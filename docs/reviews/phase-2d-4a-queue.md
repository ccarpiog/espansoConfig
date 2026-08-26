# Phase 2d-4a — the reconciliation queue, event and drain command: review

Round 1, against the 2d-4a implementation on an uncommitted working tree over `31712b2`.
Every gate was green when this review was commissioned: `cargo test --workspace` 1297,
clippy/fmt/`cargo doc` clean, `cargo tree -p espansoconfig-core | rg tauri` empty,
`watch_check::` 20/20 with 252 filtered out, `npm test` 2125, `npm run check` 431 files /
0 errors, `npm run build` 184 modules with the server oracle absent and the client oracle
present. **The verdict below is therefore not about a red gate**; it is about what nine
targeted questions found behind green ones.

The brief asked about: the overflow policy, the non-UTF-8 deviation from the consult's Q3,
the acknowledgement watermark under the out-of-order drains Q7 item 5 requires of 2d-5,
lock order and re-entrancy, the epoch reset across two locks, the `wire_contract` hole the
split opened, claims versus code, the liveness inventory, and coalescing correctness.

---

## Round 1 — verbatim

Findings

High

1. A newly added UTF-8 document can become unaddressable when it later changes to non-UTF-8. `Added` exposes the snapshot’s `DocumentId`, but the backend `Workspace` never adopts that file (`loaded: false`). A subsequent non-UTF-8 `Changed` is converted through `address_of`, which therefore returns `ObservedDocument::Unknown` rather than the ID previously sent to the consumer ([src-tauri/src/reconciliation.rs:692](src-tauri/src/reconciliation.rs:692), [src-tauri/src/reconciliation.rs:727](src-tauri/src/reconciliation.rs:727)). Since `Unknown.relative_path` is expressly lossy display data and not an address ([src-tauri/src/reconciliation.rs:170](src-tauri/src/reconciliation.rs:170)), the consumer cannot reliably identify and invalidate its existing projection. Known-at-open documents are recoverable—the `Unreadable` sequence and known ID invalidate them—but this added-then-changed case is stranded. The notes document lost revisions and non-UTF-8 additions, but not this loss of an already-issued identity. The deviation is therefore not fully defensible as recorded.

Medium

2. Out-of-order drains can move the returned watermark backwards despite the explicit guarantee that they cannot. The internal acknowledgement correctly uses `max`, but an empty response uses the caller’s lower `after_sequence`, not `guard.acknowledged` ([src-tauri/src/reconciliation.rs:599](src-tauri/src/reconciliation.rs:599), [src-tauri/src/reconciliation.rs:611](src-tauri/src/reconciliation.rs:611)). After acknowledging 10, `drain(5)` can return an empty batch with `newest_sequence == 5`; a caller following the documented instruction to store it unconditionally regresses. This contradicts both the field documentation and decision record ([src-tauri/src/reconciliation.rs:362](src-tauri/src/reconciliation.rs:362), [docs/decisions/2d-4a-notes.md:110](docs/decisions/2d-4a-notes.md:110)). Repeating a watermark also returns the same batch only if no enqueue occurs between calls, so the unqualified idempotence wording is too strong. Production observations cannot legitimately be minted below the real acknowledgement: the ledger increments its allocator for every publication, and a reverted settlement is re-observed and admitted under a fresh sequence ([src-tauri/src/ledger.rs:2085](src-tauri/src/ledger.rs:2085), [crates/espansoconfig-core/src/watch/engine.rs:923](crates/espansoconfig-core/src/watch/engine.rs:923)).

3. Coalescing fails for the out-of-arrival-order case the design explicitly anticipates. If sequence 9 for path/state A reaches the queue before sequence 3 for the same path/state, `previous < admitted.sequence` is false, so sequence 9 is retained and sequence 3 is inserted too ([src-tauri/src/reconciliation.rs:539](src-tauri/src/reconciliation.rs:539)). `reindex` correctly leaves sequence 9 as the path’s newest entry, but it does not remove the duplicate sequence 3. Thus the batch is ordered but not coalesced, contrary to the unconditional queue guarantee. The older repeat should be refused/coalesced rather than inserted. The `Removed`→`Added` rule itself is correct because `Absent != Content`, and reindexing selects the highest remaining sequence.

4. The overflow rationale falsely says dropping the globally oldest entry preserves “the newest state of every document” ([src-tauri/src/reconciliation.rs:520](src-tauri/src/reconciliation.rs:520), [docs/decisions/2d-4a-notes.md:122](docs/decisions/2d-4a-notes.md:122)). The oldest entry may be the only—and therefore newest—state for its document; the existing test actually drops three such documents while asserting the false sentence ([src-tauri/src/reconciliation.rs:993](src-tauri/src/reconciliation.rs:993)). The safety escape is present: `discarded` is cumulative and the documentation explicitly requires a complete workspace reload rather than partial reconciliation. Nothing in 2d-4a enforces that obligation, and R4 accurately assigns enforcement to the future consumer. Therefore overflow is observable rather than silent, but the preservation claim and its justification are false.

