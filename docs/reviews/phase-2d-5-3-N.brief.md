# Review brief — Phase 2d-5-3-N

Repo: `/Users/ccarpio/Developer/Utils/espansoConfig` (branch `main`, HEAD `455a63a`; the only changes
HEAD carries over `1e80603` are `PROGRESS.md` and `PROGRESS.json`).
Review file — write your full report there, overwriting: `docs/reviews/phase-2d-5-3-N.md`.
Time budget: 10 minutes.

## Phase and goal

Phase 2d-5-3-N is round 14 of the `reconciliationCoordinator.ts` review tail — the round `CLAUDE.md`
§7.1 commissioned because Phase 2d-5-3-M's fix changed one source file. The goal of this round is to
review THAT fix, cold: is what it wrote true of the code?

## What to review — the whole scope, and nothing else

The change under review is ALREADY COMMITTED as `1e80603` (Phase 2d-5-3-M). Read it with:

    git show 1e80603 --stat
    git show 1e80603 -- src/lib/browser/reconciliationCoordinator.ts
    git show 1e80603 -- docs/decisions/2d-5-3-L-notes.md

1. `src/lib/browser/reconciliationCoordinator.ts` — comment-only, one hunk, **2 insertions and 1
   deletion**, inside the `awaitingReady`/post-await refusal arm. The rewritten clause is lines
   **799–801** on HEAD:

       the open this test supersedes returns at the generation check directly
       under its own `openWorkspace` await, so it never reaches
       `workspaceReady()`.

   It replaced *"a superseded open returns at a generation check and never reaches
   `workspaceReady()`"*. Read the whole comment block it sits in (**787–812**), because a replacement
   inherits the sentences around it.
2. `docs/decisions/2d-5-3-M-notes.md` in full — every claim it makes about the code, the tests, the
   commits, and every count and line number in it.
3. The three marked corrections 2d-5-3-M wrote into `docs/decisions/2d-5-3-L-notes.md` — one block in
   §3 and two in §4 and §7 item 3 (`rg -n '2d-5-3-M' docs/decisions/2d-5-3-L-notes.md`).

## The instruction that has found the substantive finding of every round of this tail

**Check the comments against the code, not the code against the comments.** Hunt the ADDITIONS.
Twelve of the thirteen rounds A…M found a real defect in the previous round's fix, and every one of
them was a sentence that was *nearly* true. This round's fix swapped a **universal** for a **sited**
claim, and **a sited claim can be wrong about its site**. Each proposition below is asserted by the
new comment text or by the notes, and nothing in the repository pins any of it — read the code and
decide whether each is true:

- **"the open this test supersedes"** presumes the cited test supersedes **exactly one** open, and
  that the one it means is unambiguous. The test is `src/lib/browser/workspace.test.ts:1229`,
  *"lets the newer open win, however late the older one answers"*. Read the whole `it` body. How
  many opens does it start, how many are superseded, and does the singular definite article name one
  of them without ambiguity?
- **"the generation check directly under its own `openWorkspace` await"** identifies a check by
  **position** rather than by number. Read `open()` in `src/lib/browser/workspace.svelte.ts` IN FULL.
  Is there exactly one generation check directly under the `await commands.openWorkspace(root)` the
  losing open is parked on? Is that the check the parked open reaches **first**, with nothing else
  between the await and it? And does *"its own"* resolve to the parked open's await rather than to
  the winner's?
- **"so it never reaches `workspaceReady()`"** is now an inference from where the open returns, not a
  claim about superseded opens in general. Is the inference valid as written — does returning at that
  check in fact preclude reaching `workspaceReady()` on that path? And is there any clause **left
  standing** in 787–812 that still reads as the universal M's finding rejected? A replacement that
  narrows one sentence while an untouched neighbour keeps the wide claim is this tail's shape twice
  over (2d-5-3-H, 2d-5-3-L).
- **The M notes' own mechanism account** (§2) is the reasoning the fix rests on: `open()` holds
  **three** generation checks at `2604`, `2625` and `2661`, the third **inside** the per-document
  loop; between that loop's end and `reconciliation.workspaceReady()` at `2687` there is **no check
  and no await at all**; `report` is an injected parameter of `createBrowserState` at `1715`, called
  **inside** that loop at `2672`. Every one of those is a line number and a structural claim about a
  file the review tail has repeatedly found miscited. Re-derive them.
