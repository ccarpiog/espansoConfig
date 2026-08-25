# Phase 2d-3 — save composition and the suppression ledger

**A save this application commits no longer comes back through its own watcher as a foreign
external change, and no external change is lost to that suppression, because three facts hold
together: the commit and the record that describes it are one window no admission can *decide*
inside; every observation carries a stamp taken before its reads, so a reading already in hand
when that window opened cannot clear the record either; and a refused reading is **answered** —
the engine takes its settlement back and observes the path again, rather than keeping a state it
never really announced. That record is one entry per document, written in exactly one
place.** `src-tauri/src/ledger.rs` is the new module: `WriteLedger` holds the
consult's `last_app_write[DocumentId] = { workspace_epoch, revision }` beside the open Tauri
session, together with the per-epoch observation sequence allocator and the published-state map
that coalescing compares against; `admitting_sink` is the **admission gate**, an
`ObservationSink` the session installs between every watcher and the downstream sink, deciding
under two leaf mutexes it drops before calling anything. `commands.rs` composes with it in three
places and only three: `commit_and_record` — the window `run_one_save` runs its transaction
in — records a committed revision (and nothing else, ever),
`after_a_save` admits a refresh that disagrees with what the transaction last saw, and
`conflict_after_the_lock` records **no** app write and admits its refresh the same way a native
hint is admitted.

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
`Observation::path()` to `crates/espansoconfig-core/src/watch/engine.rs`, and §9.1 is why that
could not be done a layer out. The architecture rule is unchanged and re-checked — `cargo tree -p
espansoconfig-core | rg tauri` still finds nothing, and the engine learns nothing about saves,
ledgers or application sessions. The new Rust types (`ObservedState`,
`Admission`, `AppWrite`, `LedgerTally`, `AdmittedObservation`, `SaveRecords`) serialize nothing
and cross no boundary, so the dictionary contract's serializable-enum sweep has nothing new to
account for. Admitted observations still end at a **discarding** downstream sink in production:
they are produced, decided and dropped, and a value that sink drops is gone.

---

## 1. What this step built

