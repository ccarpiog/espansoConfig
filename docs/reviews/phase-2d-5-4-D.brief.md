# Review brief — Phase 2d-5-4-D, the round `CLAUDE.md` §7.1 commissions for 2d-5-4-C's fix

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. Read `CLAUDE.md` at the root first —
it is binding, and its §5 (conventions), §7 (review rounds and their marks) and its paragraphs on
decision records that overclaim are the standards this review applies.

**The change under review is COMMITTED**, at `f3ba2cd` (*Phase 2d-5-4-C — the round 2d-5-4-B's fix
commissioned, and the round its own fix commissions*); `2d192ce` after it only records the SHA. The
working tree is clean apart from four deliberate instrument paths named at the bottom of this brief;
**they are not the change under review and are never findings**. Read the committed files at HEAD;
`git show f3ba2cd -- <path>` shows a file's whole phase diff.

## What this round is, and what it is not

This is **not** a new implementation step. `CLAUDE.md` §7.1: *a fix round that changes at least one
source file is owed a review round, scoped to that change*. Phase 2d-5-4-C was itself such a round
(Codex, `ship-with-fixes`, 1 blocker + 3 should-fix, all four re-derived and all four holding — one
only in part — plus **five more its own re-derivation found that the review had missed**); its fix
changed **four source files**, and this round reviews that fix. Its own fix, by the same rule, decides
whether another round follows — by whether it touches a source file, never by the severity of what it
found.

**The fix round is not a separate commit**: it landed inside `f3ba2cd`. It is therefore identified
here by **region**, from `docs/decisions/2d-5-4-C-notes.md` §2 … §9, which is the record of what each
finding changed.

## The fix round's scope, region by region

Four source files. Every line and symbol below is what the fix round wrote or rewrote; line numbers
are HEAD's and are a starting point, not a boundary.

**1. `src/lib/browser/workspace.svelte.ts`**

- **`ownedRepair` (737–759)** — the blocker's fix. The `kept` arm no longer passes `repair.selected`
  through whole; the `SelectedMatch` is rebuilt field by field, its identity through
  `ownedMatchIdOf` (498–504). The claim to check with it is the swept one: *this was the **only**
  unnormalized ingress into `selected`*, a sweep whose first table omitted a producer
  (`adoptAfterTheDeletion`, 4917–4941) that the fix worker added afterwards.
- **The deleted failure arm of the private reread** — the production-reachable should-fix. The arm
  in `rereadUnderGuard` (3051–3146) that re-stated an existing `stale` on failure is **gone**;
  `noteDocumentStatus` (2922–2929) and `statusWriteOf` (2942–2944) are unchanged in behaviour, and
  the argument is that the arm could never change a *value* while the token it advanced was the whole
  of its effect, the failure still being reported by `report`. **This is the only fix of this chain
  that removed behaviour rather than adding a check.**
- **`ownedSummaryOf` (694–704) and `open()`'s publication of `documents`** (the hunk at ~3612–3630).
  `open()` re-checks its generation after the copied rows and before publishing them.
- **The coordinator-facing `rereadUnderGuard` member (2457–2466)**, which now writes the initial
  `stale` mark **under a predicate the caller hands over**, in the same synchronous block as the mark.

**2. `src/lib/browser/observationTransitions.ts`**

- **`ReconciliationWorkspace.rereadUnderGuard` (603–623)** — a third `() => boolean` parameter,
  `owns`, beside `guard`, distinguished only by its name and its JSDoc, which says in as many words
  that nothing in the type makes it a question about ownership. `applyChange` (889–1070) is its only
  caller today, passing `stillOurs` (918).
