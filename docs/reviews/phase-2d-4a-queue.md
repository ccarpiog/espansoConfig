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

---

## Round 3 — verbatim

Scope: **the round-2 fix**, not the original implementation and not round 1's fix. Commissioned
under the same rule that commissioned round 2 — a fix is a change, and the round that reviews it
is not optional. Round 2's own lesson was carried into this brief: *a fix can close a finding's
example without closing its shape*, so round 3 was asked what the round-2 fix's own new sentences
and its new code now rest on, and specifically whether calling the surviving arrival-order
dependence a `discarded` **loss** rather than a coalescing failure is a true distinction or a
relabelling.

Gates when this round was commissioned, all measured on this clean tree at `55ebd74` by the
orchestrator: `cargo test --workspace` **1303** passed / 0 failed over **26** result lines all
`ok`, exit 0; `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check`
clean; `cargo doc --workspace --no-deps` exit 0 (its ~73 `private_intra_doc_links` warnings are a
different, pre-existing lint); `cargo tree -p espansoconfig-core | rg tauri` empty; `watch_check::`
**20/20** with 258 filtered out in 68.00 s; `npm test` **2125** in 56 files; `npm run check` **431**
files / 0 errors; `npm run build` **184** modules with the server oracle absent and the client
oracle present.

## High

None.

## Medium

1. Capacity eviction reintroduces arrival-order-dependent coalescing. Consider one path with `A(1), B(2), A(257)` and sequences 3–256 belonging to other paths. Arrival order `1..257` evicts `A(1)`, returning `B(2), A(257)`. Order `2..257, 1` instead evicts `B(2)`, stores `A(1)`, and the drain folds the two A entries, returning only `A(257)`. Thus eviction can erase the separator that made the A states distinct; calling this "not a coalescing failure" and the guarantee "unconditional" is false even though `discarded == 1` makes the loss observable (`src-tauri/src/reconciliation.rs:40`, `src-tauri/src/reconciliation.rs:58`, `src-tauri/src/reconciliation.rs:751`). Closure requires an arrival-order-independent capacity representation/policy that preserves sequence-run information, with this boundary case tested; merely relabelling the outcome as loss does not close the coalescing claim.

2. R10 records but does not bound a concrete cross-document regression. Enqueue one unique state for document B at sequence 1, then 256 identical states for document A at sequences 2–257. The new raw-entry accounting evicts B's only state and forces a whole-workspace reload; the pre-fix queue would have retained B plus one coalesced A state without overflowing. "Repeats are rare" is unmeasured and cannot justify allowing redundant entries to displace unrelated documents (`src-tauri/src/reconciliation.rs:481`, `src-tauri/src/reconciliation.rs:751`, `docs/decisions/2d-4a-notes.md:818`). Closure requires capacity accounting that prevents folded repeats from displacing unique document state, or an enforceable, measured bound proving this stream cannot reach capacity.

3. R3 remains a wire defect that 2d-5 cannot repair from the value supplied. A first stable non-UTF-8 addition is converted to `Unreadable`; because neither the workspace nor `issued_identities` knows the new path, it carries only `ObservedDocument::Unknown`, explicitly display-only. The consumer receives neither the `Added` row Q3 specifies nor an address with which to install or invalidate one (`src-tauri/src/reconciliation.rs:360`, `src-tauri/src/reconciliation.rs:384`, `src-tauri/src/reconciliation.rs:966`, `docs/decisions/2d-4a-notes.md:776`). Closure requires the Rust wire/core observation to carry sufficient identity and summary metadata for this addition, or an explicit authoritative reload signal and policy that actually makes the file addressable.

4. The round-2 retention correction still claims more than it changed. The record's opening continues to say every admitted observation "is no longer dropped," despite stale-epoch, watermark, and capacity drops. It also says every named retention position states that eviction costs a whole-workspace reload, but `external_observation` only names eviction, while `drain` says a folded entry stays pending without stating that eviction removes it or requires reload (`docs/decisions/2d-4a-notes.md:3`, `docs/decisions/2d-4a-notes.md:235`, `docs/decisions/2d-4a-notes.md:980`, `src-tauri/src/reconciliation.rs:799`, `src-tauri/src/reconciliation.rs:913`). Closure requires every claimed position—including the header—to state the same exact retention boundary: acknowledgement or eviction, with eviction reported as loss requiring whole-workspace reload.

## Low

5. R9 accurately admits that `issued_identities` is unbounded, but that is still an avoidable second unbounded path-retention structure, not merely a documentation residue. Arbitrarily many distinct projected additions in one long-lived epoch grow both the process-wide identity table and this map; `QUEUE_CAPACITY` provides no protection (`src-tauri/src/reconciliation.rs:504`, `crates/espansoconfig-core/src/workspace/mod.rs:210`, `docs/decisions/2d-4a-notes.md:789`). Closure requires eliminating the duplicate through an authoritative identity lookup/carried identity, or a safe lifecycle bound backed by measurement.

## Verified without findings

- `coalesced_sequences` correctly folds runs longer than two: each equal successor removes its immediate predecessor, leaving only the run maximum.
- Three or more runs and interleaved paths are handled independently by the per-path `previous` map.
- The highest pending sequence is always carried, including when it is the final member of a folded run; `newest_sequence` therefore remains correct.
- The replacement-epoch two-case split is exhaustive over the queue mutex. Wholesale state replacement and the queue epoch check are the actual fences claimed.
- The four earlier same-watermark idempotence qualifications are true when no enqueue occurs between calls.
- The two liveness inventory entries fit the expanded `a pointer:` definition: they cite Q3, state a future obligation, and explicitly deny local implementation.
- Rewording "answered by" to "obliging" was an honest false-positive removal; whole-workspace reload is a consumer response to recorded loss, not observation-pipeline liveness.
- R4 correctly identifies the future consumer obligation and that 2d-4a does not enforce it.
- `issued_identities` is cleared at epoch replacement and does not introduce a stale-identity result across epochs.
- The step still draws nothing and makes no write-surface policy decision.

NOT READY — 0 High, 4 Medium, 1 Low findings.

Codex session ID: 01a03ded-e3bb-7403-9ce6-35d50a7d824c
Resume in Codex: codex resume 01a03ded-e3bb-7403-9ce6-35d50a7d824c

---

## Round 4 — verbatim

