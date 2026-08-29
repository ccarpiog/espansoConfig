## Round 1 — step 1, the contract and its pointers

### Verdict

**NOT READY.** The consolidation is useful, the boundary and placement are defensible, and the ledger's corrected four-item record list now matches `decide`. But guaranteed clause 9 overstates the lifetime of a `CommitAnchor`: the map slot/latest-commit fact lasts for the epoch, while the concrete retained value is replaced by every later commit to the same path. The source passage the clause cites makes the same claim, so step 2 would mechanically protect a false canonical statement.

This is not merely another copy of rounds 5 and 6's wording. It is a new, narrower instance of the same defect shape: the contract changes from talking about an epoch-lived per-path fact to talking about an individual value without preserving the qualification. That is substantive enough to keep the tail open.

### Findings

1. **High — `crates/espansoconfig-core/src/watch/retained_state.rs:131`: guaranteed clause 9 gives an individual commit anchor an epoch lifetime, although `WriteLedger::record_app_write` replaces the `CommitAnchor` value on every later commit to the same path.** The clause says “a commit anchor lives as long as the epoch” and “Exactly one thing removes an anchor: the workspace replacement.” In `src-tauri/src/ledger.rs:1270`, however, `latest_commit_at.insert(path, CommitAnchor { ... })` drops and replaces any earlier value for that path before the epoch ends. What is epoch-lived is the map entry/latest-commit chronology fact, not each `CommitAnchor` value. The distinction matters here because the new module defines its family as retained “values” at lines 18–20. The same overstatement remains in the cited source at `src-tauri/src/ledger.rs:789` (“Its life is the epoch and nothing shorter” and “removed by ... `begin_epoch` alone”), while the local insertion comment at `src-tauri/src/ledger.rs:1258` correctly says that a later anchor replaces the earlier one. This is a prose-only finding: state the guarantee in terms of the per-path slot/latest anchor being maintained until epoch replacement, while allowing later commits to supersede its value.

2. **Low — `crates/espansoconfig-core/src/watch/retained_state.rs:8`: the introduction calls the three discoveries “three consecutive review rounds,” but its own enumeration is round 5, round 6, and this implementation step.** Step 1's internal discovery was not a third review round, and no round 7 had run when this text was written. The nearby sentence at line 12 already gives the accurate description (“this step found a third instance”), so the “consecutive review rounds” framing should be narrowed to three consecutive audits/fix passes or simply three discoveries. This is the likeliest purely new prose residue outside the numbered clauses.

### Clause audit

I derived all 17 numbered clauses from the named implementation sites rather than from either decision record.

- G1 matches `SessionIdentities::by_path`, `identity_of`, and `identity_already_issued`: insertion is process-wide and there is no removal. Its pairing with N1 is honest; R9 remains open, uncapped, unevicted, and unmeasured. Merely writing the condition into the contract does not close it.
- G2 matches the two `begin_epoch` implementations and their composition in `WorkspaceSession::open`: the ledger clears its five epoch-scoped fields, the queue replaces its whole `QueueState`, and the tally is deliberately left standing. The derived wire values remain semantically epoch-scoped through their epoch tags; the clause's concrete reset list does not claim that already-returned batches cease to exist.
- G3 matches the ledger allocator and admission path in production: the mutex serializes allocation, only `Admission::Admitted` spends a number, and `begin_epoch` resets the allocator. The public shell types do not encode uniqueness, but the clause is true of the application pipeline it defines.
- G4 matches all four `pending` mutation sites. A stored production entry is removed by `drain`'s `retain`, overflow's `remove`, or `begin_epoch`'s whole-state replacement. `insert` would replace an equal key and create a fourth route, but G3's production allocator makes that key collision unreachable; the queue documentation states that type-system limitation beside the insertion. This remains one of step 2's highest-risk sites because no test or type forces the topology, but it is not a false claim about the current application.
- G5 matches `QUEUE_CAPACITY`, insert-before-evict, and `evictable_sequence`'s `Reverse(count), lowest` ordering. The one-entry-versus-two invariant is exactly as narrow as the implementation; it does not inherit R10's former stronger claim.
- G6 matches `drain`: `acknowledged = max(old, argument)`, removal uses the call's argument, and `newest_sequence` is finally maxed with the retained acknowledged watermark. `begin_epoch` replaces that watermark, so the successor can return zero. The new wording is correctly scoped to the epoch named by the batch.
- G7 matches the two increments in `enqueue`, the absence of a drain reset, and `QueueState::empty` on replacement. Wrong-epoch arrivals are deliberately outside that epoch's loss history and are not counted.
- G8 matches `LedgerState::tally`: `begin_epoch` clears every adjacent epoch field and does not reset the tally. Within the declared family it is the sole session-lived exception after the process-lived identity register.
- G9's app-write-record half matches all record mutations: a later write replaces it, `decide` clears every reading below both early retaining returns, reload clears it only on other bytes, and `begin_epoch` clears it. Its anchor half has the High finding above.
- N1 is true and keeps R9 open. The core's wire-identity maximum is a refusal boundary, not an eviction, retention cap, or measurement that makes the table bounded in the sense claimed here.
- N2 is supportable as a lack of a fixed capacity policy: `announced` can accumulate distinct watched paths within an epoch and `latest_commit_at` has no pruning policy before epoch replacement. Production commit anchors are naturally limited by paths the open workspace can save, but there is no configured capacity analogous to the queue's 256 entries; the clause should not be read as claiming a second streaming source for anchors.
- N3 follows from whole-text and projection ownership in a `Changed` entry: the entry-count cap is not a byte cap.
- N4 follows exactly from `evictable_sequence`, including the all-singleton and equal-busyness tie cases.
- N5 is a valid denial of delivery: overflow or replacement can remove an entry before any drain returns it. The sentence “take entries no drain ever returned” is naturally existential in this negative clause; it must not be promoted by step 2 into a universal claim, because drained entries remain stored and can later be evicted or replacement-discarded too.
- N6 matches `owed_wake`: it reports the highest key pending at that locked instant, and a drain or epoch replacement can make a later wake's number smaller.
- N7 follows from the resets and epoch-local allocator; comparison across tags has no protocol meaning.
- N8 is true as an operational-measurement claim. Test-only accessors and assertions inspect individual outcomes, but the repository has no instrumentation for identity entries/bytes, ledger-map sizes, or drain clone cost.

### Pointer audit

The pointer edits preserve the local facts that matter. In particular, `drain` keeps its `max` construction, `begin_epoch` keeps the whole-state assignment and its call ordering, `external_observation` keeps the fact that a drain clones rather than consumes, the command keeps acknowledgement/idempotence semantics, and the ledger keeps which map carries which fact and which mutation occurs at each call site. I found no true call-site fact deleted merely to shorten a passage.

Some source items necessarily repeat their own local invariant next to the pointer — `identity_already_issued`, `begin_epoch`, `ReconciliationBatch::newest_sequence`, `CommitAnchor`, and the relevant fields are the derivation sites, not independent consumer paraphrases. The remaining consumer sites generally point without re-enumerating the full rule. The eight non-rustdoc-checked positions are appropriately limited to `//` comments or documentation inside `#[cfg(test)]` modules; a resolvable production intra-doc link was not replaced by plain text at any of them.

The one pointer/source combination that fails the intended design is the High finding: `CommitAnchor` repeats the false individual-value lifetime and points to the canonical clause that repeats it again. That buys enforcement of a link while doubling down on the wrong subject.

### Boundary and placement

Keeping `persist::backup` out is correct. Its retention is an on-disk rotation policy with its own marker, ordering, failure, and boundedness contract; no observation, queue drain, ledger decision, sequence, or consumer-held projection is decided against those backup entries.

