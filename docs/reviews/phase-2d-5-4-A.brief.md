# Review brief — Phase 2d-5-4-A, the round `CLAUDE.md` §7.1 commissions for 2d-5-4's fix

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. Read `CLAUDE.md` at the root first —
it is binding, and its §5 (conventions), §7 (review rounds and their marks) and its paragraphs on
decision records that overclaim are the standards this review applies.

**The change under review is COMMITTED**, at `81e54db` (*Phase 2d-5-4 — the observation state
transitions*). The working tree is clean apart from four deliberate instrument paths named at the
bottom of this brief; **they are not the change under review and are never findings**. Read the
committed files at HEAD; `git show 81e54db -- <path>` shows a file's whole phase diff.

## What this round is, and what it is not

This is **not** a new implementation step. `CLAUDE.md` §7.1: *a fix round that changes at least one
source file is owed a review round, scoped to that change*. Phase 2d-5-4's review (Codex,
`ship-with-fixes`, 2 blockers + 3 should-fix) was answered by a fix round that changed **six source
files**, and this round reviews that fix. Its own fix, by the same rule, decides whether another
round follows — by whether it touches a source file, never by the severity of what it found.

**The fix round is not a separate commit**: it landed inside `81e54db` with the phase's original
build. It is therefore identified here by **region**, from
`docs/decisions/2d-5-4-notes.md` §8, which is the record of what each finding changed.

## The fix round's scope, region by region

Six source files. Every line and symbol below is what the fix round wrote or rewrote.

**1. `src/lib/browser/workspace.svelte.ts`** (4590 lines)

- `rereadUnderGuard()` at **2654–2705** — finding 1's fix. The three captures are compared and the
  install happens with the answer **materialized once** before both readings, because `commands` is
  injected and a `value` getter is caller-controlled code. Its JSDoc states what is guaranteed *and*
  that the copy is **shallow**, so `next.matches` is still the command's own array and `repairAfter`
  reads elements this module did not build after the installation.
- The host's `rereadUnderGuard` member at **2119–2125** — finding 4's fix: the outcome is no longer
  discarded; the file is marked stale before the read and only the success arm clears it.
- `pendingAdditions` at **2001**, written at **2489–2546**, cleared at **3119**, subtracted by
  `fileTextTarget()` at **2727–2733** and consumed at **2773, 2924–2943** — finding 3's fix, so a
  pending `Added` identity cannot reach a document command through the raw viewer.

**2. `src/lib/browser/observationTransitions.ts`** (1137 lines)

- `ObservationSession.stillApplying()` — the declaration and its JSDoc at **683–705**, and the guard
  at **873–934**, where it is asked **first** of five questions and its refusal marks `stale` and
  never clears it. Finding 2's fix.

**3. `src/lib/browser/reconciliationCoordinator.ts`** (1515 lines)

- The typed block at **185–234**, the `blockedByLostHistory` arm at **899–901**, and the answer
  `stillApplying: () => !disposed && block.kind !== 'blockedByLostHistory'` at **934**.

**4–6. The three suites** — `workspace.test.ts` (8610 lines), `observationTransitions.test.ts` (904),
`reconciliationCoordinator.test.ts` (1930). New cases per finding, plus finding 5's rewrite: both
routing cases now take their command counts **before** the observations are fetched and deliver them
through a controlled wake, and compare **all six** reading commands of the open workspace, through
the new `documentCommandCounts` / `expectNoDocumentCommandSince` helpers.

**Also in scope: `docs/decisions/2d-5-4-notes.md`** in full — its three **marked correction blocks**
(§3.3's *"with nothing between them"*, §3.5's reachability claim and its evidence sentence, §3.7's
count), its §7 *where it is thin* marks, and its §8 account of the round.

## Where a finding has lived in every tail this project has run

Point the review at these first. Each is the fix that answered a finding, which is exactly where the
next finding has been found here.

1. **The new fifth guard question.** `stillApplying()` is `!disposed && block.kind !==
   'blockedByLostHistory'`. Does it answer correctly across an `open()` that *does* recover, where the
   block is cleared and the open generation moves in the same step? Is asking it **first** right, or
   does it mask a staler refusal that should have been reported instead?
2. **The shallow copy `rereadUnderGuard` now takes.** Its JSDoc says `repairAfter` still reads the
   command's own array *after* the installation and that `replaceSelection`'s discipline is what
   bounds it. **Check that claim against `replaceSelection`.** It is exactly the shape of a record
   claiming a guarantee the code does not give — and it is now written into **source**.
3. **`pendingAdditions`.** It is a third piece of retained state beside `acceptedSequenceByDocument`
   and `projectionGenerations`, and ruling 6's warning is that **nothing enforces which one a
   transition consults**. Is it cleared on every path that should clear it? Does any arm read the
   wrong map? Is the membership test itself atomic?
4. **The stale mark's lifecycle.** Three fixes now write it — the guard's refusal, the reread's start
   and the failure arm — and one clears it. Is there a path that marks and never clears, or one that
   clears a mark it did not set?
5. **The record's corrections.** A correction block is a source of new false claims in this project's
   history: three of 2d-5-3-A's ten findings were regressions a previous round's fix introduced.
   Check each of the three correction blocks against the code it describes.

Two standing shapes to sweep for, **by shape and never by the words of a past finding**:

- **A consuming operation whose result is discarded**, and a check and a spend separated by any
  property read — this project has shipped that twice in one phase. `readonly` freezes nothing at
  runtime and a getter or a proxy trap runs arbitrary code.
- **A comment asserting a contract the code does not give.** The fourteen-round 2d-5-3 tail was
  entirely about whether comments tell the truth; no test can fail one. Check `file:line` citations
  resolve — four stale cross-file citations under `src/` are a known open class here.

## Verification already run — do not re-run

The ladder's live rung, measured in full at 2d-5-4 on this exact tree:

- `cargo test --workspace -- --test-threads=1` → **1320**, summed over **26** `test result` lines and
  checked by the complementary question (no line lacking `0 failed`). No Rust changed.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**.
- `npm test` → **2380 tests in 61 files**, exit 0.
- `npm run build` → **189 modules**; both bundle oracles read — server-only markers absent,
  client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before. Read the code.

## Known and declared, not findings

- The four uncommitted instrument paths — `src-tauri/src/probe.rs`, `src/probe.ts`, and two hook
  lines each in `src-tauri/src/main.rs` and `src/main.ts` — are the temporary window-reading
  instrument. They are deliberate, never committed, and a later step deletes them. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)`.
- Two things 2d-5-4 hands forward on purpose: a removed target ships as state and not as telling
  (`WriteSurfaceTransition` takes the narrowed `Changed`/`Projected` snapshot, so a `Removed` or
  `Unreadable` observation reaches no surface — 2d-5-5's), and the unbounded blocked-drop is
  restated rather than fixed, with `observationsDropped()` counting only blocked drops. Say if either
  is wrong to hand forward, not merely that it is handed forward.
- 2d-5-4's `DetailPane.svelte` change is comment-only and was verified mechanically (`git diff -U0`
  filtered to non-JSDoc changed lines returns nothing), so no window reading is owed. A round that
  disagrees should say so; the remedy would be a reading, not a revert.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4-A.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived from the code before it is accepted, and reviewers' arithmetic has
been wrong in three of the last five rounds. Say explicitly when a finding is about the **record**
rather than about source: under §7.1 that distinction decides whether another round runs.

Time budget: 25 minutes.