Scope: **the round-3 fix**, not the original implementation and not round 1's or round 2's fixes.
Commissioned under the rule that commissioned rounds 2 and 3 — a fix is a change, and the round
that reviews it is not optional. Round 3's own lesson was carried into this brief: *moving a rule
does not move the bound it depended on*, so round 4 was asked what the round-3 fix's own new code
and its own new sentences now rest on, the round-3 fix having changed the eviction victim, the wire
shape and the identity source in one round. It was pointed hardest at `evictable_sequence`, whose
order-independence §12.4 records as argued and bounded-checked but **expressly not proved**, and at
the residues R3, R9 and R10 against this project's precedent that seven items recorded as bounded
residues in Phase 2d-3 were later found to be real defects.

Gates when this round was commissioned, all measured on this clean tree at `c8e9ef1` by the
orchestrator: `cargo test --workspace` **1307** passed / 0 failed over **26** result lines all `ok`,
exit 0; `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean;
`cargo tree -p espansoconfig-core | rg tauri` empty; `watch_check::` **20/20** with 262 filtered out
in 77.24 s; `npm test` **2125** in 56 files; `npm run check` **431** files / 0 errors; `npm run build`
**184** modules with the server oracle absent and the client oracle present with 2 matches.

## High

None.

## Medium

1. A process-lifetime identity is not necessarily an address in the current workspace. `address_of` now consults only the global identity register, even though that API explicitly says `Some` does not mean the current workspace contains the document or that the caller ever saw the number (`crates/espansoconfig-core/src/workspace/mod.rs:288`, `crates/espansoconfig-core/src/workspace/mod.rs:294`, `src-tauri/src/reconciliation.rs:1148`). Exact sequence:

   - Epoch 1 opens root `R` containing `match/a.yml`, minting `D`.
   - The file is removed and epoch 2 reopens `R` without it; the epoch-2 workspace and frontend summary contain no `D`.
   - An external process recreates the path but stable reads fail, producing `Observation::Unreadable`, not `Added`.
   - `identity_already_issued` returns epoch 1’s `D`, so the epoch-2 wire sends `Known { document: D }` and omits the display path, although the current workspace rejects `D` as `UnknownDocument`.

   The replacement test constructs precisely an empty workspace that cannot resolve the identity, then declares the resulting `Known` value correct without testing current addressability (`src-tauri/src/reconciliation.rs:1664`, `src-tauri/src/reconciliation.rs:1683`, `src-tauri/src/reconciliation.rs:1687`; current-workspace lookup semantics at `crates/espansoconfig-core/src/workspace/mod.rs:487` and `crates/espansoconfig-core/src/workspace/mod.rs:506`). The deleted epoch-scoped test was protecting a real distinction: stable path identity may survive an epoch, but current addressability does not. The replacement test does not replace that protection.

2. R3 is still a wire defect, not a bounded residue for 2d-5. For a known UTF-8 document at revision `R1` that stabilizes to non-UTF-8 bytes at revision `R2`, projection produces `ExternalObservation::Unreadable { sequence, document, reason }`; both `previous_revision = R1` and `disk_revision = R2` are discarded (`src-tauri/src/reconciliation.rs:354`, `src-tauri/src/reconciliation.rs:378`, `src-tauri/src/reconciliation.rs:439`, `src-tauri/src/reconciliation.rs:1073`). Q3 requires those operands on `Changed`, and 2d-5 cannot recover either from the supplied value. `Changed` should move to a discriminated content shape, or `Unreadable` must carry the revisions; merely assigning the decision to the future consumer cannot close missing Rust wire data.

3. The round-3 retention correction still states a false universal headline. It says every admitted observation is held until acknowledgement or overflow (`docs/decisions/2d-4a-notes.md:3`), while its own correction immediately admits two additional rejection causes: replaced epoch and sequence at or below the watermark (`docs/decisions/2d-4a-notes.md:25`). Both are implemented by returning before insertion (`src-tauri/src/reconciliation.rs:872`). Exact interleavings:

   - An observation passes ledger admission under epoch 1, pauses, the queue adopts epoch 2, then `enqueue` rejects it.
   - After `drain(10)`, an admitted same-epoch sequence 5 reaches `enqueue`; it is counted and dropped without acknowledgement or overflow.

   One command position is also false in the opposite direction: “kept only until an overflow evicts it” omits removal by acknowledgement (`src-tauri/src/commands.rs:1314`, `src-tauri/src/commands.rs:1321`). The claimed identical boundary was therefore not achieved.

## Low

1. The specific refused “prefer a currently redundant entry” policy is correctly rejected, but §12.4 overgeneralizes its counterexample into a false rule. Under the recorded preference—lowest currently folded entry, otherwise lowest—the `S,T,S,S,S` history with capacity 3 retains `{1,2,5}` for arrival `1,2,3,4,5` and `{2,4,5}` for `1,3,4,5,2`, confirming the stated counterexample (`docs/decisions/2d-4a-notes.md:376`). But the claim that any capacity rule depending on state equality “cannot” be arrival-order independent is false (`docs/decisions/2d-4a-notes.md:1410`). For example, insert then retain the top `K` under any fixed total key containing `(state discriminant, sequence)` is state-dependent and arrival-order independent. The evidence supports refusing this policy, not the universal claim.

2. R9 remains a real unbounded-retention defect after its duplicate was deleted. The core retains every distinct `PathBuf` ever named for the process lifetime (`crates/espansoconfig-core/src/workspace/mod.rs:210`, `crates/espansoconfig-core/src/workspace/mod.rs:214`, `crates/espansoconfig-core/src/workspace/mod.rs:267`). Create, stabilize and remove `N` distinct watched paths while regularly draining: the queue stays at or below 256, but `by_path` retains all `N` paths indefinitely. The code’s “tens of files, so it never becomes a consideration” assertion is neither enforced nor measured (`crates/espansoconfig-core/src/workspace/mod.rs:218`). Deleting the second map closes duplication, not this resource bound, as the record itself concedes (`docs/decisions/2d-4a-notes.md:1418`).

## Verified without findings

- The new busiest-path selector stores before eviction and removes only the selected path’s lowest sequence (`src-tauri/src/reconciliation.rs:717`, `src-tauri/src/reconciliation.rs:881`). Its state count is irrelevant because it never reads `ObservedState`; four or more paths introduce no new tie shape, and two paths cannot tie on both documented keys because globally unique sequences cannot be both paths’ lowest sequence.
- The selector preserves a suffix per path, so eviction cannot join two state runs. The sampled boundary and repeat-stream tests correctly exercise their stated cases.
- The refused redundancy policy’s concrete `{1,2,5}` / `{2,4,5}` counterexample is valid.
- `AddedContent` gives both projected and non-UTF-8 additions a row and address. Its discriminated shape is usable by 2d-4b and stronger than unrelated optional fields.
- `Box<DocumentView>` is serialization-transparent under Serde; both boxed fields preserve the prior JSON value shape.
- Current `src-tauri` production code uses public `identity_of` only for the intended non-UTF-8 `Added` case; the other occurrence is a test helper. No separate misuse exists in this tree.
- The fourteen correction positions and §12.2’s three evidence-table corrections otherwise match the implementation. The old §7 table remains historical, but the prose accurately identifies the changed test names and `AddedContent` access.
- The liveness-comment rewording was an honest false-positive removal: it concerns eviction selection, not whether a path is observed again. I found no other round-3 liveness claim hidden from the current phrase family.
- R10 is conservative but bounded: repeats can consume all 256 slots and cause a counted reload, but cannot evict a singleton while their own path has multiple entries.
- The step still draws nothing, makes no open-write-surface decision, and introduces no Tauri dependency into `espansoconfig-core`.

NOT READY — 0 High, 3 Medium, 2 Low findings.

Codex session ID: 01a03ea0-a509-7e51-86ec-99e8b6790a85
Resume in Codex: codex resume 01a03ea0-a509-7e51-86ec-99e8b6790a85

---

## Round 5 — verbatim

Scope: **the round-4 fix**, not the original implementation and not the rounds 1–3 fixes. Commissioned
under the rule that commissioned rounds 2, 3 and 4 — a fix is a change, and the round that reviews it
is not optional. Round 4's own lesson was carried into this brief: *a replacement test can assert the
shape of an answer instead of the property the test it replaced was holding*, so round 5 was asked
whether the round-4 fix's own two tests assert properties or shapes, and what its own new code and its
own new sentences now rest on. It was pointed at the three-arm `ObservedDocument` and its absent
accessor, `address_of` / `address_of_minted`, `ChangedContent` and the operands outside its arms, the
retention sweep's six positions, the liveness-inventory filing, the L2 downgrade, and §13's nine
correction blocks — and at the residues R3, R9 and R10 against this project's precedent that seven
items recorded as bounded residues in Phase 2d-3 were later found to be real defects.

Gates when this round was commissioned, all measured on this clean tree at `657217a` by the
orchestrator: `cargo test --workspace` **1308** passed / 0 failed over **26** result lines all `ok`,
exit 0; `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean;
`cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links` warnings, the
pre-existing count; `cargo tree -p espansoconfig-core | rg tauri` empty; `watch_check::` **20/20**
with 263 filtered out in 69.44 s; `npm test` **2125** in 56 files; `npm run check` **431** files /
0 errors; `npm run build` **184** modules with the server oracle absent and the client oracle present
with 2 matches.