Keeping `persist::write`'s lock registry out is also defensible, despite its deliberately recorded similarity to R9. The registry is process-wide, per-real-path, leaked, and unmeasured, and future writes do depend on recovering the same mutex for serialization. But the retained object is synchronization, not observation state: the mutex guards no in-memory fact, holds no number or projection, and is not an operand in an observation, drain, suppression, coalescing, or save-admission decision. This is a close subsystem boundary rather than a denial of the resource issue, and the record correctly requires step 2 to inventory it as judged-out instead of phrase-tuning around it.

Core is the least-bad placement for a compile-checked cross-crate documentation target. The module does not pretend core owns the shell implementations: lines 61–69 explicitly state that two holders live in the shell, cannot be linked from core, and are nevertheless part of the cross-crate contract. No dependency inversion or Tauri dependency was introduced. That tension is stated honestly.

### Ledger correction and residue sweep

The corrected four-item app-write-record list agrees with `decide` and the other mutation sites. A chronology refusal and a stamped self-write suppression return above `clear_the_record_at`; every reading that survives both returns reaches the unconditional clear before duplicate/exhaustion/marker/withholding outcomes. Thus ordinary stamped external content, absence, unreadability, and serialized readings all clear a standing record. Reload clears only when it accepted other bytes, a later committed write supersedes the record, and workspace replacement clears the maps.

The former “serialized reading/door” wording no longer survives as a narrower general claim in the source sweep. Remaining serialized-door passages state true local behavior: serialized doors skip the two retaining questions and then clear below them. The narrower residue that did survive is instead one level deeper in the newly centralized half of G9: “the anchor lives for the epoch” overlooks supersession of the concrete latest-anchor value by a later commit.

### Likeliest sites for a later round

After fixing the High, the most likely future findings remain:

- G4's “exactly three,” because it depends on production provenance and a human enumeration of mutation sites while `enqueue` and `AdmittedObservation` do not encode uniqueness;
- G8's “one retained value,” because additions to either holder can silently create another non-epoch field;
- G9's distinction among record, map entry/latest chronology fact, and concrete `CommitAnchor` value — the defect in this round;
- N2's plural treatment of the announced and anchor maps, whose sources of growth are not identical;
- N5's phrase “take entries no drain ever returned,” which is correct as an existence counterexample and false if a future pointer restates it universally;
- the `persist::write` lock-registry boundary, which step 2 must explicitly inventory as judged-out;
- the introductory review-history sentence at line 8, which already turned an implementation-step discovery into a “review round.”

Step 2 should not be built on the current text. Correct the subject of G9 and its `CommitAnchor` source passage first; otherwise the new checker will make a false lifetime claim harder to remove.

**NOT READY**

## Round 2 — step 1, against the round-1 fix

### Verdict

**NOT READY.** The round-1 fix corrected the principal subject distinction: in
production, `record_app_write` never leaves an existing path's slot empty, its
replacement value is the latest commit anchor, `begin_epoch` is the only
operation that empties the slot, and `decide` only reads it. G4, G8, N2 and N5
also remain true at their stated boundary. But the fix's own new consumer
summary immediately collapses the distinction again in a different direction:
two of the record's four ends do touch anchor state. The ledger also retains two
older co-existence claims which the widened lifetime sweep did not catch and
which contradict the very consumer case G9 is meant to guarantee.

These are not merely restatements of round 1's wording. Round 1 distinguished a
concrete anchor value from its epoch-lived slot. Round 2 finds (1) a new
universal over the operations that end a record, including the two operations
that replace or clear anchor state, and (2) an independent claim that record
and anchor cannot be observed separately even though their separability is the
round-9 mechanism. Both have new substantive content.

### Findings

1. **High — `crates/espansoconfig-core/src/watch/retained_state.rs:152`: G9's new consumer summary says none of the record's four ends touches the anchor, but supersession replaces the concrete anchor and workspace replacement clears its slot.** The clause's own four ends include “supersession by a later committed write” and “a workspace replacement.” `WriteLedger::record_app_write` ends the old record at `src-tauri/src/ledger.rs:1284` and replaces the old `CommitAnchor` at lines 1303–1309; `WriteLedger::begin_epoch` clears both the record map and `latest_commit_at` at lines 1195 and 1206. Thus “none” is false under both the value and slot senses the fix has just separated. The usable guarantee is narrower but still strong: within the retained epoch, a reading/reload that clears a record does not touch the anchor; supersession preserves the per-path slot by replacing its value with the newer anchor; and epoch replacement makes predecessor observations stale before chronology is consulted. Consequently a stamped reading older than this epoch's latest commit is still refused without a record, but the stated premise for that consequence is false. This sentence is new in the round-1 fix and sits in the canonical guaranteed clause, so step 2 must not protect it as written.

2. **Medium — `src-tauri/src/ledger.rs:494` and `src-tauri/src/ledger.rs:1232`: the ledger says the shared insertion guard means no decision can see the record without the anchor or the anchor without the record, although seeing an anchor after its record is gone is the intended design.** `decide` reads the two independently at lines 2071–2072, and every path below its two retaining returns calls `clear_the_record_at` at line 2137, which removes `documents_by_path` and `writes` but expressly does not touch `latest_commit_at` (lines 1922–1927). The next decision therefore can and deliberately does see an anchor with no record; G9 relies on precisely that state. The mutex proves only that a decision cannot interleave with `record_app_write` and see a partially inserted pair. The module-level sentence is unqualified, while the `record_app_write` doc repeats it and then immediately says clearing the record leaves the anchor standing. This is what the widened pattern missed: a co-existence assertion about the same two values that says nothing in the vocabulary of lifetime, removal or survival.

### Priority audit

