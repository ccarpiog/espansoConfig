# Phase 2d-3 — the write ledger and the admission gate: review

Every round of this step review, verbatim, newest last. Rounds are static: the Codex
sandbox blocks FSEvents delivery, so the delivery-dependent tests are never run there
and host-measured evidence is supplied in each brief instead (the precedent is the 2d-2
review, whose round-1 High was sandbox-confounded).

---

## Round 1 — NOT READY (2 High, 1 Medium)

Brief: the whole uncommitted change (`git diff` plus `src-tauri/src/ledger.rs` and
`docs/decisions/2d-3-notes.md`), attacked on concurrency and lifetime, check-and-spend
shape, the Q2 predicate, 2d-4 scope creep, the `watch_check` seam move, and the record
against the code.

Host-measured evidence supplied: `cargo test --workspace` 1242/0; focused serial
`watch_check::` 20/20; clippy `-D warnings` clean; `cargo fmt --check` clean;
`cargo tree -p espansoconfig-core | rg tauri` empty; `npm run check` 431/0/0,
`npm test` 2125, `npm run build` 184 — frontend untouched.

### Verbatim reply

## High

- [commands.rs:1408](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:1408), [ledger.rs:297](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:297) — Committing and recording are not atomic with watcher admission. `save_document` performs the rename before returning, while the watcher can independently enter `WriteLedger::admit`; the session lock does not serialize the worker. Interleaving: save renames revision A → save thread is descheduled before line 1415 → watcher stabilizes on A and finds no record → A is admitted as external → save resumes and records A. The promised self-write suppression has already failed. A related interleaving can admit external B before the delayed A record, leaving a stale A record afterward. Minimal fix: add a shared commit/admission serialization protocol covering `save_document` through committed-outcome recording—either a gate held by saves and admissions or a pending-save state that defers observations until finalized. Keep downstream callbacks outside all guards. Add a deterministic barrier-based concurrency test. The headline claim in [2d-3-notes.md:3](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3) is therefore not currently guaranteed.

- [ledger.rs:280](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:280), [ledger.rs:424](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:424) — A committed save does not invalidate the path’s prior published state, and duplicate coalescing returns before clearing the app-write entry. Scenario: external revision B was previously admitted, so `published[path] = B` → the app commits A and records A, leaving published B → its A hints are suppressed → an external writer replaces A with B → the gate calls this a duplicate and retains the A record → the post-commit external replacement is never reported; a later external change B→A is also wrongly suppressed using that stale record. This directly defeats Q2 and the claimed post-commit replacement proof in [2d-3-notes.md:310](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:310). Minimal fix: atomically invalidate the path’s published-state entry when recording a committed app write, then add the regression sequence `publish B → record A → observe B → observe A`, requiring both later transitions to be admitted and the record cleared.

## Medium

- [watch_check.rs:122](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/watch_check.rs:122), [watch_check.rs:430](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/watch_check.rs:430), [ledger.rs:299](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:299) — Moving all 2d-2 tests behind the admission gate weakens the successful-reopen lifecycle test. `open` adopts the new epoch before shutting down the old watcher, so any leaked epoch-1 observation is discarded by the gate and can never reach the channel checked at lines 473–477. Interleaving: reopen installs epoch 2 → a regression fails to cancel/join epoch 1 → the old watcher observes the subsequent old-tree write → `admit` returns `StaleEpoch` → the test passes despite the worker leak it says it catches. Minimal fix: capture the old watcher’s existing `JoinProbe` before reopening and assert it is complete when ordinary `open` returns, or retain a test-only raw pre-admission tap for lifecycle tests. Keep the two new suppression tests behind the production gate.

No watcher or Cargo tests were run; these findings are static.

**NOT READY**

Codex session ID: 01a037dc-ef41-7a22-aaaa-9fc4dd65610e
Resume in Codex: codex resume 01a037dc-ef41-7a22-aaaa-9fc4dd65610e

---

## Round 2 — NOT READY (1 High)

Scoped to the fix round, not the whole step. The finding is the **narrower survivor** of round 1's
High 1, and it overturns the residue the fix round had recorded as unavoidable
(`2d-3-notes.md` section 5 item 10). Everything else the fix round changed — the published-state
invalidation, the early-return ordering, the coalescing-unreachability argument and the strengthened
reopen probe — was inspected and found sound.

Host-measured evidence supplied: `cargo test --workspace` 1245/0 (+3 over round 1); focused serial
`watch_check::` 20/20; clippy `-D warnings` clean; `cargo fmt --check` clean;
`cargo tree -p espansoconfig-core | rg tauri` empty; frontend untouched, so 431 / 2125 / 184 stand.

### Verbatim reply

## High

- [ledger.rs:457](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:457), [ledger.rs:731](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:731), [2d-3-notes.md:3](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3) — The commit gate is acquired only after the engine has stabilized an observation, so a narrower instance of round 1’s atomicity defect survives. Interleaving: disk contains P → the engine completes both reads and constructs observation P → before `admitting_sink` calls `admit`, the save acquires the gate, commits A, records A, and releases it → P enters the gate, declines suppression, clears A’s record, and publishes P → the save-generated observation of A later finds no record and is admitted as foreign. The code therefore still permits exactly what the headline says cannot happen. Section 5 item 10 describes the race honestly but incorrectly calls it unavoidable and “over-reporting only”; it can be closed without inferring chronology from hashes by synchronizing the stabilization window or explicitly tracking commit generations. Minimal fix: acquire an observation-side gate before the first stabilizing read and hold it through `decide`—releasing it before downstream—or tag stabilization with a commit generation and restart/discard the observation if a commit intervened. Add the deterministic sequence `stabilize P → commit/record A → decide P → observe A`, requiring A to remain suppressible.