- **The surviving propositions the sentence still carries**, re-derived by M (§4) and recorded as
  holding: `workspaceReady()`'s body is exactly `openInProgress = false;` then
  `requestDrain('workspaceOpened')`, in that order; *"Of the two tests cited here"* cites exactly two
  and the two-witness attribution is the right way round; the coordinator is constructed
  unconditionally; `workspaceOpened()` runs at `2569` before the first await; `openGeneration` is
  written in one place only (`2554`); `drainMayStart()` is false because the test never calls
  `start()`. **A false "holds" is worse than a missed finding** — spot-check rather than inherit.
- **The Low that M fixed in the record** dropped a count and an end line: `2d-5-3-L-notes.md` §4 and
  §7 item 3 had *"the eleven `the reconciliation lifecycle` tests at `workspace.test.ts:7535-7790`"*,
  and M says the suite opens at 7535, closes at **7779** and holds **ten** `it(` blocks (7536, 7549,
  7566, 7591, 7628, 7650, 7677, 7698, 7732, 7758). Count them yourself. M's correction blocks assert
  those numbers while dropping them from the claim — check that the correction is itself correct, and
  that the **bounded absence claim** the paragraph makes survives without the figure.

Read `open()`, `workspaceReady()` and the cited test bodies IN FULL, not the lines the notes quote.

Then check the record. `2d-5-3-M-notes.md` asserts line numbers, quoted sentences, gate figures
(`1320 / 441 / 2307 / 188`, 26 `test result` lines, two full runs), archive sizes (93 + 40 + 29
lines) and a `PROGRESS.md` measurement on the tree `1e80603` committed. Every one is a claim about a
tree: re-derive what you can with `git show`, `sed`, `awk` and `wc`, say which tree you measured, and
report anything you could not resolve under NOT-VERIFIED rather than passing it. §1.2's account of
the truncated Codex report is a claim about a tool, not a tree — check only that the notes do not
turn it into a claim about source. §6's marks matter: an item marked **actionable** that names a
correctness defect in a source file would hold this step open under `CLAUDE.md` §7.3, so say if you
think one does.

## Verification already run by the orchestrator — do not repeat it

All four gates were green on the tree 2d-5-3-M committed, on two full runs: `cargo test --workspace
-- --test-threads=1` → 1320 passed across 26 `test result` lines, none lacking `0 failed`; clippy
`-D warnings` exit 0; `cargo fmt --check` exit 0; `cargo tree -p espansoconfig-core` finds no
`tauri`; `npm run check` → 441 files, 0 errors, 0 warnings; `npm test` → 2307 passed; `npm run build`
→ 188 modules, server-only markers absent, client-only markers present. The orchestrator is re-running
the same gates on the inherited tree while you read.

## HARD RULE — run NO build, test, lint, package or cargo command of any kind

Not `cargo test`, `cargo build`, `cargo check`, `cargo clippy`, `cargo tree`, `npm test`,
`npm run check`, `npm run build`, `npx vitest`, `npx svelte-check`, `tsc` — nothing that compiles,
tests or bundles. This host has a measured filesystem-watcher concurrency scar, and a stale-`target/`
scar on top of it: any such run can corrupt the orchestrator's readings, which are in flight right
now. Review by reading. `git show`, `git log`, `git grep`, `rg`, `cat`, `sed`, `awk`, `wc` are fine.
State under NOT-VERIFIED that no build/test command was run, by instruction.

## Recorded risks and things not to touch

- The working tree is deliberately not clean: `src-tauri/src/main.rs` and `src/main.ts` (modified)
  and `src-tauri/src/probe.rs` and `src/probe.ts` (untracked) are a window-reading instrument that is
  never committed. They are OUT OF SCOPE: do not treat them as part of the change, and do not modify,
  revert or commit them.
- `PROGRESS.md`, `PROGRESS.json` and `docs/progress-archive/` may change under you while you read;
  they are the orchestrator's checkpoint and are not in scope.
- Quote the line you are pointing at **and** give its number on HEAD, so the orchestrator can
  re-derive it. Reviewer arithmetic was wrong in two of the last four rounds.
- Severity: a false statement in a source comment is SHOULD-FIX (Medium); a stale line anchor or a
  wrong count in a `docs/` record is SHOULD-FIX (Low, unless it changes a conclusion). Finding
  nothing at a severity is a valid answer; this tail's records treat a fabricated finding as worse
  than a missed one.

## Report

Write the full report (400 words max) to `docs/reviews/phase-2d-5-3-N.md`. Its first line must read
exactly `Reviewer: autoclaude adversarial reviewer`; end with the four keys VERDICT / BLOCKERS /
SHOULD-FIX / NOT-VERIFIED. Return only those four lines to the orchestrator.