- **G9's three-way distinction:** The headline and its detailed slot/value explanation now match production code. `record_app_write` holds the state mutex while inserting the record, path index and fresh anchor. A later commit to the same path replaces the prior concrete value and leaves the map keyed at that path. No production method removes or mutates an individual `latest_commit_at` entry; `begin_epoch` clears the map whole. `decide` obtains the newest stored instant through `commit_anchor_at` and never mutates the anchor. The test-only `stamp_the_anchor_at` seam can manufacture a non-production instant and is explicitly test-only; it does not refute the application guarantee. The defect is the new “none of the four ends touches” summary, not the slot/value account before it.
- **Whether the fix weakened the guarantee:** It did not hedge away the important behavior. `clear_the_record_at`, both serialized doors, ordinary stamped supersession below the retaining checks, and reload invalidation leave `latest_commit_at` alone. A later commit updates rather than empties the slot. This is enough for `decide` to refuse a stamped reading at or before the latest anchor even after the suppression record is gone. Workspace replacement is different: it clears the anchor, but the old observation is rejected by the epoch fence and chronology has no cross-epoch meaning. The High is that G9 presents these distinct reasons as “none touches,” not that the consumer protection is absent.
- **Ten corrected positions and the broader residue:** The corrected module headline, `Admission::PrecedesACommit`, `LedgerTally::preceded_a_commit`, `LedgerState::writes`, `begin_epoch`, `record_app_write`, `decide`, `CommitAnchor`, and the two test comments no longer give each concrete anchor an epoch lifetime. The likeliest remaining narrow residues are `begin_epoch`'s “one place a commit anchor is removed” (`ledger.rs:1198`) and `CommitAnchor`'s “removed by begin_epoch alone” (`ledger.rs:805`): each is defensible only because its following words switch the subject to the slot/fact, while an old concrete value is also dropped on replacement. They should be kept in round 3's attack list, but the immediate qualifications make them ambiguity rather than separate findings here. The two false “no decision can see one without the other” passages are a genuine miss by the widened sweep because they assert co-existence, not duration.
- **G4's exactly three:** `QueueState::pending` has the four stated production mutation sites: insert at `reconciliation.rs:1097`, overflow removal at 1102, drain retention at 1187–1189, and whole-state replacement at 1029–1030. Insert could replace an equal key, but the only production values come from the ledger allocator, which spends each sequence once under its mutex; `enqueue` and `AdmittedObservation` do not encode that invariant, and the contract honestly says so. On the current production pipeline, a stored entry leaves by acknowledgement, eviction or epoch replacement exactly.
- **G8's one retained value:** `LedgerState` contains the epoch-scoped epoch/maps/allocator and `tally`; `begin_epoch` resets all but `tally`. `QueueState` is replaced whole, so none of its fields survives an epoch. The queue's wake emitter and the ledger's gate are session-lived infrastructure, but they are outside the contract's expressly drawn family: neither is observation state against which a later observation, drain or save decision is taken. Within that boundary, `LedgerTally` remains the one session-lived retained value. The claim is true but structurally unguarded against a future field addition, exactly as the contract admits.
- **N2:** `announced` removes individual path entries when a commit or reload makes their fact false, and is cleared whole only at `begin_epoch`. `latest_commit_at` has no individual removal at all; insertion at an existing key replaces its value while preserving the per-path slot/latest-commit fact. Read as a restriction on map slots leaving, the “only where” statement is therefore true of `announced` and vacuously true of `latest_commit_at`. G9's new explicit value/slot distinction makes this wording a likely future ambiguity, but it does not make the present capacity denial false.
- **N5:** This is an existence counterexample to the denied guarantee that every stored entry reaches a consumer. Overflow can evict a never-drained entry, and `begin_epoch` can discard a pending never-drained entry. Previously returned entries remain stored and may later be evicted or replaced, so the sentence would be false as a universal; in its negative-clause context it supplies the necessary counterexamples and remains true.

### Likeliest sites for round 3

- G9's corrected conclusion at `retained_state.rs:152`, after the High is fixed:
  it must keep record clearing, anchor replacement and epoch clearing distinct
  without weakening the chronology refusal.
- `CommitAnchor`'s `removed` wording at `ledger.rs:805` and `begin_epoch`'s at
  `ledger.rs:1198`, where “anchor” can still slide from slot/fact back to value.
- N2 at `retained_state.rs:176`, because “entries leave” needs the same slot/value
  discipline G9 now makes explicit.
- G4 and G8 remain the highest-risk true enumerations because neither the set of
  pending mutations nor the absence of another session-lived field is encoded.
- N5 remains vulnerable to a pointer turning its existential counterexample into
  a universal statement.

Step 2 should not be built on the current text. Correct G9's false universal and
the ledger's two false co-existence assertions first, while preserving the
epoch-scoped chronology guarantee that the implementation does provide.

**NOT READY**

## Round 3 — step 1, against the round-2 fix

### Verdict

**NOT READY.** G9’s rewritten conclusion now holds: record clearing, anchor replacement, and epoch clearing remain distinct, and the chronology refusal is preserved. The three co-existence sentences changed by the round-2 fix are also accurate. However, a fourth co-existence claim remains in the reload invalidation documentation: it derives an impossible paired post-state from a shared mutex even though the two invalidations are intentionally conditional and independent. This is prose-only and does not expose a code defect. It is the same broad claim family as round 2’s Medium, but it is not a restatement of wording already fixed there; it concerns a different pair of retained values and a different mutation path, so it is new substance.

### Findings

1. **Medium — `src-tauri/src/ledger.rs:1656`: the reload invalidation comment says the shared state guard prevents a decision from seeing either one-sided record/announcement state, although the method deliberately permits both.** The passage claims that because “both invalidations happen under one state guard,” no decision can observe the record cleared while the announcement stands, “or the reverse.” The guard does prevent a decision from interleaving between the two conditional checks, but it does not make their predicates agree. At lines 1673–1683, the record is cleared only when its revision differs from the reload, while the announcement is removed only when its state differs. Thus a reload matching the announcement but not the record leaves an announcement with no record, and a reload matching the record but not the announcement leaves a record with no announcement. Lines 1612–1614 expressly identify those two states as intentional. The corrected claim should say that no decision can interleave between the two checks and any removals they select, while expressly preserving that either asymmetric result may be observed after the method returns. This is a prose-only finding.

### Priority audit

- **G9’s corrected conclusion — CLEARED.** `clear_the_record_at` removes `documents_by_path` and `writes` without touching `latest_commit_at` (`ledger.rs:1947–1950`), and reload invalidation reaches that same helper (`ledger.rs:1673–1675`). Supersession inserts a fresh record and fresh anchor under one guard, replacing the previous value without emptying the path’s slot (`ledger.rs:1305–1332`). Epoch replacement clears the record maps and the anchor map (`ledger.rs:1204–1217`), while `admit` rejects a predecessor epoch before calling `decide` or consulting chronology (`ledger.rs:1367–1378`). Finally, `decide` consults the anchor independently of the record and refuses `read_after <= anchor` (`ledger.rs:2094–2117`). The consumer consequence at `retained_state.rs:152–170` therefore follows from the three stated premises without restoring either false universal from rounds 1 or 2.

- **The three narrowed co-existence sentences — CLEARED; a fourth exists and is the finding above.** The module-level record/anchor sentence (`ledger.rs:494–500`) and `record_app_write`’s equivalent (`ledger.rs:1243–1251`) now claim only that no decision can interleave with that insertion and observe a half-written pair. The record/announcement sentence (`ledger.rs:1279–1284`) likewise limits itself to the unconditional insertion-plus-invalidation performed by that call. All three match the single state guard and correctly disclaim permanent co-existence. The missed family is slightly narrower than “two values are always seen together”: it is **atomic execution incorrectly promoted into a correlated post-state when the mutations have different predicates**. The surviving reload sentence phrases that as “both invalidations” under one guard, which let it escape the insertion-oriented correction.

- **The slot/value wording around `CommitAnchor` and `begin_epoch` — CLEARED.** `begin_epoch` now names “a commit anchor’s slot” and immediately distinguishes the shorter-lived value (`ledger.rs:1208–1216`). `CommitAnchor` likewise says the path’s slot is maintained while the concrete value is replaced, then gives creation, reading, and removal subjects explicitly (`ledger.rs:807–821`). Neither passage slides back from slot or chronology fact to the concrete value.

- **N2 — CLEARED.** `announced` may remove an individual path when a commit or reload makes its announcement false (`ledger.rs:1333`, `1682`); `latest_commit_at` has no individual removal at all, and insertion at an existing path replaces only its value (`ledger.rs:1326–1332`). Naming “a path’s slot” at `retained_state.rs:191–195` therefore selects the true reading: an anchor value can leave while its slot remains. Both maps still lack a capacity policy and neither is pruned as a whole before `begin_epoch`, so the expressly-not-guaranteed bound is unchanged.

- **G4’s “exactly three” — CLEARED.** The production mutations of `QueueState::pending` remain the whole-state replacement in `begin_epoch` (`reconciliation.rs:1029–1030`), insertion and overflow removal in `enqueue` (`reconciliation.rs:1097–1103`), and acknowledgement retention in `drain` (`reconciliation.rs:1184–1190`). A same-key insertion would be a fourth exit, but production sequences are allocated uniquely within an epoch; the queue documentation continues to state that this is not type-enforced. No fifth production mutation has appeared.