## High

None.

## Medium

1. The retention correction is still false: workspace replacement is a third way a stored entry leaves the queue. Exact sequence: epoch 1 stores sequence 1; no drain acknowledges it and capacity is not exceeded; a successful open allocates epoch 2 and calls `begin_epoch(2)`; `begin_epoch` replaces the entire `QueueState`, discarding the pending entry, watermark, and loss count (`src-tauri/src/reconciliation.rs:924`, `src-tauri/src/reconciliation.rs:934`, `src-tauri/src/reconciliation.rs:947`, `src-tauri/src/commands.rs:680`, `src-tauri/src/commands.rs:699`). This contradicts “a stored entry then leaves this queue in exactly two ways” and the decision record’s claim that every position now carries that exact boundary (`src-tauri/src/reconciliation.rs:78`, `src-tauri/src/reconciliation.rs:84`, `src-tauri/src/reconciliation.rs:1177`, `src-tauri/src/commands.rs:1324`, `docs/decisions/2d-4a-notes.md:49`). The existing replacement test even records that replacement empties pending state (`src-tauri/src/reconciliation.rs:1896`, `src-tauri/src/reconciliation.rs:1903`). The truthful boundary needs a third clause: a stored entry is acknowledged, evicted, or discarded wholesale when the queue adopts a replacement epoch; the third is not counted loss because the successful open itself replaces the authoritative workspace.

## Low

1. `address_of_minted` models an invariant violation as a valid `Named` value whose documented meaning would be false. Today `Workspace::from_tree` and the observation engine both mint through `identity_of`, so if the workspace contains the path its number must equal the snapshot’s (`crates/espansoconfig-core/src/workspace/mod.rs:469`, `crates/espansoconfig-core/src/workspace/mod.rs:473`, `crates/espansoconfig-core/src/watch/engine.rs:1004`). Nevertheless, the helper explicitly contemplates `workspace.document_id(path) == Some(other)` and returns `Named`, even though `Named` claims the open workspace does not hold the path (`src-tauri/src/reconciliation.rs:291`, `src-tauri/src/reconciliation.rs:1339`, `src-tauri/src/reconciliation.rs:1347`). That branch cannot be reproduced on this tree, but if a second identity source is introduced it silently converts a broken invariant into misleading wire data. Match `Some(resolved)` separately, assert that it equals the snapshot identity, and reserve `Named` for `None`. Filing “must answer” as a liveness false positive is honest—the sentence is unrelated to observation progress—but the inventory does not resolve this separate invariant problem (`src-tauri/src/liveness_contract.rs:488`).

2. R9 remains an actual unbounded-retention residue; round 4 corrected the reassurance but did not correct the bound. Exact sequence: during one long process lifetime, create and stabilize distinct paths `P1…PN`, remove each, and drain regularly. Every projected path calls `identity_of`; every first sighting inserts its owned `PathBuf`; nothing removes it, while the reconciliation queue remains capped at 256 (`crates/espansoconfig-core/src/watch/engine.rs:1004`, `crates/espansoconfig-core/src/workspace/mod.rs:305`, `crates/espansoconfig-core/src/workspace/mod.rs:314`, `src-tauri/src/reconciliation.rs:186`, `src-tauri/src/reconciliation.rs:229`). The revised comment now describes that accurately and rejects unsafe identity reuse (`crates/espansoconfig-core/src/workspace/mod.rs:228`, `crates/espansoconfig-core/src/workspace/mod.rs:245`), but documentation and assignment to 2d-5/2d-7 are not a bound (`crates/espansoconfig-core/src/workspace/mod.rs:252`). Against the cited Phase 2d-3 precedent, this should remain an open Low until measured and either bounded safely or accepted with evidence.

