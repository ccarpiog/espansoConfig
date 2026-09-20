# Review brief — Phase 2d-5-4-B, the round `CLAUDE.md` §7.1 commissions for 2d-5-4-A's fix

## Repository

`/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`. Read `CLAUDE.md` at the root first —
it is binding, and its §5 (conventions), §7 (review rounds and their marks) and its paragraphs on
decision records that overclaim are the standards this review applies.

**The change under review is COMMITTED**, at `ee78429` (*Phase 2d-5-4-A — the round 2d-5-4's fix
commissioned, and the round its own fix commissions*). The working tree is clean apart from four
deliberate instrument paths named at the bottom of this brief; **they are not the change under review
and are never findings**. Read the committed files at HEAD; `git show ee78429 -- <path>` shows a
file's whole phase diff.

## What this round is, and what it is not

This is **not** a new implementation step. `CLAUDE.md` §7.1: *a fix round that changes at least one
source file is owed a review round, scoped to that change*. Phase 2d-5-4-A was itself such a round
(Codex, `ship-with-fixes`, 2 blockers + 4 should-fix, all six re-derived and all six holding); its fix
changed **four source files**, and this round reviews that fix. Its own fix, by the same rule, decides
whether another round follows — by whether it touches a source file, never by the severity of what it
found.

**The fix round is not a separate commit**: it landed inside `ee78429`. It is therefore identified
here by **region**, from `docs/decisions/2d-5-4-A-notes.md` §2, §3 and §4, which is the record of what
each finding changed.

## The fix round's scope, region by region

Four source files. Every line and symbol below is what the fix round wrote or rewrote.

**1. `src/lib/browser/workspace.svelte.ts`** (4872 lines)

- **`ownedMatchOf` at 498–519 and `ownedProjectionOf` at 521–588**, with `ownedRepair` at 590–624 —
  findings 1 and 2's fix. A command's answer is copied field by field, and each match field by field,
  at **all nine** ingresses of a command-supplied projection: `2927` (the guarded reread), `3249`
  (`adoptDiskVersion`'s disk snapshot), `3462` (`open()`), `3559` (the selection repair, via
  `ownedRepair`) and `4463`, `4530`, `4603`, `4669`, `4765` (the five adoptions). The construction is
  explicit and typed `DocumentView`, which the JSDoc claims makes a later field a **compile error in
  that function**; the depth is stated as **two levels**, with everything below declared still the
  command's own object.
- **`rereadUnderGuard`'s JSDoc at ~2860–2930 and its body to ~2975** — the replacement of 2d-5-4's
  false sentence (*"what bounds that half is `replaceSelection`'s own discipline"*), the enumeration
  of `installView`'s reads including the `views` comparison it had omitted, and the **clear** moved
  out of the coordinator's guard into the installation block so an explicit reread clears too
  (finding 5).
- **The host's failure arm at ~2280–2350**, fenced by three captures compared at the write: the open
  generation, the per-document `statusWrites` token (`statusWriteOf`, declared at **2810–2812**) and
  whether the window still holds a row (finding 3).

**2. `src/lib/browser/observationTransitions.ts`** (1185 lines)

- **The guard at ~890–1000**, where `markStaleWhileOurs` (943–948) fences the **two arms above** the
  ownership question — `stillApplying`'s refusal at 949–950 and the epoch refusal at ~953–954 — while
  the decision order is deliberately untouched and the two arms **below** `isNewest` still write
  directly (finding 4). The comment at **971** argues that a call that can never refuse is one no test
  can tell from no call.
- **`observationTransitions.ts:747`'s reachability sentence** — finding 6's fix, which separates *the
  command this arbitration requests* from *what is reachable transitively*.

**3–4. The two suites** — `workspace.test.ts` (8964 lines) and `observationTransitions.test.ts` (992).
Nine new cases, each confirmed to fail against the pre-fix code by reverting the change, running the
one suite and restoring it; two candidate cases were **discarded for passing both ways**. The messages
are in `docs/decisions/2d-5-4-A-notes.md` §6.

**Also in scope: `docs/decisions/2d-5-4-notes.md`'s six new correction blocks** and
**`docs/decisions/2d-5-4-A-notes.md` in full** — its §7 *where it is thin* marks included. §7 item 12's
*recorded only* mark was struck this round; check that what replaced it is true.

## Where a finding has lived in every tail this project has run

Point the review at these first. Each is the fix that answered a finding, which is exactly where the
next finding has been found here.