The published-state invalidation, early-return ordering, coalescing-unreachability argument, and strengthened reopen probe are otherwise sound on static inspection. No tests were run.

**NOT READY**

Codex session ID: 01a0380c-5336-7f13-9917-5a6127afe648
Resume in Codex: codex resume 01a0380c-5336-7f13-9917-5a6127afe648

---

## Round 3 — NOT READY (2 High)

Scoped to round 2's fix. Finding 1 is the concern the brief raised as its first item and it is
**confirmed**: over-refusal is not a safe direction, because the engine settles before the ledger
decides. Finding 2 is a soundness boundary in the new chronology proof. The round also **cleared**
the removed test (its valid coverage is retained by two other tests), and found no coverage
regression, no construction-site omission, no wire-boundary violation, no lock-order regression and
no behaviour change from the merged lookup.

Host-measured evidence supplied: `cargo test --workspace` 1246/0; focused serial `watch_check::`
20/20; clippy `-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p espansoconfig-core |
rg tauri` empty; no `crates/` and no `src/` path changed.

### Verbatim reply

High

- [ledger.rs:831](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:831), [engine.rs:614](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/watch/engine.rs:614), [engine.rs:777](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/watch/engine.rs:777), [2d-3-notes.md:551](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:551) — `PrecedesACommit` can permanently swallow a genuine external change. `ObservationEngine::tick` installs the stabilized state into `tracked` before returning it to the ledger. If the ledger then refuses that observation, a later re-hint commonly stabilizes to the already-tracked state and the engine emits nothing. Concrete scenario: external P stabilizes and `tick` updates `tracked` to P → the app commits A and records it before admission → P returns `PrecedesACommit` → the app’s A hints produce A, which is suppressed, but P is never published. There is an even sharper over-refusal case: first read P → app commits/records A between the next pass’s stamp and read → an external writer restores P before that read → the second P settles and updates `tracked`, but is refused because its stamp precedes the record → the already-queued A/P hints re-read P and coalesce inside the engine. Native delivery can therefore be perfect and P is still lost. The claims that re-hinting “produce[s] a fresh observation” and makes the direction safe are false; this is not merely inherited native-delivery residue. Minimal fix: serialize the final settling `tick` with ledger decision—acquire the observation-side commit gate immediately before the pass’s asserting read and hold it through all ledger decisions, releasing it before downstream callbacks—or make settlement provisional and roll it back/requeue it when admission refuses. Add an engine-plus-ledger regression proving that a refused stabilized state cannot disappear after subsequent hints.

- [ledger.rs:831](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:831), [ledger.rs:110](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:110), [2d-3-notes.md:945](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:945) — The stated `Instant` implication is not fully sound. `Instant` is monotonic across threads, but not guaranteed strictly increasing: two ordered calls may return equal values. Thus `read_after >= recorded_at` does not prove the read followed the record when the values are equal. In a clock-resolution collision, an observation stamped before the commit passes the chronology check, can clear the new record, and restores round 2’s exact self-write-as-foreign failure. Minimal fix: refuse when `read_after <= recorded_at`, and rewrite the proof around the accepted condition `read_after > recorded_at`.

The removed test did encode round 2’s defect as a requirement. Its valid coverage—gate serialization and post-commit supersession—is retained by the replacement test, `no_admission_can_decide_between_a_commit_and_its_record`, and `a_different_revision_is_admitted_and_supersedes_the_record`. I found no separate coverage regression, construction-site omission, wire-boundary violation, lock-order regression, or behavior change from the merged lookup.

Static review only; watcher behavior remains unverified in this sandbox as required.

**NOT READY**

Codex session ID: 01a0383e-28af-7092-8e7b-5161c04c263b
Resume in Codex: codex resume 01a0383e-28af-7092-8e7b-5161c04c263b

---

## Round 4 — NOT READY (1 High, 1 Low)

Scoped to round 3's fix. The High is the **fourth consecutive narrower instance**, and this time it
lives in the hole the round-3 fix round wrote down as honestly bounded: `2d-3-notes.md` §5 item 16
said a clock-collision refusal on the save path "costs one *publication*" and that the external
replacement "is reported by the watcher's own hints instead". Round 4 shows the second half is false
— 2d-2's own record retains the possibility of a missed native hint — so the cost is a **lost
external observation**, not a lost publication. The Low is a doc-comment guarantee the code does not
give. Everything else the round-3 fix built was inspected and cleared: the one-pass `undo` lifetime,
rescan ordering, exclusive engine ownership, the exhaustive sink answer, the strict `Instant` proof,
the lock order, post-guard rollback, no weakened test, and no 2d-4 scope creep.

Host-measured evidence supplied: `cargo test --workspace` 1249/0; focused serial `watch_check::`
20/20 (68 s); clippy `-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p
espansoconfig-core | rg tauri` empty; frontend untouched, so 431 / 2125 / 184 stand.

### Verbatim reply

## High

