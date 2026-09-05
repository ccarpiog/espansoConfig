# Superseded 'Next action' handoffs

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

Every block below was the live handoff once and was superseded in place. They are kept for the record they carry, never as an instruction.

---

### ⚠️ HISTORICAL — the **round-2→round-3** handoff, superseded by the round-6 status above. Rounds 3, 4 and 5 are all executed: round 3 returned NOT READY with 0 High, 4 Medium and 1 Low, round 4 with **0 High, 3 Medium and 2 Low**, round 5 with **0 High, 1 Medium and 3 Low**, and all three fixes are committed — round 4’s at `16d11b3`. The intervening round-3→round-4 and round-4→round-5 handoffs were superseded in place rather than kept here; their substance is the round-4 and round-5 verification sections above, `docs/decisions/2d-4a-notes.md` §§12–14, and commits `c8e9ef1` and `16d11b3`.


### **STEP 2d-4a IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, and two Codex rounds both returned NOT READY. Both fixes are in the tree. THE NEXT ACTION IS ROUND 3 OF THE 2d-4a REVIEW, against the round-2 fix.**

**Read `docs/reviews/phase-2d-4a-queue.md` first — it is the work list.** Rounds 1 and 2 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 3's brief is
written from round 2's fix, exactly as round 2's was written from round 1's.

**Round 2's lesson is that a fix can close a finding's example without closing its shape.** Round 1
found coalescing arrival-order dependent; round 1's fix made a repeat coalesce onto the higher
sequence and round 2 showed that **round 1's finding 3 was never closed** — comparing only the
highest pending entry cannot normalise arbitrary arrival order, and in order `[9, 3, 5]` the queue
was **dropping an observation that was not a repeat in sequence order**. Three of round 2's five
findings were sentences round 1's *fix round* wrote. **Write round 3's brief the same way: ask what
the round-2 fix's own new sentences and its new code now rest on.**

#### What the round-2 fix built — re-derive these, do not inherit them

- **Coalescing moved from `enqueue` to `drain`, and this is a design change no reviewer asked for.**
  `coalesced_sequences` folds, at drain, each path's sequence-**adjacent** run of one
  `crate::ledger::ObservedState` to that run's highest sequence. `newest_for_path` and `reindex` are
  **deleted**; `enqueue` now stores every admitted observation. The fixer's argument is that
  adjacency is necessary but not sufficient at enqueue time, because in arrival order `[9, 3, 5]` an
  enqueue-time rule still drops A(3) — so the rule had to become a pure function of the complete
  pending set. **Round 3 should test that argument and the new fold**, including: whether the fold
  is correct when a path has three or more runs; whether it is correct across the capacity eviction,
  which still evicts by sequence and is therefore still arrival-timing dependent (documented in
  guarantee 3 as a `discarded` loss, **not** a coalescing failure — is that distinction true?); and
  whether **R10**, which concedes a folded repeat holds a pending slot until the drain that folds it,
  interacts with the 256-entry cap in a way the record does not state.
- **`issued_identities`** records every `DocumentId` put on the wire against its path for the epoch;
  `address_of` consults it after the workspace answers `None`. Round 2 cleared it of the
  stale-identity class. **R9** concedes it has no bound within an epoch and duplicates
  `espansoconfig_core::workspace`'s process-wide path retention, and now says it is unmeasured.
- **Five retention positions** now carry the eviction condition and say an eviction costs a
  **whole-workspace reload**, not a repeated drain. Four idempotence sentences were qualified in fix
  round 1 and round 2 found them mutually consistent; the fifth was the one it found unqualified.
  **Ask whether the five now agree with each other and with the four.**
- **§4's epoch passage has now been rewritten twice** — once to replace a false atomicity claim, once
  because the replacement recorded an incomplete mechanism as the complete one. It now splits
  exhaustively on the queue-mutex order. **A passage wrong twice is where round 3 should look first.**
- **The two liveness-inventory entries were reclassified** from *local fact* to `a pointer:`, the
  taxonomy's existing category, with one clarifying paragraph added to `Judged::reason`.
  `LIVENESS_SHAPES` gained five more phrases for **zero** new unmarked hits. The fix round also
  reports that the sweep fired on its own new prose (`answered by`) and that it **reworded rather
  than inventoried** it — recorded in `2d-4a-notes.md` §11.4. **That judgement is round 3's to test**:
  rewording to dodge a sweep is exactly what the check cannot catch.

#### What round 3 must attack

- **The fix is a change, and the round that reviews it is not optional.** Round 3's scope is the
  round-2 fix: the drain-time fold and the deletion of `newest_for_path`/`reindex`, the five
  retention positions, §4's twice-rewritten epoch passage, the reclassified inventory entries, the
  reworded `answered by` prose, and R9/R10.
- **Apply round 2's own lesson to round 2.** It closed an example by moving the rule. **Is the shape
  closed?** Arrival-order dependence survives at the capacity eviction by the record's own admission.
  Is calling that a `discarded` loss rather than a coalescing failure a true distinction or a
  relabelling?
- **The record's residues.** R3 narrowed, R4 sharpened, R9 added, R10 added. Note this project's
  precedent: **seven** §5 items recorded as bounded residues in Phase 2d-3 were later found to be
  real defects, and rounds 12, 13 and 14 all had Highs that were records about a residue written by
  the round that created it.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-4a-queue.md          # THE WORK LIST — rounds 1 and 2 verbatim
# docs/decisions/2d-4a-notes.md              # the record, with both fix rounds' correction blocks
# docs/decisions/2d-4-split-notes.md         # why 2d-4 is two steps and what 4b owes
# docs/reviews/phase-2d-design.md            # THE AUTHORITY for 2d. Q3 the wire, Q7 item 4 the
#   scope and its prohibitions, Q7 item 5 the out-of-order drains 2d-5 will perform, Q8 the
#   sharpest failure mode
# src-tauri/src/reconciliation.rs            # the whole step
# crates/espansoconfig-core/src/watch/liveness.rs — THE CONTRACT. Read before writing any sentence
#   about what the pipeline guarantees, and point at it rather than restating it
```

#### After round 3 closes: 2d-4b

`docs/decisions/2d-4-split-notes.md` §2 is the spec. The TypeScript half: the mirrored types, the
`BrowserCommands` wrapper for the drain, the **injectable** event-listener wrapper (injectable
exactly as `BrowserCommands` is, so tests drive state without Tauri), the `describe*` builders in
`src/lib/i18n/codes.ts` and their reactive `t*` wrappers in `index.ts`, the frontend tests, and the
**re-measured** `npm run check` / `npm test` / `npm run build` baselines.

Three things 2d-4b inherits, stated so they are not rediscovered:

- **`AWAITING_FRONTEND_DECLARATION` in `wire_contract.rs` must be deleted by 2d-4b.** It is the
  one-entry gap the split opened, and Codex round 2 verified it is checked in **both** directions —
  declaring the command name on the frontend without deleting the entry fails the build. The hole
  cannot silently outlive the step.
- **`src/lib/i18n/codes.test.ts:379` holds variant counts** ("hold the variant counts this phase
  measured") that the ten new EN/ES keys do **not** yet appear in, because no accessor exists.
  Adding the accessors moves those counts.
- **A key with no accessor is a key nothing can render.** 2d-4a's frontend gate is green with the
  keys present and unreachable; that is a fact about the present suites, not a licence, and
  `2d-4-split-notes.md` §3 says so.

---


### ⚠️ HISTORICAL — the 2d-3 closure and its handoff to 2d-4, superseded by the 2d-4a status above. 2d-4 was **split** into 4a and 4b (`docs/decisions/2d-4-split-notes.md`) and 4a is implemented; this section is kept for the 2d-3 record it carries and for its reading list, not as an instruction.

### **STEP 2d-3 IS CLOSED. The review tail is over by owner decision, and 2d-3-C built the mechanism that ends it rather than reviewing a fifteenth round. THE NEXT ACTION IS PHASE 2d-4.**

**There is no round 15, and adding one would undo the decision.** On 2026-08-26 the owner ruled *"Do
it then, I don't want more rounds"* against a standing recommendation that the tail had no
convergence mechanism other than rounds. **2d-3-C is that mechanism**, and it is built, green and
independently proved — see the verification section above and `docs/decisions/2d-3-C-notes.md`.

**What closed the tail, in one sentence:** the liveness claim had roughly **twenty** surfaces on
which it could be false and fourteen rounds could only find some of them; the contract is now stated
**once**, in `crates/espansoconfig-core/src/watch/liveness.rs`, twenty positions **point** at it over
compile-checked intra-doc links, and `src-tauri/src/liveness_contract.rs` **fails the build** on any
liveness-shaped claim its inventory does not carry.

**Before writing any sentence about what the observation pipeline guarantees, read
`crate::watch::liveness` and point at it.** Do not restate it. A restatement will either fail the
check or become the fifteenth round's finding, and there is no fifteenth round to catch it.

#### What a fresh session must know before touching this area

- **The check catches an *unmarked* claim and a *new* claim. It cannot judge whether a claim is
  true.** `docs/decisions/2d-3-C-notes.md` §5 lists **seven** limits; the four sharpest are repeated
  in the verification section above. **Read §5 before trusting the mechanism** — over-trusting it is
  precisely this project's declared worst defect class, applied to the thing built to prevent it.
- **The inventory key is `(file, phrase)`.** Swapping a recorded sentence for a different sentence
  using the same phrase in the same file moves no count and passes.
- **`docs/` is not swept**, deliberately: it holds the append-only review history where fourteen
  rounds of false sentences are quoted on purpose. §1's headline and §5's note in
  `2d-3-notes.md` point at the contract **as prose, with nothing enforcing it**.
- **Both crates now deny `rustdoc::broken_intra_doc_links`**, so `cargo doc --workspace --no-deps`
  is a gate: it must exit 0. Its ~74 `private_intra_doc_links` warnings are a **different and
  pre-existing** lint and are not this step's.
- **Residues 39 and 42 are untouched and are not about where the contract is stated**: a
  `PrecedesACommit` refusal's safety is argued over an engine no test can hold permanently unstable,
  and the negative arm of the conditional debt has no discriminating oracle. **Residue 44 survives at
  its new position** — the contract's clauses are prose over code, and what changed is that there is
  **one** passage to check against `revert_settlement` instead of twenty.

#### The next phase — 2d-4

`docs/reviews/phase-2d-design.md` **Q7 item 4** is the authority and states it in full:

> **2d-4 — queue, event wake, drain command, and wire contracts.** Add the typed queue,
> `workspace://reconciliation-ready`, `drain_external_changes`, TypeScript types/wrapper, command
> registration/dispatch tests, sequence/epoch/coalescing tests, and EN/ES code namespaces/accessors
> for every visible failure. The event remains a hint; the command answer is authoritative. This step
> must not draw anything or decide whether a surface is open. Update the registered-command count
> rather than continuing to claim fifteen; the present application registers fifteen workspace
> commands and one menu command (`src-tauri/src/main.rs:73-127`;
> `src-tauri/src/wire_contract.rs:1425-1492`).

**2d-4 is the first 2d step that touches the frontend**, so the three carried frontend numbers
(`431 / 2125 / 184`) stop being carried and must be **re-measured**. `git diff --name-only 08a3366 --
src/` has been empty for the whole of 2d-3 and will not be after 2d-4.

**Open items 2d-3 hands to 2d-4** are listed in the round-14 handoff below (the *"Open items 2d-3
still carries into 2d-4"* block), and they are unchanged by 2d-3-C except as noted above. The two
that bear directly on 2d-4's own scope: the production `ObservationSink` **discards**, so a sequence
and a publication are spent on a value no present code recovers — 2d-4's queue is what recovers it;
and `latest_commit_at` is never pruned within an epoch (item 27).

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q7 item 4 is 2d-4's spec;
#   Q2 the suppression ruling, Q3 the highest-sequence rule, Q5 the coalescing rule
# crates/espansoconfig-core/src/watch/liveness.rs — THE CONTRACT. Read before writing any sentence
#   about what the pipeline guarantees, and point at it rather than restating it
# docs/decisions/2d-3-C-notes.md             — §4 the check, §5 what it does NOT close (seven limits)
# src-tauri/src/liveness_contract.rs         — the check and its 82-entry inventory
# docs/decisions/2d-3-notes.md               — §1, §4, §5, §6's gate table. §7–§20 are the round
#   history and are append-only; do not sweep or rewrite them
```

#### The gate baseline — all measured on this tree by the orchestrator

- **`1272 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust figure moved **+4** at 2d-3-C, exactly the four new tests, over
  **26** result lines, all `ok`, exit 0. The Rust ladder across the whole 2d-3 review: 1249 at round
  4's brief, 1251, 1256, 1261, 1262, 1263, 1267, then **1268** for rounds 10–14, and **1272** at
  2d-3-C. **The three frontend numbers are still carried** and must be re-measured at 2d-4.
- **`cargo doc --workspace --no-deps` is now a gate** and must exit 0 — that is what makes the twenty
  pointers real.
- **The focused serial gate is `cargo test -p espansoconfig --bin espansoconfig watch_check:: --
  --test-threads=1`, it is **20/20** with **227** filtered out** (223 before 2d-3-C's four tests),
  and it belongs to every future Rust gate run. Its **wall-clock is not a baseline**: 64.77 s to
  285.53 s have all been seen, and it was **67.19 s** here. What it asserts is 20/20 and no timeout.
- **The host scar still binds.** The workspace suite is evidence on a **quiet host only**. Kill
  orphans (`pkill -f 'target/debug/deps/espansoconfig-'`), run **once**, and **stay off the machine**
  — 2d-3-C's implementer hit 3 baseline timeouts on its first run **while its own poll loops were
  running**, and a quiet re-run was clean.
- **On a tree with unstaged work, `git checkout <path>` is not an undo.** It discards everything
  unstaged in that file. Revert a test probe with the inverse edit, or plant it on a copy — this cost
  a recovery at 2d-3-C.

---


### ⚠️ HISTORICAL — the round-14→round-15 handoff, superseded by the 2d-3 closure above. **Round 15 was never run and must not be**: 2d-3-C replaced it by owner decision. This section is kept for the round-14 record it carries, not as an instruction.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, and round 14 broke the round-13 fix one layer under where the brief aimed: **two Highs and two Lows**, all fixed, none cleared. THE NEXT ACTION IS ROUND 15 OF THE 2d-3 REVIEW, against the round-14 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–14 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 15's brief is
written from round 14's fix, exactly as rounds 2–14 were written from theirs.

**Round 14's lesson is that a narrower claim can still be unconditional.** Round 13 replaced *the
engine must answer* with *the path stays owed* at eight positions, and round 14's brief asked whether
the narrower claim was true at every one of them. It was not: **`revert_settlement` re-owes a path
only where the settlement it takes back had itself discharged a debt** — every other refusal ends in a
plain `hint`, which is precisely the thing the suppression argument elsewhere says may be *coalesced
into silence*. **Write round 15's brief the same way.** Round 14 corrected thirteen positions for
High 2 and rewrote a headline for High 1, and added four correction blocks and four residues. Ask
what the *corrected* sentences now rest on.

That is the **fourteenth consecutive** round with a name-position finding, and the **third
consecutive** round in which both Highs are sentences a *fix round* wrote while closing something
else. **Both Highs were again this project's declared worst defect class.**

#### What the round-14 fix built — re-derive these, do not inherit them

- **High 1 — the §1 headline made a rollback produce an observation.** *"the engine takes its
  settlement back and **observes the path again**"*, against `revert_settlement`'s own doc: *"it
  schedules a read, so it emits nothing itself. The observation comes back out of a later `tick`,
  with whatever the file holds **then**"*. The headline now says the engine **restores the prior
  tracked state and re-hints** the path, and that *answered* names **that rollback and never an
  observation that arrives**.
- **High 2 — *re-owes the path* is conditional in the code and was unconditional in thirteen
  descriptions of it.** `crates/espansoconfig-core/src/watch/engine.rs`'s `revert_settlement` ends
  `if owed { self.observe_owed(...) } else { self.hint(...) }`, where `owed` comes from the `Undone`
  record of the settlement being taken back. **An ordinary native-hint settlement has `owed == false`
  and takes the plain `hint` branch.** Six positions in `ledger.rs` — including round 13's own new
  safety sentence at ~509–513 — one in `watch_check.rs` and five in the record all said it
  unconditionally. Each now says the debt is restored **only where the settlement taken back had
  discharged one**, and **the two negatives the reviewer expressly cleared are kept**: a
  `PrecedesACommit` refusal publishes nothing and clears nothing.
- **Low 1 — three of §19.4's after-counts were measured on a tree that did not yet hold the round-13
  review text the same commit appended.** Re-measured on `5a41d7d`, `phase-2d-3-ledger.md` holds
  **10** liveness-shape, **3** debt-shape and **6** `same sentence` hits against the recorded 0, 0
  and 5; §19.7 item 40's *2 → 2* contradicted §19.4's correct *2 → 10*. The fix round re-measured
  **every** §19.4 count on a `git archive` copy rather than copying the reviewer's figures.
- **Low 2 — §19.5 said six correction blocks and named seven** (§1, §10.5, §12.6, §15.3, §16.1,
  §18.1, §18.5; `rg -c 'Correction \(round-13 fix round'` returns 7). **The miscount had propagated
  into this file's previous handoff**, which said *the six correction blocks* and then listed seven.
- **The fix round's own two sweeps found six more positions the reviewer did not name** — **two in
  code, four in the record** — and **both code positions are in `src-tauri/src/main.rs`'s module
  header**, the file §19.4's sweep could not see because round 13 enumerated `ledger.rs`, `watch.rs`,
  `watch_check.rs` and `commands.rs` rather than the directory. **One of the two is round 13's own
  High 2 sentence still standing a full round after it was corrected everywhere else.** The
  name-position pass also found **§10.3's section heading** (*a rollback promises a fresh
  observation*), blocked rather than rewritten per §2.6.
- **Zero non-comment lines changed in `src-tauri/src/` this round** — `git diff -U0 src-tauri/src/`
  filtered to non-comment lines returns **nothing**, where round 13 returned exactly one (an
  assertion message). **The orchestrator verified this rather than accepting it.** No behaviour, no
  signature, no control flow, no test, no assertion, no assertion message; `decide`'s
  `read_after <= at` untouched; no core file, no `src/` path, no command, wire type, event, queue,
  i18n key or user-visible string. Five files: `ledger.rs`, `main.rs`, `watch_check.rs`,
  `2d-3-notes.md`, `phase-2d-3-ledger.md` — plus `PROGRESS.md`, which §20.5 names.

#### What round 15 must attack

- **The fix is a change, and the round that reviews it is not optional.** Round 15's scope is the
  round-14 fix: §1's rewritten headline (**again** — it was round 13's High 2 and round 14's High 1,
  and it now carries eight correction blocks), the thirteen rewritten *owed/re-hinted* positions,
  `main.rs`'s newly rewritten module header, the four numbers corrected **in place**, and **§20,
  which is the section under review**.
- **Apply round 14's own lesson to round 14.** It replaced an unconditional claim with a
  **conditional** one at thirteen positions. **Is the condition stated correctly at every one of
  them?** The condition is *the settlement taken back had itself discharged an `observe_owed`
  request* — not *the path was owed*, not *a debt existed*, and not *the settlement was owed*.
  `Undone::owed` is set where the settlement **discharged** a debt; check each rewritten sentence
  against `settle`, `observe_owed` and the `Undone` construction, never against the other sentences.
- **The safety sentence is now a three-way claim and no test drives any of it.** `ledger.rs`
  ~509–513 says a retry that never completes leaves a state *un-concluded and re-hinted*, *owed again
  only where the settlement taken back had discharged a debt*, *never reported wrongly* and *never a
  record cleared by a reading older than the commit*. §19.7 item 39 already conceded no test drives
  the last two; round 14 added two more clauses to the same undriven sentence.
- **The four residues, §20.7 items 41–44**, and residue 43 in particular: round 14 corrected four
  numbers **in place** rather than only beneath, breaking this record's own convention with an
  argument. **That judgement is round 15's to test.** Note the precedent: **seven** §5 items recorded
  as bounded residues have since been found to be real defects, and rounds 12, 13 and 14 *all* had
  Highs that were records about a residue written by the round that created it.
- **§20.4's sweep counts and its kept list.** It records what it judged and **kept** — `ledger.rs`'s
  *is re-observed* heading, four driven test comments, `watch.rs`'s *ask* heading, the
  `…_asks_for_a_re_observation…` test names, `engine.rs`'s two docs, `2d-1-notes.md:140`,
  `watch.rs:1199`, §1's `Undone` bullet (recorded as the closest call) and the eight *What is
  guaranteed* sections. **A kept position is an unfixed position with a reason attached**, and the
  reason is what round 15 checks.
- **§5 item 17 said the true thing since round 5** — *"`revert_settlement` restores unconditionally
  and **re-hints** only a watched path"* — so **the record held its own refutation for nine rounds
  while thirteen other positions contradicted it.** Ask what else §5 already says that the prose
  around it denies.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5 (with its new navigational note),
  §6's gate table and §7–§20. **Every one of the fourteen rounds so far found a false claim in this
  record.**

**Keep the two standing rules, and note that round 14 sharpened the first:** sweep for the **shape**,
never for the words of the closed finding — **and sweep a *directory*, never a remembered file list**,
which is exactly how round 13's own High 2 survived a round inside `main.rs`. Sweep **name
positions** — headlines, section headings, bold ruling lines, first sentences, doc comments, module
headers, test names, assertion messages — as a pass **distinct** from the prose sweep.

**Brief the review the way rounds 1–14 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### Operational traps — they recur every round

**New at round 14, and it cost a false exit 0 at 0 s.** The companion's launch response names the job
**`jobId`**; `node "$CC" status --all --json` names it **`id`**. A watchdog written from the launch
response matches nothing in the listing and — under round 13's *"not found anywhere means probably
finished"* rule — reports terminal immediately, on a job that has not started. **Match `x.id ||
x.jobId`, and treat *not found* as terminal only once the job has been seen listed** (with a grace
period, ~120 s, before giving up). Round 13's rule is right and was incompletely stated.

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion stamps `updatedAt`
once, ~10 s after launch, and never advances it. **The working signal is the log file's mtime.** A
drop-in replacement that polls on it — and that carries both the `latestFinished` fix from round 13
and the `id` fix from round 14 — is `wait-on-log.sh` (usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` stalled / `4` bad args); it lives in a session scratchpad, so **recreate it from this description
if the path is gone** — it was gone at rounds 10–14 and was rebuilt all five times.

**`node "$CC" status --all --json` returns
`{ workspaceRoot, config, sessionRuntime, running, latestFinished, recent, needsReview }`.** A job
that *completes* leaves `running` and does **not** appear in `recent` either, landing in
**`latestFinished`**, a single object rather than an array. **Search all three**, and key on `id`.

The `codex:codex-rescue` subagent returns a "running in background" wrapper **immediately** and does
not deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and drive
`node "$CC" task --background --effort medium "$PROMPT" --json`, then `node "$CC" result <job-id>`,
directly. **Do not run `node "$CC" status <job-id> --json`** — it echoes the entire brief back into
the transcript. Round 14 took **242 s** at `--effort medium`; round 13 took ~7 min on a brief of
comparable size, so **the duration is host and queue state, not a signal about depth**.

**A second measured trap.** `cargo test --workspace 2>&1 | tail -40` **discards the totals**.
Redirect the whole run to a file and sum it: `cargo test --workspace > <file> 2>&1`, then
`rg -o 'test result: ok\. (\d+) passed; (\d+) failed' -r '$1 $2' <file> | awk '{p+=$1; f+=$2; n++} END {print n, p, f}'`.

**A third.** The workspace suite is evidence on a **quiet host only**. A previous session's first run
failed with **9** `watch_check` bounded-wait timeouts on a byte-identical clean tree while the focused
serial gate passed 20/20 through the same weather. **Do not poll the machine while these suites run** —
`git status` in a loop is enough to confound them. Kill orphans first
(`pkill -f 'target/debug/deps/espansoconfig-'`), run once, and stay off the host. **Round 14's run was
clean on the first attempt**, both for the worker and for the orchestrator's independent re-measure.

**A fourth, carried from round 12.** Something in the environment once rewrote `/goahead` to
`/goahead-fable` **inside historical text** in four committed documents. **Check `git status` for
unexplained one-line document changes before committing any round**, and revert them rather than
carrying them. Round 14's tree showed exactly the five expected files and nothing else.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–14 verbatim. THE work list for round 15.
# docs/decisions/2d-3-notes.md               — the record: §1 (its headline is round 14's High 1 and
#   round 13's High 2, and now carries eight correction blocks), §4, §5 (its new navigational note,
#   and item 17, which said the true thing since round 5), §6's gate table, and §7–§20 (§20 is
#   round 14's, the one under review), plus the four correction blocks §20.5 lists
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 the suppression ruling and
#   its clearing rule, Q3 the highest-sequence rule, Q5 the coalescing rule, Q7 item 3 this step's
#   spec, Q7 item 4 what 2d-4 actually owns, Q1 (with its round-4 correction block)
# crates/espansoconfig-core/src/watch/engine.rs — revert_settlement at ~908 (THE authority for
#   round 14's High 2: `if owed { observe_owed } else { hint }`); observe_owed at ~759; settle and
#   the `Undone` construction, which is where `owed` is decided
# src-tauri/src/ledger.rs                    — the rewritten module doc at ~486–525 (round 13's
#   High 1 and round 14's High 2 both land here); preceded_a_commit at ~845; decide()'s
#   `read_after <= at` at ~1966 (UNCHANGED and cleared at round 10); the test at ~3960
# src-tauri/src/main.rs                      — the module header, rewritten at ~77–115 for BOTH of
#   round 14's Highs; the file round 13's sweep never looked at
# src-tauri/src/watch.rs                     — ReObserveOutcome at ~532; WorkerMessage::Stop
# src-tauri/src/watch_check.rs               — the paragraph at ~1224–1240
# src-tauri/src/commands.rs                  — the module header; the assertion at ~8378;
#   reload() ~836; with_workspace ~1228; the two save tails; run_one_save; commit_and_record
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1268 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). **Unchanged by round 14**, which adds and removes no test and — unlike
  round 13 — changes **no** assertion message either: its non-comment diff in `src-tauri/src/` is
  empty. The Rust ladder across this step's review: 1249 at round 4's brief, 1251 after the round-4
  fix, 1256 after round 5, 1261 after round 6, 1262 after round 7, 1263 after round 8, 1267 after
  round 9, and **1268** after rounds 10, 11, 12, 13 and **14**. 26 result lines, all `ok`, exit 0.
  Clippy `-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri`
  empty. **The frontend has never been touched across the whole step** — re-verified at round 14 with
  `git diff --name-only 08a3366 -- src/`, which is empty — so its three numbers are carried, not
  re-measured.
- **The focused serial gate is `cargo test -p espansoconfig --bin espansoconfig watch_check:: --
  --test-threads=1`, it is **20/20** with **223** filtered out, and it belongs to every future Rust
  gate run.** Its **wall-clock is not a baseline**: 64.77 s and 64.85 s at round 11, 71.24 s then
  285.53 s then 253.40 s at round 12, 237.04 s then 65.14 s at round 13, and **76.96 s then 66.77 s**
  at round 14 — all of them 20/20, 0 failed, exit 0. Round 14 edited only comments in that file.
  **The duration is host state.** What this gate asserts is 20/20 and no timeout, never a wall-clock.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- Consult Q3's highest-sequence rule is no longer load-bearing for the phantom — round 7 removed the
  dependency by never publishing an unstabilized read.
- `SavedDocument::revision` is a **post-rename read-back** (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer
  (§5 item 32, and §17.7 item 34's second half).
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19). **Round 13's High 1 is what happens when a doc elsewhere
  forgets these three — and §5 item 17 is the one round 14's High 2 forgot.**
- **Items 23 and 24 are closed** (round 9). Item 25 is downgraded (round 10) to a maintenance risk.
  Item 26: the third consumer of the workspace/watcher path-spelling agreement. Item 27:
  `latest_commit_at` is never pruned within an epoch. Item 28: a non-zero `preceded_a_commit` supports
  a weaker diagnosis. Item 29: a failed reload of a removed file reports nothing. **Item 30 is closed
  as a defect** (round 11) and survives only as its residue. Item 31: *"sustained growth"* is prose,
  not a check. Item 32: the ledger-only test proves its claims against a hand-passed `Instant`.
  Item 33: the save-thread stall has no test, **and the seam it needs is assigned to no phase**.
  Item 34: `watch_check` asserts strictly less. Item 35: the intermittent-early-stamp detection is
  gone and the seam that would recover it has no owner. Item 36 / **40**: every correction is prose.
  Item 37: a complete *file by file* list is a convention, not a check. Item 38: the liveness contract
  is stated in no single place, so every consumer paraphrases it — **the root cause of round 13's two
  Highs and of round 14's, and the fix round has now declined to build the canonical statement
  twice**. Item 39: the safety half is argued and not driven.
- **New at round 14, items 41–44 in §20.7** — read them there; 43 is the in-place number corrections
  and is the one round 15 is most likely to bite on.

---


### ⚠️ HISTORICAL — the round-13→round-14 handoff, superseded by the round-15 status above. Round 14 is executed, it returned NOT READY with 2 High and 2 Low, and its fix is in the tree and green. Note that this section says *the six correction blocks* and then lists seven — that miscount is round 14's Low 2, corrected in the record rather than rewritten here.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, and round 13 broke the round-12 fix on exactly the shape round 12's brief predicted: **two Highs and one Low**, all fixed, none cleared. THE NEXT ACTION IS ROUND 14 OF THE 2d-3 REVIEW, against the round-13 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–13 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 14's brief is
written from round 13's fix, exactly as rounds 2–13 were written from theirs.

**Round 13's lesson is that a fix round's own new sentences are the next round's richest seam.**
Round 12 corrected a premise at four positions, and in doing so *wrote* two new claims — *bounded by
the host clock advancing* and *bounded in the safe direction*. Round 13's brief asked what the
corrected sentences now rest on, and the answer was: on a liveness guarantee this pipeline expressly
refuses. **Write round 14's brief the same way.** Round 13 replaced eight positions and added six
correction blocks; every one of those is a sentence that did not exist before this round.

That is the **thirteenth consecutive** round with a name-position finding — this time a **module doc**
and the record's **§1 headline**, the single most load-bearing sentence in the document and one no
previous round had attacked. **Both Highs were again this project's declared worst defect class.**

#### What the round-13 fix built — re-derive these, do not inherit them

- **High 1 — *bounded by the host clock advancing* was a liveness claim the state machine refuses.**
  The old sentence said the retry *"is bounded by the host clock advancing"* and that *"every refusal
  is answered by a re-observation"*. Three things in this codebase say otherwise, each in its own doc:
  `crate::watch::ReObserveOutcome` (*"Neither variant claims anything about what will be observed …
  a path that never stabilizes … is never answered at all … `Asked` is **not** a promise that an
  observation will arrive"*), `ObservationEngine::observe_owed` (*"It also promises no answer at all
  for a path that never stabilizes: a file written continuously stays pending, and the debt waits with
  it"*), and `WorkerMessage::Stop`, which a worker can consume before its next tick. `ledger.rs`
  ~486–513 now says the clock bounds only **repeated chronology refusals once another settlement is
  produced**, that **nothing makes one be produced**, and names all three stoppers with their sources.
  **The safety half is kept and separated** — *"The safe direction is the half that holds without any
  of that"* — because the reviewer explicitly cleared it.
- **High 2 — the §1 headline claimed the engine *must answer*.** *"every one of those requests is an
  **owed** observation the engine must answer rather than a hint it may coalesce into silence"* is a
  liveness guarantee at the document's headline, and `observe_owed` refuses it. It now reads *"an
  **owed** observation the engine may not discharge by **coalescing** it into silence, which stays
  owed until a settlement of that path emits and which is never a promise that one will"* — the
  negative guarantee only, concession in the same sentence.
- **The Low — §18.5 misclassified three of five `commands.rs` hits.** Only `commands.rs:155` and
  `:2409` are the serialized-doors argument; `:1339`, `:1371` and `:2057` matched the pattern's *a
  second time* alternative and are about resolving something **twice**, with no clock in them. The
  **count of five was right and the judgement was wrong** — a defect in the sweep's record, not in the
  prose it judged.
- **The fix round's own two sweeps found nine more instances the reviewer did not name**, eight of
  them in code: `ledger.rs`'s *two proofs* bullet, both halves of `LedgerTally::preceded_a_commit`,
  a comment in `record_app_write`, the closing sentence of *a read the save path could not use*,
  `watch_check.rs`'s round-12 paragraph, `commands.rs`'s **module header** (the code twin of the §1
  sentence), and — at a **name position** — the assertion message at `commands.rs:8372`, which said
  *is observed again* over a test that asserts an **inbox**, and now says *is asked for again*.
- **No behaviour change, no signature, no control flow, `decide`'s `read_after <= at` untouched, no
  core file, no `src/` path**, no command, wire type, event, queue, i18n key or user-visible string.
  **The orchestrator verified this rather than accepting it**: `git diff -U0 src-tauri/src/` filtered
  to non-comment lines yields **exactly one** changed line in the whole round, and it is that
  assertion's message string. Five files: `ledger.rs`, `commands.rs`, `watch_check.rs`,
  `2d-3-notes.md`, `phase-2d-3-ledger.md` — plus `PROGRESS.md`, which §19.5 names.

#### What round 14 must attack

- **The fix is a change, and the round that reviews it is not optional.** Round 14's scope is the
  round-13 fix: `ledger.rs`'s rewritten *widening the refusal* passage (~486–513) **and its new
  two-paragraph structure**, the rewritten `preceded_a_commit` doc, `commands.rs`'s module header and
  the changed assertion message, `watch_check.rs`'s rewritten paragraph, §1's rewritten headline, the
  **six** correction blocks (§1, §10.5, §12.6, §15.3, §16.1, §18.1, §18.5), and **§19, which is the
  section under review**.
- **Apply round 13's own lesson to round 13.** It replaced a false liveness claim with a *narrower*
  one at eight positions. **Is the narrower claim true at every one of them?** In particular
  `ledger.rs` ~509–513's new safety sentence — *"what a retry that never completes leaves behind is a
  state still owed — never a state reported wrongly, and never a record cleared by a reading older
  than the commit"* — is a **new** claim about two negatives, and §19.7 item 39 concedes **no test
  drives it**. Check it against `decide`'s arm and `admitting_sink`'s match rather than against the
  sentence.
- **The three new residues, §19.7.** **(38)** the liveness contract is stated in no single place, so
  every consumer paraphrases it and each paraphrase can be wrong — round 13's own two Highs were
  paraphrases, and its sweep found nine more; the fix round **deliberately declined** to invent a
  canonical section while fixing eight positions, and that judgement is round 14's to test.
  **(39)** the safety half is argued, not driven. **(40)** every correction is prose.
- **Residue 38 is the sharpest**, and note the precedent: **seven** §5 items recorded as bounded
  residues have since been found to be real defects, and rounds 12 and 13 *both* had Highs that were
  records about a residue written by the round that created it.
- **Whether §19's own claims are true of the code** — especially §19.4's sweep counts, given as
  **before → after**: liveness shape `ledger.rs` 16→11, `commands.rs` 11→9, the record 21→52; debt
  shape `commands.rs` 2→1, the record 2→10; carried counts ordering-shape record 24→38, costless
  25→25, `same sentence` record 18→26 and `commands.rs` 0→1, `preceded_a_commit` unchanged.
  **§19.4 itself warns that a fix can leave a line-based count almost unmoved** while removing the
  false sentence — so read the hits, never the totals.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5 (items 38–40 are new), §6's gate table
  and §7–§19. **Every one of the thirteen rounds so far found a false claim in this record.**

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, assertion messages — as a pass **distinct** from the prose
sweep. Round 13 is the proof of the second: its High 2 was a **headline** thirteen rounds old, and
one of its own sweep finds was an **assertion message**.

**Brief the review the way rounds 1–13 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### Operational traps — they recur every round

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion stamps `updatedAt`
once, ~10 s after launch, and never advances it. **The working signal is the log file's mtime.** A
drop-in replacement that polls on it is `wait-on-log.sh` (usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` stalled / `4` bad args); it lives in a session scratchpad, so **recreate it from this description
if the path is gone** — it was gone at rounds 10–13 and was rebuilt all four times.

**New at round 13, and it cost a false exit 4.** `node "$CC" status --all --json` returns
`{ workspaceRoot, config, sessionRuntime, running, latestFinished, recent, needsReview }`. Round 12's
note said to concatenate **`running` and `recent`** — that is **still not enough**: when a job
*completes* it leaves `running` and does **not** appear in `recent` either, landing in
**`latestFinished`**, a single object rather than an array. A watchdog polling only the two arrays
stops finding the job at the exact moment it succeeds and exits `4` on a healthy run. **Search
`running`, `recent` and `latestFinished`**, and treat *job not found anywhere* as **probably
finished — go read the result**, never as an error.

The `codex:codex-rescue` subagent returns a "running in background" wrapper **immediately** and does
not deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and drive
`node "$CC" task --background --effort medium "$PROMPT" --json`, then `node "$CC" result <job-id>`,
directly. **Do not run `node "$CC" status <job-id> --json`** — it echoes the entire brief back into
the transcript. Round 13 took **~7 min** at `--effort medium`.

**A second measured trap.** `cargo test --workspace 2>&1 | tail -40` **discards the totals**.
Redirect the whole run to a file and sum it: `cargo test --workspace > <file> 2>&1`, then
`rg -o 'test result: ok\. (\d+) passed; (\d+) failed' -r '$1 $2' <file> | awk '{p+=$1; f+=$2; n++} END {print n, p, f}'`.

**A third, and round 13 hit it head-on.** The **first** `cargo test --workspace` of this session
failed with **9 `watch_check` bounded-wait timeouts** on a byte-identical clean tree at `719c864`,
aborting before any other binary reported. That is the documented scar, not a defect: the focused
serial gate then passed **20/20** on the same tree, and a quiet re-run of the whole workspace gave
**1268 / 0 over 26 lines**. **Do not poll the machine while these suites run** — `git status` in a
loop is enough to confound them. Kill orphans first (`pkill -f 'target/debug/deps/espansoconfig-'`),
run once, and stay off the host.

**A fourth, carried from round 12.** Something in the environment once rewrote `/goahead` to
`/goahead-fable` **inside historical text** in four committed documents. **Check `git status` for
unexplained one-line document changes before committing any round**, and revert them rather than
carrying them. Round 13's tree showed exactly the five expected files and nothing else.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–13 verbatim. THE work list for round 14.
# docs/decisions/2d-3-notes.md               — the record: §1 (its headline is round 13's High 2),
#   §4, §5 (items 38–40 are new), §6's gate table, and §7–§19 (§19 is round 13's, the one under
#   review), plus the six correction blocks §19.5 lists
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 the suppression ruling and
#   its clearing rule, Q3 the highest-sequence rule, Q5 the coalescing rule, Q7 item 3 this step's
#   spec, Q7 item 4 what 2d-4 actually owns, Q1 (with its round-4 correction block)
# src-tauri/src/ledger.rs                    — the rewritten module doc at ~486–513 (round 13's
#   High 1, now two paragraphs); preceded_a_commit at ~845; decide()'s `read_after <= at` at ~1966
#   (UNCHANGED and cleared at round 10); the test at ~3960
# src-tauri/src/watch.rs                     — ReObserveOutcome at ~532, the doc that refuses the
#   liveness claim; WorkerMessage::Stop
# crates/espansoconfig-core/src/watch/engine.rs — observe_owed at ~759, the other refusal
# src-tauri/src/watch_check.rs               — the rewritten paragraph at ~1205–1258
# src-tauri/src/commands.rs                  — the module header; the assertion at ~8372;
#   reload() ~836; with_workspace ~1228; the two save tails; run_one_save; commit_and_record
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1268 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). **Unchanged by round 13**, which adds and removes no test and changes one
  assertion's **message** only. The Rust ladder across this step's review: 1249 at round 4's brief,
  1251 after the round-4 fix, 1256 after round 5, 1261 after round 6, 1262 after round 7, 1263 after
  round 8, 1267 after round 9, 1268 after rounds 10, 11, 12 and **1268** after round 13. 26 result
  lines, all `ok`, exit 0 — measured **twice**, before the fix and after it. Clippy `-D warnings`
  clean; `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty.
  **The frontend has never been touched across the whole step** — re-verified at round 13 with
  `git diff --name-only 08a3366 -- src/`, which is empty — so its three numbers are carried, not
  re-measured.
- **The focused serial gate is `cargo test -p espansoconfig --bin espansoconfig watch_check:: --
  --test-threads=1`, it is **20/20** with **223** filtered out, and it belongs to every future Rust
  gate run.** Its **wall-clock is not a baseline**: 64.77 s and 64.85 s at round 11, 71.24 s then
  285.53 s then 253.40 s at round 12, and **237.04 s then 65.14 s** at round 13 — all of them 20/20,
  0 failed, exit 0. Round 13 edited only comments in that file. **The duration is host state.** What
  this gate asserts is 20/20 and no timeout, never a wall-clock.
- **The scar still binds, and round 13 re-measured it.** The workspace suite is evidence on a **quiet
  host only**: this session's first run failed with **9** `watch_check` bounded-wait timeouts on the
  clean tree at `719c864` while the focused serial gate passed 20/20 through the same weather. Kill
  orphaned test binaries (`pgrep -fl espansoconfig`), stay off the machine, and re-run quietly before
  concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- Consult Q3's highest-sequence rule is no longer load-bearing for the phantom — round 7 removed the
  dependency by never publishing an unstabilized read.
- `SavedDocument::revision` is a **post-rename read-back** (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer
  (§5 item 32, and §17.7 item 34's second half).
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19). **Round 13's High 1 is what happens when a doc elsewhere
  forgets these three.**
- **Items 23 and 24 are closed** (round 9). Item 25 is downgraded (round 10) to a maintenance risk.
  Item 26: the third consumer of the workspace/watcher path-spelling agreement. Item 27:
  `latest_commit_at` is never pruned within an epoch. Item 28: a non-zero `preceded_a_commit` supports
  a weaker diagnosis. Item 29: a failed reload of a removed file reports nothing. **Item 30 is closed
  as a defect** (round 11) and survives only as its residue. Item 31: *"sustained growth"* is prose,
  not a check. Item 32: the ledger-only test proves its claims against a hand-passed `Instant`.
  Item 33: the save-thread stall has no test, **and the seam it needs is assigned to no phase**.
  Item 34: `watch_check` asserts strictly less. Item 35: the intermittent-early-stamp detection is
  gone and the seam that would recover it has no owner. Item 36 / **40**: every correction is prose.
  Item 37: a complete *file by file* list is a convention, not a check.
- **New at round 13.** Item 38: the liveness contract is stated in no single place, so every consumer
  paraphrases it and nothing enforces the paraphrase — **the root cause of both of round 13's Highs**.
  Item 39: the safety half of the refusal is argued and not driven; no test holds a path permanently
  unstable and asserts nothing is published for it.

---


### ⚠️ HISTORICAL — the round-12→round-13 handoff, superseded by the round-14 status above. Round 13 is executed, it returned NOT READY with 2 High and 1 Low, and its fix is in the tree and green.


### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, and round 12 broke round 11's fix on the shape round 11 itself had named: **two Highs and three Lows**, all fixed, none cleared. THE NEXT ACTION IS ROUND 13 OF THE 2d-3 REVIEW, against the round-12 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–12 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 13's brief is
written from round 12's fix, exactly as rounds 2–12 were written from theirs.

**Round 12's lesson is that a round's own lesson must be turned on that round.** Round 11 found that
round 10 *corrected a conclusion and left its premise standing, in the same paragraph*. Round 12's
brief asked whether a **third** premise stood in the paragraphs round 11 had corrected twice — and it
did. **Write round 13's brief the same way**: round 12 corrected one premise across four positions and
one cost-claim across five. Ask what the *corrected* sentences now rest on.

That is the **twelfth consecutive** round with a name-position finding. **Both Highs were again this
project's declared worst defect class**: a record claiming a guarantee the code does not give.

#### What the round-12 fix built — re-derive these, do not inherit them

- **High 1 — program order does not give a strictly greater `Instant`, and four claims said it did.**
  `decide`'s chronology check is `AdmissionDoor::StampedPublication(read_after) => anchor.is_some_and(|at| read_after <= at)`,
  so **equality is on the refusing side**, deliberately and correctly — round 10 cleared that
  behaviour, and round 12 did not touch the comparison. The comment above it already said `Instant`
  is monotonic but *not* guaranteed strictly increasing, and the test helper `later_than_now()` is
  `Instant::now() + 1ns` **because** of it. So *the re-observation's own stamp is taken after the
  anchor* is a statement about **program order** and says nothing about the two `Instant` **values**;
  a clock collision lets one anchor refuse successive re-readings of one path. Four positions
  presented one refusal per commit as a guarantee — `ledger.rs:480`, `ledger.rs:861`,
  `watch_check.rs:1227` and §16.6 item 30's round-11 correction block — and each now carries the
  concession **inside the same sentence**. `ledger.rs:480` also says what bounds the retry: **the host
  clock advancing**, not construction, and bounded in the safe direction because every refusal is
  answered by a re-observation and none of them publishes.
- **The fix round's own sweep found two more instances the reviewer did not name** — §15.3's *"so it
  cannot be refused by the same anchor twice"* and §16.1's **third** bullet — plus one at a **name
  position**: the assertion message closing
  `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading`, which
  generalized a property that test holds only **by construction** through `later_than_now`.
- **High 2 — the removal was recorded as costing nothing, and it cost a detection.** Round 11's neuter
  replaced `WatchWorker::observe`'s per-pass stamp with a `OnceLock`, so it drives the **permanently**
  early stamp and nothing else; what it proves is that the surviving bounded positive wait catches
  *that* case. Under an **intermittently** early stamp the removed line *did* fire: `LedgerTally` is
  cumulative — `begin_epoch` clears `writes`, `documents_by_path`, `announced` and `latest_commit_at`
  but **not** the tally — so one transient refusal left `preceded_a_commit` non-zero for the session
  and the exact-zero assertion failed, whereas the rollback's correctly stamped re-pass satisfies the
  wait and the test now passes. **The removal stands on its merits** (the line could not tell that
  defect from the harmless save-thread stall), but §17.7 item 34's *"exactly as it did before"* was
  false. Five record positions plus `watch_check.rs`'s own comment now state the trade.
- **Low 1 — the orchestrator's named suspect, confirmed.** §16.1's closing paragraph still claimed
  *the first half of the old paragraph is intact* and *the one production assertion of zero is kept
  rather than weakened*; round 11 changed that half and removed that assertion. A correction block now
  sits beneath it.
- **Low 2 — §17.6 named three files and the commit has five.** Corrected; and the fix round found the
  habit is **seven sections older than round 11** — §§10.2, 11.2, 12.4, 13.3, 14.6, 15.6 and 16.3
  never named the review file either, which §18.6 declares rather than hides.
- **Low 3 — item 33 assigned the stamping seam to 2d-4, and the authority assigns it to nobody.**
  `docs/reviews/phase-2d-design.md` **Q7 item 4** scopes 2d-4 to the typed queue,
  `workspace://reconciliation-ready`, `drain_external_changes`, the TypeScript types and wrapper,
  command registration and dispatch tests, sequence/epoch/coalescing tests and the EN/ES namespaces —
  **no stamp and no seam appear in it.** Verified by the orchestrator against Q7 item 4 directly, not
  taken from the reviewer's summary. The attribution is removed and the debt carried unassigned.
- **No behaviour change, no signature, no control flow, `decide`'s comparison untouched, no core file,
  no `src/` path**, no command, wire type, event, queue, i18n key or user-visible string. One
  assertion **message** changed; no assertion added or removed; no test added or removed. Five files:
  `ledger.rs`, `watch_check.rs`, `2d-3-notes.md`, `phase-2d-3-ledger.md`, `PROGRESS.md`.

#### What round 13 must attack

- **The fix is a change, and the round that reviews it is not optional.** Round 13's scope is the
  round-12 fix: the rewritten module-doc sentence at `ledger.rs` ~480, the twice-more-rewritten
  `LedgerTally::preceded_a_commit` bullets, `watch_check.rs`'s two rewritten paragraphs, the test's
  step-5 comment and its rewritten closing assertion message, the **nine** correction blocks in
  `2d-3-notes.md` (§15.3, §16.1's third bullet, §16.1's closing paragraph, §16.6 item 30, §17.3,
  §17.6, §17.6b, §17.7 item 33, §17.7 item 34), and **§18, which is the section under review**.
- **Apply round 12's own lesson to round 12.** It corrected a premise at four positions and a
  cost-claim at five. **What do the corrected sentences now rest on?** In particular: *bounded by the
  host clock advancing* and *bounded in the safe direction* (`ledger.rs` ~485) are new claims about
  liveness and safety that nothing tests; and *the removal was still right — the line could not tell
  that defect from the harmless save-thread stall* is a new justification, not the old one.
- **The three new residues, §18.7.** **(35)** the intermittent-early-stamp detection is gone and
  nothing replaces it; recovering it needs a deterministic production-stamping seam that **Q7 assigns
  to no phase**, so it must not be quietly attached to one again. **(36)** every correction round 12
  made is prose, and no test fails if a later round un-makes one — the same gap `CLAUDE.md` records
  for the i18n suites. **(37)** §18.6's complete file list is a convention, not a check: nothing
  compares a *what changed, file by file* list against `git show <commit> --stat`.
- **Residue 35 is the sharpest**, because it is now a *stated debt with no owner*, and the previous
  two rounds both show what happens to residues written by the round that created them: round 12's
  **both Highs** were records about a residue, written by the round that created it, and both
  overstated it.
- **Whether §18's own claims are true of the code** — especially §18.5's sweep counts, which are given
  as **before → after** pairs (the ordering shape: `ledger.rs` 8→7, `watch_check.rs` 1→1,
  `commands.rs` 5→5, this record 14→24; the costless-removal shape on a deliberately **narrowed**
  pattern: `ledger.rs` 1→1, `watch_check.rs` 1→0, this record 9→25) and §17.5's two carried counts,
  which move to `same sentence` **25** and `preceded_a_commit` in `watch_check.rs` **2**. The
  orchestrator re-measured the last two on the finished tree and both match.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5 (items 25–37), §6's gate table and
  §7–§18. **Every one of the twelve rounds so far found a false claim in this record.**

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, assertion messages — as a pass **distinct** from the prose
sweep. §18.5 records a measured **limit** of the first rule that round 13 should read: a sweep written
from the *words* of a finding cannot find the instance whose wording nobody has thought of yet.

**Brief the review the way rounds 1–12 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### An operational trap — it recurs every round

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion runtime stamps
`updatedAt` once, ~10 s after launch, and never advances it, so the watchdog's stall predicate fires on
a job that is demonstrably working. **The working signal is the log file's mtime.** A drop-in
replacement that polls on it is `wait-on-log.sh` (~110 lines, usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` genuinely stalled / `4` bad args); it lives in a session scratchpad, so **recreate it from this
description if the path is gone** — it was gone at rounds 10, 11 and 12 and was rebuilt all three times.

**New at round 12, and it cost a rebuild:** `node "$CC" status --all --json` returns
`{ workspaceRoot, config, sessionRuntime, running: [...], recent: [...] }`. It has **no `jobs` and no
`tasks` key**, so a watchdog looking for those finds nothing, counts five unreadable polls and exits
`4` on a healthy job. Concatenate **`running` and `recent`** and match on `id`. Verified at round 12 by
listing the envelope's array keys directly.

The `codex:codex-rescue` subagent returns a "running in background" wrapper **immediately** and does not
deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and drive
`node "$CC" task --background --effort medium "$PROMPT" --json`, then `node "$CC" result <job-id>`,
directly. **Do not run `node "$CC" status <job-id> --json`** — it echoes the entire brief back into
the transcript. Round 12 took **~180 s** at `--effort medium`, well under round 10's 282 s.

**A second measured trap.** `cargo test --workspace 2>&1 | tail -40` **discards the totals** — the
run's 26 `test result` lines do not survive the pipe, and the suite has to be run again to count them.
Redirect the whole run to a file and sum it: `cargo test --workspace > <file> 2>&1`, then
`rg -o 'test result: ok\. (\d+) passed; (\d+) failed' -r '$1 $2' <file> | awk '{p+=$1; f+=$2; n++} END {print n, p, f}'`.

**A third, new at round 12 and not a Codex trap at all.** Something in the environment rewrote
`/goahead` to `/goahead-fable` **inside historical text** in four committed documents — `PROGRESS.md`
and `docs/reviews/phase-0b-1-span-layer.md`, `phase-0b-2-trivia-and-ownership.md` and
`phase-2b-2b-2-open-key-code.md` — during the round-12 session, while the `/goahead` skill was being
renamed. Those documents record what was **actually run at the time**; the rename belongs to the
environment's present, not to their past. All four were reverted before the commit. **Check
`git status` for unexplained one-line document changes before committing any round**, and revert them
rather than carrying them.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–12 verbatim. THE work list for round 13.
# docs/decisions/2d-3-notes.md               — the record: §1, §4, §5 (items 35–37 are new; item 33
#   loses its 2d-4 attribution and item 34 is corrected), §6's gate table, and §7–§18
#   (§18 is round 12's, the one under review), plus the nine correction blocks §18.6 lists
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling and
#   its clearing rule, Q3 the highest-sequence rule, Q5 the coalescing rule scoped to
#   conflict_after_the_lock, Q7 item 3 this step's spec, Q7 item 4 what 2d-4 actually owns
#   (Low 3 turns on it), Q1 (with its round-4 correction block)
# src-tauri/src/ledger.rs                    — decide()'s five steps and its `read_after <= at`
#   comparison; CommitAnchor and latest_commit_at; the module doc at ~477; the thrice-rewritten
#   preceded_a_commit doc at ~845; the test at ~3960
# src-tauri/src/watch_check.rs               — the two rewritten paragraphs at ~1205–1256 and the
#   assertion that is NOT there; the bounded positive wait ~20 lines above them
# src-tauri/src/commands.rs                  — reload() at ~836; with_workspace at ~1228;
#   the two save tails; run_one_save; commit_and_record
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1268 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). **Unchanged by round 12**, which adds and removes no test and changes one
  assertion's **message** only. The Rust ladder across this step's review: 1249 at round 4's brief,
  1251 after the round-4 fix, 1256 after round 5, 1261 after round 6, 1262 after round 7, 1263 after
  round 8, 1267 after round 9, 1268 after round 10, 1268 after round 11, **1268** after round 12. 26
  result lines, all `ok`, exit 0 — measured **twice**, before the fix and after it. Clippy
  `-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty.
  **The frontend has never been touched across the whole step** — re-verified at round 12 with
  `git diff --name-only 08a3366 -- src/`, which is empty — so its three numbers are carried, not
  re-measured.
- **The focused serial gate is `cargo test -p espansoconfig --bin espansoconfig watch_check:: --
  --test-threads=1`, it is **20/20** with **223** filtered out, and it belongs to every future Rust
  gate run.** Its **wall-clock is not a baseline**: 64.77 s and 64.85 s at round 11, then 71.24 s
  before round 12's fix and **285.53 s** then **253.40 s** after it — the last on a verified-quiet host
  with no orphaned binary, and all of them 20/20, 0 failed, exit 0. Round 12 edited only comments in
  that file: no timing constant, no wait, no test. **The duration is host state.** What this gate
  asserts is 20/20 and no timeout, never a wall-clock, and §18.6b says so.
- **The scar still binds.** The workspace suite is evidence on a **quiet host only**: contended runs on
  a byte-identical tree have failed with 9 and 10 `watch_check` bounded-wait timeouts while the focused
  serial gate passed 20/20 through the same weather. Kill orphaned test binaries
  (`pgrep -fl espansoconfig`) and re-run quietly before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- Consult Q3's highest-sequence rule is no longer load-bearing for the phantom — round 7 removed the
  dependency by never publishing an unstabilized read. 2d-4 should still keep the rule, but a
  correctness argument no longer rests on it.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer
  (§5 item 32, and §17.7 item 34's second half).
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19).
- **Items 23 and 24 are closed** (round 9). Item 25 is downgraded (round 10) to a maintenance risk.
  Item 26: the third consumer of the workspace/watcher path-spelling agreement. Item 27:
  `latest_commit_at` is never pruned within an epoch. Item 28: a non-zero `preceded_a_commit` supports
  a weaker diagnosis. Item 29: a failed reload of a removed file reports nothing. **Item 30 is closed
  as a defect** (round 11) and survives only as its residue: no test exercises the rename-to-record
  window. Item 31: *"sustained growth"* is prose, not a check, with no per-path counts and no wire
  surface until 2d-4. Item 32: the ledger-only test proves its claims against a hand-passed `Instant`.
  Item 33: the save-thread stall has no test — **and as of round 12 the seam it needs is assigned to no
  phase**, Q7 item 4 having none of it. Item 34: `watch_check` asserts strictly less — **corrected at
  round 12**, because the intermittent case it now misses is one it previously caught.
- **New at round 12.** Item 35: the intermittent-early-stamp detection is gone and nothing replaces
  it; the seam that would recover it has no owner. Item 36: every correction round 12 made is prose,
  enforced by nothing. Item 37: a complete *file by file* list is a convention, not a check.

---

### ⚠️ HISTORICAL — the round-11→round-12 handoff, superseded by the round-13 status above. Round 12 is executed, it returned NOT READY with 2 High and 3 Low, and its fix is in the tree and green.

> **Correction (round 12).** Two claims in the block below were falsified by the round it briefed, and are left standing here per this record's convention of never rewriting history. **(a)** *"driving it needs a deterministic production-stamping seam, which is 2d-4's shape"* — `phase-2d-design.md` Q7 item 4 scopes 2d-4 to the queue, the wake event, the drain command and the wire contracts, and names no stamp and no seam; Q7 assigns the seam to **no phase at all** (round 12's third Low). **(b)** residue 34's *"an intermittent early stamp still passes, exactly as before"* — before round 11 removed the exact-zero assertion it did **not** pass, because the tally is cumulative across an epoch (round 12's second High). See §18.2 and §18.4.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, and round 11 broke round 10's clean sheet immediately with **two Highs, one Medium and one Low**, all fixed. THE NEXT ACTION IS ROUND 12 OF THE 2d-3 REVIEW, against the round-11 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–11 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 12's brief is
written from round 11's fix, exactly as rounds 2–11 were written from theirs.

**Round 11's lesson is the one to carry into round 12: round 10 corrected a *conclusion* and left its
*premise* standing, in the same paragraph.** Round 10's Low was the tally doc's *on a healthy
production path this stays zero*; the rewrite that closed it kept, in the very next clause, *the hints
one commit generates are decided after that commit's anchor and **never** reach this arm* — the same
unenforced timing argument, one level down. **When a round fixes a claim, read the sentence the claim
rested on.**

That is the **eleventh consecutive** round with a name-position finding and the **third consecutive**
where it was a *premise* rather than a word. **Both Highs were this project's declared worst defect
class**: a record claiming a guarantee the code does not give.

#### What the round-11 fix built — re-derive these, do not inherit them

- **High 1 — the doc said *never* while §16.6 item 30 said nothing enforces it**, and both were
  written in the same fix round. The scenario needs no defect anywhere: the save renames to `A` → its
  hint starts stabilizing → **the save thread stalls between the rename and `record_app_write` for
  longer than one debounce plus one probe** → the worker stamps and settles `A` first → the anchor is
  only then recorded → admission correctly answers `PrecedesACommit`. The doc now says zero is the
  **usual** outcome, says *usually is all it is* in the same breath, names the stall, and points at
  item 30. §16.1's **first** bullet carried the same premise one level weaker and carries a
  correction block.
- **High 2 — the record claimed the same-sentence rule was satisfied, and it was not.** §16.1's last
  bullet asserted in as many words that the tally doc *says in the same sentence* that no threshold is
  enforced; in the doc the concession began a new sentence. **The bullet asserting compliance is what
  made the non-compliance invisible.** The doc's bullet is now one sentence, and the concession is
  **widened**, not merely relocated: it now names that the tally keeps no per-path count to read
  growth from and that nothing fails when the counter climbs.
- **The Medium — an assertion credited with a check its neighbour performs.** `watch_check`'s
  `preceded_a_commit == 0` was kept at round 10 because *weakening it removes the only production-path
  check on the stamp*. **That ground was false**: the check is the bounded positive wait for
  `suppressed >= 1` twenty lines above, as the comment directly over the assertion already said.
  **The assertion is removed**, and §16.6 item 30 is closed as a defect while its residue stands.
- **The removal is proved, not inherited** (§17.6b). Neuter: `WatchWorker::observe`'s per-pass
  `Instant::now()` replaced by a `OnceLock` initialized at first use — the *permanently* early stamp
  in its production shape. Under it the test failed at **`timed out waiting for the save's own bytes
  to be suppressed`** (`watch_check.rs:141`, 128.06 s) — the **wait**, not the removed line.
  `watch.rs` was restored byte-identically and is absent from the round's diff.
- **The Low** — the new test's four-tuple message said *no other decision was taken* while step 3
  takes and asserts `Admission::Withheld`. The message is corrected and `withheld == 1` is now
  asserted.
- **No behaviour change, no core file, no `src/` path**, no command, wire type, event or queue. Four
  files: `ledger.rs`, `watch_check.rs`, `2d-3-notes.md`, `phase-2d-3-ledger.md`.

#### What round 12 must attack

- **The fix is a change, and the round that reviews it is not optional.** Round 12's scope is the
  round-11 fix: the twice-rewritten `LedgerTally::preceded_a_commit` doc, `watch_check`'s rewritten
  paragraph **and its now-absent assertion**, the three correction blocks (§16.1 first bullet, §16.1
  last bullet, §16.6 item 30), the test's corrected message and new assertion, and **§17, which is the
  section under review**.
- **Apply round 11's own lesson to round 11.** It corrected two premises — does a third stand in the
  same paragraph? The rewritten doc still argues from *one debounce plus one probe* and from *the
  anchor follows the rename by one read-back*; check every clause that rests on either.
- **The two new residues.** §17.7 records: **(33)** the stall of §17.1 **has no test** — it is a real
  interleaving argued from the same unenforced ordering, and nothing exercises the window between the
  rename and `record_app_write`; driving it needs a deterministic production-stamping seam, which is
  2d-4's shape. **(34)** `watch_check` now asserts strictly **less** than it did: the surviving wait
  proves a *permanent* early stamp only, so an **intermittent** early stamp still passes, exactly as
  before.
- **Residue 34 is the sharpest**, because round 11 removed a check and the round that reviews it must
  decide whether the trade was right rather than accept the argument that removed it.
- **Whether §17's own claims are true of the code** — especially §17.5's sweep counts (14 `same
  sentence` hits on the swept tree, **17** on the finished one; `preceded_a_commit` at `ledger.rs` 15,
  `watch_check.rs` 1, `commands.rs` 1) and §17.6's file list.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5 (items 25–34), §6's gate table and
  §7–§17. **Every one of the eleven rounds so far found a false claim in this record.**

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, assertion messages — as a pass **distinct** from the prose
sweep.

**Brief the review the way rounds 1–11 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### An operational trap — it recurs every round

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion runtime stamps
`updatedAt` once, ~10 s after launch, and never advances it, so the watchdog's stall predicate fires on
a job that is demonstrably working. **The working signal is the log file's mtime.** A drop-in
replacement that polls on it is `wait-on-log.sh` (~110 lines, usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` genuinely stalled / `4` bad args); it lives in a session scratchpad, so **recreate it from this
description if the path is gone** — it was gone at rounds 10 and 11 and was rebuilt both times. The
`codex:codex-rescue` subagent returns a "running in background" wrapper **immediately** and does not
deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and drive
`node "$CC" task --background --effort medium "$PROMPT" --json`, then `node "$CC" result <job-id>`,
directly. **Do not run `node "$CC" status <job-id> --json`** — it echoes the entire brief back into
the transcript. Round 11 took well under round 10's 282 s at `--effort medium`.

**One more measured trap, new at round 11.** `cargo test --workspace 2>&1 | tail -40` **discards the
totals** — the run's 26 `test result` lines do not survive the pipe, and the suite has to be run
again to count them. Redirect the whole run to a file and sum it:
`cargo test --workspace > <file> 2>&1`, then
`rg -o 'test result: ok\. (\d+) passed; (\d+) failed' -r '$1 $2' <file> | awk '{p+=$1; f+=$2; n++} END {print n, p, f}'`.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–11 verbatim. THE work list for round 12.
# docs/decisions/2d-3-notes.md               — the record: §1, §4, §5 (items 33–34 are new, and
#   item 30 now carries a correction block closing it as a defect), §6's gate table, and §7–§17
#   (§17 is round 11's, the one under review), plus the two correction blocks under §16.1
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling and
#   its clearing rule, Q3 the highest-sequence rule, Q5 the coalescing rule scoped to
#   conflict_after_the_lock, Q7 item 3 this step's spec, Q1 (with its round-4 correction block)
# src-tauri/src/ledger.rs                    — decide()'s five steps; CommitAnchor and
#   latest_commit_at; the twice-rewritten preceded_a_commit doc at ~823; the test at ~3880
# src-tauri/src/watch_check.rs               — the rewritten paragraph at ~1205 and the assertion
#   that is NO LONGER THERE; the bounded positive wait ~20 lines above it
# src-tauri/src/commands.rs                  — reload() at ~836; with_workspace at ~1228;
#   the two save tails; run_one_save; commit_and_record
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1268 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). **Unchanged by round 11**, which removed one assertion and added one and so
  added no test. The Rust ladder across this step's review: 1249 at round 4's brief, 1251 after the
  round-4 fix, 1256 after round 5, 1261 after round 6, 1262 after round 7, 1263 after round 8, 1267
  after round 9, 1268 after round 10, **1268** after round 11. 26 result lines, all `ok`, exit 0 —
  measured **twice**, before the fix and after it. Focused serial
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` is **20/20**
  (64.77 s before the fix, 64.85 s after, **223** filtered out both times) and belongs to every future
  Rust gate run. Clippy `-D warnings` clean; `cargo fmt --check` clean;
  `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend has never been touched across
  the whole step** — re-verified at round 11 with `git diff --name-only 052dd38~1 HEAD | rg '^src/'`,
  which is empty — so its three numbers are carried, not re-measured.
- **The scar still binds.** The workspace suite is evidence on a **quiet host only**: contended runs on
  a byte-identical tree have failed with 9 and 10 `watch_check` bounded-wait timeouts while the focused
  serial gate passed 20/20 through the same weather. Kill orphaned test binaries and re-run quietly
  before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- Consult Q3's highest-sequence rule is no longer load-bearing for the phantom — round 7 removed the
  dependency by never publishing an unstabilized read. 2d-4 should still keep the rule, but a
  correctness argument no longer rests on it.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer
  (§5 item 32, and §17.7 item 34's second half).
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19).
- **Items 23 and 24 are closed** (round 9). Item 25 is downgraded (round 10) to a maintenance risk.
  Item 26: the third consumer of the workspace/watcher path-spelling agreement. Item 27:
  `latest_commit_at` is never pruned within an epoch. Item 28: a non-zero `preceded_a_commit` supports
  a weaker diagnosis. Item 29: a failed reload of a removed file reports nothing. **Item 30 is closed
  as a defect by round 11** — the assertion it was written about is gone — and survives only as its
  residue: no test exercises the rename-to-record window. Item 31: *"sustained growth"* is prose, not
  a check, with no per-path counts and no wire surface until 2d-4. Item 32: the ledger-only test
  proves its claims against a hand-passed `Instant`.
- **New at round 11.** Item 33: the save-thread stall of §17.1 is a real interleaving with **no test**;
  driving it needs a deterministic production-stamping seam, which is 2d-4's shape. Item 34:
  `watch_check` now asserts strictly less — the surviving positive wait proves a **permanent** early
  stamp only, so an intermittent one still passes.

---
### ⚠️ HISTORICAL — the round-10→round-11 handoff, superseded by the round-12 status above. Round 11 is executed, it returned NOT READY with 2 High, 1 Medium and 1 Low, and its fix is in the tree and green.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, and round 10 is the first round in ten to return **no High and no Medium**. It returned one Low, which is fixed. THE NEXT ACTION IS ROUND 11 OF THE 2d-3 REVIEW, against the round-10 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–10 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 11's brief is
written from round 10's fix, exactly as rounds 2–10 were written from theirs.

**Round 10 broke the streak, and what it *cleared* matters more than what it found.** Nine
consecutive rounds had each returned at least one High. Round 10 returned none, and it cleared, with
reasons rather than shrugs:

- **The three-map combination**, which was the brief's first question — the round-9 fix took all
  three of round 9's remedies literally and with no deviation, leaving `writes`, `announced` and
  `latest_commit_at` with three different lifetimes and only one of them cleared by `decide`. The
  verdict: three lifetimes are right **because the three maps answer three different questions**.
  Suppression records end when their licence becomes stale, announced entries track what a consumer
  was shown, and commit anchors stay chronology-only until the epoch ends.
- **The orchestrator's named suspect**, and this one is worth keeping. The brief asked whether High
  3's remedy had been applied at only one of its two sites: `conflict_after_the_lock`
  (`commands.rs:2474`) and `after_a_save` (`commands.rs:2730`) *also* call `workspace.refresh` and so
  also accept a foreign revision into the workspace cache, while the withholding door announces
  nothing and `after_a_save`'s agreeing arm calls the ledger not at all. It is **not** High 3's shape:
  the withholding door's refreshed state is **deliberately shown to nobody**, so an older announced
  `B` remains valid and a later return to `B` may correctly coalesce. **The asymmetry between the
  reload and the two save tails is the design, not an omission** — do not "fix" it in a later round.
- **§5 item 25 — the implementer's own prediction for this round's High — judged and downgraded.**
  The arm-scoped refresh audit is **currently exact**, and the rejected one-caller chokepoint would
  not have enforced future use anyway, so it is a **maintenance risk rather than a present
  behavioural defect**. This is the **first** §5 item predicted to become a High that survived the
  round it was written for, against seven that did not.
- **§5 items 26, 27 and 29**, both `differs` conditions, failed reloads, removed files and
  already-held revisions.

#### What the round-10 fix built — re-derive these, do not inherit them

- **The Low was the tenth consecutive name-position finding, and again a *premise* rather than a
  word.** The round-9 fix round wrote §5 item 28 correctly — a non-zero `preceded_a_commit` now
  supports a weaker diagnosis — but left `LedgerTally::preceded_a_commit`'s **own doc** still
  claiming *on a healthy production path this stays zero*, which the anchor's epoch-long life makes
  false. **The record and the name position contradicted each other for a round.**
- The doc now says: **zero is what an ordinary save-generated hint produces**, a non-zero value can
  equally be a **healthy observation spanning a commit**, and what is left to diagnose bad stamping
  is **sustained growth out of proportion to this session's commits**, or the focused save test —
  with the same sentence saying **no threshold is enforced anywhere**.
- **§5 item 28's own false clause** (*"true for the same reason it always was — the engine's
  debounce"*) is corrected in place, with a correction block recording that item and doc disagreed
  from round 9 until now.
- **`watch_check.rs`'s `preceded_a_commit == 0` assertion is kept**, not weakened, with a new
  paragraph scoping that zero **to that test's construction** and naming the unenforced duration
  ordering it rests on.
- **One new test**, `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading`
  (`ledger.rs:3875`) — ledger-only, no engine, no filesystem, no sleep. Proved against **two**
  neuters: (A) coupling the anchor's removal back into `clear_the_record_at`, the pre-round-9
  shape — the test fails at the refusal assertion; (B) replacing the stamped arm's comparison with
  `anchor.is_some()` — the test fails at the health half, which neuter A does not reach.
- **No core change**; no new command, event, queue, wire type or frontend file.

#### What round 11 must attack

- **The fix is a change, and the round that reviews it is not optional.** Round 11's scope is the
  round-10 fix: the rewritten tally doc, §5 item 28's correction block, `watch_check`'s new scoping
  paragraph, the new test, and **§16, which is the section under review**.
- **The three new residues, judged with expectation rather than suspicion** — seven §5 items written
  as honestly bounded have later been found to be real defects, and only item 25 has so far
  survived. §16.6 records: **(30)** `watch_check`'s exact-zero assertion rests on a probe interval
  versus the rename-to-record window — **reasoned, never measured**, so a slow enough host could fail
  it with no defect present, and it was deliberately not weakened; **(31)** *"sustained growth"* is
  **prose, not a check** — the tally keeps one cumulative `u64` per decision, no per-path counts, and
  has no wire surface until 2d-4; **(32)** the new test's production coverage is exactly what the
  existing engine-level test already gave, its own claims are proved against a **hand-passed
  `Instant`**, and **a stamp taken too late stays invisible**.
- **Residue 30 is the sharpest**, because it is this project's named worst class in miniature: an
  assertion whose justification is an unmeasured timing argument, kept rather than weakened.
- **Whether the doc's new sentence is now true of its predicate** — it claims what sustained growth
  would mean while conceding nothing enforces it. Check that the concession is in the **same
  sentence** as the claim, which is this project's standing rule.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5 (items 25–32), §6's gate table and
  §7–§16. **Every one of the ten rounds so far found a false claim in this record.**

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, assertion messages — as a pass **distinct** from the prose
sweep. **Ten consecutive rounds have now found a name-position defect**, and the last two were
premises rather than words.

**Brief the review the way rounds 1–10 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### An operational trap — it recurs every round

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion runtime stamps
`updatedAt` once, ~10 s after launch, and never advances it, so the watchdog's stall predicate fires on
a job that is demonstrably working. **The working signal is the log file's mtime.** A drop-in
replacement that polls on it is `wait-on-log.sh` (~90 lines, usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` genuinely stalled / `4` bad args); it lives in a session scratchpad, so **recreate it from this
description if the path is gone** — it was gone at round 10 and was rebuilt. The
`codex:codex-rescue` subagent returns a "running in background" wrapper **immediately** and does not
deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and drive
`node "$CC" task --background --effort medium "$PROMPT" --json`, then `node "$CC" result <job-id>`,
directly. **Do not run `node "$CC" status <job-id> --json`** — it echoes the entire brief back into
the transcript. Round 10 took **282 s** of Codex wall clock at `--effort medium`.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–10 verbatim. THE work list for round 11.
# docs/decisions/2d-3-notes.md               — the record: §1, §4, §5 (items 30–32 are new), §6's
#   gate table, and §7–§16 (§16 is round 10's, the one under review), plus the new correction block
#   under §5 item 28
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling and
#   its clearing rule, Q3 the highest-sequence rule, Q5 the coalescing rule scoped to
#   conflict_after_the_lock, Q7 item 3 this step's spec, Q1 (with its round-4 correction block)
# src-tauri/src/ledger.rs                    — decide()'s five steps; CommitAnchor and
#   latest_commit_at; the rewritten preceded_a_commit doc at ~823; the new test at ~3875
# src-tauri/src/watch_check.rs               — the exact-zero assertion and its new scoping paragraph
# src-tauri/src/commands.rs                  — reload() at ~836; with_workspace at ~1228;
#   the two save tails; run_one_save; commit_and_record
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1268 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust ladder across this step's review: 1249 at round 4's brief, 1251
  after the round-4 fix, 1256 after round 5, 1261 after round 6, 1262 after round 7, 1263 after round
  8, 1267 after round 9, **1268** after the round-10 fix (**+1**:
  `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading`).
  26 result lines, all `ok`. Focused serial
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` is **20/20**
  (64.44 s, **223** filtered out — one more than round 9's 222, which is the new test landing in the
  same binary) and belongs to every future Rust gate run. Clippy `-D warnings` clean;
  `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend has
  never been touched across the whole step** — re-verified at round 10 with
  `git diff --name-only 052dd38~1 HEAD | rg '^src/'`, which is empty — so its three numbers are
  carried, not re-measured.
- **The scar still binds.** The workspace suite is evidence on a **quiet host only**: contended runs on
  a byte-identical tree have failed with 9 and 10 `watch_check` bounded-wait timeouts while the focused
  serial gate passed 20/20 through the same weather. Kill orphaned test binaries and re-run quietly
  before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- Consult Q3's highest-sequence rule is no longer load-bearing for the phantom — round 7 removed the
  dependency by never publishing an unstabilized read. 2d-4 should still keep the rule, but a
  correctness argument no longer rests on it.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer
  (restated as §5 item 32).
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19).
- **Items 23 and 24 are closed** (round 9). Item 25 is **downgraded by round 10** to a maintenance
  risk: nothing forces a future read path to report, but the audit is exact today. Item 26: the third
  consumer of the workspace/watcher path-spelling agreement. Item 27: `latest_commit_at` is never
  pruned within an epoch. Item 28: a non-zero `preceded_a_commit` supports a weaker diagnosis —
  **its doc now says so** (round 10). Item 29: a failed reload of a removed file reports nothing.
- **New at round 10.** Item 30: `watch_check`'s exact-zero assertion rests on an **unmeasured** timing
  argument. Item 31: *"sustained growth"* is prose, not a check, and the tally has no per-path counts
  and no wire surface until 2d-4. Item 32: the new test proves its claims against a hand-passed
  `Instant`, and a stamp taken too late stays invisible.

---

### ⚠️ HISTORICAL — the round-9→round-10 handoff, superseded by the round-11 status above. Round 10 is executed, it returned NOT READY with 0 High, 0 Medium and 1 Low, and its fix is in the tree and green.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, but the step review stands at round 9, which returned **three** Highs, all defects in behaviour. THE NEXT ACTION IS ROUND 10 OF THE 2d-3 REVIEW, against the round-9 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–9 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 10's brief is
written from round 9's fix, exactly as rounds 2–9 were written from theirs.

**Round 9 is the sharpest round of this tail.** It **cleared** round 8's whole argument — a marker is
a user-visible save-conflict fact rather than a sequence-backed external report, the serialized
clearing extension is sound for both tails, marking coalesces pending matching hints while its entry
stands, withholding correctly permits the externally restored revision to publish — and it cleared the
three defects the round-8 fix round had self-caught. **Then it returned three Highs, all behaviour,
all one root cause: nothing told the ledger when the workspace accepts a foreign revision.**
`reload_document` re-read disk and updated the workspace cache while touching the ledger not at all.

**Two of those three Highs were §5 items 23 and 24 — written by the round-8 fix round *one round
earlier*, as honestly bounded residues, deferred in writing.** That makes **seven** §5 items so
recorded and later found to be real defects: item 10 (round 2), item 16 (round 4), item 18 (round 5),
items 20 and 3 (round 6), items 23 and 24 (round 9). **The posture toward every remaining open item of
§5 is no longer suspicion but expectation** — and the round-9 fix round wrote **five more** (items
25–29) while predicting item 25 will be round 10's High.

#### What the round-9 fix built — re-derive these, do not inherit them

- **`WriteLedger::adopt_reloaded_revision_under_the_session_lock(path, revision)`** — one new
  **non-door** entry point, called from `WorkspaceSession::reload` **inside `with_workspace`'s
  closure** (`commands.rs:836–844`). Under **one** state guard it drops the app-write record when it
  names a **different** revision, and the announced state when it is **not** that state. Both are
  scoped to *differs*, which honours §14.2's one surviving reason — clearing on a reload whose read
  *equals* the record would unsuppress that write's own pending native hints with nothing announced to
  absorb them, a **false external change**, the one outcome this module may not produce — and lets
  Q5's marker survive *Reload disk version*.
- **The path is resolved *before* the refresh**, so no successful reload can skip the invalidation.
- **`RecordedWrite` is deleted.** The commit instant now lives in
  `LedgerState::latest_commit_at: BTreeMap<PathBuf, CommitAnchor>`, written by `record_app_write` under
  the record's own guard, read by `decide` step 1, and removed by **`begin_epoch` alone** — so the
  anchor **outlives the record it was taken with**, which is High 2. It is keyed by **path**, because
  step 3 removes the `documents_by_path` index a document-keyed anchor would hide behind.
- **The lock-order argument, verified by the orchestrator rather than accepted:** `with_workspace`
  takes the session mutex and holds it across the whole closure (`commands.rs:1228–1237`), and the new
  method takes `enter_gate()` then `lock()` beneath it — **session → gate → state, no inversion**. The
  session lock is **load-bearing rather than incidental**: releasing it between the refresh and the
  report would let a commit land inside, and this call would then clear a record a save had just
  taken, which is round 2's High reached through a read-only command.
- **§14.2's rejection is reversed in place**, with both false grounds named: `WorkspaceSession::document`
  and `text` are **cached** reads (`document_view`, `document_text`) that cannot accept a foreign disk
  revision, so they never "re-created the same gap"; and `reload` **already** mutated the workspace
  cache, so private ledger state widens no command signature and makes no writer of it.
- **No core change at all**; no new command, event, queue, wire type or frontend file.

#### The deviation round 10 must judge first — there is none, and that is itself the thing to check

The round-9 fix took the reviewer's remedy on **all three** Highs with no deviation. **A fix round that
deviates from nothing is unusual in this review**, and the two rounds that did deviate (7 and 8) had
their arguments judged first and one was reversed. So round 10's first job is different: **judge
whether taking all three remedies literally was right**, and in particular whether the *combination*
is coherent — High 1 and High 3 clear two maps from one new entry point, while High 2 makes a third
map outlive both. Three maps with three lifetimes, and only one of them is now cleared by `decide`.

#### What round 10 must attack

- **§5 item 25, first and hardest — the implementer's own prediction for this round's High.**
  *Nothing forces a future read path to report.* The claim that every path accepting a foreign revision
  tells the ledger is an **audit of today's call sites, not a property of a type**, and a shared
  chokepoint was rejected as one-caller surface. The step has now shipped, twice, a rule expressed as
  an enumeration that a later reader must re-derive; `AdmissionDoor`'s exhaustive match exists
  precisely because that shape failed before. Is the audit true today, and is rejecting the chokepoint
  right?
- **The three lifetimes.** `writes` (cleared by step 3, by `record_app_write`, and now by a reload),
  `announced` (cleared by `record_app_write` and now by a reload) and `latest_commit_at` (cleared by
  `begin_epoch` **alone**, never pruned within an epoch — §5 item 27). Does any pair now disagree in a
  way `decide` cannot see? An anchor that outlives every record for its path is by construction a
  suppression-free but chronology-bearing state: what refuses what, and for how long?
- **The *differs* scoping on both invalidations.** It is load-bearing in the dangerous direction
  (equal → keep, or a false external change). Verify it against a reload that **fails**, a reload of a
  **removed** file (§5 item 29 says it reports nothing), and the case where the workspace already held
  the revision the reload returns.
- **`preceded_a_commit`'s weakened diagnosis** (§5 item 28) — a non-zero tally no longer means what
  `crate::watch_check`'s positive wait was written to assume. Round 3's precedent: a tally that stops
  discriminating is how a stamp taken too early becomes untestable.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5 (items 23–29), §6's gate table and
  §7–§15 (**§15 is the section under review**), plus the new correction blocks under §5 items 23/24,
  §14.1, §14.2 and §14.8. **Every one of the nine rounds so far found a false claim in this record**,
  and the round-9 fix round **found one in its own** before reporting: it had written that *every*
  `Workspace::refresh` call site is followed by a ledger call, which is false — a failed refresh and
  `after_a_save`'s agreeing arm call nothing — and corrected it in three places to the true claim.
  **Do not treat that self-catch as credit**; judge the correction as harshly as a finding of your own.

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, assertion messages — as a pass **distinct** from the prose
sweep. Round 9's Low 4 was the **ninth consecutive** name-position miss and it was a **premise** rather
than a word (*the read follows a commit*, false because `after_a_save` also runs after
`committed: false`). This round deleted a type (`RecordedWrite`), added one (`CommitAnchor`), added a
map and a non-door entry point, and changed what `reload` *is*.

**Brief the review the way rounds 1–9 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### An operational trap — it recurs every round

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion runtime stamps
`updatedAt` once, ~10 s after launch, and never advances it, so the watchdog's stall predicate fires on
a job that is demonstrably working. **The working signal is the log file's mtime.** A drop-in
replacement that polls on it is `wait-on-log.sh` (~60 lines, usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` genuinely stalled / `4` bad args); it lives in a session scratchpad, so **recreate it from this
description if the path is gone**. The `codex:codex-rescue` subagent returns a "running in background"
wrapper **immediately** and does not deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and drive
`node "$CC" task --background --effort medium "$PROMPT" --json`, then `node "$CC" result <job-id>`,
directly. Rounds 8 and 9 each took ~7 min of Codex wall clock at `--effort medium`.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–9 verbatim. THE work list for round 10.
# docs/decisions/2d-3-notes.md               — the record: §1, §4, §5 (items 25–29 are new), §6's
#   gate table, and §7–§15 (§15 is round 9's, the one under review), plus the new correction blocks
#   under §5 items 23/24, §14.1, §14.2 and §14.8
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling and
#   its clearing rule, Q3 the highest-sequence rule, Q5 the coalescing rule scoped to
#   conflict_after_the_lock, Q7 item 3 this step's spec, Q1 (with its round-4 correction block)
# src-tauri/src/ledger.rs                    — decide()'s five steps; CommitAnchor and
#   latest_commit_at; adopt_reloaded_revision_under_the_session_lock at ~1476
# src-tauri/src/commands.rs                  — reload() at ~836; with_workspace at ~1228;
#   the two save tails; run_one_save; commit_and_record
# docs/decisions/2d-1-notes.md               — the engine's contract, plus §2.1's correction blocks
# docs/decisions/2d-2-notes.md               — §2.1 the lock and join argument; §2.3, which expressly
#   permits a healthy native backend to miss a hint
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1267 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust ladder across this step's review: 1249 at round 4's brief, 1251
  after the round-4 fix, 1256 after round 5, 1261 after round 6, 1262 after round 7, 1263 after round
  8, **1267** after the round-9 fix (**+4**:
  `a_reload_that_accepts_other_bytes_ends_the_records_suppression_licence`,
  `a_reload_that_accepts_other_bytes_invalidates_the_announced_state`,
  `a_commit_anchor_outlives_the_record_it_was_taken_with`,
  `a_reload_tells_the_ledger_which_revision_the_workspace_accepted`). 26 result lines, all `ok`.
  Focused serial `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1`
  is **20/20** (64.43 s) and belongs to every future Rust gate run. Clippy `-D warnings` clean;
  `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend has
  never been touched across the whole step** — re-verified against all six commits' file lists — so
  its three numbers are carried, not re-measured.
- **The scar still binds.** The workspace suite is evidence on a **quiet host only**: contended runs on
  a byte-identical tree have failed with 9 and 10 `watch_check` bounded-wait timeouts while the focused
  serial gate passed 20/20 through the same weather. Kill orphaned test binaries and re-run quietly
  before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- Consult Q3's highest-sequence rule is no longer load-bearing for the phantom — round 7 removed the
  dependency by never publishing an unstabilized read. 2d-4 should still keep the rule, but a
  correctness argument no longer rests on it.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer.
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19).
- **New at round 9, and §5 items 23 and 24 are now *closed* rather than carried.** Item 25: nothing
  forces a future read path to report — an audit, not a type, and the implementer's own prediction for
  round 10's High. Item 26: the third consumer of the workspace/watcher path-spelling agreement. Item
  27: `latest_commit_at` is never pruned within an epoch. Item 28: a non-zero `preceded_a_commit` now
  supports a weaker diagnosis than `watch_check`'s positive wait assumes. Item 29: a failed reload of a
  removed file reports nothing.

---

### ⚠️ HISTORICAL — the round-8→round-9 handoff, superseded by the round-10 status above. Round 9 is executed, it returned NOT READY with 3 High and 4 Low, and its fix is in the tree and green.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, but the step review stands at round 8, and round 8 returned the first High since round 6 that is a defect in *behaviour*. THE NEXT ACTION IS ROUND 9 OF THE 2d-3 REVIEW, against the round-8 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–8 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 9's brief is
written from round 8's fix, exactly as rounds 2–8 were written from theirs.

**Eight rounds, eight narrower instances — and round 8 found its High one step *above* where the
brief pointed.** The brief asked whether `decide`'s shared steps still mean the same thing for a door
that will not announce, and named step 4's `Duplicate` as the suspect. The reviewer **cleared
`Duplicate`** and found step 2 instead: `self_write_suppresses` ran **before the door was consulted**,
so a stale app-write record could answer `SelfWrite` to a serialized save-tail reading — retaining the
record, marking nothing, announcing nothing, and returning above the only two things that door exists
to do. It also **cleared round 7's whole deviation** — the marker/withholding asymmetry, `Duplicate`
before the withholding arm where an earlier announcement genuinely exists, a marker overwriting a
newer publication as over-reporting rather than silence, marker invalidation on commit, and the
recorded no-watcher trade.

**The path needs no race, and both premises were confirmed in the code by the orchestrator before the
fix round was briefed:** `reload_document` (`commands.rs:2736`) is `session.reload(id)` and touches
the ledger **not at all**; `committed_revision` (`commands.rs:1705`) answers `Some` only for
`committed: true`, so a save that commits nothing leaves the previous record standing while the
workspace has moved on.

#### What the round-8 fix built — re-derive these, do not inherit them

- **Step 2 is now a `match door`, structurally identical to step 1's** (`ledger.rs:1572–1592`).
  `self_write_suppresses` is asked of `AdmissionDoor::StampedPublication` alone; both serialized doors
  answer `false` and fall through to step 3, which clears the record. The `ObservedState` narrowing
  (absence and unreadability are not routed through the predicate) moved **inside** the stamped arm.
  The enum is now matched **three** times rather than twice, so a fourth door cannot be added without
  answering this question for itself.
- **The argument recorded is narrower than *the record might be stale*** (`2d-3-notes.md` §14.1):
  suppression exists to absorb the several **native hints** one atomic replacement generates; a native
  hint arrives through exactly one door; a serialized caller brings a read it took itself, under the
  session lock, after the record, through a door that since round 7 **cannot publish** — and the
  mistake suppression prevents (reporting this application's own write as somebody else's) is
  something only a **publication** can commit. §14.1 argues this is **Q2 followed more exactly rather
  than a deviation from it**, and concedes in the same breath that it **does** extend Q2's *clearing*
  rule, which names three events and not this one.
- **Step 3's justification is restated as a two-bullet partition** (`ledger.rs:1437–1461`), because
  its old ground — *"a `Content` state reaching here was already proved by step 2 not to be the
  recorded bytes"* — is false for a serialized door under the fix.
- **One new test**, `a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes`, and one
  renamed with its assertions replaced (`a_conflict_against_this_apps_own_committed_bytes_is_suppressed`
  → `…_is_marked_rather_than_suppressed`). Both proved failing without the fix, in three neuter runs.
- **No core change at all**; no command, event, queue, wire type or frontend file.

#### The deviation round 9 must judge first

There is no deviation from the reviewer's remedy this time — **the deviation is in the *argument***.
The fix round did not justify the change on the reviewer's ground (a *stale* record) but on a stronger
one: that suppression has **no work to do** on the serialized doors *whether or not the record is
stale*, because only a publication can misreport. That is a wider claim than the finding required, and
it is the claim round 9 must attack first. In particular:

- Is *"only a publication can commit the error suppression prevents"* true, given that a **marker**
  writes into `announced` and a consumer reads that map? A marker announces a state to 2d-4/2d-5
  without spending a sequence — does announcing this application's own bytes through a marker
  misreport, even though no sequence moves?
- §14.1 concedes the fix **extends consult Q2's clearing rule** to an event Q2 does not name. §13
  already crossed that line once. Is the extension sound, or is it the second unremarked widening of a
  consult rule in two rounds?

#### What round 9 must attack

- **The argument above**, first and hardest.
- **What clearing the record gives up.** Step 3 now runs for serialized readings that *equal* the
  recorded bytes. Work the pending-native-hint case through for **both** doors: after the marking door
  clears and announces, do the app's own pending hints coalesce at step 4 — and for how long, given
  §5 item 24 says `announced` can itself go stale? After the withholding door clears and announces
  **nothing**, the same hints publish. §14.2 calls that accepted over-reporting and the prescribed
  regression asks for exactly it; check that it is over-reporting and not a false external change.
- **§5 item 23, which this round widened by one input class.** Clearing a record clears the chronology
  anchor with it, so a reading stamped *before* that record has nothing to refuse it. It is recorded as
  pre-existing and closable only by giving the anchor its own lifetime. Judge that as §5 items are now
  judged — **with suspicion**: five §5 items written as honestly bounded have later been found to be
  real defects, and item 3 twice.
- **§5 item 24, which this round created by its own sweep** — `announced` can go stale exactly as the
  record could, because `reload_document` tells it nothing either, so a revert to a state the person
  has navigated away from coalesces into silence. It is deferred to 2d-5. Is deferral right, or is
  this round 3's swallowed change reached from a fourth side?
- **The root-cause fix that was rejected**, with four reasons (`2d-3-notes.md` §14.2) — chiefly that it
  fixes no door, needs a fourth ledger mutation path from a **read-only** command, and records a fact
  (*what the consumer has accepted*) that consult Q3/Q5 give to 2d-5. Judge the rejection.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5, §6's gate table and §7–§14 (**§14 is
  the section under review**). **Every one of the eight rounds so far found a false claim in this
  record**, and §13's correction blocks from this round are themselves new claims.

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, assertion messages — as a pass **distinct** from the prose
sweep. Round 8's second Low was the **eighth consecutive** incomplete name sweep; this round moved six
prose positions and eight assertion messages from "published" to "announced" and left the legitimate
uses of "published" standing beside them, which is exactly the shape that hides the ninth.

**The fix round's own self-review found three defects in its own change and closed them** — an
over-narrowed claim (*"the entry is always an earlier save's"*, false for `after_a_save` on a committed
save) in four code sites and the record; three unqualified *"the marker takes the job over"* sentences,
now bounded by *while it stands*; and an **inferred** neuter-suite total in its own evidence,
re-measured. **Do not treat that self-catch as credit** — judge those three closures as harshly as
findings you made yourself. That instruction is what produced round 6's High 1.

**Brief the review the way rounds 1–8 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### An operational trap — it recurs every round

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion runtime stamps
`updatedAt` once, ~10 s after launch, and never advances it, so the watchdog's stall predicate fires
on a job that is demonstrably working. **The working signal is the log file's mtime.** A drop-in
replacement that polls on it is `wait-on-log.sh` (~60 lines, usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` genuinely stalled / `4` bad args); it lives in a session scratchpad, so **recreate it from this
description if the path is gone**. The `codex:codex-rescue` subagent returns a "running in background"
wrapper **immediately** and does not deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and
drive `node "$CC" task --background --effort medium "$PROMPT" --json`, then
`node "$CC" result <job-id>`, directly. Round 8 took ~7 min of Codex wall clock at `--effort medium`.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–8 verbatim. THE work list for round 9.
# docs/decisions/2d-3-notes.md               — the record: §1, §4, §5 (items 23 and 24 are new), §6's
#   gate table, and §7–§14, one section per fix round (§14 is round 8's, the one under review)
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling and
#   its clearing rule, Q3 the highest-sequence rule, Q5 the coalescing rule scoped to
#   conflict_after_the_lock, Q7 item 3 this step's spec, Q1 (with its round-4 correction block)
# src-tauri/src/ledger.rs                    — decide() at ~1518; step 2's door match at ~1572–1592;
#   step 3's restated partition at ~1437–1461; step 5 at ~1607
# src-tauri/src/commands.rs                  — the two save tails; run_one_save; commit_and_record
# docs/decisions/2d-1-notes.md               — the engine's contract, plus §2.1's correction blocks
# docs/decisions/2d-2-notes.md               — §2.1 the lock and join argument; §2.3, which expressly
#   permits a healthy native backend to miss a hint
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1263 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust ladder across this step's review: 1249 at round 4's brief, 1251
  after the round-4 fix, 1256 after the round-5 fix, 1261 after the round-6 fix, 1262 after the
  round-7 fix, **1263** after the round-8 fix (**+1**, the one new test). 26 result lines, all `ok`.
  Focused serial `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1`
  is **20/20** (67.15 s) and belongs to every future Rust gate run. Clippy `-D warnings` clean;
  `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend has
  never been touched across the whole step** — re-verified against all five commits' file lists — so
  its three numbers are carried, not re-measured.
- **The scar still binds, and it bit again in this round.** The workspace suite is evidence on a
  **quiet host only**: the fix round saw one run come back 228/10 with ten `watch_check.rs:141`
  bounded-wait timeouts while an orphaned test binary from a cancelled run competed with it; the host
  was quieted and the suite is 1263/0 twice quietly, with the focused gate 20/20 through the same
  weather. Re-run quietly before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- Consult Q3's highest-sequence rule is no longer load-bearing for the phantom — round 7 removed the
  dependency by never publishing an unstabilized read. 2d-4 should still keep the rule, but a
  correctness argument no longer rests on it.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer.
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19) — which decides whether a conflict's disk side is ever
  announced at all.
- **New at round 8.** §5 item 23: clearing a record clears the chronology anchor with it, so a reading
  stamped before that record has nothing to refuse it — pre-existing, widened by one input class, and
  closable only by giving the anchor its own lifetime. §5 item 24: `announced` can go stale exactly as
  the record could, because `reload_document` tells it nothing either — deferred to 2d-5's
  per-document accepted sequence.

---

### ⚠️ HISTORICAL — the round-7→round-8 handoff, superseded by the round-9 status above. Round 8 is executed, it returned NOT READY with 1 High and 2 Low, and its fix is in the tree and green.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, but the step review stands at round 7, and round 7 reversed a deliberate deviation by owner decision. THE NEXT ACTION IS ROUND 8 OF THE 2d-3 REVIEW, against the round-7 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–7 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 8's brief is
written from round 7's fix, exactly as rounds 2–7 were written from theirs.

**Seven rounds, seven narrower instances — and round 7 is the first whose High was not narrower but
the *same* finding re-asserted.** Round 7's whole first job was to judge the round-6 fix round's
deliberate deviation (*publish **and** ask*), and it judged it **wrong**. The reason is a misreading
of consult Q3 that the record had turned into a guarantee: Q3 says the frontend acts only on the
**highest sequence it has accepted**, which forbids regressing to an older sequence but does **not**
oblige a consumer to wait for a sequence that does not exist yet. So a 2d-4 drain landing between the
phantom P at sequence *n* and the stabilized Q at *n+1* legitimately accepts P, a write surface
installs it, the person confirms *Reload*, and **their draft is gone** — Q cannot give it back. That
is **§5 item 3 wrong for the second time**, and the sixth consecutive round to find a false claim in
this record.

#### The owner decision this round rests on — 2026-08-25

Four resolutions were put to the owner and **"adopt the remedy" was chosen**: split the coalescing
marker from the sequence-spending publication, rather than (b) publishing P marked provisional and
binding 2d-4 to it, (c) recording the draft-loss path as an honest §5 hole, or (d) stabilizing on the
save path with two reads under the session lock. **Round 8 may reopen the engineering, but the
choice among those four is settled** — do not re-litigate it as a finding.

#### What the round-7 fix built — re-derive these, do not inherit them

- **Three doors where there was one, and `decide`'s step 5 is the only step that differs between
  them.** `AdmissionDoor` is a **private, exhaustively matched** three-variant enum (the technique
  the round-5 fix used for `ReadChronology`, so a fourth door is a compile error rather than a
  skipped case). `ledger.rs:1409–1428` is the whole of it:
  - `StampedPublication` — the watcher's stamped, two-read door. **The only arm that allocates a
    sequence**; it inserts into `announced` and answers `Admitted { sequence }`;
  - `SerializedMarker` — `mark_under_the_session_lock`, used by **`conflict_after_the_lock` only**.
    Inserts into `announced` so consult Q5's native duplicate still coalesces, and **spends no
    sequence**;
  - `SerializedWithholding` — `withhold_under_the_session_lock`, used by **`after_a_save`'s
    disagreeing arm only**. Records *nothing*, so the engine's later stabilized reading of that state
    is not coalesced away.
- **`admit_under_the_session_lock` is gone** — verified absent from all of `src-tauri/`; every
  remaining mention is a past-tense record of what an earlier round built, left standing under
  §10.7's rule and enumerated in §13's name-position sweep.
- **`published`/`published_state` are renamed `announced`/`announced_state`**, and
  `Admission::Marked`/`Withheld` and `LedgerTally::marked`/`withheld` are new.
- **`ReadChronology` is subsumed into `AdmissionDoor`**, which now carries both the chronology proof
  and the step-5 decision.
- **No core change at all**, and `cargo tree -p espansoconfig-core | rg tauri` still finds nothing.

#### The deviation round 8 must judge first — the mirror of round 7's

The orchestrator's brief carried a hypothesis: that **both** save tails could simply mark, needing no
owed-origin override. **It held for the conflict tail and failed for the post-save tail**, and the
worker deviated deliberately, which is why there is a third door rather than two. Its argument, in
`2d-3-notes.md` §13: marking `after_a_save`'s disagreeing read **would have swallowed a genuinely
stable external change**, because nobody is shown that state — `SaveResult::Saved` carries no disk
side — so the engine's later stabilized reading of the same state would coalesce against the marker
and consult Q2's *"the differing post-save observation is queued as external"* would be met by
**nothing**. That is round 3's swallowed-change defect reached from a third side. Q5's coalescing is
scoped by the consult to a conflict *registered by `conflict_after_the_lock`*, so the marker belongs
to that tail alone.

**Round 8 must decide whether that asymmetry is right**, and in particular whether *withholding*
leaves `after_a_save`'s disagreeing arm worse than either marking or publishing when the owed request
is never answered.

#### What round 8 must attack

- **The asymmetry above**, first and hardest.
- **`decide`'s step ordering across three doors.** Steps 1–4 are shared and step 5 is not. Does every
  earlier step still mean the same thing for a door that will not announce? In particular the
  `announced` comparison at `ledger.rs:1398` answers `Duplicate` **before** the door is consulted —
  is `Duplicate` the right answer for a withholding door, which recorded nothing and therefore has
  nothing to be a duplicate *of*?
- **The rename `published` → `announced`.** A rename plus a behaviour split is exactly the shape that
  hid round 6's High 1, and this one changed what the map *means*: it no longer implies a sequence
  was spent. Sweep every doc comment, count and test name that still reasons about it as "published".
- **`record_app_write`'s invalidation** — §13 says it is unchanged in code and now also clears a
  marker, which the record argues is **required** (leaving one across a commit would be round 1's
  second High with a marker in it). Verify that, because it is an argument the round wrote about its
  own change.
- **The residues, judged as §5 items are now judged — with suspicion, because five of them have gone
  from "honestly bounded" to "real defect" and item 3 twice:**
  - with **no watcher**, a conflict's disk side now enters the sequence **not at all**, and
    `after_a_save`'s disagreeing read announces nothing. That read was the one external change a
    watcher-less session could still announce — though what it announced was unconfirmed. Is the
    trade stated truthfully, and is it the right one?
  - a **marker can still overwrite a newer publication**, costing one duplicate announcement. §13
    calls that over-reporting rather than silence. Check that it is.
  - §5 item 22 as rewritten, including the case this round deliberately creates.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5, §6's gate table and §7–§13 (**§13 is
  the section under review**, and it is ~900 lines). **Every one of the seven rounds so far found a
  false claim in this record.** Check the notes against the code, never the code against the notes.

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, every mention of a renamed item — as a pass **distinct** from
the prose sweep. This round renamed a map, deleted a method, added two `Admission` variants and two
tally fields, and moved `commands.rs`'s module count from five to six.

**Brief the review the way rounds 1–7 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### An operational trap — it recurs every round

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion runtime stamps
`updatedAt` once, ~10 s after launch, and never advances it, so the watchdog's stall predicate fires
on a job that is demonstrably working. **The working signal is the log file's mtime.** A drop-in
replacement that polls on it is at
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/4a29b83e-b1bc-44b7-81cc-cc61b6a5f2dd/scratchpad/wait-on-log.sh`
(scratchpad — recreate it from this description if the path is gone; it is ~60 lines, usage
`wait-on-log.sh <job-id> [max_wait_s] [stall_s] [interval_s]`, exit `0` terminal / `2` deadline /
`3` genuinely stalled / `4` bad args). The `codex:codex-rescue` subagent returns a "running in
background" wrapper **immediately** and does not deliver the result; resolve the companion with
`CC=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | head -1)` and
drive `node "$CC" status --all --json` / `node "$CC" result <job-id>` directly. Round 7 took ~9 min
of Codex wall clock at `--effort medium`.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–7 verbatim. THE work list for round 8.
# docs/decisions/2d-3-notes.md               — the record: §1, §4, §5's holes stated open, §6's gate
#   table, and §7–§13, one section per fix round (§13 is round 7's, the one under review)
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling,
#   Q3 is the highest-sequence rule round 7 corrected, Q5 is the coalescing rule scoped to
#   conflict_after_the_lock, Q7 item 3 is this step's spec, Q1 (with its round-4 correction block)
# src-tauri/src/ledger.rs                    — the three doors; decide()'s step 5 at ~1402–1428
# docs/decisions/2d-1-notes.md               — the engine's contract, plus §2.1's correction blocks
# docs/decisions/2d-2-notes.md               — §2.1 the lock and join argument; §2.3, which expressly
#   permits a healthy native backend to miss a hint
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1262 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust ladder across this step's review: 1249 at round 4's brief, 1251
  after the round-4 fix, 1256 after the round-5 fix, 1261 after the round-6 fix, **1262** after the
  round-7 fix (**+1**, the one new test). Focused serial
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` is **20/20**
  (69.27 s) and belongs to every future Rust gate run. Clippy `-D warnings` clean; `cargo fmt --check`
  clean; `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend has never been touched
  across the whole step** — re-verified against all four commits' file lists — so its three numbers
  are carried, not re-measured.
- **The scar still binds.** The workspace suite is evidence on a **quiet host only**: two *contended*
  runs on a byte-identical tree failed with 9 and 10 `watch_check` bounded-wait timeouts (389 s vs
  85.8 s) while the machine was saturated — and the serial gate passed 20/20 through the same
  weather. Re-run quietly before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers.
- **Consult Q3's highest-sequence rule is no longer load-bearing for the phantom** — round 7 removed
  the dependency by never publishing an unstabilized read. 2d-4 should still keep the rule, but a
  correctness argument no longer rests on it.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer.
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19) — which now decides whether a conflict's disk side is ever
  announced at all.

---

### ⚠️ HISTORICAL — the round-6→round-7 handoff, superseded by the round-8 status above. Round 7 is executed, it returned NOT READY with 1 High and 2 Low, and its fix is in the tree and green.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, but the step review stands at round 6, and round 6 found the two sharpest defects of the whole step. THE NEXT ACTION IS ROUND 7 OF THE 2d-3 REVIEW, against the round-6 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–6 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 7's brief is
written from round 6's fix, exactly as rounds 2–6 were written from theirs.

**Six rounds, six narrower instances, and the pattern has now been stated as a rule rather than
observed as a coincidence.** Round 6's two Highs were **both items of `2d-3-notes.md` §5 that the
record had already judged and dismissed** — item 20 ("bounded by an epoch reset") and item 3 ("not
new exposure"). That makes **five** §5 items written as honestly bounded and later found to be real
defects: **item 10** (round 2), **item 16** (round 4), **item 18** (round 5), and **items 20 and 3**
(round 6). §5 is not a residue to inherit; it is where the defects live. Round 7's default posture
toward every remaining open item of it is **suspicion**, and that is not optional.

**The round-6 fix round found and closed a seventh instance in its own change before any reviewer
saw it**: `settle` removed a path's debt *before* the settlement that answers it — a check-and-spend,
this project's named recurring shape. The debt is now put back when a settlement emits nothing, which
makes *a debt is spent only by a settlement that emitted* structural rather than an agreement between
three functions. **Do not treat that self-catch as credit.** Judge the new arm as harshly as one you
found yourself; that instruction is what produced round 6's High 1.

#### What the round-6 fix built — re-derive these, do not inherit them

- **`ObservationEngine::observe_owed(path, now)`** and the private `owed: BTreeSet<PathBuf>` it
  fills: a re-observation this application asks for is now a **debt the engine must answer**, not a
  hint it may coalesce into silence. It is answered even against a state the baseline **established
  but never announced**, and even when the engine tracks nothing for that path
  (`Removed { previous_revision: None }`). The private `Undone` value the one-pass `undo` map holds
  carries the debt beside the replaced tracked state, so `revert_settlement` restores **both**.
- **`WatchWorker::hint_paths` → `schedule_paths`**, with a private `HintOrigin`, because the two
  origins no longer ask the same question while the re-spelling and the clock stay one rule.
  `WatchWorker::baseline` now **retains application-origin requests across a failing enumeration**
  and hands them to the engine it finally opens, as debts.
- **Both save tails publish *and* ask.** `conflict_after_the_lock` and `after_a_save` call
  `side.watcher.re_observe(path)` **after** their `admit_under_the_session_lock`, on the arms where
  they publish. `after_a_save`'s *agreeing* refresh deliberately does not ask — it publishes nothing,
  clears nothing, and read exactly the revision the transaction established.
- **`ledger.rs` and `main.rs` gained no production code** — doc corrections and counts only.

#### The deviation round 7 must judge first

Round 6's High 2 proposed *"route any ledger mutation/publication through the engine's two-read
stabilization path."* **The fix round adopted the first half and rejected the second, deliberately**,
and argued it in `2d-3-notes.md` §12.2 from three places: consult **Q2** explicitly instructs
`conflict_after_the_lock` to publish/coalesce under the same sequence allocator; consult **Q5** makes
that published entry the very thing that coalesces a native duplicate, so removing it would raise a
**second** conflict on top of the one already on screen at 2d-5; and withholding the publication
would leave the window with neither the phantom nor the truth, which is **round 3's swallowed-change
defect reached from the other side**. The fix is therefore *publish **and** ask*: the phantom is
superseded at a **later** sequence, never prevented.

**Round 7 must decide whether that deviation is right**, because it rests on a rule this step cannot
enforce: consult **Q3**'s *for each document the frontend acts only on the highest sequence it has
accepted*, which **2d-4 and 2d-5 must keep**. If that rule is not kept, the phantom P is not
harmless — it is published. §5 item 3's replacement says so, and item 3 has already been wrong once.

#### What round 7 must attack

- **The deviation above**, first and hardest.
- **The debt machinery** — `observe_owed`, `owed`, `Undone`, and the re-insertion in `settle`. Is
  there any path where a debt is spent by a settlement that emitted nothing, or survives when it
  should not, or is owed to a path the engine will never settle? What happens across `begin_epoch`,
  a worker that stops between the ask and its next tick, and a `revert_settlement` that restores a
  debt already re-owed?
- **`schedule_paths` and `HintOrigin`** — the rename plus a behaviour split. Does a **native** hint
  behave exactly as it did before the split? The two origins now ask different questions through one
  function, which is precisely the shape that hid round 6's High 1.
- **The three new residues, judged as §5 items are now judged**: **item 21** (a request dropped by a
  worker that stops before its next tick, claimed bounded by `begin_epoch` — item 20 made exactly
  this kind of claim and was false), **item 22** (an owed observation of an unchanged state still
  costs a sequence), and **item 3's remainder** (the phantom still *enters* the sequence). Also
  **item 19** — that a watcher is running to hear the ask — which now decides whether a published
  single read is **ever** corrected.
- **The one thing not forced** (`2d-3-notes.md` §12.7): the new spawned-worker test does **not** force
  *which* of the two arms absorbed the request; both are the fix and both fail before it. Judge that
  as honestly bounded or as the next instance.
- **The record against the code** — `2d-3-notes.md` §1, §4, §5, §6's gate table and §7–§12, plus the
  correction blocks in `2d-1-notes.md` §2.1 (round 6's Low 1 changed "one" to "two" there). **Every
  one of the six rounds so far found a false claim in this record.** Check the notes against the
  code, never the code against the notes.

**Keep the two standing rules:** sweep for the **shape**, never for the words of the closed finding;
and sweep **name positions** — headlines, section headings, bold ruling lines, first sentences, doc
comments, module headers, test names, every mention of a renamed item — as a pass **distinct** from
the prose sweep. Round 6's two Lows were both that class, and this round renamed `hint_paths` to
`schedule_paths` and moved several counts (three→five→six in `main.rs`, "exactly three arms"→five in
`commands.rs`).

**Brief the review the way rounds 1–6 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### An operational trap this session hit — it will recur

**`codex-wait.sh` reports STALLED on a healthy Codex `task` job.** The companion runtime stamps
`updatedAt` once, ~10 s after launch, and never advances it, so the watchdog's stall predicate fires
at the threshold on a job that is demonstrably working. **Confirm against the job's `logFile` before
cancelling anything** — a genuine hang shows a repeating `Searching:` loop; a healthy job shows
advancing tool calls with log timestamps far past the frozen `updatedAt`. The working signal is the
**log file's mtime**. A drop-in replacement that polls on it is at
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/4a29b83e-b1bc-44b7-81cc-cc61b6a5f2dd/scratchpad/wait-on-log.sh`
(scratchpad — recreate it from this description if the path is gone; it is ~60 lines). Also note the
`codex:codex-rescue` subagent returns a "running in background" wrapper **immediately** and does not
deliver the result; drive `codex-companion.mjs` directly with `status` / `result`.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–6 verbatim. THE work list for round 7.
# docs/decisions/2d-3-notes.md               — the record: §1, §4, §5's holes stated open, §6's gate
#   table, and §7–§12, one section per fix round (§12 is round 6's, the one under review)
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling,
#   Q3 is the highest-sequence rule the deviation rests on, Q5 is the coalescing rule, Q7 item 3 is
#   this step's spec, Q1 (with its round-4 correction block) binds it
# docs/decisions/2d-1-notes.md               — the engine's contract, plus the correction blocks
#   this step added to §2.1 (round 6's Low 1 is there)
# docs/decisions/2d-2-notes.md               — §2.1, the lock and join argument; §2.3, which
#   expressly permits a healthy native backend to miss a hint
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1261 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust ladder across this step's review: 1249 at round 4's brief, 1251
  after the round-4 fix, 1256 after the round-5 fix, **1261** after the round-6 fix. Focused serial
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` is **20/20**
  (68.03 s) and belongs to every future Rust gate run. Clippy `-D warnings` and `cargo fmt --check`
  clean; `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend has never been touched
  across the whole step** — verified against both commits' file lists — so its three numbers are
  carried, not re-measured.
- **The scar still binds.** The workspace suite is evidence on a **quiet host only**: two *contended*
  runs on a byte-identical tree failed with 9 and 10 `watch_check` bounded-wait timeouts (389 s vs
  85.8 s) while the machine was saturated — and the serial gate passed 20/20 through the same
  weather. Re-run quietly before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers; those save-path publications are where consult Q5's *save-origin conflict
  wins over a native duplicate* must land.
- **Consult Q3's highest-sequence rule is now load-bearing for correctness, not only for tidiness** —
  the round-6 fix's publish-and-ask depends on it. 2d-4 must keep it.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer.
- A re-observation may not survive a worker stopping before its next tick (§5 item 21); an owed
  observation of an unchanged state still costs a sequence (§5 item 22); and nothing forces a watcher
  to exist to hear the ask (§5 item 19).

---

### ⚠️ HISTORICAL — the round-5→round-6 handoff, superseded by the round-7 status above. Round 6 is executed, it returned NOT READY with 2 High and 2 Low, and its fix is in the tree and green.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — every gate is green, but the step review stands at round 5, and the "expected five" is spent. THE NEXT ACTION IS ROUND 6 OF THE 2d-3 REVIEW, against the round-5 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1–5 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 6's brief is
written from round 5's fix, exactly as rounds 2–5 were written from theirs.

**The tail is the story of this step, and it has not converged.** Five rounds, and **every single one
found a narrower instance of the finding the round before had just closed** — rounds 3, 4 and 5 each
found one inside the previous fix round's own new code or its own new prose. The round-5 fix round
then found a **sixth** in its own change before any reviewer saw it. Do not brief round 6 as a
formality; brief it as the next instance hunt.

**A three-instance pattern the record now carries explicitly, and the reason round 6 must attack §5
directly.** `2d-3-notes.md` §5 is *Holes, stated rather than hoped about* — and three of its items
have now been written as honestly bounded and then found to be real defects: **item 10** (round 2),
**item 16** (round 4) and **item 18** (round 5). Each time the record was not merely incomplete but
**wrong on both of its claims about the cost**. Round 6 must judge every remaining open item of §5
the way rounds 2, 4 and 5 judged those three, and the default posture is suspicion, not deference.

**Where things stand after the round-5 fix.** The chronology operand of `decide` is the private
`ReadChronology`: `WriteLedger::admit` can build only `StampedBeforeTheRead(Instant)`,
`admit_under_the_session_lock` only `SerializedWithEveryRecord`, and `decide` matches it
exhaustively, so a third proof is a compile error rather than a skipped check. **The save path
consults no clock at all**, so no clock resolution can collide on it. A refresh that *fails* no
longer drops the external change: `ReObserver::re_observe(path)` puts one `WorkerMessage::ReObserve`
on the running watcher's existing inbox, the worker absorbs it through the **extracted**
`WatchWorker::hint_paths` so a re-observation and a native hint are one code path, and the engine's
ordinary two reads then settle and the stamped door admits. **Nothing publishes from a failed single
read and nothing clears the record from one.**

#### The three facts the round-5 fix rests on, all verified in code — re-derive them, do not inherit them

1. **The inbox is `std::sync::mpsc::channel()` — unbounded.** This is the whole lock-order argument
   for the new call: the save holds the session lock when it sends, and the worker may take the
   session lock in its sink callback, so a **bounded** channel or any blocking send would be exactly
   the deadlock this module's one-sentence argument rules out. Verified: no `sync_channel` anywhere
   in `src-tauri/src/watch.rs`, and the channel's internal lock is never held across a sink call.
2. **A workspace with no watcher degrades to `ReObserveOutcome::NoWatcher`** — never a panic, never
   an error, and never anything that reaches a save's result. A committed write is never afterwards
   reported as an error, and that binds this path too.
3. **The chronology premise itself** — that the production call graph serializes saves and refreshes —
   was re-derived by round 5 independently of the fix round that claimed it, and **holds**, including
   for `conflict_after_the_lock`. `ReadChronology` is private and no production caller can select a
   variant.

#### What round 6 must attack

Keep the two standing rules, and note that **round 5 caught the round-4 fix round failing the second
one twice**, so treat the previous sweep as known-unreliable and redo it from the current code:
**sweep for the shape, never for the words of the closed finding**, and **sweep name positions —
headlines, section headings, bold ruling lines, first sentences, doc comments, module headers, test
names, and every mention of a renamed item — as a pass distinct from the prose sweep.** Two renames
landed in the round-5 fix and both are name-position risk: `SaveRecords` → `SessionSideOfASave` (it
gained a non-record third field) and the new narrower `ObservationSide` its two tails take.

Specific surfaces:

- **`ReObserver` and the extracted `hint_paths`** — the fix's new machinery, and the first time the
  save path reaches the watcher at all. Can a re-observation and a native hint diverge now that they
  are one code path? What happens to a `ReObserve` for a path the engine does not watch, or one
  arriving after the worker has begun shutdown, or during an epoch change? Does the extraction
  change any existing hint's behaviour?
- **`after_an_uncertain_write`** — the *sixth* narrower instance, found by the round-5 fix round in
  `run_one_save`'s `may_have_written()` arm, which had evicted the cache and returned having read
  nothing. Judge the new arm as harshly as a reviewer would judge one it found itself.
- **The one thing deliberately not driven** (`2d-3-notes.md` §11.6): **no test pushes
  `WorkerMessage::ReObserve` through a *spawned* worker.** The three halves that are driven are the
  ask, the message's arrival, and the engine-plus-gate stabilization. The stated reason is that a
  spawned worker would put another real FSEvents session into `watch_check` and move its 20/20.
  Judge that as honestly bounded or as the seventh instance.
- **Every remaining open item of §5**, per the three-instance pattern above.
- **The record against the code** — `docs/decisions/2d-3-notes.md` (§1's headline and correction
  blocks, §5, §6's gate table, and §7–§11, one per fix round) and the correction blocks in
  `docs/decisions/2d-1-notes.md` §2.1. **Every one of the five rounds so far found a false claim in
  this record.** Check the notes against the code, not the code against the notes.

**Brief the review the way rounds 1–5 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–5 verbatim. THE work list for round 6.
# docs/decisions/2d-3-notes.md               — the record: the decisions, §5's holes stated open,
#   §6's gate table, and §7–§11, one section per fix round
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling
#   and carries the truthful sentence; Q7 item 3 is this step's spec; Q1 (with its round-4
#   correction block) and Q3 (nothing of the wire yet) bind it
# docs/decisions/2d-1-notes.md               — the engine's contract, plus the correction blocks
#   this step added to §2.1
# docs/decisions/2d-2-notes.md               — §2.1, the lock and join argument this composes with;
#   §2.3, which expressly permits a healthy native backend to miss a hint
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1256 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust ladder across this step's review: 1249 at round 4's brief,
  1251 after the round-4 fix, **1256** after the round-5 fix. Focused serial
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` is **20/20**
  (63 s) and belongs to every future Rust gate run. Clippy `-D warnings` and `cargo fmt --check`
  clean; `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend was never touched**
  across the whole step, so its three numbers are carried, not re-measured.
- **The scar still binds, and this step produced its sharpest measurement.** The workspace suite is
  evidence on a **quiet host only**: two *contended* runs on a byte-identical tree failed with 9 and
  10 `watch_check` bounded-wait timeouts (389 s vs 85.8 s) while `spindump`, a Virtualization VM and
  `corespotlightd` saturated the machine — and the serial gate passed 20/20 through the same
  weather. Re-run quietly before concluding anything from a timeout. Recorded in `2d-3-notes.md` §6.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers; those save-path publications are where consult Q5's *save-origin conflict
  wins over a native duplicate* must land.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited,
  not introduced here). The chronology stamp does not touch it: it orders *events*, and this is a
  question of *whose bytes*.
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer.
- No test pushes a `ReObserve` through a spawned worker (§11.6).

---

### ⚠️ HISTORICAL — the round-3→round-4 handoff, superseded by the round-5 status above. Rounds 4 and 5 are executed and their fixes are in the tree; both returned NOT READY, and the tail is still open.

### **STEP 2d-3 IS IMPLEMENTED AND *NOT* CLOSED — the write ledger and the admission gate are built and every gate is green, but the step review stands at round 3 of an expected five. THE NEXT ACTION IS ROUND 4 OF THE 2d-3 REVIEW, against the round-3 fix.**

**Read `docs/reviews/phase-2d-3-ledger.md` first — it is the work list.** Rounds 1, 2 and 3 are in it
verbatim, newest last, each with the host-measured evidence its brief carried. Round 4's brief is
written from round 3's fix, exactly as rounds 2 and 3 were written from theirs.

**Where things stand.** `src-tauri/src/ledger.rs` is `WriteLedger`: the consult Q2 record
`last_app_write[DocumentId] = { workspace_epoch, revision }`, the per-epoch observation-sequence
allocator, the published-state map that coalesces, and the **commit gate** — a second mutex, distinct
from the state mutex, held across `save_document` *and* the record by RAII. The intake sits at
`WorkspaceSession::observing`, which wraps the injected sink in `admitting_sink`; the seam a test
injects at is therefore `AdmittedSink`/`AdmittedObservation`, one layer out from 2d-2's, and
`unwatched()` builds *through* `observing` so there is one installation site. `run_one_save`
delegates to `commit_and_record`; `after_a_save` admits a refresh that disagrees with the
transaction; `conflict_after_the_lock` records nothing and admits its refresh through the same
decision. Admitted observations still end at `discarding_sink`, because the queue is 2d-4's. **No
command, no event, no queue, no wire, no frontend file** — Q3 holds.

**The lock order is `session → gate → state`, everywhere.** The worker takes `gate → state` with no
session lock; `save_document` never touches the ledger. Nothing holding a ledger lock ever waits for
the session lock, and that one sentence is the whole deadlock argument.

#### The three review rounds, and why the tail matters more than the head

Each round found **a narrower instance of the finding the round before had just closed** — the same
shape as 2d-1's and 2d-2's tails, now three-for-three in this step:

1. **Round 1** — two High, one Medium. Commit and record were not atomic with admission; a committed
   save did not invalidate the path's published state and coalescing returned before clearing the
   record; and the seam move had **weakened** 2d-2's reopen test, which the neuter run confirmed
   passed with a deliberately leaked worker.
2. **Round 2** — one High: the commit gate was acquired only *after* the engine had stabilized an
   observation, so a save could slip between the stabilization and the decision and have its own
   write admitted as foreign. It **overturned** the fix round's own §5 item 10, which had recorded
   that race as unavoidable and "over-reporting only". It is neither.
3. **Round 3** — two High. `PrecedesACommit` could **swallow a genuine external change permanently**,
   because `ObservationEngine::tick` installs the stabilized state into `tracked` *before* the ledger
   decides — demonstrated with *perfect* native delivery, which is what killed the "inherited
   delivery residue" framing. And the `Instant` implication was unsound at equality: `Instant` is
   monotonic but **not strictly increasing**, so `>=` did not prove the read followed the record.
   Round 3 also **cleared** the test the previous round had deleted (its coverage is carried by
   `no_admission_can_decide_between_a_commit_and_its_record` and
   `a_different_revision_is_admitted_and_supersedes_the_record`), plus construction sites, the wire
   boundary, lock order and the merged lookup.

**Round 3's fix made the first core change of this step.** `ObservationEngine` now keeps, for exactly
one pass, the tracked state each settlement replaced (`Settled { observation, replaced }`, a private
`undo` map cleared on `tick`'s first line), and `revert_settlement(path, now)` restores it and
re-hints. `ObservationSink` **answers** `ObservationOutcome`; `watch::deliver` — one function, one
call site — reverts on `Undecided`, which only `PrecedesACommit` produces. The core learns nothing
about saves or ledgers, stays Tauri-free, and `docs/decisions/2d-1-notes.md` carries a correction
block beneath the affected statement rather than a rewrite. Serializing the settling `tick` was
rejected on a **re-derived** basis, not the inherited cost one: the unit a lock can span is `tick`,
not one read, so it would hold a ledger lock across every due path's read *and* YAML projection, and
`WatchSource::read` is an injected trait — caller-supplied code — which destroys the leaf-mutex
argument outright.

**The fourth narrower instance was found by that fix round in its own new code**, and closed
structurally: `admitting_sink` had decided twice over one `Admission` (an `if let` for the downstream
call, a separate `outcome_of` for the engine's answer), which would let a future arm forward a value
to a consumer *and* have the engine un-conclude it underneath. One exhaustive match now produces
both, so the arm that forwards is the arm that answers `Decided`.

#### What round 4 must attack

Write the brief from the round-3 fix, and keep the two standing rules: **sweep for the shape, never
for the words of the closed finding**, and **sweep name positions — headlines, section headings, bold
ruling lines, first sentences, doc comments, module headers, test names — as a pass distinct from the
prose sweep.** Specific surfaces:

- **the provisional-settlement rollback**, which is new core machinery: is the `undo` map's one-pass
  lifetime correct on every path; can a revert race a concurrent hint; does `tick` clearing `undo` on
  its first line lose an undo a caller still needed; is the re-hint guaranteed to produce a fresh
  observation *this* time, or is that the round-3 claim again in new words?
- **`ObservationSink` answering `ObservationOutcome`** — a dropped answer is invisible to every test
  (§5 item 14), and that is the shape of a check-and-spend whose result is discarded;
- **the strict `read_after > recorded_at`** proof, rewritten in the module's *stamp* section and §9.2;
- **the four holes stated open** (§5 items 13, 14, 16, 17) — judge each as honestly bounded or quietly
  optimistic, the way round 2 judged item 10 and found it wrong on both counts;
- **the record against the code**, `docs/decisions/2d-3-notes.md` and the correction blocks in
  `docs/decisions/2d-1-notes.md`. Rounds 1, 2 and 3 each found a false claim in this record.

**Brief the review the way rounds 1–3 were briefed, and this is not optional:** the Codex sandbox
**blocks FSEvents delivery**, so a delivery-dependent test times out there while the supported host
passes it repeatedly. Tell the reviewer to work **statically**, never to run `cargo test` or anything
matching `watch_check::`, and supply the host-measured numbers in the brief. 2d-2's round-1 High was
sandbox-confounded evidence, and that precedent binds every FSEvents-adjacent review.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-3-ledger.md          — rounds 1–3 verbatim. THE work list for round 4.
# docs/decisions/2d-3-notes.md               — the record: the decisions, the fix-round sections,
#   the early-return audit, the per-test audit, and §5's holes stated open
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q2 is the suppression ruling
#   and carries the truthful sentence; Q7 item 3 is this step's spec; Q1 (with its round-4
#   correction block) and Q3 (nothing of the wire yet) bind it
# docs/decisions/2d-1-notes.md               — the engine's contract, plus the two correction
#   blocks this step added to §2.1
# docs/decisions/2d-2-notes.md               — §2.1, the lock and join argument this composes with
```

#### The gate baseline — all measured on this tree by the orchestrator, not by the author

- **`1249 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The Rust delta over 2d-2's 1223 is **+26**. Focused serial
  `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` is **20/20**
  and belongs to every future Rust gate run. Clippy `-D warnings` and `cargo fmt --check` clean;
  `cargo tree -p espansoconfig-core | rg tauri` empty. **The frontend was never touched** across the
  whole step, so its three numbers are carried, not re-measured.
- **The scar still binds:** the workspace suite is evidence on a **quiet host only**. A contended run
  once failed ten `watch_check` bounded-wait timeouts (exit 101) on a tree that passed quiet. Re-run
  quietly before concluding anything from a timeout.

#### Open items 2d-3 still carries into 2d-4 (stated, not discharged)

- The production `ObservationSink` discards, so a sequence and a publication are spent on a value no
  present code recovers; those two save-path publications are where consult Q5's *save-origin
  conflict wins over a native duplicate* must land.
- `SavedDocument::revision` is a **post-rename read-back**, so a foreign process writing between the
  rename and that read makes this session record *their* revision as its own (§5 item 15, inherited,
  not introduced here).
- A stamp taken too **late** has no test that can fail, and neither has a dropped sink answer.
- A save-path refresh can be refused by a clock collision; it has no settlement to take back, so it
  costs one publication and never a write.

---

### ⚠️ HISTORICAL — the 2d-2→2d-3 handoff, superseded by the 2d-3 status above.

### **STEP 2d-2 IS COMPLETE — native lifecycle and the real-filesystem adapter, closed READY at round 5 of its review. THE NEXT ACTION IS STEP 2d-3 — save composition and the suppression ledger (`run_one_save`, `conflict_after_the_lock`).**

**Where things stand.** The 2d-1 engine now runs behind the open `WorkspaceSession`:
`src-tauri/src/watch.rs` is `WatcherLifecycle` — one worker thread per open workspace driving
the `ObservationEngine` with real clock and filesystem, owning the `NativeWatch`, with epochs
minted by a checked allocator in `WorkspaceSession::open` (typed `EpochSpaceExhausted`, never
reuse), teardown that can never join the worker on itself (same-thread detection routed to a
never-blocking reaper: each sweep joins every handle it observes finished, blocking on no
unfinished handle), the polling fallback engaged only on native failure (Q1), `HintSpelling`
reconciling FSEvents' resolved paths onto discovery's spelling, and epoch-tagged observations
to an injected `ObservationSink` whose production instance discards until 2d-4's queue.
`src-tauri/src/watch_check.rs` is the real-filesystem evidence: 18 serial integration tests —
the eight create/rename/edit/remove × config//match/ matrix cells asserting exact source
bytes, reopen/failed-reopen/last-owner teardown, sink re-entry without deadlock, a parked
worker not blocking a later reap, epoch boundaries, polling fallback, shutdown.

**The review took five rounds** (`docs/reviews/phase-2d-2-lifecycle.md`), and the shape of
the tail matters for 2d-3: round 1's High (a claimed no-gap handoff and a mandatory gate
"failing") was **sandbox-confounded evidence** — the Codex sandbox blocks FSEvents delivery,
so exactly the delivery-dependent tests timed out there while the supported host passed them
repeatedly; every later round therefore reviewed statically with host-measured evidence
supplied in the brief, and that split must be repeated for any future FSEvents-adjacent
review. Rounds 2–4 each found the narrower survivor of a just-closed finding (self-join via
the sink after the mutex fix; serial-reaper starvation after the self-join fix; a chronological
"exit-order" claim after the starvation fix — closed as wording, since nothing needs the
order). One measured scar is recorded and binds gate-taking: **the workspace suite is
evidence on a quiet host only** — one contended run failed ten `watch_check` bounded-wait
timeouts (exit 101) on a tree that passed 1223/0 and 18/18 twice quiet
(`2d-2-notes.md` §4 and §6 round 4). **The closure commit is `c68f537`** — the lifecycle, the
integration suite, the core's one `signal_of` change, the record, the five-round review and
this checkpoint, staged by path; the working tree after it is clean.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q7 item 3 is 2d-3's
#   specification; Q1 (with its round-4 correction block) and Q3 (the wire is 2d-4's) bind it.
# docs/decisions/2d-2-notes.md               — what the lifecycle gives 2d-3: the surface (§2),
#   the holes stated open (§5 — the reaper policy is item 12), the five-round closure (§6)
# docs/reviews/phase-2d-2-lifecycle.md       — the five rounds; round 1's sandbox confound is
#   the precedent for briefing any future watcher review
# docs/decisions/2d-1-notes.md               — the engine's own contract (§2, §5)
```

#### What 2d-3 is (consult Q7 item 3)

**Save composition and the suppression ledger.** The save path (`run_one_save` in
`src-tauri/src/commands.rs`, and `conflict_after_the_lock`) composes with observation: a save
this application commits must not come back through the watcher as a foreign external change.
2d-3 owns that suppression ledger. The consult's Q7 item 3 paragraph is the specification;
do not pre-empt it from this summary. Still not 2d-3's: the queue, the wake event,
`drain_external_changes` and any window wiring (2d-4, per Q3), and the browser coordinator
(2d-5).

#### The step ladder (consult Q7)

1. **2d-1** core observation engine ✅ (five rounds, READY)
2. **2d-2** native lifecycle + real-filesystem adapter ✅ (five rounds, READY)
3. **2d-3** save composition + suppression ledger ← **next**
4. **2d-4** queue, wake event, `drain_external_changes`, wire
5. **2d-5** browser coordinator + pure surface transitions
6. **2d-6** components, i18n, mounted evidence
7. **2d-7** reviewed rebuilt instrument + bilingual WKWebView reading, with a command counter
8. **2d-8** instrument removal + harness-free closure

#### The gate baseline — re-derived at 2d-2's closure, all four measured on this tree

- **`1223 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules); bundle oracle server-only tokens ABSENT, client-only PRESENT (2) —
  read both lines. The Rust delta over 2d-1's 1198 is 2d-2's 25 (accounted round by round in
  `2d-2-notes.md` §4); the focused serial `watch_check::` suite is 18/18 and belongs to every
  future Rust gate run — quiet host required, per the scar above. Clippy `-D warnings` and
  `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty.

#### Open items 2d-3 inherits (stated, not discharged)

- The production `ObservationSink` discards; several lifecycle items carry
  `#[cfg_attr(not(test), allow(dead_code))]` with named pending consumers (2d-4's queue).
- The `Degraded` runtime-error arm is reviewed, not test-driven (`2d-2-notes.md` §5.7).
- A permanently unfinished worker's handle stays held for the process life (§5 item 12).
- The two watched roots are watched whole; per-save suppression granularity is 2d-3's to design.

---

### ⚠️ HISTORICAL — the 2d-1→2d-2 handoff, superseded by 2d-2's closure above.

### **STEP 2d-1 IS COMPLETE — the core observation engine, closed READY at round 5 of its review. THE NEXT ACTION IS STEP 2d-2 — native lifecycle and the real-filesystem adapter, the one step whose principal integration test belongs in `src-tauri`.**

**Where things stand.** The engine exists in `crates/espansoconfig-core/src/watch/` (engine,
correspond, native) with no caller, per consult Q7 item 1. Its review took **five rounds**
(`docs/reviews/phase-2d-1-engine.md`), and the shape of the tail matters for every later step:
rounds 2–4 each found a **narrower instance of a just-closed finding** — a symlinked *ancestor*
after the final-component fix, then the bare claim surviving as a module **headline**, then as a
markdown **heading** and as the consult's own **ruling line**. Sweep name positions (headlines,
headings, bold rulings, first sentences) as their own pass, distinct from the prose sweep; and a
captured verdict gets a **correction block beneath it, never a rewrite**
(`docs/reviews/phase-2d-design.md` Q1 now carries the first one). The record is
`docs/decisions/2d-1-notes.md`; §§6–9 hold the four closure rounds with their correction blocks.
**The closure commit is `53bdcce`** — the engine, the record, the five-round review, the
consult's Q1 correction block and this checkpoint, staged by path; the working tree after it is
clean.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d. Q7 item 2 is 2d-2's
#   specification; Q1 (lifecycle owner, polling fallback) and Q3 (the wire is 2d-4's, NOT yet)
#   bound it. Q1's ruling carries a round-4 correction block — read it with the ruling.
# docs/decisions/2d-1-notes.md               — what the engine gives 2d-2 to hold: the public
#   surface (§2), the holes stated open (§5), and the five-round closure history (§§6–9)
# docs/reviews/phase-2d-1-engine.md          — the five rounds; round 5's sweep notes bind the
#   sweeps every later fix round owes
```

#### What 2d-2 is (consult Q7 item 2)

**Native lifecycle and the real-filesystem adapter.** Put one core watcher handle behind the
open `WorkspaceSession`, with workspace epochs, cancellation/join on successful replacement,
drop on shutdown, and the native-error polling fallback (Q1: polling is a fallback for an
unavailable native backend, never the primary mechanism). **A temp-directory integration test
using real creates, atomic renames, edits and removals under both roots** — the one step whose
principal integration test belongs in `src-tauri`, because a `notify` callback plus workspace
replacement is not a pure core question. It must **not** emit to a window or change conflict UI
(the wire — the event, the queue, `drain_external_changes` — is 2d-4's), and 2d-3 owns the
suppression ledger. Evidence class per Q7: core/model tests plus the `src-tauri` integration
test; no mounted or window evidence.

#### The step ladder (consult Q7)

1. **2d-1** core observation engine ✅ (five rounds, READY)
2. **2d-2** native lifecycle + real-filesystem adapter ← **next**
3. **2d-3** save composition + suppression ledger
4. **2d-4** queue, wake event, `drain_external_changes`, wire
5. **2d-5** browser coordinator + pure surface transitions
6. **2d-6** components, i18n, mounted evidence
7. **2d-7** reviewed rebuilt instrument + bilingual WKWebView reading, with a command counter
8. **2d-8** instrument removal + harness-free closure

#### The gate baseline — re-derived at 2d-1's closure, all four measured on this tree

- **`1198 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules); bundle oracle server-only tokens ABSENT, client-only PRESENT (2) —
  read both lines. The Rust delta over 2c-5-7's 1153 is 2d-1's 45 (41 + 3 pinning + 1 pinning);
  the three frontend figures were **re-measured, not carried** — the scar stays `1623`. Clippy
  `-D warnings` and `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri`
  empty (notify 8.2.0 is in the core legitimately; tauri is not).

---

### ⚠️ HISTORICAL — the consult→2d-1 handoff, superseded by 2d-1's closure above.

### **THE PHASE 2d DESIGN CONSULT IS COMPLETE — `docs/reviews/phase-2d-design.md`, eight questions ruled, eight steps cut. THE NEXT ACTION IS STEP 2d-1 — the core observation engine, with no caller.**

**Where things stand.** The consult ran to completion in a writable sandbox and wrote its own
verdict file; two of its load-bearing citations were independently re-read and hold
(`src/lib/components/DetailPane.svelte:453-469` — the open-surface list nothing can prove
complete, Q8's subject — and `src-tauri/src/main.rs:73-127` — fifteen workspace commands plus
one menu command, which is why Q4 orders the "fifteen commands" prose updated when the drain
command lands). **The consult commit is `fdb4f07`** — the verdict file and this checkpoint,
staged by path; the working tree after it is clean. **Four of its rulings overrule the handoff
brief** — see the phase-table row above for the four — and they bind every step below.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY after this checkpoint's commit
# docs/reviews/phase-2d-design.md            — THE AUTHORITY for 2d: VERDICT, Q1–Q8; Q7 is the
#   eight-step split, and step 1's paragraph is 2d-1's specification
# IMPLEMENTATION_PLAN.md §6.5                — the plan section the consult refines (and, in the
#   "no dirty draft" sentence, overrules)
# docs/reviews/phase-2c-5-7-removal.md       — round 1's six inherited items; the consult binds
#   them into steps 7 (command counter, pathname rebindings) and 8 (carry-forward, never credit)
```

#### What 2d-1 is (consult Q7 item 1, and Q1/Q2 for its internals)

**The core observation engine, no caller.** In `crates/espansoconfig-core`: add the `notify`
dependency (the crate, not yet a running watcher — 2d-2 owns lifecycle), the two watched roots,
per-path debounce (150–300 ms per plan §6.5), consecutive-read stability, exact hashing
(`ContentRevision`), projection/validation, typed changed/added/removed/unreadable observations,
rescan, and snapshot-bound correspondence tables. Core tests use **injected hints, clock and
reader** over synthetic temp trees; the coverage list is Q7 item 1's sentence (bursts, atomic
renames, partial writes, read-error recovery, non-UTF-8, deletion/recreation, parse failure,
semantic findings, recursive nested match files, disabled files, packages). **This step must not
touch Tauri, commands, Svelte, i18n or saves** — the architecture rule (`cargo tree -p
espansoconfig-core | rg tauri` must stay empty) is part of its acceptance. The fifteen corpus
fixtures may be enumerated and fed through read/hash tests **without editing or logging their
text**; the real corpus stays out of any writer harness (Q7's closing paragraphs).

#### The step ladder the consult cut (Q7)

1. **2d-1** core observation engine, no caller ← **next**
2. **2d-2** native lifecycle + real-filesystem adapter (the one `src-tauri` integration test)
3. **2d-3** save composition + suppression ledger (`run_one_save`, `conflict_after_the_lock`)
4. **2d-4** queue, `workspace://reconciliation-ready` wake event, `drain_external_changes`, wire
5. **2d-5** browser coordinator + pure surface transitions (registry, guarded auto-reload,
   watcher-origin conflict discriminant)
6. **2d-6** components, i18n, mounted evidence (all seven write surfaces)
7. **2d-7** reviewed rebuilt instrument + bilingual WKWebView reading, **with a command counter**
8. **2d-8** instrument removal + harness-free closure

#### The gate baseline — ONE figure

- **`1153 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules), re-derived at 2c-5-7 on the harness-free tree. The scar stays `1623`:
  a count only a given tree can produce must be re-derived on that tree, never copied forward.
  The bundle oracle is the discriminating check (server-only tokens ABSENT, client-only PRESENT —
  read both lines); a new `.ts` module costs one, a styled component two.

---

### ⚠️ HISTORICAL — the 2c-5→2d handoff, superseded by the consult's completion above.

### **PHASE 2c-5 IS COMPLETE — all seven steps — AND WITH IT PHASE 2c: 2c-5 is the last of the split's ten sub-phases. THE NEXT ACTION IS THE PHASE 2d DESIGN CONSULT, by the standing rule that every phase since 2b-2c is put to a consult before any line of it is written.**

**Where things stand.** Step 7 removed the instrument and re-derived the production baseline —
**`1153 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules), clippy and fmt clean, bundle oracle server-absent/client-present — and
its review closed READY at round 3 after forcing on-file closure for steps 1–3 (see "Verification
— Phase 2c-5 step 7" above). **There is no with-harness figure any more; this is the only
baseline.** The working tree at this checkpoint is clean. **The closure commit is `b71044b`** —
the record, the three-round review, the three closure-round appends, and the five comment/doc
fixes across `backup.rs`, `persist_backup.rs` and `restore.ts`, staged by path.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all     # expect EMPTY — no harness paths exist any more
# IMPLEMENTATION_PLAN.md §6.5                — external change reconciliation, 2d's subject
# docs/decisions/2c-split-notes.md           — §2 confirms 2c-5 closed the ten-sub-phase split
# docs/reviews/phase-2c-5-7-removal.md       — round 1's list of six items 2d-era work inherits
#   explicitly; rounds 2–3 for the closing shape-sweeps
# docs/reviews/phase-2c-5-design.md          — the consult FORM to follow: like every consult
#   since 2c-4a it changed the phase rather than confirming it
```

#### What the 2d consult must settle

Phase 2d is **external change reconciliation** (plan §6.5): the file changed on disk while this
application holds a projection of it. The consult is commissioned exactly as 2c-5's was
(`Agent(subagent_type="codex:codex-rescue", ...)`, self-contained brief, either-sandbox rule,
verdict captured to `docs/reviews/phase-2d-design.md` if the sandbox cannot write). Brief it with
plan §6.5, the conflict machinery that already exists (2c-4a's capture, `adoptDiskVersion`,
`conflictChoicesFor`, the reapply of 2c-4b), and the six inherited items named above — the
no-command-counter limitation and the unreachable adoption answers bear directly on what
reconciliation can claim to observe. Do not pre-empt its rulings; every consult since 2c-4a has
overruled part of the handoff brief.

#### The gate baseline — ONE figure now

- **`1153 / 431 / 2125 / 184`**, re-derived at 2c-5-7 on the harness-free tree and re-run
  independently after each of its fix rounds. The scar stays `1623`: a count only a given tree can
  produce must be re-derived on that tree, never copied forward. The bundle oracle is the
  discriminating check (server-only tokens ABSENT, client-only PRESENT — read both lines), and the
  module ladder's rule stands: a new `.ts` module costs one, a styled component two.

---

### ⚠️ HISTORICAL — the 6b→7 handoff, superseded by the phase closure above. Step 7 is executed and closed READY at round 3 of its review.

### **Step 2c-5-6b is COMPLETE — the twelve re-takes taken as P87–P98 on a presented window, the round-2 review READY with no findings, the manifest written and 92/92 OK. THE NEXT ACTION IS STEP 2c-5-7 — the instrument's removal and the harness-free re-derivation, the phase's LAST step.**

**What closed 6b, in one paragraph.** The console lock that blocked the re-takes was gone
(`CGSSessionScreenIsLocked` absent); a display-asserting `caffeinate -d -u` held through twelve
serial launches P87–P98 (the six cases `restore-preview-bytes`, `restore-withdraw`,
`restore-findings`, `restore-nothing`, `restore-reload`, `restore-notutf8`, each `:en` then `:es`),
all on the fix-round binary `371fc7c1…` under §11.7's license. Every transcript printed
`visibility=visible` (verified per transcript by the orchestrator); the four committed launches
passed the by-hand displaced-bytes readings. Record §13 discharges §12's obligation; one
orchestrator fix before the review closed a §13.14 status sentence that omitted the record's own
uncommitted append. Round 2 is READY — written by the reviewer itself into
`docs/reviews/phase-2c-5-6b-reading.md` under "Round 2". See "Verification — Phase 2c-5 step 6b"
above. **The closure commit is `b9271c1`** (the record's §13 and §13.14 fix plus the review file's
Round 2, by path); the manifest stays in the harness tree, deliberately uncommitted like its four
predecessors, and the working tree after the commit lists exactly the four harness paths.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all   # expect exactly FOUR lines — the harness paths, nothing else
ls /private/tmp/espansoconfig-harness-2c-5/   # the tree is VOLATILE — but for step 7 its LOSS only shortens the deletion list
sed -n '/^## Q7/,/^## Q8/p' docs/reviews/phase-2c-5-design.md   # item 7 is the removal step's specification
# docs/decisions/2c-5-6-window-reading.md — §13.14 (the closure's accounting; the 2c-5-7 deletion
#   list is NOT lengthened by the re-takes), §11.9 (the fix round's accounting)
# docs/decisions/2c-5-6a-instrument-extension.md — §8 (the decoys and planted artifacts, with paths)
# docs/decisions/2c-5-5a-instrument-rebuild.md — §8.1 (the four residual rebindings, inherited open)
```

#### What 2c-5-7 is, and what it owes

The phase's last step: remove the instrument entirely and re-derive every gate on the harness-free
tree. Its parts, each with its authority:

1. **Revert the two tracked harness files by path** — `src/main.ts` and `src-tauri/src/main.rs`
   each carry two hook lines (`git restore` them; never a blanket checkout) — and **delete the two
   untracked probe sources** `src/probe.ts` and `src-tauri/src/probe.rs`.
2. **Delete the harness artifacts**: the tree `/private/tmp/espansoconfig-harness-2c-5/`, the four
   decoys `…-probe-decoy-C11..C14.yml` outside it, and the planted symlink artifacts — the exact
   paths are 6a §8's and record §11.9's, and §13.14 confirms the re-takes lengthened nothing.
3. **Re-derive the gates on the harness-free tree — measure, never copy**: expected
   `1153 / 431 / <measured> / 184` (`cargo test --workspace` / `npm run check` files / `npm test` /
   `npm run build` modules). The npm-test expectation is ~2125 (harness-free 2123 before the 6b fix
   round, whose two mounted `RestorePane.test.ts` cases are product and stay), but **the figure
   must come from the harness-free run itself — the scar is `1623`**, a count once copied forward
   for three step records. Clippy `-D warnings`, `cargo fmt --check`, and the bundle oracle both
   lines (server-only tokens ABSENT, client-only PRESENT).
4. **The record and the phase closure** per design Q7 item 7 — whatever review evidence Q7 assigns
   the step, then the 2c-5 phase row, this checkpoint, commit by path, push.

The four residual rebindings (5a §8.1) stay inherited-open through 6b unwidened; they are not step
7's to close. After step 7 the with-harness baseline ceases to exist — the harness-free figures
become the only baseline.

#### The gate baseline — TWO figures, and do not confuse them

- **With the harness in the tree: `1153 / 432 / 2126 / 185`** — unchanged at 6b's closure, which
  touched only markdown and the manifest; last derived twice at the 6b fix round. Clippy and fmt
  clean; bundle oracle **absent / present → 2** (read both lines).
- **Harness-free production: `1153 / 431 / <re-derive> / 184`** — what **2c-5-7 must re-derive on
  a harness-free tree**, never copy forward.

---

### ⚠️ HISTORICAL — the blocked re-take handoff, superseded by 6b's closure above. Its twelve re-takes are taken as P87–P98, its round-2 review is READY, and its manifest is written and verified.

### **Step 2c-5-6b is PARTIAL — all 24 launches taken and every state read bilingually, but the round-1 review is NOT READY and its disposition owes TWELVE RE-TAKES that are BLOCKED ON A LOCKED CONSOLE. THE NEXT ACTION IS THE RE-TAKES — P87 upward, on an unlocked screen — then the round-2 review and the manifest.**

**What happened, in one paragraph.** The reading ran P63–P86 (eleven cases × two languages, plus
P85/P86 re-taking `restore-notutf8` after a fix round closed the reading's own Medium — the
unreachable `code.backupReadError.notUtf8` sentence, now drawn through `tBackupReadError` in both
`RestorePane.svelte` failed panels, +2 mounted cases). The phase review verified everything else
but found the record's occlusion derivation unsound: **all ten part-2 launches and both re-takes
printed `visibility=hidden` at plan start and nothing proves they were ever presented.** Record
§12 withdrew the derivation, re-classified those twelve as document-and-filesystem readings (byte
lines stand; screen claims do not), and owes twelve re-takes. At the post-review check the console
was locked (`CGSSessionScreenIsLocked = 1`), so they could not be taken. See "Verification — Phase
2c-5 step 6b" above.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all   # expect exactly FOUR lines — the harness paths, nothing else
ls /private/tmp/espansoconfig-harness-2c-5/   # the tree is VOLATILE and has been lost twice — check FIRST
# docs/decisions/2c-5-6-window-reading.md — §12 (the re-take obligation and its terms), §2 (the
#   reading's rules), §11 (the fix round; the full digest of binary 371fc7c1…), §6 (the ten
#   sections the re-takes echo), §8 (the coverage table the re-takes re-earn)
# docs/reviews/phase-2c-5-6b-reading.md — the round-1 verdict, verbatim
# docs/decisions/2c-5-6a-instrument-extension.md — §2 the cases, §3.3 the reporter's limits
# docs/decisions/2c-5-5a-instrument-rebuild.md — §3 the launch recipe
```

#### The re-takes — exactly what is owed

**Twelve launches, P87 upward** (numbering never reuses): `restore-preview-bytes`,
`restore-withdraw`, `restore-findings`, `restore-nothing`, `restore-reload`, `restore-notutf8`,
each `:en` then `:es`, all on the binary the fix round built (`371fc7c1…` — full digest in record
§11; verify `shasum -a 256 target/debug/espansoconfig` FIRST and stop if it differs — a rebuild is
a new step, not a shrug). The five part-2 cases never enter the branches the fix changed, so the
one binary serves all twelve. **Acceptance per launch: its own transcript prints
`visibility=visible`** — plus the standing per-case shapes (record §6/§11.6) and the by-hand
displaced-bytes readings on the four committed launches (findings → `base-r0.yml`, reload →
`elsewhere-r1.yml`). Before the first launch: confirm the console is unlocked
(`CGSSessionScreenIsLocked` absent or 0) and hold the display awake for the run (a background
`caffeinate -d -u -t <seconds>` is enough); if any launch still reports hidden, stop and fix the
environment rather than accumulating more unusable numbers. One plan per launch, fresh bundle
path, serial, language through the picker.

#### After the re-takes

1. Append §13 to `docs/decisions/2c-5-6-window-reading.md`: the twelve launches in the record's
   per-launch style, the re-earned §8 rows, and the closure of §12's obligation.
2. **Round-2 review**, scoped to the re-takes, the §12/§9 edits and §13 — commission as
   `Agent(subagent_type="codex:codex-rescue", ...)`, brief for either sandbox, capture the verdict
   if read-only, sweep for the SHAPE of the closed findings. The four residual rebindings (5a
   §8.1) stay inherited-open and are not new findings.
3. On READY: write `manifest-2c-5-6b-reading.sha256` (the final post-image: five scripts, thirteen
   fixtures, both probe sources, and every 6b launch's `probe.log` + `bytes.txt`), update this
   checkpoint, commit by path, push. **Then 2c-5-7** — the instrument's removal and the
   harness-free re-derivation — is the phase's last step.

#### The gate baseline — TWO figures, and do not confuse them

- **With the harness in the tree: `1153 / 432 / 2126 / 185`** (`cargo test --workspace` / `npm run
  check` files / `npm test` / `npm run build` modules) — moved 2124 → 2126 at the 6b fix round
  (two mounted cases; prediction matched measurement). Clippy and fmt clean; bundle oracle
  **absent / present → 2** (read both lines).
- **Harness-free production: `1153 / 431 / <re-derive> / 184`** — what **2c-5-7 must re-derive on
  a harness-free tree**, never copy forward; the npm-test figure moved with the fix round's two
  cases, so the pre-6b `2123` no longer holds and the scar is still `1623`.

#### The state of the tree

If `/private/tmp/espansoconfig-harness-2c-5/` is gone again, rebuild from 5b §2–§3 plus 6a §2 (both
recipes proven), re-run `byte-fixtures.sh`, and re-take one positive launch plus the five
confinement controls on the new binary before using it. It holds: five scripts, thirteen fixtures,
launches **P49–P86, N09, C11–C15** (+ `C14-plant`), four manifests (each failing set the kept
record of a later edit — see 6a §8 and record §11.9). Decoys `…-probe-decoy-C11..C14.yml` sit
outside the tree; 2c-5-7's deletion list is those four, the tree, and the planted symlink
artifacts. The four harness paths in the repository (`src/main.ts`, `src-tauri/src/main.rs`
modified two hook lines each; `src/probe.ts`, `src-tauri/src/probe.rs` untracked) are the
surviving authority and **must never be committed — never `git commit -a` or `git commit -am`;
stage by path.** The 6b commit additionally holds the fix round's two tracked product files
(`RestorePane.svelte`, `RestorePane.test.ts`) — the reading's Medium made this a source-carrying
step, as 2c-4c-5b-1/5b-2 was.

---

### ⚠️ HISTORICAL — the 6a → 6b handoff, superseded by 6b's partial completion above. Its launch plan is executed; what remains of 6b is the twelve re-takes, the round-2 review and the manifest.

### **Step 2c-5-6a is COMPLETE — seven new cases proven, four states argued unreachable, two review rounds ending READY. THE NEXT ACTION IS STEP 2c-5-6b — the bilingual window reading itself.**

**Step 2c-5-6 was split by the orchestrator into 6a and 6b**, exactly as 2c-5-5 was cut: 6a extended
the instrument to every restore state the reading must reach — done, see "Verification — Phase 2c-5
step 6a" above — and **6b is the reading**: the only window evidence the phase owes (design Q7 item
6), in both languages, on every reachable restore state.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all   # expect exactly FOUR lines — the harness paths, nothing else
ls /private/tmp/espansoconfig-harness-2c-5/   # the tree is VOLATILE and has been lost twice — check FIRST
sed -n '/^## Q7/,/^## Q8/p' docs/reviews/phase-2c-5-design.md   # item 6 is the reading's specification
docs/decisions/2c-5-6a-instrument-extension.md   # the instrument as it NOW exists: §1 every state's case,
#   §3.3 the reporter's limits (keyboard activation is unmeasurable — untrusted events), §5 what no case
#   reaches, §6 the four unreachability arguments (verified by review), §10-10.1 the review dispositions
docs/decisions/2c-5-5b-instrument-cases.md       # §3 the restore machinery, §4 the P50-P53 launches
docs/decisions/2c-5-5a-instrument-rebuild.md     # §3 = the launch recipe; §8.1 = the residual rebindings
```

#### The state of the tree

If `/private/tmp/espansoconfig-harness-2c-5/` is gone again, rebuild from 5b §2-§3 plus 6a §2 (both
recipes proven), re-run `byte-fixtures.sh`, and re-take one positive launch plus the five confinement
controls on the new binary before using it. The tree holds: five scripts (`launch.sh` with **23 case
rows** — twelve 5a, four 5b, seven 6a — `byte-fixtures.sh`, `inert.sh`, `confine.sh`,
`adversary.sh`), thirteen fixtures, launches **P49–P62, N09, C11–C15** (+ `C14-plant`), and four
manifests, of which two deliberately fail on known entries (`-rebuild` on `launch.sh` +
`src/probe.ts`; `-cases` (6a) on `src/probe.ts`; `-fix` on the 6a record — each failure the kept
record of a later edit, stated in the records). Decoys `…-probe-decoy-C11..C14.yml` sit outside the
tree; 2c-5-7's deletion list is those four, the tree, and the planted symlink artifacts. The four
harness paths in the repository (`src/main.ts`, `src-tauri/src/main.rs` modified two hook lines
each; `src/probe.ts`, `src-tauri/src/probe.rs` untracked) are the surviving authority and **must
never be committed — never `git commit -a` or `git commit -am`; stage by path.**

#### The gate baseline — TWO figures, and do not confuse them

- **With the harness in the tree: `1153 / 432 / 2124 / 185`** (`cargo test --workspace` / `npm run
  check` files / `npm test` / `npm run build` modules) — re-derived three times at 6a, last after
  its fix round. Clippy and fmt clean; bundle oracle **absent / present → 2** (read both lines).
- **Harness-free production: `1153 / 431 / 2123 / 184`** — what **2c-5-7 must re-derive on a
  harness-free tree**, never copy forward. The scar is `1623`.

#### What 2c-5-6b is, and what it owes

Q7 item 6's reading, over the restore surface: **both languages on every reachable restore state**
(6a §1's table maps each demanded state to its case or its unreachability argument; the eleven
restore cases each take `[:en|es]`), **its own geometry** (6a launches measured `1180x728 dpr=2` on
most and `1080x728` on P61-P62 — nothing carries forward between launches, §6.8's rule), the
keyboard/focus/scroll/viewport/hit-testing readings through 6a's reporter (its §3.3 names what the
reporter cannot measure), and the byte comparisons every launch's `bytes.txt` already carries. One
scoping decision is 6b's to take with the design in hand: 5a §4's sentence says 2c-5-6 "owes both
languages on every surface" in the context of the twelve write-surface proof cases, but Q7 item 6 —
the authoritative specification — demands restore states only, and the write surfaces had their own
bilingual window readings in their own phases; resolve that against the design before planning
launches rather than inheriting either reading silently. Launch numbering continues at **P63+**;
one plan per launch, fresh bundle path, language **through the picker**; an occluded WKWebView
stops running `setTimeout` about six seconds after launch. **Any component fix invalidates and
re-takes the affected readings** (and is product code: gates and a review round follow it). A
driver edit means rebuilding in 5a §3's order before the first dependent launch. Two 6a
observations 6b should carry into its plans: the refused non-UTF-8 read draws **two generic
sentences and never the offset** (`tBackupReadError` has no component caller — read what is drawn,
do not expect the offset); and P62 found the sticky actions row sliding **under the app header**
with the disabled prepare control's centre answering `somethingElse(header)` — whether that
covering matters on the read state is 6b's to judge. The record is
`docs/decisions/2c-5-6-window-reading.md`, in the bounded evidential style.

#### Commissioning 6b's review — the standing rule

**Write every review brief so either sandbox works** — the final message IS the deliverable; check
whether the review file exists and is substantive before writing to that path (all three 6a-era
verdicts were captured by the orchestrator). Commission as
`Agent(subagent_type="codex:codex-rescue", ...)`, and brief the reviewer to sweep for the **shape**
of a finding, never the words of the one just closed. The four residual rebindings (5a §8.1) are
inherited-open, unwidened by 5b and 6a both, and are not new findings.

---

### ⚠️ HISTORICAL — the 5b → 6 handoff, superseded by 6a's completion above. Its "sixteen cases" inventory predates the seven 6a cases, `byte-fixtures.sh`, the three byte-exact fixtures and the two 6a manifests.

### **Step 2c-5-5b is COMPLETE — both parts, four restore launches, one review round, READY with no findings. THE NEXT ACTION IS STEP 2c-5-6 — the bilingual window reading.**

**5b closed clean**: the record is `docs/decisions/2c-5-5b-instrument-cases.md` (§§1–8, §8 the
disposition), the review is `docs/reviews/phase-2c-5-5b-instrument.md` (READY, no findings — the
first READY any instrument step has produced), and the "Verification — Phase 2c-5 step 5b" section
above is the checkpoint's account. **The scratch tree was lost a second time and rebuilt at the same
path** — read that verification section before trusting any older description of the tree's contents.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all   # expect exactly FOUR lines — the harness paths, nothing else
ls /private/tmp/espansoconfig-harness-2c-5/   # the tree is VOLATILE — check it exists before planning anything
sed -n '/^## Q7/,/^## Q8/p' docs/reviews/phase-2c-5-design.md   # step 6's specification is Q7 item 6
docs/decisions/2c-5-5b-instrument-cases.md   # the instrument AS IT NOW EXISTS: §2 the rebuilt scripts and
#   their proof, §3 the restore machinery, §4 the four restore launches, §5 what 5b does NOT reach
docs/decisions/2c-5-5a-instrument-rebuild.md # §3 = the launch recipe; §8.3 = what 2c-5-6 owes; §8.1 = the
#   four residual rebindings, inherited open and unwidened
```

#### The state of the tree, and the one check to run before anything else

**`/private/tmp/espansoconfig-harness-2c-5/` has now been lost twice** — `/private/tmp` does not
survive a reboot, and both losses were discovered on session resume. **Check it exists first.** If it
is gone again, rebuild it from `docs/decisions/2c-5-5b-instrument-cases.md` §2 and §3 (the recipe is
proven — it has produced a working tree twice) and re-take one positive launch plus the five
confinement controls on the new binary before using it, exactly as 5b part 1 did. The four harness
paths in the repository (`src/main.ts` and `src-tauri/src/main.rs` modified by two hook lines each,
`src/probe.ts` and `src-tauri/src/probe.rs` untracked) are the surviving authority and **must never
be committed — never `git commit -a` or `git commit -am`; stage by path.**

The tree now holds: the four scripts (`launch.sh` with the seeded backup catalogue and the three
restore-only byte-oracle lines, `inert.sh`, `confine.sh`, `adversary.sh`), ten fixtures, launches
**P49–P53, N09, C11–C15** (+ `C14-plant`), and two manifests (`-rebuild` 29 entries of which exactly
two now fail — `launch.sh` and `src/probe.ts`, the part-2 edits, kept as the record of the change;
`-cases` 24 entries, all verify). Decoys `…-probe-decoy-C11..C14.yml` sit outside the tree; 2c-5-7's
deletion list is those four, the tree, and the planted symlink artifacts — the C01–C09 decoys of 5a
are already gone with the wipe.

#### The gate baseline — TWO figures, and do not confuse them

- **With the harness in the tree: `1153 / 432 / 2124 / 185`** (`cargo test --workspace` / `npm run
  check` files / `npm test` / `npm run build` modules), re-derived twice at 5b — by the worker after
  the last driver edit and independently by the orchestrator before the review. Clippy and fmt
  clean; bundle oracle **absent / present → 2** (read both lines — the bare `svelte/internal/server`
  search is vacuous).
- **Harness-free production: `1153 / 431 / 2123 / 184`** — what **2c-5-7 must re-derive on a
  harness-free tree**, never copy forward. The scar is `1623`.

#### What 2c-5-6 is, and what it owes

The bilingual window reading over the restore surface — design Q7 item 6, the sixth of the phase's
seven steps. Per 5a's §8.3 it owes **both languages on every surface** (5a §4's coverage is
aggregate, not per-surface) and **its own geometry**: this tree's launches measured
**`1180x728 dpr=2 visible`**, the lost 5a tree measured `720x728 dpr=1`, and under §6.8's
incomparability rule no earlier record's rectangles carry forward in either direction. The instrument
gives it sixteen cases — the twelve 5a plan-proof cases plus `restore-replace`, `restore-prepare`,
`restore-conflict` and `restore-none`, each taking `[:en|es]` — and the record's §5 lists the states
no case reaches, which bounds what a reading can claim. **One plan per launch, into a fresh bundle
path; the language must be set through the picker** (the WebKit data store follows the shared bundle
identifier); an occluded WKWebView stops running `setTimeout` about six seconds after launch.

#### Commissioning 2c-5-6's review — the rule 5a learned, 5b confirmed

**Write every review brief so either sandbox works** — the workspace may be read-only, the final
message IS the deliverable, a sandbox limit must not affect the verdict. 5b's reviewer ran read-only
and could not create its review file; the orchestrator captured the final message verbatim under a
capture note, as 5a's rounds 6 and 7 were. **Check whether the review file exists and is substantive
before writing to that path.** Commission as `Agent(subagent_type="codex:codex-rescue", ...)`, and
brief the reviewer to sweep for the **shape** of a finding, never the words of the one just closed.
The four residual rebindings (5a §8.1) are inherited-open, unwidened by 5b, and are not new findings.

---

### ⚠️ HISTORICAL — the step 2c-5-5a → 5b handoff, superseded by 5b's completion above. Its description of the tree predates the second loss and the rebuild: the launches and manifests it names (P37–P48, N07–N08, C05–C10, the three 5a manifests) no longer exist. The rebuilt tree is described in the "Verification — Phase 2c-5 step 5b" section and the 5b record.

### **Step 2c-5-5a is CLOSED — by the owner's decision of 2026-08-24, recorded in §16 of the record. THE NEXT ACTION IS STEP 2c-5-5b — build the restore-specific cases onto the inherited harness, per §8.2.**

**5a closed by path B — a deliberate exception to the standing rule, which only the owner could take.**
The round-7 fix round's six changes owed an eighth review round; the owner, asked directly, chose not to
keep paying for it. `docs/decisions/2c-5-5a-instrument-rebuild.md` **§16** is the closing entry: what
the exception accepts (16.1 — the open prose-bookkeeping defect class, no round ever READY, **nine**
unreviewed changes enumerated exactly), what it does not touch (16.2 — the four residual rebindings,
open and disclosed, accepted not proven), why it is bounded (16.3 — 2c-5-7 deletes the subject, each
round costs a Codex round-trip), and that the rule is **narrowed for that closure, not suspended**
(16.4 — every code change and every other record still owes its review round). The closure changed
**markdown only**; §16.5 holds the gates re-derived at closure. See "Verification — Phase 2c-5 step 5a
(closure by owner decision)" above.

**Step 2c-5-5 was split by the orchestrator into 5a and 5b**, exactly as 2c-4c-4 was cut: 5a was the
harness itself and its proof set — done; **5b is the restore-specific cases**, specified by the
record's §8.2 and outlined below.

#### Read these first, in this order

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all   # expect exactly FOUR lines — NOT empty
docs/decisions/2c-5-5a-instrument-rebuild.md   # §8.1 = what 5b inherits and must NOT rebuild;
#   §8.2 = what 5b must build (the specification); §16 = 5a's closing entry;
#   §15.6/§16.2 = the four residual rebindings 5b inherits, open and disclosed.
```

5a's review history, if needed: the seven review files are **rounds 1–7** and the dispositions are **§9–§15**, one per round, in order — `phase-2c-5-5a-instrument.md` (8 findings) → §9; `-round2.md` (4) → §10; `-round3.md` (5) → §11; `-round4.md` (6) → §12; `-round5.md` (3, all Low) → §13; `-round6.md` (3, all Low, **no instrument defects**) → §14; `-round7.md` (3, all Low, **no instrument defects**) → §15. **The initial review is round 1, and `-roundN.md` is round N** — the off-by-one mapping was itself a round-6 finding; do not re-introduce it. The instrument has been still since round 2, every round's fix created the next round's finding, and **no round ever returned READY** — 5a closed by the owner's exception, not by a READY.

#### The state of the tree, and why it is NOT clean

**The harness is deliberately uncommitted and is IN THE TREE right now.** `git status --short --untracked-files=all` shows, and must show, exactly these four and nothing else:

```
 M src-tauri/src/main.rs      # two hook lines
 M src/main.ts                # two hook lines
?? src-tauri/src/probe.rs     # the Rust probe side
?? src/probe.ts               # the driver
```

**Those four are the harness and they must never be committed.** Everything else — the record with its closing §16, the seven review files and this file — **is** committed, because it is the phase's evidence rather than the instrument; the Git state table's newest 5a row carries the closure commit's SHA. **Never `git commit -a` or `git commit -am`.** Stage by path. The scratch tree is `/private/tmp/espansoconfig-harness-2c-5/` — a stable path, not a session scratchpad, because 5b, 6 and 7 are different sessions.

#### The gate baseline — TWO figures, and do not confuse them

- **With the harness in the tree: `1153 / 432 / 2124 / 185`.** This is what the gates answer right now, re-derived after every fix round, again after the round-7 fixes, **and once more at closure (§16.5)**, and what a session working on 5b should expect before it adds anything. `cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` are clean; the bundle oracle reads **absent / present → 2**; the build emits `index-I5AFZyLL.js`, unchanged since round 4. **Rounds 6 and 7 and the closure changed markdown only**, so no gate could have moved and none did.
- **Harness-free production: `1153 / 431 / 2123 / 184`.** This is what **2c-5-7 must re-derive on a harness-free tree** — never copy the with-harness figure forward. The scar is `1623`, which stood in this file for three step records after 3d-1 committed ten cases while the harness was in the tree.

The delta is exactly **+1 module** (`src/probe.ts`), **+1 `svelte-check` file**, **+1 vitest case** (`scripts/lint/ipc-detail.test.ts`'s per-file `it.each`), and **+0 Rust tests**.

#### 5a's review history, closed — the detail lives in the record, not here

Seven rounds ran: findings **8 → 4 → 5 → 6 → 3 → 3 → 3**, ceiling **High → Medium → Low**, and
`Instrument defects: None.` in rounds 6 and 7 — the counts are **not monotone** and the record does not
claim they are. What moved is the **kind**: rounds 1–2 changed the instrument's code, rounds 3–5 changed
what the record and comments *claimed* about that code, and rounds 6–7 found only prose, **five of their
six findings being the record's bookkeeping about its own review history** — each round appends a
section, the append falsifies a count above it, the next round finds that. The per-round detail is
§9–§15 and the seven review files; the closure is §16. **No round ever returned READY**, and the two
scars a future session must not re-open are named in §16.1 (the defect class stays open — no claim that
a closing sweep caught its last instance) and §14.1 (**`-roundN.md` is round N**; the off-by-one mapping
was itself a finding once).

#### What is OPEN, and what 5b inherits

**Four residual rebindings, open and disclosed, not closed** — the module note in `src-tauri/src/probe.rs` and §8.1 both say so in these terms:

1. the **source's final component**, between `confined_source` and `std::fs::read`;
2. the **temporary's name** after `create_new`, because the `rename` that spends it resolves the name and not the handle;
3. an **ancestor of the target's** pathname — the launch tree;
4. an **ancestor of the source's** pathname, most directly `fixtures`, which is a **sibling** of `launches` and so was never covered by item 3.

They are one shape — a name checked at one instant and spent at another, this project's check-and-spend defect class. Closing any needs `openat`-style pinned directory handles that `std` does not offer; writing one with `libc` in throwaway instrument code was **considered and rejected** as new unproven cleverness on the one path where being wrong is worst. All four are **accepted, not proven** — operator-controlled launch root, never-shipped binary, deleted at 2c-5-7 — and **acceptance is not proof of impossibility**. Arm A of round 2's High is therefore **partially closed**, never closed.

What IS forced, and it belongs in the same sentence: the canonical target must be exactly `<launch>/xdg/espanso/match/conflict.yml` beneath the canonical launches root at the instant of the check (measured by C10), and no entry of any kind existed at the temporary's pathname when `open` ran (`O_EXCL`, measured by C07).

#### The decision that closed 5a — taken, and where it is recorded

The owner was offered both of §15.5's paths — **(A)** run the eighth round the standing rule prescribed,
**(B)** accept 5a with §15.4's reading as the closing state — and on 2026-08-24 chose **(B)**. §16 of
the record is the closing entry and the "Verification — Phase 2c-5 step 5a (closure by owner decision)"
section above is the checkpoint's account. **The exception covers exactly the nine changes §16.1
enumerates and nothing else**: every code change and every other record, 5b's included, still owes its
review round.

#### Commissioning 5b's reviews — the sandbox rule 5a learned

**Write every review brief so either sandbox works** — say the workspace may be read-only, that the
final message IS the deliverable, and that a sandbox limit must not affect the verdict. Rounds 6 and 7
both ran read-only and **could not write their own review files**; the orchestrator captured each final
message verbatim to `docs/reviews/phase-2c-5-5a-instrument-round{6,7}.md`, each with a capture note
under a rule. **Check whether the review file exists and is substantive before writing anything to that
path.** Commission as `Agent(subagent_type="codex:codex-rescue", ...)`, and brief the reviewer to sweep
for the **shape** of a finding, never the words of the one just closed.

#### What 5b builds

`docs/decisions/2c-5-5a-instrument-rebuild.md` §8.2 is the specification and it is specific. In outline: seeded **backup-root fixtures** (nothing in this tree writes a `.espansoconfig-backups` directory *before* a launch — the positives produce one *during*, which is a by-product and not a catalogue); the **`RestorePane` drive** — the pane is `section.restore` with four `section.step` blocks, its outcome panel is a **direct child**, and there is **no `.panel.reapply` on it at all**, so `reportReapply` must never be called for a restore or the plan times out; the catalogue / entry / candidate / prepare / replace states, each with the launch that reaches it; and the **byte oracle extended over the backup tree**, because a restore is a whole-file replacement that itself takes a backup and must not disturb the batch it restored from.

**5b must treat `probe_third_writer` as exercised exactly once** (P37) and `runThirdWriter()` as reachable — that is now true where round 1 found it tree-shaken. Bundle oracle, and read **both** lines because a bare `svelte/internal/server` search is a **vacuous** negative:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # server-only — must be ABSENT
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    # client-only — must be PRESENT → 2
```

#### Two standing traps, both in `CLAUDE.md`, both still binding

1. **One plan per launch, into a fresh bundle path.** An occluded WKWebView stops running `setTimeout` about **six seconds** after launch; `open -a` does not restart it and `-NSAppSleepDisabled` does not prevent it. LaunchServices **silently drops `--env`** for a bundle path it thinks is already running.
2. **The webview's `localStorage` is not keyed by `HOME`** — the WebKit data store follows the **bundle identifier**, which every probe bundle shares. **A plan must set the language explicitly through the picker.**

#### One measurement this tree makes that no earlier record can be compared against

**The viewport here is `720x728 dpr=1`, where every earlier record reports `1180x728 dpr=2`.** Panel rectangles, reach numbers and negative-`y` observations from this tree therefore say nothing about the ones 3c-2, 3d-2b or 2c-4c-5 recorded, **in either direction**. 2c-5-6 owes its own geometry and may not carry any earlier record's rectangles forward.

---

### ⚠️ HISTORICAL — the step 2c-5-5 handoff, superseded by the split into 5a/5b. Kept because its specification of step 5 is still what 5b is measured against.

### **Step 2c-5-4b is COMPLETE. The next thing to do is step 2c-5-5 — rebuild and review the temporary window instrument.**

**Phase 2c-5 is complete through step 4.** Steps 1, 2, 3, 4a and 4b are done — the core catalogue, the
read-only wire, restore as browser values, the coordinator wiring, and the screen with the phase's whole
mounted evidence. **Steps 5, 6 and 7 remain.** Read the "Verification — Phase 2c-5 step 4b" section above
for what 4b built and the "Phase 2c-5-4b review disposition" for the round-by-round roster: five findings
in round 1, three in round 2, two in round 3, one each in rounds 4 and 5.

#### The production gate baseline

**`1153 / 431 / 2123 / 184`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **This supersedes `1153 / 426 / 1958 / 181`, the figure that stood at 4a.** The
Rust figure is unchanged since 2c-5-2.

**The instrument moves these while it is in the tree**, which is the whole reason 2c-5-7 exists and why
it **re-derives** every harness-free count instead of copying an instrumented one forward. Take the
baseline above as the number to come back to, **not** as a number step 5 must hold.

**Predict the module count before building.** `CLAUDE.md` §6 gives the arithmetic, and 4b is a fresh
worked example of it — 184 was written down before the build and the build answered 184. A new `.ts`
module reachable from the entry costs **one**; a new component **with a `<style>` block costs two**,
because the block is a module of its own (measured at 2c-4c-3a, and measured again at 4b by deleting the
block to **183** and restoring it to **184**); a component with no styles costs one. **If the prediction
disagrees with the build, find out why rather than rebaselining.** Use the discriminating oracle and read
**both** lines — a bare `svelte/internal/server` search is a **vacuous** negative in a production build,
because Vite resolves and minifies module specifiers away:

```sh
# server-only sentinels — must be ABSENT
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js
# client-only constructs — must be PRESENT, proving the search can match at all
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js   # → 2 at 4b
```

#### The exact first commands, for a session resuming cold

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all          # must be empty
sed -n '/^## Q7/,/^## Q8/p' docs/reviews/phase-2c-5-design.md   # step 5's specification is Q7 item 5
sed -n '96,106p' docs/decisions/2c-4c-6-notes.md                # why step 5 must rebuild from prose
rg -n 'probe|ECFG_PROBE|launch\.sh' docs/decisions/2c-4c-4a-instrument-rebuild.md docs/decisions/2c-4c-4b-instrument.md
rg -n 'probe|ECFG_PROBE|launch\.sh' docs/decisions/2c-4c-5b-1-instrument.md docs/decisions/2c-4b-3d-2a-instrument-rebuild.md
rg -n 'restoreView|prepareRestore|confirmRestore' src/lib/components/RestorePane.svelte
```

#### What 2c-5-5 is (consult Q7 item 5)

**Rebuild and review the temporary window instrument.** Reconstruct **from the surviving prose** the probe
hooks, the deterministic fixtures, the driver, the fresh bundle-path launch, the language selection, the
external target **and backup** mutations, and the whole-tree byte oracle. The previous phase deliberately
removed the harness and recorded that the next one must rebuild from prose
(`docs/decisions/2c-4c-6-notes.md:96-106`). The construction records that survive are
`2c-4a-3c-1-instrument.md`, `2c-4b-3b-instrument.md`, `2c-4b-3c-1-notes.md`,
`2c-4b-3d-2a-instrument-rebuild.md`, `2c-4c-4a-instrument-rebuild.md`, `2c-4c-4b-instrument.md` and
`2c-4c-5b-1-instrument.md`. They **describe** the harness rather than reproduce it, and 2c-4c-4a is the
precedent for authoring `src-tauri/src/probe.rs` from the code because no record carries its source.

**Prove the driver reaches every planned state before using it as evidence.** That is the step's own
acceptance criterion and not a nicety: an instrument that silently misses a state strands the reading
built on it, which is exactly what round 1 of 2c-4b-3d-2a found **twice**.

**It owes instrument tests and review, not a product window reading.** 2c-5-6 is the only step of this
phase that owes the bilingual WKWebView reading, and 4b changed no `.svelte` file after its first fix
round, so nothing is invalidated and nothing is brought forward.

#### Two standing traps for the instrument, both already in `CLAUDE.md` and both worth repeating here

1. **One plan per launch, into a fresh bundle path.** A WKWebView whose window is occluded stops running
   `setTimeout` about **six seconds** after launch; `open -a` does not restart it and
   `-NSAppSleepDisabled` does not prevent it. And LaunchServices **silently drops `--env`** for a bundle
   path it thinks is already running, so a reused path gives a launch that looks fine while carrying the
   previous plan.
2. **The webview's `localStorage` is not keyed by `HOME`.** The WebKit data store follows the **bundle
   identifier**, which every probe bundle shares, so a language override set by one launch is still in
   force in the next — from a different bundle path, with a `HOME` created seconds earlier. **A plan must
   set the language explicitly through the picker** rather than trust the launch environment; two launches
   of the 2c-2-2 reading failed by looking for an English control on a Spanish screen.

#### The memory note that binds this step

**The probe harness stays uncommitted — never `git commit -am` while probe files are in the tree.**
2c-5-7 removes the instrument and **re-derives** all harness-free gate counts, because **a count only a
harness-free tree can produce must be re-derived on such a tree, never copied forward.** The scar is
`1623`, which stood in this file for three step records after 3d-1 committed ten cases while the harness
was in the tree.

#### The lesson 5 inherits from 4b

**A check and a spend separated by any property read are not atomic in JavaScript** — a property read runs
arbitrary code through a getter or a proxy trap, `readonly` does not freeze at runtime, and the absence of
`await` proves nothing about synchronous re-entry — and **removing a token to protect it creates a false
"nothing here" state for every other producer that tests for presence.** Step 5 writes a driver that
presses this application's controls in sequence, so it will not reproduce either defect; what it inherits
is the sweep discipline. **Sweep for the shape, never for the words of the finding you just closed.**
Three consecutive rounds of 4b each found a narrower instance of what the round before had fixed, and each
one was created by that fix.

---

### ⚠️ HISTORICAL — the step 2c-5-4b handoff, discharged. Kept because its four binding rules and its five hand-forwards are what 4b was built and reviewed against.

### **Step 2c-5-4a is COMPLETE. The next thing to do is step 2c-5-4b — the restore screen, its i18n, and the phase's mounted evidence.**

**Step 2c-5-4 was split into 4a and 4b.** The consult's Q7 item 4 is still the specification, but 4a has
already discharged its coordinator half. Read the "Verification — Phase 2c-5 step 4a" section above for
what the split is and why the boundary sits where it does, and the "Phase 2c-5-4a review disposition"
for the three findings and the lesson. **4b is the last step of 2c-5-4, and it carries the phase's whole
mounted evidence.**

#### The production gate baseline

**`1153 / 426 / 1958 / 181`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. The Rust figure is **unchanged since 2c-5-2** and must stay so unless 4b touches
Rust, which it should not.

**Predict the module count before building.** `CLAUDE.md` §6 gives the arithmetic, and 4a's +1 is a fresh
worked example of it: a new `.ts` module reachable from the entry costs **one**; a new component **with a
`<style>` block costs two**, because the block is a module of its own (measured at 2c-4c-3a, not
inferred); a component with no styles costs one. So `RestorePane.svelte` with styles is +2, and any new
`.ts` beside it is +1 each. If the prediction disagrees with the build, **find out why rather than
rebaselining**. Use the discriminating oracle — a bare `svelte/internal/server` search is **vacuous** in a
production build:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # server-only — must be ABSENT
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js     # client-only — must be PRESENT (2 at 4a)
```

#### The exact first commands, for a session resuming cold

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all          # must be empty
sed -n '/^## Q5/,/^## Q7/p' docs/reviews/phase-2c-5-design.md   # the screen, and what restore must never claim
rg -n 'restoreView|restoreRefusal|canPrepareRestore|prepareRestore|confirmRestore' src/lib/browser/restore.ts
rg -n 'restoreDocument|BackupCommands|listBackupBatches' src/lib/browser/workspace.svelte.ts
rg -n 'documentStart|openMatchDrafts|unsavedDraftInDocument' src/lib/components/DetailPane.svelte
```

#### What 4b must build (consult Q5 and Q7 item 4)

The third-pane mode reached from the document's whole-text surface; catalogue states; the candidate and an
**optional** loaded-target `SourceText`; two-stage controls; typed English/Spanish accessors; the save
outcomes; and accessible focus and scroll behaviour. **Every changed component gets a mounted interaction
test.** The mounted matrix proves exact identity-bound confirmation, withdrawal on every change,
open-surface refusal, **no direct IPC call**, parse-finding acknowledgement, conflict preservation,
committed-result wording, and no forbidden historical or authenticity claim.

Four things bind it, carried unchanged from the unsplit handoff:

1. **`SourceText`, never a `<textarea>`.** Input controls normalize carriage returns — a `<textarea>`
   collapses CR and CRLF to LF, an `<input>` **deletes** the character — and `SourceText` is this
   project's established read-only representation, with named control characters and horizontal
   scrolling. Reuse the `documentStart` walk `DetailPane.svelte` already does for the raw viewer.
   Showing the target's currently held text as a second stacked `SourceText` is useful **only** if
   labelled as *the window's loaded observation*; it must not be called current disk state. A diff is
   unnecessary and must never become writable.
2. **Three states, not a modal detached from its evidence**: select a recognised batch and entry; inspect
   the candidate; *Prepare to replace file*, which produces the opaque pending confirmation; then a
   **visually distinct** *Replace entire file with the shown text*. Do **not** add a type-the-filename
   ritual — the consult rules it adds no stronger binding.
3. **The batch label is not a timestamp assertion.** The UI may say *Backup batch named 2026-…* and may
   order recognised batches newest-**name**-first. It may **not** say *taken at*, *the file at*, *version
   from*, or convert the name into a localized historical time. The counter disambiguates sessions created
   under one label; it is not an edit sequence.
4. **Add `tRestoreRefusal(refusal: RestoreRefusal)` to `src/lib/i18n/index.ts` and call it.** Step 3
   deliberately added no accessor and 4a deliberately added none either; a component renders a code by
   calling an accessor, **never** by building a key and never `t(restoreRefusalKey(...))`.

#### Five things 4a hands forward, and they are specific

1. **`BackupCommands` has a real production default.** A `createBrowserState` call that omits the third
   argument reaches `invoke` rather than a script. **No type says so**, and 4b's mounted tests are exactly
   the call sites that would forget. Inject it explicitly in every mounted case.
2. **Build one shared live `RestoreContext`** and give it to `restoreView`, `restoreRefusal`,
   `prepareRestore` **and** `confirmRestore`. All four gates must agree, and wrapping only confirmation is
   what the confirmation round warned against. Build `observed` with `revisionInProjection(browser.views,
   session.target)` — the model's own named producer — **never** with `session.baseRevision`, which is the
   frozen base and legitimately differs from what the window projects.
3. **`restoreDocument(started, surfaces, invalidate)` answers `RestoreSession | null`.** `null` means
   *this invocation produced no session, so do not install one*; non-null always means install it. Do not
   install the confirmation's frozen session on `null` — that would overwrite whatever the call that
   **did** spend the permit produced.
4. **4b owns the `InvalidateEverySurface` supplier.** It must synchronously close or mark terminal
   **every** write surface for that document. 4a forces only that a callback is supplied, never that it
   closes anything. The pre-send open-surface refusal is an **affordance, not the safety proof**: a
   surface can open after preview, which is why confirmation rechecks and why this callback exists.
5. **The acknowledgement is candidate-scoped, not one-attempt.** `restoreConfirmationWithdrawn` keeps it,
   so after a withdrawal the screen may re-ask for confirmation while an acknowledgement is still held.
   **Neither 4b's copy nor its mounted cases may be built around consent being re-collected.** This was
   the confirmation round's one Low, and it was a false claim in 4a's own prose.

#### The lesson 4b inherits, now with two instances behind it

**A check and a spend separated by any property read are not atomic in JavaScript**, because a property
read can run arbitrary code through a getter or a proxy trap, and `readonly` does not freeze an object at
runtime. Verifying there is no `await` proves nothing about **synchronous re-entry**. Step 3 spent four
passes on this; 4a then found a **narrower surviving instance one function along**, because the sweep had
been written from the closed finding's wording. 4b draws the controls that call `confirmRestore` and
`sendRestore` through the coordinator: it must not reintroduce a gap between deciding and spending, and
its sweep must look for the **shape** — a consuming operation whose result is discarded — not the words.

---

### ⚠️ HISTORICAL — the step 2c-5-4 handoff as written for the unsplit step. Discharged in part by 4a. Kept because its four binding rules are what 4b must still obey.

### **Step 2c-5-3 is COMPLETE. The next thing to do is step 2c-5-4 — the third-pane screen, i18n, and the phase's mounted evidence.**

The consult is `docs/reviews/phase-2c-5-design.md`; its **Q5** is step 4's specification, **Q6** is what
restore must never claim, and **Q7 item 4** is the evidence step 4 owes. Step 3's rounds are
`docs/reviews/phase-2c-5-3-code.md` and `docs/reviews/phase-2c-5-3-confirmation.md` (which holds three
rounds, including the third and fourth passes on the confirmation spend).

#### The production gate baseline

**`1153 / 426 / 1936 / 180`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. The Rust figure is **unchanged** and must stay so unless step 4 touches Rust.
`npm run check` moved 424 → 426 (two new files); `npm test` 1793 → 1936.

**180 is unchanged and that is correct**: nothing draws `restore.ts`, so it is not reachable from the
entry. **Step 4 will move this number, and by a known amount** — the ladder in `CLAUDE.md` §6 gives the
arithmetic: a new `.ts` module reachable from the entry costs **one**, a new component with a `<style>`
block costs **two** (the block is a module of its own — measured at 2c-4c-3a, not inferred), and a
component with no styles costs one. Drawing restore makes `restore.ts` reachable for the first time,
which is **+1 on its own**, exactly as `recovery.ts` was at 2c-4c-3a. Predict the number before
building, then check the prediction — and if it disagrees, find out why rather than rebaselining.
**Do both the arithmetic and the bundle search**, and use the discriminating oracle:

```sh
# server-only sentinels — must be ABSENT
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js
# client-only constructs — must be PRESENT, proving the search can match at all
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js   # → 2 at step 3
```

A bare `svelte/internal/server` search is a **vacuous** negative in a production build; the 2c-5-2
entry below records why.

#### The exact first commands, for a session resuming cold

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all          # must be empty
sed -n '/^## Q5/,/^## Q6/p' docs/reviews/phase-2c-5-design.md   # step 4's specification
sed -n '/^## Q6/,/^## Q7/p' docs/reviews/phase-2c-5-design.md   # what restore must never claim
rg -n "restoreRefusalKey|openWriteSurfaceKey" src/lib/browser/restore.ts
rg -n "documentStart" src/lib/components/DetailPane.svelte
```

#### What step 4 must build (consult Q5 and Q7 item 4)

The third-pane mode reached from the document's whole-text surface; catalogue states; the candidate
and an **optional** loaded-target `SourceText`; two-stage controls; typed English/Spanish accessors;
the save outcomes; and accessible focus and scroll behaviour. **Every changed component gets a mounted
interaction test.** The mounted matrix proves exact identity-bound confirmation, withdrawal on every
change, open-surface refusal, **no direct IPC call**, parse-finding acknowledgement, conflict
preservation, committed-result wording, and no forbidden historical or authenticity claim.

Four things bind it specifically:

1. **`SourceText`, never a `<textarea>`.** Input controls normalize carriage returns — a `<textarea>`
   collapses CR and CRLF to LF, an `<input>` **deletes** the character — and `SourceText` is this
   project's established read-only representation, with named control characters and horizontal
   scrolling. Reuse the `documentStart` walk `DetailPane.svelte` already does for the raw viewer.
   Showing the target's currently held text as a second stacked `SourceText` is useful **only** if
   labelled as *the window's loaded observation*; it must not be called current disk state. A diff is
   unnecessary and must never become writable.
2. **Three states, not a modal detached from its evidence**: select a recognised batch and entry;
   inspect the candidate; *Prepare to replace file*, which produces the opaque pending confirmation;
   then a **visually distinct** *Replace entire file with the shown text*. Do **not** add a
   type-the-filename ritual — the consult rules it adds no stronger binding.
3. **The batch label is not a timestamp assertion.** The UI may say *Backup batch named 2026-…* and may
   order recognised batches newest-**name**-first. It may **not** say *taken at*, *the file at*,
   *version from*, or convert the name into a localized historical time. The counter disambiguates
   sessions created under one label; it is not an edit sequence.
4. **Add `tRestoreRefusal(refusal: RestoreRefusal)` to `src/lib/i18n/index.ts` and call it.** Step 3
   deliberately added no accessor (it would have made the model reachable from the entry for code no
   component called); the fourth pass adjudicated that sound **at that boundary only**. A component
   renders a code by calling an accessor, **never** by building a key and never `t(restoreRefusalKey(...))`.

#### Two obligations step 3 hands forward

- **A catalogue or candidate answer landing during a send is dropped** — a consequence of the truthful
  freeze that keeps a committed answer describable. **Step 4 owes a way to ask again.**
- **`applyRestore` takes a required `InvalidateEverySurface`.** Step 4 must supply the coordinator's
  synchronous whole-document invalidator, which closes or marks terminal **every** write surface for
  that document. The pre-send open-surface refusal is an **affordance, not the safety proof**: a
  surface can open after preview, which is why confirmation rechecks the coordinator and why this
  callback exists.

#### The lesson step 3 cost four passes to learn, and step 4 inherits it

**A check and a spend separated by any property read are not atomic in JavaScript**, because a property
read can run arbitrary code through a getter or a proxy trap, and `readonly` does not freeze an object
at runtime. Verifying there is no `await` proves nothing about **synchronous re-entry** — that is
exactly what round 3 verified and exactly what it missed. Step 4 draws the controls that call
`confirmRestore` and `sendRestore`; it must not reintroduce a gap between deciding and spending.

---

### ⚠️ HISTORICAL — the step 2c-5-3 handoff, discharged. Kept because its rules are what step 3 was built and reviewed against.

### **Step 2c-5-2 is COMPLETE. The next thing to do is step 2c-5-3 — restore as browser values, with nothing drawn.**

The consult is `docs/reviews/phase-2c-5-design.md`; its **Q4** is step 3's specification and its
**Q7 item 3** is the evidence step 3 owes. Step 2's rounds are `docs/reviews/phase-2c-5-2-code.md`
(the review, 325 lines) and `docs/reviews/phase-2c-5-2-confirmation.md` (the confirmation, 230
lines). Step 1's are `phase-2c-5-1-code.md` and `phase-2c-5-1-confirmation.md`.

#### The production gate baseline

**`1153 / 424 / 1793 / 180`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. The Rust figure moved from 1131 → 1152 in the implementation (+21: 15 in
`backup.rs`, 6 in `wire_contract.rs`) and → **1153** in fix round 1 (+1: the length test). It was
re-derived by the orchestrator by **summing the per-suite totals**, not by trusting any worker's
figure. `npm run check` moved 423 → **424** (one new test file), `npm test` 1767 → **1793** (+26:
20 in the new `backupCodes.test.ts`, 5 in `commands.test.ts`, and **1 from
`scripts/lint/ipc-detail.test.ts`'s per-file `it.each` picking up the new file** — that last one is
the kind of increment that looks unexplained if you only count the cases you wrote).

**The module count stayed at 180, and that is correct rather than suspicious**: every frontend change
in this step was a *modification* of an existing module, and the two new files are a test and a Rust
file — neither is reachable from the entry.

#### ⚠️ The bundle-regression oracle was wrong as previously written, and this is the correction

`CLAUDE.md` says to check **both** the arithmetic and a bundle search for `svelte/internal/server`.
**That search cannot fail in a production build**: Vite resolves and minifies module specifiers away,
so the literal string is absent whether or not the server build leaked in. Verified at this step — a
control search for `svelte/internal/client` in `dist/assets/index-*.js` **also matched nothing**,
which makes the negative vacuous in both directions. Step 2's implementer reported that control as
having matched; it does not.

**The oracle that actually discriminates**, and what was used here:

```sh
# server-only sentinels — must be ABSENT
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js
# client-only constructs — must be PRESENT, proving the search can match at all
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js   # → 2 at this step
```

#### What step 2 built, and the two decisions it took

Three read-only commands — `list_backup_batches`, `list_backup_entries`, `read_backup_text` —
registered as the thirteenth to fifteenth commands in `src-tauri/src/main.rs`. **No writer was
added**; restore remains a content path on the sixth writer. Read-only-ness is proved twice: a
lexical tripwire over the command bodies and a byte-oracle test that drives all three over a real
tree and compares the whole tree afterwards. **The tripwire's own documentation now says what it does
and does not prove** — it is a regression tripwire, not a soundness proof, and a writer reached
through a re-export, an alias, a trait method or a macro would not be seen by it.

- **Non-UTF-8 entry names — *exact-or-absent*.** An entry reaches the wire only when its relative
  path survives the lossy rendering byte-for-byte, compared as `OsStr` **bytes** rather than `Path`
  components. The rest are counted in an `unaddressable` operand, so a short listing is **disclosed
  rather than silently short**. Tested at the identity level with a positive control, because **APFS
  refuses to create a non-UTF-8 name** and the file cannot be made.
- **`BackupEntry.length` crosses as exact decimal digits, not a JSON number** — the step's one
  behavioural change, and a **wire-format change** (`number` → `string`). Nothing consumes it yet;
  **2c-5-4's screen must use `BigInt(length)`**. Refusing was rejected because it drops an entry from
  a listing that claims completeness, and capping because it reports a length never observed. The
  confirmation round adjudicated the mechanism **sound**.

#### The two adjudications the confirmation round settled — do not reopen either

1. **`batch_stamp`'s "sorts lexicographically in the same order it sorts chronologically" is NOT a
   defect** (`backup.rs:1331`). Its grammatical subject is the fixed UTC **format** applied to `when`,
   explaining why formatted values compare lexicographically; it makes no claim about the directories
   on disk, and `rotate()` above it now says on-disk ordering establishes no chronology.
2. **The `length` wire format is sound.** Only its explanatory *example* was wrong, and that was a
   false claim **introduced by fix round 1**: `2^53` **is** exactly representable as a JavaScript
   number, so the first integer demonstrating loss is `2^53 + 1`. The test's illustrative control now
   uses `MAX_EXACT_WIRE_INTEGER + 2` → `"9007199254740993"`; the loop still carries `MAX + 1` as
   boundary coverage rather than as a rounding demonstration.

#### The lesson this step re-proved, in the sharpest form yet

**Every one of the seventeen findings across both rounds was a sentence claiming a guarantee the code
does not give. No High was ever found, and no test could have failed for any of them.**

The narrowing pattern held exactly as the record predicts. Fix round 1 closed eleven findings **and
swept 30 further sites** — and the confirmation round *still* found **narrower instances of the same
four defects**. Two details are worth carrying:

- **M2's exact flagged sentence was standing in a second file.** "the eleventh session after this
  one" was fixed in `backup.rs` and left untouched in `core/persist/save.rs`. Fixing the named site
  is not fixing the defect.
- **The fix introduced its own false claim** (the `2^53` example). *A fix is a change, and the round
  that reviews it is not optional* — this step is now the third consecutive one where that rule paid.

Fix round 2 swept 27 more sites, and used a discriminator worth reusing: **"newest *name* first" is
hedged and stays; unhedged "older/oldest batch" goes.** The forbidden claims remain forbidden —
nothing may claim a backup is older or newer than another state, claim recoverability, or claim
provenance. Batches are sessions, the directory name is a clock-derived label, and retention promises
neither chronology nor recoverability.

#### Two residues fix round 2 named and deliberately left — ✅ **both ruled on at step 3, and closed**

1. **The containment claim is corrected.** `docs/decisions/2a-3b-notes.md` §2.2 keeps its original
   prose and gains a **correction block**, per the convention that an old record is corrected
   elsewhere rather than edited. It splits the claim in two: `backup_relative_path()` keeps only
   `Component::Normal` components, so the **constructed path** introduces no lexical `.` or `..`
   escape — arithmetic on a `Path`, true on **every** target — while containment **on disk** against a
   symlink swapped between check and use is closed **on macOS only**, and there only for the
   descriptor-anchored read walk. `create_backup_root`, `create_batch`, `write_backup`,
   `publish_backup` and `rotate` all still resolve by pathname on every target, so **§9 hole 15 is
   unchanged and still describes the write side**. A `docs/`-wide sweep found no other instance; the
   review files that contain the phrase are quoting it as their own finding.
2. **The four i18n strings need no change.** `code.backupStep.writeBatchMarker` and
   `code.entrySkipped.marker` were read in both languages: they are meaning-parallel and follow their
   neighbours' convention exactly — **EN gerund, ES infinitive** across all twelve `backupStep` keys.
   Still true that no suite pins meaning; this was a reading, and it is recorded as one.

One residue named below **remains open and is still worth doing**:
`crates/espansoconfig-core/src/persist/backup.rs:4312` carries a test comment *"Nothing a caller can
spell escapes the batch"*. It reads as a claim about the **constructed value**, which is the true half,
so it is not urgent — but it is the last unswept instance of the phrase.

#### The residues as fix round 2 originally wrote them

1. **`docs/decisions/2a-3b-notes.md:159` still holds "cannot escape the batch directory"** — an
   unconditional containment claim that the macOS/non-macOS split made false off macOS. It is a
   Phase 2a record, and **project convention leaves old records as written and corrects them
   elsewhere**. It needs a *correction block*, not an edit. `docs/` was outside the sweep's scope.
2. **Four i18n strings are the fixer's own words, not the reviewer's dictated text** —
   `code.backupStep.writeBatchMarker` and `code.entrySkipped.marker`, EN and ES each. Meaning-parity
   between the two languages was checked **by reading only**, and **no test can catch a drift there**
   (the i18n suites check key and placeholder parity, never meaning).

#### Is a third review round owed?

**Not automatically, and the evidence says no.** Round 2 found no High and no behavioural defect;
fix round 2 changed no executable line except the test control the review itself dictated, and no
gate figure moved. But this project's history is four passes on step 2c-5-1, and **the cheapest
version of a third round is narrow**: the two residues above, plus a sweep of `docs/` for the
containment claim. A fresh session with budget may reasonably take it before starting step 3; it is
**not** a blocker.

#### The exact first commands, for a session resuming cold

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all          # must be empty
sed -n '/^## Q4/,/^## Q5/p' docs/reviews/phase-2c-5-design.md   # step 3's specification
sed -n '/^## Q5/,/^## Q6/p' docs/reviews/phase-2c-5-design.md   # the one-shot confirmation ruling
rg -n "saveRawDocument" src/lib/browser/state.ts
rg -n "openWholeDocumentSave" src/lib/browser/invalidation.ts
```

#### What step 3 must build (consult Q4 and Q7 item 3)

Catalogue and preview state, **exact candidate retention**, open-surface refusal, the **one-shot
confirmation**, acknowledgement invalidation, conflict retention, and composition through
`BrowserState.saveRawDocument` plus `openWholeDocumentSave`. **No component changes, so no mounted
test and no window reading** — this is the project's established value-before-choice cut.

Model/workspace tests owe every binding change, the dirty-unknown wording predicate, all six
competing surface kinds, `committed: false`, refusal/acknowledgement, conflict/adopt
`installed | alreadyThere | refused`, a second conflict, send uncertainty, committed invalidation
failure, and **proof that no save is issued without confirmation**.

The consult's single binding instruction, to read before writing a line:

> The only restore submission is the exact UTF-8 text whose candidate hash, opaque backup-entry
> identity, target `DocumentId`, target base revision, and preview generation are bound into one
> unspent confirmation; send that text unchanged through `BrowserState.saveRawDocument`, and treat
> every mismatch as "write nothing."

**And the limitation that must be stated in the same sentence as what the code does force**:
structural TypeScript cannot prove every caller used the confirmation — the browser transition can
make confirmation the only producer it exposes, but a direct IPC import bypasses it. `matchDeletion.ts`
has the identical limitation and says so. **Claiming the core enforces restore intent would be this
step's instance of the defect class that produced all seventeen of step 2's findings.**

---

### ⚠️ HISTORICAL — the step 2c-5-2 handoff, discharged. Kept because its rules are what step 2 was built and reviewed against.

### **Step 2c-5-1 is COMPLETE. The next thing to do is step 2c-5-2 — the read-only Tauri wire.**

The consult is `docs/reviews/phase-2c-5-design.md`; its **Q3** is step 2's specification and its **Q7 item 2**
is the evidence step 2 owes. Step 1's two review rounds are `docs/reviews/phase-2c-5-1-code.md`
and `docs/reviews/phase-2c-5-1-confirmation.md`.

#### What step 2 must build (consult Q3)

Three commands, **all read-only**: `list_backup_batches`, `list_backup_entries`, `read_backup_text`.
The first two return step 1's scan summaries. The third takes an opaque `BackupEntryId` **plus the
selected `DocumentId`**, re-resolves the latter through the workspace's authoritative
`DocumentContext`, **verifies the entry maps to that target**, and returns
`{ entry, document, text, revision }`.

- **A display path is never authority.** `DocumentSummary.relative_path` is display data; the
  session-local id is what callers hand back.
- **No new writer, and no restore-specific finding** — Q1 and Q3 both. Restore is a content path on
  `save_raw_document`, and *"the person chose Restore"* is UI authorization, not something validation
  can infer from identical text.
- Every new error is a **code plus structured operands** — missing root, refused root,
  unrecognised/stale batch, stale entry, path/type refusal, I/O, `NotUtf8 { offset }` — and each
  crosses **both** dictionaries through typed accessors. Components may not construct keys.
- **Step 1 deliberately derived `Serialize` on nothing.** `src-tauri/src/dictionary_contract.rs`
  requires every serializable enum in the scanned trees to be a registered namespace, so the wire
  types and their dictionary entries arrive together in step 2 or the contract test fails. The
  `code()` accessors are already in place, following the existing `BackupError`/`BackupStep`
  precedent.
- Prove a forged id, a forged path, a wrong target, a stale batch, an unreadable entry and invalid
  UTF-8 are **typed refusals**, and prove **no command calls a writer**.
- Step 2 owes Rust/IPC and TypeScript **model tests only** — no mounted test, no window reading.

#### Three things step 1 leaves for step 2, from the implementer's own notes

1. **A batch entry whose name is not valid UTF-8 is admitted** — the id holds a real `PathBuf` and
   display is lossy through `WirePath`. **Step 2 must decide the wire round-trip.** A lossy id simply
   fails revalidation as `StaleEntry`, which is safe but is not the same as being representable.
2. **A disambiguated copy (`base.yml-1`, minted by `publish_backup`) is not `entry_for_target`'s
   answer** — it is not the name the mapping produces. It is still **listed** by `scan_entries`,
   where `BackupTarget::InConfigRoot` reverse-maps its own literal path. The variant is documented as
   a statement about the **path**, never that a file exists there or that this copy came from it.
3. **`entry_for_target` answers `None` for a target equal to the configuration root.** Step 1's fix
   round made that a behavioural refusal rather than only a documented sentinel, because it was
   otherwise returning the entry for an in-root file literally named `_outside`.

#### The one decision an owner took during step 1, and it binds step 2 and beyond

**The symlink TOCTOU is closed by descriptor-relative traversal via `openat`/`O_NOFOLLOW`, using the
`libc` already declared under `[target.'cfg(target_os = "macos")'.dependencies]`.** No new dependency
was added, and the alternatives — adding `rustix`/`cap-std` as the crate's first *unconditional*
platform dependency, or narrowing the guarantee instead of closing the race — were both put to the
owner and declined.

The consequence every later step inherits: **the guarantee is per-target and must always be stated
that way.**

- **On macOS** the root is opened `O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC`, children via
  `openat(…, O_NOFOLLOW)`, classification by `fstatat(AT_SYMLINK_NOFOLLOW)`, confirmation by `fstat`
  on the descriptor, and listings by `dup`+`fdopendir`+`rewinddir`+`readdir`. `read_entry` reads
  **the same leaf descriptor** `open_entry` opened — there is no second open by name.
- **Off macOS** the pathname implementation stays and **a raced substitution can be followed**. This
  is deliberate and documented, not an oversight.
- **One macOS residue is real and named**: the backup root's own path is resolved once, with
  `O_NOFOLLOW` covering only its final component.
- **`espansoconfig-core` must never depend on `tauri`** — the read side adds no Tauri use, and
  `cargo tree -p espansoconfig-core | rg tauri` must keep finding nothing.

**A sentence true on macOS and false elsewhere, stated unconditionally, is what round 2 was still
finding after round 1's fix**, and it is this project's worst defect class. The whole of round 2's
NOT READY verdict was that one defect at four sites.

#### Two latent bugs step 1's own sweep found, neither named by any review

- **`escape_in_root_path` emitted `_outside_/` for a one-component path**, because `PathBuf::push("")`
  appends a separator. Normalisation had hidden it; the strict validator exposed it by rejecting a
  legitimate entry. Its test asserts **`OsStr` spellings byte-for-byte**, because `Path` equality is
  component-wise and **would not have caught it**.
- **`fdopendir` on a duplicated descriptor shares the file offset**, so a second listing of one
  directory returned empty until `rewinddir` was added. Its test lists twice and was verified to fail
  without the fix.

#### One thing NOT done, deliberately, and it is the cheapest thing a fresh session could do first

**No third review round was commissioned.** Round 2's entire verdict was prose at four named sites,
the reviewer **dictated the replacement sentence**, and the fix changed **no executable line** — all
six edits were inside `///` comments, with the test count unchanged at 1131 either side. The
orchestrator's own sweep then found and fixed a **seventh** site the review had not named: the module
header's line 76 justified putting the same-user attacker out of scope on the grounds that *"every
path this module touches is resolved by pathname"*, which the macOS read walk had just made false —
an **under**-claim, and the mirror image of the defect round 2 closed.

This project's history is that each round finds a narrower instance of the last, and **the seventh
site is exactly that pattern continuing**. A fresh session with a full budget may reasonably take one
short round over the doc comments in `crates/espansoconfig-core/src/persist/backup.rs` before
starting step 2. It is **not** a blocker: no behavioural defect is outstanding, round 2 found none
new, and it explicitly reported *"no unnamed residual macOS race below the opened backup root"*.

#### What was NOT proved about the non-macOS body, stated as a limitation rather than a result

`x86_64-unknown-linux-gnu` is **not installed** and was deliberately not installed. The `#[cfg]` split
was instead proved by **compiling it**: every `#[cfg(target_os = "macos")]` in `backup.rs` was
temporarily flipped to `cfg(any())` and the `not(...)` one to `cfg(all())`, then build, the backup
tests (45/45, the macOS-only race test correctly excluded) and clippy were run; the tree was restored
and re-verified, and **no `cfg(any())`/`cfg(all())` artifact survives** — checked independently by the
orchestrator.

Round 2 ruled that adequate for syntax and type-correctness against the host's standard library, and
named what it does **not** prove: **Linux target dependency/cfg resolution, linker/ABI compatibility,
target-specific standard-library differences, and behaviour on a Linux filesystem or kernel.** A true
target build remains the stronger confirmation and has never been run.

#### The production gate baseline

**`1131 / 423 / 1767 / 180`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. **The first figure moved from 1112 to 1131 in step 1** (+15 in the
implementation, +4 in the fix round: the raced-swap test, the listing-idempotence test, the
config-root sentinel test and the disambiguated-sibling test; none removed). It was re-derived by the
orchestrator by **summing the per-suite totals**, not by trusting a worker's figure. The three
frontend figures are untouched, because step 1 changed no frontend file — step 2 is the first that
will.

**The module count's shorthand is spent**: 180 is now within one of the number that used to mean *the
Svelte server build leaked in*, so check **both halves** — the arithmetic (a new `.ts` module costs
one, a new **styled** component costs two) and the bundle search for `svelte/internal/server`,
verifying the search can match before trusting its negative.

#### The exact first commands, for a session resuming cold

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all          # must be empty
sed -n '/^## Q3/,/^## Q4/p' docs/reviews/phase-2c-5-design.md   # step 2's specification
rg -n "pub struct BackupCatalog|pub fn scan_batches|pub fn scan_entries|pub fn read_entry|pub fn entry_for_target" \
   crates/espansoconfig-core/src/persist/backup.rs
rg -n "BackupError|BackupStep" src-tauri/src/dictionary_contract.rs   # the precedent step 2 follows
```

---

### ⚠️ HISTORICAL — the step 2c-5-1 handoff, discharged. Kept because its rules are what step 1 was built and reviewed against.

**Step 2c-5-1 is complete.** The verdict is the 2c-5-1 row in the Status table above; the rules below
are what it was built to, and Q2 of the consult remains their source.

### **The 2c-5 design consult is TAKEN. The next thing to do is step 2c-5-1 — the core backup catalogue, in Rust, with no caller.**

The consult is `docs/reviews/phase-2c-5-design.md`, 125 lines, VERDICT plus Q1–Q8. **Read it before
writing a line**; this section is the handoff, not a substitute for it.

#### The three places the consult ruled against the brief that commissioned it

1. **There is no seventh writing command.** Restore is a **content path on the sixth writer**: the
   frontend reads the backup's text through a **read-only** command and submits it through the
   existing `BrowserState.saveRawDocument` → `save_raw_document` → `SaveContent::ReplaceText` path.
   The three new commands — `list_backup_batches`, `list_backup_entries`, `read_backup_text` — write
   nothing.
2. **There is no restore-specific acknowledgeable finding.** A finding belongs to the **candidate
   gate**, and *"the person chose Restore"* is UI authorization, not a property validation can infer
   from identical text. Adding route provenance to `SaveContent` to manufacture one would give two
   byte-identical replacement candidates **different transaction verdicts** and turn the sixth writer
   into a hidden seventh protocol. The destructive consent is the **one-shot identity-bound
   confirmation** in the browser layer instead — with the admitted boundary, which the decision
   record must state **in the same sentence**, that structural TypeScript cannot prove every caller
   used it (`matchDeletion.ts` has the identical limitation and says so).
3. **Q8 disagrees with this project's own history.** Asked whether the sharpest failure here is prose,
   the consult answered **no**: *"perfect prose cannot recover a file replaced under mismatched
   authorization."* The most likely *review finding* is still a sentence — *version from Tuesday*,
   *undo*, *unsaved changes* — but the highest-consequence *plausible error* is behavioural.

#### The single instruction the consult says to read before writing a line

> The only restore submission is the exact UTF-8 text whose candidate hash, opaque backup-entry
> identity, target `DocumentId`, target base revision, and preview generation are bound into one
> unspent confirmation; send that text unchanged through `BrowserState.saveRawDocument`, and treat
> every mismatch as "write nothing."

A preview of entry A followed by a write of entry B, a confirmation carried to another document, or
a base revision refreshed at send time **destroys the wrong bytes while every lower-level write
primitive behaves correctly**.

#### The seven steps (consult Q7), and what each owes

| Step | Scope | Evidence owed |
|---|---|---|
| **2c-5-1** | **The core backup catalogue, with no caller.** Types, the shared batch parser and order, root and marker recognition, the recursive non-following entry scan, the reversible target mapping, the exact byte read, the UTF-8 refusal, typed read errors. Every operation read-only | model tests only — **no** mounted test, **no** window reading |
| **2c-5-2** | **The read-only Tauri wire.** The three commands, opaque serialized ids, dictionary-contract coverage, `DocumentId`→context mapping, exhaustive TypeScript types | Rust/IPC and TS model tests; **no** mounted test, **no** reading |
| **2c-5-3** | **Restore as browser values, nothing drawn.** Catalogue/preview state, exact candidate retention, the open-surface refusal, the one-shot confirmation, the sealed invalidation, conflict retention, composition through `saveRawDocument` | model tests; **no** mounted test, **no** reading |
| **2c-5-4** | **The third-pane screen, i18n and the mounted evidence.** The mode, the candidate through `SourceText`, two-stage controls, typed EN/ES accessors | **the phase's mounted-component evidence**; no reading |
| **2c-5-5** | **Rebuild the temporary window instrument** from prose — the harness was deleted at 2c-4c-6 and its sources survive in no record | instrument review; no product reading |
| **2c-5-6** | **The bilingual WKWebView reading** | **the only step that owes the window reading** |
| **2c-5-7** | **Remove the instrument**, sweep for residue, re-derive the gate figures on a harness-free tree | none |

#### What step 2c-5-1 must build, from consult Q2

`crates/espansoconfig-core/src/persist/backup.rs` today has a write side and **no read side**:
`rotate` is private and the newest-first ordering a restore UI needs is locked inside it. Add a
**non-mutating `BackupCatalog`, separate from the stateful `BackupSession`**:

```text
BackupCatalog::rooted_at(config_root: &Path) -> BackupCatalog
BackupCatalog::scan_batches() -> Result<BackupBatchScan, BackupReadError>
BackupCatalog::scan_entries(batch: &BackupBatchId) -> Result<BackupEntryScan, BackupReadError>
BackupCatalog::entry_for_target(batch: &BackupBatchId, target: &Path)
    -> Result<Option<BackupEntry>, BackupReadError>
BackupCatalog::read_entry(entry: &BackupEntryId) -> Result<BackupBytes, BackupReadError>
BackupBytes::utf8() -> Result<BackupText, BackupReadError>
```

The rules that are **not** derivable from those signatures:

- **Identities are opaque and revalidated at use.** `BackupBatchId` privately holds the exact
  directory name plus the parsed `stamp` and numeric `counter`; `BackupEntryId` holds that batch
  identity plus a **validated relative component path**. `BackupEntry` exposes its id, a display
  path, a byte length and a target classification (`InConfigRoot { relative_path } |
  OutsideConfigRoot`) — **never an absolute path the frontend could manufacture**. Every
  `scan_entries`, mapping and read call **rechecks** root, batch grammar, real-directory status,
  marker, containment and leaf type, because rotation or another process may change the tree between
  calls. A disappeared batch or entry is a **typed stale/gone result, not an empty file**.
- **One ordering function, shared with rotation.** Descending `(stamp string, counter number)` for
  display; rotation reverses the same order to remove oldest. It exists twice today — the grammar in
  `parse_batch_name` and a repeated tuple sorted ascending inside `rotate`. **Do not sort whole names
  lexicographically, and do not parse the stamp into a claimed time.**
- **A missing root is an outcome, not an error**; an existing root that is a symlink, not a
  directory, or not private is a **typed refusal**, matching the checks already required before
  writing.
- **Never follow a symlink at any level**, exclude the marker, reject `.`/`..` and non-normal
  components, offer only real regular files. Foreign names, unmarked batch-shaped directories,
  regular files and symlinked batch names are **skipped, reported, and never counted as eligible**.
  `BackupBatchScan`/`BackupEntryScan` carry eligible values **plus counts and codes for the
  unrecognised and unreadable**, so the UI need not turn an incomplete scan into *"no backups"*.
- **Invalid UTF-8 is `BackupReadError::NotUtf8 { entry, offset }`** and cannot be previewed or sent.
  Never normalize, never replace invalid bytes, never call the result *"raw bytes"*. This matches
  `document_text`.
- **Reading never triggers rotation.** Rotation is the crate's only recursive deletion and is
  deliberately coupled to a successfully written capture.
- **The marker means "recognised as this application's batch format", not "untampered"** — anything
  able to write the root can forge it. Treat every entry as **untrusted input**. **No sentence may
  say the application verified that it wrote or preserved these bytes.**
- **The existing path mapping must be made a shared reversible value rather than copied**: in-root
  targets retain their relative path, `_outside` is an escaped second namespace, non-normal external
  components are dropped.

Rust tests Q7 names for this step: missing and refused roots, stamp/counter order, foreign, unmarked
and symlinked batches, symlinks at **every entry depth**, marker exclusion, a non-UTF-8 offset,
disappearing entries, outside-namespace escaping, target mapping, and **proof that enumeration and
read never create or rotate**.

`espansoconfig-core` must never depend on `tauri` — check with
`cargo tree -p espansoconfig-core | rg tauri`, which must find nothing.

#### The production gate baseline

**`1112 / 423 / 1767 / 180`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules, measured at 2c-4c-6 on a harness-free tree. Step 2c-5-1 is Rust-only, so
only the first figure should move. `npm install` is required before any frontend command will run.

**The module count's shorthand is spent**: 180 is now within one of the number that used to mean
*the Svelte server build leaked in*, so check **both halves** — the arithmetic (a new `.ts` module
costs one, a new **styled** component costs two) and the bundle search for `svelte/internal/server`,
verifying the search can match before trusting its negative.

#### The exact first commands, for a session resuming cold

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all          # must be empty
cat docs/reviews/phase-2c-5-design.md             # the consult — VERDICT and Q1–Q8
rg -n "fn rotate|fn parse_batch_name|fn backup_relative_path|fn carries_batch_marker" \
   crates/espansoconfig-core/src/persist/backup.rs
```

---

### ⚠️ HISTORICAL — the 2c-5 consult handoff, discharged. Kept because it is what the consult was commissioned against.

**The consult was taken and is `docs/reviews/phase-2c-5-design.md`.** Everything below was the brief
it was given; the rulings above supersede any assumption it records.

### **Phase 2c-4c is CLOSED. The next thing to do is the 2c-5 design consult — before any line of 2c-5 is written.**

**2c-5 is *restore from backup*: a whole-document replacement through the normal save path, with the
full identity invalidation.** `2c-split-notes.md` classifies it as the sub-phase that **fails as a
destructive mistake**, and it is the last sub-phase of 2c.

**The standing rule since 2b-2c binds it: the phase goes to a Codex design consult before any line
of it is written**, and the consult has changed the phase rather than confirmed it in most of the
sub-phases that ran one — 2c-4a's ruled the frontend's eager conflict adoption a defect, 2c-4b's
narrowed the phase and split its confidence rule in two, 2c-4c's rewrote the placement policy. Write
the consult to `docs/reviews/phase-2c-5-design.md`.

#### What the consult must be told, because it is load-bearing and not derivable from the plan

1. **The write path already exists and must be reused.** A restore *is* a whole-document
   replacement, and `SaveContent::ReplaceText` (2b-2c-3a) plus `save_raw_document` (2b-2c-3b)
   already are one. `espansoconfig_core::persist::save_document` is **the only entry point that may
   write a user's file** — never `replace_file_atomically`, never `replace_locked_file`, and never
   from inside the transaction, because **the lock is not reentrant and the process hangs silently
   and forever**. Whether a restore is a seventh writing command or a content path on the sixth is
   exactly what the consult should decide; this handoff does not assume it.
2. **The invalidation already has a shape.** `openWholeDocumentSave(sealed, forget)` in
   `src/lib/browser/invalidation.ts` is the one-shot sealed obligation: after a committed whole-file
   replacement **every `MatchId` in that file is stale** and `moved` is `null` permanently. A caller
   that does not discharge it does not have a save result.
3. **What does NOT exist is the read side of backups, and this is the real work.**
   `crates/espansoconfig-core/src/persist/backup.rs` can *write* batches (`BackupSession::rooted_at`,
   the per-session capture, `BackupRecord`) and can *delete* old ones — but its `fn rotate` is
   **private**, and the module exposes **no public way to enumerate batches, to list what a batch
   holds, or to read a backed-up file's bytes**. The newest-by-name ordering that a restore UI needs
   (the stamp compares as a **string** because `batch_stamp`'s format sorts chronologically, and the
   disambiguating counter compares as a **number**) lives inside that private function. **So 2c-5
   owes a core-side read API before any command and long before any screen** — and by §3 of
   `CLAUDE.md` it must be built in the core, with no `tauri` dependency.
4. **The backup root is `.espansoconfig-backups`**, placed outside every espanso auto-load glob at
   2a-3b, with ten-batch retention. Rotation is **the only destructive operation in the crate**.
5. **Three kinds of evidence are owed**, as by every 2c sub-phase since the split: model tests, a
   **mounted-component test**, and a **window reading**. Budget for the third: the reading harness
   was deleted by step 6 and **its sources survive in no record**, so 2c-5 rebuilds it from prose
   exactly as 2c-4c-4a did. That rebuild has cost a full sub-step every time.

#### The production gate baseline a fresh session starts from

**`1112 / 423 / 1767 / 180`** — `cargo test --workspace` / `npm run check` files / `npm test` /
`npm run build` modules. These were **measured at step 6 on a harness-free tree**, not copied
forward, and the tree at `HEAD` is the tree that produced them. `npm install` (or `npm ci`) is
required before any frontend command will run.

**The module count is a regression guard whose shorthand is spent**: 180 is now within one of the
number that used to mean *the Svelte server build leaked in*, so check **both halves** — the
arithmetic (a new `.ts` module costs one, a new styled component costs **two**) and the bundle
search — and verify the search can match before trusting its negative.

#### The exact first commands, for a session resuming cold

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all          # must be empty — the harness is gone
cat docs/decisions/2c-split-notes.md              # the cut; 2c-5 is its last row
rg -n "pub fn|pub struct|pub enum" crates/espansoconfig-core/src/persist/backup.rs
#   ^ the write side. Note there is no listing, no batch enumeration and no read-back.
```

Then commission the design consult. Do **not** write implementation first: every sub-phase since
2b-2c that skipped straight to code paid for it in review rounds, and this is the one classified as
failing destructively.

---

### ⚠️ HISTORICAL — the step-6 handoff, discharged. Kept because its four obligations are what the step's verification section reports against.

**Step 6 is complete.** Everything below was done: both probe sources deleted, the four hook lines
reverted by hand to byte-identical, the 2.9 GB scratch tree removed, and the four gate figures
re-derived on the harness-free tree — where they matched the expectation this block recorded
**before** the measurement. The closing verdict is **"Verification — Phase 2c-4c step 6"** above.

### **Step 2c-4c-6 — the harness removal — is all that is left of Phase 2c-4c. Step 5 is CLOSED.**

Steps 1, 2, 3a, 3b, 4a, 4b and 5 are complete. **Step 5 closed at 5b-3**, after a three-part fix
round: 5b-1 extended the instrument and measured the overlap, 5b-2 deleted one CSS declaration and
re-measured it, and 5b-3 rewrote the reading record and took Codex rounds 2 and 3. The closing verdict
is **"Verification — Phase 2c-4c step 5b-3"** above. **No further launch, reading or review is owed by
step 5**, and step 6 must not re-run any of it.

**Step 6 exists so an instrument does not become production code.** It produces no product evidence.
It owes four things, and the fourth is the one this project has already got wrong once.

1. **Delete both probe sources.** `src/probe.ts` and `src-tauri/src/probe.rs` are **untracked**, so
   deleting them leaves no diff and the evidence is the empty status, not a patch.
2. **Revert the four hook lines by hand, to byte-identical.** They are, exactly:
   - `src-tauri/src/main.rs` — the added `mod probe;` declaration, and `main()`'s
     `probe::register_with_probe(tauri::Builder::default())` which must go back to
     `register(tauri::Builder::default())`;
   - `src/main.ts` — the added `import { startProbe } from './probe';` and the trailing
     `startProbe();` call, with the blank line that precedes it.

   **Read the diff before deleting anything**, and prove the revert with `git diff`, which must come
   back **empty**. Do not reconstruct these lines from memory after the probe sources are gone.
3. **Delete the scratch tree** `/private/tmp/espansoconfig-harness-2c-4c/` — the launch directories
   P01–P73, the fixtures and the manifests. It measured **2.9 GB** at the end of 5b-3.
4. **Re-derive the production gate figures on the harness-free tree, and never copy them forward.**
   Every figure recorded during 4a, 4b, 5, 5b-1, 5b-2 and 5b-3 is **with-harness**:
   `1112 / 424 / 1768 / 181`. Production is **expected** to be `1112 / 423 / 1767 / 180`, and that
   expectation is what must be **measured**, not asserted. 2c-4b-3d-3 found the production test count
   `1623` had stood stale in three consecutive step records for exactly this reason, and `CLAUDE.md`
   §4 states the rule: a count only a harness-free tree can produce must be **re-derived** on such a
   tree. **If a measured figure differs from the expectation, record the measurement and investigate
   the difference — never adjust the number to match.**

**The exact first commands**, for a session resuming cold with no conversation history:

```sh
cd /Users/ccarpio/Developer/espansoConfig
git status --short --untracked-files=all
#   expect exactly these four harness paths (plus whatever the 5b-3 commit has not yet taken):
#     M src-tauri/src/main.rs
#     M src/main.ts
#     ?? src-tauri/src/probe.rs
#     ?? src/probe.ts
git diff src/main.ts src-tauri/src/main.rs    # the four hook lines — READ THIS FIRST
du -sh /private/tmp/espansoconfig-harness-2c-4c/
```

Then, in this order:

```sh
rm src/probe.ts src-tauri/src/probe.rs
# revert the four hook lines BY HAND, then prove it:
git diff src/main.ts src-tauri/src/main.rs    # must be EMPTY
rm -rf /private/tmp/espansoconfig-harness-2c-4c/
git status --short --untracked-files=all      # must return NOTHING
```

Then the four gates, on that harness-free tree, recording what each one actually prints:

```sh
cargo test --workspace
npm run check
npm test
npm run build
rg -c "svelte/internal/server|svelte/server|async_hooks" dist/assets/*.js   # must find nothing
```

**Do both halves of the module-count check** — the arithmetic and the bundle search. 180 is now within
one of a legitimate count, so the number alone decides nothing; `CLAUDE.md` §4 records why the old
"a jump to ~180 is the regression" shorthand is spent.

#### What must NOT happen in step 6

- **Never `git commit -a` or `git commit -am`** while any harness path is in the tree. Stage by path.
  After the removal the tree should be clean, and staging by path is still the habit every harness
  step in 2c-4b and 2c-4c has kept.
- **Do not regenerate `manifest-2c-4c-4a-post.sha256`** — it is a partial-verify artifact by design,
  and 5b-3's §1.3 states its 54-OK/1-FAILED comparison as a current result.
- **Do not "fix" the with-harness figures into the production ones by editing this file.** Measure.
- **Do not reopen step 5.** Its record and its three reviews are final unless a round 4 is
  commissioned against the one claim the 5b-3 section names as challengeable.

#### What step 6 owes as evidence, and what it does not

It changes **no tracked source file** except returning two files to what `HEAD` already holds, so **no
window reading and no mounted test is owed** — the same disposition 2c-4b-3d-3 had. Its evidence is
the four re-derived gate figures and an empty `git status --short --untracked-files=all`.

**A Codex round on the step's record is owed and is not optional.** Twelve consecutive rounds in this
phase have found a narrower instance of what the round before them closed, and the last two were
instances **the fix round itself created**. Sweep for what the record now says, not for the words an
older finding used. Write the record as `docs/decisions/2c-4c-6-notes.md` and the review as
`docs/reviews/phase-2c-4c-6.md`, following 2c-4b-3d-3's pair. The commit then holds the record, the
review and this checkpoint — and **closes Phase 2c-4c**.

---

### ⚠️ HISTORICAL — the 5b handoff, kept because 5b-1's and 5b-2's measurements are what step 6 must not disturb

**5b is complete in all three parts.** What follows is the handoff as written between them; its 5b-1
and 5b-2 subsections are the measurement and the fix as recorded, and its "5b-3 is what remains"
subsection is **fully discharged** — see the marker on it below.

**5b was cut in three by the orchestrator** — 5b-1 the instrument extension and the measurement, 5b-2
the fix and its re-measurement, 5b-3 the reading record's rewrite and the Codex rounds that judged it
(**two of them, not one**). The cut exists because the round's first owed item (*judge the overlap*)
turned out to be a defect in the application rather than a defect in a sentence, which is the first
time that has happened in this phase.

#### 5b-1 is complete, and what it measured

`docs/decisions/2c-4c-5b-1-instrument.md` is the record. `src/probe.ts` gained
`reportRecoveryGeometry()`, called from `driveRecoveryForm` **before** any control is typed into or
pressed: the `section.recovery` **next element sibling** found structurally, that sibling's box and
first control, the section's children with their boxes and combined extent, the scroller's
`scrollTop`/`scrollHeight`/`clientHeight` with `reportReach`'s restore discipline kept, a
`document.elementFromPoint` hit test of every form control with six named cases, and the computed
`display`/`overflow`/`flex`/`min-height`/`height` of the section, its layout parent and its
`offsetParent`.

**Eight launches, P54–P61** — `editor-recovery-create`, `editor-recovery-refused`,
`editor-recovery-conflict`, `creator-recovery-create`, each in both languages. The orchestrator
re-derived the four-part conjunction from the artifacts rather than taking the worker's report: **one
`--- end`, no `--- failed`, a zero-byte `probe.err` and `bytes=MATCH` on all eight.**

**The numbers, and they are not ambiguous:**

- `section.recovery` computes to `flex=0 1 auto minHeight=0px height=0px` — a **zero-height** border
  box — while its ten children lay out over an extent of **1001–1035 px**.
- Its layout parent (`section.matchEditor` / `section.matchCreator`) is itself a compressed flex
  column: `height=579.94px` against roughly 1800 px of content.
- So the section contributes **nothing** to that flow and its next sibling — the host outcome panel,
  `div.panel[role="status"]`, holding the live conflict — is placed **7 px below the section's top**
  instead of below its content: `658,165,491x1032` (en editor), `658,181,491x1094` (es editor),
  `658,182,491x829` (en creator), `658,199,491x873` (es creator). **The recovery form's content and
  the conflict panel occupy the same vertical band.**
- The hit test is the consequence, and it is why 27 earlier launches passed over this. At the only
  recovery control whose centre lay inside the 728-px viewport — *Stop creating this snippet* /
  *Dejar de crear este fragmento*, box `967,158,182x27` — `document.elementFromPoint` returned
  `div.panel[role="status"]`, **not the button**, in **all eight** launches. The driver presses with
  `HTMLElement.click()`, which bypasses hit testing, so every earlier programmatic press succeeded
  against a control a pointer could not have reached.

**The root cause is one property**, `min-height: 0` on `.recovery` (`RecoveryPanel.svelte:808`): it
removes the automatic minimum size that would otherwise floor a flex item at its min-content height,
so the item collapses to zero inside a parent that is already compressed while its children overflow
visibly over the sibling below. The same declaration on the six write surfaces' own outermost
sections is the **legitimate** scroller idiom and must not be touched — `.recovery` is the only
nested instance.

**What this means for the phase**: `RecoveryPanel` is drawn on the editor and the creator only, and
those are exactly the two surfaces where 2c-4c's recovery **form** can be opened at all. So the
phase's central deliverable was covered by the panel below it on every screen that can reach it.

#### 5b-2 is complete, and the fix is one deleted declaration

`docs/decisions/2c-4c-5b-2-notes.md` is the record. **`min-height: 0` is deleted from `.recovery`**
in `src/lib/components/RecoveryPanel.svelte`, restoring `min-height: auto` so the section is floored
at its min-content height exactly as every other item of the host's column already is.
**`flex-shrink: 0` was rejected** — it forbids a legitimate shrink and would leave the misleading
declaration standing — and a comment now occupies the property's place recording why its **absence**
is load-bearing, because a later editor restoring the idiom would restore the defect.

**Twelve launches, P62–P73**, the four-part conjunction re-derived by the orchestrator on all twelve:
one `--- end`, no `--- failed`, zero-byte `probe.err`, `bytes=MATCH`.

- **The overlap is closed, and the arithmetic is exact.** The sibling now begins at
  **children-bottom + 7 px** — the column's own gap — on every surface and in both languages:
  `1159→1166` (en editor), `1210→1217` (es editor), `1176→1183` (en creator), `1227→1234` (es
  creator). Before the fix it began at **section-top + 7**.
- **`elementFromPoint` returns `isTheControl`** in all eight recovery launches. No `somethingElse`
  survives anywhere in P62–P69.
- **The ordinary path is unshifted**: `P70` and `P73` diff against their predecessors `P25` and `P26`
  to **the launch directory name alone**. `section.recovery` still measures `491x0` with
  `sectionText=""` when there is nothing to offer, so the empty case is unchanged.

Gates re-run by the orchestrator with the harness in the tree: `cargo test --workspace` **1112
passed, 0 failed**; `npm run check` **424 files, 0 errors, 0 warnings**; `npm test` **1768 passed, 51
files**; `npm run build` **181 modules**, with `svelte/internal/server`, `svelte/server` and
`async_hooks` all absent from the built bundle.

**A mounted test cannot close this defect and none was written that appears to.** jsdom performs no
layout — `getBoundingClientRect` returns zeros there — so no `RecoveryPanel.test.ts` case can
distinguish the broken CSS from the fixed CSS. The window measurement is the only evidence, which is
a sharper instance of this project's standing rule that a green suite is not a screen. Three further
bounds are recorded and must survive into 5b-3: `elementFromPoint` reports **paint order at a point,
not event delivery**; six of the seven form controls were still `outsideViewport` at the sampled
scroll position and were **not** hit-tested, so the verdict rests on one control per launch; and the
creator's host outcome panel measures 812/890 px after against 829/873 before, which is **bimodal
across pre-fix launches too** (P33 already measured 812, P34 already measured 890 with the old CSS)
and is therefore not attributed to the fix — **cause unexplained**, recorded rather than resolved.

#### ⚠️ DISCHARGED — 5b-3 as it was briefed, and the one instruction below that turned out to be wrong

**5b-3 is complete.** Everything this subsection asks for was done, and it took **two** Codex rounds,
not one. **Its first instruction was wrong and must not be followed again**: it asks for *M2
reclassified as a confirmed High*, and round 2 rejected exactly that — the retained evidence is a
centre-point paint test on **one** control per launch, which cannot establish pointer unreachability,
and the record's own §8.16 and §8.17 withhold that guarantee. **M2 is a Medium.** The geometry defect
itself was never in doubt; the severity was. The closing verdict is the 5b-3 verification section
above.

The reading record's rewrite: **M2 reclassified as a confirmed High that reached a screen and was
fixed** *(⚠️ this is the wrong instruction named just above — the outcome was Medium)*, plus the review's two prose Highs (post-images upgraded into construction chronology; final
bytes and backups upgraded into intermediate write history), its Medium (`revealOutcome` credited
with a movement `reveal.ts:57-82` defines as an unobservable request), its Low (judge L3 — Codex
argues Observation; do not simply accept it), and **§8's three missing bounds**. Then Codex round 2,
which is not optional: **ten consecutive rounds in this phase have found a narrower instance of what
the round before them closed.** Sweep for what the record now says, not for the words the old
finding used.

**The three bounds §8 is missing** are named by the review's last verified observation, and they are:
the **unretained construction chronology** the record nevertheless claims; the **inability to
attribute a sampled scroll position to an honoured reveal request**; and — now discharged by 5b-1 and
5b-2, so it becomes a statement of what was found rather than a gap — that the open-form launches
before P54 **did not remeasure the still-rendered following host outcome** and could not test pointer
hit-testing. Add the two bounds 5b-2 recorded beside them: `elementFromPoint` is paint order at a
point and not event delivery, and six of the seven form controls were `outsideViewport` at the
sampled scroll position, so the verdict rests on one control per launch.

**The exact next command as briefed** *(⚠️ done — the record is now 1296 lines, not 799; the live
handoff is step 6 at the top of this section)*:

```sh
wc -l docs/decisions/2c-4c-5-window-reading.md      # 799 lines — the record to rewrite
cat docs/reviews/phase-2c-4c-5-reading.md           # 52 lines — read the review BEFORE the record
```

Then delegate the rewrite to a worker, and commission Codex round 2 as
`docs/reviews/phase-2c-4c-5b-record.md`. **No new launch is required by 5b-3** — P54–P73 are the
evidence, and their conjunction was re-derived from the artifacts by the orchestrator at both steps.
*(What happened: round 2 was commissioned to that path and returned NOT READY on two Highs, and a
**round 3** — `docs/reviews/phase-2c-4c-5b-record-round3.md` — was then commissioned and returned NOT
READY on one Medium. No new launch was made.)*

**Step 6 — the harness removal — still must not run until 5 closes** *(step 5 is now closed; step 6 is
the live handoff at the top of this section)*, and the four harness paths (`src/probe.ts`,
`src-tauri/src/probe.rs` untracked; two hook lines each in `src/main.ts` and `src-tauri/src/main.rs`)
must never be committed. Stage by path; never `git commit -a`. Step 6 also re-derives the production
gate counts on a harness-free tree; the figures above are **with-harness** (`1112 / 424 / 1768 / 181`)
and production is `1112 / 423 / 1767 / 180`.

---

### ⚠️ HISTORICAL — the step-5 handoff as written before 5b-1 measured M2

**Fully discharged. All six of its items are done** — items 1 and 2 by 5b-1 and 5b-2, items 3, 4, 5
and 6 by 5b-3 — and it is kept because its statement of round 1's findings, and its "What must NOT
happen" list, are the record of what step 5 was handed. **Its item 2 was answered "a genuine defect
that reaches a screen", and its severity settled at Medium, not High** (round 2). Nothing in it still
binds a future session except the two prohibitions in "What must NOT happen" that outlive step 5:
never `git commit -a` while a harness path is in the tree, and do not regenerate
`manifest-2c-4c-4a-post.sha256`.

### **Step 2c-4c-5 is TAKEN but NOT CLOSED. The next action is its fix round, `2c-4c-5b`, and it needs an instrument extension.**

The reading is `docs/decisions/2c-4c-5-window-reading.md` (799 lines). Its Codex round 1 is
`docs/reviews/phase-2c-4c-5-reading.md` — **NOT READY, three Highs, one Medium, one Low**. That file
was recovered verbatim from the job's rollout payload because the job ran read-only and its
`apply_patch` was rejected; the provenance is stated in its header. **Read the review before the
record.**

#### The launches happened and their evidence stands

**27 launches, P27–P53**, in `/private/tmp/espansoconfig-harness-2c-4c/launches/`. Every one reached
`--- end` with a zero-byte `probe.err`, none printed `--- failed`, and **all 27 report
`bytes=MATCH`** — re-derived by the orchestrator from the artifacts, not taken from the worker's
report. Thirteen compared against an authored expected-bytes document and fourteen against a fixture
the case must leave unchanged. `editor-recovery-create-expected.yml`, the fifth prediction fixture,
matched on its first launch **in both languages**. Codex verified the conjunctions independently and
confirms **4b's aggregate language hole is closed**: all six surfaces have at least one English and
one Spanish launch. **None of that is in dispute, and a fix round must not re-run it.**

#### ⚠️ High 1 is a defect in the record, and the orchestrator verified it in the code

The record's §3.2 classifies **M2** — `section.recovery`'s `491x0` border box — as *latent, inferred,
never constructed*, on this premise: *"In every state this reading reached that value is `null` — the
reapply that opens recovery is what cleared it."*

**That premise is false, and the check is three lines of source:**

- `conflictOf()` in `src/lib/browser/matchEditor.ts:1078` is `return conflictArm(session.outcome)` —
  a conflict is **read out of** the outcome, so a session showing one has `outcome !== null`.
- `describeEditSave` sets that outcome for **every** non-saved result, conflicts included
  (`matchEditor.ts:1522`, and the `result.outcome !== 'saved'` arm at `:1525–1530`).
- Both creating hosts draw the host outcome panel as the sibling **immediately after**
  `<RecoveryPanel>`, gated on exactly that value: `{#if view.outcome !== null}` at
  `src/lib/components/MatchEditor.svelte:910`, and `MatchCreator.svelte:779–795`.
- `attemptOfReapply` (`src/lib/browser/reapply.ts:540–547`) returns the **held** session unchanged for
  `manualResolution`, which is the arm P27–P34 all printed. It clears nothing.

**So the sibling-overlap state was constructed in eight launches — P27 through P34 — and the
instrument did not measure it.** M2 is not latent. What is unknown is whether the overlap is
*visible*, and no retained artifact answers that: no launch measured the host outcome panel's
rectangle while the recovery form was open, and `HTMLElement.click()` bypasses hit testing, so every
programmatic press succeeding is **not** evidence a person could reach those controls.

#### What the fix round owes

1. **The instrument extension, and it is a deliberate exception to "step 5 is a reading, not
   construction."** The geometry judgement is step 5's whole deliverable and it cannot be made from
   the retained artifacts. Extend `src/probe.ts` to report, while the recovery form is open: the host
   outcome panel's rectangle, the recovery form's own content rectangles, and the scroller's
   `scrollHeight`/`scrollTop`. **Rebuild in 4a §3's order — `npm run build`, `touch
   src-tauri/build.rs`, `cargo build -p espansoconfig --features custom-protocol`** — `npm run build`
   alone changes nothing. Then re-launch the eight editor/creator recovery cases in **both**
   languages, continuing the ledger at **P54**.
2. **Judge the overlap on that evidence** and reclassify M2 — it may be a genuine High that reaches a
   screen, the first in this phase, or it may be harmless once measured. Do not pre-decide it.
3. **The other two Highs and the Medium are prose**, and each is this project's named worst defect
   class: post-images upgraded into construction chronology (*"first launch"*, *"no probe source was
   edited"*, *"no rebuild"*, *"the gates were re-run"* — none retained in any artifact); final bytes
   and backups upgraded into intermediate write history, which **contradicts the record's own §8.3**;
   and `revealOutcome` credited with moving the pane when `reveal.ts:57–82` defines `scrollIntoView`
   as a silent request whose honouring a caller cannot observe. Narrow each to what is retained.
4. **The Low**: Codex argues L3 is at most an Observation — the unavailable sentences give advice and
   never promise a verbatim control label. Judge it; do not simply accept it.
5. **§8 is incomplete** and must gain the three bounds the review names.
6. **A second Codex round is not optional** — a fix is a change, and **nine consecutive rounds in this
   phase have found a narrower instance of what the round before them closed.** Sweep for what the
   record now says, not for the words the old finding used.

#### What must NOT happen

- **Step 6 — the harness removal — must not run until step 5 closes.** The fix round needs the tree,
  and the extension needs the probe sources.
- **Never `git commit -a` or `git commit -am`.** Four harness paths are in the working tree; stage by
  path. `src-tauri/src/probe.rs` and `src/probe.ts` are untracked and must stay that way.
- **Do not record hole 1 as measured.** `browser.notice.gone`'s second producer
  (`repairSelection`'s `clearSelection` arm, `src/lib/browser/selection.ts:292`) is untouched, and
  the review confirms §8.1 bounds it honestly today. Keep that wording.
- **Do not regenerate `manifest-2c-4c-4a-post.sha256`** (a partial-verify artifact by design).

#### The gates, re-derived by the orchestrator **with the harness in the tree**

```sh
cargo test --workspace   # 1112 passed, 0 failed
npm test                 # 1768 passed, 51 files
npm run check            # 424 files, 0 errors, 0 warnings
npm run build            # 181 modules
```

All four were run by the orchestrator after the reading, not copied from the worker, and the built
bundle was searched for `svelte/internal/server`, `svelte/server` and `async_hooks` — **none
present**. **These are with-harness figures and must never be carried forward as production
numbers**; production is `1767 / 423 / 180 / 1112`, and step 6 re-derives them on a harness-free
tree. Note the review's third High applies here too: no gate transcript is retained, so the record
may claim these figures **were produced**, not that they were produced after the last edit.

---

### ⚠️ HISTORICAL — the step-4b handoff, kept because its provenance limits still bind

**Step 4 was split in two by the orchestrator**, the way step 3 was, and for the same reason: 4a had
to rebuild **both** halves of the harness from prose, which 3d-2a never had to do. The consult's
six-step cut is unchanged. **The instrument is now finished** — 4a built it, 4b gave it the recovery
cases — so step 5 launches and judges, and step 6 deletes.

#### What 4b built, in the sentences step 5 needs

The construction record is `docs/decisions/2c-4c-4b-instrument.md`; its **§11 is written for step 5**
and names the tree, the case list and the rebuild order. Read that section first.

1. **`section.recovery`-scoped driving.** The form has status panels of its own, and an unscoped
   `[role="status"]` sweep would conflate them with the host surface's. Codex verified the scoping
   holds and that no selector escapes it.
2. **Recovery reporting is keyed to the element**, never to a display string —
   `RECOVERY_WITHOUT_CREATION_ATTRIBUTE` carries the reason the component itself derived. What that
   closes is the cheaper failure: a host that re-inlined the paragraph and did **not** stamp the
   attribute. A host that re-inlined it *and* stamped it would read identically (§10.5).
3. **A fourth probe command, `probe_third_writer` over `ECFG_PROBE_R2`.** A recovery form drafts
   against the disk revision R1 already produced, so re-running the second writer cannot conflict it.
   Inert without the variable, and harness-confined.
4. **The recovery cases are** `editor-recovery-create`, `editor-recovery-refused`,
   `editor-recovery-conflict` and `creator-recovery-create`; **the reload cases** are
   `creator-reload`, `deleter-reload-gone`, `mover-reload-gone`, `duplicator-reload-gone` and 4a's
   `editor-reload-gone`.

#### ⚠️ What step 5 owes, and what 4b explicitly does not give it

- **Both languages on all six surfaces.** 4b's coverage is still **aggregate**: the editor and the
  creator were each launched in both, but the deleter and duplicator only in English and the mover
  and raw editor only in Spanish.
- **A judgement on the geometry, which 4b measured and refused to judge.** `section.recovery` reports
  a **zero-height bounding rect** in every launch that measured it, while its children lay out
  normally, and the four recovery-without-creation paragraphs sit at **`y = -14/-15`** on three
  surfaces. That is a measurement; whether a person can read or reach it is step 5's call.
- **Nothing in 4b is a window reading.** No launch judged whether anything could be read, reached or
  understood, and **a transcript cannot fail because a sentence is untrue** — the harness prints the
  strings the panels drew, and a false one prints exactly as well as a true one. The byte comparison
  is the harness's only independent evidence (§10.2).
- **Seventeen of the thirty-one case-table rows have never been launched by any step of this phase**,
  and 4a's six are a subset of 4b's fourteen. **A case-table row is not evidence** (§10.9).
- **R38 is untouched**: none of the fifteen corpus fixtures `CLAUDE.md` §4 lists has been through this
  harness, and the fixture shape is still the easy one — LF, no BOM, no block scalars, no
  item-owned comments, one sequence.
- **There is still no invoke spy and no command counter**, so *the refused create issued exactly one
  command* and *the reload wrote nothing* are **not** established; what P19 shows is a final
  filesystem state equal to R2 with no backup directory (§10.3).

#### Hole 1 is the one item of 4b's brief that is NOT closed, and it is argued rather than measured

`browser.notice.gone`'s second producer — `repairSelection`'s `clearSelection` arm
(`src/lib/browser/selection.ts:292`) — was not reached. §5 of the record gives the five-link chain in
the code: `select()` is its only production caller, it mints the `MatchId` from the projection the
window already holds, so the revision always agrees and the boundary answers `identityStaleRevision`
→ `reresolve`, which is the **other** producer. All four reload launches drew the notice from that
length arm (§6.4).

**Do not record this as measured.** The record states its own limit and step 5 must keep it: *no
launch attempted it, and no launch could have distinguished "unreachable" from "not attempted."*
What would close it is a probe command handing `select()` a `MatchId` this window did not mint — which
is instrumenting the model rather than driving a window, and is a different kind of instrument. That
is named as the cost, not proposed.

#### Five expected-bytes fixtures are predictions, not measurements

4a's four — `editor-fallback-expected.yml`, `mover-reordered-expected.yml`, `mover-after-expected.yml`,
`mover-end-expected.yml` — are unchanged, and `editor-recovery-create-expected.yml` joins them: its
plan arm and case row exist, and it was not launched because P18 exercises that plan through its
refusal ending and P17 exercises a create. **Read a `bytes=DIFFER` on any of the five as a suspect
fixture first**, not as an application defect.

#### What 4b's review cost, and the lesson

One round, two findings — **a High and a Low, both prose**, and Codex faulted neither the instrument
nor the application: it verified the scoping, the structural keying, the third writer's confinement
and hole 1's accuracy. The High was the record upgrading a **post-image** into first-attempt,
authorship and chronology guarantees ("matched on the first launch", "never compared", "every gate ran
after the last edit and nothing has changed since"). **The fix round's own post-fix sweep found a
fifth instance the review had not named, and the first draft of one narrowing introduced a sixth**
— *"no launch was discarded from `launches/`"*, which a post-image cannot witness — removed within the
same round. That is the **ninth consecutive round in this phase where a fix produced a finding**.
The disposition is at the foot of `docs/reviews/phase-2c-4c-4b-instrument.md`.

**The Low is closed in the record and deliberately left standing in the review**: the record now says
`$HOME`, and the review keeps the literal because a finding has to name the string it is about — which
also matches 44 existing `docs/reviews/` files, where Codex output is kept verbatim by standing
convention.

---

#### ⚠️ The harness is in the working tree and MUST NOT be committed

`git status --short --untracked-files=all` right now lists **four harness paths**, and the checkpoint
commit for 4b stages `PROGRESS.md` and the two `docs/` files **by path** and nothing else:

```
 M src-tauri/src/main.rs      ← two hook lines
 M src/main.ts                ← two hook lines
?? src-tauri/src/probe.rs     ← untracked, 194 lines (152 at 4a; 4b added the fourth command)
?? src/probe.ts               ← untracked, 1598 lines (981 at 4a)
```

**Never `git commit -a` while these are in the tree.** Step 5 reads with them, and **step 6 deletes
them and re-derives the production gate counts**.

**The scratch tree is `/private/tmp/espansoconfig-harness-2c-4c/`** — `launch.sh` (a 31-row case
table with an `R2` column), `fixtures/` (**24**), `launches/P01…P26/`,
`manifest-2c-4c-4a-post.sha256` and `manifest-2c-4c-4b-post.sha256` (**55** entries, all verify).
Steps 5 and 6 both need that path. **4a's manifest was deliberately not regenerated and now reports
three failures** — the three files 4b edited; see the record's §7.2 before treating that as damage.

#### The gates, re-derived by the orchestrator **with the harness in the tree**

```sh
cargo test --workspace   # 1112 passed, 0 failed    ← unchanged by the harness
npm test                 # 1768 passed, 51 files    ← with-harness; production is 1767
npm run check            # 424 files, 0 errors      ← with-harness; production is 423
npm run build            # 181 modules              ← with-harness; production is 180
```

**These are with-harness figures and must never be carried forward as production numbers** — that is
the defect 2c-4b-3d-3 found and fixed. Step 6 re-derives `1767 / 423 / 180 / 1112` on a harness-free
tree. The `+1` on each frontend gate is `src/probe.ts`: one new `.ts` module, no styles, and the
per-source-file `it.each` scanners add its row. **4b added no module**, so the numbers are 4a's.

#### Privacy, verified rather than assumed

No launch artifact contains any path under `$HOME`; the real espanso config directory is untouched;
no `.espansoconfig-backups` exists outside the launch trees. Every fixture is neutral — `:alpha`,
`:beta`, `:gamma`, `:probe` and nothing else. **A decision record is a public-repository artifact and
must say `$HOME` rather than spelling the owner's home path**; that was 4b's Low finding.

---

### ⚠️ HISTORICAL — the step-4a handoff, kept because its provenance limits still bind

#### What 4a established, and the one thing it got wrong

**Twelve launches, all twelve with a zero-byte `probe.err`, one `--- end` each, no `--- failed`,
`bytes=MATCH` on all twelve.** P07–P12 are the proof set — `editor-exact`, `creator-front`,
`deleter-exact`, `mover-exact`, `duplicator-exact`, `raw-negative`, one per write surface. P01–P06 are
the same six pairings on the pre-`cargo fmt` binary, retained. The two binaries are pinned by a
`binary=` digest in each launch's `bytes.txt`.

**Source-to-binary provenance is unknown and the record now says so.** No build transcript was
retained and `launch.sh` copies whatever `ECFG_BINARY` names without checking a timestamp, so the
strongest true statement is that P07–P12 ran an executable whose digest matches the one now at
`target/debug/espansoconfig`. *A tree rebuilt from the records reaches all six surfaces* is *not*
available — it conjoins source inspection with a byte measurement. Codex's High was exactly this, in
three passages.

**The language coverage is aggregate, not per-surface.** English for the editor, deleter and
duplicator; Spanish for the creator, mover and raw editor; **no surface was launched in both**. Step 5
is what owes both languages on every surface.

#### ⚠️ What the 4a review changed about step 4b's scope — read this before writing a plan function

4a's record originally said *nothing about recovery is in this instrument*. **That was false**, and the
review found it by tracing the mounts rather than reading the case table. Verified directly in the
components: `MatchDeleter.svelte:548`, `MatchMover.svelte:815`, `MatchDuplicator.svelte:708` and
`RawEditor.svelte:541` mount `RecoveryWithoutCreation` **unconditionally**, handing it the live
`view.conflict` — so **P09–P12 already drew a recovery sentence**. `MatchEditor.svelte:908` and
`MatchCreator.svelte:791` mount `RecoveryPanel` from their reapply outcome and retained conflict.

So 4b does **not** add recovery reach. It adds **reporting and activation**, and its scope is these
three things:

1. **Targeted reporting of `[data-recovery-without-creation]`** on the four non-creating surfaces. The
   driver today reads only the non-reapply status panel and then `[role="status"]` blocks
   (`src/probe.ts:367`, `:379`, `:486`, `:506`), so that element never enters a transcript. Look for
   the **element**, never a string — `RECOVERY_WITHOUT_CREATION_ATTRIBUTE` carries the reason the
   component itself derived, which is how a host that re-inlined the paragraph is caught.
2. **Targeted reporting and activation of the editor's and creator's recovery offer** — assert it,
   then press it. No launch has ever done either.
3. **A `.recovery`-scoped driver for the opened form**, through its own create / refusal / conflict /
   reload outcomes. **The scope is load-bearing**: that form has status panels of its own, and an
   unscoped `[role="status"]` sweep would conflate them with the host surface's.

Plus the expected-byte fixtures a recovery create needs — placement is a fixed `RECOVERY_POSITION` of
`End`, with no chooser, and the trigger is an **editable literal**, never auto-suffixed.

#### Also owed, and 4b is the natural place — the five holes 2c-4b left

`2c-4b-3d-3-notes.md` §4.1's list, unclosed by 4a: `browser.notice.gone`'s second producer
(`repairSelection`'s `clearSelection` arm, `src/lib/browser/selection.ts:292`), and the
**confirmed-reload** transition on the creator, the deleter, the mover and the duplicator. This tree
has a reload case on **one** surface — `editor-reload-gone`, rebuilt from 3d-2a §8.3 — and it was not
launched. Adding the other four costs a plan function each, not a launch.

#### Four un-launched expected-bytes fixtures are predictions, not measurements

`editor-fallback-expected.yml`, `mover-reordered-expected.yml`, `mover-after-expected.yml` and
`mover-end-expected.yml` were authored from the records' *Expected afterwards* columns and have never
been compared against anything. **Read a `bytes=DIFFER` on an un-launched positive as a suspect
fixture first**, not as an application defect. The five that did match are the reason to expect these
to — including `creator-front-expected.yml`, the one derived from `choose_scalar`/`render_item` rather
than from byte preservation, which matched byte-for-byte.

#### The gates, re-derived by the orchestrator **with the harness in the tree**

```sh
npm test           # 1768 passed, 51 files    ← with-harness; production is 1767
npm run check      # 424 files, 0 errors      ← with-harness; production is 423
npm run build      # 181 modules              ← with-harness; production is 180
cargo test --workspace   # 1112 passed, 0 failed    ← unchanged by the harness
```

**These are with-harness figures and must never be carried forward as production numbers** — that is
the defect 2c-4b-3d-3 found and fixed. Step 6 re-derives `1767 / 423 / 180 / 1112` on a harness-free
tree. The `+1` on each frontend gate is `src/probe.ts`: one new `.ts` module, no styles, and the
per-source-file `it.each` scanners add its row.

**The bundle was searched as well as counted**, per `CLAUDE.md`'s ladder warning: `internal/server`,
`svelte/server` and `async_hooks` are all absent from `dist/assets/index-*.js`, and the search is live
(495 `svelte` hits in the same file). Do both, never the number alone.

#### Privacy, verified rather than assumed

No launch log contains any path under `/Users/ccarpio/`; the real espanso config directory is
untouched; no `.espansoconfig-backups` exists outside the launch trees. Every fixture is neutral —
`:alpha`, `:beta`, `:gamma`, `:probe` and nothing else.

#### What 4a's review cost, and the lesson

One round, five findings, **none of them a defect in the instrument**. All five were prose in the
record, and the fix round changed no executable line. **The orchestrator's own fix then wrote a count
larger than the work it described** — "four places" where three passages had been narrowed — caught by
the standing post-fix sweep and corrected before the commit. That is the **eighth consecutive round in
this phase where a fix produced a finding**, and the first where the fix and the finding were the same
person's. The disposition is at the foot of `docs/reviews/phase-2c-4c-4a-instrument.md`.

---

### ⚠️ HISTORICAL — the step-3b handoff, kept because its items 2 and 3 still bind

**Step 3 was split in two by the orchestrator and both halves are done.** The consult's six-step cut
is unchanged. 3a built the shared panel, its strings and the two surfaces that can create; 3b drew
the four that cannot. **The consult's step-3 matrix is now complete on all six surfaces**, its
positive half proved at 3a and its negative half at 3b.

#### What 3b left, in the sentences step 4 needs

1. **`src/lib/components/RecoveryWithoutCreation.svelte` is the second recovery renderer, and there
   are exactly two.** `RecoveryPanel.svelte` draws the form on the two surfaces that create;
   this one draws one sentence on the four that cannot, and **owns the decision to draw it** — a
   host mounts it unconditionally and carries no condition about the sentence. It exports
   `RECOVERY_WITHOUT_CREATION_ATTRIBUTE` and stamps the derived reason onto its paragraph, which is
   how each host's suite proves the **mount** rather than the words. A window plan that expects a
   recovery sentence should look for that element, not for a string.
2. **`recoveryAvailability` asks `conflict === null` first**, as of 3b. Before it, the four
   non-creating surfaces answered `operationDraft`/`wholeDocumentDraft` whatever was happening, so
   drawing them at all would have put a permanent paragraph about a disk version on a screen where
   none was in dispute. Codex verified the reorder with a **complete disagreement matrix** (round 1
   of `docs/reviews/phase-2c-4c-3b-code.md`, "Verified without findings"): with a conflict nothing
   changes for any surface; without one the two creating kinds move from `notFromManualResolution`
   to `noConflict`, and both are refusals no screen draws. **Do not re-litigate the ordering.**
3. **The route check stands above the reapply check and that is load-bearing.** The raw editor's
   `reapplySupport` is `unavailable`, so it can never produce a `manualResolution`; an entry
   condition written on one would silence its sentence permanently. `recoveryWithoutCreation` passes
   a null attempt and two empty lists precisely because the route check returns first, and
   `recovery.test.ts` pins that rather than asserting it.
4. **No dictionary key was added or changed at 3b.** The two sentences it draws —
   `browser.recovery.unavailable.operationDraft` and `.wholeDocumentDraft` — are 3a's, in both
   languages, and each names the truthful next step for its surface.

#### The gates, re-derived by the orchestrator on the working tree at the 3b commit

```sh
npm install                    # required first in a fresh clone; node_modules/ is gitignored
cargo test --workspace         # expect 1112 passed, 0 failed
npm test                       # expect 1767 passed, 51 files
npm run check                  # expect 423 files, 0 errors, 0 warnings
npm run build                  # expect 180 modules
```

**⚠️ 180 is exactly the old "the Svelte server build leaked in" shorthand, and at 3b that shorthand
stopped being usable.** A legitimate count now sits on it. The arithmetic is 178 + 2 for one new
**styled** component, verified by deleting the `<style>` block (179) and restoring it; and the built
bundle was independently searched for `internal/server`, `svelte/server` and `async_hooks`, none
present. **Do both checks, never the number alone.** `CLAUDE.md`'s ladder carries this rung and the
warning.

The test count is off by more than your own cases whenever a file is added under `src/lib/browser/`
or `src/lib/components/`: three per-source-file `it.each` scanners add rows. At 3b that was the whole
of 1764 → 1767. Expect it; do not hunt it.

#### What 2c-4c-3b's review cost, and the lesson worth carrying

Two rounds. Round 1 returned **NOT READY** on one High — the four hosts each deciding independently
whether to draw the sentence, which is the 2c-3c-3 failure mode reached through a *model function
that already existed*. **Centralizing which reason to draw did not centralize whether to draw it**,
and only a renderer can own the second. Round 2 confirmed the High closed and returned one Medium
that **the fix round's own record introduced**: a claim one scope wider than the work it described.
The full disposition is "Phase 2c-4c-3b review disposition" above.

**Six consecutive rounds on this phase have now ended with a fix producing the next round's
finding.** Do not treat a fix round as the end of a step, and read a fix round's record **against its
diff** rather than against the brief that commissioned it — round 2's Medium was the orchestrator's
own brief wording, copied into a record by a worker who had implemented something narrower.

#### ⚠️ HISTORICAL — what 3a handed 3b, kept for items 2 and 3, which still bind

**3b is done, so items 1 and 4 are discharged and item 1's headline is now false**: there are **two**
recovery renderers, not one — see "What 3b left" above. Items 2 and 3 are unchanged and bind every
remaining step of this phase.

1. ~~**`src/lib/components/RecoveryPanel.svelte` is the one recovery renderer**~~ — superseded at 3b.
   It is one of two: the form renderer, driven by `recoveryView()`, used by the two hosts that
   create. 3b's four surfaces were the ones `recoveryAvailability` answers **`unavailable`** for —
   `operationDraft` for the deleter, mover and duplicator, `wholeDocumentDraft` for the raw editor —
   and they draw a reason through `RecoveryWithoutCreation.svelte`. The sentences are
   `browser.recovery.unavailable.operationDraft` and `.wholeDocumentDraft`, both languages, both
   written to name the truthful next step.
2. **`sendRecoveryCreate` takes a required third argument, `InstallTheWaitingForm`**, invoked with
   the waiting session **before** the request is authorized and never for a refused form. Any new
   call site must supply one; the type forces that, and forces this module to call it before
   sending. **It does not force the callback body to install the form anywhere a screen reads** —
   `() => {}` type-checks — and that limit is stated on the type itself. 3b should need no new call
   site at all, since none of its four surfaces creates.
3. **Every sentence about `sourceConflictState` names the act, never the outcome**, and all three
   arms now also disclaim knowledge of what the host draft holds now. Round 1's second High was
   exactly this claim; do not reintroduce it in a 3b sentence.
4. **The mounted matrix 3b owes** — **DISCHARGED at 3b.** It was the negative half of the consult's
   step-3 requirement: that the deleter, the mover and the duplicator offer **neither copy nor
   save-as-new**, that the raw editor offers **no save-as-new**, and that **the original conflict
   survives every non-committed ending** on each. 3a proved the positive half on the editor and the
   creator. Note what 3b learned about the last clause: the raw editor has only **two** reachable
   non-committed endings, its reapply being deliberately unavailable, and the three match surfaces
   have three.

#### ⚠️ HISTORICAL — the gates at the 3a commit, superseded by 3b's `1112 / 1767 / 423 / 180`

```sh
npm install                    # required first in a fresh clone; node_modules/ is gitignored
cargo test --workspace         # expect 1112 passed, 0 failed
npm test                       # expect 1744 passed, 51 files    ← superseded: 1767
npm run check                  # expect 422 files, 0 errors, 0 warnings    ← superseded: 423
npm run build                  # expect 178 modules              ← superseded: 180
```

**178 moved by three for two source files, and that is the expected reading, not a regression.**
`recovery.ts` became reachable from the entry for the first time (+1), `RecoveryPanel.svelte` is new
(+1), and **that component's `<style>` block is a module of its own** (+1). Measured, not inferred:
the block was deleted, the build came back 177, and it was restored. `CLAUDE.md`'s ladder is updated
with this. **The old shorthand for the regression — "a jump to ~180" — is now within one of a
legitimate count**, so check the bundle for `svelte/internal/server` rather than reading the number
(it is absent at 178). A new styled component now costs **two**.

The test count is off by more than your own cases whenever a file is added under `src/lib/browser/`
or `src/lib/components/`: three per-source-file `it.each` scanners add rows. Expect it; do not hunt it.

#### What 2c-4c-3a's review cost, and the one lesson worth carrying

Two rounds. Round 1 returned **NOT READY** on two Highs; round 2 confirmed the fix and found no High
and no Medium. Both records are `docs/reviews/phase-2c-4c-3a-code.md`; the step's own record is
`docs/decisions/2c-4c-3a-notes.md`.

**The lesson: all five gates were green when round 1 found both Highs, and neither was visible to
any of them.** 1744 tests, a mounted suite on every changed component, `svelte-check` clean. The
first High was a synchronous-ordering bug no model test drives — a double-click on *Create* sent two
writes against one base revision, and the late conflict could replace a committed answer, which is
the one thing this project forbids absolutely. The second was prose, and **the i18n suites check
parity and placeholders, never meaning**. A green suite is not a screen, and it is not a claim either.

**Round 2's only finding was a false sentence the round-1 fix had itself introduced** — the fifth
time this phase that a fix produced the next round's finding. Do not treat a fix round as the end of
a step.

#### Still owed by the phase after 3b

**2c-4c-4** rebuild the window instrument · **2c-4c-5** the bilingual window reading ·
**2c-4c-6** remove the instrument and re-derive the gate counts. Their scopes and the evidence each
owes are the table in the consult disposition above. **The window reading is owed for six surfaces**
and none of the evidence 3a or 3b produced is a reading of a screen — 3b in particular drew new
markup on four surfaces and, per the standing rule, **a window reading is re-taken after any change
to a component**. Step 4 judges the instrument, not the screen; step 5 is the reading.

---

### The step-2 handoff, kept because its prohibitions bind every remaining step

**The review round step 2 owed is DISCHARGED — do not run it again.** Rounds 5, 6 and 7 ran and are
recorded in **"Phase 2c-4c step 2 — the rounds 5–7 disposition"** above and in

**The review round step 2 owed is DISCHARGED — do not run it again.** Rounds 5, 6 and 7 ran and are
recorded in **"Phase 2c-4c step 2 — the rounds 5–7 disposition"** above and in
`docs/reviews/phase-2c-4c-2-code.md`. All three returned `NOT READY`; all four findings were prose,
contracts or test names; **no executable line changed and the bundle stayed byte-identical
(`index-C1846SS8.js`) throughout.** Read that disposition before touching `recovery.ts` — it says
what rounds 1–7 already ruled and **must not be re-litigated**, including the two things round 6
and round 7 affirmed as correct and not to be disturbed.

**Round 8 is judged not worth spending, and the reasoning is in that disposition's last section so
you can overrule it on evidence.** Round 7's fix is one doc-comment sentence that withdraws a claim.

**One thing came out of round 7 that is NOT step 3's to fix**, and it is now the fifth item on the
standing debt ledger: `browser.saveOutcome.reloadClosesSurface` promises *"Loading the version on disk
**moves this window to it**"* in both languages, and that clause is unverifiable when a satisfied
adoption answers `alreadyThere`. **It is already drawn on the match editor and the match creator**
(`MatchEditor.test.ts:1171`, `MatchCreator.test.ts:970`), so changing it obliges a **re-taken 2c-4a-3c
window reading**. Whether it is false at all is contested — the disposition records both readings.
`recovery.ts`'s capability contract already stops endorsing it; **step 3 must not quietly "fix" the
dictionary sentence while drawing its panel.**

**Dispatch every Codex round read-only-aware:** five of the seven rounds ran with the workspace
mounted read-only and could not append their own section. **Ask for the full section text in the
final message** and transcribe it, marking provenance — do not spend a job discovering the mount, and
do not let a transcription pass as Codex's own bytes.

The phase's cut, with the full five-question table and the six-step scope table, is "Phase 2c-4c —
consult disposition" above. The consult itself is `docs/reviews/phase-2c-4c-design.md`. **Read the
disposition first and the consult only for the step you are on** — the consult is 25 KB and a step
needs one section of it. Step 2's record is `docs/decisions/2c-4c-2-notes.md`; its **seven** review
rounds are `docs/reviews/phase-2c-4c-2-code.md`.

**⚠️ HISTORICAL — these were the numbers at step 2 and they are superseded.** The current gates are
`1112 / 1744 / 422 / 178`, at the top of this section. What follows is kept only because the
paragraph under it explains *why* 175 did not move at step 2, which is the fact that makes 178
readable now. (See "Verification — Phase 2c-4c step 2" above, where each was re-derived by the
orchestrator rather than accepted from a worker.)

```sh
npm install                    # required first in a fresh clone; node_modules/ is gitignored
cargo test --workspace         # expect 1112 passed, 0 failed
npm test                       # expect 1711 passed, 50 files
npm run check                  # expect 420 files, 0 errors, 0 warnings
npm run build                  # expect 175 modules
```

**`1711 / 420 / 175 / 1112` are the step-2 numbers.** Two of them carry a fact worth knowing before
you re-derive them:

- **175 must move to 176 in step 3, and if it does not, the components are not importing
  `recovery.ts`.** It stayed at 175 through step 2 because nothing reachable from the entry imports
  that module — it sits above `matchEditor.ts`/`matchCreation.ts` and the reverse edge would be a
  cycle — so the bundle is byte-identical to step 1's. This is the one step in this project where an
  unmoved module count is the *expected* reading of a new module.
- **The test count is off by two from anything you can attribute to your own cases**, because
  `scripts/lint/ipc-detail.test.ts` runs a per-source-file `it.each` and a new file in
  `src/lib/browser/` adds cases there. Expect it; do not hunt it.

#### What step 2 hands step 3, in the sentences step 3 needs

1. **`src/lib/browser/recovery.ts` is recovery as a value and nothing draws it.** `recoveryAvailability`
   is the **single producer** of both the choice list and the destination list, gated on
   `reapply.ts`'s `manualResolution` arm. The six field transfers go through `fieldIntent`, so
   **`None` is not `Some("")`** — an absent optional writes no key, an empty string writes an empty
   value. `RECOVERY_POSITION` is the only position value anywhere and it is a fixed `End`.
   `sendRecoveryCreate` composes `BrowserState.createMatch` through a callback: **no new command, no
   second writer.**
2. **`sourceConflictState` answers `retained | windowMoved | spent`, and it is deliberately coarse.**
   `windowWasReconciled` means *an adoption was spent or a re-read was ordered* — **not** that the
   projection changed, which this module cannot observe. It is recorded on `alreadyThere` as well as
   `installed`, on purpose. **Every sentence step 3 writes about it must name the act, never the
   outcome**; seven carriers had to be reworded in round 4 for exactly this, and any UI copy that
   says the window *moved* re-opens the finding.
3. **Nine transitions guard `closed` explicitly**, and the invariant case probes the produced closed
   form **plus four hostile ones the type permits and nothing produces**, each with its own adoption
   recorder. A tenth transition added in step 3 must be classified in the runtime-export partition or
   the case fails — which is the point — and if it reads outcome, reload or acknowledgement state it
   needs the guard too.
4. **Three capability booleans are still `false`** — the two reload/reapply offers and save-as-new —
   so the transitions exist and no control is drawn. **Step 3 flips them and draws, without inventing
   machinery.** That is the 2c-4a-2 → 2c-4a-3a trade this phase has now used twice.

#### What 2c-4c-3 must do

One recovery UI, i18n in **both languages through typed accessors** (`src/lib/i18n/codes.ts` — a
component renders a code by calling an accessor, never by building a key), and **mounted evidence per
changed component**: that the editor and the creator invoke recovery creation, that the deleter, the
mover and the duplicator offer **neither copy nor save-as-new**, that the raw editor offers no
save-as-new, and that **the original conflict survives every non-committed ending**.

It also owes the evidence **step 1's live behaviour change** never got: `NewMatchRepeatsLiteralTrigger`
already fires for ordinary `create_match` on the creator surface, with no mounted test and no window
reading behind it.

The prohibitions are unchanged and they bind the drawn controls now, not just the model: the name is
**_Create a new snippet from supported fields_**, never *Duplicate*, *exact copy* or *Keep my draft*;
the repeated-trigger sentence claims **risk only**, never espanso semantics (D2u); no `After`, no
numeric position, no reused old `MatchId`; no synthesized sequence; every write through
`save_document`; and a committed write is never afterwards reported as an error.

#### The remaining three steps, so the cut is visible from here

**2c-4c-4** rebuild the window instrument · **2c-4c-5** the bilingual window reading ·
**2c-4c-6** remove the instrument and re-derive the gate counts. Their scopes and the evidence each
owes are the table in the consult disposition above.

#### The rules that bind every step of 2c-4c

- **Three kinds of evidence per sub-phase** — model tests, a **mounted-component test**, and a
  **window reading**. A green suite is not a screen. Steps 1 and 2 owed only the first because
  neither changed a component; **step 3 is the first that owes the second**.
- **The harness is gone, so any reading costs a rebuild first** — that is why steps 4 and 5 are two
  steps. `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md` carries the fixtures' content, not just
  their descriptions.
- **Never `git commit -a` or `git commit -am` while probe files are in the tree.** Stage by path.
- **A fix is a change, and the round that reviews it is not optional.**

#### The five holes 2c-4b left behind, still open and still not defects

They have no case row in the (now removed) `launch.sh` and no arm in `runPlan`, so nothing could be
launched for them; each costs a fixture or a plan function **plus an instrument rebuild** before
there is anything to launch. **2c-4c-4 is the natural place to add them**, since it rebuilds the
instrument anyway — but they are not obligations of any 2c-4b record.

- **Hole 1 — `browser.notice.gone`'s second producer**: `repairSelection`'s `clearSelection` arm,
  `src/lib/browser/selection.ts:292`. Every reading of that sentence so far came from `reresolve`'s
  **length** arm (P43 en, P44 es).
- **Holes 2–5 — the confirmed-reload transition on the creator, the deleter, the mover and the
  duplicator.** It exists on all five match surfaces and has been launched on **one**, the editor.

#### The standing bound on every window reading this project has taken (R38)

**The fixture shape has always been the easy one** — plain `replace:` scalars, double-quoted
triggers, LF, no BOM, no block scalars, no item-owned comments, no read-only file. **None of the
fifteen corpus fixtures `CLAUDE.md` §4 lists has ever been through the harness, and the owner's real
configuration has never been opened by it.** The consult ruled that **2c-4c-5 closes only the shapes
directly relevant to recovery** — at least one CRLF-or-BOM fixture and one item-owned-comment or
block-scalar case — and that the full sweep stays open for a later gate. It is recorded, not absorbed.

---

### The record that opened step 2c-4c-2 (superseded by the above)

**Superseded.** Step 2c-4c-2 is complete; what it built and what binds the steps after it is the
section above. This is kept for the prohibitions it states, which still bind step 3's drawn controls.

### Step 2c-4c-1 is complete. **Step 2c-4c-2 — recovery as browser values — is next, and it draws nothing.**

The phase's cut, with the full five-question table and the six-step scope table, is "Phase 2c-4c —
consult disposition" above. The consult itself is `docs/reviews/phase-2c-4c-design.md`. **Read the
disposition first and the consult only for the step you are on** — the consult is 25 KB and a step
needs one section of it. Step 1's own record is `docs/decisions/2c-4c-1-notes.md` and its three
review rounds are `docs/reviews/phase-2c-4c-1-code.md`.

**The tree is clean and the gates are at these numbers** (see "Verification — Phase 2c-4c step 1"
above, where each was re-derived by the orchestrator rather than accepted from a worker):

```sh
npm install                    # required first in a fresh clone; node_modules/ is gitignored
cargo test --workspace         # expect 1112 passed, 0 failed
npm test                       # expect 1633 passed, 49 files
npm run check                  # expect 418 files, 0 errors, 0 warnings
npm run build                  # expect 175 modules
```

**`1633` is right and `1623` is the stale figure 2c-4b-3d-3 corrected. Do not "restore" 1623.**
The Rust figure moved 1086 → **1112** at step 1; `175` and `418` did not move and must not, because
step 1 added no frontend module and no frontend case.

#### What step 1 hands step 2, in the four sentences step 2 needs

1. **`NewMatch` now carries six fields**, not two: mandatory `trigger` and `replace` plus optional
   `label`, `word`, `left_word` and `right_word` — the same six `src/lib/browser/matchEditor.ts`
   drafts. `fields()` emits **only present** keys in one documented order, and **`None` is not
   `Some("")`**: an absent optional writes no key at all, while an empty string writes an empty
   value. The TypeScript mirror in `src/lib/ipc/types.ts` has all six, and a wire-contract test now
   compares the two property sets, so a typo in one optional key is a test failure rather than a
   silently dropped field.
2. **A repeated literal trigger is now refused once and committed on *Save anyway*, for ordinary
   `create_match` as well as for recovery.** That is correct and was required by the brief — exact
   repetition is a property of the candidate, not of the route that reached it — but it means **a
   behaviour change is already live on the creator surface with no mounted test and no window
   reading behind it.** It needed no component change because `refusalAcknowledgement` and
   `refusalChoices` (`src/lib/browser/rawSave.ts`) are verdict-driven and `MatchCreator.svelte`
   already renders the code through `tFindingCode`. **Steps 3 and 5 owe that evidence**; step 2 does
   not, because it still draws nothing.
3. **The finding claims risk and never semantics.** Its two sentences say the new snippet repeats
   trigger text another snippet in this list already writes, and that this application cannot
   determine how espanso will handle overlapping definitions. Never *invalid*, never *collision*,
   never which snippet wins, and never that a non-match is safe. Any sentence step 2 or 3 writes
   about it inherits that bound (D2u).
4. **`insertion_landings` in `crates/espansoconfig-core/src/patch/edit.rs` is the address authority**,
   and the reason it exists is worth carrying: the first version of this step derived the inserted
   item's position from candidate-sequence *length*, which is a guess about the batch's shape, and a
   legal insert-plus-remove batch made the finding fire against an existing item. **Ask the
   arithmetic that does the placement; do not re-derive it beside the engine.**

#### What 2c-4c-2 must do, and what it must not

Add, in `src/lib/browser/`, with **no `.svelte` change, no `ConflictChoice` member, no dictionary key
and no control drawn**: the shared recovery outcome/choice model, the six field transfer decisions,
destination selection, **fixed `End` placement with no chooser**, and the rule that **the source
conflict survives until a recovery create commits**. Compose the existing `BrowserState.createMatch`.

The precedent to follow is the one 2c-4a-2 → 2c-4a-3a established and this checkpoint has recorded
twice since: **an unoffered transition can be built and tested without drawing its choice, and that
is the right trade.** Step 3 then flips capability and draws, without inventing machinery.

Its evidence is model and workspace tests over **every** `manualResolution` obstacle from the five
surfaces, no eligible destination, another conflict, refusal/acknowledgement/retry, an uncertain
send, a failed adoption after a *known* commit, selection races — and **proof that no command is
called** by an operation-choice or a raw recovery.

The prohibitions that bite hardest here:

- **Opening recovery must not adopt the disk snapshot or close the source surface.** The
  `manualResolution` arm (`src/lib/browser/reapply.ts:236`) guarantees the projection, the selection
  and the one-shot authorization are all untouched. **That is the phase's strongest asset and
  spending it early throws it away.**
- **Never *Duplicate*, *exact copy* or *Keep my draft*.** The product reconstructs schema-supported
  fields and cannot promise source-byte preservation; *Keep my draft* is already reapply's control.
  Its name is **_Create a new snippet from supported fields_**.
- **No `MovePlacement` or `MatchId` draft is copied or saved.** They preserve no authored content,
  and `src/lib/browser/draftKind.ts` already refuses that false promise as a property of the value.
- **No `After`, no numeric position, no reused old `MatchId`, no guessed anchor.** Recovery has no
  trustworthy anchor by definition; placement is a fixed `End`.
- **No new sequence created, no other file chosen silently, no widening into file creation.**
- **Every write still goes through `save_document`**, there is no `force` flag, and a committed write
  is never afterwards reported as an error.

#### The remaining four steps, so the cut is visible from here

**2c-4c-3** one recovery UI, i18n in both languages through typed accessors, and mounted evidence ·
**2c-4c-4** rebuild the window instrument · **2c-4c-5** the bilingual window reading ·
**2c-4c-6** remove the instrument and re-derive the gate counts. Their scopes and the evidence each
owes are the table in the consult disposition above.

#### The rules that bind every step of 2c-4c

- **Three kinds of evidence per sub-phase** — model tests, a **mounted-component test**, and a
  **window reading**. A green suite is not a screen. Step 1 owed only the first because it changed no
  component, and **step 2 is the same**; the phase as a whole owes all three, and step 1's live
  creator-surface behaviour change is now part of what steps 3 and 5 must cover.
- **The harness is gone, so any reading costs a rebuild first** — that is why steps 4 and 5 are two
  steps. `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md` carries the fixtures' content, not just
  their descriptions.
- **Never `git commit -a` or `git commit -am` while probe files are in the tree.** Stage by path.
- **A fix is a change, and the round that reviews it is not optional.** Step 1 took three rounds and
  each one was earned: round 2 existed because round 1's fix went wider than its brief, and round 3
  because round 2's fix did the same. Both times the widening was **justified** and both times it
  introduced or nearly introduced something.

#### The five holes 2c-4b left behind, still open and still not defects

They have no case row in the (now removed) `launch.sh` and no arm in `runPlan`, so nothing could be
launched for them; each costs a fixture or a plan function **plus an instrument rebuild** before
there is anything to launch. **2c-4c-4 is the natural place to add them**, since it rebuilds the
instrument anyway — but they are not obligations of any 2c-4b record.

- **Hole 1 — `browser.notice.gone`'s second producer**: `repairSelection`'s `clearSelection` arm,
  `src/lib/browser/selection.ts:292`. Every reading of that sentence so far came from `reresolve`'s
  **length** arm (P43 en, P44 es).
- **Holes 2–5 — the confirmed-reload transition on the creator, the deleter, the mover and the
  duplicator.** It exists on all five match surfaces and has been launched on **one**, the editor.

#### The standing bound on every window reading this project has taken (R38)

**The fixture shape has always been the easy one** — plain `replace:` scalars, double-quoted
triggers, LF, no BOM, no block scalars, no item-owned comments, no read-only file. **None of the
fifteen corpus fixtures `CLAUDE.md` §4 lists has ever been through the harness, and the owner's real
configuration has never been opened by it.** The consult ruled that **2c-4c-5 closes only the shapes
directly relevant to recovery** — at least one CRLF-or-BOM fixture and one item-owned-comment or
block-scalar case — and that the full sweep stays open for a later gate. It is recorded, not absorbed.

---

### The record that opened step 2c-4c-1 (superseded by the above, kept for its four prohibitions)

**Superseded.** Step 2c-4c-1 is complete; what it built, and what binds the steps after it, is the
section above. This is kept because its four prohibitions are the reasoning behind the shipped
finding, and a later step that touches `NewMatchRepeatsLiteralTrigger` should read them.

The consult is `docs/reviews/phase-2c-4c-design.md`; its disposition, with the full five-question
table and the six-step cut, is "Phase 2c-4c — consult disposition" above. **Read the disposition
first and the consult only for the step you are on** — the consult is 25 KB and a step needs one
section of it.

**The tree is clean and the production gates are confirmed on it** (see "Verification — Phase 2c-4c
design consult" above):

```sh
npm install                    # required first in a fresh clone; node_modules/ is gitignored
npm test                       # expect 1633 passed, 49 files
cargo test --workspace         # expect 1086 passed, 0 failed
npm run check                  # expect 418 files, 0 errors, 0 warnings
npm run build                  # expect 175 modules
```

**`1633` is right and `1623` is the stale figure 2c-4b-3d-3 corrected. Do not "restore" 1623.**

#### What 2c-4c-1 must do, and the four things it must not

Two core changes, and **no command, no `DocumentEdit` variant and no second writer**:

1. **Widen `NewMatch`** in `crates/espansoconfig-core/src/draft/new_match.rs` from its two mandatory
   fields to those two plus **optional `label`, `word`, `left_word`, `right_word`** — the same six
   fields `src/lib/browser/matchEditor.ts` actually drafts. `fields()` emits **only present
   schema-known fields, in one documented order**. No projection, comment, arbitrary key/value list
   or YAML source may enter this type.
2. **Add `FindingCode::NewMatchRepeatsLiteralTrigger { revision }`** in
   `crates/espansoconfig-core/src/validate/mod.rs`, produced by a **pure candidate inspection**
   beside `findings_of` in `crates/espansoconfig-core/src/persist/save.rs`. It is
   `SuspiciousButPermitted`, carries the exact candidate `ContentRevision`, and fires **only** for an
   `InsertItem` candidate whose new match exposes a modeled literal trigger text **exactly equal** to
   another modeled literal trigger text **in that same destination sequence**.

The four prohibitions, each with the reason it exists:

- **The finding's sentence may say only that the new snippet repeats literal trigger text already
  present, and that this application cannot determine how espanso will handle overlapping
  definitions.** It must not say *invalid*, *collision*, which snippet wins, or that a non-match is
  safe. That is **D2u** — a claim about risk is permitted, a claim about espanso semantics is not.
- **It must not become a generic validator rule.** A rule that runs over every candidate would
  interrupt unrelated match edits; a UI-only check would be bypassable. It is produced **inside**
  `save_document`, for `InsertItem` candidates only, and it participates in the ordinary
  exact-multiset acknowledgement round trip.
- **It will affect ordinary `create_match`, and that is correct, not a side effect.** Exact
  repetition is a property of the candidate creation, not of which frontend route reached it —
  so 2c-4c-1's tests must cover the plain-creation path as well as the recovery one.
- **Do not reuse `DuplicateKeepsTriggerDefinition`.** It is produced only for `DuplicateItem`
  batches; borrowing it would be the 2c-3c precedent reused **under a false name** rather than
  transferred at the right level.

**The evidence 2c-4c-1 owes** is Rust tests only — optional-field order and omission; exact repeated
and non-repeated literal triggers; **no semantic claim for regex or unmodelled trigger forms**; a
changed candidate revision invalidating an old acknowledgement; exact-multiset coverage; and byte
identity outside the insertion span. **No mounted test and no window reading**, because no component
changes. Those are steps 3 and 5.

#### The remaining five steps, so the cut is visible from here

**2c-4c-2** recovery as browser values, drawing nothing · **2c-4c-3** one recovery UI, i18n and
mounted evidence · **2c-4c-4** rebuild the window instrument · **2c-4c-5** the bilingual window
reading · **2c-4c-6** remove the instrument and re-derive the gate counts. Their scopes and the
evidence each owes are the table in the consult disposition above.

#### The rules that bind every step of 2c-4c

- **Three kinds of evidence per sub-phase** — model tests, a **mounted-component test**, and a
  **window reading**. A green suite is not a screen. 2c-4c-1 owes only the first because it changes
  no component; the phase as a whole owes all three.
- **The harness is gone, so any reading costs a rebuild first** — that is why steps 4 and 5 are two
  steps. `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md` carries the fixtures' content, not just
  their descriptions.
- **Never `git commit -a` or `git commit -am` while probe files are in the tree.** Stage by path.
- **`save_document` is the only entry point that may write a user's file**, there is no `force` flag,
  and a committed write is never afterwards reported as an error.
- **The recovery product is never called *Duplicate*, *exact copy* or *Keep my draft*.** It
  reconstructs schema-supported fields and cannot promise source-byte preservation; *Keep my draft*
  is already reapply's control. Its name is **_Create a new snippet from supported fields_**.
- **Opening recovery must not adopt the disk snapshot or close the source surface.** The
  `manualResolution` arm (`src/lib/browser/reapply.ts:236`) guarantees the projection, the selection
  and the one-shot authorization are all untouched — that is the phase's strongest asset, and
  spending it early throws it away.

#### The five holes 2c-4b left behind, still open and still not defects

They have no case row in the (now removed) `launch.sh` and no arm in `runPlan`, so nothing could be
launched for them; each costs a fixture or a plan function **plus an instrument rebuild** before
there is anything to launch. **2c-4c-4 is the natural place to add them**, since it rebuilds the
instrument anyway — but they are not obligations of any 2c-4b record.

- **Hole 1 — `browser.notice.gone`'s second producer**: `repairSelection`'s `clearSelection` arm,
  `src/lib/browser/selection.ts:292`. Every reading of that sentence so far came from `reresolve`'s
  **length** arm (P43 en, P44 es).
- **Holes 2–5 — the confirmed-reload transition on the creator, the deleter, the mover and the
  duplicator.** It exists on all five match surfaces and has been launched on **one**, the editor.

#### The standing bound on every window reading this project has taken (R38)

**The fixture shape has always been the easy one** — plain `replace:` scalars, double-quoted
triggers, LF, no BOM, no block scalars, no item-owned comments, no read-only file. **None of the
fifteen corpus fixtures `CLAUDE.md` §4 lists has ever been through the harness, and the owner's real
configuration has never been opened by it.** The consult ruled that **2c-4c-5 closes only the shapes
directly relevant to recovery** — at least one CRLF-or-BOM fixture and one item-owned-comment or
block-scalar case — and that the full sweep stays open for a later gate. It is recorded, not absorbed.

---

### The record that opened 2c-4c (superseded by the above, kept for its five questions)

### Phase 2c-4b is complete, and the harness is gone. **Phase 2c-4c — the recovery fallback — is next, and its first act is a design consult.**

> **Done.** The consult was taken; `docs/reviews/phase-2c-4c-design.md` answers all five questions
> below and returned **no open question for the owner**. This block is kept because the five
> questions are what the consult was asked, and the answers only make sense beside them.

**Nothing is left over from 2c-4b.** 3d was cut in three — the fixes (3d-1), the re-take (3d-2,
itself cut into 2a and 2b) and the removal (3d-3) — and all three are closed. The working tree is
**clean**: `git status --short --untracked-files=all` returns nothing, `git diff` is empty, and no
probe file, hook line or scratch tree survives anywhere.

**The gate numbers are the production ones again, and one of them is not what this file used to say:**

```sh
npm install                    # required first in a fresh clone; node_modules/ is gitignored
npm test                       # expect 1633 passed, 49 files    ← NOT 1623; see below
cargo test --workspace         # expect 1086 passed, 0 failed
npm run check                  # expect 418 files, 0 errors, 0 warnings
npm run build                  # expect 175 modules
```

**`1633` is the corrected figure and `1623` was stale** — it predated the 10 test cases 3d-1
committed while the harness was in the tree, and it was copied forward through three step records
because a production count is unobservable on a tree that has a harness in it. The arithmetic, the
artifacts and the two in-place annotations are in "Verification — Phase 2c-4b step 3d-3" above and
`docs/decisions/2c-4b-3d-3-notes.md` §3. **Do not "restore" 1623.**

#### What 2c-4c is, and why the code already names it

**Recovery fallback**: *save-draft-as-a-new-snippet, and manual resolution when the target is
ambiguous or gone* (`2c-split-notes.md` §2). **It fails as a dead-end mistake** — that is the failure
mode the split assigned it, and it is the right one to design against: every other conflict path now
ends somewhere, and this one is what stands between a person and a draft they cannot land anywhere.

**2c-4b built the doorway and deliberately did not walk through it.** `src/lib/browser/reapply.ts:236`
is `ReapplyOutcome`'s `manualResolution` arm, and its own doc comment says where recovery belongs:

> *Nothing could be done automatically, and **nothing was adopted**. The window is exactly where it
> was: the projection was not replaced, the selection was not repaired and the conflict's
> authorization was not spent. **Recovery from here is 2c-4c's, whole.***

That is the precise entry condition 2c-4c inherits, and it is a **strong** one: the arm guarantees
nothing was spent, so 2c-4c starts from an unspent conflict with the draft intact — it does not have
to unwind a partial adoption. The `obstacle` code it carries is what the recovery must be able to act
on. The reading that drew this arm on five surfaces in both languages is
`docs/decisions/2c-4b-3c-2-window-reading.md`, and `revealReapplyReport` is why it is visible.

#### The first act is a design consult, and that is a standing rule, not a preference

**Every phase since 2b-2c has been put to a design consult before any line of it was written**, and
the consults have changed the phase rather than confirmed it often enough that the rule is load-bearing:
2c-4a's ruled the frontend's eager adoption a *defect* rather than something to disclose; 2c-4b's
**narrowed the phase and split its confidence rule in two**, and ruled the raw editor out of reapply
entirely; the 2c split's own changed four of the seven things it was asked about.
`docs/reviews/phase-2c-4c-design.md` is where 2c-4c's belongs.

Questions the consult must settle before any step is cut, none of which should be answered by
assumption:

1. **Is "save my draft as a new snippet" a `create_match`, and if so what is its trigger?** A trigger
   collision is the obvious hazard — the draft's trigger is very likely the one already on disk. D2u
   forbids claiming espanso semantics, and 2c-3c settled the neighbouring question for *Duplicate* by
   making `DuplicateKeepsTriggerDefinition` an acknowledgeable finding **claiming risk, never
   semantics**, content-addressed to the candidate. Whether that precedent transfers is a consult
   question, not a foregone conclusion.
2. **Where does the new snippet go?** `create_match` has `NewMatchPosition`, identity-addressed; a
   recovery has no natural anchor, because the anchor is what went missing.
3. **What is "manual resolution" on a screen?** 2c-4b draws a *report* saying it happened. Whether
   2c-4c adds a side-by-side, a copy-out, or only the save-as-new escape is the phase's shape.
4. **Which surfaces get it.** Five match surfaces plus the raw editor, and the raw editor is the one
   ruled out of *reapply* — a whole-document text draft has no match to identify. It does not follow
   that it is out of *recovery*; that is a distinct question and the consult should say so explicitly.
5. **Does it need Rust at all**, or is it entirely a composition of existing commands? 2c-3c needed a
   new core primitive and a twelfth command; 2c-4a and 2c-4b needed none.

#### The rules that bind 2c-4c before it starts

- **Three kinds of evidence.** Model tests, a **mounted-component test**, and a **window reading** —
  every sub-phase of 2c owes all three, and a green suite is not a screen.
- **The harness is gone, so any reading costs a rebuild first.** `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md`
  is written to make that possible and carries the fixtures' content, not just their descriptions.
  Budget it as its own step — 3c, 3d-2 and 2c-4a-3c were each numbered in two for exactly this reason:
  **building an instrument and taking a reading are two different kinds of work in one worker's
  context.**
- **Never `git commit -a` or `git commit -am` while probe files are in the tree.** Stage by path.
- **`save_document` is the only entry point that may write a user's file**, there is no `force` flag,
  and a committed write is never afterwards reported as an error.
- **No control may be named or coded "keep my draft" for anything other than reapply** — that name is
  now spent, and 2c-4c's escape is a different promise.

#### The five holes 2c-4b leaves behind, recorded so they are not rediscovered as bugs

They have no case row in `launch.sh` and no arm in `runPlan`, so nothing could be launched for them;
each costs a fixture or a plan function **before** there is anything to launch, and now an instrument
rebuild too. **None is an obligation of `2c-4b-3d-1-notes.md` §7**, and none is a known defect — they
are unobserved paths.

- **Hole 1 — `browser.notice.gone`'s second producer**: `repairSelection`'s `clearSelection` arm,
  `src/lib/browser/selection.ts:292`. Every reading of that sentence so far came from `reresolve`'s
  **length** arm (P43 en, P44 es).
- **Holes 2–5 — the confirmed-reload transition on the creator, the deleter, the mover and the
  duplicator.** It exists on all five match surfaces and has been launched on **one**, the editor.

#### The standing bound on every window reading this project has taken

**The fixture shape has always been the easy one** — plain `replace:` scalars, double-quoted triggers,
LF, no BOM, no block scalars, no item-owned comments, no read-only file. **None of the fifteen corpus
fixtures `CLAUDE.md` §4 lists has ever been through the harness, and the owner's real configuration
has never been opened by it.** That is the largest single gap in this project's window evidence, it
survived 2c-4b untouched, and it is worth naming in 2c-4c's consult as a candidate for its own step.

---

### The record that closed 2c-4b-3d-3 (superseded by the above, kept for its work list)

### Phase 2c-4b-3d-2b is complete. **Step 2c-4b-3d-3 — the harness's removal — is next, and it is the last step of 2c-4b-3d.**

> **Done at 3d-3.** Everything below is the checkpoint as it stood before the removal, kept because it
> is the work list the removal followed. Its `1623` is the stale figure §3 of
> `docs/decisions/2c-4b-3d-3-notes.md` corrects to **1633**; the `418` and `175` were right.

**3d was cut in three: the fixes (3d-1), the re-take (3d-2, itself cut into 2a and 2b), and the
removal.** The reading is taken and its record is `docs/decisions/2c-4b-3d-2b-window-reading.md`.
**Nothing is left to read and nothing is left to fix — 3d-3 deletes the instrument and returns the
gates to their production numbers.**

The exact first commands to run, with the values this tree produces **with the harness still in it**:

```sh
npm test                       # expect 1634 passed, 49 files   — WITH the harness
cargo test --workspace         # expect 1086 passed, 0 failed
npm run check                  # expect 419 files, 0 errors, 0 warnings — WITH the harness
npm run build                  # expect 176 modules             — WITH the harness
```

**Those four are the shifted numbers. 3d-3's own success criterion is that they become
`1623` / `418` / `175`** (frontend tests / `svelte-check` files / bundle modules) once the harness is
gone. `cargo test --workspace` is **1086 with the harness**, and `src-tauri/src/probe.rs` declares no
test (`rg 'mod tests|#\[test\]' src-tauri/src/probe.rs` finds nothing), so the removal is not expected
to move it — **check the number rather than assume it**.

#### What 3d-3 must remove, and how 2c-4a-3c-5 did it

- **`src/probe.ts`** and **`src-tauri/src/probe.rs`** — deleted outright. Both are untracked, so
  deleting them changes no tracked file.
- **Two hook lines each in `src/main.ts` (`:20`, `:37`) and `src-tauri/src/main.rs` (`:47`, `:124`)** —
  **restored by hand to byte-identical**, which is how 2c-4a-3c-5 removed the previous harness. Do not
  `git checkout` blindly if anything else is pending in those files; there is nothing else pending
  today — `git diff --stat` over those two paths is **5 insertions and 1 deletion**, the four hook
  lines and nothing else.
- **The scratch tree `/private/tmp/espansoconfig-harness-2c-4b-3d/`** — `launch.sh`, `run-batch.sh`,
  the two manifest scripts, `fixtures/`, `launches/P01…P75/` and the three manifests.
- **After the removal, `git diff` must be empty** and
  `git status --short --untracked-files=all` must list no `probe` path.

**The scratch tree's measured size is `3.0G`** (`du -sh /private/tmp/espansoconfig-harness-2c-4b-3d/`,
measured at the close of 3d-2b) across **75 launch directories**, because `launch.sh` assembles a
fresh `.app` bundle per launch and every launch retains its whole bundle. That figure is the reason
the removal is a step and not a footnote.

**Never `git commit -a` or `git commit -am` while `src/probe.ts` and `src-tauri/src/probe.rs` are in
the tree.** Stage by path, as 3d-1 and 3d-2a both did.

#### The five holes that survive this step, and that are **not** 3d-3's to close

They are 3d-2a §6.7's holes, carried into the reading's §14 and restated as bounds in its §15 item 10.
A **hole** has **no case row in `launch.sh` and no arm in `runPlan`**, so nothing could be launched
for it; it costs a fixture or a plan function **before** there is anything to launch. None is an
obligation of `2c-4b-3d-1-notes.md` §7.

- **Hole 1 — `browser.notice.gone`'s second producer**: `repairSelection`'s `clearSelection` arm,
  `src/lib/browser/selection.ts:292`. The reading drew that sentence from `reresolve`'s **length** arm
  only (P43 en, P44 es).
- **Holes 2–5 — the confirmed-reload transition on the creator, the deleter, the mover and the
  duplicator.** The transition exists on all five match surfaces and has a case on **one** (the
  editor).

**Removing the harness makes each of them cost a rebuild too** — the repo-side hooks, the two probe
sources and the whole scratch tree would have to be reconstructed from
`docs/decisions/2c-4b-3d-2a-instrument-rebuild.md` before the missing fixture or plan function could
even be written. **That is the accepted trade**, and it is the same one 2c-4a-3c-5 took: the harness
costs 3.0 GB of scratch, four lines of hook in two production files and a shifted gate baseline for as
long as it stays, and the five holes are not §7 obligations.

#### What 3d-2b proved, at its real strength

**64 launches, P12–P75**, all reaching `--- end` with a zero-byte `probe.err`, none printing
`--- failed`, and `bytes=MATCH` on all 64 — including the five expected-bytes files 3d-2a §6.3 had
flagged as never compared against anything. **All 23 cases of the driver's table have now been
launched at least once on this tree.**

- **Question 1 — the refused reapply's report is visible.** Sixteen refusal readings over five
  surfaces and both languages put it at `y = 44`, the visible band's own top ([44, 689]), up to at
  most a sub-pixel of its top edge. 3c-2's §11.1 Medium is closed.
- **The cause is measured, not inferred.** P66 records **one** application-issued `block:nearest`
  request on the report, synchronously paired with `delta=-114` and `rect=-70->44`, and
  `revealReapplyReport` (`src/lib/components/reveal.ts:168`) is the only production path that calls
  `scrollQuietly` with `'nearest'`.
- **Question 2 — the success path.** The `'nearest'` request is issued on all five match surfaces in
  both languages and **moves nothing**. On the editor the pane had 160–295 px of unspent room and the
  request spent none of it; the editor's final offset is the **browser's clamp** on a `scrollHeight`
  that shrank when the panel was rebuilt, separated from the reveal for the first time.
- **Obligation (c) — a second press.** Ten `:twice` launches, five surfaces, both languages: exactly
  one `origin=app` request each, returning without throwing and producing **no movement while the
  report was already in view**, against a pane with room in both directions.
- **The reading's own findings are three Lows and three Observations** — F1 a status block with a
  *Dismiss* control lying above the band on the editor's success path (informational, reachable by
  scrolling, one surface), F2 the report's bottom flush with the band's bottom there, F3 a second
  press changing nothing on screen; F4 the 6–7 px gap between two same-width panels, F5
  `fieldCollisions`' two arms drawing one sentence by design, F6 a cleared-selection notice beside an
  editor still open on that snippet. **None is a defect in what is written to a user's file.**

#### And the bounds, drawn from the reading's §15 — state them as bounds, never soften them

- **No invoke spy and no command counter.** Every refusal claim is a claim about the **final
  filesystem state** and nothing more; `--- end` prints unconditionally; `HTMLElement.click()` is not a
  mouse click and no plan pressed a key. Whether a second press ran a second reapply **transition** is
  therefore still unobservable — what is measured is that the component's reveal effect re-ran.
- **The reveal is observed as a *request* and a pane offset, never as a platform decision.**
  `threw=false` says the native call returned without throwing, not that the platform honoured it.
- **The instrumented launches (P54–P75) force a layout flush the uninstrumented ones do not.** Stated
  as a bound, not as a proof of no effect; the twelve success rectangles reproducing P24–P45's exactly
  is *consistent with* no effect and is not a demonstration of none.
- **On the four operation surfaces the success-arm `delta=0` says nothing about the request** — the
  pane's range was already `0`. Only the editor's launches, where room existed, carry that weight.
- **Two binaries ran the two rounds** (`84148bbf…` for P12–P53, `7fe2a6da…` for P54–P75), so a
  cross-round geometric comparison is a comparison across binaries. §12's 17 px panel-height
  instability is **reproduced and confounded**: it excludes neither of 3d-2a's two candidate causes.
- **Every launch ran `hasFocus=false visibility=hidden`**, so every focus statement is about that
  condition and not the one a person at the machine would have.
- **The fixture shape is still the easy one** — plain `replace:` scalars, double-quoted triggers, LF,
  no BOM, no block scalars, no item-owned comments, no read-only file. **None of the fifteen corpus
  fixtures `CLAUDE.md` §4 lists has ever been through this harness, and the owner's real configuration
  has never been opened by it.**

#### The manifests, and the one thing about them that must not be "repaired"

`/private/tmp/espansoconfig-harness-2c-4b-3d/` holds three manifests. `manifest-3d-2b-fix-post.sha256`
(**177 entries**) covers the current probe and the P54–P75 artifacts and **verifies in full**.
`manifest-3d-2b-post.sha256` (131 entries) verifies **130** and `manifest-3d-2a-post.sha256`
(46 entries) verifies **45**; the single failing entry in each is **`src/probe.ts` and nothing else**,
because the review round instrumented it. **That is recorded rather than regenerated on purpose** — a
manifest is a statement about a moment, and 3d-2a §8.5 is this project's record of what regenerating
one destroyed. 3d-3 deletes all three with the tree; it must not rewrite them first.

---

### The record that closed 2c-4b-3d-2a (superseded by the above, kept for its work list and its bounds)

### Phase 2c-4b-3d-2a is complete. **Step 2c-4b-3d-2b — the re-take window reading — is next.**

**3d-2 was cut in two**, and a cold session most needs to know why. The checkpoint before this one
named 3d-2 as one step: the reading. It could not start as one, because **the scratch half of the
harness was gone** — the session that owned it had been discarded, and with it `launch.sh`, all the
fixtures, the driver's case table and `launches/L01…L110/`. Reconstructing an instrument and taking a
reading are two different kinds of work in one worker's context, which is exactly why 3c and 2c-4a-3c
were each numbered in two. So: **3d-2a rebuilt and proved the instrument (complete). 3d-2b takes the
reading. 3d-3 deletes the harness.**

The exact first commands to run:

```sh
npm install && npm test        # expect 1634 passed, 49 files — WITH the harness
cargo test --workspace         # expect 1086 passed, 0 failed
npm run check                  # expect 419 files, 0 errors, 0 warnings — WITH the harness
```

#### The critical fact about resuming here — and it has changed

**The harness is NOT committed, and a fresh clone does not have it.** It has two halves, and at 3d-2a
they lived in different places for the first time.

- **The repo-side half survived** the session boundary and is in the working tree: `src/probe.ts`,
  `src-tauri/src/probe.rs`, and two hook lines each in `src/main.ts` (`:20`, `:37`) and
  `src-tauri/src/main.rs` (`:47`, `:124`). `git diff` is exactly those four lines and nothing else.
- **The scratch half is at a new, stable path**: `/private/tmp/espansoconfig-harness-2c-4b-3d/` —
  `launch.sh`, `fixtures/` (21 files), `launches/P01…P11/`, `manifest-3d-2a-post.sha256` (46 entries,
  all verifying). **The old path under `/private/tmp/claude-501/.../scratchpad` is gone and must not
  be looked for.** It was a *session scratchpad*, which is why it vanished; the replacement is
  deliberately outside any session directory so the same loss cannot repeat between 3d-2b and 3d-3.

**Check `git status --short --untracked-files=all` first.** If it lists `src/probe.ts` and
`src-tauri/src/probe.rs`, the repo-side half survived and the gate numbers are the shifted ones
(**1634 / 419 / 176**); if it does not, they are the production ones (**1623 / 418 / 175**) and that
half must be rebuilt. [**3d-3: the production test count in that sentence is stale — it is `1633`.**
This block is superseded, and the correction is in "Verification — Phase 2c-4b step 3d-3".]
If `/private/tmp/espansoconfig-harness-2c-4b-3d/` is missing, the scratch half
must be rebuilt from `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md`, which was written to make
exactly that possible and now records the fixtures' content rather than only their descriptions.

#### Two corrections 3d-2a made to earlier records, both verified against artifacts

1. **`BLOCK_TEXT_LIMIT` is 4000, not 1500.** `2c-4b-3c-1-notes.md:290` and this file's own 3c-1 row
   both said 1500; `src/probe.ts:397` is the artifact and `2c-4b-3c-2-window-reading.md` §1 records
   the change. Both records are annotated rather than silently edited.
2. **The driver's case count is not the fixture-file count.** 3c-1's "19" is the number of fixture
   *files*; the case table had 20 rows, and after 3d-2a's three new cases it has **23**, in both
   `launch.sh` and `runPlan`. Codex re-derived both counts independently.

#### What 3d-2b owes

**A window reading of every component 3d-1 changed, in both languages.** A green suite is not a
screen, and this project's standing rule is that a window reading is re-taken after **any** change to
a component. 3d-1 changed **six**: `MatchEditor.svelte`, `MatchCreator.svelte`, `MatchDeleter.svelte`,
`MatchMover.svelte`, `MatchDuplicator.svelte` — and `RawEditor.svelte`, drawn in late by round 2's
shape sweep for two comments.

**`docs/decisions/2c-4b-3d-1-notes.md` §7 is the work list**, and it is per-component. **§6.7 of
`2c-4b-3d-2a-instrument-rebuild.md` is what schedules it**: a per-obligation table naming, for every
row of that §7, which case serves it and whether that case has been launched. Codex verified the
table complete against §7. Read them together — §7 says what to look at, §6.7 says what to run.

The four things the reading must settle, none of which any test in this repository can:

1. **Is the reapply report visible now?** §11.1 of the 3c-2 reading measured it at `y` between −53 and
   −104 with `clip=above` in **all 18** `manualResolution` launches, on five surfaces in both
   languages, and a second press reproduced the identical invisible refusal. `revealReapplyReport` is
   the fix. **Neither a model test nor a mounted test can fail for this, because neither has a
   viewport** — that sentence is in the code, and it is why this step exists.
2. **The success-path geometry, which has never been measured at all.** §7 item (f): read the
   **success-arm** report (`reapplied` and `alreadySatisfied`) and the next usable controls on **all
   five** match components, in both languages. The deleter's renewed confirmation (`:464`, above its
   report at `:516`) and the mover's rebuilt destination list (`:663`, above its report at `:784`) get
   their component-specific checks — but they are **not** the whole surface, and the direction the
   reveal scrolls them is **unknown**: `'nearest'` may move them up, down, or not at all. **Record
   which of the three happened.**
3. **`browser.notice.gone` now has a case, and 3d-2a drew it in both languages** (P09 English, P10
   Spanish) — the first time in this project's history. Codex traced the producer to `reresolve`'s
   length arm through `adoptDiskVersion` → `repairAfter`, so it is **the** length predicate and not
   the same string from elsewhere. What 3d-2b owes is the **judgement** of that sentence on a screen,
   not its existence. **Its second producer — `repairSelection`'s `clearSelection` arm — still has no
   case and was not provoked.**
4. **`browser.matchEditor.reapply.fieldCollisions`' ineligibility arm now has a case too**, and 3d-2a
   drew it (P07 English, P11 Spanish) with P08 as the isolating twin. The two fixtures differ by three
   bytes — `replace:` versus `replace: ""`, 206 versus 209 — both plans draft the same `""`, so the
   disk holds the drafted value in both and **only eligibility differs**; `fieldEligibility` returns
   `ownsNoBytes` exactly when the scalar span is zero-width. Again: the arm is reachable, and the
   sentence's **judgement in full, in both languages**, is 3d-2b's.

And the standing constraint from `docs/decisions/1c-2b-2b-2-notes.md` §6.1, which has cost two
launches before: **one plan per launch, into a fresh bundle path.** A WKWebView whose window is
occluded stops running `setTimeout` about six seconds after launch. The webview's `localStorage` is
**not** keyed by `HOME` — it follows the bundle identifier, which every probe bundle shares — so a
plan must set the language **explicitly through the picker** and never trust the launch environment.

#### What 3d-2a proved, stated at its real strength

**11 launches (P01–P11)**, every one reaching `--- end` with a zero-byte `probe.err`, none printing
`--- failed`, and `bytes=MATCH` on all 11 — six proving the rebuilt instrument reaches all six write
surfaces in both languages with the positive/refusal partition intact (four ending at hand-authored
bytes with a backup present, two at R1 with no backup directory), and five proving the two new cases.

**And the honest bounds, which the record states and Codex re-derived.**

- **The fixtures were re-authored from prose, not recovered.** R0 now digests to `91f2c4df…` where 3b
  recorded `507e98f5…`, so **digest continuity with launches L01–L110 is gone**. That contradiction is
  established for `base-r0.yml` and `elsewhere-r1.yml` only; for the other seventeen it is *unknown*,
  because no original, no old digest and no before-manifest survives.
- **14 of the 23 cases were never launched, and 5 of the 9 expected-bytes files were never compared.**
  Both lists are named in the record's §6.2 and §6.3 and both counts were re-derived independently.
  **If 3d-2b hits `bytes=DIFFER` on an un-launched positive, suspect the fixture before the
  application.**
- **Two panel rectangles measured 17 px taller** than `2c-4b-3c-2-window-reading.md` §4.1 recorded
  (deleter en `491x758` against `741`; mover es `491x775` against `758`) while four reproduced exactly.
  There are two candidate causes — 3d-1 changed the components, and these fixtures are re-authored —
  and **3d-2a separates neither.** It is recorded as a measurement for 3d-2b, not a regression claim.
- **The instrument cannot observe whether a write occurred and was reverted.** There is no invoke spy
  and no command counter, so every refusal claim is a claim about the **final filesystem state** and
  nothing more. `--- end` prints unconditionally and says nothing about activity after the driver's
  last line.
- **The fixture shape is still the easy one** — plain `replace:` scalars, double-quoted triggers, one
  leading comment, LF, no BOM, no block scalars, no item-owned comments, no read-only file. None of the
  fifteen corpus fixtures `CLAUDE.md` §4 lists has ever been through this harness, and the owner's real
  configuration has never been opened by it.

---

### The record that closed 2c-4b-3d-1 (superseded by the above, kept for its work list and its bounds)

### Phase 2c-4b-3d-1 is complete. **Step 2c-4b-3d-2 — the re-take window reading — is next.**

**3d was cut in three**, the way 3c was cut and for the same reason: the fixes, the re-take and the
harness's removal are three different kinds of work, and 3d-1 alone took three Codex rounds plus an
orchestrator round. **3d-1 (the four fixes) is complete. 3d-2 is the reading. 3d-3 deletes the
harness.**

The exact first commands to run:

```sh
npm install && npm test        # expect 1634 passed, 49 files — WITH the harness
cargo test --workspace         # expect 1086 passed, 0 failed
```

#### The critical fact about resuming here

**The harness is NOT committed, and a fresh clone does not have it.** `src/probe.ts`,
`src-tauri/src/probe.rs`, the four hook lines in `src/main.ts` (`:20`, `:37`) and
`src-tauri/src/main.rs` (`:47`, `:124`), and the whole scratch tree (`launch.sh`, `run-3c-2.sh`,
`fixtures/`, `launches/L01…L110/`, `manifest-3c-1-post.sha256`, `manifest-3c-2-post.sha256`) live only
in the working tree of the sessions that built them, under
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad`.
**That tree was confirmed present at the start of the 3d-1 session** and it is where the launch
recipe's fixtures already are.

**Check `git status --short --untracked-files=all` first**: if it lists `src/probe.ts` and
`src-tauri/src/probe.rs`, the harness survived and the gate numbers are the shifted ones
(**1634 / 419 / 176**); if it does not, they are the production ones (**1623 / 418 / 175**) and the
harness must be rebuilt from `docs/decisions/2c-4b-3b-instrument.md` and
`docs/decisions/2c-4b-3c-1-notes.md` before a single reading can be taken.
[**3d-3: the production test count in that sentence is stale — it is `1633`.** This block is
superseded, and the correction is in "Verification — Phase 2c-4b step 3d-3".]

Note the scratch tree was **4.4 GB** at 3c-2 and every launch retains a whole `.app` bundle. **3d-3
deletes the harness, and that includes this tree.**

#### What 3d-2 owes

**A window reading of every component 3d-1 changed, in both languages.** A green suite is not a
screen, and this project's standing rule is that a window reading is re-taken after **any** change to
a component. 3d-1 changed **six**: `MatchEditor.svelte`, `MatchCreator.svelte`, `MatchDeleter.svelte`,
`MatchMover.svelte`, `MatchDuplicator.svelte` — and `RawEditor.svelte`, which was drawn in late by
round 2's shape sweep for two comments. **`docs/decisions/2c-4b-3d-1-notes.md` §7 is the work list**,
and it is per-component.

The four things the reading must settle, none of which any test in this repository can:

1. **Is the reapply report visible now?** §11.1 measured it at `y` between −53 and −104 with
   `clip=above` in **all 18** `manualResolution` launches, on five surfaces in both languages, and a
   second press reproduced the identical invisible refusal. `revealReapplyReport` is the fix.
   **Neither a model test nor a mounted test can fail for this, because neither has a viewport** —
   that sentence is in the code, and it is why this step exists.
2. **The success-path geometry, which has never been measured at all.** §7 item (f): read the
   **success-arm** report (`reapplied` and `alreadySatisfied`) and the next usable controls on **all
   five** match components, in both languages. The deleter's renewed confirmation (`:464`, above its
   report at `:516`) and the mover's rebuilt destination list (`:663`, above its report at `:784`) get
   their component-specific checks — but they are **not** the whole surface, and the direction the
   reveal scrolls them is **unknown**: `'nearest'` may move them up, down, or not at all.
3. **`browser.notice.gone` has never been drawn in any launch.** It is a length predicate with a
   second producer in `repairSelection`'s `clearSelection` arm. Half of §11.3's High still has no
   screen behind it, and 3d-2 owes it one.
4. **`browser.matchEditor.reapply.fieldCollisions`'s ineligibility arm has no screen behind it
   either** — the arm that made the old sentence false is the one no launch has drawn.

And the standing constraint from `docs/decisions/1c-2b-2b-2-notes.md` §6.1, which has cost two
launches before: **one plan per launch, into a fresh bundle path.** A WKWebView whose window is
occluded stops running `setTimeout` about six seconds after launch. The webview's `localStorage` is
**not** keyed by `HOME` — it follows the bundle identifier, which every probe bundle shares — so a
plan must set the language **explicitly through the picker** and never trust the launch environment.

#### What 3d-1 proved, stated at its real strength

Four findings closed, over three Codex rounds and an orchestrator round, and **not one finding in any
round was a defect in behaviour** — every one was a sentence, a contract or a count claiming more than
the code gives. The gates are 1634 / 419 / 176 / 1086, all green, with the harness in the tree.

**And the honest bound.** Every claim 3d-1 makes about what a person *sees* is unproven. The reveal
fix is the one thing in this step that no test in this repository can falsify, its own JSDoc says so,
and the success-path geometry it introduced was never measured on any surface. **3d-1 is the fix; the
evidence is 3d-2's.**

---

### The record that closed 2c-4b-3c-2 (superseded by the above, kept for its work list and its bounds)

### Phase 2c-4b-3c-2 is complete. **Step 2c-4b-3d — the fixes, the re-take, and the harness's removal — is next.**

**Read `docs/decisions/2c-4b-3c-2-window-reading.md` first**; it is the whole work list. Read
`docs/reviews/phase-2c-4b-3c-2-reading.md` second — three review rounds, and round 2's High is the
one a fixer most needs, because it is a finding that turned out **not to exist**. Read
`docs/decisions/2c-4b-3b-instrument.md` only when a launch has to be run: it holds the launch recipe
verbatim and the nine things a worker must not re-derive.

The exact first commands to run:

```sh
npm install && npm test        # expect 1624 passed, 49 files — WITH the harness
cargo test --workspace         # expect 1086 passed, 0 failed
```

#### The critical fact about resuming here

**The harness is NOT committed, and a fresh clone does not have it.** `src/probe.ts`,
`src-tauri/src/probe.rs`, the four hook lines in `src/main.ts` and `src-tauri/src/main.rs`, and the
whole scratch tree (`launch.sh`, `run-3c-2.sh`, `fixtures/` — 19 files, `launches/L01…L110/`,
`manifest-3c-1-post.sha256`, `manifest-3c-2-post.sha256`) live only in the working tree of the
sessions that built them, under
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad`.
**Check `git status --short --untracked-files=all` first**: if it lists `src/probe.ts` and
`src-tauri/src/probe.rs`, the harness survived and the gate numbers are the shifted ones
(**1624 / 419 / 176**); if it does not, they are the production ones (**1623 / 418 / 175**) and the
harness must be rebuilt from the two instrument records before a single reading can be taken.

Note the scratch tree is now **4.4 GB** — every launch retains a whole `.app` bundle. 3d deletes the
harness at its end, and that includes this tree.

#### What 3d owes

**Four findings, then a re-take of every component it changes, then the harness's removal.** The
severity order is the fix order, and the re-take is not optional — a green suite is not a screen, and
a window reading is re-taken after any change to a component.

1. **§11.3 — High. `browser.notice.differentMatch` is false, and `browser.notice.gone` with it.**
   `reresolve` (`src/lib/browser/selection.ts:176`, with `matchFingerprint` at `:109`) compares a
   positional index and an **exact `source_text`**, so *"what is now in that position is a different
   snippet"* is drawn when the **same** snippet was edited in place — which is exactly what happened
   in L43–L46. The two strings have **different predicates and need different wording**: `differentMatch`
   is a bytes predicate and was drawn on screen; `gone` is a length predicate, was derived from source
   and **never drawn in any launch**, so half of this finding has no screen behind it and 3d owes it
   one. **Do not touch `browser.notice.displacedByMove` or `displacedByDuplicate`** — round 1's sweep
   alleged the same defect there and round 2 retracted it; their attribution is reachable only when
   the re-read is the committed operation's own parse (`adoptTheDocumentOnDisk`
   `workspace.svelte.ts:2750-2752` for the move, `adoptAfterTheDuplicate` `:2891-2893` for the
   duplicate), where the identity claim is earned.
2. **§11.1 — Medium. A refused reapply reports where nobody can see it.** In **all 18**
   `manualResolution` launches — five surfaces, both languages — the report block is drawn entirely
   above the visible band (`y` between −53 and −104, `clip=above`), the outcome panel and its four
   controls keep pixel-identical coordinates, and **a second press reproduces the identical invisible
   refusal** (L107–L110). The mechanism: the report is a second `role="status"` panel drawn
   immediately before the outcome panel in all five components, and the reveal machinery knows only
   about the outcome panel — `outcomeReveal` (`src/lib/browser/saveOutcome.ts:1711`) has no arm for a
   reapply report and `revealOutcome` (`src/lib/components/reveal.ts:87`) is only ever handed
   `outcomePanel` and `outcomeChoices`. **Neither a model test nor a mounted test can fail for this,
   because neither has a viewport.** §11.4 is the constraint on the fix: on five of six surfaces the
   conflict panel's controls already start below the fold.
3. **§11.5 — Medium. `browser.matchEditor.reapply.fieldCollisions` gives a false reason for a correct
   refusal.** `fieldReapply` returns `collision` when a drafted field becomes **ineligible**, even
   when its value did not change, so *"The version on disk has changed fields…"* claims more than the
   predicate gives. Graded Medium rather than High deliberately, and the argument is in the finding:
   this project's precedents put a false claim about *whether the file was written* at High and a
   right-substance/wrong-door defect at Low, and this is a wrong **reason** for a refusal that
   correctly writes nothing. **3d may re-grade it with that argument in view.**
4. **§11.2 — Low. The Spanish reapply family uses *usted* where every other Spanish string on the
   same panel uses *tú*** — seven strings, `src/lib/i18n/es.json:140-145` and `:255`.

Five observations (§11.4 and §11.6–§11.9) are recorded and are **not** work: nothing moves focus into
the conflict panel; a refusal correctly draws no selection notice; the mover's destinations and the
deleter's confirmation are visibly rebuilt; and `alreadySatisfied` leaves nothing to press.

#### What 3c-2 proved, stated at its real strength

**71 launches (L40–L110)**, all with a zero-byte `probe.err`, none printing `--- failed`, and
`bytes=MATCH` on **all 71**. **21 ended at hand-authored bytes with a backup present; 50 ended at R1
with no backup directory** — a perfect partition, and the orchestrator re-derived it from every
launch's own `expect=` and `backups=` fields rather than accepting it. **No defect was found in what
is written to disk**, on any of the six surfaces, in either language.

**PASS** on choice ordering, on the readiness sentence and its draft-kind branch, on the reachability
and focusability of every drawn control, on the truth of the other four refusal sentences and both
shared obstacle lines, and on the duplicator's refusal/acknowledgement round after a successful
reapply.

**And the honest bounds, which §12 of the record states as 21 items.** There is no invoke spy and no
command counter, so **every refusal claim is a claim about the final filesystem state and nothing
more**; `--- end` is printed **unconditionally** and is only a wrapper signal, saying nothing about
activity after the driver's last line; `HTMLElement.click()` is not a mouse click and **no `Tab` key
was ever sent**, so DOM order and `tabIndex` values are *consistent with* the expected tab order and
real traversal is untested; and **the fixture shape is still the easy one** — plain `replace:`
scalars, double-quoted triggers, one leading comment, LF, no BOM, no block scalars, no item-owned
comments, no second sequence, no read-only file. **None of the fifteen corpus fixtures `CLAUDE.md` §4
lists has ever been through this harness**, and the owner's real configuration was never opened.

---

### The record that closed 2c-4b-3c-1 (superseded by the above, kept for its rationale)

**2c-4b-3c was cut in two, and this is the deviation a cold session most needs to know.** The
checkpoint before this one named 3c as one step: "the reading". Its own work list was five missing
fixture pairs, Spanish coverage for three surfaces, Q7's eight-reading matrix over six surfaces in
two languages, keyboard and focus operability, and a standing judgement — which is instrument
construction and reading in one worker's context, and 3b had already spent four review rounds on
construction alone. It is now **3c-1 (extend the instrument, complete)** and **3c-2 (take the
reading, next)**, exactly as 2c-4a-3c was numbered when the same obligation came due. **3d is
unchanged**: it applies whatever 3c-2 finds, re-takes the affected readings, and then deletes the
harness.

**Both High findings of 3c-1's first review round were instrument gaps, not sentences** — Q7 point
6's changed-`after`-anchor refusal and Q7 point 4's removed target had no fixture pair in either
step. Had 3c not been cut, 3c-2 would have met them mid-reading with no case to run.

The exact first commands to run:

```sh
npm install && npm test        # expect 1624 passed, 49 files — WITH the harness
cargo test --workspace         # expect 1086 passed, 0 failed
```

**Read `docs/decisions/2c-4b-3c-1-notes.md` first, and `docs/decisions/2c-4b-3b-instrument.md`
second.** 3b's record is still the instrument's foundation — the launch recipe verbatim, the build
order of its §6.1, and the nine things a worker must not re-derive. 3c-1's record is what changed on
top of it: eight new cases (19 in total), 16 new launches (L24–L39), the driver's `moverPlan`
placement parameter, `BLOCK_TEXT_LIMIT` at 1500, and **§7, what this instrument still does not
prove**, which is 3c-2's honest starting bound.

#### The critical fact about resuming here

**The harness is NOT committed, and a fresh clone does not have it.** `src/probe.ts`,
`src-tauri/src/probe.rs`, the four hook lines in `src/main.ts` and `src-tauri/src/main.rs`, and the
whole scratch tree (`launch.sh`, `fixtures/` — 17 files, `launches/L01…L39/`,
`manifest-3c-1-post.sha256`) live only in the working tree of the sessions that built them, under
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad`.
**If that working tree is gone, 3c-2's first job is to rebuild the harness from the two records** —
which is exactly what 3b did from `2c-4a-3c-1-instrument.md`, and both records were written to make
that possible again. Check `git status --short --untracked-files=all` first: if it lists
`src/probe.ts` and `src-tauri/src/probe.rs`, the harness survived and the gate numbers are the
shifted ones (**1624 / 419 / 176**); if it does not, they are the production ones (1623 / 418 / 175)
and the harness must be rebuilt before a single reading can be taken.

`manifest-3c-1-post.sha256` is a **post-image only** — SHA-256 of `launch.sh`, every fixture, both
probe sources and every retained `probe.log`/`bytes.txt` as 3c-1 left them. It can show a later step
what changed under it. It is **not** evidence that anything was unmodified during 3c-1, because there
is no before-image; 3c-1's §5.7 says so, and a reader must not promote it.

#### What 3c-2 must do

Run and record Q7's eight-reading R0→R1 matrix over six write surfaces in both languages
(`docs/reviews/phase-2c-4b-design.md` lines 131–151), reading **choice ordering, focus and scroll
reachability, every new refusal sentence, and the ordinary refusal/acknowledgement round after a
successful reapply attempt** — none of which 3b or 3c-1 touched. **The instrument now runs every
numbered Q7 point**, so 3c-2 builds no case unless it hits the two gaps named below.

1. **The reading itself, which nothing so far has taken.** 3c-1's launches were construction proofs:
   each confirmed a case reaches its surface and lands the right bytes. None judged an ordering, a
   focus path, a scroll position or a sentence's truth.
2. **A standing finding, measured twice and judged neither time.** The `manualResolution` report
   block was drawn at a **negative `y`** — above the fold, in a pane whose outcome panel had been
   scrolled into view — in nine of 3b's 23 launches and in L27, L30, L34, L35, L36, L37, L38 and L39
   here, with several selection banners too (`-70`, `-87`, `-104`, `-111`, `-85`; two mover banners
   were at `+58`). **Whether that is acceptable is 3c-2's judgement**, and it is the one finding
   already sitting in the ledger.
3. **An observation 3c-1 recorded and explicitly did not diagnose.** The selection-repair banner said
   *"what is now in that position is a different snippet, so the selection was cleared"* in L25, L26,
   L27, L28 and L29 — the launches whose R1 changed or moved the target's own bytes — where L24's
   said *"the snippet you had selected was found again"*. That is which sentence was drawn, not a
   defect claim and not a diagnosis of the repair rule.
4. **§7.6 — `end` after a reorder is still unbuilt.** Q7 point 6 names four placement shapes;
   `top`-after-reorder, the resolvable `after` and the changed anchor have cases, and `end` does not,
   because `moverPlan` presses one placement per launch and needs a third parameter value. It is
   handed to **the next construction step**. If 3c-2 chooses to build it rather than defer it, that
   is a deviation to record, not a silent addition.
5. **§7.7 — bilingual coverage is eight of nineteen cases.** Q7's closing paragraph says *read both
   languages*; the creator, duplicator and mover now have Spanish launches, and eleven cases still do
   not.
6. **§7.5 — one fixture shape, and it is still the easy one.** These 19 cases add a `label:` key, a
   duplicated trigger, a reordered sequence, a changed anchor and a deleted item to 3b's shape, and
   **nothing else**: plain `replace:` scalars, double-quoted triggers, one leading comment, LF, no
   BOM, no block scalars, no item-owned comments, no blank-line runs, no second sequence, no
   read-only file, no package. The fifteen corpus fixtures `CLAUDE.md` §4 lists exist precisely
   because those shapes behave differently, and **none has been through this harness**.
7. **§7.0 and 3b's §8.3 and §8.11 still bind.** There is no invoke spy and no command counter, so
   every refusal claim is a claim about the **final filesystem state** and nothing more; and
   `HTMLElement.click()` is not a mouse click — no plan has yet used the keyboard, tabbed focus or
   scrolled anything, so focus order and keyboard operability are entirely unread.

#### What 3c-1 proved, stated at its real strength

16 launches, all 16 with a zero-byte `probe.err`, all 16 reaching `--- end` and **none** printing
`--- failed` first. Eight new cases close every Q7 point that had none: `editor-fallback`,
`editor-satisfied`, `editor-ambiguous`, `editor-missing`, `mover-reordered`, `mover-after`,
`mover-after-changed`, `creator-anchor-gone`. Every positive ended byte-identical to hand-authored
expected bytes that differ from R1; every refusal ended byte-identical to R1 with no
`.espansoconfig-backups` directory. **A byte match is still not a proof of mechanism** — 2c-4b-1's
Rust-side tests carry that — and `alreadySatisfied` is distinguishable from `reapplied` here only by
the sentence drawn, which §7.4 admits.

**§8.5 of 3b's record is false and 3c-1 corrects it.** It said no new case would need a driver
change; `mover-after` needed one, because it had to select a placement the existing mover plan never
selected, and no fixture pair can turn *At the top of the list* into *After {trigger}*. The
`moverPlan` placement parameter is that forced change; six switch arms naming each case in its own
transcript were a **chosen** one, and 3c-1's §3 separates the two. **Every launch ran in a synthetic
two-file tree; the owner's real configuration was never opened.**

---

### The record that closed 2c-4b-3b (superseded by the above, kept for its rationale)

#### What 3b proved, stated at its real strength

23 launches, all 23 with a zero-byte `probe.err`, 21 printing `--- end` — **of which four printed
`--- failed` first**, so `--- end` is a wrapper signal and never a success signal. A true
`SaveResult::Conflict` reached all six surfaces with `expected ≠ found` and `diskRevision` at R1.
*Keep my draft* is drawn and pressable on all five match surfaces and **absent on the raw editor**, in
English and in Spanish. Five positive cases produced a file byte-identical to hand-authored expected
bytes; six refusals left the file byte-identical to R1 with **no `.espansoconfig-backups` directory**.
Every case ran in a synthetic two-file tree; the owner's real configuration was never opened.

#### What 3b cost, and the lesson it repeats

**Four review rounds, ten findings, and every single one was a sentence in the record.** No defect in
the harness; no defect in the application. Round 2 found that **two of round 1's fixes had shipped the
mirror image of the claim they closed**, round 3 found that the orchestrator's own round-2 fix was
**still a false universal**, and round 4 returned READY with no findings. The record now separates,
explicitly and non-exhaustively, launch-case
outcome claims from harness-source claims, application-source facts, contemporaneous diagnoses whose
evidence was not retained, launch-derived inferences, and gate results with no transcript.

---

### The record that closed 2c-4b-3a (superseded by the above, kept for its rationale)

### Phase 2c-4b-3a is complete. **Step 2c-4b-3b is next.**

**`keepMyDraft` is on five screens and refused on the sixth, and no window has been read.** The exact
first commands to run:

```sh
npm install && npm test        # expect 1623 passed, 49 files
cargo test --workspace         # expect 1086 passed, 0 failed
```

(`npm run check` expects **418 files, 0 errors, 0 warnings** — unchanged. `npm run build` expects
**175 modules**, *unchanged*: 3a added no new source module, only members, accessors, handlers and
strings, so the guard's shape rule says the number must not move. i18n is **769** keys per language,
at parity — 745 plus the 24 this step added, its first user-facing strings since 2c-4a-3b.)

#### Why 2c-4b-3 was cut into four steps

The consult's Q8 named 2c-4b-3 as one step — "one choice authority, six panels, i18n, and window
reading". It is cut here into **3a** (the code), **3b** (the instrument), **3c** (the reading) and
**3d** (the fixes and the re-take), which is exactly how 2c-4a-3c ran when the same obligation came
due. The forcing fact: **the external-writer harness does not exist.** `2c-4a-3c-5` deleted it, by
design — "the harness is deleted, both hook files restored by hand to byte-identical, and the gates
are back at their production numbers". So the reading 3c owes cannot be taken until 3b rebuilds it,
and Q7 asks for **more** than 2c-4a-3c-1 built: fixed R0→R1 fixture *pairs*, seeded whole and copied
atomically over `conflict.yml`, rather than a broad substitution.

#### What 3a actually shipped

`ConflictChoice` gained `keepMyDraft`, pushed from **one line** — `saveOutcome.ts:460` — after
`copyDraft` and before the reload pair, gated on **both** the new per-surface
`ConflictCapabilities.offersReapply` and the permanent `reapplySupport` that 2c-4b-2 built. The five
match surfaces set the boolean `true`; `rawEditor.ts` sets it `false` beside `unavailable`, and the
two statements are deliberately not one: the weaker says *this surface does not draw it today*, the
stronger says *this surface can never do it*.

`reapply.ts` gained the **presentation half only** — no transition changed. Each surface got an
obstacle key function beside its union, a `reapplyOffered` view read from the produced list, and a
component handler, readiness line and report block. The i18n layer composes each obstacle sentence
with its nested wire/model code, so no renderer can drop the reason.

**`DetailPane.svelte` needed no change** — the mover's and duplicator's extra readers were already
props.

#### Two review rounds, and what they cost

**Round 1 — NOT READY**, 1 High, 1 Medium, 2 Lows, and **every one of them was prose**. The High:
the readiness sentence promised a sendable form even when reapply returns `alreadySatisfied`, which
returns none. The Medium: the result prose claimed the attempt had moved the window, and that
retrying a refusal could not change the answer.

**Round 2 confirmed all four closed and found one new Low — introduced by the fix round**, which is
this repository's documented recurrence. Closing the permanence claim had meant rewriting it in **32
further places**, and `editorSave.ts`'s `ReloadStep.refused` came out saying that because a refusal
spends nothing, a later press over a window that had reprojected to the requested revision *would be
answered `alreadyThere`*. **Reaching that revision is not sufficient**: four guards run before the
revision comparison, and "a refusal spends nothing" rules out only *this attempt newly causing* the
spent-authorization guard. An unconditional claim of permanent refusal had been replaced by an
unconditional claim of later success — the mirror image of the finding being closed. Fixed, and the
sweep that followed found **two narrower instances** in `reapply.ts`'s `adoptionRefused` arm, both
fixed. The reviews are `docs/reviews/phase-2c-4b-3a-code.md` and `phase-2c-4b-3a-code-round2.md`;
the record is `docs/decisions/2c-4b-3a-notes.md`, §7 and §8.

#### What 3a inherits and hands on as stated risk

1. **Nothing here has been seen on a screen.** Six components changed, so **six readings are owed**,
   and 3a's evidence anticipates none of them. A mounted test proves a handler fires, not that a
   window draws.
2. **No suite in this repository can fail because a sentence became untrue.** This phase demonstrated
   it twice: four false sentences, and then their mirror image, all past 1623 green tests,
   `svelte-check` and a build. The 24 new strings are argued against the code, **not read**.
3. **`adoptForReapply` is still not a route a caller is forced through**, and 2c-4b-1's two risks are
   unchanged — see the 2c-4b-2 record below, which 3a did not alter.

#### What 3b must do

Rebuild the instrument to `docs/decisions/2c-4a-3c-1-instrument.md`'s mechanism — a fresh bundle path
per launch, a synthetic config, the language set **explicitly through the picker** and never trusted
from the launch environment, one plan per launch, an external filesystem writer that touches no
workspace or cache, and synchronization **from the plan rather than `sleep`**. Then add what Q7 asks
of it: two complete neutral fixture variants per case, the second writer copying the selected R1 file
atomically over `conflict.yml` after the probe's "surface ready" point, and a byte comparison of the
final file against the expected post-reapply bytes. Prove the instrument before the reading depends
on it, exactly as 2c-4a-3c-1 did — that step's whole value was demonstrating a **true**
`SaveResult::Conflict` from a running WKWebView before anything was read. **The harness is
deliberately uncommitted**, and 3d deletes it again.

---

### The record that closed 2c-4b-2 (superseded by the above, kept for its rationale)

### Phase 2c-4b-2 is complete. **Step 2c-4b-3 is next.**

**Reapply exists as a value on five surfaces and nothing draws it.** The exact first commands to run:

```sh
npm install && npm test        # expect 1587 passed, 49 files
cargo test --workspace         # expect 1086 passed, 0 failed
```

(`npm run check` expects **418 files, 0 errors, 0 warnings**. `npm run build` expects **175
modules** — 174 at step 1 plus exactly one new source module, `src/lib/browser/reapply.ts`; the
guard is the *shape* of the change, and a jump to ~180 with `svelte/internal/server` in the bundle is
the regression it exists to catch. i18n is **745** keys per language, at parity and **unchanged** —
this step added no user-facing string, because it draws nothing.)

#### What step 2 actually shipped

`src/lib/browser/reapply.ts` is the shared part of *Keep my draft*: **the gate** (`beginReapply`, the
only reader of the new permanent `ConflictCapabilities.reapplySupport`), **the two evidence readers**
(`subjectCorrespondence` and `anchorCorrespondence`, which turn step 1's two wire enums into the
three answers a surface can act on), the three-armed `ReapplyOutcome<S, O>`, and **the adoption**
(`adoptForReapply`, which spends the conflict's one authorization through the existing
`BrowserState.adoptDiskVersion` door — no parallel weaker door was built).

One pure transition per surface, all **decide-first-adopt-second**, so a refusal spends nothing and
leaves the window exactly where it was: the editor's Q4 six-row field table with **whole-operation**
collision refusal; the creator's targetless rebase with consent withdrawn and `after` retained only
on exact anchor correspondence; strict exact correspondence for delete (confirmation re-asked against
the live projection) and duplicate (consent cleared); move with a `SequenceAddress` equality
requirement, the destination rebuilt from the new sequence, `top`/`end` lowered afresh and
`alreadySatisfied` reported without writing; and the raw editor **permanently `unavailable`**, its
transition taking no adoption function at all.

**Nothing is drawn, and that is the proven trade taken again.** `ConflictChoice` has no member a
reapply control could be named by, `conflictChoicesFor` is byte-for-byte as 2c-4a-3 left it, no
dictionary key was added, and **no `.svelte` file was touched** — so no mounted-component and no
window evidence is owed by this step. 2c-4b-3 flips capability over machinery that already exists and
is already driven by tests, exactly as 2c-4a-3a did for the reload.

#### The planned `offersReapply: false` boolean was not built, deliberately

The consult's step-2 paragraph asked for it. What shipped instead is
`ConflictCapabilities.reapplySupport: 'supported' | 'unavailable'` — a **permanent** fact about the
surface, like `draftKind` and `reloadOutcome`, read by `beginReapply`. The argument, recorded in
`2c-4b-2-notes.md` §2.1 and in the field's own doc comment: a boolean saying *this surface draws it
today* would have nothing to produce and nothing to read it while `ConflictChoice` has no reapply
member, and `saveOutcome.ts` already names a declaration nothing reads as "a second answer" — the
defect that once let a button compile and do nothing. **2c-4b-3 adds the boolean and the
`ConflictChoice` member together.**

#### Four review rounds, and what converged

**Round 1 — NOT READY**, 2 Mediums + 2 Lows, and it found this step's only algorithmic defect: the
reapply authorization was keyed on the **derived `ConflictModel`**, so two descriptions of one wire
conflict could each win a successful adoption spend. It is now a
`WeakMap<ConflictResult, ReloadConfirmation>` keyed on `conflict.source` — the same wire value
`rememberTheConflict` keys on — so the second description receives the first's token and
`authorizeDiskAdoption` refuses it.

**Rounds 2, 3 and 4 found no algorithmic defect at all.** Every remaining finding was this
repository's named worst class — *a sentence claiming a guarantee the code does not give* — and the
same one kept reappearing: **`BrowserState.adoptDiskVersion`'s guards described as a set of five
checks applied alike, when they are an ordered sequence.** Authorization, spend, origin and
projected-document precede **every** successful answer; `alreadyThere` is then decided **and its
token spent** before the projection generation is inspected at all, so the generation comparison
guards only the branch that installs. That claim was wrong in four places and took **three rounds**
to close, each sweep having been written from the previous finding's wording rather than from what
the method does. Round 4 is **READY**.

The reviews are `docs/reviews/phase-2c-4b-2-code.md` and `phase-2c-4b-2-code-round2.md`. **Rounds 3
and 4 have no review file** — Codex returned its verdict without writing one — so
`docs/decisions/2c-4b-2-notes.md` §9 is their only record, and it reproduces round 3's finding in
full. The record is `2c-4b-2-notes.md`, §§7–9 covering the three fix rounds.

#### Three things 2c-4b-3 inherits as stated risk

1. **`adoptForReapply` is not a route a caller is forced through.** `reapplyAuthorizationFor`,
   `confirmReloadDiskVersion` and `BrowserState.adoptDiskVersion` are all exported and compose
   directly, and `AdoptTheDiskVersion` is an ordinary function type, so an arbitrary callback can
   ignore both token and spend. What holds is an **implementation fact** — every transition that
   adopts takes this route, and each surface's suite keeps it that way — plus one run-time check
   inside the door: no adoption for a conflict the window never registered.
2. **One prose defect was deliberately left standing.** `src/lib/browser/workspace.svelte.ts:615`
   still reads *"Five things are checked here, in order"* — the oldest instance of the ordering
   defect above, shipped and committed at 2c-4a-2 and therefore outside this step's diff. Recorded in
   `2c-4b-2-notes.md` §8.4 and §9.2. **2c-4b-3 touches that area and should close it.**
3. **Step 1's two risks are unchanged**: `ReapplyEvidence` ties two fields nothing in Rust or
   TypeScript can bind together, held only by its single production construction site; and the
   command-level tests observe *answers*, not requests, so a seventh writing command with a wrong
   request needs a fifth test (`2c-4b-1-notes.md` §7.4).

#### What 2c-4b-3 must do

Per the consult's Q6 and Q8: add `keepMyDraft` to `ConflictChoice` and to **`conflictChoicesFor`
only** — never appended locally by a surface — produce it after *Keep editing* and the copy and
before the reload, flip capability on the five eligible surfaces with raw declaring it unavailable,
wire the component handlers and `DetailPane` props, render typed readiness/refusal/collision
sentences through accessors in both dictionaries (components never compose a key), give every changed
component a mounted interaction test proving the offered choice invokes its model transition and that
raw never offers it, and then run and record **the deterministic R0→R1 window matrix of Q7's eight
readings**, re-taking any surface whose component changes during a fix round.

**The sentence beside the control is the thing most likely to be wrong.** Q6 lists what it must not
claim: that the same snippet has been found before the resolution says so, that every draft can be
kept, that all fields will merge, that nothing else changed, that the next save will succeed, that the
file cannot change again, that the result is a byte-for-byte copy of the old item, or that espanso
will accept it. The i18n suites check keys and placeholders, **not meaning**.

---

### The record that closed 2c-4b-1 (superseded by the above, kept for its rationale)

### Phase 2c-4b-1 is complete. **Step 2c-4b-2 is next.**

**`3451a81` is `HEAD`** — step 1 with **all three review rounds folded in**, so, as with every
phase since `8989c16`, no commit holds a demonstrated defect. The exact first commands to run:

```sh
npm install && npm test        # expect 1499 passed, 48 files
cargo test --workspace         # expect 1086 passed, 0 failed
```

(`npm run check` expects **416 files, 0 errors, 0 warnings** — 415 at the consult plus
`src/lib/i18n/reapplyCodes.test.ts`. `npm run build` expects **174 modules**, *unchanged*: everything
step 1 added to the frontend is a type, a dictionary entry or a test, and **no new source module**, so
the guard's shape rule says the number must not move. i18n is **745** keys per language, at parity.)

#### What step 1 actually shipped

`crates/espansoconfig-core/src/reconcile.rs` is the correspondence primitive: `ReapplyAnchor`
(document + sequence path + owned-run digest + mapping-slice digest + exact trigger-form fingerprint
+ base-uniqueness), `ReapplyConfidence`, `ReapplyMode`, `PlacementMode`, `ReapplyRequest`,
`ReapplyPlacement`, `ReapplyEvidence`, nine `ReapplyRefusal` variants and four `ReapplyResolution`
variants. **The tier walk never reads the item index** — it is carried for diagnostics only.
Ownership evidence is a `pub(crate) item_owned_runs` over the **existing** `entry_owned_runs`, so no
second copy of the ownership rules exists; the confirmation round verified that.

**The anchor is captured before the transaction and resolved against the exact fresh snapshot.**
`view_at` became `document_at` so the pre-transaction snapshot is returned rather than re-read, and
`conflict_after_the_lock` remains the **sole** production `SaveResult::Conflict` construction site:
it refreshes once and takes `subject`, `placement`, `disk`, `disk_text` and `disk_revision` from that
one `SourceDocument`. That is consult Q9 item 2's failure mode designed out, and round 2 confirmed it
in production.

**The step is evidence only** — no path reads the answer and no written byte depends on it. Six
writing commands build a request; raw answers `Unsupported` and a `Front`/`End` creation answers
`Targetless`.

#### The High, and why the wire shape changed mid-phase

Round 1's High: **a move placed `after` another snippet carried only half its evidence.** Only the
moved item's anchor was threaded, so 2c-4b-2 could not have learned whether the requested destination
was still expressible without recreating the core algorithm or guessing by position. The fix is a
deliberate wire-shape change — `ReapplyEvidence { subject, placement }`, with **placement always
`ExactItem` and no parameter able to weaken it** — and round 2 ruled it closed in production, along
with the two deviations it forced: a creation's `after` anchor now answers in `placement` rather than
`subject` (a refinement of the consult's Q3 single-resolution sketch, not a departure from Q4), and
`code.reapplyResolution.targetless` was reworded because moving that anchor made its old clause false.

#### Three rounds, and what each one cost

**Round 1 — NOT READY**, 1 High, 3 Mediums, 2 Lows. **Round 2 — NOT READY**: four closed, **two still
standing, two new**. **Round 3** closed all four and its own sweep found **three more**. The recurrence
is this repository's documented one — *each round's fix produced the next round's finding* — and every
survivor was a **narrower instance** whose search had been written from the previous wording.

The sharpest survivor: `NoExactCorrespondence` compares **owned-run digests**, while both dictionaries
still claimed the whole snippet was not written exactly the same. The repo's own
`a_comment_changing_hands_separates_the_two_exact_tiers` is the counterexample — the mapping is
byte-identical while exact owned-run correspondence refuses. Two more of the same kind: the generic
`Refused` sentences claimed a search "in the file as it is now" although `NoAnchorInBase` is returned
**without ever consulting the fresh snapshot**, and `docs/decisions/2c-4b-1-notes.md` §4.3 claimed `{}`
was "deliberately not accepted" while the code **did** accept it — the record claiming a guarantee the
code did not give, which is this project's named worst defect class and which no test can fail.

**Two tests could not have failed, and both were rebuilt.** The R1/R2 interleaving test passed
`ReapplyMode::Unsupported`, an arm that never reads the snapshot — so the one property it existed to
pin was unfalsifiable. And both corpus sweeps `continue`d on refusal, letting a mutation that newly
refuses a class **delete that class from its own audit** while the count stayed above the threshold.
Eligibility is now stated independently of `capture`, every eligible target must capture or the test
panics with the fixture name, and a present real corpus must be non-zero.

**Falsifiability was proved by mutation, not asserted.** Round 3's four command-level conflict tests
were checked by applying and reverting four mutations one at a time — move placement→`NotAnchored`,
create placement→`NotAnchored`, delete→weak confidence, save→`ExactItem` — each flipping exactly one
assertion. That closed the hole where **nothing pinned the command-to-request mapping at all**: the
core cases built `ReapplyRequest` directly in a test helper, so flipping the production move to
`NotAnchored` would have left every test green.

#### Two things 2c-4b-2 inherits as stated risk

1. **`ReapplyEvidence` ties two fields nothing in Rust or TypeScript can bind together.** As with
   `disk_text`/`disk_revision`, only the single production construction site holds the pairing. A
   second site, or an anchor derived after the cache refreshed, makes a correct algorithm resolve the
   wrong observation.
2. **The command-level tests observe *answers*, not requests.** They pin each writer's policy only
   through a fixture in which exact and trigger-only correspondence disagree — a later edit to
   `POLICY_DISK` could make them agree and the discrimination would vanish silently. Nothing
   enumerates the writers either, so a seventh writing command with a wrong request needs a fifth
   test. Both are recorded in `2c-4b-1-notes.md` §7.4.

The reviews are `docs/reviews/phase-2c-4b-1-code.md` and `phase-2c-4b-1-code-round2.md`; the record is
`docs/decisions/2c-4b-1-notes.md`.

#### The consult's verdict, and the cut it forces

**2c-4b is one honest path from a retained conflict to a new ordinary save attempt — not a general
merge or recovery system.** Adopt the revision-bound disk snapshot 2c-4a already captured, establish
a **conservative correspondence** in that snapshot, rebuild the pending edit or operation against the
new projection, withdraw the old consent, and submit through the existing command and the one save
transaction. **An ambiguous or missing target is a refusal that writes nothing**, and recovery when
reapply refuses stays 2c-4c's, whole.

**Correspondence has two confidence policies, and that asymmetry is the phase's core decision.** The
match editor may fall back from exact item identity to a **unique unchanged trigger**, then performs
per-field collision checks. **Delete, move, duplicate and every positional anchor require exact item
correspondence** — the item index is never a tie-break. The creator is targetless and is revalidated
against the new destination instead.

**The raw editor gets no reapply at all.** A whole-document text draft has no match to identify and
blindly overwriting is forbidden by the plan itself, so raw answers `unsupported` and its only
honest options remain 2c-4a's plus 2c-4c's fallback.

| Step | Scope | State |
|---|---|---|
| **2c-4b-1** | The core `reconcile` primitive, the anchor/fingerprint construction, the refusal enum, and `ConflictResult.reapply` on the wire — **built from the same fresh snapshot as `disk_revision`**. No control is added, so 2c-4a's behaviour is unchanged and the new payload is only evidence | ✅ complete — three review rounds |
| **2c-4b-2** | Reapply as browser-model transitions, one per surface, with **`offersReapply: false`** — the proven trade of building and testing an unoffered transition before drawing it. No component changes, so no mounted or window evidence is owed | ✅ complete — four review rounds. The planned boolean was **not** built; `ConflictCapabilities.reapplySupport` is what shipped, and §2.1 of the record argues why |
| **2c-4b-3** | `keepMyDraft` added to `ConflictChoice` and to **`conflictChoicesFor` only**, the capability flipped on the five eligible surfaces, both dictionaries, the mounted suites, and the deterministic R0→R1 window matrix | ⬜️ |

**Why not two steps, in the consult's own words:** if core and UI land together, one review must
simultaneously prove byte ownership, cross-revision identity, field collision, adoption spending,
five handlers and prose — and *the algorithmic error the split warns about hides under presentation
volume*. If the label lands before the transitions, the UI claims the phase exists while still
meaning *keep editing*, which is the exact naming prohibition this phase was created to lift.
**Splitting by surface is also wrong**: it duplicates one confidence rule and makes the first
renderer the de facto authority for the others.

#### Three things the consult says will bite, recorded before they do

1. **A sentence will claim a guarantee the predicate does not give** — *"same snippet"* on a
   trigger-only provisional match, *"all changes reapplied"* when some were merely already satisfied,
   *"nothing changed"* when only the target's owned bytes matched. This repository's worst defect
   class, and no test can fail one.
2. **Evidence from R0 or R2 will be presented as if it belonged to the conflict's R1.** The old
   anchor must be made *before* the transaction and the resolution taken from the exact fresh
   snapshot, bound to `disk_revision`; `conflict_after_the_lock`'s single construction site is what
   holds that today (`src-tauri/src/commands.rs:1288-1313`, verified this session). A convenient
   later `get_document` destroys it, and then a perfectly correct algorithm resolves the wrong
   observation.
3. **Reprojection will make a correct model act on a stale selection or a stale move anchor after an
   `await`.** Revalidate document, projection generation, selected intent, target, anchor and the
   same-sequence relation **at the call boundary**, in the final synchronous block — the guard this
   project has already needed once. For move, R25 stays visible in the test: the submitted batch is
   still exactly one move.

---

### The record that closed 2c-4a (superseded by the above, kept for its rationale)

**Step 3c closed the whole of 2c-4a**, and with it plan §12's "conflict capture and preservation".
All six write surfaces draw a conflict panel, a person can choose on every one of them, and the
choices have now been **seen on a screen** rather than inferred from a suite.

**The reading found a defect class no suite in this repository can fail**, and the two Codex rounds
found two more of the same kind: **six of the eight findings across step 3c were sentences or
records claiming something the code does not do.** None of them changed a byte written to disk.

**`3f34007`** is step 3c's commit — the implementation, both Codex rounds' fixes, the review file and
all five decision records together, so no commit holds a demonstrated defect — and it is where a
fresh session begins (`eb19c36` was the base). The exact first commands to run:

```sh
npm install && npm test        # expect 1482 passed, 47 files
cargo test --workspace         # expect 1048 passed, untouched since 2c-4a-1
```

(`npm run check` expects **415 files, 0 errors, 0 warnings**. `npm run build` expects **174
modules** — 172 at 2c-4a-3a plus exactly two new source modules,
`src/lib/components/reveal.ts` and `src/lib/browser/draftKind.ts`; the guard is the *shape* of a
change to that number, `CLAUDE.md` §6. i18n is **729** keys per language, at parity — 726 at 3b plus
`choice.keepOperation`, `rawEditor.diskLineEndingsNotPreserved` and the `reloadUnavailable`
operation-choice twin.)

### What step 3c settled, in one place

**The instrument.** A true `SaveResult::Conflict` **is** reachable from a window, and the second
writer must be an **external filesystem process**. This application's own raw-save IPC can never
produce one — it refreshes the same Rust workspace cache, so `view_at` answers
`identityStaleRevision` before the transaction. That excuse had stood since 2c-3b and it was the
*instrument* that was wrong, not the outcome that was unreachable.
`docs/decisions/2c-4a-3c-1-instrument.md` §2 is the recipe and **§5 is the list of mistakes already
paid for** — read it before ever building this harness again.

**The reading.** `docs/decisions/2c-4a-3c-2-window-reading.md`: 25 launches, six surfaces, both
languages, **1 High, 2 Mediums, 2 Lows, 4 Observations**, and **no defect in what is written to
disk**. The High was `browser.matchCreation.revisionExpected` in Spanish saying the snippet *se ha
escrito* — *had been written* — **four lines under the sentence saying nothing was written**, on the
one panel whose entire job is to make that unambiguous.

**A rule stated once.** `src/lib/browser/draftKind.ts` is new and holds
`draftKindWording<T>(draftKind, { authoredText, operationChoice })`, generic so a key function and a
message-code describer are not two rules. **Five callers**: `conflictChoiceKey`,
`reloadUnavailableKey`, `reloadWarningFor`, `describeConflict` and `rawSaveChoiceKey`. The one
remaining bare `draftKind === 'authoredText'` in production is `conflictChoicesFor`'s copy guard,
documented as deliberately not this rule and confirmed as such by review round 2.

**Three instances of one defect, closed together.** *Keep editing* was drawn where nothing is being
edited in **three** places, each found by a different instrument and each a narrower instance of the
one before: `conflictChoiceKey`'s label (the reading), `rawSave.ts`'s refused-arm label (Codex round
1), and `browser.saveOutcome.reloadUnavailable`'s sentence (the orchestrator's own sweep). **The
round that fixed the first argued explicitly for deferring the second**, and review round 1 ruled
that deferral unsound: *the age of `rawSave.ts` does not make its output truthful, and absence from a
prior transcript is a gap in evidence, not evidence that a reachable label is correct.*
`2c-4a-3c-3-notes.md` §2.2, §2.3, §4.3 and §7.3 carry correction blocks saying so, with the rejected
reasoning left legible beside its refutation.

**The refusal arm was drawn for the first time in this project** at 3c-4's re-take. It was the
previous round's whole justification for deferring — *"no window reading has ever drawn that arm"* —
and the fix round drew it: *Leave this as it is* / *Dejarlo como está* on the duplicator, the mover
and the deleter, with *Keep editing* unchanged on the match editor.

**A panel nobody could see.** The match editor's conflict panel opened at **y = 720** in English and
**y = 771** in Spanish inside a **728 px** viewport, 1 044 px tall, with `section.detail`'s
`scrollTop` at `0` and nothing moving it — so a person who pressed *Save this snippet* and hit a
conflict saw **eight pixels of it in English and none of it in Spanish**, and what was invisible was
*the statement that nothing was written*. The panel is `role="status"`, so a screen reader was told
throughout: **this was never an accessibility failure and the fix is not an accessibility fix.**
`outcomeReveal` now lives in `saveOutcome.ts` with `OutcomeArm` **derived from** `SaveOutcomeModel`
rather than restated, and it carries **arm identity** (`savedPanel` / `refusedPanel` /
`conflictPanel` / `conflictChoices`) — because a cue that mapped every arm to one value would not
re-fire when `refused` was replaced by `saved` with no `null` interval between them, which is the
`saveAnyway` path. `src/lib/components/reveal.ts` keeps only the guarded `scrollIntoView`.

**An exhaustive claim is a claim.** Review round 2's only finding: three passages said
`adoptDiskVersion` answers `refused` **only** for three causes, and the implementation has **five**.
The narrow conclusion was right and the proof was not, so all three now name five guards and argue
the UI's unreachability separately — keeping the mounted-only coverage limit and **not** turning the
22-launch absence into stronger evidence than it is. `2c-4a-3c-5-notes.md` is that fix and the
probe's removal.

### What 2c-4b inherits, and the two things it must not misread

1. **`reloadUnavailable`'s two sentences are not reachable from a window** and are covered by mounted
   tests only. No control on a conflict panel can move a projection generation. That is stated
   plainly in three records and must not be quietly upgraded.
2. **"Keep my draft" is still forbidden as a name and as a code until 2c-4b, and 2c-4b is now.**
   `CLAUDE.md` §6 makes it absolute *before* this phase; there it means **rebase the draft onto the
   newly parsed document**, which is 2c-4b's actual work. The words become available exactly when the
   thing exists.

The 2c split table above is the plan of record for what remains: **2c-4b** (reapply — identify the
intended match in the newly parsed document and apply only when confidence suffices; fails as an
*algorithmic* mistake), then 2c-4c, 2c-5, and 2d.

---

### Step 3c ran in five steps, and this is the record of the cut (superseded, kept for its rationale)

**Step 3c — the window reading for all six write surfaces — was cut, and the cut is recorded here
because it is not in `2c-split-notes.md`.** The reason is the *instrument*, not the size: consult
Q7's recipe — a second writer that is an external filesystem process — had **never been
demonstrated**, and every earlier reading used this application's own raw-save IPC, which refreshes
the same Rust workspace cache so `view_at` answers `identityStaleRevision` before the transaction
and no conflict is ever reached. A reading plan written on an unproven instrument is a reading that
discovers, twenty launches in, that it measured nothing.

**It became four rather than three when 3c-2 found five defects.** Fixing them and re-taking the
reading is a step's worth of work on its own, and doing it in the same breath as deleting the
harness would have meant deleting the instrument the re-take needs.

| Step | Scope | State |
|---|---|---|
| **3c-1** | The harness, and the proof that a true conflict reaches a window | ✅ complete |
| **3c-2** | The reading itself, six surfaces, both languages | ✅ complete — 1 High, 2 Mediums, 2 Lows |
| **3c-3** | The fixes, and the re-take over every component they touch | ✅ complete — all five closed |
| **3c-4** | The probe's removal, the hooks restored by hand, and the commit | ⬜️ **next** |

**3c-3's verdict: all five closed, and one more with them.**
`docs/decisions/2c-4a-3c-3-notes.md` is what changed and why;
`docs/decisions/2c-4a-3c-3-retake.md` is what a screen did afterwards — sixteen launches, L33
through L48, **all sixteen reaching `--- end` with a zero-byte `probe.err`**, fourteen writing
nothing at all and two writing deliberately as the byte check's own control.

- **§10.1, the High** — the Spanish creator line claimed the snippet had been written, four lines
  under *No se ha escrito nada*. It is *se redactó sobre* now, and **the English moved with it**
  (§10.6's Observation): *drafted against*, not *written against*. The reason for moving both is in
  `2c-4a-3c-3-notes.md` §2.1, and the point that decided it is that **a rule with a hole where the
  defect was is worse than no rule**.
- **§10.2** — `conflictChoiceKey` now branches `keepEditing` on the draft kind, so the deleter, the
  mover and the duplicator draw *Leave this as it is* / *Dejarlo como está* instead of an offer to
  keep editing something nobody was editing. **The doc comment that argued for the defect is
  corrected in the same change.**
- **§10.3 and §10.4** — `src/lib/components/reveal.ts` scrolls the outcome panel into view when it
  appears and the controls into view at the reload's second step, on **all six** surfaces. The
  match editor's panel went from y = 720 (en) / y = 771 (es) to **y = 44 in both**, and the
  confirmation control lands at y = 666–667 `inView=true` on twelve launches.
- **§10.5** — the raw editor's refused reload has a reload-specific sentence
  (`rawEditorDiskRefusalKey`), so the reason for a disabled control is no longer a sentence about a
  different one.
- **And `2c-3c-3-window-reading.md` §10.2's own Low**, the committed panel below the fold, closed as
  a side effect: the reveal is every arm's, not the conflict's, deliberately.

**Two things 3c-4 inherits.** The wording invariant added in `src/lib/i18n/dictionaries.test.ts` is
the first executable check in this repository over what a sentence *claims* rather than over its
parity — it fires on any `revisionExpected` value, in either locale, that uses a verb of writing,
and it keeps its own word list falsifiable. And **`rawSave.ts`'s `keepEditing` still says *Keep
editing* on the refused arm** of the three operation-choice surfaces: the same defect one arm along,
recorded and deliberately not fixed, because no window reading in this project has ever drawn that
arm (`2c-4a-3c-3-notes.md` §2.2).

**3c-1's verdict: the recipe works.** `docs/decisions/2c-4a-3c-1-instrument.md` is the record.
Seven launches, **all seven reaching their own `--- end` with a zero-byte `probe.err`**; true
`conflict` outcomes on `MatchEditor`, `MatchMover` and `MatchDuplicator`, in both languages, by two
independent second-writer routes; the same three revisions in every one, with `expected ≠ found`,
which is a real locked-read mismatch and not an identity refusal. **No launch wrote anything** —
every tree was compared whole against a pristine pre-launch copy and the only difference was the
external writer's own 36 bytes, with **no `.espansoconfig-backups` directory created at all**.

Five things 3c-2 must not re-derive, all in §5 of that record: `npm run build` alone changes
nothing (the bundle embeds `dist` at *cargo* build time, so `touch src-tauri/build.rs && cargo build
-p espansoconfig --features custom-protocol` must follow it — that is what launch L06 cost); the
second writer is **spawned inside the plan**, never scheduled by wall clock, because a `sleep`-timed
writer races start-up and silently opens the surface at R1 where no conflict is possible; the probe
registers its commands **beside** `main.rs`'s `generate_handler!` list rather than inside it,
because `wire_contract::registered_commands()` parses that list textually; the picker beats the
leaked `localStorage` override and the leak is real; and the conflict panel is **drawn below the
fold** in an unscrolled pane, so a plan reporting only what is inside the viewport reports an empty
panel. **`RawEditor`, `MatchCreator` and `MatchDeleter` were not driven** — consult Q7's points 1, 3
and 4 remain claims.

### The working tree is not clean, and that is deliberate

**`eb19c36` is still `HEAD`, and the probe harness is uncommitted on purpose.** `src/probe.ts` and
`src-tauri/src/probe.rs` are temporary and **may never be committed**; `src/main.ts` and
`src-tauri/src/main.rs` each carry two clearly-marked temporary hook lines that are restored by hand
when the probe is deleted. A fresh session resuming here inherits that tree, and the scratch harness
with it:

```
src/probe.ts                                  new,      temporary — delete at 3c-4
src-tauri/src/probe.rs                        new,      temporary — delete at 3c-4
src/main.ts                                   modified, two hook lines — restore by hand at 3c-4
src-tauri/src/main.rs                         modified, two hook lines — restore by hand at 3c-4
docs/decisions/2c-4a-3c-1-instrument.md       new,      keep and commit
docs/decisions/2c-4a-3c-2-window-reading.md   new,      keep and commit
docs/decisions/2c-4a-3c-3-notes.md            new,      keep and commit
docs/decisions/2c-4a-3c-3-retake.md           new,      keep and commit
src/lib/components/reveal.ts (+ its suite)    new,      PRODUCTION — keep and commit
```

Everything 3c-3 changed under `src/lib/` **is production and is committed with the step**; only the
five probe lines above are temporary. `src/probe.ts` carries three additions of its own from 3c-3
(a `noscroll` flag, a `nowriter` flag and the `reveal:` scroll-position line) and they go with it.

`<scratch>/launch.sh` and `<scratch>/launches/L01…L48/` live in
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/5297a7df-1f6e-4dca-8b0a-f02a92f3b872/scratchpad`,
outside the repository. **If that scratch directory is gone, rebuild `launch.sh` from
`2c-4a-3c-1-instrument.md` §2 — the harness in `src/` and `src-tauri/src/` is the part that matters
and it is on disk.**

With the harness in the tree the gate numbers move, and each move is explained rather than
tolerated. After 3c-3, and **only the last line of each is the probe's**:

```sh
npm test        # 47 files, 1464 tests. 1427 → 1464 is accounted for line by line in
                #   2c-4a-3c-3-notes.md §6, including the +2 in `ipc-detail.test.ts`, which
                #   sweeps every .ts under src/ and therefore counts reveal.ts and its suite.
                #   Of the 1464, one is probe.ts's row in that same sweep
npm run check   # 415 files. 413 → 415 is reveal.ts and reveal.test.ts; one of the 415 is probe.ts
npm run build   # 174 modules — 172, plus reveal.ts, plus probe.ts. The "moved by exactly the
                #   number of new source modules" shape, not the resolve.conditions regression:
                #   checked, `rg -c "internal/server|async_hooks"` over the bundle finds nothing.
                #   It returns to 173 when the probe is deleted
cargo test --workspace   # 1048, unmoved. cargo test -p espansoconfig 149, unmoved
```

### Next: Phase 2c-4a step 3c-4 — remove the probe, then commit

**Everything step 3 owes is delivered.** 3a and 3b drew the six panels, 3c-2 read them in a running
window and 3c-3 fixed and re-read everything the reading found. What is left is mechanical and is a
step of its own only because it must not be done before a re-take:

1. **Delete `src/probe.ts` and `src-tauri/src/probe.rs`**, and restore the two hook lines in each of
   `src/main.ts` and `src-tauri/src/main.rs` **by hand** — they are marked. `probe::register_with_probe`
   calls `crate::register` and then replaces the handler, leaving `main.rs`'s own
   `generate_handler![…]` untouched, which is why `wire_contract::registered_commands()` still
   passes with the harness in the tree; restoring it is removing two lines, not reconstructing one.
2. **Re-run every gate and check the numbers move the way removal predicts**: `npm run build` should
   go **174 → 173** and `npm run check` **415 → 414**, both by exactly one, and `npm test` should
   lose exactly the one `ipc-detail.test.ts` row `probe.ts` contributes. A different shape is a
   different problem (`CLAUDE.md` §6).
3. **Commit**, with `PROGRESS.md` updated in its own commit as every other step of this phase has
   been. `docs/decisions/2c-4a-3c-{1,2}-*.md` and `2c-4a-3c-3-{notes,retake}.md` are all kept.

**Nothing in `src/lib/` is temporary**, including `src/lib/components/reveal.ts` and its suite:
those are 3c-3's fix for findings 10.3 and 10.4 and are production.

**Two things step 3 hands on rather than closes**, both recorded rather than left to be rediscovered:

- **`rawSave.ts`'s `keepEditing` still says *Keep editing* on the refused arm** of the mover, the
  deleter and the duplicator — the same defect as finding 10.2, one arm along. Not fixed, because
  `refusalChoices` carries no draft kind and **no window reading in this project has ever drawn that
  arm**; fixing a sentence nobody has seen on the strength of a reading that did not see it is how
  the previous round's fix became the next round's finding (`2c-4a-3c-3-notes.md` §2.2, §4.3).
- **`browser.saveOutcome.reloadUnavailable`, `adoptDiskVersion`'s `alreadyThere` and `refused`, and
  `moveAfterSnippetNoLongerShown` are unreachable from a window**, as a property of the screens
  rather than of the launches (`2c-4a-3c-2-window-reading.md` §7.4, §11). They keep model-suite and
  mounted evidence only, permanently, unless a later phase gives a conflict panel a control that can
  move a projection generation.

**What 2c-4a as a whole must still not do**, unchanged from the consult and carried into 2c-4b: no
`saveAnyway`, no retry of the stale candidate, no automatic reload, no clearing of dirty state on
conflict, **no cross-revision identification of "the same match"**, no YAML emitted from a
projection, no diff, and **no control named or coded "keep my draft"** — `CLAUDE.md` §6 makes that
absolute before 2c-4b.

---

**Phase 2c-4a step 3b (superseded by the above, kept for its rationale) is complete: all six write
surfaces now draw a conflict panel.** The mover,
the deleter and the duplicator declare `offersReload: true`, and their panels show the disk side
through `SourceText`, a **retained operation summary** where the other three show authored text,
all three revisions, the two-step *Load the version on disk* → *Close this and load it*, and the
refused-reload disclosure they had carried since 3a with nothing rendering it.
**`offersCopyDraft: false` is untouched on all three and is permanent** — consult Q4 refuses a copy
for a `MovePlacement` or a `MatchId` as a property of the drafted value.

Step 3b also **went beyond its brief and found a defect by doing so**: the shared conflict
sentences described text nobody typed on those three panels, so `describeConflict` now branches on
`draftKind` and `conflictChoiceKey` takes a **required** `ConflictDraftKind`. Round 1 ruled the
widening justified and verified the three pre-existing panels come out **byte-identical in rendered
wording**. It also closed the item the previous checkpoint flagged: `MatchMover.svelte:511`'s
in-component precedence rule is now `notMovableToShow` in `matchMove.ts`.

**Two review rounds: NOT READY on two Medium and one Low, then READY with no findings.** The
disposition is "Phase 2c-4a step 3b review disposition" above; the counts are in "Verification —
Phase 2c-4a step 3b".

**Step 3c is next, and it is step 3's exit.**

**`5f39499`** is step 3b's commit — implementation, both review rounds' fixes, the review file and
the decision record together, so no commit holds a demonstrated defect — and it is where a fresh
session begins (`59c8105` was the base). The exact first commands to run:

```sh
npm install && npm test        # expect 1426 passed, 46 files
cargo test --workspace         # expect 1048 passed, untouched since 2c-4a-1
```

(`npm run check` expects **412 files, 0 errors, 0 warnings**. `npm run build` expects **172
modules** — **unchanged**, because step 3b added no source module; the guard is the *shape* of a
change to that number, `CLAUDE.md` §6. i18n is **726** keys per language, at parity.)

### Read this before starting step 3c

`docs/reviews/phase-2c-4a-design.md` governs the whole phase, and its **Q7** is the recipe below —
read it first, because the instrument is the thing this step is most likely to get wrong.
`docs/decisions/2c-4a-3b-notes.md` is step 3b's record; its §8 is written as the handover to this
step and names three things worth putting on the reading's list. `docs/reviews/phase-2c-4a-3b-code.md`
holds both review rounds. `docs/decisions/2c-4a-3a-notes.md` §4 lists the holes 3a left that a
reading is the right instrument to judge.

### Next: Phase 2c-4a step 3c — the window reading, for all six write surfaces

**The reading is owed for six surfaces, not three.** It was already owed for six before this step:
3a's fix round migrated `RawEditor.svelte` onto the shared clipboard module, and **a window reading
is re-taken after any change to a component**. Step 3b then added three panels that have never been
seen *and* its fix round put **new prose on five surfaces**, four of which were the subject of no
finding — so the reading has more to check than it did when 3a handed it over.

**The recipe, from consult Q7.** Open the surface at revision R0, then — **without invoking any app
command that reloads the document** — use a **shell or editor process** to append a valid YAML
comment to that exact file, producing R1. The frontend and the Rust cache stay at R0, `view_at`
passes, and the core's locked read sees R1. This application's own raw-save IPC does **not** work as
the second writer, which is what made a true conflict look unreachable since 2c-3b: it refreshes the
same Rust workspace cache, so `view_at` answers `identityStaleRevision` before the transaction. That
proved the *instrument* wrong, not the outcome unreachable.

**One plan per launch, into a fresh bundle path**, and set the language **explicitly through the
picker** — the webview's `localStorage` follows the **bundle identifier**, not `HOME`, so an
override set by one launch is still in force in the next, and two launches of 2c-2-2's reading
failed by looking for an English control on a Spanish screen. A WKWebView whose window is occluded
stops running `setTimeout` about six seconds after launch; `open -a` does not restart it and
LaunchServices silently drops `--env` for a bundle path it thinks is already running.
`docs/decisions/1c-2b-2b-2-notes.md` §6.1 is the technique.

**What the reading must judge that no suite can.** The clipboard on the two authored-text panels —
jsdom proves the fallback route runs, not what lands on the pasteboard, and the carriage-return
refusal is a claim about a real WKWebView. The legibility of a two-column comparison beside a whole
file's text. Whether the operation summary reads as a description of what was asked for rather than
as an instruction. The mover's **two** `reloadWarning` arms, which need a `top`/`end` conflict and
an `after` conflict to both be staged. And the five renamed confirmation lines checked against the
shared warning above them, in **both** languages, for the duplication step 3b's finding 3 removed.

**One thing step 3c inherits and must not undo.** After a match conflict is dismissed, a second
submission is refused by `view_at` with `identityStaleRevision` — **not** by a second conflict —
because `conflict_after_the_lock` already refreshed the Rust cache. Only a raw save reaches the
locked check twice. Write-safe either way, but they are different sentences.

**What step 3c must not do**, unchanged from the consult: no `saveAnyway`, no retry of the stale
candidate, no automatic reload, no clearing of dirty state on conflict, **no cross-revision
identification of "the same match"** (that is 2c-4b's confidence work), no YAML emitted from a
projection, no diff, and **no control named or coded "keep my draft"** — `CLAUDE.md` §6 makes that
absolute before 2c-4b. A defect the reading finds is fixed and the reading **re-taken**, by the
standing rule 2c-1b and 2c-3b-2 both paid.

---

**Phase 2c-4a step 3a (superseded by the above, kept for its rationale) is complete: two of the six
write surfaces draw a conflict panel, and a person could choose for the first time.** The match
editor and the creator offer *Reload disk
version* → *Confirm reload*, *Copy my text* and *Keep editing*; the disk side and the retained draft
are both on screen, all three revisions always. The other three match surfaces still declare
`offersReload: false` and are untouched.

**Step 3 was split three ways** — 3a (the two authored-text surfaces), **3b (the three
operation-choice surfaces)**, 3c (the window reading). The rationale and the failure-mode table are
in "Verification — Phase 2c-4a step 3a" above. **Step 3b is next.**

**`96d7e06` is step 3a's commit, pushed to `origin/main`, and is where a fresh session begins**
(`061e75e` was the base). The exact first commands to run:

```sh
npm install && npm test        # expect 1404 passed, 46 files
cargo test --workspace         # expect 1048 passed, untouched since step 1
```

(`npm run check` expects **412 files, 0 errors, 0 warnings**. `npm run build` expects **172
modules** — 171 plus exactly one new source module, `src/lib/components/clipboard.ts`; the guard is
the *shape* of a change to that number, `CLAUDE.md` §6. i18n is **711** keys per language, at
parity.)

### Read this before writing a line of step 3b

`docs/reviews/phase-2c-4a-design.md` governs the whole phase; its **Q4** is the rule that decides
what 3b may offer, and its **Q7** gives the six per-surface recipes step 3c needs.
`docs/decisions/2c-4a-3a-notes.md` is step 3a's record — its §7.8 is the round-2 disposition and
§7.9 is what it hands the next reviewer. `docs/reviews/phase-2c-4a-3a-code.md` holds both rounds.

### What 3a built that 3b inherits rather than invents

- **`ConflictCapabilities.reloadOutcome` is required**, and all three of 3b's surfaces already
  declare `closesSurface` — which is true of them, because their successful reload transitions set
  `closed: true`. 3b does not choose this value; it verifies the sentence it produces is the one
  its panel should show.
- **The terminal `refused` arm exists and nothing draws it on those three surfaces.**
  `ReloadStep` has it, `spendTheConfirmedReload` answers `satisfied | refused | notAttempted`, and
  `ConflictReloadStep` has `unavailable`. The three unoffered surfaces **already carry a
  `reloadUnavailable` field nothing renders**. 3b draws it.
- **`ConflictDiskText` / `conflictDiskText()`** own the empty-file decision. A renderer walks the
  union; it does not test `diskText === ''`.
- **`src/lib/components/clipboard.ts`** is the one clipboard routine, and `RawEditor.svelte` was
  migrated onto it. **3b's three surfaces must not offer a copy at all** — Q4's rule is a property
  of the drafted value, not of a caller's opinion: `MovePlacement` is a positional choice and
  `MatchId` is a protocol carrier, and copying either preserves nothing while looking like it
  preserved something. `offersCopyDraft` stays `false` on all three.

### Next: Phase 2c-4a step 3b — the three operation-choice panels

1. **Flip `offersReload` to `true`** in `matchDeletion.ts`, `matchMove.ts` and
   `matchDuplication.ts`. Leave `offersCopyDraft: false` on all three.
2. **Draw the panels** in `MatchDeleter.svelte`, `MatchMover.svelte` and `MatchDuplicator.svelte`:
   the disk side through `SourceText`, the **operation summary** rather than a retained draft
   beside it, both revisions always shown, the two-step reload, and the `unavailable` disclosure
   after a refused adoption. Components stay rule-free walks over the model — if a rule has to be
   decided it goes in `src/lib/browser/`, because **a rule written into one renderer is carried by
   that renderer's mounted suite alone**.
3. **New keys at parity** for anything the operation summaries need. A component renders a code by
   calling an accessor, never by building a key.
4. **Extend the three existing mounted jsdom suites** — `MatchDeleter.test.ts`, `MatchMover.test.ts`
   and `MatchDuplicator.test.ts` all already opt in by docblock. Cover the reload offer appearing,
   the confirmation step, `adoptDiskVersion` being called, the caller stopping **only** on
   `refused`, and the `unavailable` disclosure. Prove falsifiability by mutation where a test guards
   a call that could be deleted silently.

**One thing 3b must check rather than assume.** `MatchMover.svelte:511` still holds the shape the
duplicator moved away from at 2c-3c-3's Medium — a refusal rule written against `outOfDate` rather
than against the value that names the frozen reason. It was shipped at 2c-3b and window-read there,
so it is not a regression; but 3b is in that file anyway, and the rule belongs in the model.

**What step 3b must not do**, unchanged from the consult: no `saveAnyway`, no retry of the stale
candidate, no automatic reload, no clearing of dirty state on conflict, **no cross-revision
identification of "the same match"** (that is 2c-4b's confidence work), no YAML emitted from a
projection, no diff, and **no control named or coded "keep my draft"** — `CLAUDE.md` §6 makes that
absolute before 2c-4b.

### Then: Phase 2c-4a step 3c — the window reading, for all six surfaces

**The reading is step 3's exit, and it is owed for six surfaces rather than five.** The fix round
migrated `RawEditor.svelte` onto the shared clipboard module, and **a window reading is re-taken
after any change to a component** — so the raw editor's reading is owed again even though its
behaviour is reported materially unchanged.

Consult **Q7** removed the excuse that has stood since 2c-3b: the true `conflict` outcome had never
been provoked from a window for a move or a duplicate, because those readings used **this
application's own raw-save IPC** as the second writer, which refreshes the same Rust workspace cache
so `view_at` answers `identityStaleRevision` before the transaction. That proved the *instrument*
wrong, not the outcome unreachable. The recipe: open the surface at revision R0, then — **without
invoking any app command that reloads the document** — use a **shell or editor process** to append a
valid YAML comment to that exact file, producing R1. The frontend and the Rust cache stay at R0,
`view_at` passes, and the core's locked read sees R1.

**One plan per launch, into a fresh bundle path**, and set the language **explicitly through the
picker** — the webview's `localStorage` follows the **bundle identifier**, not `HOME`, so an
override set by one launch is still in force in the next. A WKWebView whose window is occluded stops
running `setTimeout` about six seconds after launch. `docs/decisions/1c-2b-2b-2-notes.md` §6.1 is
the technique.

**The clipboard is what the reading matters most for.** jsdom proves the fallback route runs; it
cannot prove what lands on the pasteboard. And the CR refusal is a claim about a real WKWebView.

**One thing step 3 inherits and must not undo.** After a match conflict is dismissed, a second
submission is refused by `view_at` with `identityStaleRevision` — **not** by a second conflict —
because `conflict_after_the_lock` already refreshed the Rust cache. Only a raw save reaches the
locked check twice. Write-safe either way, but they are different sentences.

---

**Phase 2c-4a step 2 (superseded by the above, kept for its rationale) is complete: the frontend
conflict protocol exists end to end, and nothing draws it.** A conflict now installs nothing in the window — it captures and stops. Adoption happens
in exactly one place, only for a confirmed reload, and all six write surfaces have the transition
that reaches it. What is deliberately withheld is the *offering*: every match surface still declares
`offersReload: false`, so `conflictChoicesFor` names neither `reloadDiskVersion` nor `confirmReload`
and no control is drawn. **2c-4a-3 flips one boolean per surface and draws the panels; it does not
have to invent the machinery.**

**`ee79c5d` was the base; step 2's commit is where a fresh session begins.** The exact first
commands a fresh session should run:

```sh
npm install && npm test        # expect 1380 passed, 46 files
cargo test --workspace         # expect 1048 passed
```

(`npm run check` expects **411 files, 0 errors, 0 warnings**. `npm run build` expects **171
modules** — unchanged, because step 2 adds no frontend module; the guard is the *shape* of a change
to it, `CLAUDE.md` §6. i18n is **698** keys per language, at parity — one fewer than 2c-3c-3,
because `browser.rawEditor.diskVersionUnavailable` was deleted as unreachable.)

### Read this before writing a line of step 3

`docs/reviews/phase-2c-4a-design.md` governs the whole phase; its Q7 gives the six per-surface
recipes for provoking a real conflict in a window. `docs/decisions/2c-4a-2-notes.md` is step 2's
record — read **§7.6.2** whatever else you skip. `docs/reviews/phase-2c-4a-2-code.md` holds four
review passes; the round-3 pass is the one that confirms the code and explains why the guards are
the guards.

### What step 2 built, in the four sentences step 3 needs

- **One adoption door.** `BrowserState.adoptDiskVersion(conflict, confirmation)` authorizes and
  installs in a single call and answers `DiskAdoptionOutcome` = `installed | alreadyThere |
  refused`. **`alreadyThere` is success**, not a refusal: the window already holds the revision that
  was asked for, and treating it as failure is the stuck confirmation it was added to prevent. All
  six callers must stop only on `refused` — `spendTheConfirmedReload` is what collapses the two
  successful arms, deliberately.
- **The spend is bound to the conflict's origin, not to its content.** `rememberTheConflict` keys a
  `WeakMap` on the wire value that `ConflictModel.source` carries whole, recording the document and
  its projection generation at the moment the conflict arrived. A conflict this window never
  produced is refused, and so is one whose projection has since been replaced. It is **not** keyed
  on `conflict.expected` — that is the session's frozen base and legitimately differs from what the
  window projects.
- **The three-step machine is shared and already wired.** `editorSave.ts` owns `ReloadStep`,
  `NOT_RELOADING`, `AdoptTheDiskVersion<T>`, `reloadAsked`, `reloadConfirmed`,
  `spendTheConfirmedReload` and `offeredReloadStep`. All five match models carry `reload` and
  `closed` on the session and `awaitingReloadConfirmation`/`closed` on the view, every `apply*` and
  every dismissal writes `NOT_RELOADING` back, and the five components' `reloadDiskVersion` and
  `confirmReload` arms **already call the transitions**. `DetailPane` already passes
  `adoptDiskVersion` to all six.
- **`conflictChoicesFor(capabilities, step)` is the only producer of a choice list**, fed by one
  exported `CONFLICT_CAPABILITIES` per surface. `draftKind` is a permanent fact about the drafted
  value; `offersCopyDraft` and `offersReload` say what the panel *acts on today* and are hand-set.
  A copy is refused for an `operationChoice` draft regardless of the boolean, because the Q4 rule is
  a property of the value and not of a caller's opinion about it.

### Next: Phase 2c-4a step 3 — components, i18n, mounted tests and the window reading

1. **Flip `offersReload` to `true` on the five match surfaces** and draw the panels: the disk side
   through `SourceText`, the retained draft or operation summary beside it, both revisions always
   shown. **Only the match editor and the creator get `copyDraft`** — `MatchBuffers` and
   `CreationBuffers` hold authored strings; `MovePlacement` is a positional choice and `MatchId` is
   a protocol carrier, and copying either preserves nothing while looking like it preserved
   something. The copy is a **labelled reference copy, never YAML**.
2. **New English and Spanish keys, at parity**, for the confirmation screens and the copy-result
   disclosures. A component renders a code by calling an accessor, never by building a key.
3. **Five new mounted jsdom suites**, one per match component — the seven that opt in today do not
   include them for these arms. Read `copyBySelecting` in `RawEditor.svelte` before writing any
   clipboard code.
4. **The window reading is part of step 3's exit, not a follow-up.** Consult Q7 removed the excuse
   that has stood since 2c-3b: the true `conflict` outcome had never been provoked from a window for
   a move or a duplicate because those readings used **this application's own raw-save IPC** as the
   second writer, which refreshes the same Rust workspace cache so `view_at` answers
   `identityStaleRevision` before the transaction. That proved the *instrument* wrong, not the
   outcome unreachable. The recipe: open the surface at revision R0, then — **without invoking any
   app command that reloads the document** — use a **shell or editor process** to append a valid
   YAML comment to that exact file, producing R1. The frontend and the Rust cache stay at R0,
   `view_at` passes, and the core's locked read sees R1. One plan per launch, into a fresh bundle
   path, and set the language **explicitly through the picker** — the webview's `localStorage`
   follows the bundle identifier, not `HOME`.

**What step 3 must not do**, unchanged from the consult: no `saveAnyway`, no retry of the stale
candidate, no automatic reload, no clearing of dirty state on conflict, **no cross-revision
identification of "the same match"** (that is 2c-4b's confidence work), no YAML emitted from a
projection, no diff, and **no control named or coded "keep my draft"** — `CLAUDE.md` §6 makes that
absolute before 2c-4b.

**One thing step 3 inherits and must not undo.** After a match conflict is dismissed, a second
submission is refused by `view_at` with `identityStaleRevision` — **not** by a second conflict —
because `conflict_after_the_lock` already refreshed the Rust cache. Only a raw save reaches the
locked check twice. It is write-safe either way, but the two are different sentences and the record
said the wrong one for two review rounds.

---

**Phase 2c-4a step 1 (superseded by the above, kept for its rationale) is complete: the
revision-bound disk snapshot exists, and nothing draws it.**
`SaveResult::Conflict` now carries `disk_text` — the whole file text of the fresh read, paired with
`disk_revision` **by content-hash equality** in the one production construction site,
`conflict_after_the_lock` in `src-tauri/src/commands.rs`. No screen changed, no control was added,
no i18n key was added, and `conflictText`/`captureTheDiskText` in
`src/lib/browser/workspace.svelte.ts` are untouched.

**`fa5bb93` is step 1's commit and is where a fresh session begins** (`ddf67ab` before it is the
design consult, committed on its own so the ruling was durable before any code rested on it). The
exact first commands a fresh session should run:

```sh
npm install && npm test        # expect 1326 passed, 46 files
cargo test --workspace         # expect 1048 passed
```

(`npm run check` expects **411 files, 0 errors, 0 warnings**. `npm run build` expects **171
modules** — unchanged, because step 1 adds no frontend module. The module count is a regression
guard and the guard is the *shape* of a change to it, not the number: `CLAUDE.md` §6.)

### Read this before writing a line of step 2

**`docs/reviews/phase-2c-4a-design.md` is the consult that governs this whole phase**, and it
changed the phase rather than confirming it. Its VERDICT and Q2 carry the ruling step 2 exists to
implement. `docs/decisions/2c-4a-1-notes.md` is step 1's record, including its §6 correction blocks.

### Next: Phase 2c-4a step 2 — the frontend conflict protocol

**The consult's central ruling, and the reason this step is not cosmetic: the frontend's eager
adoption of the disk projection on a conflict is a defect, not something to disclose.** Today all
six writing wrappers in `src/lib/browser/workspace.svelte.ts` do
`forgetTextOf(document)` + `installView(answer.value.disk)` + `repairAfter(...)` in their conflict
arm — `moveMatch:2086`, `saveMatch:2184`, `createMatch:2265`, `deleteMatch:2328`,
`duplicateMatch:2451`, `saveRawDocument:2538`. So **a conflict writes nothing, and yet the snippet
list re-orders and the selection moves before the person has chosen anything**, leaving their draft
on screen against a projection that no longer describes it. "Load the disk version separately" is
true of the command layer and false of the window.

Step 2 is the protocol, with no new control drawn:

1. **Defer the frontend adoption.** The conflict arm captures the result and stops; it does not call
   `forgetTextOf`, `installView` or `repairAfter`. A **confirmed reload** becomes the sole frontend
   transition that installs the carried disk projection and repairs the selection. The Rust-side
   refresh in `conflict_after_the_lock` **stays** — it is required for the two-observation truth and
   for backend cache coherence, and removing it is not what this ruling asks.
2. **Rewire the raw editor's reload.** `loadDiskVersion` in `src/lib/browser/rawEditor.ts:779-805`
   currently assumes workspace adoption already happened before the answer arrived. That assumption
   cannot survive (1), so adoption and `loadDiskVersion` must become **one deliberate operation**.
3. **Stop treating a conflict as invalidation.** `matchDuplication.ts:825-829` sets `invalidated`
   from the conflict arm itself, and `matchMove.ts` documents the same asymmetry — both are
   consequences of the eager install and must go with it. Invalidation should follow **actual
   projection adoption**, never the mere existence of a separately held snapshot.
4. **Collapse the two authorities for conflict choices** (consult Q9 item 1). `describeConflict`
   installs the global three into every `ConflictModel` (`saveOutcome.ts:285-302`, `:380-389`) while
   each match model **ignores that field** and exposes a local `['keepEditing']`
   (`matchEditor.ts:1600`, `matchCreation.ts:1256`, `matchDeletion.ts:692`, `matchMove.ts:1590`,
   `matchDuplication.ts:1032`). **That split is exactly why a newly offered button can compile and
   do nothing.** Capability and step must come from one surface-owned model authority.
5. **Per-surface capability, by the consult's Q3/Q4 rule** — *does the draft contain user-authored
   text a clipboard can preserve truthfully?* All six get a confirmed reload path. **Only the match
   editor and the creator get `copyDraft`**: `MatchBuffers` and `CreationBuffers` hold authored
   strings, while `MovePlacement` is a positional choice and `MatchId` is a protocol carrier, and
   copying either would preserve nothing while looking like it preserved something. The copy is a
   **labelled reference copy, never YAML** — serializing `MatchBuffers` as YAML would repeat the
   exact preservation-promise mistake 2c-3c exists to prevent.
6. **`diskText` supersedes the second read.** Step 1's field makes `conflictText`,
   `captureTheDiskText` and `forgetConflictText` in `workspace.svelte.ts` redundant. Step 1 recorded
   this and deliberately did **not** act on it. `2c-4a-1-notes.md` §4.1 also records a latent defect
   in the thing being superseded: **`captureTheDiskText` reuses the viewer's *older* cached answer
   when the viewer points at the same document** — an older text, not merely a later one.

**A naming collision step 2 must resolve deliberately**, found during step 1's verification and
judged by the review to belong here: `RawEditor.svelte` already has a `diskText` prop of type
`RawDocumentText | null` (derived from `rawTextOf`), while the new `ConflictModel.diskText` is a
`string`. The review's position is that TypeScript will reject accidental interchange because they
sit at different typed boundaries — but two different things with the same name on the same screen
is how a wrong value gets drawn, and a person reading the component has no type checker.

**What step 2 must not do**, from the consult: no `saveAnyway`, no retry of the stale candidate, no
automatic reload, no clearing of dirty state on conflict, **no cross-revision identification of "the
same match"** (that is 2c-4b's confidence work), no YAML emitted from a projection, no diff, and
**no control named or coded "keep my draft"** — `CLAUDE.md` §6 makes that absolute before 2c-4b.

### Then: step 3 — components, i18n, mounted tests and the window reading

The six panels drawn, new English and Spanish keys, `SourceText` for the disk side, the
confirmation screens and copy-result disclosures. **Every newly offered `ConflictChoice` arm must
act in the same change** — the five components' exhaustive switches protect against a new *member*
of the union and **not** against a newly *offered* one, which is drawn as a control the moment the
model names it and would do nothing.

**The window reading is part of step 3's exit, not a follow-up**, and the consult's Q7 removed the
excuse that has stood since 2c-3b: the true `conflict` outcome had never been provoked from a window
for a move or a duplicate because those readings used **this application's own raw-save IPC** as the
second writer, which refreshes the same Rust workspace cache so `view_at` answers
`identityStaleRevision` before the transaction. That proved the **instrument** wrong, not the
outcome unreachable. The recipe: open the surface at revision R0, then — without invoking any app
command that reloads the document — use a **shell or editor process** to append a valid YAML comment
to that exact file, producing R1. The frontend and the Rust cache stay at R0, `view_at` passes, and
the core's locked read sees R1. Consult Q7 gives the per-surface steps for all six.

---

**Phase 2c-3c (superseded by the above, kept for its rationale) is complete — all three steps, and
all three kinds of evidence.** Step 1 put
`DocumentEdit::DuplicateItem` in the core as a **true** duplicate; step 2 put `duplicate_match`
on the wire and `matchDuplication.ts` in the browser layer; **step 3 drew it**:
`MatchDuplicator.svelte` is the sixth write surface, `MatchDuplicator.test.ts` is the seventh
jsdom-opted mounted suite, and `docs/decisions/2c-3c-3-window-reading.md` is the bilingual
window reading — **24 launches, PASS on all seven items, no High and no Medium, and no defect
in what is written to disk.**

**`21b3573` is 2c-3c's closing commit and is where a fresh session begins.** The exact
first command a fresh session should run:

```sh
npm install && npm test        # expect 1324 passed, 46 files
```

(`cargo test --workspace` expects **1046**, unchanged — step 3 wrote no Rust. `npm run check`
expects **411 files, 0 errors, 0 warnings**. `npm run build` expects **171 modules** — the +2
over step 2's 169 is one new `.svelte` file: its module and its scoped-style virtual module.)

### What step 3 contains

`src/lib/components/MatchDuplicator.svelte`: the panel as a rule-free walk over
`matchDuplicationView`, with **one** `$derived.by` that calls `projections()` once and hands both
the view and the identity `beginDuplicate` checks out of that single read; the
acknowledge-and-retry round trip, the three outcome arms, the one `reloadFile` recovery and the
sticky action row. `src/lib/components/MatchDuplicator.test.ts`: 13 mounted cases in two suites,
the last over a **real** `BrowserState`. `documentHasUnsavedDraft(document, drafts)` in
`src/lib/browser/matchDuplication.ts` — the producer step 2 deliberately left missing — with
`openMatchDrafts()` in `DetailPane.svelte` supplying it through `unsavedDraftInDocument()`; the
pane's `duplicatingMatch` session, its opener, its `{:else if}` branch and `busy` grown to **six**
write surfaces; one new `DetailPane.test.ts` case for reachability. Two dictionary sentences
rewritten, **no key added** — 699 per language, at parity, 31 in the
`browser.matchDuplication.*` namespace. 1302 → **1324** frontend tests over 46 files; Rust
unchanged at 1046. The decision record is `docs/decisions/2c-3c-3-notes.md`.

### The two review rounds (`docs/reviews/phase-2c-3c-3-code.md`)

Round 1 (`NOT READY`): a Medium — the component decided that the frozen `notDuplicable` reason
loses to a live `outOfDate`, a rule living in markup; and a Low — the `unsavedDraftInDocument`
sentence was false of its own predicate, which measures an **open** editor and not a dirty one.
Round 2, the confirmation pass (`NOT READY`): both behavioural fixes confirmed closed, plus two
Lows that were **prose those fixes introduced** — a false testability record, and two governing
documents still claiming dirty-draft coordination. **Each round's fix produced the next round's
finding, again**, and both `NOT READY` verdicts were accepted rather than argued with. All four
were fixed before the commit; the fifth entry in the disposition table is the orchestrator's own
correction of `DetailPane.svelte`'s pre-existing "nothing can check" absolute. Dispositions:
`## Phase 2c-3c-3 review disposition` above, and `docs/decisions/2c-3c-3-notes.md` §6.

### What 2c-3c decided that a later session must not silently undo

- **The rule that decides between two refusal arms belongs to the model, not to a renderer.**
  `notDuplicableToShow` returns the frozen reason **only when `cannotDuplicate ===
  'notDuplicable'`** — written against that value, not against `outOfDate`, so a refusal added
  above it in `refusalGiven`'s order suppresses the frozen detail **by construction**. The
  unsuppressed verdict stays on `MatchDuplicationSession.eligibility`. The reason is not that
  markup cannot be tested — `MatchDuplicator.test.ts` mounts and checks this renderer — but that
  a rule in one renderer is carried by that renderer's mounted suite **alone**, and a second
  renderer can omit it while walking the model faithfully.
- **`documentHasUnsavedDraft` measures an *open* match editor, never a *dirty* one, and that is
  correct rather than a bug** (R36). `isDirty` is derived inside `MatchEditor.svelte`'s own
  session, so no coordinator can observe it; over-refusing costs one closed editor,
  under-refusing strands edits. Both sentences claim an open editor and this app's inability to
  tell whether it was edited — **never** that unsaved edits exist. "Document-wide dirty-draft
  coordination" is **not** what shipped, and the correction blocks in `2c-3c-2-notes.md` §2.4 and
  `phase-2c-3c-design.md` say so where the older records claim otherwise.
- **The clone is the source's exact owned runs, byte-identical, trigger included** (step 1), it
  lands immediately after its source with no placement choice (consult Q4), and the batch that
  holds a `DuplicateItem` holds nothing else (R25's precedent). The acknowledgeable
  `DuplicateKeepsTriggerDefinition` claims **risk, never espanso semantics** (D2u) and is
  content-addressed by the candidate's own `ContentRevision`.
- **The selection-follow guard holds at the write, not before it** (step 2) — a
  `DuplicateIntent { held, generation }` is re-validated after the adoption's own await, in the
  same synchronous block as `replaceSelection`. `moved: null` claims only that the clone could
  not be identified in the read that followed the write.
- **Nothing on this surface is presented as reversible.** The reading's complete roll of controls
  contains no undo, revert, restore or "keep my draft".

### The debt ledger carried forward — now four items

**`browser.matchDeletion.sendFailed`** and **`browser.rawEditor.discardWarning`** still carry
2c-3b-2's F4 pattern; this step touched neither screen. Step 3 adds two, both in **move**, both
shipped, both left because changing a sentence or a decision in a shipped screen obliges a
re-taken window reading of the sub-phase that owns it (2c-3b-2's):
**`browser.matchMove.refused.unsavedDraft`** (`en.json:316`, `es.json:316`) has the identical
open-versus-dirty defect, and **`MatchMover.svelte:511`** —
`current.view.notMovable !== null && current.view.cannotMove !== 'outOfDate'` — is the round-1
Medium's exact shape, still in a `.svelte` file, and duplicate's model-side fix now diverges from
it. Step 2's own recorded twins (`movedNotIdentified`, `createdNotIdentified`, the shared
`after_a_save` prose residue) stand unchanged for the follow-up that owns them.

### Next: Phase 2c-4a — conflict capture and preservation

`docs/decisions/2c-split-notes.md` §2 is the scope, verbatim: **retain the draft, load the disk
version separately, compare, copy, reload — overwriting neither side.** It **fails as a
both-sides data-loss mistake**, which is why it is its own sub-phase and why neither side of the
comparison may be quietly dropped to make a screen simpler.

**The constraint that binds it before any code is written** (`CLAUDE.md` §6): **no control
anywhere may be named or coded "keep my draft" before 2c-4b.** There the words mean *rebase the
draft onto the newly parsed document* — identify the intended match in the new parse and apply
only when confidence suffices — and using them in 2c-4a makes that phase look done. 2c-4a
preserves both sides and offers a copy; it does not reapply anything.

The conflict machinery it builds on already exists and is **unevenly drawn**, which is the first
thing to check rather than assume. `ConflictChoice` has `keepEditing`, `copyDraft`,
`reloadDiskVersion` and `confirmReload`. The **raw editor** already offers three at a time —
`rawEditor.ts`'s `CONFLICT_FIRST_STEP` is `['keepEditing', 'copyDraft', 'reloadDiskVersion']` and
`CONFLICT_CONFIRM_STEP` swaps the last for `confirmReload`. The **five match-level panels** —
editor, creator, deleter, mover, duplicator — each hold a local
`const CONFLICT_CHOICES = ['keepEditing']` and offer that alone. Those five constants, and the
`conflictAction` switches that walk them, are where 2c-4a lands.
`MatchDuplicator.svelte`'s switch states what the exhaustive `switch` forces and what it does
not: a *new member* of `ConflictChoice` fails to compile there, but a **newly offered** member
does not — the arm is drawn as a control the moment the model names it, and it would do nothing.
The standing hole to carry in: **the true `conflict` outcome has never been provoked from a
window** for a move or a duplicate — the command's identity gate answers first — so those
sentences have model-suite and mounted evidence only (`2c-3c-3-window-reading.md` §12 item 4,
`2c-3b-2-window-reading.md` §10.2). By the rule every sub-phase since 2b-2c has followed, 2c-4a's
first act is its **design consult**.

---

**Phase 2c-3c step 2 (superseded by the above, kept for its rationale) is complete:
`duplicate_match` is the twelfth command and the sixth
writer, `BrowserState.duplicateMatch` is the sixth writing wrapper, and `matchDuplication.ts`
is duplicate as a value. Nothing draws it — the component, the mounted test and the bilingual
window reading are step 3's, and 2c-3c does not close without them.**

**`78f34dd` is step 2's commit and is where a fresh session starting 2c-3c-3 begins.** The
exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1302 passed, 45 files
```

(`cargo test --workspace` expects **1046**. `npm run check` expects 409 files, 0 errors,
0 warnings. `npm run build` expects **169 modules** — the +1 over step 1's 168 is
`matchDuplication.ts`, production-reachable through `i18n/index.ts`.)

### What step 2 contains

`duplicate_match(id, base_revision, acknowledgement)` in `src-tauri/src/commands.rs`, routed
through `run_one_save` with the helper's `at` set to `DuplicateItem::resulting_path()` so
`SaveResult.moved` names the clone in the fresh revision (consult Q8); registered in
`main.rs`; every contract test retabulated for twelve commands. `duplicateMatch` on the wire
(`src/lib/ipc/commands.ts`) preserving the finding's `ContentRevision` operand exactly.
`src/lib/browser/matchDuplication.ts`: a `Draft<MatchId>` session with eligibility
{`notInDocument`, `readOnly`, `noSequencePosition`, `unsavedDraftInDocument` — document-wide,
coordinator-supplied} and refusal precedence {`mayHaveWritten`, `alreadyDuplicated`,
`saveInFlight`, `conflict`, `outOfDate`, `notDuplicable`}, sticky spent facts, and
live-identity begin/submission gates. `BrowserState.duplicateMatch` in `workspace.svelte.ts`
with full `MatchSaveAnswer` parity. i18n: 31 `browser.matchDuplication.*` keys per language,
two notices, one `commandError` key, three typed accessors. 1041 → **1046** Rust tests,
1244 → **1302** frontend tests over 45 files.

### The four review rounds (`docs/reviews/phase-2c-3c-2-code.md`)

Round 1 (`NOT READY`): a High — selection could be reclaimed after the person moved away and
returned; a Medium — `moved: null` sentences implied a second file change; two Lows — the
dispatcher test presenting cache content as disk evidence (2b-2c-3b's exact pattern, again),
and an attribution doc describing duplication as reordering. Round 2, the confirmation pass
(`NOT READY`): the High's fix had closed the pre-command window and left the adoption re-read
await open — **each round's fix produces the next round's finding, again** — plus a Low in a
test comment. Round 3 rebuilt the guard: a `DuplicateIntent { held, generation }` captured
synchronously before the command travels whole into the dedicated `adoptAfterTheDuplicate`,
which re-validates both halves after its own `getDocument` await **in the same synchronous
block as `replaceSelection`** — no await between check and write, the `rereadDocument`
capture-and-recheck shape — with two interleaving tests that fail against the round-2 code.
Round 4, scoped to round 3's changes: **`READY`, no findings.** All dispositions are
`docs/decisions/2c-3c-2-notes.md` §6.

### What step 2 decided that a later session must not silently undo

- **Selection is never reclaimed after the person moves it, and the guard holds at the write,
  not before it.** The clone is followed only if the initiating `SelectedMatch` object is
  still held AND `selectGeneration` has not moved, both re-checked with no await between the
  check and `replaceSelection`. The no-follow path installs the fresh projection and
  repairs/clears synchronously — no `MatchId` naming nothing (the 2c-3a-1 rule).
- **`RepairAttribution` gained `'requestedDuplicate'` with its own notices**
  (`keptAfterDuplicate`/`displacedByDuplicate`) rather than reusing `'requestedMove'` —
  move's sentences say *reordered*, which is false of an insertion. The type's doc now says
  only "changed the file", each member claiming its own kind of change.
- **`moved: null` claims only that the clone could not be identified in the read that
  followed the write** — causes non-exhaustive, in all four production sites and both
  languages. A deleted-after-commit file still answers `Saved`/`moved: None`, tested.
- **`CommandError::DuplicateSourceNotASequenceItem` is a new code, not a rename of move's
  shared one** — the rename is a wire change three shipped commands inherit, recorded as the
  standing 2b-2c-2 follow-up. Documented unreachable through today's projection, like its
  move twin.
- **There is no pending-confirmation phase in the session** — the acknowledgement round trip
  is itself the deliberate step (consult Q6).

### Next: step 2c-3c-3 — the component and the evidence

Consult Q7 item 3 is the spec: draw the duplicate action and its acknowledge/retry UI as a
rule-free walk over the model view; wire the `unsavedDraftInDocument` producer (it has no
producer today — the coordinator must supply it, notes §4); add the mounted-component
interaction test; run the full suites, build and module guard; and record a fresh
English-and-Spanish window reading at the target size, as
`docs/decisions/2c-3c-3-window-reading.md` in the shape of `2c-3b-2-window-reading.md`. The
reading rules stand: one plan per launch into a fresh bundle path, the language set
explicitly through the picker, a re-take after any component change. The Spanish creation-form
width debt (owed since the `fragmento` change) and the destination-panel height precedent are
the measured-size warnings to carry in. The one-synchronous-read rule binds the component:
view, eligibility and submission identity from one projection read (notes §4).

### The debt this step carries forward, unchanged

**`browser.matchDeletion.sendFailed` and `browser.rawEditor.discardWarning`** still have F4's
defect pattern and are still a pair: whichever sub-phase next touches those screens owes the
fix and the re-taken reading. This step touched neither screen. Step 2 adds to the same
ledger: the `movedNotIdentified`/`createdNotIdentified` twins and the pre-existing
`after_a_save` prose residue, recorded in `2c-3c-2-notes.md` §6 for the owning follow-up.

---

**Phase 2c-3c step 1 (superseded by the above, kept for its rationale) — Duplicate is under
way, its owner decision is taken, and step 1 of its
three-step cut is complete: `DocumentEdit::DuplicateItem` is a true duplicate in the core, and
nothing calls it.**

The owner decision `2c-split-notes.md` §4 left open was taken first: **a true duplicate** —
option (1), the byte-exact clone — never the projection-based copy. The design consult is
`docs/reviews/phase-2c-3c-design.md`, and its Q7 answer changed the expected cut from the
two-step pattern of 2c-2/3a/3b to **three steps**: 2c-3c-1 the core primitive (this commit),
2c-3c-2 the boundary and model, 2c-3c-3 the component and its evidence. The consult's reason
stands recorded there: `edit.rs` adds a new verification class over run-owned bytes and
asymmetric copy seams, and reviewing that beside a new command, cache adoption, session state
and a component would make a preservation defect hard to localize.

**`e079161` is step 1's commit and is where a fresh session starting 2c-3c-2 begins.** The exact
first command a fresh session should run:

```sh
npm install && npm test        # expect 1244 passed, 44 files
```

(`cargo test --workspace` expects **1041** — up from 1008; step 1 is Rust plus the precedented
dictionary cascade. `npm run check` expects 407 files, 0 errors, 0 warnings. `npm run build`
expects **168 modules**, unchanged — the cascade added keys and type members, no new source
module. The real-corpus sweep inside `tests/patch_duplicate.rs` skips cleanly when
`tests/corpus/real/` is absent and must apply at least one duplicate when it is present.)

### What step 1 contains

`DocumentEdit::DuplicateItem { item }` in `crates/espansoconfig-core/src/patch/edit.rs`: a
byte-exact copy of a sequence item's owned runs (via `carve_envelope`, factored from
`removal_envelope` so no deletion-premise refusal is imported), landing **immediately after its
source, same sequence, with no placement choice** (consult Q4); batch-only via
`DuplicateMustBeTheOnlyEditInItsBatch` (R25's precedent, consult Q1); destination-only seam
refusals — `DuplicateSeam::{ArrivalLands,ArrivalCloses,CopiedRunsJoin}`,
`DuplicateWouldExtendAKeptBlock`, `DuplicateWouldCopyAFileComment` — asymmetric on purpose,
because the original never moves so there is no source-close arm; and an EOF-prefix line-ending
rule for a last-item source (copy the observed ending in front of the clone, else
`NoObservableLineEnding`). The verification class is independent of the planner by
construction: a byte oracle against `entry_owned_runs`' own textual derivation, the re-derived
insertion boundary (`arrival.span.start == item_own_lines(...).end`), digest/order, a lockstep
tree walk, an exact comment-ownership multiset with clone-relative positional checks, and a
claimed-run-set-equals-independent-set equality that is the only layer able to refuse a false
provenance claim over honest bytes.

`FindingCode::DuplicateKeepsTriggerDefinition` is produced by `save_document` only when the
clone projects as a match with a modelled trigger form. It claims **risk, never espanso
semantics** (D2u), and it **carries the candidate's `ContentRevision`**, so acknowledgement is
content-addressed and consent for one clone cannot spend on another — the same discipline
`DocumentDoesNotParse` established, closed here after review round 1 demonstrated the transfer.

Tests: the new `crates/espansoconfig-core/tests/patch_duplicate.rs` (corpus classes: LF, CRLF,
BOM, Unicode, mixed endings, no-final-newline, leading comments, file-owned holes, block
scalars; the three move-seam fixtures — 6/6 copy on block-scalar seams, one `CopiedRunsJoin`
refusal on run-joins, 4/4 on kept-comment — and the real-corpus sweep, 26 applied / 0 refused)
plus the in-module adversarial suite built on `tampered_duplicate`. 1008 → **1041** Rust tests;
the frontend suite is unchanged at 1244.

### The review rounds, and what they teach again

Both rounds returned `READINESS: NOT READY` (`docs/reviews/phase-2c-3c-1-code.md`; the
confirmation pass is appended there). Round 1: three High, one Low — the acknowledgement that
could transfer to a byte-different candidate on a later revision, the verification that trusted
the planner's own boundary derivation, the run bound that did not independently exclude
file-owned comment provenance, and the corpus sweep that stayed green if every duplicate was
refused. Round 2, scoped to round 1's fixes, found what the standing rule predicts — **each
round's fix produces the next round's finding**: the F3 mutation test changed byte order, so
the byte oracle intercepted it and the provenance layer went untested. The closing fix tampers
**only the claim** over honest bytes — verified by temporarily disabling the run-vector
equality and watching the tampered plan return `Ok` through the whole pipeline — and a
companion test records as two measurements why a bytes-rebuilding tamper proves nothing about
that layer. All five findings are closed; the dispositions are
`docs/decisions/2c-3c-1-notes.md` §6.

### What step 1 decided that a later session must not silently undo

- **The trigger is byte-identical and no edit rides along.** Clone-then-edit-trigger in one
  batch was considered and refused (consult Q2) — R25's rationale binds duplicate too.
  Uniqueness is the finding's job, not the primitive's.
- **`ArrivalCloses` and the non-EOF kept-block clause are believed unreachable and kept
  defensively** — `2c-3c-1-notes.md` §2.9, holes 1 and 3. Those are reachability *arguments*,
  not proofs; deleting either arm requires re-running the argument, not observing the absence
  of a failing test.
- **A `|+` block's trailing blanks are the scalar's own content span** — owned, therefore
  copied. Measured during implementation, and it is why the non-EOF kept-block clause is
  believed unreachable.
- **The dictionary cascade is part of the core step, by 2b-2c-3a's precedent** (the consult's
  "no TypeScript in step 1" yields to the workspace staying green): 12 `code.*` keys per
  language, `DuplicateSeam` in `CODE_ENUMS`, retabulated `VARIANT_COUNTS` and wire tallies
  (177 → 189; struct/unit (106,12,59) → (115,12,62)), four TS union extensions with the finding
  member tagged for its `ContentRevision` operand. `codes.ts` needed nothing — no new accessor
  until 2c-3c-2 puts sentences on a screen.

### Next: step 2c-3c-2 — the boundary and the model

Consult Q5/Q6/Q8 are its spec, read them before coding: register
`duplicate_match(id, base_revision, acknowledgement)` as the twelfth command, routed through
`run_one_save` with the helper's `at` naming the clone's **post-insertion** path so
`SaveResult.moved` names the clone in the fresh revision; `BrowserState.duplicateMatch` with
full `MatchSaveAnswer` parity (refusal, conflict, `mayHaveWritten`, failed adoption,
`committed: false`, `forgetTextOf`, total stale-projection removal after a known commit) and
the two-counter selection rules — follow `moved` to the clone only if the source is still the
selection that initiated the operation, never reclaim a selection the person moved;
`matchDuplication.ts` as a `Draft<MatchId>` session with eligibility
{`notInDocument`, `readOnly`, `noSequencePosition`, `unsavedDraftInDocument` — document-wide on
purpose, a commit strands every dirty draft in the file} and refusal precedence
{`mayHaveWritten`, `alreadyDuplicated`, `saveInFlight`, `conflict`, `outOfDate`,
`notDuplicable`} — the arm that claims less wins; the i18n accessors and both dictionaries the
model needs; **no `.svelte` file**. The mounted test and the bilingual window reading are
2c-3c-3's, and 2c-3c is not done without them.

### The debt this step carries forward, unchanged

**`browser.matchDeletion.sendFailed` and `browser.rawEditor.discardWarning`** still have F4's
defect pattern and are still a pair: whichever sub-phase next touches those screens owes the
fix and the re-taken reading. This step touched neither screen.

---

**Phase 2c-3b (superseded by the above, kept for its rationale) is complete: move exists as a
value, a screen draws it, and all three kinds of
evidence are in hand — model tests, the mounted-component test, and the window reading.** The
reading is `docs/decisions/2c-3b-2-window-reading.md`: twelve launches settled the six questions
the previous checkpoint posed (five PASS, one confirmed defect), a fix round closed the one Medium,
Codex reviewed the fix (**READY, no findings** — `docs/reviews/phase-2c-3b-2-reading-fix.md`), and
a five-launch re-take (§13 of the record) measured the new sentences on screen in both languages.

**`45d8478` is the phase's commit and is where a fresh session starts.** The exact first command a
fresh session should run:

```sh
npm install && npm test        # expect 1244 passed, 44 files
```

(`cargo test --workspace` expects **1008**, unchanged — nothing in the reading or the fix touched
Rust. `npm run check` expects 407 files, 0 errors, 0 warnings. `npm run build` expects **168
modules**, unchanged: the fix added sentences and arms to existing modules, no new source module.)

### The next step is Phase 2c-3c — Duplicate, and it owes a decision before it owes code

`docs/decisions/2c-split-notes.md` §4 is explicit: there are exactly two honest products. **(1) A
true duplicate** — clone the existing match's exact source subtree, insert the clone — which is
new **Rust work in `patch/`** and is why 2c-3c is a sub-phase rather than a button; or **(2) a
projection-based copy**, which is cheap and **is not duplicate** — it drops comments, key order and
scalar spelling, and calling it *Duplicate* breaks the preservation promise in the one place nobody
checks. They are not alternatives to choose between casually: (2) may exist only under a name that
does not claim more than it does. **The first act of 2c-3c is the design consult
(`docs/reviews/phase-2c-3c-design.md`, by the rule every sub-phase since 2b-2c has followed),
and its first question is this owner decision.** If (1), the consult must also settle the clone
primitive's shape (a `DocumentEdit` that copies a source byte range at a sequence-item boundary,
beside `InsertItem`), the trigger-collision question (a byte-exact clone duplicates the trigger —
what, if anything, warns?), and where the clone lands (the position model `NewMatchPosition`
already gives `create_match`).

### What this reading and its fix round settled that a later session must not silently undo

- **`RepairAttribution` defaults to `'externalChange'` everywhere, and exactly one call site says
  otherwise.** `adoptTheDocumentOnDisk` and `repairAfter` both take the argument with that default;
  only `BrowserState.moveMatch`'s **committed** adoption passes `'requestedMove'`, and the adoption
  honors it **only when the fetched projection matches both `moved.document` and `moved.revision`**
  — the parse the write itself produced. A file changed again between the write and the re-read, a
  recovery re-read, and every other wrapper's adoption all keep the external sentences, which the
  reading's L4b/L5 (and the re-take's R5) measured being *accurate* for a genuinely external
  change. Rewording those sentences globally was rejected for exactly that reason.
- **`mayHaveWritten` and the conflict path keep the external attribution deliberately** —
  uncertainty claims less, and a conflicted move really did have the file move under the person.
  The new arms are `keptAfterMove` and `displacedByMove` in `src/lib/browser/notices.ts`, drawn
  through `selectionNoticeKey`/`tSelectionNotice` like every other arm.
- **The reading record's §5 transcripts are the pre-fix sentences, kept as taken.** §13 supersedes
  §7.1 and says so; §7 itself was not rewritten. A later session must not "correct" §5 — it is the
  record of what the defect looked like.
- **§7.2 (the committed panel makes the same claim twice), §7.3 (placeless destinations enabled
  under the `outOfDate` refusal) and §7.4 (the frozen *Where it is now* marker) are recorded, not
  fixed** — two Lows and an observation, each with its reasoning in the record. §7.3 in particular
  is the model's own rule read literally, coherent and strange to look at; fixing it is a decision,
  not a cleanup.
- **The true `conflict` outcome cannot be provoked through the IPC** — the command's identity gate
  (`view_at` checks the base revision first) answers before the save transaction can conflict, so
  the three `revision*` sentences, *Keep editing* and `cannotMove.conflict` have model-suite and
  mounted evidence only (record §10.2). Reaching them from a window needs a filesystem write timed
  between the gate and the lock. This is a standing hole, stated, not a defect.
- **`movedNotIdentified` and the `mayHaveWritten` state were measured as canned-answer readings of
  the real component** (record §4.3, §10.3) — their layout and copy are window-verified, their
  end-to-end reachability rests on the model suite.

### The debt this phase carries forward, unchanged

**`browser.matchDeletion.sendFailed` and `browser.rawEditor.discardWarning`** still have F4's
defect pattern and are still a pair: whichever sub-phase next touches those screens owes the fix
and the re-taken reading (see the superseded entry below for the full disposition). This phase
touched neither screen.

---

**Phase 2c-3b step 2 (superseded by the above, kept for its rationale): the code was complete and
committed, and the window reading was the whole of the next session's job — the section above is
that reading's outcome.**

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1242 passed, 44 files
```

(`cargo test --workspace` expects **1008**, unchanged — neither step of 2c-3b wrote any Rust.
`npm run check` expects 407 files, 0 errors, 0 warnings. `npm run build` expects **168 modules**;
the guard was rebaselined from 166 by measuring a pristine `git archive HEAD` build and subtracting,
and the +2 is `MatchMover.svelte` plus `matchMove.ts`, which was type-only in production until this
step drew it.)

### The next step is the window reading, and nothing else

**It is the third of `2c-split-notes.md` §7's three kinds of evidence, and this sub-phase does not
close without it.** Model tests and a mounted-component test are both in hand. The rule that makes
this non-negotiable is written in `CLAUDE.md` and was earned twice: **a green test suite is not a
screen.** 2c-1b's reading found two real defects past 883 passing tests, `svelte-check` and two Codex
passes — one of them this project's central promise broken on the one screen that writes. 2c-3a-2's
reading found a layout defect past 1160 passing tests and two Codex passes over the very component.

**How to take it:**

- **The technique is `docs/decisions/1c-1-notes.md` §10.** The WKWebView constraint is
  `docs/decisions/1c-2b-2b-2-notes.md` §6.1: a webview whose window is occluded stops running
  `setTimeout` about six seconds after launch, `open -a` does not restart it, and LaunchServices
  silently drops `--env` for a bundle path it thinks is already running. **One plan per launch, into
  a fresh bundle path.**
- **Set the language explicitly through the picker at the top of every plan.** The webview's
  `localStorage` follows the **bundle identifier**, not `HOME`, so a previous launch's override leaks
  into a fresh bundle with a fresh `HOME` (`docs/decisions/2c-2-2-window-reading.md` §1.2). Two
  launches of that reading failed by looking for an English control on a Spanish screen.
- **Record it as `docs/decisions/2c-3b-2-window-reading.md`**, in the shape of
  `docs/decisions/2c-3a-2-window-reading.md`.

**What the reading must settle, beyond "it draws".**

1. **The destination panel's height, measured, in Spanish.** §2.8 gave it `max-height: 12rem` with a
   sticky action row — **a bound, not a measurement**. It is the same one-row-per-something shape that
   put 2c-3a-2's creation form at 805 px tall inside a 645 px pane with its primary control below the
   fold. Drive it over the longest sequence available. **Spanish is the longer language**, and
   `fragmento` is longer than the `atajo` it replaced.
2. **The creation form's width in Spanish, while you are there.** `PROGRESS.md` has owed this since
   the terminology change: the re-taken 2c-3a-2 reading measured only **13 px** of margin *before*
   `fragmento` replaced `atajo`, and no screen has drawn the longer word yet.
3. **The three rewritten sentences, on screen, in both languages** — `moved`, `movedNotIdentified`
   and `cannotMove.outOfDate`. All three grew in the fix rounds and **no test asserts what a sentence
   says**, only which key is drawn (notes hole 10, taken deliberately: substring assertions over copy
   are brittle enough to become their own defect). The reading is the only thing that can see them
   wrap, overflow or read as nonsense.
4. **`invalidatedByCommit`, still unsettled** (`2c-3b-1-notes.md` §5, and item 10 of the superseded
   list below). Drive a file of **at least three snippets** with the selection moved mid-flight both
   **inside** the shifted range and **outside** it. Measured today: a selection at a position the
   reorder touched is dropped with the `differentMatch` notice, which tells the person the file
   *changed on disk* and that what is now in that position is a different snippet — after a move they
   asked for, with the snippet still in the file one row above. **If that reads as a false alarm, the
   fix is an explicit notice argument on the adoption, never a swap inside `repairAfter`** — a
   conflicted move really did move the file under the person, and the same code serves it.
5. **Whether a spent session reads as a dead end.** The panel offers no repair for `outOfDate`,
   `alreadyMoved` or `mayHaveWritten`, by decision: the sentences are supposed to say *close this and
   pick the snippet again*. Whether they actually do is a claim about a screen.
6. **The silent absence of Move while an editor is open.** The R36 conservative refusal means a
   snippet with an open editor is not offered a move **and no sentence explains why**. The
   confirmation review judged that acceptable for the chosen policy — but "acceptable" was a judgement
   about code, and whether it is confusing is a judgement only a window can make.

**A window reading is re-taken after any change to a component.** If the reading finds a defect and
you fix it, the reading is taken again — 2c-1b took two and 2c-3a-2 took a 12-launch reading plus a
6-launch re-take for exactly this reason.

### What was decided in this step that a later session must not silently undo

- **`invalidated` means *identities this session can no longer vouch for*, and it has TWO producers
  that differ in kind.** `applyMove` sets it when a projection was **replaced**; `moveRecoveryFailed`
  sets it when one was **not** — the projection is still installed, and what happened is that the
  command contradicted the identity and the window could not obtain a better one. Reading the field as
  *the projection was replaced* is wrong for one of its two producers, and the module header said
  exactly that until the confirmation pass.
- **`cannotMove.outOfDate` can say *"This move wrote nothing"* only because of the refusal
  precedence.** `mayHaveWritten` and `alreadyMoved` are both asked above it, so a session that wrote —
  or may have — never reaches that sentence. **Reordering `refusalGiven` would silently make that copy
  a lie**, from a file that looks unrelated to it.
- **`rereadDocument` captures three generations before its await**, and the two per-document counters
  fail to distinguish workspaces for **opposite** reasons: `open()` clears `projectionGenerations`,
  while `rereadGenerations` is monotonic and survives it. Only `openGeneration` separates workspaces.
- **F5 was fixed at the session, not at the workspace, on purpose.** Making a failed recovery re-read
  invalidate the workspace's projection and selection would have meant driving the two counters, and
  mis-driving them is a defect this project has already shipped once. A Medium does not justify it.

### The debt this step found and did not pay

**`browser.matchDeletion.sendFailed` has F4's exact defect** — *"The snippet is still in the file"* —
and was left because changing a shipped screen's copy obliges a re-taken window reading of the
sub-phase that owns it (2c-3a-2). See the disposition section above. **`browser.rawEditor.discardWarning`
is still outstanding for the same reason**, and has been since 2c-2-2. These two are now a pair, and
the rule is the same for both: **whichever sub-phase next touches that screen owes the fix and the
re-taken reading.**

---

**Phase 2c-3b step 1 (superseded by the above, kept for its rationale) is complete: move exists as a
value, and nothing draws it.**
`docs/decisions/2c-3b-1-notes.md` is the record (§6 is eighteen open holes, §7 / §8 / §9 are the three
review rounds). The design consult for the whole of 2c-3b is `docs/reviews/phase-2c-3b-design.md`; the
three code reviews are `docs/reviews/phase-2c-3b-1-{code,confirmation,third-pass}.md`, and **all three
returned `READINESS: NOT READY`. All fourteen findings were fixed before the commit.**

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1219 passed, 43 files
```

(`cargo test --workspace` expects **1008**, unchanged — step 1 wrote no Rust, and step 2 should need
none either.)

### That open decision is TAKEN, the fourth pass ran, and it found two High findings

**The decision the previous checkpoint left open — whether to re-review round 3's own fixes — was
taken in favour of running the pass, and the pass returned `READINESS: NOT READY`.** Both findings
are fixed and committed; the disposition table is *Phase 2c-3b-1 fourth pass disposition* above and
the review is `docs/reviews/phase-2c-3b-1-fourth-pass.md`. In short: the precedence rule round 3
wrote had been applied to `mayHaveWritten` but **not** one pair further down, where the frozen
`notMovable` still beat `outOfDate`; and two comments still justified the terminal state by
**duplicate execution**, the claim §9 had just removed from both dictionaries.

**The rule that produced both is now four rounds old and still generating findings: each round's fix
produces the next round's finding.** Step 2 should expect the same of its own fix rounds rather than
treat a second pass as a formality.

**Step 1's own baseline moved with the fix**: the frontend suite is now **1219**, not 1218.

**The next step is Phase 2c-3b step 2 — move on a screen.** Step 1 deliberately touched no `.svelte`
file, so **two of `2c-split-notes.md` §7's three kinds of evidence are still owed**: the
mounted-component test and the window reading. Only the model tests exist.

**Do not re-commission the design consult.** `docs/reviews/phase-2c-3b-design.md` covers the whole of
2c-3b, step 2 included, and **seven of its nine answers are statements about the *screen* that step 1
could only prepare for**: Q1 (the affordance — a destination panel of **Top** / **After…** / **End**
with one explicit move action, the moving snippet excluded from the anchors, row controls and
drag-and-drop deferred), Q4 (the boundary sentence that says moves stay inside the file, kept beside
the list even in *All*), Q5 (the selection — follow the moved snippet only if it is still the current
selection when the answer lands, and never reclaim it otherwise), Q6 (the destination list is the
**unfiltered** document order, and the chosen anchor is named), Q7 (no confirmation dialog — choosing
a destination and pressing move is already two deliberate steps), Q8 (the typed command failure with a
**Reload file** recovery) and Q9 (the dirty-draft rule, and truthful copy about preserving edits).

**What step 1 built that step 2 must call and must not redesign.**

- **`src/lib/browser/matchMove.ts` is the whole of move as a value**, exactly as `matchCreation.ts`
  and `matchDeletion.ts` are for new and delete. The component is a thin walk over it. Every
  decision — what may be moved, where to, when a send may start, what a refusal means — is in that
  module, and that is why fourteen review findings were reachable without a screen.
- **The invariant is "same sequence", not "same file"** (consult correction 4). `sequenceOf` reads
  `MatchView.path`, requires the last step to be an index, and carries the **file identity beside the
  steps** — `matches[0]` of two files is one path and two sequences. Today's projection gives a file
  one snippet list; encoding that coincidence is what this shape exists to prevent.
- **`end` is the UI's lowering, never a wire arm.** The wire has only `after: MatchId | null`, so
  `MoveTarget` is a second type from `MovePlacement` precisely so the lowering cannot be mistaken for
  the contract. `alreadyThere` is computed on the **lowered target**, because for the last snippet
  *end* and *after the item above it* are two placements and one request.
- **The anchor list is the complete sequence minus the snippet itself** — derived from the document
  projection, **never** from the filtered list the search box produces. A query must not decide where
  a snippet lands.
- **Only co-sequential snippets are offered, with one boundary sentence** —
  `browser.matchMove.withinThisFile`, whose `{file}` the component fills. Creation's *show every
  ineligible destination* rule does **not** generalise to a move's anchors (correction 8).
- **`moveNotWithinOneSequence` is a typed command failure, not an acknowledgeable refusal**
  (correction 3): it carries no findings, so *Save anyway* beside it would be a button that can never
  work. `moveRecoveryChoices` offers **Reload file** for exactly four codes, and
  `identityStaleRevision` is one of them because that — not the sequence error — is what a stale
  projection normally produces (correction 5).
- **R25 gets no message at all** (correction 1). Nothing in this UI can express a combined batch, so a
  warning would describe a request nobody can make. The module header says so; do not "fix" the
  omission.
- **The dirty-draft rule is `moveEligibility`'s `unsavedDraft` arm, and it is this application's
  workflow policy rather than the file refusing** (correction 2). The fact arrives as an argument,
  `unsavedDraftFor`, **required and nullable** so no function invents "there are none" for a caller
  that did not look.
- **Where two refusal arms are true at once, the one that claims less wins.** `mayHaveWritten` — *this
  application cannot tell what happened* — is asked **first**, above `alreadyMoved` and above the
  liveness check whose sentence says nothing was written. That ordering is round 3's first finding and
  it is written as a rule with its reason, not as an arrangement of `if`s. **The same rule now puts the
  liveness check above `notMovable`** (the fourth pass's first finding): `eligibility` is frozen at
  `startMatchMove` and never recomputed, so after a reprojection *this snippet cannot be moved* is a
  definite claim read off a replaced parse while `outOfDate` is the half still known to be true.
- **`MatchMoveView.notMovable` is the frozen reason and `cannotMove` is the live one, and a component
  may not draw the first beside a `cannotMove` of `outOfDate`.** They answer at two different times.
  Drawing both puts the definite claim back on screen exactly where the precedence suppressed it —
  and **nothing in TypeScript can enforce this**, because the only place it can be broken is a
  `.svelte` file. The rule is on the field's own doc comment.
- **`BrowserState.moveMatch` now mirrors `saveMatch`**: it answers `MatchSaveAnswer`, it **reads
  `adoptTheDocumentOnDisk`'s return value** and reports a failed re-read *beside* a committed outcome,
  and it calls `forgetTextOf(document)` rather than `forgetFileText()`. All three latent shapes this
  file recorded are closed. Never answer `SaveResult | null` from a writing wrapper.
- **The identity a submission checks is read from the live projection at the moment of the click** —
  `beginMove(session, projected)`, the same rule `confirmDelete` follows. Handing back `session.match`
  defeats the whole check, and **nothing in TypeScript can say where an argument came from**.
- **A `MatchId` handed to `draft.ts` must be a plain object.** `structuredClone` throws on a `$state`
  proxy; `plainIdentity()` — now **exported** from `matchDeletion.ts` rather than copied — is the
  pattern, and **a model test cannot catch a repeat of this**, because model tests pass plain fixtures.

**What step 2 owes, beyond drawing it.**

1. **All three kinds of evidence** (`2c-split-notes.md` §7): model tests (step 1 has these), at least
   one **mounted-component test** (`/** @vitest-environment jsdom */` as the **first** line, as
   `MatchEditor.test.ts`, `MatchCreator.test.ts` and `MatchDeleter.test.ts` do; **do not back-fill the
   existing six components**), and **a recorded window reading** — `1c-1-notes.md` §10 for the
   technique, `1c-2b-2b-2-notes.md` §6.1 for the WKWebView constraint: **one plan per launch, into a
   fresh bundle path**. **A window reading is re-taken after any change to a component.**
2. **Set the language explicitly through the picker at the top of every plan.** The webview's
   `localStorage` follows the **bundle identifier**, not `HOME`, so a previous launch's override leaks
   into a fresh bundle with a fresh `HOME` (`CLAUDE.md` §6).
3. **Rebaseline the module guard honestly if it moves.** It is **166** now. Build a pristine
   `git archive HEAD` copy and subtract; a delta equal to the number of new source modules is a new
   module, a jump to ~180 with `svelte/internal/server` in the bundle is the `resolve.conditions`
   regression. **Never rebaseline by editing the condition.**
4. **`MoveRecovery.reloadFile` has no producer on `BrowserState`.** There is **no public re-read of one
   document** — `commands.reloadDocument` is reached only from inside `select()`'s repair. The view
   offers the recovery as a **code**; step 2 must add the call behind it, exactly as 2c-3a-1's hole 2
   recorded that `BrowserState` exposed no projection list until step 2 needed one.
5. **`unsavedDraftFor` has no producer either.** Every call in step 1 passes `null` or a fixture, so
   the rule is written and unexercised in the running application. The component supplies the fact,
   from whatever the detail pane knows about an open `matchEditor` session — **and the identity it
   supplies has to be a live one**, because the comparison is all three fields.
6. **What produces that live identity is R36 / hole 18, and it is not decided.** Either own a
   coordinator that re-points the editor-to-snippet relation in the same synchronous block that
   installs a projection, **or** refuse a move for a snippet with a stale draft until the draft is
   saved or discarded. **Not** `identityInProjection`, and not any other lookup that infers
   cross-revision identity from an arena node.
7. **Hand the view, the destination options and the submission identity *one* current projection read,
   in *one* synchronous block** (R37). The model's agreement is one rule over **consistent** inputs and
   nothing forces consistency.
8. **`BrowserState.moveMatch` still takes `MatchView`s where `matchMove.ts` produces `MatchId`s.** Only
   `.id` is read from either, so the projections are friction rather than information. Either resolve
   the identities against the live projection — the read `beginMove` already requires — or change the
   wrapper's first two parameters. It was left because it is a decision about what a *move component*
   holds, and step 1 has none.
9. **There is no way back from an `outOfDate` session, and none from a `mayHaveWritten` one.** Both are
   surfaced refusals rather than repairs: closing the panel and picking the snippet again is what the
   sentences tell a person to do. **Offering a repair is a screen decision**, and so is whether the
   panel says it.
10. **Settle the `invalidatedByCommit` question in the reading** (`2c-3b-1-notes.md` §5). Measured
    today: a selection at a position the reorder did not touch is kept, and one at a position it did
    touch is **dropped with the `differentMatch` notice**, which tells the person the file *changed on
    disk* and what is now in that position is a different snippet — after a move they asked for, with
    the snippet still in the file one row above. Drive it over a file of at least three snippets with the
    selection moved mid-flight **inside** the shifted range and **outside** it. If the sentence reads
    as a false alarm, the fix is an explicit notice argument on the adoption, **never** a swap inside
    `repairAfter` — a conflicted move really did move the file under the person, and the same code
    serves it.

**A layout defect is a defect, and only a window shows it.** 2c-3a-2's creation form opened with its
primary action at y=813 in a 645 px pane — past 1160 passing tests, `svelte-check` with zero warnings
and two Codex passes over the very component. The cause was an **unbounded list** whose height scaled
with the user's file count. **A move's destination panel draws one row per snippet in the sequence**,
which is the same shape and can be longer: **it owes a bound and a measurement**, taken in **Spanish**,
the longer language. `fragmento` is now the Spanish noun for a snippet everywhere, it is **longer than
`atajo`, and no screen has yet drawn it** — the re-taken 2c-3a-2 reading measured only 13 px of margin
on the creation form before the term changed, so step 2's reading should look at that form's width
while it is there.

**One thing inherited that is still owed.** `browser.rawEditor.discardWarning` still says *"Your
changes have not been written to the file"*, which is **false after a `mayHaveWritten` send failure** —
the very state 2c-3b-1 gave the move panel a truthful sentence for. The small editor's twin was fixed
in 2c-2-2; the raw editor's was left because changing it obliges a re-take of 2c-1b's window reading.
**Whichever sub-phase next touches the raw editor owes the fix and the re-taken reading.**

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged.

---

**Phase 2c-3a (superseded by the above, kept for its rationale) is complete, both steps: a person can
create a snippet and delete one from a window, and the selection survives a delete.**
`docs/decisions/2c-3a-2-notes.md` is step 2's record
(§4 is fourteen open holes) and `docs/decisions/2c-3a-2-window-reading.md` is its window reading —
12 launches plus a 6-launch re-take, and it is the primary evidence for the phase. The two code
reviews are `docs/reviews/phase-2c-3a-2-{code,confirmation}.md`; the first returned **NOT READY** on
two findings and the second, after the fix, returned **READY**. **All findings, and the window
reading's own layout defect, were fixed before the commit.**

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1160 passed, 42 files
```

(`cargo test --workspace` expects **1008**, unchanged — neither step of 2c-3a wrote any Rust, and
2c-3b should need none either.)

### The Spanish snippet term — DECIDED BY THE OWNER and applied

**The owner chose `fragmento`.** The Spanish dictionary had called a snippet both `atajo` (the 2c
namespaces) and `fragmento` (everything older), and the window reading's L9 drew both **five lines
apart in a single pane**. The split predated 2c-3a-2; that step widened it and was the first to put
both words on screen together. `fragmento` won as the established majority term and the closer match
to the English *snippet* — `atajo` means *shortcut*, which in espanso more naturally names the
**trigger** than the match.

**The real count was 49 strings / 60 occurrences, not the 22 first reported**, and the discrepancy is
worth keeping: 22 was this *step's own* new strings, and the whole-dictionary figure was never
checked until the change was made. It reconciles — `git show 37ea352:src/lib/i18n/es.json` holds 27,
step 2 added 22, and 27 + 22 = 49 at `57bf362`. **Zero occurrences remain**, and none was kept back:
all 49 were read against their `en.json` counterparts and every one said *snippet* — not one was a
keyboard shortcut or about the trigger. `git diff --numstat` reports **49 changed, 0 added, 0
removed**, so no key moved and the parity suites still pass.

**⚠️ What this leaves open, and it is not nothing.** The change is **dictionary-only** — it touches no
component, so it obliges no re-taken window reading, and none was taken. But `fragmento` is the
**longer** noun, and the re-taken reading measured Spanish with only **13 px of margin** on the
creation form. **No screen has been observed drawing the longer word**, so control width — e.g.
*Añadir este fragmento* — is unverified. The sticky action row should keep the primary control
visible regardless of wrapping, which is why this was judged safe to defer rather than safe to
ignore. **2c-3b's window reading must set the language to Spanish through the picker anyway; it
should look at the creation form's width while it is there.**

**Two further Spanish inconsistencies were found while making this change, reported and deliberately
NOT fixed** — expanding the change beyond the term the owner ruled on was out of scope:

- **A real split.** English's single *"a single value"* is Spanish's `un valor suelto` in four codes
  (`code.valueKind.scalar`, `code.nodeKind.scalar`, `code.editError.notAScalar`,
  `code.verificationFailure.targetKindChanged`) **and** `un valor único` in five
  (`code.draftError.notAScalar`, `.fieldHasAnUnmodelledShape`, `.variableFieldHasNoScalar`,
  `.entryDraftsAScalarAndASequence`, `.nestedValueIsACollection`).
- **A collision this change sharpened.** `browser.matchEditor.readOnly.unmodelledShape` and
  `browser.matchEditor.shapeOnly` say `un solo fragmento de texto` for "a single piece of text" — in a
  pane that now says `fragmento` for the snippet itself.
- **Not a defect**, checked and dismissed: `conjunto de claves` vs `bloque de claves` faithfully
  mirrors English's own *set of keys* / *block of keys*.

**The next step is Phase 2c-3b — move on a screen**, per `docs/decisions/2c-split-notes.md` §2:
`move_match` drawn, the new identity adopted, and the cross-sequence and combined-edit refusals
**surfaced rather than hidden**. Like 2c-3a it **fails as an identity mistake**, so the care 2c-3a
needed carries over unchanged.

**2c-3b owns the two latent shapes `BrowserState.moveMatch` still carries**, and that is the whole
reason they were deferred rather than forgotten:

- its `SaveResult | null` return, and
- **a stale projection left installed when its own re-read fails.**

Its `baseRevision` was already fixed in 2c-3a-1. It has had **no production caller** until now, which
is precisely why nothing about a component blocked the deferral — and why 2c-3b must not draw it
before fixing them.

**Two refusals 2c-3b must surface rather than hide** — both are locked decisions, not defects:
`ItemMove` is **same-sequence only** (D2r: no moving between files or between sequences), and a move
**may not be combined with any other edit in one batch** (R25).

**What 2c-3a-2 built that 2c-3b must copy and must not redesign.**

- **`MatchCreator.svelte` and `MatchDeleter.svelte` hold no rule.** Every decision lives in
  `matchCreation.ts` / `matchDeletion.ts`, which is why both of this step's review findings were
  fixable without touching behaviour. Keep that shape.
- **The identity a confirmation checks is read from the live projection at the moment of the click** —
  `identityInProjection(projections(), session.match)` in `matchDeletion.ts`, called from exactly one
  path in `MatchDeleter.svelte`. Never hand back `session.match`. Nothing in TypeScript enforces
  this; the module header says so in the same sentence as what it does force.
- **Every writing wrapper forwards the *submission's* base revision**, never the live projection's.
  `saveMatch` now takes one — the last half of 2c-3a-1's second finding, closed at 2c-3a-2 with the
  signature and its `MatchEditor.svelte` caller moved together.
- **`BrowserState.views` exposes the projections** and was added for `startMatchCreation`. It is
  **not one per listed file**: a refused `get_document` leaves no projection, so a per-file list
  walks `documents` and looks each one up in `views` — which is why `destinationsOf` takes both.
- **A `MatchId` handed to `draft.ts` must be a plain object.** `structuredClone` throws on a
  `$state` proxy, and `BrowserState.views` is deeply proxied. `plainIdentity()` in
  `matchDeletion.ts` is the pattern; **a model test cannot catch a repeat of this**, because model
  tests pass plain fixtures.

**What 2c-3b owes, beyond drawing it.**

1. **All three kinds of evidence** (`2c-split-notes.md` §7): model tests, at least one
   **mounted-component test** (`/** @vitest-environment jsdom */` as the **first** line; **do not
   back-fill the existing six components**), and **a recorded window reading**.
2. **Set the language explicitly through the picker at the top of every plan.** The webview's
   `localStorage` follows the **bundle identifier**, not `HOME`.
3. **A window reading is re-taken after any change to a component.** 2c-3a-2 re-took its reading over
   six further launches for a change that was pure CSS, and the re-take is what turned the layout fix
   from an intention into a measurement.
4. **Rebaseline the module guard honestly if it moves.** It is **165** now. Build a pristine
   `git archive HEAD` copy and subtract; a delta equal to the number of new source modules is a new
   module, a jump to ~180 with `svelte/internal/server` in the bundle is the `resolve.conditions`
   regression. **Never rebaseline by editing the condition.**

**One thing inherited that is still owed.** `browser.rawEditor.discardWarning` still says *"Your
changes have not been written to the file"*, which is **false after a `mayHaveWritten` send
failure**. The small editor's twin was fixed in 2c-2-2; the raw editor's was left because changing it
obliges a re-take of 2c-1b's window reading. **Whichever sub-phase next touches the raw editor owes
it.**

**A layout defect is a defect, and only a window shows it.** 2c-3a-2's creation form opened with its
primary action at y=813 in a 645 px pane — past 1160 passing tests, `svelte-check` with zero
warnings, and two Codex passes that both examined the very component. The cause was an **unbounded
list** whose height scaled with the user's file count, so it got worse the more real the
configuration. Any new pane that draws one-row-per-something owes a bound and a measurement.

---

**Phase 2c-3a step 1 (superseded by the above, kept for its rationale): new and delete existed as
values and nothing drew them.** `docs/decisions/2c-3a-1-notes.md` is the record (§4 is twelve open holes,
§5 / §7 / §8 are the three review rounds). The design consult for the whole of 2c-3a is
`docs/reviews/phase-2c-3a-design.md`; the three code reviews are
`docs/reviews/phase-2c-3a-1-{code,confirmation,third-pass}.md`, and **all three returned
`READINESS: NOT READY`. All ten findings were fixed before the commit.**

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1116 passed, 40 files
```

(`cargo test --workspace` expects **1008**, unchanged — step 1 wrote no Rust, and step 2 should
need none either.)

**The next step is Phase 2c-3a-2 — new and delete on a screen.** Step 1 deliberately touched no
`.svelte` file, so **two of `2c-split-notes.md` §7's three kinds of evidence are still owed**: the
mounted-component test and the window reading. Only the model tests exist.

**Do not re-commission the design consult.** `docs/reviews/phase-2c-3a-design.md` covers the whole
of 2c-3a, step 2 included — its Q1 (the selection after a delete), Q2 (the two-phase confirmation),
Q4 (the position default), Q5 (the destination list) and Q6 (the last snippet) are all statements
about the *screen* that step 1 could only prepare for.

**What step 1 built that step 2 must call and must not redesign.**

- **`src/lib/browser/matchCreation.ts` and `matchDeletion.ts` are the whole of new and delete as
  values**, exactly as `matchEditor.ts` is for the small editor. The components are thin walks
  over them. Every decision — what may be created, where, what a confirmation means, when a save
  may start — is in those two modules, and that is why ten review findings were reachable without
  a screen.
- **Deletion is two phases and `confirmDelete` is the only producer of a `StartedDeletion`.**
  `requestDelete` asks, `cancelDelete` takes it back, `confirmDelete(session, projected)` is the
  only thing that yields something to send. **`projected` must be read from the live projection**,
  never passed back as `session.match` — the module's header says plainly that nothing enforces
  where the argument came from, and a component that hands back the session's own identity defeats
  the whole check.
- **A destination is offered even when it cannot receive a snippet.** Five typed refusals —
  `notASnippetFile`, `readOnly`, `couldNotBeRead`, `notParsed`, `noMatchList` — rendered with
  `tDestinationRefusal`. **Never build the key.** Silently omitting a file the sidebar names is
  what consult Q5 rejects.
- **The `After` anchor is an identity and cannot outlive its file.** Changing the destination
  clears or replaces an incompatible anchor. Do not offer a position picker that stores an ordinal.
- **Both wrappers take a `baseRevision` and forward it unchanged.** Pass the *submission's* base,
  the one the form or session holds — not whatever the window's projection happens to say at the
  moment of the click. That was round 1's second High finding.
- **`code.commandError.documentHasNoMatchList` can finally be drawn**, and only `create_match`
  produces it.

**What step 2 owes, beyond drawing it.**

1. **The three kinds of evidence of `2c-split-notes.md` §7, all three**: model tests (step 1 has
   these), at least one **mounted-component test** (opt in with `/** @vitest-environment jsdom */`
   as the first line, as `MatchEditor.test.ts` and `DetailPane.test.ts` do; **do not back-fill the
   existing six components**), and **a recorded window reading** — `1c-1-notes.md` §10 for the
   technique, `1c-2b-2b-2-notes.md` §6.1 for the WKWebView constraint: **one plan per launch, into
   a fresh bundle path**. A window reading is **re-taken after any change to a component**.
2. **Set the language explicitly through the picker at the top of every plan.** The webview's
   `localStorage` follows the **bundle identifier**, not `HOME` (`CLAUDE.md` §6).
3. **`BrowserState.saveMatch` still substitutes `view.revision`** for the caller's base, the one
   half of round 1's finding 2 that was left. Its caller is `DetailPane.svelte:435`, which step 2
   touches anyway — **fix the signature and the caller together.** `matchEditor.baseRevisionOf`
   exists and is unused; it is what should be passed.
4. **`startMatchCreation` needs `DocumentView[]` and `BrowserState` does not expose one.** A
   projections accessor is owed before a component can build the destination list.
5. **Where `confirmDelete`'s `projected` is read from** is a decision step 2 must make explicitly
   and write down, for the reason in the second bullet above.
6. **Rebaseline the module guard honestly if it moves.** It is **161** now. Build a pristine
   `git archive HEAD` copy and subtract; a delta equal to the number of new source modules is a new
   module, a jump to ~180 with `svelte/internal/server` in the bundle is the `resolve.conditions`
   regression. **Never rebaseline by editing the condition.**

**Two things inherited that are still owed.**

- **`BrowserState.moveMatch` still carries two latent shapes** — a `SaveResult | null` return and a
  stale projection left installed when its own re-read fails. Its `baseRevision` was fixed in this
  step. **It has no production caller**, so nothing about a component blocks fixing the rest;
  **2c-3b is the sub-phase that puts move on a screen and owns them**, and that is the whole reason
  they are deferred.
- **`browser.rawEditor.discardWarning` still says *"Your changes have not been written to the
  file"***, which is false after a `mayHaveWritten` send failure. The small editor's twin was fixed
  in 2c-2-2; the raw editor's was left because its markup is outside that cut and changing it
  obliges a re-take of 2c-1b's window reading. Whichever sub-phase next touches the raw editor
  owes it.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged.

---

**Phase 2c-2 is complete, both steps: a person can now open one snippet in a window, edit its six
fields, undo, save, and read what the save did.** `docs/decisions/2c-2-2-notes.md` is the record (§4
is fifteen open holes); `docs/decisions/2c-2-2-window-reading.md` is the four window readings, 26
launches, and it is the primary evidence for the phase. The two code reviews are
`docs/reviews/phase-2c-2-2-code.md` and `-confirmation.md`, and **both returned
`READINESS: NOT READY`. All seven findings were fixed before the commit**, as were the four the
window readings found and the two the implementer's own audit found afterwards.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1020 passed, 38 files
```

(`cargo test --workspace` expects **1008**, unchanged — 2c-2-2 wrote no Rust, and 2c-3a should need
none either.)

**The next step is Phase 2c-3a — new and delete on a screen**, per `docs/decisions/2c-split-notes.md`
§2: `create_match` and `delete_match` on a screen, the returned identity adopted, and **the
selection's behaviour when the snippet deleted is the one selected**. It **fails as an identity
mistake**, which is a different failure mode from 2c-2's and needs a different kind of care: 2c-2's
worst case was writing the wrong value into the right place, and 2c-3a's is holding a `MatchId` that
no longer names anything.

**Do not re-commission the 2c design consult.** `docs/reviews/phase-2c-2-design.md` covers 2c-2 only;
the split itself came from `docs/reviews/phase-2c-split-design.md` and covers the whole of 2c.

**What 2c-2-2 built that 2c-3a must call and must not redesign.**

- **`src/lib/components/MatchEditor.svelte` is a walk over `matchEditorView`, and holds no rule.**
  Every decision about what may be edited, what a draft means, when a save may start and what a
  commit moves is in `src/lib/browser/matchEditor.ts`. Keep new screens that shape; it is why this
  phase's four code findings were fixable in a value.
- **A snippet and its file are captured together**, in one assignment
  (`MatchEditingSession` in `DetailPane.svelte`). Passing a second value straight from the live
  selection is the High finding of this phase and type-checks perfectly.
- **A committed save owes a re-projection, and the obligation lives on the session.**
  `needsReprojection` is set by a commit and cleared by **nothing** but `startMatchEditor` over a
  fresh projection; `isEditable` is `false` while it is `true`. There is deliberately **no *Dismiss***
  on a committed panel. A delete has the same problem in a stronger form — see below.
- **`Reprojection` answers a typed reason, never a bare `null`**
  (`notProjected | otherFile | otherSnippet`). A refusal with no reason is not representable, and
  `DetailPane.reprojectMatch` is the one implementation: it compares `document`, then `node`, then
  `revision`.
- **`MatchSaveAnswer` has three arms** — `answered`, `notAttempted` (no fields, because no command
  ran) and `failed` with `failure: IpcFailure` **required**. Wire `createMatch` and `deleteMatch`
  the same way; do not answer `SaveResult | null`.
- **`sendFailureLines` in `editorSave.ts` walks the failure chain once**, in the model, so how deep a
  screen goes is a decision a test can fail on. Reuse it; do not decide it in markup.
- **A refused field shows its value and names where the value came from**
  (`shownValuesOf`, `ShownValue.source`, `tDetailField`). Any new read-only surface owes the same:
  showing a name and a reason with nothing between them is this phase's first window-reading defect.
- **A value's source text goes through `SourceText`, never into a control.** Measured in the shipped
  WKWebView: a `<textarea>` turns `"x\ry\r\nz"` into `"x\ny\nz"` and an `<input>` **deletes** a
  carriage return (`"p\rq"` → `"pq"`). No control in this application can produce one.

**What 2c-3a owes.**

1. **The three kinds of evidence of `2c-split-notes.md` §7, all three**: model tests in
   `src/lib/browser/`, at least one **mounted-component test** (opt in with
   `/** @vitest-environment jsdom */` as the first line, as `MatchEditor.test.ts` and
   `DetailPane.test.ts` do; **do not back-fill the existing six components**), and **a recorded
   window reading** — `1c-1-notes.md` §10 for the technique, `1c-2b-2b-2-notes.md` §6.1 for the
   WKWebView constraint: **one plan per launch, into a fresh bundle path**. A window reading is
   **re-taken after any change to a component**; 2c-2-2 took four.
2. **Set the language explicitly through the picker at the top of every plan.** The webview's
   `localStorage` follows the **bundle identifier**, not `HOME`, so a previous launch's override
   leaks into a fresh bundle with a fresh `HOME`. This **corrects `2c-1b-notes.md` §9.1**, which said
   `HOME` keys it; the correction is in `CLAUDE.md` §6 and cost two launches to find.
3. **Neither `createMatch` nor `deleteMatch` is wired into `BrowserState` yet.** Both exist in
   `src/lib/ipc/commands.ts` (lines 502 and 561) and neither appears in `workspace.svelte.ts` —
   only `moveMatch`, `saveMatch` and `saveRawDocument` do. Wiring them is 2c-3a's, through the
   wrapper, with the adoption performed **before the answer is handed back**.
4. **A deletion answers `moved: null`, and that is the answer rather than a gap.** `deleteMatch`'s
   own JSDoc is explicit: the snippet that was deleted has no identity in the new revision, and
   filling `moved` with a neighbour's identity would put a position back into the one field that
   exists to replace positions with identities. **Every `MatchId` held for that file is stale
   afterwards.** Re-read the document and choose — that choice is this sub-phase's central UI
   question.
5. **Deleting the last snippet of a file is refused** by the core, with `saveFailed` carrying the
   engine's own reason. Offer to delete the file instead, or say so; **do not retry**, and do not
   invent a force flag — there is none anywhere in this design.
6. **`code.commandError.documentHasNoMatchList` can finally be drawn.** `match_list_of` in
   `src-tauri/src/commands.rs` has exactly one caller, `create_one_match`, so **only `create_match`
   produces it** — 2c-2-2 recorded it as a hole precisely because it belongs here.
7. **Rebaseline the module guard honestly if it moves.** It is **158** now. Build a pristine
   `git archive HEAD` copy and subtract; a delta equal to the number of new source modules is a new
   module, a jump to ~180 with `svelte/internal/server` in the bundle is the `resolve.conditions`
   regression. **Never rebaseline by editing the condition.**

**Three things inherited that are still owed.**

- **`BrowserState.moveMatch` still carries all three latent shapes** that findings 1, 2 and 6 fixed
  in `saveMatch`: a `SaveResult | null` return, a stale projection left installed when its own
  re-read fails, and an un-dropped `conflictText`. **No screen calls it yet. 2c-3b is the sub-phase
  that puts move on a screen, and it must fix these first** — they were written down rather than
  changed silently because fixing them alters a published signature outside 2c-2's cut.
- **A component can still bypass the wrapper.** `src/lib/ipc/commands.ts` exports `saveMatch`, and
  nothing in TypeScript, `svelte-check` or the three lint scanners stops a `.svelte` file importing
  it directly and skipping adoption — the same hole `moveMatch` and `saveRawDocument` have had since
  2b-2a. **Today no component imports that module for anything but a type**, which is a fact about
  the code as written and not a guarantee. This is stated in `BrowserState.saveMatch`'s own JSDoc in
  the same sentence as what the wrapper does force, and `createMatch`/`deleteMatch` will inherit it.
- **`browser.rawEditor.discardWarning` still says *"Your changes have not been written to the
  file"***, which is false after a `mayHaveWritten` send failure. The small editor's twin was fixed
  in 2c-2-2; the raw editor's was left because its markup is outside that cut and changing it obliges
  a re-take of 2c-1b's window reading. Whichever sub-phase next touches the raw editor owes it.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged.

---

**Phase 2c-2 is split into two steps, and step 1 is complete: the small editor exists as a value
and nothing draws it.** `docs/decisions/2c-2-1-notes.md` is the record (§4 is ten open holes). The
design consult for the whole of 2c-2 is `docs/reviews/phase-2c-2-design.md`; the two code reviews
are `docs/reviews/phase-2c-2-model-code.md` and `-confirmation.md`, and **both returned
`READINESS: NOT READY`. All seven findings were fixed before the commit.**

**Do not re-commission the design consult.** `phase-2c-2-design.md` covers the whole of 2c-2,
step 2 included — its Q1 (word boundary), Q2 (the carriage return), Q5 (trigger read-only) and Q7
(the most likely missed defect) are all statements about the *screen* that step 1 could only
prepare for.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 974 passed, 36 files
```

(`cargo test --workspace` expects **1008**, and step 2 should write no Rust.)

**The next step is Phase 2c-2-2 — the small editor's screen.** Step 1 deliberately touched no
`.svelte` file, so **two of `2c-split-notes.md` §7's three kinds of evidence are still owed**: the
mounted-component test and the window reading. Only the model tests exist.

**What step 1 built that step 2 must call and must not redesign.**

- **`src/lib/browser/matchEditor.ts` is the whole editor as a value**, exactly as `rawEditor.ts` is
  for the raw editor. The component is a thin walk over it. That is what made step 1's protocol
  testable at all, and it is the only reason the seven review findings were reachable without a
  screen.
- **`MatchBaseline` and `MatchBuffers` are two values and `fieldIntent` is the only reader of
  both.** Do not let a control write into the baseline, and do not seed a buffer from anything but
  the projection. **An initially absent field left blank must stay `'Unchanged'`** — that single
  rule is what stops the app writing `label: ''` into a file that never had a label.
- **Eligibility is computed before anything is bound.** Five reasons: `notDecodable`,
  `carriageReturn`, `ownsNoBytes`, `unmodelledShape`, `triggerNotSingle`. The consult's Q5 asked
  for **read-only, not disabled** — the value stays selectable and the reason is shown inline.
  Render the reason with `tFieldRefusal`; **never build the key.**
- **The word-boundary control is three text fields, and it may not become a checkbox.** D2u forbids
  deciding that `word: on` means true. A screen that wants to name the trigger shape a snippet
  *does* have calls `tTriggerKind`.
- **`describeEditSave`, not `describeWholeDocumentSave`.** The outcome is **not** sealed; a field
  edit invalidates no identity by itself. `editorSave.ts` holds the five save decisions both
  editors share — extend it rather than copying `rawEditor.ts` a second time.
- **`BrowserState.saveMatch` answers `MatchSaveAnswer`, never `null`**, and performs identity
  adoption inside the wrapper. `applySave` requires the `adoption` as its third argument. **A
  failed adoption is reported beside the committed outcome, never in place of it** — the screen
  must say *the file was written and this window is out of step*, never *the save failed*.

**What step 2 owes.**

1. **The component**, plus **the mounted-component test** (opt in with `/** @vitest-environment
   jsdom */` as the first line, per `RawEditor.test.ts`; **do not back-fill the existing six
   components**), plus **a window reading** — `1c-1-notes.md` §10 for the technique,
   `1c-2b-2b-2-notes.md` §6.1 for the WKWebView constraint: **one plan per launch, into a fresh
   bundle path.** A window reading is re-taken after any change to a component.
2. **The consult's Q7 — the single most likely defect all the automated tests pass over: an
   untouched `replace: "a\rb"` reaching a real browser control and being submitted with LF.** Step
   1 proved that projection is genuinely reachable (`an_escaped_carriage_return_decodes_into_a_
   projected_logical_value` in `crates/espansoconfig-core/tests/model_projection.rs`) and gated it
   three times. **The window reading must include that exact case**, because jsdom's normalization
   is not WKWebView's and a mounted test cannot settle it.
3. **The strings still never drawn.** The thirty-two `code.draftError.*`, the thirty-six
   `code.editError.*`, `code.commandError.draftRefused` and `code.commandError.documentHasNoMatchList`
   — `save_match` is the command that produces most of them, so this is the step that can finally
   draw them. (`PROGRESS.md` said *"the eight `code.editError.*`"* before 2c-2-1; the real count is
   **36**.)
4. **Rebaseline the module guard honestly if it moves.** It is **156** now. Build a pristine
   `git archive HEAD` copy and subtract; a jump to ~180 with `svelte/internal/server` in the bundle
   is the regression, a delta equal to the new source modules is not.

**Two things step 1 recorded that a later sub-phase inherits.**

- **Notes hole 9 — `BrowserState.moveMatch` still carries all three latent shapes** that findings 1,
  2 and 6 fixed in `saveMatch`: a `SaveResult | null` return, a stale projection left installed when
  its own re-read fails, and an un-dropped `conflictText`. **No screen calls it yet. 2c-3b is the
  sub-phase that puts move on a screen, and it must fix these first** — they were written down
  rather than changed silently because fixing them alters a published signature outside 2c-2's cut.
- **A component can still bypass the wrapper.** `src/lib/ipc/commands.ts` exports `saveMatch`, and
  nothing in TypeScript, `svelte-check` or the three lint scanners stops a `.svelte` file importing
  it directly and skipping adoption — the same hole `moveMatch` and `saveRawDocument` have had since
  2b-2a. Today no component imports that module for anything but a type. This is stated in
  `BrowserState.saveMatch`'s own JSDoc in the same sentence as what the wrapper does force.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged.

---

**Phase 2c-1b is complete: this application can now be used to write a user's file from a window.**
`docs/decisions/2c-1b-notes.md` is the record (1417 lines; §9 is the window readings). The aggregate
code review is `docs/reviews/phase-2c-1b-code.md`, and it returned **`READINESS: NOT READY`** twice —
once on the phase, once on the fixes the window reading forced. **All nine findings were fixed
before the commit.** The cut this phase implements is `docs/decisions/2c-split-notes.md`, produced
by the consult `docs/reviews/phase-2c-split-design.md`; **do not re-commission that consult for
2c-2** — it covers the whole of 2c.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 894 passed, 35 files
```

(`cargo test --workspace` still expects **1007**, and this phase wrote no Rust.)

**The next step is Phase 2c-2 — the small editor**: literal trigger · `replace` · label · word
boundary, over `MatchDraft` and `save_match`, extending undo coverage to per-field editing. Its
scope is in the 2c split table above, and it **fails as a draft-versus-projection mistake** — which
is the one thing 2c-1b could not test, because a raw candidate is one exact string and a field
candidate is *derived*.

**What 2c-1b built that 2c-2 must not redesign, and the one thing it must not copy.**

- **`Draft<T>` is generic and already carries a structured case.** 2c-1b drafts a `string`, where
  the snapshot is nearly the identity. **2c-2 drafts a structured `MatchDraft`, which is the case
  2c-1a's `{ same, snapshot }` rules and unconditional deep-freezing were built for** — the review
  demonstrated the aliasing defect concretely. Use `structuredDraftRules<T>()`; do not invent a
  shallower one.
- **The three arms, the acknowledgement round trip and the conflict state are drawn once, in
  `rawEditor.ts` + `RawEditor.svelte`.** 2c-2 uses `describeEditSave`, **not**
  `describeWholeDocumentSave`, and its outcome is **not** sealed — a field edit invalidates no
  identity. Read `saveOutcome.ts` before writing a second presenter, and extract rather than copy.
- **`RoundTripText` is the raw editor's brand and does not generalize.** A field editor's values
  pass through `<input>` and `<textarea>` too, so **the CRLF question returns in a different
  shape**: a `replace` block scalar drafted through a text area is subject to the identical API-value
  normalization. **Decide it deliberately in 2c-2; do not assume the brand covers it.** This is the
  single most likely way 2c-2 breaks the preservation promise.
- **`BrowserState.saveRawDocument`'s wiring cannot be copied for `saveMatch`.** `saveRawDocument`
  re-resolves positionally because a replacement has no identity to re-point with;
  `adoptTheDocumentOnDisk` re-points **by identity**. `saveMatch`, `createMatch` and `deleteMatch`
  are still **not** wired into `workspace.svelte.ts` — only `moveMatch` and `saveRawDocument` are.
- **The mounted-component harness exists and is scoped.** `environment: 'node'` stays the default
  and files opt in by docblock. **Do not back-fill the existing six components**, and **do not let
  `npm run build` leave 154 modules** — that number is the guard that the test and production
  resolution paths have not diverged.

**What 2c-2 owes, beyond its own scope.**

1. **The three kinds of evidence of `2c-split-notes.md` §7**, all three: model tests, mounted
   component tests, and **a window reading**. 2c-1b is this project's proof that the third is not
   ceremony — it caught two real defects that 883 passing tests, `svelte-check` and two Codex
   passes had all missed, one of which silently rewrote every line ending in a user's file.
2. **A window reading is re-taken after any change to a component.** 2c-1b took two for that
   reason. Budget for it.
3. **The strings still never drawn.** 2c-1b drew the raw-save subset. The thirty-two
   `code.draftError.*`, the eight `code.editError.*`, `code.commandError.draftRefused` and
   `code.commandError.documentHasNoMatchList` remain on the list — `save_match` is the command
   that produces most of them.
4. **Two questions 2c-1b left open for a human**, neither blocking: whether the shipped WKWebView
   refuses `navigator.clipboard` (both readings ran against a locked screen, which fully explains
   the failure — hole 8.12), and whether the CRLF **refusal** is the right long-term product call
   or whether an editing surface that does not read its value back through a `<textarea>` should be
   built (D13 is written so it can be built on top). **The refusal forecloses nothing.**

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged, except that inherited item 1 is now partly paid: a screen calls one of the five writing
commands.

---

**Phase 2c-1a is complete: the draft spine exists and nothing draws it.**
`docs/decisions/2c-1a-notes.md` is the record; the aggregate code review is
`docs/reviews/phase-2c-1a-draft-spine.md`, and it returned **`READINESS: NOT READY`** on three
High findings. **All eight were fixed before the commit.** The cut this phase implements is
`docs/decisions/2c-split-notes.md`, produced by the consult
`docs/reviews/phase-2c-split-design.md`; **do not re-commission that consult for 2c-1b** — it
covers the whole of 2c.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 821 passed, 33 files
```

(`cargo test --workspace` still expects **1007**, and this phase wrote no Rust.)

**The next step is Phase 2c-1b — the raw editor, the one vertical slice of 2c-1.** It is the
first screen in this project that can write a user's file. Its scope is in the 2c split table
above: the raw pane made editable and saveable over the already-wired `saveRawDocument`, the three
outcome arms drawn, the acknowledgement round trip drawn, the terminal-but-honest conflict state,
and **this project's first mounted-component test**.

**What 2c-1a built that 2c-1b calls, and must not redesign.**

- **`Draft<T>` carries rules, `{ same, snapshot }`, not just an equality**, and every value it
  records — base, current, each history step, the save/reload base, the consent candidate — is a
  **deep-frozen snapshot**. The raw editor drafts a `string`, so the snapshot is the identity; do
  not conclude from that that the rules are ceremony. 2c-2 drafts a structured `MatchDraft`, and
  the review demonstrated the aliasing defect that shape exists to prevent.
- **`isDirty` is derived from the base**, not stored. There is no flag to set and none to clear.
- **Consent is opaque and branded, and `acknowledgeDraft` does not exist.** The only producer is
  `acknowledgeRefusal(draft, submission, refusal)`, which checks the base revision, the candidate
  identity and acknowledgeability. Editing or undoing invalidates it. **Do not reach around this**
  by lifting `submission.acknowledgement` and pairing it with different text — that path is still
  reachable (hole 4.1) and the wire's exact-multiset check is the only thing that would catch it.
- **A whole-document outcome arrives sealed.** `openWholeDocumentSave(sealed, forget)` is the only
  way to learn anything about it; the seal is **one-shot**, and a second open returns
  `alreadyOpened` without calling the callback. `forget` is **synchronous** and total — the
  re-read that follows is a separate, asynchronous step and is not this.
- **A throwing `forget` never unwrites the file.** The opener returns the committed outcome beside
  `invalidation: { kind: 'failed' }`. 2c-1b must present that honestly: **the save succeeded and
  the window is out of step**, never "the save failed".
- **Two describers, and no `scope` string**: `describeWholeDocumentSave` and `describeEditSave`.
  A whole-document saved arm **types** `moved: null`. Both return **codes and parameters, never
  sentences**.
- **`ConflictModel<T>` carries the actual `Draft<T>`**, and reload is a confirmed transition —
  `confirmReloadDiskVersion` → `reloadDiskVersion`, with a token checked against that conflict.

**What 2c-1b owes.**

1. **The eight requirements of `2c-split-notes.md` §6**, in a drawn conflict state — and the
   prohibition with them: **no control may be named or coded "keep my draft"**, because that
   phrase means 2c-4b's rebase and using it early would make 2c-4b look already done. **No
   placeholder buttons for 2c-4.**
2. **The mounted-component test**, this project's first. `vite.config.ts` still says
   `environment: 'node'` with a comment reading *"Adding jsdom later is a deliberate decision, not
   a default"* — 2c-1b is where that decision is taken. Scope it to the interactive components 2c
   introduces; **do not back-fill the existing six**, and **do not treat it as replacing the
   window reading** — a mounted test proves a handler fires, not that a window draws.
3. **A window reading**, per `1c-1-notes.md` §10, under the WKWebView constraint of
   `1c-2b-2b-2-notes.md` §6.1: **one plan per launch, into a fresh bundle path.**
4. **The twelve strings 2c-1a added have still never been drawn**, on top of the ~40 already on
   that list. 2c-1b draws the raw-save subset of both.
5. **Nothing forces a caller to seal.** `commands.saveRawDocument` and
   `BrowserState.saveRawDocument` still answer unsealed values (hole 4.2). 2c-1b is where the seal
   is either proved useful at a real call site or found wanting — decide it there, on evidence.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged. Nothing in 2c-1a supersedes it.

---

**The Phase 2c split is done, and it is the only thing this entry records.** No code was written:
the previous checkpoint's instruction was *"A fresh session's first act is that split, not code"*,
and this is that act. The cut is `docs/decisions/2c-split-notes.md`; the design consult behind it
is `docs/reviews/phase-2c-split-design.md`; the disposition of its seven answers is the section
above. **Four of the seven changed the cut.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 1007 tests, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **738**.)
Both were run at the head of this session and both matched, so the split rests on a verified
baseline rather than an assumed one.

**The next step is Phase 2c-1a — the draft spine, with no editor and no screen.** Its scope is in
the 2c split table above. Three things it owes, in the order they matter:

1. **The draft state shape**, designed so undo is expressible rather than addable later: base
   revision **and** base value; the current editable value; past and future states (or reversible
   actions); **dirty derived from the base, never a separate flag**; a history boundary after a
   successful save or a reload; redo cleared when editing resumes from an undone state; and an
   **acknowledgement bound to the exact current candidate**, so that undoing or editing invalidates
   consent collected for a different one. That last one is the protocol's own content-addressing
   rule (`FindingCode::DocumentDoesNotParse` carries the candidate's revision) meeting the fact
   that undo changes the candidate — it belongs in the shape because that is the only place it
   cannot be forgotten.
2. **The typed whole-document invalidation effect.** A committed replacement makes **every**
   `MatchId` in the file stale, and today that obligation is represented in no type: a caller that
   ignores it compiles (`2b-2c-3b-notes.md` §7.2). 2c-1a owes a shape where dropping it does not
   compile — and where TypeScript cannot force that, the residue is **written down as a hole, not
   claimed closed.** This is the consult's answer 6, the single most likely way 2c goes wrong.
3. **The save-outcome presentation model for all three arms** — `Saved` (including
   `committed: false` and the `notes` disclosures), `Refused` (the findings, the acknowledgeable
   subset, and the **exact-multiset** re-submission), and `Conflict`. It lives in
   `src/lib/browser/`, beside `rawSave.ts`, which already models the `DocumentDoesNotParse` case
   specifically and must be **used** by this model rather than duplicated by it.

**2c-1a registers no command, writes no Rust and draws no screen.** It is the same shape as 1b-1
(the i18n layer with no command) and 2b-2c-3a (the core mode with no caller): the state that
everything later stands on, proven before anything stands on it.

**What 2c-1b will need from it, so 2c-1a does not under-build:** a raw text area bound to the
current value, a save control gated on dirty, the three arms drawn, the acknowledgement round trip
drawn, a terminal-but-honest conflict state meeting the eight requirements of
`2c-split-notes.md` §6, and **this project's first mounted-component test** — the deliberate
`jsdom` decision `vite.config.ts` has been holding open since 1b-1.

**Everything under "What 2c inherits" and "What 2c must not revisit" in the entry below still
binds**, unchanged. Read it before starting 2c-1a; nothing in the split supersedes it.

---

**Phase 2b-2c-3b is complete, and with it 2b-2c and the whole of 2b.**
`docs/decisions/2b-2c-3b-notes.md` is the record; the aggregate code review is
`docs/reviews/phase-2b-2c-3b-code.md`, and it returned **`READINESS: NOT READY`** on a High finding.
**All four of its findings were fixed before the commit.** The design consult
(`docs/reviews/phase-2b-2c-3-design.md`) covers the whole of 2b-2c-3, was **not re-commissioned**,
and carries the owner's ruling overriding its Q2 appended at the end.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 1007 tests, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **738**.)

**Every command Phase 2b was scoped to deliver now exists.** Eleven `#[tauri::command]`s, five of
which write a user's file: `move_match`, `save_match`, `create_match`, `delete_match` and now
`save_raw_document`. All five go through **one** tail, `run_one_save`, which now carries a
`SaveContent` rather than a slice of edits, and through **one** entry point that writes,
`espansoconfig_core::persist::save_document`.

**The next step is Phase 2c — the editing UI.** Its scope in the split table above: the draft model,
the small editor (literal trigger · `replace` · label · word boundary), new / duplicate / delete /
move, the conflict UI, draft-level undo and restore from backup. **It is far too large for one
phase and must be split before any of it is written**, by the same rule every earlier split used — a
dependency order, by failure mode. A fresh session's first act is that split, not code.

**What 2c inherits, and the first item is now the largest single debt in the project.**

1. **Nothing has ever been drawn.** The standing "never been drawn" list is now: the thirty-two
   `code.draftError.*` strings, `code.commandError.draftRefused`, the eight `code.editError.*`
   sentences, `code.commandError.documentHasNoMatchList`, the two `code.presentationNote.*`
   sentences, `code.findingCode.documentDoesNotParse`, `code.saveError.replacementRequiresBackups`
   and the six `browser.rawSave.*` keys. **Five commands can write a user's file and no screen calls
   any of them.** The first phase of 2c owes the look.
2. **`workspace.svelte.ts` wires two of the five writing commands.** `moveMatch` (since 2b-2a) and
   now `saveRawDocument` (forced into existence by the 3b review's Medium). `saveMatch`,
   `createMatch` and `deleteMatch` are **not** there. Note `saveRawDocument`'s wiring **cannot be
   copied** for the other three and vice versa: `adoptTheDocumentOnDisk` re-points a selection **by
   identity**, and a replacement has no identity to re-point with, so it re-resolves positionally
   and checks the result.
3. **`() => {}` still satisfies `ReloadAfterRawSave`, and no type can force `RawSaveOutcome.reload`
   to be *read*.** What is closed is forgetting the obligation, discharging it on the wrong arm, and
   discharging it too late. A caller importing `src/lib/ipc/commands.ts` directly can still opt out;
   only review catches that. Recorded as hole 7.2 of the 3b notes rather than overclaimed.
4. **A re-read that fails after a committed replacement leaves the file unprojected** — reported,
   but absent from `views` rather than marked unreadable, because `loadFailures` is only filled by
   `open()`. Hole 7.3 of the 3b notes.
5. **`SaveError::ReplacementRequiresBackups` is unreachable from the command layer**, because
   `with_open` always hands a real `BackupSession`. That is the intended arrangement — the refusal
   exists to make forgetting impossible — but the only coverage is the core's.
6. **221+ Spanish values are checked only by heuristic** (no sentence byte-identical to its English
   counterpart, placeholders matching). Nothing establishes that any of them is idiomatic.
7. **The real configuration has never had a whole-document replacement applied to it**, and still
   exercises neither `create_match` nor `delete_match`. The real-corpus sweeps cover moves and field
   edits only.
8. **A move still leaves the identical doubled blank line at its origin and says nothing about it**
   (2b-2c-2 hole 6.2); **`create_match` still derives `End` from `view.matches.len()`** (hole 6.8);
   **`verify_items` speaks `verify_field`'s vocabulary** (2b-2c-1 hole 3) and a deletion can still
   report a refusal whose sentence is about a move (2b-2c-2 hole 6.4); three
   `code.diagnosticCode.*` observations remain recorded as non-defects (`2b-2b-3-notes.md` §7.5).

**What 2c must not revisit, inherited from every phase before it.**

- **`espansoconfig_core::persist::save_document` is the only entry point that may write a user's
  file.** Never call `replace_file_atomically` or `replace_locked_file` from a command — **the lock
  is not reentrant, so the process hangs silently and forever.**
- **`run_one_save` is the single copy of this layer's cache-coherency policy.** A sixth writing
  command calls it; it does not copy it.
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1).
  **A committed write is never afterwards reported as an `Err`** (D2) — **and the 3b review found
  that invariant broken in TypeScript, so it binds the boundary layer too, not just Rust.**
- **An empty batch still goes through the transaction** (D3), and so does a replacement whose text
  equals the file's, which is a `Saved` with `committed: false`.
- **Every variant of a wire enum used as an error operand serializes as an object** (D5).
- **A raw save MAY write text the YAML parser rejects** — the owner's settled ruling. Never refused,
  never silent: the acknowledgement protocol is what makes it safe.
- No `force` flag, no acknowledgement bypass, no caching of "the findings I last issued", no wire
  path accepted back as a target. `committed: false` and `backup: None` are legal on a success.
- **Nothing in this project renders a Svelte component in an automated test**, so a claim about a
  screen needs **a reading of a screen**, re-taken after any change to a component
  (`docs/decisions/1c-1-notes.md` §10 records the technique; `1c-2b-2b-2-notes.md` §6.1 records the
  WKWebView constraint — one plan per launch, into a fresh bundle path).
- **The UI shows a scalar's source text as written, never an inferred type** (D2u). Moving a match
  between files or between sequences is refused (D2r). A move may not be combined with any other
  edit in one batch (R25).

---

**Phase 2b-2c-3a is complete.** `docs/decisions/2b-2c-3a-notes.md` is the record; the aggregate code
review is `docs/reviews/phase-2b-2c-3a-code.md`, and it returned **`READINESS: NOT READY`** on a High
finding that was **fixed before the commit**. The design consult
(`docs/reviews/phase-2b-2c-3-design.md`) covers the whole of 2b-2c-3 and was **not re-commissioned**
— **do not re-commission it for 3b either.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 1001 tests, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **702**.)

**`save_document` can now replace a whole document, and nothing calls it.** That is the entire state
of 2b-2c-3a: the mode exists, is proven, and has no caller outside tests.

**The next step is Phase 2b-2c-3b — `save_raw_document`, the eleventh `#[tauri::command]`, and the
last of 2b-2c.** With it, 2b-2c closes and every command Phase 2b was scoped to deliver exists.

**What 2b-2c-3a built that 2b-2c-3b calls, and must not redesign.**

- **`SaveContent<'a>` is a field of `SaveRequest`** — `content`, replacing `edits` — with arms
  `Edits(&'a [DocumentEdit])` and `ReplaceText(&'a str)`. It is **core-only and not on the wire**;
  3b decides what the *command* takes, which is not the same type.
- **`SaveContent::ReplaceText` requires a backup session.** `SaveError::ReplacementRequiresBackups
  { path }` is raised **before the lock** when `backups` is `None`. The command layer already owns a
  `BackupSession`, so **pass it** — this refusal exists to make forgetting impossible, not to be
  worked around. Note it also refuses a replacement that would have been byte-identical, which is
  stricter than Q6's letter and was kept deliberately (`2b-2c-3a-notes.md` §5.1): a caller must be
  able to know its request is well-formed **without reading the file**.
- **`FindingCode::DocumentDoesNotParse { revision, line, column, byte_index, detail }`** is
  **acknowledgeable** (class `SuspiciousButPermitted`) and **content-addressed to the candidate**.
  The `revision` operand is what stops consent collected for one text being spent on another; it is
  deliberately **not** in either dictionary sentence, and `saveCodes.test.ts` asserts its absence.
  `line`, `column` and `byte_index` are all `Option` — a crate-internal syntax error yields the
  finding with no position rather than withholding the user's bytes.
- **`validate` does not and must not produce that code.** `every_finding_code_is_reachable` exempts
  it from both sides: no fixture may produce it, and the exemption must still name a declared
  variant.
- **A replacement reports `notes: []` and exactly one whole-document `Replacement`** spanning
  `0..source.len()`. The single span is a **byte-level statement, not a locality claim**.

**What 2b-2c-3b owes, and the first is the one the consult flagged as unfinished.**

1. **The full identity invalidation.** Consult Q3: after `committed: true` the frontend must
   invalidate **all** cached projections and identities and reload the document — **every `MatchId`
   in the file is stale**, and unlike a create or a delete there is no single match to answer with.
   `moved: None` is the permanent answer. **The obligation is currently represented in no type**
   (hole 6.2 of the notes): a caller that ignores it compiles. On `committed: false`, nothing
   becomes stale.
2. **`save_raw_document` must call `run_one_save`, not copy it.** That block is the cache-coherency
   policy and it was four copies before the `35a9e9e` cleanup round.
3. **The UI's own debt, from Q8**: a raw save must be presented as *replacing the entire document*,
   not as an edit, and — from the owner's ruling — when the text does not parse the user gets **a
   sentence saying espanso will not load the file until it is fixed, the parser's position if it has
   one, and the choice**, in both languages. Not a blocked save.
4. **`detail` is the parser's own message and cannot be localized.** The sentence around it is; the
   fragment inside it is not. 3b is where that first becomes visible.

**What 2b-2c-3b inherits from every command before it, and none of it is its to revisit.**

- **`espansoconfig_core::persist::save_document` is the only entry point that may write a user's
  file.** Never call `replace_file_atomically` or `replace_locked_file` from a command — **the lock
  is not reentrant, so the process hangs silently and forever.**
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1).
- **A committed write is never afterwards reported as an `Err`** (D2).
- **An empty batch still goes through the transaction** (D3) — and so does a replacement whose text
  equals the file's, which is a `Saved` with `committed: false`.
- **Every variant of a wire enum used as an error operand serializes as an object** (D5).
- No `force` flag, no acknowledgement bypass, no caching of "the findings I last issued", no wire
  path accepted back as a target. `committed: false` and `backup: None` are **not** failures.

**The debts, retallied.**

- **The thirty-two `code.draftError.*` strings, `code.commandError.draftRefused`, the eight
  `code.editError.*` sentences, `code.commandError.documentHasNoMatchList`, the two
  `code.presentationNote.*` sentences and now `code.findingCode.documentDoesNotParse` and
  `code.saveError.replacementRequiresBackups` have never been drawn.** The first phase to build the
  editor screen owes the look — and 3b adds the raw editor to that list.
- **215+ Spanish values are checked only by heuristic** — two more than at 2b-2c-2.
- **The real configuration has never had a whole-document replacement applied to it**, and still
  exercises neither `create_match` nor `delete_match` (hole 6.3 of 2b-2c-2, extended).
- **A move leaves the identical doubled blank line at its origin and says nothing about it**
  (2b-2c-2 hole 6.2). Unchanged.
- **`create_match` derives `End` from `view.matches.len()`** (2b-2c-2 hole 6.8). Unchanged.
- **`verify_items` speaks `verify_field`'s vocabulary** (2b-2c-1 hole 3), and a deletion can still
  report a refusal whose sentence is about a move (2b-2c-2 hole 6.4).
- **Three `code.diagnosticCode.*` observations remain recorded as non-defects**
  (`2b-2b-3-notes.md` §7.5).

---

**Phase 2b-2c-2 is complete and both of its Codex consultations are closed.**
`docs/decisions/2b-2c-2-notes.md` is the record; the design consult is
`docs/reviews/phase-2b-2c-2-design.md` and the aggregate code review is
`docs/reviews/phase-2b-2c-2-code.md`. **That review returned `READINESS: NOT READY`**, and the
verdict was accepted rather than argued with: its Medium and its Low were both fixed and re-verified
before the commit. **This application can now create and delete a user's snippets.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 983 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **700**.)

The tree is at **`35a9e9e`**, which is the cleanup round, not the phase commit. Both are pushed.

**A cleanup round ran after the phase commit and is already in** (`35a9e9e`). Four independent
quality reviews — reuse, simplification, efficiency, altitude — converged on three duplications, now
removed: the save-transaction tail is **one `run_one_save`** called by all four writing commands
(with `view_at` and `with_open` beside it), the landing index comes from the engine's own
**`ItemPlacement::items_above`**, and both anchor resolutions are **one `anchor_index`**.
**`save_raw_document` must call `run_one_save`, not copy it** — that block is the cache-coherency
policy, and it was four copies before this round.

**The 2b-2c-3 design consult has already been taken** — `docs/reviews/phase-2b-2c-3-design.md`, eight
rulings. **Do not re-commission it.** Its rulings, in one line each:

| Q | Ruling |
|---|---|
| Q1 | The substitute for the patch engine's proof is **both** a successful reparse **and** the existing validation/acknowledgement gate |
| Q2 | ~~A raw save may not write text the YAML parser rejects~~ — **OVERRIDDEN BY THE OWNER, see below** |
| Q3 | Keep `SaveResult`; `moved: None` |
| Q4 | **One** core `save_document(SaveRequest)` entry point branching internally — not a second entry point beside it (the lock is not reentrant) |
| Q5 | A raw save **does** fully participate in acknowledgement for validation findings |
| Q6 | No backup for a byte-identical result; every committed raw replacement must have a recoverable pre-commit image; the revision check is **more** load-bearing here |
| Q7 | The highest risk is **silently overwriting changes made after the raw editor loaded the file** |
| Q8 | A raw save is **a separate replacement mode with a different promise**, not a locality-preserving edit |

**Q2 was put to the owner and the owner reversed it. This is a settled decision, not an open
question — do not re-litigate it and do not re-commission a consult on it.**

> **A raw save MAY write text the YAML parser rejects. Do not refuse to write it.**

The tradeoff as it was put: refusing means **this application cannot be used to repair a file that is
already broken**, which is arguably the single most valuable thing a raw editor does — and the app
already *displays* unparseable files, since a broken file crosses as a view and never as an error.
`docs/reviews/phase-2b-2c-3-design.md` carries the ruling in full, appended below the consult it
overrides.

**Three consequences, and the last one is an inference rather than the owner's words.**

1. **Q1 narrows.** The reparse can no longer be a *gate* — failing it is no longer disqualifying. It
   stays a **fact the transaction must establish and report**, because the answer is what the user is
   told and what the workspace cache must do next.
2. **Q5 now carries the weight.** The acknowledgement protocol is what makes the ruling safe: the app
   does not refuse, and it does not write silently either. *"Refused, not forced"* was never
   *"refused, full stop"* — it is **never written without the user meaning it**.
3. **Silent or acknowledgeable? Assumed acknowledgeable.** The owner's ruling does not settle this.
   The assumption follows plan §6.2 (nothing unrequested happens silently) and the fact that 2b-2c-2
   has just paid to disclose a *doubled blank line* — a far smaller surprise than a file espanso will
   refuse to load. **A phase that finds this assumption wrong should put it back to the owner rather
   than quietly choosing the other reading.**

Everything else in the consult stands: one `save_document` entry point branching internally (Q4 — the
lock is not reentrant), `moved: None` (Q3), the backup and revision rules (Q6), the stale-revision
test as the highest risk (Q7), and Q8's framing of a raw save as a **separate replacement mode with a
different promise**.

**The next step is Phase 2b-2c-3 — `save_raw_document`, the eleventh `#[tauri::command]`, and the
last of 2b-2c.** It is not a small step and it is not like the two before it.

**Start from the answer 2b-2c-1's design consult already gave it** (`docs/reviews/phase-2b-2c-1-design.md`,
Q6, recorded and deliberately not built): **a `SaveRequest` variant for whole text, never a full-span
`DocumentEdit`.** A whole-document text is **not** a span replacement, so it may not claim the patch
engine's locality invariants — the thing every other operation in this application is built to
guarantee. Giving `save_document` a whole-text path is a change to **the one entry point that
writes**, not a new caller of it, and that is the whole difficulty.

**What 2b-2c-2 built that 2b-2c-3 must not redesign.**

- **`PresentationNote` is now a tagged union**, `ScalarRestyled { edit, from, to, reason }` (the old
  struct's four operands, unchanged) plus `DoubledSequenceSeparation { edit }`. Both arms are struct
  variants, so both cross as one-key objects (D5). **A raw save re-encodes nothing and moves nothing,
  so its `notes` should be empty** — but that is a claim to state and test, not to assume.
- **`ItemPlacement { Front, After(usize), End }`** replaced `insert_item()`'s `after: Option<usize>`.
  An implicit-null `matches:` accepts `Front` and `End` and **refuses every `After(_)`** with
  `NoSuchDestinationItem { items: 0, … }`.
- **`NewMatch { trigger, replace }` is closed and both fields are mandatory**, and
  `NewMatchPosition`'s three arms are all struct variants so the position crosses as a uniform
  object. `NewMatchPosition` is **not** a code and has no dictionary namespace.
- **`CommandError::DocumentHasNoMatchList`** is the refusal for a file with no `matches:` key at all.
  A **bare** `matches:` is promoted and is not this refusal.
- **`every_edit_error_variant_crosses_as_an_object`** now covers `EditError` (36) and `SaveError` (9)
  and derives its lists by parsing the source. **A new error enum on this boundary owes the same
  check** — the pinned counts move with the enums.

**What 2b-2c-3 inherits from every command before it, and none of it is its to revisit.**

- **`espansoconfig_core::persist::save_document` is the only entry point that may write a user's
  file.** Never call `replace_file_atomically` or `replace_locked_file` from a command or from inside
  the transaction — **the lock is not reentrant, so the process hangs silently and forever.** This is
  the invariant a whole-text path is most likely to break, because a whole text *feels* like
  something you could just write.
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1).
- **A committed write is never afterwards reported as an `Err`** (D2). A raw save has no single match,
  so **`moved: None` is its permanent answer**, not a failure.
- **An empty batch still goes through the transaction** (D3). A raw save whose text equals the file's
  is a `Saved` with `committed: false`.
- **Every variant of a wire enum used as an error operand serializes as an object** (D5).
- No `force` flag, no acknowledgement bypass, no caching of "the findings I last issued", no wire path
  accepted back as a target. `committed: false` and `backup: None` are **not** failures.

**Three things 2b-2c-3 must decide, and none has been decided yet.**

1. **What a raw save is checked against.** The other operations get their safety from the patch engine
   proving the untouched bytes are untouched. A whole text has no untouched bytes to prove. So what
   plays that role — a reparse that must succeed, a validation verdict, both, or an explicit
   acknowledgement that the user is taking the wheel?
2. **Whether a raw save may write a file the parser rejects.** `document_text` already answers valid
   UTF-8 **or refuses** with a typed `NotUtf8 { path, offset }`; a file it cannot display cannot be
   round-tripped through this command at all. Whether it may write text the *YAML* parser rejects is
   a different question and a sharper one.
3. **What it does to identities.** Every `MatchId` in the file is stale afterwards, and unlike a
   create or a delete there is no single match to answer with.

**Two debts this phase paid.**

- **`SaveResult::Saved::notes` has a second producer**, and the first that is not a scalar
  re-encoding. It still has **no reader** — which is why the union reshape was free, and it will not
  be free again.
- **A move's empty `notes` is now a tested property**, not just a documented one
  (`a_move_out_of_the_same_gap_still_reports_nothing`).

**The debts, retallied.**

- **The thirty-two `code.draftError.*` strings, `code.commandError.draftRefused`, the eight
  `code.editError.*` sentences, and now `code.commandError.documentHasNoMatchList` and the two
  `code.presentationNote.*` sentences have never been drawn.** The first phase to build the editor
  screen owes the look.
- **213+ Spanish values are checked only by heuristic** — three more than at 2b-2c-1. Nothing
  establishes that any is idiomatic.
- **The real configuration exercises neither new command** (hole 6.3 of the notes). It is swept for
  moves and for field edits; nothing has ever been created in it or deleted from it.
- **A move leaves the identical doubled blank line at its origin and says nothing about it**
  (hole 6.2). The removal side is closed; the move side is not, and closing it would change an
  already-shipped command's documented "notes are always empty for a move".
- **`create_match` derives `End` from `view.matches.len()`** (hole 6.8) — a projection count rather
  than something the engine hands back. It can only affect the identity answered in `moved`, never
  a byte.
- **`verify_items` speaks `verify_field`'s vocabulary** (hole 3 of 2b-2c-1), and a deletion can still
  report a refusal whose sentence is about a move (hole 6.4).
- **Three `code.diagnosticCode.*` observations remain recorded as non-defects**
  (`2b-2b-3-notes.md` §7.5).

---

**Phase 2b-2c-1 is complete and both of its Codex consultations are closed.**
`docs/decisions/2b-2c-1-notes.md` is the record; the design consult is
`docs/reviews/phase-2b-2c-1-design.md` and the aggregate code review is
`docs/reviews/phase-2b-2c-1-code.md`, which reported **no finding in five of its six categories** and
one Low documentation finding, since fixed. **The patch engine now has all six primitives it will
ever need for matches** — and nothing calls the two new ones.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 959 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **696**.)

**The next step is Phase 2b-2c-2 — `create_match` and `delete_match`, the eighth and ninth
`#[tauri::command]`.** Read the 2b-2c split table above first. `save_raw_document` is **2b-2c-3's**
and must not be reached for here: it is not a span replacement, and giving `save_document` a
whole-text path is a change to the one entry point that writes, not a new caller of it.

**What 2b-2c-1 built that 2b-2c-2 calls, and must not redesign.**

- **`InsertItem { sequence, after: Option<usize>, fields: Vec<(String, String)> }`** — one flat
  block-mapping sequence item, scalar values only, each spelled by the **existing** scalar codec.
  `after: None` appends last. **There is no "before the first item" form** (hole 6): `ItemMove` can go
  to the front and `InsertItem` cannot, so a `create_match` that wants to insert at the top must
  derive the destination the way `plan_move` derives its front, or append and then move.
- **`RemoveItem`** addresses **the item**, not `(sequence, index)` (D1) — it is `ItemMove`'s lift half
  in shared code, and `tests/patch_item.rs` compares the two outputs byte for byte. Do not add a
  second removal path.
- **Eight named refusals, all planning-time and all struct variants on the wire**:
  `NotASequence`, `InsertedItemHasNoFields`, `DuplicateInsertedField`, `InvalidInsertedFieldKey`,
  `FlowSequenceInsertionUnsupported`, `InconsistentSequenceIndentation`,
  `ImplicitNullSequenceHasAmbiguousTrivia`, `RemovalWouldEmptyTheSequence`. Each already has its
  sentence in both languages and its member in the TypeScript union.
- **A bare `matches:` is promoted into its first block-sequence item.** That is what lets the app
  create the first match in a fresh file. Its ambiguity guard is **one line deep** (hole 7) — it
  refuses only when the line immediately below the bare key is a comment.

**What 2b-2c-2 inherits from 2b-2b-3 and 2b-2a, unchanged and not its to revisit.**

- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1). A
  `create_match` with no anchor and a `delete_match` naming something that is not an item belong with
  `DraftRefused` and `MoveNotWithinOneSequence`, **not** as new `SaveResult` variants — filing a
  non-overridable refusal beside an overridable one invites a frontend to offer an acknowledgement
  that can never work.
- **A committed write is never afterwards reported as an `Err`** (D2). If post-commit re-resolution
  fails, the answer is `moved: None` and a successful `SaveResult`. **`delete_match` is the first
  command for which `None` is the correct *routine* answer** rather than a defensive one — the match
  it deleted has no identity in the new revision, by construction.
- **An empty batch still goes through the transaction** (D3). No short-circuit.
- **Every variant of a wire enum used as an error operand must serialize as an object** (D5). A single
  unit variant among struct ones silently demotes a typed refusal to *unexpected failure*. A new error
  enum on this boundary owes its own `every_*_variant_crosses_as_an_object` check.
- **`NOT_A_CODE` is read from both directions** (D6), and the non-vacuity floor in
  `every_typescript_wire_union_has_a_namespace` moves with `types.ts`.
- `espansoconfig_core::persist::save_document` is **the only** entry point that may write a user's
  file. Never call `replace_file_atomically` or `replace_locked_file` from a command or from inside
  the transaction — **the lock is not reentrant, so the process hangs silently and forever.**

**What 2b-2c-2 must not do**, all inherited: no `force` flag or acknowledgement bypass; no caching of
"the findings I last issued"; no wire path accepted back as a target; and `committed: false` /
`backup: None` are **not** failures.

**Two things 2b-2c-2 will be the first to feel, both recorded as holes rather than discovered late.**

- **A removal between blank-separated items leaves both blank lines** (hole 5). Removing the middle
  item of a sequence with one blank line between each pair leaves **two** consecutive blank lines;
  with two blanks it leaves four. That is the lift-site join rule applied literally — a blank line
  beside an item is not the item's, and deciding which of two runs to collapse is a layout decision no
  primitive may make. It is pinned as expected bytes, and **a UI that deletes matches will show it.**
- **Deleting the last match of a file is refused**, by design (`RemovalWouldEmptyTheSequence`). The UI
  owes the user a sentence, not a failed save.

**The debts, retallied.**

- **The thirty-two `code.draftError.*` strings, `code.commandError.draftRefused`, and now the eight
  new `code.editError.*` sentences have never been drawn.** So has `SaveResult::Saved::notes`, which
  has a producer and no reader. The first phase to build the editor screen owes the look.
- **210+ Spanish values are checked only by heuristic** — eight more than at 2b-2b-3. Nothing
  establishes that any is idiomatic.
- **The real configuration exercises neither new primitive** (hole 2). It is swept for moves and for
  field edits; nothing has ever been inserted into it or removed from it, so `tests/patch_item.rs` is
  that surface's only coverage.
- **`verify_items` speaks `verify_field`'s vocabulary** (hole 3): a sequence that lost an item reports
  `EntryCountChanged` and an item that changed reports `SiblingChanged`, whose sentences say *entry*
  and *block*. A user never sees it — a verification failure discards the candidate — but a phase that
  surfaces these should split them.
- **Three `code.diagnosticCode.*` observations remain recorded as non-defects**, not fixed
  (`2b-2b-3-notes.md` §7.5).

---

**Phase 2b-2b-3 is complete and both of its Codex consultations are closed — and with it, 2b-2b.**
`docs/decisions/2b-2b-3-notes.md` is the record; the design consult is
`docs/reviews/phase-2b-2b-3-design.md` and the aggregate code review is
`docs/reviews/phase-2b-2b-3-code.md`, which reported **no finding at any severity**. **This
application can now write a match's edited fields to a user's file.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 927 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **696**.)

**The next step is Phase 2b-2c — the two missing core primitives and the three commands over them.**
Read the Phase 2 split table above first. Its scope, unchanged since it was written:

- **sequence-item insert and sequence-item remove in `patch/`**, with the comment-ownership,
  indentation and block-scalar answers 0c-3a and 0c-3b-1 had to give for *mappings*. These are the
  two primitives whose absence is the reason `create_match`, `delete_match` and `save_raw_document`
  do not exist. `DocumentEdit` has exactly four variants today — scalar edit, mapping-field insert,
  mapping-field remove, same-sequence item move;
- then **`create_match`, `delete_match` and `save_raw_document`** over them;
- **`save_raw_document` needs its own answer, and it is not a small one.** A whole-document text is
  **not** a span replacement, and `save_document` is the one entry point that writes. Giving it a
  whole-text path is a change to that entry point, not a new caller of it.

**What 2b-2c inherits from 2b-2b-3, and must not redesign.**

- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1). The new
  commands will each have their own planning refusals — a `create_match` with no anchor, a
  `delete_match` naming an item that is not one. They belong with `DraftRefused` and
  `MoveNotWithinOneSequence`, **not** as new `SaveResult` variants, and for the recorded reason:
  filing a non-overridable refusal beside an overridable one invites a frontend to offer an
  acknowledgement that can never work.
- **A committed write is never afterwards reported as an `Err`** (D2). If a post-commit
  re-resolution fails, the answer is `moved: None` and a successful `SaveResult`. `delete_match`
  will be the first command for which `None` is the *correct routine* answer rather than a defensive
  one — the match it deleted has no identity in the new revision, by construction.
- **An empty batch still goes through the transaction** (D3). Do not add a short-circuit for a
  create or a delete that turns out to change nothing.
- **`plan_match_edits` runs both batch guards itself** (D4, `2b-2b-3-notes.md` §3). Do not re-run
  them at the command layer: the independence guard needs the original key lists, which only the
  planner holds, and a copy assembled at the command layer is a weaker second statement wearing the
  same name.
- **Every variant of a wire enum used as an error operand must serialize as an object** (D5). A
  single unit variant among thirty-one struct ones silently demotes a typed refusal to *unexpected
  failure*, because the operand-shape table pins one shape per operand from one sample.
  `every_draft_error_variant_crosses_as_an_object` now catches it for `DraftError`; **a new error
  enum on this boundary owes the same check.**
- **`NOT_A_CODE` is read from both directions** (D6). A union exempted on the Rust side is exempted
  on the TypeScript side, from one table. The non-vacuity floor in
  `every_typescript_wire_union_has_a_namespace` is **43** and moves with the file — a union added to
  `types.ts` raises it, and one that stops carrying single-quoted members lowers it.

**What 2b-2c must not do**, all inherited and none of it its own to revisit: no `force` flag or
acknowledgement bypass; no caching of "the findings I last issued" to police acknowledgements; no
call to `replace_file_atomically` or `replace_locked_file` from a command or from inside the
transaction (**the lock is not reentrant — the process hangs silently and forever**); no wire path
accepted back as a target; and `committed: false` / `backup: None` are **not** failures.

**The debts, retallied.**

- **The four `code.diagnosticCode.*` strings 2b-1 corrected have now been seen on a screen**, in
  both languages, and all four were judged defensible. `docs/decisions/2b-2b-3-notes.md` §7 is the
  reading, with §7.6 stating what it is *not* evidence of. **That debt is closed after five phases.**
- **A new one opens in its place, and it is larger.** Thirty-two `code.draftError.*` strings and one
  `code.commandError.draftRefused` were added in both languages and **have never been drawn**. So
  has `SaveResult::Saved::notes`, which now has a producer and no reader. The first phase to build
  the editor screen owes the look.
- **202+ Spanish values are checked only by heuristic.** Nothing establishes that any is idiomatic.
  The window reading judged **four** of them by eye and found them correct — which is four.
- **Three `code.diagnosticCode.*` observations were recorded as non-defects**, not fixed
  (`2b-2b-3-notes.md` §7.5): `{count}` has no plural rule and is safe only because the Rust guard is
  `> 1`; the two `MatchHasSeveral*` sentences say *"This snippet"* on a file-level pane that does not
  say which; and the key `…ContentForms` disagrees with both its own sentence and the Rust
  `FindingCode::MatchHasSeveralContentFields`.

---

**Phase 2b-2b-2 is complete and BOTH of its reviews are closed.** `docs/decisions/2b-2b-2-notes.md`
is the record; the design consult is `docs/reviews/phase-2b-2b-2-open-key-design.md` and the code
review is `docs/reviews/phase-2b-2b-2-open-key-code.md`, each with its own disposition table above.
**A match's open half can now be drafted, and nothing can call it.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 917 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1.)

**The next step is Phase 2b-2b-3 — `save_match`, the command.** Nothing stands in front of it: the
review debt the previous checkpoint carried forward has been paid, its one finding is fixed, and the
2b-2b-2 code review found no other defect in the three places that checkpoint named as invisible to
the test suite.

**One thing 2b-2b-3 inherits from that fix round, and it is a small obligation with a sharp edge.**
`DraftError` gained a variant, `AmbiguousVariableKey { variable }` — the **twelfth** that carries an
index and nothing else. It is **unreachable from
any projected document today** — the hazard gate refuses the whole match first — and it still owes a
`draftError` string in both languages like every other variant, because a code with no sentence is
worse than a code with no caller. Write that sentence about *ambiguity*, not about something the user
can currently trigger, and do not let the unreachability tempt anyone into skipping it: the
exhaustiveness check will demand it, and the check is right.

**2b-2b-3 is the step that gives every line of 2b-2b-1 and 2b-2b-2 its first caller**, and it carries
four obligations that are already written down:

- **the `draftError` dictionary namespace in both languages**, and the deletion of the TEMPORARY
  `NOT_A_CODE` entry for `DraftError`. `the_temporary_draft_error_exclusion_expires_when_anything_names_it`
  fires the moment production Tauri code names `DraftError` while the exclusion stands, and
  **self-disables** once it is gone. The exhaustiveness test alone would pass — that is why the
  tripwire exists;
- **`SaveResult::Saved::notes` gets its first producer.** `PresentationNote` and `NotReencodable`
  have been on the wire since 2b-1 with no caller. A move re-encodes no scalar; a draft diff will;
- **positional addressing makes `base_revision` load-bearing** in a way the closed surface's
  key-addressing was not. A stale **index** silently names a *different* entry, where a stale key
  merely names a missing one. What makes it safe is the optimistic-concurrency check inside
  `save_document`, taken **under the lock**. It must not be skipped, and the draft must be planned
  against the projection associated with the revision the caller sent;
- **the window reading that is now four phases overdue.** The four `code.diagnosticCode.*` strings
  2b-1 corrected have still never been seen on a screen. 2b-2a, 2b-2b-1 and 2b-2b-2 each opened no
  window. 2b-2b-3 is the first phase since 2b-1 that will have a command to read them through.

**What 2b-2b-3 must not do**, all inherited and none of it its own to revisit: no `force` flag or
acknowledgement bypass; no caching of "the findings I last issued" to police acknowledgements; no
call to `replace_file_atomically` or `replace_locked_file` from a command or from inside the
transaction (**the lock is not reentrant — the process hangs silently and forever**); no wire path
accepted back as a target; and `committed: false` / `backup: None` are **not** failures.

**What 2b-2b-2 established that 2b-2b-3 inherits unchanged:**

- **An address below the match mapping is an index, never a key the owner wrote.** Seven
  `DraftTarget` variants and **twelve** `DraftError` variants carry indices only — eleven as 2b-2b-2
  shipped, plus `AmbiguousVariableKey` from its code review's fix round. This is not a style
  choice — a refusal crosses the process boundary and the owner's configuration is private
  (`CLAUDE.md` §1). A frontend that wants to show *which* param failed resolves the index against the
  projection it already holds.
- **The equality rule is still one line and still the only one.** `scalar.text == value`, through the
  inherited `plan_scalar`. The consult proposed a second, source-text comparison for `params`; it was
  refused, and the resulting gap is hole 1 rather than a second answer.
- **This phase inserts nothing below the match mapping** (D1). A drafted entry that does not exist is
  refused, never inserted. Writing an author-chosen key would be the first key string this engine
  emits that no schema fixes; it needs its own anchor machinery and its own review, and **nothing in
  the current UI can produce one**. That is a decision with a reason, not a limitation found late.
- **The guards are widened, not loosened.** `check_closed_surface` admits exactly seven scalar shapes
  and four removable ones; six over-deep paths are refused as both an edit and a removal.
  `check_batch_independence` takes a fourth argument, `NestedKeys`, carrying each nested mapping's
  **whole** key list — because an unedited duplicate still makes an edited path ambiguous.

**Two debts no test can discharge, both now older.**

- **The four `code.diagnosticCode.*` strings have still not been seen on a screen** — four phases.
- **170+ Spanish values are checked only by heuristic.** Nothing establishes that any is idiomatic.

---

**Phase 2b-2b-1 is complete and its review is closed.** `docs/decisions/2b-2b-1-notes.md` is the
record; the review disposition is the table above and
`docs/reviews/phase-2b-2b-draft-design.md` holds the six design rulings the phase was built to.
**A draft can now be turned into a minimal edit batch, and nothing can call it yet.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 882 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1.)

**The next step is Phase 2b-2b-2 — `vars` and `form_fields`, the open key surface.** Read the
2b-2b split table above first. **2b-2b was split three ways because a match's fields are two
surfaces, not one**, and the second one is where the interesting problem is: a variable's `params`
is a mapping whose keys belong to the *form author*, not to espanso, and whose values are
legitimately sequences. It is an unschema'd mapping diff, and it collides head-on with the rule
that **no primitive may synthesize a collection node**.

**What 2b-2b-2 inherits and must not redesign:**

- **The equality rule is one line and it is the contract**: `scalar.text == value`, the drafted
  logical string against the projection's **decoded** logical value. `ScalarView::text` is already
  `decode()`'s output. A second comparison written anywhere else is a second answer to a question
  that has one.
- **`ScalarView::decoded == false` means `text` is the RAW SOURCE SLICE**, not a logical value, so
  it cannot be compared as one. `DraftError::NotDecodable` refuses it. This trap is not in the
  design consult — it was found in the codebase, and it is the one a new surface will re-open.
- **The surface is closed by a type *and* by a guard, and widening it means widening both.**
  Adding `vars` to `MatchDraft` without adding it to `check_closed_surface` produces a batch that
  refuses **itself** — which is the failure mode this arrangement was designed to have. Expect it,
  and do not "fix" it by loosening the guard.
- **`DraftField<T>` is generic already.** A `DraftField<VariableDraft>` costs nothing and keeps a
  JSON `null` failing closed. **Do not switch to `Option<Option<T>>`** — a frontend collapsing
  `undefined` into `null` would turn an untouched field into a *removal*, and
  `a_null_draft_field_is_a_deserialization_error_and_never_a_removal` is the test that says so.
- **Intent-level duplication must be caught before diffing, not after** (F1). A no-op intent is
  erased before any batch exists, so no batch-level guard can see that it was ever drafted.
- **The two guards are not independent validation of intent** (F4). They inspect paths, not nodes.
  Do not lean on them for a claim they cannot make.

**Three things 2b-2b-2 must not do.**

- **Do not synthesize a collection node**, and do not add a primitive that would. A `params` value
  that is a sequence today may have its *existing* scalar elements edited; it may not gain or lose
  one. That is 2b-2c's work, with 2b-2c's primitives.
- **Do not widen `Remove` to discard structure the editor never displayed.** 2b-2b-1 was asked to
  and refused, deliberately (F2). `RemovalWouldDiscardUnshownStructure` is that decision's name.
  Re-opening it is a decision to make in the open, not a fix to slip in.
- **Do not add a `#[tauri::command]`.** The counts stay `commands.rs:7`, `menu.rs:1` until
  2b-2b-3. `save_match` is 2b-2b-3's, and with it the `draftError` dictionary namespace in both
  languages and the deletion of the TEMPORARY `NOT_A_CODE` entry — which
  `the_temporary_draft_error_exclusion_expires_when_anything_names_it` will force the moment
  production code names the type.

**One debt is now three phases old.** The four `code.diagnosticCode.*` strings 2b-1 corrected have
still not been seen on a screen; 2b-2a opened no window and neither did this phase. **170+ Spanish
values remain checked only by heuristic** — non-blank, non-identical to their English twin, in
placeholder agreement. Nothing establishes that any of them is idiomatic.

---

**Phase 2b-2a is complete and its review is closed.** `docs/decisions/2b-2a-notes.md` is the record;
§11 is the finding-by-finding disposition and §14 is what 2b-2b and 2b-2c inherit. **This application
can now write a user's file from a window** — `move_match` is the seventh `#[tauri::command]` and the
first that is not read-only.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 828 tests across 20 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1 — `node_modules/` is gitignored and
`package-lock.json` is committed, so `npm ci` reproduces the pinned tree exactly.)

**The next step is Phase 2b-2b — `MatchDraft`, the minimal-diff engine and `save_match`.** Read the
2b-2 split table above first: **2b-2 was split three ways, and the reason is a fact about the core,
not a preference.** `create_match`, `delete_match` and `save_raw_document` have **no primitive behind
them** and are deferred to 2b-2c along with the primitives they need. Do not reach for them.

**The one rule 2b-2b exists to get right, and it is the whole sub-phase.** A `MatchDraft` is a
*desired state*, and Rust derives the `DocumentEdit` batch by diffing it against the projection. **A
field the draft leaves unchanged must produce no edit at all.** Rewriting an unchanged scalar is not
a harmless no-op: it can change the scalar's spelling and emit a `PresentationNote`, which is a
byte-preservation failure wearing a success's clothes, and it is the failure mode this sub-phase is
cut out to fail at loudly. Diff against the projection associated with **`base_revision`**, and emit
nothing where the projected value already equals the drafted one **even if its YAML spelling
differs**. The draft must be able to say *unchanged*, *set* and *remove* distinctly wherever all
three are meaningful, or the diff is ambiguous and will guess.

**Why the draft, and not an edit list from the frontend.** It was considered and rejected: an
untrusted caller handing over spans and edit kinds would put preservation-critical structure in the
one place this project cannot check, and would let it route around the mapping-scoping and the four
supported operations. Trusted Rust derives the batch. Recorded so it is not re-litigated.

**Everything 2b-2a built that 2b-2b uses unchanged**, and none of it is 2b-2b's to redesign:

- **`SaveResult` is document-level and operation-neutral** — `Saved` / `Conflict` / `Refused`, all
  three in the **`Ok` channel**, because a conflict and a refusal are expected actionable outcomes
  rather than errors. It is **flat**, like `CommandError`, and what it carries keeps the core's own
  convention. `save_match` returns the same type; it does not get its own.
- **`SaveResult::Saved::notes` gets its first producer here.** `PresentationNote` and
  `NotReencodable` are already on the wire with their eight dictionary entries and **no caller** —
  1b-1's shape repeated deliberately. A move re-encodes no scalar; a draft diff will.
- **`moved: MatchId | null` is a fact, never a failure.** It is `null` when the operation had no
  single match, when the commit was skipped, **or when the post-commit read disagrees with the
  revision the transaction established** — meaning another writer reached the file in between.
- **The conflict payload carries `expected`, `found` *and* `disk_revision`**, and the three are not
  interchangeable: `found` is what the **locked** read saw and refused on, `disk_revision` is the
  **fresh read taken after the lock was released**. When they differ the file changed again. No
  string may present them as descriptions of the same bytes. `base` and `draft` are **not** on the
  wire — a deviation from plan §6.4, recorded in `2b-2a-notes.md` §4.
- **`CommandError::SaveFailed` carries a second operand, `may_have_written`**, computed in the
  serializer by calling the core's own `SaveError::may_have_written()`. It is **not a field**, so
  there is no second list of `WriteStep` names anywhere to drift. `mayHaveWritten()` in
  `src/lib/ipc/errors.ts` is the single frontend spelling, and `true` means forget the cached text
  and re-read.
- **`ByteSpan` has a hand-written `Deserialize`** routing through `ByteSpan::new`; an inverted span
  is a **deserialization error**, not a repair. `Acknowledgement`'s is hand-written too and
  re-applies `of()`'s filter. Do not replace either with a derive.
- **`WorkspaceSession` owns an `Open { workspace, backups }`.** The `BackupSession` is constructed
  with the workspace and threaded through every save; **no code path in this crate passes
  `backups: None`**, and if the constructor ever becomes fallible the decision is already written on
  `WorkspaceSession::open` — a save whose safety net cannot be put in place must **refuse**.
- **Cache coherence is the command layer's job**, and `save_document` deliberately does not reach
  into `Workspace`. A committed save refreshes; a conflict refreshes and *that same projection is the
  `disk` payload*, so one read serves both; a failure that may have written **evicts**.

**Five things 2b-2b must not do.**

- **Do not add a `force` flag**, or any acknowledgement bypass. Findings go out, the acknowledged
  subset comes back, matched as an **exact multiset** — `[A, A]` differs from `[A]`, and
  `Acknowledgement::covers_all` consumes matches rather than testing membership.
- **Do not let the command layer cache "the findings I last issued" to police acknowledgements.**
  It cannot prove a human saw anything, it goes stale across reloads and concurrent windows, and
  intersecting sets destroys duplicate multiplicity. Enforcing presentation is the **UI's**
  obligation.
- **Do not call `replace_file_atomically` or `replace_locked_file` from a command**, or from inside
  the transaction — the lock is **not reentrant** and the process hangs silently and forever.
  `save_document` is the only entry point that may write a user's file.
- **Do not accept a wire path back as a target.** Every path crosses as a lossy `String`; two
  distinct non-UTF-8 filenames can render identically. Target by `DocumentId` / `MatchId`.
- **Do not present `committed: false` or `backup: None` as failures.** Both are legal on a success,
  for four documented reasons each.

**Two holes 2b-2a opened that a later phase owns**, beyond the ones listed in the verification
section above:

- **`move_match` holds the session mutex across the whole save** — a lock, two parses, a validation,
  a backup copy and a rename — and every command is synchronous on the main thread. A slow disk
  blocks the window. This was theoretical before 2b-2a; it is not now, and Phase 2's debounced
  editing will make it worse.
- **A committed save writes two files** — the target and, on a first modification, one backup — and
  if the rename then fails, `discard_backup` unrecords the copy but a file may remain. Unchanged
  from 2a-3b hole 2, now reachable from a command.

**Two debts that no test can discharge, both carried forward and both now older.**

- **The four `code.diagnosticCode.*` strings 2b-1 corrected have still not been seen on a screen.**
  CLAUDE.md's rule is that a claim about a screen needs a reading of a screen. 2b-2a opened no
  window, so the next phase that does still owes the look.
- **170 Spanish values are checked only by heuristic** — non-blank, non-identical to their English
  twin, in placeholder agreement with it. 2b-2a added thirteen more. Nothing establishes that any of
  them is idiomatic.

---

**Phase 2b-1 is complete and its review is closed.** `docs/decisions/2b-1-notes.md` is the record; §7 is
the finding-by-finding disposition of both reviews and §4 is what 2b-2 inherits. The save transaction's
types now cross the IPC wire — **18 enums / 157 variants and 7 structs**, each with a `code.` namespace
in both `src/lib/i18n/en.json` and `es.json`, pinned by `src-tauri/src/dictionary_contract.rs` and
`src-tauri/src/wire_contract.rs`. **No `#[tauri::command]` was added**: the count is 6 in
`src-tauri/src/commands.rs` and 1 in `menu.rs`, before and after. This is 1b-1's shape repeated — the
i18n layer shipped with no command behind it for the same reason.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 798 tests across 20 binaries, 0 failed
```

**The next step is Phase 2b-2 — the six mutating commands**: `save_match`, `create_match`,
`delete_match`, `move_match`, `save_raw_document`, `reload_document`, each returning `SaveResult`, each
carrying an optimistic-concurrency token, with `SaveResult::Conflict` on the wire. It is the first code
that lets anything outside `espansoconfig-core` write a user's file.

**The one thing 2b-2 must do first, and it is a type change before it is a design.** The
acknowledgement has to arrive *from* the interface, and **nothing in the save wire deserializes**.
2b-1 removed the one type-level obstruction — `FindingCode::VariableMissingRequiredParam::param` is now
an owned `String`, not a `&'static str` — but `Deserialize` itself is still absent from `Finding`,
`ByteSpan` and `VariableKind`. Review A (`docs/reviews/phase-2b-1-wire-boundary.md`) ruled on the three
options and named changing the field type the soundest; it is done. What remains:

- **derive `Deserialize` on `Acknowledgement`, `Finding`, `FindingCode` and their complete transitive
  payload graph** — that is `ByteSpan` and `VariableKind` today, and the compiler will name any others;
- **compare acknowledgements as an exact multiset**, consuming matches or counting occurrences, so that
  `[A, A]` differs from `[A]`. Review A calls a set-membership check insufficient, by name;
- **do not** round-trip an index-based selection (unstable if findings reorder between calls) and **do
  not** hand back the exact JSON bytes (JSON permits insignificant byte differences, object-key order
  is not semantic, and Tauri parses the JSON before Rust sees it). Both were considered and rejected.

**Two wire facts 2b-2 inherits and must not re-decide.**

- **A path on the wire is display text, never an identifier.** Every path crosses through `WirePathRef`
  as a *lossy* String, so two distinct non-UTF-8 filenames can render identically and the string cannot
  be copied back to name the file. The real `PathBuf` stays inside the transaction. A command that
  accepts a wire path back as a target is a bug (review A, A-iii).
- **`io::Error` crosses as `kind` plus a nullable numeric `raw_os_error`, never as prose.** The errno
  was added *because* `ErrorKind` collapses distinct failures into `Other`; it is diagnostic data, gets
  **no dictionary entry**, and no message interpolates it. `CommandError::Io` on the read surface was
  deliberately left alone — widening it is a separate decision.

**Five things 2b-2 must not rebuild, and one it must not undo** — unchanged from the 2a-3b checkpoint
and restated because they are still the ones most likely to be re-derived wrongly:

- **An acknowledgement is content-addressed.** The save command carries the findings *out* and the
  acknowledged subset *back in*, matched as a multiset. **A `force: true` parameter would undo the
  whole design.**
- **Nothing in the core can establish that a human saw a finding.** `validate()` is public and `Finding`
  is publicly constructible, so a caller can compute the findings itself and acknowledge them all.
  **Enforcing presentation is the user interface's obligation**; 2b-2 owes the wire shape that makes it
  possible.
- **`save_document` is the only entry point that may write a user's file**, and it writes *two* — the
  target and, on a first modification, one backup. `replace_file_atomically` and `replace_locked_file`
  take finished bytes and validate nothing; **do not call either from a command**, and never from
  inside the transaction (the lock is not reentrant — the process hangs, silently and forever).
- **`SaveRequest::backups` is `Option<&BackupSession>`, and `None` means no backup at all.** 2b-2 must
  construct and own a `BackupSession` for the app session and thread it through, or every save silently
  runs without a safety net. **The user interface owns what a session is** — the core cannot know.
- **`SavedDocument::committed` can be `false` on a success**, and `SavedDocument::backup` can be `None`
  on a success for four documented reasons each. Neither is a failure, and neither may be presented as
  one.
- **`forgetFileText()`** in `src/lib/browser/workspace.svelte.ts` still has **no caller** and must be
  called after a successful write, or the raw viewer keeps the bytes it read before it.

**`SavedDocument` is *not* serialized**, and that is deliberate rather than an omission. It carries
`Replacement` and `PresentationNote`, which are on neither `PROGRESS.md`'s list nor in `SaveError`'s
closure, and which owe their own dictionary entries the day they cross. **What `SaveResult::Saved`
carries out of a successful save is 2b-2's design to make**, not a leftover to pick up.

**`SaveError` is not flattened, and flattening it is 2b-2's call to make explicitly.** The core's types
took the *core's* wire convention — externally tagged, Rust variant names verbatim, `snake_case` fields
— not `CommandError`'s flat `camelCase` `code` + operands. If the frontend wants nine switchable
top-level codes it builds a shell type the way `CommandError` already does for the read surface; it
does not get them from the core.

**Two holes that are still 2b's to close, both inherited unchanged.**

- **Hole 1** — `DuplicateVariableName` and `RegexDoesNotCompile` are unoverrideable `EditorModelError`s,
  so a file espanso demonstrably runs (duplicates are last-wins) can be unsaveable through the visual
  editor. The escape hatch the plan names is the **raw editor**, which is a UI.
- **Hole 13** — espanso 2.3.0 has a tenth variable type, `var_type: "global"`, which this crate reports
  as `VariableTypeNotRecognised`. Fixing it means a `VariableKind` variant, which is a Phase 1 **wire**
  type and owes two dictionary entries.

**What 2c inherits from 2a-3b specifically** (recorded so it is not re-derived): *Reveal backups in
Finder* points at `BackupSession::root()`, **and that directory may not exist** — a session that saved
nothing creates nothing, deliberately. No string may say a file is recoverable; retention is ten
sessions, and the honest sentence names the number. **A backup is not a version history**: it holds the
file as it was before the session's first change to it, not before each change.

**One thing owed that no test can discharge.** Four pre-existing `code.diagnosticCode.*` strings were
corrected during 2b-1's fix round for predicting espanso's behaviour (`parseFailed`,
`fieldHasUnexpectedShape`, `matchHasSeveralTriggerForms`, `matchHasSeveralContentForms` — both
languages, eight values). They appear on the diagnostics surface that Phase 1c-2b-1 read in a running
window, and **that surface has not been re-read since**. CLAUDE.md's rule is that a claim about a screen
needs a reading of a screen; the claim made in `2b-1-notes.md` §7.2 is deliberately narrower — that the
strings no longer predict espanso's behaviour — and the next phase that opens a window owes the look.

**And one that a bilingual reader owes.** 157 Spanish values were written by 2b-1 and checked only for
being non-blank, non-identical to their English twin, and in placeholder agreement with it. That is the
untranslated-value *heuristic*, and `dictionaries.test.ts` says so itself. Review B corrected ten
Spanish strings on quality grounds; nothing establishes that the remaining ones are idiomatic.

---

**Phase 2a-3b is complete, its review is closed, and with it 2a-3 and the whole of 2a.**
`docs/decisions/2a-3b-notes.md` is the record; §12 is the finding-by-finding disposition of all eleven
review findings plus the confirmation pass's one residue, and §11 is what 2b and 2c inherit.
**Plan §6.6 is finished end to end** — all thirteen steps of the save transaction exist, under one
lock, in Rust that no user interface can reach yet.

**The next step is Phase 2b — the Tauri mutation surface**: plan §6.4's six mutating commands
(`save_match`, `create_match`, `delete_match`, `move_match`, `save_raw_document`, `reload_document`),
each returning `SaveResult`, each carrying an optimistic-concurrency token, and `SaveResult::Conflict`
on the wire. It is the first code that lets anything outside `espansoconfig-core` write a user's file.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 787 tests across 20 binaries, 0 failed
```

**The single largest thing 2b owes, and it is indivisible.** `SaveError` and everything it carries must
cross the wire, and **nothing in `persist` derives `Serialize` today** — deliberately, because the day
any of it does, every variant owes a `code.` namespace in **both** `src/lib/i18n/en.json` and
`es.json`, checked by `src-tauri/src/dictionary_contract.rs`. The full list, which has grown with every
2a sub-phase: `SaveError` (9 variants), `SaveVerdict`, `SaveRefusal`, `Acknowledgement`, `Finding`,
`FindingCode`, `FindingClass`, `WriteError`, `WriteStep`, `TargetDifference`, `EditError`, and now
`BackupError` (with `BackupNameExhausted`), `BackupStep`, `BackupRecord`, `Rotation` and
`RotationOutcome`. **Do not do this piecemeal**; one variant serialized without its string is a
dictionary-contract test failure, and half the enum serialized is worse than none.

**Five things 2b must not rebuild, and one it must not undo.**

- **An acknowledgement is content-addressed.** The save command's wire shape has to carry the findings
  *out* and the acknowledged subset *back in*, matched as a multiset. **A `force: true` parameter would
  undo the whole design.**
- **Nothing in the core can establish that a human saw a finding.** `validate()` is public and `Finding`
  is publicly constructible, so a caller can compute the candidate's findings itself and acknowledge
  them all. **Enforcing presentation is the user interface's obligation, and 2b owes the wire shape
  that makes it possible.**
- **`save_document` is the only entry point that may write a user's file**, and it now writes *two* —
  the target and, on a first modification, one backup. `replace_file_atomically` and
  `replace_locked_file` take finished bytes and validate nothing; **do not call either from a command.**
- **`SaveRequest::backups` is `Option<&BackupSession>`, and `None` means no backup at all.** 2b must
  construct and own a `BackupSession` for the app session and thread it through, or every save silently
  runs without a safety net. **The user interface owns what a session is** — this crate cannot know.
- **`SavedDocument::committed` can be `false` on a success**, and `SavedDocument::backup` can be `None`
  on a success for four different reasons. Neither is a failure, and 2b must not present either as one.
- **`forgetFileText()`** in `src/lib/browser/workspace.svelte.ts` still has no caller and must be called
  after a successful write, or the raw viewer keeps the bytes it read before it.

**Two holes that are 2b's to close, both inherited unchanged.**

- **Hole 1** — `DuplicateVariableName` and `RegexDoesNotCompile` are unoverrideable `EditorModelError`s,
  so a file espanso demonstrably runs (duplicates are last-wins) can be unsaveable through the visual
  editor. The escape hatch the plan names is the **raw editor**, which is a UI.
- **Hole 13** — espanso 2.3.0 has a tenth variable type, `var_type: "global"`, which this crate reports
  as `VariableTypeNotRecognised`. Fixing it means a `VariableKind` variant, which is a Phase 1 **wire**
  type and owes two dictionary entries.

**What 2c inherits from 2a-3b specifically** (recorded here so it is not re-derived): *Reveal backups in
Finder* points at `BackupSession::root()`, **and that directory may not exist** — a session that saved
nothing creates nothing, deliberately. No string may say a file is recoverable; retention is ten
sessions, and the honest sentence names the number. **A backup is not a version history**: it holds the
file as it was before the session's first change to it, not before each change.

---

**Phase 2a-3a is complete and its review is closed.** `docs/decisions/2a-3a-notes.md` is the record;
§11 is the finding-by-finding disposition of all fourteen review findings and §10 is what 2a-3b and 2b
inherit. Plan §7 row 11 is now **three-quarters closed** rather than a quarter: line endings and the
BOM are preserved by construction by the span layer, permissions are restored as mode bits **and** ACL,
and ownership is the one that remains — unfixable by an unprivileged rename-based writer.

Phase 2a-3b was, in its own words, plan §6.6 step **13** and plan §6.6's
"Backups" paragraph. Before the first modification of each file per session, copy the file into a
location that is **not** under an auto-loaded glob, retain the last 10 save batches, and offer *Reveal
backups in Finder*. It is Rust with no UI and no IPC, exactly like 2a-1, 2a-2a, 2a-2b and 2a-3a — the
*Reveal* affordance is a UI and belongs to 2c; what 2a-3b owes it is a path.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 736 tests across 19 binaries, 0 failed
```

**Where the backup step goes, established rather than guessed** (2a-2b notes §8): **between the verdict
and the commit**, inside `save_document`. The lock is already held there, the candidate already
exists, and the target's current bytes are already in memory as `source` — so a backup needs **no extra
read**. It must **not** run before the verdict, or a refused save leaves a backup of a file nobody
changed.

**What 2a-3b inherits from 2a-3a, and must not rebuild.**

- **A backup is a *copy*, and a copy has the same metadata problem the save had.** 2a-3a established
  that `fcopyfile(COPYFILE_ACL | COPYFILE_XATTR)` is how this project carries an ACL and extended
  attributes onto a new inode, and that `COPYFILE_STAT` is **excluded** — measured to restore a stale
  mtime and to copy `uchg`, which then makes a later rename fail and leaves an undeletable file.
  A backup that wants the original's metadata should reuse `copy_metadata`'s decisions, not re-litigate
  them. Whether a backup *should* carry the ACL at all is a real question 2a-3b must answer: an ACL that
  denies deletion, carried onto a backup, makes the backup unrotatable.
- **`copy_metadata` is private to `persist::write`** and takes two `&File`. Exposing it, or a
  `pub(super)` twin, is 2a-3b's call.
- **`SavedDocument::committed` can be `false` on a success.** A candidate byte-identical to the target
  is not rewritten, because every rename installs a new inode and drops metadata for nothing. **A backup
  must not be taken for a save that wrote nothing.**
- **`verify_temp_identity` is the pattern for "the name still means the inode I hold".** A backup that
  writes through a temp file owes the same check, and the same explicit precondition: the rename is by
  pathname, so a directory writable by an untrusted principal is out of scope.
- **A refusal may leave a temp file behind, and 2a-3a stopped claiming otherwise.** Nothing cleans
  leftovers up (notes hole 6). If 2a-3b's backup directory accumulates its own leftovers, it inherits
  that problem rather than solving it, and should say so.

**Three things 2a-3b is most likely to get wrong.**

- **A backup location under an auto-loaded glob is a bug that creates snippets.** Plan §6.6 names
  `~/Library/Application Support/espanso/.espansoconfig-backups/<timestamp>/…`; the leading `.` and the
  directory nesting are both load-bearing, exactly as the temp file's leading `_` and non-`.yml` suffix
  are in 2a-1.
- **"Before the first modification of each file per session" is a statement about session state**, and
  `crate::persist` currently holds none. Where that state lives is 2a-3b's decision to make and to write
  down — a transaction that consulted the caller's cache would be a second owner of the session's state,
  which 2a-2b explicitly refused to become.
- **Diagnostics are phrased as risk, not prophecy**, and this governs variant names, doc comments and
  **test names**. Three sentences a string must never say, inherited rather than invented: *espanso will
  reject this* (plan §6.6); *your edit cannot be lost* (2a-1 D4 — the residual race is one rename wide);
  *this file is valid* (step 4 proves it parses under **our** substrate, step 5 reports under **our**
  model). A backup phase adds a fourth candidate: *your file is recoverable* — retention is 10 batches,
  not forever. 2a-3a added a fifth by removing one: *nothing was written* — a refusal leaves the
  **target** untouched, which is not the same claim.

**What 2a-3b inherits from 2a-2b, and must not rebuild.**

- **`save_document(SaveRequest) -> Result<SavedDocument, SaveError>`** in
  `crates/espansoconfig-core/src/persist/save.rs` is plan §6.6 steps 1 to 12, under **one** lock. It is
  **the only entry point that should ever write a user's file**; `replace_file_atomically` and
  `replace_locked_file` take finished bytes and validate nothing.
- **Do not call `replace_file_atomically` from inside the transaction.** Disabling experiment E12 is
  what happens: the lock is not reentrant and the process hangs, silently and forever.
- **`SavedDocument::committed` can be `false` on a success.** A candidate byte-identical to the target
  is not rewritten, because every rename installs a new inode and drops eight metadata classes for
  nothing. A backup must not be taken for a save that wrote nothing.
- **The blocking policy is one pure function, `verdict(&[Finding], &Acknowledgement)`.** An
  `EditorModelError` refuses with no override; a `SuspiciousButPermitted` refuses until the caller
  acknowledges it **by content**, matched as a **multiset**. Extending it means a `SaveVerdict` variant,
  which is an exhaustive-match compile error.
- **`inspect_target` is the only read of a save target in the crate**, and it is `pub(super)` for that
  reason. It opens `O_NOFOLLOW | O_NONBLOCK` and refuses a non-regular target. A second, unchecked read
  is how finding 8 happened; do not add one.
- **Nothing new derives `Serialize`.** `SaveError` (8 variants), `SaveVerdict`, `SaveRefusal` and
  `Acknowledgement` owe `code.` namespaces in **both** `en.json` and `es.json` the day any of them
  gains it, and they carry `Finding`, `FindingCode`, `FindingClass`, `WriteError`, `WriteStep`,
  `TargetDifference` and `EditError` with them. That is a large, single, indivisible change, and it is
  **2b's**. **2a-3a made it two variants larger and no harder**: `WriteStep::VerifyTempIdentity` and
  `WriteError::TempFileChangedDuringWrite` join the list, and the dictionary contract check
  (`src-tauri/src/dictionary_contract.rs`) was verified to still not see either — neither type derives
  `Serialize`, so **no dictionary key is owed today** and no i18n JSON file was touched.

**What 2b inherits from 2a-2b, and must not rebuild.**

- **An acknowledgement is content-addressed, and 2b must round-trip the findings, not a boolean.** The
  save command's wire shape has to carry the findings out and the acknowledged subset back in. A
  `force: true` parameter would undo the whole design.
- **Nothing in this crate can establish that a human saw a finding.** `validate()` is public and
  `Finding` is publicly constructible, so a caller can compute the candidate's findings itself and
  acknowledge all of them. Enforcing presentation is the **user interface's** obligation, and 2b owes
  it. (This corrects a claim the first pass of the notes made and the review withdrew.)
- **Hole 1 is 2b's to close, not 2a-3's.** `DuplicateVariableName` and `RegexDoesNotCompile` are
  unoverrideable `EditorModelError`s, so a file espanso demonstrably runs — duplicates are last-wins —
  can be unsaveable through the visual editor. The escape hatch the plan names is the **raw editor**,
  which is a UI. Until it exists, the hole is open.
- **Hole 13 is still 2b's**: espanso 2.3.0 has a tenth variable type, `var_type: "global"`, which this
  crate reports as `VariableTypeNotRecognised`. Fixing it means a `VariableKind` variant, which is a
  Phase 1 **wire** type and owes two dictionary entries.

**What the earlier phases leave, and Phase 2 as a whole should not rebuild** — the Phase 1 inheritance
below is still current for 2b and 2c, and the two items addressed to Phase 2 by name are:

- **`forgetFileText()`** in `src/lib/browser/workspace.svelte.ts` must be called after a successful
  write, or the raw viewer keeps the bytes it read **before** it. Nothing fails without it; that is why
  it is written here.
- **`RawDocumentText.text` carries no revision and is not authority for a write.** The viewer's text is
  for reading.

---

**Phase 1c-2b-2b-2 completed Phase 1c-2b-2b, Phase 1c and Phase 1.**
`docs/decisions/1c-2b-2b-2-notes.md` is the record; §8 is the exit verdict and §12 is the
review disposition.

The application can now show **one whole file's text**, drawn through the same primitive the detail
pane uses, with a toggle in the third pane. `documentText()` has a caller at last, so it is in `dist`.
**All five fidelity rows that only a whole document could exhibit are closed by a window reading** — a
real BOM, a NUL, five other C0/C1 controls, a lone CR and a file with no final newline — and a file
that is **not valid UTF-8** draws a typed refusal with its byte offset instead of an empty box, which
closes 1c-2b-2a hole 8.

**Phase 1's stated exit was checked rather than assumed, and it is met.** In a running window over the
owner's real configuration: 13 files, **zero** load failures, **zero** findings, every file's whole
text rendered, and **all 65 snippets clicked and rendered** with 3–6 sections and exactly one
source-text box each. Recorded as counts and file names only (D1). Three things that verdict does
**not** cover are named in notes §8 — the sharpest being that the real configuration produces **zero**
unmodelled entries, so it exercises that surface not at all and synthetic fixtures are its only
coverage, permanently.

**The review round is done: eight findings, two of them blocking, seven closed and the eighth recorded
with Phase 2 as its owner.** See "Phase 1c-2b-2b-2 review disposition" above. The two blocking fixes
were a **user-facing string that was false for line endings** — reworded in both languages and read on
a screen — and a **cleared target that left a stale file-text snapshot**, now invalidated by one
helper called from every path that can remove the target.

**What Phase 2 inherits from Phase 1, and should not rebuild.** (Still current for 2b and 2c; the
authoritative next step is at the top of this section.)

- **`rawDocument.ts` and its four arms.** `loading`, `text`, `empty`, `refused` — a file this
  application cannot show must not look like an empty one, and that rule now has two instances
  (`SourceSlice` over a span, `RawDocumentText` over a file).
- **`documentStart` has exactly one caller and must keep exactly one.** It is the only way a `bom`
  segment is produced; a slice that passed it would claim to know where byte 0 is.
- **`sourceSegments(text, atDocumentStart)` and `SourceText.svelte`, unchanged.** Still the one place
  file text becomes something a screen can draw. **Do not write a second renderer**, and do not
  re-slice by a wire span in JavaScript (`1c-2b-2a-notes.md` §4.2).
- **The corpus sweep in `sourceText.test.ts`.** All 33 committed fixtures now go through the primitive
  and are rebuilt character for character; experiment J shows it catching a normaliser on a real file.
- **The cost model, measured** (notes §8.1): `2n` segments for *n* lines, to 968 000 bytes in a test
  and 17 840 bytes / 45 ms / 4 409 DOM nodes in a window. **Nothing is capped**, deliberately.
- **One plan per launch** (notes §6.1). A WKWebView whose window is occluded stops running `setTimeout`
  about six seconds after launch; `open -a` does not restart it and `-NSAppSleepDisabled` does not
  prevent it. Every window reading from here on must be a short, single-purpose run, relaunched into a
  **fresh bundle path** — LaunchServices silently drops `--env` for a path it thinks is already
  running.
- **Fourteen holes** (notes §9). Three are now holes with **measurements**: the pane still renders file
  text two ways (hole 2, with the reason it was not fixed — the primitive has no inline presentation),
  a parse-failed file still shows `0` like an empty one (hole 3, **seen** on adjacent sidebar rows),
  and mixed line endings are still invisible (hole 5, seen on a 19-break document, and the caption
  above the document now says so rather than implying otherwise).
- **Hole 14 is addressed to Phase 2 by name, and is the one item here a phase can fail by ignoring.**
  It is the review's eighth finding, recorded rather than fixed. Two halves:
  - **There is no way to refresh the file the viewer is showing after a write.** `readFileText()`
    returns early when the target is the file it already holds, and the `force` flag that could have
    overridden that was deleted at experiment E because nothing read-only could reach it. So after a
    successful write the viewer keeps the bytes it read **before** it, and close-and-re-open is the only
    refresh. Phase 2 must call **`forgetFileText()`** (`src/lib/browser/workspace.svelte.ts`) after a
    successful write — deliberately, because **nothing fails without it**.
  - **`RawDocumentText.text` carries no revision and is not authority for a write.** It is a `string`;
    the `ContentRevision` saying which bytes it came from is not on it. Basing an edit on it would be
    writing over whatever is on disk *now* with what was read at some earlier moment. **The viewer's
    text is for reading.**

**What earlier sub-phases leave, and 1c-2b-2b should also not rebuild.**

- **A detail pane, and the rule that keeps it thin.** New work deciding *what* appears goes in
  `src/lib/browser/detail.ts` beside `describeMatch()`; the component gets the walk. The text scan at
  the end of `detail.test.ts` is where a new accessor gets its cheap guard.
- **Seventeen reactive typed accessors** — 1c-1's fourteen plus `tValueKind`, `tDetailField` and
  `tUnknownCount`. **A component calls one and never builds a key.** As of 1c-1 that is enforced rather
  than trusted: `scripts/lint/built-translation-keys.ts` refuses any `t(` whose key is not written
  literally, and it found a two-phase-old instance the moment it was written.
- **226 dictionary keys**, `en.json` still the schema, and the untranslated-value exception list now
  carries `browser.detail.section.variables` by name.
- **`DIAGNOSTIC_DISPLAY_INDICES`, and the pattern it establishes.** New in 1c-2b-1: a **mapped type
  over `DiagnosticCodeName`** that converts a zero-based wire operand into a one-based display number,
  emitting it under a *display* operand name so a stale dictionary leaves a visible placeholder rather
  than a wrong number. A new code without a row is a `svelte-check` failure naming the variant. **Any
  further wire-value-to-display-value conversion belongs here**, beside `ENUM_OPERAND_NAMESPACES` and
  nowhere near the key builders.
- **A working data path, and every file now projected at `open()`.** `browser.status`,
  `browser.documents`, `browser.sidebar`, `browser.scopedMatches`, `browser.visibleMatches`,
  `browser.selected`, `browser.selectedMatch` and `browser.loadFailures` are all live, the selection is
  R27-correct, and **config profiles project too** as of 1c-2b-1. `holdsMatches` governs *counting and
  list membership* only — and it is asked on **`kind`, not `shape`**, because a match-shaped profile is
  still a profile. Both branches of `scopedMatches()` ask it; removing either guard reintroduces a real
  leak (experiment Z).
- **A plural helper.** `src/lib/i18n/plural.ts` selects a `.one` / `.other` key pair on `count === 1`.
  Any new counted string uses it; `"1 snippets"` was a real defect on a real screen.
- **A findings surface in the middle pane**, `src/lib/browser/findings.ts`, with two identities over
  one data type: `diagnosticIdentity` (code only) decides which sentence appears,
  `occurrenceIdentity` (code + span + node + path) decides how many times it is counted. **If a new
  judgement needs a home, it goes here, not into the component.**
- **A notice area, selection-scoped.** If 1c-2b-2 needs somewhere for a non-blocking failure,
  `1c-1-notes.md` hole 5 is the shape of the work: `menuUnavailable`, `menuBuildFailed` and
  `invalidMenuLabels` still have a string and no screen.

**Five rules 1c-2b-2b is most likely to break** — and 1c-2b-2a broke the first of them six times, in
doc comments and test names rather than on a screen, which is the same defect in the one place the
markup scan can never see.

- **Do not claim on screen what the app does not do.** New in 1c-2a, and **1c-2b-1 broke it three
  times in one sub-phase** — a string saying a second YAML document "is shown" when nothing showed it,
  a string saying the *snippet* held a hazard that `disqualifying_hazard` also finds on ancestors, and
  two sentences in its own notes asserting profiles stayed out of `scopedMatches` while they did not.
  The pattern is identical every time: **the sentence was written from the intent, not from the data.**
  1c-2b-2a made it six more, all in doc comments and test names — a test called *…crosses as its own
  bytes* that never built an app, one called *a remote origin is refused* that attempted three of seven,
  one called *every command…* that omitted the new one, and a capability manifest that said "all six"
  the day a seventh was registered. **1c-2b-2b is more exposed than any of them**, because its entire
  subject is *showing bytes* and its most likely failure is a viewer that says "as written" while a
  transformation sits between the file and the screen. **Before writing a string, check the data behind
  it exists and says that** — and before writing a test *name*, read the body and ask whether it could
  fail if the name were false.
- **Never hardcode a user-facing string** (CLAUDE.md §2). Every namespace now has a caller, so a new
  string here is genuinely new prose in **both** dictionaries.
- **R31 — a clean lint run is not evidence.** `scripts/lint/hardcoded-strings.ts` sees `.svelte`
  **markup** only: not `<script>` bodies, not `{'literal'}`, not `.ts` constants, not props. 1c-2a and
  1c-2b-1 both enumerated their blind spots by name rather than assuming them clean; do the same.
  **Experiment Y is the demonstration**: `tHazard(` left in a comment while the markup renders the raw
  identifier passes the entire suite.
- **Nothing establishes that any of the Spanish strings is Spanish.** The untranslated-value check
  establishes non-identity. This now matters more than it ever has: the strings are on a screen, 1c-1
  added 35, 1c-2a added 50 and 1c-2b-1 added 8. A bilingual reader is the only thing that closes it.
  The one defect found here so far — two different Spanish words for one concept, one above the other
  on screen — was found **by reading a screen**, which remains the only instrument that has ever caught
  anything in this area.
- **`cargo build` must follow every `npm run build` before a window reading.** New in 1c-2b-1 and it
  silently invalidated one reading: `custom-protocol` embeds `dist` into the binary, so a window opened
  after only a `vite build` shows the **previous** bundle and looks entirely normal.
- **Nothing renders a Svelte component in an automated test** — `1c-1-notes.md` hole 1, and the reason
  the R32 readings had to be re-taken after the fix round. A component that throws produces an empty
  pane that the whole suite passes straight through. Either adopt a DOM and a component-testing library
  as a deliberate decision with its own costs, or read the window again. **Do not skip both.**
- **A held identity can go stale, and the UI is what holds identities** — R27. `match_by_id` returns
  `Result<_, IdentityError>`; a lookup crossing a `refresh()` may get `StaleRevision`, which means the
  **document moved on**, not that the match survived. Recovery is re-resolution, with three possible
  answers, and `identityRecovery()` returns them as data so a caller cannot skip one. `DocumentPath`
  is **not** a fallback identity — a sequence step is a position. **1c-1 got this wrong once already**
  and a reviewer caught it: the comparison that decided `sameMatch` was blind to `word`, to variables
  and to every non-primary content field. It compares `MatchView.source_text` now — the match's own
  bytes — and **must not be narrowed back to a display projection.**

**Phase 1 is read-only, so it cannot corrupt a file.** That makes it the right place to spend effort on
the UI shell, i18n and the Tauri boundary rather than on fidelity. The fidelity engine is done and
proven, and since 1a the read model is too.

### What Phase 1b inherits from 1a

- **The command surface already exists.** `Workspace::{discover, summary, list_documents,
  get_document, get_match, document_view, document_text, refresh, load_all, evict}` maps onto plan
  §6.4's read-only commands. `DocumentView` is what crosses the boundary; `SourceDocument` is
  deliberately not serializable.
- **A held identity can go stale, and the UI is what holds identities** — R27, **corrected at
  1b-2a**. `match_by_id` returns `Result<_, IdentityError>` and a lookup crossing a `refresh()` may
  get `StaleRevision`. Handle it; do not unwrap it. That code means **the document moved on** — not
  that the match survived. Recovery is *re-resolution*, and re-resolution has three possible answers:
  the same match, a **different** match, or nothing. `DocumentPath` is **not** a fallback identity: a
  sequence step is `PathSegment::Index(usize)`, a position, so an external edit that deletes an
  earlier match leaves the path resolving to a different one. The earlier wording here — "re-resolve
  by `DocumentPath`, the thing designed to survive a reparse" — was **false and is withdrawn**.
- **Scalars arrive as source text**, per D2u. There is no type to render, and no badge derives from a
  value.
- **`Deserialize` is derived on a named list only** — R28. Do not widen it without reading
  `docs/decisions/1a-notes.md` §9 hole 6 first.

### What the gate licenses, and what it does not

**Licensed:** UI work on the operations that exist — editing a scalar, adding and removing a field,
reordering matches **inside one sequence**.

**Not licensed, and each has a reason on file:**

- **Presenting a plain scalar's *type*** to the user. R16's open half: 31 synthetic and 65 real plain
  scalars resolve non-`str` under YAML 1.1, and the projection is not proven to match espanso's resolver.
  A UI that renders `on` as a boolean is making a claim this project has not earned. **This question is
  now decided — see D2u: the browser shows source text, never an inferred type.** Flagging a scalar as
  1.1-ambiguous *is* permitted, because that is a claim about risk rather than about meaning.
- **Moving a match between files or between sequences** (D2r). `ItemMove` is same-sequence only, and its
  "no re-indentation" proof does not transfer. Plan §8.4's drag-between-files needs its own operation.
- **Combining a move with any other edit in one batch** (R25).

### The two concerns this section used to raise before Phase 1, and where they stand

1. **R19's remaining half — ✅ answered by 1a.** The safe entry point re-scanned on every call, and
   ~20 ms per keystroke-triggered rescan is not viable for an editor. `crate::workspace` now builds the
   `SyntaxIndex` + `TriviaIndex` **once per `ContentRevision`** and serves views from the cache, pinned
   against an instrumented parse counter. What is *not* answered is incrementality: a document that
   changes is reparsed whole. That is fine for a browser and will need revisiting when Phase 2 edits on
   a debounce.
2. **Architecture rule (CLAUDE.md §3) — still absolute, and the check changed in 1b-1 (D2x).**
   `crates/espansoconfig-core` must never depend on `tauri`, directly or transitively.
   `rg -c tauri Cargo.lock` **is no longer a check** — `src-tauri/` exists, so the lockfile contains
   tauri legitimately and that command now finds matches whether or not the rule holds. The check is
   `cargo tree -p espansoconfig-core | rg tauri` finding nothing, and it was run and empty at 1b-1.
   Do not quote the old one-liner as evidence again.

### Standing rules that outlive Phase 0

- **R24 — a safety property that lives only in the test suite is not a safety property.** It has now
  occurred **three times, in three consecutive phases**, and the third (Phase 1a) was found by a
  *reviewer* rather than by the phase. Whenever a sweep proves something the engine relies on, ask
  whether the engine asserts it too. The closure condition is the sentence in
  `docs/decisions/0c-3b-2b-notes.md` §8.1: *the gate rests on no property whose only home is a test file.*
  **Its 1a corollary, which is cheaper to check and catches more:** read the test's *name*, then read its
  *body*, and ask whether the body could fail if the name's claim were false. `…survives_a_reordering`
  never reordered anything for a whole phase.
- **An audit that iterates what the implementation emitted is vacuous.** New in 1a (D2w), and it is R24
  seen from the other side: a coverage check that walks the records the code chose to produce cannot see
  a record the code declined to produce. Derive the expectation from the **document**, then compare.
- **R20 — the corpus is the weak link, eight occurrences.** A new refusal gets a fixture on **each side**
  of its condition, never one inside it. The eighth was `ExplicitKeyMapping`, which had no fixture at all
  for five phases while being counted as covered. **1a added two more deviations rather than fixtures** —
  the depth guard and the non-scalar sequence item are pinned by hand-written sources on both sides, not
  by corpus fixtures — and both are recorded as deviations in `1a-notes.md` §9 holes 4 and 10.
- **An oracle must be able to disagree.** Break the **engine** and check the oracle fires, not only the
  reverse.
- **A comparison that decides identity must see everything that distinguishes two things.** New in 1c-1,
  and it is R24's corollary aimed at a *predicate* rather than at a test. The selection's fingerprint was
  assembled from what the **list pane displays** — search text, badges, two shape codes — and was then
  asked to answer a question about **identity**. Two matches differing only in `word: true` / `word: false`
  were identical to it. The lesson generalises: when a comparison is built from a projection, write down
  what the projection drops, then ask whether the question being asked can survive those omissions.
- **A component that no test renders is a component nobody has run.** New in 1c-1. The whole frontend
  suite — 354 tests — passes without instantiating a single Svelte component, so a runtime error in one
  produces a blank pane the suite cannot see. Until that changes, **a claim about a screen needs a
  reading of a screen**, re-taken after any change to a component. 1b-1's blank window is the precedent.
- **An identity that is "designed to survive" something has to be shown surviving it.** New in 1b-2a,
  and the fourth occurrence of the pattern R24's corollary names. The phase wrote that `DocumentPath`
  was the identity designed to survive a reparse, **in three files and in this checkpoint**, without a
  test in which anything survived a reparse. The reviewer wrote the counterexample in four lines. Read
  the *name* of the property, then look for the test that could fail if it were false — the same check
  as R24's corollary, applied to a doc comment instead of to a test name.
- **Corpus privacy (D1) is absolute**, and matters more as the UI grows: no real config content in any
  committed file, screenshot, test name or report. Real-corpus counts computed, never hard-coded; its
  tests skip cleanly when absent.
- **Never hardcode a user-facing string** (CLAUDE.md §2). This is the rule Phase 1 is most likely to
  break, because a browser is almost entirely user-facing strings.

### The weakest pins, if a later phase touches them anyway

**R22** (`InconsistentEntryIndentation` pinned at 0 by argument, not construction — the weakest in the
table), **R25** (move verification is not compositional, so `OverlappingEdits` is never tested against a
move-versus-edit conflict), **R26** (`shares_a_line` is a unit test rather than a fixture), and R16's
1.2-core half, which has no second implementation where the 1.1 half now has one.

---



---

## Superseded next action — written at 2d-4a-E (round 10), spent by 2d-4a-F

**History, never an instruction.** It named Phase 2d-4a-F as the next action and predicted the
tail would end at round 11. 2d-4a-F ran; round 11 returned `do-not-ship` with a High in source,
so the prediction was wrong and round 12 is owed. Kept verbatim below.

## Next action

### Rounds 9 and 10 both RAN today. The next action is **Phase 2d-4a-F** — round 11's review of the round-10 fix — then **Phase 2d-4b**.

**🛑 Do not run a step-2 round 10 of 2d-4a-C.** That tail is closed by owner decision; reopening it
needs a new owner ruling. **2d-4a's own tail is a different tail** and is the one that is live — it
has now run *eleven* numbered positions, so a bare "round 10" is ambiguous between the two. Check
which tail before acting.

#### What happened on 2026-08-29, under `/autoclaude-opus` in driven mode

**Two corrective phases ran to completion: 2d-4a-D (round 9) and 2d-4a-E (round 10).** Each was
commissioned by `CLAUDE.md` §7.1 because the fix before it changed a source file, and each spent the
workflow's single per-phase review invocation.

| Round | Phase | Verdict | Findings | Report |
|---|---|---|---|---|
| 9 | 2d-4a-D | **do-not-ship** | **2 High**, 3 Medium | [`…round-9.md`](docs/reviews/phase-2d-4a-round-9.md) |
| 10 | 2d-4a-E | ship-with-fixes | **0 High**, 2 Medium, 2 Low | [`…round-10.md`](docs/reviews/phase-2d-4a-round-10.md) |

The record is [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) **§18** (round 9) and
**§19** (round 10); the briefs are `docs/decisions/2d-4a-{D-round-9,E-round-10}-brief.md`.

**Both reviewers were the `/autoclaude-opus` workflow's own `autoclaude-reviewer` agent on
`model: "opus"`, not Codex** — the workflow names exactly one review mechanism. **Rounds 7–10 are
four consecutive rounds with no second provider's eyes**, and round 10 was *told* that in its brief
and asked to look where an Opus reviewer would nod. That is a coverage bound, recorded in §18.4 and
§19.4, not a defect. **2d-4a-F is the next opportunity to break the run.**

#### 🔴 What round 9 found, and what round 10 then cleared

Round 8's Medium was that the M1 paragraph on `address_of_minted` claimed an *enforcement* the code
does not perform; **its fix replaced that with a closed enumeration wrong by one** — *"**Two** things
end that loop"*, omitting **overflow eviction** — and **the correct enumeration was written out one
file away**, in `retained_state.rs` clause 4. Round 5 of this tail found the same shape in the same
file. Round 9's second High: the `INVENTORY` entry cited **clause 6** for a sentence stating clause
4's third way.

**Round 10 closed both by its own derivation rather than by trusting the fix** — every mutation of
`pending` enumerated (**no fourth way**), *"every lock in this module"* checked against eight sites,
and *"no `INVENTORY` count moved"* re-derived over all 88 retained-state and 61 liveness phrases.
**Round 9's two Highs are closed by an independent round, not merely by their own fix.** Round 10's
own two Mediums were **citation discipline in that same comment**, not behaviour: a paraphrase of
clause 5's victim rule missing its tie-break, and a restatement of clause 4's caveat beside the
pointer meant to replace it — which `retained_state.rs:59-61` says outright *"has bought nothing"*.
The fix answers both the way that rule prescribes: **point, do not restate.**

#### Step 1 — Phase 2d-4a-F, the third corrective phase (THE NEXT ACTION)

**Why it exists.** The round-10 fix changed **one source file** —
`src-tauri/src/reconciliation.rs`, comment-only, two hunks — so §7.1 commissions **round 11**.
`/autoclaude-opus` allows one review invocation per phase and 2d-4a-E spent it on round 10, so §7.4
carries the debt into the next corrective phase. **2d-4a-E is superseded by 2d-4a-F, never complete.**

**Round 11's scope is two comment edits in one file**, plus §19 and the round-10 correction block in
§18.3 — narrower than round 10's scope, which was narrower than round 9's. **§7.2 predicts the
ending**: a tail stops at the first fix round that stops touching source, so if round 11 finds only
record defects — or nothing — its fix touches no source file and **the tail ends there**. That is a
prediction, not a permission: if round 11 finds a real defect in source, its fix commissions round 12
and the tail is doing its job.

**Three things the round-11 brief should carry**, all from 2d-4a-E. **The two edits under review** at
`reconciliation.rs` ~1497–1520 — the eviction sentence now **points at clause 5** instead of
paraphrasing it, and clause 4's caveat is **deleted**, leaving the pointer alone; ask whether pointing
lost something the paraphrase carried. **A pointer's target is checked for existence, not content**
(§19.4): both crates deny `rustdoc::broken_intra_doc_links`, so deleting `retained_state` breaks the
build, but *clause 4* and *clause 5* are ordinals in a hand-numbered list and **inserting a clause
renumbers every citation in the workspace with nothing failing** — this round leans on that harder
than the last. And **L2 was considered and declined, which is not the same as closed**: the precedent
claim in `retained_state_contract.rs:1089`'s `reason`, with §19.1's argument recorded in full so a
later round can disagree with it rather than rediscover it.

Dispatch it as before: a fresh `autoclaude-reviewer` on `model: "opus"` that did not write the code,
briefed from [`docs/decisions/2d-4a-E-round-10-brief.md`](docs/decisions/2d-4a-E-round-10-brief.md)'s
shape, writing to `docs/reviews/phase-2d-4a-round-11.md`. To break the four-round Opus run instead,
[`docs/decisions/codex-dispatch-procedure.md`](docs/decisions/codex-dispatch-procedure.md) is the
Codex route — a `/goahead` procedure, not an `/autoclaude` one, and its known failure modes are worth
reading before choosing it inside a driven single-shot session.

#### Step 2 — Phase 2d-4b

Spec: [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) §2 — the mirrored
TypeScript types, the `BrowserCommands` wrapper for the drain, the **injectable** event-listener
wrapper, the `describe*` builders in `src/lib/i18n/codes.ts` with their reactive `t*` wrappers in
`index.ts`, the frontend tests, and the re-measured `npm run check` / `npm test` / `npm run build`
baselines. Its four inherited constraints are listed at the end of the round-7 brief. By the standing
rule since 2b-2c, a design consult comes before any line of it is written.


---

## Superseded next action — written at 2d-4a-F (round 11), spent by 2d-4a-G

**History, never an instruction.** It named Phase 2d-4a-G as the next action. 2d-4a-G ran;
round 12 returned `ship-with-fixes` with 0 High, and two of its Lows were fixed in source, so
round 13 is owed. Kept verbatim below.

## Next action

### Round 11 RAN today and found a High in source. The next action is **Phase 2d-4a-G** — round 12's
### review of the round-11 fix — then **Phase 2d-4b**.

**🛑 Do not run a step-2 round 10 of 2d-4a-C.** That tail is closed by owner decision; reopening it
needs a new owner ruling. **2d-4a's own tail is a different tail** and is the one that is live — it
has now run *twelve* numbered positions, so a bare round number is ambiguous between the two. Check
which tail before acting. The spent next-action blocks are in
[`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md), which
is **history and never an instruction**.

#### What happened on 2026-08-29, under `/autoclaude-opus` in driven mode

**Three corrective phases have now run to completion: 2d-4a-D (round 9), 2d-4a-E (round 10) and
2d-4a-F (round 11).** Each was commissioned by `CLAUDE.md` §7.1 because the fix before it changed a
source file, and each spent the workflow's single per-phase review invocation.

| Round | Phase | Verdict | Findings | Report |
|---|---|---|---|---|
| 9 | 2d-4a-D | **do-not-ship** | **2 High**, 3 Medium | [`…round-9.md`](docs/reviews/phase-2d-4a-round-9.md) |
| 10 | 2d-4a-E | ship-with-fixes | 0 High, 2 Medium, 2 Low | [`…round-10.md`](docs/reviews/phase-2d-4a-round-10.md) |
| 11 | 2d-4a-F | **do-not-ship** | **1 High**, 1 Medium, 1 Low | [`…round-11.md`](docs/reviews/phase-2d-4a-round-11.md) |

The record is [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) **§18** (round 9),
**§19** (round 10) and **§20** (round 11); the briefs are
`docs/decisions/2d-4a-{D-round-9,E-round-10,F-round-11}-brief.md`.

#### 🔴 What round 11 found, and why it matters more than its count

**§19.4 predicted this tail would end at round 11, and it did not.** The prediction was written as a
prediction and not as a permission, and §7.2 is explicit that a round finding a real source defect is
the mechanism working. **Take no forecast from §20 either** — the honest form is the conditional: if
round 12 finds only record defects or nothing, its fix touches no source file and the tail ends there.

**The High is a clause four rounds had read past.** `reconciliation.rs` said the eviction victim is
*"never whichever entry this assertion trips over"* — while the **same sentence's own condition**
says the entry loses its place *"when `evictable_sequence` picks it"*, the **same paragraph's
summary** four lines below names what the escape waits on as *"an overflow that selects this
entry"*, and the `INVENTORY` `reason` at `retained_state_contract.rs:1089` calls it *"an overflow
evicting **it** inside the enqueue"*. On the literal reading the escape can never fire and the list
closed at three has two members — **round 9's enumeration-wrong-by-one reached from the other side**.
The fix moves *never* onto the **reason**, where it was always true: clause 5 *"does not know this
assertion exists"*, and the entry *"goes when the rule happens to name it, never because it is the
entry that trips here."* **The defect predates M1** — the pre-M1 text said *not* — so rounds 9 and 10
both read it, and round 10 rewrote its neighbours while keeping it. **A rewrite is not a review of
what it preserves.**

**What round 11 cleared is again larger than what it found**, all by its own derivation: clause 5
states the victim rule whole with its tie-break and matches `evictable_sequence`, so M1's pointer is
accurate; clause 4 satisfies all three surviving claims made about it, so M2's deletion kept nothing
local; the `retained_state.rs:55-61` header quotes are correct; **L2's declined argument holds on a
second round's reading**; `+9 / −9` all-`///` and *`retained_state_contract.rs` unchanged* are true of
`22d1afb`; and no phrase of either family moved. §20's opening lists all six.

#### Step 1 — Phase 2d-4a-G, the fourth corrective phase (THE NEXT ACTION)

**Why it exists.** The round-11 fix changed **one source file** — `src-tauri/src/reconciliation.rs`,
comment-only, **+4 / −3**, one sentence — so §7.1 commissions **round 12**. `/autoclaude-opus` allows
one review invocation per phase and 2d-4a-F spent it on round 11, so §7.4 carries the debt into the
next corrective phase. **2d-4a-F is superseded by 2d-4a-G, never complete.**

**Round 12's scope is one comment edit in one file**, plus §20 and the two round-11 correction blocks
(one under §19.1's closing paragraph, one under §18.3's round-10 block). **Four things the round-12
brief should carry**, all from 2d-4a-F:

1. **The edit under review** at `reconciliation.rs` ~1500–1505. Ask the sharpest available question
   about it: the repair keeps the word *never* and moves it from the **victim** to the **reason**
   (*"never because it is the entry that trips here"*). Is that claim true of `evictable_sequence`,
   and does the sentence now agree with the paragraph's summary at `:1509` and with the `reason` at
   `retained_state_contract.rs:1089`? **A repair that relocates a word can relocate the defect.**
2. **H1 was older than the fix that was under review**, so the round that reviews *its* fix should not
   assume the surrounding sentences are clean merely because four rounds have read them. §20.4 marks
   this *recorded only*, and it is the reason the tail keeps producing findings in one paragraph.
3. **A pointer's target is checked for existence, not for content.** Both crates deny
   `rustdoc::broken_intra_doc_links`, so deleting `retained_state` breaks the build — but *clause 4*
   and *clause 5* are ordinals in a hand-numbered list, and **inserting a clause renumbers every
   citation in the workspace with nothing failing**. §20.4 sizes that surface for the first time:
   **nine Rust files, 83 citations**, that count being the orchestrator's and **not verified by round
   11**. Round 12 may verify or break it.
4. **L2 stays declined on two rounds' reading.** The precedent claim in
   `retained_state_contract.rs:1089`'s `reason`; §19.1 has the argument in full and round 11 agreed
   with it. Say so in the brief so round 12 does not spend its budget rediscovering it.

Dispatch it as before: a fresh `autoclaude-reviewer` on `model: "opus"` that did not write the code,
briefed from [`docs/decisions/2d-4a-F-round-11-brief.md`](docs/decisions/2d-4a-F-round-11-brief.md)'s
shape, writing to `docs/reviews/phase-2d-4a-round-12.md`. **That would be the sixth consecutive Opus
round.** To break the run instead,
[`docs/decisions/codex-dispatch-procedure.md`](docs/decisions/codex-dispatch-procedure.md) is the
Codex route — a `/goahead` procedure, not an `/autoclaude` one, and its known failure modes are worth
reading before choosing it inside a driven single-shot session.

#### Step 2 — Phase 2d-4b

Spec: [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) §2 — the mirrored
TypeScript types, the `BrowserCommands` wrapper for the drain, the **injectable** event-listener
wrapper, the `describe*` builders in `src/lib/i18n/codes.ts` with their reactive `t*` wrappers in
`index.ts`, the frontend tests, and the re-measured `npm run check` / `npm test` / `npm run build`
baselines. Its four inherited constraints are listed at the end of the round-7 brief. By the standing
rule since 2b-2c, a design consult comes before any line of it is written.

---

## Spent — the next action as it stood after round 12 (2026-08-29), carried out by Phase 2d-4a-H on 2026-08-30

_History, never an instruction. Its step 1 ran as round 13 and closed 2d-4a's tail; its step 2 (Phase 2d-4b) became the live next action._

### Next action (spent)

### Rounds 11 and 12 both RAN today. The next action is **Phase 2d-4a-H** — round 13's review of the
### round-12 fix — then **Phase 2d-4b**.

**🛑 Do not run a step-2 round 10 of 2d-4a-C.** That tail is closed by owner decision; reopening it
needs a new owner ruling. **2d-4a's own tail is a different tail** and is the one that is live — it
has now run *thirteen* numbered positions, so a bare round number is ambiguous between the two. Check
which tail before acting. The spent next-action blocks are in
[`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md), which
is **history and never an instruction**.

#### What happened on 2026-08-29, under `/autoclaude-opus` in driven mode

**Four corrective phases have now run to completion: 2d-4a-D, -E, -F and -G.** Each was commissioned
by `CLAUDE.md` §7.1 because the fix before it changed a source file, and each spent the workflow's
single per-phase review invocation.

| Round | Phase | Verdict | Findings | Report |
|---|---|---|---|---|
| 9 | 2d-4a-D | **do-not-ship** | **2 High**, 3 Medium | [`…round-9.md`](docs/reviews/phase-2d-4a-round-9.md) |
| 10 | 2d-4a-E | ship-with-fixes | 0 High, 2 Medium, 2 Low | [`…round-10.md`](docs/reviews/phase-2d-4a-round-10.md) |
| 11 | 2d-4a-F | **do-not-ship** | **1 High**, 1 Medium, 1 Low | [`…round-11.md`](docs/reviews/phase-2d-4a-round-11.md) |
| 12 | 2d-4a-G | ship-with-fixes | **0 High**, 2 Medium, 3 Low | [`…round-12.md`](docs/reviews/phase-2d-4a-round-12.md) |

The record is [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) **§18** … **§21**, one
section per round; the briefs are `docs/decisions/2d-4a-{D,E,F,G}-round-{9,10,11,12}-brief.md`.

#### 🟢 What round 12 cleared, and the one shape it found twice

**It cleared round 11's repair at the level round 11 attacked.** `evictable_sequence` (`:921-935`) is
a pure function of `pending` over paths, counts and sequences, reading no `DocumentId` and no
assertion state, **with no coupling direct or indirect** — so *"never because it is the entry that
trips here"*, *"when `evictable_sequence` picks it"*, *"an overflow that selects this entry"* and
`retained_state_contract.rs:1089`'s *"an overflow evicting **it**"* are now **all true together**. It
also checked the **preserved** clauses rather than assuming them (`drain`'s two mutations, `enqueue`'s
`while … > QUEUE_CAPACITY`, all three `PoisonError::into_inner` sites), confirmed §20.2's figures, and
agreed for the **third** round that round 10's L2 stays declined.

**Its two Mediums and one Low are one shape: a figure measured over one span and labelled with
another.** The round-11 block said its link count listed *"the doc comment"* when it listed the
**paragraph** (the doc comment gives 13 over 10; the paragraph gives the six over five it reports);
§20.4's *"83 citations"* was `rg -c`, which counts **lines** — `rg -o … | wc -l` gives **85**; and the
round-10 block it all descends from labelled a **hunk's** count as the paragraph's. **Three
instances, three rounds, one shape**, each found by re-deriving the figure rather than re-reading the
sentence. All three are corrected.

**Its second Medium is the sharper one.** §20.4 said *"H1 is older than the fix under review"*, which
is true of the words and misleading about the defect: pre-M1 the *not* sat beside a **concrete
criterion**, under which it read as criterion-versus-criterion and was true. M1 deleted that
criterion, substituted *"whatever that rule names"*, and strengthened *not* into *never*. **M1 is a
contributing cause, not merely a preserver**, so the record no longer implies four rounds had read the
defect.

#### Step 1 — Phase 2d-4a-H, the fifth corrective phase (THE NEXT ACTION)

**Why it exists.** Round 12's two source Lows were **fixed rather than carried** — §7.3 would have
permitted carrying either, and §21.1 records the merits that decided otherwise: L2 broke the
punctuation of the three-item list **both Highs of this tail were miscounts of**, and L1's ambiguous
clause was one round old and duplicated the paragraph's own summary. That fix changed
`src-tauri/src/reconciliation.rs` (**+3 / −4**, comment-only), so §7.1 commissions **round 13**, and
§7.4 carries the debt into this phase. **2d-4a-G is superseded by 2d-4a-H, never complete.**

**Four things the round-13 brief should carry**, all from 2d-4a-G:

1. **The edit under review** at `reconciliation.rs` ~1498–1505. It does two things at once: it turns
   the full stop after *clause 5* back into a comma with an appositive (*"a rule that does not know
   this assertion exists"*), restoring the *A; B; and C* list, and it **deletes** the clause *"so this
   escape waits on a state it cannot bring about"*. Ask whether the appositive's antecedent is any
   clearer than the pronoun it replaced, and whether deleting the clause lost anything the summary at
   `:1509-1510` does not already carry.
2. **This paragraph has produced two Highs in twelve rounds, both enumeration miscounts**, and round
   12's L2 was a punctuation change that damaged the same enumeration. **Count the list.** The
   preserved clauses are in scope for the same reason: a rewrite is not a review of what it preserves.
3. **"Measure one span, label another" is now a named shape** (§21.4), found three times in three
   rounds. Every figure §21 cites — `+3 / −4`, *every line begins `///`*, *six over five*, *13 over
   10*, the 88/61 phrase families — is the fix round's own derivation. **Re-derive them**, and check
   each is labelled with the span it was taken over.
4. **L2 of round 10 stays declined on three rounds' reading.** Say so in the brief so round 13 does
   not spend budget rediscovering it.

Dispatch it as before: a fresh `autoclaude-reviewer` on `model: "opus"` that did not write the code,
briefed from [`docs/decisions/2d-4a-G-round-12-brief.md`](docs/decisions/2d-4a-G-round-12-brief.md)'s
shape, writing to `docs/reviews/phase-2d-4a-round-13.md`. **That would be the seventh consecutive
Opus round — now longer than the six-round Codex run it replaced.** To break it,
[`docs/decisions/codex-dispatch-procedure.md`](docs/decisions/codex-dispatch-procedure.md) is the
route: a `/goahead` procedure, not an `/autoclaude` one, and its known failure modes are worth reading
before choosing it inside a driven single-shot session.

#### Step 2 — Phase 2d-4b

Spec: [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) §2 — the mirrored
TypeScript types, the `BrowserCommands` wrapper for the drain, the **injectable** event-listener
wrapper, the `describe*` builders in `src/lib/i18n/codes.ts` with their reactive `t*` wrappers in
`index.ts`, the frontend tests, and the re-measured `npm run check` / `npm test` / `npm run build`
baselines. Its four inherited constraints are listed at the end of the round-7 brief. By the standing
rule since 2b-2c, a design consult comes before any line of it is written.

---

## The next-action block that carried Phase 2d-4a to its closure — spent 2026-08-30

Written by Phase 2d-4a-H when round 13 ended the tail, and spent by the iteration that ran 2d-4b's
design consult. **History, never an instruction.** Its 🛑 about a round 14 was true when written and
remains true: no round 14 of 2d-4a is commissioned.

## Next action

### Phase 2d-4a's review tail CLOSED at round 13. The next action is **Phase 2d-4b** — the TypeScript
### half of the reconciliation wire — and it opens with a **design consult**.

**🛑 Do not run a round 14 of 2d-4a.** It is not commissioned and running one would be a round nobody
authorised (`CLAUDE.md` §7.2's last paragraph). Round 13's fix round changed **no source file** — three
correction blocks in `docs/decisions/2d-4a-notes.md`, which is under `docs/` and so on §7's closed list
of *the record* — so §7.1 commissions nothing and the step closes. **Neither is a step-2 round 10 of
2d-4a-C available**: that is a different tail, closed by owner decision, and reopening it needs a new
owner ruling. Thirteen numbered positions exist across the two, so a bare round number is ambiguous —
check which tail before acting. The spent next-action blocks are in
[`docs/progress-archive/next-action-history.md`](docs/progress-archive/next-action-history.md), which
is **history and never an instruction**.

#### What closed the tail, and why it is a rule's output rather than a judgement

**Phase 2d-4a-H ran round 13 on 2026-08-30** — a fresh `autoclaude-reviewer` on `model: "opus"`,
briefed from [`docs/decisions/2d-4a-H-round-13-brief.md`](docs/decisions/2d-4a-H-round-13-brief.md),
reporting to [`docs/reviews/phase-2d-4a-round-13.md`](docs/reviews/phase-2d-4a-round-13.md). Verdict
**`ship-with-fixes`: 0 High, 2 Medium, 0 Low, and both Mediums in the record.**

| Round | Phase | Verdict | Findings |
|---|---|---|---|
| 9 | 2d-4a-D | **do-not-ship** | 2 High, 3 Medium |
| 10 | 2d-4a-E | ship-with-fixes | 0 High, 2 Medium, 2 Low |
| 11 | 2d-4a-F | **do-not-ship** | 1 High, 1 Medium, 1 Low |
| 12 | 2d-4a-G | ship-with-fixes | 0 High, 2 Medium, 3 Low |
| **13** | **2d-4a-H** | **ship-with-fixes** | **0 High, 2 Medium — both in the record** |

**It cleared the source change.** The reviewer counted the enumeration this paragraph has twice been
wrong about and found it right: three items as *A; B; and C*, the colon at `reconciliation.rs:1503`
opening a clause **inside** item 2 and the semicolon at `:1505` closing it, the summary at `:1507-1510`
matching all three in order, and the appositive true of `evictable_sequence` (`:921-935`). Round 12's
repair holds.

**Both Mediums were confirmed by re-derivation before being accepted, not taken on the report's word.**
M1: §18.3's round-12 correction block raised the citation total to **85** and in the same breath called
a breakdown summing to **83** *"exact"* — an occurrence total beside a line breakdown, **inside the
block written to correct exactly that shape**. Only `retained_state_contract.rs` moves (41 over 39),
which is why eight of nine rows hid it. M2: §21.2 said *"listed in full"* and named four of seven files.
**And the one thing round 13 could not verify was chased down rather than carried**: the **88 / 61 /
149** figures are right, but they count `RETAINED_STATE_SHAPES` and `LIVENESS_SHAPES` — the sweep's
**patterns** — while both modules use `phrase` for an `INVENTORY` field holding something else. §21.3
now carries two `awk` lines that reproduce 88 and 61. **A name collision rather than a span one**, and
the nearest neighbour yet of the shape §21.4 names.

**The record is [`docs/decisions/2d-4a-notes.md`](docs/decisions/2d-4a-notes.md) §22.** Its §22.4 marks
every residue per §7.3; **none is a blocker**, which is a condition of the closure and not an
afterthought to it. Two are worth carrying forward by name: `docs/reviews/phase-2d-4a-queue.md` still
has no section for rounds 10–13 (*actionable*, record not source, so a later phase may adopt it), and
**seven consecutive Opus rounds with no second provider** (*recorded only*) — a bound the closure does
**not** discharge, because closure is a fact about round 13's diff and not about its thoroughness.

#### Phase 2d-4b — the TypeScript half of the wire (THE NEXT ACTION)

Spec: [`docs/decisions/2d-4-split-notes.md`](docs/decisions/2d-4-split-notes.md) §2 — the mirrored
TypeScript types, the `BrowserCommands` wrapper for the drain, the **injectable** event-listener
wrapper, the `describe*` builders in `src/lib/i18n/codes.ts` with their reactive `t*` wrappers in
`index.ts`, and the frontend tests. §3 says why the EN/ES JSON is in 4a and the accessors in 4b; §4
says what neither step does. Its four inherited constraints are listed at the end of
[`docs/decisions/2d-4a-round-7-brief.md`](docs/decisions/2d-4a-round-7-brief.md).

**Three things bind it before any line is written:**

1. **A design consult comes first** — the standing rule since 2b-2c, and 2d's own consult
   ([`docs/reviews/phase-2d-design.md`](docs/reviews/phase-2d-design.md)) changed the phase in four
   places. 2d-4b is the first step of this phase to touch `src/`.
2. **It is the first step since 2d-4a began that touches `src/`, so the three frontend figures must be
   re-measured**, not carried: `npm run check` **431** files, `npm test` **2125**, `npm run build`
   **184** modules are the pre-4b baseline. A count that moves by the number of new source modules
   **plus one per new styled component** is new source; use the discriminating bundle oracle, never the
   module number alone (`CLAUDE.md` §4).
3. **A component renders a code by calling an accessor, never by building a key** — `codes.ts`'s
   builders make a missing key a compile error in that file, and building a key by hand opts out of the
   only check that catches it.



---

## The 2d-5-1 closure next action, archived 2026-09-04 at Phase 2d-5-2a

**History, never an instruction.** This is the "Next action" `PROGRESS.md` carried while 2d-5-1 was
the live head, moved here the moment 2d-5-2a closed rather than at the size bound — which is what the
live head asked the next session that closed a 2d-5 step to do. Everything it says about 2d-5-1 is
still true; everything it says about *what happens next* was superseded when the orchestrator split
2d-5-2 three ways.

### Phase 2d-5-1 is COMPLETE and CLOSED, tail and all — 2d-5-1 → A → B → C, ended **by rule** at
### round C. The next action is **Phase 2d-5-2 — the exhaustive live registry**.

#### How 2d-5-1 closed, so nobody reopens it

Round C returned **ship, 0 blockers, 0 should-fix, 0 Low**, having derived all four claims of the
comment under review true — three of them by steps the comment's author had not written down. Its fix
round therefore changed **no source file**, `CLAUDE.md` §7.1 commissioned nothing, and §7.2 closed the
step. **The third tail this project has ended by rule**, after 2d-4a's at round 13 (`811d180`) and
2d-4b's at round 8 (`21cbef8`).

**The closure is a fact about a diff, never about thoroughness**, so it discharged no coverage bound:
the items under *"Where it is thin"* in `docs/decisions/2d-5-1-C-notes.md` §6 survive it, and two of
them are 2d-5-2's.

#### What 2d-5-2 is

**The coordinator-owned keyed registry with a register/unregister lease**, and the exact
`OpenWriteSurfaceKind`-keyed binding object in `DetailPane` that makes **omitting a declared kind a
compile error in one file**; `MatchCreator` reports its chosen destination upward.
`docs/decisions/2d-5-split-notes.md` §"2d-5-2 — the exhaustive live registry" is the spec, and the
consult `docs/reviews/phase-2d-5-design.md` binds over it wherever they differ.

**Evidence it owes:** mounted evidence for **all seven** kinds, the creator's unknown-to-known
transition, and restore's unchanged behaviour — **plus a narrow window regression reading, which may
not claim real watcher delivery** (the split's §7 item 7 draws that line). **Components: yes**, but
registry plumbing only: no new watcher UI.

**Two things 2d-5-2 inherits as work, both named below in full.** The `invalidateEverySurface`
coverage gap is the first — this step already owns `DetailPane` and already owes it mounted evidence,
which is why the gap belongs here and not in a round. The five unreachable literals of
`openWriteSurfaces()` are the second: 2d-5-2's window reading is the **first reading of the new
shape**.

**Risk class: high.** It touches components, it introduces a compile-time exhaustiveness mechanism
whose whole value is that it fails loudly in one file, and it owes a window reading — and a green
suite is not a screen.

#### One actionable item 2d-5-2 inherits, and it is not a blocker

**`invalidateEverySurface` (`src/lib/components/DetailPane.svelte:545-563`) is reached by no test**, and
2d-5-1-B's round established that **more strongly than 2d-5-1-A had**. It traced the only call site —
the `invalidate` prop at `DetailPane.svelte:972`, consumed once by `RestorePane.svelte:515` inside the
send path, which that suite's two restore cases never reach — and then **measured it**: in a scratch
copy of `src/` outside the repository, with `creating = false` deleted from `DetailPane.svelte:562`,
the full vitest run came back byte-identical to the unmodified control. So *"breaks nothing"* holds
**repository-wide**, not merely for that one suite.

It is still a **coverage gap and not a correctness defect** — the function is correct as written and
was read against the model at 2d-5-1-A — so `CLAUDE.md` §7.3 does not hold a step open for it.
**2d-5-2 is where it belongs**, because that step already owns `DetailPane` and already owes it
mounted evidence. `2d-5-1-A-notes.md` §5 item 1 and `2d-5-1-B-notes.md` §2 are the record.

#### What the whole of 2d-5-1 shipped, so 2d-5-2 does not re-derive it

`src/lib/browser/restore.ts` holds the widened single `OpenWriteSurface` union (the consult's
declaration, with `WriteSurfaceTarget` and `WriteSurfaceDocumentTarget` named), `competingSurfaceFor`
switching on the target discriminant with a `never` terminus — **still answering `null` for an unknown
creator, which is 2c-5's shipped and window-read behaviour, and untouched by the corrective phase** —
`targetingSurfaceFor` (which prefers an exact document match and falls back to the first eligible
destination-less creator), and `creatorEligibilityOf`, which **delegates** to `destinationEligibility`
in `./matchCreation.ts` rather than restating its five conditions, so the two cannot drift.
`src/lib/browser/conflictSource.ts` is new and holds `ExternalConflictObservation`, the discriminated
`ConflictSource`, two `WeakMap` memos giving one wire value one stable source object, and the
origin-line vocabulary; two keys per language and `tConflictOriginMessage` in `src/lib/i18n/index.ts`
are its user-facing half. `conflictChoicesFor` and `adoptDiskVersion` were not touched and are still
the only choice-list producer and the only confirmed-install door.

**The split's §6-item-1 question is settled: the mechanical edit was taken.** `openWriteSurfaces()` in
`DetailPane.svelte` pushes `{ kind, target: { kind: 'document', document } }` for its six literals, so
2d-5-1 deviated from the consult's *"components: none"*. **No window reading was taken, and the ground
is narrower than it first looked**: that function has exactly one caller, `:966`, inside the
`{:else if restoring !== null}` arm at `:947` of the chain beginning at `:844`, so **five of the six
literals cannot execute at all** — in production or in any test. 2d-5-2's narrow window regression
reading is the first reading of the new shape and inherits those five.

**One property of `targetingSurfaceFor` that 2d-5-2 could make live.** Its first-wins guard
(`restore.ts:623`) is **behaviourally inert today**: only the `matchCreator` arm of `OpenWriteSurface`
carries a `WriteSurfaceTarget` (`:423-435`), so a destination-less surface is always a `matchCreator`
and the variable can only ever hold that one string. The comment there claims only what is true — that
the guard keeps the earlier entry — and was deliberately **not** rewritten to say more, because that
would have touched source and commissioned a fourth corrective phase to correct nothing false. **Give
a second kind a `WriteSurfaceTarget` and the guard stops being inert on its own.**
`2d-5-1-C-notes.md` §3 is the record.

#### The rest of the split, so a step is not invented

**2d-5-2** the exhaustive live-registry composition (components: **yes**, plus a narrow window
regression reading); **2d-5-3** the drain lifecycle coordinator; **2d-5-4** the observation state
transitions; **2d-5-5** external conflicts and save arbitration; **2d-5-6** the file-wide route-guard
closure; **2d-5-7** production activation, the capability widening and the baseline re-measure
(components: **yes**, `AppShell.svelte` only).

The three documents that bind every step, in reading order:
[`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md) (**the consult; it binds**),
[`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) (the record — read its §5
corrections before treating `phase-2d-design.md` step 5 as the spec) and
[`docs/decisions/2d-5-design-brief.md`](docs/decisions/2d-5-design-brief.md) (the brief).

#### The one item 2d-5 still inherits as work

**The drain guard's escaping route, discharged at 2d-5-6 and not before.**
`src/lib/browser/workspace.svelte.ts` imports its command wrappers at module level, so a call made
through one of those bindings rather than through an injected parameter increments the `drains`
counter in nothing. The route is caught in **six** named cases — one `expect(invoked)` assertion in
`DetailPane.test.ts` and five in `RestorePane.test.ts`, each in a distinct `it` block and **in neither
`afterEach`** — while `workspace.test.ts`, whose subject module holds the route, has no
`@tauri-apps/api/core` mock at all. **The closure is owed to all three files.** This is
`2d-4b-notes.md` §14.8 item 1 (re-derived by `2d-5-split-notes.md` §7), which 2d-4b's closure
explicitly did not discharge.

#### Residues that are recorded, not work

None is a correctness defect in source. Named so a later step does not spend a round rediscovering them.

1. **`07744ae`'s commit message states its source diff as `+9 / -8` when `--numstat` gives `11 10`.**
   Permanent — this project does not rewrite pushed history. `2d-4b-notes.md` §14.4 is the correction.
2. **`2d-4b-notes.md` §11.8 claim 3 cites `node_modules/@tauri-apps/api/core.js:202`** — version-pinned,
   untracked, invisible to every gate. Correct today; a dependency bump falsifies it silently.
3. **`workspace.test.ts:468` says "six review rounds"** where three carried the cross-file ranges the
   sentence justifies. Two rounds were told they could take it and **both deliberately left it**.
4. **`scripts/lint/ipc-detail.test.ts` generates its cases from `scannableFiles()`**, so its count moves
   when a file is *added* under the scanned roots and no author touches it. 2d-5-1's own record got its
   +27 breakdown wrong by inferring per-file figures from a total that summed correctly
   (`2d-5-1-notes.md` §5). **Re-derive a test count per file, on a pristine tree, never from the total.**


---

## The 2d-5-2a next action, archived 2026-09-04 at Phase 2d-5-2a-A

**History, never an instruction.** This is what `PROGRESS.md` carried between 2d-5-2a's commit
(`15ada19`) and 2d-5-2a-A's. Its account of the three-way split and of what 2d-5-2a shipped is
still true; its *Next action* — 2d-5-2a-A — is done, and its transcription of round 1's three
findings is the input 2d-5-2a-A answered.

### Phase **2d-5-2 has been split three ways** by the orchestrator, and **2d-5-2a is complete**.
### The next action is **Phase 2d-5-2a-A — the review round 2d-5-2a's three fixes are owed**.

#### The split, and why it was taken

`docs/decisions/2d-5-split-notes.md` and `docs/reviews/phase-2d-5-design.md` both describe 2d-5-2 as
one step. **The orchestrator split it on 2026-09-04**, before any line of it was written, following
this project's own 2c-5-4a/4b precedent — *"the coordinator wiring, with nothing drawn"*, then
*"the screen and the phase's whole mounted evidence"*:

- **2d-5-2a** — the coordinator-owned keyed registry as a value. **Components: none.** ✅ complete.
- **2d-5-2b** — the exact `satisfies Record<OpenWriteSurfaceKind, …>` assembly in `DetailPane`,
  `MatchCreator` reporting its chosen destination upward, and **the phase's whole mounted evidence**:
  all seven kinds, the creator's unknown→known transition, restore's unchanged behaviour, and the
  `invalidateEverySurface` coverage gap. **Components: yes.**
- **2d-5-2c** — the narrow window regression reading, which **may not claim real watcher delivery**
  (`2d-5-split-notes.md` §7 item 7).

**The third piece is a separate step because the instrument no longer exists.** Every prior window
reading ran out of `/private/tmp/espansoconfig-harness-2c-5/`, which 2c-5-7 removed and which is not
on disk today (checked). Rebuilding it was a whole sub-phase twice already (2c-5-5a, 2c-5-5b), so
folding it into a step that also writes components would have made one worker own two unrelated
jobs. **A window reading is still owed and is not discharged**; 2d-5-2c is where.

Nothing about the split changes what 2d-5-2 delivers. The consult still binds; the three steps'
deliverables union to exactly the one step it specified.

#### What 2d-5-2a shipped

`src/lib/browser/writeSurfaceRegistry.ts` — **new, plain TypeScript, no Svelte runes**, which settles
`2d-5-split-notes.md` §6 item 2 (*"the consult does not say where the coordinator lives"*) for this
step: a module beside `workspace.svelte.ts` rather than inside it, because that file is already
3 588 lines and 2d-5-3, 2d-5-4 and 2d-5-5 each add more coordinator machinery to it, and because a
plain-TS registry is model-testable without mounting anything.

It holds one live entry per `OpenWriteSurfaceKind` in a `Map`, and `registerWriteSurface(surface,
transition)` answers the consult's `UnregisterWriteSurface` as a **callable lease** carrying
`replaceTarget(WriteSurfaceDocumentTarget) → 'replaced' | 'staleLease'`. Unregister is idempotent and
**inert once displaced**; `openWriteSurfaces()` snapshots in registration order, and a displacing
registration keeps its predecessor's position; `generation()` moves for all three mutators and for no
no-op; `transitionFor(kind)` is the only reader of the stored transition, **which nothing invokes** —
2d-5-4/2d-5-5 give it a caller. `BrowserState` owns one instance and exposes `registerWriteSurface`,
`openWriteSurfaces()` and `writeSurfaceGeneration()`.

**Two things it deliberately did not do**, both because the caller that would change is a component:
`restoreDocument` was **not** rerouted through the registry, and `open()` does **not** clear it. Both
are 2d-5-2b's. And **no `satisfies Record<OpenWriteSurfaceKind, …>` assembly exists anywhere** — the
consult puts exhaustiveness in the composition file, and the composition file is a component.

The record is [`docs/decisions/2d-5-2a-notes.md`](docs/decisions/2d-5-2a-notes.md); the review is
[`docs/reviews/phase-2d-5-2a.md`](docs/reviews/phase-2d-5-2a.md).

#### What 2d-5-2a-A is, and why it exists

**Round 1 returned `ship-with-fixes`, 0 blockers, 3 SHOULD-FIX (one of them Low). All three are
carried to 2d-5-2a-A rather than fixed inside 2d-5-2a**, so that what was committed is exactly what
was reviewed. 2d-5-2a-A applies them and takes its own review — which is what discharges the round
`CLAUDE.md` §7.1 commissions for a source-changing fix. §7.4 is why it is a phase and not a second
round: the autoclaude workflow caps a phase at its own review budget, that cap outranks §7, and the
debt it leaves is **carried as a corrective phase, never written off**.

**The three findings, in the reviewer's order:**

1. **`writeSurfaceRegistry.ts:245-249` — the generation's doc claims a guarantee the code does not
   give.** It says an unmoved counter means *a set nothing has touched*, but the counter moves only
   for registry operations, and the same file's header (`:51-55`) says surface values are **held by
   reference**. A host mutating its own registered surface's `target` in place therefore changes what
   `openWriteSurfaces()` answers **with the generation unmoved** — and the consult's Q5 guard
   (`phase-2d-5-design.md:157-163`) rests on exactly that unmoved case.
   `docs/decisions/2d-5-2a-notes.md` §3.5 repeats the sentence verbatim, and §7 item 4 records the
   mutation hazard **without connecting it to the guard**. This is this project's **named worst
   defect class**. The preferred fix makes the sentence true rather than weakening it: store a
   normalized copy of the surface (`kind`, then `target.kind`, then `target.document`, read in a
   defined order) so the registry's answer cannot move without the generation moving.
2. **`workspace.svelte.ts:1683` — "the safe one costs nothing" is false.** The same file at `:2269`
   says *"Their identities are reallocated by the load below"*, so a registration surviving `open()`
   names a `DocumentId` that now denotes a **different file**: `competingSurfaceFor` would refuse a
   restore of a file nobody has open, and `targetingSurfaceFor` would attribute it to a surface that
   is not about it. Fail-safe for writes, but **not free** — and neither that comment nor notes §3.8
   names reallocation. **Inert at 2d-5-2a, live at 2d-5-2b**, which is what makes it 2d-5-2a-A's
   rather than a later step's.
3. **(Low) `writeSurfaceRegistry.ts:306-308` — `withTarget` reads `surface.kind` a second time.** The
   accessor test at `writeSurfaceRegistry.test.ts:359` does not exercise it, because the creator path
   short-circuits. An inconsistent accessor yields an entry keyed K whose `surface.kind` is not K,
   making `transitionFor` and `openWriteSurfaces` disagree. The fix is to pass the captured `kind`
   in rather than re-read it — the same discipline finding 1's fix needs.

**Findings 1 and 3 are one discipline seen twice:** never re-read a caller-supplied property after
you have acted on it. Fix them together.

#### What the review did not verify, so 2d-5-2a-A does not assume it did

The reviewer re-ran only `npx vitest run src/lib/browser/writeSurfaceRegistry.test.ts` (22 passed) and
`npm run check` (438 files, 0/0). **`npm test`'s total, `npm run build`'s module count and both
bundle oracles were not re-run inside its budget** — the orchestrator had run all four itself, and
those runs are the record below. `cargo test`, clippy, fmt and `cargo tree` were not re-run by the
reviewer either; no Rust file changed. **And no mounted evidence or window reading exists for this
step by design**, so every claim about a host registering, unregistering on unmount, or reporting a
destination is **unverifiable until 2d-5-2b**.


---

## The Next-action prose of Phases 2d-5-2b and 2d-5-2b-A, archived 2026-09-05 at Phase 2d-5-2b-B

_Superseded by the compact live head in `PROGRESS.md`. Kept whole because its
measurements — the mutation results, the three open questions, the fourth-generation
instance — are cited by `docs/decisions/2d-5-2b-notes.md`._

**One sentence in what follows is known to be wrong and is deliberately not edited here.** It says
`competingSurfaceFor` is called at `restore.ts:1993` and `:2581` *"reached from `RestorePane.svelte`'s
`current` through `restoreView` → `restoreRefusal`"*. That is true of `:1993` and **false of
`:2581`**, which sits in `permitHolds` on the spend path and is not reached through `current` at all.
Phase 2d-5-2b-B found it; `docs/decisions/2d-5-2b-notes.md` §14.2 is the correction, and the live
pointer in `PROGRESS.md` was fixed there. This block is a snapshot and keeps the error it had.

### Phase 2d-5-2b-A is complete: the round §7.1 commissioned for 2d-5-2b's fix has run, and its own fix changed source.
### The next action is **Phase 2d-5-2b-B — the review round §7.1 commissions for 2d-5-2b-A's fix**.

#### Why a round is owed, so nobody has to decide it

2d-5-2b-A's one review ([`docs/reviews/phase-2d-5-2b-A.md`](docs/reviews/phase-2d-5-2b-A.md))
returned `ship-with-fixes`, **0 blockers** and **four SHOULD-FIX** findings, and all four were fixed
in this phase's own commit. That fix round changed **source** —
`src/lib/browser/workspace.svelte.ts` substantively, `src/lib/components/MatchCreator.svelte`
(comment) and `src/lib/components/DetailPane.test.ts` (one new case) — so `CLAUDE.md` §7.1
commissions a round, scoped to that fix. §7.4 carries the debt as a corrective phase rather than
writing it off, exactly as the 2d-5-2a chain did four times: that phase is **2d-5-2b-B**.

**Scope it to the fix, not to the phase.** The four findings and what answered them are
[`docs/decisions/2d-5-2b-notes.md`](docs/decisions/2d-5-2b-notes.md) **§13**.

#### What 2d-5-2b-A changed

**Finding 1 was the substantive one, and it moved the guard off the mirror.**
`writeSurfaceGeneration()` used to *return* the mirror; it now does
`void surfaceGeneration; return writeSurfaces.generation();` — the read is the dependency, the
registry is the answer. **The direction is the whole reason**: returning the mirror would make the
door **under-report** (*"nothing changed"*) if a later method ever moved the registry without
calling `noticeWriteSurfaces()`, while `openWriteSurfaces()` answered the new set in the same
block — and the Q5 guard 2d-5-4 captures across an `await` is exactly the caller that would believe
it. Both doors now read the registry, so *"the two doors cannot report different numbers"* is true
**by construction** rather than by the mirror happening to be in step. **What the mirror still owns
is the invalidation and not the value**, nothing in TypeScript enforces that, and the doc block says
so in the same sentence.

**Finding 2 is why that fix is not free.** Making the door authoritative removed the only oracle the
three `noticeWriteSurfaces()` call sites had: every generation assertion in `DetailPane.test.ts`
used to read the mirror **against itself**, so no test could have failed if mirror and registry
drifted. The replacement is **reactive** — after the fix, the mirror's only externally visible
consequence is that a `$derived` reading `browser.openWriteSurfaces()` re-runs — and one new case
carries it, *shows the restore a surface that was re-targeted onto its file*.

**All three sites were proven by mutation, and the orchestrator re-ran two of the three itself**
rather than accepting the worker's table. Commenting out `replaceTarget`'s `noticeWriteSurfaces()`
fails *shows the restore a surface that was re-targeted onto its file* **alone** (1 failed / 23
passed); commenting out the unregister's fails *shows the restore a surface that opened after its
derived had run* **alone** (1 / 23). The registration site fails two cases. Restored, 24 pass. This
also discharges the *"mutation testing of the three call sites"* item the review listed as
NOT-VERIFIED, which it could not run under its read-only constraint.

**Findings 3 and 4 were two more instances of this chain's recurring defect** — a sentence whose
scope is wider than its code, and they are its **fifth** and **sixth**. `workspace.svelte.ts`'s
*"Nothing calls it yet"* is now *"no caller **in production** captures it yet"*, and
`MatchCreator.svelte`'s *"Nothing reads either answer in production"* now says that
`competingSurfaceFor` **is** read in production and that `targetingSurfaceFor` is the one that is
not. **Both replacements were re-derived by the orchestrator against the code rather than
accepted**: `writeSurfaceGeneration` has **five** call sites across **three** cases and **zero** in
production; `competingSurfaceFor` is called at `restore.ts:1993` and `:2581`, reached from
`RestorePane.svelte`'s `current` through `restoreView` → `restoreRefusal`; and
`targetingSurfaceFor`, outside its own definition, appears **only in comments**.

**The review's own count was wrong and the fix did not copy it.** It said `DetailPane.test.ts` calls
that door *"four times"*; it is **five, across three cases**. The corrected comment pins no number
at all. That is this chain's discipline working in the direction it usually fails — a figure
re-derived instead of inherited.

**The sharpest thing for 2d-5-2b-B to attack**: **all three reactive cases observe one consumer.**
`RestorePane.svelte`'s `$derived.by` drawing a refusal sentence is the only reactive reader of this
door in the application, so *"the mirror moved"* and *"the restore's refusal redrew"* are
**indistinguishable in this suite** (`2d-5-2b-notes.md` §13.5 item 2) — every one of the three
mutations above is caught through that single path. Also worth the budget: §13.5 item 1 — the mirror
is **still** kept by hand, now narrower (an unmirrored fourth path loses the invalidation, not the
value) — and note that the check named there, `rg -n 'writeSurfaces\.' src/lib/browser/workspace.svelte.ts`,
**does not show the two mutations the lease performs**, so the check is weaker than the item it
serves.

#### Where 2d-5-2 stands

`docs/decisions/2d-5-split-notes.md` and `docs/reviews/phase-2d-5-design.md` both describe 2d-5-2 as
one step. **The orchestrator split it three ways on 2026-09-04**, before any line of it was written,
following this project's own 2c-5-4a/4b precedent — *"the coordinator wiring, with nothing drawn"*,
then *"the screen and the phase's whole mounted evidence"*:

- **2d-5-2a** — the coordinator-owned keyed registry as a value. **Components: none.** ✅ **complete
  and CLOSED** (`15ada19`, `9f32cc5`, `52ff829`, and 2d-5-2a-C's commit below), after a four-phase
  review tail that ended **by rule**.
- **2d-5-2b** — the exact `satisfies Record<OpenWriteSurfaceKind, …>` assembly in `DetailPane`,
  `MatchCreator` reporting its chosen destination upward, and **the phase's whole mounted evidence**:
  all seven kinds, the creator's unknown→known transition, restore's unchanged behaviour, and the
  `invalidateEverySurface` coverage gap. **Components: yes.** ✅ **implemented, reviewed and
  committed**. Its fix round commissioned **2d-5-2b-A**, which is ✅ **complete** — one review,
  `ship-with-fixes`, 0 blockers, four SHOULD-FIX all fixed — and whose own fix round changed source,
  so **2d-5-2b-B is owed**. See the top of this section.
- **2d-5-2c** — the narrow window regression reading, which **may not claim real watcher delivery**
  (`2d-5-split-notes.md` §7 item 7). ⬜️ not started. **It is a separate step because the instrument
  no longer exists**: every prior reading ran out of `/private/tmp/espansoconfig-harness-2c-5/`,
  which 2c-5-7 removed and which is not on disk today (checked at 2d-5-2a). Rebuilding it was a whole
  sub-phase twice already (2c-5-5a, 2c-5-5b). **A window reading is still owed and is not
  discharged.**

Nothing about the split changes what 2d-5-2 delivers. The consult still binds; the three steps'
deliverables union to exactly the one step it specified.
#### What `writeSurfaceRegistry.ts` is now, after all four phases

`src/lib/browser/writeSurfaceRegistry.ts` is **plain TypeScript, no Svelte runes**, beside
`workspace.svelte.ts` rather than inside it — which settles `2d-5-split-notes.md` §6 item 2
(*"the consult does not say where the coordinator lives"*) for this step, because that file is
already 3 588 lines and 2d-5-3, 2d-5-4 and 2d-5-5 each add more coordinator machinery to it.

It holds one live entry per `OpenWriteSurfaceKind` in a `Map`. `registerWriteSurface(surface,
transition)` answers the consult's `UnregisterWriteSurface` as a **callable lease** carrying
`replaceTarget(WriteSurfaceDocumentTarget) → 'replaced' | 'staleLease'`. Unregister is idempotent and
**inert once displaced**; `openWriteSurfaces()` snapshots in registration order and a displacing
registration keeps its predecessor's position; `generation()` moves for all three mutators and for no
no-op; `transitionFor(kind)` is the only reader of the stored transition, **which nothing invokes** —
2d-5-4/2d-5-5 give it a caller. `BrowserState` owns one instance and exposes `registerWriteSurface`,
`openWriteSurfaces()` and `writeSurfaceGeneration()`.

**2d-5-2a-A changed how a surface is stored, and that is the substantive change of the pair.** The
registry now reads the caller's object once per property in a stated order — `kind`, then `target`,
then `target.kind`, then `target.document` — **all before the serial is taken**, and stores a copy it
builds itself, **frozen at both levels** because `Object.freeze` is shallow. So a host that retains
its registered surface and mutates it cannot change what `openWriteSurfaces()` answers, which is what
makes the generation's documented guarantee **true rather than weakened** — the fix the review asked
for. `withTarget` is gone; `replaceTarget` builds through `ownedDocumentSurface(kind, …)` with the
**captured** kind.

**An unrepresentable pairing throws a `TypeError`** — a non-`matchCreator` kind read together with
`target.kind === 'unknown'`, or a discriminant that is neither arm. The throw happens before the
serial is taken. The argument is that reaching it takes a caller who defeated the compiler, and that
inventing a document, storing an unnarrowable value, or dropping the registration silently are each
worse — the last being fail-**unsafe**, since an invisible surface is the answer that permits a
silent reload. **This was the worker's judgement call, not the review's**, and
`2d-5-2a-A-notes.md` §2.4 argues it.

**Two things both phases deliberately did not do**, because the caller that would change is a
component: `restoreDocument` is **not** rerouted through the registry, and `open()` does **not** clear
it. Both are 2d-5-2b's. And **no `satisfies Record<OpenWriteSurfaceKind, …>` assembly exists
anywhere** — the consult puts exhaustiveness in the composition file, and the composition file is a
component.

#### The three open questions 2d-5-2b answered, so a later step does not re-ask them

1. **The frozen surface is safe under Svelte 5.** 2d-5-2a-A made every stored surface a copy the
   registry freezes at both levels, and no component had ever consumed it. Probed under `$state.raw`,
   a proxied `$state`, `$derived`, `$state.snapshot` and array spread: all safe. A cast-away write
   throws `TypeError: Cannot assign to read only property 'kind'` **from the frozen target, not from
   Svelte**, leaving the registry unchanged. **No source finding against `writeSurfaceRegistry.ts`.**
2. **`open()` still does not clear the registry**, and now on evidence rather than on the argument
   2d-5-2a-A's correction block left standing. A registration really does survive an `open()` when its
   host does (a permanent test); `open()` has exactly two production callers, both in
   `AppShell.svelte`, neither reachable with a surface open; and `open()` sets `status = 'loading'`
   synchronously, so `AppShell`'s guard unmounts the pane and the leases come back at the next flush.
   Clearing would be the **unsafe** direction, since an invisible surface is what permits a silent
   reload. **What is thin here is named**: the last link was measured with a throwaway component
   reproducing the guard's shape rather than with `AppShell` itself, and `2d-5-2b-notes.md` §11 item 5
   marks it *actionable* for whichever step mounts `AppShell` (2d-5-7 touches it).
3. **The mount-path `TypeError` is unreachable *by construction* from this pane**, which is what makes
   R32's blank-pane hazard falsifiable at last: every surface comes from compiler-checked object
   literals with no cast and no assertion, and all seven sources are `$state.raw` or a boolean, so no
   proxy and no accessor can run inside the registry's property reads. **It is not unreachable in
   general** — a caller that takes a kind and a target apart and reconciles them with a cast still
   reaches it, which is the caller the registry's own `@throws` describes.

#### What review 4 did not verify, so 2d-5-2b does not assume it did

Review 4 re-derived the chain's one source change against `git show 15ada19:…` and confirmed both its
cases, and it hunted the chain's recurring shape and **found a fourth instance** (below). It did
**not** re-run the four gates or either bundle oracle — the diff was comment-only and the
orchestrator's own runs are the record below — and it did not reproduce the out-of-repo harness the
behaviour tables rest on.

**It also raised, and did not settle, whether `docs/reviews/phase-2d-5-2a-B.md:17,34` are stale.**
They cite `:555-557`, which 2d-5-2a-C's `+8` lines moved. **The orchestrator's ruling: they are not
stale and must not be "fixed".** A review file records what a reviewer said about the tree as it stood
at `5ec011e`; rewriting its citations to match a later tree would falsify the record rather than
correct it. **The live pointers were updated instead** — this file now cites `:555-568`. The rule
generalizes: **a citation in a review file is a historical snapshot; a citation in `PROGRESS.md` or in
a notes file's live prose is a pointer and is maintained.**

#### The fourth-generation instance, and why the chain closed rather than blocking

**This is the most useful thing the chain measured, so it is kept in the live head.** Before review 4
ran, this file recorded that a **fourth** instance of the chain's recurring defect would mean
`BLOCKED` work under §7.2 rather than a round to keep spending. Review 4 found one:
`2d-5-2a-C-notes.md:271` said *"the shipped module has no `kind` route at all"*, which is false —
`registerWriteSurface` reads `surface.kind` at `writeSurfaceRegistry.ts:503`. **It sat inside the
record written to fix the third instance.**

**It did not block, and the reasoning is on the record because the letter of the warning was met.**
`CLAUDE.md` §7.3 reserves blocking for an **actionable item naming a correctness defect in a source
file**; this instance is in a record. Review 4 verified the chain's one source change as correct. And
the fix was prose, so §7.1 commissioned nothing and the tail **terminated** — which is exactly what
the warning was written to detect the absence of. **The clause fired in letter and not in effect.**

**What a later phase should take from this, since the shape has now survived four attempts to kill
it:** it is not fixed by care, and it is not fixed by being told about it — 2d-5-2a-C was briefed on
this exact hazard, in these exact words, and still produced an instance. What *did* catch it every
time was **a reader re-deriving a sentence's scope against the code**, and what never caught it was
re-reading the sentence. Treat *"true of the module?"* as a question to be answered against a file,
never as a stylistic preference.
#### What became of the two items 2d-5-2b inherited

1. **`invalidateEverySurface` is now executed by a test, and its *effect* is still unobservable.**
   The body runs — the coverage gap 2d-5-1-B measured is closed in that narrow sense — but what it
   closes cannot be seen from this pane while `busy` keeps the seven surfaces mutually exclusive.
   **2d-5-1-B's measurement is not superseded** and must not be read as if it were: deleting a line
   from that function still breaks no test in this repository. It stays a coverage bound rather than a
   correctness defect, so §7.3 holds no step open for it. `2d-5-2b-notes.md` §9.1 and §11 item 6 are
   the record; `2d-5-1-A-notes.md` §5 item 1 and `2d-5-1-B-notes.md` §2 are the older one.
   The function also now ends in `stopCreating()` rather than a bare `creating = false`, so the
   creator's reported destination cannot outlive the form.
2. **The five unexecutable literals are gone, because the producer is gone.** 2d-5-1-C's measurement
   said five of `openWriteSurfaces()`'s six entries could not execute at all — its one caller sat
   inside the `{:else if restoring !== null}` arm, so `busy` had already made the other five null.
   2d-5-2b **deleted that producer**; the assembly that replaced it is conditioned on no arm, so all
   seven of its entries are live. What `busy` still means is that **at most one is non-null at a
   time**, so the registry holds at most one entry from this pane and its documented array order
   decides nothing here — which is `2d-5-2b-notes.md` §11 item 2, *recorded only*: the multi-surface
   behaviour of both predicates is driven by model tests over hand-built arrays and by no mounted case
   at all.

#### One property of `targetingSurfaceFor` a later step could make live

Its first-wins guard (`restore.ts:623`) is **behaviourally inert today**: only the `matchCreator` arm
of `OpenWriteSurface` carries a `WriteSurfaceTarget`, so a destination-less surface is always a
`matchCreator` and the variable can only ever hold that one string. The comment there claims only
what is true and was deliberately **not** rewritten to say more. **Give a second kind a
`WriteSurfaceTarget` and the guard stops being inert on its own.** `2d-5-1-C-notes.md` §3 is the
record.

#### The rest of the split, so a step is not invented

**2d-5-3** the drain lifecycle coordinator; **2d-5-4** the observation state transitions; **2d-5-5**
external conflicts and save arbitration; **2d-5-6** the file-wide route-guard closure; **2d-5-7**
production activation, the capability widening and the baseline re-measure (components: **yes**,
`AppShell.svelte` only).

The three documents that bind every step, in reading order:
[`docs/reviews/phase-2d-5-design.md`](docs/reviews/phase-2d-5-design.md) (**the consult; it binds**),
[`docs/decisions/2d-5-split-notes.md`](docs/decisions/2d-5-split-notes.md) (the record — read its §5
corrections before treating `phase-2d-design.md` step 5 as the spec) and
[`docs/decisions/2d-5-design-brief.md`](docs/decisions/2d-5-design-brief.md) (the brief).

#### The one item 2d-5 still inherits as work

**The drain guard's escaping route, discharged at 2d-5-6 and not before.**
`src/lib/browser/workspace.svelte.ts` imports its command wrappers at module level, so a call made
through one of those bindings rather than through an injected parameter increments the `drains`
counter in nothing. The route is caught in **six** named cases — one `expect(invoked)` assertion in
`DetailPane.test.ts` and five in `RestorePane.test.ts`, each in a distinct `it` block and **in neither
`afterEach`** — while `workspace.test.ts`, whose subject module holds the route, has no
`@tauri-apps/api/core` mock at all. **The closure is owed to all three files.** This is
`2d-4b-notes.md` §14.8 item 1 (re-derived by `2d-5-split-notes.md` §7), which 2d-4b's closure
explicitly did not discharge.

#### Residues that are recorded, not work

None is a correctness defect in source. Named so a later step does not spend a round rediscovering them.

1. **Three 2d-4b residues — a commit message's own diff figure, a `node_modules` line citation and a
   "six review rounds" count in `workspace.test.ts:468` — are in
   [`docs/progress-archive/phase-2d.md`](docs/progress-archive/phase-2d.md).** Archived at 2d-5-2a; no
   2d-5 step reads any of them, and all three are still true.
2. **`scripts/lint/ipc-detail.test.ts` generates its cases from `scannableFiles()`**, so its count moves
   when a file is *added* under the scanned roots and no author touches it. 2d-5-2a moved it by **+2**
   without an author touching it, which is the fourth recorded instance. **Re-derive a test count per
   file, on a pristine tree, never from the total.**
3. **`docs/decisions/2d-5-2a-notes.md` §7 has seven items, six *recorded only* and one *actionable*.**
   The actionable one — that `DetailPane`'s own array and the registry answer one question and will
   disagree until 2d-5-2b routes the pane — **names no correctness defect in source**, so §7.3 does
   not hold the step open for it. It is 2d-5-2b's acceptance criterion.


---

## The Next-action prose of Phase 2d-5-2b-B, archived 2026-09-05 at Phase 2d-5-2b-C

Verbatim as the live head carried it while 2d-5-2b-C was the owed round. It is superseded on three
points, all corrected by 2d-5-2b-C and recorded in `docs/decisions/2d-5-2b-notes.md` §15:

- the claim that `restore.ts:2581` is **the** read that decides whether the restore is written —
  `:1993` decides it too, through `canPrepareRestore` → `confirmRestore`;
- the claim that `:2581` "is not reached through `current` at all" — the *call* is not, but the
  surface list it judges is `current`'s;
- the two-audience split naming only `$derived`, which puts an `$effect` in the wrong arm.


### Phase 2d-5-2b-B is complete: the round §7.1 commissioned for 2d-5-2b-A's fix has run, and its own fix changed source.
### The next action is **Phase 2d-5-2b-C — the review round §7.1 commissions for 2d-5-2b-B's fix**.

#### Why a round is owed, so nobody has to decide it

2d-5-2b-B's one review ([`docs/reviews/phase-2d-5-2b-B.md`](docs/reviews/phase-2d-5-2b-B.md))
returned `ship-with-fixes`, **0 blockers** and **three SHOULD-FIX** findings (one a Low with two
parts), and all three were fixed in this phase's own commit. That fix round changed **three source
files** — `src/lib/browser/workspace.svelte.ts`, `src/lib/components/MatchCreator.svelte` and
`src/lib/components/DetailPane.test.ts` — so `CLAUDE.md` §7.1 commissions a round, scoped to that
fix. Every change but one is a comment, and **the unit is the file**, so the size of the diff decides
nothing. §7.4 carries the debt as a corrective phase rather than writing it off: that phase is
**2d-5-2b-C**.

**Scope it to the fix, not to the phase.** The three findings and what answered them are
[`docs/decisions/2d-5-2b-notes.md`](docs/decisions/2d-5-2b-notes.md) **§14**.

#### What 2d-5-2b-B changed, and the one thing it measured that was not asked for

**Findings 1 and 2 are the recurring defect's seventh and eighth instances** — *a sentence whose
scope is wider than its code*. Finding 1's sits **inside the sentence written to fix the sixth**,
which is the same shape as the fourth instance (one inside the correction block that closed the
third). The class has now survived six attempts to kill it. What caught it again is what has caught
every one: **re-deriving a sentence's scope against the code**, never re-reading the sentence.

- **Finding 1** — `MatchCreator.svelte` said `competingSurfaceFor` is read in production *"by
  `RestorePane.svelte`'s `current` on every open restore"*. There are **two** production readers:
  `restore.ts:1993` in `restoreRefusal`, which `current` reaches, and `restore.ts:2581` in
  `permitHolds`, called by `sendRestore` at `:2663` — and **the second is the read that decides
  whether the restore is written**, reached not through `current` at all. Nor is it *every* open
  restore: `restoreRefusal` returns one of **six** earlier reasons first (`restore.ts:1975-1992`), so
  an open restore with no candidate never reaches the call. **Both figures were counted off the file
  by the orchestrator, not taken from the review.**
- **Finding 2** — two sites in `workspace.svelte.ts` said a future unmirrored path would cost *"the
  invalidation and not the value"*. **That is true only of a caller that calls.** A `$derived` over
  either door memoizes, so with no invalidation it keeps rendering its cached number until some
  *other* dependency moves — a **stale screen**, for the exact audience the mirror exists for. Both
  sentences now name the two audiences separately.
- **Finding 3 (Low)** — the new `DetailPane.test.ts` case's first half is a **negative control**, not
  an oracle: its `not.toContain` held before the registration too, so it passes whether or not the
  mirror moved. The comment said *"what makes the two halves different"* and invited the stronger
  reading; it now says the evidence starts below the `replaceTarget`. The manually taken lease is
  also now released before `pane.stop()`, as its sibling case does.

**The orchestrator settled the review's own NOT-VERIFIED item by measuring it.** Whether the Svelte
compiler emits a *tracked* read for `void surfaceGeneration` in a `.svelte.ts` module was believed by
analogy with `openWriteSurfaces()`. Compiled through `svelte/compiler`'s `compileModule` (v5.56.8,
client), `void surfaceGeneration` becomes **`void $.get(surfaceGeneration)`** — `$.get` is the
tracked read, so the statement **is** a subscription. Settled favourably.

**That probe found a hazard nobody had recorded, and it is the sharpest thing for 2d-5-2b-C to
weigh.** With **no writer** to `surfaceGeneration` the same compiler emits a plain `let … = 0` and
**optimises the signal away entirely** — the read is then tracked by nothing. So this door's
reactivity is contingent on `noticeWriteSurfaces()` continuing to *assign*, and a change that removed
every write would make both doors silently non-reactive with no type error, no failing test and no
visible difference in either door's source. It is a **second** failure mechanism for the hand-kept
mirror, independent of item 9's *"a fourth path forgets to mirror"*, and it is `2d-5-2b-notes.md`
§14.6 item 1, *recorded only* — no source is wrong today, because three sites assign.

**Also worth the budget**: §14.6 item 3 — **all three reactive cases still observe one consumer**.
`RestorePane.svelte`'s `$derived.by` is still the only reactive reader of this door in the
application, so *"the mirror moved"* and *"the restore's refusal redrew"* remain indistinguishable in
this suite. This round narrowed what the cases **claim**; it did not widen what they **observe**.

**One live pointer in this file was wrong and is fixed here.** It said `competingSurfaceFor` is
called at `restore.ts:1993` and `:2581` *"reached from `RestorePane.svelte`'s `current` through
`restoreView` → `restoreRefusal`"* — true of the first, false of the second. `92fe0f4`'s commit
message carries the identical mis-attribution and is **left as written**: a commit message is a
historical snapshot, and only live pointers are maintained.