5. The new source contains an un-inventoried liveness claim in wording the sweep does not recognize: a failed wake allegedly still results in drains after listener registration, open, and resume ([src-tauri/src/events.rs:47](src-tauri/src/events.rs:47); duplicated at [src-tauri/src/reconciliation.rs:570](src-tauri/src/reconciliation.rs:570)). Those frontend drains do not exist in 2d-4a—the notes themselves say no frontend can call the command—so this is both a present-tense false claim and a liveness restatement outside the canonical contract. None of `LIVENESS_SHAPES` matches “still reconciles” or “still drains,” explaining why the green sweep misses it. This directly contradicts the notes’ assertion that the new module only links to the contract and otherwise makes local queue claims ([docs/decisions/2d-4a-notes.md:299](docs/decisions/2d-4a-notes.md:299)).

Low

6. `ReconciliationBatch::discarded` is documented as counting only capacity drops, but `enqueue` also increments it for a sequence at or below the acknowledged watermark ([src-tauri/src/reconciliation.rs:370](src-tauri/src/reconciliation.rs:370), [src-tauri/src/reconciliation.rs:529](src-tauri/src/reconciliation.rs:529)). Both causes imply incomplete history and the same reload response, but the wire field’s stated meaning is still false.

7. The decision record says the ledger and queue “cannot disagree” about their epochs because both reset under the session lock ([docs/decisions/2d-4a-notes.md:273](docs/decisions/2d-4a-notes.md:273)). They are separate locks and reset sequentially, so they can disagree transiently. An old observation admitted immediately before the ledger reset can enqueue into the still-old queue during that window; the subsequent queue reset removes it. Conversely, the successor watcher starts only after both resets, and old observations arriving afterward fail an epoch check. The implementation therefore prevents cross-epoch leakage, but it does not provide the atomic agreement claimed.

Verified without findings

- Lock order is session → ledger gate → ledger state, with those ledger guards released before downstream; drains are session → queue. Enqueue holds only the queue state mutex, and the emitter is cloned out of its separate mutex before invocation. Re-entrant `WorkspaceSession::open` therefore encounters no held queue or ledger lock.
- Recovering poisoned queue mutexes is defensible here: no caller-supplied code runs under either mutex, and wake emission occurs after releasing them. There is no evident panic path that can leave the `BTreeMap` structurally invalid, though the blanket recovery policy deserves the same explicit rationale already present for the ledger.
- The epoch checks and watcher-start ordering prevent an old observation from surviving a replacement and prevent a successor observation from arriving before queue adoption.
- `AWAITING_FRONTEND_DECLARATION` is genuinely checked both ways: it must be registered and absent from the frontend declarations. Adding the 2d-4b name forces deletion of the exception, after which full registered/declared equality applies. The hole cannot silently outlive an actual frontend declaration.
- `Removed` followed by `Added` remains two observations, including identical-byte recreation.

NOT READY — 1 High, 4 Medium findings.

Codex session ID: 01a03d87-5c45-7db0-b12b-7d28d86e6ad3
Resume in Codex: codex resume 01a03d87-5c45-7db0-b12b-7d28d86e6ad3

---

## Round 2 — verbatim

Scope: **the round-1 fix**, not the original implementation. Commissioned because a fix is a
change and the round that reviews it is not optional — in Phase 2d-3, rounds 12, 13 and 14
each found a High that a *previous fix round* had written while closing something else.

Gates when this round was commissioned, all measured on this tree by the orchestrator:
`cargo test --workspace` 1301 over 26 result lines all `ok`; clippy, `cargo fmt --check` and
`cargo doc --workspace --no-deps` clean; `cargo tree -p espansoconfig-core | rg tauri` empty;
`watch_check::` 20/20 with 256 filtered out in 66.02 s; `npm test` 2125; `npm run check` 431
files / 0 errors; `npm run build` 184 modules.

Findings

Medium

1. The coalescing fix is still arrival-order dependent for an `A → B → A` history. Suppose sequence 9/state A arrives, followed by sequence 3/state A; sequence 3 is discarded as a repeat of 9. If sequence 5/state B then arrives, the true sequence history was A(3), B(5), A(9), which the notes explicitly say must retain both A observations, but the queue returns only B(5), A(9). Conversely, with 9/A, 5/B, then 3/B, `newest_for_path` points to 9/A, so 3/B is inserted beside 5/B and the batch is not coalesced. Comparing only the highest pending entry cannot correctly normalize arbitrary arrival order; it must consider sequence-adjacent states for that path. This contradicts the new unconditional guarantee and can drop an observation that was not a repeat in sequence order (`src-tauri/src/reconciliation.rs:40`, `src-tauri/src/reconciliation.rs:675`, `docs/decisions/2d-4a-notes.md:92`). Round-1 finding 3 is therefore not closed.