- [commands.rs:2259](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2259), [commands.rs:2293](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2293), [ledger.rs:706](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:706), [ledger.rs:919](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:919), [2d-3-notes.md:636](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:636) — A clock-equality refusal can permanently lose the differing post-save external observation because `admit_at_current_epoch` has neither an engine settlement to revert nor an independent retry. Concrete scenario: the app commits A and records it at instant T → an external process writes B before `after_a_save` refreshes → line 2268’s `Instant::now()` also returns T → the refresh installs B in the cache → `decide` returns `PrecedesACommit`, retaining A’s record and publishing nothing → the healthy native backend silently misses B’s hint, a possibility explicitly retained by [2d-2-notes.md:204](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-2-notes.md:204) → B never enters the phase-2d observation sequence or future queue. This violates the design requirement that a differing post-save refresh be queued as external ([phase-2d-design.md:32](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2d-design.md:32)) and falsifies both the headline’s “no external change is lost” claim ([2d-3-notes.md:3](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3)) and item 16’s sentence that the replacement “is reported by the watcher’s own hints.” Minimal fix: give the session-locked refresh entry point a caller-proven chronology mode that skips `PrecedesACommit`; any existing record necessarily predates these reads because saves and refreshes are serialized by the session lock. Keep suppression, supersession, coalescing, and sequence allocation shared with `decide`, and add a deterministic equality regression for `after_a_save`.

## Medium

None.

## Low

- [engine.rs:749](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/watch/engine.rs:749), [engine.rs:774](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/watch/engine.rs:774), [2d-3-notes.md:1332](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:1332), [2d-3-notes.md:1470](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:1470) — The documentation claims rollback produces “the same observation again,” although the implementation deliberately re-reads and can produce a different current state. Concrete scenario: P settles and is refused → `revert_settlement` restores base B and re-hints → another process writes Q before the two retry reads → the engine correctly emits `Changed { B → Q }`, not the refused `Changed { B → P }`. The method’s later paragraph accurately says it reports whatever the file holds then, contradicting the earlier guarantee and §9.1/§9.5’s unqualified evidence claim. Minimal fix: qualify “same observation” with “if the disk remains unchanged”; otherwise promise only a fresh observation of the state that stabilizes during the retry.

The one-pass undo lifetime, rescan ordering, exclusive engine ownership, exhaustive sink answer, strict `Instant` proof, lock order, and post-guard rollback are sound on static inspection. No test capability appears weakened by the round’s changes. I found no 2d-4 command, event, queue, wire, or frontend scope creep; the core changes remain Tauri-independent.

No tests were run; these findings are static.

**NOT READY**

Codex session ID: 01a03894-97bc-72a2-ae35-3096fd2e06ba
Resume in Codex: codex resume 01a03894-97bc-72a2-ae35-3096fd2e06ba

---

## Round 5 — NOT READY (1 High, 2 Low)

Scoped to round 4's fix. **Five rounds, five narrower instances.** Two things this round settled in
the fix's favour before finding anything: the chronology premise was **re-derived independently and
holds** — the production call graph does serialize saves and refreshes, `conflict_after_the_lock`
included — and `ReadChronology` is genuinely private with no production caller able to select a
variant. Lock order, leaf mutexes, Tauri-freedom and the absence of 2d-4 scope creep were all
confirmed.

The High is **§5 item 18 judged quietly optimistic**, which is the third time a hole this record
stated as honestly bounded turned out to be a real defect (item 10 at round 2, item 16 at round 4,
item 18 now). It is round 4's exposure reached through `Err` rather than through `PrecedesACommit`,
and the round-4 fix round's stated reason for leaving it open — that the only alternative was
publishing a single unstabilized read — is rejected: the existing engine can be asked to re-observe
the path instead. The two Lows are both **name-position misses by the round-4 fix round's own
sweep**: documentation that still describes save-path stamping that no longer happens and a "three
things" count that is now four, and a test named for a premise it does not exercise.

Host-measured evidence supplied: `cargo test --workspace` 1251/0; focused serial `watch_check::`
20/20 (62 s); clippy `-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p
espansoconfig-core | rg tauri` empty; 7 files changed, no `src/` path and no frontend file, so
431 / 2125 / 184 stand.

### Verbatim reply

## High

- [commands.rs:2283](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2283), [commands.rs:2296](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2296), [commands.rs:2318](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2318), [2d-3-notes.md:706](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:706), [2d-3-notes.md:1804](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:1804) — A failed post-save refresh is the same lost-observation defect as round 4 on an error path; the record’s claim that closing it “would be worse” presents immediate single-read publication as the only alternative, but the existing engine can instead be explicitly asked to stabilize the path without clearing the record first. Concrete scenario: the app commits revision A and records it → an external process removes the file before `after_a_save` reads it → `Workspace::refresh` returns `NotFound` → `after_a_save` evicts the cache, admits nothing, and returns `Saved` → the healthy-looking native backend silently misses the removal hint, as §2.3 expressly permits → the persistent removal never enters the observation sequence. This is the same exposure round 4 classified High, merely reached through `Err` rather than `PrecedesACommit`, and it contradicts the headline’s “no external change is lost” claim at [2d-3-notes.md:3](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3). Minimal fix: when either post-save refresh fails, send an application-originated re-observe hint to that workspace’s existing watcher/engine; let its normal two-read pipeline stabilize `Absent`, `Unreadable`, or content and then use ordinary stamped admission. Do not publish or clear the record from the failed single read itself.

## Medium

None.

## Low

- [ledger.rs:223](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:223), [2d-3-notes.md:657](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:657), [main.rs:57](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/main.rs:57) — Current documentation still says “the two save path callers take [their stamps] on the line above their `Workspace::refresh`” and that “Three things together” prevent loss, although neither save-path caller stamps now and the round-4 fix establishes a fourth required fact: session-lock serialization. Concrete failure scenario: a maintainer follows the module contract and restores stamped save-path admission → A is recorded at T → an external B is read after A but its adjacent stamp also equals T → B is refused with no settlement or retry, recreating round 4. Minimal fix: remove the stale save-path-stamp sentence from `ledger.rs` and §5 item 14, and change `main.rs` to say four facts or explicitly scope its three mechanisms to watcher-produced observations.

