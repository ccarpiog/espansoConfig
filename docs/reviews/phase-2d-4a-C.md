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