- **G8’s “the one exception” — CLEARED.** `LedgerState` still consists of the epoch, record maps, announced map, anchor map, sequence allocator, and tally (`ledger.rs:1079–1143`). `begin_epoch` resets or clears every one except `tally` (`ledger.rs:1204–1218`), while the queue replaces its entire `QueueState`. Within the contract’s retained-state boundary, no second session-lived value has appeared.

- **N5 — CLEARED.** Overflow can evict an entry before any drain returns it, and epoch replacement can discard such a pending entry wholesale. Previously returned entries remain stored and can also be evicted or replacement-discarded, so the counterexample must remain existential. In the reviewed source, no pointer turns it into a universal claim; `retained_state.rs:207–212` remains the negative clause itself.

### Likeliest sites for round 4

- The correction at `ledger.rs:1656`: the likely regression is another sentence that says both invalidations or both retained values are always absent or present together, instead of saying only that no decision interleaves between the conditional operations.
- The independent-condition statement immediately above it (`ledger.rs:1612–1614`) and the two predicates below it (`ledger.rs:1673–1683`): a fix must preserve both legitimate asymmetric outcomes rather than “repair” the contradiction by weakening those true local facts.
- The insertion atomicity passages at `ledger.rs:494–500`, `1243–1251`, and `1279–1284`: a sweep-driven fix could incorrectly homogenize unconditional paired insertion/invalidation with the reload method’s independently conditional removals.
- `clear_the_record_at` at `ledger.rs:1936–1950`: its record/index pairing is genuinely unconditional, but that true local pair must not be generalized to the record/anchor or record/announcement pairs.

**NOT READY**

---

## Round 4 — step 1, against the round-3 fix

### Verdict

**READY.** The round-3 fix accurately limits the mutex guarantee to non-interleaving during independently conditional invalidations, correctly describes both asymmetric post-states, and preserves the surrounding predicates and insertion-only atomicity claims. I found no new substantive issue and no restatement of the wording defects fixed in rounds 1–3.

### Findings

None.

### Priority audit

- **1. Corrected paragraph — CLEARED.** The record is removed only when its revision differs (`src-tauri/src/ledger.rs:1685–1687`); the announcement is removed only when its state differs (`src-tauri/src/ledger.rs:1688–1695`). Consequently, the two asymmetric outcomes named at `ledger.rs:1664–1668` are legal and agree with the independence statement at `ledger.rs:1612–1614`.

- **2. Interleaving claim — CLEARED.** Reload invalidation acquires `enter_gate()` and then `lock()` (`ledger.rs:1683–1684`). Every entry point reaching `decide` does likewise: `admit` at `ledger.rs:1367–1373`, `mark_under_the_session_lock` at `ledger.rs:1481–1483`, and `withhold_under_the_session_lock` at `ledger.rs:1556–1558`. Those are the only source-tree calls to `decide`. Thus no decision on this ledger can interleave with the checks and selected removals. The absence of a scheduler-controlled race test is correctly recorded as unenforced evidence, not proof that the claim is false.

- **3. `documents_by_path` field documentation — CLEARED.** Production identities remain stable per path through `identity_of` (`crates/espansoconfig-core/src/workspace/mod.rs:316–327`). `record_app_write` replaces the record and removes any prior path for that document before inserting the current mapping (`ledger.rs:1307–1313`), while `clear_the_record_at` removes the path mapping and corresponding record together (`ledger.rs:1959–1962`). The invariant is not encoded in the method’s argument types, but I found no concrete production violation warranting disagreement with round 3’s judgement.

- **4. G4, G8 and N5 — CLEARED.** G4 still derives three exit routes from insertion/overflow removal (`src-tauri/src/reconciliation.rs:1097–1103`), acknowledgement retention (`reconciliation.rs:1184–1189`), and whole-state replacement (`reconciliation.rs:1029–1030`). G8 still has `tally` as the only `LedgerState` field preserved by `begin_epoch` (`ledger.rs:1079–1143`, `1202–1218`). N5 remains an existential counterexample: overflow and epoch replacement can remove a pending entry before any drain returns it (`retained_state.rs:207–212`). I found no concrete reason to reopen any of the three.

- **5. Predicted regressions — CLEARED.** The independence statement (`ledger.rs:1612–1614`) and both predicates (`ledger.rs:1685–1695`) remain intact. The insertion-atomicity passages remain correctly scoped to their unconditional operations (`ledger.rs:494–500`, `1243–1251`, `1279–1284`). `clear_the_record_at` still pairs only the record and path index and expressly leaves the anchor untouched (`ledger.rs:1948–1962`). None was generalized into a permanent co-existence claim.

- **6. `persist::write` lock registry — CLEARED as judged out.** The registry retains one leaked synchronization mutex per real path (`crates/espansoconfig-core/src/persist/write.rs:432–475`), but those mutexes guard disk-write serialization and are not retained observation state consulted by an observation, drain, suppression, coalescing, or save-admission decision. Step 2 should inventory this position as judged out.

### Likeliest sites for round 5

- No round 5 is warranted by this review. If one is nevertheless conducted, `ledger.rs:1656–1670` remains the likeliest drift site because its conditional-atomicity distinction is still documentation-enforced only.
- G4 (`retained_state.rs:97–111`) and G8 (`retained_state.rs:132–135`) remain the highest-risk true enumerations because neither is structurally guarded against future mutation sites or fields.
- `documents_by_path` (`ledger.rs:1093–1104`) remains dependent on a production identity invariant not encoded in `record_app_write`’s types.
- Step 2 should preserve N5’s existential reading and inventory the `persist::write` registry as judged out.

READY

---

## Step 2 — round 1 (the check, the shared machinery and the record)

### Verdict

**NOT READY.** The shipped inventory and phrase family hold up, including the five phrase drops and both insertion/removal halves. However, the new guard has one Low-severity code defect: zero-count inventory entries bypass two invariants the test expressly claims to enforce. This is new substance not disclosed in §14.

### Findings

1. **Low — `src-tauri/src/retained_state_contract.rs:1238` — code defect.** The guard claims every inventory entry matches something and permits only one entry per `(file, phrase)`. It uses zero as the “unseen” sentinel, then ignores missing entries whose count is zero at line 1262. Consequently, a nonexistent entry with `count: 0` passes, and duplicate entries pass when the first has count zero. Require `entry.count > 0`, use `recorded.insert(key, count).is_none()` for duplicate detection, and check every recorded key in the reverse comparison. The identical logic at `src-tauri/src/liveness_contract.rs:802–827` should be repaired simultaneously or extracted once.

### Priority audit

- **1 — CLEARED.** All 140 current entries have positive counts, and the reasons at `retained_state_contract.rs:289–1128` accurately describe their passages. In particular, `ledger.rs`’s `outlives` twelve hits (`ledger.rs:152–4051`), `until the epoch` seven hits (`:643–4040`), and `no decision can` five hits (`:93–1657`) are not stretched across incompatible claims.

- **2 — CLEARED.** The four relevant `backwards` occurrences remain covered by `watermark backwards` at `reconciliation.rs:713`, `:718`, `:2130` and `dispatch_check.rs:2011`. The remaining `backwards`, `process-wide`, `one way`, `monotonic`, and `in the same breath` occurrences are mechanism vocabulary, unrelated subsystems, clock properties, or rhetorical location—not uncovered retained-state claims.

- **3 — CLEARED.** Group 3 reaches unconditional insertion at `ledger.rs:494–500` and `:1243–1284`, and conditional removal at `:1656–1670` through `under one state guard`, `no decision can`, and `half-applied`.