- [ledger.rs:1982](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1982), [ledger.rs:1999](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1999), [2d-3-notes.md:1873](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:1873) — The test and evidence call the reading “session-locked,” but the test constructs a bare `WriteLedger` and never owns or locks a `WorkspaceSession`; it proves only the serialized door’s implementation. Concrete failure scenario: a production caller is moved outside `with_open` → an old reading P is followed by commit/record A → that caller uses the serialized door and admits P, clearing A’s record → both new tests still pass because neither exercises the session-lock premise. Minimal fix: rename the test and evidence to say “serialized-door reading,” and state explicitly that the production lock premise remains established only by the call-graph audit unless a session-level witness/test is added.

The production call graph currently supports the chronology premise, including `conflict_after_the_lock`; `ReadChronology` is private and production callers cannot choose a variant. The lock order remains session → gate → state, ledger locks remain leaves, and no 2d-4 command, event, observation queue, wire type, serialization, or frontend change was introduced. The core change is save-unaware and Tauri-free on static inspection and the supplied dependency evidence.

No tests were run; these findings are static.

**NOT READY**

Codex session ID: 01a038df-b2f6-7503-be64-7f989d960bd0
Resume in Codex: codex resume 01a038df-b2f6-7503-be64-7f989d960bd0

---

## Round 6 — NOT READY (2 High, 2 Low)

