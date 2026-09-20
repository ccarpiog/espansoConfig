# Review brief — Phase 2d-5-4-F, the round `CLAUDE.md` §7.1 commissions for 2d-5-4-E's fix

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. Read `CLAUDE.md` at the root first —
it is binding, and its §5 (conventions), §7 (review rounds and their marks) and its paragraphs on
decision records that overclaim are the standards this review applies.

**The change under review is COMMITTED**, at `fe7d61b` (*Phase 2d-5-4-E — the round 2d-5-4-D's fix
commissioned, and the round its own fix commissions*); `daca2b1` after it only records the SHA and
the push result. The working tree is clean apart from four deliberate instrument paths named at the
bottom of this brief; **they are not the change under review and are never findings**. Read the
committed files at HEAD; `git show fe7d61b -- <path>` shows a file's whole phase diff.

## What this round is, and what it is not

This is **not** a new implementation step. `CLAUDE.md` §7.1: *a fix round that changes at least one
source file is owed a review round, scoped to that change*. Phase 2d-5-4-E was itself such a round
(Codex, `ship-with-fixes`, **2 blockers and 1 record-only SHOULD-FIX** — all three re-derived and
all three holding, one with its anchor half-wrong — plus **five more its own sweep found that the
review had missed**); its fix changed **four source files**, and this round reviews that fix. Its
own fix, by the same rule, decides whether another round follows — by whether it touches a source
file, never by the severity of what it found.

**The fix round is not a separate commit**: it landed inside `fe7d61b`. It is therefore identified
here by **region**, from `docs/decisions/2d-5-4-E-notes.md` §2 … §8, which is the record of what each
finding changed. Read that record in full; **it is also under review** — a decision record claiming a
guarantee the code does not give is this project's worst defect class, and this chain has produced one
in several rounds.

## The fix round's scope, region by region

Four source files: two modules and two suites. Line numbers are HEAD's and are a starting point, not
a boundary.

**1. `src/lib/browser/reconciliationCoordinator.ts`** — the counter and everything built on it.

- **`let lifecycle = 0`** and its declaration comment (768–786), the value the record calls *the one
  value here that is never reset*.
- **Its three increment sites**: `recoverFromLostHistory()` (899), `dispose()` (1510) and
  `workspaceOpened()` (1537, the **first** statement of that method, above the clearing block).
- **The capture** — `const lifecycleAt = lifecycle` as `runOneDrain()`'s first statement (1084–1085),
  with `host.openGeneration()` at 1087 below it — and its threading into `accept(batch, lifecycleAt)`
  (950, called at 1274).
- **`accept()`'s materialized reads and its comparison**, and the session literal it builds —
  `lifecycleIsOurs: () => lifecycle === lifecycleAt` (1018) with the epoch-`0` comment above it
  (1005–1017).
- **`'staleOpen'`'s widened doc** (around 297–310), which the record says now covers two facts.

**2. `src/lib/browser/observationTransitions.ts`** — the session member, the shared predicate and the
two fences.

- **`ObservationSession.lifecycleIsOurs`** (695–730) beside `epochNow` (699) and `stillApplying`
  (762), with the doc claiming what neither of the other two can answer.
- **`lifecycleMovedUnder(session)`** (817–855): three clauses — `!stillApplying()`,
  `!lifecycleIsOurs()`, `epochNow() !== session.epoch` — and the doc block above it saying what each
  does **not** discriminate.
- **The routing fence in `applyObservation`** (880–915): `routeObservation()` at 911, the fence at
  912, and the comment (880–890) claiming that routing is *nothing but property reads and `in`* and
  therefore runs caller code above **every** arm.
- **`applyAddition`'s own second fence** (1016–1051, the check at 1024) and the justification at
  1035 for keeping it.
- **`AcceptedSequences`** doc (226–239) and the guard doc block at 1161–1222, where `stillApplying`
  is first and the epoch check second.

**3. The two suites** — `observationTransitions.test.ts` (the session helper's fourth member and the
routing case) and `reconciliationCoordinator.test.ts` (two cases). Three cases in total; the record
says each was confirmed to fail against the **whole** pre-fix tree, with the messages verbatim in
`2d-5-4-E-notes.md` §8.1.