- **4 — CLEARED.** `persist/write.rs:432–460` is genuinely a process-lifetime synchronization registry, not observation state; `:681–682` is a transaction resource lifetime. The backup hits are unrelated disk-rotation claims. The boundary reasons at `retained_state_contract.rs:380–413` are supportable.

- **5 — CLEARED.** The module documentation at `retained_state_contract.rs:1–110` states the measured phrase-free misses, semantic-judgment limitation, self-skip, source-tree scope, judged-out boundary, and duplicated comparison. Its broader inability to force pointers rather than recorded restatements follows explicitly from its “cannot judge” qualification.

- **6 — Finding 1 applies.** Keeping the comparison unchanged was reasonable evidence for the extraction, but the duplication has now propagated the same zero-sentinel defect into both guards.

- **7 — CLEARED.** `dictionary_contract.rs:622` has a different repository-relative interface and purpose. Sharing its directory walk would add coupling without improving either prose-contract guard.

- **8 — Finding 1.** Family membership and non-empty reasons work, and positive unrecorded hits still fail. Zero counts defeat the claimed reverse and uniqueness invariants at `retained_state_contract.rs:1238–1263`.

### Likeliest sites for a later round

- The synchronized repair of `retained_state_contract.rs:1238–1263` and `liveness_contract.rs:802–827`.
- The five deliberately dropped phrases, especially `process-wide`, if the contract boundary later expands.
- The grouped `ledger.rs` reasons after any future prose or mutation-site change.
- The judged-out lock-registry wording at `persist/write.rs:432–460`.

NOT READY

## Step 2 — round 2 (the round-1 fix: the shared comparison, the re-pointed entry, the changed assertion and the amended record)

VERDICT: NOT READY
Counts: 0 High, 0 Medium, 2 Low

### Finding 1 — Low — sentence

`src-tauri/src/retained_state_contract.rs:99-106`

> “The both-direction comparison below is this test's own, and [`crate::liveness_contract`] keeps its own copy of it.”

What is wrong: This present-tense limitation is now false. The comparison exists once as `prose_sweep::complaints_against` (`src-tauri/src/prose_sweep.rs:288-349`), called by the retained-state guard at `retained_state_contract.rs:1234` and the liveness guard at `liveness_contract.rs:791`. Neither guard keeps a copy.

Why it matters: The fix left its predecessor’s deliberately accepted defect shape documented as current behavior. This is new substantive residue caused by the extraction, not wording already corrected in §13.1 or §14 item 7.

Suggested remedy: Replace this limit with the current arrangement: the comparison is shared, while each caller retains its inventory and final assertion sentence. If the lost byte-identity proof is mentioned here, label it explicitly historical.

### Finding 2 — Low — behaviour

`src-tauri/src/retained_state_contract.rs:262-264, 1163-1172, 1190-1194`

> “The two checks do not exempt each other, which [`the_sweep_reaches_both_trees`] asserts.”

What is wrong: The test no longer asserts that the retained-state sweep reaches `liveness_contract.rs`. Its replacement assertion only requires a hit from `prose_sweep.rs`. If the retained-state sweep were changed to skip `liveness_contract.rs`, all four assertions in this test could still pass: other files provide both tree hits, the canonical contract hit remains, and `prose_sweep.rs` remains visible. The current `SWEPT_TREES` and `SKIPPED` constants still cause the sibling to be swept, but the intended proof capability was lost.

Why it matters: The original assertion guarded the explicit “the checks do not exempt each other” invariant. Moving the only matching phrase made a hit-based assertion impossible; substituting shared machinery proves a different and useful property, but not the original one.

Suggested remedy: Keep the `prose_sweep.rs` assertion and add a file-selection assertion independent of phrase hits. Prefer exposing or reusing the exact selected-file layer used by `sweep`, then assert that each guard’s sibling source is selected and not skipped. Add the reciprocal assertion to the liveness guard if mutual non-exemption is the intended invariant.

### What I checked and cleared

- `complaints_against`: the three repairs are correct. Zero is illegal, duplicate detection uses map occupancy rather than a value sentinel, and every missing recorded key enters the reverse complaint loop.
- Forward comparison: a swept `(file, phrase)` absent from the inventory receives expected count zero and necessarily complains.
- Keys: hits and inventory use identical content-ordered `(file, phrase)` keys; the same phrase in two files remains two independent keys.
- Case handling: source text is lowercased, both callers permanently test that every shape is lowercase, and inventory phrases must exactly belong to that family.
- Substrings: distinct shapes that contain one another are tallied independently rather than overwriting or hiding each other.
- Empty results and caller handling: the non-empty real inventories make an empty hit set produce reverse complaints; both callers retain a non-vacuous `complaints.is_empty()` assertion.
- Re-pointed inventory entry: retaining it is correct. The assertion remains a false positive about guard-inventory structure, not an observation-pipeline retained-state claim; moving it into shared machinery does not change that judgement. Its history agrees with the code movement.
- Guard comparison strength: both guards retain every former positive-count forward and reverse check and gain the zero-count and sentinel repairs. Neither local final assertion can ignore a non-empty complaint vector.
- Record §13.1: the correction plainly says the byte-identity proof is historical at `65a0138`, cannot be re-derived, and has been replaced by weaker evidence.
- Record §14 item 7: it records the discharge’s cost explicitly; it does not present sharing as a free win.
- Record §14 item 5: its amendment accurately says the changed assertion now concerns shared machinery. Finding 2 is that the test no longer proves the separate sibling-coverage property.
- Eight probes: they demonstrate the three repaired failure classes through both callers. The zero-first duplicate is rejected at the new positive-count precondition, while the two-positive duplicate separately exercises `insert(...).is_none()`. They are not comprehensive: no post-extraction probe covers a forward count mismatch/unrecorded hit, an out-of-family phrase, or an empty reason; §17.8 accurately discloses those omissions.

### Verdict rationale

The shared comparison itself is sound and strictly stronger than either copied loop. The round is nevertheless NOT READY because the fix left one direct description of the old duplication false and replaced the sibling-coverage assertion with a test of a different property, leaving the original non-exemption invariant unverified.

## Step 2 — round 3 (against the round-2 fix: the extracted `selected_files`, its doc, the eight new assertions, the two `SKIPPED` comments, the correction blocks and §18)

VERDICT: NOT READY
Counts: 0 High, 0 Medium, 4 Low

### Finding 1 — Low — code

`src-tauri/src/prose_sweep.rs:206-231`

> ```rust
> let relative = path
>     .strip_prefix(&root)
>     .expect("a swept file lives under the workspace root")
>     .to_string_lossy()
>     .into_owned();
> // ...
> for relative in selected_files(trees, skipped) {
>     let path = root.join(&relative);
>     let source = fs::read_to_string(&path)
> ```

What is wrong: The extraction is not completely lossless. Previously, `sweep` used the original `PathBuf` from `rust_files_under` for `read_to_string` and used the lossy string only for reporting and skip comparison. It now reconstructs the filesystem path from that lossy string. On a platform permitting a non-UTF-8 `.rs` filename, the old implementation reads the actual file; the new implementation substitutes U+FFFD, attempts to read a different path, and panics.

Why it matters: A shared helper has changed the file set both guards can successfully sweep, contradicting the extraction’s requirement to preserve file selection and unreadable-file behavior. The unchanged inventories do not exercise this path.

Suggested remedy: Have `selected_files` retain relative `PathBuf`s, or return a small structure containing both the lossless relative path and its display/inventory string. Reconstruct paths only from the `PathBuf`; keep `to_string_lossy` at the `Hit.file` reporting boundary as before.