Scoped to round 5's fix. **Six rounds, six narrower instances**, and this round is the sharpest
statement yet of the pattern the brief was written around: **both Highs are items of
`2d-3-notes.md` §5 that the record had already judged and dismissed** — item 20 ("bounded by an
epoch reset") and item 3 ("not new exposure"). That makes **five** §5 items now found to be real
defects after being written as honestly bounded: item 10 (round 2), item 16 (round 4), item 18
(round 5), and items 20 and 3 (this round). The section's stated-open items are not a residue to be
inherited; they are where the defects live.

Both Highs are the **same shape as rounds 4 and 5** — a genuinely external change that never enters
the observation sequence — reached through two new doors. High 1 is the `ReObserve` that the
**baseline-retry arm consumes and discards**, which is the round-5 fix's own new machinery failing
in the one state its §5 item said bounded it. High 2 is a **one-read transient published and
coalesced** by a *successful* save-tail refresh: because the refresh succeeded, no re-observation is
asked for, so the round-5 fix's recovery path never engages and a phantom intermediate state
outlives the write that replaced it.

The two Lows are both **name-position and count misses**, the same class round 5 found twice in the
round-4 fix round's sweep: a correction block that says "one" of three ledger callers is serialized
while naming two in the same sentence, and a present-tense scope record still claiming "no change to
the core crate at all" after this step added the rollback primitive that ledger refusal recovery
depends on.

What round 6 inspected and **cleared**: the unbounded-channel and channel-lock arguments,
`NoWatcher` behaviour, shutdown/epoch serialization, the three new save-path call sites,
`after_an_uncertain_write`, native-hint behaviour preserved by `hint_paths`, the private and
exhaustive chronology proofs, the remaining §5 items, the gate table, and the absence of any
phase-2d-4 wire or frontend scope creep or a core-to-Tauri dependency.

Host-measured evidence supplied, all re-measured by the orchestrator on this exact clean tree at
`b9650a9`: `cargo test --workspace` 1256/0; focused serial `watch_check::` 20/20 (62.70 s); clippy
`-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty;
neither 2d-3 commit touches a `src/` path, so 431 / 2125 / 184 stand as carried.

### Verbatim reply

## High

- [watch.rs:1131](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/watch.rs:1131), [commands.rs:2443](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2443), [engine.rs:589](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/watch/engine.rs:589), [2d-3-notes.md:794](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:794) — a worker whose baseline is failing accepts `ReObserve` as `Asked` and then deliberately discards it, contradicting §5 item 20’s claim that this loss is bounded by an epoch reset. Concrete scenario: watcher starts but baseline enumeration fails → app commits revision A → an external process removes the document before the save refresh → refresh fails and sends `ReObserve` → the baseline retry arm consumes and drops it → baseline later succeeds but cannot enumerate the now-missing path, so `ObservationEngine::start` emits nothing → the permitted native-hint miss leaves the removal unsequenced and record A can later suppress a genuine recreation of A. This violates Q2’s rule that a differing post-save observation is admitted as external and the step’s “no external change is lost” guarantee ([phase-2d-design.md:29](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2d-design.md:29), [2d-3-notes.md:3](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3)). Minimal fix: retain application-origin re-observations across baseline failures and, after baseline establishment, force them through a path capable of emitting an owed removal/unreadable state; add a deterministic spawned-worker/baseline-failure test that does not require FSEvents.

- [workspace/mod.rs:530](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/workspace/mod.rs:530), [commands.rs:2430](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2430), [ledger.rs:1121](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1121), [2d-3-notes.md:640](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:640) — §5 item 3’s “not new exposure” ruling is false because both successful save-tail refreshes can publish and coalesce a one-read transient state into the new ledger. Concrete scenario: app commits A → a foreign non-atomic write toward Q is in progress → the single refresh reads a parseable intermediate P → `admit_under_the_session_lock` clears A and publishes P → the writer finishes Q → the healthy backend permissibly misses that hint → no re-observation is requested because the refresh succeeded, so phantom P remains while final Q never enters the sequence. This violates Q2’s requirement to suppress or admit a **stable** observation ([phase-2d-design.md:29](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2d-design.md:29)). Minimal fix: keep the immediate read only for cache/conflict payload construction, and route any ledger mutation/publication through the engine’s two-read stabilization path.

## Medium

None.

## Low

- [2d-1-notes.md:113](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-1-notes.md:113), [2d-3-notes.md:2091](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:2091) — the correction block says “one” of three ledger callers is serialized while immediately naming the two serialized save-tail callers, and §11 incorrectly says that count was checked and stands. Concrete scenario: a future change follows the recorded count → preserves serialization for only one tail → restores a stamped chronology to the other → an equal-instant collision can suppress an external observation. Minimal fix: change “one” to “two” and correct §11’s assertion.

- [2d-3-notes.md:625](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:625) — the present-tense scope record still claims “no change to the core crate at all,” although the reviewed step added the generic rollback/path support on which ledger refusal recovery depends. Concrete scenario: the statement is treated as a binding scope invariant → `revert_settlement` is removed as out of scope → a refused pre-save settlement remains coalesced → the observation is lost. Minimal fix: state that core gained ledger-agnostic rollback/path primitives but no Tauri or ledger dependency.

I cleared the unbounded-channel and channel-lock arguments, `NoWatcher` behavior, shutdown/epoch serialization, the three new save-path call sites, `after_an_uncertain_write`, native-hint behavior preserved by `hint_paths`, private/exhaustive chronology proofs, the remaining §5 items, the gate table, and the absence of phase-2d-4 wire/frontend scope or a core-to-Tauri dependency. No tests or builds were run; these findings are entirely static.

NOT READY

Codex session ID: 01a0393a-6baf-7731-b98e-1fc80671c6f8
Resume in Codex: codex resume 01a0393a-6baf-7731-b98e-1fc80671c6f8

## Round 7 — NOT READY (1 High, 2 Low)

Scoped to round 6's fix. The brief's first and hardest instruction was to **judge the deviation**:
round 6's High 2 asked that ledger publication be routed through the engine's two-read
stabilization, and the round-6 fix round adopted the first half of that remedy and **rejected the
second deliberately**, arguing *publish **and** ask* from consult Q2, Q5 and round 3's
swallowed-change defect (`2d-3-notes.md` §12.2).

**Round 7 judged the deviation wrong, and the reason is a reading of Q3 the record got backwards.**
Q3's guarantee is *for each document the frontend acts only on the **highest sequence it has
accepted***. That forbids a consumer regressing to an older sequence; it does **not** oblige one to
wait for a sequence that does not exist yet. So a phantom P published at sequence *n* is not made
harmless by a stabilized Q arriving at *n+1* — a 2d-4 drain between the two legitimately accepts P as
the highest sequence it has seen, and the concrete cost the reviewer names is a person confirming
*Reload* against P and **losing their draft**, which Q at *n+1* cannot give back. §5 item 3's
replacement, written by the round-6 fix round, rests on exactly that false reading. It is the sixth
consecutive round to find a false claim in this record, and the **second** time item 3 has been wrong.

The two Lows are the class every round of this review has produced: a module headline whose
"composes with five other things" omits the settlement rollback and is really six, and a §5 item 22
whose scenario is narrower than the code's — an unchanged owed observation can spend a sequence for a
path this session **never committed to**, reached through a baseline-established-but-unannounced
state after a failed conflict refresh.

What round 7 inspected and **cleared**: the worker-before-tail Q→P ordering is real and an owed
request reaching a live worker does correct it; debt re-insertion in `settle`, rollback re-owing
through `Undone`/`revert_settlement`, native-hint behaviour across the `schedule_paths`/`HintOrigin`
split, both `ReObserve` loop arms, baseline retention, admission ordering, epoch replacement, §5 item
21's replacement bound, and the spawned-worker test's two-arm limitation (§12.7) — all sound.

Host-measured evidence supplied, all re-measured by the orchestrator on this exact clean tree at
`9bb4695`: `cargo test --workspace` 1261/0; focused serial `watch_check::` 20/20 (66.60 s); clippy
`-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty;
no frontend `src/` path in any of the three 2d-3 commits, so 431 / 2125 / 184 stand as carried.

### Verbatim reply

## High

- [commands.rs:2549](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2549), [2d-3-notes.md:749](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:749) — “Publish and ask” does not make the single-read phantom harmless: Q3 restricts the frontend to the highest sequence it has already accepted, not to a future sequence that does not yet exist. Concrete scenario: the app commits A → `after_a_save` reads transient P and publishes it → 2d-4 drains P before the owed observation settles → an open write surface accepts P as its current conflict and the person confirms Reload, discarding their draft → the engine later stabilizes Q and publishes a higher sequence, but Q cannot restore the discarded draft. A missing/stopped watcher makes P permanent instead. This violates Q2’s stable-observation premise and falsifies §5 item 3’s claim that Q3 makes P harmless. Minimal fix: keep the immediate read for cache/conflict construction, but do not place it in the external sequence; publish only the engine-stabilized result, while retaining a separate provisional save-conflict marker for Q5 duplicate suppression.

## Medium

None.

## Low

- [commands.rs:90](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:90) — the module headline says the record composes with five other mechanisms but omits the settlement rollback, so the true count is six: commit gate, watcher stamp, settlement rollback, session-lock ordering, re-observation, and owed debt. A maintainer following this supposedly exhaustive list could remove `revert_settlement` and restore round 3’s lost-observation defect. Minimal fix: change five to six and name the rollback.

- [2d-3-notes.md:969](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:969) — §5 item 22 falsely says an unchanged owed observation costs a sequence only for a path the session committed to. Concrete scenario: the watcher baseline establishes B without announcing it → a stale save conflicts without committing → the conflict refresh fails and requests re-observation → the engine emits `Changed { B → B }` → with no record or publication, the ledger spends a sequence despite this session having committed nothing. Minimal fix: describe the actual cases—baseline-established but unpublished state following a failed conflict refresh or uncertain-write request—and retain the warning that consumers must treat the equality as reaffirmation, not an external change.

I statically inspected the round-6 record, design rulings, debt and rollback machinery, baseline retention, both `ReObserve` loop arms, native-hint routing, save tails, admission ordering, epoch replacement, and the requested name/count positions. The worker-before-tail Q→P ordering is real, and an owed request that reaches a live worker does correct it; debt re-insertion, rollback re-owing, native-hint behavior, item 21’s replacement bound, and the spawned-worker test’s two-arm limitation are sound. No tests, builds, watcher checks, or network access were used.

NOT READY

Codex session ID: 01a03981-7fd6-7351-bb5f-fa8602c3f7b8
Resume in Codex: codex resume 01a03981-7fd6-7351-bb5f-fa8602c3f7b8

---

## Round 8 — NOT READY (1 High, 2 Low)

Scoped to round 7's fix — the split of one admission door into three. The brief's first instruction
was to judge the fix round's own deliberate deviation (the third door: `after_a_save`'s disagreeing
arm *withholds* rather than *marks*), and its second was to ask whether `decide`'s **shared** steps
1–4 still mean the same thing for a door that will not announce.