3. The strengthened uniform-wire test still checks only the projected variants of both nested content enums. Its two fixtures are a projected `Changed` and projected `Added`, and the loop consequently verifies only `ChangedContent::Projected` and `AddedContent::Projected` as one-key objects (`src-tauri/src/reconciliation.rs:2473`, `src-tauri/src/reconciliation.rs:2503`, `src-tauri/src/reconciliation.rs:2506`). The non-UTF-8 test asserts the Rust `ChangedContent::Unreadable` value but never serializes it (`src-tauri/src/reconciliation.rs:2266`, `src-tauri/src/reconciliation.rs:2285`). Thus the new test is property-oriented where it runs—wire shape is its property—but §13.2 overstates it as covering the nested enums generally (`docs/decisions/2d-4a-notes.md:1712`). Serialize at least the two unreadable content variants as well, so a future unit-variant or Serde-shape regression cannot retain this green test.

## Verified without findings

- The two principal round-4 tests protect behavior rather than merely spelling. The replacement test first proves the successor workspace neither contains the path nor accepts the old identity, then requires `Named` with both identity and path (`src-tauri/src/reconciliation.rs:2402`, `src-tauri/src/reconciliation.rs:2410`, `src-tauri/src/reconciliation.rs:2429`). The non-UTF-8 change test requires the outer observation to remain `Changed`, preserves both independently computed revisions, and requires an unreadable reason instead of projection text (`src-tauri/src/reconciliation.rs:2251`, `src-tauri/src/reconciliation.rs:2267`, `src-tauri/src/reconciliation.rs:2276`, `src-tauri/src/reconciliation.rs:2285`).

- The two renamed round-3 tests also retain their underlying properties. One drives `Added → non-UTF-8 Changed → Removed` and requires both later observations to name the exact identity previously issued without claiming backend addressability (`src-tauri/src/reconciliation.rs:1765`, `src-tauri/src/reconciliation.rs:1778`, `src-tauri/src/reconciliation.rs:1810`). The other requires a first non-UTF-8 addition to carry a row, reason, and identity that its later removal names (`src-tauri/src/reconciliation.rs:1822`, `src-tauri/src/reconciliation.rs:1846`, `src-tauri/src/reconciliation.rs:1866`, `src-tauri/src/reconciliation.rs:1871`).

- Merging the two origins of `Named` is usable by a correct 2d-5 consumer. It need not reconstruct the history: if its current model contains the identity, it can invalidate/update that model; if it does not, it must not treat the number as a backend address and can use the path for the unreadable/removal presentation. The variant explicitly says only that the backend workspace lacks the path and records both possible histories (`src-tauri/src/reconciliation.rs:291`, `src-tauri/src/reconciliation.rs:302`). The batch epoch separately rejects an entire stale generation (`src-tauri/src/reconciliation.rs:642`).

- Rust cannot force future frontend behavior, but it can force an exact TypeScript mirror once 2d-4b exists by adding `ObservedDocument` to the existing variant and operand comparisons (`src-tauri/src/wire_contract.rs:1031`, `src-tauri/src/wire_contract.rs:1152`). That obligation is presently recorded as R6 and belongs to the explicitly separated TypeScript half (`docs/decisions/2d-4a-notes.md:1108`, `docs/decisions/2d-4-split-notes.md:31`). Renaming the two shared operands would add friction but would not prevent a consumer from deliberately normalizing and ignoring the tag.

- R3 is substantively closed. Every `Changed` obtains `disk_revision` through the total `StableContent::revision`, preserves `previous_revision`, and selects only the projection/reason arm afterward (`crates/espansoconfig-core/src/watch/engine.rs:364`, `src-tauri/src/reconciliation.rs:1207`, `src-tauri/src/reconciliation.rs:1230`). A consumer can arbitrate the transition and invalidate an old projection from `Changed::Unreadable`; it cannot compare or display unavailable non-UTF-8 text, which is deliberate. Stable read failures correctly remain the separate `ExternalObservation::Unreadable`, where no bytes and therefore no revision exist (`src-tauri/src/reconciliation.rs:507`, `src-tauri/src/reconciliation.rs:515`).

- The liveness inventory entry is not a dodge. “Must answer with the same number” concerns identity equality, whereas the canonical liveness contract concerns whether hints, debts, ticks, and settlements ever produce observations (`crates/espansoconfig-core/src/watch/liveness.rs:79`, `src-tauri/src/liveness_contract.rs:488`). Filing preserves evidence that the hit was judged; the invariant issue is reported separately above.

- Queue concurrency and ordering remain correct. Enqueue performs the epoch and watermark checks, insertion, and eviction under one queue mutex; drain advances the watermark, removes acknowledged entries, folds, and projects under that same mutex (`src-tauri/src/reconciliation.rs:1006`, `src-tauri/src/reconciliation.rs:1015`, `src-tauri/src/reconciliation.rs:1093`). Wake emission occurs after releasing it (`src-tauri/src/reconciliation.rs:1165`). Workspace replacement holds the session lock while the ledger and queue adopt the successor epoch before starting its watcher (`src-tauri/src/commands.rs:684`, `src-tauri/src/commands.rs:699`, `src-tauri/src/commands.rs:705`).

- The coalescing fold is a pure sequence-order fold and preserves `Removed → Added`; the eviction selector removes only the lowest sequence of the busiest path, preserving per-path suffixes and preventing repeat-heavy paths from evicting a singleton while they retain multiple entries (`src-tauri/src/reconciliation.rs:795`, `src-tauri/src/reconciliation.rs:801`, `src-tauri/src/reconciliation.rs:851`, `src-tauri/src/reconciliation.rs:861`). R10 is therefore conservative but genuinely bounded by `QUEUE_CAPACITY` (`src-tauri/src/reconciliation.rs:207`, `src-tauri/src/reconciliation.rs:229`).

- The hard scope boundaries remain intact: 2d-4 draws nothing and makes no write-surface decision (`docs/reviews/phase-2d-design.md:124`); the core manifest contains no Tauri dependency (`crates/espansoconfig-core/Cargo.toml:15`); and the application shell has one call to `save_document`, in the shared save tail (`src-tauri/src/commands.rs:1931`).

NOT READY — 0 High, 1 Medium, 3 Low findings.

Codex session ID: 01a03faa-8450-7672-a78a-356908c41f8d
Resume in Codex: codex resume 01a03faa-8450-7672-a78a-356908c41f8d

---

## Round 6 — verbatim

