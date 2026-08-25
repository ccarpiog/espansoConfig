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