**The deviation was cleared and the shared steps were not.** Round 8 is the first round of this
review since round 6 whose High is a defect in **behaviour** rather than a sentence in the record,
and it is in step 2 — `self_write_suppresses` — which the brief pointed at only obliquely by naming
step 4's `Duplicate`. The reviewer cleared `Duplicate` explicitly and found the same shape one step
higher: **suppression runs before the door is consulted, so a stale app-write record can make a
serialized save-tail reading answer `SelfWrite`** — retaining the record, announcing nothing and
marking nothing — even though that tail has independently proved the reading differs from the
transaction it just ran. The reachable path needs no watcher race: `reload_document` accepts a
foreign revision into the workspace **without touching the ledger**, and a save that returns
`committed: false` records nothing, so the previous record stands while the workspace has moved on.
On the marking door that costs consult Q5's coalescing marker, which is what stops a native duplicate
raising a **second** conflict at 2d-5; on the withholding door the owed stabilized reading meets the
same retained record and the differing post-save external observation never enters the sequence at
all.

The first Low is the record following the behaviour: §13 predicts `Marked` / `Withheld`, record
removal and a later publication for a case where the code answers `SelfWrite`, retains the record and
suppresses the owed observation. The second is the **eighth consecutive name-position miss** — the
`published` → `announced` sweep §13.7 claims complete still leaves six present-tense positions
calling the map a "published-state map" or "already published state", in two type headlines, the
tally and session-field documentation, the epoch-discard prose and the sink documentation.

What round 8 inspected and **cleared**: the marker/withholding asymmetry itself; `Duplicate` before
the withholding arm when an earlier announcement genuinely exists; a marker overwriting a newer
publication as over-reporting rather than silence; marker invalidation on commit; the explicitly
recorded no-watcher trade; and the absence of any core, wire, queue, event, command or frontend scope
creep.

Host-measured evidence supplied, all re-measured by the orchestrator on this exact clean tree at
`5ad461b`: `cargo test --workspace` 1262/0; focused serial `watch_check::` 20/20 (69.27 s); clippy
`-D warnings` clean; `cargo fmt --check` clean; `cargo tree -p espansoconfig-core | rg tauri` empty;
no frontend `src/` path in any 2d-3 commit, so 431 / 2125 / 184 stand as carried.

### Verbatim reply

## High

- [ledger.rs:1385](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1385), [commands.rs:2603](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:2603), [commands.rs:733](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:733) — Behaviour: the shared suppression step can prevent a serialized save-tail reading from superseding a stale record even though that tail has independently proved the reading differs from the current transaction. Concrete scenario: the app commits A and records A → the watcher misses an external B → `reload_document` accepts B into the workspace without touching the ledger → an unchanged save of B returns `committed: false`, so no new record replaces A → an external writer restores A before `after_a_save` refreshes → the refresh observes A ≠ saved B and enters the withholding door → `decide` answers `SelfWrite` before supersession, retains record A, and the owed stabilized A is suppressed by the same record, so this differing post-save external observation never enters the sequence. The analogous stale-record shape can make the marking door answer `SelfWrite` instead of installing its Q5 marker. Minimal fix: make suppression door-specific: a serialized marker/withholding reading is already classified by its save-tail context and must supersede any prior record before marking or withholding; retain `SelfWrite` suppression for the stamped watcher door. Add regressions with `record A → explicitly accept B → serialized read A`, requiring `Marked`/`Withheld`, record removal, and—after withholding—a stamped A admission.

## Medium

None.

## Low

- [2d-3-notes.md:3456](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3456), [2d-3-notes.md:3600](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3600), [2d-3-notes.md:3715](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3715) — Record: §13 falsely claims the serialized doors respectively answer `Marked`/`Withheld`, that every disagreeing post-save read clears its record, and that withholding ensures the stabilized reading is queued, although the shared `SelfWrite` return can do none of those things. In the A → accepted B → restored A scenario above, the record predicts `Withheld`, record removal, and a later publication, while the code answers `SelfWrite`, retains A, and suppresses the owed observation. Minimal fix: after correcting the behaviour, amend §2.6, §13.1, §13.4, §13.6, and the evidence claims to state which checks are actually door-specific and add the stale-record case to the evidence.

