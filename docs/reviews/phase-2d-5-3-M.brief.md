# Review brief — Phase 2d-5-3-M

Repo: `/Users/ccarpio/Developer/Utils/espansoConfig` (branch `main`, HEAD `ed00fb3`; the only change
HEAD carries over `c39831f` is `PROGRESS.md` and `PROGRESS.json`).
Review file — write your full report there, overwriting: `docs/reviews/phase-2d-5-3-M.md`.
Time budget: 10 minutes.

## Phase and goal

Phase 2d-5-3-M is round 13 of the `reconciliationCoordinator.ts` review tail — the round `CLAUDE.md`
§7.1 commissioned because Phase 2d-5-3-L's fix changed one source file. The goal of this round is to
review THAT fix, cold: is what it wrote true of the code?

## What to review — the whole scope, and nothing else

The change under review is ALREADY COMMITTED as `c39831f` (Phase 2d-5-3-L). Read it with:

    git show c39831f --stat
    git show c39831f -- src/lib/browser/reconciliationCoordinator.ts
    git show c39831f -- docs/decisions/2d-5-3-K-notes.md docs/decisions/2d-5-3-J-notes.md

1. `src/lib/browser/reconciliationCoordinator.ts` — comment-only, one hunk, two rewritten passages
   (lines **787–805** on HEAD, inside the `awaitingReady`/post-await refusal arm):
   (a) the two-witness sentence, now *"**Of the two tests cited here, one drives that overlap and does
       so against an injected host, and the other does not drive it at all; nothing wider is claimed
       here.**"* (789–792), and the *"so it is the one that does not"* clause that follows it (795);
   (b) the body of `workspaceReady()` as the comment now states it — *"whose body is `openInProgress =
       false` and then `requestDrain('workspaceOpened')`; a superseded open returns at a generation
       check and never reaches `workspaceReady()`"* (797–800).
2. `docs/decisions/2d-5-3-L-notes.md` in full — every claim it makes about the code, the tests, the
   commits `aa025fa` / `26fa26a` / `c39831f`, and every count and line number in it.
3. The two correction blocks 2d-5-3-L wrote into `docs/decisions/2d-5-3-K-notes.md`
   (`rg -n 'Correction, 2d-5-3-L' docs/decisions/2d-5-3-K-notes.md`) and the amendment it made in
   place inside `docs/decisions/2d-5-3-J-notes.md` (`rg -n '2d-5-3-L' docs/decisions/2d-5-3-J-notes.md`).

## The instruction that has found the substantive finding of every round of this tail

**Check the comments against the code, not the code against the comments.** Hunt the ADDITIONS.
Eleven of the twelve rounds A…L found a real defect in the previous round's fix, and every one of
them was a sentence that was *nearly* true. Each proposition below is asserted by the new comment
text or by the notes and nothing in the repository pins any of it — read the code and decide whether
each is true:

- **"Of the two tests cited here"** is itself a claim: that the paragraph cites **exactly two** tests.
  Count the citations in the paragraph as it now stands (787–812), not in the record.
- **`./reconciliationCoordinator.test.ts`'s *"installs nothing from a drain an open overtook"* drives
  an open landing while a drain is in flight, and does so against an injected host.** Read that test
  body. Does an open actually land *during* an outstanding drain await in it, and is the host injected?
- **`./workspace.test.ts`'s *"lets the newer open win, however late the older one answers"* does not
  drive that overlap at all** — and the new *"so it is the one that does not"* infers this from
  *"issues no drain at all"*. Is the inference valid as written, and does *"the one that does not"*
  have an unambiguous antecedent three lines under the sentence that introduces two tests?
- **`workspaceReady()`'s body is `openInProgress = false` and then `requestDrain('workspaceOpened')`.**
  Read the function. Are those exactly its statements, in that order, with nothing else — and is the
  order as stated?
- **"a superseded open returns at a generation check and never reaches `workspaceReady()`"** is a
  **universal about superseded opens**, where the sentence it replaced spoke of *the* superseded open
  in one named test. `open()` in `src/lib/browser/workspace.svelte.ts` has more than one early
  return, and its own comment enumerates them. Is *every* superseded open's return a **generation**
  check? Can an open be superseded and leave by some other return — or reach `workspaceReady()`
  anyway? An over-general replacement for a true narrow claim is this tail's most frequent defect.
- The claim is also sited: the losing open **in the cited test** must be the one that hits the
  generation check. Read that test and confirm **which** check it hits.
- The surviving K-era propositions the sentence still carries: unconditional construction of the
  coordinator by `createBrowserState`, `workspaceOpened()` called synchronously before the first
  await by *every* `open()`, `drainMayStart()` false because the test never calls `start()`, and the
  request therefore **remembered rather than issued**. 2d-5-3-L re-derived these and recorded them as
  holding (`2d-5-3-L-notes.md` §4); a *false* "holds" is worse than a missed finding, so spot-check
  them rather than inherit them.

Read `open()` and `workspaceReady()` in `workspace.svelte.ts` IN FULL, not the lines the notes quote.

Then check the record. `2d-5-3-L-notes.md` asserts line numbers, quoted sentences, gate figures
(`1320 / 441 / 2307 / 188`, 26 `test result` lines), archive sizes (118 + 54 + 42 + 22 lines) and a
`PROGRESS.md` measurement (689 lines / 119,264 bytes on the tree `c39831f` committed). Every one is a
claim about a tree: re-derive what you can with `git show`, `sed`, `awk` and `wc`, say which tree you
measured, and report anything you could not resolve under NOT-VERIFIED rather than passing it. §5's
host-finding account (the stale `target/` from the repository's previous location, the full
`cargo clean`) is a claim about a host, not a tree — check only that the notes do not turn it into a
claim about source. §7's marks matter: an item marked **actionable** that names a correctness defect
in a source file would hold this step open under `CLAUDE.md` §7.3, so say if you think one does.

## Verification already run by the orchestrator — do not repeat it

All four gates were green on the tree 2d-5-3-L committed: `cargo test --workspace -- --test-threads=1`
→ 1320 passed across 26 `test result` lines, none lacking `0 failed`; clippy `-D warnings` exit 0;
`cargo fmt --check` exit 0; `cargo tree -p espansoconfig-core` finds no `tauri`; `npm run check` →
441 files, 0 errors, 0 warnings; `npm test` → 2307 passed; `npm run build` → 188 modules, server-only
markers absent, client-only markers present. The orchestrator has re-run the same gates on the
inherited tree before commissioning this review.

## HARD RULE — run NO build, test, lint, package or cargo command of any kind

Not `cargo test`, `cargo build`, `cargo check`, `cargo clippy`, `cargo tree`, `npm test`,
`npm run check`, `npm run build`, `npx vitest`, `npx svelte-check`, `tsc` — nothing that compiles,
tests or bundles. This host has a measured filesystem-watcher concurrency scar, and a stale-`target/`
scar on top of it: any such run can corrupt the orchestrator's readings. Review by reading.
`git show`, `git log`, `git grep`, `rg`, `cat`, `sed`, `awk`, `wc` are fine. State under NOT-VERIFIED
that no build/test command was run, by instruction.

## Recorded risks and things not to touch

- The working tree is deliberately not clean: `src-tauri/src/main.rs` and `src/main.ts` (modified)
  and `src-tauri/src/probe.rs` and `src/probe.ts` (untracked) are a window-reading instrument that is
  never committed. They are OUT OF SCOPE: do not treat them as part of the change, and do not modify,
  revert or commit them.
- `PROGRESS.md`, `PROGRESS.json` and `docs/progress-archive/` may change under you while you read;
  they are the orchestrator's checkpoint and are not in scope.
- Quote the line you are pointing at **and** give its number on HEAD, so the orchestrator can
  re-derive it. Reviewer arithmetic was wrong in two of the last three rounds; it held in the last.
- Severity: a false statement in a source comment is SHOULD-FIX (Medium); a stale line anchor or a
  wrong count in a `docs/` record is SHOULD-FIX (Low, unless it changes a conclusion). Finding
  nothing at a severity is a valid answer; this tail's records treat a fabricated finding as worse
  than a missed one.

## Report

Write the full report (400 words max) to `docs/reviews/phase-2d-5-3-M.md`. Its first line must read
exactly `Reviewer: autoclaude adversarial reviewer`; end with the four keys VERDICT / BLOCKERS /
SHOULD-FIX / NOT-VERIFIED. Return only those four lines to the orchestrator.