### Finding 2 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:1901-1905`

> “`sweep` calls it, so there is one selection and a test observes the same one the sweep walks.”

What is wrong: There are two selections. Each test first calls `sweep()`, which calls `selected_files`, and then calls `selected_files` again to obtain `selected`. The test observes a fresh traversal using the same implementation and arguments, not the `Vec` that the sweep walked. The same overclaim appears in `prose_sweep.rs:192-194` and both guards’ test documentation.

Why it matters: The wording promotes shared implementation into stronger evidence than the test provides. A later filter between `selected_files` and the read loop, or a filesystem change between the two traversals, could make the test’s selection differ from the files actually opened while these comments continued claiming identity.

Suggested remedy: Either narrow every occurrence to say that the test recomputes selection through the same helper, or return the selected paths alongside the hits from one sweep operation so the assertions inspect the actual selection used.

### Finding 3 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:1917-1919`

> “The `prose_sweep.rs` hit-based assertion in the retained-state guard is **kept**: nothing was dropped, four assertions were added.”

What is wrong: The hit-based assertion was dropped. Before this commit it inspected `hits` for `src-tauri/src/prose_sweep.rs`; the current assertion at `retained_state_contract.rs:1230-1235` inspects `selected`. The test went from four assertions to seven: one assertion was replaced and four were added, for a net gain of three.

Why it matters: §18’s account contradicts both the diff and its own §18.5 statement that only three hit-based assertions remain. Although the inventory’s reverse direction still indirectly requires the existing `prose_sweep.rs` hit, the historical claim about what this fix did is false.

Suggested remedy: Say that the old `prose_sweep.rs` hit assertion was replaced by a selection-based assertion, while its present hit remains independently forced by the retained-state inventory’s reverse comparison.

### Finding 4 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2054-2059`

> “Every other file in the two trees is still covered only by the walk, and a change that dropped, say, `crates/espansoconfig-core/src/watch/` from `SWEPT_TREES` would be caught by the hit-based *the core tree is swept* assertion but a change dropping one **file** would not.”

What is wrong: Dropping a file with any inventoried hit is caught by `complaints_against`’s reverse direction: its recorded `(file, phrase)` keys become missing. Only a file with zero family hits can disappear without that indirect coverage firing. The risk is real but materially narrower than “dropping one file would not” states.

Why it matters: This is the same hit-versus-selection distinction the round is documenting, inverted into an overstatement of the remaining hole. It also weakens §18.8’s argument about whether exhaustive independent enumeration is worth duplicating.

Suggested remedy: State that no general selection assertion covers the remaining files; hit-bearing files are indirectly protected by inventory entries, while zero-hit files can still be dropped silently.

### What I checked and cleared

- `selected_files` preserves tree order, per-tree sorted file order, skip membership semantics, and the skipped-path `is_file()` assertion for ordinary UTF-8 repository paths. The matching loops and per-file read panic text are otherwise unchanged.
- The four new assertions are symmetric between the guards: each selects its sibling and `prose_sweep.rs`, pins its own one-element skip list, and confirms that selected output excludes that element.
- The targeted-coverage trade is defensible: independently enumerating every `.rs` file would duplicate the helper’s traversal and create a second implementation to keep synchronized. The stronger useful improvement is to expose the actual selection from the sweep invocation, as Finding 2 describes.
- Both `SKIPPED` comments accurately describe the cross-file symmetry. Each local test proves its own direction, and inspection of the sibling confirms the reciprocal direction.
- The constant-versus-literal assertions and missing named-file existence checks are real limitations, but §18.8 items 1 and 2 disclose them accurately; a rename fails loudly rather than silently weakening coverage.
- The retained-state module’s comparison-location correction is accurate: `complaints_against` is shared, while the families, trees, skips, inventories, and final assertion messages remain local.
- The liveness module header and the §15 and §16 correction blocks plainly label the byte-identity evidence historical at `65a0138`, distinguish the still-identical arrays from the changed tests, and call the surviving evidence weaker.
- §18.1, §18.3, §18.4, and §18.6 otherwise match the code and diff, including the slice-valued skip lists and current line counts of 377 / 1297 / 867.
- §18.5’s three file digests match the reviewed tree, and its reported failure sites agree with the sibling-selection assertions.
- §18.7’s test and gate figures agree with the host results supplied for this review; no new test was added.
- The phrase families and inventories were untouched by this commit; the liveness and retained-state entry counts remain 86 and 140.

### Verdict rationale

The reciprocal non-exemption behavior requested by round 2 is present, and the historical correction blocks now hold. The round is nevertheless NOT READY because the extraction loses filesystem path fidelity and §18 introduces three substantively false descriptions of its evidence, diff, and remaining coverage hole. These are new defects in this fix round, not restatements of wording already corrected.

## Step 2 — round 4 (against the round-3 fix: `SelectedFile` and the lossless read path, the narrowed identity sentence at six positions, the refused API widening, §19.4's assertion arithmetic, the six correction blocks, and §19 in full)

VERDICT: NOT READY
Counts: 0 High, 0 Medium, 4 Low

### Finding 1 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2195-2200`

> “a bare `PathBuf` would have made it call `to_string_lossy` itself, moving the lossy conversion back out of the selection layer and into the sweep, which is the opposite of what the finding asks for.”

What is wrong: The review explicitly offered bare relative `PathBuf`s as one valid remedy and said to keep `to_string_lossy` at the `Hit::file` reporting boundary. Moving that conversion into `sweep` would therefore have followed, not opposed, the finding. The struct is still a reasonable choice because it keeps both forms together and simplifies callers.

Why it matters: §19 falsely characterizes the rejected alternative, biasing the recorded design trade in favor of the chosen representation.

Suggested remedy: Say that both alternatives satisfy the finding and that `SelectedFile` was chosen for caller simplicity and to centralize the two spellings.

### Finding 2 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2229-2243`

> “The narrowed claim, which every corrected position now makes … Each position also says what holds the two traversals together — nothing in the code does.”
>
> “the property the assertions defend — that a file dropped from the walk is noticed — is unaffected by which of the two traversals answers.”

What is wrong: The second sentence repeats the identity overclaim this round was fixing. A filter inserted between `selected_files` and `sweep`’s read loop, or a filesystem change between the two calls, can drop a file from the actual walk while the test’s fresh traversal still includes it. Which traversal answers therefore does affect whether the assertion proves actual-walk coverage. The six corrected homes are individually true, but not equally explicit: `prose_sweep.rs`’s module doc only says the same function is used and does not state the second-traversal/no-coupling limitation that §19 says every position carries.

Why it matters: This overstates the evidence precisely where §19 justifies refusing the stronger API. The refusal remains defensible, but the record understates what widening `sweep` could buy.

Suggested remedy: State that the assertions protect what `selected_files` answers for the constants, not necessarily the exact files opened by that invocation of `sweep`. Narrow the “every corrected position” claim to say all six removed the identity assertion; do not claim they carry equal detail.

### Finding 3 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2293-2297`

> `| 2 | 3 homes (§18.2; prose_sweep.rs selected_files doc; both guards' test docs) | 2 | 6 | 4 |`

What is wrong: The review cited four positions: §18.2, `selected_files`’s doc, and one test doc in each of the two guards. Adding the two positions found beyond the review gives the stated total of six. Calling the cited set “3 homes” makes the row’s arithmetic 3 + 2 ≠ 6.

Why it matters: §19.6 describes itself as “cited position by cited position”; grouping two separate files into one “home” defeats that accounting and creates another false count in the audit record.

Suggested remedy: Change “3 homes” to “4 positions,” preserving the total of six.