- **Four newly fenced status writers** — `applyChange`'s `markStaleWhileOurs` (943) reached from four
  arms (1031, 1035, 1041's callback, 1053), `applyAddition` (844–863) asking `isNewest` inline at 859
  with the wire summary materialized **above** `admit`, `applyRemoval` (1149–1169) at 1165, and
  `applyNamedRow` (1227–1279) at 1251.
- **`applyUnreadable` (1191–1201) is the one writer deliberately left unfenced**, justified in its
  JSDoc positionally: no statement stands between the check and the write, and both values it reads
  are own data properties of a literal built before arbitration.

**3–4. The two suites** — `workspace.test.ts` and `observationTransitions.test.ts`. **Nine** cases net,
each confirmed to fail against the pre-fix code by reverting the change, running the one suite and
restoring it; the messages are in `docs/decisions/2d-5-4-C-notes.md` §12. One case was **re-pointed**
rather than added, because the deleted failure arm removed what a 2d-5-4-B case measured, and one
candidate case was **run and discarded** for passing against both trees.

**Also in scope: `docs/decisions/2d-5-4-C-notes.md` in full**, its §13 *where it is thin* marks
included, and **the correction blocks this round wrote into `docs/decisions/2d-5-4-notes.md`,
`docs/decisions/2d-5-4-A-notes.md` and `docs/decisions/2d-5-4-B-notes.md`** — one of which corrects a
correction a previous round wrote.

## Where a finding has lived in every tail this project has run

Point the review at these first. Each is the fix that answered a finding, which is exactly where the
next finding has been found here.

1. **The deleted failure arm.** Check **both halves** of its argument against the code: that the arm
   could never change a value, and that `report` already carries the failure on the channel every
   other failure of this state uses. Then check **what else the deleted clause was carrying** —
   `CLAUDE.md` records 2d-5-3-H as exactly that failure, a removal taking with it the only clause that
   carried a time index. Is there now a path that leaves a file marked `stale` with nothing able to
   clear it, or one that clears a mark it did not set, or a failure that reaches no channel at all?
2. **`ownedRepair`'s rebuilt `SelectedMatch`.** It claims the compile-error property the other four
   normalizers claim, with the same **optional-member** caveat: an optional property omitted from an
   object literal is not a TypeScript error. Check the declared shape of `SelectedMatch` and of
   `MatchId`. Is `ownedMatchIdOf` applied to **every** identity the arm carries? And is the swept
   claim — *the only unnormalized ingress into `selected`* — still true after the sweep gained a
   producer its first table missed? Sweep **by shape**: every write to `selected`, never by the line
   numbers above.
3. **`owns` on the `ReconciliationWorkspace` interface.** Do the call sites pass the right one of the
   two `() => boolean` parameters; can any caller reach the member **without** one; and does
   `stillOurs` answer the question the mark needs **at the moment the mark is written** rather than at
   the moment the closure was built? A closure capturing `route.sequence` answers about a sequence,
   not about a window.
4. **The four newly fenced writers, and the fifth left unfenced.** `applyUnreadable`'s justification
   is positional in the precise sense this chain has twice found false. Is it true of **every path**
   into it, and does the literal it reads really carry own data properties at both reads? For the four
   fenced ones: is each capture taken **after** the arm's own mark, and can anything between a capture
   and its comparison run caller code?
5. **The correction blocks, in three files now.** One of them corrects a correction. A correction
   block is a source of new false claims in this project's history — three of 2c-3a-1's ten findings
   were regressions a previous round's fix introduced. Check each against the code it describes, and
   **sweep for a narrower wording of what each one struck**: that is precisely what 2d-5-4-C found
   still standing from 2d-5-4-B, and 2c-4a-3a's round 2 before it.

Two standing shapes to sweep for, **by shape and never by the words of a past finding**:

- **A consuming operation whose result is discarded**, and a check and a spend separated by any
  property read — this project has shipped that twice in one phase. `readonly` freezes nothing at
  runtime and a getter or a proxy trap runs arbitrary code. Note the `void` on the private reread's
  call at 2465: its answer is discarded on purpose, and the argument for why that is safe is in the
  member's JSDoc — check it.
- **A comment asserting a contract the code does not give.** The fourteen-round 2d-5-3 tail was
  entirely about whether comments tell the truth; no test can fail one. Check `file:line` citations
  resolve — four stale cross-file citations under `src/` are a known open class here.

## Verification already run — do not re-run

The ladder's live rung, measured in full at 2d-5-4-C on this exact tree:

- `cargo test --workspace -- --test-threads=1` → **1320**, summed over **26** `test result` lines and
  checked by the complementary question (no line lacking `0 failed`). No Rust changed.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**.
- `npm test` → **2404 tests**, exit 0.
- `npm run build` → **189 modules**; both bundle oracles read — server-only markers absent,
  client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before. Read the code.

## Known and declared, not findings

- The four uncommitted instrument paths — `src-tauri/src/probe.rs`, `src/probe.ts`, and two hook
  lines each in `src-tauri/src/main.rs` and `src/main.ts` — are the temporary window-reading
  instrument. They are deliberate, never committed, and a later step deletes them. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)`.
- 2d-5-4-C added **no user-facing string in any language** and touched **no `.svelte` file**, so no
  window reading is owed. A round that disagrees should say so; the remedy would be a reading, not a
  revert.
- The two things 2d-5-4 hands forward on purpose are still handed forward: a removed target ships as
  state and not as telling (2d-5-5's), and the unbounded blocked-drop is restated rather than fixed.
  Say if either is wrong to hand forward, not merely that it is handed forward.
- **`docs/decisions/2d-5-4-C-notes.md` §13 is a record, not a work list** (§7.3). Its eight items are
  the previous round's own nomination of where it is thin; read them, and treat item 3 — the only
  **actionable** one — as a check worth running rather than as a defect already established.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4-D.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived from the code before it is accepted, and reviewers' arithmetic has
been wrong in several of the last rounds. Say explicitly when a finding is about the **record** rather
than about source: under §7.1 that distinction decides whether another round runs.

Time budget: 25 minutes.