- [ledger.rs:592](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:592), [ledger.rs:636](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:636), [commands.rs:335](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:335), [commands.rs:398](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:398), [commands.rs:527](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:527), [2d-3-notes.md:3761](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:3761) — Record/documentation: the `published` → `announced` name-position sweep is incomplete, despite §13.7 claiming the relevant present-tense positions were amended. A marker can occupy the map without any publication, yet current type headlines, tally documentation, session-field documentation, epoch-discard prose, and sink documentation still call it a “published-state map” or “already published state”; a maintainer following those contracts could treat every coalesced entry as sequence-backed or omit markers from invalidation. Minimal fix: change these present-tense positions and corresponding assertion messages to “announced,” reserving “published” for cases known to have spent a sequence.

I statically inspected the seven prior rounds, Q2/Q3/Q5/Q7, all three doors and `decide`’s ordering, both save tails, ledger invalidation, the watcher/debt contracts, §5 items 3/19/21/22, §13, lock order, scope, counts, names, and assertions. I cleared the marker/withholding asymmetry itself, `Duplicate` before the withholding arm when an earlier announcement genuinely exists, marker-overwriting-publication as over-reporting rather than silence, marker invalidation on commit, the explicitly recorded no-watcher trade, and the absence of core/Tauri, wire, queue, event, command, or frontend scope creep. No tests, builds, watcher checks, or network access were used.

NOT READY

Codex session ID: 01a039be-9574-71f3-8462-19378c31f064
Resume in Codex: codex resume 01a039be-9574-71f3-8462-19378c31f064

---

## Round 9 — NOT READY (3 High, 4 Low)

Scoped to round 8's fix. The brief's first instruction was to attack the **argument** rather than the
remedy: the fix round had adopted the reviewer's remedy exactly but justified it on a wider claim than
the finding required — that suppression has no work to do on the serialized doors *whether or not the
record is stale*, because only a **publication** can commit the error suppression prevents.

**That argument was cleared, in both halves.** A marker is a user-visible save-conflict fact rather
than a sequence-backed external report; the serialized clearing extension is sound for both tails;
marking coalesces pending matching hints while its entry stands; and withholding correctly permits the
externally restored revision to publish. The three self-caught fixes of the round-8 fix round — the
running-transaction qualification, *while it stands*, and the re-measured suite totals — were
**cleared as well**.

**And then the round returned three Highs, all defects in behaviour, all of one root cause: nothing
tells the ledger when the workspace accepts a foreign revision.** `reload_document` invalidates
neither the app-write record nor the announced-state entry, so:

1. **the stamped door can still suppress a genuine external return to the recorded bytes** — the one
   door still allowed to suppress, meeting a record made stale by a reload that never touched it;
2. **clearing the record destroys the only chronology anchor with it**, so an arbitrarily delayed
   pre-commit settlement finds no timestamp to be refused by and publishes bytes the commit has since
   replaced;
3. **a stale `announced` entry answers `Duplicate` to a genuine change** — and *deferring this to
   2d-5 cannot work*, because `Duplicate` sends that layer **no value to arbitrate**. This is the
   argument that breaks §14.2's fourth reason on its own terms.

**Two of the three are §5 items 23 and 24 — written by the round-8 fix round, one round ago, as
honestly bounded residues and deferred in writing.** That makes **seven** §5 items so recorded and
later found to be real defects: item 10 (round 2), item 16 (round 4), item 18 (round 5), items 20 and
3 (round 6), and now items 23 and 24 (round 9). The default posture toward every remaining open item
of §5 is not suspicion but expectation.

The Lows follow the Highs. **Low 1 is the reversal of §14.2's rejection of the root-cause fix, and it
names two of its four reasons as factually false** — the orchestrator verified both independently in
the code before briefing the fix round: `WorkspaceSession::document` and `text` serve the **cache**
(`document_view`, `document_text`) and cannot accept a foreign disk revision, so the claim that they
"re-create the same gap" is false; and `reload` already mutates the workspace cache
(`workspace.refresh`), so adding private ledger invalidation widens no command signature and makes no
writer of it. Of the remaining two reasons, the second concedes the qualified form the reviewer
actually asks for ("clearing only when it differs is defensible") and the fourth is refuted by High 3.
**Low 2** rejects "over-reporting" as the name for the withheld hint's later publication: the door's
premise proves a real post-read disk transition, and byte equality with an earlier app write does not
make that transition false. **Low 3** removes item 23's false physical-time bound — thread scheduling
and gate contention place no bound on how long a completed settlement may remain unadmitted. **Low 4**
is the **ninth consecutive** name-position miss, and it is a *premise* rather than a word: the
`withheld` tally doc and the withholding door's first sentence still say the read follows a commit,
although `after_a_save` also runs after `committed: false`.

Host-measured evidence supplied, all re-measured by the orchestrator on this exact clean tree at
`6eae792`: `cargo test --workspace` 1263/0 across 26 result lines; focused serial `watch_check::`
20/20 (67.15 s); clippy `-D warnings` clean; `cargo fmt --check` clean;
`cargo tree -p espansoconfig-core | rg tauri` empty; no frontend `src/` path in any 2d-3 commit, so
431 / 2125 / 184 stand as carried.

### Verbatim reply

## High