### Finding 4 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2347-2354`

> “both stayed green in both directions — which means the new prose matched no phrase of either family”
>
> “Had a hit appeared it would have been recorded as a judged entry with its reason.”

What is wrong: Each guard skips its own source. A new liveness-family phrase in `liveness_contract.rs`, or a new retained-state-family phrase in `retained_state_contract.rs`, is invisible to the corresponding guard and would not require an inventory entry. Green guards establish only the cross-family result for those two files; they establish both families for `prose_sweep.rs`. The actual additions happen not to introduce a matching own-family phrase, but that requires inspecting the diff, not inferring it from the tests.

Why it matters: §19 promotes green checks into evidence over the exact self-skip holes both modules expressly disclose.

Suggested remedy: Scope the gate evidence to files each guard actually sweeps, and record any separate inspection used to clear own-family additions in each guard’s source.

### What I checked and cleared

- `SelectedFile` restores the lossless read path: `sweep` joins `file.relative`, never `file.reported`, when opening a file.
- Leaving skip membership, `Hit::file`, and inventory keys on `reported` is correct for this fix. It preserves the original representation and all 86/140 inventory keys while preventing that lossy spelling from naming the file read.
- `SelectedFile`’s non-UTF-8 claim is sound and no stronger than the argument supports: lossy conversion changes an invalid name’s representation, so reconstructing a path from it names a different path or none.
- All six corrected identity passages are individually true and no longer claim that the test receives the vector `sweep` walked. Finding 2 concerns §19’s claim that they have equal strength and that actual-walk coverage is unaffected.
- Refusing to widen `sweep` is defensible: the current assertions materially protect the shared selection function and constants, while returning the selection would enlarge an already growing API and documentation surface. The refusal only needs its benefit stated accurately.
- The assertion arithmetic in §19.4 matches the actual `e75ec2b~1..e75ec2b` diff: retained-state 4→7 after one removal and four additions; liveness 3→7 after four additions.
- The reverse inventory comparison protects 29 retained-state files and 20 liveness files, as §19.5 states.
- The six correction blocks and inline addition accurately mark historical text. Although they make §18 harder to read linearly, retaining immediately annotated measurements is a defensible decision-record policy rather than a defect.
- The path-selection order, ASCII-tree count of 71 files, 70 selected files per guard, 153→176 comment-line measurement, source line counts, and unchanged inventories agree with the tree.
- The disclosed `dispatch_check.rs` lossy destination is harmless for its committed ASCII corpus and was not rediscovered as a finding.
- The supplied test, clippy, formatting, and frontend-disclosure evidence is not contradicted by the source or diffs. I did not rerun those gates, as instructed.
- The retained-state and liveness contracts themselves remain untouched and consistent with the checks’ stated scope.

### Verdict rationale

The read-path code fix is sound, the untestable filename argument holds, and the principal assertion arithmetic is correct. The round remains NOT READY because §19 introduces four Low record defects. Finding 2 reintroduces the same selection-versus-actual-traversal substance round 3 had already corrected; Findings 1, 3, and 4 are new defects in this fix round’s account of the alternative remedy, its position count, and what green guards prove.

## Step 2 — round 5 (against the round-4 fix: §20 in full, §20.3's six-position table and its judgement, §20.6's hand replication and its numbers, §20.7's sweep tallies, and the five new correction blocks)

VERDICT: NOT READY
Counts: 0 High, 0 Medium, 3 Low

### Finding 1 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2442-2448, 2674-2680`

> “*no existing hit was reworded away* — every inventoried hit lives in a file its own guard sweeps, so those two are inside what the gates cover.”

What is wrong: Sweeping the file does not prove that an existing `Hit` survived. `complaints_against` compares only the count for each `(file, phrase)` key. One occurrence can be reworded away while another occurrence of the same phrase is added elsewhere in that file, leaving the count and both guards green. The module documentation expressly identifies this same-key substitution limit. Direct revision comparison shows that no hit actually moved in this commit, but the gates do not establish it.

Why it matters: The correction answers one overclaim about green guards by introducing another, now about the comparison’s positional strength.

Suggested remedy: Keep “86 / 140 unchanged,” but narrow the gate claim to “no inventoried `(file, phrase)` count changed.” Attribute exact hit/window preservation to a direct diff or matcher comparison, not to the guards.

### Finding 2 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2743-2788, 2824-2833`

> “over the record returns **36** lines”
>
> “returns **13** lines … returns **60**”
>
> “over the record returns **23** lines”

What is wrong: Those counts are correct for `2695cbb~1`, before §20 and its correction blocks were appended, but the shipped record does not say so. Re-running the printed searches over the shipped file returns 66, 32 plus 77, and 49 lines respectively—not 36, 13 plus 60, and 23. §20’s own prose necessarily adds matches.

Why it matters: The measurements are historically sound but not reproducible from the revision the record presents, precisely the ambiguity earlier correction blocks take care to avoid.

Suggested remedy: Bind all three tallies explicitly to `2695cbb~1`, or say they were taken before §20 was appended. Do not update them as if they were evergreen counts.

### Finding 3 — Low — sentence

`docs/decisions/2d-4a-C-notes.md:2816-2819`

> “the three gate tables of §16, §17.7, §18.7 and §19.9”

What is wrong: Four gate tables are listed, not three. The surrounding total of thirteen tables works only when all four are included: the corrected §19.6 table plus twelve others.

Why it matters: This is another false arithmetic sentence inside the subsection specifically auditing accounting errors.

Suggested remedy: Change “three gate tables” to “four gate tables.” Also clarify that §16 was included in addition to every table in §17–§19.

### What I checked and cleared

- §20.3’s six-position table is correct row by row: all six removed identity; five explicitly say “second traversal”; only the two guard test docs state that nothing couples the traversals; the module overview states neither.
- Narrowing the record instead of enlarging `prose_sweep.rs`’s module documentation remains the right judgment. The existing link avoids duplicating a detailed limitation within one module.
- An independent in-memory replication matched all 140 retained-state and 86 liveness inventory keys over 70 selected files per guard, with zero count disagreements.
- The reported own-family totals and splits reproduce exactly: 308 = 95/192/21 and 196 = 72/106/18.
- The retained-state remainder divides exactly into 6 matches in the first module-doc run, 11 in the later header run, and 4 in the wrapped-claim test.
- Across `2bd7bd5~1..2bd7bd5`, both own-family totals, per-phrase counts, and matched-window multisets are unchanged. The same 308/196 result holds across `e75ec2b~1..e75ec2b`.
- Round 3 added 13 lines to each guard, including exactly 20 added `///` lines.
- §20.6’s sharpest conclusion is factually true for the round-3 commit. Extending the comparison across both families and all three edited source files found zero gained or lost matched windows; Finding 1 concerns only the claim that the guards proved this.
- The §20.7 tallies 36, 13 plus 60, and 23 reproduce exactly against `2695cbb~1`; Finding 2 is their missing revision scope.
- The 224 retained-state hits over 29 files, the reverse-inventory 29/20 file counts, and §20.8’s +517 decision-record line delta hold.
- All five new correction blocks accurately identify the previous text and its substantive correction.
- Keeping adjacent historical corrections remains defensible, though reorganizing §18–§19 before adding more annotations would now improve readability.
- The supplied host gate results are not contradicted by the source or diffs. No source file changed in this fix round.
- Sandbox limit: temporary here-document creation was denied. The same read-only analyses were run in memory, so no requested check remained blocked.

### Verdict rationale