Scope: **the round-5 fix**, not the original implementation and not the rounds 1–4 fixes. Commissioned
under the rule that commissioned rounds 2, 3, 4 and 5 — a fix is a change, and the round that reviews
it is not optional. Round 5's own lesson was carried into this brief: *every round so far counted the
ways a stored entry leaves the queue by the entry's own properties, and none counted the one that
depends on nothing about the entry at all*, so round 6 was asked what **else** in this step is
described by a rule written from the thing's own properties and made false by a whole-state
replacement — naming the coalescing fold, `evictable_sequence`, the watermark, the wake, `discarded`
and the sequence allocator as the candidates. It was also pointed at the twelve retention positions in
**both** directions, at a possible thirteenth position and a fifth mutation of `QueueState::pending`,
at the `debug_assert_eq!` on a path a Tauri command reaches, at the changed `commands.rs` fixture
against the charge §14.4 lays against it itself, at the `UnreadableReason` walk's three-of-six
coverage argument, at R3/R9/R10 against the Phase 2d-3 precedent, and at §14's six correction blocks
and §14.2's by-file list against `git show --stat eced554`.

The brief closed with the standing instruction that **if everything found were a restatement of the
retention-boundary wording with no new substance, the round was to say so explicitly** — the owner
having a standing decision to stop the tail and build a mechanical check in that case. It did not say
so: it **cleared** the twelve positions and the fifth-mutation question and found the same *shape* one
level above, on the watermark.

Gates when this round was commissioned, all measured on this clean tree at `345f066` by the
orchestrator: `cargo test --workspace` **1308** passed / 0 failed over **26** result lines all `ok`,
exit 0; `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean;
`cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links` warnings, the
pre-existing count; `cargo tree -p espansoconfig-core | rg tauri` empty; `watch_check::` **20/20**
with 263 filtered out in 70.68 s; `npm test` **2125** in 56 files; `npm run check` **431** files /
0 errors; `npm run build` **184** modules with the server oracle absent and the client oracle present
with 2 matches.

## High

None.

## Medium

1. The watermark guarantee still ignores whole-state replacement. `begin_epoch` resets `acknowledged` to zero, but four public positions claim `newest_sequence` never falls below the highest watermark this queue/session has ever seen and may be stored unconditionally ([reconciliation.rs](src-tauri/src/reconciliation.rs:683), [reconciliation.rs](src-tauri/src/reconciliation.rs:1135), [commands.rs](src-tauri/src/commands.rs:1342), [commands.rs](src-tauri/src/commands.rs:3492)). The decision record makes the same process-lifetime claim ([2d-4a-notes.md](docs/decisions/2d-4a-notes.md:347)).

   Exact sequence:

   1. Epoch 1 drains with watermark 9, producing `newest_sequence == 9`.
   2. `begin_epoch(2)` replaces the state with `acknowledged == 0`.
   3. `drain(0)` on the empty successor returns `newest_sequence == 0`.

   That follows directly from the fresh-state assignment and drain fallback ([reconciliation.rs](src-tauri/src/reconciliation.rs:992), [reconciliation.rs](src-tauri/src/reconciliation.rs:1145)). Round 5’s strengthened test expressly proves that replacement resets the watermark ([reconciliation.rs](src-tauri/src/reconciliation.rs:1714)). The code is right because sequences and watermarks are epoch-scoped; the guarantee needs the same qualification. A correct consumer first validates the epoch, but “ever” and “this session” currently over-claim.

## Low

1. `debug_assert_eq!` leaves a contradictory release wire if its invariant ever fails. In debug, disagreement panics while `drain_external_changes` holds the queue and session locks. In release, the assertion disappears and `address_of_minted` returns the workspace’s identity ([reconciliation.rs](src-tauri/src/reconciliation.rs:1419)), while the accompanying `DocumentView.id` and its `MatchId.document` still carry the snapshot’s identity ([document.rs](crates/espansoconfig-core/src/model/document.rs:101), [match_view.rs](crates/espansoconfig-core/src/model/match_view.rs:84)). That is not merely an `Addressable` arm which is locally true; it is one `Changed` object containing two document identities.

   Exact sequence: open path `P` as identity `X`; enqueue a projected `Changed` for `P` whose snapshot carries `Y != X`; drain. Debug panics, while release returns outer `document = X` and `content.Projected.disk.id = Y`. This is precisely the branch §14.4 concedes is untested ([2d-4a-notes.md](docs/decisions/2d-4a-notes.md:2085)). Nearby new prose is also internally contradictory: it first says there is “no second source to depend on agreeing,” then requires agreement, and incorrectly says a path is in both sources or neither—newly projected additions are in the register but not the open workspace ([reconciliation.rs](src-tauri/src/reconciliation.rs:1390)).

   Current production minting does preserve the invariant, so this remains Low: workspace discovery and watcher projection both use `identity_of`, while non-UTF-8 additions also mint there ([workspace/mod.rs](crates/espansoconfig-core/src/workspace/mod.rs:469), [engine.rs](crates/espansoconfig-core/src/watch/engine.rs:997), [reconciliation.rs](src-tauri/src/reconciliation.rs:1293)). But a release fallback that emits split identities is not a valid invariant-failure policy.

2. The new `UnreadableReason` walk repeats the exact coverage argument round 5 rejected one level above. The enum has six variants ([reconciliation.rs](src-tauri/src/reconciliation.rs:383)); the serialization walk exercises only `PermissionDenied` and `NotUtf8`—with `NotUtf8` duplicated—while `Other` is checked only as a Rust value and `InvalidData`, `TimedOut`, and `Interrupted` are never serialized ([reconciliation.rs](src-tauri/src/reconciliation.rs:2413), [reconciliation.rs](src-tauri/src/reconciliation.rs:2691)). A coherent change of `InvalidData {}` to a unit variant would make it serialize as a bare string while this test stayed green. §14.4 admits the gap and substitutes uniform reasoning for coverage ([2d-4a-notes.md](docs/decisions/2d-4a-notes.md:2109)); that is not sufficient for D5’s per-arm wire rule.

3. R10’s correction overstates which document a repeat stream can evict. The record says the repeat stream “can only displace its own document’s older entries” and no longer consumes another document’s capacity ([2d-4a-notes.md](docs/decisions/2d-4a-notes.md:1299)). The policy instead breaks equal-count ties by the lower lowest sequence ([reconciliation.rs](src-tauri/src/reconciliation.rs:847)).

   Exact sequence at capacity 256:

   1. Path B holds sequences 1 and 2.
   2. 253 singleton paths hold sequences 3–255.
   3. Path A holds sequence 256.
   4. An identical repeat for A arrives at sequence 257.

   A and B now each hold two entries. The tie chooses B’s lowest sequence 1, so A’s repeat evicts another document’s entry and increments `discarded`. The narrower implemented guarantee—never evict a singleton while another path has two—remains true. R10 is bounded, but its recorded closure is false.

4. R9 remains a real, known-open defect, not a bounded residue. `SessionIdentities::by_path` retains every path for the process lifetime ([workspace/mod.rs](crates/espansoconfig-core/src/workspace/mod.rs:201)); every first `identity_of` inserts and nothing removes ([workspace/mod.rs](crates/espansoconfig-core/src/workspace/mod.rs:305)). Repeatedly create, stabilize, and remove distinct watched paths `P1…PN` while draining: the queue stays capped at 256, while the register retains all N. Round 5 now records this honestly ([2d-4a-notes.md](docs/decisions/2d-4a-notes.md:1263)), but its deliberate no-change answer leaves the Low open.

5. §14.2 is not actually file-by-file. It lists four files ([2d-4a-notes.md](docs/decisions/2d-4a-notes.md:2008)), while commit `eced554` touched five: it omits `docs/reviews/phase-2d-4a-queue.md`, where the 65-line round-5 record was added ([phase-2d-4a-queue.md](docs/reviews/phase-2d-4a-queue.md:228)).

## Verified without findings

- All twelve round-5 retention positions now describe the actual three exits. I found no fifth mutation of `QueueState::pending`: insertion and eviction are in `enqueue`, acknowledgement uses `retain` in `drain`, and replacement assigns a fresh `QueueState` in `begin_epoch` ([reconciliation.rs](src-tauri/src/reconciliation.rs:992), [reconciliation.rs](src-tauri/src/reconciliation.rs:1051), [reconciliation.rs](src-tauri/src/reconciliation.rs:1145)). `queueing_sink` is an admission-boundary statement rather than an omitted retention position ([reconciliation.rs](src-tauri/src/reconciliation.rs:1201)).

- Coalescing remains a sequence-order fold over current pending state; replacement cannot combine runs across epochs. `Removed` and recreated content remain distinct states ([reconciliation.rs](src-tauri/src/reconciliation.rs:796)).

- Wake races remain safe: storage precedes emission, and a wake delayed across replacement carries the old epoch and is expendable ([reconciliation.rs](src-tauri/src/reconciliation.rs:1213)). `discarded` is correctly cumulative only within an epoch and reset on replacement.

- The ledger sequence allocator is reset with the epoch, and the queue’s independent epoch fence rejects an old admitted value arriving after replacement ([ledger.rs](src-tauri/src/ledger.rs:1120), [reconciliation.rs](src-tauri/src/reconciliation.rs:998)).

- The commands fixture change is legitimate. Its production-shaped projection now mints from the observation’s real path ([commands.rs](src-tauri/src/commands.rs:8803)). Other tests fabricate `DocumentId`s through `DocumentContext::detached`, including wire, save, and core projection tests, but those are isolated projections and do not compare their snapshot against a live workspace ([wire_contract.rs](src-tauri/src/wire_contract.rs:156), [save.rs](src-tauri/src/save.rs:440), [document.rs](crates/espansoconfig-core/src/model/document.rs:76)).

- R3 is substantively closed: non-UTF-8 `Changed` preserves both revisions outside `ChangedContent`, and non-UTF-8 `Added` carries a row and identity ([reconciliation.rs](src-tauri/src/reconciliation.rs:1255), [reconciliation.rs](src-tauri/src/reconciliation.rs:1293)). R10’s actual resource bound and singleton-protection rule are sound despite the false victim-locality sentence.

- The liveness contract was not over-applied: it expressly denies eventual emission, continued ticking, worker survival, and survival of ordinary hints ([liveness.rs](crates/espansoconfig-core/src/watch/liveness.rs:79)).

- Scope prohibitions hold. Commit `eced554` touched no Svelte, TypeScript, i18n, or core file; the step draws nothing and decides no write-surface state as required by Q7 item 4 ([phase-2d-design.md](docs/reviews/phase-2d-design.md:124)). The core manifest has no Tauri dependency ([Cargo.toml](crates/espansoconfig-core/Cargo.toml:10)), and the application still has one `save_document` call in the shared save tail ([commands.rs](src-tauri/src/commands.rs:1942)).

NOT READY — 0 High, 1 Medium, 5 Low findings.

Codex session ID: 01a03ff1-0d15-7423-82df-300113b0e626
Resume in Codex: codex resume 01a03ff1-0d15-7423-82df-300113b0e626

## Round 7 — verbatim

Scope: **the round-6 fix, plus the mechanism Phase 2d-4a-C built on top of it** — `src-tauri/src/prose_sweep.rs` and `src-tauri/src/retained_state_contract.rs`, which did not exist when rounds 1 to 6 ran. Commissioned by the same rule as rounds 2 to 6, in the form `CLAUDE.md` §7.1 now states it: round 6's fix changed source, so a round is owed, scoped to that change. The brief carried §15.4's own nominations — the panic policy's prose, which claims a trade over a runtime nothing measures; the epoch-scoped watermark wording, a new claim at what §15.2 called nine positions and therefore exactly the shape every previous round's fix had left a narrower instance of; and the new `#[should_panic]` test's comment, which asserts what a `debug_assert_eq!` would have measured. It was also asked whether the two new contract modules state their own limits truthfully.