- [commands.rs:748](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:748), [ledger.rs:1581](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1581) — Behaviour: `reload_document` can make an app-write record stale without invalidating it, so the stamped door can still suppress a genuine external return to those bytes. Concrete scenario: the app commits A and records A → an external B is missed by the watcher → the person reloads B, updating the workspace but not the ledger → a later save-tail failure or uncertain-write path requests an owed observation without clearing A → an external writer restores A → the owed engine settlement emits A even if A was already tracked → step 2 answers `SelfWrite`, and the B→A change never enters the sequence. Door-scoping fixes the serialized precursor but not the stale record at the only door still allowed to suppress. Minimal fix: after a successful explicit reload whose revision differs from the recorded revision, invalidate that path’s app-write record under session → gate → state; add `record A → reload B → owed stabilized A`, requiring admission rather than suppression.

- [ledger.rs:1593](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1593), [2d-3-notes.md:1194](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:1194) — Behaviour: clearing the record also destroys the only chronology anchor, allowing an arbitrarily delayed pre-commit settlement to publish bytes the commit replaced. Concrete scenario: the watcher stabilizes P and stamps it before commit A, then its thread is descheduled before admission → the app commits and records A → a serialized reading of A clears that record and marks or withholds → the delayed P reaches `decide`, finds no timestamp to compare against, and is admitted although disk now contains A; a 2d-5 consumer can act on P before any correction. Minimal fix: retain a separate per-path latest-commit timestamp for the epoch after suppression eligibility is cleared, and use it for step 1; a pre-anchor observation must still return `PrecedesACommit` and have its settlement reverted.

- [commands.rs:748](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:748), [ledger.rs:1596](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1596), [2d-3-notes.md:1210](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:1210) — Behaviour: the stale `announced` entry is round 3’s swallowed-change defect reached through coalescing, and deferring it to 2d-5 cannot work because `Duplicate` sends that layer no value to arbitrate. Concrete scenario: B is announced → an external C is accepted through `reload_document`, which leaves `announced[path] = B` → the disk returns to B → an owed stabilization emits B → step 4 answers `Duplicate`; the consumer currently holds C, but no B observation or sequence reaches it. Minimal fix: successful explicit reload must invalidate an unequal announced entry, atomically with the corresponding stale app-write invalidation; add `announce B → reload C → owed B`, requiring a new admission.

## Medium

None.

## Low

- [2d-3-notes.md:4152](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:4152), [2d-3-notes.md:4162](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:4162) — Record: the rejection of reload-time invalidation is based on two false claims: cached `document`/`text` reads do not accept a foreign disk revision, and updating private session ledger state does not widen the command signature or make the already cache-mutating reload command a writer. Concrete scenario: a maintainer follows §14.2 and waits for 2d-5 → the stale record/map return `SelfWrite`/`Duplicate` before 2d-5 receives anything, preserving both Highs above. Minimal fix: describe door-scoping and reload-time invalidation as complementary fixes, remove the alleged scope prohibition, and reserve accepted-sequence arbitration for observations that actually reach the coordinator.

- [ledger.rs:370](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:370), [2d-3-notes.md:4110](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:4110), [2d-3-notes.md:4135](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:4135) — Record/documentation: the withheld hint’s later publication is called “over-reporting,” although the door’s premise proves a real post-read disk transition; byte equality with an earlier app write does not make that transition false. Concrete scenario: the workspace and transaction last read B → an external writer restores earlier app-authored bytes A before the tail refresh → the withheld reading clears A’s stale record → the stabilized A publication correctly reports B→A. Minimal fix: call this a genuine external change whose bytes happen to equal an earlier app revision, while retaining the prohibition on claiming authorship.

- [2d-3-notes.md:1203](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2d-3-notes.md:1203) — Record: item 23 falsely bounds the chronology-anchor exposure to one debounce-plus-probe window; thread scheduling and gate contention place no bound on how long a completed settlement can remain unadmitted. Concrete scenario: P completes its engine pass before record A, then its worker is descheduled across several commands before the record is cleared and P is admitted. Minimal fix: remove the physical-time bound and state that only the production of such an observation is pre-commit; its delivery latency is unbounded.

- [ledger.rs:722](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:722), [ledger.rs:1137](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/ledger.rs:1137) — Record/documentation and name-position sweep: the `withheld` tally doc and withholding-door first sentence still say the read follows a commit, although `after_a_save` also runs after `committed: false`. Concrete scenario: an unchanged save of B commits nothing, an external A lands before its refresh, and `withheld` increments despite no commit occurring. Minimal fix: replace “commit/read-back” with “save transaction’s last locked read/tail refresh” in these name-position contracts and sweep the remaining `after_a_save` descriptions for the same premise.

I statically inspected all eight prior reviews, Q2/Q3/Q5/Q7, the three admission doors and five decision steps, the save and reload call paths, lock order, the new regression and renamed production-path test, §5 items 23–24, §§13–14 correction blocks, and headline/doc-comment/test/assertion names. I cleared the round-8 suppression split itself: a marker is a user-visible save-conflict fact rather than a sequence-backed external report, the serialized clearing extension is sound for both tails, marking coalesces pending matching hints while its entry stands, and withholding correctly permits the externally restored revision to publish. I also cleared the three self-caught fixes themselves—the running transaction qualification, “while it stands,” and the re-measured suite totals—but the adjacent committed-only name claims remain as reported. No tests, builds, watcher checks, or network access were used; I relied on the supplied host gates.

NOT READY

Codex session ID: 01a039fb-5e62-7480-a167-153f4a61b6e0
Resume in Codex: codex resume 01a039fb-5e62-7480-a167-153f4a61b6e0