The code and the substantive own-family measurement hold, but the round-4 record introduces three new Low sentence defects: an overclaim about what count-based guards prove, unscoped historical `rg` counts, and another false table-count sentence. These are new defects in this fix round, not restatements of wording already corrected.

## Step 2 — round 6 (against the round-5 fix: §21 in full, its three-step diff argument, §21.5's hand tallies, §21.4's enumeration, §21.8's deviation paragraph, the two step-1 tallies §21.9 item 6 left open, and the record-structure decision)

NOT READY — 0 High, 0 Medium, 5 Low. Two findings are new defects in §21’s own prose, one is a wrong section enumeration repeated within §21, and two are the step-1 measurements §21.9 explicitly left open. These are not merely restatements of wording already fixed; no code defect was found.

### Findings

1. **Low — `docs/decisions/2d-4a-C-notes.md`, §21.5, lines 3398–3402 — the printed Sweep C command does not produce its claimed tally.**

   > “`rg -n -i '\b(two|…|thirteen)\b[^.\n]{0,70}§'` over the record at `2695cbb` returns **30** lines, **21** from §13 on”

   Run literally, the recorded regex returns **14** lines, **11** from §13 onward. The `…` is a literal alternative, not shorthand understood by `rg`. Expanding it to the numeral words `two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen` does reproduce **30 / 21**, so the underlying tally appears right but the command credited with establishing it is not.

   The following **78 / 57** tally is also not independently reproducible from the record because it describes the search in prose without giving its regex, including how far “followed by” reaches and how Markdown punctuation is handled.

   **Narrowest fix:** print the complete first alternation and the exact second regex. Do not present an abbreviated regex as the command that returned an exact count.

2. **Low — `docs/decisions/2d-4a-C-notes.md`, §21.8, lines 3522–3528 — the deviation paragraph presents possible causes as a measured diagnosis.**

   > “Two things had made it likelier and both are named rather than guessed at”

   > “two copies … were competing”

   > “333 s to 110 s for the same target, which is the contention showing up in the clock”

   Only one rerun followed, after the orphan was removed and the build circumstances had also changed. That establishes correlation with the improved result, not that either circumstance made the failure likelier, that watcher contention occurred, or that contention caused the timing difference. §21.9 lines 3588–3593 correctly calls this an inference and says neither factor was separated; that disclaimer does not make the earlier diagnosis measured.

   **Narrowest fix:** call the orphan and completed build observed circumstances that *may* have contributed, and say the timing change is *consistent with* contention rather than demonstrating it.

3. **Low — `docs/decisions/2d-4a-C-notes.md`, §21.7 lines 3495–3497 and §21.9 item 1 lines 3540–3543 — both passages misidentify where the stacked correction blocks live.**

   > “§19 and §20 both hold sentences with two correction blocks stacked beneath them”

   The two stacked locations are **§18.6** at lines 2098 and 2116, and **§19.7** at lines 2473 and 2494. §20 has round-5 correction blocks, but not a sentence with two correction blocks stacked beneath it. §21.9 makes the mismatch especially visible by saying “§19 and §20” and immediately naming “§18.6’s and §19.7’s tails.”

   **Narrowest fix:** change “§19 and §20” to “§18 and §19” in both places.

4. **Low — `docs/decisions/2d-4a-C-notes.md`, §3 opening lines 4–5 and line 128 — the unbound 45-passage claim is no longer true.**

   > “45 passages across eight files in the two source trees point at it”

   > “45 passages now point, verified by `rg -n 'retained_state'` over both trees.”

   The requested current command returns **99 matching lines across 13 files**. Restricting the reading to §3’s original eight files gives 48 matching lines; one is `main.rs`’s `mod retained_state_contract`, leaving **47 pointer occurrences**, not 45. The history explains the move: `34cd5af..57e8800` adds two new pointer passages while step 1’s review fixes are being applied. Thus the claim had already become stale by step 1’s READY commit, before step 2 greatly enlarged the raw search output.

   **Narrowest fix:** bind 45 to the initial step-1 revision and describe it as the hand-judged passage inventory rather than the raw `rg` line count, then note that the step-1 fixes added two pointers. Alternatively, re-audit and state the current count.

5. **Low — `docs/decisions/2d-4a-C-notes.md`, §12.2 lines 1205–1207 — the `decide(` search’s output is incompletely accounted for.**

   > “`rg -n 'decide\(' src-tauri/src/ crates/ --type rust` returns **exactly three** call sites of this `decide` … plus its definition … The only other match is `syntax/ownership.rs`’s own unrelated `decide`”

   The command currently returns **eight lines**, and it returned the same shape at the step-1 close: three calls to `ledger::decide`, its definition, its `End of function decide()` marker, and the unrelated ownership function’s call, definition, and end marker. The substantive conclusion—exactly three call sites of the ledger function—still holds, but “the only other match” does not describe the command’s output.

   **Narrowest fix:** either account for all eight matches or use a call-specific command such as an anchored search over `ledger.rs` that returns only the three invocations.

### Record-structure decision

The record has passed the point where further stacking is better than consolidation. The second blocks make the final claims honest, but the document is no longer readable linearly: stopping after the first block at §18.6 or §19.7 leaves the reader with a superseded narrowing. At minimum, consolidate each of those two stacks into one current correction block that preserves both prior wordings and their chronology. A broader reorganization of §18–§20 into a current account plus a historical appendix would now improve reliability rather than merely aesthetics.

### Checked and cleared

- **§21.2’s “the guards contributed the premise of step 1 and nothing else” is accurate.** `complaints_against` compares counts keyed by `(file, phrase)`. A green guard therefore establishes that every found key is inventoried, which supplies step 1; it does not establish occurrence identity. The same-key substitution limit is correctly attributed to `retained_state_contract.rs:60–63` and `liveness_contract.rs:25–26`, while `prose_sweep.rs:46–52` deliberately defers inherited limitations to each guard.

- **The three-step diff argument holds.** Both historical diffs list the three named Rust files; the inventories contain 140/86 entries over 29/20 files and name exactly one of those three files, `prose_sweep.rs` / `"one entry per"` at retained-state line 954. Neither diff contains that phrase, and its source occurrence is the non-comment assertion string at `prose_sweep.rs:374`; `prose_units` keeps a non-comment line as its own unit.

- **§21.4’s enumeration reproduces:** §16 has 1 table and §§17, 18, and 19 have 4 each, for **1 + 4 + 4 + 4 = 13**.

- **Sweep A reproduces:** 21 matched lines, four in the three corrected positions and 17 left. Its seven-kind arithmetic is **3 + 4 + 4 + 2 + 2 + 1 + 1 = 17**.

- **Sweep B reproduces:** 43 lines total and 23 in §§17–20; its corrected-versus-left accounting is consistent.

- **Sweep C’s intended expanded first search reproduces 30/21**, and the table-separator enumeration gives 21 tables in §§13–20. The literal-command defect is Finding 1.

- The retained-state inventory has **140 entries and 224 hits**. Its seven reason classes reproduce as **29 / 3 / 1 / 2 / 61 / 39 / 5**, including exactly two mixed classes.

- The seven new correction blocks and the replication note are present. Apart from the findings above, their commit bindings and arithmetic are consistent with the local history.

- §21.6’s “strongest evidence this record holds” is acceptably bounded. It compares the two recorded independent replications with the single earlier replication, immediately says neither is a test, and names stronger mechanisms that do not exist.

### Could not check

The read-only workspace prevents responsibly rerunning Cargo gates because builds write artifacts; I did not attempt them. The two external in-memory replications also are not stored in the repository and therefore cannot be inspected or rerun. These limits do not affect the verdict: the findings above are established from the committed record, source, and Git history.
