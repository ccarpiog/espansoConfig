# Review brief — Phase 2d-5-4-E, the round `CLAUDE.md` §7.1 commissions for 2d-5-4-D's fix

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. Read `CLAUDE.md` at the root first —
it is binding, and its §5 (conventions), §7 (review rounds and their marks) and its paragraphs on
decision records that overclaim are the standards this review applies.

**The change under review is COMMITTED**, at `4f7c500` (*Phase 2d-5-4-D — the round 2d-5-4-C's fix
commissioned, and the round its own fix commissions*); `2561fa5` and `eb997b1` after it only record
the SHA and rewrite `PROGRESS.json`. The working tree is clean apart from four deliberate instrument
paths named at the bottom of this brief; **they are not the change under review and are never
findings**. Read the committed files at HEAD; `git show 4f7c500 -- <path>` shows a file's whole phase
diff.

## What this round is, and what it is not

This is **not** a new implementation step. `CLAUDE.md` §7.1: *a fix round that changes at least one
source file is owed a review round, scoped to that change*. Phase 2d-5-4-D was itself such a round
(Codex, `ship-with-fixes`, **1 blocker and 0 SHOULD-FIX** — the shortest finding list of this chain —
the blocker re-derived and **holding in part**, plus **five more its own sweep found that the review
had missed**); its fix changed **eight source files**, and this round reviews that fix. Its own fix,
by the same rule, decides whether another round follows — by whether it touches a source file, never
by the severity of what it found.

**The fix round is not a separate commit**: it landed inside `4f7c500`. It is therefore identified
here by **region**, from `docs/decisions/2d-5-4-D-notes.md` §2 … §7, which is the record of what each
finding changed. Read that record in full; **it is also under review** — a decision record claiming a
guarantee the code does not give is this project's worst defect class, and this chain has produced one
in several rounds.

## The fix round's scope, region by region

Eight source files: four modules and four suites. Line numbers are HEAD's and are a starting point,
not a boundary.

**1. `src/lib/browser/observationTransitions.ts`** — the blocker's fix and two of the five swept
findings.

- **The lifecycle fence in `applyAddition`** (the new block above `admit`, around 908–930, with the
  two new parameters threaded from `applyObservation` around 863–902). The fix asks the two questions
  `applyChange` already asks — *is this coordinator still applying at all*, and *is the epoch still
  the one this batch belongs to* — **synchronously between the wire-summary materialization and
  `admit`**, because `admit` is the one operation a cleared accepted-sequence map answers
  **permissively** while every `isNewest` fence fails safe.
- **`'lifecycleMoved'`**, a ninth arm of `ObservationOutcome` (around 764–777), and the
  `AcceptedSequences` doc block above it (226–239).
- **The unconditional status write in `applyAddition`** (926–929) — §5's fix, an `Added` after a
  `Removed` that left `{ kind: 'removed' }` standing over a present row.

**2. `src/lib/browser/reconciliationCoordinator.ts`** — the two lifecycle callbacks threaded to the
transition module (1409–1414), and rewritten identity comments (515–520, 669).

**3. `src/lib/browser/workspace.svelte.ts`** — the rewritten justification for `accepted.clear()` and
the other rewritten identity comments (2199–2210, 2223, 2281, 2978, 3536–3539, 3560, 3574, 3613), and
the struck claim that named the deleted host failure arm as a live reader of `documents`.

**4. `src/lib/browser/writeSurfaceRegistry.ts`** — rewritten identity comments only (78–84, 348).

**5. The four suites** — `observationTransitions.test.ts` (+2 cases, the two behavioural fixes),
`workspace.test.ts`, `reconciliationCoordinator.test.ts` and `src/lib/components/DetailPane.test.ts`
(comment and call-site follow-through).

**6. The record** — `docs/decisions/2d-5-4-D-notes.md` in full, plus the correction blocks this round
wrote into `2d-5-4-notes.md`, `2d-5-4-B-notes.md` and `2d-5-4-C-notes.md`. One of those corrects a
correction.

## Five things to point yourself at first

Each because the fix that answered a finding is where the next finding has lived in every tail this
project has run.