**4. The record** — `docs/decisions/2d-5-4-E-notes.md` in full, plus the correction blocks that round
wrote into `2d-5-4-notes.md`, `2d-5-2b-notes.md` and `2d-5-4-D-notes.md`.

## Five things to point yourself at first

Each because the fix that answered a finding is where the next finding has lived in every tail this
project has run.

1. **The counter's three increment sites.** Re-derive them: does anything else clear `accepted`,
   replace the workspace, or end the applying lifecycle **without** passing through
   `workspaceOpened()`, `recoverFromLostHistory()` or `dispose()`? Is `dispose()`'s increment really
   redundant with the live `disposed` read, as the comment at 1505–1510 says, or does it carry a case
   the other two do not? And is the capture in `runOneDrain` genuinely above **every**
   caller-controlled read — `host.openGeneration()` is a host call and it runs *after* the capture.
2. **`lifecycleMovedUnder`'s three clauses and the doc that says what each does not discriminate.**
   Check every half: that `stillApplying` says nothing about a replaced workspace, that
   `lifecycleIsOurs` says *something ended* and never *which one is showing*, and that the epoch
   clause is **vacuous at `0`** — and that the sentence saying none of the three is forced by a type
   is true of `session.epoch` as a `readonly` declaration.
3. **`accept()`'s materialization.** Is any read of the injected batch left **above** the capture, and
   can any write still precede the comparison? §9 item 1 of the notes names `observations.length` and
   the `for…of`'s `Symbol.iterator` as caller-controlled reads that sit **below** it; check the claim
   that neither is a defect, and check what a statement added after either would be below.
4. **The routing fence's placement.** It is above the switch — but `routeObservation` both reads
   caller values and builds the literal the arms admit on. Can any arm still arbitrate on a value
   captured **before** the fence, and is `applyAddition`'s second fence still doing work the first
   does not? The record says its materialization window runs after routing returned; re-derive that.
5. **The three new cases.** Check that each pins the **fence**, not merely an outcome string — §9
   item 6 records that `'staleOpen'` now covers two facts a case cannot tell apart — and check the one
   measurement the fix worker flagged: reverting only §2.4's comparison left two assertions passing
   and failed on the cursor instead.

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
- **Sweep by shape for a narrower instance** of anything the previous round struck. Every one of the
  last five rounds found one.

## Verification already run — do not re-run

The ladder's live rung, measured in full at 2d-5-4-E on this exact tree:

- `cargo test --workspace` → **1320**, summed over **26** `test result` lines and checked by both
  complementary questions (no line lacking `0 failed`, none lacking `0 filtered out`). No Rust
  changed.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**.
- `npm test` → **2409 tests**, exit 0.
- `npm run build` → **189 modules**; both bundle oracles read — server-only markers absent,
  client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before. Read the code.

## Known and declared, not findings

- The four uncommitted instrument paths — `src-tauri/src/probe.rs`, `src/probe.ts`, and two hook
  lines each in `src-tauri/src/main.rs` and `src/main.ts` — are the temporary window-reading
  instrument. They are deliberate, never committed, and a later step deletes them. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)`.
- 2d-5-4-E added **no user-facing string in any language** and touched **no `.svelte` file**, so no
  window reading is owed. A round that disagrees should say so; the remedy would be a reading, not a
  revert.
- The defects this fix answers are **not production-reachable**: wire values are JSON-parsed plain
  objects, and the one production re-entrancy candidate, `WriteSurfaceTransition`, is registered as a
  no-op. Say if that is wrong; do not report the fix as unnecessary merely because the driver is
  injected.
- **`docs/decisions/2d-5-4-E-notes.md` §9 is a record, not a work list** (§7.3). Its eight items are
  the previous round's own nomination of where it is thin, all **recorded only**; read them, and treat
  item 7 — 21 unread `docs/` occurrences of a false identity claim — as a check worth running rather
  than as a defect already established.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4-F.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived from the code before it is accepted, and reviewers' arithmetic has
been wrong in several of the last rounds. Say explicitly when a finding is about the **record** rather
than about source: under §7.1 that distinction decides whether another round runs.

Time budget: 25 minutes.