**This round was reviewed by the adversarial Opus fallback, not by Codex.** Codex hit its usage limit mid-job, 221 s in, and the workflow's one-bounded-attempt-per-invocation rule meant it was not relaunched. The review's own first line says so and is kept below for that reason. The round also ran under `/goahead-opus`, whose cap of two review invocations and forty-five minutes per phase binds tighter than this project's §7 (`CLAUDE.md` §7.4).

Gates when this round was commissioned, all measured on this clean tree at `93fb76b` by the orchestrator: `cargo test --workspace` **1313** passed / 0 failed over **26** result lines all `ok`, exit 0; `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean; `cargo doc --workspace --no-deps` exit 0 with **73** `private_intra_doc_links` warnings and 0 unresolved; `cargo tree -p espansoconfig-core | rg tauri` empty; `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` **20/20** with **268** filtered out in 75.66 s; `npm test` **2125** in 56 files; `npm run check` **431** files / 0 errors / 0 warnings; `npm run build` **184** modules with the server-build oracle absent and the client-build oracle present with 2 matches.

Reviewer: adversarial Opus fallback — Codex unavailable (usage limit, resets 19:07)

## Verdict

NOT READY — 0 High, 1 Medium, 4 Low; every finding is prose in a source file, none is a behaviour
defect. **(a), narrowly**: each names a specific false sentence or unstated hole, so none is a bare
restatement — but four of five sit in sites §15.4 or the brief had already nominated, and round 6
changed code twice where round 7 finds nothing that would.

## High

None.

## Medium

1. **The panic policy borrows a justification that is false of one of the two mutexes it covers.**
   `src-tauri/src/reconciliation.rs:1469` says *"`crate::commands`'s module header is why the two
   poisoned mutexes are not a second failure"*. That header (`commands.rs:220-228`) grounds
   absorption in three properties of the session mutex: behind it sits **a cache over the disk**,
   **every mutation is a single infallible assignment**, and **the recovery is `reload_document`**.
   None holds of `QueueState`: nothing can re-read lost observations; `drain` mutates it with
   **two** statements — `acknowledged` (`:1186`) then `retain` (`:1187-1189`) — before reaching the
   `assert_eq!` at `:1480`; and no `reload_document` recovers a queue.

   Failure state: the assertion fires mid-`collect`, both locks are poisoned and absorbed, and the
   queue is left with `acknowledged` raised and the prefix pruned while the caller got no batch.
   The conclusion happens to hold — both mutations are pure functions of `after_sequence`, so the
   surviving state is consistent and a retry with the same watermark reproduces the batch — but
   **that reason is stated nowhere** and the one stated does not apply. §15.4 called this prose thin
   for a different reason (the unmeasured runtime).

## Low

1. **Two positions in one file contradict each other about the same arm.**
   `reconciliation.rs:1459` says the `Addressable` arm carrying the workspace's number *"was
   locally true and the object held two identities for one file"*. The new test's comment,
   `reconciliation.rs:2677`, says *"There is no arm of `ObservedDocument` that is true in that
   case"*; §15.1's L1 row repeats the second. The first is right — `Addressable { resolved }` is
   true of what it carries; what is false is the **observation**, whose projection carries the
   snapshot's id.

2. **"Nine source positions" is at least eleven, and the two omitted are wording, not assertions.**
   §15.2 files `adopting_an_epoch_discards_the_previous_ones_entries_and_its_losses` under *gained
   two assertions*, but it also gained two prose blocks stating the claim,
   `reconciliation.rs:1770-1774` and `:1794-1801`. Both are correct — but §15.4 sends round 8 to
   §15.2's list of nine, and these are not on it.

3. **`prose_sweep` joins wrapped comments but not wrapped string literals, and neither guard states
   it.** `prose_sweep.rs:125` frames per-line handling of non-comment lines as a benefit. But this
   repository hand-wraps assertion messages with backslash continuations (e.g.
   `reconciliation.rs:1786`), and a claim split across such a break matches nothing — exactly as a
   wrapped comment would have. `retained_state_contract.rs:58` claims the check "catches an
   *unmarked* claim and a *new* claim"; its four stated limits omit this one. Re-running the
   sweep's algorithm over a continuation-joined copy of both trees for all 88 phrases finds **zero**
   hidden positions today, so this is a hole in stated capability, not a live miss.

4. **A fifth "same batch twice" position carries neither qualification.** `commands.rs:8838`: *"the
   same call answers the same batch until the caller says it has one of them."* The four others
   (`reconciliation.rs:102`, `:1157`, `commands.rs:1324`, `:3474`) all carry *when nothing was
   enqueued between the two calls and no replacement epoch was adopted between them*.

## Verified without findings

- Within-epoch monotonicity is real, not merely documented: `acknowledged` only rises
  (`reconciliation.rs:1186`), `newest_sequence` is `max(batch high, acknowledged)` (`:1207-1211`),
  and an eviction only accompanies a higher-sequence admission. The nine enumerated positions agree
  and none is over-narrow.
- `evictable_sequence` (`reconciliation.rs:920-935`) matches its doc and clause 5:
  `min_by_key((Reverse(count), lowest))`. R10's narrowed closure and its tie sentence are accurate.
- "Same batch twice" survives drain-time projection: `entries` is written only by `from_tree`
  (`crates/espansoconfig-core/src/workspace/mod.rs:483-496`) and `open` mints a new `Workspace`
  with a new epoch, so `address_of` is constant within an epoch.
- Lock extent is as documented: `with_workspace_read` (`commands.rs:1446-1455`) holds only the
  session mutex, `drain` the queue mutex under it, and the identity register
  (`workspace/mod.rs:313-329`) is released before the assertion.
- `complaints_against` (`prose_sweep.rs:326-403`) is sound both ways; its three inventory
  pre-checks are unconditional.
- Every arm of `ObservedDocument`, `AddedContent` and `ChangedContent` is serialized in
  `every_observation_crosses_as_a_uniform_object_and_carries_no_anchor`, so no second wire enum
  repeats the coverage-versus-argument gap.

## Questions

- Should `src/` join `SWEPT_TREES`? 2d-4b will write TypeScript storing `newest_sequence`;
  `retained_state_contract.rs` explains why `docs/` is excluded and says nothing about the frontend
  tree, so its limits list reads exhaustive and is not.
- §7.1: all five are fixed by editing comments in source files, so **any fix commissions round 8**.
  To stop, the cheapest honest close is to fix none and carry all five as recorded items.

## Not verified

- What a panic inside a Tauri command does to the process or the webview — unchanged from §15.4.
- R9's identity register — unmeasured for a third round, and unmeasurable from a test in this
  binary because the register is a process-wide static.
- The R10 tie case: confirmed by reading `min_by_key`, not by execution.
- Anything needing `cargo` or `npm` — the caller's gates were taken as given.

## Round 8 — verbatim

Scope: **the round-7 fix round**, and nothing else — ten comment hunks across five files in
`src-tauri/src/`, plus the two record files. Commissioned by `CLAUDE.md` §7.1: the round-7 fix
changed source files, and a fix that changes source is owed a round. The brief was narrow by
construction and named the fix round's own claims as the things to verify rather than to accept:
that no executable line changed, that the appended round-7 text is verbatim, that §16.3's gate cells
are all `pending` because the fix worker was forbidden to run Cargo, that the Python replica of the
prose sweep reads as a replica and not as evidence, and — the highest-risk item — that M1's
*substituted* claim is true, the fix round having **refused** the round-7 reviewer's own proposed
reasoning and put a different one in its place.

**This round was the adversarial Opus fallback, not Codex**, for the same reason round 7 was: the
Codex job for round 7 failed 221 s in on *"You've hit your usage limit ... try again at 7:07 PM"*,
and under `~/.claude/scripts/goahead-base.md` a Codex limit is one bounded attempt spent, never a
relaunch. It is the phase's **second and last** review invocation: the workflow caps a phase at two,
and its 45-minute tail clock had already expired when this round was dispatched.

Gates when this round was commissioned — measured on the tree at `93fb76b` by the orchestrator,
before the round-7 fix, and unchanged by that fix in principle because it altered no executable
line: `cargo test --workspace` **1313** passed / 0 failed over **26** result lines all `ok`, exit 0;
`cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean; `cargo doc
--workspace --no-deps` exit 0 with **73** `private_intra_doc_links` warnings and 0 unresolved;
`cargo tree -p espansoconfig-core | rg tauri` empty; `watch_check::` **20/20** with 268 filtered out
in 75.66 s; `npm test` **2125** in 56 files; `npm run check` **431** files / 0 errors; `npm run
build` **184** modules with the server-build oracle absent and the client-build oracle present with
2 matches.