1. **The lifecycle fence in `applyAddition`.** Does it sit above **every** caller-controlled statement
   of that arm, and does anything between it and `admit` run caller code? Are `stillApplying` and
   `epochNow` really closures over the coordinator's own `let`s at **both** of this module's call
   sites, and is `session.epoch` an own data property rather than an accessor? And the discrimination
   claim: `workspaceOpened` sets `epoch = 0` **before** the clear, and an adopted epoch is non-zero —
   check both halves, including what happens when no epoch has been adopted yet.
2. **`'lifecycleMoved'`, a ninth arm of a union nothing switches over.** The record says it buys no
   compile-time check. Check that, and check the two docs it leans on — `'superseded'`'s and
   `observationsDropped`'s — still say what the record quotes. Does any counter, test helper or
   assertion treat an unknown outcome as a failure, or as an admission?
3. **The sixteen rewritten comments.** They are now six distinct justifications rather than one
   sentence repeated, so **no single sweep finds them again**. Re-derive the Rust contract for
   yourself (`Workspace::from_tree`, `identity_of`, `session_identities` under `crates/` and
   `src-tauri/`) and check each rewritten sentence against it — and sweep **by shape** for a
   seventeenth instance and for any **narrower wording** left behind, which is what the last four
   rounds each found.
4. **The unconditional status write in `applyAddition`.** It now writes `null` where the content
   projected. Is the `isNewest` fence around it the same fence `applyRemoval` uses; can it clear a
   mark a **newer** observation wrote; and is *"there is one newest truth at that moment"* true of
   every path that reaches it, including a same-batch `Named` row and an in-flight reread's capture?
5. **The correction blocks, in three record files, one of which corrects a correction.** Check each
   against the code it describes, and sweep for a **narrower wording** of what each one struck.

## Standards this project applies, in short

- A decision record or a comment that claims a guarantee the code does not give is a **finding**, and
  the most valuable kind here: no test can fail one.
- Where TypeScript cannot force something, the sentence that describes what it *does* force must say
  so in the same breath.
- A check and a spend separated by any property read are **not atomic** — a property read runs
  arbitrary code through a getter or a `Proxy` trap, and `readonly` does not freeze at runtime.
- A consuming operation whose **result is discarded** is a check-and-spend defect; sweep for the
  **shape**, never for the words of a finding already closed.
- Comment-only changes are still source changes under §7.1, and this tail has been almost entirely
  about whether comments tell the truth. Check `file:line` citations resolve — four stale cross-file
  citations under `src/` are a known open class here and are **not** this round's findings.

## Verification already run — do not re-run

The ladder's live rung, measured in full at 2d-5-4-D on this exact tree:

- `cargo test --workspace -- --test-threads=1` → **1320**, summed over **26** `test result` lines and
  checked by both complementary questions (no line lacking `0 failed`, none lacking `0 filtered out`).
  No Rust changed.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**.
- `npm test` → **2406 tests**, exit 0.
- `npm run build` → **189 modules**; both bundle oracles read — server-only markers absent,
  client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before. Read the code.

## Known and declared, not findings

- The four uncommitted instrument paths — `src-tauri/src/probe.rs`, `src/probe.ts`, and two hook
  lines each in `src-tauri/src/main.rs` and `src/main.ts` — are the temporary window-reading
  instrument. They are deliberate, never committed, and a later step deletes them. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)`.
- 2d-5-4-D added **no user-facing string in any language** and touched **no `.svelte` file**, so no
  window reading is owed. A round that disagrees should say so; the remedy would be a reading, not a
  revert.
- The blocker is **not production-reachable**: wire values are JSON-parsed plain objects, and the one
  production re-entrancy candidate, `WriteSurfaceTransition`, is registered as a no-op. Say if that is
  wrong; do not report the fix as unnecessary merely because the driver is injected.
- **`docs/decisions/2d-5-4-D-notes.md` §9 is a record, not a work list** (§7.3). Its eight items are
  the previous round's own nomination of where it is thin; read them, and treat item 3 — the only
  **actionable** one, the same false identity claim standing 23 times under `docs/` — as a check worth
  running rather than as a defect already established.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4-E.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived from the code before it is accepted, and reviewers' arithmetic has
been wrong in several of the last rounds. Say explicitly when a finding is about the **record** rather
than about source: under §7.1 that distinction decides whether another round runs.

Time budget: 25 minutes.
