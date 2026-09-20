# Review brief — Phase 2d-5-4-G, the round `CLAUDE.md` §7.1 commissions for 2d-5-4-F's fix

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. Read `CLAUDE.md` at the root first —
it is binding, and its §5 (conventions), §7 (review rounds and their marks) and its paragraphs on
decision records that overclaim are the standards this review applies.

**The change under review is COMMITTED**, at `c410548` (*Phase 2d-5-4-F — the round 2d-5-4-E's fix
commissioned, and the round its own fix commissions*); `d3aa4d8` and `bfc323e` after it only record
the SHA, the push result and the rewritten `PROGRESS.json`. The working tree is clean apart from four
deliberate instrument paths named at the bottom of this brief; **they are not the change under review
and are never findings**. Read the committed files at HEAD; `git show c410548 -- <path>` shows a
file's whole phase diff.

## What this round is, and what it is not

This is **not** a new implementation step. `CLAUDE.md` §7.1: *a fix round that changes at least one
source file is owed a review round, scoped to that change*. Phase 2d-5-4-F was itself such a round
(Codex, `ship-with-fixes`, **2 blockers and 2 SHOULD-FIX** — all four re-derived and all four
holding, the first with its anchor blunt — plus **seven more its own sweep found that the review had
missed**, one of them a correctness defect in source that §7.3 made fix-now-or-`BLOCKED`); its fix
changed **four source files**, and this round reviews that fix. Its own fix, by the same rule,
decides whether another round follows — by whether it touches a source file, never by the severity of
what it found.

**The fix round is not a separate commit**: it landed inside `c410548`. It is therefore identified
here by **region**, from `docs/decisions/2d-5-4-F-notes.md` §2 … §8, which is the record of what each
finding changed. Read that record in full; **it is also under review** — a decision record claiming a
guarantee the code does not give is this project's worst defect class, and this chain has produced one
in several rounds.

## The fix round's scope, region by region

Four source files: two modules and two suites. **Line numbers are HEAD's** and are a starting point,
not a boundary; the authoritative hunk list is `git show c410548 --unified=0 -- <module>`.

**1. `src/lib/browser/reconciliationCoordinator.ts`** — four behavioural changes and three comment
corrections.

- **`accept()`'s blocked arm** (the region around 932–953 and 978–994): the **second comparison**
  added above the two writes, the **materialized `observationCount`** hoisted above that comparison,
  and the `watermark` / dropped-count writes themselves. The fix's claim is that both writes are now
  below a comparison that is below **every** caller-controlled read they depend on.
- **`recoverFromLostHistory()`'s `true` arm** (around 1023–1048): the registry read, the second
  lifecycle increment, and `host.reopenWorkspace(openRequest)`. `2d-5-4-F-notes.md` §9 item 6 calls a
  second reopen *wasteful rather than corrupting*; it also returns `true`.
- **`runOneDrain()`'s single-read plain snapshot** (around 1323–1365): the four getters read once into
  a plain object, `delivered` handed to `accept()`, and the `staleEpoch` arm those getters now run
  **above**.
- **`accept()`'s corrected doc block**, both **`dispose()` increment comments** (around 1598–1613) and
  **`ensurePumping`'s** corrected claim about what `pump()` catches (around 1448–1458).

**2. `src/lib/browser/observationTransitions.ts`** — one behavioural change and four comment
corrections.

- **`removeWhileOurs`** and the **`removed` arm of `applyNamedRow`** (around 1459–1511): both writes —
  `workspace.removeDocument()` and the status write — under one arbitration, the helper refusing by
  returning, and the arm still answering `'pendingRow'`.
- **`applyChange`'s guard doc** (around 1168–1186), **`stillApplying`'s** "what it does not cover"
  list (around 753–758), **`lifecycleMovedUnder`'s** doc on where it is asked (around 824–832) and
  **`applyNamedRow`'s** doc (around 1420–1431).

**3. The two suites** — `reconciliationCoordinator.test.ts` (three cases) and
`observationTransitions.test.ts` (one case). Four cases in total; the record says each was confirmed
to fail against the **whole** pre-fix tree, with the messages verbatim in `2d-5-4-F-notes.md` §8.1,
and that case 3 was additionally re-run against the fix minus only the hoisted `.length` and failed
identically.

**4. The record** — `docs/decisions/2d-5-4-F-notes.md` in full, plus the correction blocks that round
wrote into `2d-5-4-E-notes.md`, `2d-5-4-notes.md`, `2d-5-2b-notes.md`, `2d-5-2a-A-notes.md`,
`2d-5-2a-notes.md` and `2c-3a-1-notes.md`. Sixteen sentences were corrected in all — six in source
comments and ten in those six record files — and they are **not one sentence repeated**.