1. **`ownedProjectionOf`'s depth claim.** Its JSDoc says two levels is *"the depth this module reads
   after a guard"* and **enumerates the readers**. Check that enumeration against the code, not against
   the sentence: one reader it missed is a defect of exactly the class this round closed. The nine
   ingresses are the same question's second half — **is any ingress of a command-supplied projection
   still unnormalized?** Sweep for `.value`, `adoption.`, `repair.` and every `DocumentView` that
   crosses the `commands` boundary, not for the nine line numbers above.
2. **Whether a field-by-field copy is the compile-time check it claims to be.** An **optional**
   property omitted from an object literal is **not** a TypeScript error, so the guarantee holds for
   required fields and may not hold for the rest. Nothing in the JSDoc says which. Check the actual
   shape of `DocumentView` and `MatchView` for optional members, and check `ownedMatchOf` against
   `MatchView` the same way.
3. **`markStaleWhileOurs`, and the two arms deliberately left unfenced.** The argument is
   **positional**: reaching them means `isNewest` already answered yes. Is that true of **every** path
   into them, including one entered after `tellTheSurfaceAbout` has run a component callback? And is
   `sequences.isNewest` really the pure read the new comment calls it — or can it be an injected
   object whose method runs arbitrary code?
4. **The clear's new home.** It now fires for any successful install inside `rereadUnderGuard`,
   explicit rereads included. Its JSDoc claims content currency and explicitly disclaims membership
   reconciliation. **Is the disclaimer enough, and is there still a path that marks and never clears —
   or one that clears a mark it did not set?**
5. **The record's six correction blocks.** A correction block is a source of new false claims in this
   project's history: three of 2c-3a-1's ten findings were regressions a previous round's fix
   introduced. Check each block against the code it describes, and say for each finding whether it is
   about the **record** or about **source**.

Two standing shapes to sweep for, **by shape and never by the words of a past finding**:

- **A consuming operation whose result is discarded**, and a check and a spend separated by any
  property read — this project has shipped that twice in one phase. `readonly` freezes nothing at
  runtime and a getter or a proxy trap runs arbitrary code. A token captured and then compared is the
  new instance of this shape here: check that `statusWriteOf`'s capture is taken **after** the arm's
  own mark and that nothing between the capture and the comparison can run caller code.
- **A comment asserting a contract the code does not give.** The fourteen-round 2d-5-3 tail was
  entirely about whether comments tell the truth; no test can fail one. Check `file:line` citations
  resolve — four stale cross-file citations under `src/` are a known open class here.

## Verification already run — do not re-run

The ladder's live rung, measured in full at 2d-5-4-A on this exact tree:

- `cargo test --workspace -- --test-threads=1` → **1320**, summed over **26** `test result` lines and
  checked by the complementary question (no line lacking `0 failed`). No Rust changed.
- `cargo clippy --workspace --all-targets -- -D warnings` → exit 0; `cargo fmt --check` → exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` → finds nothing.
- `npm run check` → **443 files, 0 errors, 0 warnings**.
- `npm test` → **2389 tests**, exit 0.
- `npm run build` → **189 modules**; both bundle oracles read — server-only markers absent,
  client-only markers present (2).

**⛔️ Run no build, test, package or `cargo` command of any kind.** `cargo test --workspace` is flaky
on this host and a concurrent run has failed here before. Read the code.

## Known and declared, not findings

- The four uncommitted instrument paths — `src-tauri/src/probe.rs`, `src/probe.ts`, and two hook
  lines each in `src-tauri/src/main.rs` and `src/main.ts` — are the temporary window-reading
  instrument. They are deliberate, never committed, and a later step deletes them. `git diff --stat`
  over the two hook files is `5 insertions(+), 1 deletion(-)`.
- 2d-5-4-A added **no user-facing string in any language** and touched **no `.svelte` file**, so no
  window reading is owed. A round that disagrees should say so; the remedy would be a reading, not a
  revert.
- The two things 2d-5-4 hands forward on purpose are still handed forward: a removed target ships as
  state and not as telling (2d-5-5's), and the unbounded blocked-drop is restated rather than fixed.
  Say if either is wrong to hand forward, not merely that it is handed forward.

## Output

Write the full report to **`docs/reviews/phase-2d-5-4-B.md`**. Give a verdict line
(`ship-with-fixes` / `do-not-ship` / `ready`), a blocker count, and each finding with its severity,
its file and line, and enough derivation that the orchestrator can **re-derive it without you** —
every finding here is re-derived from the code before it is accepted, and reviewers' arithmetic has
been wrong in several of the last rounds. Say explicitly when a finding is about the **record** rather
than about source: under §7.1 that distinction decides whether another round runs.

Time budget: 25 minutes.