2. One idempotence/retention guarantee remains unqualified and false under overflow. The module contract says an entry “stays until a later drain acknowledges it” and a lost answer costs only a repeated drain, but `enqueue` can evict that entry before acknowledgment once capacity is reached. The four explicitly qualified sentences are mutually consistent and true when nothing is enqueued between calls, but the fix also touched this neighboring contract sentence without adding the necessary condition (`src-tauri/src/reconciliation.rs:51`, `src-tauri/src/reconciliation.rs:695`, `docs/decisions/2d-4a-notes.md:468`).

3. The replacement-epoch correction records an incomplete concurrency mechanism as the complete one. An old observation can pass `ledger.admit`, pause before the synchronous downstream call, then resume only after both the ledger and queue have reset. It then fails the queue check; it neither entered the still-old queue as the first bullet claims nor fails the ledger check as the third bullet claims, because it already passed that check. Cross-epoch leakage is still prevented, but by an additional interleaving and the queue fence that the asserted “three facts” omit (`src-tauri/src/ledger.rs:2168`, `src-tauri/src/ledger.rs:2193`, `src-tauri/src/reconciliation.rs:658`, `docs/decisions/2d-4a-notes.md:394`).

4. The two new inventory entries are not “local facts” under the inventory’s own taxonomy. Both passages expressly restate Q3’s future-consumer obligation; neither describes behavior currently implemented locally. Calling them local facts records the very distinction the check is meant to force reviewers to judge incorrectly. The matcher widening also omits obvious forms such as “drained again,” “re-drain,” and “reconciliation resumes.” I independently reproduced the check’s comment-unit and case-insensitive substring logic: the six additions produce exactly two hits, at `events.rs:42` and `reconciliation.rs:707`, as claimed, but that exact count does not make the classification or phrase family sound (`src-tauri/src/liveness_contract.rs:54`, `src-tauri/src/liveness_contract.rs:115`, `src-tauri/src/liveness_contract.rs:452`).

Low

5. R9 truthfully concedes that `issued_identities` is not capacity-bounded or evicted, but its reassurance that the map is “small beside a pending Changed” is not true of the aggregate. A long-lived epoch that repeatedly drains distinct created paths can accumulate arbitrarily many `PathBuf` entries while `pending` remains bounded at 256. The process-wide identity table already has the same asymptotic path retention, so this does not introduce a new stale-address class, but it duplicates that unbounded storage on a hot path and should not be described as small without measurement or a workload bound (`src-tauri/src/reconciliation.rs:472`, `docs/decisions/2d-4a-notes.md:623`).

Other requested checks

- `issued_identities` is cleared with `pending`, `acknowledged`, and `discarded` by one replacement of the complete `QueueState` (`src-tauri/src/reconciliation.rs:493`, `src-tauri/src/reconciliation.rs:616`).
- It does not return a stale identity after same-path removal/recreation under this repository’s identity model: the process-wide table deliberately assigns a path the same identity for the process lifetime, including recreation (`crates/espansoconfig-core/src/workspace/mod.rs:201`, `crates/espansoconfig-core/src/watch/engine.rs:418`). `Removed` and `Added` remain distinct because `Absent != Content`.
- The extension to `Removed` and io-`Unreadable` is valid: both arms use the same `address_of` fallback as non-UTF-8 unreadability (`src-tauri/src/reconciliation.rs:902`, `src-tauri/src/reconciliation.rs:910`).
- The watermark `max(batch highest, acknowledged)` does not skip a legitimately pending entry under the API contract: `after_sequence` asserts what the caller already accepted, drains remove at or below it, and later arrivals at or below the accumulated acknowledgment are rejected and counted as loss. The returned watermark is safe to store unconditionally.
- The overflow and `discarded` corrections are accurate, and the present-tense lost-wake claim was corrected.
- Round-1 findings 1, 2, 4, 5, 6, and 7 are substantively closed, apart from the new epoch-record defect above. Finding 3 remains open.
- The written Q3 coalescing guarantee was not weakened; the problem is that the rewritten code still does not keep that unconditional guarantee.

NOT READY — 0 High, 4 Medium findings.

Codex session ID: 01a03db2-1d38-72a3-948d-9b2a33255631
Resume in Codex: codex resume 01a03db2-1d38-72a3-948d-9b2a33255631