- **`src-tauri/src/ledger.rs`** (new) — `ObservedState` (the three stabilized states one
  observation asserts) with `observed_state` and `observed_path`; `Admission` (five decisions,
  six since §8); `AppWrite` (the consult's record); `LedgerTally` (four counted decisions, five
  since §8 —
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
  added, so sixteen module tests.
- **`crates/espansoconfig-core/src/watch/engine.rs`** — **the only core file any round of this step
  touched**, and only in the round-3 fix round (§9.1): `ObservationEngine::revert_settlement`, the
  private one-pass `undo` map and the private `Settled` value that fills it, `Observation::path()`,
  and `Clone` on the private `Tracked`/`LastContent` for the single settlement that needs it. One
  test added.
- **`src-tauri/src/commands.rs`** — `WorkspaceSession` gained the session-lifetime
  `ledger: Arc<WriteLedger>` and `observing` now **wraps** the injected sink in the gate;
  `unwatched()` does too; `open` calls `begin_epoch` under the session lock, before the
  successor watcher starts; `with_open` lends a `SaveRecords` (the backup session and the
  ledger, together — §2.7) instead of a bare `&BackupSession`; the six planners pass it
  through; `run_one_save` delegates its transaction to `commit_and_record` (§7.1), which takes the
  one record through the new exhaustive `committed_revision` inside the ledger's commit window;
  `after_a_save` and `conflict_after_the_lock` take the ledger and the document's path and
  admit what their refreshes saw. Seven new tests (§3).
- **`src-tauri/src/watch.rs`** — `discarding_sink` removed (it is the *downstream* sink and now
  lives with the gate); `EpochObservation` gained `read_after` and the worker gained
  `WatchWorker::observe`, the two-line function that takes it (§8.1); the round-3 fix round added
  `ObservationOutcome` and `deliver` — the sink now **answers**, and `deliver` is the one place that
  answer is read, calling `revert_settlement` for the one arm that means *this decided nothing*
  (§9.1); `EpochObservation` lost its scoped dead-code allowance, because the gate
  reads its fields in production — 2d-2 §5 item 9's intended end state for that allowance;
  `ObservationSink`'s contract now names the gate as the session's one instance of it.
- **`src-tauri/src/watch_check.rs`** — retyped onto `AdmittedSink`/`AdmittedObservation` (the
  seam moved one layer out, §2.3), `observed_path` delegates to the ledger's rather than
  keeping a second copy, and two new real-filesystem checks over synthetic temp trees (§3).
- **`src-tauri/src/main.rs`** — the module declaration and the phase paragraph.

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
  `admit_at_current_epoch`, `record_app_write` and `begin_epoch` run **no caller-supplied
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
  `admit_at_current_epoch`, so the disk state the conflict payload was built from is published
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

**Where this is weaker than the watcher's own admissions, said in the same place as what it
does**: a save-path refresh is a *single* read, where an engine observation is two equal
consecutive ones, so the consult's *a different **stabilized** revision* is met by the watcher's
callers and not by these two. A torn read would publish a state that never stably existed. That is
accepted because the same single read already builds the conflict payload the person is shown, so
it is a property of `Workspace::refresh` rather than one this step introduces.

### 2.7 D7 — the backup session and the ledger travel together, because neither is a planner's to choose

`with_open` now lends a `SaveRecords { backups, ledger }` rather than a bare `&BackupSession`.
The immediate cause was arithmetic — `create_one_match` reached eight parameters and clippy's
`too_many_arguments` refused it — but the grouping is the right shape independently: both are
**session-owned records a save writes to**, neither is a planner's to choose, all six planners
pass both straight through unchanged, and a planner that could reach one without the other could
write with no safety net or commit bytes this session can never afterwards tell from an external
write. `WorkspaceSession::with_open` is its only producer.

### 2.8 D8 — coalescing is state equality, which reproduces the engine's own two exceptions rather than fighting them

The published-state map holds one `ObservedState` per path, and an observation coalesces exactly
when the state it would publish equals the one already published. Three states rather than an
`Option<ContentRevision>` is what makes that work:

- a repeat of the same document at the same revision is a `Duplicate` — consult Q3's *repeated
  hints that stabilize to the same document/revision coalesce*;
- a `Removed` publishes `Absent`, so **`Removed` then `Added` at the same path is two
  observations even at identical bytes** — Q3's ruling verbatim, and here it falls out of state
  equality rather than being a special case;
- a `Changed` recovering from an emitted `Unreadable` at unchanged bytes is likewise admitted,
  because the published state was `Unreadable`, which is the engine's own D5 exception
  (`2d-1-notes.md` §2.5) reproduced without a second copy of the rule.

Sequences are allocated per epoch from `FIRST_OBSERVATION_SEQUENCE` (one, so a zero downstream can
only mean *unset*) and the allocation is **checked, never saturating** — the same defect
`WorkspaceEpochs` was repaired for at 2d-2. An exhausted space refuses every further admission
within its epoch, because an observation that cannot be given a distinct sequence must not be
published, and the next workspace open resets it with everything else.

`LedgerTally` counts five of the six decisions, cumulatively and without reset, because four of
them — suppressed, coalesced, discarded for a stale epoch, and (since §8) discarded as older than
a commit — are otherwise **indistinguishable from silence**, which
is the mistake a negative-only integration test would make. `Admission::SequenceSpaceExhausted` is
deliberately uncounted: it is unreachable in any physical execution and is directly observable
through `admit`'s own answer, which the boundary test drives.

> **Correction (round-2 fix round, §8).** This paragraph said *four of the five* and *three of
> them*, which was true of the five decisions that existed when it was written. §8 adds a sixth,
> `Admission::PrecedesACommit`, and gives it `LedgerTally::preceded_a_commit` by asking the two
> questions this paragraph states rather than by assuming the struct was exhaustive. The counter
> is not decoration: it is what makes `watch_check`'s positive wait on `suppressed` bite against a
> production stamp taken too early (§8.3).

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
| a conflict records none, and its refresh is external | `a_conflict_records_no_app_write_and_admits_its_refresh_as_external` — no entry, the disk state published under this epoch's allocator, and a second hint at that same state answering `Duplicate` |
| …and the one case where a conflict's refresh is *self* | `a_conflict_against_this_apps_own_committed_bytes_is_suppressed` — reachable only through the raw save (§2.6); the record survives and nothing is published |
| an uncertain write records none | `only_a_committed_outcome_licenses_an_app_write_record` — over a commit, a skipped commit, a `RevisionMismatch` and a `WriteError::VerificationFailed`, the last asserting **its own premise** (`may_have_written()` is true) so it cannot pass holding an error of the wrong kind |
| post-commit external replacement is not suppressed | `a_post_commit_external_replacement_is_admitted_and_never_recorded_as_ours` — the tail driven directly, since no command can produce the interleaving: the answer stays `committed` and still names what this application wrote, the external revision is never recorded as ours, and the differing state is admitted (`suppressed: 0`) — **and, since §7.2, `ledger.rs`'s `a_committed_record_invalidates_the_published_state_and_supersedes_itself`, which is the case the row above did not cover** |
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
> claimed a proof it did not have. `a_post_commit_external_replacement_is_admitted_and_never_recorded_as_ours`
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
  `a_conflict_against_this_apps_own_committed_bytes_is_suppressed` both failed while the other 70
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
- **no widening of the watch scope** and no change to the core crate at all.

---

## 5. Holes, stated rather than hoped about

1. **Admitted observations are still discarded in production.** The gate decides, numbers, and
   hands the value to `discarding_sink`; a value it drops is gone, and no present code recovers
   it. Whatever recovery 2d-4's bootstrap or drain offers is 2d-4's to build and to claim.
2. **A publication has no consumer, so a spent sequence is invisible.** `conflict_after_the_lock`
   and `after_a_save` discard the `Admission` they get, deliberately: what publishing *does*
   today is spend one sequence and publish one state, so the next hint at it coalesces. When
   2d-4's queue exists, those two call sites are where a save-origin observation must be enqueued,
   and consult Q5's ruling — a save-origin conflict wins over a native duplicate at the same
   document and revision — is the rule that lands there.
3. **The two save-path refreshes are single reads, not stabilized observations** (§2.6). A torn
   read would publish a state that never stably existed and could coalesce a later real
   observation of the same bytes away. It is the same read that builds the conflict payload, so
   the exposure is not new — but it is not the engine's two-read discipline either.
4. **An admitted observation still names a path, not a `DocumentId`.** The gate is deliberately
   leaf-only (§2.1), so it does not resolve one; a consumer that needs the identity will have to
   take the session lock or reach the core's identity table, and that decision is 2d-4's.
5. **The per-entry workspace epoch is redundant while `begin_epoch` discards** (§2.2). It is
   stored and checked as the second statement of one rule, and no test can currently make the
   check fail, because no path leaves an entry from another epoch behind.
6. **The path agreement is inherited, not closed** (§2.2). The ledger keys on the workspace's own
   spelling and the gate looks up the watcher's; `HintSpelling` reconciles root-prefix aliases only
   (2d-2 §5 item 6), and a case-only difference or a post-start symlinked ancestor still misses —
   in the engine first, so such a hint never reaches the ledger at all.
7. **Rotation is covered by construction, not by execution** (§2.9). Forcing a real rotation needs
   eleven batches, hence eleven sessions with sortable-by-second batch names; what the test drives
   instead is the scope claim rotation depends on, with a `.yml` file under the backup root as the
   sharpest case.
8. **The `watch_check` pair says nothing about native delivery.** Both ride the polling fallback so
   that no FSEvents delivery decides a verdict; the eight-cell matrix is where native delivery is
   claimed, and 2d-2's measured scar still binds — these suites are evidence on a quiet host.
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
    (§7.1). `admit_at_current_epoch` takes it, `after_a_save` and `conflict_after_the_lock` call
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
    are bounded by real user action rather than by anything this code guarantees.
14. **Nothing in the type system ties a stamp to the reads it claims to bound** (§8.2). Every
    `Instant` type-checks in that parameter, and a producer that took its stamp *after* its reads
    would compile, forward, compare, and silently restore round 2's High. What holds it is
    `WatchWorker::observe`, one two-line function with one caller, and the two save-path callers
    stamping on the line above their `Workspace::refresh`. A stamp taken too **early** is caught
    by `watch_check`'s `preceded_a_commit == 0` (§8.3); a stamp taken too **late** is invisible to
    every test in this crate, and that asymmetry is the honest statement of what the evidence
    covers. **Round 3 adds a second half to this item**: nothing in the type system ties the
    *answer* a sink returns to what the producer then does with it either. `ObservationSink` now
    returns `ObservationOutcome`, and a caller that drops it compiles and silently restores round
    3's first High. `crate::watch::deliver` is the one call site, and it is one function with one
    caller for exactly this reason.
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
16. **A save-path refresh can now be refused by a clock collision, and it has no settlement to take
    back** (§9.2). `after_a_save` stamps microseconds after its own save recorded, on one thread,
    and `decide` accepts only a strictly later stamp — so two adjacent `Instant::now()` calls that
    a coarse clock answers equally refuse it. It is the over-refusing direction and nothing is
    written or cleared, but unlike a watcher observation there is no engine settlement to revert:
    what is lost is one *publication*, so the external replacement that refresh saw is reported by
    the watcher's own hints instead of pre-published here. The record this round corrected said the
    save path *could never* be refused; that is why this item exists.
17. **`revert_settlement` restores unconditionally and re-hints only a watched path.** Every path
    the engine can settle entered through a `watches` check, so the two halves cannot come apart
    today. If they ever did, the rollback would still happen and the re-read would wait for the next
    hint or rescan rather than being scheduled — degraded, not lost, and stated rather than assumed.

---

## 6. The gates

| Gate | Before 2d-3 (2d-2's closure) | After 2d-3 | After round 1's fix (§7) | After round 2's fix (§8) | After round 3's fix (§9) |
|---|---|---|---|---|---|
| `cargo test --workspace` | 1223 passed, 0 failed | 1242 passed, 0 failed | 1245 passed, 0 failed | 1246 passed, 0 failed | **1249 passed, 0 failed** (exit 0; the sum of the run's own `test result` lines) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | 18/18 twice | 20/20 twice (66.8 s, 59.2 s) | 20/20 twice (65.4 s, 60.3 s) | 20/20 twice (67.6 s, 63.6 s) | **20 passed, 0 failed** (69.6 s, quiet host) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | clean | clean | clean | **clean** (exit 0) |
| `cargo fmt --check` | clean | clean | clean | clean | **clean** (exit 0, after one `cargo fmt`) |
| `cargo tree -p espansoconfig-core \| rg tauri` | empty | empty | empty | empty | **empty** (no match — and this is the round that touched a core file, so it is the run that matters) |
| `npm run check` files | 431 | 431 | 431 | 431 | **431 — not re-run; the frontend was not touched** |
| `npm test` | 2125 | 2125 | 2125 | 2125 | **2125 — not re-run; the frontend was not touched** |
| `npm run build` modules | 184 | 184 | 184 | 184 | **184 — not re-run; the frontend was not touched** |
| bundle oracle | server-only absent, client-only present (2) | same | not re-run | not re-run | **not re-run, same reason** |

**Round 3's fix moved the workspace count by 3, and every one is accounted for**: two in
`src-tauri/src/ledger.rs` (14 → 16) — `a_reading_stamped_exactly_at_the_record_is_refused` and
`a_refused_stabilized_state_is_re_observed_rather_than_lost` — and one in
`crates/espansoconfig-core/src/watch/engine.rs`,
`a_reverted_settlement_is_observed_again_instead_of_coalescing_away`, which is the first test any
round of this step added to the core. `watch_check` stays at 20.

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
history, produced by a build with the fix removed rather than by contention (§8.6).

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
`a_committed_record_invalidates_the_published_state_and_supersedes_itself`, and it asserts the
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
  `a_committed_record_invalidates_the_published_state_and_supersedes_itself` failed on the
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
  `a_committed_record_invalidates_the_published_state_and_supersedes_itself` still drives it.
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
  **the same observation again**, which is the honest answer.

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
  `commands.rs`'s `a_post_commit_external_replacement_is_admitted_and_never_recorded_as_ours`: it
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
| …and that the recovery is the *same* observation rather than a new shape | the same test's step 4, plus the core's `a_reverted_settlement_is_observed_again_instead_of_coalescing_away`, which asserts the re-observed `Changed` carries the same `previous_revision` |
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
