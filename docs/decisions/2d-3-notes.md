# Phase 2d-3 — save composition and the suppression ledger

**A save this application commits no longer comes back through its own watcher as a foreign
external change, and no external change is lost to that suppression, because six facts hold
together: the commit and the record that describes it are one window no admission can *decide*
inside; every **watcher** observation carries a stamp taken before its reads, so a reading already
in hand when that window opened cannot clear the record either; a refused reading is **answered** —
the engine takes its settlement back, restoring the prior tracked state and **re-hinting** the path,
rather than keeping a state it never really announced, and *answered* names that rollback and never
an observation that arrives; the two save-path refreshes carry **no** stamp, because they run under
the session lock that every producer of a record holds, so their reads follow any record in program
order and no clock decides whether they are heard; where this application has **no** reading to
bring at all — a refresh that raised, or a write that may have landed without saying what it
wrote — it publishes nothing from the read that did not happen and asks the running watcher to
observe that path again, and where it has one it acted on but cannot prove **stable** — either
save-path refresh, which is one read where the engine takes two — it publishes **nothing from that
one either** and asks for a stabilized reading in its place, marking the state for coalescing where
the person has been shown it and recording nothing where nobody has, so a state that never stably
existed never enters the sequence at all; and every one of those requests is an **owed** observation
the engine may not discharge by **coalescing** it into silence, which stays owed until a settlement of
that path emits and which is never a promise that one will — retained across a failing baseline,
emitted even against a state the engine established but never announced, and restored by a refusal
that takes its settlement back **only where that settlement had discharged one** — a refused native
hint's settlement had not, so it is re-hinted rather than re-owed. That record is one entry per
document, written
in exactly one place.** `src-tauri/src/ledger.rs` is the new module: `WriteLedger` holds the
consult's `last_app_write[DocumentId] = { workspace_epoch, revision }` beside the open Tauri
session, together with the per-epoch observation sequence allocator and the announced-state map
that coalescing compares against; `admitting_sink` is the **admission gate**, an
`ObservationSink` the session installs between every watcher and the downstream sink, deciding
under two leaf mutexes it drops before calling anything. `commands.rs` composes with it in three
places and only three: `commit_and_record` — the window `run_one_save` runs its transaction
in — records a committed revision (and nothing else, ever),
`after_a_save` puts a refresh that disagrees with what the transaction last saw through the same
supersession and the same coalescing a native hint meets and **withholds** it from the sequence and
from the coalescing map alike, and `conflict_after_the_lock` records **no** app write and puts its
refresh through those same two steps, **marking** the state it read so a later hint at it coalesces.
Neither can publish; only the watcher's stamped door can (§13). **Neither is asked either retaining
check** — not chronology, because neither reads a clock (§10), and not suppression, because neither
is a native hint (§14).

> **Correction (round-1 fix round, §7).** The headline above stood, before §7's fix, as a claim
> the code did not give: `save_document` performs its rename before returning and the watcher
> worker entered `WriteLedger::admit` under no session lock, so a save could rename to revision
> A, be descheduled, and have its own bytes admitted as **external** before it recorded A. What
> closes it is the **commit gate**, a second mutex distinct from the ledger's state — §7.1. The
> sentence above is rewritten to name the mechanism; what it claims is now true, subject to §5's
> holes, one of which (§5 item 10) is new and is the residue this mechanism cannot reach.

> **Correction (round-2 fix round, §8).** The headline as §7 left it named **one** mechanism and
> claimed the whole property, and the review found a narrower instance of the same defect still
> standing: a gate serializes *decisions* and cannot reach a **read that already happened**. An
> observation stabilized before a save, parked at the gate while that save committed A and
> recorded it, then decided that its bytes are not A, **cleared A's record** and published — and
> the save's own hints of A, finding no record, were admitted as **foreign**. That is not
> over-reporting; it is this application reporting its own committed write as an external change,
> which at 2d-5 becomes a watcher-origin conflict against the user's own save — consult Q8's class
> of failure, though not the case Q8's ruling itself names (§8.1 says which). §8 closes it with the
> **stamp**: `crate::watch::EpochObservation::read_after`, an instant taken before the reads,
> against an instant `record_app_write` takes after the rename. The sentence above is rewritten
> to name both mechanisms, because naming one was exactly what let the second gap hide.
> **§5 item 10 said this residue was unavoidable and "over-reporting only"; it was wrong on both
> counts, and it is rewritten rather than left standing.**

> **Correction (round-3 fix round, §9).** The headline as §8 left it named **two** mechanisms and
> claimed the whole property, and the review found the same shape one layer further down: a
> *refusal* is not a free action, because `ObservationEngine::tick` installs the stabilized state
> into its tracked table **before** the ledger ever sees it. So a refused observation left the
> engine believing it had announced that state, the same bytes re-read afterwards coalesced to
> nothing **inside the engine**, and a genuine external change refused once was never reported
> again — with native delivery working perfectly. The direction the record called *safe* was
> therefore lossy, and §5 item 13's sentence that a re-hint would "produce a fresh observation" was
> false. §9 closes it with the **third** mechanism: the refusal is **answered**, and
> `ObservationEngine::revert_settlement` takes the settlement back so the path is un-concluded and
> re-observed. The same round also made the chronology comparison **strict** — `Instant` is
> monotonic and not guaranteed strictly increasing, so equality ordered nothing and a
> clock-resolution collision restored round 2's exact failure. The sentence above is rewritten to
> name all three mechanisms, and **this round is the first to change
> `crates/espansoconfig-core`** — the paragraph below that says the core was not touched is
> corrected there.

> **Correction (round-4 fix round, §10).** The headline as §9 left it said *every* observation
> carries a stamp, and treated the stamp as the mechanism that makes a reading safe. Both halves
> were wrong about the **save path**, and that is the fourth consecutive narrower instance. Its two
> refreshes stamp `Instant::now()` microseconds after their own save's record, on one thread, into a
> comparison that accepts only a strictly later value — so a clock-resolution collision refused
> them. Unlike a watcher observation there was no settlement to take back and no loop to retry, so
> the cost was not *one publication* (§5 item 16's claim) but **the external observation itself**:
> nothing guarantees the native backend reports the same replacement (`2d-2-notes.md` §2.3), and the
> consult requires a disagreeing post-save refresh to be *queued as external*
> (`phase-2d-design.md` Q2). §10 closes it with the **fourth** fact, and it is a proof rather than a
> mechanism: a record can only be inserted by a thread holding the session lock, and these two
> callers hold it, so their reads follow any record in program order with no clock in between.
> `WriteLedger::admit_at_current_epoch` is renamed `admit_under_the_session_lock` and drops its
> `Instant`. **§5 item 16 said the cost was one publication and that the replacement "is reported
> by the watcher's own hints"; both were false, and the item is replaced rather than left
> standing.**

> **Correction (round-5 fix round, §11).** The headline as §10 left it said *four facts*, and the
> review found the fifth consecutive narrower instance: **the same loss, reached through an `Err`.**
> A post-save refresh that *fails* — an external process removes or locks the file between the
> rename and the re-read — admitted nothing, and §5 item 18 called that acceptable because the only
> alternative it could see was publishing an unstabilized single read. That is a false choice. The
> engine can be **asked** to observe the path, and its ordinary two reads then produce a state the
> stamped door admits. §11 closes it with the **fifth** fact: `crate::watch::ReObserver::re_observe`,
> a path into the running watcher's inbox, on three arms — both failed refreshes and the uncertain
> write, which the review did not name and this round's shape sweep did. **§5 item 18 said closing
> it "would be worse"; that was wrong, and the item is replaced rather than left standing — the
> third time a hole this record stated as bounded turned out to be a real defect (item 10 at round
> 2, item 16 at round 4, item 18 now).** `SaveRecords` is renamed `SessionSideOfASave`, because the
> value now carries something that is not a record.

> **Correction (round-6 fix round, §12).** The headline as §11 left it said *five facts*, and the
> review found the sixth consecutive narrower instance — **twice, and both times inside an item §5
> had already judged and dismissed.** §11's mechanism was right; two of its claims about the shape of
> it were not, and one arm it never touched carried the same defect. First: *asks the running
> watcher* was a request the worker could **accept and then discard**, because a worker whose
> baseline is still failing has no engine to hint — and §5 item 20 called that loss bounded by an
> epoch reset, which it is not, since the workspace stays open and the ledger's record stays with it.
> Second, one layer deeper: even delivered, the request was an ordinary **hint**, which asks *has
> anything changed since I last told you* — and `ObservationEngine::start` **establishes** the
> tracked table without telling anybody anything, so a hint could be answered by silence for a state
> the asking caller had never heard. Third, on the arms §11 did not touch at all: a save-path refresh
> that **succeeds** publishes a **single** read into the ledger, and §5 item 3 called that *not new
> exposure*; it is, because a foreign non-atomic write can present a parseable intermediate that
> never stably existed, and nothing asked for anything further precisely because the read succeeded.
> §12 closes all three with the **sixth** fact: the request is an
> `ObservationEngine::observe_owed` **debt** — retained across a failing baseline, answered even
> against an established-but-unannounced state, re-owed when a refusal takes its settlement back —
> and both admitting refreshes now ask for one beside publishing what the consult requires them to
> publish. **§5 items 20 and 3 are replaced rather than left standing, and that makes five of that
> section's items found to be real defects after being written as honestly bounded** (10, 16, 18, 20,
> 3). This round is the **second** to change `crates/espansoconfig-core`, and the paragraph below
> that names the round-3 change as the only one is corrected there.

> **Correction (round-7 fix round, §13).** The headline as §12 left it still said that a save-path
> refresh *keeps what it published*, and that was the **seventh** consecutive round's finding — the
> half of round 6's remedy that §12.2 rejected deliberately, on an argument from consult Q3 that
> reads Q3 backwards. Q3 guarantees that for each document the frontend acts only on the **highest
> sequence it has accepted**: that forbids a consumer regressing to an older sequence, and obliges
> nobody to wait for a sequence that does not exist yet. So a phantom published at *n* is not made
> harmless by a stabilized reading arriving at *n+1* — a 2d-4 drain landing between them accepts the
> phantom, an open write surface installs it as its conflict, the person confirms *Reload*, and the
> draft is gone where no later sequence can give it back. §13 closes it by **splitting the
> coalescing marker from the sequence-spending publication**: `WriteLedger::admit` remains the only
> door that can spend a sequence, and the two save tails get doors of their own —
> `mark_under_the_session_lock`, which records the state the person is shown so consult Q5's
> duplicate still coalesces, and `withhold_under_the_session_lock`, which records nothing at all
> because nobody was shown anything and a marker there would swallow the engine's own stabilized
> reading. **No single unstabilized read enters the observation sequence**, and that is now a
> property of which methods exist. **§5 item 3 is replaced for the second time**, which makes it
> the only item of that section to have been wrong twice, and six of that section's items have now
> been found to be real defects after being written as honestly bounded (10, 16, 18, 20, 3, and 3
> again). This round changed **no** core file at all.

> **Correction (round-8 fix round, §14).** The headline as §13 left it said the two save tails go
> through *the same checks a native hint meets*, and that was the **eighth** consecutive round's
> finding — the first since round 6 that is a defect in behaviour rather than a sentence. Round 7
> gave each tail its own door and left `decide`'s steps 1–4 shared, so **suppression ran before the
> door was consulted**: a record made stale by anything outside this ledger — `reload_document`
> accepting a foreign revision into the workspace, or a save answering `committed: false` and
> recording nothing — could answer `SelfWrite` to a save tail that had already established its
> reading differs from its own transaction. The marking door then lost consult Q5's coalescing
> entry, and the withholding door, whose *only* effect is the record removal, had no effect at all —
> so the same record went on to suppress the owed stabilized reading that tail asked for, and consult
> Q2's *the differing post-save observation is queued as external* was met by nothing. §14 closes it
> by making suppression **door-scoped**, exactly as chronology has been since §10: the check exists
> to absorb the several **native hints** one atomic replacement generates, and a native hint arrives
> through the stamped door alone. The sentence above is amended to say which steps are shared and
> which are the stamped door's, because saying *the same checks* is what let a shared step mean three
> different things. §5 gains items 23 and 24, both of them holes this round **found** rather than
> made. This round changed **no** core file at all.

> **Correction (round-13 fix round, §19).** The headline as §14 left it ended on a **liveness
> guarantee the engine expressly refuses**, and that is round 13's second High, at this record's
> sharpest name position: *every one of those requests is an **owed** observation the engine **must
> answer** rather than a hint it may coalesce into silence*.
> `crates/espansoconfig-core/src/watch/engine.rs`'s `observe_owed` says the opposite in its own
> *what this does not do* paragraph — it *"promises no answer at all for a path that never
> stabilizes: a file written continuously stays pending, and the debt waits with it"* — and a path
> outside this engine's roots is dropped exactly as a hint is, recording **no** debt at all. §5 item
> 21 of this record already conceded, separately, that a re-observation absorbed by a worker that
> then receives `Stop` is *"a request no tick will serve"* — so **the headline contradicted its own
> §5 from the round-6 fix round that wrote the clause**, through the two correction blocks added
> above it since (rounds 7 and 8) and six reviews. What the debt really gives is a **negative**
> guarantee, and the sentence above now says only that: an owed observation cannot be discharged by
> **coalescing** it into silence, and it stays owed until a settlement of that path emits — with the
> denial that a settlement will occur written into the **same sentence**, per §17.2's rule. The code
> twin of the false sentence stood in `src-tauri/src/commands.rs`'s module header, in the same words,
> and is corrected there in the same round (§19.2). **Nothing about the property this headline claims
> is weakened by the correction**: *a hint that could be answered by silence* was round 6's **first**
> High (§12.1) and `observe_owed` still closes it; what is withdrawn is a promise that the answer
> arrives, which no round ever built and which §5 items 19 and 21 already denied.

> **Correction (round-14 fix round, §20).** The headline as §19 left it was wrong about the
> **rollback itself**, twice, and both are round 14's Highs — the fourteenth consecutive round to
> find something at a name position, and the ninth §1 correction block. First: *the engine takes its
> settlement back **and observes the path again*** promised an observation that
> `ObservationEngine::revert_settlement` expressly does not emit. Its own doc says *"it schedules a
> read, so it **emits nothing itself**. The observation comes back out of a later `tick`, with
> whatever the file holds **then**"* — and a path that never stabilizes is never answered at all.
> The sentence now says the engine **restores the prior tracked state and re-hints the path**, with
> *answered* naming that rollback and nothing that arrives. Second: *re-owed when a refusal takes its
> settlement back* was unconditional, and the primitive is conditional. `revert_settlement` restores
> the debt **with the state** — `Undone { replaced, owed }`, then `if owed { self.observe_owed(…) }
> else { self.hint(…) }` — so a settlement that had discharged no debt, which is every ordinary
> **native hint's**, takes the plain `hint` arm. A hint *can* be coalesced away, which is exactly
> what "stays owed" promises cannot happen, so the clause claimed the anti-coalescing guarantee for
> readings that do not carry it. It now says the debt is restored **only where that settlement had
> discharged one**. **The two negatives the reviewer cleared are retained word for word and are not
> weakened**: a `PrecedesACommit` refusal publishes nothing and clears nothing. And as at round 13,
> **the primitive said the true thing and only its consumers' descriptions were wrong** —
> `revert_settlement`'s *"A debt is restored with the state. If the settlement being taken back
> discharged an `observe_owed` request, the path is owed again"* is correctly conditional, and this
> round changes no core file.
>
> **This block corrects the identical clause wherever it stands in this stack**, and it stands twice:
> in the headline above, and in the **round-6 fix round's** block, whose *"re-owed when a refusal
> takes its settlement back"* is the clause's origin in §1. That older block is left as it was
> written, as every superseded block in this stack is; read it with *restored only where that
> settlement had discharged a debt* in place of *re-owed*. §12.6, where round 6 wrote the same clause
> in its *guaranteed* paragraph, carries its own round-14 block.

The consult is `docs/reviews/phase-2d-design.md`; **Q7 item 3** is this step's specification,
**Q2** is the ruling on the predicate, the ledger's location and lifetime, where the update
belongs and what `conflict_after_the_lock` must do instead, **Q1** rules the lifecycle owner
(its ruling carries a round-4 correction block, read with it) and **Q3** rules what must not
exist yet. `docs/decisions/2d-2-notes.md` §2 is the lifecycle surface this composes with and §5
the holes it inherits — **item 5, the epoch tag with no reader, is the one this step
discharges**; `docs/decisions/2d-1-notes.md` §2.1 is where the predicate's shape and its caller
obligation were written down with 2d-3 named as the owner of the ledger that discharges it.

**No wire, no window, no writer, no force flag.** No command was added or changed in signature,
no Tauri event exists, no queue and no `drain_external_changes`, no Svelte or i18n file moved,
and no user-facing string was added. **The core crate was untouched through round 2 and is not
untouched now**: the round-3 fix round added `ObservationEngine::revert_settlement` and
`Observation::path()` to `crates/espansoconfig-core/src/watch/engine.rs` (§9.1 is why that
could not be done a layer out), and the round-6 fix round added
`ObservationEngine::observe_owed` there (§12.1). **Both are ledger-agnostic and neither carries a
Tauri or a save dependency**: one says *the caller could not use that conclusion*, the other says
*the caller could not use what it read; tell it what this path holds*, and no save, ledger or
application session enters that module through either. The architecture rule is unchanged and
re-checked — `cargo tree -p espansoconfig-core | rg tauri` still finds nothing, and the engine
learns nothing about saves, ledgers or application sessions. The new Rust types (`ObservedState`,
`Admission`, `AppWrite`, `LedgerTally`, `AdmittedObservation`, `SessionSideOfASave` — `SaveRecords`
until §11 renamed it — since §11, `ObservationSide`, `ReObserver` and `ReObserveOutcome`, and since
§12, `crate::watch::HintOrigin`) serialize nothing
and cross no boundary, so the dictionary contract's serializable-enum sweep has nothing new to
account for. Admitted observations still end at a **discarding** downstream sink in production:
they are produced, decided and dropped, and a value that sink drops is gone.

---

## 1. What this step built

- **`src-tauri/src/ledger.rs`** (new) — `ObservedState` (the three stabilized states one
  observation asserts) with `observed_state` and `observed_path`; `Admission` (five decisions,
  six since §8, **eight since §13**); `AppWrite` (the consult's record); `LedgerTally` (four counted
  decisions, five since §8, **seven since §13** —
  §2.8); `WriteLedger` with `new`, `begin_epoch`, `record_app_write`, `admit`,
  `admit_at_current_epoch`, the four observability accessors and the test-only
  `seed_sequence`; the private `decide`, which is the whole rule; `AdmittedObservation` and
  `AdmittedSink`; `discarding_sink` (moved here from `watch.rs`, retyped, same honesty); and
  `admitting_sink`, the gate. Ten module tests (§3), and three more from the round-1 fix round
  (§7), which also added the commit gate itself: `CommitGate`, `begin_commit` and the private
  `enter_gate` (§7.1). The round-2 fix round added the chronology stamp (§8.1): the private
  `RecordedWrite`, `Admission::PrecedesACommit`, `LedgerTally::preceded_a_commit`, and the
  `read_after` operand on `admit`, `admit_at_current_epoch` and `decide` — two tests added, one
  removed, so fourteen module tests. The round-3 fix round (§9) made that comparison **strict**,
  made `admitting_sink` answer `crate::watch::ObservationOutcome` from the **same** match that
  decides whether an observation reaches `downstream`, turned `observed_path` into a delegation to
  the core's new `Observation::path()`, and added the test-only `recorded_at` accessor — two tests
  added, so sixteen module tests. The round-4 fix round (§10) added the private `ReadChronology`,
  the two-variant mode `decide` now takes in place of a bare `Instant`; renamed
  `admit_at_current_epoch` to **`admit_under_the_session_lock`** and removed its `read_after`
  operand; and added the test-only `stamp_the_record_at` seam — one test added, so seventeen module
  tests. The round-5 fix round (§11) added **no** production code here and one test —
  `a_removal_the_save_path_could_not_read_is_stabilized_and_admitted`, the engine-plus-gate half of
  the round's High — so eighteen module tests; it also renamed
  `a_session_locked_reading_is_never_refused_by_the_records_own_instant` to
  `a_serialized_door_reading_…` (§11.3) and corrected the *what the types do not force* paragraph,
  which still described a save-path stamp that has not existed since §10. The round-6 fix round
  (§12) added **no production code here either** — the *what is weaker here* paragraph on
  `admit_under_the_session_lock` and the module's *a read the save path could not use* section are
  rewritten around round 6's second High, and one test is added — it was called
  `a_one_read_publication_is_superseded_by_the_state_the_engine_stabilizes` then and §13 renamed it
  `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` — so nineteen module
  tests. The round-7 fix round (§13) is the first since §10 to change production code here, and
  what it changes is the shape rather than the rule: `ReadChronology` becomes the three-variant
  private `AdmissionDoor`, which decides the chronology proof **and** what a surviving state may do;
  `admit_under_the_session_lock` is split into **`mark_under_the_session_lock`** and
  **`withhold_under_the_session_lock`**, neither of which can spend a sequence;
  `Admission::Marked` and `Admission::Withheld` are the two new decisions, with
  `LedgerTally::marked` and `LedgerTally::withheld` beside them; `LedgerState::published` becomes
  `announced` and `published_state` becomes `announced_state`, because a marker is not a
  publication. One test added,
  `a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not`, so twenty module tests.
- **`crates/espansoconfig-core/src/watch/engine.rs`** — **the only core file any round of this step
  touched**, in the round-3 fix round (§9.1): `ObservationEngine::revert_settlement`, the
  private one-pass `undo` map and the private `Settled` value that fills it, `Observation::path()`,
  and `Clone` on the private `Tracked`/`LastContent` for the single settlement that needs it. One
  test added. The round-6 fix round (§12.1) added `ObservationEngine::observe_owed` and the private
  `owed` set it fills; the private `Undone` value the `undo` map now holds, which carries the debt
  beside the replaced state so a refusal re-owes it; an `owed` operand on `settle` and its three
  settlements, with the re-insertion that makes *a debt is spent only by a settlement that emitted*
  structural rather than an agreement between them; and the doc corrections on `Observation::Changed`,
  `Observation::Removed` and `ObservationEngine::start` that the two new emitted shapes owe. One test
  added.
- **`src-tauri/src/commands.rs`** — `WorkspaceSession` gained the session-lifetime
  `ledger: Arc<WriteLedger>` and `observing` now **wraps** the injected sink in the gate;
  `unwatched()` does too; `open` calls `begin_epoch` under the session lock, before the
  successor watcher starts; `with_open` lends a `SaveRecords` (the backup session and the
  ledger, together — §2.7) instead of a bare `&BackupSession`; the six planners pass it
  through; `run_one_save` delegates its transaction to `commit_and_record` (§7.1), which takes the
  one record through the new exhaustive `committed_revision` inside the ledger's commit window;
  `after_a_save` and `conflict_after_the_lock` take the ledger and the document's path and
  admit what their refreshes saw. Seven new tests (§3), and one more from the round-4 fix round
  (§10), which also took the `Instant::now()` line off both refreshes: they now call
  `admit_under_the_session_lock`, and `std::time::Instant` is no longer imported by the module at
  all. The round-5 fix round (§11) renamed `SaveRecords` to **`SessionSideOfASave`** and gave it a
  third field — the open watcher's `ReObserver` — added the narrower `ObservationSide` the two tails
  take in place of a bare `&WriteLedger`, and added `after_an_uncertain_write`, the third arm that
  asks. Three new tests, so eleven. The round-6 fix round (§12.2) added the **fourth and fifth**
  arms that ask — `conflict_after_the_lock`'s *successful* refresh and `after_a_save`'s
  *disagreeing* one, both of which publish a single read and now ask for a stabilized reading
  beside it — and rewrote the module header's count of what this module composes with, both tails'
  documentation and `SessionSideOfASave::watcher`'s *three arms* sentence. Two new tests, so
  thirteen. The round-7 fix round (§13) moved both tails onto the new doors —
  `conflict_after_the_lock` **marks** and `after_a_save` **withholds**, and neither publishes —
  rewrote both tails' sections and `run_one_save`'s around that, and corrected the module header's
  *composes with five other things* to **six**, naming the settlement rollback it had omitted
  (round 7's first Low). **No new test**: the two the round-6 fix round added are the ones that
  carry it, with their claims inverted and their names with them
  (`a_disagreeing_post_save_refresh_announces_nothing_and_asks_for_a_stabilized_reading` and
  `a_conflict_refresh_marks_its_disk_side_and_still_asks_for_a_stabilized_reading`), and three
  older ones renamed the same way, so thirteen still.
- **`src-tauri/src/watch.rs`** — `discarding_sink` removed (it is the *downstream* sink and now
  lives with the gate); `EpochObservation` gained `read_after` and the worker gained
  `WatchWorker::observe`, the two-line function that takes it (§8.1); the round-3 fix round added
  `ObservationOutcome` and `deliver` — the sink now **answers**, and `deliver` is the one place that
  answer is read, calling `revert_settlement` for the one arm that means *this decided nothing*
  (§9.1); `EpochObservation` lost its scoped dead-code allowance, because the gate
  reads its fields in production — 2d-2 §5 item 9's intended end state for that allowance;
  `ObservationSink`'s contract now names the gate as the session's one instance of it. The round-5
  fix round (§11) added the re-observation path here: `WorkerMessage::ReObserve(PathBuf)`,
  `ReObserver` and `ReObserveOutcome`, `WatcherLifecycle::re_observer`, the extracted
  `WatchWorker::hint_paths` both a native hint and a re-observation go through, and the test-only
  `WatcherLifecycle::listening`/`HintInbox` seam. One test added. The round-6 fix round (§12.1)
  renamed `hint_paths` to **`WatchWorker::schedule_paths`** and gave it the new `HintOrigin`, because
  the two origins no longer ask the same question — a native hint stays a hint and an
  application-originated request becomes an owed observation — while the re-spelling and the clock
  stay one rule; and it made `WatchWorker::baseline` **retain** application-originated requests
  across a failing enumeration and hand them to the engine it finally opens. One test added, on a
  real spawned worker with no FSEvents stream at all.
- **`src-tauri/src/watch_check.rs`** — retyped onto `AdmittedSink`/`AdmittedObservation` (the
  seam moved one layer out, §2.3), `observed_path` delegates to the ledger's rather than
  keeping a second copy, and two new real-filesystem checks over synthetic temp trees (§3).
- **`src-tauri/src/main.rs`** — the module declaration and the phase paragraph. The round-4 fix
  round scoped the stamp to *watcher* observations there; the round-5 fix round corrected the count
  the same paragraph still gave as **three**, which was already four before this round's own fifth
  fact (§11.3, round 5's first Low); the round-6 fix round takes it to **six** and describes both
  halves of the sixth — the owed observation, and the two admitting refreshes that now ask. The
  round-7 fix round leaves the count at six — it rewrote the fifth fact rather than adding a
  seventh, and the count was re-derived by counting the facts the paragraph names — and replaced
  its *what it publishes is kept* sentence with the marker/withholding split.

---

## 2. The decisions

### 2.1 D1 — the ledger lives beside the session, its mutexes are leaves, and the gate drops both guards before it calls anything

> **Correction (fix round, §7.1).** This section was written when the ledger held one mutex. It
> now holds two — a **commit gate** beside the state — and the heading and the bullets below are
> updated in place; the argument they make is unchanged and the second mutex extends it. §7.1 is
> the deadlock argument for the pair, against the four shapes 2d-2 left live.

Consult Q2 puts the record beside the open Tauri session — not in core global state and not in
the frontend — and this is that, as a field of `WorkspaceSession` rather than of `Open`, because
a workspace replacement **empties** it rather than replacing it (§2.4) and because the watcher's
gate holds the same `Arc`. The concurrency shape is the load-bearing part, and it is the shape
2d-2's round-1 review demanded: the sink runs on the watcher's worker thread, synchronously, and
a sink may call back into the session. So:

- **the ledger's state mutex is a leaf, exactly as `WorkspaceEpochs`'s is.** `admit`,
  `admit_under_the_session_lock` (`admit_at_current_epoch` until §10 renamed it),
  `record_app_write` and `begin_epoch` run **no caller-supplied
  code** — there is no closure and no callback under the guard — so it cannot be one
  side of a lock cycle. Since §8 there is exactly one call under it that leaves the module,
  `Instant::now()` in `record_app_write`, and it is named rather than left inside a blanket
  *"no I/O"*: a clock read takes no lock of this process's and can block on nothing a caller
  controls;
- **the commit gate is a leaf too, and the one thing that runs under it is named.** Since §7.1
  it is held across `save_document`, which is core code taking plain data: it holds no reference
  to this session, calls back into nothing here, and blocks only on `crate::persist`'s per-path
  registry, which excludes this process's cooperating callers alone. So the gate can be waited
  *on* without ever waiting for the waiter;
- **the decision is a value, and the downstream call is outside the guard.** `decide` returns an
  `Admission`; `admitting_sink` matches on it after the guard has been dropped and only then
  calls the sink it wraps. A downstream sink is therefore free to call back into the session
  *and* into the ledger, which is not a hope: `the_downstream_sink_runs_outside_the_ledger_lock`
  drives one observation through the gate on a spawned thread with a downstream that re-enters
  the ledger, and a regression to a guard held across the call fails as a bounded timeout rather
  than hanging the suite;
- **the worker thread never takes the session lock.** The gate resolves an observation's path to
  a ledger entry through the ledger's own path index (§2.2), so nothing on the worker's path
  reaches `WorkspaceSession::open`'s mutex. The lock order is **session → gate → state** on every
  path and never the reverse: a save takes all three (through `commit_and_record`), `open` takes
  all three for `begin_epoch`, and the worker takes gate → state with no session lock at any
  point.

What Rust does not force, in the same sentence: nothing stops a future method on `WriteLedger`
taking a closure and calling it under the guard, and nothing stops a future gate calling
downstream before dropping it. The leaf property is a property of the code as written, kept by
`decide`'s signature — it takes `&mut LedgerState`, so it cannot be reached without the guard and
cannot take it twice — and by the one test above.

### 2.2 D2 — the record is keyed by `DocumentId` and reached by path, because an observation names a path and never an identity

The consult's record shape is `last_app_write[DocumentId]`, and that is exactly what `writes`
is. But an `Observation` is path-based, and resolving a path to a `DocumentId` needs either the
open `Workspace` — behind the session lock, which the worker must not take (§2.1) — or a widening
of the core's `pub(crate)` `identity_of`. Neither was taken. Instead the ledger keeps its own
`documents_by_path` index, written and erased in the same two statements as `writes`, populated
from the `DocumentContext` `run_one_save` already holds: the same value the save's own
`SaveRequest` is built from, so the ledger's spelling of a path is the workspace's own and not a
second derivation of it.

**Why that is not a second source of truth**: the process-wide identity table a `DocumentId`
comes from is itself keyed by path for the life of the process and never re-points
(`2d-1-notes.md` D7), so path ↔ document is one-to-one within a session and the two directions
cannot disagree about which document a path is. **What is not forced, said here rather than
discovered later**: that the workspace's spelling of a path and the watcher's are the same
string. That agreement is `crate::watch::HintSpelling`'s (2d-2 D6) plus discovery's — both walk
the same `workspace.root()` — and `2d-1-notes.md` §5 item 3's residue (a backend spelling that
differs by case alone, or a root whose symlinked ancestor appears after worker start) is
inherited here unchanged: such a hint misses the tracked entry in the engine long before it could
miss a ledger key.

**The entry carries its epoch, and that is redundant today.** `begin_epoch` discards the whole
map, so an entry's epoch always equals the current one, and the suppression check's
`entry.epoch == ledger.epoch` filter can never fail. It is stored and checked anyway because the
entry's own claim is *committed under this epoch* and the two statements of that rule — the
discard and the tag — are different statements: a future path that discarded late, or not at
all, would silently begin suppressing across a workspace replacement. Nothing in the type system
ties them together; the test that pins the discard
(`workspace_replacement_discards_the_whole_map`) and the entry's own field are two places, not
one, and this sentence is the record of why.

### 2.3 D3 — the gate is installed by `WorkspaceSession::observing`, and what a test injects is what is behind it

Consult Q7 item 3 needs the suppression to *happen*, which means something must sit between the
watcher and whatever consumes observations. That something is `admitting_sink`, and it is
installed by `WorkspaceSession::observing` — **the one site that creates a ledger and installs
its gate**, and the constructor every session goes through: `WorkspaceSession::new` delegates to
it, and the test-only `unwatched()` was rewritten this step to build through it and then flip its
one switch rather than assembling a second session of its own, because a second such site is where
the two would drift apart. So the seam a test injects at moved one layer out: `observing` now
takes an `AdmittedSink`
(`Fn(AdmittedObservation)`) rather than an `ObservationSink` (`Fn(EpochObservation)`), and what a
caller sees is what this session **admitted** — never what it suppressed, coalesced or discarded.

`AdmittedObservation` is a different type from `EpochObservation` rather than the same one with a
number added, because a value of it has already passed three checks; the two types' shared field
names (`epoch`, `observation`) are what made `watch_check`'s eighteen existing tests a retyping
rather than a rewrite, and all eighteen still pass.

> **Correction (fix round, §7.3).** *A retyping rather than a rewrite* was true of the source and
> false of one test's **meaning**: putting the gate in front of the sink took the leak verdict away
> from `a_successful_reopen_cancels_and_joins_the_old_watcher_and_bumps_the_epoch`, whose closing
> drain window can no longer see a leaked worker because §2.4's epoch discard runs first. Round 1's
> Medium. All eighteen still compiling and passing was never evidence that all eighteen still
> observed what they were written to observe; §7.3 asks that question of each of them and fixes the
> one where the answer was no.

**A gate that is merely constructible is not a gate**, so the production path is proved rather
than read off the constructor: `a_committed_save_is_suppressed_while_a_later_external_write_is_not`
opens a real session, commits a real `save_document` transaction through
`WorkspaceSession::save_raw_document`, and waits — a **bounded positive wait on the suppression
tally**, not an inference from silence — for the watcher to have stabilized on the save's own
rename and met the record. Only then is the negative read.

### 2.4 D4 — `open` adopts the epoch before the successor starts, and that is what finally gives the epoch tag a reader

`WorkspaceSession::open` calls `ledger.begin_epoch(epoch)` inside the same locked block that
mints the epoch and installs the successor, and **before** `watcher_for` starts it. The order is
load-bearing in one direction and stated in the other:

- **before the successor starts**, so the successor's very first observation cannot be discarded
  as stale by an epoch the ledger had not yet adopted;
- **while the replaced watcher is still running** — it is cancelled and joined after the lock is
  released (2d-2 D1) — so every observation the replaced worker produces from that instant on
  carries an epoch the ledger no longer holds and is discarded. That is the correct answer, not a
  loss: the workspace those observations describe is no longer open. **It is also what cost 2d-2's
  reopen test its leak verdict** — a leaked worker's observation is now discarded before the sink,
  so silence at the sink stopped meaning *no leak*. §7.3 is the repair, and it is the direct fact
  instead: the replaced watcher's join probe reads complete the instant an ordinary `open`
  returns.

This is the reader `2d-2-notes.md` §5 item 5 said the epoch tag did not yet have. The fence 2d-2
shipped was physical (a replaced watcher's channel receiver is gone) plus the join-before-return
order; what it could not cover was the in-flight window, and the tag is now checked there.

On an exhausted epoch space the ledger adopts `NO_EPOCH` — the zero the epoch contract reserves
for *unset* — matching the `WatcherLifecycle::without_epoch` that arm installs. Nothing observes
under it, because that lifecycle has no worker.

### 2.5 D5 — one exhaustive expression decides what a save records, and the uncertain write is an absence of a condition rather than a condition

`committed_revision(&Result<SavedDocument, SaveError>) -> Option<ContentRevision>` is the whole
of the write-side rule:

```rust
match outcome {
    Ok(saved) if saved.committed => Some(saved.revision),
    Ok(_) | Err(_) => None,
}
```

It is a named function rather than four branches inside `run_one_save` because *only a committed
revision is ever recorded* is then a property of the type rather than of a reviewer's reading —
and because the sharpest arm is the one with no branch at all. **An uncertain write
(`SaveError::may_have_written`) records nothing not because a condition excludes it but because
no error reaches the recording line**: its committed revision is by definition unknown, recording
a guess would suppress a real later observation, and recording nothing makes that observation
external, which is the safe direction. The existing `evict` on that arm is unchanged.

`commit_and_record` calls it once, inside the commit window and therefore before the outcome is
handed to `after_a_save` — the consult's *before* — and that is the one `record_app_write` call
site in the crate. It is in the shared tail rather than in six wrappers for the reason every other
rule there is: six copies drift, and this one drifts **silently**, because a wrapper that forgot
to record would look exactly like a wrapper whose save an external writer had overtaken. (Before
§7.1 the call was four lines in `run_one_save` itself, and the gate is what moved it into a
function of its own; the rule it applies is unchanged.)

### 2.6 D6 — the two save-path refreshes are observations, and they go through the same decision a native hint does

Consult Q2 gives `conflict_after_the_lock` the opposite job from `run_one_save`'s: record no app
write, keep the cache refresh, and publish/coalesce the external observation under the same
sequence allocator. Both halves are implemented, and `after_a_save` gets the same treatment for
its own disagreeing refresh:

- **`conflict_after_the_lock` records nothing, and that is the load-bearing half.** Were it to
  record the disk's revision as an app write, the very external change the watcher exists to
  report would be suppressed the moment it stabilized. Its refresh instead goes through
  `admit_under_the_session_lock` (`admit_at_current_epoch` until §10 renamed it), so the disk state
  the conflict payload was built from is published
  once and a later native hint at it is a `Duplicate` rather than a second conflict. The Rust-side
  refresh itself **stays**: it is cache coherency and the two-observation truth, not watcher UI
  adoption;
- **`after_a_save` publishes only when its refresh disagrees with the revision the transaction
  last saw.** Agreement means either the bytes this save committed — already recorded a line
  earlier, and therefore *suppressed* by that record rather than published — or a skipped commit,
  where the file holds what the caller already had and there is no observation to make.
  Disagreement is the consult's post-commit external replacement: the ledger records **only** the
  revision this application committed, the differing state is admitted rather than suppressed, and
  a committed write is never relabelled a failure.

**One rule, two callers, so "external rather than self" cannot be two rules that agree today.**
The consequence is a case worth naming rather than hiding: when the disk holds bytes *this
application itself committed earlier* and the caller's base was older still — reachable only
through `save_raw_document`, which deliberately takes no pre-transaction revision check, since
every other writing command refuses a stale base with `identityStaleRevision` first — the
conflict's admission answers `SelfWrite` and publishes nothing. That is correct and is the
predicate's own limit: byte identity, never authorship.

**Both callers stamp their read, since §8.** `admit_at_current_epoch` takes a `read_after` like
`admit` does, and each caller takes `Instant::now()` on the line above its `Workspace::refresh`.
Neither can currently be refused by that comparison — both run under the session lock, which is
the lock a save holds, so no commit can land between their stamp and their decision — and the
parameter exists anyway, for this section's own reason: an internally taken `Instant::now()` would
be stamped **after** the read it is meant to bound, which is the exact shape of the defect §8
closes, and a second rule that agrees today is what §2.6 exists to refuse.

> **Correction (round-4 fix round, §10).** The paragraph above is **wrong in its middle sentence**,
> and that sentence was round 4's High. *"Neither can currently be refused by that comparison"* is
> false: no **concurrent** commit can land between the stamp and the decision, but `after_a_save`'s
> own save recorded a few lines earlier on the same thread, and `decide` accepts only a *strictly*
> later stamp — so a clock-resolution collision between two adjacent `Instant::now()` calls refuses
> it, with no settlement to take back and no loop to retry. §9.2's last paragraph and §5 item 16
> already knew this and got the cost wrong; §10 gets both right. **Neither caller stamps now.**
> `admit_under_the_session_lock` takes no `Instant`, because the session lock these two already
> hold is the lock every producer of a record holds, so the record precedes the read in program
> order and there is nothing for a clock to prove. *One rule with two callers* is unchanged and is
> what this section is about: both still reach the same `decide`, with the same suppression, the
> same supersession, the same coalescing and the same sequence allocator. What differs is only
> which **proof of chronology** each door can build, and neither door lets its caller choose
> (§10.1).

**Where this is weaker than the watcher's own admissions, said in the same place as what it
does**: a save-path refresh is a *single* read, where an engine observation is two equal
consecutive ones, so the consult's *a different **stabilized** revision* is met by the watcher's
callers and not by these two. A torn read would publish a state that never stably existed. That is
accepted because the same single read already builds the conflict payload the person is shown, so
it is a property of `Workspace::refresh` rather than one this step introduces.

> **Addition (round-5 fix round, §11).** Nothing above is falsified, and one case it does not cover
> is the round's High: a refresh that **raises** is not a weaker observation, it is **no**
> observation, and this section's *one rule, two callers* says nothing about what a caller with no
> reading should do. The answer is that it admits nothing — the paragraph directly above is the
> reason, taken to its limit: if a single *successful* read is weaker than the engine's two, a
> single failed one proves nothing at all — and hands the path to the watcher instead
> (`crate::watch::ReObserver::re_observe`). So the two callers are unchanged, the two doors are
> unchanged, and no third proof of chronology exists; what §11 adds is a way to *get* a reading
> where this section's callers have none.

> **Correction (round-6 fix round, §12).** The paragraph two above — *where this is weaker than the
> watcher's own admissions* — states the weakness correctly and then draws a **false conclusion**
> from it, which was round 6's second High. *"That is accepted because the same single read already
> builds the conflict payload the person is shown, so it is a property of `Workspace::refresh`
> rather than one this step introduces"* is wrong in its second clause: a payload is shown once and
> replaced by the person's next action, while a state published here persists in the coalescing map
> and spends a sequence, so publishing a torn or intermediate read **is** an exposure this step
> introduced. The publication itself stays — consult Q2 requires a differing post-save observation
> to be queued as external and Q5 requires a conflict's disk side to be published so a later hint at
> it coalesces — and what §12 adds is the other half: **both admitting arms ask the watcher for a
> stabilized reading in the same breath**, so what the engine's two reads settle on is admitted at a
> **later** sequence and supersedes the phantom, or coalesces into a publication that was right all
> along. *One rule, two callers* is untouched; the two doors are untouched; what changed is that
> neither door is any longer the last word on a path. §5 item 3 is replaced with what remains.

> **Correction (round-7 fix round, §13).** The block above kept the publication and was wrong to,
> and this section's **heading** goes with it. *The two save-path refreshes are observations, and
> they go through the same decision a native hint does* is now true of the **checks** and false of
> the **outcome**: since §13 they go through doors of their own, neither of which can spend a
> sequence, and they no longer end the same way as each other. The heading is left standing as
> written with this block beneath it rather than rewritten, because the sentence it makes is the
> one this section exists to argue — *external rather than self* is one rule and not two that agree
> today — and that half is untouched: one `decide`, one suppression predicate, one supersession
> step, one coalescing comparison.
>
> What changed is step 5. `conflict_after_the_lock`'s refresh **marks** its state
> (`mark_under_the_session_lock`), because consult Q5 requires a native duplicate at the same
> document and revision to be coalesced and the person has been shown that state in the payload;
> `after_a_save`'s disagreeing refresh **withholds** its state entirely
> (`withhold_under_the_session_lock`), because nobody has been shown it and a coalescing marker
> would make the engine's own stabilized reading of the same state a `Duplicate` — consult Q2's
> *the differing post-save observation is queued as external* met by nothing at all. **That
> asymmetry is the half round 6's remedy did not name**, and §13.1 is why it is a third door rather
> than a second use of the second: the review's own words scope Q5's coalescing to a conflict
> *registered by `conflict_after_the_lock`*, and there is no conflict on the other path.
>
> The paragraph two above — *where this is weaker than the watcher's own admissions* — states the
> weakness correctly for the third round running, and the conclusion drawn from it is now that
> neither single read may be numbered at all.

> **Correction (round-8 fix round, §14).** Two sentences in this section are now false, and the
> second of them was round 8's High.
>
> The **first** is this section's own *"one rule, two callers"* paragraph, which ends: *"the
> conflict's admission answers `SelfWrite` and publishes nothing. That is correct and is the
> predicate's own limit: byte identity, never authorship."* The premise is unchanged — a raw save
> against a stale base really can conflict against bytes this session committed earlier — and the
> verdict was wrong. Suppression exists, in consult Q2's own words, to *absorb the several native
> notifications one atomic replacement may generate*, and this reading is not one of them: it is a
> read `conflict_after_the_lock` performed itself, under the session lock, after the record, through
> a door that since §13 cannot publish. Answering `SelfWrite` to it withheld consult Q5's coalescing
> entry — the thing that stops a native duplicate at the same document and revision raising a second
> conflict — for no gain, because a door that cannot publish cannot make the mistake suppression
> prevents. The state is now **marked**, and the app write's own pending hints coalesce against that
> marker instead of being suppressed by the record: the same silence through a different counter.
> `commands.rs`'s `a_conflict_against_this_apps_own_committed_bytes_is_suppressed` asserted the old
> verdict and is renamed `…_is_marked_rather_than_suppressed`, with its four assertions replaced.
>
> The **second** is the round-4 block's closing sentence above: *"both still reach the same `decide`,
> with the same suppression, the same supersession, the same coalescing and the same sequence
> allocator."* Since §13 the sequence allocator is not shared, and since §14 the suppression is not
> either. What **is** shared is one `decide`, one supersession step and one coalescing comparison —
> which is still the whole of what this section argues, because *external rather than self* being one
> rule and not two that agree today is a claim about where the rule lives, not about how many of its
> steps every caller is asked. The harm the wording did is the reason it is corrected rather than
> left: a shared step that means three different things is exactly what round 8 found.
>
> **Why the record removal is right even where the record names the bytes just read**, which is the
> half no earlier round had to argue: on both serialized doors the entry met is an **earlier** save's
> and never the running transaction's — `conflict_after_the_lock` runs where the transaction was
> refused and recorded nothing, and `after_a_save` reaches its door only where the refresh disagrees
> with the revision its transaction last saw. What clearing gives up is stated in §14.1 rather than
> smoothed over.

### 2.7 D7 — the backup session and the ledger travel together, because neither is a planner's to choose

`with_open` now lends a `SaveRecords { backups, ledger }` rather than a bare `&BackupSession`.
The immediate cause was arithmetic — `create_one_match` reached eight parameters and clippy's
`too_many_arguments` refused it — but the grouping is the right shape independently: both are
**session-owned records a save writes to**, neither is a planner's to choose, all six planners
pass both straight through unchanged, and a planner that could reach one without the other could
write with no safety net or commit bytes this session can never afterwards tell from an external
write. `WorkspaceSession::with_open` is its only producer.

> **Correction (round-5 fix round, §11).** The first sentence above is out of date and the name in
> it was **wrong for its contents**, which is why the correction is a rename rather than a note.
> `with_open` lends a **`SessionSideOfASave { backups, ledger, watcher }`**: the third field is the
> open watcher's `ReObserver`, and it is not a record a save writes to — it is a handle a save
> *asks* through on the three arms where it has no reading of its own (§11.1). Everything else this
> section argues is unchanged and now covers three values rather than two: none of them is a
> planner's to choose, all six planners pass them straight through, and a planner that could reach
> one without the others could write with no safety net, commit bytes this session can never
> afterwards tell from an external write, **or drop a reading nothing else will take**. The two
> tails take a narrower `ObservationSide { ledger, watcher }` rather than the whole value, because a
> `BackupSession` in the reach of a function that runs *after* the transaction would be a pre-save
> copy taken after the save.

> **Correction (round-6 fix round, §12.2).** *"on the three arms where it has no reading of its
> own"* is a count and a condition, and round 6 changed both. It is **five** arms, and two of them
> do have a reading: `after_a_save`'s disagreeing refresh and `conflict_after_the_lock`'s successful
> one publish a **single** read, which is not the engine's two, so each asks for a stabilized
> reading beside admitting. The condition is therefore *no reading of its own, or one it cannot
> prove stable*. Everything else this section argues is unchanged, and the field's own documentation
> at `SessionSideOfASave::watcher` carries the same correction rather than only this block.

### 2.8 D8 — coalescing is state equality, which reproduces the engine's own two exceptions rather than fighting them

The announced-state map holds one `ObservedState` per path, and an observation coalesces exactly
when the state it would announce equals the one already announced. Three states rather than an
`Option<ContentRevision>` is what makes that work:

- a repeat of the same document at the same revision is a `Duplicate` — consult Q3's *repeated
  hints that stabilize to the same document/revision coalesce*;
- a `Removed` publishes `Absent`, so **`Removed` then `Added` at the same path is two
  observations even at identical bytes** — Q3's ruling verbatim, and here it falls out of state
  equality rather than being a special case;
- a `Changed` recovering from an emitted `Unreadable` at unchanged bytes is likewise admitted,
  because the announced state was `Unreadable`, which is the engine's own D5 exception
  (`2d-1-notes.md` §2.5) reproduced without a second copy of the rule.

Sequences are allocated per epoch from `FIRST_OBSERVATION_SEQUENCE` (one, so a zero downstream can
only mean *unset*) and the allocation is **checked, never saturating** — the same defect
`WorkspaceEpochs` was repaired for at 2d-2. An exhausted space refuses every further admission
within its epoch, because an observation that cannot be given a distinct sequence must not be
published, and the next workspace open resets it with everything else.

`LedgerTally` counts seven of the eight decisions, cumulatively and without reset, because six of
them — suppressed, coalesced, discarded for a stale epoch, (since §8) discarded as older than
a commit, and (since §13) marked and withheld — are otherwise **indistinguishable from silence**,
which is the mistake a negative-only integration test would make.
`Admission::SequenceSpaceExhausted` is
deliberately uncounted: it is unreachable in any physical execution and is directly observable
through `admit`'s own answer, which the boundary test drives.

> **Correction (round-2 fix round, §8).** This paragraph said *four of the five* and *three of
> them*, which was true of the five decisions that existed when it was written. §8 adds a sixth,
> `Admission::PrecedesACommit`, and gives it `LedgerTally::preceded_a_commit` by asking the two
> questions this paragraph states rather than by assuming the struct was exhaustive. The counter
> is not decoration: it is what makes `watch_check`'s positive wait on `suppressed` bite against a
> production stamp taken too early (§8.3).

> **Correction (round-7 fix round, §13).** Two things above changed and the numbers are the
> smaller half. §13 splits the **coalescing marker** from the **sequence-spending publication**, so
> an entry in the announced-state map is now written either by a publication or by
> `conflict_after_the_lock`'s marker, and the sentence *the state it would publish equals the one
> already published* became *would announce … already announced*, amended in place. That is not a
> widening of what coalescing means: both entries answer *does a consumer already have this state*,
> which is the question this section is about, and the three exceptions above are unchanged because
> they are about state equality and not about who wrote the entry. The counts are re-derived by
> counting `Admission`'s variants (eight) and `LedgerTally`'s fields (seven), not by adding two to
> the numbers this paragraph gave — the discipline round 6's first Low imposed. The one deliberately
> uncounted decision is still `SequenceSpaceExhausted`, and it is now reachable from **one** door
> rather than from two, because the two serialized doors spend no sequence to exhaust.

### 2.9 D9 — backup writes are still excluded by construction, and the test drives the construction rather than the arithmetic

Consult Q2: the backup root `<config root>/.espansoconfig-backups` is a **sibling** of both
watched roots, and the watch scope is exactly `config/` and `match/` — so batch creation, entry
copies, marker writes and rotation never enter the watch stream, with no filter to get wrong. The
scope was not widened, and nothing in this step touches it.

`neither_a_backup_producing_save_nor_the_backup_root_is_ever_observed` drives that on a real
filesystem, and it drives the **scope** rather than one shape of backup write: after a real
backup-producing save (premise checked — the save reports `backup_taken` and the root really holds
files), the shapes a batch and its rotation perform are written and removed under that root by
hand, including a `.yml` entry copy named exactly like a watched file, so it would pass the
engine's own extension filter if the scope were wrong. The fence that makes the negative mean
something is in the same window and on the same cadence: one real external write **under a
watched root** is admitted and is that epoch's only numbered observation.

---

## 3. The evidence, item by item

Consult Q7 item 3 and this step's brief list what is owed. `ledger.rs`'s **fourteen** module tests
are deterministic and touch no filesystem — two of them run two threads, and are deterministic
anyway, because their synchronization is a barrier plus a **positive** wait on an event the fix
itself must produce (§7.1, §8.3) rather than a sleep, and because the instants they compare are
values the test itself takes, in an order the test itself writes; `commands.rs`'s seven run against `unwatched()`
sessions (the ledger is real there — nothing about the record depends on a watcher, and the
FSEvents cost of 2d-2 §2.9 is not owed); `watch_check.rs`'s two are real sessions over real temp
trees.

| Owed | Where |
|---|---|
| all six writing commands record only committed revisions | `commands.rs`'s `every_writing_command_records_only_the_revision_it_committed` — every writer driven on its own tree through its own path to the shared tail (the duplicate through its two-call acknowledgement), each asserting the entry exists, carries **exactly** the revision the command answered with, and is tagged with the session's epoch |
| `committed: false` records none | `a_save_that_commits_nothing_records_no_app_write` — and its refresh agrees, so nothing is published either |
| a refusal records none | `a_refused_save_records_no_app_write` — a raw save the parser rejects; the file is untouched and the whole tally is zero, because the refusal arm returns before either refresh |
| a conflict records none, and its refresh is external | `a_conflict_records_no_app_write_and_marks_its_refresh_for_coalescing` — no entry, the disk state announced for this path, **no sequence spent on it since §13**, and a second hint at that same state answering `Duplicate` |
| …and the case where a conflict's refresh finds this application's **own** committed bytes | `a_conflict_against_this_apps_own_committed_bytes_is_marked_rather_than_suppressed` — reachable only through the raw save (§2.6); **since §14 it is marked, not suppressed**: the record goes, consult Q5's coalescing entry is installed, no sequence is spent, and a native hint at those bytes then answers `Duplicate` rather than `SelfWrite` — the same silence through a different counter |
| **a stale record never suppresses a serialized reading of its own bytes** | `ledger.rs`'s `a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes` — §14, and the case the row above cannot reach: the record is `A`, the workspace has moved on without telling the ledger, and a save tail reads `A` back. Both serialized doors answer `Marked`/`Withheld` and clear the record; after the withholding one the owed **stamped** reading of `A` is `Admitted`, which is consult Q2's *queued as external* met at last. Its third leg is the discrimination — the same record and the same bytes through the **stamped** door are still `SelfWrite`, with the record retained |
| an uncertain write records none | `only_a_committed_outcome_licenses_an_app_write_record` — over a commit, a skipped commit, a `RevisionMismatch` and a `WriteError::VerificationFailed`, the last asserting **its own premise** (`may_have_written()` is true) so it cannot pass holding an error of the wrong kind |
| post-commit external replacement is not suppressed | `a_post_commit_external_replacement_supersedes_the_record_and_is_never_ours` — the tail driven directly, since no command can produce the interleaving: the answer stays `committed` and still names what this application wrote, the external revision is never recorded as ours, and the differing state supersedes the record rather than being suppressed by it (`suppressed: 0`) — **and since §13 announces nothing at all, the ask being what queues it** — **and, since §7.2, `ledger.rs`'s `a_committed_record_invalidates_the_announced_state_and_supersedes_itself`, which is the case the row above did not cover** |
| a stabilized observation equal to the entry is suppressed, and the entry survives duplicate hints | `ledger.rs`'s `the_recorded_revision_is_suppressed_and_survives_duplicate_hints` — three hints, three suppressions, the entry unchanged and nothing published |
| a different revision is admitted and clears/replaces the entry | `a_different_revision_is_admitted_and_supersedes_the_record`, plus `record_app_write`'s replace-in-place |
| an absence or an unreadable state is never a self-write | `an_absence_or_an_unreadable_state_is_never_a_self_write` |
| workspace replacement discards the map | `workspace_replacement_discards_the_whole_map` — records, published states and sequences all gone, and the previous workspace's committed bytes now an ordinary observation |
| a stale epoch is discarded | `an_observation_carrying_a_stale_epoch_is_discarded`, and end-to-end through the gate in `the_gate_forwards_only_admitted_observations_and_numbers_them` |
| sequences increase monotonically within one epoch | `sequences_increase_monotonically_within_one_epoch` (six states across two paths → 1…6) and the exhaustion boundary `an_exhausted_sequence_space_admits_nothing_further_in_its_epoch` |
| coalescing, and `Removed` then `Added` as two observations | `a_repeat_coalesces_while_removal_and_recreation_are_two_observations` |
| the gate forwards only admitted observations, numbered | `the_gate_forwards_only_admitted_observations_and_numbers_them` — one each of four of the six decisions through one gate (admitted, suppressed, coalesced, stale epoch), one value out, and the tally asserted whole, `preceded_a_commit: 0` included |
| the gate is a leaf | `the_downstream_sink_runs_outside_the_ledger_lock` — bounded, off-thread, fails as a timeout rather than hanging |
| **the gate is on the production path** | `watch_check.rs`'s `a_committed_save_is_suppressed_while_a_later_external_write_is_not` — a real session, a real transaction, a bounded positive wait on the suppression tally, then the negative, then the discrimination: an external write of different bytes is admitted as sequence 1 and supersedes the record |
| a real backup-producing save observes no backup path | `watch_check.rs`'s `neither_a_backup_producing_save_nor_the_backup_root_is_ever_observed` (§2.9) |
| **a commit and its record are one window** | `ledger.rs`'s `no_admission_can_decide_between_a_commit_and_its_record` — §7.1, added by the round-1 fix round, its arm amended by §8.1 |
| **a reading taken before a commit never supersedes its record, and that commit's own hints stay suppressible** | `ledger.rs`'s `a_reading_taken_before_a_commit_never_supersedes_its_record` — §8, the sequence `stabilize P → commit/record A → decide P → observe A`, barrier-driven, plus the discrimination that a reading taken *after* the commit still reports and still supersedes |
| **…and the same for a reading of an absence or an unreadable state** | `ledger.rs`'s `a_reading_of_an_absence_taken_before_a_commit_is_refused_too` — §8, the state-agnostic half: the chronology check is deliberately not narrowed the way the suppression predicate is |
| **the production stamp is not taken too early** | `watch_check.rs`'s `a_committed_save_is_suppressed_while_a_later_external_write_is_not`, strengthened by §8 with `preceded_a_commit == 0` beside the positive wait on `suppressed` |

> **Correction (round-1 fix round, §7.2).** The *post-commit external replacement* row above
> claimed a proof it did not have. `a_post_commit_external_replacement_supersedes_the_record_and_is_never_ours`
> drives the case where **nothing had been published for that path**, and that is the only case
> it drives. Where an external revision B had already been admitted and the application then
> committed A, `published[path]` still said B, so an external replacement back to B coalesced
> into a `Duplicate` — reported nothing, and left a record of A standing that then suppressed a
> later genuine external change to A. §7.2 closes it and adds the sequence the reviewer named.
> This block is the correction; the row is amended in place rather than rewritten, per this
> project's convention.

> **Correction (round-2 fix round, §8).** The *a commit and its record are one window* row named a
> second test, `an_external_admission_that_meets_a_commit_window_supersedes_its_record`, whose
> assertion was **round 2's defect written down as a requirement**: it demanded that an external
> reading parked at the gate across a commit window clear the record that window had just taken.
> Clearing it is precisely what makes the save's own hints foreign. That test's scenario is now
> `a_reading_taken_before_a_commit_never_supersedes_its_record`, with the opposite verdict and
> with the two follow-on steps the old one had no reason to take; the row is amended above and
> the surviving half of round 1's mirror interleaving — a reading taken *after* the commit does
> supersede — is `a_different_revision_is_admitted_and_supersedes_the_record` and step 5 of the
> new test. A renamed test is a name position, and the sweep §8.5 records is what caught the
> other four places the old name and the old claim appeared.

**Two neuter runs were taken, and each is named for exactly what it drove** — a test that cannot
fail against a broken build is decoration (§7.5 adds four more, and §8.6 two more again):

- with `decide`'s suppression branch disabled,
  `a_committed_save_is_suppressed_while_a_later_external_write_is_not` failed as a clean bounded
  timeout at the tally wait (124.4 s), which is the production-path claim of §2.3 rejecting a
  build with no gate behind it;
- with `record_app_write` removed from `run_one_save` (the call the fix round moved into
  `commit_and_record` — §7.1),
  `every_writing_command_records_only_the_revision_it_committed` and
  `a_conflict_against_this_apps_own_committed_bytes_is_marked_rather_than_suppressed` (named
  `…_is_suppressed` when that run was taken) both failed while the other 70
  command tests passed.

**The backup check was not neuter-run**, and the honest reason is that its claim is negative and
structural: there is no branch to disable, because nothing filters backup paths — the scope
excludes them by construction (§2.9). What that test can fail against is a *widened* scope, which
is a change nobody made here.

### The truthful sentence, from consult Q2, verbatim

> **This application ignores a filesystem hint when the bytes now on disk hash to the latest
> revision it recorded after committing that file; this proves the text is identical, not who
> wrote it.**

An external process rewriting byte-identical bytes is indistinguishable by this predicate, and
ignoring it is acceptable because the file text — the source of truth — did not change. **Nothing
built on this may claim that the ignored event "was ours", that no external write occurred, or
that metadata stayed unchanged.** Hash equality proves byte identity subject to the hash's
collision limit. The sentence stands at the head of `ledger.rs`'s module documentation, and the
core's `self_write_suppresses` carries it too — the predicate has one definition and this step did
not restate it differently.

**What none of this proves.** Nothing here proves an observation is *consumed*: the production
downstream sink discards by design, and no queue, event or command exists to drain (2d-4's). The
`watch_check` pair rides the **polling** fallback deliberately — their trees hold only `match/`,
following the three teardown tests' technique — so they say nothing about FSEvents delivery, which
the eight-cell matrix already carries. Rotation itself is not driven: what is driven is the scope
claim that covers it (§2.9). And the record's per-entry epoch check is unreachable while
`begin_epoch` discards (§2.2), so that check is reviewed, not driven.

---

## 4. What is deliberately not built

Consult Q3 and Q7 items 4–8 own all of it, and none of it exists here:

- **no queue**, no `workspace://reconciliation-ready`, no `ReconciliationWake`, no
  `drain_external_changes`, no `#[tauri::command]` of any kind — the command count is unchanged;
- **no TypeScript, no Svelte, no i18n key, no dictionary-contract entry** — nothing this step
  added crosses IPC, so nothing owes one, and no user-facing string was added because nothing
  here is visible;
- **no writer, no force flag, no route around `save_document`** — the six writers are the same
  six, each still ending in `run_one_save`, thence in `commit_and_record` (§7.1) and thence in the
  one entry point that may write a user's file — a guard around the existing call, never a second
  call;
- **no open-write-surface registry, no automatic reload, no watcher-origin conflict** — Q4, Q5
  and Q6, all frontend, all 2d-5 and 2d-6;
- **no widening of the watch scope**, and **no Tauri, save or ledger dependency in the core
  crate** — which is not the same as *no change to the core crate*, and this bullet said the
  second until the round-6 fix round (round 6's second Low). Two rounds of this step have added a
  primitive to `crates/espansoconfig-core/src/watch/engine.rs`, and both are things the engine can
  say about a **directory** with no application session in them:
  `ObservationEngine::revert_settlement` plus `Observation::path()` (round 3, §9.1) and
  `ObservationEngine::observe_owed` (round 6, §12.1). The scope claim the bullet is for still
  holds — `cargo tree -p espansoconfig-core | rg tauri` finds nothing and the engine learns
  nothing about saves or ledgers — and stating it as *no change at all* invited the opposite
  failure: a maintainer reading it as a binding invariant would remove the rollback that ledger
  refusal recovery depends on, or the debt that a re-observation depends on, and the observation
  each was built to save would go back to being lost.

---

## 5. Holes, stated rather than hoped about

> **Note (round-14 fix round, §20.7): items 1–24 are here, and items 25 onward are in the fix rounds
> that found them.** This section holds the residues written up to the round-8 fix round, which is the
> last round that added to it (§14's block above says *"§5 gains items 23 and 24"*). From the round-9
> fix round on, each round records its own residues in its *what this round's own change leaves open*
> subsection — items 25–29 in **§15.8**,
> 30–32 in **§16.6**, 33–34 in **§17.7**, 35–37 in **§18.7**, 38–40 in **§19.7** and **41–44 in
> §20.7** — because a
> residue belongs beside the round that found it and renumbering a list eight rounds of cross-references
> point into is a defect waiting to happen. **The numbering is one sequence across all of them**, so
> *item 21* means the same thing wherever it is cited, and a search for an item number finds exactly
> one definition. This note is navigational and corrects nothing.

1. **Admitted observations are still discarded in production.** The gate decides, numbers, and
   hands the value to `discarding_sink`; a value it drops is gone, and no present code recovers
   it. Whatever recovery 2d-4's bootstrap or drain offers is 2d-4's to build and to claim.
2. **A publication has no consumer, so a spent sequence is invisible.** `conflict_after_the_lock`
   and `after_a_save` discard the `Admission` they get, deliberately: what a *watcher's*
   publication does today is spend one sequence and announce one state, so the next hint at it
   coalesces. **Since §13 neither tail publishes at all**, so what those two call sites discard is
   an `Admission::Marked` or an `Admission::Withheld`; when 2d-4's queue exists, the save-origin
   value it must carry is the **conflict**, and consult Q5's ruling — a save-origin conflict wins
   over a native duplicate at the same document and revision — is the rule that lands there, with
   the marker already in place to make the duplicate coalesce. What 2d-4 must **not** do is enqueue
   either tail's own single read as an observation: that is round 7's High, and it is now
   unavailable rather than merely discouraged, because no save-path door can mint a sequence.
3. **~~A published phantom is harmless because a stabilized reading supersedes it at a later
   sequence~~ — the premise stands for the third round running, the second ruling was false too,
   and §13 closes it by taking the publication away.** This item has now been wrong **twice**, and
   it is the only item of this section that has. The premise was always right and is still right:
   a `Workspace::refresh` is one read where the engine takes two, so a foreign non-atomic write in
   progress can hand a save tail a **parseable intermediate** state that never stably existed. The
   first ruling — *"it is the same read that builds the conflict payload, so the exposure is not
   new"* — was round 6's second High, and §12 replaced it. **The replacement §12 wrote was round
   7's High**: it said the phantom's publication was harmless because *consult Q3's rule — a
   consumer acts only on the highest sequence it has accepted for a document* — made the earlier
   value inert.

   **Why that was false, said plainly.** Q3's guarantee is that a consumer acts only on the
   **highest sequence it has accepted**. That forbids *regressing* to an older sequence; it obliges
   nobody to **wait** for a sequence that does not exist yet. A phantom published at *n* is the
   highest sequence in existence until the stabilized reading is admitted at *n+1*, so a 2d-4 drain
   landing in between accepts it legitimately, an open write surface installs it as its conflict,
   the person confirms *Reload*, and their draft is gone. Nothing at *n+1* gives a discarded draft
   back. The sentence was a rule about ordering read as a rule about timing.

   **What §13 changed**: the coalescing marker and the sequence-spending publication are now two
   things. `WriteLedger::admit` — the stamped door, whose readings are the engine's two equal
   consecutive reads — is the only door that can spend a sequence, so **no single unstabilized read
   enters the observation sequence at all**. `conflict_after_the_lock` **marks** the state it read
   (`mark_under_the_session_lock`), which is exactly what consult Q5's *the duplicate is coalesced*
   needs and no more; `after_a_save` **withholds** its state entirely
   (`withhold_under_the_session_lock`), because nobody was shown it and a marker there would make
   the engine's own stabilized reading of the same state a `Duplicate`. Both still ask for an owed
   observation, and that reading is what is published.

   **What remains, stated as what it is.** Three things, and none is the phantom.

   - **The conflict payload can still describe a state that never stably existed.** It is built
     from one read and consult Q5 forbids a second `document_text`, so this is a property of the
     payload rather than of the ledger — and it is bounded the way §12 correctly said a payload is:
     shown once, replaced by the person's next action, and superseded on screen by the stabilized
     observation when 2d-5 exists to install it.
   - **With no watcher to ask (item 19), a marker is the end of it and a withholding announces
     nothing.** Who loses what, precisely: for `conflict_after_the_lock`, the person saving still
     sees the disk side in their payload, and what no consumer learns is that the file changed — so
     a *second* surface on that document is told nothing. For `after_a_save`'s disagreeing read,
     nobody is told at all, where before §13 a single read was published; that read was the one
     external change a watcher-less session could still announce, and it announced a state no
     second read had confirmed. Both are a workspace with no watcher observing nothing, which is
     what such a workspace already does everywhere else.
   - **A marker can still overwrite a newer publication.** The ordering between the worker's own
     admissions and a save tail's is decided by the commit gate rather than by real time, so a
     stabilized state admitted just *before* the tail marks leaves the marker last in the
     coalescing map. The cost is now **over-reporting** rather than a phantom: a later observation
     of that stabilized state is announced again at a new sequence instead of coalescing. That is
     the direction this record has always taken over silence, and it is unchanged from before §13
     except that it no longer spends a sequence on the way in — `ledger.rs`'s
     `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` drives exactly that
     ordering.

   The same single read also installs a fresh parse in the workspace cache, which is unconditional
   cache coherence and is corrected by the next read of that document rather than by anything here.
4. **An admitted observation still names a path, not a `DocumentId`.** The gate is deliberately
   leaf-only (§2.1), so it does not resolve one; a consumer that needs the identity will have to
   take the session lock or reach the core's identity table, and that decision is 2d-4's.
5. **The per-entry workspace epoch is redundant while `begin_epoch` discards** (§2.2). It is
   stored and checked as the second statement of one rule, and no test can currently make the
   check fail, because no path leaves an entry from another epoch behind.
6. **The path agreement is inherited, not closed** (§2.2). The ledger keys on the workspace's own
   spelling and the gate looks up the watcher's; `HintSpelling` reconciles root-prefix aliases only
   (2d-2 §5 item 6), and a case-only difference or a post-start symlinked ancestor still misses —
   in the engine first, so such a hint never reaches the ledger at all. **Since §12 the same miss
   applies to a *request*, and that is worth saying separately**: `ObservationEngine::observe_owed`
   drops a path it does not watch and records no debt, exactly as `hint` drops it — deliberately,
   because a debt no settlement could ever reach would sit there for the life of the engine — so a
   save asking about a path this engine's roots do not match is answered by silence rather than by a
   refusal. The save path's spelling is the workspace root's and the engine's root is that same
   value, which is why this is the inherited residue rather than a new one.
7. **Rotation is covered by construction, not by execution** (§2.9). Forcing a real rotation needs
   eleven batches, hence eleven sessions with sortable-by-second batch names; what the test drives
   instead is the scope claim rotation depends on, with a `.yml` file under the backup root as the
   sharpest case.
8. **The `watch_check` pair says nothing about native delivery.** Both ride the polling fallback so
   that no FSEvents delivery decides a verdict; the eight-cell matrix is where native delivery is
   claimed, and 2d-2's measured scar still binds — these suites are evidence on a quiet host.
   **§12's spawned-worker test says nothing about it either, and by a stronger construction**: it
   starts its watcher over a root that does not exist, so the backend can watch **neither** root,
   no stream is ever created, and nothing in it can be carried by a native event even in principle.
   It is a real worker thread, a real engine and a real filesystem, run in the ordinary
   `cargo test --workspace` suite rather than in `watch_check`, precisely because it adds no
   FSEvents session to that suite's budget.
9. **Nothing prevents a future `WriteLedger` method from calling caller code under the guard**
   (§2.1). The leaf property is kept by `decide`'s signature and one bounded test, not by a type.
10. **~~An observation stabilized *before* a save and decided *after* its record supersedes that
    record~~ — CLOSED by §8, and this item was wrong on both of its claims.** It said the residue
    was unavoidable without inferring a filesystem chronology from hashes, and that its cost was
    over-reporting. Both are false. It is avoidable without touching hashes at all — the
    chronology needed is not the file's but **this session's own**, and an instant taken before a
    read and an instant taken after a rename are enough to order those two events. And the cost
    was never over-reporting: clearing the record makes the save's **own** hints of A foreign, so
    what the window would show is this application reporting its own committed write as somebody
    else's change (consult Q8's sharpest failure mode, and at 2d-5 a watcher-origin conflict
    raised against the user's own save). Round 2 rejected this item, and §8 is the closure. The
    residues that remain in its place are items 13 and 14 below, both narrower and both stated as
    what they are.
11. **An admission waits behind an in-flight save for that save's whole transaction** (§7.1).
    The gate is held across `save_document`, because the rename is inside it. The wait is bounded
    by one save's own I/O — `crate::persist`'s per-path lock excludes only this process's
    cooperating callers, so no foreign holder can extend it — and a delayed observation is a
    delayed observation, never a lost one. What is *not* measured is how long that is on a large
    file on a slow volume.
12. **The commit gate is not reentrant and nothing but review keeps a caller out of it twice**
    (§7.1). `admit_under_the_session_lock` takes it (`admit_at_current_epoch` until §10 renamed
    it), `after_a_save` and `conflict_after_the_lock` call
    that, and both run after `commit_and_record`'s guard has been dropped — a property of one
    function's block scope, not of any type. The one spelling of the mistake a tool catches is
    `let _ = ledger.enter_gate()`, which rustc's deny-by-default `let_underscore_lock` rejects
    (measured, §7.5); a guard bound and then dropped early is not caught by anything.
13. **The stamp is a lower bound, so the chronology check over-refuses across the width of one
    engine pass** (§8.2). `read_after` is taken immediately before `ObservationEngine::tick` and
    the settling read happens inside it, so a commit landing in between refuses a reading that may
    in fact have followed it. The window is microseconds. **The rest of this item, as §8 wrote it,
    was false, and round 3 is why** — the paragraph is replaced rather than annotated, because
    every clause of it was load-bearing and wrong:

    > ~~The direction is the safe one; what makes it recoverable rather than lossy is that the very
    > commit that caused the refusal is itself a filesystem write, whose own native hints re-hint
    > that path and produce a fresh observation with a later stamp, and that recovery inherits
    > 2d-2's native-delivery residue exactly.~~

    A re-hint does **not** produce a fresh observation of a refused state: `tick` had already
    installed that state as the engine's tracked one, so the same bytes re-read stabilize to the
    tracked state and coalesce **inside the engine**, emitting nothing. The refusal was therefore
    lossy, not over-refusing, and it was not native-delivery residue — perfect delivery loses the
    state just the same. What makes it recoverable now is that the refusal is **answered**:
    `admitting_sink` returns `ObservationOutcome::Undecided` and `crate::watch::deliver` calls
    `ObservationEngine::revert_settlement`, which restores the tracked state the settlement replaced
    and re-hints the path. The recovery therefore depends on **one engine pass of this same
    watcher**, not on native delivery — the revert schedules its own hint (§9.1).

    What it *does* still depend on, stated as the residue this item now carries: that the worker
    reverts before it ticks again (one loop, one call site, no type), and that the refusing
    condition eventually stops holding — each re-observation costs one debounce plus one probe, so
    a save committing to the same path faster than 240 ms without pause would keep refusing. Both
    are bounded by real user action rather than by anything this code guarantees. **Since §12 the
    revert also restores an owed *debt***, so a refused observation that was answering one is still
    owed and the retry can answer it; without that the retry would coalesce against the tracked
    state and the debt would be spent on silence, which is this item's own shape one layer down.
14. **Nothing in the type system ties a stamp to the reads it claims to bound** (§8.2). Every
    `Instant` type-checks in that parameter, and a producer that took its stamp *after* its reads
    would compile, forward, compare, and silently restore round 2's High. What holds it is that
    there is exactly **one** producer of a stamp — `WatchWorker::observe`, one two-line function
    with one caller. **Neither save-path caller stamps, and this clause used to say they did**: it
    read *"and the two save-path callers stamping on the line above their `Workspace::refresh`"*,
    which stopped being true at §10 and stood through round 4's own name sweep — round 5's first
    Low, and its concrete cost is that a maintainer following it would restore stamped save-path
    admission and with it round 4's High. A stamp taken too **early** is caught
    by `watch_check`'s `preceded_a_commit == 0` (§8.3); a stamp taken too **late** is invisible to
    every test in this crate, and that asymmetry is the honest statement of what the evidence
    covers. **Round 3 adds a second half to this item**: nothing in the type system ties the
    *answer* a sink returns to what the producer then does with it either. `ObservationSink` now
    returns `ObservationOutcome`, and a caller that drops it compiles and silently restores round
    3's first High. `crate::watch::deliver` is the one call site, and it is one function with one
    caller for exactly this reason. **Round 4 adds a third half**: nothing in the type system ties
    `WriteLedger::admit_under_the_session_lock` to a caller that really holds the session lock.
    This module owns no such lock and can require no witness of one, so a future caller reaching
    that door from the watcher's worker thread would compile, skip the chronology check it could
    not justify skipping, and silently restore round 2's High. Two callers and one paragraph in
    that method's own documentation are what keep it — the same shape as the two above, and the
    same asymmetry: the mistake is invisible to every test in this crate. **Round 6 adds a fourth
    half**: nothing ties an owed observation to the caller that asked for one. The debt
    `ObservationEngine::observe_owed` records is per **path** and carries no identity, so two
    requests before one settlement are one debt, one settlement discharges both, and a caller
    cannot tell whether the observation it eventually sees is the answer to *its* request or to
    somebody else's. That is harmless as long as the only thing a caller does with the answer is
    put it through the ledger — which is all any caller does — and it would stop being harmless the
    moment a caller waited for *its own* answer. What the engine does force, in the same sentence, is
    that a debt is spent only by a settlement that emitted: `settle` puts a debt back when its
    settlement answers nothing.
15. **The revision a save records is the file's post-rename read-back, not necessarily the bytes
    it wrote** — inherited from the core, not introduced here. `SavedDocument::revision` is
    documented in `crates/espansoconfig-core/src/persist/save.rs` as what the file held when the
    primitive last read it, and a foreign process can replace the file between the rename and that
    read; the field's own doc says re-reading narrows the window and nothing at that layer closes
    it (2a-1 notes D4). The ledger records whatever that read answered, so in that
    interleaving this session suppresses a foreign write and reports nothing — the predicate's own
    limit, byte identity and never authorship, reached one layer down. Nothing at this layer
    narrows it, and the chronology stamp does not address it: it orders *events*, and this is a
    question of *whose bytes*. **Re-checked in round 3 and it stands unchanged**: the strict
    comparison and the settlement revert both order events too, so neither touches it.
16. **~~A save-path refresh can now be refused by a clock collision, and it has no settlement to
    take back~~ — CLOSED by §10, and this item was wrong on both of its claims about the cost.**
    The premise was right and the accounting was not, exactly as item 10's was before §8 replaced
    it. It said the refusal was *the over-refusing direction* and that what was lost was **one
    publication**, the external replacement being *"reported by the watcher's own hints instead"*.
    Neither holds. What is lost is the **external observation itself**: no engine settlement exists
    to take back on that path, no loop retries it, and the native hint the sentence relies on is
    exactly what `docs/decisions/2d-2-notes.md` §2.3 declines to guarantee — *a backend that stops
    delivering without reporting anything looks like a healthy quiet stream, and no API
    distinguishes them*. The consult requires a disagreeing post-save refresh to be **queued as
    external** (`phase-2d-design.md` Q2), so a refresh nobody hears is a violation of the spec and
    of §1's own headline, not an acceptable over-refusal. §10 is the closure: neither save-path
    caller stamps any more, because the session lock they already hold orders their reads against
    every record in program order, so there is no clock left to collide. The residue that replaces
    this item is **§5 item 14's third half** — nothing in the type system says a caller of
    `admit_under_the_session_lock` holds that lock.
17. **`revert_settlement` restores unconditionally and re-hints only a watched path.** Every path
    the engine can settle entered through a `watches` check, so the two halves cannot come apart
    today. If they ever did, the rollback would still happen and the re-read would wait for the next
    hint or rescan rather than being scheduled — degraded, not lost, and stated rather than assumed.
    **Since §12 the same is true of the debt it restores**: a restored debt goes back through
    `observe_owed`, which drops an unwatched path, so the same unreachable case would drop the debt
    with the hint rather than leave one nothing could answer.
18. **~~A post-save refresh that *fails* tells the ledger nothing at all~~ — CLOSED by §11, and this
    item was wrong about the choice it presented.** Its premise was right — `after_a_save` evicted
    and answered `moved: None`, `conflict_after_the_lock` returned the read's error, and neither
    admitted anything, so a removal immediately after a commit was heard only through a native hint
    `2d-2-notes.md` §2.3 declines to guarantee. Its **conclusion** was wrong: it said closing the
    hole *"would be worse"*, and offered exactly one alternative — publishing an `Absent` or
    `Unreadable` from the single read that failed, which would indeed have published a state that
    never stably existed and cleared the app-write record. There is a third option and the item did
    not look for it: **ask the engine**. The path goes back to the running watcher
    (`crate::watch::ReObserver::re_observe`), its ordinary two reads produce the state, and the
    stamped door admits it — nothing is published from the failed read and no record is cleared by
    it. That is §11, and the item's own last sentence names the mechanism it then failed to use:
    *the engine's two-read stability is what that state needs, and the engine is where it is
    produced.* This is the **third** time this record has stated a hole as bounded and been wrong
    (item 10 at round 2, item 16 at round 4, this at round 5); §11.4 draws the conclusion. The
    residues that replaced it were items 19 and 20 below, both narrower and both about a watcher that
    is not there rather than about a reading that is thrown away — and **item 20 was itself a real
    defect**, closed at round 6, which makes this the fourth item of this section to be replaced and
    round 6's first High the fourth instance of the pattern this paragraph names. What stands in its
    place is item 21, plus item 19 unchanged.
19. **A re-observation reaches nothing when the workspace has no running watcher** (§11.1). A
    worker that could not be spawned, an exhausted epoch space
    (`WatcherLifecycle::without_epoch`), a `WorkspaceSession::unwatched` test session, or a worker
    already stopped all answer `ReObserveOutcome::NoWatcher`, and the state the failed read could
    not describe is then not observed by anything. That is degradation to exactly the coverage such
    a workspace already had — a watcher-less session observes nothing at all — and it is answered
    rather than raised, because a committed write is never afterwards reported as an error. What is
    **not** claimed is that the production path always has one: `WatcherLifecycle::start` absorbs a
    thread-spawn failure by design (2d-2), and nothing checks afterwards. **§12 makes this item
    sharper rather than narrower**: it is now the only thing standing between a save-path *single
    read* and its stabilized correction as well (item 3), so a workspace with no watcher can be left
    with a published state that never stably existed, where before §12 it was left with no
    publication at all on the failing arms. Both are the coverage that workspace had; the second is
    worse to look at, and saying so is the point of writing it down here.

    **§13 changes what a watcher-less workspace is left with, and the direction is the safe one.**
    No save-path read is published any more, so such a workspace is never left holding a state that
    never stably existed; what it is left with instead is **nothing** — the two costs are itemised
    in item 3's *what remains*, and the sharpest is that `after_a_save`'s disagreeing read used to
    be the one external change a session with no watcher could still announce. It announced an
    unconfirmed one. Nothing here makes a watcher exist, and that is still the whole of this item.
20. **~~A re-observation issued while the worker's baseline is still failing is dropped~~ — CLOSED
    by §12, and this item was wrong about what bounded the loss.** Its premise was right — the arm
    existed and dropped the message — and both of the reasons it gave were false. *There is no
    engine to hint yet* is true and is not a reason to drop the **request**: a request can be held
    until there is one, which is what §12 does. *The baseline that eventually starts one reads every
    path* is true and answers nothing, because a baseline **establishes** rather than observes — so
    a path removed before it runs is a path it cannot even enumerate, and a path it does enumerate is
    established without being announced to anybody. And the sentence that made both look survivable —
    *bounded by the same fact, `begin_epoch` discards the whole ledger on replacement* — is simply
    **not true of this half**: no replacement happens, the workspace stays open, and the app-write
    record stays with it, so a record naming bytes the file no longer holds goes on suppressing a
    genuine recreation of exactly those bytes. That was round 6's first High. §12 retains the
    requests across the failing baseline and hands them to the engine it finally opens, as **debts**,
    which is the one form an establishing baseline cannot swallow. The residue that replaces this
    half is item 21.
21. **A re-observation absorbed by a worker that stops before its next tick is still dropped**, and
    this is item 20's *second* half, kept because it is the half whose bounding argument is true.
    A workspace replacement cannot interleave with a save — both hold the session lock — but a
    message absorbed by a worker that then receives `Stop`, and a debt held by an engine that is
    dropped with its worker, are both requests no tick will serve. `begin_epoch` discards the whole
    ledger on replacement, so no record survives to suppress anything, and the successor's baseline
    reads the same tree; that is the coverage a replaced workspace already had. **Stated rather than
    measured**, and the distinction from item 20 is exactly which fact does the bounding: here a
    replacement really is happening, there it was not.
22. **An owed observation of a path whose stable state is one the engine already tracks is emitted
    anyway, and the ledger publishes it whenever nothing already announced that state and no record
    names it.** That is the price of the mechanism rather than a defect in it: *nothing changed
    since I last told you* and *I have never told you anything* are different answers, and only the
    engine's ledger-free view can tell them apart — it cannot, so it answers both. The observation
    carries the equality on its face (`previous_revision == content.revision()` on a `Changed`), so
    a consumer can see that nothing changed; what this step does **not** do is decide what 2d-5
    should do with it, and **a consumer that treated the equality as an external change would put a
    false sentence on screen — it is a reaffirmation, and that warning is the load-bearing half of
    this item.**

    > **Correction (round-7 fix round, §13; round 7's second Low).** The sentence this item ended
    > with — *"the case that costs a sequence is a path this session has committed to but never
    > published a state for"* — was **false**, and the review's counter-case is one this record
    > could have derived from its own code: the condition in `decide` is *no record naming this
    > state and nothing already announcing it*, and neither clause says anything about committing.
    > The reviewer's sequence: the watcher's baseline **establishes** state B without announcing it
    > → a stale save conflicts under the lock without committing anything → the conflict's refresh
    > **fails**, so it records nothing and announces nothing, and asks for a re-observation → the
    > engine settles on B and, because a debt is owed, emits `Changed { B → B }` → the ledger finds
    > no record and no announcement and spends a sequence. This session committed nothing to that
    > path at any point.

    **The real cases, enumerated from the arms that ask** (§12.5's list, re-walked against §13's
    code rather than recalled):

    - `conflict_after_the_lock`'s **failed** refresh — the reviewer's case above. No record, because
      a conflict never takes one; no announcement, because a read that did not complete announces
      nothing. A path this session need never have written to;
    - `after_an_uncertain_write` — the record is **deliberately** absent, because the committed
      revision is unknown, so an owed settlement at whatever the file holds finds nothing to
      suppress it and nothing to coalesce it. The session attempted a write here but cannot say
      what landed;
    - `after_a_save`'s **failed** refresh — the record stands, naming what this save committed, so
      the sequence is spent only where the file no longer holds those bytes. There it is not a
      reaffirmation at all;
    - `after_a_save`'s **disagreeing** refresh — **new with §13, and here the sequence is the
      mechanism rather than its price**. The read is withheld precisely so that the engine's
      stabilized reading is admitted and published, which is consult Q2's *the differing post-save
      observation is queued as external*. If that reading equals the withheld one, the equality on
      its face still says *nothing changed since the engine last spoke*, and it is still the first
      time any consumer has been told.

    **And the cases that cost nothing**, unchanged in kind and widened by §13 in one place: the
    ledger answers `SelfWrite` when a **stamped** reading's state is the recorded one (§14 narrowed
    that to the stamped door), and `Duplicate` when it is the **announced** one — which since §13
    includes a state `conflict_after_the_lock` marked without publishing, so the whole
    successful-conflict path now costs nothing here where before §13 it cost a sequence at the tail
    and coalesced afterwards.
23. **Clearing an app-write record clears the chronology anchor with it, and a reading older than
    that record then has nothing to refuse it** (§14.1). Step 1 of `decide` refuses a stamped
    reading it cannot place at or after the record — and it can only do that while an entry stands,
    so from the first accepted state that supersedes one, a reading stamped *before* that record is
    publishable, describing bytes this application has since replaced. **This is not new and §14 did
    not create it**: supersession has cleared the anchor on every accepted differing state since this
    module was written, which is the ordinary external conflict, and §14 widened the inputs that
    reach it by one class — a *serialized* reading of the recorded bytes — rather than adding a
    class. It is stated here because no earlier round stated it, and because the round that widens a
    hole is the round that owes the sentence. **Bounded by physics rather than by a mechanism**: such
    a reading must have been produced by an engine pass that began before the record and be still
    travelling when the later decision lands, which is one debounce plus one probe of window, and the
    engine's own tracked state means no *fresh* reading of replaced bytes can be produced at all.
    What would close it is an anchor that outlives the record — a second field, or a per-path *last
    superseded at* instant — and that is a design change with its own review, not a fix round's to
    slip in.

    > **Correction and closure (round-9 fix round, §15; round 9's second High and its third Low).**
    > This item was **wrong about the bound and right about the defect**, and it is now **closed in
    > code**. Wrong about the bound: *"bounded by physics … one debounce plus one probe of window"*
    > is false. Only the **production** of such a reading is pre-commit; its **delivery** waits on
    > thread scheduling and on the commit gate, and neither places any bound on it — a completed
    > settlement can sit on a descheduled worker across several commands. Right about the defect,
    > and round 9 found it reachable exactly as this item describes: a settlement stamped before a
    > commit and delivered after a serialized reading had cleared that commit's record was
    > **admitted**, publishing bytes the commit had replaced, with a 2d-5 consumer free to act on
    > them before any correction. Closed by the remedy this item itself named — a per-path
    > `CommitAnchor` whose life is the **epoch**, written by `record_app_write` under the same state
    > guard as the record and removed by `begin_epoch` alone. `decide`'s step 1 reads the anchor and
    > no longer reads the record at all; the record's own `recorded_at` field is gone.
    > `ledger.rs`'s `a_commit_anchor_outlives_the_record_it_was_taken_with` is the driven form,
    > through a real engine and a real `deliver`, and it fails when the anchor is coupled back to the
    > record.
24. **The announced-state map can go stale the same way the record could, and coalescing then
    reports nothing where it should report** (§14.4). `LedgerState::announced` answers *does a
    consumer already have this state*, and its only invalidations are `record_app_write` and
    `begin_epoch`. Nothing else tells it what the frontend has taken: `reload_document` installs a
    foreign revision in the workspace and touches the ledger not at all, exactly as it does for the
    record. So a path announced at B, reloaded to C by the person, and then externally written back
    to B answers `Duplicate` — a state the consumer does *not* have, coalesced into silence. **Found
    by §14's own sweep for the shape and deliberately not closed here**, for the reason the root-cause
    fix was rejected in §14.2: it needs a fourth mutation path into the ledger from a read-only
    command, and *what a consumer has accepted* is the coordinator's fact rather than this module's —
    consult Q3 and Q5 give 2d-5 a **per-document accepted sequence**, which is where the two views can
    be reconciled by construction instead of by two maps agreeing. Until then the ledger's map is
    honest about what it can see and blind to what a command answered.

    > **Correction and closure (round-9 fix round, §15; round 9's third High).** The deferral in the
    > last two sentences was **wrong on its own terms**, and round 9's argument is one sentence: a
    > `Duplicate` sends 2d-5 **no value to arbitrate**, so a per-document accepted sequence cannot
    > reconcile a state that never reaches the coordinator at all. The "fourth mutation path into the
    > ledger from a read-only command" objection is answered under §14.2's correction block below.
    > Closed in code: `reload_document` now reports the revision the workspace accepted, and the
    > ledger drops the announced state for that path **where it differs from it** — and only where it
    > differs, because a reload *onto* a marked state is what *Reload disk version* does to a save
    > conflict, and consult Q5's coalescing entry has to survive it. `ledger.rs`'s
    > `a_reload_that_accepts_other_bytes_invalidates_the_announced_state` drives both halves.

---

## 6. The gates

| Gate | Before 2d-3 (2d-2's closure) | After 2d-3 | After round 1's fix (§7) | After round 2's fix (§8) | After round 3's fix (§9) | After round 4's fix (§10) | After round 5's fix (§11) | After round 6's fix (§12) | After round 7's fix (§13) | After round 8's fix (§14) | After round 9's fix (§15) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `cargo test --workspace` | 1223 passed, 0 failed | 1242 passed, 0 failed | 1245 passed, 0 failed | 1246 passed, 0 failed | 1249 passed, 0 failed | 1251 passed, 0 failed (exit 0; three green runs, and two contended runs on the same tree that were not — see the scar paragraph below) | **1256 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines; two green runs) | **1261 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines, +5 for this round's five new tests; two green runs on a quiet host) | **1262 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines over all 26 of them, +1 for this round's one new test) | **1263 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines over all 26 of them, +1 for this round's one new test) — **on a quiet host, and the scar bit first**: an earlier run of the same tree, contended with an orphaned test binary left by a run this session had cancelled, came back **228 passed, 10 failed** in 456.55 s, every failure a `watch_check.rs:141` bounded-wait timeout and none of them a decision this round changed. The host was quieted, the focused serial gate re-run 20/20, and this figure is the quiet re-run —
**taken twice**, the second time on the finished tree after the neuter runs were reverted, both
1263/0 over 26 `test result` lines | **1267 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines over all 26 of them, +4 for this round's four new tests) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | 18/18 twice | 20/20 twice (66.8 s, 59.2 s) | 20/20 twice (65.4 s, 60.3 s) | 20/20 twice (67.6 s, 63.6 s) | 20 passed, 0 failed (69.6 s, quiet host) | 20 passed, 0 failed twice (68.5 s, 68.7 s — the second through the contention the workspace run failed in) | **20 passed, 0 failed** twice (182.0 s, then 70.8 s quiet — no timeout in either; the first ran on the heels of two full workspace runs and is the scar's slow-but-green face) | **20 passed, 0 failed** twice (68.67 s, then 63.20 s — both on a quiet host, no timeout in either; this round added no `watch_check` test and its one new real-worker test lives in `watch.rs`, so this suite's FSEvents budget is unchanged) | **20 passed, 0 failed** (69.38 s, quiet host, no timeout; this round added no `watch_check` test and touched no watcher code, so this suite's FSEvents budget is unchanged) | **20 passed, 0 failed** (81.03 s, quiet host, no timeout; this round added no `watch_check` test and touched no watcher code, so this suite's FSEvents budget is unchanged). Run **first** after the contended workspace failure above, because it is the gate that discriminates a real regression from the host | **20 passed, 0 failed** (73.27 s, quiet host, no timeout; this round added no `watch_check` test and touched no watcher code, so this suite's FSEvents budget is unchanged) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | clean | clean | clean | clean | clean | **clean** (exit 0) | **clean** (exit 0) | **clean** (exit 0) | **clean** (exit 0) | **clean** (exit 0) |
| `cargo fmt --check` | clean | clean | clean | clean | clean | clean (no `cargo fmt` needed) | **clean** (exit 0, after one `cargo fmt` on `watch.rs`) | **clean** (exit 0; no `cargo fmt` was needed) | **clean** (exit 0, after one `cargo fmt` on `ledger.rs`) | **clean** (exit 0; no `cargo fmt` was needed) | **clean** (exit 0, after one `cargo fmt` on `ledger.rs`) |
| `cargo tree -p espansoconfig-core \| rg tauri` | empty | empty | empty | empty | empty | empty | **empty** (no match; this round touched **no** core file at all) | **empty** (no match; this round touched one core file, `watch/engine.rs`, and what it added is ledger-agnostic — §12.1) | **empty** (no match; this round touched **no** core file at all) | **empty** (no match; this round touched **no** core file at all) | **empty** (no match; this round touched **no** core file at all) |
| `npm run check` files | 431 | 431 | 431 | 431 | 431 | 431 | **431 — not re-run; the frontend was not touched** | **431 — not re-run; the frontend was not touched** | **431 — not re-run; the frontend was not touched** | **431 — not re-run; the frontend was not touched** | **431 — not re-run; the frontend was not touched** |
| `npm test` | 2125 | 2125 | 2125 | 2125 | 2125 | 2125 | **2125 — not re-run; the frontend was not touched** | **2125 — not re-run; the frontend was not touched** | **2125 — not re-run; the frontend was not touched** | **2125 — not re-run; the frontend was not touched** | **2125 — not re-run; the frontend was not touched** |
| `npm run build` modules | 184 | 184 | 184 | 184 | 184 | 184 | **184 — not re-run; the frontend was not touched** | **184 — not re-run; the frontend was not touched** | **184 — not re-run; the frontend was not touched** | **184 — not re-run; the frontend was not touched** | **184 — not re-run; the frontend was not touched** |
| bundle oracle | server-only absent, client-only present (2) | same | not re-run | not re-run | not re-run | not re-run | **not re-run, same reason** | **not re-run, same reason** | **not re-run, same reason** | **not re-run, same reason** |

**Round 3's fix moved the workspace count by 3, and every one is accounted for**: two in
`src-tauri/src/ledger.rs` (14 → 16) — `a_reading_stamped_exactly_at_the_record_is_refused` and
`a_refused_stabilized_state_is_re_observed_rather_than_lost` — and one in
`crates/espansoconfig-core/src/watch/engine.rs`,
`a_reverted_settlement_is_observed_again_instead_of_coalescing_away`, which is the first test any
round of this step added to the core. `watch_check` stays at 20.

**Round 4's fix moved the workspace count by 2, and both are accounted for**: one in
`src-tauri/src/ledger.rs` (16 → 17),
`a_session_locked_reading_is_never_refused_by_the_records_own_instant` (renamed
`a_serialized_door_reading_…` at §11.3), and one in
`src-tauri/src/commands.rs` (7 → 8),
`a_post_save_refresh_is_never_refused_when_no_clock_could_place_it_after_the_record`. `watch_check`
stays at 20 and no test was removed. The frontend figures in the last column are again **carried,
not measured**, and the warrant is the exhaustive list of what this round edited: three files under
`src-tauri/src/` (`ledger.rs`, `commands.rs`, `main.rs`), one core file
(`crates/espansoconfig-core/src/watch/engine.rs`, a doc comment only), this record and
`docs/decisions/2d-1-notes.md`. No `src/`, no i18n path, no corpus path, no `Cargo.toml` and no
`Cargo.lock` — so there is nothing a frontend gate could have moved. **The list is the warrant
because this round ran no `git` command**; the working-tree check the previous rounds quoted is the
committing session's to take.

**Round 5's fix moved the workspace count by 5, and every one is accounted for**: three in
`src-tauri/src/commands.rs` (8 → 11) —
`a_failed_post_save_refresh_asks_for_a_re_observation_and_publishes_nothing`,
`a_failed_conflict_refresh_asks_for_a_re_observation_and_still_refuses` and
`an_uncertain_write_evicts_the_parse_and_asks_for_a_re_observation`, one per arm that asks — one in
`src-tauri/src/ledger.rs` (17 → 18),
`a_removal_the_save_path_could_not_read_is_stabilized_and_admitted`, and one in
`src-tauri/src/watch.rs` (4 → 5),
`a_re_observation_reaches_a_listening_watcher_and_degrades_without_one`. `watch_check` stays at 20
and **no test was removed**; one was **renamed** (§11.3), which moves no count and is the shape a
net figure hides, so it is spelled out here as well as there. The frontend figures in the last
column are again **carried, not measured**, and the warrant is the exhaustive list of what this
round edited: four files under `src-tauri/src/` (`watch.rs`, `commands.rs`, `ledger.rs`,
`main.rs`) and this record. **No core file, no `src/`, no i18n path, no corpus path, no
`Cargo.toml` and no `Cargo.lock`** — so there is nothing a frontend gate could have moved. As at
round 4, **the list is the warrant because this round ran no `git` command**; the working-tree
check earlier rounds quoted is the committing session's to take.

**Round 6's fix moved the workspace count by 5, and every one is accounted for**: two in
`src-tauri/src/commands.rs` (11 → 13) —
`a_disagreeing_post_save_refresh_announces_nothing_and_asks_for_a_stabilized_reading` and
`a_conflict_refresh_marks_its_disk_side_and_still_asks_for_a_stabilized_reading`, one per
admitting arm — one in `src-tauri/src/ledger.rs` (18 → 19),
`a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does`; one in
`src-tauri/src/watch.rs` (5 → 6),
`a_re_observation_issued_while_the_baseline_fails_is_answered_once_it_starts`; and one in
`crates/espansoconfig-core/src/watch/engine.rs`,
`an_owed_observation_is_answered_where_a_hint_coalesces_to_silence`, the second test any round of
this step has added to the core. `watch_check` stays at 20 and **no test was removed**; one was
**renamed** — `WatchWorker::hint_paths` to `schedule_paths` is a production rename, not a test one,
and no test name changed this round. The frontend figures in the last column are again **carried,
not measured**, and the warrant is the exhaustive list of what this round edited: four files under
`src-tauri/src/` (`watch.rs`, `commands.rs`, `ledger.rs`, `main.rs`), one core file
(`crates/espansoconfig-core/src/watch/engine.rs`), this record and
`docs/decisions/2d-1-notes.md`. **No `src/`, no i18n path, no corpus path, no `Cargo.toml` and no
`Cargo.lock`** — so there is nothing a frontend gate could have moved.
`docs/reviews/phase-2d-3-ledger.md` also shows as modified in the working tree; that is the
orchestrator's append of round 6's verbatim reply, made before this round began, and this round did
not touch it. As at rounds 4 and 5, **the list is otherwise the warrant because this round ran no
`git` command that changes anything**; the working-tree check earlier rounds quoted is the
committing session's to take.

> **Correction (round-7 fix round, §13).** Two test names in the paragraph above were **renamed**
> by §13 and are amended in place here, so that a reader following this record to round 6's
> evidence finds it: `a_disagreeing_post_save_refresh_publishes_and_still_asks_for_a_stabilized_reading`
> is now `…_announces_nothing_and_asks_…`, and
> `a_conflict_refresh_publishes_its_disk_side_and_still_asks_for_a_stabilized_reading` is now
> `…_marks_its_disk_side_and_still_asks_…`; `ledger.rs`'s
> `a_one_read_publication_is_superseded_by_the_state_the_engine_stabilizes` is now
> `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does`. What each round *did* is
> left as written — an identifier is a pointer and a dangling one helps nobody, which is the same
> distinction §12.8 drew when it swept `hint_paths` from a test comment and left it standing in
> three prose records of what round 5 built.

**Round 7's fix moved the workspace count by 1, and it is accounted for**: one in
`src-tauri/src/ledger.rs` (19 → 20),
`a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not`, which is the
discrimination between the two new serialized doors and the one thing no test before it drove.
`commands.rs` stays at **13** — the two tests round 6 added are the ones that carry this round's
change, with their assertions inverted rather than duplicated, because a second pair asserting the
opposite of a shipped pair is two tests where one is dead. `watch_check` stays at 20 and **no test
was removed**; **seven were renamed**, counted by listing them, and every one because the claim in
the name changed — five in `commands.rs`:
`a_conflict_records_no_app_write_and_admits_its_refresh_as_external` →
`…_and_marks_its_refresh_for_coalescing`,
`a_post_commit_external_replacement_is_admitted_and_never_recorded_as_ours` →
`…_supersedes_the_record_and_is_never_ours`,
`a_post_save_refresh_is_admitted_when_no_clock_could_place_it_after_the_record` →
`…_is_never_refused_when_…`, and the two named in the correction block above; and two in
`ledger.rs`: `a_committed_record_invalidates_the_published_state_and_supersedes_itself` →
`…_the_announced_state_…`, and the round-6 test that block also names. The frontend figures in the last
column are again **carried, not measured**, and the warrant is the exhaustive list of what this
round edited: three files under `src-tauri/src/` (`ledger.rs`, `commands.rs`, `main.rs`) and this
record. **No core file, no `src/`, no i18n path, no corpus path, no `Cargo.toml` and no
`Cargo.lock`** — so there is nothing a frontend gate could have moved, and `cargo tree` had nothing
new to answer for. `docs/reviews/phase-2d-3-ledger.md` again shows as modified; that is the
orchestrator's append of round 7's verbatim reply, made before this round began, and this round did
not touch it. **The list is otherwise the warrant because this round ran no `git` command at all** —
the brief forbade it — so the working-tree check is the committing session's to take.

**Round 8's fix moved the workspace count by 1, and it is accounted for**: one in
`src-tauri/src/ledger.rs` (20 → 21),
`a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes`, which drives both
serialized doors against a record naming the bytes they read and — as its third leg — the
discrimination that the same input through the **stamped** door is still suppressed.
`commands.rs` stays at **13**: the test that carried the old verdict is the one that carries the new
one, with its assertions replaced rather than a second test asserting the opposite of a shipped
pair. `watch_check` stays at 20 and **no test was removed**; **one was renamed**,
`a_conflict_against_this_apps_own_committed_bytes_is_suppressed` →
`…_is_marked_rather_than_suppressed`, because the claim in the name changed. The frontend figures in
the last column are again **carried, not measured**, and the warrant is the exhaustive list of what
this round edited: three files under `src-tauri/src/` (`ledger.rs`, `commands.rs`, `main.rs`) and
this record. **No core file, no `src/`, no i18n path, no corpus path, no `Cargo.toml` and no
`Cargo.lock`** — so there is nothing a frontend gate could have moved, and `cargo tree` had nothing
new to answer for. `docs/reviews/phase-2d-3-ledger.md` again shows as modified; that is the
orchestrator's append of round 8's verbatim reply, made before this round began, and this round did
not touch it. **The list is otherwise the warrant because this round ran no `git` command at all** —
the brief forbade it — so the working-tree check is the committing session's to take.

**The test count moved by 19 over 2d-2's 1223, and every one is accounted for**: 10 module tests
in `src-tauri/src/ledger.rs`, 7 in `src-tauri/src/commands.rs` and 2 in
`src-tauri/src/watch_check.rs` (18 → 20). Every figure is the sum of the runs' own `test result`
lines rather than a number carried forward.

**The fix round moved it by a further 3, all of them in `ledger.rs`** (10 → 13): the two
concurrency checks of §7.1 and the published-state regression of §7.2. `watch_check` stays at 20 —
§7.3 strengthens an existing test rather than adding one — and no test was removed. The frontend
figures in the last column are **carried, not measured**, and the row says so: `git status
--short --untracked-files=all` shows this round's changes only under `src-tauri/src/` and in this
record, so there is nothing for a frontend gate to have moved. Carrying a number is the thing this
project has got wrong before, which is why it is labelled rather than repeated as if fresh.

**The frontend figures were re-measured rather than assumed at the end of the step itself, and
they are unchanged as this step's boundary requires** — and the **fix round carried them without
re-measuring**, which the last column of the table says in each row rather than leaving to be
inferred. The warrant for carrying them is the same check in both cases: `git status --short
--untracked-files=all` shows changes only under `src-tauri/src/` and in this record — no `src/`,
no i18n path, no corpus path, no `Cargo.toml` and no `Cargo.lock` — so there is nothing a frontend
gate could have moved.

**The round-2 fix round moved it by a further 1, in `ledger.rs`** (13 → 14): two tests added
(§8.3's chronology sequence and its absence twin) and **one removed** —
`an_external_admission_that_meets_a_commit_window_supersedes_its_record`, whose scenario the first
of those two now drives to the opposite verdict (§7.1's correction block). `commands.rs` stays at
7 and `watch_check` at 20; §8.3 strengthens an existing `watch_check` test rather than adding one.
This is the first round of this step to **remove** a test, which is why it is spelled out rather
than left as a net figure: a count that moves by +1 when two were added is exactly the shape a
carried-forward number hides. The frontend figures in the last column are again **carried, not
measured**, on the same warrant, stated exactly: `git status --short --untracked-files=all` shows
this round's changes under `src-tauri/src/` (four modified files and the new `ledger.rs`), in this
record, and in `docs/decisions/2d-1-notes.md`, whose correction block §8 explains — no `src/`, no
i18n path, no corpus path, no `Cargo.toml` and no `Cargo.lock`.

**The quiet-host precondition still binds.** 2d-2 §6 round 4 records a contended workspace run that
failed ten `watch_check` bounded-wait timeouts on a tree that passed quiet; every figure above was
taken with nothing else running, and the two new `watch_check` checks add two more real sessions to
that budget — both on match-only trees, so neither establishes an FSEvents stream of its own. The
fix round's two serial `watch_check` runs were taken quiet as well, and neither produced a timeout,
so no contended re-run was owed. **The round-2 fix round's two were also taken quiet, with the same
result** — and its second neuter run is the one deliberate `watch_check` timeout in this step's
history, produced by a build with the fix removed rather than by contention (§8.6). **Round 4 hit
the scar twice and is the sharpest evidence this project has for it**, so both episodes are
recorded:

- a first `cargo test --workspace` overlapped a stray background run of the same command and
  returned two `watch_check` failures (`a_real_edit_under_config_reaches_the_sink` and
  `a_real_atomic_rename_under_config_reaches_the_sink`, exit 101). The stray process was killed and
  the identical command re-run: **1251 passed, 0 failed**, twice, that binary's target taking 85.8 s;
- later, with the tree **byte-identical** and only Markdown edited since those two green runs, two
  further workspace runs failed with **nine and then ten** `watch_check` timeouts, all at
  `watch_check.rs:141`'s bounded `wait_for`, the failing target taking 389 s against 85.8 s. Nothing
  of this session's was running; `ps -Ao pid,pcpu,comm -r` showed `spindump` at 97 %, then a
  `Virtualization.framework` VM at 111 % and `corespotlightd` at 106 %. The **serial** gate passed
  20/20 in 68.7 s through the same weather, which locates the failure in the parallel workspace run
  rather than in the watcher: `cargo test` runs the eight-cell matrix concurrently, and FSEvents
  delivery is what the host was starving. A later workspace run on the same tree was green again —
  **1251 passed, 0 failed**.

That is the whole warning in one measurement: *the same tree produced 1251/0 and 217/10 within the
hour, and only the host differed.* A `watch_check` timeout is evidence about the host until a quiet
re-run says otherwise.

**Round 5 met the scar's other face — slow but green — and it is recorded because a duration is
evidence too.** The serial gate was first run immediately after two consecutive
`cargo test --workspace` runs and took **182.0 s** against round 4's 68.5 s, with **no** failure and
**no** timeout: 20 passed, 0 failed. Run again on a quiet host it took **70.8 s**, back in the range
every earlier round measured. Nothing in the tree changed between the two, and this round added no
`watch_check` test — so the ratio is the host, exactly as the failures above were, and a slow green
run needs a quiet re-run before its *duration* is quoted as this step's, just as a timeout needs one
before its verdict is.

---

## 7. The round-1 fix round

`docs/reviews/phase-2d-3-ledger.md` round 1 returned **NOT READY** with two High findings and one
Medium. All three are closed here. The two corrections this round owes the record itself are the
block under the headline (§1's first paragraph) and the block under the evidence table (§3); this
section is what they point at.

### 7.1 High 1 — a commit and its record are now one window, behind a gate distinct from the state

**What the finding was.** `save_document` performs its rename before returning, and the watcher's
worker enters `WriteLedger::admit` holding only the ledger's own mutex — the session lock does not
serialize it. So: the save renames to revision A; the save thread is descheduled before it records
A; the watcher stabilizes on A, finds no record, and admits A as **external**. Self-write
suppression has already failed, and the headline this record opened with was not guaranteed. The
mirror interleaving admits an external B before the delayed A record and leaves a stale A record
standing behind it.

**What changed.** `WriteLedger` now holds a **commit gate**, `Mutex<()>`, beside — never inside —
its state mutex, and `CommitGate<'_>` is the guard that names a held window.

- `crate::commands::commit_and_record` is new and is the **only** producer of a record: it takes
  the gate, calls `save_document`, records `committed_revision`'s answer if there is one, and
  returns — the guard dropping at the block's end, so every arm releases it, an early return and a
  panic included. `run_one_save` delegates its transaction to it, which is what puts the gate
  *before* the rename rather than after it.
- `admit`, `admit_at_current_epoch` and `begin_epoch` take the gate before the state and release
  both before returning.
- `record_app_write` takes a `&CommitGate<'_>`, so **a record is taken inside a commit window is a
  property of the signature**. What the type does **not** force, in the same sentence: that the
  gate is this ledger's, and that it was taken before `save_document` rather than after it. Both
  are kept by `commit_and_record` being one function with one caller.

**Why it is deadlock-free**, against the four shapes named in the brief. The order is always
**session → gate → state**, no path takes them in any other order, and the argument reduces to
one sentence: **nothing that holds a ledger lock ever waits for the session lock** — not
`record_app_write`, not either `admit`, not `begin_epoch`, and not `save_document`, which is the
one thing that runs under the gate. A thread waiting for a ledger lock is therefore always waiting
for a holder that will get there on its own. Shape by shape:

- **`WorkspaceSession::open`'s cancel-and-join** — `open` takes session, then gate (for
  `begin_epoch`), then state, and releases all three before the join, which runs outside the
  session lock exactly as 2d-2 D1 requires. The join waits for a worker that holds no ledger lock
  while it waits for anything: the worker's gate/state guards are released by `admit` returning,
  and only then does it call downstream.
- **`WatcherLifecycle`'s `Drop`, same-thread and routed to the reaper** — it touches no ledger lock
  at all.
- **A save in flight under the session lock** — it holds session and gate for the duration of one
  transaction. An admission blocks on the gate for exactly that long, and the save cannot block on
  anything the admission holds, because `save_document` never reaches this module. So a wait, never
  a cycle (§5 item 11 states the cost).
- **The sink re-entering the session** — the downstream sink runs with **both** ledger guards
  already dropped, so it may take the session lock, call `WorkspaceSession::open`, or re-enter the
  ledger. `the_downstream_sink_runs_outside_the_ledger_lock` and `watch_check`'s three
  callback-initiated teardown tests are that as measurement.

**No caller-supplied code runs while any ledger lock is held**, and the gate is the case worth
saying out loud: under the state mutex there is no closure and no callback (and, since §8, exactly
one call that leaves the module — `Instant::now()`, named there); under the gate
there is exactly one thing, `save_document`, whose `SaveRequest` is plain data, which holds no
reference to this session, and which writes through `crate::persist`'s own per-path registry —
a registry that excludes only this process's cooperating callers, so the window is one save's own
I/O and never an unbounded wait on a foreign lock holder.

**The tests are barrier-based and deterministic in both directions**, which the brief asked for and
which a bounded negative window would not have given.
`no_admission_can_decide_between_a_commit_and_its_record` and
`an_external_admission_that_meets_a_commit_window_supersedes_its_record` each spawn one admitting
thread, release it into `admit` through a `Barrier`, and then have the committing thread wait —
**positively** — until that admission has announced itself at the gate. The announcement is a
test-only counter incremented inside `enter_gate`, immediately before the acquisition and in the
same function as it, so a build without the gate never announces and the wait fails instead of
racing. While the committing thread holds the gate, a non-zero waiter count *proves* the admission
has not decided; it then takes its record, drops the gate, and reads the answer. The first test's
answer must be `SelfWrite` with `admitted: 0`; the second's must be `Admitted` **with the record
cleared**, which is the stale-record half of the finding.

> **Correction (round-2 fix round, §8.1).** Both expected answers in the sentence above have
> changed, because a reading parked at the gate was necessarily taken **before** the record the
> window takes — that is what parking means — and such a reading is now `PrecedesACommit`. The
> first test keeps its name and all of its claims (`admitted: 0`, the record retained, nothing
> published) with that arm substituted. The second test's expectation was worse than stale: *the
> record cleared* is exactly what makes the save's own hints foreign, so round 1's fix wrote round
> 2's defect down as a requirement. It is replaced by
> `a_reading_taken_before_a_commit_never_supersedes_its_record`, which drives the same
> interleaving to the opposite verdict and then checks the two things the old test had no reason
> to check: that the save's own bytes are still suppressed, and that a reading taken *after* the
> commit still reports and still supersedes. The barrier machinery, the positive wait and the
> announcement counter are unchanged and still prove the gate.

### 7.2 High 2 — a committed record invalidates the path's published state, and supersession moved above coalescing

**What the finding was**, and it needed no race: external revision B is admitted, so
`published[path] = B`; the application commits A and records A, leaving `published` at B; its own A
hints are suppressed, correctly; an external writer replaces A with B; the gate calls that a
**duplicate of B** and returns *before* clearing the app-write record. So the post-commit external
replacement is never reported, **and** the retained A record then wrongly suppresses a later
genuine external change to A. That defeats consult Q2 directly and falsified the proof this
record's §3 claimed.

**What changed**, in two places rather than one, because the finding has two halves:

1. **`record_app_write` removes `published[path]`**, under the same state guard as the record
   itself, so the two cannot be observed apart. Invalidating rather than publishing the committed
   revision is deliberate: nothing was published for an app write, no sequence was spent and no
   consumer was told, so the map must not claim one was. Over-reporting a later observation is the
   safe direction; coalescing one away is not.
2. **`decide` clears the record immediately after suppression is declined**, above the coalescing
   check and above the sequence-exhaustion check, rather than only on the arm that publishes. This
   is the finding read as a **shape**: an arm that returns early must not skip a mutation a later
   arm performs unless skipping it is the point. Suppression is the only arm with that licence, and
   it says so.

**The audit of every early return** the brief asked for, since sweeping for the shape rather than
the words is the whole instruction:

| Early return | Skips | Intended? |
|---|---|---|
| `admit`'s `StaleEpoch` — above `decide` entirely | the record clearing, the coalescing check, publication | **Yes.** An observation carrying a replaced epoch may not name a document, so it may not clear that document's record either. Only the tally moves. |
| `decide`'s `SelfWrite` | the record clearing, coalescing, publication | **Yes**, and it is the one arm that must retain the record: the several native hints one atomic replacement generates all meet the same entry. |
| `decide`'s `Duplicate` | publication | **Yes** for publication — that is what coalescing *is*. **No** for the record clearing, which is the finding, and which is why the clearing moved above it. |
| `decide`'s `SequenceSpaceExhausted` | publication and the tally | **Yes.** It is terminal within its epoch, deliberately uncounted (§2.8), and it now clears the record like every other non-suppressed arm — the same fact, which that arm simply cannot act on. |
| `admitting_sink`'s `if let Admission::Admitted` | the downstream call | **Yes.** Four decisions end silently; the tally is what makes them observable. **Round 3 replaced this `if let` with one exhaustive `match`** that decides the downstream call *and* the answer the producer acts on, so no arm can forward a value downstream while the worker un-concludes it underneath (§9.3). |
| `run_one_save`'s four outcome arms | — | The gate is released by RAII before any of them, so no arm can strand it and none needs to remember to. |
| `decide`'s `PrecedesACommit` — **added by §8**, above every row above it except the stale-epoch discard | the record clearing, the suppression predicate, coalescing, publication | **Yes**, and it is the second arm with the licence this table's first row claims for suppression alone. A reading this session cannot place strictly after its own last commit to that path describes bytes it may have since replaced: publishing them would report a state that is gone, and clearing the record would make the commit's own hints foreign — which is the round-2 High itself. Only the tally moves **inside the ledger** — and since round 3 the *producer* is told, because "only the tally moves" was true of this module and false of the pipeline: the engine had already settled (§9.1). |

**What is driven and what is only reviewed.** The regression sequence the brief named —
`publish B → record A → observe B → observe A` — is
`a_committed_record_invalidates_the_announced_state_and_supersedes_itself`, and it asserts the
invalidation, the retained suppression of the app's own hints, **both** later transitions admitted
with distinct sequences, and the record cleared. Change 2, though, is **reviewed rather than
driven**: with the invalidation in place, no public sequence can reach the coalescing arm holding a
record, because a record always clears the published entry and only an admitted observation can put
one back — and an admitted observation clears the record. It is the second statement of one rule,
exactly as `AppWrite::epoch` is for the discard on workspace replacement (§2.2), and it is written
down here rather than left to be rediscovered.

### 7.3 Medium — the reopen lifecycle test's leak verdict is the join probe, not the drain window

**What the finding was.** Moving `watch_check` onto the admission gate weakened
`a_successful_reopen_cancels_and_joins_the_old_watcher_and_bumps_the_epoch`. `open` adopts the new
epoch **before** shutting the old watcher down, so a leaked epoch-1 observation is now discarded by
the gate as `StaleEpoch` and can never reach the channel the test's closing drain window reads. A
regression that failed to cancel and join the old worker would leave that test green.

**What changed.** The test captures the replaced watcher's `JoinProbe` *before* reopening —
asserting first that it reads incomplete, so the premise is checked rather than assumed — and then
asserts `completed()` the instant `open` returns. That needs no wait: an ordinary `open`, called
from any thread but the replaced worker's own, joins that worker in place, and the probe's flag is
stored only after the join returned (2d-2 §2.1). The drain window is **kept and re-worded**: it
still pins that the successor's epoch is the only one delivering and that no path of the replaced
tree arrives, and it is no longer described as the leak detector. The two 2d-3 suppression tests
stay behind the production gate, unchanged, as the brief required.

**The same question, asked of the other seventeen 2d-2 tests.** Each was checked for *can the gate
mask the regression this test exists to catch*, and exactly one — the above — could:

- **the eight matrix cells** (create/edit/atomic-rename/removal × `config`/`match`): each waits for
  a **positive** observation of bytes it just wrote, under epoch 1, with no app write recorded and
  nothing published for that path, so no arm of the gate can intervene. A regression that changed
  the epoch would fail the `got.epoch` assertion or time out; neither is masked;
- **`a_failed_reopen_keeps_the_previous_watcher_watching`**: a failed discovery returns before the
  locked block, so `begin_epoch` is never reached and the ledger stays at epoch 1. The verdict is a
  positive delivery at epoch 1; a regression that replaced the watcher anyway fails on the epoch,
  and one that advanced the ledger's epoch alone makes the observation `StaleEpoch` and the test
  time out. Both fail;
- **`dropping_the_session_joins_the_worker_and_closes_the_sink`**: the verdict is `Disconnected`,
  and the gate closure holds the ledger `Arc` but never the channel's sender, so the only holders
  of the sender are still the session and the worker. A worker that was not joined still keeps the
  channel open;
- **the three callback-initiated teardown tests** (`…reenters_the_session…`,
  `…reopens_the_workspace…`, `…becomes_the_last_owner…`) and the reaper-starvation test: every one
  of them parks or acts inside the **downstream** sink, which the gate calls with both its guards
  already dropped. The deadlock and self-join regressions they catch are unchanged in shape, and
  the gate adds no lock the parked thread holds;
- **`an_unwatched_session_keeps_epoch_semantics…`** and
  **`an_exhausted_epoch_space_opens_unwatched…`**: no observation is produced at all, so there is
  nothing for the gate to decide.

### 7.4 What is guaranteed now, and what is only likely

**Guaranteed.** A committed save's record cannot be observed later than the rename it describes:
the two are one window at the gate, and every admission enters through the same gate. A committed
record invalidates its path's published state atomically with itself. Every non-suppressed
decision supersedes the record, whichever arm it takes. An ordinary `open` has joined the replaced
worker by the time it returns, and that is now asserted directly rather than inferred from silence.
A record is taken only inside a commit window, by signature.

**Likely, or merely true today.** That the gate handed to `record_app_write` is *this* ledger's, and
that it was taken before the transaction — kept by one function with one caller, not by a type.
That no future `WriteLedger` method runs caller code under either lock (§5 item 9). That the
coalescing arm's record clearing is unreachable and therefore untested (§7.2). And that a save's own
bytes are suppressed **at all** in the presence of an engine observation stabilized before the save
— they are not, when that older observation is decided after the record (§5 item 10), which is
over-reporting and is the residue the gate cannot reach.

> **Correction (round-2 fix round, §8).** Two sentences above are now wrong, and each was wrong in
> a different way.
>
> - *"Every non-suppressed decision supersedes the record, whichever arm it takes"* was true when
>   written and is **not what the code does now**: `Admission::PrecedesACommit` is a non-suppressed
>   decision that deliberately retains the record, and it is the second of the two arms with that
>   licence. §8.1's `decide` doc carries the current five-step order.
> - The last *likely* bullet described the residue and got its cost wrong in the same words §5
>   item 10 did. It is **closed**, not likely: a reading the session cannot place at or after its
>   own last commit to that path is now discarded, so the save's own bytes stay suppressible. What
>   moves into the *likely* column in its place is the stamp's own caller obligation — that every
>   producer takes its stamp before its reads, which no type forces (§5 item 14).

> **Correction (round-3 fix round, §9).** *"A committed save's record cannot be observed later than
> the rename it describes"* is unchanged, but the sentence that discarding a reading is enough is
> not: **discarding it silently threw the state away**, because the engine had already settled
> (§9.1). What is guaranteed now is stronger and is stated in §9.5. One more *guaranteed* sentence
> also weakens: the chronology check accepts only a **strictly** later stamp, so a save-path refresh
> stamped microseconds after its own record can be refused by a clock collision (§5 item 16) —
> nothing is written or cleared by that, and it is the over-refusing direction, but the earlier
> claim that those two callers could *never* be refused was wrong.

### 7.5 The neuter runs

Four, each disabling exactly one thing this round added and then restored:

- **the gate acquisition in `admit`** (`let _gate = self.enter_gate();` removed):
  `no_admission_can_decide_between_a_commit_and_its_record` and
  `an_external_admission_that_meets_a_commit_window_supersedes_its_record` both failed at
  `await_a_waiter_at_the_gate` — *"no admission ever reached the commit gate — is `admit` taking
  it?"* — after the bounded 30 s, while the other 11 ledger tests passed. Deterministic in both
  directions: the wait is positive, so it cannot pass by luck.
  (**Name correction, round-2 fix round**: the second of those two tests no longer exists under
  that name — §8.1 replaced it with `a_reading_taken_before_a_commit_never_supersedes_its_record`,
  which uses the same barrier, the same positive wait and the same announcement counter, so this
  neuter run's verdict carries to it unchanged. The run itself was not re-taken; §8.6 takes its
  own.);
- **`record_app_write`'s `published.remove(path)`**:
  `a_committed_record_invalidates_the_announced_state_and_supersedes_itself` failed on the
  invalidation assertion. Run again with that assertion disabled, it failed on the behavioural
  one — `Duplicate` where `Admitted { sequence: 2 }` is owed — which is the finding's own scenario
  rather than a proxy for it;
- **the replaced watcher leaked in `open`** (`previous.watcher.shut_down()` replaced by
  `std::mem::forget(previous)`), **with the new probe assertion disabled**:
  `a_successful_reopen_cancels_and_joins_the_old_watcher_and_bumps_the_epoch` **passed** in 13.2 s.
  That is the Medium reproduced — the drain window is blind to a leaked worker now that the gate
  discards its epoch;
- **the same leak with the probe assertion restored**: the test failed in 11.1 s on *"an ordinary
  open must have joined the replaced worker before returning"*.

One further thing was measured rather than assumed while writing §5 item 12: spelling a gate
acquisition `let _ = self.enter_gate()` — which would drop the guard at the semicolon and silently
open the window — is a **compile error**, rustc's deny-by-default `let_underscore_lock`. That is
the only spelling a tool catches; a guard bound and then dropped early is not caught by anything.

**Nothing from 2d-4 or later was added**: no Tauri event, no queue, no `drain_external_changes`, no
`#[tauri::command]`, no TypeScript, Svelte or i18n file, no writer, no force flag and no route
around `save_document`. `commit_and_record` is not a seventh writer — it is the one existing call
of `save_document`, moved inside a guard.

---

## 8. The round-2 fix round

`docs/reviews/phase-2d-3-ledger.md` round 2 returned **NOT READY** with one High: a narrower
instance of round 1's atomicity defect, surviving the commit gate. It is closed here. The
corrections this round owes the record itself are the second block under the headline (§1), the
block under §2.8, the block under §3's evidence table, the block inside §7.1, the row added to
§7.2's early-return audit, the block under §7.4, the name correction in §7.5, and the rewrite of
§5 item 10 with items 13–15 in its place. This section is what they all point at.

**One correction is owed outside this record**, and it is taken: `docs/decisions/2d-1-notes.md`
§2.1 enumerates the predicate's *caller obligation* — the obligation this ledger exists to
discharge — as four items, and this round found a fifth (place the reads relative to the recorded
write). A correction block sits beneath that paragraph. **The core crate itself was not touched**;
the block records an obligation, not a change.

### 8.1 High — a gate cannot reach a read that already happened, so every observation carries a stamp

**What the finding was.** `admitting_sink` calls `admit` only once the engine has already
stabilized an observation — two equal reads, one debounce and one probe earlier. So: disk holds P
(a genuine external write); the engine completes both reads and constructs observation P; before
the sink calls `admit`, a save takes the gate, commits A, records A and releases; P enters the
gate, declines suppression because P is not A, **clears A's record** and publishes P; and the
save's own native hints of A then find no record and are admitted as **foreign**. The gate makes a
commit and its record one window no admission can *decide* inside; it cannot make them one window
no *read* can cross, because the read happened before the window opened.

**Why that is worse than §5 item 10 admitted.** That item called it over-reporting. It is not:
what is reported is this application's own committed write, presented as somebody else's change.
At 2d-5 that becomes a watcher-origin conflict raised against the user's own save — a conflict
panel over a file nobody else touched, on the one path where the person's draft is at stake.
**Said exactly rather than by paraphrase**: consult Q8's own ruling names a *different* sharpest
case, an incomplete open-write-surface registry auto-reloading over a live draft. What this shares
with it is the class Q8 is about — every suite green while the one real callback path does
something destructive to work the person cannot get back — and the 2d-5 consequence above is the
shape it would take here. That is the claim; Q8 is not cited for more than the class.

**What changed.** Every observation now carries the instant its reads are known to follow, and
every record carries the instant it was taken:

- `crate::watch::EpochObservation` gained `read_after: Instant`, produced by
  `WatchWorker::observe` — a **two-line function**, the stamp and then
  `ObservationEngine::tick`, with one caller. That shape is deliberate and is the same technique
  `enter_gate` uses for its announcement: the stamp is worth nothing unless it precedes the reads
  it bounds, and nothing in the type system says so;
- `WriteLedger::record_app_write` stores a private `RecordedWrite { write, recorded_at }` instead
  of a bare `AppWrite`, taking `Instant::now()` on the line that inserts it — therefore **after**
  `save_document` returned and after the rename inside it. `AppWrite` keeps exactly the consult's
  two fields, because the instant is a fact about this session's chronology rather than about the
  write, and the pair lives under one guard so the two cannot be observed or updated apart;
- `decide` gained a first step, above the suppression predicate: if this path has a record and
  `read_after < recorded_at`, the answer is `Admission::PrecedesACommit` and **nothing is
  mutated but the tally**;
- `admit` and `admit_at_current_epoch` both take the stamp, so *external rather than self* stays
  one rule with two callers (§2.6). `after_a_save` and `conflict_after_the_lock` take
  `Instant::now()` on the line above their `Workspace::refresh`.

**The implication it turns on, in one direction only.** `read_after >= recorded_at` gives
`read >= read_after >= recorded_at >= rename`, so the reading observed the disk at or after the
commit landed and describes a state that commit did not undo. That is the whole soundness
argument, and it needs no filesystem chronology and no inference from hashes: the two events it
orders are **this session's own**, one read it performed and one write it performed. The converse
is deliberately not claimed — `read_after < recorded_at` proves only that the session *cannot*
place the read after the rename — which is why the check over-refuses across the width of one
engine pass and never under-refuses (§5 item 13).

> **Correction (round-3 fix round, §9.2).** **The paragraph above is unsound at equality**, and it
> is the accepted condition that is wrong rather than its wording. `Instant` is documented
> monotonic and is *not* documented strictly increasing, so two ordered calls may answer the same
> value — and at equality `read_after >= recorded_at` proves nothing about which call came first.
> A clock-resolution collision would then let a reading taken **before** the rename pass the check,
> clear the new record, and restore round 2's exact self-write-as-foreign failure. The accepted
> condition is now the strict one, `read_after > recorded_at`, and the proof is rewritten around it
> in §9.2 and in `crate::ledger`'s own *stamp* section rather than patched here.

**Why the discarded observation is not a lost one.** A refusal means a commit of this
application's landed at that path after the stamp. That commit is itself a filesystem write, so
its own native hints re-hint the path — usually before the stale observation is even emitted,
because `ObservationEngine::hint` resets a pending probe to debouncing — and the path stabilizes
again with a later stamp. What defeats that recovery is a backend that stops delivering without
reporting anything, which is 2d-2's stated residue and defeats everything else the watcher does
too.

> **Correction (round-3 fix round, §9.1).** **This paragraph was false, and it was the round's first
> High.** A re-hinted path that stabilizes to the refused state emits **nothing**, because `tick`
> had already installed that state into the engine's tracked table before the ledger ever saw it,
> and `settle_present` coalesces against exactly that table. So the recovery described above did not
> exist: native delivery could be perfect and the state was still lost. It also was not
> native-delivery residue, so naming 2d-2's hole here pointed at the wrong thing. §9.1 is the
> closure — the refusal is **answered**, and `ObservationEngine::revert_settlement` un-concludes the
> path and re-hints it, so the recovery costs one engine pass of this same watcher and depends on no
> native event at all.

### 8.2 The three mechanisms, and why this is the one

The review named two and the brief named a third. All three were evaluated before anything was
built.

- **(a) An observation-side gate, acquired before the first stabilizing read and held through
  `decide`. Rejected, and not narrowly.** The stabilization window is one debounce plus one
  probe — **240 ms** at the default timing (`EngineConfig::default()` is 200/40) — and it is
  **unbounded** in the worst case, because the debounce is trailing-edge and a path written
  continuously never stabilizes at all (`ObservationEngine::hint`'s own doc says so). Any save that
  begins while a path is stabilizing therefore waits that long, and a save that begins while a file
  is being written continuously waits until the writing stops. Worse than the number: the two reads
  happen in **two different loop turns**, and between them the worker parks, absorbs native
  signals, and may run a whole `rescan` directory walk. Holding a mutex across all of that, with a
  save blocked on it, is a different kind of object from the leaf mutexes §2.1 argues about: today
  *nothing that holds a ledger lock ever waits for anything but its own I/O*, and this would make a
  ledger lock be held by a sleeping thread while a save holding the session lock waits for it. That
  is not a proven cycle — the discipline of releasing before the downstream call could in principle
  be extended across the window — but it removes the one-sentence argument that makes §2.1
  checkable at all. Paying that to close a microsecond race is the wrong trade.

  > **Re-evaluated in round 3, on the narrower basis the review named, and rejected again for a
  > different and stronger reason.** Round 3 asked for (a) scoped to the pass's **asserting read**
  > rather than to the whole stabilization window — one read, not a 240 ms debounce — so the cost
  > argument above does not apply to it and was not inherited. It is rejected because the *unit* a
  > caller can hold a lock across is `tick`, not one read: `tick` performs the due reads of every
  > pending path and **projects and validates** each settling one, and splitting it would be a far
  > larger core change than the revert. Two things follow, and the second is decisive. The wait is
  > no longer microseconds but one whole pass including YAML parsing, unbounded in file size, with a
  > save blocked on it. And `WatchSource::read` is an **injected trait implementation** — that is
  > caller-supplied code — so holding a ledger lock across `tick` directly destroys §2.1's leaf
  > property, which is the one-sentence argument this module's deadlock freedom rests on. It would
  > also need an `Arc<WriteLedger>` inside `crate::watch` and a second, gate-free `admit`, which is
  > the layering objection (b) was already rejected for. The revert has none of that: it takes no
  > lock at all, runs strictly after both guards are dropped, and adds no coupling between the
  > watcher's thread and a save's.
- **(b) A commit generation, with the observation tagged at or before its read. Adopted, with the
  clock as the generation.** The honest version needs a stamp taken at or before the read, which
  is what makes it work and also what makes a counter awkward: a counter has to be *read* from
  somewhere, so the worker would need a handle on the ledger — either an `Arc<WriteLedger>` in
  `crate::watch`, which puts 2d-3's decision inside 2d-2's lifecycle module, or a closure
  parameter threaded through `WatcherLifecycle::start`. `Instant` needs neither: it is a
  process-wide monotone clock both sides already have, `std::time::Instant` is documented as
  monotonically nondecreasing, and every comparison here is made under the state guard that
  publishes the record, so the visibility is the mutex's and only the *ordering* is the clock's.
  The brief's own permission to add a narrow orderable token to the core was therefore not
  needed — **the core is untouched**.
- **(c) Refuse to clear a record newer than the observation. Adopted as the rule, once "newer"
  could be established.** The brief asked whether this is smaller than (a) or (b), and whether
  "newer" can be established soundly. It cannot be established from the values already in hand:
  an observation's `previous_revision` does **not** distinguish *stabilized before the commit*
  from *coalesced over it*, because the engine legitimately debounces two writes into one
  observation and never sees the intermediate state — so `previous_revision: X, content: P` with a
  record of A is consistent with both, and A is the current disk state in one case and not in the
  other. With the stamp, "newer" is established, and (c) is what step 1 of `decide` does. What
  was **not** adopted is the weaker form of (c) — retain the record but publish anyway. Publishing
  re-installs `published[path]`, which `record_app_write` had just invalidated, and that is round
  1's second High in a narrower form: a later genuine external write back to those exact bytes
  would then coalesce into a `Duplicate` and report nothing. A reading that describes bytes this
  application has since replaced has nothing honest to publish, so it publishes nothing.

### 8.3 The evidence

| Owed | Where |
|---|---|
| the reviewer's sequence, `stabilize P → commit/record A → decide P → observe A`, with A still suppressible | `ledger.rs`'s `a_reading_taken_before_a_commit_never_supersedes_its_record` — barrier-driven, no sleep: the admitting thread is released into `admit` and parks at the gate, the committing thread waits **positively** on the announcement counter before taking its record, and the parked reading therefore decides after the record while having been stamped before it |
| …and that the refusal is about the reading's age, not about the path becoming exempt | step 5 of the same test: a reading of new external bytes, stamped after the commit, is `Admitted` and clears the record. The tally is asserted whole — `admitted: 1, suppressed: 1, coalesced: 0, stale_epoch: 0, preceded_a_commit: 1` |
| the same for a state the suppression predicate never sees | `a_reading_of_an_absence_taken_before_a_commit_is_refused_too` — `Absent` and `Unreadable`, both refused when stamped before the record, both ordinary observations when stamped after. The chronology check is deliberately not narrowed to `Content` the way the predicate is |
| the round-1 concurrency test still proves the gate | `no_admission_can_decide_between_a_commit_and_its_record`, unchanged but for its arm (§7.1's correction block): the positive wait still fails on a build whose `admit` does not take the gate |
| the production stamp is not taken too early | `watch_check.rs`'s `a_committed_save_is_suppressed_while_a_later_external_write_is_not`, strengthened with `preceded_a_commit == 0`. This is the one production-path claim about the stamp a test can make, and it works because step 1 sits **above** the suppression predicate: a worker stamping at its start rather than per pass would refuse the save's own hint as older, the positive wait on `suppressed` would time out, and the new assertion names why |
| a stamp taken too **late** | **nothing.** It is invisible to every test in this crate — the ledger tests pass their stamps explicitly and the production tests cannot see a stamp at all. What holds it is `WatchWorker::observe` being one two-line function with one caller, plus §5 item 14 |

### 8.4 The re-audit of what round 2 declared sound

Round 2 inspected four things statically and found them sound. This change touches the same
decision path, so each was re-checked against the new code rather than inherited.
**§9.4 does the same for what round 3 cleared, against round 3's own change** — including the
strengthened reopen probe below, whose `StaleEpoch` argument round 3's fix had to re-derive because
that arm now also decides whether a settlement is taken back.

- **The published-state invalidation.** `record_app_write` still removes `published[path]` under
  the same guard as the record. The new arm publishes nothing, so it cannot put an entry back, and
  it clears nothing, so it cannot leave one behind. The invariant *a record standing implies no
  published state for its path* is unchanged, and
  `a_committed_record_invalidates_the_announced_state_and_supersedes_itself` still drives it.
- **The early-return ordering.** Re-audited as a whole, with the new arm added as a row to §7.2's
  table. The rule that table states — *an arm that returns early must not skip a mutation a later
  arm performs unless skipping it is the point* — now has two licensed arms instead of one, and
  both say so at their own definition site. The order between them was chosen deliberately and is
  documented on `decide`: they overlap on exactly one input (a reading of the recorded bytes,
  stamped before the record), both answers are true of it, both retain the record and both publish
  nothing, so the order decides only which counter moves — and putting chronology first is what
  gives §8.3's production assertion its bite.
- **The coalescing-unreachability argument.** Still holds, and for the same reason plus one: only
  a publication fills `published`, a publication requires passing the clearing step, and the one
  arm added since the argument was written neither publishes nor clears. The clearing on the
  coalescing arm therefore remains reviewed rather than driven.
- **The strengthened reopen probe.** Untouched. `EpochObservation` gained a field, but
  `watch_check` never constructs one — it consumes `AdmittedObservation`, which is unchanged — and
  the stale-epoch discard still happens in `admit` **above** `decide`, so a replaced watcher's
  observation is discarded before any record or stamp is consulted. A leaked epoch-1 worker's
  observation is still `StaleEpoch`, and the join probe is still what carries the leak verdict.

### 8.5 The two sweeps

**For the shape** — *a value read at one time and acted on at another, with a mutation possible in
between* — rather than for the words of round 2's finding:

- **Found and changed:** `decide` looked up `documents_by_path` and `writes` inside the
  suppression branch only, and the new chronology check needed the same entry. Two lookups under
  one guard cannot disagree today, but they are two statements of *which entry this path has*, and
  a future change to the key would update one. `decide` now takes **one** lookup and both checks
  read it.
- **Inspected and sound:** `run_one_save`'s cloned `DocumentContext` and the record taken from its
  path (session lock held throughout, and only `open` re-spells a path); `open`'s epoch allocation
  followed by `begin_epoch` (both under the session lock); `after_a_save`'s `observed` revision
  read from the refresh and admitted after an `evict` that only runs on the arm where `observed`
  is `None`; the reaper's `is_finished()`-then-`join()` (monotone false-to-true);
  `WatcherLifecycle::drop`'s thread-id comparison (a thread id is immutable); `enter_gate`'s
  announcement counter (test-only, and the waiter cannot acquire while a test holds the gate).
- **Inspected, real, and inherited rather than closed:** `SavedDocument::revision` is the file's
  post-rename read-back, so a foreign process replacing the file in between makes this session
  record *their* revision as its own write. That is the core's documented window (2a-1 notes D4),
  it is a question of whose bytes rather than of event order, and the stamp does not address it.
  It is now §5 item 15 rather than left unstated.
- **Also inspected:** `commands.rs`'s test at the `Duplicate` assertion reads
  `current_epoch()` and then calls `admit` with it — the shape, in a single-threaded test against
  an `unwatched()` session that has no worker at all. Left as it is, and named here rather than
  discovered later.

**For name positions**, as a pass distinct from the prose: headlines, section headings, bold
ruling lines, doc comments, module headers and test names.

- `docs/decisions/2d-3-notes.md` line 3 — the headline named one mechanism and claimed the whole
  property; rewritten to name both, with a correction block beneath it;
- `src-tauri/src/main.rs`'s phase paragraph said the commit gate alone makes a save's own rename
  un-reportable; rewritten to name the gate **and** the stamp, and to say what each reaches;
- `Admission::SelfWrite`'s doc said it is *the only decision that retains a record*; it is now one
  of two, and it names the other;
- `Admission::Duplicate`'s doc said it is cleared *like every arm below the suppression check*;
  there are two retaining checks above it now;
- `LedgerTally`'s doc said *four of the five decisions*, and §2.8 said the same; both corrected,
  and the doc's own instruction — ask the two questions rather than assume the struct is
  exhaustive — is what added the new counter;
- `decide`'s doc listed a four-step contract with *only step 1 has that licence*; it is now five
  steps with two licensed arms, and the step numbers in the round-1 argument it carries were
  renumbered with it;
- **the test name `an_external_admission_that_meets_a_commit_window_supersedes_its_record`** —
  the sharpest one. Its name, its comment and its assertions all stated round 2's defect as a
  requirement. Replaced by `a_reading_taken_before_a_commit_never_supersedes_its_record`, with
  correction blocks at both places the old name appears (§3's table, §7.1, §7.5's neuter run).

### 8.6 The neuter runs

Two, each disabling exactly one thing this round added, then restored:

- **the chronology check itself** (`decide`'s step 1 disabled, its condition only):
  `a_reading_taken_before_a_commit_never_supersedes_its_record` failed on **step 3's first
  assertion** — `Admitted { sequence: 1 }` where `PrecedesACommit` is owed, which is the round-2
  High's first consequence, the publication of a state that is gone. It failed there rather than
  on the record-clearing assertion two lines below only because that one is reached second; the
  same code path takes both. `a_reading_of_an_absence_taken_before_a_commit_is_refused_too` failed
  on its first loop iteration for the same reason, and
  `no_admission_can_decide_between_a_commit_and_its_record` failed too — `SelfWrite` where
  `PrecedesACommit` is owed, because a build without the check falls through to the predicate
  there. **3 failed, 11 passed** — the other eleven ledger tests are
  untouched by the check, which is what makes it a check rather than a rewrite;
- **the production stamp taken too early** (`WatchWorker::observe`'s `Instant::now()` replaced by
  `self.origin`, the fixed instant a worker starts at):
  `a_committed_save_is_suppressed_while_a_later_external_write_is_not` failed at
  `watch_check.rs:141` — `wait_for`'s *"timed out waiting for the save's own bytes to be
  suppressed"* — after the bounded 120 s, in **128.95 s**, because every observation of that
  session is then stamped before every record and refused as older. That is §8.3's claim about the
  production path, driven rather than argued, and it is deterministic in both directions: the wait
  is positive, so it cannot pass by luck.

**What has no neuter run, and why**: a stamp taken too *late* has no test to fail, so disabling
nothing would demonstrate nothing. Saying that is the point of §5 item 14 rather than manufacturing
a run that could not fail.

### 8.7 What is guaranteed now, and what is not

**Guaranteed.** A reading this session cannot place at or after its own last committed write to a
path neither publishes nor clears that path's record, so a committed save's own hints remain
suppressible however late that reading decides. The chronology check applies to every observed
state, not only to content. A record and the instant it was taken cannot be observed or updated
apart. `admit` and `admit_at_current_epoch` reach the same `decide` with the same four operands,
so the two save-path refreshes are decided by one rule rather than by a second that agrees today.

**Not guaranteed, and stated as such.** That a producer's stamp precedes its reads — no type says
so, one function and two adjacent lines do (§5 item 14). That a refused reading is re-observed —
it depends on native delivery, which is 2d-2's residue (§5 item 13). That the ledger's own record
names the bytes this application wrote rather than a foreign process's, when that process replaced
the file between the rename and the read-back (§5 item 15, the core's window). And everything §5's
other items already carried, unchanged by this round.

**Nothing from 2d-4 or later was added**: no Tauri event, no queue, no `drain_external_changes`,
no `#[tauri::command]`, no TypeScript, Svelte or i18n file, no writer, no force flag, no route
around `save_document`, and no change to `crates/espansoconfig-core` — `cargo tree -p
espansoconfig-core | rg tauri` still finds nothing, and no core file was touched at all.

> **Correction (round-3 fix round, §9).** Two sentences of §8.7 do not survive round 3.
> *"A reading this session cannot place at or after its own last committed write to a path neither
> publishes nor clears that path's record"* is now *cannot place **strictly after***, and *"nothing
> in the type system ties a stamp to the reads it claims to bound"* has a second half: nothing ties
> the sink's **answer** to what the producer does with it either. And the last paragraph's *"no
> change to `crates/espansoconfig-core` … no core file was touched at all"* is **false as of round
> 3**: `crates/espansoconfig-core/src/watch/engine.rs` gained `revert_settlement` and
> `Observation::path()` (§9.1). Everything else in that paragraph still holds, and the architecture
> rule was re-checked on the round that broke the streak. §9.5 is the current statement of what is
> guaranteed.

> **Correction (round-4 fix round, §10).** *"`admit` and `admit_at_current_epoch` reach the same
> `decide` with the same four operands"* is no longer the shape, and the sentence it was defending
> is stronger than ever. The method is `admit_under_the_session_lock` and the fourth operand is a
> private `ReadChronology` rather than an `Instant`, so the two doors reach the same `decide` with
> the same suppression, supersession, coalescing and sequence allocation, differing only in which
> **proof of chronology** each can build — and neither lets its caller build the other's. That is
> still one rule with two callers; it is now one rule with two *proofs*, which is what §10.1 is
> about. §10.5 is the current statement of what is guaranteed.

---

## 9. The round-3 fix round

`docs/reviews/phase-2d-3-ledger.md` round 3 returned **NOT READY** with two Highs, and it is the
third consecutive round whose finding was produced by the previous round's fix. Both are closed
here. The corrections this round owes the record itself are the third block under the headline (§1),
the rewrite of the *no wire* paragraph's core-untouched claim, two additions to §1's built list,
the replacement of §5 item 13 and the second half of item 14, items 16 and 17 in §5, the round-3
column and paragraph in §6, two rows of §7.2's early-return table, the block under §7.4, two blocks
inside §8.1, the re-evaluation block inside §8.2, the pointer in §8.4, and the block under §8.7.
**One correction is owed outside this record and is taken**: `docs/decisions/2d-1-notes.md` §2.1's
round-2 correction block said *nothing in this engine changed, and nothing here is asked to change*;
its second half was wrong, and a further block sits beneath it.

### 9.1 High 1 — a settlement is provisional, because a refusal is not a free action

**What the finding was.** `ObservationEngine::tick` installs a stabilized state into its `tracked`
table *before* returning the observation, so when the ledger refuses that observation the engine has
already recorded the state as known. `settle_present` coalesces against exactly that table, so a
later hint stabilizing to the same state emits **nothing**. Concretely: an external revision P
stabilizes and `tick` updates `tracked` to P → this application commits A and records it before the
admission → P is refused as `PrecedesACommit` → the save's own hints of A are correctly suppressed
— **and P is never published, ever**. The review's sharper variant needs no delayed delivery at all:
the second reading of P settles into `tracked` and is refused because its stamp precedes the record,
and the already-queued hints re-read P and coalesce inside the engine. Native delivery can be
perfect and P is still lost.

**Why the record's own sentences were false, said plainly.** §5 item 13 claimed a re-hint would
"produce a fresh observation with a later stamp", that the direction was *the safe one*, and that
what remained was 2d-2's native-delivery residue. All three are wrong, and each in a different way:
a re-hint produces nothing against a tracked state; over-refusal is loss rather than delay when the
producer has already settled; and no native event is involved in the loss. They are replaced rather
than softened.

**The mechanism, and why it is this one.** The review named two and invited a third.

- **(a) Serialize the settling `tick` with the ledger decision** — hold an observation-side commit
  gate from immediately before the pass's asserting read through every ledger decision. Round 2 had
  rejected the *whole stabilization window* version on cost (§8.2 (a)); round 3 correctly pointed
  out that the asserting read is one read, not a 240 ms debounce, so that cost argument was **not**
  inherited and the option was re-evaluated from scratch. It is rejected again, for a stronger
  reason: the unit a caller can hold a lock across is `tick`, not one read. `tick` performs the due
  reads of *every* pending path and **projects and validates** each settling one, so the window is
  one whole pass including YAML parsing, unbounded in file size, with a save blocked on it — and,
  decisively, `WatchSource::read` is an injected trait implementation, which is **caller-supplied
  code**. Holding a ledger lock across it destroys §2.1's leaf property, which is the one-sentence
  argument this module's deadlock freedom rests on. It would also need an `Arc<WriteLedger>` inside
  `crate::watch` and a second gate-free `admit` — the layering objection §8.2 rejected (b) for.
- **(b) Make settlement provisional. Adopted.** The engine keeps, for exactly one pass, the tracked
  state each settlement replaced, and `ObservationEngine::revert_settlement(path, now)` puts it back
  and re-hints the path. It takes no lock, runs strictly after both ledger guards are dropped, adds
  no coupling between the watcher's thread and a save's, and works for any future refusal rather
  than only for this one.
- **(c) Requeue without rolling back.** Considered and rejected: with `tracked` still holding P a
  requeue coalesces to nothing, so it would need a *this path is owed an observation* flag, and the
  observation it then emits is a lie about its own shape — `Changed { previous_revision: P,
  content: P }`, which this engine documents as meaning *readable again, bytes as before*, or a
  `Removed { previous_revision: None }` that has forgotten what it removed. Rolling back produces
  **the same observation again if the disk still holds that state when the retry reads it**, and
  otherwise a correct fresh observation of whatever does stabilize — which is the honest answer
  either way, and is the difference from (c): the shape is right in both cases.

  > **Correction (round-4 fix round, §10).** The sentence above read *"Rolling back produces the
  > same observation again, which is the honest answer"*, with no condition on it, and round 4's
  > Low is that the implementation deliberately does not promise that. `revert_settlement` restores
  > the base and **re-hints**; the retry re-reads, so if another process writes Q in between the
  > engine emits `Changed { B → Q }` and not the refused `Changed { B → P }` — correctly.
  > `revert_settlement`'s own third bullet always said so, contradicting the guarantee its first
  > paragraph gave; the doc comment and this sentence are both qualified now. What (c) is rejected
  > for is unchanged and does not depend on the replay: a requeue without a rollback emits an
  > observation whose *shape* is a lie, whatever the disk then holds.

**What changed.**

- **`crates/espansoconfig-core/src/watch/engine.rs`** — *the first core change any round of this
  step made*. `ObservationEngine` gained a private one-pass `undo: BTreeMap<PathBuf,
  Option<Tracked>>`, cleared on the first line of every `tick`; the three `settle_*` functions now
  answer a private `Settled { observation, replaced }`, and `settle` files the undo, so **every
  emitted observation is revertible by construction** — a fourth settlement kind would have to
  answer `Settled` to compile. Two of the three hand their replaced value over by **move**; only
  `settle_failed` clones, because it is the one settlement that carries part of the state it
  replaces into the state it installs, and it clones only on the arm that emits. A rescan that
  re-hints every tracked path and coalesces therefore clones no snapshot at all.
  `revert_settlement` restores and re-hints; `Observation::path()` is the accessor a caller needs to
  take the path out before handing the observation on, and `crate::ledger::observed_path` is now a
  delegation to it rather than a second copy of that rule;
- **`src-tauri/src/watch.rs`** — `ObservationSink` **answers**: it returns the new
  `ObservationOutcome`, and `deliver` is the one place that answer is read, calling
  `revert_settlement` for `Undecided`. `deliver` is a free function rather than a method so a test
  can drive it with a real engine and the real gate; `WatchWorker::publish` is the loop's one-line
  call into it. The re-hint uses the pass's own `now`, which is the instant those reads were
  scheduled at, so the debounce covers the whole interval since the refused conclusion;
- **`src-tauri/src/ledger.rs`** — `admitting_sink` maps `PrecedesACommit` to `Undecided` and every
  other decision to `Decided`, from the **same** exhaustive match that decides whether the
  observation reaches `downstream` (§9.3). `StaleEpoch` and `SequenceSpaceExhausted` are
  deliberately `Decided`: a replaced watcher's engine is going away and its successor's baseline
  scan re-reads every file under both roots, and exhaustion is terminal within its epoch — reverting
  either would re-observe one path forever.

### 9.2 High 2 — the accepted condition is strict, and equality is a refusal

**What the finding was.** `Instant` is monotonic across threads but expressly **not** guaranteed
strictly increasing, so two ordered calls may answer equal values. `read_after >= recorded_at`
therefore does not prove the read followed the record, and on a clock-resolution collision an
observation stamped *before* the commit passed the check, cleared the new record, and restored round
2's exact self-write-as-foreign failure.

**What changed.** One character in `decide` — `read_after <= entry.recorded_at` refuses — and the
proof rewritten around the accepted condition rather than patched, in `crate::ledger`'s *stamp*
section and here. It is two steps because the two steps are about different things:

> **On the values:** `read_after > recorded_at`.
>
> **On real time:** a monotonic, nondecreasing clock cannot answer a *strictly greater* value to a
> call made earlier, so the `Instant::now()` behind `read_after` was made at or after the one behind
> `recorded_at`. With the stamp taken before its reads and the record taken after its rename, that
> gives `read >= stamp >= record >= rename` — the read observed the disk at or after the commit
> landed, so what it read is a state that commit did not undo.

At equality the second step collapses and nothing about the two calls' order follows, which is why
equality sits on the refusing side. Neither step needs a filesystem chronology or an inference from
hashes: both events are this session's own.

**The sweep for the shape, not for the words.** Every `Instant` comparison in `src-tauri` was
listed and read:

- `decide`'s is the only one that carries an implication, and it is the one that changed;
- `watch_check.rs`'s four bounded waits and `ledger.rs`'s `await_a_waiter_at_the_gate` compare
  against a **deadline**. An equality collision there costs one extra loop iteration and asserts
  nothing, so they are correct as written;
- **test arrangements that rely on two stamps differing** were the real sweep. The four tests that
  stamp *before* a record want the refusing side, so the strict rule makes them **more** robust at
  equality, not less. The helpers that want the accepting side — `admit_now` and `hinted` — read the
  clock and would have been at the mercy of its resolution, so they now use `later_than_now()`, one
  nanosecond past `Instant::now()`, which makes their own claim (*later than everything this test
  has already done*) true by construction. The one arrangement that **cannot** be made robust is
  `commands.rs`'s `a_post_commit_external_replacement_supersedes_the_record_and_is_never_ours`: it
  asserts `admitted == 1`, which needs `after_a_save`'s internal `Instant::now()` to be strictly
  later than a record taken a few lines above, and that stamp is internal by design (§2.6). An
  `fs::write` separates them, so it is reviewed rather than driven, and §5 item 16 carries the
  production half of the same fact.

### 9.3 The fourth narrower instance — forwarding and answering were two expressions over one value

Rounds 1, 2 and 3 each found a narrower instance of the previous round's finding, so this round
asked its own change the same question: *is there anywhere else a value is settled, installed or
consumed before the decision that could reject it?* It was found in this round's own new code.

`admitting_sink` decided **twice** over one `Admission`: an `if let Admission::Admitted` chose
whether to call `downstream`, and a separate `outcome_of` chose what to answer the producer. Today
those two agree — only `Admitted` forwards, and `Admitted` answers `Decided` — but they are two
statements of one rule, and the shape they permit is precise and bad: an arm that forwards a value
to a consumer *and* answers `Undecided` would have the worker un-conclude, in the engine, a state a
consumer has already been told about. It is closed structurally rather than by a test: one
exhaustive `match` now produces both, so **the arm that forwards is the arm that answers
`Decided`**, and a seventh `Admission` is a compile error in that block.

Three other candidates were inspected and are **inherited rather than closed**, each named here
rather than rediscovered:

- `decide` spends a sequence and installs `published[path]` before any consumer has received
  anything, and the production downstream sink **drops** the value (§5 items 1 and 2). That is the
  same shape, it is deliberate, and it is 2d-4's: when the queue exists, the enqueue must be
  answered by the decision that produced it, exactly as the ledger's refusal is answered now;
- `decide` clears the record above the coalescing and sequence-exhaustion arms, so a
  `SequenceSpaceExhausted` clears a record and publishes nothing. §7.2's table licenses it and the
  reason is unchanged: the file no longer holds what this application committed, whether or not the
  arm can act on it;
- `after_a_save` refreshes the workspace cache before the admission decides. The refresh is
  unconditional cache coherence rather than a consequence of the decision, so refusing the admission
  leaves nothing installed that should not be.

### 9.4 The re-audit of what round 3 cleared

Round 3 cleared five things. This change touches the same paths, so each was re-checked against the
new code rather than inherited.

- **The removed test's coverage.** `no_admission_can_decide_between_a_commit_and_its_record` still
  parks a reading at the gate, still fails on a build whose `admit` does not take it, and still ends
  in `PrecedesACommit` — the strict rule cannot change that arm, because its stamp is taken before
  the record. `a_different_revision_is_admitted_and_supersedes_the_record` needs the *accepting*
  side and now gets it by construction through `later_than_now()` rather than by clock resolution.
  Both still bite.
- **The construction sites.** `ObservationSink` changed shape, so every producer of one was
  re-listed: there is exactly one, `admitting_sink`, installed by `WorkspaceSession::observing`,
  which every session constructor goes through. Every sink a test injects is an `AdmittedSink`,
  which is unchanged, so no test-side sink was touched.
- **The wire boundary.** `ObservationOutcome` derives no `serde` trait, appears in no command
  signature and crosses nothing; `Observation::path()` returns a borrowed path inside the core.
  Nothing new is serializable, so the dictionary and wire contracts have nothing new to account for
  — and both suites run in the workspace figure below.
- **The lock order.** Unchanged, and the new call adds nothing to it: `revert_settlement` takes no
  lock at all, and `deliver` calls it strictly **after** `admitting_sink` has returned, which is
  after `admit` dropped both guards by returning a value. The `Undecided` arm never calls
  `downstream`, so a revert and a downstream re-entry are mutually exclusive by construction.
- **The merged lookup.** `decide` still takes one lookup of `documents_by_path` and `writes`, read
  by both retaining checks; only the comparison operator inside the first of them changed.

### 9.5 The evidence and the neuter runs

| Owed | Where |
|---|---|
| an engine-plus-ledger regression proving a refused stabilized state cannot disappear after subsequent hints | `ledger.rs`'s `a_refused_stabilized_state_is_re_observed_rather_than_lost` — one real temp tree, one real `ObservationEngine` whose clock is an argument, the real `admitting_sink` and the real `crate::watch::deliver`. **No thread and no sleep**: the stamp is a value, so taking the record after it is the whole interleaving |
| …and that the recovery is the *same* observation rather than a new shape — **on a disk nothing else writes to**, which is a property of these two tests and not a guarantee of the method (corrected in the round-4 fix round, §10.3) | the same test's step 4, plus the core's `a_reverted_settlement_is_observed_again_instead_of_coalescing_away`, which asserts the re-observed `Changed` carries the same `previous_revision`. Both hold the tree still across the retry, so what they drive is *the settlement was taken back*; a retry that reads a state some other process has since written correctly reports **that** state instead |
| that a revert is one pass deep | the core test's tail: a tick with nothing due makes the settlement final, and the next revert restores nothing and is a plain hint |
| the equality case | `ledger.rs`'s `a_reading_stamped_exactly_at_the_record_is_refused`. A test cannot make the host clock collide on demand, so it asks for the collision directly through the test-only `WriteLedger::recorded_at` — the record's own instant, handed straight to `admit`, which is exactly what a coarse clock would have produced |
| the production stamp is still not taken too early | unchanged: `watch_check.rs`'s `a_committed_save_is_suppressed_while_a_later_external_write_is_not` still asserts `preceded_a_commit == 0`, and it still passes |
| a stamp taken too **late**, and a sink answer **dropped** | **nothing.** Both are invisible to every test in this crate. What holds them is `WatchWorker::observe` and `deliver`, each one function with one caller, plus §5 item 14 |

**Three neuter runs**, each disabling exactly one thing this round added, then restored:

- **the `deliver`-side revert** (`ObservationOutcome::Undecided` handled as a no-op):
  `a_refused_stabilized_state_is_re_observed_rather_than_lost` failed at step 3's tracked-state
  assertion — *"the engine no longer believes it announced the refused state"* — because that
  assertion is reached first. To show the loss itself rather than its cause, step 3's assertion was
  then relaxed to a plain read and the run repeated: it failed at step 4 with **`the refused
  external state is observed again: []`, left 0, right 1** — the genuine external change gone, with
  every read in the test performed and no delivery involved. Both edits restored. 15 of the 16
  ledger tests passed in the first run, which is what makes it a check rather than a rewrite;
- **the engine's rollback** (`revert_settlement`'s restore arm emptied, the re-hint left):
  `a_reverted_settlement_is_observed_again_instead_of_coalescing_away` failed at *"the state the
  settlement replaced is back"*, proving that the re-hint alone — the "requeue" option (c) — is not
  the fix;
- **the strict comparison** (`<=` relaxed back to `<`):
  `a_reading_stamped_exactly_at_the_record_is_refused` failed with **`Admitted { sequence: 1 }`
  where `PrecedesACommit` is owed** — round 2's High restored by a clock collision, publishing a
  state that is gone and then clearing the record. **1 failed, 15 passed**, so the check is narrow.

### 9.6 The two sweeps

**For the shape** — *a value settled, installed or consumed before the decision that could reject
it* — is §9.3, and the `Instant`-comparison sweep is §9.2's last paragraph.

**For name positions**, as a pass distinct from the prose:

- `docs/decisions/2d-3-notes.md` line 3 — the headline named two mechanisms and claimed the whole
  property; rewritten to name three, with a third correction block beneath it;
- the *no wire, no window* paragraph said the core crate **was not touched at all**; that was true
  through round 2 and is false now, and it is corrected in place rather than left to §9;
- `src-tauri/src/main.rs`'s phase paragraph said **two** things make a save's own rename
  un-reportable; it now names three and says what each reaches, and says *strictly after*;
- `Admission::PrecedesACommit`'s doc said it mutates nothing but the tally, which was true of the
  ledger and false of the pipeline; it now names the answer it forces and the rule for which arms
  may join it;
- `LedgerTally::preceded_a_commit`'s doc counted refusals with no statement of what a refusal costs;
  it now says the count is of refusals and never of losses, and why;
- `WriteLedger::admit_at_current_epoch`'s doc said *today neither can be refused by it*; one of them
  can, at a clock collision, and the doc says so and says what it costs (§5 item 16);
- `commands.rs`'s `after_a_save` carried the same claim as a comment; corrected there too, which is
  the narrower instance the previous rounds' pattern predicted;
- `crate::ledger`'s module *stamp* section stated the implication with `>=`; the whole section is
  rewritten around the strict condition, and the *converse* paragraph that called over-refusal *the
  safe one* is replaced by the paragraph that says why it was not and what makes it safe now;
- `admitting_sink`'s doc and `ObservationSink`'s doc both described a sink that answers nothing;
  both now name the answer and the one call site that reads it;
- `crates/espansoconfig-core/src/watch/engine.rs`'s module header gained *A settlement is
  provisional until the next tick*, beside its existing *A hint is not truth*.

---

## 10. The round-4 fix round

`docs/reviews/phase-2d-3-ledger.md` round 4 returned **NOT READY** with one High and one Low, and
it is the fourth consecutive round whose finding was produced by the previous round's fix. Both are
closed here. The High lives in exactly the hole the round-3 fix round wrote down as honestly
bounded — §5 item 16 — which is what item 10 did to §7 and item 13 did to §8: **this step's holes
have twice now been the next round's High, so a hole is a place to look first rather than a place
already accounted for.**

The corrections this round owes the record itself are the fourth block under the headline (§1), two
additions to §1's built list, a block under §2.6, the **replacement** of §5 item 16 and a third half
of item 14, the name in item 12, the new item 18, the round-4 column in §6's table together with a
new count paragraph and a rewritten quiet-host scar paragraph beneath it, the names in §2.1's
leaf-mutex bullet and §2.6's first bullet, a
block inside §8.7, a block inside §9.1's option (c) and an amended row of §9.5. **One correction is
owed outside this record and is taken**: `docs/decisions/2d-1-notes.md` §2.1's fifth caller
obligation can now be discharged two ways, and a block beneath the round-3 one says so.

### 10.1 High — the premise was verified before anything was built on it

**What the finding was.** `after_a_save` takes `Instant::now()` a few lines after its own save
recorded, on one thread, and `decide` accepts only a *strictly* later stamp. Two adjacent clock
reads that a coarse clock answers equally therefore produced `Admission::PrecedesACommit`: the
record was retained, nothing was published, and — unlike a watcher observation — nothing answered
the refusal. There is no engine settlement on that path to take back and no loop to retry it. So a
post-save refresh that found an **external** replacement could be refused and never heard again.

**Why the record's own sentences were false, said plainly.** §5 item 16 said the cost was *one
publication*, and that the external replacement "is reported by the watcher's own hints instead".
The second half is what makes the first half wrong, and it is not true: `docs/decisions/2d-2-notes.md`
§2.3 expressly declines to cover a backend that stops delivering **without reporting anything** —
*a sandbox that blocks FSEvents delivery looks exactly like a healthy quiet stream, and no API
distinguishes them*. An observation whose only remaining carrier is a hint nobody guarantees is not
a delayed publication; it is a lost external change. That falsifies §1's headline in its own words,
and it violates the consult's Q2, which requires the differing post-save observation to be **queued
as external**. §2.6's *"neither can currently be refused by that comparison"* was the same error one
layer up: no *concurrent* commit can refuse them, and their own does.

**The premise was checked in the code, not inherited from the review.** The review's minimal fix
rests on *saves and refreshes are serialized by the session lock*. Round 2's fix produced round 3's
finding by inheriting a premise, so this one was re-derived from the call graph, and it is stated as
the chain it is:

1. `WriteLedger::record_app_write` is the **only** producer of a record. Its one production caller
   is `commands::commit_and_record` (`ledger.rs`'s module docs already claimed this; it was
   re-checked with `rg`, which finds that call and one test's);
2. `commit_and_record` has one caller, `run_one_save`;
3. every route to `run_one_save` is one of the six writing planners, and each is reached only from
   the six `WorkspaceSession` methods that call `with_open`;
4. `with_open` takes the session mutex and holds the guard across its **whole** closure, which is
   where `run_one_save` — and therefore `after_a_save` and `conflict_after_the_lock` — runs.

So a record can only be *inserted* by a thread holding the session lock, and both refresh callers
hold it. Every record they can observe was written either by this thread earlier in this same call,
or by a previous holder that released the lock before this one acquired it; both give a
happens-before edge, so the record precedes the read in program order with no clock consulted.

**Two things the premise deliberately does not say**, because getting either wrong is how a premise
becomes the next round's finding:

- it is about **insertion**, not about mutation. `decide` *removes* records (supersession) from the
  watcher's worker thread, holding no session lock. That does not weaken the argument — a removal
  cannot make a record appear that was written later — and the two are serialized against each other
  by the commit gate regardless;
- it holds for **both** callers and was checked separately for each. `conflict_after_the_lock` runs
  in the same `with_open` closure after a `RevisionMismatch`; its transaction recorded nothing, so
  any record it meets belongs to an earlier save under an earlier acquisition of the same lock. Had
  the premise held for only one of the two, the fix would have applied to only one.

**The mechanism, and why it is this one.**

- **(a) Keep the stamp and accept equality on that path** (`read_after < recorded_at` refuses).
  Rejected. Under the premise, `recorded_at <= read_after` always holds, so the refusing arm is
  unreachable — a check whose predicate can never be true, dressed as a safety net. It would also
  still be a *value comparison* described as a proof, which is the exact class of sentence this
  record keeps having to correct.
- **(b) A caller-proven chronology mode, shared with `decide`. Adopted.** `decide`'s fourth operand
  becomes a private `ReadChronology` with two variants: `StampedBeforeTheRead(Instant)`, which
  compares, and `SerializedWithEveryRecord`, which does not. Everything else `decide` does is
  untouched and shared: the merged lookup, suppression, supersession, coalescing, sequence
  allocation and the tally.
- **(c) A second decision function for the save path.** Rejected on §2.6's own ground: *external
  rather than self* must not become two rules that agree today. This is also what the review asked
  for explicitly.
- **(d) Give the save path a retry of its own.** Rejected as the wrong layer and the wrong shape: a
  retry would re-read the file a second time to answer a question the session lock has already
  answered, and a second read is exactly the torn-read exposure §5 item 3 records.

**Why the mode is private, and why neither door takes it as an argument.** This is the round's own
design decision rather than the review's. A public mode parameter would be a caller-supplied licence
to skip a safety check, and the caller most able to skip it wrongly is the watcher's worker thread —
the one caller that can prove nothing. So `ReadChronology` is private, `WriteLedger::admit` can build
only the stamped variant, and `WriteLedger::admit_under_the_session_lock` only the serialized one:
*which proof of chronology an observation carries* is a property of the door it came through, and
there is no parameter through which to ask for the other. `decide` matches the mode exhaustively, so
a third proof is a compile error there rather than a silently skipped check.

**What the types still do not force**, said beside what they do: that a caller of
`admit_under_the_session_lock` really holds the session lock. This module owns no such lock and can
require no witness of one — `CommitGate` works because the gate is the ledger's own, and the session
mutex is not. Two callers and one paragraph in that method's documentation are what keep it, and §5
item 14 now carries it as its third half.

### 10.2 What changed, file by file

- **`src-tauri/src/ledger.rs`** — the private `ReadChronology` and its two variants; `decide` takes
  it instead of a bare `Instant` and matches it exhaustively before consulting the record;
  `admit_at_current_epoch` is renamed **`admit_under_the_session_lock`**, drops its `read_after`
  parameter and builds the serialized variant; `admit` is unchanged in signature and builds the
  stamped one. The module's *stamp* section gains a **two proofs** section that states the
  call-graph premise, and `Admission::PrecedesACommit`, `LedgerTally::preceded_a_commit` and the two
  entry points' docs are corrected to say that only the stamped door can reach that arm. The
  test-only `stamp_the_record_at` seam is new, and one module test with it;
- **`src-tauri/src/commands.rs`** — both `Instant::now()` lines are gone, both refreshes call
  `admit_under_the_session_lock`, and `std::time::Instant` is no longer imported by the module (it
  survives inside the test module, which still drives `admit`). The module header, `run_one_save`'s
  *the app-write record is taken here* section, `conflict_after_the_lock`'s *the refresh is
  external* section and `after_a_save`'s *a refresh that disagrees* section all name the new door
  and say why it takes no stamp. One new test;
- **`src-tauri/src/main.rs`** — the phase paragraph said a stamp rides **every** observation; it now
  says every *watcher* observation, and names the save path's proof and what a refusal there used to
  cost;
- **`crates/espansoconfig-core/src/watch/engine.rs`** — the Low, and a **doc comment only**. No core
  behaviour changed in this round.

### 10.3 Low — a rollback promises a fresh observation, not a replay

> **Correction (round-14 fix round, §20.4), on the heading directly above.** **The heading is blocked
> rather than rewritten**, as §2.6's was, because it names round 10's Low and four sections point at
> it — but read on its own it is round 14's **first High**: a rollback promises **no** observation at
> all. `ObservationEngine::revert_settlement` restores the state the settlement replaced and
> schedules a read; *"it schedules a read, so it emits nothing itself. The observation comes back out
> of a later `tick`, with whatever the file holds **then**"* is the primitive's own third bullet, and
> a path that never stabilizes is never answered. The heading's *promises* is a contrast with
> **replay** — the axis round 10's Low was about, *which* observation rather than *whether* one — and
> the body below says the true thing in its second sentence: *the rollback restores the base and
> schedules a **read***. Found by §20.4's name-position pass, at a **section heading**, which makes
> fourteen consecutive rounds with a name-position finding.

**What the finding was.** `revert_settlement`'s first paragraph said the re-hint *"produces the same
observation again"*, unconditionally, while its own third bullet said the observation comes back
*"with whatever the file holds then — which may no longer be the state that was refused"*. The
second is what the code does: the rollback restores the base and schedules a **read**. If another
process writes Q before the two retry reads, the engine emits `Changed { B → Q }`, which is correct
and is not the refused `Changed { B → P }`.

**Why it matters even though it is a Low.** It is this project's worst defect class in miniature — a
doc comment claiming a guarantee the code does not give — and no test can fail it: both tests that
cover the rollback hold the tree still across the retry, so they drive *the settlement was taken
back* and would pass under either reading of the sentence.

**What changed.** The guarantee is qualified in all three places the claim appeared: the
`revert_settlement` doc comment (which now says a fresh observation of whatever stabilizes, *and the
same one again only if the disk is unchanged*, with a note that the third bullet already said so),
§9.1's option (c) paragraph, and §9.5's evidence row, which now states that *nothing else writes to
this disk* is a property of those two tests rather than of the method. Option (c) stays rejected and
its reason is untouched: a requeue without a rollback emits an observation whose **shape** is a lie,
whatever the disk then holds.

### 10.4 The sweep for the shape, not for the words

Every round of this step has found a narrower instance of the previous round's finding, and rounds 3
and 4 each found one in the fix round's **own new code**. So this round asked its own change the
same question: *is there anywhere else a value is settled, installed, spent or consumed before the
decision that could reject it, or any other refusal arm with no recovery path?*

**One new candidate was found, and it is stated as a hole rather than closed** — §5 item 18. A
post-save refresh that **fails** admits nothing at all: `after_a_save` evicts the cache and answers
`moved: None`, `conflict_after_the_lock` returns the error. That is the same dependency on an
unguaranteed native hint that item 16 was just closed for, reached through an error arm instead of a
refusal arm. It is deliberately left open, because closing it is worse than leaving it: a
`Workspace::refresh` failure is **one** read, so publishing `Absent` or `Unreadable` from it would
publish a state that never stably existed **and clear the app-write record**, which is precisely
what makes a save's own hints foreign. The two-read stability that state needs is the engine's, and
the engine is where it should be produced.

The refusal arms reachable from the new door were enumerated rather than assumed:

- `PrecedesACommit` — now unreachable from it, which is the fix;
- `SelfWrite` and `Duplicate` — answers about these exact bytes; re-reading gives the same answer,
  and neither loses anything, because nothing changed relative to what was already published;
- `StaleEpoch` — not reachable here at all: there is no epoch check, because the session lock is the
  lock a workspace replacement takes to change the epoch;
- `SequenceSpaceExhausted` — **the same shape as the High and inherited, not closed.** It clears the
  record, publishes nothing, and the caller discards the answer, with no recovery on either door. It
  is terminal within its epoch by policy and unreachable in any physical execution (it needs `u64`
  sequences spent), §9.3's second bullet already licenses it, and skipping the chronology check
  neither widens nor narrows it.

Three candidates from §9.3 were re-checked against the new code rather than inherited, and all three
stand unchanged: `decide` still spends a sequence and publishes before any consumer exists (2d-4's);
`decide` still clears the record above the coalescing and exhaustion arms; and both refreshes still
install a fresh parse in the workspace cache before the admission decides — unconditional cache
coherence, not a consequence of the decision, so a refusal leaves nothing installed that should not
be.

**The `Instant` sweep, again, because the change removed two clock reads.** `rg 'Instant::now\(\)'
src-tauri/src` was re-run and every hit read. Production holds **three** clock reads and exactly
**two** of them are chronology stamps: `record_app_write`'s, on the line that inserts a record, and
`WatchWorker::observe`'s, on the line before the engine pass. The third is
`WatcherLifecycle`'s `origin`, the worker's monotonic base for the engine's `Millis` — it is never
compared against a record and is named here rather than left for the *exactly two* above to be
wrong about. `commands.rs` has **none**: the module-level `use std::time::Instant` was removed,
which is the compiler confirming the call sites are gone rather than a reviewer's claim that they
are. The rest are `watch_check`'s bounded-wait deadlines and the test helpers, plus the two new
tests, which ask for their collision from the record's side rather than racing the host clock.

### 10.5 What is guaranteed now, and what is not

**Guaranteed.** A *watcher* reading this session cannot place strictly after its own last committed
write to a path neither publishes nor clears that path's record, and is answered so the engine
re-observes it. A *save-path* refresh is never refused for chronology at all, because the session
lock it already holds orders it against every record that can exist; a disagreeing one is therefore
published, spends a sequence, and supersedes the record, whatever the host clock's resolution. Both
doors reach one `decide`, so suppression, supersession, coalescing and sequence allocation are one
rule with two callers. Only one door can build the stamped mode and only the other can build the
serialized one, and no caller of either can choose.

**Not guaranteed, and stated as such.** That a caller of `admit_under_the_session_lock` holds the
session lock (§5 item 14, third half). That a producer's stamp precedes its reads, and that a sink's
answer is acted on (§5 item 14, first two halves). That a *failed* post-save refresh is heard at all
(§5 item 18). That a rollback replays the state that was refused rather than reporting what the disk
then holds (§10.3 — and that is correct behaviour, not a gap). And everything §5's other items
already carried, unchanged by this round.

**Nothing from 2d-4 or later was added**: no Tauri event, no queue, no `drain_external_changes`, no
`#[tauri::command]`, no TypeScript, Svelte or i18n file, no writer, no force flag, no route around
`save_document`, and nothing new that serializes. One core file was touched and only in a doc
comment; `cargo tree -p espansoconfig-core | rg tauri` still finds nothing.

> **Correction (round-5 fix round, §11.5).** One line of the *not guaranteed* list above is out of
> date, and it is the one round 5 turned into its High: *that a failed post-save refresh is heard at
> all (§5 item 18)*. It **is** heard now — the path is handed to the running watcher and the state
> the engine stabilizes is admitted through the stamped door (§11.1) — subject to the two narrower
> residues that replace item 18, §5 items 19 and 20. Everything else in this section stands
> unchanged; this round altered no decision the ledger takes.

> **Correction (round-13 fix round, §19.4).** The **first** sentence of the *Guaranteed* paragraph
> above ends on a liveness claim this step never built — *"and is answered so the engine re-observes
> it"* — and it is a narrower instance of round 13's first High, found by §19.4's shape pass and not
> named by the reviewer. It sits under a **`**Guaranteed.**` name position**, which is what makes it
> worth a block of its own rather than a mention. What `admitting_sink` gives is
> `ObservationOutcome::Undecided`, and what `deliver` does with it is
> `ObservationEngine::revert_settlement`, which un-concludes the state and **re-owes the path**; a
> re-observation follows only if that path stabilizes again and this watcher's worker is still
> ticking, and §5 items 19 and 21 are the two standing statements that neither is forced. The
> guarantee that survives is the one the rest of the sentence already carries and is **safety, not
> liveness**: such a reading neither publishes nor clears the record, and the settlement is taken
> back rather than kept, so the state is left owed instead of consumed. The module doc this sentence
> describes now says exactly that (§19.1).

> **Correction (round-14 fix round, §20.2), on the round-13 block directly above.** That block closed
> the liveness overclaim and shipped a **debt** one in the same breath, twice: *"un-concludes the
> state and **re-owes the path**"* and *"the state is left owed instead of consumed"*.
> `revert_settlement` re-owes only where the settlement it takes back had discharged an
> `observe_owed` request; the settlement refused here is an ordinary **native hint's**, which owes
> nothing, so the plain `hint` arm runs and what is left is a **re-hinted** path, not an owed one.
> Read both sentences as *un-concludes the state and re-hints the path* and *the state is left
> un-concluded instead of consumed*. Nothing else in the block moves: the safety half it names —
> neither publishes nor clears the record — is exactly what round 14's reviewer cleared, and its
> liveness correction stands.

### 10.6 The evidence and the neuter runs

| Owed | Where |
|---|---|
| **a deterministic equality regression for `after_a_save`** | `commands.rs`'s `a_post_save_refresh_is_never_refused_when_no_clock_could_place_it_after_the_record` — the shared tail driven directly, a record taken in its own commit window, an external write, and the assertion that the differing refresh is published and supersedes. **A test cannot make the host clock collide on demand**, and since the fix this caller reads no clock to collide with, so the collision is asked for from the **record's** side through the test-only `WriteLedger::stamp_the_record_at`: the record's instant is put an hour ahead, which is a collision and worse. That is `a_reading_stamped_exactly_at_the_record_is_refused`'s technique taken from the other end |
| that the *door* decides it, not the ledger going soft | `ledger.rs`'s `a_serialized_door_reading_is_never_refused_by_the_records_own_instant` — one ledger, one path, one record stamped beyond every later clock read, asked through **both** entry points: the serialized one is `Admitted` and supersedes, and the stamped one, against a record stamped the same way, is still `PrecedesACommit` and still retains. **It proves the serialized door's implementation and not the premise that licenses it**, and the name said otherwise until §11.3: the test constructs a bare `WriteLedger`, owns no `WorkspaceSession` and locks nothing, so *the production callers of this door hold the session lock* rests on §10.1's call-graph audit **alone** and would stay green if a caller were moved outside `with_open` tomorrow |
| that suppression, supersession, coalescing and sequence allocation stayed shared | unchanged and still passing at the time: the whole of §3's table and §9.5's, over one `decide`. `a_conflict_against_this_apps_own_committed_bytes_is_marked_rather_than_suppressed` (named `…_is_suppressed` then) was the sharpest of them, because it is a save-path refresh that had to answer `SelfWrite`. **§13 unshared the sequence allocator and §14 unshared the suppression check, and that test's verdict is now `Marked`** — what stayed shared is one `decide`, one supersession step and one coalescing comparison |
| the lock order and the leaf property | unchanged: `admit_under_the_session_lock` takes gate → state and returns a value, exactly as before; `the_downstream_sink_runs_outside_the_ledger_lock` and `no_admission_can_decide_between_a_commit_and_its_record` still pass |
| that a caller of the serialized door holds the session lock | **nothing.** No test in this crate can fail it, and the row above says why the test that reads as though it did does not; §5 item 14's third half is the standing statement of it |

**Two neuter runs**, one per new guarantee, each disabling exactly one thing this round added and
then restored. Both were driven by the *same* single edit — `admit_under_the_session_lock` building
`ReadChronology::StampedBeforeTheRead(Instant::now())` instead of the serialized variant, which is
precisely the pre-fix behaviour:

- `ledger.rs`'s `a_serialized_door_reading_is_never_refused_by_the_records_own_instant` (named
  `a_session_locked_reading_…` when this run was taken; §11.3 renamed it, and its first assertion's
  message with it) failed at that first assertion — **`left: PrecedesACommit`,
  `right: Admitted { sequence: 1 }`**. **16 passed, 1 failed** of the 17 ledger tests,
  so the check is narrow;
- `commands.rs`'s `a_post_save_refresh_is_never_refused_when_no_clock_could_place_it_after_the_record`
  failed at the published-state assertion — **`left: None`, `right: Some(Content(…))`**, *"the
  differing refresh is queued as external whatever the clock says"* — which is round 4's High
  reproduced exactly: the external state gone, with the file written and the refresh performed.
  **72 passed, 1 failed** of the 73 command tests.

The edit was reverted and both suites re-run green before anything else was measured.

### 10.7 The two sweeps

**For the shape** — *a value settled, installed, spent or consumed before the decision that could
reject it, or a refusal arm with no recovery* — is §10.4, including the one new hole it found (§5
item 18) and the four refusal arms of the new door, enumerated.

**For name positions**, as a pass distinct from the prose:

- `docs/decisions/2d-3-notes.md` line 3 — the headline said *every observation carries a stamp* and
  claimed the whole property on three mechanisms; rewritten to four, with a fourth correction block
  beneath it;
- **§5 item 16 is replaced, not annotated**, because both of its claims about the cost were wrong —
  the same treatment §8 gave item 10 and §9 gave item 13, and the third time this step has had to
  give it;
- `WriteLedger::admit_at_current_epoch` — the **name itself** was a name position: it described what
  the door skips (the epoch tag) while the precondition that licenses the skip is the session lock,
  which now licenses a second one. It is `admit_under_the_session_lock`;
- `src-tauri/src/main.rs`'s phase paragraph claimed a **stamp** on every observation; it now says
  every *watcher* observation and names the other proof;
- `crate::ledger`'s module header listed `admit_at_current_epoch` in the lock-order bullet and, in
  its *stamp* section, said *every observation therefore carries `read_after`*; both corrected, and
  the *two proofs* section is new;
- `Admission::PrecedesACommit`'s doc did not say which door can answer it; it does now, and says why
  the other cannot;
- `LedgerTally::preceded_a_commit`'s doc said it *counts refusals, never losses* — true of what it
  can count today and **false when written**, because a save-path refusal was a loss and was counted
  here. The doc now says both;
- `commands.rs`'s module header and the two refresh functions' docs each carried the *stamped before
  their own read* sentence; all three corrected, which is the narrower-instance pattern the previous
  rounds predicted;
- `crates/espansoconfig-core/src/watch/engine.rs`'s `revert_settlement` promised *the same
  observation again*; qualified (§10.3);
- `docs/decisions/2d-1-notes.md` §2.1's round-2 correction block enumerated the fifth caller
  obligation as *place the observation's reads relative to the recorded write* and named one way to
  discharge it; a round-4 block beneath it names the second;
- **inspected and deliberately left standing**, so the next round does not rediscover them as
  misses: §8.1's heading *"…so every observation carries a stamp"*, and the historical descriptions
  in §1's built list, §7.1, §8.1 and §9.6 that name `admit_at_current_epoch`. Each is a record of
  what a **named earlier round** did, and each was true then; this file's convention is that such
  sections are corrected by a block rather than rewritten, and §8.1 already carries two of round 3's
  plus §8.7's round-4 one. The rule this round applied to decide between the two treatments: **a
  present-tense claim about how the code works now is amended in place or blocked; a past-tense
  record of what a round built is left alone.** That is why §2.1's leaf-mutex bullet, §2.6's first
  bullet and §5 item 12 were amended and these were not.

---

## 11. The round-5 fix round

`docs/reviews/phase-2d-3-ledger.md` round 5 returned **NOT READY** with one High and two Lows, and
it is the fifth consecutive round whose finding was produced by the previous round's fix. All three
are closed here. Two things the review settled in the fix's favour before finding anything, and they
are not re-argued below: the chronology premise was **re-derived independently and holds** — the
production call graph does serialize saves and refreshes, `conflict_after_the_lock` included — and
`ReadChronology` is genuinely private with no production caller able to select a variant. Lock
order, leaf mutexes, Tauri-freedom and the absence of 2d-4 scope creep were confirmed too.

The High lives in exactly the hole the round-4 fix round wrote down as honestly bounded — §5 item
18 — which is what item 10 did to §7 and item 16 did to §10. **That is now three, and three is a
pattern rather than a coincidence: every hole this record has stated as bounded and left open has
turned out to be a real defect, and in each case the item's own text named the reason it looked
bounded — an alternative it had considered and rejected.** The rule this round draws from it, and
applies to items 19 and 20 below: *a hole is bounded only if the enumeration of alternatives in it
is complete, and an enumeration written by the person who wants the hole to be bounded is not
evidence that it is.* Item 18 offered exactly one alternative, called it worse, and was right about
that one alternative and wrong about the hole.

The corrections this round owes the record itself are the fifth block under the headline (§1), four
additions to §1's built list and one to its wire-types sentence, an addition under §2.6, a
correction block under §2.7, the amendment of §5 item 14, the **replacement** of §5 item 18 by two
narrower items, the round-5 column in §6's table with a new count paragraph and a new scar
paragraph, a correction block under §10.5, and three amendments inside §10.6 — its renamed test's
evidence row, that row's neighbour naming the same door, and the neuter bullet that quotes the
assertion message the rename changed. **No correction is owed outside this record, and that
was checked rather than assumed**: `docs/decisions/2d-1-notes.md` §2.1's round-4 block says a caller
that can place its reads some other way owes no stamp, and names *2d-3's three callers* — this round
adds no caller of either door and removes none, so the block's count and its claim both stand.
`docs/decisions/2d-2-notes.md` §2.3's residue is likewise untouched, and §11.1 says why the fix does
not depend on it.

> **Correction (round-6 fix round, §12.3).** The last sentence of the paragraph above is false in
> one word, and it is round 6's first Low. *The block's count and its claim both stand* was
> **checked and wrong**: `2d-1-notes.md` §2.1's round-4 block said **one** of 2d-3's three callers
> could place its reads another way while naming **two** in the same sentence — the two save-path
> refreshes — so the count did not stand and this round's check of it recorded that it did. Round 5
> was right that its own change added no caller and removed none; what it got wrong was reading the
> block rather than counting it. The block is corrected in place at `2d-1-notes.md` §2.1, and the
> lesson is §12.5's: *a count in a document one is checking must be re-derived from what the
> document names, not read off the number the document gives.*

### 11.1 High — a read this application could not use is replaced, not published

**What the finding was.** The app commits revision A and records it; an external process removes the
file before `after_a_save` reads it; `Workspace::refresh` answers `NotFound`; `after_a_save` evicts
the cache, admits nothing, and returns `Saved`. The removal then enters the observation sequence only
if the native backend delivers a hint for it — and `docs/decisions/2d-2-notes.md` §2.3 expressly
declines to cover *a backend that stops delivering without reporting anything*. That is round 4's
exposure exactly, reached through an `Err` arm instead of through `PrecedesACommit`, and it
falsifies §1's *no external change is lost*.

**Why the record's own sentence was false, said plainly.** §5 item 18 said closing the hole *"would
be worse"*, and the sentence after it shows what it had in mind: publishing an `Absent` or
`Unreadable` from the single read that failed, which would put a state into the sequence that was
never proved stable **and clear the app-write record** — making the save's own hints foreign. Every
word of that is true, and none of it is an argument for leaving the hole open: it rules out **one**
alternative. The item's last sentence names the one it did not consider — *the engine's two-read
stability is what that state needs, and the engine is where it is produced* — and stops one step
short of asking the engine for it.

**The mechanism was checked for availability, lock safety and scope before anything was built on
it**, because round 2's fix produced round 3's finding by inheriting a premise:

1. **It exists and is reachable.** `WatcherLifecycle` already owns `control: Sender<WorkerMessage>`,
   the inbox the native callback forwards into. `Open` owns the `WatcherLifecycle`, and
   `WorkspaceSession::with_open` destructures `Open` — so the save path can be handed a borrow of it
   beside the two records it already gets, disjointly from the `&mut Workspace`.
2. **It cannot violate the lock order.** The inbox is `std::sync::mpsc::channel()` — **unbounded**,
   never `sync_channel` — so `Sender::send` allocates and links a node and returns; it never waits
   for the receiver to consume anything. That was the hazard to check, because the save path holds
   the **session** lock and the worker is allowed to take that same lock inside its sink callback: a
   bounded channel or a blocking send would have been precisely session → (wait for worker) →
   (worker waits for session). The channel's own internal lock is never held by the worker across a
   sink call — the worker holds it only inside `recv_timeout`/`try_recv` — so there is no cycle
   through it either. Lock order stays **session → gate → state**, and nothing new is taken under a
   ledger guard.
3. **A workspace with no watcher degrades cleanly.** `WatcherLifecycle::stationary` drops its
   receiver at construction, and a worker that could not be spawned or has already exited has none
   either, so the send fails and is answered `ReObserveOutcome::NoWatcher` — never a panic, never an
   error, and never something a save's result depends on. `WorkspaceSession::unwatched`'s test
   sessions take exactly that arm.
4. **It is 2d-3's and not 2d-4's.** Consult Q3's wire is `workspace://reconciliation-ready` plus
   `drain_external_changes`; this adds no event, no queue, no command, no wire type and nothing
   serializable, and carries a path **into** the engine rather than an observation out of it. It is
   the same reasoning `hand_to_reaper`'s channel already carries in `crate::watch`. What it closes
   is Q7 item 3's own subject — *post-commit external replacement is not suppressed* — so leaving it
   for 2d-4 would ship this step with its headline false.

**The mechanism, and why it is this one.**

- **(a) Publish the failed read directly.** Rejected, and it is what §5 item 18 rejected: one read
  that did not complete proves no state, publishing `Absent` from it would clear the record, and the
  next hint at the real state would coalesce against a state that never existed.
- **(b) Retry the read here.** Rejected on §10.1 option (d)'s ground and one more: a second single
  read is still a single read, and the torn-read exposure §5 item 3 records is exactly what two
  reads exist to close.
- **(c) A third `ReadChronology` — *"no reading, take my word"*.** Rejected as the shape this whole
  step keeps correcting: a door that admits a state nobody read.
- **(d) Ask the running watcher to observe the path again. Adopted.**
  `crate::watch::ReObserver::re_observe(path)` puts one `WorkerMessage::ReObserve(path)` on the
  worker's inbox; the worker absorbs it through `WatchWorker::hint_paths`, which is the code a
  native hint already goes through; the engine debounces, reads twice, and settles; and `deliver`
  hands the result to the same `admitting_sink` through the same **stamped** door. Nothing about the
  ledger, the two doors or `decide` changes at all.

**Three arms take it, and the third is the one the review did not name** — §11.4 is the sweep that
found it. `after_a_save`'s failed refresh and `conflict_after_the_lock`'s failed refresh are the
review's two; `after_an_uncertain_write` is the third, reached when
`SaveError::may_have_written()` is true. That arm reads nothing at all: the rename may have landed
and the revision it landed is unknown, so `committed_revision` records nothing — deliberately,
because a guess would suppress a real observation. *Recording nothing is the safe direction* is only
true if something eventually observes what the file holds, and until this round nothing on that arm
did; it evicted the cache and returned.

**Why this does not depend on the residue it closes.** A re-observation is a hint into the
**engine's** pending table, not a request to the native backend, so it reaches the two-read pipeline
whether or not FSEvents is delivering anything. That is the whole reason it answers §2.3 where item
18's *"the watcher's own hints"* did not.

**What it cannot do, said beside what it does.** It cannot make a save wait, and it cannot make one
fail: the send does not block, and all three call sites bind the answer and act on none of it,
because *a committed write is never afterwards reported as an error*. It cannot reach a workspace
with no running watcher (§5 item 19), and it is dropped while a worker's baseline is still failing
or if the worker stops before its next tick (§5 item 20). And it claims nothing about **what** will
be observed: a path whose bytes have not changed since the engine last settled it coalesces to
nothing inside the engine, which is correct — there is no external change to report.

### 11.2 What changed, file by file

- **`src-tauri/src/watch.rs`** — `WorkerMessage::ReObserve(PathBuf)` and its `Debug` arm;
  `ReObserveOutcome` (`Asked` / `NoWatcher`) and `ReObserver`, a `Copy` handle holding
  `&Sender<WorkerMessage>` and exposing one method, deliberately narrower than `WatcherLifecycle`
  so a save cannot shut a watcher down or read its status; `WatcherLifecycle::re_observer`;
  `WatchWorker::hint_paths`, **extracted** from `absorb` so that a re-observation and a native hint
  are one code path rather than two spellings; the two loop arms and the `baseline` arm that absorb
  the new message; a module section, *a save may ask for one path to be observed again*, carrying
  the unbounded-channel argument; and the test-only `WatcherLifecycle::listening`/`HintInbox` seam.
  One test;
- **`src-tauri/src/commands.rs`** — `SaveRecords` renamed **`SessionSideOfASave`** and given a third
  field, `watcher: ReObserver<'a>`, which `with_open` fills from `Open`'s own lifecycle; the new
  `ObservationSide { ledger, watcher }` that the two tails take in place of a bare `&WriteLedger`,
  narrower than the whole value because a `BackupSession` in the reach of a post-transaction
  function would be a pre-save copy taken after the save; `after_an_uncertain_write`, which takes
  the watcher **alone** because there is nothing that arm may say to the ledger; the ask on all
  three arms; and the module header, `run_one_save`, `after_a_save` and `conflict_after_the_lock`
  documented for it. Three tests;
- **`src-tauri/src/ledger.rs`** — **no production code**. The *what the types do not force*
  paragraph is corrected (round 5's first Low), a new section says a read the save path could not
  use is re-observed rather than published, and
  `a_session_locked_reading_is_never_refused_by_the_records_own_instant` is renamed
  `a_serialized_door_reading_…` and now states what it does **not** prove (round 5's second Low).
  One test;
- **`src-tauri/src/main.rs`** — the phase paragraph's **three** things became five, and the fifth is
  described (round 5's first Low, second half);
- **`crates/espansoconfig-core/`** — **untouched.** The engine learns nothing about saves, ledgers or
  application sessions from this round, and the mechanism is deliberately in `crate::watch` for that
  reason: *ask this path to be read again* is a fact about a running watcher, and the engine already
  has the verb for it.

### 11.3 The two Lows

**Low 1 — documentation describing a save-path stamp that has not existed since §10.**
`ledger.rs`'s module header still said *"the two save path callers take theirs on the line above
their `Workspace::refresh`"*, §5 item 14 said the same, and `main.rs` still counted **three**
mechanisms where §10 had made four. The failure it invites is concrete and is round 4 again: a
maintainer following the module contract restores stamped save-path admission, an external write is
read after a record whose adjacent stamp collides with it, and the reading is refused with nothing
to answer the refusal. All three are corrected — the module header now says there is exactly **one**
producer of a stamp and that neither save-path caller stamps; item 14 quotes its own wrong clause
rather than quietly deleting it; and `main.rs` says **five**, because this round's own fact makes
four into five.

**Low 2 — a test named for a premise it does not exercise.**
`a_session_locked_reading_is_never_refused_by_the_records_own_instant` constructs a bare
`WriteLedger` and never owns or locks a `WorkspaceSession`, so what it proves is the **serialized
door's implementation**: that this door consults no clock. It is renamed
`a_serialized_door_reading_is_never_refused_by_the_records_own_instant`, its first assertion's
message no longer says *"placed by the lock it already holds"*, and both the test and §10.6's
evidence row now say in the same sentence as what they do prove that **the production lock premise
rests on §10.1's call-graph audit alone** and would survive a caller being moved outside
`with_open`. §5 item 14's third half is unchanged and is the standing statement of it; a
session-level witness is what would close it, and none was added.

### 11.4 The sweep for the shape, not for the words

The question, asked of this round's own change as every round before it has: *is there anywhere else
a value is settled, installed, spent or consumed before the decision that could reject it, or any
other path where an external change can be observed and then dropped with no recovery?*

**Every early return and every `Err` arm of the save path was enumerated, and what each costs:**

- `run_one_save`'s `workspace.document_context(document)?` — before the transaction. Nothing was
  written and nothing was read of the file's content, so there is no reading to drop and no
  disturbance to observe. **Costs nothing;**
- `Err(SaveError::Refused(_))` — the semantic gate declined and nothing was written. Same answer,
  and the same for every `Err` whose `may_have_written()` is false. **Costs nothing** — and note
  what makes that different from the arms below: this application neither disturbed the file nor
  holds a reading of it, so the watcher's coverage of it is exactly the coverage of a file nobody
  saved;
- `Err(_) if may_have_written()` — **the one the review did not name, and this sweep's find.** The
  rename may have landed, nothing is recorded, and until this round nothing observed the result.
  Now `after_an_uncertain_write` asks. It publishes nothing and records nothing, which is unchanged
  and required: the committed revision is unknown, and a guess would suppress a real observation;
- `after_a_save`'s `Err` from `refresh` — the review's first arm. Asks; publishes nothing; **does
  not clear the record**, which the test asserts directly, because clearing it is what would make
  this save's own hints foreign;
- `after_a_save`'s `Ok` arm where the revision **agrees** with the transaction's — either this
  save's own bytes, already recorded and suppressed by that record, or a skipped commit where the
  file holds what the caller already had. **Costs nothing**, and asking here would be noise: the
  state is known;
- `after_a_save`'s `Ok` arm where it **disagrees** — admitted, unchanged since §10;
- `conflict_after_the_lock`'s `Err` from `refresh` — the review's second arm. Asks; returns the
  read's own error, unchanged, because a file that cannot be re-read has no disk side to describe;
  publishes nothing and invents no record, and a conflict records none in the first place;
- `conflict_after_the_lock`'s success — admitted, unchanged since §10.

**The refusal arms of both doors were re-checked against the new code rather than inherited**, and
§10.4's four still stand exactly as it left them: `PrecedesACommit` unreachable from the serialized
door, `SelfWrite` and `Duplicate` answers about these exact bytes, `StaleEpoch` unreachable there,
and `SequenceSpaceExhausted` the same inherited shape. This round adds no arm to either door. The
three §9.3 candidates §10.4 re-checked were re-checked again and stand: `decide` still spends a
sequence and publishes before any consumer exists (2d-4's), still clears the record above the
coalescing and exhaustion arms, and both refreshes still install a fresh parse in the workspace
cache before the admission decides — unconditional cache coherence, so a refusal, and now a
failure, leaves nothing installed that should not be.

**The new code was asked the same question.** `re_observe` consumes nothing and spends nothing: the
send either reaches the inbox or does not, and its answer is a report rather than a permit, so the
three call sites binding and ignoring it are not a check-and-spend. The re-hint cannot race a
settlement, because **only the worker thread touches the engine** — a message sits in the channel
until the top of the next loop turn, so it can neither land between `tick` and `deliver` nor
interleave inside a pass. It *can* restart the debounce of a path already probing, discarding that
path's first read; that is `ObservationEngine::hint`'s documented behaviour for every hint, the path
stays pending, and a starvation would need re-observations faster than one debounce plus one probe
forever, where each one costs a user a save. `HintInbox::re_observations` drains, which the
`watch.rs` test pins by reading it twice.

**One candidate outside the save path was considered and deliberately not taken.**
`WorkspaceSession::reload` — and `document`, and `text` — also reads the file and can discover bytes
this session had not seen, and tells the ledger nothing. It is **not** the same shape, and the
difference is the one §2.6 draws: those callers reach `with_workspace`, hold no `SaveRecords`
successor, take no record and disturb no file, so they have no reading they *could not* use and no
write of their own to place. Nothing about them is suppressed by a record either, so the watcher's
ordinary coverage of those paths is exactly what it is for a file nobody saved. Extending the ask to
every read command would make every projection a watcher request and would decide, here, questions
consult Q4 and Q5 place in 2d-5. Written down so the next round does not have to rediscover the
reasoning.

**Two new residues came out of it and are written down as §5 items 19 and 20** rather than smoothed
over: a workspace with no running watcher hears nothing, and a re-observation can be dropped by a
worker still failing its baseline or stopping before its next tick. Per this section's opening rule,
neither is claimed to be bounded by an enumeration of alternatives; both are claimed to be *the
coverage that workspace already had*, which is a different and checkable statement.

### 11.5 What is guaranteed now, and what is not

**Guaranteed.** Everything §10.5 guaranteed, unchanged — this round altered no decision the ledger
takes. Added: a save-path read that **fails**, and a write whose outcome is unknown, publish nothing
and clear nothing; each hands its path to the running watcher; and the state that then enters the
observation sequence for that path is one the engine read **twice** and admitted through the stamped
door. The ask cannot fail a save, cannot make one wait, and cannot change what any of the three arms
returns.

**Not guaranteed, and stated as such.** That a watcher is running to hear the ask (§5 item 19). That
a re-observation survives a failing baseline or an imminent workspace replacement (§5 item 20). That
a caller of `admit_under_the_session_lock` holds the session lock (§5 item 14, third half) — and
now, explicitly, that the test named for it does not prove it (§11.3). That a producer's stamp
precedes its reads, and that a sink's answer is acted on (§5 item 14, first two halves). And
everything §5's other items already carried, unchanged by this round.

**Nothing from 2d-4 or later was added**: no Tauri event, no queue, no `drain_external_changes`, no
`#[tauri::command]`, no TypeScript, Svelte or i18n file, no writer, no force flag, no route around
`save_document`, and nothing new that serializes. **No core file was touched at all**;
`cargo tree -p espansoconfig-core | rg tauri` still finds nothing.

> **Correction (round-6 fix round, §12.6).** Two lines of this section are out of date, and the
> first is what round 6 turned into its first High. *That a re-observation survives a failing
> baseline or an imminent workspace replacement (§5 item 20)* is two claims, and only the second is
> still ungiven: a re-observation **does** survive a failing baseline now, retained by
> `WatchWorker::baseline` and handed to the engine it finally opens as an owed observation (§12.1);
> the replacement half is kept and is §5 item 21. And the *guaranteed* paragraph's last sentence —
> *the state that then enters the observation sequence for that path is one the engine read twice*
> — was true of the three arms this round gave, and false of the two arms it did not touch, where a
> **single** save-path read was published and nothing asked for anything more (§12.2, round 6's
> second High). Both admitting arms ask now, so that sentence is true of all five, at the cost of
> the phantom's own sequence, which §5 item 3 carries. Everything else in this section stands.

### 11.6 The evidence and the neuter runs

| Owed | Where |
|---|---|
| that a failed post-save refresh **asks**, and publishes and clears nothing | `commands.rs`'s `a_failed_post_save_refresh_asks_for_a_re_observation_and_publishes_nothing` — the review's scenario driven directly: a record taken in its own commit window, the file removed, the tail run, and then four assertions — the inbox holds that one path, `published_state` is `None`, the record still names the committed revision, and the whole `LedgerTally` is still zero |
| that a failed conflict refresh asks, and still refuses | `commands.rs`'s `a_failed_conflict_refresh_asks_for_a_re_observation_and_still_refuses` — the error comes back unchanged (`io`), the inbox holds the path, nothing is published, and no record is invented |
| that an uncertain write asks | `commands.rs`'s `an_uncertain_write_evicts_the_parse_and_asks_for_a_re_observation` — the arm the review did not name, driven through the extracted `after_an_uncertain_write` |
| that the ask **reaches** a running watcher, and degrades where there is none | `watch.rs`'s `a_re_observation_reaches_a_listening_watcher_and_degrades_without_one` — two requests arrive in order as paths and nothing else, the inbox drains, and both stationary shapes (`inert`, `without_epoch`) answer `NoWatcher` without panicking |
| that what the ask produces is **stabilized** and then admitted | `ledger.rs`'s `a_removal_the_save_path_could_not_read_is_stabilized_and_admitted` — one real temp tree, one real engine with an injected clock, the real `admitting_sink` and the real `crate::watch::deliver`: the record stands after the failed read, **one** read settles nothing, the second settles `Absent`, the stamped door admits it, and only then is the record superseded |
| that the ledger's decisions are unchanged | nothing new was needed and nothing was weakened: §3's table, §9.5's, §10.6's and the whole of `ledger::` still pass over one `decide`, which this round did not touch |
| that a **running worker** turns the message into a hint | **partly.** `hint_paths` is shared with the native-hint arm that `watch_check`'s eight-cell matrix exercises on a real filesystem, and the loop arm that calls it is one line — but no test drives `WorkerMessage::ReObserve` through a spawned worker. Adding one would put a real FSEvents session in `watch_check`; it is stated here instead of claimed |
| that the production save path always has a watcher to ask | **nothing**, and §5 item 19 is the standing statement of it |

**Four neuter runs**, one per call site the round added plus one for the mechanism itself, each
disabling exactly one thing and then restored:

- `after_a_save`'s ask removed —
  `a_failed_post_save_refresh_asks_for_a_re_observation_and_publishes_nothing` failed at the inbox
  assertion, **`left: []`, `right: ["…/match/base.yml"]`**, *"the path this application could not
  read is handed to the watcher"*. **75 passed, 1 failed** of the 76 command tests;
- `conflict_after_the_lock`'s ask removed —
  `a_failed_conflict_refresh_asks_for_a_re_observation_and_still_refuses` failed at the same
  assertion, **`left: []`, `right: ["…/match/base.yml"]`**, *"and the path is handed to the watcher
  rather than left to a hint nobody promised"*. **75 passed, 1 failed** of 76;
- `after_an_uncertain_write`'s ask removed —
  `an_uncertain_write_evicts_the_parse_and_asks_for_a_re_observation` failed at
  **`left: []`, `right: ["…/match/base.yml"]`**, *"the file this save may have written is observed
  again rather than assumed"*. **75 passed, 1 failed** of 76 — and note that all three failures are
  narrow: no other test in the module notices, which is what makes them checks rather than
  couplings;
- the send inside `ReObserver::re_observe` removed, so the method answers `NoWatcher`
  unconditionally — `a_re_observation_reaches_a_listening_watcher_and_degrades_without_one` failed
  at its first assertion, **`left: NoWatcher`, `right: Asked`**. **4 passed, 1 failed** of the 5
  `watch` module tests.

Each edit was reverted and the affected suite re-run green before the next was made, and both suites
were green again before the gates in §6 were taken.

**One guarantee is deliberately **not** neutered**, and saying so is the point: `ledger.rs`'s
`a_removal_the_save_path_could_not_read_is_stabilized_and_admitted` drives machinery this round did
not build — the engine's two reads, `deliver`, and the stamped door — so there is nothing new in it
to disable. It is evidence that the mechanism this round chose lands where it claims, not evidence
of a new guarantee.

### 11.7 The two sweeps

**For the shape** — *a value settled, installed, spent or consumed before the decision that could
reject it, or a refusal arm with no recovery* — is §11.4, including the third arm it found that the
review did not name, the full enumeration of both refreshes' early returns and `Err` arms with what
each costs, and the two new residues (§5 items 19 and 20).

**For name positions**, as a pass distinct from the prose — and **redone from the current code
rather than from round 4's list**, because both of round 5's Lows are misses by that list:

- `src-tauri/src/ledger.rs`'s module header — *"the two save path callers take theirs on the line
  above their `Workspace::refresh`"*, describing a stamp removed at §10. Corrected, and the
  corrected sentence names the single producer rather than counting callers, so a future caller
  cannot make it stale by arriving;
- `src-tauri/src/main.rs`'s phase paragraph — **Three** where §10 had made it four. Now five;
- `docs/decisions/2d-3-notes.md` §5 item 14 — the same stale clause, quoted rather than deleted so
  the correction is visible;
- **`SaveRecords` — the name itself was a name position.** It said *records*, and the round's fix
  gives it a third field that is a handle, not a record. Renamed `SessionSideOfASave`, with §2.7's
  present-tense sentence blocked rather than left standing;
- `ledger.rs`'s `a_session_locked_reading_is_never_refused_by_the_records_own_instant` — a **test
  name** as a name position, claiming a premise the test does not exercise. Renamed, its assertion
  message corrected, and §10.6's evidence row and neuter bullet updated with it;
- `docs/decisions/2d-3-notes.md` line 3 — the headline said *four facts*; five, with a fifth
  correction block beneath it;
- **§5 item 18 is replaced, not annotated**, because its conclusion was wrong — the same treatment
  §8 gave item 10 and §10 gave item 16, and the third time this step has had to give it;
- `src-tauri/src/commands.rs`'s module header — *"this module composes with two other things that
  do"*, which enumerated the commit gate and the stamp while a third, the session lock, sat in the
  same paragraph as a qualification of the stamp rather than as a mechanism of its own. With this
  round's fourth it now says **four** and names all four in the same sentence, so the count and the
  enumeration cannot drift apart again;
- **searched and found current**, so the next round does not re-find them as misses: *"the two
  save-path refreshes"* wherever it appears (§1, §2.6's heading, §5 item 3, `main.rs`,
  `commands.rs`, `ledger.rs`) — there are still exactly **two** refreshes, and the third arm this
  round added performs none, so the phrase is not stale anywhere; `admit_at_current_epoch` in §1's
  built list, §7.1, §8.1, §9.6 and §5 item 12, each a past-tense record of what a named round did;
  §8.1's *"…so every observation carries a stamp"* heading and its `Instant::now()`-on-the-line-above
  bullet, both inside a *what changed* section §8.7's round-4 block already corrects; and §2.6's
  §8-era stamping paragraph, whose round-4 block already says *neither caller stamps now*. The rule
  applied is §10.7's, unchanged: **a present-tense claim about how the code works now is amended in
  place or blocked; a past-tense record of what a round built is left alone.**

---

## 12. The round-6 fix round

`docs/reviews/phase-2d-3-ledger.md` round 6 returned **NOT READY** with two Highs and two Lows, and
it is the sixth consecutive round whose finding was produced by the previous round's fix. All four
are closed here. Three things the review settled in the fix's favour before finding anything, and
they are not re-argued below: the unbounded-channel and channel-lock arguments, `NoWatcher`
behaviour and shutdown/epoch serialization all hold; `after_an_uncertain_write` and the three
round-5 call sites are sound; and the private, exhaustive chronology proofs, the gate table and the
absence of any 2d-4 wire or frontend scope creep were confirmed again.

**Both Highs live inside items of §5 this record had already judged and dismissed** — item 20
("bounded by an epoch reset") and item 3 ("not new exposure"). That makes **five** of that section's
items found to be real defects after being written as honestly bounded: 10 (round 2), 16 (round 4),
18 (round 5), and 20 and 3 now. §11's opening rule — *a hole is bounded only if the enumeration of
alternatives in it is complete, and an enumeration written by the person who wants the hole to be
bounded is not evidence that it is* — was right and was not enough, because neither of this round's
Highs is an incomplete enumeration. Item 20 gave a **reason** that is simply false of the case it
covers (`begin_epoch` discards nothing when no replacement happens), and item 3 gave a **ruling**
that does not follow from its own true premise (a payload is shown once; a published state
persists). So the rule this round adds, and applies to items 19, 21 and 22 below: *check the
sentence that makes a hole look bounded against the code that would have to make it true, in the
same pass that writes it.* Both of these would have failed that check on the day they were written.

The corrections this round owes the record itself are the sixth block under the headline (§1), five
amendments to §1's built list and one to its wire-types sentence, a correction of §1's core-crate
paragraph, a block under §2.6, the **replacement** of §5 items 3 and 20, amendments to §5 items 6,
8, 13, 14, 17, 18 and 19, two new items 21 and 22, the round-6 column in §6's table with a new count
paragraph, a block under §11's *no correction is owed outside this record* paragraph, and a block
under §11.5, whose *not guaranteed* list named a failing baseline in the same breath as a workspace
replacement and whose *guaranteed* paragraph was true of three arms and false of two. **One
correction is owed outside this record and is taken**: `docs/decisions/2d-1-notes.md` §2.1's round-4
block said **one** where it named two (§12.3), and a second block there records the sixth caller
obligation the engine's new primitive discharges.

### 12.1 High 1 — a request the worker could take and drop, and a hint that could be answered by silence

**What the finding was.** A worker whose baseline enumeration is failing accepts a `ReObserve` as
`Asked` and then deliberately discards it. The application commits revision A and records it; an
external process removes the document before the save's refresh; the refresh fails and asks the
watcher — and the baseline retry arm consumes the message and drops it. The baseline later succeeds,
but it cannot enumerate a path that is not there, so `ObservationEngine::start` establishes nothing
for it and emits nothing; the permitted native-hint miss (`2d-2-notes.md` §2.3) leaves the removal
unsequenced; and record A goes on suppressing a genuine later recreation of exactly those bytes.

**Why the record's own sentences were false, said plainly.** §5 item 20 gave two reasons and a
bound, and all three fail:

- *"there is no engine to hint yet"* — true, and not a reason to drop the **request**. A request can
  be held until there is one. Nothing about the arm required the drop; §11 wrote it as its own arm
  precisely so the choice would be visible, and the choice was wrong;
- *"the baseline that eventually starts one reads every path"* — true, and it answers nothing,
  because a baseline **establishes** rather than observes. `ObservationEngine::start`'s own
  documentation says so in the first line of its contract: *the baseline is the caller's opening
  state, not an observation*;
- *"both are bounded by the same fact — `begin_epoch` discards the whole ledger on replacement"* —
  **false of this half.** No replacement happens. The workspace stays open, the epoch does not
  change, and the record stays exactly where the save left it. The bound belonged to the item's
  *other* half, where a replacement really is under way, and it was carried across a sentence to a
  case it does not cover. That is the whole defect, and it is one sentence long.

**The mechanism was checked for scope and for sufficiency before anything was built on it**, because
round 2's fix produced round 3's finding by inheriting a premise:

1. **Retention alone is not sufficient, and this was the round's own find.** The review asks for the
   requests to be retained and then "forced through a path capable of emitting an owed
   removal/unreadable state". Replaying them as ordinary **hints** is not such a path, and it is not
   only the absence case: a hint at a path the baseline has just *established* stabilizes to that
   established state and coalesces to nothing, so a request about a file whose bytes an external
   writer had already replaced would also be answered by silence, with the app-write record left
   standing over bytes the file no longer holds. Ordinary coalescing answers *has anything changed
   since I last told you*, and every caller of `re_observe` has been told nothing.
2. **It is therefore the engine's to fix, and the fix is ledger-free.**
   `ObservationEngine::observe_owed(path, now)` records a **debt** beside the hint: the next
   settlement of that path emits the state it stabilized to even when that state is the one the
   engine already tracks and even when it tracks none. No save, no ledger and no application session
   enters the module — the call says *the caller could not use what it read; tell it what this path
   holds*, which is a fact about a directory in exactly the way `revert_settlement`'s *the caller
   could not use that conclusion* is.
3. **The two new emitted shapes are honest and are documented as such.** An absence with nothing
   tracked is `Removed { previous_revision: None }` — the same field saying the same thing it always
   says, *no content was ever stably read here* — and an unchanged present state is a `Changed`
   whose `previous_revision` equals the new revision, which the variant already sanctioned for the
   unreadable-recovery case and now sanctions for this one. Both put the equality on the value's
   face, so a consumer can see that nothing changed rather than being told that something did.
4. **It is 2d-3's and not 2d-4's**, on §11.1 item 4's reasoning unchanged: no event, no queue, no
   command, no wire type and nothing serializable; a path goes *into* the engine and every value
   that comes back out is the engine's own.
5. **Every application-origin request is owed, not only the retained ones.** A rule with an
   exception is a rule that drifts, and this particular exception would have been wrong anyway: a
   request that reaches the loop rather than the baseline arm meets exactly the same
   established-but-unannounced state, because a *successful* baseline establishes too. The narrower
   fix would have closed the arm the review named and left its twin one line away.

**What it cannot do, said beside what it does.** It cannot reach a workspace with no running watcher
(§5 item 19), and it cannot survive a worker that stops before its next tick or an engine dropped
with it (§5 item 21) — that half of the old item 20 is kept, because its bounding argument is the
true one. It answers nothing for a path that never stabilizes, and nothing for a path this engine
does not watch (§5 item 6). And it claims nothing about *which* caller an answer belongs to: a debt
is per path (§5 item 14's fourth half).

### 12.2 High 2 — a single read is published, and a stabilized one is asked for beside it

**What the finding was.** Both *successful* save-tail refreshes publish and coalesce a **one-read**
state into the ledger. The application commits A; a foreign non-atomic write toward Q is in
progress; the single refresh reads a parseable intermediate P; `admit_under_the_session_lock` clears
A and publishes P; the writer finishes Q; the healthy backend permissibly misses that hint; and **no
re-observation is requested because the refresh succeeded**, so the phantom P remains as the last
word on that path and Q never enters the sequence. §5 item 3's *not new exposure* ruling is what
licensed it.

**Why the record's own sentence was false, said plainly.** Item 3's premise was always right — a
`Workspace::refresh` is one read where the engine takes two. Its ruling — *"it is the same read that
builds the conflict payload, so the exposure is not new"* — does not follow from it. A payload is
shown once and is replaced by the person's next action; a **published state** persists in the
coalescing map, spends a sequence, and is what a consumer acting on the highest sequence takes. Those
are different lifetimes, and the item compared them as if they were one.

**Where this round deviates from the review's suggested fix, and why.** The review's minimal fix is
*"keep the immediate read only for cache/conflict payload construction, and route any ledger
mutation/publication through the engine's two-read stabilization path."* The first half is adopted
in substance and **the second half is not**, deliberately and with the reason stated rather than
silently:

- consult **Q2** rules that `conflict_after_the_lock` *publishes/coalesces that external observation
  under the same sequence allocator*, and that a differing post-save refresh *is queued as
  external*. Both are explicit instructions to publish from the save path;
- consult **Q5** rules that *a save-origin conflict registered by `conflict_after_the_lock` wins over
  a native duplicate at the same document/revision because it has the locked refusal fact and
  operation-specific reapply evidence; the duplicate is coalesced.* Removing the publication removes
  exactly the entry that makes that duplicate coalesce, so the native hint at the state the person is
  already looking at would be admitted as a **second** report of it — at 2d-5, a watcher-origin
  conflict raised on top of the save-origin conflict already on screen;
- and the brief's own constraint binds: the record must be *cleared or retained correctly in the
  window before the engine's stabilized observation arrives*. Withholding the publication would
  leave the window with neither the phantom nor the truth, which is round 3's swallowed-change
  defect reached from the other side.

**So the fix is publish *and* ask**, which takes the finding's true half and leaves the consult's
rulings intact. Both admitting arms keep their publication and then call
`crate::watch::ReObserver::re_observe` for the same path, as an owed observation. What the engine's
two reads settle on is admitted at a **later** sequence and supersedes the phantom, or coalesces
into a publication that was right all along. Consult **Q3**'s rule — *for each document the frontend
acts only on the highest sequence it has accepted* — is what makes the earlier value harmless, and it
is a rule 2d-4 and 2d-5 must keep rather than one this step can enforce; §5 item 3's replacement says
so.

**The owed half is load-bearing here too, and the sharpest ordering shows why.** The commit gate
serializes *decisions*, not reads, so the worker can admit the writer's final state Q **before** the
save tail publishes its earlier reading P. The engine then tracks Q while the ledger's last word is
P, and an ordinary re-hint would stabilize to Q, coalesce inside the engine, and emit nothing — the
phantom published forever. `ledger.rs`'s
`a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` drives exactly that
sequence.

**The one arm that deliberately does not ask** is `after_a_save`'s *agreeing* refresh. It publishes
nothing, clears nothing, and read exactly the revision the transaction established: there is no
reading it could not act on and no state it put anywhere, so what it leaves is the ordinary coverage
of a file after any write, which is the watcher's. §12.5 enumerates that with the rest.

> **Correction (round-7 fix round, §13).** **The *ask* half of this section stands and the
> *publish* half is gone**, and saying which is which is the point of this block. Round 6's remedy
> was *"keep the immediate read only for cache/conflict payload construction, and route any ledger
> mutation/publication through the engine's two-read stabilization path"*; §12.2 above adopted the
> first half and rejected the second **deliberately**, on the three reasons it lists. Round 7
> judged the rejection wrong, and the owner ruled the remedy adopted.
>
> Of the three reasons, **the third was simply a misreading**: consult Q3's *for each document the
> frontend acts only on the highest sequence it has accepted* forbids a consumer regressing to an
> older sequence and obliges none to wait for a later one, so a drain landing between the phantom
> at *n* and the truth at *n+1* accepts the phantom and a person who confirms *Reload* against it
> loses a draft nothing can give back. **The first two were about the wrong mechanism rather than
> wrong in themselves**, and §13 keeps what they protect: consult Q2's *published/coalesces that
> external observation* and Q5's *the duplicate is coalesced* are both about **coalescing**, and a
> coalescing entry needs no sequence. So the conflict tail keeps its entry as a **marker** and the
> duplicate still coalesces; nothing is left with neither the phantom nor the truth, because the
> owed observation this section added is what publishes.
>
> **One thing this section did not consider at all**, and §13.1 is where it is worked out: the two
> arms are not symmetric. Q5's coalescing is scoped, in the consult's own words, to a conflict
> *registered by `conflict_after_the_lock`*, and `after_a_save`'s disagreeing refresh registers no
> conflict and shows its state to nobody — so a marker there would swallow the engine's own
> stabilized reading of the same state, which is round 3's defect from the other side. That tail
> withholds instead.
>
> The **ordering** paragraph above — the worker admitting Q before the tail decides on P — is
> unchanged and is still what makes the owed request load-bearing; what changes is that the tail's
> P is a marker, so the cost of that ordering is one duplicate announcement rather than a phantom
> at the head of the sequence (§5 item 3's third residue).

### 12.3 The two Lows

**Low 1 — a count that named more than it counted, and a check that read the number instead of
counting it.** `docs/decisions/2d-1-notes.md` §2.1's round-4 correction block said **one** of 2d-3's
three ledger callers could place its reads without a stamp, and named **two** in the same sentence:
the two save-path refreshes. It is two — the third caller is the watcher's worker thread, which
holds no session lock and is the one that stamps. The concrete cost of leaving it is round 4 again:
a maintainer following the count preserves serialization for one tail and restores a stamped
chronology to the other, where an equal-instant collision refuses an external observation with
nothing to answer the refusal. The block is corrected **in place**, because it is a present-tense
claim about how the code works now (§10.7's rule).

The second half is this record's own: §11's *no correction is owed outside this record, and that was
checked rather than assumed* paragraph asserted that the block's count stood. It did not, and the
check that said so read the number the block gave rather than counting the callers the block named.
A correction block under that paragraph says so, and the rule §12's opening paragraph draws from it
is the general form: **a count in a document one is checking must be re-derived from what the
document names.**

**Low 2 — a present-tense scope record that had been false for three rounds.** §4's last bullet said
*"no widening of the watch scope and no change to the core crate at all."* The first half is true
and is what the bullet is for; the second stopped being true at round 3, which added
`ObservationEngine::revert_settlement` and `Observation::path()`, and is further from true now that
round 6 has added `ObservationEngine::observe_owed`. The failure it invites is concrete and
symmetrical with Low 1's: read as a binding scope invariant, it licenses removing the rollback that
ledger refusal recovery depends on, or the debt that a re-observation depends on, and the
observation each was built to save goes back to being lost. The bullet now states what is actually
invariant — **no Tauri, save or ledger dependency in the core crate** — names both primitives, and
says why each is a fact about a directory rather than about an application session. §1's *no wire,
no window* paragraph, which already carried the round-3 half correctly, gains the round-6 half.

### 12.4 What changed, file by file

- **`crates/espansoconfig-core/src/watch/engine.rs`** — `ObservationEngine::observe_owed(path, now)`
  and the private `owed: BTreeSet<PathBuf>` it fills; the private `Undone` value the one-pass `undo`
  map now holds, carrying the debt beside the replaced tracked state so `revert_settlement` restores
  both; an `owed` operand on `settle` and on all three settlements — `settle_present` skips its
  coalescing check, `settle_missing` emits with `previous_revision: None` where nothing was tracked,
  `settle_failed` skips its coalesce; and the re-insertion in `settle` that makes *a debt is spent
  only by a settlement that emitted* structural rather than an agreement between three functions.
  The module docs gain an *owed* section; `Observation::Changed` and `Observation::Removed` document
  the two shapes an owed settlement can produce; `ObservationEngine::start` says in its own contract
  that establishing is not announcing and names the request that pays for the difference. One test;
- **`src-tauri/src/watch.rs`** — `WatchWorker::hint_paths` renamed **`WatchWorker::schedule_paths`**
  and given the new private `HintOrigin`, because the two origins no longer ask the same question
  while the re-spelling and the clock stay one rule; `WatchWorker::baseline` retains
  application-origin requests in a `BTreeSet` across a failing enumeration and hands them to the
  engine it finally opens, as debts, and takes the `HintSpelling` it needs to do so; both loop arms
  route `WorkerMessage::ReObserve` through the application origin. The module's *a save may ask*
  section, `WorkerMessage::ReObserve`, `ReObserveOutcome`, `ReObserver::re_observe`,
  `WatchWorker::baseline` and `WatchWorker::run` are documented for all of it. One test, on a real
  spawned worker;
- **`src-tauri/src/commands.rs`** — `conflict_after_the_lock` and `after_a_save` each call
  `side.watcher.re_observe(path)` **after** their `admit_under_the_session_lock`, on the arms where
  they publish. The module header's *composes with four other things* becomes five and names the
  owed observation; its *where this application has no reading to bring* paragraph becomes *no
  reading, or one it cannot prove stable* and counts five arms; `run_one_save`'s section is
  rewritten around the same five and names the one arm that deliberately does not ask; both tails'
  own sections carry the new half; and `SessionSideOfASave::watcher`'s *exactly three arms* becomes
  five. Two tests;
- **`src-tauri/src/ledger.rs`** — **no production code.** `admit_under_the_session_lock`'s *what is
  weaker here* paragraph carried item 3's false ruling as a doc comment and is rewritten around what
  the code now does; the module's *a read the save path could not use* section becomes *could not
  use — or could not prove stable*; the round-5 engine-plus-gate test's hint becomes the
  `observe_owed` the worker really performs. One test;
- **`src-tauri/src/main.rs`** — the phase paragraph's **five** things become six, the sixth is
  described in both its halves, and the sentence about a failing refresh gains its successful twin.

### 12.5 The sweep for the shape, not for the words

The question, asked of this round's own change as every round before it has: *is there anywhere else
a value is settled, installed, spent, published or consumed before the decision that could reject
it, or any place a single unstabilized read reaches the ledger?*

**Every production path into the ledger was enumerated with `rg`, not recalled.** There are exactly
four: `admitting_sink`'s `admit` (the watcher's, two reads, stamped), `after_a_save`'s
`admit_under_the_session_lock`, `conflict_after_the_lock`'s, and `commit_and_record`'s
`record_app_write`. The two middle ones are the single reads, and both now ask. There is no fifth.

**One narrower instance was found in this round's own new code, and it is closed rather than
recorded.** `settle` removes a path's debt before running the settlement that is supposed to answer
it — a check and a spend in two places, which is precisely the shape `CLAUDE.md` names as this
project's recurring defect. All three settlements do emit whenever a debt is owed, so the gap is
unreachable today; a fourth settlement kind that coalesced despite a debt would have consumed the
request and answered it with silence, which is the whole defect the mechanism exists to close. The
debt is now put **back** when a settlement answers `None`, so *a debt is spent only by a settlement
that emitted* is a property of one function rather than an agreement between three.

**A second candidate was found and is written down as a residue rather than closed** — §5 item 22.
An owed observation whose stable state equals the tracked one is emitted anyway, and the ledger
publishes it when nothing was published for that path. That is the price of the mechanism and not a
defect in it: *nothing changed* and *I have never told you anything* are different answers, and only
a ledger-free engine forced to answer both can be sure of answering the second. The common case
costs nothing — the ledger answers `SelfWrite` or `Duplicate` — and the observation carries the
equality on its face for the case that does not.

**Every arm of the save path was re-enumerated against the new code rather than inherited from
§11.4**, and what each costs:

- `run_one_save`'s `workspace.document_context(document)?` — before the transaction, nothing written
  and nothing read of the file's content. **Costs nothing**, unchanged;
- `Err(SaveError::Refused(_))`, and every `Err` whose `may_have_written()` is false — nothing
  written, no reading held. **Costs nothing**, unchanged;
- `Err(_) if may_have_written()` — asks, unchanged since §11, and the request is now a debt;
- `after_a_save`'s `Err` from `refresh` — asks; publishes nothing; does not clear the record.
  Unchanged since §11, and the request is now a debt, which is what makes it answerable when the
  worker's baseline was failing or has just established the path;
- `after_a_save`'s `Ok` arm where the revision **agrees** — **re-judged rather than inherited, and
  it still does not ask.** It publishes nothing and clears nothing, so unlike the arm below it puts
  no state anywhere that a stabilized reading would have to correct. Its record, if it took one,
  correctly describes what it read. What it cannot rule out is an external write landing after its
  read whose hint the backend misses — and that is the ordinary coverage of every file this
  application does not save, inherited from `2d-2-notes.md` §2.3 and not made worse here;
- `after_a_save`'s `Ok` arm where it **disagrees** — publishes, as consult Q2 requires, **and now
  asks**;
- `conflict_after_the_lock`'s `Err` from `refresh` — asks; returns the read's own error; publishes
  nothing and invents no record. Unchanged since §11, and now a debt;
- `conflict_after_the_lock`'s success — publishes, as consult Q2 and Q5 require, **and now asks**.

**The refusal arms of both doors were re-checked and are untouched by this round**: `PrecedesACommit`
is still unreachable from the serialized door, `SelfWrite` and `Duplicate` are still answers about
these exact bytes, `StaleEpoch` is still unreachable there, and `SequenceSpaceExhausted` is still the
same inherited shape. `decide` was not changed at all, so the three §9.3 candidates §10.4 and §11.4
re-checked stand unchanged again.

**The new code was asked the same question.** `observe_owed` consumes nothing and spends nothing: it
records a debt and schedules a read, and its only failure mode is a path the engine does not watch,
where it records nothing rather than a debt nothing could answer. `schedule_paths` moves its paths in
and drops nothing but an unwatched one. `baseline`'s retained set is moved into the engine on
success and dropped on `Stop` — the second is §5 item 21, and it is bounded by the replacement that
must be what stopped the worker. The two new `re_observe` calls are placed **after** their
admissions, which is where both ledger guards are already dropped, so no send happens under a lock;
and the answer is bound and ignored on all five arms, which is a report rather than a permit
(§11.4's argument, unchanged).

**One candidate outside the save path was re-considered and again not taken.**
`WorkspaceSession::reload`, `document` and `text` also read a file and can discover bytes this
session had not seen. §11.4's reason stands and round 6 does not weaken it: those callers take no
record, disturb no file and put **nothing into the ledger**, so they hold no reading that decided
anything. Round 6's second High is about a read that *decides* — it publishes and it clears — and
that is exactly what separates the two.

### 12.6 What is guaranteed now, and what is not

**Guaranteed.** Everything §10.5 and §11.5 guaranteed, unchanged — this round altered no decision the
ledger takes and did not touch `decide`. Added: a re-observation this application asks for is a
**debt** the engine must answer rather than a hint it may coalesce into silence; it is retained
across a failing baseline and handed to the engine that finally opens; it is answered even when the
state the path stabilizes to is one the engine established but never announced, and even when the
engine tracks nothing for that path at all; and it is re-owed when a refusal takes its settlement
back. Added: both save-path refreshes that publish a single read now ask for a stabilized reading in
the same breath, so the last word on a path this application wrote to is a state the engine read
twice — at a later sequence than the single read, never in place of it — **and that last clause is
conditional on there being a watcher to ask, which nothing here forces** (§5 item 19). Every one of
these is a claim about a running watcher plus a running engine; with neither, what is guaranteed is
exactly what §10.5 and §11.5 guaranteed and no more.

**Not guaranteed, and stated as such.** That a watcher is running to hear the ask (§5 item 19) —
which now also decides whether a published single read is ever corrected. That a re-observation
survives a worker stopping before its next tick or an imminent workspace replacement (§5 item 21).
That a consumer acts only on the highest sequence per document — consult Q3's rule, which this step
relies on and 2d-4 must keep (§5 item 3). That an owed observation of an unchanged state costs no
sequence (§5 item 22). That a debt belongs to the caller that asked for it (§5 item 14, fourth
half). That a caller of `admit_under_the_session_lock` holds the session lock (§5 item 14, third
half). That a producer's stamp precedes its reads, and that a sink's answer is acted on (§5 item 14,
first two halves). And everything §5's other items already carried, unchanged by this round.

**Nothing from 2d-4 or later was added**: no Tauri event, no queue, no `drain_external_changes`, no
`#[tauri::command]`, no TypeScript, Svelte or i18n file, no writer, no force flag, no route around
`save_document`, and nothing new that serializes. One core file was touched and the primitive it
gained is ledger-agnostic; `cargo tree -p espansoconfig-core | rg tauri` still finds nothing.

> **Correction (round-7 fix round, §13).** Two of the sentences above are falsified and one is
> strengthened, and §13.6 is the current statement; this block says which is which so the change
> can be read here rather than inferred.
>
> **Falsified, in the *guaranteed* paragraph**: *both save-path refreshes that publish a single read
> now ask for a stabilized reading in the same breath, so the last word on a path this application
> wrote to is a state the engine read twice — at a later sequence than the single read, never in
> place of it*. Since §13 neither refresh publishes at all, so there is no "later sequence than the
> single read": the stabilized reading is the **only** sequence, and *in place of it* is exactly
> what happens. The ask is unchanged and everything this paragraph says about a **debt** is
> unchanged.
>
> **Falsified, in the *not guaranteed* list**: *that a consumer acts only on the highest sequence
> per document — consult Q3's rule, which this step relies on and 2d-4 must keep (§5 item 3)*. This
> step no longer relies on it for anything, because it no longer puts a value into the sequence that
> needs a later one to correct it. 2d-4 must still honour Q3, which is Q3's own business; what has
> gone is this step's dependence on it. The item-3 pointer stands and points at a replaced item.
>
> **Strengthened**: what is guaranteed now includes *no single unstabilized read spends a sequence
> or reaches the downstream sink*, and it is a property of which methods exist rather than of what a
> caller does. **Also falsified by the rename**: *a caller of `admit_under_the_session_lock` holds
> the session lock* now reads *a caller of either serialized door*, and the obligation is unchanged
> (§5 item 14's third half).

> **Correction (round-13 fix round, §19.4).** The *guaranteed* paragraph's second sentence — *a
> re-observation this application asks for is a **debt** the engine must answer rather than a hint it
> may coalesce into silence* — is the **origin** of round 13's second High: this is the round that
> wrote it, and §1's headline took the same words. It over-claims in one direction only, and the
> paragraph itself half-knew it: its own last sentence says *"every one of these is a claim about a
> running watcher plus a running engine"*, and its *not guaranteed* list, three lines below, already
> names §5 items 19 and 21. What the debt gives is that the engine may not answer a settlement of
> that path with **silence** — the coalescing arm is what `observe_owed` closes — and that the debt
> survives until such a settlement emits; it is **not** a guarantee that a settlement emits, because
> `observe_owed`'s own doc says a path being written continuously *"stays pending, and the debt waits
> with it"* and an unwatched path records no debt at all. The three clauses that follow the false one
> are unaffected: retention across a failing baseline, emission against an established-but-unannounced
> state, and re-owing on a rollback are each conditional on a settlement happening and claim nothing
> about whether one does. §1's headline and `src-tauri/src/commands.rs`'s module header carry the
> corrected sentence from round 13 on.

> **Correction (round-14 fix round, §20.2), on the *guaranteed* paragraph and on the round-13 block
> directly above.** The paragraph's fourth clause — *"and it is re-owed when a refusal takes its
> settlement back"* — is round 14's second High at its **origin**, exactly as its second sentence was
> round 13's, and the round-13 block reproduced it while clearing it (*"re-owing on a rollback"* among
> the three clauses it called unaffected). Both are unconditional and the primitive is not.
> `ObservationEngine::revert_settlement` reads `Undone { replaced, owed }` and branches — `if owed {
> self.observe_owed(path, now) } else { self.hint(path, now) }` — so the debt comes back **only where
> the settlement being taken back had discharged one**. A refusal of an owed observation re-owes it,
> which is the case this clause was written for and which still holds; a refusal of an ordinary
> **native hint's** settlement re-**hints**, and a hint may be coalesced away, which is precisely the
> outcome an owed observation is proof against. So the clause is true of the arm that carries a debt
> and false as a general statement about refusals, and the block above was wrong to list it as
> unaffected. Read it as *and it is re-owed when a refusal takes back a settlement that had discharged
> it*. Round 13's own correction — what the debt gives is a **negative** guarantee — stands untouched.

### 12.7 The evidence and the neuter runs

| Owed | Where |
|---|---|
| **a deterministic spawned-worker/baseline-failure test that does not require FSEvents** | `watch.rs`'s `a_re_observation_issued_while_the_baseline_fails_is_answered_once_it_starts` — a real `WatcherLifecycle` over a root that **does not exist**, so the backend can watch neither root, no stream is ever created and nothing in the test can be carried by a native event even in principle. The request is made after the polling fallback engages (which proves the worker is past `establish_native`) and while `ready` is false (which proves the baseline has not succeeded); the tree is then created without the document, and the sink receives `Removed { previous_revision: None }` for the path that was never there |
| …and what that test does **not** force | which of two arms absorbed the request. The worker is inside `baseline`'s retry loop when the request is sent, and `ObservationEngine::start` fails in microseconds over an absent root, so it is in `recv_timeout` essentially all of that time — the neuter run below confirms the retention arm is the one that runs. But if a slow worker reached its first attempt only after the tree appeared, the request would be drained by the loop arm instead, and **the test would still pass**, because that arm is owed too. Both are the fix; only one is forced |
| that the engine answers a debt where a hint is silent | `engine.rs`'s `an_owed_observation_is_answered_where_a_hint_coalesces_to_silence` — five steps over one real temp tree: a baseline-established state hinted (silent) then owed (a `Changed` carrying `previous_revision == content.revision()`); an untracked absence hinted (silent) then owed (`Removed { previous_revision: None }`); a debt discharged once; a debt restored by `revert_settlement`; and an unwatched path recording none |
| that a marked single read spends no sequence and the stabilized state does (**amended by §13**; it read *that a single-read publication is superseded by a stabilized state* when round 6 wrote it) | `ledger.rs`'s `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` — the sharpest ordering of round 6's second High, with the worker admitting the final state **first** and the save tail publishing its earlier reading **second**, so the phantom is genuinely the last word; the owed request then answers with the state the engine tracks, at sequence 3 |
| that neither admitting arm publishes, that the conflict arm marks what the person was shown, and that both ask (**amended by §13**; it read *that both admitting arms publish **and** ask* when round 6 wrote it) | `commands.rs`'s `a_disagreeing_post_save_refresh_announces_nothing_and_asks_for_a_stabilized_reading` and `a_conflict_refresh_marks_its_disk_side_and_still_asks_for_a_stabilized_reading` — each asserts the publication (which consult Q2 and Q5 require) and the ask (which round 6 adds) in the same test, because either alone would be the wrong fix |
| that the ledger's decisions are unchanged | nothing new was needed and nothing was weakened: §3's table, §9.5's, §10.6's, §11.6's and the whole of `ledger::` still pass over one `decide`, which this round did not touch |
| that the retained requests survive a **real** worker's baseline | driven, by the first row |
| that the production save path always has a watcher to ask | **nothing**, and §5 item 19 is the standing statement of it — sharper now than before, because it also decides whether a published single read is corrected |
| that a consumer acts on the highest sequence per document | **nothing here can drive it**: there is no consumer until 2d-4. §5 item 3 carries it as an obligation on that step rather than as something this one proves |

**Seven neuter runs**, each disabling exactly one thing and then restored, and each reverted with
its suite re-run green before the next was made:

- **the retention arm** (`baseline` consuming `ReObserve` and dropping it, as before this round) —
  `a_re_observation_issued_while_the_baseline_fails_is_answered_once_it_starts` failed as a clean
  bounded timeout at the sink wait (20.4 s). It also proves which arm runs: the loop arm was
  untouched by this edit, so a request reaching it would still have been answered;
- **the owed origin** (`baseline` replaying its retained paths as `HintOrigin::Native`) — the same
  test failed the same way. That is the round's own find as a measurement: retention **alone** is
  not the fix, because a hint at a path a baseline has just established, or cannot enumerate, is
  answered by silence;
- **the owed coalescing bypass** (`settle_present` coalescing unconditionally) — `ledger.rs`'s
  `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` failed at *"the debt is
  answered even though nothing changed"*, **left 0, right 1**. **18 passed, 1 failed** of the 19
  ledger tests, so the check is narrow;
- **the owed absence** (`settle_missing` returning `None` whenever nothing was tracked) — two
  suites, which is the two halves of the removal case: `engine.rs`'s
  `an_owed_observation_is_answered_where_a_hint_coalesces_to_silence` failed at *"the debt is
  answered: []"*, and `watch.rs`'s spawned-worker test failed as a bounded timeout (20.4 s);
- **the debt restore in `revert_settlement`** (reverting as a plain hint) — the engine test failed
  at *"a refused owed observation is still owed"*, **6 passed, 1 failed** of the 7 engine tests, so
  the check is narrow;
- and for the second High, **each of the two new asks removed in turn** —
  `a_disagreeing_post_save_refresh_announces_nothing_and_asks_for_a_stabilized_reading` and
  `a_conflict_refresh_marks_its_disk_side_and_still_asks_for_a_stabilized_reading` each failed at
  its inbox assertion, **`left: []`, `right: ["…/match/base.yml"]`**, **77 passed, 1 failed** of the
  78 command tests in each run. Neither failure disturbed the other, which is what makes them checks
  rather than couplings.

**One thing is deliberately not neutered**, and saying so is the point: nothing was removed to test
`ObservationEngine::start`'s establishing behaviour, because that is 2d-1's and this round did not
change it. What the tests above drive is the **consequence** of it — that a caller which has been
told nothing cannot use *nothing changed* — and the consequence is what the fix is about.

> **Correction (round-7 fix round, §13).** Three rows above name tests §13 **renamed**, and the
> names are amended in place so the evidence stays findable; what round 6 built is left as written.
> Two rows also state a claim §13 falsified, and the claims are the rows' whole point, so they are
> corrected rather than left: *that a single-read publication is superseded by a stabilized state*
> is now *that a marked single read spends no sequence and the stabilized state does* — the test
> drives the same ordering with the tail's publication removed — and *that both admitting arms
> publish **and** ask* is now *that neither arm publishes, that the conflict arm marks what the
> person was shown, and that both ask*. The neuter runs below them measured round 6's code and are
> **not** re-claimed for §13's; §13.5 records this round's own, including the two that re-run the
> same two `commands.rs` tests against the new assertions.

### 12.8 The two sweeps

**For the shape** — *a value settled, installed, spent, published or consumed before the decision
that could reject it, or a single unstabilized read reaching the ledger* — is §12.5, including the
`rg`-derived enumeration of all four production paths into the ledger, the one narrower instance
found in this round's own new code and closed, the one written down as §5 item 22, and the full
re-enumeration of the save path's arms with what each costs.

**For name positions**, as a pass distinct from the prose, and **redone from the current code rather
than from round 5's list**, because both of round 6's Lows are misses by that kind of list:

- **`WatchWorker::hint_paths` — the name itself was a name position.** It said *hint*, and half of
  what it now does is record a debt. Renamed `schedule_paths`, with the origin named rather than
  passed as a boolean, and every mention of the old name swept: `watch.rs`'s module *a save may ask*
  section, `WorkerMessage::ReObserve`'s doc, `WatchWorker::run`'s doc, and `ledger.rs`'s round-5 test
  comment, which described the request as *what `WatchWorker::hint_paths` makes of it* and now
  performs the `observe_owed` the worker really performs;
- `src-tauri/src/main.rs`'s phase paragraph — **Five** where this round makes it six, with both
  halves of the sixth described;
- `src-tauri/src/commands.rs`'s module header — *composes with **four** other things*, now five;
  and its *three arms* paragraph, now five, with the two new arms named and the one that does not
  ask named as well, so the count and the enumeration cannot drift apart;
- `ReObserver::re_observe`'s doc — *"because of what the **three** production callers are"*, and it
  then enumerated all three. Now five, enumerated, with the two new ones described by what each was
  already returning when it asked, because the point of the enumeration is that no caller's outcome
  may depend on a watcher's availability;
- `ReObserveOutcome`'s doc — it explained itself by saying a path whose bytes have not changed
  *"coalesces to nothing"*, which is exactly what an owed request no longer does. Rewritten to say
  what `Asked` really promises: that the request reached the inbox of a worker that had not exited,
  and nothing about what will be observed;
- `SessionSideOfASave::watcher`'s doc — *asked on exactly **three** arms and no others*, now five.
  A count in a doc comment that a later round adds to is the exact shape of round 5's second Low;
  and **§2.7's own round-5 correction block carried the same count** (*"a handle a save asks through
  on the three arms where it has no reading of its own"*), which is both a count and a condition
  round 6 changed — blocked there rather than left, because it is a present-tense description of the
  value `with_open` lends;
- `docs/decisions/2d-3-notes.md` line 3 — the headline said *five facts*; six, with a sixth
  correction block beneath it;
- **§11.5's *not guaranteed* list** — it named a failing baseline and a workspace replacement in one
  breath, and the first half is now given. A block under it says which half moved and which did
  not, exactly as §11.5 itself had to block §10.5. Its *guaranteed* paragraph's closing sentence was
  true of three arms and false of the two this round reached, and the block says that too;
- **§5 items 3 and 20 are replaced, not annotated**, because one's ruling and one's bound were
  wrong — the same treatment §8 gave item 10, §10 gave item 16 and §11 gave item 18, and the fourth
  and fifth times this step has had to give it. Item 18's closing sentence, which named items 19 and
  20 as its residues, is amended rather than left pointing at a replaced item;
- `docs/decisions/2d-1-notes.md` §2.1's round-4 block — **one** where it named two (round 6's first
  Low), corrected in place, with a block recording why; and a second block there for the sixth
  caller obligation the engine's new primitive discharges;
- `docs/decisions/2d-3-notes.md` §4's last bullet and §1's *no wire, no window* paragraph — *no
  change to the core crate at all* (round 6's second Low), replaced by what is actually invariant
  and by the two primitives that are not;
- `ledger.rs`'s `admit_under_the_session_lock` — its *what is weaker here* paragraph was §5 item 3's
  false ruling written as a doc comment, in the one place a reader of the door would meet it.
  Rewritten around what the code now does, and it names the two consult rulings that keep the
  publication;
- **searched and found current**, so the next round does not re-find them as misses: *"the two
  save-path refreshes"* wherever it appears (§1, §2.6's heading, `main.rs`, `commands.rs`,
  `ledger.rs`) — there are still exactly two refreshes and this round added no third, so the phrase
  is not stale anywhere; `admit_at_current_epoch` in §1's built list, §7.1, §8.1, §9.6 and §5 item
  12, each a past-tense record of what a named round did; §8.1's *"…so every observation carries a
  stamp"* heading and §2.6's §8-era stamping paragraph, both already carrying round-4 blocks; and
  **three places that name `hint_paths` and are deliberately left standing** — §11.1's option (d),
  §11.2's `watch.rs` entry, and §11.6's row saying no test drives `WorkerMessage::ReObserve` through
  a spawned worker. Each is a record of what **round 5** built and each was true then; the first two
  are named again in §12.4's `watch.rs` entry with the rename, and the third **has** gone stale,
  with §12.7's first row as the answer. The rule applied is §10.7's, unchanged: **a present-tense
  claim about how the code works now is amended in place or blocked; a past-tense record of what a
  round built is left alone.**

---

## 13. The round-7 fix round

`docs/reviews/phase-2d-3-ledger.md` round 7 returned **NOT READY** with one High and two Lows, and
it is the seventh consecutive round whose finding was produced by the previous round's fix. All
three are closed here. What round 7 inspected and settled in the fix's favour before finding
anything is not re-argued below: the worker-before-tail Q→P ordering is real and an owed request
reaching a live worker does correct it; debt re-insertion in `settle`, rollback re-owing through
`Undone`/`revert_settlement`, native-hint behaviour across the `schedule_paths`/`HintOrigin` split,
both `ReObserve` loop arms, baseline retention, admission ordering, epoch replacement, §5 item 21's
replacement bound and the spawned-worker test's two-arm limitation (§12.7) are all sound.

**The High is the half of round 6's remedy that §12.2 rejected deliberately**, and the owner has
ruled the remedy adopted. That makes this the **second** time §5 item 3 has been wrong, and item 3
is the only item of that section to have been wrong twice; six of that section's items have now been
found to be real defects after being written as honestly bounded (10, 16, 18, 20, 3, and 3 again).
The rule §12 added — *check the sentence that makes a hole look bounded against the code that would
have to make it true, in the same pass that writes it* — was right and was not enough here, because
item 3's replacement did not rest on the code at all. It rested on a **quotation of the consult**,
and the quotation was read backwards. So the rule this round adds, and applies to every remaining
consult citation in this record: *a consult ruling cited as a guarantee must be read for what it
obliges and what it forbids, separately, and the sentence that leans on it must name which of the
two it is using.*

The corrections this round owes the record itself, counted by listing them: the seventh block under
the headline (§1) and two amendments to the headline paragraph itself — the fifth fact, and the
sentence naming what each of the three `commands.rs` places does; **three** amendments to §1's built
list (`ledger.rs`, `commands.rs`, `main.rs`) plus its `Admission` and `LedgerTally` counts; a block
under §2.6 and one under §2.8, with §2.8's first sentence amended in place; the **replacement** of §5
item 3 and amendments to §5 items 2, 19 and 22; two amended rows in §3's evidence table; the round-7
column in §6's table with its own count paragraph and a block under round 6's; and blocks under
§12.2, §12.6 and §12.7, with two amended rows in §12.7's table. **No correction is owed outside this record**, and that was
checked by re-deriving the two counts a sibling document makes rather than by reading them.
`docs/decisions/2d-1-notes.md` §2.1's round-4 block, as round 6 corrected it, says **two** of 2d-3's
**three** ledger callers can place their reads without a stamp. Both numbers survive this round and
were counted, not assumed: the callers are the watcher's worker thread through `admit`,
`conflict_after_the_lock` through `mark_under_the_session_lock` and `after_a_save` through
`withhold_under_the_session_lock` — still three, and still two of them under the session lock. The
split changed which door a save-path caller uses and not how many callers there are or what each can
prove. §13.7 records the rest of the search, including what was found in `PROGRESS.md` and left
standing.

### 13.1 The High — the marker and the publication are two jobs, and one map did both

**What the finding was.** Round 6's second High said both *successful* save-tail refreshes publish
and coalesce a **one-read** transient into the ledger. §12.2 adopted the first half of the review's
remedy — keep the immediate read for cache and payload construction — and **rejected the second
deliberately**, shipping *publish **and** ask*: keep the publication, and additionally ask the engine
for a stabilized re-observation, so the phantom is superseded at a later sequence rather than
prevented. Round 7 judged that deviation wrong. Its scenario: the app commits A → `after_a_save`
reads transient P and publishes it → a 2d-4 drain takes P before the owed observation settles → an
open write surface accepts P as its current conflict, the person confirms *Reload*, and their draft
is discarded → the engine later stabilizes Q and publishes it at a higher sequence, which cannot
restore the draft. A missing or stopped watcher makes P permanent instead.

**Why the record's own sentence was false, said plainly.** §12.2 and §5 item 3's replacement both
rested on consult **Q3**: *for each document the frontend acts only on the highest sequence it has
accepted*. That is a rule about **regression**, not about **waiting**. It forbids a consumer acting
on a sequence older than one it has already taken; it obliges no consumer to hold off until a
sequence that does not exist yet arrives. At the moment P is published, P *is* the highest sequence
in existence for that document, so a drain that accepts it is doing exactly what Q3 tells it to do.
The correction at *n+1* is not a correction of an action already taken on a discarded draft. The
record turned an ordering rule into a timing guarantee, in one clause, and then leaned two sections
on it.

**What was built, and the hypothesis that was checked rather than assumed.** The brief's design was
to split the **coalescing marker** from the **sequence-spending publication** in `WriteLedger`:
`published` had been documented as *"the last state published for each path, which is the whole of
the coalescing rule"* — one map doing both jobs — so the tails could record a state for coalescing
without spending a sequence, and the owed re-observation would be what publishes. The brief also
carried a starting hypothesis to verify: that **both** tails could mark, and that the three cases
would fall out on their own without any owed-origin override.

**It holds for one tail and fails for the other, and that was established by reading the code.** The
three cases the hypothesis names are right about `conflict_after_the_lock` and wrong about
`after_a_save`:

- a **native duplicate** at the marked state → the ledger sees the marker → `Duplicate` ✓, which is
  consult Q5's *a save-origin conflict registered by `conflict_after_the_lock` wins over a native
  duplicate at the same document/revision … the duplicate is coalesced*;
- the **owed settlement** at the marked state, P having been stable after all → also `Duplicate` ✓,
  and correct for the conflict tail: the person has P in the payload `conflict_after_the_lock`
  returns, and publishing it would be the second conflict Q5 forbids;
- the **owed settlement** at Q ≠ P → admitted and published ✓, the truth entering the sequence while
  P never did.
- **and the case the hypothesis does not cover**: the owed settlement at the marked state for
  `after_a_save`'s disagreeing read. That tail returns `SaveResult::Saved`, which carries **no disk
  side** — `after_a_save`'s own answer is `{ revision, committed, notes, backup_taken, moved }`, and
  `moved` is `None` precisely *because* the refresh disagreed. So **nobody has been shown that
  state**. A marker there makes the engine's later stabilized reading of the same state a
  `Duplicate`, and consult **Q2**'s *the differing post-save observation is queued as external* is
  then met by nothing at all. That is round 3's swallowed-change defect reached from the other
  side — the trap the brief named, real, and reached through the tail the brief's hypothesis did not
  separate out.

**The fix is therefore three doors and not two, and the asymmetry is the consult's own.** Q5's
coalescing rule is scoped, in the consult's words, to a conflict *registered by
`conflict_after_the_lock`*; there is no such conflict on the other path. So:

- **`WriteLedger::admit`** — the watcher's stamped door, whose readings are the engine's two equal
  consecutive reads — is the **only** door that can spend a sequence. *No single unstabilized read
  enters the observation sequence* is now a property of which methods exist;
- **`WriteLedger::mark_under_the_session_lock`** — `conflict_after_the_lock`'s — runs every check
  and, for a state that survives, records it in the announced map and answers `Admission::Marked`.
  No sequence, no downstream value;
- **`WriteLedger::withhold_under_the_session_lock`** — `after_a_save`'s — runs every check and
  records **nothing**, answering `Admission::Withheld`. What it decides is the app-write record and
  only that: the file does not hold the bytes this save committed, so the entry saying it does must
  not go on suppressing somebody else's later write of exactly those bytes.

**No core change was needed and none was made** (`cargo tree -p espansoconfig-core | rg tauri` still
finds nothing, and this round touched no core file at all), and **no owed-origin override was needed
either**: the discrimination lives in *which door the reading came through*, which is a fact the
caller already has, rather than in *where a later observation came from*, which the engine would have
had to carry and which would have made the debt caller-identified — the thing §5 item 14's fourth
half says it deliberately is not.

**Why one enum and not two.** `ReadChronology` became `AdmissionDoor`, a three-variant private enum
that decides both the chronology proof and what a surviving state may do. Two orthogonal parameters
would have had six combinations of which three are legal, and the three illegal ones are exactly the
mistakes that matter: a stamped reading that only marks drops the watcher's own observations, and a
single unstabilized read that publishes is this round's High. `decide` matches the door **twice**, so
a fourth door is a compile error in both places.

> **Correction (round-8 fix round, §14).** The three-door list above says each serialized door *runs
> every check* and then does its own thing, and round 8's High is that it did — the check above the
> door was the one that should not have been asked. Read the two bullets as they now stand: each
> door runs the checks it **is** asked, which are supersession and coalescing, and neither retaining
> check is among them. The prediction the bullets make — `Marked` for a state the marking door sees,
> `Withheld` for the withholding door's, and the record cleared in both — was **false wherever the
> app-write record named the state just read**, because `decide` answered `SelfWrite` first and
> returned. §14.1 is the whole of it. The last sentence of this subsection is also amended by
> arithmetic rather than by argument: `decide` now matches the door **three** times, not twice.
>
> Two further sentences of §13.1 that the correction does not touch, said so that the next round does
> not re-find them: *no owed-origin override was needed* stands, and *the discrimination lives in
> which door the reading came through* stands — §14 is that sentence applied one step higher rather
> than a retreat from it.

### 13.2 The two Lows

**Low 1 — a module headline that counted five while composing with six, and omitted the one whose
removal restores a lost-observation defect.** `commands.rs`'s header said *this module composes with
five other things* and named the commit gate, the watcher's stamp, the session lock, the
re-observation and the owed debt. The **settlement rollback** is missing: without
`ObservationEngine::revert_settlement`, a refused reading leaves the engine believing it announced a
state nobody heard, and the same bytes re-read coalesce to nothing forever — round 3's first High.
The concrete cost of leaving the list as written is that a maintainer treating it as exhaustive
removes `revert_settlement` as unaccounted-for machinery. The count is now **six**, the rollback is
named third with what it does, and the header says in the same breath that the count is re-derived by
counting the list. **The count was checked by counting**, not by reading it: `main.rs`'s parallel
paragraph already said six and its six are the commit gate, the stamp, the taken-back settlement, the
session lock, the re-observation and the owed debt — the same six, which is how the omission was
visible at all.

**Low 2 — §5 item 22's scenario was narrower than the code's.** The item ended *"the case that costs
a sequence is a path this session has committed to but never published a state for"*. The condition
in `decide` is *no record naming this state and nothing already announcing it*, and neither clause
mentions committing. The reviewer's counter-case: the watcher's baseline **establishes** state B
without announcing it → a stale save conflicts under the lock without committing → the conflict's
refresh **fails**, so it records nothing and announces nothing, and asks for a re-observation → the
engine settles on B and, a debt being owed, emits `Changed { B → B }` → the ledger finds no record
and no announcement and spends a sequence, for a path this session never wrote to. The item now
enumerates the real cases from the arms that ask, re-walked against this round's code rather than
recalled, keeps the warning that a consumer must read the equality as **reaffirmation** and never as
an external change, and adds the case this round creates deliberately: `after_a_save`'s withheld
read, where the sequence the owed settlement spends is the mechanism rather than its price. It also
records the case this round **removes** — a successful conflict refresh now costs nothing here, where
before it spent a sequence at the tail and coalesced afterwards.

### 13.3 What changed, file by file

- **`src-tauri/src/ledger.rs`** — the private `ReadChronology` becomes the three-variant
  `AdmissionDoor` (`StampedPublication(Instant)`, `SerializedMarker`, `SerializedWithholding`), which
  `decide` matches twice: once for the chronology check and once for the new **step 5**, where each
  door says whether a surviving state is published, marked or recorded nowhere.
  `admit_under_the_session_lock` is split into `mark_under_the_session_lock` and
  `withhold_under_the_session_lock`, neither of which can spend a sequence.
  `Admission::Marked` and `Admission::Withheld` are the two new decisions; `LedgerTally::marked` and
  `LedgerTally::withheld` count them, and the tally's *five of six* is re-derived to *seven of
  eight*. `LedgerState::published` becomes `announced` and `WriteLedger::published_state` becomes
  `announced_state`, because a marker is not a publication and an accessor that called one the other
  would let a test assert *published* over a state no sequence was spent on. `admitting_sink` gains
  the two new arms, unreachable from its own door and answered rather than panicked — a `panic!` on
  the watcher's worker thread is the one panic this crate must not take. The module's *a read the
  save path could not use* section loses round 6's publication half and gains a new section, *the
  marker and the publication are two jobs, and one map did both*; `record_app_write`'s
  invalidation section gains a paragraph on the marker it now also clears. **One test added, four
  amended and two renamed**, counted by listing them: added,
  `a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not`; amended,
  `a_serialized_door_reading_is_never_refused_by_the_records_own_instant` (it now drives **both**
  serialized doors), `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` (also
  renamed, from `a_one_read_publication_is_superseded_by_the_state_the_engine_stabilizes`), and the
  two whose whole-`LedgerTally` literals gained the two new counters —
  `the_gate_forwards_only_admitted_observations_and_numbers_them` and
  `a_reading_taken_before_a_commit_never_supersedes_its_record`, each of which now says `marked: 0,
  withheld: 0` rather than leaving it to be inferred; renamed,
  `a_committed_record_invalidates_the_announced_state_and_supersedes_itself`;
- **`src-tauri/src/commands.rs`** — `conflict_after_the_lock` calls `mark_under_the_session_lock`
  and `after_a_save` calls `withhold_under_the_session_lock`; both keep their
  `ReObserver::re_observe` on the same arms, unchanged. The module header's *composes with five
  other things* becomes **six** and names the settlement rollback (Low 1), and its *no reading, or
  one it cannot prove stable* paragraph gains *no single read of this application's own enters the
  observation sequence*. `run_one_save`'s section, both tails' sections and the two inline comments
  at the call sites are rewritten around the split. **No test added; five renamed, and all five of
  those amended** — the five are listed in §6's round-7 count paragraph, and no other `commands.rs`
  test was touched;
- **`src-tauri/src/main.rs`** — the phase paragraph keeps its count of **six** — this round rewrote
  the fifth fact rather than adding a seventh, and the count was re-derived by counting the facts the
  paragraph names — and its *what it publishes is kept and a stabilized reading is asked for beside
  it* becomes the marker/withholding split. *A repeat of an already published state* becomes
  *already announced*;
- **no core file, and no `src/` path.**

### 13.4 The sweep for the shape, not for the words

The question, asked of this round's own change as every round before it has: *is there anywhere else
a value is settled, installed, spent, published or consumed before the decision that could reject it,
or any place a single unstabilized read reaches the ledger?*

**Every production path into the ledger was enumerated with `rg`, not recalled** — the search was
`rg -n 'record_app_write|\.admit\(|mark_under_the_session_lock|withhold_under_the_session_lock|begin_epoch'`
over `src-tauri/src/` excluding `ledger.rs`, plus `rg -n '\.admit\('` inside it, with the test
modules discarded by inspection. There are exactly **five**, where before this round there were
four:

1. `commands.rs:575` — `WorkspaceSession::open` → `begin_epoch`, which discards everything;
2. `commands.rs:1680` — `commit_and_record` → `record_app_write`, inside the commit gate;
3. `commands.rs:2387` — `conflict_after_the_lock` → `mark_under_the_session_lock`;
4. `commands.rs:2622` — `after_a_save` → `withhold_under_the_session_lock`;
5. `ledger.rs:1507` — `admitting_sink` → `admit`, the watcher's, stamped, two reads.

**Exactly one of the five can spend a sequence, and it is the one whose readings are stable.** That
is the High closed as a property of the enumeration rather than of a caller's discipline. The four
observability accessors (`current_epoch`, `recorded_write`, `announced_state`, `tally`) have no
production reader at all and carry their scoped dead-code allowances unchanged.

**This round's own new code was asked the same question.** `decide`'s step 5 is three sibling arms
of one match rather than early returns, so none of them skips a mutation a later one performs — the
round-1 second-High shape — and each performs its own and only its own. The publishing arm's
`next_sequence` read and write are the pre-existing pair, unchanged, under one guard with no caller
code between them. The marking arm inserts **below** step 3, where the record has just been cleared,
so `decide`'s standing argument that no public sequence can reach step 4 with a record standing is
not weakened. Neither serialized door can answer `SequenceSpaceExhausted`, because neither reaches
the allocator.

**Every arm of the save path was re-enumerated against the new code rather than inherited from
§12.5**, and what each costs:

- `run_one_save`'s `workspace.document_context(document)?` — before the transaction, nothing written
  and nothing read of the file's content. **Costs nothing**, unchanged;
- `Err(SaveError::Refused(_))`, and every `Err` whose `may_have_written()` is false — nothing
  written, no reading held. **Costs nothing**, unchanged;
- `Err(_) if may_have_written()` — asks, and records nothing. Unchanged;
- `after_a_save`'s `Err` from `refresh` — asks; records nothing; does not clear the record.
  Unchanged;
- `after_a_save`'s `Ok` arm where the revision **agrees** — publishes nothing, marks nothing, clears
  nothing, asks nothing. **Re-judged again and unchanged**: it read exactly the revision the
  transaction established, so it puts no state anywhere that a stabilized reading would have to
  correct, and what it cannot rule out is an external write landing after its read whose hint the
  backend misses — the ordinary coverage of every file this application does not save;
- `after_a_save`'s `Ok` arm where it **disagrees** — **withholds** and asks. Clears the record;
  announces nothing;
- `conflict_after_the_lock`'s `Err` from `refresh` — asks; returns the read's own error; records
  nothing and invents no record. Unchanged;
- `conflict_after_the_lock`'s success — **marks** and asks. Announces the state the person is being
  shown; spends no sequence.

**The refusal arms of both doors were re-checked and are untouched by this round**: `PrecedesACommit`
is still unreachable from either serialized door, `SelfWrite` and `Duplicate` are still answers about
these exact bytes, `StaleEpoch` is still unreachable there, and `SequenceSpaceExhausted` is now
unreachable from **two** of the three doors rather than one. The chronology comparison, the
suppression predicate and the supersession step were not changed at all, so the three §9.3 candidates
§10.4, §11.4 and §12.5 re-checked stand unchanged again.

**Three questions the brief asked to be worked out and written down rather than assumed**, each
answered from the code:

- **what `record_app_write`'s invalidation of the announced map now reaches.** The call is
  unchanged — one `remove(path)` under the same state guard as the record — and the round-1
  second-High reasoning above it is unchanged and still correct. What it *reaches* is wider: the
  entry it removes may now be a **marker** rather than a publication, and removing that one is right
  for the same reason and for one more. The same reason: a committed app write makes any earlier
  answer for that path obsolete, so a later external write back to it is news again. The one more: a
  marker means *a consumer already has this state*, and the person who was shown that disk side has
  since saved over it, so the sentence has stopped being true of them. Leaving a marker across a
  commit would coalesce a genuine post-commit external revert to the conflict's own disk side —
  round 1's second High with a marker in it. `record_app_write`'s own documentation carries this;
- **what `after_a_save`'s disagreeing arm now announces to a *second* open surface on that
  document.** By itself, **nothing** — it spends no sequence and writes no coalescing entry, so no
  observation exists for a 2d-4 drain to carry. With a watcher running, the owed re-observation
  settles and the stamped door publishes it, and that stabilized reading is what a second surface
  gets; the difference from before this round is that it describes a state read twice rather than
  once, and that it arrives one engine pass later. With **no** watcher (§5 item 19) nothing arrives
  at all, where before this round a single unconfirmed read did. The surface that performed the save
  is unaffected either way: it learns the file moved on through its own `SaveResult::Saved` with
  `moved: None` and the re-read the frontend already performs;
- **whether either tail can now report a state the person is not shown.** The marking tail cannot —
  it announces exactly the revision its own payload carries, out of one snapshot. The withholding
  tail announces nothing, so it cannot either. The only producer of an announcement a person has not
  seen is the watcher's stamped door, which is where 2d-5's conflict machinery expects to find one.

**One candidate outside the save path was re-considered and again not taken.**
`WorkspaceSession::reload`, `document` and `text` also read a file once and can discover bytes this
session had not seen. §11.4's reason stands and this round strengthens it: those callers take no
record, disturb no file and put **nothing** into the ledger, and what separates them from the two
tails is that a tail's read *decides* — it clears the record, and one of them announces. This round
narrowed what a tail's read may decide; it did not widen the set of readings that decide anything.

**One narrower instance was looked for in the round's own reasoning and found not to exist**, and
saying where it was looked for is the point: the `Withheld` arm records nothing, so it cannot be a
check-and-spend of anything; the `Marked` arm's insertion is not consumed by any later step of the
same call; and neither door reads a value it then acts on outside the state guard. What this round
does **not** claim is that a fourth door could not be added wrongly — `AdmissionDoor` makes it a
compile error to add one silently, and nothing makes its author choose the right arm.

> **Correction (round-8 fix round, §14).** Two of this subsection's claims were false, and one of
> them is why round 8's High survived a sweep that was looking one step too low.
>
> The arm list says `after_a_save`'s **disagreeing** refresh *"withholds and asks. Clears the record;
> announces nothing"* and that `conflict_after_the_lock`'s success *"marks and asks"*. Both were
> conditional on something the list does not mention: that the app-write record did not already name
> the state being read. Where it did, `decide` returned `SelfWrite` above the door, retaining the
> record and doing neither — so the withholding arm's *whole* effect was skipped, and the owed
> reading it asks for in the same breath met the same record and was suppressed too. §14 makes the
> two lines true unconditionally.
>
> The paragraph beginning *"the refusal arms of both doors were re-checked and are untouched by this
> round"* is the second, and its last sentence is the miss: *"the chronology comparison, the
> suppression predicate and the supersession step were not changed at all, so the three §9.3
> candidates … stand unchanged again."* That is true as a statement about **edits** and was read as
> one about **correctness** — the suppression predicate was unchanged and had, that round, silently
> acquired two new callers whose door made it wrong. The rule §14 takes from it: when a round splits
> one caller into three, every *shared* step below the split is a new question about each of them,
> and *"not changed at all"* is the answer to a different one.

### 13.5 The evidence and the neuter runs

| Owed | Where |
|---|---|
| that no single unstabilized read spends a sequence | `commands.rs`'s `a_conflict_refresh_marks_its_disk_side_and_still_asks_for_a_stabilized_reading` and `a_conflict_records_no_app_write_and_marks_its_refresh_for_coalescing` (`admitted: 0, marked: 1` beside the announced state), and `a_disagreeing_post_save_refresh_announces_nothing_and_asks_for_a_stabilized_reading` (`admitted: 0, marked: 0, withheld: 1` beside an announced state of `None`). All three **fail before the change**, and neuter run 3 is that measured rather than asserted |
| that consult Q5's duplicate coalescing still holds | `ledger.rs`'s `a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not`, first half — a marked state, then a **stamped** observation of exactly that state, answering `Duplicate`; and `commands.rs`'s `a_conflict_records_no_app_write_and_marks_its_refresh_for_coalescing`, which drives it through the real `save_raw_document` and a real `admit` |
| that a withheld state is **not** pre-coalesced away | the same ledger test's second half — a withheld state, then a stamped observation of exactly that state, answering `Admitted { sequence: 1 }` — and `a_disagreeing_post_save_refresh_announces_nothing_and_asks_for_a_stabilized_reading`, which asks the ledger the same question after driving the real tail. **This is the pair that discriminates the two doors**, and no test before this round drove it |
| that the phantom is superseded without ever being numbered | `ledger.rs`'s `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` — the sharpest ordering, with the worker admitting the final state **first** (sequence 1) and the save tail marking its earlier reading **second**; the owed request then answers with the state the engine tracks, at sequence **2**, and the tally ends `(admitted: 2, marked: 1)`. Before this round the same sequence ended with the phantom at sequence 2 and the truth at 3 |
| that neither serialized door can be refused by a clock | `ledger.rs`'s `a_serialized_door_reading_is_never_refused_by_the_records_own_instant`, extended to drive **both** doors against records stamped beyond every later clock read; and `commands.rs`'s `a_post_save_refresh_is_never_refused_when_no_clock_could_place_it_after_the_record`, whose claim is now about the tally and the record rather than about a publication |
| that the ledger's other decisions are unchanged | nothing new was needed and nothing was weakened: `decide`'s chronology, suppression, supersession and coalescing steps were not edited, and §3's table, §9.5's, §10.6's, §11.6's and §12.7's still pass |
| that the production save path always has a watcher to ask | **nothing**, and §5 item 19 is the standing statement of it — now sharper in the other direction than §12 left it: what a watcher-less workspace is left with is nothing rather than an uncorrectable phantom |
| that a consumer acts only on the highest sequence per document | **nothing here can drive it**, and since this round **nothing here depends on it**. §5 item 3's replacement no longer leans on Q3 at all |

**Five neuter runs**, each disabling exactly one thing and then restored, and each reverted with its
suites re-run green before the next was made:

- **the withholding door's silence** (`SerializedWithholding` inserting into `announced`, which is
  the brief's own starting hypothesis built as written) —
  `a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not` failed at *"Q2: nobody has
  this state, so the stabilized reading is queued as external"*, **left `Duplicate`, right
  `Admitted { sequence: 1 }`**: the swallowed change itself, measured. `a_serialized_door_reading_…`
  failed too, at *"it announces nothing"*. **18 passed, 2 failed** of the 20 ledger tests;
- **the marker** (`SerializedMarker` recording nothing) — three ledger failures, the sharpest being
  `a_marker_coalesces_…` at *"Q5: the person has this state already"*, **left `Admitted { sequence:
  1 }`, right `Duplicate`** — **17 passed, 3 failed** of 20 — and two `commands.rs` failures at the
  announced-state assertions, **76 passed, 2 failed** of 78;
- **the split itself** (`SerializedMarker` spending a sequence, which is the code exactly as round 6
  shipped it) — three ledger failures, every one of them `left: Admitted { sequence: n }, right:
  Marked`, **17 passed, 3 failed** of 20; and two `commands.rs` failures at the tally assertions,
  each printing `admitted: 1, marked: 0`, **76 passed, 2 failed** of 78. **This is round 7's High as
  a measurement**: putting the publication back is what these tests catch;
- **the conflict tail's door** (`conflict_after_the_lock` calling the withholding door) — two
  `commands.rs` failures at *"the refresh is announced as this path's coalescing marker"* and *"the
  disk side is announced once, so a native duplicate at it coalesces (Q5)"*, **76 passed, 2 failed**
  of 78. Q5's entry gone, and nothing else disturbed;
- **the post-save tail's door** (`after_a_save` calling the marking door — the trap the third door
  exists to avoid) — three `commands.rs` failures: `a_disagreeing_post_save_refresh_announces_nothing_…`
  at *"nothing is announced for this path"* (**left `Some(Content(…))`, right `None`**),
  `a_post_commit_external_replacement_supersedes_the_record_and_is_never_ours` at the same shape, and
  `a_post_save_refresh_is_never_refused_…` at the tally, printing `marked: 1, withheld: 0`. **75
  passed, 3 failed** of 78.

Each failure is narrow, and the two doors' neuters disturb **different** tests, which is what makes
them checks on the discrimination rather than on the split alone.

**One thing is deliberately not neutered**, and saying so is the point: nothing was removed to test
that the owed re-observation reaches the engine, because that is §11's and §12's mechanism and this
round did not touch it. §12.7's two `commands.rs` inbox neuters are the measurement of it, and both
of those tests still assert the ask beside their new assertions about what is announced.

### 13.6 What is guaranteed now, and what is not

**Guaranteed.** Everything §10.5, §11.5 and §12.6 guaranteed, **less the two sentences §12.6's
correction block names as falsified**. Added, and it is this round's whole claim: **no single
unstabilized read of this application's own spends a sequence or reaches the downstream sink.**
`WriteLedger::admit` is the only door that publishes, its readings are the engine's two equal
consecutive reads, and the two save-path doors have no way to reach the allocator — so the guarantee
is a property of which methods exist rather than of what a caller remembers. Added: consult Q5's
duplicate coalescing still holds, because the conflict tail's read is **announced** even though it is
not published, and a native duplicate at that document and revision therefore answers `Duplicate`.
Added: consult Q2's *the differing post-save observation is queued as external* is met by a reading
the engine stabilized, and the withholding door exists so that nothing pre-coalesces it away.

**Not guaranteed, and stated as such.** That a watcher is running to hear the ask (§5 item 19) —
which now decides whether **anything at all** is announced for a path a save tail read, where before
this round it decided whether a published single read was ever corrected. That the conflict payload
the person is shown describes a state that stably existed: it is one read, consult Q5 forbids a
second `document_text`, and the payload is bounded by being shown once (§5 item 3's first residue).
That a marker cannot overwrite a newer publication: the commit gate orders decisions and not real
time, so a stabilized state admitted just before the tail marks leaves the marker last, and the cost
is one duplicate announcement later rather than a phantom (§5 item 3's third residue). That a
re-observation survives a worker stopping before its next tick or an imminent workspace replacement
(§5 item 21). That an owed observation of an unchanged state costs no sequence (§5 item 22, rewritten
this round). That a debt belongs to the caller that asked for it (§5 item 14, fourth half). That a
caller of **either** serialized door holds the session lock (§5 item 14, third half — the obligation
is unchanged and now has two doors to hold it). That a producer's stamp precedes its reads, and that a
sink's answer is acted on (§5 item 14, first two halves). And everything §5's other items already
carried, unchanged by this round.

**What this round no longer needs to claim**: that consult Q3's highest-sequence rule makes anything
this step produces harmless. Nothing this step puts into the sequence needs a later value to correct
it, so the dependence §12.6 listed under *not guaranteed* is gone rather than still owed to 2d-4.
2d-4 must honour Q3 for its own reasons.

**Nothing from 2d-4 or later was added**: no Tauri event, no queue, no `drain_external_changes`, no
`#[tauri::command]`, no TypeScript, Svelte or i18n file, no writer, no force flag, no route around
`save_document`, and nothing new that serializes. **No core file was touched at all**, and
`cargo tree -p espansoconfig-core | rg tauri` still finds nothing.

> **Correction (round-8 fix round, §14).** One sentence in the *guaranteed* paragraph was false as
> written: *"consult Q2's `the differing post-save observation is queued as external` is met by a
> reading the engine stabilized, and the withholding door exists so that nothing pre-coalesces it
> away."* Nothing **pre-coalesced** it, and something else swallowed it: the app-write record the
> withholding door failed to clear when the reading matched it went on to suppress that stabilized
> reading through `decide`'s step 2. The guarantee holds as written only since §14. The
> `conflict_after_the_lock` sentence beside it — Q5's duplicate coalescing holding because the disk
> side is announced — had the same conditional hole, and for the same reason: no marker was
> installed on the path where `SelfWrite` was answered.
>
> The *not guaranteed* paragraph gains nothing and loses nothing, and §5's two new items (23 and 24)
> are additions to that list rather than corrections of it: the chronology anchor a supersession
> clears, and the announced-state map's own staleness.

### 13.7 The two sweeps

**For the shape** — *a value settled, installed, spent, published or consumed before the decision
that could reject it, or a single unstabilized read reaching the ledger* — is §13.4, including the
`rg`-derived enumeration of all **five** production paths into the ledger with the one that can spend
a sequence named, the full re-enumeration of the save path's arms against this round's code, and the
question asked of this round's own new code.

**For name positions**, as a pass distinct from the prose, and **redone from the current code rather
than from round 6's list**. Every count below is derived by counting what the document names:

- **`admit_under_the_session_lock` — the name itself was a name position.** It said *admit*, and
  admitting is what its callers may no longer do. Split into `mark_under_the_session_lock` and
  `withhold_under_the_session_lock`, and every present-tense mention swept: `ledger.rs`'s commit-gate
  bullet list, its *two proofs* section, its *what the types do not force* paragraph,
  `Admission::PrecedesACommit`'s doc, `stamp_the_record_at`'s doc, `commands.rs`'s module header,
  `run_one_save`'s section and both tails' sections;
- **`LedgerState::published` and `WriteLedger::published_state` — the same**, renamed `announced` and
  `announced_state`, because the map now holds two kinds of entry and only one of them was published.
  `record_app_write`'s *why the published state is invalidated* heading and `begin_epoch`'s *the
  published states* are amended with them, as is §2.8's first sentence and §1's headline paragraph;
- `src-tauri/src/main.rs`'s phase paragraph — **six**, re-derived by counting the facts it names, and
  unchanged: this round rewrote the fifth rather than adding a seventh. Its *what it publishes is
  kept* sentence is replaced;
- `src-tauri/src/commands.rs`'s module header — *composes with **five** other things*, now **six**,
  with the settlement rollback named (round 7's first Low). The count was checked by counting the
  list, against `main.rs`'s parallel six;
- `ledger.rs`'s `LedgerTally` doc — *counts **five** of the **six** decisions*, now **seven** of
  **eight**, re-derived by counting `Admission`'s variants and this struct's fields, with the
  sentence saying so; and `admitting_sink`'s *a **seventh** `Admission` is a compile error in this
  block*, now **ninth**;
- `2d-3-notes.md` §1's built list — *`Admission` (five decisions, six since §8)* and *`LedgerTally`
  (four counted decisions, five since §8)*, extended by counting, not by adding;
- **seven test names**, counted by listing them, each because the claim in the name changed:
  `a_conflict_records_no_app_write_and_admits_its_refresh_as_external` →
  `…_and_marks_its_refresh_for_coalescing`;
  `a_post_commit_external_replacement_is_admitted_and_never_recorded_as_ours` →
  `…_supersedes_the_record_and_is_never_ours`;
  `a_post_save_refresh_is_admitted_when_no_clock_could_place_it_after_the_record` →
  `…_is_never_refused_when_…`;
  `a_disagreeing_post_save_refresh_publishes_and_still_asks_for_a_stabilized_reading` →
  `…_announces_nothing_and_asks_…`;
  `a_conflict_refresh_publishes_its_disk_side_and_still_asks_for_a_stabilized_reading` →
  `…_marks_its_disk_side_and_still_asks_…`; plus `ledger.rs`'s
  `a_one_read_publication_is_superseded_by_the_state_the_engine_stabilizes` →
  `a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does` and
  `a_committed_record_invalidates_the_published_state_and_supersedes_itself` →
  `…_the_announced_state_…`. **Every mention of an old identifier in this record is amended in
  place**, including the ones inside past-tense round records, because an identifier is a pointer and
  a dangling pointer helps nobody — the same distinction §12.8 drew when it swept `hint_paths` out of
  a test comment and left it standing in three prose records of what round 5 built. What each round
  *did* is left exactly as it was written;
- **§2.6's heading is blocked rather than rewritten** — *the two save-path refreshes are observations,
  and they go through the same decision a native hint does* is now true of the checks and false of
  the outcome, and the block under it says which half is which. The heading's own argument, *external
  rather than self is one rule and not two that agree today*, is untouched and is what the section is
  for;
- **§5 item 3 is replaced, not annotated**, for the second time — the same treatment §8 gave item 10,
  §10 gave 16, §11 gave 18 and §12 gave 20 and 3. Items 2, 19 and 22 are amended;
- **searched and found current or deliberately left**, so the next round does not re-find them as
  misses: *"the two save-path refreshes"* wherever it appears — there are still exactly two and this
  round added no third, though what they do now differs from each other, which every present-tense
  site now says; `ReObserver::re_observe`'s *"the **five** production callers"* and
  `SessionSideOfASave::watcher`'s *"asked on exactly **five** arms"* — re-derived by counting the
  arms in `run_one_save`, `after_a_save`, `conflict_after_the_lock` and `after_an_uncertain_write`,
  still five, because this round changed what two arms *record* and not which arms *ask*;
  `watch.rs`'s *a save may ask* section, whose sentence *publishing a one-read state that never
  stably existed puts a phantom into the observation sequence* is a **reason** and is now also a
  description of what no door does; `admit_at_current_epoch` in §1's built list, §7.1, §8.1, §9.6 and
  §5 item 12, each a past-tense record of what a named round did; and `PROGRESS.md`'s three mentions
  of `admit_under_the_session_lock` (lines 3695, 8754, 8898), **left standing and named here**: two
  are past-tense records of what rounds 4 and 6 did, and the third sits under a *Where things stand
  after the round-5 fix* heading that dates it. `PROGRESS.md` is the orchestrator's file and its
  round-7 checkpoint is where that name is next written.

The rule applied throughout is §10.7's, unchanged: **a present-tense claim about how the code works
now is amended in place or blocked; a past-tense record of what a round built is left alone** — with
the identifier clause above as the one thing that crosses the line in both directions.

> **Correction (round-8 fix round, §14).** The second bullet above — the `published` → `announced`
> rename, *"every present-tense mention swept"* — was **not** complete, and it is the **eighth
> consecutive round** in which a name position outlived the sweep that claimed it. What the sweep
> took was the two identifiers and the two doc headings it names; what it left was every place the
> map is described in prose rather than named, and those are the places a maintainer reads a
> contract off: `ledger.rs`'s `WriteLedger` type headline (*"the published-state map"*) and its
> `LedgerTally::coalesced` field (*"the state already published for their path"*); `commands.rs`'s
> `WorkspaceSession::ledger` field, its `observing` constructor and its `open` documentation, plus
> one inline comment in `open`'s body. **A marker occupies that map with no sequence spent**, so each
> of those told a reader that every coalesced entry is sequence-backed, or — reading `open`'s
> and `record_app_write`'s wording together — that only publications are invalidated. All are
> amended, and so are the **assertion messages** that carried the same claim: five in `ledger.rs`
> (*"nothing was published"* twice, *"the state already published"*, *"the published states are
> discarded"*, *"invalidates what was last published"*) and three in `commands.rs` (two *"nothing is
> published"* and one test's doc headline). Where a sequence really was spent — `Admission::Admitted`,
> `SequenceSpaceExhausted`, `record_app_write`'s *nothing was published for this write*, the
> `AdmissionDoor` variants and every past-tense sentence about what round 7 removed — *published* is
> **kept**, which is the discrimination the rename exists to make.
>
> §14's own name sweep is §14.5, and the position the eighth round adds is a different one: every
> sentence anywhere saying that suppression is asked of every reading, or that step 2 proves the
> bytes differ.

---

## 14. The round-8 fix round

`docs/reviews/phase-2d-3-ledger.md` round 8 returned **NOT READY** with one High and two Lows, and
it is the eighth consecutive round whose finding was produced by the previous round's fix. All three
are closed here. What round 8 inspected and settled in the fix's favour before finding anything is
not re-argued below: the marker/withholding asymmetry itself, `Duplicate` reaching the withholding
arm first where an earlier announcement genuinely exists, a marker overwriting a newer publication as
over-reporting rather than silence, marker invalidation on commit, the explicitly recorded no-watcher
trade, and the absence of any core, wire, queue, event, command or frontend scope creep.

**This is the first round since round 6 whose High is a defect in behaviour rather than a sentence in
this record**, and it was found one step *above* where the brief pointed. The brief asked whether
`decide`'s shared steps 1–4 still mean the same thing for a door that will not announce, and named
step 4's `Duplicate` as the candidate; the reviewer cleared `Duplicate` and found the same shape in
step 2. The rule this round adds to the ones the previous seven left: **when a round splits one
caller into three, every step below the split that is still shared is a new question about each of
them, and *"that step was not changed at all"* answers a different one.** §13.4 wrote exactly that
sentence about the suppression predicate and read it as a clearance.

The corrections this round owes the record itself, counted by listing them: a block under the §1
headline and one amendment to the headline paragraph's own sentence about what the two tails go
through; a block under §2.6; two amended rows in §3's evidence table, one of them new; **two** new
§5 items, 23 and 24, neither of them a defect this round made; the round-8 column in §6's table with
its own count paragraph; blocks under §13.1, §13.4, §13.6 and §13.7; and two identifier amendments
in past-tense paragraphs (§3's neuter-run bullet and §10.6's evidence row), for §13.7's reason —
an identifier is a pointer and a dangling one helps nobody. **No correction is owed outside this
record**: `docs/decisions/2d-1-notes.md` §2.1's round-4 block says **two** of 2d-3's **three** ledger
callers place their reads without a stamp, and both numbers survive this round unchanged — they were
re-derived by naming the three callers, not read off. `main.rs`'s **six** facts survive too, and were
re-derived the same way: this round narrowed one existing check rather than adding a seventh
mechanism.

### 14.1 The High — suppression is the stamped door's question, because only a publication can misreport

**What the finding was.** Round 7 gave each save tail a door of its own and left `decide`'s steps 1–4
shared. Step 2 — `self_write_suppresses` against the app-write record — therefore ran **before the
door was consulted**, so a record that had gone stale could answer `SelfWrite` to a serialized
save-tail reading: retaining the record, announcing nothing, marking nothing, and returning above the
only two things that door exists to do.

**The reachable path needs no race, and the two premises were confirmed in the code rather than
assumed.** `committed_revision` (`commands.rs`) answers `Some` only for `Ok(SavedDocument {
committed: true, .. })`, so a save that commits nothing records nothing and the **previous** entry
stands; and `reload_document` is `session.reload(id)`, which touches the ledger **not at all**, so the
workspace can accept a foreign revision while the record still names an older app write. The
reviewer's sequence: the app commits A and records A → the watcher misses an external B →
`reload_document` accepts B into the workspace → an unchanged save of B returns `committed: false`,
so no new record replaces A → an external writer restores A before `after_a_save` refreshes → the
refresh observes A ≠ the saved B and enters the withholding door → `decide` answers `SelfWrite`,
retains A, and the **owed stabilized reading of A that the same tail asks for on the next line meets
the same record and is suppressed in its turn**. Consult Q2's *the differing post-save observation is
queued as external* is met by nothing at all — round 3's swallowed change, reached through the check
above the door rather than through the door.

**What it cost on each door.** On the withholding door, everything: that door's *only* effect is the
record removal, so a `SelfWrite` answer is no effect at all, and the suppression then propagates to
the owed reading. On the marking door, consult Q5's coalescing entry — the thing that stops a native
duplicate at the same document and revision raising a **second** conflict at 2d-5 — plus the same
record removal.

**The fix is the reviewer's, and the argument for it is narrower than *the record might be stale*.**
Suppression exists for one purpose, and consult Q2 states it in the same breath as the rule: *keep a
matching entry long enough to absorb the several native notifications one atomic replacement may
generate*. A **native notification** arrives through exactly one door. A serialized caller brings a
read it performed itself, under the session lock, after the record, through a door that since §13
cannot publish — and the mistake suppression prevents is *reporting this application's own write as
somebody else's*, which is something only a **publication** can do. So the check has no work to do on
those two doors and only harm to do, and that is true whether or not the record is stale. `decide`'s
step 2 is now a `match door` structurally identical to step 1's, and the enum is matched three times
rather than twice, so a fourth door cannot be added without answering this question for itself.

**This is Q2 followed more exactly rather than a deviation from it**, and the consult's own two
sentences are the reason. Its ruling is scoped to *a **stable** observation*, and a single save-tail
read is precisely what this record has said since §12 is **not** one; and the truthful sentence §3
quotes verbatim — *"this application ignores a **filesystem hint** when the bytes now on disk hash to
the latest revision it recorded"* — describes what suppression now does and only that. Where §14
does go beyond Q2's letter is the **clearing** rule, which names three events (a different stabilized
revision accepted, the next committed app save, workspace replacement) and not this one; §13 already
crossed that line, since a `Withheld` reading is neither stabilized nor a commit and its whole effect
is the removal. §14 extends it to a serialized reading that finds the recorded bytes, and §14.1's
*what clearing gives up* is the price paid for it, stated rather than assumed away.

**Where a serialized reading equals the entry it meets, that entry was never taken by the running
transaction** — the fact that makes the narrowing safe rather than merely useful, and it was derived
from the two call sites rather than assumed: `conflict_after_the_lock` runs on the
`RevisionMismatch` arm, where `committed_revision` is `None` and nothing was recorded; `after_a_save`
reaches its door only where the refresh **disagrees** with the revision its transaction last saw,
which no record of that transaction can equal. So the entry a `SelfWrite` used to protect on these
doors was always an **earlier** save's. **The narrower sentence is deliberate**: `after_a_save` on a
committed save is decided against its own transaction's record, and it always was — that reading
simply differs from it, which is why the fix changes nothing there.

**What clearing that entry gives up, stated rather than smoothed over.** Two things, and they are
different on the two doors:

- **the suppression of that earlier write's own pending native hints.** On the **marking** door the
  marker takes the job over **while it stands**: the state goes into `announced`, so a hint
  stabilizing at it answers `Duplicate` instead of `SelfWrite` — a different counter, the same
  silence, and nothing reaches a consumer. The new `commands.rs` test asserts exactly that
  `Duplicate` rather than leaving it to be reasoned about. **What *"while it stands"* excludes was
  walked rather than waved at**: a later committed save removes the marker with `record_app_write`
  and puts its own record there, and a hint of the older bytes then meets the chronology check —
  refused as older if its reads preceded that record, and if they did not, then its reads saw the
  disk at or after the newer rename, so bytes equal to the marker's mean somebody wrote them back
  and announcing them is correct. A differing publication in between replaces the marker, which is
  §5 item 3's third residue unchanged. On the **withholding** door nothing takes it over, and such a hint is
  **published**. That is deliberate: the door is reached only where an external write landed between
  a save's locked read and its read-back, so the bytes announced are bytes somebody else wrote, and
  announcing a state the disk demonstrably holds is over-reporting where the alternative is silence
  about an external change. The review asks for precisely this behaviour — its prescribed regression
  requires that a **stamped** admission of A after a withholding be *admitted*;

  > **Correction (round-9 fix round, §15; round 9's second Low).** *"Over-reporting"* is the wrong
  > name for that publication, and calling it one understates what the code is right about. The
  > withholding door's own premise is that the file no longer holds the revision its transaction last
  > saw, so a **real post-read disk transition** is established before the door is reached; a later
  > hint at bytes that happen to equal an earlier app write is therefore a **genuine external change
  > whose bytes happen to equal an earlier app revision**, and byte equality with something this
  > application once wrote does not make that transition false. The standing prohibition is
  > unchanged and is the only thing suppression ever licensed: **byte identity, never authorship** —
  > nothing here may claim the write was ours. `ledger.rs`'s module section and
  > `WriteLedger::withhold_under_the_session_lock` carry the corrected wording;
- **the chronology anchor for readings older than that record**, which is §5's new item 23. Step 1
  refuses only while an entry stands. This is **not new**: supersession has cleared the anchor on
  every accepted differing state since this module was written, which is the ordinary external
  conflict. §14 widens the inputs that reach it by one class rather than adding a class, and the
  round that widens a hole is the round that owes the sentence.

  > **Correction (round-9 fix round, §15; round 9's second High).** This bullet is **no longer a
  > cost**, because clearing a record no longer clears anything else. The instant moved out of the
  > record and into a per-path `CommitAnchor` whose life is the epoch, so *step 1 refuses only while
  > an entry stands* is false of the shipped code: it refuses while an **anchor** stands, and only
  > `begin_epoch` removes one. See §5 item 23's closure block.

### 14.2 The three questions the brief required answered in writing

**1. Step 3's own justification becomes false, and here is the true one.** `decide`'s step 3 —
supersession, unconditional — justified needing *"no condition of its own"* on the ground that *"a
`Content` state reaching here was already proved by step 2 not to be the recorded bytes."* With step
2 door-scoped, a serialized `Content` state can reach step 3 and **be** the recorded bytes. The
restated argument is two arguments, one per class of door, and the doc comment now carries both: for
a *stamped* reading, step 2's proof, unchanged; for a *serialized* one, that the reading was taken
under the session lock after the record in program order, by a tail that has already classified it,
against an entry no running transaction of this session took — so the entry's licence has outlived
the last reading that could spend it, and spending it is what stops it suppressing the owed
stabilized reading. Step 3 still needs no condition; what changed is that the sentence justifying
that is no longer one sentence.

**2. Can clearing on a serialized door let this application's own write be announced as an external
change?** Worked through for both doors, and the answer is *no* on one and *over-reporting* on the
other — never silence, and never a false claim of authorship, which the predicate is forbidden to
make in either direction. Marking door: an app write of A leaves a record and pending native hints; a
later conflict tail reads A, clears the record and **marks** A; the hints then stabilize to A and
meet the marker, answering `Duplicate` — coalesced, no sequence, nothing downstream. Withholding
door: the same chain minus the marker, so such a hint is published. That is the standing judgement of
this record applied to a new input — the same one §5 item 3's third residue takes for a marker
overwriting a newer publication — and it is bounded by what the withholding door requires to be
reached at all: the file must have moved away from the transaction's own last read and back to the
recorded bytes, so what is announced is a state an external writer put there.

**3. Was the root-cause fix better?** It was weighed and **rejected**, and this is the round's one
deviation-shaped decision, offered for the next round to judge first. The root-cause candidate is to
clear the record where it actually goes stale — when the workspace accepts a foreign revision through
`reload_document`, or when a save commits nothing. Four reasons against, in the order they decided it:

- **it does not fix the door.** The staleness is not caused by `reload_document`; it is caused by the
  record's suppression licence outliving the last reading that could spend it. Every other read path
  that does not go through the ledger — `WorkspaceSession::document`, `text`, and whatever 2d-4 and
  2d-5 add — re-creates the same gap, and the *next* one would be found by round 9. The door-scoped
  fix is a statement about which readings the check is **for**, which no new read path can falsify;
- **the obvious version of it is wrong in the dangerous direction.** Clearing on a reload whose read
  *equals* the record would unsuppress that write's own pending native hints with nothing announced
  to absorb them — a false external change, which is the one outcome this module may not produce.
  Clearing only when it differs is defensible, but it is a different fix from the one that closes
  this finding, and it closes none of this finding;
- **it needs a fourth mutation path into the ledger, from a read-only command.** `record_app_write`
  is the ledger's only producer and `begin_epoch` its only bulk eraser; the exhaustively matched
  `AdmissionDoor` exists so that a new way in is a compile error rather than a skipped case. Making
  `reload_document` mutate the ledger also changes what that command *is*, which is a widening of the
  command surface this step's scope bound forbids;
- **the fact it wants to record belongs to a layer that does not exist yet.** *What has the consumer
  accepted* is the coordinator's fact: consult Q3 and Q5 give 2d-5 a **per-document accepted
  sequence**, and that is where a reload and an observation can be reconciled by construction rather
  than by two maps agreeing. §5 item 24 records the same gap in the announced-state map and defers it
  the same way, deliberately and in writing rather than by omission.

> **Correction — the rejection is REVERSED (round-9 fix round, §15; round 9's first Low, and the
> Highs it left standing).** Reload-time invalidation is **built**, and this item's four reasons are
> corrected one by one. **Two of them were factually false**, and both were re-checked in the code
> rather than argued:
>
> - *"every other read path re-creates the same gap — `WorkspaceSession::document`, `text`."* **False.**
>   `document` is `workspace.document_view(id)` and `text` is `workspace.document_text(id)`, both
>   **cached** reads that install nothing this session did not already hold. Only `reload` calls
>   `Workspace::refresh`, which re-reads the file. The enumeration is `rg '\.refresh\('` over
>   `src-tauri/src/`, which finds exactly **three** call sites — `WorkspaceSession::reload`,
>   `conflict_after_the_lock` and `after_a_save` — and on every arm where one of them **accepts a
>   revision the session did not already hold** the ledger is told: the last two through their own
>   doors since round 7, and `reload` since this round. (The arms that tell it nothing accepted
>   nothing: an `Err` from `refresh` returns before it touches the cache, and `after_a_save`'s
>   agreeing arm found the revision its transaction already had.) So the gap had one hole, not an
>   open set;
> - *"it needs a fourth mutation path into the ledger, from a read-only command … a widening of the
>   command surface this step's scope bound forbids."* **False on the second half.** `reload` already
>   mutates the workspace cache; mutating private session state adds **no command**, changes no
>   command signature, puts nothing new on the wire and writes no user file, none of which the scope
>   bound touches. The first half is true and is answered by shape rather than by refusal: the new
>   entry point is **not a door** — it brings no reading, builds no `AdmissionDoor`, answers no
>   `Admission`, spends no sequence and announces nothing. It only removes.
>
> **The second reason survives and is honoured**: *"the obvious version of it is wrong in the
> dangerous direction — clearing on a reload whose read equals the record would unsuppress that
> write's own pending native hints with nothing announced to absorb them."* Exactly so, which is why
> both invalidations are conditioned on **differing**, and why the same rule protects consult Q5's
> marker from *Reload disk version*. What this item got wrong about it is the next clause — *"it is a
> different fix from the one that closes this finding, and it closes none of this finding"* — which
> is true and is **not a reason against building it**: door-scoping and reload-time invalidation are
> **complementary**, and round 8 needed both. Door-scoping is right about *which readings suppression
> is for* whatever made the entry stale, and a `committed: false` save still leaves an earlier entry
> standing, so §14.1's argument is unchanged rather than superseded.
>
> **The fourth reason is refuted on its own terms** by round 9's third High: `Duplicate` sends 2d-5
> **no value to arbitrate**, so a per-document accepted sequence cannot reconcile a state the
> coordinator never receives. Accepted-sequence arbitration is the right mechanism for observations
> that actually reach the coordinator, and only for those.
>
> **And the first reason's own prediction came true against it**: it said *"the next one would be
> found by round 9."* Round 9 did not find a new read path; it found that the one this item had
> already named was still open, and that a second map had the same hole.

### 14.3 The two Lows

**Low 1 — the record predicted what the code did not do.** §13 says the serialized doors answer
`Marked`/`Withheld`, that a disagreeing post-save read clears its record, and that withholding
ensures the stabilized reading is queued; in the stale-record case the code answered `SelfWrite`,
retained the record and suppressed the owed observation. The behaviour was fixed first and the record
made true of it second, which is the only order that works: §2.6's *"that is correct and is the
predicate's own limit"* paragraph and its round-4 block's *"the same suppression"* clause, §13.1's
two door bullets, §13.4's arm list and its *"not changed at all"* clearance, §13.6's Q2 and Q5
guarantees, and §3's evidence rows all carry blocks or amendments naming which checks are actually
door-specific. The stale-record case is **added to the evidence** as its own row, and §5 items 23 and
24 record what the fix leaves open.

**Low 2 — the eighth consecutive name-position miss.** §13.7 claimed the `published` → `announced`
sweep complete; it had swept the two **identifiers** and left the map's description in **prose**, in
six present-tense positions plus their assertion messages. The correction block under §13.7 lists
every position and, as importantly, every place where *published* is **kept** because a sequence
really was spent. The shape rather than the words: the sweep looked for the old identifier, and the
false contracts were the ones that never named it.

### 14.4 The sweep for the shape, not for the words

The question, asked of this round's own change: *is there any other place where a rule shared by
several callers is applied to a value whose caller has already answered it, or where a map or record
this ledger keeps can be made stale by something outside the ledger?*

**`decide`'s five steps were re-enumerated one at a time against the three doors**, which is the
enumeration round 8's High shows this record had never actually made:

1. **chronology** — door-scoped since §10. Asked of the stamped door only, correctly;
2. **suppression** — door-scoped by this round. The finding;
3. **supersession** — shared, and it is a *mutation* rather than a check, so the shape does not
   apply; its justification is restated per door in §14.2 item 1 rather than left resting on step 2;
4. **coalescing** — shared, and it means the same thing for all three doors: *does a consumer already
   have this state*. Round 8 cleared it and the re-check agrees — a serialized reading that finds its
   own state already announced has nothing to add, and the record has been cleared above it either
   way. **But the map it consults can go stale exactly as the record could**, which is §5's new item
   24, found here and deferred with its reasons rather than closed;
5. **what the door may do** — three sibling arms of one match, each performing its own and only its
   own, unchanged.

**Every production path into the ledger was re-enumerated with `rg` rather than recalled** — the same
search §13.4 used — and there are still exactly **five**: `open` → `begin_epoch`, `commit_and_record`
→ `record_app_write`, `conflict_after_the_lock` → `mark_under_the_session_lock`, `after_a_save` →
`withhold_under_the_session_lock`, and `admitting_sink` → `admit`. This round added none and removed
none; what it changed is which checks the third and fourth are asked.

**`admitting_sink`'s exhaustive match was re-checked** and is untouched: `SelfWrite` is still
reachable from its own door, and its comment — *"`SelfWrite` and `Duplicate` are answers about these
exact bytes, and re-reading them yields the same answer"* — is still true of the door that sink calls.

**This round's own new code was asked the same question.** The new step 2 returns early, exactly as
before, and returning early above step 3 is a licence only the two retaining checks have — the
narrowing removes uses of that licence and adds none. It reads no value it then acts on outside the
state guard, spends nothing, and consumes nothing; there is no check-and-spend shape in it, because
there is nothing to spend. And the `match state` inside it is exhaustive rather than an `if let`, so a
fourth `ObservedState` is now a compile error here too, where before it silently fell through to
*not a self-write*.

**One thing this round does not claim**: that a fourth door could not be added wrongly. The enum makes
adding one silently a compile error in three places; nothing makes its author choose the right arm in
any of them.

### 14.5 The sweep for name positions

Distinct from the prose sweep, and this round has **two** positions to sweep rather than one.

- **The one round 8's Low names** — every present-tense description of `LedgerState::announced` as a
  *published* state, in prose that never uses the identifier. Listed exhaustively in the correction
  block under §13.7, with the places *published* is deliberately kept listed beside them;
- **the one this round's own change creates** — every sentence anywhere saying that suppression is
  asked of **every** reading, or that step 2 proves the bytes differ. Swept and amended: `ledger.rs`'s
  `AdmissionDoor` headline (*decides **two** things* → **three**, and *survives every check* →
  *survives the checks its door is asked*, in the headline and in two of the three variants — the
  stamped variant keeps *every check* and says it is the one door asked all of them),
  `Admission::SelfWrite`, `Admission::Marked`, `Admission::Duplicate`, `Admission::Withheld`,
  `LedgerTally::suppressed`, `decide`'s step list and its *step 1 sits above step 2* paragraph, its
  *no public sequence can reach step 4 with a record standing* argument, the `recorded` lookup's own
  comment, both serialized entry points' doc comments; `commands.rs`'s module header, `run_one_save`'s
  *both refreshes* paragraph (*two things differ* → **three**, with the count re-derived by counting
  the list), `conflict_after_the_lock`'s *the refresh is external* section, `after_a_save`'s
  *a refresh that disagrees* section, and both inline call-site comments; and `main.rs`'s phase
  paragraph.

**One test name changed**, because the claim in the name changed:
`a_conflict_against_this_apps_own_committed_bytes_is_suppressed` →
`…_is_marked_rather_than_suppressed`. Every mention of it in this record is amended in place,
including the two inside past-tense round records, per §13.7's identifier rule; what each round *did*
is left as written.

**Searched and found current or deliberately left**: `watch_check.rs`'s two suppression tests and its
module header, which are about the **stamped** door throughout and are untouched by this round —
their positive wait on `tally().suppressed` still bites, and still bites for the same reason;
`ledger.rs`'s *a self-write hint stamped before its own record is counted as `preceded_a_commit`*,
which is a statement about the stamped door and stays true; `commands.rs`'s round-1 narrative of
*"self-write suppression having already failed"*, a past-tense description of a defect's shape; and
`PROGRESS.md`'s two present-tense *"published-state map"* descriptions (lines 110 and 9187),
**left standing and named here** because that file is the orchestrator's — its round-8 checkpoint is
where this round's names, the renamed test and the announced-state map alike, are next written.

### 14.6 What changed, file by file

- **`src-tauri/src/ledger.rs`** — `decide`'s step 2 becomes a `match door` producing
  `suppressed_as_a_self_write`, with the predicate reached only through
  `AdmissionDoor::StampedPublication` and the state match inside it made exhaustive. `decide`'s
  contract documentation gains the door restriction in step 2 and a two-bullet restatement of step
  3's justification; `AdmissionDoor` says it decides **three** things and is matched **three** times;
  `Admission::SelfWrite` and `LedgerTally::suppressed` say which door can produce them; both
  serialized entry points say which two steps they are not asked and what the exemption costs; and
  the module gains a section, *suppression is the stamped door's question, because only a publication
  can misreport*. **One test added**, `a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes`,
  which drives both serialized doors against a record naming the bytes they read, the owed stamped
  reading after the withholding, and — as its third leg — the discrimination that the same record and
  the same bytes through the **stamped** door are still `SelfWrite`. Five assertion messages amended
  for the name sweep;
- **`src-tauri/src/commands.rs`** — no behaviour of its own changed: both tails call the same two
  doors on the same arms. Its documentation is what moved — the module header, `run_one_save`'s
  *both refreshes* paragraph, `conflict_after_the_lock`'s *the refresh is external, and the ledger is
  told so rather than fed* section (whose *exactly one case answers self-write* paragraph was the
  sharpest false sentence this round found in the code's own documentation), `after_a_save`'s
  *a refresh that disagrees* section, and both inline call-site comments. **No test added; one
  renamed and its four assertions replaced** — `a_conflict_against_this_apps_own_committed_bytes_is_marked_rather_than_suppressed`
  now asserts the record gone, the marker installed, `suppressed: 0, marked: 1, admitted: 0`, and a
  following native hint answering `Duplicate`. Four name-position amendments and three assertion
  messages;
- **`src-tauri/src/main.rs`** — the phase paragraph's *go through the same checks a native hint
  meets* becomes the two shared steps plus the two retaining checks neither door is asked. Its count
  of **six** facts is unchanged and was re-derived by counting them;
- **no core file, and no `src/` path.**

### 14.7 The evidence and the neuter runs

| Owed | Where |
|---|---|
| that a stale record cannot suppress a serialized reading of its own bytes | `ledger.rs`'s `a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes` — both doors, `Marked` and `Withheld`, the record gone in both, and the whole tally asserted `(suppressed: 1, marked: 1, withheld: 1, coalesced: 1, admitted: 1)` |
| that the withheld state's owed stabilized reading is then **queued as external** (consult Q2) | the same test's fifth assertion: after the withholding, a **stamped** admission of exactly those bytes answers `Admitted { sequence: 1 }`. This is the half the review named, and no test before this round could reach it |
| that consult Q5's coalescing entry is installed where a `SelfWrite` used to withhold it | the same test's third assertion, and `commands.rs`'s `a_conflict_against_this_apps_own_committed_bytes_is_marked_rather_than_suppressed` driving it through a **real** `save_raw_document` conflict against this session's own committed bytes |
| that the marker takes over the suppression of that write's own pending hints | both tests' final assertion — a **stamped** hint at the marked bytes answering `Duplicate`, which is the same silence through a different counter |
| **that the check was narrowed and not removed** | the same ledger test's third leg: the same record and the same bytes through the **stamped** door still answer `SelfWrite` and still retain the record. Also `the_recorded_revision_is_suppressed_and_survives_duplicate_hints`, unchanged, and `watch_check`'s production-path positive wait on `tally().suppressed`, unchanged and still green |
| that nothing else about the ledger's decisions moved | `decide`'s chronology comparison, supersession step and coalescing comparison were not edited; §3's table, §9.5's, §10.6's, §11.6's, §12.7's and §13.5's all still pass |
| that a record made stale by `reload_document` is repaired | **nothing, and deliberately** — §5 item 24 and §14.2 item 3 are the standing statement. What this round guarantees is that a save tail's own reading can always spend the licence; a path with no save tail and no watcher hint still cannot |

**The gates were run on the finished tree**, and the scar in §6's table paragraph bit before they
were: `cargo test --workspace` **1263 passed, 0 failed** (exit 0, 26 `test result` lines summed,
twice on a quiet host — the second run after the neuters were reverted, so the figure describes the
tree as it stands);
focused serial `watch_check::` **20 passed, 0 failed** (81.03 s); `cargo clippy --workspace
--all-targets -- -D warnings` clean (exit 0); `cargo fmt --check` clean (exit 0, nothing to format);
`cargo tree -p espansoconfig-core | rg tauri` empty. The frontend three are **carried, not
measured**, on the warrant of the file list in §14.6 — no `src/` path was opened.

**Three neuter runs**, each disabling exactly one thing and then restored, with the suites re-run
green before the next was made:

- **the whole fix** (both serialized doors routed back through the predicate, which is the code
  exactly as round 7 shipped it) — `a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes`
  failed at *"a serialized reading is not one of the native hints suppression absorbs"*, **left
  `SelfWrite`, right `Marked`**; **20 passed, 1 failed** of the 21 ledger tests. And in `commands.rs`,
  `a_conflict_against_this_apps_own_committed_bytes_is_marked_rather_than_suppressed` failed at *"the
  marking door supersedes the record it was decided against"*, **left `Some(AppWrite { epoch: 1,
  revision: … })`, right `None`** — **77 passed, 1 failed** of 78. This is round 8's High as a
  measurement on the production path, not only in the ledger. **Both figures were re-measured by
  running each whole suite under the neuter**, because the first pass ran the single test by name and
  the round's own review caught the suite totals being *inferred* from that — the one defect class no
  test can fail;
- **the withholding door's half alone** (the marking door left exempt, the withholding door routed
  back through the predicate) — the same ledger test failed at *"the same exemption, on the door
  whose only effect is the record"*, **left `SelfWrite`, right `Withheld`**; **20 passed, 1 failed**
  of 21, and `commands.rs` stayed green. That is what makes the test a check on **each** door rather
  than on the pair;
- **the marking door's half alone** is the first neuter's `commands.rs` failure, which is why it is
  not run a third time as its own: the `commands.rs` test drives only the marking door, so its
  failure above already isolates that half on the production path.

**One thing is deliberately not neutered**: nothing was removed to test that the owed re-observation
reaches the engine, because that is §11's and §12's mechanism and this round did not touch it.

### 14.8 What is guaranteed now, and what is not

**Guaranteed.** Everything §10.5, §11.5, §12.6 and §13.6 guaranteed, less the two sentences §13.6's
correction block names as conditional. Added, and it is this round's whole claim: **no reading a save
tail took itself is ever answered *self-write*, so neither serialized door can be prevented from
doing the one thing its door exists to do.** In particular consult Q5's coalescing entry is installed
whenever `conflict_after_the_lock`'s refresh succeeds, and consult Q2's *the differing post-save
observation is queued as external* is met by the owed stabilized reading **unconditionally** rather
than only where the app-write record happened not to name the same bytes.

**Not guaranteed, and stated as such.** Everything §13.6 lists, unchanged — a watcher running to hear
the ask (§5 item 19) above all — plus the two items this round adds. **§5 item 23**: clearing a record
clears the chronology anchor with it, so a reading stamped before that record has nothing to refuse
it; pre-existing, widened by one input class here, and closable only by a design change that gives
the anchor a life of its own. **§5 item 24**: the announced-state map can go stale exactly as the
record could, because `reload_document` tells it nothing either, so a revert to a state the person
has already navigated away from can coalesce into silence; deferred to 2d-5's per-document accepted
sequence with its reasons written down. And, unchanged and now doubly relevant: nothing here may
claim an ignored event *was ours* — byte identity, never authorship.

**Nothing from 2d-4 or later was added**: no Tauri event, no queue, no `drain_external_changes`, no
`#[tauri::command]`, no TypeScript, Svelte or i18n file, no writer, no force flag, no route around
`save_document`, and nothing new that serializes. **No core file was touched at all**, and
`cargo tree -p espansoconfig-core | rg tauri` still finds nothing.

> **Correction to §14.8 (round-9 fix round, §15).** Both items in the *not guaranteed* paragraph are
> now **closed in code**, and both were real defects rather than acceptable residues: §5 item 23 was
> round 9's second High and §5 item 24 was its third. Their closure blocks in §5 carry the detail.
> §14.8's *guaranteed* paragraph survives unchanged — round 9 cleared round 8's whole argument.

---

## 15. The round-9 fix round

`docs/reviews/phase-2d-3-ledger.md` round 9 returned **NOT READY** with **three Highs — all defects
in behaviour — and four Lows**, the largest round of this review's tail. All seven are closed here.
What round 9 inspected and settled in round 8's favour before finding anything is not re-argued
below: the door split itself, a marker as a user-visible save-conflict fact rather than a
sequence-backed external report, the serialized clearing extension for both tails, a marker
coalescing pending matching hints while its entry stands, withholding permitting the externally
restored revision to publish, and the three defects the round-8 fix round self-caught.

**The three Highs are one root cause: nothing told the ledger when the workspace accepted a foreign
revision.** `reload_document` re-read the file into the session's cache and touched the ledger not at
all, so the app-write record and the announced state could both go on describing a state the session
had moved past — and clearing the record, which is what round 8 taught the serialized doors to do,
took the chronology anchor with it.

**Two of the three Highs are §5 items 23 and 24**, written by the round-8 fix round one round ago as
honestly bounded residues and deferred in writing. That makes **seven** §5 items so recorded and
later found to be real defects: item 10 (round 2), 16 (round 4), 18 (round 5), 20 and 3 (round 6),
and now 23 and 24 (round 9). §15.7 writes this round's own residues with that expectation stated
rather than implied.

### 15.1 The reversal §14.2 owed, said plainly

**§14.2's rejection of the root-cause fix is REVERSED**, and the correction block under it says so in
place. Two of its four reasons were **factually false**, and both were re-checked in the code:

- `WorkspaceSession::document` and `text` do **not** "re-create the same gap" — they are
  `workspace.document_view(id)` and `workspace.document_text(id)`, cached reads that install nothing.
  `rg '\.refresh\('` over `src-tauri/src/` finds exactly **three** `Workspace::refresh` call sites in
  this crate — `WorkspaceSession::reload`, `conflict_after_the_lock` and `after_a_save` — and the
  last two already tell the ledger through their own doors on every arm that accepted anything. The
  gap had **one** hole;
- making `reload` mutate private ledger state is **not** "a widening of the command surface this
  step's scope bound forbids". It adds no command, changes no signature, puts nothing new on the
  wire and writes no user file. `reload` already mutates the workspace cache.

**One reason survives and is honoured, and it is the one that decides the shape of the fix**: the
obvious version *is* wrong in the dangerous direction. Clearing a record whose bytes a reload just
read would unsuppress that write's own pending native hints with nothing announced to absorb them —
a false external change, the one outcome this module may not produce. So **both invalidations are
conditioned on differing**, and the equal cases are kept deliberately.

The fourth reason — defer to 2d-5's per-document accepted sequence — is refuted on its own terms by
High 3: **`Duplicate` sends that layer no value to arbitrate.** Accepted-sequence arbitration is the
right mechanism for observations that reach the coordinator, and only for those.

**And the two fixes are complementary, not alternatives.** Door-scoping is right about *which
readings suppression is for* whatever made an entry stale, and a `committed: false` save still leaves
an earlier commit's entry standing with nothing outside the ledger to clear it. §14.1's argument is
unchanged rather than superseded, and `ledger.rs`'s *suppression is the stamped door's* section now
says which of its two example routes round 9 closed and which it did not.

### 15.2 High 1 and High 3 — a reload reports what the workspace accepted

**One new entry point**, `WriteLedger::adopt_reloaded_revision_under_the_session_lock(path,
revision)`, called from `WorkspaceSession::reload` inside `with_workspace`'s closure. It takes the
gate and then the state, once, and under that one guard:

- removes the path's **app-write record** (and its path-index entry) when the record names a
  **different** revision — High 1. Left standing, the stamped door — the one door still allowed to
  suppress — answered `SelfWrite` to a genuine external return to the recorded bytes, and that change
  never entered the sequence;
- removes the path's **announced state** when it is **not** this state — High 3. Left standing, a
  genuine external return to the announced bytes answered `Duplicate`, which is round 3's swallowed
  change reached through coalescing.

Both mutations are under the one state guard, so no decision can observe one without the other, which
is the atomicity the review asked for.

**It is not a door and not a writer.** It brings no reading, builds no `AdmissionDoor`, answers no
`Admission`, spends no sequence, moves no tally and announces nothing. It only removes. That is why
the `AdmissionDoor` enum is untouched and still matched three times: a door exists to decide what a
*reading* may do, and there is no reading here.

**Why a `ContentRevision` and not an `ObservedState`**: a successful reload can only ever have read
content — an absence or an unreadable state is an `Err` from `Workspace::refresh` — and a parameter
that could express one would be a parameter a later edit could use to report a state nobody observed.

**A failed reload tells the ledger nothing, and that was checked rather than assumed.**
`Workspace::refresh` does `read_utf8(&…path)?` **before** it touches `entries[position].loaded`, so an
`Err` leaves the cache exactly as it was: the session accepted nothing, and there is nothing to
invalidate. This is the same rule the two save tails keep for their own failed reads.

**The path is resolved before the re-read, deliberately.** `document_context` and `refresh` both begin
with the same `position_of(id)` lookup, so an unknown `DocumentId` fails at the first call with
exactly the error it failed with before, and **no arm can reach a successful reload that then skips
the invalidation**. Ordering them the other way would have made the ledger call depend on a second
fallible lookup that cannot fail today.

### 15.3 High 2 — the anchor outlives the record

`RecordedWrite` is **gone**. `LedgerState::writes` now holds a bare `AppWrite`, and the instant lives
in a new `LedgerState::latest_commit_at: BTreeMap<PathBuf, CommitAnchor>`, where
`CommitAnchor { epoch, at }`.

The fix is *which value the instant lives in*, and the reason is that the two facts have different
lifetimes:

- the **record** lives as long as its suppression licence is honest. Four things end it:
  supersession, a serialized reading, a reload onto other bytes, and a workspace replacement;
- the **anchor** lives as long as the **epoch**. `record_app_write` writes it under the same state
  guard as the record, so no decision can see one without the other; `begin_epoch` is the only thing
  that removes one.

`decide`'s step 1 now reads `commit_anchor_at(ledger, path)` and does not read the record at all;
step 2 reads `record_at(ledger, path)` and does not read a clock. Two helpers rather than two inline
traversals, so *which entry this path has* is one statement per question rather than one per reader.

**Keyed by path, not by `DocumentId`**, and that is structural rather than an economy: step 3 removes
the `documents_by_path` entry that a path-to-record lookup goes through, so an anchor behind that
index would become unreachable at exactly the moment it has to keep answering.

**Widening the refusal is safe in the direction that matters.** A refusal at the stamped door is
*answered*: `admitting_sink` returns `Undecided`, `deliver` takes the engine's settlement back, the
path is re-hinted, and the re-observation's own stamp is taken after the anchor — so it cannot be
refused by the same anchor twice, and no re-observation loop exists. In steady state the anchor is
inert: every observation produced after this session's last commit to a path beats it.

> **Correction (round-12 fix round, §18.1).** *"So it cannot be refused by the same anchor twice, and
> no re-observation loop exists"* is **false as a guarantee**, and this paragraph is a **narrower
> instance of round 12's first High that the reviewer did not name** — found by §18.5's shape sweep,
> two per-round sections above the four positions the finding lists. The re-observation's stamp
> follows the anchor in **program order** only; `Instant` is monotonic and expressly not guaranteed
> strictly increasing, `decide` compares `read_after <= at` and so puts equality on the **refusing**
> side (`ledger.rs`'s own comment above that comparison says exactly this, and the test helper
> `later_than_now` exists because of it), so a clock collision refuses the re-reading again against
> the same anchor. A short re-observation loop therefore **does** exist in principle and is bounded
> by the host clock advancing rather than by construction — bounded in the safe direction, since
> every one of those refusals is answered by a re-observation and none publishes anything. The
> module doc this paragraph describes now carries the concession in the same sentence as the claim.

> **Correction (round-13 fix round, §19.1).** The **round-12 correction block directly above** closed
> one premise and shipped another in its own last two lines: *bounded by the host clock advancing
> rather than by construction — bounded in the safe direction, since every one of those refusals is
> answered by a re-observation and none publishes anything*. That is round 13's first High, at the
> position where round 12 wrote it. The clock advancing bounds only the run of **repeated chronology
> refusals once another settlement for that path is produced**, and nothing produces one: a path being
> written continuously never stabilizes (`observe_owed`'s own doc), `crate::watch::ReObserveOutcome`
> says an `Asked` promises a worker's inbox and not an observation, and the worker can take `Stop`
> before its next tick (§5 item 21). So the clock may advance for ever with the retry never
> completing, and *every refusal is answered by a re-observation* is false. **The safe direction is
> unaffected and needs none of this**: a refusal here publishes nothing, clears nothing and mutates
> nothing but the tally, and the settlement is taken back, so what an uncompleted retry leaves is a
> state still **owed** — the reviewer cleared that half expressly. Each round's fix has produced the
> next round's finding for thirteen rounds, and this block is the thirteenth instance of it.

> **Correction (round-14 fix round, §20.2), on the round-13 block directly above.** *"What an
> uncompleted retry leaves is a state still **owed**"* is round 14's second High, and this is the
> **fourteenth** instance of the pattern the block above names — a fix round's own fix becoming the
> next round's finding, now for two consecutive rounds at this one paragraph.
> `revert_settlement` restores a debt only where the settlement it takes back had discharged one, and
> the settlement refused here is a **native hint's**, which had not; the plain `hint` arm runs and
> what is left is a re-**hinted** path. Read it as *a state still **un-concluded and re-hinted***.
> **What the reviewer cleared is retained and is not weakened by this**: publishes nothing, clears
> nothing, mutates nothing but the tally. What is withdrawn is the anti-coalescing property, which a
> hint does not carry — the paragraph above the round-12 block already said the true thing, *"the path
> is re-hinted"*, and neither correction block noticed.

**Across a `begin_epoch`** the anchor is discarded with everything else, which is the whole of its
lifetime rule and is why it carries no *clearing* logic of its own. **Across a failed reload** it is
untouched, because a reload says nothing about when this session last wrote. And the `epoch` field is
`AppWrite::epoch`'s second statement of the discard rule, checked separately for the same reason.

### 15.4 The four Lows

**Low 1 — §14.2's rejection.** §15.1 above, and the correction block under §14.2 itself.

**Low 2 — "over-reporting" is the wrong name.** The withheld hint's later publication is a **genuine
external change whose bytes happen to equal an earlier app revision**. The door's premise already
establishes a real post-read disk transition — the file no longer holds the revision its transaction
last saw — and byte equality with something this application once wrote does not make that transition
false. Corrected in `ledger.rs`'s module section, in
`WriteLedger::withhold_under_the_session_lock`, and in §14.1's bullet. **The prohibition is kept
verbatim in the same place**: byte identity, never authorship.

**Low 3 — §5 item 23's false physical-time bound.** Removed. Only the **production** of such an
observation is pre-commit; its delivery latency is unbounded — a completed settlement can sit on a
descheduled worker or behind the commit gate across several commands. The same false bound stood in
`LedgerTally::preceded_a_commit`'s doc comment and is corrected there too, which is a position the
Low did not name.

**Low 4 — the ninth consecutive name-position miss, and it is a *premise*.** `after_a_save` runs for
`Ok(SavedDocument { committed: false, .. })` as well, so *"the read follows a commit"* is false of
it. Corrected in `LedgerTally::withheld` (*"between a save transaction's last locked read and its
tail refresh"*, with the false version named), in `Admission::Withheld`'s first sentence, in
`WriteLedger::withhold_under_the_session_lock`'s caller paragraph and its marker-would-swallow
paragraph, and — a position the Low did not name — in `commands.rs`'s `after_a_save` doc section *a
refresh that disagrees is an external observation*, which said *"a post-commit external replacement
is not suppressed"*. **Deliberately kept**: `a_post_commit_external_replacement_supersedes_the_record_and_is_never_ours`,
whose scenario constructs `committed: true`, so *post-commit* is true of it.

### 15.5 The sweeps

**For the shape, not the words.** The question asked of this round's own change: *what other fact
this ledger keeps can be made stale by something outside the ledger?* Enumerated field by field over
`LedgerState`:

- `writes` / `documents_by_path` — the workspace accepting a foreign revision, **closed here**; a
  `committed: false` save leaving an earlier entry standing, **answered by round 8's door-scoping**;
  an unobserved external write, which is the predicate's documented limit and not a defect;
- `announced` — the same reload route, **closed here**. The frontend's `adoptDiskVersion` needs no
  entry of its own: the backend's acceptance of that revision happened inside
  `conflict_after_the_lock`, which already goes through the marking door;
- `latest_commit_at` — **nothing outside this ledger can make it stale**, and that is why the
  chronology fact belongs here rather than on the record: it asserts *this session committed to this
  path at this instant*, which no other process can falsify;
- `epoch`, `next_sequence`, `tally` — not per-path facts about a disk.

**For the consuming-operation shape** (`CLAUDE.md`'s standing rule): the new method consumes nothing.
`clear_the_record_at` returns `()`, and `announced.remove` is idempotent and carries no permit
semantics; there is no check-and-spend pair, because there is nothing to spend. No caller-supplied
code runs under either guard.

**The `Workspace::refresh` enumeration** is written as a command rather than as a claim, so the next
round can re-run it: `rg '\.refresh\(' src-tauri/src/` finds **three** call sites. **The claim is not
that every one is followed by a ledger call — that would be false** — but that every arm on which one
of them **accepts a revision the session did not already hold** tells the ledger. The arms that do not
tell it accepted nothing, and each was checked rather than assumed: `Workspace::refresh` does
`read_utf8(…)?` before it touches `entries[position].loaded`, so an `Err` leaves the cache exactly as
it was; and `after_a_save`'s agreeing arm found the revision its transaction already had, which is
what the record already names.

**For name positions**, swept as a pass of its own. Every position that said the chronology check
reads *the record*: the module's *stamp* section (`read_after > recorded_at` → `read_after > anchor`,
and the two-step implication with it), `Admission::PrecedesACommit`, `LedgerTally::preceded_a_commit`,
`decide`'s step-1 contract and its *step 1 sits above step 2* paragraph, `AdmissionDoor`'s three
questions and its `SerializedMarker` variant, the `record_app_write` doc, `AppWrite`'s own header,
`LedgerState::writes`, `begin_epoch`, and four assertion messages and inline comments in the tests.
**Three test names changed, because the claim in each name changed** — the count re-derived by
counting the arrows below, two in `ledger.rs` and one in `commands.rs`:
`a_reading_stamped_exactly_at_the_record_is_refused` →
`…_at_the_commit_anchor_is_refused`, and
`a_serialized_door_reading_is_never_refused_by_the_records_own_instant` →
`…_by_a_commit_anchor`; in `commands.rs`,
`a_post_save_refresh_is_never_refused_when_no_clock_could_place_it_after_the_record` →
`…_after_the_commit`. **Two test seams renamed and re-keyed**: `WriteLedger::recorded_at(DocumentId)`
→ `commit_anchor(&Path)`, `stamp_the_record_at(DocumentId, Instant)` →
`stamp_the_anchor_at(&Path, Instant)`.

**`main.rs`'s count moved from six to seven**, re-derived by counting the list rather than by adding
one: the **commit anchor** is now its own item beside the stamp, because round 9's second High was a
defect in what the stamp is compared against rather than in the stamp. The reload invalidation is
**not** in that list and has a paragraph of its own, because that list is about a save's own rename
and a reload is a different event.

### 15.6 What changed, file by file

- **`src-tauri/src/ledger.rs`** — `RecordedWrite` removed and `CommitAnchor` added, with
  `LedgerState::latest_commit_at` beside it; `record_app_write` writes both under one guard and
  `begin_epoch` clears the anchor map; three private helpers (`record_at`, `commit_anchor_at`,
  `clear_the_record_at`) so each lookup and the record's erasure are one statement; `decide`'s step 1
  reads the anchor and step 3 calls the helper; the new entry point
  `adopt_reloaded_revision_under_the_session_lock`; two module sections added (*a reload accepts a
  foreign revision*, *the anchor outlives the record*) and four amended. Two test seams renamed and
  re-keyed. **Three tests added**:
  `a_reload_that_accepts_other_bytes_ends_the_records_suppression_licence`,
  `a_reload_that_accepts_other_bytes_invalidates_the_announced_state` and
  `a_commit_anchor_outlives_the_record_it_was_taken_with`; **two renamed**;
- **`src-tauri/src/commands.rs`** — `WorkspaceSession::reload` resolves the path, refreshes, and tells
  the ledger, with the whole contract on its doc comment; `with_workspace` gains the lock-order
  paragraph its new customer relies on; the module header gains a round-9 paragraph and a sentence
  saying `reload_document` is still a reader; the `reload_document` wrapper says the same; the Low-4
  premise corrected in `after_a_save`'s doc. A `later_than_now()` test helper added and **three**
  hand-written `Instant::now()` stamps moved onto it, because an anchor that outlives its record is a
  value those comparisons now really meet. **One test added**,
  `a_reload_tells_the_ledger_which_revision_the_workspace_accepted`; **one renamed**;
- **`src-tauri/src/main.rs`** — the mechanism list moves from **six** to **seven** with the commit
  anchor named, and a paragraph for the reload invalidation beside it;
- **no core file, and no `src/` path.**

### 15.7 The evidence, the neuter runs, and the gates

| Owed | Where |
|---|---|
| `record A → reload B → owed stabilized A` is **admitted**, not suppressed | `ledger.rs`'s `a_reload_that_accepts_other_bytes_ends_the_records_suppression_licence`, first half; and on the production path `commands.rs`'s `a_reload_tells_the_ledger_which_revision_the_workspace_accepted`, first half — a real save, a real external write, a real `session.reload` |
| that the **equal** reload does **not** clear the record | both of those tests' second halves: the record survives and a hint at those bytes is still `SelfWrite`. This is §14.2's surviving reason, driven |
| `announce B → reload C → owed B` is a **new admission**, not `Duplicate` | `ledger.rs`'s `a_reload_that_accepts_other_bytes_invalidates_the_announced_state`, first half, asserting `FIRST_OBSERVATION_SEQUENCE + 1` |
| that a marker survives a reload **onto** it (consult Q5) | the same test's second half: `Marked` → reload at the marked revision → `announced_state` unchanged → the native twin still `Duplicate` |
| a pre-anchor observation after a **serialized clearing** still answers `PrecedesACommit`, with its settlement reverted | `ledger.rs`'s `a_commit_anchor_outlives_the_record_it_was_taken_with` — a real temp tree, a real engine, the real `admitting_sink` and the real `deliver`; it asserts nothing reaches the consumer, `preceded_a_commit == 1`, `announced_state == None`, the engine's tracked state reverted, and the correction admitted on the next stabilization |
| that nothing else about the ledger's decisions moved | the coalescing comparison, the suppression predicate and every door's step-5 arm were not edited; §3's table and §§9.5, 10.6, 11.6, 12.7, 13.5 and 14.7 all still pass |
| that a record made stale by a `committed: false` save is still handled | **round 8's door-scoping, unchanged** — `a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes`, still green |

**Two neuter runs**, each disabling exactly one thing and then restored, with the suites re-run green
afterwards:

- **the reload invalidation** (the method's body replaced by `let _ = (path, revision);`) — the ledger
  suite came back **22 passed, 1 failed → 2 failed** of 24:
  `a_reload_that_accepts_other_bytes_ends_the_records_suppression_licence` failed at *"the licence has
  outlived the last reading that could honestly spend it"*, **left `Some(AppWrite { epoch: 1, … })`,
  right `None`**, and `a_reload_that_accepts_other_bytes_invalidates_the_announced_state` failed at
  *"the entry stopped answering its own question when the workspace moved past it"*, **left
  `Some(Content(…))`, right `None`**. On the production path the `commands.rs` suite came back
  **78 passed, 1 failed** of 79:
  `a_reload_tells_the_ledger_which_revision_the_workspace_accepted` failed at *"and the record that
  licensed suppression of the bytes it moved past is gone"*. Both figures are whole-suite runs, not
  single-test runs, for §14.7's reason;
- **the anchor's independent life** (`clear_the_record_at` made to remove the anchor too, which is
  the coupling as it stood before this round) —
  `a_commit_anchor_outlives_the_record_it_was_taken_with` failed at *"a pre-commit reading reaches no
  consumer, record or no record"*; **23 passed, 1 failed** of 24, and every other ledger test stayed
  green, which is what makes that test a check on the **anchor's lifetime** rather than on the
  chronology check in general.

**The gates, on the finished tree**, each with its exit status:

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1267 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines over all **26** of them, **+4** on round 8's 1263 for this round's four new tests) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** (exit 0, 73.27 s, quiet host, no timeout; this round added no `watch_check` test and touched no watcher code, so this suite's FSEvents budget is unchanged) |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean** (exit 0) |
| `cargo fmt --check` | **clean** (exit 0, after one `cargo fmt` on `ledger.rs`) |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** (no match; this round touched **no** core file at all) |
| `npm run check` files / `npm test` / `npm run build` modules | **431 / 2125 / 184 — not re-run; the frontend was not touched**, on the warrant of §15.6's file list |

### 15.8 What this round's own change leaves open

Written with the expectation §15's opening states: **seven** §5 items recorded as bounded residues
have since been found to be real defects, so these are written as candidates for the next round's
Highs rather than as reassurances.

25. **Nothing forces a future read path that accepts a foreign revision to report it.** Today the
    enumeration is exact and re-runnable — `rg '\.refresh\(' src-tauri/src/` finds three call sites,
    all three of which tell the ledger — but that is an audit, not a type. 2d-4's drain and 2d-5's
    coordinator can add a fourth, and the compiler will say nothing. A chokepoint was considered and
    rejected as surface with one user: the two save tails need *different* ledger treatment
    (`Marked`, `Withheld`) from a reload's, so a shared `refresh_and_tell_the_ledger` helper would
    have exactly one caller. **This is the residue most likely to become round 10's High**, and the
    honest mitigation is that the search above is written into this record and into `ledger.rs`.
26. **The reload invalidation uses the *workspace's* spelling of a path and `announced` is keyed by
    the *watcher's*.** Inherited unchanged from 2d-1 §5 item 3 — `record_app_write` and both
    serialized doors already depend on the same agreement — but this round adds a **third** consumer
    of it, so a spelling divergence now costs one more thing: a reload that silently invalidates
    nothing.
27. **`latest_commit_at` is never pruned within an epoch.** One `PathBuf` and sixteen bytes per path
    this session commits to, bounded by the config's file count and released at the next workspace
    open. Stated because *never pruned* is a shape this project has been wrong about before, not
    because the size is interesting.
28. **A non-zero `preceded_a_commit` no longer implies a recent save.** The anchor stands for the
    whole epoch, so the counter can move for an observation produced before a commit that happened
    long ago. The diagnosis a non-zero count supports is therefore weaker: it says *some reading was
    produced before this session's last commit to that path*, not *a commit happened just now* — and
    not *something malfunctioned*, because a settlement completed before a commit and delivered after
    it is an ordinary interleaving no debounce can prevent.

    > **Correction (round-10 fix round, §16.1).** As written, this item ended *"Its own doc still says
    > on a healthy production path this stays zero, which is true for the same reason it always was —
    > the engine's debounce"*. That clause was **false**, and it is round 10's single Low. Debounce
    > separates a save's own hint from the pass that settles it; it can do nothing about a settlement
    > that was **already complete** when the commit happened, and the anchor's new epoch-long life is
    > exactly what lets such a settlement still be refused. `LedgerTally::preceded_a_commit`'s doc
    > comment carried the same premise in its own name position, so this item and that doc
    > **contradicted each other** from the round-9 fix round until round 10. Both now say that zero is
    > what ordinary save-generated hints produce and that a non-zero value can equally be a healthy
    > observation spanning a commit.
29. **`ObservedState::Absent` and `Unreadable` cannot be reported by a reload**, so a file removed
    externally and confirmed by a failed reload invalidates nothing. That is correct — a read that
    did not complete proves no state — but it means the person seeing "this file could not be read"
    has told the ledger nothing, and the record for that path is still spending its licence until a
    watcher stabilizes the absence. `§5` item 19's no-watcher trade applies unchanged.

## 16. The round-10 fix round

`docs/reviews/phase-2d-3-ledger.md` round 10 returned **NOT READY** with **no High, no Medium and
exactly one Low** — the first round in ten that found no defect in behaviour. Nine consecutive rounds
had each returned at least one High; this one returned a single documentation finding, and it is
closed here.

The brief given to the reviewer was different from rounds 8 and 9. The round-9 fix had taken the
reviewer's remedy on all three Highs with **no deviation**, so there was no deviating argument to
attack; the instruction was instead to judge whether taking all three remedies *literally* was right,
and in particular whether their **combination** is coherent — High 1 and High 3 clear two maps from
one new entry point while High 2 makes a third map outlive both, leaving three maps with three
lifetimes and only one of them cleared by `decide`.

**What the round cleared**, recorded here so round 11 does not re-do it:

- **the three-map combination**, and the clearing is reasoned rather than bare: suppression records
  end when their licence becomes stale, announced entries track what a consumer was shown, and commit
  anchors correctly remain chronology-only until the epoch ends. Three different lifetimes are the
  right answer because the three maps answer three different questions;
- **the withholding suspect** the orchestrator named. `conflict_after_the_lock` and `after_a_save`
  also call `Workspace::refresh` and so also accept a foreign revision, while the withholding door
  announces nothing and `after_a_save`'s agreeing arm calls the ledger not at all — which looked like
  High 3's shape surviving at a second site. It is not: **the withholding door's refreshed state is
  deliberately shown to nobody**, so an older announced `B` remains valid and a later return to `B`
  may correctly coalesce. The asymmetry between the reload and the save tails is the design;
- **§5 items 26, 27 and 29**, **both `differs` conditions**, **failed reloads**, **removed files** and
  **already-held revisions**.

**§5 item 25 — the implementer's own prediction for this round's High — was judged and downgraded.**
The arm-scoped refresh audit is **currently exact**, and the rejected one-caller chokepoint would not
have enforced future use anyway, so item 25 is a **maintenance risk rather than a present behavioural
defect**. That is the first time in this step that a §5 item written as a candidate for the next
round's High **survived** the round it was written for. It is downgraded, **not closed**: nothing was
changed for it, the audit is still an audit, and the judgement is about today's code — 2d-4's drain
and 2d-5's coordinator can still add a fourth `refresh` site with the compiler silent, which is the
item as originally written.

### 16.1 The Low — the tally's own doc contradicted the item that corrected it

The finding, in the reviewer's own construction: the watcher completes a stable reading P → its worker
is descheduled → this application commits A and records its anchor → a serialized decision clears A's
suppression record → the delayed P reaches stamped admission and correctly increments
`preceded_a_commit`. **No component malfunctioned, and debounce cannot prevent it** — debounce
separates a save's own hint from the pass that settles it, and P's settlement was already complete
when the commit happened.

The round-9 fix round had written §5 item 28 for exactly this weakening, and item 28 is right in
substance. What it did not do is fix the counter's **own doc comment**, which went on saying *on a
healthy production path this stays zero* — so from the round-9 fix round until this one, the record
and the code **contradicted each other**, and item 28 even asserted the doc's premise was still true.
Both positions now say the same thing, and the correction block under item 28 records that they did
not.

**`LedgerTally::preceded_a_commit`'s doc now claims three things and disclaims a fourth**:

- **zero is what an ordinary save-generated hint produces** — unchanged, and for the unchanged
  reason: one debounce plus one probe separates a save's hint from the pass that settles it, while
  the anchor follows the rename by one read-back;

  > **Correction (round-11 fix round, §17.1).** This bullet is round 11's **first** High, seen at
  > the record's own name position. It gives the timing as *the unchanged reason* and concedes
  > nothing, while the doc comment it describes went further and said the hints one commit generates
  > *never* reach this arm. **Nothing enforces that ordering** — it compares a probe interval
  > against a rename-to-record window, which is exactly what §16.6 item 30 was written to concede,
  > so this bullet and item 30 **contradicted each other from the moment both were written**. A save
  > thread stalled between the rename and `record_app_write` for longer than one debounce plus one
  > probe lets the worker stamp and settle the saved bytes first, and the arm then refuses them with
  > nothing wrong. The doc now says **usually** and states the stall in the same breath; zero remains
  > the usual outcome and is no longer offered as a guarantee.
- **a non-zero value can equally be a healthy observation whose production spanned a commit**, since
  the anchor's life is the epoch;
- what is left to diagnose bad stamping is **sustained growth out of proportion to this session's
  commits** — which a correctly stamped pipeline cannot produce, because a refusal is answered and
  the re-observation's stamp is taken after the anchor — or a failure of `crate::watch_check`'s
  `a_committed_save_is_suppressed_while_a_later_external_write_is_not`;
- and it says **in the same sentence** that no threshold is enforced anywhere: nothing in the type
  system and no test distinguishes proportionate growth from disproportionate. That half is a thing
  to read, not a thing that fails, and §16.6 item 31 states what it would cost to make it a check.

> **Correction (round-11 fix round, §17.2).** The last bullet was **false as written for the whole of
> round 10**, and it is round 11's second High. The doc comment it describes carried the
> sustained-growth claim and the *no threshold is enforced anywhere* concession as **two sentences**,
> the second beginning at a sentence boundary — so this record claimed compliance with this project's
> standing rule (*where TypeScript, or the type system, cannot force something, say so in the same
> sentence that describes what it does force*) that the code it describes did not give. That is this
> project's worst defect class, and the bullet asserting the rule was satisfied is exactly what made
> it invisible. The round-11 fix round rewrote the doc so the claim and the concession really are one
> sentence, and widened the concession to name what is missing: no per-path count to read growth
> from, and nothing that fails when the counter climbs.

> **Correction (round-12 fix round, §18.1).** The **third** bullet — *a correctly stamped pipeline
> cannot produce sustained growth, because a refusal is answered and the re-observation's stamp is
> taken after the anchor* — is round 12's first High one level down, and it is a **narrower instance
> the reviewer did not name**, found by §18.5's shape sweep. The re-observation's stamp follows the
> anchor in **program order** only, and since `decide` compares `read_after <= at` a clock collision
> refuses the same reading again, so a correctly stamped pipeline **can** move this counter more than
> once per commit and the premise this bullet argues from is not enforced anywhere. The doc comment
> it describes now says *usually* and carries that concession in the same sentence as the claim, so
> this bullet's description of it is superseded on that point as well as on the last bullet's.

> **Correction (round-13 fix round, §19.1).** The **third** bullet has a *second* false premise,
> untouched by the round-12 block above and standing beneath it for a whole round: *a refusal is
> **answered***, read as *a re-observation arrives*. It does not have to. `admitting_sink` answers
> `Undecided`, `deliver` calls `revert_settlement`, and that re-**owes** the path; whether a
> settlement ever follows depends on the path stabilizing and on the worker outliving the debt, and
> §5 items 19 and 21 say neither is forced. So *sustained growth out of proportion to this session's
> commits* rests on a premise that is weaker in **two** independent ways — the clock, which round 12
> named, and the arrival, which it did not — and the diagnosis was already, in the fourth bullet, a
> suspicion nothing enforces. `LedgerTally::preceded_a_commit`'s doc now carries **both** concessions
> inside the same sentence as the claim (§19.1), which is what this bullet describes.

> **Correction (round-14 fix round, §20.2), on the round-13 block directly above.** *"`deliver` calls
> `revert_settlement`, and that re-**owes** the path"* is round 14's second High. It re-owes only
> where the settlement being taken back had discharged an `observe_owed` request; the settlement a
> `PrecedesACommit` refusal takes back is an ordinary **native hint's**, which had not, so the
> `else { self.hint(path, now) }` arm runs and the path is re-**hinted**. Read the clause as *and that
> restores the state it replaced and re-hints the path, re-owing it only where that settlement had
> discharged a debt*. The block's own finding — *answered* is the rollback and not an arrival — is
> unaffected and stands; what this correction removes is the further claim that the rollback leaves an
> anti-coalescing debt behind, which is the property a hint precisely does not have.
> `LedgerTally::preceded_a_commit`'s doc now carries **all three** concessions (§20.2).

**It does not overclaim in the other direction.** The counter is not meaningless: it still counts
refusals and never losses, the *first* half of the old paragraph is intact, and the one production
assertion of zero is kept rather than weakened — see §16.6 item 30 for what keeping it costs.

> **Correction (round-12 fix round, §18.3).** **Both claims in the sentence above became false at
> round 11 and stood uncorrected for a whole round**, which is round 12's first Low and the twelfth
> consecutive name-position finding in this review — a bold first sentence whose two supporting
> clauses had each been overtaken by the fix round that runs three sections below it. The *first half
> of the old paragraph* is **not** intact: round 11's first High changed it from *never* to
> **usually**, because a save thread stalled between the rename and `record_app_write` for longer
> than one debounce plus one probe lets the worker stamp and settle the saved bytes first (§17.1).
> And *the one production assertion of zero* is **not** kept: round 11's Medium **removed** it from
> `watch_check.rs` as a line that could fail with no defect present (§17.3), and §16.6 item 30 —
> which this sentence points at for *what keeping it costs* — was closed as a defect in the same
> round. What survives of the sentence is only its first clause: the counter still counts refusals
> and never losses. What the removal costs is now stated where the removal is recorded, and it is not
> nothing (§18.2).

### 16.2 The sweeps

**For the shape, not the words.** The premise swept for was *a non-zero `preceded_a_commit` means
something malfunctioned*, in every position where a name carries a claim: headlines, section
headings, bold ruling lines, first sentences, doc comments, module headers, test names and assertion
messages.

- every occurrence of the identifier, read one by one on the tree as it stood before this round's
  edits: **14 code positions** (`ledger.rs` 12, `watch_check.rs` 1, `commands.rs` 1) and **18 record
  positions** in `2d-3-notes.md` and `PROGRESS.md`. The only false premise was the one the Low names,
  `ledger.rs:823`. The record positions are per-round evidence tables, left as written per this
  project's convention, and each was checked to be a claim about **its own round's construction**
  rather than a general invariant;
- the premise without the identifier — `stays zero`, `remains zero`, `always zero`, `never moves`,
  `only moves`, `means a bug`, `indicates a bug`, `bad stamping`, `wrong place`, `malfunction` —
  over `src-tauri/src`, `docs/decisions` and `PROGRESS.md`. **Found nothing further.** The one
  `never moves` hit is `WriteLedger::gate_waiters`' doc, about the gate acquisition and not about
  this counter;
- `debounce` over `src-tauri/src`, on that same pre-edit tree: **19 hits**. Two were the false bound,
  both already corrected —
  `ledger.rs`'s *the anchor outlives the record* section says in as many words that *nothing bounds
  that delay* and that *the record used to say the exposure was one debounce plus one probe wide, and
  that was false* (round 9's third Low), and `commands.rs`'s `commit_and_record` says the same about
  the gate. Neither claims debounce prevents a pre-commit settlement from being admitted;
- **test names**: `a_reading_stamped_exactly_at_the_commit_anchor_is_refused`,
  `a_serialized_door_reading_is_never_refused_by_a_commit_anchor`,
  `a_commit_anchor_outlives_the_record_it_was_taken_with`,
  `a_reading_taken_before_a_commit_never_supersedes_its_record`,
  `a_reading_of_an_absence_taken_before_a_commit_is_refused_too` and
  `a_post_save_refresh_is_never_refused_when_no_clock_could_place_it_after_the_commit`. **Every one
  names a construction rather than a health invariant**, and none needed a word changed;
- **the two assertions of zero**, which are the positions where the premise could hide as an
  expectation rather than as prose. `commands.rs:8166` asserts it of a scenario in which the
  chronology check is unreachable by construction — a serialized door — and its message says so.
  `watch_check.rs:1214` is the one the brief asked about, and it is **the code written against the
  stronger diagnosis**: it is kept, and a paragraph beside it now says the zero is a property of
  *that test's construction* and names the ordering of two durations it rests on. §16.6 item 30 is
  the residue.

**For the consuming-operation shape** (`CLAUDE.md`'s standing rule, and the defect this phase has
shipped twice): this round adds no operation, consumes nothing and spends nothing. The new test calls
`admit`, `withhold_under_the_session_lock` and `record_app_write`, all of which already exist and are
already reviewed, and it discards no result — every call's answer is asserted.

### 16.3 What changed, file by file

- **`src-tauri/src/ledger.rs`** — `LedgerTally::preceded_a_commit`'s doc comment rewritten (§16.1);
  **one test added**,
  `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading`. No
  behaviour, no signature and no other doc changed;
- **`src-tauri/src/watch_check.rs`** — one comment paragraph added beside the `preceded_a_commit == 0`
  assertion, scoping it to that test's construction. The assertion itself is untouched;
- **`docs/decisions/2d-3-notes.md`** — §5 item 28 amended with a correction block, and this §16;
- **no core file, no `src/` path, and no command, wire type or user-visible string.**

### 16.4 The evidence and the neuter runs

| Owed | Where |
|---|---|
| that a settlement spanning a commit increments the tally, and that the interleaving is healthy | `ledger.rs`'s `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading` — the reviewer's own construction (`stabilize P → commit A → clear A's record → admit P`), at the ledger alone, with no engine, no filesystem and no thread |
| that the increment is one and not a symptom | the same test's steps 4 and 5: `admitted`, `suppressed`, `coalesced` and `stale_epoch` are all still zero at the refusal, nothing is announced, the same state read again **after** the commit is `Admitted { sequence: 1 }`, and the counter does not move a second time |
| determinism | the stamp is a value taken before `record_app_write`'s, and `Instant` is monotonic and nondecreasing, so `read_after <= anchor` holds whatever the host clock's resolution — and equality is on the refusing side. No sleep, no wait, no FSEvents |
| that the production interleaving really reaches this | unchanged: `a_commit_anchor_outlives_the_record_it_was_taken_with`, which drives the same sequence through the real engine, the real `admitting_sink` and the real `deliver` |

**Two neuter runs**, each restored afterwards with the suite re-run green:

- **the anchor coupled back to the record** (`clear_the_record_at` made to remove the
  `latest_commit_at` entry too, which is the shape round 9 fixed) — the ledger suite came back
  **23 passed, 2 failed** of 25. The new test failed at *"a reading produced before the commit may not
  report bytes the commit could have replaced"*, **left `Admitted { sequence: 1 }`, right
  `PrecedesACommit`**, and `a_commit_anchor_outlives_the_record_it_was_taken_with` failed beside it;
- **an anchor that refuses unconditionally** (the stamped arm's comparison replaced by
  `anchor.is_some()`) — the new test failed at *"the refusal deferred the reading rather than dropping
  it"*, **left `PrecedesACommit`, right `Admitted { sequence: 1 }`**. This is the neuter that isolates
  the half the first one does not: the tally's *health* claim, that one commit refuses one reading
  **once**. It is a blunt instrument — 16 of the 25 ledger tests fail under it — so what it proves is
  that the assertion is load-bearing, not that it is uniquely so.

### 16.5 The gates

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1268 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines over all **26** of them, **+1** on round 9's 1267 for this round's one new test) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** (exit 0, 69.41 s on the finished tree and 74.74 s on the run before this round's last doc edits, quiet host, no timeout in either; this round added no `watch_check` test and changed only a comment there) |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean** (exit 0) |
| `cargo fmt --check` | **clean** (exit 0, no reformatting needed) |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** (no match; this round touched **no** core file at all) |
| `npm run check` files / `npm test` / `npm run build` modules | **431 / 2125 / 184 — not re-run; the frontend was not touched**, on the warrant of §16.3's file list |

### 16.6 What this round's own change leaves open

Written with the expectation §15 states and this round does not weaken: **seven** §5 items recorded as
bounded residues have since been found to be real defects, and item 25 surviving one round is not
evidence that the pattern has ended.

30. **`watch_check`'s `preceded_a_commit == 0` is an exact-zero assertion whose soundness rests on an
    ordering of two durations that nothing enforces.** No pre-commit settlement can exist in that test
    *because* a settlement needs two equal reads, so the earliest stamp that could see the saved bytes
    twice is one probe after the rename, while the anchor follows the rename by one function return
    (`commit_and_record` records immediately after `save_document` returns). That is a comparison of a
    probe interval against a rename-to-record window, and **it is reasoned, never measured**: no test
    exercises that window, and a host slow enough between the rename and the record could fail the
    line with no defect present. It was deliberately **not** weakened — weakening it removes the only
    production-path check on the stamp — so the cost is a line that can fail for two different
    reasons and says only one of them.

    > **Correction (round-11 fix round, §17.3).** The clause *"weakening it removes the only
    > production-path check on the stamp"* was **false**, and it is round 11's Medium. The check on
    > the stamp is the **bounded positive wait** for `suppressed >= 1` twenty lines above the
    > assertion, not the assertion: a stamp taken too early *permanently* refuses the hint as
    > `PrecedesACommit` on every re-reading, so the hint is never suppressed and that wait times out.
    > The comment sitting directly above the assertion said so — *"the positive wait above would time
    > out, and this line names why"* — so the record credited the assertion with a detection its own
    > neighbouring comment assigned to the wait. **The assertion is removed at round 11.** It
    > detected nothing the wait does not, and it could fail with no defect present: a save thread
    > stalled between the rename and `record_app_write` for longer than one debounce plus one probe
    > lets the worker stamp and settle the saved bytes first, this application's own hint is refused
    > once as `PrecedesACommit`, the engine takes the settlement back, the re-reading is stamped
    > after the anchor and *is* suppressed — correct behaviour throughout, and the old line failed on
    > it. Item 30 is therefore **closed as a defect and survives only as its unchanged residue**: no
    > test exercises the rename-to-record window, and a stamp taken too *late* remains invisible.

    > **Correction (round-12 fix round, §§18.1 and 18.2).** The block above is **round 11's**, and two
    > of its sentences are false. **(a)** *"The re-reading is stamped after the anchor and is
    > suppressed"* holds in program order only: `decide` compares `read_after <= at`, so equality
    > refuses and a clock collision can refuse the same reading again against the same anchor —
    > correct behaviour throughout, but not the single refusal the block presents. **(b)** *"It
    > detected nothing the wait does not"* is **false**, and it is round 12's second High. The
    > neuter §17.6b ran — `WatchWorker::observe`'s per-pass `Instant::now()` replaced by a `OnceLock`
    > — is the **permanently** early stamp, and it proves only that the surviving wait catches that
    > case. An **intermittently** early stamp is a different story with a different ending: one save
    > pass is refused as `PrecedesACommit`, the engine's rollback produces a correctly stamped pass,
    > that pass is suppressed, the wait is satisfied and the test **passes** — while before the
    > removal the cumulative, never-reset `preceded_a_commit` was left non-zero for the session and
    > the exact-zero line **failed**. So the removal is a real trade: it keeps the permanent-case
    > detection, drops the intermittent-case detection, and buys a line that can no longer fail on the
    > harmless save-thread stall this item describes. **Keeping the removal is still right** — the
    > removed line could not tell the intermittent defect from the stall, so it was a two-reason line
    > that named one reason — but recording it as costing nothing was not, and §18.7 item 35 carries
    > the lost coverage and what recovering it would cost.
31. **"Sustained growth" is prose, not a check.** `LedgerTally` keeps one cumulative `u64` per
    decision for the whole session; it counts no refusals per path and holds nothing to compare a
    count against, so the very data a growth reading needs is not kept. Nothing fails when the counter
    climbs. And the tally has **no wire surface at all** until 2d-4, so in the shipped application the
    diagnosis this round wrote into the doc is available to a person reading a debugger and to nobody
    else.
32. **The new test drives the ledger alone, so what it pins about the *production* interleaving is
    what `a_commit_anchor_outlives_the_record_it_was_taken_with` already pinned.** Its own
    contribution — one increment, and the reading admitted on its next stabilization — is proved
    against a hand-passed `Instant`, and nothing ties that hand-passed stamp to the one
    `WatchWorker::observe` takes. §5 item 14's third half applies unchanged: a stamp taken too **late**
    on the production path is still invisible to every test in this crate.

## 17. The round-11 fix round

`docs/reviews/phase-2d-3-ledger.md` round 11 returned **NOT READY** with **two Highs, one Medium and
one Low**. Round 10's clean sheet lasted exactly one round, and the shape of what broke it is the
point: **round 10 corrected a conclusion and left its premise standing.** Round 10's Low was the
tally doc's *on a healthy production path this stays zero*; the rewrite that closed it kept, in the
very next clause, *the hints one commit generates are decided after that commit's anchor and **never**
reach this arm* — the same unenforced timing argument, one level down, in the same paragraph.

**That makes eleven consecutive rounds with a name-position finding, and three consecutive rounds
where the finding was a *premise* rather than a word.** It also makes **both** of this round's Highs
instances of this project's declared worst defect class: a record claiming a guarantee the code does
not give, which no test can fail.

### 17.1 High 1 — the doc said *never*, and §16.6 item 30 said nothing enforces it

The two positions were written **in the same fix round** and contradicted each other from the moment
both existed. `LedgerTally::preceded_a_commit`'s doc argued that one debounce plus one probe (240 ms
at the default timing) separates a save's own hint from the pass that settles it, while the anchor
follows the rename by one read-back, and concluded that a save's own hints **never** reach the
refusing arm. Item 30 of §16.6 had already conceded, for `watch_check`'s assertion, that this is *a
comparison of a probe interval against a rename-to-record window*, **reasoned and never measured**.

The reviewer's scenario, and it needs no defect anywhere: the save renames to `A` → the native hint
starts stabilizing → **the save thread stalls between the rename and `record_app_write` for longer
than one debounce plus one probe** → the worker stamps and settles `A` first → the anchor is only
then recorded → admission correctly answers `PrecedesACommit`. Nothing malfunctioned; the refusal is
right; the counter moves; and the doc said it could not.

**The fix.** The doc now says zero is the **usual** outcome and says *usually is all it is* in the
same breath, naming the stall, naming the two durations being compared, and pointing at both item 30
and `watch_check`'s own concession. The record's §16.1 first bullet — which carried the same premise
one level weaker, giving the timing as *the unchanged reason* and conceding nothing — carries a
correction block saying so.

### 17.2 High 2 — the record claimed the same-sentence rule was satisfied, and it was not

`CLAUDE.md`'s standing rule is that where the type system cannot force something, the code says so
**in the same sentence** that describes what it does force. §16.1's last bullet asserted, in as many
words, that the tally doc *says in the same sentence that no threshold is enforced anywhere*. It did
not: the sustained-growth claim ended in a full stop, and **No threshold is enforced anywhere** began
a new sentence.

**The bullet asserting compliance is what made the non-compliance invisible** — a reader checking the
rule reads the record, finds it claimed, and stops. That is why this is a High and not a Low.

**The fix.** The doc's bullet is now one sentence carrying claim and concession together, and the
concession is **widened** rather than merely relocated: it now names that the tally keeps no per-path
count to read growth from and that nothing fails when the counter climbs, so sustained growth is
*a suspicion to read and never a diagnosis this crate can make*. §16.1's bullet carries a correction
block.

### 17.3 The Medium — an assertion credited with a check its neighbour performs

`watch_check.rs`'s `preceded_a_commit == 0` was kept at round 10 on the stated ground that *weakening
it removes the only production-path check on the stamp*. **That ground was false.** The check is the
**bounded positive wait** for `suppressed >= 1` twenty lines above it: a stamp taken too early
*permanently* — at the worker's start rather than immediately before each engine pass — refuses this
hint as `PrecedesACommit` on every re-reading, so it is never suppressed and the wait times out. The
comment directly above the assertion said exactly that (*"the positive wait above would time out, and
this line names why"*), so the record credited the assertion with a detection its own neighbouring
comment assigned to the wait.

**The assertion is removed.** It detected nothing the wait does not, and under §17.1's stall it fails
with correct behaviour throughout: the hint is refused once as `PrecedesACommit`, the engine takes the
settlement back, the re-reading is stamped after the anchor and *is* suppressed. §16.6 item 30 carries
the correction and is **closed as a defect**, surviving only as its unchanged residue — no test
exercises the rename-to-record window, and a stamp taken too *late* is still invisible.

> **Correction (round-12 fix round, §§18.1 and 18.2).** Two claims in the paragraph above are false.
> **(a)** *"The re-reading is stamped after the anchor and is suppressed"* is true in program order
> and not in `Instant` values, because `decide` compares `read_after <= at` and refuses at equality,
> so a clock collision can refuse the same reading again (§18.1). **(b)** *"It detected nothing the
> wait does not"* is round 12's second High: the removed exact-zero line **did** detect one thing the
> surviving wait cannot, an **intermittently** early stamp, because `preceded_a_commit` is cumulative
> and never reset while a rollback's correctly stamped re-pass satisfies the wait and leaves the test
> green (§18.2). The removal stands — the line could not tell that defect from the harmless stall, so
> it named one of its two reasons — but it is a trade, not a free saving, and §18.7 item 35 carries
> what it costs.

### 17.4 The Low — the test's message denied a decision the test itself took

`a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading` asserted the
four-tuple `(admitted, suppressed, coalesced, stale_epoch)` was `(0, 0, 0, 0)` under the message *"no
other decision was taken"*. Step 3 of that same test **takes and asserts `Admission::Withheld`**,
which increments `withheld`; the tuple merely omitted the field. The message is now the accurate
*"no publication, suppression, coalescing or stale-epoch decision was taken"*, and the withhold is
**asserted at 1** rather than left to the reader.

### 17.5 The sweeps

**For the shape, not the words.** The premise swept for was *the save-path ordering is guaranteed*,
in every name position:

- `never reach`, `cannot reach`, `never reaches`, `decided after that commit`, `after its record`,
  `no reading was refused` over `src-tauri/src`, `docs/decisions/2d-3-notes.md` and
  `docs/reviews/phase-2d-design.md`. **One hit needed judging and was cleared**: `ledger.rs:607` says
  the two serialized doors *prove the ordering by construction instead of by a clock, and never reach
  this arm*. That `never` is sound and is the correct use of the word — `mark` and `withhold` do not
  call `admit`, so they are structurally incapable of reaching the arm. It is a claim about control
  flow, not about a clock. Every other hit is a different subject (the gate, the walk, the menu, the
  wire);
- `same sentence` over the same three files plus `ledger.rs`, `watch_check.rs` and `commands.rs`:
  **14 hits on the tree the sweep was run against** (`ledger.rs` 6, this record 8; `watch_check.rs`,
  `commands.rs` and `phase-2d-design.md` none). Only §16.1's, the one High 2 names, claimed
  compliance the described text did not give. The others describe their own adjacent sentences and
  were checked one by one. This round's own three correction blocks add three more, so the count on
  the finished tree is **17** — stated because a later round re-running the sweep will get that
  number and must not read it as a discrepancy;
- the identifier `preceded_a_commit` after this round's edits: `ledger.rs` **15**, `watch_check.rs`
  **1** (the assertion's removal took one, the surviving reference is the cross-link in the rewritten
  paragraph), `commands.rs` **1**.

**For the consuming-operation shape** (`CLAUDE.md`'s standing rule): this round adds no operation and
consumes nothing. It removes one assertion, rewrites two doc comments and one test message, and adds
one assertion. No result is discarded.

### 17.6 What changed, file by file

- **`src-tauri/src/ledger.rs`** — `LedgerTally::preceded_a_commit`'s doc rewritten twice over
  (§17.1 and §17.2); the new test's four-tuple message corrected and one `withheld` assertion added
  (§17.4). **No behaviour, no signature, no control flow.**
- **`src-tauri/src/watch_check.rs`** — the `preceded_a_commit == 0` assertion **removed** and its
  paragraph rewritten to say what the positive wait detects and why the assertion did not (§17.3).
  No test added or removed; the file's test count is unchanged.
- **`docs/decisions/2d-3-notes.md`** — three correction blocks (§16.1 first bullet, §16.1 last
  bullet, §16.6 item 30) and this §17.
- **no core file, no `src/` path, and no command, wire type, event, queue or user-visible string.**

> **Correction (round-12 fix round, §18.4).** **This list was incomplete, and it is round 12's second
> Low.** `git show 411658f --stat` lists **five** files, not three: the two Rust files and this record
> above, plus **`docs/reviews/phase-2d-3-ledger.md`** (round 11's verbatim reply appended, +68 lines)
> and **`PROGRESS.md`** (the round-11→round-12 handoff, +176 lines). Both belong in a section headed
> *what changed, file by file*, and every four-file or three-file claim derived from this list is
> wrong by the same two names.
>
> **The omission has a history, and half of it is a convention this record never declared.** No
> *"what changed, file by file"* section in this record has ever named `docs/reviews/phase-2d-3-ledger.md`
> — §§10.2, 11.2, 12.4, 13.3, 14.6, 15.6 and 16.3 all omit it, seven sections over seven rounds,
> because the review file receives the reviewer's reply verbatim rather than an authored change.
> That is a defensible thing to exclude and an indefensible thing to exclude **silently**, so it is
> declared here rather than continued: **from §18 on, these sections name every file in the fix
> round's commit and say which of them is a verbatim append.** The `PROGRESS.md` omission has no such
> excuse — round 11's commit is the **first** 2d-3 fix commit to carry `PROGRESS.md` at all (round
> 10's fix, `82c7dc5`, holds exactly four files and none of them is `PROGRESS.md`), so §17.6 dropped
> a file that was new to the shape rather than one an old habit covered.

### 17.6b The neuter that justifies the removal, and the gates

**§17.3's claim is proved, not inherited.** Removing an assertion on the argument that a neighbouring
wait already carries its detection is exactly the shape this review keeps finding unproved, so the
argument was driven rather than accepted. The neuter: `WatchWorker::observe`'s per-pass
`Instant::now()` replaced by a `OnceLock` initialized at first use — the stamp taken **once at worker
start** rather than immediately before each engine pass, which is the *permanently* early stamp in
its exact production shape.

Under it, `a_committed_save_is_suppressed_while_a_later_external_write_is_not` failed with

> `timed out waiting for the save's own bytes to be suppressed` (`watch_check.rs:141`, 128.06 s)

— **the bounded positive wait, not the removed assertion.** The detection §16.6 item 30 credited to
the exact-zero line is carried by the wait, and the line's removal costs nothing. `watch.rs` was
restored from a byte-identical copy immediately afterwards and is absent from this round's diff.

> **Correction (round-12 fix round, §18.2).** *"The line's removal costs nothing"* is **false**, and
> it is round 12's second High at the position that was supposed to prove the removal. **The neuter
> above is the right neuter for a claim it was not asked to prove.** A `OnceLock` stamp is the
> *permanently* early stamp, so the run proves the wait catches that case — and nothing more. The
> case the removed line caught alone is the **intermittently** early stamp: one pass refused, the
> engine's rollback producing a correctly stamped pass, that pass suppressed, the wait satisfied and
> the test green, while the cumulative `preceded_a_commit` the old line read was left at one and
> **failed**. What the removal actually costs is therefore one detection, named in §18.7 item 35; the
> removal is still right, because the removed line could not separate that defect from the harmless
> save-thread stall of §17.1 and so failed on a healthy execution. **A neuter proves the claim it
> instruments and no neighbouring claim**, and this record spent a round reading it as proving both.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1268 passed, 0 failed** (exit 0, summed over **26** `test result` lines — unchanged, because this round removed an assertion and added one, and neither is a test) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** (exit 0, 64.85 s, **223** filtered out, quiet host, no timeout) |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean** (exit 0) |
| `cargo fmt --check` | **clean** (exit 0) |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** (no match; this round touched no core file) |
| `npm run check` files / `npm test` / `npm run build` modules | **431 / 2125 / 184 — not re-run; the frontend was not touched**, on the warrant of §17.6's file list and of `git diff --name-only 052dd38~1 HEAD \| rg '^src/'` being empty |

All six measured by the orchestrator on this tree, before and after the fix.

### 17.7 What this round's own change leaves open

Written with the expectation §15 states: **seven** §5 items recorded as bounded residues have since
been found to be real defects, and item 25 surviving two rounds is still not evidence the pattern has
ended. Round 11 closed item 30 as a *defect* while leaving its residue; it added no new §5 item,
because its three changes are all removals of false claims rather than new mechanism. What it leaves:

33. **The stall of §17.1 has no test.** It is a real interleaving, argued from the same unenforced
    ordering that item 30 concedes, and nothing in this crate exercises the window between the rename
    and `record_app_write`. The doc now *describes* it; no test *drives* it. Driving it needs a
    deterministic production-stamping seam, which is the reviewer's own alternative remedy and is
    2d-4's shape, not this step's.

    > **Correction (round-12 fix round, §18.4).** *"Which is 2d-4's shape, not this step's"* is
    > **false**, and it is round 12's third Low. The authority is `docs/reviews/phase-2d-design.md`
    > Q7, and its item 4 scopes 2d-4 to *"the typed queue, `workspace://reconciliation-ready`,
    > `drain_external_changes`, TypeScript types/wrapper, command registration/dispatch tests,
    > sequence/epoch/coalescing tests, and EN/ES code namespaces/accessors for every visible
    > failure"* — a wire step, naming no stamp and no suppression. Q7 item 3 is *"save composition and
    > **suppression ledger**"*, which is this step; the stamp itself is taken in `WatchWorker::observe`,
    > which Q7 item 2 put in 2d-2. **No ruling assigns the seam to 2d-4**, so the attribution is
    > removed rather than re-pointed: the test debt is carried here, unassigned, because inventing a
    > phase for it is exactly the false-precision this review keeps finding. The residue stands as
    > written on its first three sentences.
34. **`watch_check` now asserts strictly less than it did**, and that is the intended trade: the
    removed line detected nothing the surviving positive wait does not, but the surviving wait proves
    a *permanent* early stamp only. An early stamp that is intermittent still passes, exactly as it
    did before. §5 item 14's third half is unchanged — a stamp taken too **late** is invisible to
    every test in this crate.

    > **Correction (round-12 fix round, §18.2).** **Two of the three claims above are false**, and
    > together they are round 12's second High at the position that records the trade. *"The removed
    > line detected nothing the surviving positive wait does not"* is wrong: the removed line was the
    > only reader of a **cumulative** counter, so an early stamp on one pass alone left
    > `preceded_a_commit` at one for the rest of the session and failed it, while the wait sees only
    > the suppression the rollback's correctly stamped re-pass produces. *"An early stamp that is
    > intermittent still passes, exactly as it did before"* is wrong in its last three words: **before
    > the removal it did not pass** — that is the whole of what the removal gave up. What is true is
    > the middle claim and the first four words: the surviving wait proves a *permanent* early stamp
    > only, and `watch_check` really does assert strictly less. The trade is still the right one, for
    > the reason item 30's correction gives — the removed line could not tell an intermittently early
    > stamp from a healthy save-thread stall, so it was a line with two causes and one message — but
    > it is a trade with a price, and the price is item 35.

---

## 18. The round-12 fix round

`docs/reviews/phase-2d-3-ledger.md` round 12 returned **NOT READY** with **two Highs and three Lows**.
Round 11's lesson was *round 10 corrected a conclusion and left its premise standing, in the same
paragraph*; round 11 then corrected two premises, and the brief for round 12 asked, in as many words,
whether **a third stood in the same paragraphs**. It did — and the third one had been sitting in
`decide()`'s own comment the whole time, which is the sharpest thing about it.

**That makes twelve consecutive rounds with a name-position finding, and four consecutive where the
finding is a *premise* rather than a word.** Both Highs are again this project's declared worst defect
class — a record claiming a guarantee the code does not give — and the second of them is worse than
its predecessors in one specific way: it is a claim about **a check that was deleted**, made in the
same round that deleted it, and it made the deletion look free.

**Every one of the five findings was verified against the code before anything was written**, because
this review has an eleven-round history in which a fix round's own fix became the next round's
finding. Four are real and are fixed. **One is real and is fixed by removing an attribution rather
than by adding machinery**, and the authority that settles it is quoted in §18.4. **None was cleared**
— unlike round 9, which reversed a rejection, and round 10, which downgraded an item, round 12 found
nothing this record could defend.

### 18.1 High 1 — program order does not give a strictly greater `Instant`, and four claims said it did

**The premise, in the code that decides it.** `decide`'s chronology check is

```rust
AdmissionDoor::StampedPublication(read_after) => anchor.is_some_and(|at| read_after <= at),
```

so **equality is on the refusing side**, deliberately and correctly — the comment directly above it
says why in as many words (*"`Instant` is monotonic but expressly not guaranteed strictly increasing,
so two ordered clock reads may answer the same value — and at equality this comparison proves nothing
about which of the two calls came first"*), the round-10 review cleared that behaviour as right, and
this round does not touch the comparison. The test helper `later_than_now()` exists **because** of it:
it is `Instant::now() + 1ns`, and its own doc says `Instant::now()` alone would not be strictly later.

**The false claim, in four places.** *The re-observation's own stamp is taken after the anchor* is
true in **program order** and says nothing about the two `Instant` **values**. So a clock collision
lets the same anchor refuse the same path's re-reading again, and each of these presented one refusal
per commit as a guarantee (**line numbers as the reviewer cited them, at `08a3366`**, not on the
finished tree):

| Position | What it said |
|---|---|
| `ledger.rs:480` (module doc, *the anchor outlives the record*) | *"so it cannot be refused by it a second time"* |
| `ledger.rs:861` (`LedgerTally::preceded_a_commit`) | *"so one commit refuses one reading once"* |
| `watch_check.rs:1227` (the rewritten paragraph) | *"the re-reading is stamped after the anchor and **is** suppressed"* |
| `2d-3-notes.md:5004` (§16.6 item 30's round-11 correction block) | the same sentence as `watch_check`'s |

**The fix is one sentence at each of the four positions**, claim and concession together, never a
concession beginning a new sentence — round 11's High 2 was a record claiming that rule was satisfied
when the concession began a new sentence, and repeating that here would have been the fourth-round
instance of the same shape. The three code positions now say *usually* and name the mechanism in the
same breath: program order only, `Instant` not guaranteed strictly increasing, `decide` refusing at
equality, so successive re-readings can be refused until one stamp *strictly* exceeds the anchor.
`ledger.rs:480` adds what bounds the retry, because a reader's next question is whether this is a
livelock: **the host clock advancing**, not construction — and it is bounded in the safe direction,
since every refusal is answered by a re-observation and none of them publishes anything.

**The shape sweep found two more instances the reviewer did not name** (§18.5), both in per-round
record sections and both now carrying correction blocks: §15.3's *"so it cannot be refused by the same
anchor twice, and no re-observation loop exists"*, and §16.1's **third** bullet, whose sustained-growth
diagnosis is argued from the same premise. It also found one at a **name position** — the assertion
message closing
`a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading`, which read
*"one increment for one commit spanned: the anchor refuses the re-reading no second time"* and
generalized a property that test has **by construction** through `later_than_now`. That message and
the step-5 comment above it now say which of the two they are.

> **Correction (round-13 fix round, §19.1).** The paragraph two above ends on the sentence round 13
> found: *"`ledger.rs:480` adds what bounds the retry … **the host clock advancing**, not construction
> — and it is bounded in the safe direction, since every refusal is answered by a re-observation and
> none of them publishes anything."* **Answering the livelock question was right; the answer was
> wrong**, and it is this record's worst defect class one more time — a fix round writing a guarantee
> while closing one. The clock advancing bounds only *repeated chronology refusals once another
> settlement for that path is produced*, and nothing makes one be produced: `observe_owed` promises no
> answer for a path that never stabilizes, `crate::watch::ReObserveOutcome::Asked` promises a worker's
> inbox and not an observation, and the worker can consume `Stop` first (§5 item 21). The word
> **every** is the load-bearing error. §19.1 rewrites the module-doc sentence to say what the clock
> really bounds and to state the two unguaranteed conditions beside it, and **keeps the safety half
> unweakened** — the reviewer cleared that a `PrecedesACommit` refusal publishes nothing, and §19
> does not touch `decide`'s comparison, any signature or any control flow.

### 18.2 High 2 — the removal of the exact-zero assertion was recorded as costing nothing, and it cost a detection

**What was checked before this was written.** `WatchWorker::observe` takes `let read_after =
Instant::now();` **per pass**, immediately before `engine.tick`. A refusal at the stamped door returns
`ObservationOutcome::Undecided`, `deliver` calls `engine.revert_settlement`, and the path settles again
on a later pass with a **fresh** stamp. `decide`'s `PrecedesACommit` arm does
`ledger.tally.preceded_a_commit += 1`, and `LedgerTally` is **cumulative for the session**: nothing
resets it, `begin_epoch` clears the records, the path index and the anchors but not the tally.

**So the two stamping defects have two different endings, and only one of them is caught now:**

- a **permanently** early stamp — the worker stamping once at start — refuses the save's own hint on
  *every* re-reading, so it is never suppressed, and the bounded positive wait for `suppressed >= 1`
  times out. §17.6b's `OnceLock` neuter drove exactly this and the test failed **at the wait**;
- an **intermittently** early stamp — one pass stamped before `record_app_write`, the next after —
  is refused once, the engine's rollback produces a correctly stamped pass, that pass **is**
  suppressed, the wait is satisfied, and the test **passes**. Before round 11 the cumulative
  `preceded_a_commit` was left at one and the exact-zero assertion **failed**.

**The removal therefore surrendered a distinct detection**, and three sentences of the round-11 record
said it did not: item 30's correction block and §17.3 both say *"it detected nothing the wait does
not"*, §17.6b says *"the line's removal costs nothing"*, and §17.7 item 34 says an intermittent early
stamp *"still passes, exactly as it did before"* — which is false in its last three words, because
before the removal it did not pass. The same false claim stood at a **name position in the code**:
`watch_check.rs:1234`, *"Removing the assertion costs nothing it detected"*.

**The neuter was the right neuter for a claim it was not asked to prove**, and that is the general
lesson worth more than this instance: a `OnceLock` stamp instruments the *permanent* case only, so the
run proves the wait catches that case and is silent about every other. §17.6b read one run as proving
two claims.

**The removal stands.** Round 11 established that the assertion was timing-unsound — the save-thread
stall of §17.1 makes it fail with correct behaviour throughout — and round 12 does not dispute it. The
honest statement is a **trade**: the removed line could not tell an intermittently early stamp from a
harmless stall, so it was a line with two causes and one message, and deleting it bought a suite that
no longer fails on a healthy execution at the price of the only check that could see the intermittent
defect. Correction blocks dated to this round sit under §16.6 item 30, §17.3, §17.6b and §17.7 item
34; `watch_check.rs`'s own paragraph now states the trade where the assertion used to be; and
`LedgerTally::preceded_a_commit`'s second bullet says it too, because that doc is where a maintainer
looks for what the counter is for. **What the lost coverage would cost to recover is §18.7 item 35**,
and building it is not in this round's scope.

### 18.3 The first Low — the named suspect, confirmed at a bold first sentence

§16.1's closing paragraph — ***"It does not overclaim in the other direction."*** — supported itself
with two clauses, and **round 11 falsified both, three sections below, without touching this
paragraph**:

- *the **first** half of the old paragraph is intact* — round 11's High 1 changed it from **never** to
  **usually**;
- *the one production assertion of zero is **kept** rather than weakened — see §16.6 item 30 for what
  keeping it costs* — round 11's Medium **removed** it, and closed item 30 as a defect in the same
  round, so the sentence points at a section that no longer says what it is cited for.

The brief offered this as a **question**, not as a finding, exactly as round 10's brief offered a
suspect that turned out not to be a defect. This one is a defect: it survived a whole round at a bold
first-sentence position with no correction block, while three correction blocks were added above it.
A round-12 correction block now sits directly beneath it, naming both changes and saying what survives
— only the first clause, that the counter still counts refusals and never losses.

### 18.4 The other two Lows — an incomplete file list, and a residue assigned to a phase that does not own it

**Low 2 — §17.6 named three files and the commit holds five.** `git show 411658f --stat` lists
`PROGRESS.md`, `docs/decisions/2d-3-notes.md`, `docs/reviews/phase-2d-3-ledger.md`,
`src-tauri/src/ledger.rs` and `src-tauri/src/watch_check.rs`; §17.6 named the two Rust files and this
record. The correction block under §17.6 names both omissions and, more usefully, separates them:
**no** *what changed, file by file* section in this record has ever named
`docs/reviews/phase-2d-3-ledger.md` — §§10.2, 11.2, 12.4, 13.3, 14.6, 15.6 and 16.3, **seven sections
over seven rounds** — because the review file receives the reviewer's reply verbatim rather than an
authored change. That exclusion is defensible and was never declared, so **§18.6 declares it and names
the file anyway**. The `PROGRESS.md` omission is not covered by any such habit: round 11's is the
**first** 2d-3 fix commit to carry `PROGRESS.md` at all (round 10's fix, `82c7dc5`, holds four files
and none of them is `PROGRESS.md`). Every four-file claim derived from that list is wrong by the same
two names; the ones inside this record are corrected here, and the ones in `PROGRESS.md` are the
orchestrator's, reported rather than edited, because a phase worker does not write `PROGRESS.md`.

**Low 3 — item 33 assigned the deterministic production-stamping seam to 2d-4, and the authority does
not.** `docs/reviews/phase-2d-design.md` Q7 was read before deciding, because round 9 reversed a
rejection and round 10 downgraded an item, and disagreeing with the reviewer is legitimate when the
authority backs it. It does not back it here. Q7 item 4 is

> **2d-4 — queue, event wake, drain command, and wire contracts.** Add the typed queue,
> `workspace://reconciliation-ready`, `drain_external_changes`, TypeScript types/wrapper, command
> registration/dispatch tests, sequence/epoch/coalescing tests, and EN/ES code namespaces/accessors
> for every visible failure.

— a **wire** step, which names no stamp and no suppression. Q7 item 3 is *"2d-3 — save composition and
**suppression ledger**"*, which is this step, and the stamp itself is taken in `WatchWorker::observe`,
which Q7 item 2 placed in 2d-2. **No ruling assigns the seam to any phase**, so the attribution is
**removed** rather than re-pointed, and the test debt is carried unassigned. Inventing a phase for a
debt is a false precision that reads as a plan, and this review has spent twelve rounds finding
sentences that read as more than they are.

### 18.5 The two sweeps

Both were run as **separate passes**, and the counts below are line counts from `rg -c`, given as
**before → after** wherever this round's own edits move them, so a later round re-running them does
not read its own predecessor's work as a discrepancy.

**Pass 1 — for the shape, never for the words of the finding just closed.** Two shapes: *an ordering
or timing argument presented as a guarantee*, and *a removal presented as costless*.

```sh
rg -c 'after the anchor|after the record|refuses? one reading once|a second time|refused by it|refused by the same anchor' \
  src-tauri/src/{ledger,watch_check,commands,watch}.rs docs/decisions/2d-3-notes.md docs/reviews/phase-2d-design.md
rg -c 'costs nothing|cost nothing|detected nothing|detects nothing|loses nothing|lost nothing|exactly as it did before|no cost' \
  src-tauri/src docs/decisions/2d-3-notes.md docs/reviews/phase-2d-design.md
```

- the ordering shape, **at `08a3366` → on the finished tree**: `ledger.rs` **8 → 7**,
  `watch_check.rs` **1 → 1**, `commands.rs` **5 → 5**, `watch.rs` **0 → 0**, this record
  **14 → 24**, `phase-2d-design.md` **0 → 0**. `ledger.rs` falls by one because the module-doc
  sentence §18.1 rewrote no longer says *a second time*; this record rises by ten because of §18.1's
  own two correction blocks and this section quoting the pattern's own words back. Every hit at
  `08a3366` was read. The five `commands.rs` hits and `ledger.rs`'s at 1860, 1875 and 1996 are the
  **serialized doors'** argument — *a read the caller performed itself, under the session lock, after
  the record in program order* — and that is sound and is not this finding: those doors set
  `precedes_a_commit = false` by a `match door` and consult **no clock at all**, so no collision can
  reach them. `ledger.rs:3157` is a test comment whose next line is `later_than_now()`, true by
  construction. The remaining hits are the four §18.1 fixes, the two the reviewer did not name, and
  the one assertion message;

  > **Correction (round-13 fix round, §19.3).** *"The five `commands.rs` hits … are the **serialized
  > doors'** argument"* is **round 13's Low**: the count of five is right and the classification is
  > not, and the sweep's recorded judgement is the defect rather than the prose it judged. Read on the
  > tree round 13 reviewed, only **two** of the five are that argument —
  > `commands.rs:155` (*"itself, under the session lock, after the record, through a door that
  > cannot"*) and `commands.rs:2409` (*"function performed itself, under the session lock, after the
  > record, through"*). The other **three** matched the pattern's *a second time* alternative and are
  > about resolving something **twice**, with nothing to do with clock ordering at all:
  > `commands.rs:1339` (*"a second time here would be two lookups that agree today and are two
  > places"*), `commands.rs:1371` (*"identity a second time for that would be two lookups that agree
  > today and are"*) and `commands.rs:2057` (*"planner a second time here would resolve the document
  > twice and let this layer"*). All three are sound as written and none is a finding; what was wrong
  > is this record saying they were the serialized-doors argument, which is the shape a later round
  > would have had to re-derive to trust the sweep. **The `ledger.rs` half of the sentence stands**:
  > 1860, 1875 and 1996 really are the serialized doors', and so is the *no clock at all* reasoning
  > about them. The lesson is the sweep's own: a single `rg` pattern with alternatives returns hits
  > from **every** alternative, and a bullet that describes them with one argument has stopped
  > reporting a measurement and started summarizing one.
- the costless-removal shape, on the **narrowed** pattern printed above — the word *free* was
  deliberately dropped from it after a first pass, because *deadlock-free* and *free function* put
  ten hits in `commands.rs`, two in `watch.rs` and four in `phase-2d-design.md` that have nothing to
  do with this shape — **at `08a3366` → on the finished tree**: `ledger.rs` **1 → 1**,
  `watch_check.rs` **1 → 0**, `commands.rs` **0 → 0**, `watch.rs` **0 → 0**, this record
  **9 → 25**, `phase-2d-design.md` **1 → 1**. `watch_check.rs` falls to zero because *"Removing the
  assertion costs nothing it detected"* is the sentence §18.2 replaced; this record rises by sixteen
  because four correction blocks quote the false claims they correct, and §18.2 and this bullet quote
  them again. Of the nine hits at `08a3366`: §§1188, 1192, 3256 and 3656 of this record are about a
  **sequence not spent** — the ledger's economy, not a deleted check — §3924 is about a paragraph's
  content, `ledger.rs:1099` is about **lock contention** (*"it costs nothing because the one thread
  that could hold the gate for any length of time is a save"*), and `phase-2d-design.md:104`'s
  *"`refused` closes nothing"* is an adoption outcome. The remaining **four** in this record, plus
  `watch_check.rs`'s one, are exactly the five positions §18.2 corrects — and §17.7 item 34 matched
  **twice over**, on *detected nothing* and on *exactly as it did before*, the second phrase being in
  the pattern only because the reviewer's finding named it. That is worth recording as a limit of the
  method: the sweep would have found item 34 on the first phrase anyway, but a sweep written from the
  *words* of a finding cannot find the instance whose wording nobody has thought of yet.

**§17.5's two carried counts move, and both numbers are given so round 13 does not read this round's
own work as a discrepancy.** `rg -c 'same sentence'` over §17.5's five files was `ledger.rs` **6**
and this record **11**, total **17**, on the tree round 12 reviewed; it is now `ledger.rs` **7** and
this record **18**, **total 25** — one in the code because §18.1's fix says *in the same sentence*
where it puts the concession, and seven here because §18 states the rule at every position it applied
it, this paragraph included. (`docs/reviews/phase-2d-3-ledger.md`, which §17.5 did not sweep, holds a
further **5**.)
`rg -c 'preceded_a_commit'` was `ledger.rs` **15**, `watch_check.rs` **1**, `commands.rs` **1**; it is
now `ledger.rs` **15**, `watch_check.rs` **2**, `commands.rs` **1** — the identifier returns to
`watch_check` in §18.2's replacement paragraph, which has to name the counter to say what the removed
line read. **No identifier was added to production code and none was removed.**

**Pass 2 — name positions, as a distinct pass.** Headings, bold ruling lines, first sentences, doc
comments, module headers, test names and assertion messages, over the same files.

```sh
rg -n '^\s*fn [a-z_]+\(' src-tauri/src/{ledger,watch_check,commands,watch}.rs -o | rg -i 'once|never|always|cannot|no_|second|suppress|preced'
rg -n '^#{2,4} .*(once|never|always|cannot|costs?|nothing|guarantee)' -i docs/decisions/2d-3-notes.md docs/reviews/phase-2d-design.md docs/reviews/phase-2d-3-ledger.md
rg -n '^\*\*[^*]{0,120}(never|always|cannot|once|costs nothing|guarantee)' -i docs/decisions/2d-3-notes.md
```

- **it found two, and both are fixed**: the bold first sentence of §16.1's closing paragraph (the
  Low the brief named, §18.3) and the assertion message at the end of
  `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading` (§18.1);
- **24 test names matched and every one was judged.** The five `never` names —
  `a_reading_taken_before_a_commit_never_supersedes_its_record`,
  `a_serialized_door_reading_is_never_refused_by_a_commit_anchor`,
  `a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes`,
  `a_post_commit_external_replacement_supersedes_the_record_and_is_never_ours` and
  `a_post_save_refresh_is_never_refused_when_no_clock_could_place_it_after_the_commit` — are all
  **sound, and three of them for a reason worth stating: equality moves the outcome toward
  *refusal*, so a clock collision makes a *never-supersedes* claim more true and never less.** The
  other two are control-flow claims about a `match door` that reads no clock;
- **the test name `…_is_counted_once_and_admitted_on_its_next_reading` was judged and left**, and the
  reason is recorded rather than assumed: a test name names the scenario the test **drives**, and
  this one drives a hand-passed `later_than_now()` stamp for which *counted once* is true by
  construction. What generalized was the assertion message inside it, and that is what changed;
- the eight `### … What is guaranteed now, and what is not` sections were read for a *one refusal per
  commit* claim. **None carries one.** §§10.5 and 11.5's *a watcher reading cannot place strictly
  after its own last committed write* is a claim about what is **refused**, so equality strengthens
  it.

**For the consuming-operation shape** (`CLAUDE.md`'s standing rule, and 2c-5-4a's scar): this round
adds no operation, consumes nothing and discards no result. It changes one assertion message, adds
comments, and adds correction blocks.

### 18.6 What changed, file by file

**Declared, per §18.4: this list names every file in the round's commit, and says which is a verbatim
append.**

- **`src-tauri/src/ledger.rs`** — the module doc's *widening the refusal is safe* sentence rewritten
  to carry the clock concession (§18.1); `LedgerTally::preceded_a_commit`'s **first** bullet given the
  same concession inside the same sentence, and its **second** bullet rewritten to state the
  removal's real cost (§§18.1, 18.2); the step-5 comment and the closing assertion **message** of
  `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading` scoped to
  that test's construction (§18.1). **One assertion message changed and no assertion added or
  removed; no test added or removed; no behaviour, no signature, no control flow, and `decide`'s
  comparison untouched.**
- **`src-tauri/src/watch_check.rs`** — inside
  `a_committed_save_is_suppressed_while_a_later_external_write_is_not`, the *is suppressed* sentence
  given the clock concession (§18.1), and *"Removing the assertion costs nothing it detected"*
  replaced by the trade it actually is (§18.2). **Comments only.** The removed assertion is **not**
  restored.
- **`docs/decisions/2d-3-notes.md`** — **nine** correction blocks, one per corrected position:
  §15.3's *widening the refusal* paragraph, §16.1's third bullet, §16.1's closing paragraph, §16.6
  item 30, §17.3, §17.6, §17.6b, §17.7 item 33 and §17.7 item 34 — **and this §18**. Every one is
  **added beneath** the text it corrects; nothing is deleted or silently rewritten, including the
  round-11 correction blocks that two of these correct in their turn.
- **`docs/reviews/phase-2d-3-ledger.md`** — round 12's section appended: a prose preamble and the
  reviewer's reply **verbatim**. The verbatim half is not an authored change.
- **`PROGRESS.md`** — the orchestrator's, not this round's: the round-12→round-13 handoff and the
  commit row. **Named here because §17.6 not naming it is round 12's second Low.**
- **no core file, no `src/` path, and no command, wire type, event, queue, i18n key or user-visible
  string.**

### 18.6b The gates, and what this round did not measure

No neuter was run and none was owed: this round changes no production behaviour, deletes no check and
adds none. The one code change with a runtime existence — an assertion **message** — is exercised by
the test that carries it on every run.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1268 passed, 0 failed** (exit 0, summed over **26** `test result` lines — unchanged, and it must be: this round adds and removes no test, and changes one assertion's message only) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** (exit 0, **223** filtered out, quiet host, no timeout; this round changed only comments in that file) |

**One measurement moved and it is not this round's doing, so it is stated rather than left for round 13
to trip over.** The focused serial gate ran **71.24 s** before the fix and **285.53 s** then **253.40 s**
after it, the second of those on a verified-quiet host with no orphaned test binary. All three runs are
**20 passed, 0 failed, 223 filtered out, exit 0**. The suite is built of bounded waits, so a slower host
lengthens the run without changing the verdict, and this round edited only comments in that file — no
timing constant, no wait, no test. **The duration is host state, not a property of the tree**, and the
ladder of past figures (64.77 s, 64.85 s, 71.24 s) must not be read as a regression baseline: what the
gate asserts is 20/20 and no timeout, never a wall-clock.
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean** (exit 0) |
| `cargo fmt --check` | **clean** (exit 0) |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** (no match; this round touched no core file) |
| `npm run check` files / `npm test` / `npm run build` modules | **431 / 2125 / 184 — not re-run; the frontend was not touched**, on the warrant of §18.6's file list and of `git diff --name-only 08a3366 -- src/` being empty |

### 18.7 What this round's own change leaves open

Written with the expectation §15 states and this round does not weaken: **seven** §5 items recorded as
bounded residues have since been found to be real defects. Round 12's own two Highs are a further
warning of a different kind — both were **records about a residue**, written by the round that created
it, and both overstated it. What this round leaves:

35. **The intermittent-early-stamp detection is gone and nothing replaces it.** This is §18.2's price,
    stated as a debt rather than as a trade already paid. Recovering it needs a **deterministic
    production-stamping seam**: a way to make `WatchWorker::observe` take a stamp a test chooses, and
    a way to hold `record_app_write` behind a settle, so the interleaving can be driven instead of
    argued. Both are production code changed for a test's benefit on the one path where being wrong is
    worst, and this step has not built one. **Q7 assigns it to no phase** (§18.4), so
    it is carried here unassigned and must not be quietly attached to one. Until then the suite
    catches a *permanently* early stamp, through one bounded positive wait, and nothing else.
36. **Every correction this round made is prose, and no test fails if a later round un-makes one.**
    The four claims of §18.1 and the five of §18.2 are enforced by nothing — this is the same gap
    `CLAUDE.md` records for the i18n suites, where parity and placeholders are checked and *meaning*
    is not, and it is why twelve rounds of review have each found a false sentence that every gate was
    green over. The concession now lives inside the same sentence as its claim at every position, which
    makes it harder to lose by accident and not losable by moving a full stop alone — the exact failure
    round 11's High 2 named — but *harder* is the whole of the claim, and nothing enforces it.
37. **§18.6's declaration is a convention, not a check.** Nothing compares a *what changed, file by
    file* list against `git show <commit> --stat`, so the next incomplete list will be found by the
    next reviewer or not at all — which is exactly how this one was found, seven sections after the
    habit started.

## 19. The round-13 fix round

`docs/reviews/phase-2d-3-ledger.md` round 13 returned **NOT READY** with **two Highs and one Low**.
Round 12's lesson was *a fix round's own fix becomes the next round's finding*; round 13 is that
lesson at its purest, because **both Highs are sentences round 12's fix round wrote or left
standing**, and the High the reviewer calls the sharpest is at this record's **§1 headline** — the
one position eight correction blocks have already been stacked under.

**That makes thirteen consecutive rounds with a name-position finding.** Both Highs are again this
project's declared worst defect class — a record claiming a guarantee the code does not give — and
the shape they share is new to this review: not an *ordering* premise, which rounds 10 to 12 chased,
but a **liveness** one. *The refusal is answered.* *The engine must answer the debt.* Both are true
of a rollback and of a coalescing rule, and neither is true of an observation arriving.

**All three findings were verified against the code before anything was written**, and all three are
real; **none is rejected by this record**, unlike round 9, which reversed a rejection, and round 10,
which downgraded an item. What the **reviewer** cleared, expressly: `decide`'s equality refusal, the safety
property that a `PrecedesACommit` decision never reaches the downstream sink, the exact-zero
assertion's removal and its replacement justification, residues 35–37 apart from the liveness
overclaim, §18.5's supplied sweep arithmetic and file list, and the serialized-door reasoning **at
the hits where it applies**.

### 19.1 High 1 — the retry is bounded by nothing, and the module doc said the host clock bounded it

**The claim, as round 12's fix round left it** (`ledger.rs`, the module doc's *the anchor outlives
the record* section, line 486 at `719c864`):

> That retry is bounded by the host clock advancing rather than by construction, and it is bounded
> in the safe direction: **every** refusal is answered by a re-observation and none of them
> publishes anything.

**The code that refuses it, in this same crate.** `crate::watch::ReObserveOutcome`'s own doc:
*"**Neither variant claims anything about what will be observed.** … a path that never stabilizes —
one being written continuously — is never answered at all. … In particular `ReObserveOutcome::Asked`
is **not** a promise that an observation will arrive: it is a promise that the request reached the
inbox of a worker that had not yet exited."* `ObservationEngine::observe_owed`'s: *"It also promises
no answer at all for a path that never stabilizes: a file written continuously stays pending, and
the debt waits with it."* And `WorkerMessage::Stop` exists, so the worker can consume it before its
next tick — which is §5 item 21, written seven rounds ago.

**So the word doing the damage is *every*, and the second is *bounded*.** The host clock advancing
bounds only the run of **repeated chronology refusals once another settlement for that path is
produced**; nothing makes one be produced, so the clock may advance indefinitely with the retry
never completing. That is the reviewer's minimal fix and it is the one taken: the module doc now
says what the clock bounds, and states the two unguaranteed conditions — stabilization and worker
lifetime — beside it.

**What is *not* wrong, and is deliberately not weakened.** The **safety** half needs no liveness at
all and the reviewer cleared it: a `PrecedesACommit` refusal publishes nothing, clears no record and
mutates nothing but the tally, and the engine's settlement is **taken back** rather than kept, so
what an uncompleted retry leaves behind is a state still **owed** — never a state reported wrongly,
and never a record cleared by a reading older than the commit. That is why the counter is named for
refusals and not for losses, and it survives this round untouched. `decide`'s `read_after <= at`
comparison is not changed, nor is any signature, control flow or behaviour anywhere in the round.

> **Correction (round-14 fix round, §20.2).** The paragraph directly above says *"what an uncompleted
> retry leaves behind is a state still **owed**"*, and that is round 14's second High at the very
> position §19 wrote to record what it was keeping. A refusal at the stamped door takes back an
> ordinary **native hint's** settlement, which discharged no `observe_owed` request, so
> `revert_settlement` runs its `else { self.hint(path, now) }` arm: what is left behind is a state
> **un-concluded and re-hinted**, and a hint can be coalesced away. Read the sentence with
> *un-concluded and re-hinted* in place of *still owed*. **The three claims the reviewer cleared, in
> round 13 and again in round 14, are unchanged**: publishes nothing, clears no record, mutates
> nothing but the tally — and neither *never a state reported wrongly* nor *never a record cleared by
> a reading older than the commit* depends on the debt.

**The positions fixed** (line numbers as at `719c864`, the tree round 13 read):

| Position | What it said |
|---|---|
| `ledger.rs:486` (module doc, *the anchor outlives the record*) | *"every refusal is answered by a re-observation"*, and the retry *"bounded by the host clock advancing"* |
| `ledger.rs:190` (module doc, *two proofs*) | *"the engine's settlement is taken back, so the path is re-observed"* |
| `ledger.rs:871` (`LedgerTally::preceded_a_commit`, first bullet) | *"because a refusal here is answered and the re-observation's own stamp is taken after the anchor"* |
| `ledger.rs:904` (`LedgerTally::preceded_a_commit`, closing paragraph) | *"every refusal of a watcher observation is answered by taking the engine's settlement back, and the path is re-observed"* |
| `ledger.rs:1199` (a comment inside `record_app_write`) | *"a refusal that is answered and re-observed, never a lost change"* |
| `ledger.rs:278` (module doc, the *re-observed* section's closing sentence) | *"is followed by one somebody can"* |
| `watch_check.rs:1228` (the round-12 paragraph) | *"the re-reading is stamped after the anchor and **is** suppressed"* |
| `commands.rs:8372` (an **assertion message**) | *"the file this save may have written is observed again rather than assumed"*, over a test that reads the **inbox** |

Each now separates the two halves in the **same sentence**, per §17.2's rule: *answered* names the
rollback and the re-owing, and never an arriving observation. The assertion message is the round's
name-position instance in code — it asserts `inbox.re_observations() == vec![path]`, which is
exactly what `ReObserveOutcome` says an `Asked` promises, and its message generalized that to an
observation. It now says **asked for**.

> **Correction (round-14 fix round, §20.2).** *"**Answered** names the rollback and the re-owing"* is
> round 14's second High in the sentence that says what §19 put in each of those eight positions: the
> rollback restores the state and **re-hints**, and re-owes only where the settlement taken back had
> discharged an `observe_owed` request, which an ordinary native hint's had not. Read it as *answered
> names the rollback — the restore and the re-hint, with the debt back only where one was
> discharged*. All eight positions in the table above carry that correction from round 14 on, six of
> them named again by the reviewer; the ninth, `src-tauri/src/main.rs`'s module header, is a twin
> §19.4's sweep could not see because its file list did not include `main.rs` (§20.4). Everything
> else in this subsection stands, including the assertion message's **asked for**, which round 14's
> reviewer cleared by name.

**Three record positions carry correction blocks for the same premise**, all found by §19.4's shape
pass: §10.5's *Guaranteed* paragraph (*"and is answered so the engine re-observes it"* — a
**`Guaranteed.` name position**), §15.3's own **round-12 correction block**, whose last two lines
shipped the overclaim while closing the ordering one, and §16.1's third bullet, which round 12
corrected for the clock and left standing for the arrival. §18.1's paragraph — the record of the
sentence itself — carries a fourth.

### 19.2 High 2 — the §1 headline guaranteed liveness `observe_owed` expressly refuses

**The claim, at this record's sharpest name position** (§1, line 18 at `719c864`):

> and every one of those requests is an **owed** observation the engine **must answer** rather than
> a hint it may coalesce into silence

**The code that refuses it** is the primitive the clause is about.
`crates/espansoconfig-core/src/watch/engine.rs`'s `observe_owed`, in its own *what this does not do,
said beside what it does* paragraph: it *"promises no answer at all for a path that never
stabilizes: a file written continuously stays pending, and the debt waits with it"* — and one
paragraph above, *"A path this engine does not watch is dropped exactly as `ObservationEngine::hint`
drops it, and records no debt."* So the engine neither must answer, nor always can, nor always
records a debt to answer.

**And the record already knew, in two places.** §5 item 21 says a re-observation absorbed by a worker
that then receives `Stop` is *"a request no tick will serve"*, and §5 item 19 says one reaches
nothing when no watcher is running. §12.6, the section that **wrote** the clause, ends its own
*guaranteed* paragraph with *"every one of these is a claim about a running watcher plus a running
engine"*. The headline contradicted its own §5 from the round-6 fix round onward, through two
further correction blocks and six reviews.

**The fix is the reviewer's minimal one**, and it turns the claim into the **negative** guarantee
that is real: an owed observation cannot be discharged by **coalescing** it into silence, and it
stays owed until a settlement of that path emits — with *never a promise that one will* inside the
**same sentence**. Nothing the clause was built for is weakened: *a hint that could be answered by
silence* was round 6's first High (§12.1) and `observe_owed` still closes it. What is withdrawn is a
promise no round ever built.

**The same sentence stood in code**, which the reviewer did not name and §19.4's pass found:
`src-tauri/src/commands.rs`'s module header, in the list of the six things this module composes with
— *"the fact that such a request is an **owed** observation the engine must answer rather than a
hint it may coalesce away"*. It carries the corrected sentence from this round on. §12.6 gets a
correction block as the clause's origin.

### 19.3 The Low — §18.5 classified five sweep hits as one argument, and they are two

§18.5's ordering-shape bullet said *"The five `commands.rs` hits and `ledger.rs`'s at 1860, 1875 and
1996 are the **serialized doors'** argument — a read the caller performed itself, under the session
lock, after the record in program order"*. The **count is right and the classification is not**, and
the defect is in the sweep's recorded judgement rather than in any prose it judged.

Measured on the tree round 13 read, only **two** of the five are that argument:

- `commands.rs:155` — *"itself, under the session lock, after the record, through a door that
  cannot"*;
- `commands.rs:2409` — *"function performed itself, under the session lock, after the record,
  through"*.

The other **three** matched the pattern's *a second time* alternative and are about resolving
something **twice**, with nothing to do with clock ordering:

- `commands.rs:1339` — *"a second time here would be two lookups that agree today and are two
  places"*;
- `commands.rs:1371` — *"identity a second time for that would be two lookups that agree today and
  are"*;
- `commands.rs:2057` — *"planner a second time here would resolve the document twice and let this
  layer"*.

All three are sound as written; none is a finding. The `ledger.rs` half of the sentence stands — 1860,
1875 and 1996 really are the serialized doors', and so is the *those doors consult no clock at all*
reasoning about them. A correction block sits inside §18.5's bullet, indented into it so the bullet
and its correction are read together.

**The general lesson is the sweep's own**: a single `rg` pattern with alternatives returns hits from
**every** alternative, and a bullet that describes them all with one argument has stopped reporting a
measurement and started summarizing one. §19.4 therefore names, for each pattern, which alternative
each surviving hit matched wherever the hits are not homogeneous.

### 19.4 The two sweeps

Both were run as **separate passes**, written from the *shape* and not from the words of the three
findings. Counts are `rg -c` line counts given as **before → after**, *before* measured on the clean
tree at `719c864` **prior to any edit of this round**, so round 14 does not read this round's own
work as a discrepancy.

**Pass 1 — for the shape.** Two shapes, and neither is round 12's ordering shape: *a liveness or
answer-guarantee presented as certain*, and *a debt or request described as one that will be
discharged*.

```sh
rg -c 'is answered|are answered|re-observed|observed again|must answer|is re-observed|will be observed|answered by a re-observation|bounded by the host clock' \
  src-tauri/src/{ledger,watch,watch_check,commands}.rs crates/espansoconfig-core/src/watch/engine.rs \
  docs/decisions/2d-3-notes.md docs/reviews/phase-2d-design.md docs/reviews/phase-2d-3-ledger.md
rg -c 'must answer|will be answered|is discharged|debt is answered|owed observation the engine|the engine must' \
  src-tauri/src/{ledger,watch,watch_check,commands}.rs crates/espansoconfig-core/src/watch/engine.rs \
  docs/decisions/2d-3-notes.md docs/reviews/phase-2d-design.md docs/reviews/phase-2d-3-ledger.md
```

- the **liveness** shape, **at `719c864` → on the finished tree**: `ledger.rs` **16 → 11**,
  `watch.rs` **8 → 8**, `watch_check.rs` **0 → 0**, `commands.rs` **11 → 9**,
  `engine.rs` **12 → 12**, this record **21 → 52**, `phase-2d-design.md` **0 → 0**,
  `phase-2d-3-ledger.md` **0 → 10** (corrected in place by the round-14 fix round; it said **0 → 0**,
  which is round 14's first Low — see the block at the end of this section).
  **Every hit at `719c864` was read.** `ledger.rs` loses **nine**
  matching lines across the six positions §19.1 rewrote and gains **four** back — three rewritten
  sentences that still contain *is answered* and now carry the concession beside it, plus one new
  line saying what the section heading's *re-observed* means. `commands.rs` falls by two, the module
  header and the assertion message. This record rises by thirty-one because §19's seven correction
  blocks and this section quote the corrected words back, which is the same inflation §18.5 recorded
  and for the same reason. Of what survives in `ledger.rs`: the section heading at 257 and the four
  test comments and assertion messages at 3203, 3434, 3839 and 3925 are **driven by the test that
  contains them** —
  each of those tests ticks the engine itself, so the re-observation is true by construction there,
  which is round 12's own precedent for `later_than_now()`; `Admission::PrecedesACommit`'s *"the one
  arm a producer must answer"* is an **obligation on the producer**, and `admitting_sink`'s doc says
  in as many words that nothing forces a caller to meet it; and the remaining four are §19.1's own
  rewritten sentences and the new heading gloss. In `commands.rs` the survivors are unrelated senses
  of *answered* — a command answering a value, a finding answered separately — except line 101,
  *"a refused reading is answered by `ObservationEngine::revert_settlement`"*, which is sound
  precisely because it **names the function** that does the answering rather than an observation;
- the **debt** shape, **at `719c864` → on the finished tree**: `ledger.rs` **2 → 2**, `watch.rs`
  **3 → 3**, `watch_check.rs` **0 → 0**, `commands.rs` **2 → 1**, `engine.rs` **7 → 7**, this record
  **2 → 10**, `phase-2d-design.md` **0 → 0** and `phase-2d-3-ledger.md` **0 → 3** (corrected in place
  by the round-14 fix round; the two were given together as *both review files* **0 → 0**, which is
  round 14's first Low — see the block at the end of this section).
  `commands.rs` falls by the module-header sentence
  §19.2 corrected. **This record's own movement is the one to read with care, and it is the reverse
  of what a reader expects**: the two hits at `719c864` were §1's headline and §12.6's sentence — the
  two false ones — and the headline's is now gone, yet the count went **up**, because §19.2 and three
  correction blocks quote the removed sentence in order to correct it. **A rising count can mean a
  removal here**, which is why every hit is read and none of these totals is a gate. Of the
  survivors, `watch.rs:1199` (*"A debt is the one form a settlement must
  answer"*) and `engine.rs:591` (*"a debt is discharged by the settlement that …"*) are **conditional
  on a settlement occurring** and claim nothing about whether one does; `watch.rs:271` and
  `ledger.rs:619` are obligations on a named caller; and the rest are assertion messages in tests
  that drive their own ticks.

**Pass 2 — name positions, as a distinct pass.** Headings, bold ruling lines, first sentences, doc
comments, module headers, test names and assertion messages.

```sh
rg -n '^\s*fn [a-z_]+\(' src-tauri/src/{ledger,watch_check,commands,watch}.rs -o | rg -i 'answer|observ|owed|debt|suppress|bounded'
rg -n '^//! # ' src-tauri/src/{ledger,watch,commands}.rs
rg -n '^#{2,4} .*(answer|observ|owed|debt|guarantee|must)' -i docs/decisions/2d-3-notes.md docs/reviews/phase-2d-design.md docs/reviews/phase-2d-3-ledger.md
```

- **it found three, and all three are fixed**: §1's headline (the High the reviewer named), the
  assertion message at `commands.rs:8372` (§19.1's table), and §10.5's ***Guaranteed.*** paragraph,
  whose first sentence ended *"and is answered so the engine re-observes it"*;
- **`ledger.rs`'s module-doc heading *A read the save path could not use — or could not prove
  stable — is re-observed* was judged and kept**, and the reason is recorded rather than assumed: its
  contrast is with **published**, which is what the section is about and how §11.4's file list
  describes it, and renaming it would strand that description. What was wrong was the section's
  **closing sentence** — *"is followed by one somebody can"* — which now says *asked* to be followed,
  with the three reasons an ask may go unanswered in the same sentence and a line saying the heading's
  *re-observed* is the contrast and not a promise;
- **the `…_asks_for_a_re_observation…` test names in `commands.rs` are this shape done right** and
  are left alone: three names, each saying **asks for**, over tests that assert an inbox. So is
  `watch.rs`'s `a_re_observation_issued_while_the_baseline_fails_is_answered_once_it_starts`, whose
  *once it starts* is the condition;
  `ledger.rs`'s `a_refused_stabilized_state_is_re_observed_rather_than_lost` drives its own ticks,
  and its *rather than lost* is the safety half this round does not weaken;
- the **eight** `### … What is guaranteed now, and what is not` sections were read again, this time
  for a **liveness** claim rather than round 12's *one refusal per commit*. §10.5 carried one and is
  corrected. §12.6 carried the origin of the §1 headline and is corrected. **§8.7 is the one that got
  it right all along** and is worth naming: its *not guaranteed* list says, in as many words, *"That a
  refused reading is re-observed"*. §§7.4, 11.5, 13.6 and 14.8 state their claims in a *Guaranteed*
  paragraph whose companion *Not guaranteed* paragraph names §5 items 19, 20 and 21 immediately
  below; that is the section's declared two-paragraph shape rather than a concession lost in another
  sentence, and they are judged sound as structured and left.

**Round 12's four carried counts move, and both numbers are given for each.** On §18.5's ordering
pattern: `ledger.rs` **7 → 7**, `watch_check.rs` **1 → 1**, `commands.rs` **5 → 5**, `watch.rs`
**0 → 0**, this record **24 → 38**, `phase-2d-design.md` **0 → 0** — no code hit moves, because
§19 rewrote no sentence that matched that pattern. On §18.5's costless-removal pattern: `ledger.rs`
**1 → 1**, `watch_check.rs` **0 → 0**, `commands.rs` **0 → 0**, `watch.rs` **0 → 0**, this record
**25 → 25**, `phase-2d-design.md` **1 → 1**. `rg -c 'same sentence'`: `ledger.rs` **7 → 7**, this
record **18 → 26**, `docs/reviews/phase-2d-3-ledger.md` **5 → 6** (corrected in place by the round-14
fix round; it said **5 → 5**, which is round 14's first Low), and `commands.rs` **0 → 1** —
the identifier reaches that file for the first time because §19.2's replacement says which record
sentence it is the twin of. `rg -c 'preceded_a_commit'`: `ledger.rs` **15 → 15**, `watch_check.rs`
**2 → 2**, `commands.rs` **1 → 1**. **No identifier was added to production code and none was
removed.**

**For the consuming-operation shape** (`CLAUDE.md`'s standing rule, and 2c-5-4a's scar): this round
adds no operation, consumes nothing and discards no result. It changes one assertion **message**,
edits comments and doc comments, and adds correction blocks.

> **Correction (round-14 fix round, §20.3), on three of this section's after-counts.** Round 14's
> first Low: every *after* figure above for `docs/reviews/phase-2d-3-ledger.md` was measured on a tree
> that did **not** yet hold the round-13 review text the same commit appended to that file, so three
> of them were wrong the moment the commit was made. Re-measured on `5a41d7d` — the finished tree of
> the round-13 commit, with `git archive 5a41d7d | rg -c` over the same three patterns — that file
> holds **10** liveness-shape hits, **3** debt-shape hits and **6** `same sentence` hits, against the
> **0**, **0** and **5** recorded. All three are corrected **in place** above, each marked, because a
> count is read as a measurement and a block beneath it would leave the false figure standing where a
> later round re-runs the sweep. **Nothing else moves**: every other before- and after-count in this
> section was re-measured on the same tree and stands — `ledger.rs` 16 → 11 and 2 → 2, `watch.rs`
> 8 → 8 and 3 → 3, `watch_check.rs` 0 → 0, `commands.rs` 11 → 9 and 2 → 1, `engine.rs` 12 → 12 and
> 7 → 7, this record 21 → 52 and 2 → 10, both of round 12's carried patterns, and
> `rg -c 'preceded_a_commit'`. **The cause is the rule this section already states one paragraph
> above and did not apply to itself**: the round's own commit inflates a count by quoting the words it
> corrects, and the review file is inflated by an *append* rather than by an edit — which is why
> §20.4 measures every after-count on the finished tree **including** the review file's new section,
> and says so.

### 19.5 What changed, file by file

**Per §18.6's declaration: this list names every file in the round's commit, and says which is a
verbatim append and which is not this round's authorship.**

- **`src-tauri/src/ledger.rs`** — six doc-comment and comment positions given the liveness
  concession in the same sentence as the claim (§19.1's table): the module doc's *two proofs* bullet,
  the *the anchor outlives the record* sentence the reviewer cited, the closing sentence of the
  *a read the save path could not use* section, both halves of
  `LedgerTally::preceded_a_commit`'s doc, and one comment inside `record_app_write`. **Comments and
  doc comments only. No behaviour, no signature, no control flow; `decide`'s `read_after <= at`
  comparison untouched; no test, no assertion and no assertion message added, removed or changed in
  this file.**
- **`src-tauri/src/commands.rs`** — the module header's *owed observation* sentence rewritten to the
  negative guarantee (§19.2), and the **assertion message** at the end of
  `an_uncertain_write_evicts_the_parse_and_asks_for_a_re_observation` changed from *is observed
  again* to *is asked for again*, with four lines saying what the assertion reads (§19.1).
  **One assertion message changed; no assertion added or removed, no test added or removed, no
  behaviour, no signature and no control flow.**
- **`src-tauri/src/watch_check.rs`** — inside
  `a_committed_save_is_suppressed_while_a_later_external_write_is_not`, the round-12 paragraph's
  *is suppressed* sentence now says the re-reading is conditional on the path stabilizing again and
  on the worker still ticking (§19.1). **Comments only.** The removed exact-zero assertion is **not**
  restored.
- **`docs/decisions/2d-3-notes.md`** — **seven** correction blocks, one per corrected position: §1's
  headline (which is also rewritten in place, as every previous §1 correction has done), §10.5's
  *Guaranteed* paragraph, §12.6's *guaranteed* paragraph, §15.3's round-12 correction block, §16.1's
  third bullet and §18.1's fix paragraph — six — plus the seventh, indented inside §18.5's ordering
  bullet for
  the Low — **and this §19**. Every one is **added beneath** the text it corrects; nothing is deleted
  or silently rewritten, including the two round-12 correction blocks that two of these correct in
  their turn.

  > **Correction (round-14 fix round, §20.3).** The count above said **six** while its own list named
  > **seven**, and `rg -n 'Correction \(round-13 fix round'` over this record returns seven: §1, §10.5,
  > §12.6, §15.3, §16.1, §18.1 and §18.5's indented one. Round 14's second Low. The number is
  > corrected **in place**, for the same reason the three counts in §19.4 are — a figure a later round
  > re-derives must be right where it is read — and the *plus* clause is rewritten so the sentence's
  > own arithmetic is visible rather than inferred. Nothing about which positions were corrected
  > changes; the list was always right and only the number was wrong. The miscount also reached
  > `PROGRESS.md`, which is the orchestrator's file and is reported here rather than edited (§18.4's
  > Low 2 and §18.6's convention).
- **`docs/reviews/phase-2d-3-ledger.md`** — round 13's section appended: a prose preamble and the
  reviewer's reply **verbatim**. The verbatim half is not an authored change.
- **`PROGRESS.md`** — the orchestrator's, not this round's: the round-13→round-14 handoff and the
  commit row. Named here because §18.4's Low 2 was an incomplete list and §18.6 declared the
  convention that fixes it.
- **no core file** — `crates/espansoconfig-core` is untouched, which matters this round because both
  Highs quote `ObservationEngine::observe_owed`'s doc **as the authority that refuses them**: the
  primitive already said the true thing, and only its consumers' descriptions were wrong. **No
  `src/` path, and no command, wire type, event, queue, i18n key or user-visible string.**

### 19.6 The gates

No neuter was run and none was owed: this round changes no production behaviour, deletes no check
and adds none. The one code change with a runtime existence — an assertion **message** — is exercised
by `an_uncertain_write_evicts_the_parse_and_asks_for_a_re_observation` on every run.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1268 passed, 0 failed** (exit 0, summed over **26** `test result` lines — unchanged, and it must be: this round adds and removes no test, and changes one assertion's message only) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** (exit 0, **223** filtered out, **72.63 s**, quiet host, no timeout; this round changed only comments in that file) |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean** (exit 0) |
| `cargo fmt --check` | **clean** (exit 0) |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** (no match; this round touched no core file) |
| `npm run check` files / `npm test` / `npm run build` modules | **431 / 2125 / 184 — not re-run; the frontend was not touched**, on the warrant of §19.5's file list and of `git diff --name-only 08a3366 -- src/` being empty on the tree this round started from |

**§18.6b's warning about the focused gate's duration stands and is repeated because it is easy to
mistake for a regression**: that suite is built of bounded waits, so a slower or busier host
lengthens the run without changing the verdict. What the gate asserts is **20/20 and no timeout**,
never a wall-clock, and this round edited only comments in that file — no timing constant, no wait,
no test.

### 19.7 What this round's own change leaves open

Written with the expectation §15 states and this round does not weaken: **seven** §5 items recorded
as bounded residues have since been found to be real defects. Round 13's own two Highs are a further
instance of round 12's warning — both are sentences a *fix round* wrote while closing something
else. What this round leaves:

38. **Nothing anywhere states the liveness contract in one place, so each consumer restates it and
    each restatement can be wrong.** The true statement lives in three separate doc comments —
    `ObservationEngine::observe_owed`'s *what this does not do*, `ReObserveOutcome`'s *neither variant
    claims anything about what will be observed*, and §5 items 19 and 21 — and every description of
    the pipeline paraphrases them. Both of this round's Highs are paraphrases that dropped a
    qualification, in a module doc and in a headline, and §19.4 found nine more of the same shape.
    **Nothing enforces the paraphrase**: no type carries the distinction between *asked* and
    *observed*, `ReObserveOutcome` is discarded by four of its five callers by design (the ask may
    not steer a save), and no test can fail a sentence. What would close it is a single named
    statement every position points at instead of restating — a real edit to make, and this round
    did not make it, because inventing a canonical section while fixing eight positions is how a
    fix round produces the next round's finding.
39. **The safety half is argued and not driven.** *A `PrecedesACommit` refusal publishes nothing,
    clears nothing and leaves the state owed* is the half that survives this round, and the
    reviewer cleared it — but what a test drives is the refusal and the rollback, over an engine the
    test ticks itself. **No test in this crate holds a path in a permanently unstable state and
    asserts that nothing is published for it**, because doing so needs a way to keep a real watcher
    probing while the disk never settles. So the property that the retry's failure is *safe* rests
    on reading `decide`'s arm and `admitting_sink`'s match, exactly as it rested before this round.

    > **Correction (round-14 fix round, §20.2).** *"Leaves the state owed"* is round 14's second
    > High inside the item that names what survives. The refusal takes back a **native hint's**
    > settlement, which discharged no debt, so `revert_settlement`'s `else { self.hint(…) }` arm runs
    > and what is left is a state **un-concluded and re-hinted**. Read the item with that phrase in
    > place of *leaves the state owed*; the two negatives it turns on — publishes nothing, clears
    > nothing — are exactly what round 14's reviewer cleared, and the item's own point, that they are
    > argued rather than driven, is unchanged. Item 42 is round 14's version of the same gap.
40. **Every correction this round made is prose, and no test fails if a later round un-makes one.**
    §18.7 item 36 said this of §18's nine positions; it is now true of a further eight, and the
    argument is unchanged — this is the same gap `CLAUDE.md` records for the i18n suites, where
    parity and placeholders are checked and *meaning* is not. What round 13 adds to the item is a
    sharper version of its own lesson: §19.4's liveness sweep shows that **a fix can leave the
    line-based count almost unmoved** — this record's debt-shape count went **2 → 10** while the false
    sentence was removed and correction blocks quoting it were added, and the *liveness* count moved
    the same way, 21 → 52 — so a future round must read
    the hits and never the totals.

    > **Correction (round-14 fix round, §20.3).** The example above read *"this record's debt-shape
    > count went 2 → 2"*, which contradicts §19.4's own — and correct — **2 → 10** two subsections
    > earlier, and is round 14's first Low. The figures are corrected **in place**; the item's point
    > survives intact and is arguably better served by the true numbers, because *"a rising count can
    > mean a removal"* is the trap §19.4 names in as many words, while *2 → 2* implied the softer
    > *"a count that does not move"*. Both readings lead to the same rule: read the hits, never the
    > totals.

---

## 20. The round-14 fix round

`docs/reviews/phase-2d-3-ledger.md` round 14 returned **NOT READY** with **two Highs and two Lows**.
Round 13 called itself round 12's lesson at its purest — *a fix round's own fix becomes the next
round's finding* — and round 14 is the same lesson a second time: **both Highs are sentences round
13's fix round wrote or left standing**, and the sharper is again at this record's **§1 headline**,
which now carries nine correction blocks.

**That makes fourteen consecutive rounds with a name-position finding.** Both Highs are again this
project's declared worst defect class — a record or a doc claiming a guarantee the code does not give
— and their shape is round 13's shape finished. Round 13 corrected two **liveness** claims, *the
refusal is answered* and *the engine must answer the debt*; in correcting them it wrote descriptions
of the **rollback itself** that are wrong in two independent ways. Round 14 is about the rollback,
not about the arrival.

**All four findings were verified against the code before anything was written**, and all four are
real; **none is rejected by this record**. What the **reviewer** cleared, expressly: the conditional
clock claim (repeated equality refusals can continue until a strictly greater stamp, while no
settlement is guaranteed), the two actual safety negatives in `decide` and `admitting_sink` — a
`PrecedesACommit` decision neither publishes nor clears the record — the revised `commands.rs` inbox
assertion message, the owed-debt anti-coalescing rule *while the engine retains that debt*, round
13's behaviour and scope claims, and the supplied gate outcomes.

**The primitive said the true thing and only its consumers' descriptions were wrong**, exactly as at
round 13, and this round therefore changes **no core file** either.
`ObservationEngine::revert_settlement`'s own doc paragraph is correctly conditional — *"**A debt is
restored with the state.** If the settlement being taken back discharged an
[`ObservationEngine::observe_owed`] request, the path is owed again"* — and so is **§5 item 17** of
this record, at a **bold ruling line**: *"`revert_settlement` restores unconditionally and re-hints
only a watched path … **Since §12 the same is true of the debt it restores**"*. Item 17 was written
at round 5, extended at round 6, and has never been wrong; it is worth naming for the same reason
§19.4 named §8.7.

### 20.1 High 1 — the headline made a rollback produce an observation

**The claim, at this record's sharpest name position** (§1, line 7 at `5a41d7d`):

> a refused reading is **answered** — the engine takes its settlement back and observes the path
> again, rather than keeping a state it never really announced

**The code that refuses it** is the primitive the clause is about, at
`crates/espansoconfig-core/src/watch/engine.rs:899`, in `revert_settlement`'s own *What it does not
do, said beside what it does* list:

> it schedules a read, so it **emits nothing itself**. The observation comes back out of a later
> [`ObservationEngine::tick`], with whatever the file holds **then** — which may no longer be the
> state that was refused, and that is the honest answer rather than a replay of a stale reading.

So the rollback restores and schedules; it does not observe. And whether a later `tick` ever answers
is exactly what round 13 established that nothing here forces: `observe_owed`'s doc says a path
written continuously *"stays pending, and the debt waits with it"*, `ReObserveOutcome` says an
`Asked` is a promise about a worker's inbox and not about an observation, and `WorkerMessage::Stop`
can be consumed before the next tick (§5 items 19 and 21). **The headline therefore preserved round
13's liveness defect at the first mechanism it names**, which is the reviewer's sentence for it and
is right.

**The fix is the reviewer's minimal one**: the headline says the engine **restores the prior tracked
state and re-hints the path**, and *answered* names that rollback and never an observation that
arrives. Nothing the clause was built for is weakened — *a refusal is not a free action* was round
3's High (§9.1) and `revert_settlement` still closes it; what is withdrawn is a promise the
primitive expressly declines.

**The same shape stood twice in `src-tauri/src/main.rs`'s module header**, which the reviewer did not
name and §20.4's passes found: *"the engine is told to un-conclude it and **observe the path
again**"*. It is corrected there in the same words the headline now uses.

**§10.3's section heading is the name-position pass's own find** — *a rollback promises a fresh
observation, not a replay* — and it is **blocked rather than rewritten**, as §2.6's heading was,
because it names round 10's Low and four sections point at it. Its *promises* is a contrast with
**replay**, the axis round 10 was about; read as liveness it is this High at a heading.

### 20.2 High 2 — *re-owes the path* is conditional in the code and was unconditional in thirteen descriptions of it

**The claim**, in the safety account round 13's fix round wrote and in twelve places beside it: that
a `PrecedesACommit` refusal *re-owes* the path, or *leaves the state owed*.

**The code that refuses it**, at `crates/espansoconfig-core/src/watch/engine.rs:928`:

```rust
let owed = match self.undo.remove(path) {
    Some(Undone { replaced, owed }) => { /* restore the tracked state */ owed }
    None => false,
};
if owed { self.observe_owed(path, now); } else { self.hint(path, now); }
```

A debt comes back **only where the settlement being taken back had itself discharged an
`observe_owed` request**. An ordinary **native-hint** settlement has `owed == false` and takes the
plain `hint` arm — and a hint *can be coalesced away*, which is precisely what *stays owed* promises
cannot happen. So the descriptions claimed the anti-coalescing property for readings that do not
carry it, at the one place where the difference is the whole point.

**What is *not* wrong, and is deliberately not weakened.** The **two negatives the reviewer cleared
are retained word for word**: a `PrecedesACommit` refusal **publishes nothing** and **clears
nothing**. Neither depends on the debt, and neither is touched anywhere in this round. Nor is
*never a state reported wrongly* or *never a record cleared by a reading older than the commit* — the
rollback plus the retained record give both without any liveness or any debt. `decide`'s
`read_after <= at` comparison is not changed, nor is any signature, control flow or behaviour
anywhere in the round.

**The positions fixed** (line numbers as at `5a41d7d`, the tree round 14 read):

| Position | What it said |
|---|---|
| `ledger.rs:190` (module doc, *two proofs*) | *"the path is put back on the engine's pending table as an **owed** observation"* |
| `ledger.rs:489` (module doc, *the anchor outlives the record*) | *"the engine's settlement is taken back and the path is re-owed"* |
| `ledger.rs:512` (module doc, the round-13 safety sentence) | *"what a retry that never completes leaves behind is a state still owed"* |
| `ledger.rs:896` (`LedgerTally::preceded_a_commit`, first bullet) | *"answered by taking the engine's settlement back and re-owing the path"* |
| `ledger.rs:935` (`LedgerTally::preceded_a_commit`, closing paragraph) | *"and re-owing the path"*, and *"the state is left **owed** instead of concluded"* |
| `ledger.rs:1235` (a comment inside `record_app_write`) | *"taking the settlement back and re-owing the path"* |
| `watch_check.rs:1228` (the round-12 paragraph) | *"the engine takes the settlement back and re-owes the path"* |
| `2d-3-notes.md:21` (§1's headline; the reviewer named this record only for its five later positions, and the headline clause is the same sentence's) | *"re-owed when a refusal takes its settlement back"* |
| `2d-3-notes.md:2549` (§10.5's round-13 correction block) | *"un-concludes the state and **re-owes the path**"*, and *"the state is left owed instead of consumed"* |
| `2d-3-notes.md:4667` (§15.3's round-13 correction block) | *"what an uncompleted retry leaves is a state still **owed**"* |
| `2d-3-notes.md:4976` (§16.1's round-13 correction block) | *"`deliver` calls `revert_settlement`, and that re-**owes** the path"* |
| `2d-3-notes.md:5807` (§19.1's *what is not wrong* paragraph) | *"what an uncompleted retry leaves behind is a state still **owed**"* |
| `2d-3-notes.md:6092` (§19.7 item 39) | *"publishes nothing, clears nothing and leaves the state owed"* |

Each code position now names the branch: *restores the state that settlement replaced and re-hints
the path, re-owing it only where that settlement had discharged a debt*. Each record position carries
a correction block beneath it saying the same and naming what survives.

**Four further record positions were found by §20.4's passes and the reviewer did not name them**:
§12.6's *guaranteed* paragraph, which is the clause's **origin** — round 6 wrote *"and it is re-owed
when a refusal takes its settlement back"* there and §1's headline took the same words, exactly as it
did for round 13's High 2 — together with §12.6's **round-13 correction block**, which reproduced the
overclaim while clearing the liveness one by listing *"re-owing on a rollback"* among the three
clauses it called unaffected; §19.1's summary sentence *"**answered** names the rollback and the
re-owing"*; and §1's own **round-6 correction block**, corrected inside the §1 stack's round-14 block
rather than by a block of its own, because that stack is read as a stack.

**And the code twin the reviewer did not name is in `src-tauri/src/main.rs`'s module header** — where
round 13's *own* High 2 sentence was **still standing a round after it was corrected everywhere
else**: *"the fact that such a request is an **owed** observation the engine **must answer**"*, with
*"and re-owed when a refusal takes its settlement back"* in the same sentence. §19.4's sweep could
not see it because its file list was `ledger.rs`, `watch.rs`, `watch_check.rs` and `commands.rs`.
**The lesson is the sweep's own and is now recorded twice**: sweep the *directory*, never a list of
the files the last finding happened to touch.

### 20.3 The two Lows — three after-counts measured on the wrong tree, and a miscount of seven as six

**Low 1 — §19.4's after-counts for `docs/reviews/phase-2d-3-ledger.md`.** That file receives the
round's review as an **append**, in the same commit as the fix, and §19.4's *finished tree* figures
for it were taken before the append. Re-measured with `git archive 5a41d7d` into a scratch tree and
`rg -c` over §19.4's own three patterns, that file holds **10** liveness-shape hits, **3** debt-shape
hits and **6** `same sentence` hits, against the **0**, **0** and **5** recorded. §19.7 item 40's
worked example also said *"this record's debt-shape count went 2 → 2"*, contradicting §19.4's own —
and correct — **2 → 10** two subsections above it.

**Every one of these was re-measured rather than copied from the reviewer**, and so was every other
count in §19.4, on the same extracted tree: `ledger.rs` 16 → 11 and 2 → 2, `watch.rs` 8 → 8 and
3 → 3, `watch_check.rs` 0 → 0, `commands.rs` 11 → 9 and 2 → 1, `engine.rs` 12 → 12 and 7 → 7, this
record 21 → 52 and 2 → 10, round 12's ordering pattern (`ledger.rs` 7, `watch_check.rs` 1,
`commands.rs` 5, `watch.rs` 0, this record 38, `phase-2d-design.md` 0), its costless-removal pattern
(`ledger.rs` 1, this record 25, `phase-2d-design.md` 1) and `rg -c 'preceded_a_commit'`
(`ledger.rs` 15, `watch_check.rs` 2, `commands.rs` 1) — **all of which stand**. Only the three review-file
figures and item 40's example move.

**Low 2 — §19.5 said six correction blocks and named seven.** `rg -n 'Correction \(round-13 fix
round'` over this record returns seven: §1, §10.5, §12.6, §15.3, §16.1, §18.1 and §18.5's indented
one. The number is corrected and the sentence's own arithmetic is made visible rather than inferred.

**All four figures are corrected *in place*, and each carries a correction block beside it.** That is
a deliberate departure from *nothing is rewritten*: a count is read as a **measurement**, a later
round re-runs the sweep against it, and a block underneath would leave the false figure standing
where the comparison is made. The blocks say what the figure was, what it is, and how it was
re-measured. The same miscount reached `PROGRESS.md`, which is the orchestrator's file and is
**reported rather than edited** (§18.4's Low 2 and §18.6's convention).

### 20.4 The two sweeps

Both were run as **separate passes**, written from the *shape* and not from the words of the four
findings. Counts are `rg -c` line counts given as **before → after**, *before* measured on the clean
tree at `5a41d7d` **prior to any edit of this round** (extracted with `git archive` into a scratch
tree), *after* on the finished tree **including this round's own append to
`docs/reviews/phase-2d-3-ledger.md`** — which is Low 1's whole lesson and is why the file set below
is a **directory** rather than a list of four files.

**Pass 1 — for the shape.** Two shapes, and both are about the **rollback** rather than about an
arrival: *a rollback described as producing an observation*, and *a refusal or a rollback described
as leaving a path owed, re-owed or owed again unconditionally*.

```sh
rg -c --pcre2 'observes? the path again|observe the path again|observed again|re-observes|is re-observed|fresh observation' \
  src-tauri/src crates/espansoconfig-core/src \
  docs/decisions/2d-{1,2,3}-notes.md docs/reviews/phase-2d-design.md docs/reviews/phase-2d-3-ledger.md
rg -c --pcre2 '\bre-?owe[sd]?\b|\bre-?owing\b|owed again|leaves the state owed|state still owed|left \*\*owed\*\*|the state is left owed' \
  src-tauri/src crates/espansoconfig-core/src \
  docs/decisions/2d-{1,2,3}-notes.md docs/reviews/phase-2d-design.md docs/reviews/phase-2d-3-ledger.md
```

- the **rollback-produces-an-observation** shape, **at `5a41d7d` → on the finished tree**:
  `ledger.rs` **4 → 4**, `watch.rs` **5 → 5**, `watch_check.rs` **0 → 0**,
  `commands.rs` **0 → 0**, `main.rs` **1 → 0**, `engine.rs` **3 → 3**, this record
  **23 → 28**, `2d-1-notes.md` **0 → 0**, `2d-2-notes.md` **0 → 0**,
  `phase-2d-design.md` **0 → 0**, `phase-2d-3-ledger.md` **4 → 7**. **Every hit at
  `5a41d7d` was read.** The only code change is `main.rs`'s module header. Of what survives:
  `watch.rs`'s module heading *A save may ask for one path to be observed again* and its two prose
  hits describe an **ask**, which is this shape done right; `engine.rs`'s three are the core
  primitive's own doc and one test, and the reviewer cites that doc as the **authority** that refuses
  the Highs, so it is judged sound as structured and kept; `ledger.rs`'s four are two test assertion
  messages and two test comments **driven by the test that contains them** — each ticks the engine
  itself, so the re-observation is true by construction there, which is round 12's precedent for
  `later_than_now()` and round 13's for these same four lines. This record rises because §20 quotes
  the corrected words back, which is the inflation §18.5 and §19.4 both recorded, and the review file
  rises because round 14's section quotes them too;
- the **unconditional re-owing** shape, **at `5a41d7d` → on the finished tree**: `ledger.rs`
  **6 → 5**, `watch.rs` **0 → 0**, `watch_check.rs` **1 → 0**, `commands.rs`
  **0 → 0**, `main.rs` **1 → 1**, `engine.rs` **2 → 2**, this record **10 → 56**,
  `2d-1-notes.md` **0 → 0**, `2d-2-notes.md` **0 → 0**, `phase-2d-design.md` **0 → 0**,
  `phase-2d-3-ledger.md` **3 → 9**. **Every hit at `5a41d7d` was read**, and **every surviving hit in
  `ledger.rs` and `main.rs` was read again after the fix**: all six now say *re-owed only where that
  settlement had discharged a debt*, or *never re-owed* of the native-hint arm, so the count barely
  falls while every false claim is gone — **a near-flat count can mean a full correction here**,
  which is the same warning §19.4 recorded in the other direction and the reason no total in this
  section is a gate. `watch_check.rs` is the one that reaches **0**, because its sentence now names
  the **hint** arm and has no occasion to say *re-owe* at all. `engine.rs`'s two are the primitive's
  own conditional sentences — *"If the settlement being
  taken back discharged an `observe_owed` request, the path is owed again"* and *"an owed observation
  that is then refused is re-owed by `revert_settlement`"* — both correct and both untouched. The
  three hits in the review file at `5a41d7d` are reviewer text (two verbatim, one in round 13's
  preamble) and are
  **not edited**, because that file is an append-only ledger; the preamble's *"leaves the state
  owed"* is corrected here instead, and round 14's own section says so. The six it gains are round
  14's own section quoting the corrected words back.

**Pass 2 — name positions, as a distinct pass.** Headings, bold ruling lines, first sentences, doc
comments, module headers, test names and assertion messages, read for both shapes.

```sh
rg -n '^\s*fn [a-z_]+\(' src-tauri/src/*.rs crates/espansoconfig-core/src/watch/*.rs -o \
  | rg -i 'owed|owe|observ|answer|debt|revert|refus'
rg -n '^//! # ' src-tauri/src/{ledger,watch,commands,main}.rs crates/espansoconfig-core/src/watch/engine.rs
rg -n --pcre2 '^#{2,4} .*(answer|observ|owed|debt|guarantee|must|refus)' -i \
  docs/decisions/2d-{1,2,3}-notes.md docs/reviews/phase-2d-design.md docs/reviews/phase-2d-3-ledger.md
rg -n --pcre2 '^\*\*[^*]*(owed|re-owe|observ|answer|debt)[^*]*\*\*' -i docs/decisions/2d-{1,2,3}-notes.md
```

- **it found three, and all three are fixed or blocked**: §1's headline (the High the reviewer
  named), **`src-tauri/src/main.rs`'s module header** — two sentences, one of them round 13's own
  High 2 still standing — and **§10.3's section heading**, *a rollback promises a fresh observation,
  not a replay*, which is blocked rather than rewritten;
- **`ledger.rs`'s module-doc heading *A read the save path could not use — or could not prove
  stable — is re-observed* was re-checked and kept**, this time against the debt shape as well as the
  liveness one. Round 13's reason stands — its contrast is with **published** — and the section's
  closing sentence, which round 13 rewrote, already carries the three reasons an ask may go
  unanswered and the line saying the heading's *re-observed* is a contrast and never a promise;
- **`watch.rs`'s module heading *A save may ask for one path to be observed again* is this shape done
  right** and is left alone: *ask* is the verb, and the section beneath it says the request becomes an
  owed observation, which for `re_observe` is exactly true. So are the three
  `…_asks_for_a_re_observation…` test names in `commands.rs`,
  `watch.rs`'s `a_re_observation_issued_while_the_baseline_fails_is_answered_once_it_starts` (whose
  *once it starts* is the condition), `ledger.rs`'s
  `a_refused_stabilized_state_is_re_observed_rather_than_lost` and `engine.rs`'s
  `a_reverted_settlement_is_observed_again_instead_of_coalescing_away`, both of which drive their own
  ticks;
- **§5 item 17 is the bold ruling line that got it right all along** and is worth naming beside
  §8.7's *not guaranteed* list: *"`revert_settlement` restores unconditionally and re-hints only a
  watched path … Since §12 the same is true of the debt it restores"*. Written at round 5, extended
  at round 6, never wrong, and never consulted by any of the thirteen positions that contradicted it;
- the **eight** `### … What is guaranteed now, and what is not` sections were read again, this time
  for the **debt** shape rather than round 13's liveness one. §12.6 carried the origin clause and is
  corrected. §§7.4, 8.7, 10.5, 11.5, 13.6 and 14.8 carry no unconditional re-owing: §14.8's
  *"unconditionally"* is about the record not naming the same bytes, which the next clause says in as
  many words, and §11.5's and §13.6's *owed* sentences are about what an `observe_owed` request is
  and are conditional on a settlement. They are judged sound as structured and left;
- **`docs/decisions/2d-1-notes.md:140` and `src-tauri/src/watch.rs:1199` were judged and kept**: *a
  hint plus a **debt** the next settlement of that path must answer* and *the one form a settlement
  must answer* are obligations **on a settlement that occurs**, claim nothing about whether one does,
  and were cleared on that reading by round 13's own pass;
- **§1's `Undone` bullet was judged and kept** — *"carries the debt beside the replaced state so a
  refusal re-owes it"* — because its antecedent is *the debt*: `Undone` carries one only where a
  settlement discharged one, so *it* is what a refusal re-owes. It is the closest call in this pass
  and is recorded rather than left silent.

**Round 12's and round 13's carried counts.** `rg -c 'same sentence'`: `ledger.rs` **7 → 7**,
this record **26 → 32**, `commands.rs` **1 → 1**, `docs/reviews/phase-2d-3-ledger.md`
**6 → 8**. `rg -c 'preceded_a_commit'`: `ledger.rs` **15 → 15**, `watch_check.rs`
**2 → 2**, `commands.rs` **1 → 1**. **No identifier was added to production code and none
was removed.**

**For the consuming-operation shape** (`CLAUDE.md`'s standing rule, and 2c-5-4a's scar): this round
adds no operation, consumes nothing and discards no result. It edits comments and doc comments and
adds correction blocks, and — unlike round 13 — it changes **no assertion message** and no other
runtime-bearing line.

### 20.5 What changed, file by file

**Per §18.6's declaration: this list names every file in the round's commit, and says which is a
verbatim append and which is not this round's authorship.**

- **`src-tauri/src/ledger.rs`** — six doc-comment and comment positions given the **branch** in the
  same sentence as the claim (§20.2's table): the module doc's *two proofs* bullet, the *the anchor
  outlives the record* sentence, the round-13 safety sentence that closes that section, both halves
  of `LedgerTally::preceded_a_commit`'s doc, and one comment inside `record_app_write`. **Comments
  and doc comments only. No behaviour, no signature, no control flow; `decide`'s `read_after <= at`
  comparison untouched; no test, no assertion and no assertion message added, removed or changed in
  this file.**
- **`src-tauri/src/main.rs`** — the **module header**, two sentences, both twins the reviewer did not
  name and §19.4's sweep could not see: *"the engine is told to un-conclude it and observe the path
  again"* (§20.1) and *"such a request is an **owed** observation the engine **must answer** …
  re-owed when a refusal takes its settlement back"*, the latter being **round 13's own High 2 still
  standing a round after it was corrected in `commands.rs` and in the headline** (§20.2). **Module
  doc comment only. No behaviour, no signature, no control flow, no test.**
- **`src-tauri/src/watch_check.rs`** — inside
  `a_committed_save_is_suppressed_while_a_later_external_write_is_not`, the round-12 paragraph's
  *re-owes the path* now names the **hint** arm and why it is the one that runs there (§20.2).
  **Comments only.** The removed exact-zero assertion is **not** restored.
- **`docs/decisions/2d-3-notes.md`** — **twelve** correction blocks over **sixteen** corrected
  positions, and the number is derived by counting the list rather than asserted over it, because
  saying *six* over a list of seven is round 14's second Low and this is the sentence that would
  repeat it. The twelve blocks, in file order, with the positions each covers:
  **(1)** §1's headline — two clauses, one per High — which is also **rewritten in place**, as every
  previous §1 correction has done, and whose block additionally corrects **§1's round-6 correction
  block** in the same stack (two positions); **(2)** §10.3's **section heading**, blocked and not
  rewritten; **(3)** §10.5's round-13 block, two sentences in it; **(4)** §12.6's *guaranteed*
  paragraph **and** its round-13 block, named together in one block (two positions); **(5)** §15.3's
  round-13 block; **(6)** §16.1's round-13 block; **(7)** §19.1's *what is not wrong* paragraph;
  **(8)** §19.1's summary sentence; **(9)** §19.4's **three** after-counts (three positions);
  **(10)** §19.5's *six*; **(11)** §19.7 item 39; **(12)** §19.7 item 40's worked example. That is
  2+1+1+2+1+1+1+1+3+1+1+1 = **sixteen** positions over twelve blocks — **and this §20** beside them.
  Every block is
  **added beneath** the text it corrects; nothing is deleted. **Four numbers are corrected in place**
  (§19.4's three after-counts and §19.5's block count), each with a block beside it, for the reason
  §20.3 gives.
- **`docs/reviews/phase-2d-3-ledger.md`** — round 14's section appended: a prose preamble and the
  reviewer's reply **verbatim**, checked byte-for-byte against the result file. The verbatim half is
  not an authored change. **Round 13's preamble is not edited**, and the one sentence in it that
  carries the corrected claim is named in §20.4 and in round 14's own preamble.
- **`PROGRESS.md`** — the orchestrator's, not this round's: the round-14→round-15 handoff and the
  commit row. Named here because §18.4's Low 2 was an incomplete list and §18.6 declared the
  convention that fixes it. §19.5's *six* also reached that file and is reported rather than edited.
- **no core file** — `crates/espansoconfig-core` is untouched, which matters this round for the same
  reason it mattered at round 13: both Highs quote `revert_settlement`'s own doc **as the authority
  that refuses them**. **No `src/` path, and no command, wire type, event, queue, i18n key or
  user-visible string.**

### 20.6 The gates

No neuter was run and none was owed: this round changes no production behaviour, deletes no check and
adds none. **It changes no runtime-bearing line at all** — round 13 changed one assertion message and
this round changes none — so the workspace total must be exactly round 13's, and a movement in it
would itself be the finding.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1268 passed, 0 failed** (exit 0, summed over **26** `test result` lines — unchanged from round 13, and it must be: this round adds and removes no test and changes no assertion) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** (exit 0, **223** filtered out, **76.96 s**, quiet host, no timeout; this round changed only comments in that file) |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean** (exit 0) |
| `cargo fmt --check` | **clean** (exit 0) |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** (no match; this round touched no core file) |
| `npm run check` files / `npm test` / `npm run build` modules | **431 / 2125 / 184 — not re-run; the frontend was not touched**, on the warrant of §20.5's file list and of `git diff --name-only 08a3366 -- src/` being empty on the tree this round started from |

**§18.6b's warning about the focused gate's duration stands and is repeated because it is easy to
mistake for a regression**: that suite is built of bounded waits, so a slower or busier host
lengthens the run without changing the verdict. What the gate asserts is **20/20 and no timeout**,
never a wall-clock, and this round edited only comments in that file — no timing constant, no wait,
no test.

### 20.7 What this round's own change leaves open

Written with the expectation §15 states and this round does not weaken: **seven** §5 items recorded as
bounded residues have since been found to be real defects. Round 14's own two Highs are a further
instance of round 12's warning — both are sentences a *fix round* wrote while closing something else —
and one of them, `main.rs`'s module header, is round 13's finding **surviving its own fix round**
because the sweep that found the others was scoped to a file list. What this round leaves:

41. **A sweep scoped to a file list cannot find the twin in the file the list omits, and nothing
    makes a sweep's scope match the pipeline's.** §19.4's shape pass named `ledger.rs`, `watch.rs`,
    `watch_check.rs` and `commands.rs` because those are the files the previous findings had touched;
    `src-tauri/src/main.rs`'s module header describes the same six mechanisms in the same words and
    was outside it, so round 13's own High 2 sentence survived the round that closed it everywhere
    else. §20.4 sweeps the **directory**, which closes this instance and not the class: the class is
    that **no list is derivable** — nothing enumerates which files describe this pipeline, a document
    under `docs/` can join them at any time, and a directory sweep over a repository this size trades
    the omission for noise a reader must filter by hand. What would close it is a marker every such
    passage carries and a check that the marker's set is the swept set. That is a real edit and this
    round did not make it, for §19.7 item 38's reason: inventing machinery while fixing eight
    positions is how a fix round produces the next round's finding.
42. **The conditional half of the rollback is argued and not driven.** *A debt is restored only where
    the settlement being taken back had discharged one* is now claimed in thirteen places, and what a
    test drives is the **positive** arm: `engine.rs`'s
    `an_owed_observation_is_answered_where_a_hint_coalesces_to_silence` has a step that reverts a
    settlement which discharged a debt and asserts the debt comes back. **No test asserts the negative
    arm** — that reverting a settlement which owed nothing leaves a plain hint that a subsequent
    identical stabilization coalesces away — because asserting *nothing was emitted for a reason* over
    an engine that also emits nothing when the disk is quiet needs a discriminating oracle this crate
    does not have. So the branch that carries round 14's whole correction rests on reading
    `revert_settlement`'s six lines, exactly as §19.7 item 39 says the safety half rests on reading
    `decide`'s arm.
43. **Four numbers in §19 are now corrected in place, and nothing distinguishes a corrected count
    from an original one except the block beside it.** §20.3 argues the departure and §20.5 records
    it, but the record now contains figures whose provenance is *this round re-measured them* and
    figures whose provenance is *the round that wrote them measured them*, in the same tables, told
    apart only by prose. A later round re-running §19.4's patterns against §19.4's tree gets the
    corrected numbers and no signal that they were corrected unless it reads the blocks. **Nothing
    enforces reading the blocks**, which is §19.7 item 40's gap applied to arithmetic rather than to
    meaning — and Low 1 is itself the proof that a count written once is trusted afterwards.
44. **Every correction this round made is prose, and no test fails if a later round un-makes one.**
    §18.7 item 36 and §19.7 item 40 said this of §18's nine and §19's eight positions; it is now true
    of a further nineteen. What round 14 adds is narrower and worse than the general gap: two of the
    thirteen positions §20.2 corrected are **correction blocks written by round 13 to fix a different
    claim in the same sentence**, so the record now has a stack in which block *n* corrects block
    *n−1* and block *n+1* corrects block *n*. Nothing checks that a stack converges, and a reader who
    stops at the first block gets a sentence two rounds out of date.