Reviewer: adversarial Opus fallback — Codex unavailable (usage limit, resets 19:07)

## Verdict

NOT READY — 0 High, 1 Medium, 2 Low; every finding is prose in a source file or the record, none is
a behaviour defect, and the fix round's central claim (no executable line changed) is verified true.

## High

None. Every added/removed line under `src-tauri/src/` is a `//`, `///` or `//!` line — checked
mechanically by stripping `+`/`-` and leading whitespace from `git diff -U0` and finding no residue.
No test, fixture, phrase table or inventory entry moved. §16.3 records every gate as `pending` with
no measured number anywhere in the table; the only numbers it reports are labelled a Python replica,
and the paragraph beneath says in as many words *"It is a replica and not the test"*, names the two
real guards, and says the replica "can agree with a wrong implementation of itself". That is honest.

## Medium

1. **M1's replacement paragraph denies two escapes the code allows.**
   `src-tauri/src/reconciliation.rs:1489-1493` states *"a later drain at any watermark below the
   offending entry's sequence reaches this assertion again — and the caller cannot acknowledge past a
   sequence it was never handed"*, under the heading *"What that does not buy is a queue this caller
   can drain."* Both sentences claim an enforcement the code does not have.
   - `after_sequence` is an unvalidated `u64` off the wire (`commands.rs:3491-3495` →
     `commands.rs:1353-1359` → `reconciliation.rs:1184`). Nothing checks it against anything handed
     out; a caller passing any value above the offending sequence has the entry pruned by the
     `retain` at `:1187` before the projection, and drains cleanly.
   - `ReconciliationQueue::begin_epoch` (`:1029-1031`) assigns `QueueState::empty(epoch)` over the
     whole state, so reopening the workspace discards the offending entry outright.

   Failure state: a reader follows this paragraph, believes the queue is wedged for the epoch, and
   reasons about recovery from a premise the code contradicts twice. It errs pessimistic, so nothing
   unsafe follows from it — but the paragraph exists precisely to stop a sentence that does not reach
   its conclusion, and this is one, three lines below the assertion it is about. §16.1's M1 row and
   its first disagreement bullet repeat it (*"the caller cannot acknowledge past the offending entry
   because it was never handed its sequence"*), so the fix is at three positions.

   The rest of the paragraph is **true and I verified it line by line**: `guard.acknowledged = …`
   (`:1186`) and `pending.retain` (`:1187-1189`) both complete before `coalesced_sequences` and
   before the `.map(external_observation)` inside the `.collect()` (`:1191-1197`) that reaches
   `external_observation:1307` → `address_of_minted:1500`. `discarded` and `epoch` are untouched by
   `drain`, so the surviving state is exactly what a completed `drain(after_sequence)` leaves.

## Low

1. **Two record sentences mis-describe the direction of the review's span errors.**
   `docs/decisions/2d-4a-notes.md` §15.2's round-7 correction and §16.1 say the corrected spans are
   *"each a line wider at one end than the review's"* and that the review's are *"each a line short
   at one end"*. Measured on `93fb76b`: the first block is `1771-1774` against the review's
   `1770-1774` — a line **narrower**, not wider; the second is `1794-1802` against `1794-1801` — a
   line wider. Both spans themselves are correct; the characterisation of one of them is not.

2. **"Fifteen positions" counts three pointers as statements of the claim.** The same correction
   block says three of the nine *"now point at it rather than restating it"*, then calls
   `retained_state`'s clause 6 a *"fifteenth"* — 14+1 only if the three pointers still count.
   §16.4's second bullet then calls it *"the fifteen-position epoch-scoped watermark family"* whose
   positions are *"kept identical by a reader"*, which is not what a pointer is. The block hedges
   ("re-derive the positions from the tree"), so the harm is bounded.

## Verified without findings

- **Verbatim reproduction is exact.** `docs/reviews/phase-2d-4a-queue.md`'s appended block, from its
  `Reviewer:` line onward, is byte-identical to `docs/reviews/phase-2d-4a-round-7.md` after `### `→
  `## ` demotion — 97 lines against 97, zero diff hunks.
- **L4's "six positions" is right.** `reconciliation.rs:102-106`, `:1158`, `:1842`, `commands.rs:1324`,
  `:3474`, `:8839` — all six now carry both qualifications.
- **L1's four positions**: source at `reconciliation.rs:2704`, record at §3.3 (`:812`), §15.1
  (`:2317`) and §15.4 (`:2518`). The uncorrected `:2016` is inside a `>` quote of an earlier round and
  correctly left.
- **§16.2's by-file list matches `git diff --stat`**: 7 files, 3 comment blocks in `reconciliation.rs`,
  1 in `commands.rs`, and it names `phase-2d-4a-round-7.md` as the untracked eighth path.
- **§16.4's marks are honest.** Nothing marked *recorded only* names a source defect; the three
  *actionable* items name a re-runnable check, a deliberately-left assertion message and six `docs/`
  positions — none a correctness defect in source, so none is a blocker.
- `retained_state_contract.rs:106-116`'s `src/` clause takes no decision and states the gap.

## Questions

- Does `SWEPT_TREES` excluding `src/` deserve a 2d-4b acceptance criterion rather than a sentence?

## Not verified

- Any gate: forbidden to run `cargo`/`npm`.
- The five provenance attributions in §16.1's L2 bullet (`eced554` / `6be7231`) — the five positions
  exist and their text matches, but I did not run `git log -S` on each to confirm which commit
  introduced which. §16.4 already nominates this as thin.
- The replica's 88/140/224/0 and 61/86/129/0 counts, which need execution.

## Round 9 — filed, and deliberately not reproduced here

Round 9's report is `docs/reviews/phase-2d-4a-round-9.md`, written by the reviewer itself and complete
there: `do-not-ship`, 2 High and 3 Medium, against the round-8 fix alone. **It is not copied into this
file, and its absence is not a skipped step.** This queue exists to preserve replies that lived only
in a transcript — which is what rounds 1 to 6 were — and round 9's reply was a file from the moment it
was written, so a copy here would be a second text to keep in step with no reply to rescue.
`docs/decisions/2d-4a-notes.md` §18 is the record of the round.