## Five things to point yourself at first

Each because the fix that answered a finding is where the next finding has lived in every tail this
project has run.

1. **The blocked arm's second comparison.** It is above both writes — but is it above **every**
   caller-controlled read those writes depend on, now that `observationCount` is hoisted? And the arm
   above it: `recoverFromLostHistory()` returning `true` after its registry read already reopened the
   workspace fires a **second** reopen with `openRequest` already holding the new open's request.
   Re-derive that — it writes nothing, but it also returns `true`, and `runOneDrain` records
   `'accepted'` for a batch refused whole.
2. **The snapshot in `runOneDrain`.** Four getters now fire **above** the `staleEpoch` arm that used
   to run below it. Check what else moved with them: is anything still read off `answer.value` rather
   than off `delivered`, is the snapshot's own construction order consequential, and does `accept()`
   now read anything that is not a plain data property?
3. **`removeWhileOurs` and the arm it fences.** It refuses by returning, and the arm still answers
   `'pendingRow'` — the same shape `noteWhileOurs` has had since 2d-5-4-C. Is that outcome string true
   of a refusal that wrote nothing, and does any counter or case distinguish them? Check too that no
   third write of that arm was left outside.
4. **The sixteen corrected sentences.** Re-derive the Rust contract — `Workspace::from_tree`,
   `identity_of`, `session_identities` in `crates/espansoconfig-core/src/` — and check each corrected
   passage against it; then sweep **by shape** for a narrower wording of what each one struck, which
   is what every round of this tail has found. The struck claim is that `open()` **reallocates**
   document identities; the shape to search for is an identity being renumbered, not the word.
5. **The four new cases.** Check each pins the **fence** and not an outcome string, and check §8.1's
   one recorded discrimination: case 3 was re-run against the whole fix minus only the
   materialization and failed identically, which is what makes it evidence for the hoisted `.length`
   rather than for the blocked arm's recheck.

## Standards this project applies, in short

- A decision record or a comment that claims a guarantee the code does not give is a **finding**, and
  the most valuable kind here: no test can fail one.
- Where TypeScript cannot force something, the sentence that describes what it *does* force must say
  so in the same breath.
- A check and a spend separated by any property read are **not atomic** — a property read runs
  arbitrary code through a getter or a `Proxy` trap, and `readonly` does not freeze at runtime.
- A consuming operation whose **result is discarded** is a check-and-spend defect; sweep for the
  **shape**, never for the words of a finding already closed.
- Comment-only changes are still source changes under §7.1, and this tail has been largely about
  whether comments tell the truth. Check `file:line` citations resolve — four stale cross-file
  citations under `src/` are a known open class here (`reapply.ts:612`, `:613`,
  `writeSurfaceRegistry.ts:231`, `restore.test.ts:2504`) and are **not** this round's findings.
- **Sweep by shape for a narrower instance** of anything the previous round struck. Every one of the
  last six rounds found one.

## Verification already run — do not re-run

The ladder's live rung, measured in full at 2d-5-4-F on this exact tree:

- `cargo test --workspace` → **1320**, summed over **26** `test result` lines and checked by both
  complementary questions (no line lacking `0 failed`, none lacking `0 filtered out`). No Rust
  changed.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**.
- `npm test` → **2413 tests**, exit 0.
- `npm run build` → **189 modules**; both bundle oracles read — server-only markers absent,
  client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before. Read the code.

## Known and declared, not findings

- The four uncommitted instrument paths — `src-tauri/src/probe.rs`, `src/probe.ts`, and two hook
  lines each in `src-tauri/src/main.rs` and `src/main.ts` — are the temporary window-reading
  instrument. They are deliberate, never committed, and a later step deletes them. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)`.
- 2d-5-4-F added **no user-facing string in any language** and touched **no `.svelte` file**, so no
  window reading is owed. A round that disagrees should say so; the remedy would be a reading, not a
  revert.
- The defects this fix answers are **not production-reachable**: wire values are JSON-parsed plain
  objects, and the one production re-entrancy candidate, `WriteSurfaceTransition`, is registered as a
  no-op. Say if that is wrong; do not report the fix as unnecessary merely because the driver is
  injected.
- **`docs/decisions/2d-5-4-F-notes.md` §9 is a record, not a work list** (§7.3). Its eight items are
  the previous round's own nomination of where it is thin, all **recorded only**; read them, and treat
  item 3 — the unfinished `docs/` sweep for the identity claim — as a check worth running rather than
  as a defect already established.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4-G.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived from the code before it is accepted, and reviewers' arithmetic has
been wrong in several of the last rounds. Say explicitly when a finding is about the **record** rather
than about source: under §7.1 that distinction decides whether another round runs.

Time budget: 25 minutes.
