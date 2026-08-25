# Phase 2d-2 — native lifecycle and the real-filesystem adapter

**One core watcher handle now lives behind the open `WorkspaceSession`, with checked workspace
epochs, cancellation-and-join on successful replacement, drop on shutdown, and the native-error
polling fallback — and the step's principal integration evidence is in `src-tauri`, on a real
filesystem, exactly where the consult put it.** `src-tauri/src/watch.rs` is the lifecycle:
`WatcherLifecycle` owns one worker thread that drives 2d-1's `ObservationEngine` with the real
clock and the real filesystem, holds the `NativeWatch` for exactly as long as it runs, and hands
every stabilized observation — epoch-tagged — to an injected sink. `commands.rs` grew the three
session-side pieces: the watcher travels inside `Open`, the epoch is minted from the session's
`WorkspaceEpochs` allocator in `WorkspaceSession::open`, and `watch_status` makes the lifecycle
observable. `src-tauri/src/watch_check.rs` is the integration evidence: real creates, atomic
renames, edits and removals under **each** watched root — one isolated test per operation-root
cell, so an early timeout cannot hide the rest of the matrix — through the real session, read
through the same sink seam 2d-4's queue will use.

The consult is `docs/reviews/phase-2d-design.md`; **Q7 item 2** is this step's specification,
**Q1** rules the lifecycle's owner, the replacement order and the fallback's place (its ruling
carries a round-4 correction block, read with it), and **Q3** rules what must not exist yet: no
event, no queue, no `drain_external_changes`. 2d-1's record (`docs/decisions/2d-1-notes.md`)
states in §5 items 2 and 3 the two obligations this step discharges — the real-delivery
integration test, and reconciling the native backend's path spelling with discovery's — and in
§2.10 why the core deliberately has no delivery test of its own.

**No wire, no window, no ledger, no save path was touched.** No command was added or changed in
signature, no Tauri event exists, no Svelte or i18n file moved, and the frontend gates have
nothing to re-measure. The core crate gained exactly one narrow change, in the round-1 fix round
(§6): `watch/native.rs` now maps a backend's dropped-events report to `Degraded` instead of
forwarding it as filterable hints — still Tauri-free, `cargo tree -p espansoconfig-core | rg
tauri` still finds nothing. The new Rust types (`LifecycleConfigError`, `EpochSpaceExhausted`,
the private `WorkerMessage`) serialize nothing and cross no boundary, so the dictionary
contract's serializable-enum sweep has nothing new to account for.

---

## 1. What this step built

- **`src-tauri/src/watch.rs`** — the lifecycle module: `EpochObservation` and `ObservationSink`
  (the seam), `discarding_sink` (the production sink until 2d-4), `WorkspaceEpochs` and its
  typed `EpochSpaceExhausted` terminal state with the `NO_EPOCH` sentinel (§2.2),
  `LifecycleConfig` and its starvation refusal, `WatchStatusView`, `WatcherLifecycle` (start /
  status / shut_down / `Drop`, the production `without_epoch` for the exhausted-epoch arm, and
  the test-only `inert` — §2.9), the thread-id routed teardown join with the private `Reap`,
  the reaper thread whose every sweep joins every handle it observes finished, blocking on no
  unfinished handle (`reap_forever`, rounds 3–4), plus the test-only `JoinProbe` completion
  handshake (rounds 2–3 — §2.1), the private `WatchWorker` (native establishment, cancellable
  baseline, the loop), and the private
  `HintSpelling` (the backend-spelling reconciliation 2d-1 §5 item 3 left here). Four module
  tests: the config refusal, the respelling property, the epoch-allocation boundary and the
  stationary lifecycle's observable shape — since round 2 including its trivial teardown
  handshake.
- **`src-tauri/src/commands.rs`** — `Open` gained the `watcher` field; `WorkspaceSession` gained
  the session-lifetime `observations` sink, `watch_config` and the `epochs` allocator (a leaf
  mutex — `allocate` runs no caller code), a manual `Debug` (a sink is a closure) and a manual
  `Default`; `WorkspaceSession::new` now delegates to the new `WorkspaceSession::observing`,
  which is the injection seam, and the test-only `WorkspaceSession::unwatched` is §2.9's
  economy; `open` mints the epoch and installs the successor under the session lock, then
  cancels-and-joins the previous watcher **after releasing it and — for every open not initiated
  from that watcher's own sink callback — before returning** (§2.1), through the one
  `watcher_for` helper; `watch_status` is the observability accessor, and the test-only
  `watcher_join_probe` is the teardown-completion probe (round 2). The command tests' sessions
  are `unwatched()`.
- **`src-tauri/src/watch_check.rs`** — the `#[cfg(test)]` integration module: eighteen tests
  over synthetic temp trees (§3) — the eight-cell operation matrix (every content-bearing cell
  asserting its payload through the shared `assert_exact_source_bytes` helper, round 2), four
  further real-filesystem lifecycle tests (successful and failed reopen, drop, unavailable
  root), the sink-re-entry deadlock check, the two callback-initiated teardown checks (round 2),
  the reaper-starvation check (round 3), the epoch-exhaustion boundary and one pinning the
  economy's epoch semantics — following
  `dispatch_check.rs`'s in-crate-test-module shape because a binary crate has no `tests/`
  directory that can reach its internals.
- **`crates/espansoconfig-core/src/watch/native.rs`** — changed in the round-1 fix round only
  (§6): the private `signal_of` maps every backend delivery to a `NativeSignal`, and a
  rescan-flagged event — `notify`'s shape for FSEvents' dropped-events `MustScanSubDirs` — is
  `Degraded`, never hints, because its paths name directories the engine's filter would drop.
  Three new module tests pin the mapping.
- **`src-tauri/src/main.rs`** — the two module declarations and the phase paragraph in the crate
  docs.

---

## 2. The decisions

### 2.1 D1 — the watcher travels inside `Open`, and the join never runs under the session lock or on the worker being joined

Consult Q1. The watcher's lifetime *is* the open workspace's, so the handle is a field of `Open`
beside the `Workspace` and the `BackupSession`: a successful `open` replaces all three, a failed
`open` returns before touching any of them, and dropping the session drops them. The replacement
order, as the code actually performs it: **under the session lock, mint the epoch and install
the new workspace with its new watcher; then release the lock; then cancel the previous watcher
and either join it — from any thread but its own worker — or hand its join to the reaper; then
return.** The lock is held only for the swap, and the join runs outside it,
because the worker calls the injected `ObservationSink` synchronously and a sink is allowed to
call back into the session — 2d-4's queue consumer may well ask `watch_status`, which takes the
session lock. A join under that lock is a deadlock with any such sink: the worker waits for the
lock inside its callback while `open` waits for the worker inside the join. (The first version
of this record claimed the under-lock join was safe "because the worker never takes that lock",
which overlooked every path reached through the sink — round 1's second High, §6 item 2, pinned
by a test that parks a re-entering sink mid-replacement and failed against the under-lock
shape.) What survives the restructure is the guarantee that matters, **stated with round 2's
boundary on it: called from any thread but the replaced watcher's own worker, when `open`
returns the replaced worker has exited and nothing of its epoch can reach the sink again**;
while the replacement is in flight the two watchers may interleave at the sink, and the epoch
tag is what tells them apart (§2.2). The boundary is real, not defensive: a sink callback is
allowed to call back into the session, so it can call `open` itself — replacing the very watcher
whose worker is running the callback — or upgrade a `Weak`, become the last strong owner, and
drop the whole session on that worker; a thread synchronously waiting to join itself can never
be satisfied (round 2's High, §6 round 2). **The callback-initiated case therefore does not get
join-before-return, and the code no longer attempts it**: `WatcherLifecycle`'s `Drop` compares
the worker's thread id with the current thread's, joins in place on every other thread exactly
as before, and on the worker's own thread hands the `JoinHandle` to the **reaper** — a
process-lifetime thread that is never a worker, spawned on first use, parked on its channel
between teardowns, and joined by nobody. What is guaranteed on which thread, precisely: **on the
worker**, the stop message is already in its inbox when the teardown call returns, so the worker
exits after the initiating callback returns and the engine pass it interrupted completes —
observations of the torn-down epoch may reach the sink until then, epoch-tagged; **on the
reaper**, each sweep joins **every handle it observes finished, without blocking on unfinished
handles and irrespective of earlier handoffs** (rounds 3–4): the reaper never blocks inside a
join on a worker that has not exited — it sweeps the handles it holds with `is_finished()` and
joins exactly the exited ones, so a worker that exits is joined within about one sweep interval
(`REAPER_SCAN_MS`, 50 ms) whatever was handed over before it. No chronological ordering among
the workers one sweep meets finished is claimed — `is_finished()` reports only whether a worker
is finished at the instant inspected, never when it exited, so two workers that both exit
between sweeps are joined in hand-over order within their sweep (round 4). Only after a
worker's own join returns is its teardown-completion flag stored — the handshake the
test-only `JoinProbe` reads, so "the worker
was actually joined, off the worker" is a bounded assertion rather than an inference from
silence. The stated bounded policy for a worker that never exits — a sink callback parked
forever has hung its own worker — is that its handle simply **stays held**: one `Reap` of
memory per permanently stuck worker, kept for the life of the process, blocking no other
worker's join, and the held set grows with nothing else, because every worker that does exit is
joined and released by the next sweep. (Round 2's reaper joined serially in hand-over order,
so one such worker blocked every join handed over behind it — round 3's High, §6 round 3;
round 2's version of this sentence claimed the join unconditionally.) The reaper's channel
carries thread handles between teardown sites, never an observation, an event or anything a
command could drain, so it is not the wire consult Q3 forbids. Commands arriving during the
join see the already-installed successor, never an emptied session. There is no separate close
command, so replacement and shutdown are the only two close events, and both cancel **and
join**: `shut_down(self)` at the replacement site is a named consume whose mechanism is `Drop`,
which sends the stop message and routes the join as above, discarding the join result because a
worker that panicked has already stopped watching and there is nothing here to report it to.

### 2.2 D2 — epochs come from a checked allocator, and a replacement can never reuse one

`FIRST_WORKSPACE_EPOCH` is 1 — so a zero anywhere downstream can only mean *unset* — and the
session mints each epoch from its one `WorkspaceEpochs` allocator, under the session lock, so
epochs install in the order they are allocated. The allocation is **checked, never saturating
and never wrapping**: round 1's `saturating_add(1)` would have pinned the epoch at `u64::MAX`
and reused it on every later successful replacement — exactly what the tag exists to prevent
once 2d-4 lets observations outlive their watcher — so exhaustion is a typed terminal state,
`EpochSpaceExhausted`, answered forever once `u64` is spent. The terminal policy at the one call
site: **the open still succeeds and the workspace watches nothing**
(`WatcherLifecycle::without_epoch` — no worker, `ready: false`, status reporting the `NO_EPOCH`
zero that the epoch contract reserves for *unset*), per §2.7's principle that a missing watcher
degrades reconciliation, not the session, and because an observation that cannot be attributed
to a distinct epoch must not be produced. Exhaustion is unreachable in any physical execution —
one allocation per successful open does not spend `u64` in a process lifetime — but it is
reachable by construction, so the arm is typed and tested rather than hoped away
(`epoch_allocation_is_checked_and_never_reuses_a_value`,
`an_exhausted_epoch_space_opens_unwatched_rather_than_reusing_an_epoch`, both run against the
saturating shape and failed). Never serialized, `EpochSpaceExhausted` owes no dictionary entry,
by `LifecycleConfigError`'s precedent.

Every observation the worker emits is tagged (`EpochObservation`), which is what 2d-4's shared
queue must check once observations outlive their watcher. **The fence within one open is
physical**: each watcher has its own channel, and a late native callback from a replaced backend
finds its channel's receiver gone — the send fails and the hint is discarded before it can name
a document (Q1's requirement, met by construction). The ordering the fence gives, stated as the
code performs it: a replaced watcher's worker is joined **before the `open` that replaced it
returns — unless that open ran inside the replaced worker's own sink callback, where the join
is the reaper's and the worker exits only after the initiating callback returns (§2.1)** — and
not before the new epoch exists — the successor is minted and started first (§2.1) — so during
an in-flight replacement, and after a callback-initiated one until the old worker exits,
observations of the two epochs may interleave at the sink, and the tag is the only
discriminator there. Nothing yet *reads* the tag to discard, because
nothing shared exists to discard from; §5 item 5 states that as the hole it is.

### 2.3 D3 — one worker thread owns the engine, the native watch, and the caller obligations

The worker establishes the native watch **first**, then runs the baseline — and that order is
the whole of the no-missed-write argument, so here it is precisely, because round 1 challenged
it (§6 item 1). **The claim: there is no instant after the baseline's read of a file at which
the native stream is not yet live.** Its three legs, each checked against the code rather than
assumed:

1. **`NativeWatch::start` returns only after the stream is started, not merely requested.**
   `notify` 8.2.0's macOS backend blocks each `watch` call until its run-loop thread has
   created, scheduled and executed `FSEventStreamStart` for the stream — `run()` in its
   `fsevent.rs` receives the run loop over a channel that is written *after* the start call, and
   `watch_inner` waits on that receive. So when `establish_native` returns a healthy watch, a
   subsequent write lands on a started stream. This is a property of the pinned backend,
   verified in its vendored source and recorded in `establish_native`'s doc comment; a backend
   change that made establishment asynchronous would reopen the window, which is why the doc
   names the evidence.
2. **The baseline runs strictly after establishment**, on the same worker thread, so any write
   that lands after a baseline read of its file lands while the stream is live and produces a
   hint. A successful baseline consumes nothing from the worker's inbox — hints are consumed and
   dropped only in the *failing*-baseline retry wait (§5 item 10) — so a hint that arrives
   during the baseline waits in the channel and is absorbed by the loop's first turn.
3. **A write that completes before the baseline's read of its file needs no hint**: the read
   sees its bytes, and a torn read defers the path into the ordinary pending pipeline
   (2d-1's two-read stability), which re-reads it.

What the argument deliberately does not cover: a backend that stops delivering **without
reporting anything** — a sandbox that blocks FSEvents delivery looks exactly like a healthy
quiet stream, and no API distinguishes them (§6 item 1 records the review-host evidence of
precisely that). Every failure the backend *does* report engages the polling fallback: creation
failure, a refused root, `Degraded`, and — since this fix round — a dropped-events rescan
demand, which `native.rs` now maps to `Degraded` instead of forwarding as hints the engine's
filter would drop. Accordingly, `ready` claims only that the baseline is done and the loop is
running; it does **not** claim the native backend can deliver, and `WatchStatusView::ready`'s
doc now says so in the same sentence.

The engine's two documented caller obligations — map real time onto its
injected `Millis`, and keep ticking until `next_deadline()` is `None` — are met in one place: the
worker measures instants from a fixed `Instant` origin by subtraction (exactly the mapping the
engine's docs prescribe) and its loop sleeps only until the next deadline or the next rescan,
woken early by any message. A stop request is a channel message, so cancellation needs no
polling flag and interrupts any park immediately. The baseline retries a failing enumeration on
the poll cadence, remaining cancellable between attempts; hints consumed during a failing
baseline are dropped, which loses nothing — the baseline that eventually succeeds reads the tree
as it is then.

### 2.4 D4 — the sink is the seam, and the production sink discards, said out loud

`ObservationSink` lives on the **session**, not on `Open`, because it outlives any one workspace:
a replacement changes which directory is watched, never where observations go.
`WorkspaceSession::new` hands every watcher `discarding_sink()` — observations are produced and
dropped — because the queue that will consume them is 2d-4's, and building it early would put a
wire where consult Q3 says none may exist yet. This is the project's established
primitive-before-caller cut: the lifecycle exists and is tested before its consumer, exactly as
`persist::save_document` had no command at 2a and the 2d-1 engine had no caller.
`WorkspaceSession::observing(sink, config)` is the one injection seam — the integration tests
use it today and 2d-4's queue lands on it. **A dropped observation is gone**: the engine is
private to the worker, no snapshot or drain surface exists, and no present code recovers a value
the production sink has discarded — the 2d-2 guarantee is only that observations are produced
and deliberately unconsumed until 2d-4 exists to consume them. Whatever recovery 2d-4's
bootstrap or drain offers is 2d-4's to build and to claim when it is code. (This paragraph and
`discarding_sink`'s doc both claimed more in round 1 — "not lost forever, the first drain starts
from the tracked state" — a guarantee no present code gives; §6 item 5.)

### 2.5 D5 — polling is engaged in exactly three cases, validated against starvation, and never re-probed

Consult Q1: polling is a fallback for an unavailable native backend, never the primary mechanism.
The worker engages the rescan cadence when the backend cannot be created, when any watched root
could not be watched (a fresh install may have only one of the two directories — `native.rs`
already refuses per root without failing the start), or when the running backend reports
`Degraded`; **in no other case does a timer drive a rescan**. Since the fix round, `Degraded`
covers one more report without adding a case: a backend event flagged *rescan needed* —
`notify`'s shape for FSEvents' dropped-events `MustScanSubDirs` — is mapped to `Degraded` by
`native.rs`'s `signal_of` rather than forwarded as hints, because its paths name directories the
engine's YAML filter would silently drop, and a dropped-events announcement discarded is a
missed write with nothing left to recover it (§6, the finding-1 sweep). `LifecycleConfig::new` refuses a
poll interval under `2 × (debounce + probe)`, because the interaction is real and silent: a
rescan re-hints every listed and tracked path, the engine's debounce is trailing-edge, so a fast
enough poller pushes every deadline out forever and starves the pipeline it exists to feed, with
nothing failing. The factor of two is margin for tick scheduling; the hard floor is one debounce
plus one probe. **Once engaged, polling persists for this watcher's life**: nothing re-probes the
native backend, so a healthy watch returns with the next workspace open. That is a stated cost —
re-establishment machinery would need its own lifecycle inside the lifecycle, for a state the
next open clears.

### 2.6 D6 — the backend's path spelling is reconciled to discovery's, narrowly

2d-1 §5 item 3: the engine compares hint paths to tracked paths byte for byte, and reconciling
the backend's spelling with discovery's is the lifecycle's, beside the backend. macOS FSEvents
reports **resolved** paths, and every macOS temp directory sits behind the `/var` →
`/private/var` symlink, so without reconciliation every hint in every integration test would be
dropped as outside the watched roots — measured, not hypothesized: that is how this defect was
found. `HintSpelling` canonicalizes each watched root **once, at worker start**, and re-prefixes
a hint under a root's canonical form onto its spelled form. Deliberately nothing below the root
is resolved: discovery refuses symlinked intermediates inside the tree, so a deeper mismatch is a
hint about a path the walk cannot reach, and dropping it is the walk's own answer. What it cannot
fix is stated at the type: a spelling that differs by case only, and a root whose symlinked
ancestor appears *after* start, still miss (§5 item 6).

### 2.7 D7 — a watcher that cannot start never costs the workspace

`WatcherLifecycle::start` returns immediately and infallibly; the native watch, the baseline and
the loop all run on the worker thread, so `open_workspace` never waits for a directory walk it
did not ask for. If the worker **thread** cannot be spawned — resource exhaustion — the lifecycle
watches nothing and says so observably (`ready: false`, forever), and the open still succeeds:
this application browsed and edited for two whole phases with no watcher, so a missing watcher
degrades reconciliation, not the session. Refusing the workspace over it would trade a degraded
watcher for a dead window.

### 2.8 D8 — observability by accessor, and lint-armed dead-code allowances

`WatcherLifecycle::status` and `WorkspaceSession::watch_status` exist because a property nothing
can observe is a property nothing can test (`PROGRESS.md` R24): the integration tests wait on
`ready` and read `polling` through them, and nothing anywhere can *steer* the watcher through
them. Until 2d-4 wires production consumers, several items are consumed only from `#[cfg(test)]`
code, and each carries `#[cfg_attr(not(test), allow(dead_code))]` with a comment naming its
pending consumer — scoped that way so the lint stays armed exactly where consumers exist, and a
test that stops using one fails the build rather than leaving it silently dead everywhere.

### 2.9 D9 — one active FSEvents stream costs seconds, and the command tests stopped paying it

Measured, not assumed: on this machine a single test whose watcher establishes and tears down
two live streams takes **2.77 s** against a 0.07 s harness floor, a test whose backend watches
**nothing** takes 0.00 s, and three stream-holding tests in parallel take 8.1 s — the cost is per
*active stream*, it is in establishment and teardown, and it serializes process-wide through the
events daemon. The first full-suite run after this step made that a defect: every one of the
~65 command tests that opens a session started a real watcher it never consulted, the bin target
went from under a minute to **217 s**, and the two real watcher tests starved past their bounded
waits and failed.

The economy chosen: `WorkspaceSession::unwatched()`, a **`#[cfg(test)]`** constructor whose opens
install `WatcherLifecycle::inert(epoch)` — no worker, no native backend, `ready: false` forever,
which is deliberately the *same observable shape* as a worker that could not be spawned (§2.7),
so it invents no new state. The `cfg` is the enforcement: the `watching` switch does not exist in
a production build, so no production constructor can produce an unwatched session, and `open`
itself keeps one shape in both builds — the branch is confined to the `watcher_for` helper.
Since the fix round the stationary shape has exactly one production constructor beside the
test-only `inert`: `WatcherLifecycle::without_epoch`, reachable only from `open`'s
exhausted-epoch arm (§2.2), which carries no epoch at all — so the sentence above is still about
sessions: no production path yields a session whose *ordinary* opens watch nothing.
What the economy costs, said plainly: the command tests now say **nothing** about the watcher,
and a session built by `unwatched()` takes a test-only path through `watcher_for`. The lifecycle
claims are carried instead by `watch_check`'s real-watcher sessions and by `dispatch_check`'s
production-built ones (`register()` still calls `WorkspaceSession::new()`, so the dispatcher
tests run real watchers), and a future test reaching for `unwatched()` *because it is faster*
in a test that is about the watcher is the misuse to review for.

### 2.10 D10 — the integration tests' flakiness policy: bounded waits, and a fence before any negative

Native delivery promises nothing about latency — and §2.9's stream costs contend with
`dispatch_check`'s production-built watchers in a parallel run — so every positive expectation
is a bounded wait (`PATIENCE`, 120 s) that returns the moment its observation arrives, and no
bare unsynchronized sleep decides a verdict. The one negative claim —
nothing from a replaced watcher — is asserted **behind a positive fence**: an edit to the live
tree must arrive first, and only then is a short drain window read, because a leaked watcher
would run the same debounce cadence the live edit just demonstrated. The shutdown proof is fully
deterministic: the only channel senders live inside the sink whose only holders were the session
and its worker, so `Disconnected` on the receiver *is* the join, not a timing inference. The
sink-re-entry deadlock check keeps the same discipline: its one sleep only widens the overlap
between the parked sink and the replacing `open` — the verdicts are bounded `recv_timeout`s, and
a regression to the under-lock join fails as a clean timeout panic rather than a hung suite.
Round 2's two teardown checks go one step further and remove the FSEvents dependence entirely:
their trees hold only `match/`, so the polling fallback is engaged from the start and the rescan
cadence delivers the triggering edits whether or not native delivery works; their verdicts are
bounded channel waits plus the join probe, which is stored only after the join actually
returned. Round 3's reaper-starvation check rides the same match-only shape with one deliberate
park: the first worker's callback parks only after its own reap is handed over, the park is
itself PATIENCE-bounded and released before the test ends so the suite exits cleanly, and the
decisive verdict is a bounded wait for the second worker's handshake completing while the
first is still parked.

---

## 3. The evidence, item by item

Consult Q7 item 2 lists what this step owes. All integration items are in
`src-tauri/src/watch_check.rs`, over synthetic temp trees only; the module tests named below
live beside their subjects (`watch.rs`, the core's `native.rs`):

| Owed | Where |
|---|---|
| real creates, edits, atomic renames and removals under **each** root, exact bytes and revisions, membership classification | the eight-cell matrix, one isolated test per operation-root cell: `a_real_{create,edit,atomic_rename,removal}_under_{config,match}_reaches_the_sink`, each over its own tree and session so an early timeout hides no other cell. Creates assert the walk's `FileKind`; every content-bearing cell asserts its payload through the shared `assert_exact_source_bytes` helper, which destructures the `Projected` snapshot and compares `snapshot.source` byte for byte **and** checks the revision hashes those same bytes (round 2 — the revision comparison alone was a claim through the hash, not a byte comparison); edits and renames assert that over the baseline's `previous_revision`; removals — which correctly carry no content payload — remember the removed revision; renames stage under a non-YAML name, the same shape a save's temp file takes |
| epoch tagging | every integration assertion checks `epoch`; the reopen test sees 1 then 2 |
| cancellation/join on successful replacement | `a_successful_reopen_cancels_and_joins_the_old_watcher_and_bumps_the_epoch` — an **ordinary** reopen, from the test's own thread: `open` returns only after the join, the live tree's edit is the fence, and the grace window behind it sees nothing of the replaced tree |
| the join never runs under a lock a sink can take | `a_sink_that_reenters_the_session_during_replacement_does_not_deadlock` — the sink parks inside its callback, calls `watch_status` while `open` is joining that very worker, and both must complete; run against the under-lock join and failed (a clean 120 s timeout panic) |
| a callback-initiated teardown never joins the worker on itself | round 2: `a_sink_that_reopens_the_workspace_does_not_join_its_own_worker` — the sink calls `open`, replacing its own watcher; the reopen must return, the join probe must complete (the reaper's handshake, stored only after the join returned), and the successor must deliver under epoch 2 — and `a_sink_that_becomes_the_last_owner_drops_the_session_without_joining_itself` — the sink takes the last strong reference and drops the whole session on the worker; the drop must complete, the probe must complete, and the sink must close (`Disconnected`). Both trees hold only `match/`, so the rescan cadence delivers the triggers with no FSEvents dependence. Both run against the always-join-in-place shape and failed — the reopen as a clean 120 s bounded timeout (129 s run), the last-owner drop as the self-join's own "Resource deadlock avoided" panic (1.6 s run) |
| one stuck worker cannot starve later reaps | round 3: `a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it` — the first teardown's worker parks in its sink callback strictly after its own reap is handed to the reaper (released only at cleanup), a second session then tears itself down the same way and its worker exits, and the second worker's join handshake must complete while the first is still parked — which no hand-over-order release can produce, because the stuck reap is queued first; the parked worker's probe must still read incomplete at that moment, and after the release its own reap must complete, which is the held-handle policy observed. Both trees hold only `match/`; run against the serial hand-over-order reaper and failed (§6 round 3) |
| epochs are never reused | `watch.rs`'s `epoch_allocation_is_checked_and_never_reuses_a_value` (the `u64::MAX` boundary) and `an_exhausted_epoch_space_opens_unwatched_rather_than_reusing_an_epoch` (the session at exhaustion opens, reports `NO_EPOCH`, watches nothing); both run against the saturating shape and failed |
| a failed open keeps workspace **and** watcher | `a_failed_reopen_keeps_the_previous_watcher_watching` — same epoch, still ready, still delivering |
| drop on shutdown | `dropping_the_session_joins_the_worker_and_closes_the_sink` — `Disconnected` on the sink's channel is the join made observable |
| polling only as fallback | every matrix cell asserts `polling: false` before and after its native delivery; `an_unavailable_root_engages_the_polling_fallback_and_a_rescan_delivers` asserts it engages for a missing root and that the **rescan** delivers an addition no native watch covers |
| a dropped-events report becomes degradation, never filterable hints | `native.rs`'s `a_rescan_flagged_event_is_degradation_not_hints`, beside `an_ordinary_event_becomes_hints_carrying_its_paths` and `a_backend_error_is_degradation_with_its_text` — the mapping is driven; forcing a live FSEvents overflow deterministically is not portable, so the emission itself remains reviewed (§5 item 7) |
| the starvation refusal | `watch.rs`'s `a_poll_interval_that_would_starve_the_debounce_is_refused` |
| backend-spelling reconciliation | `watch.rs`'s `a_native_hint_is_respelled_onto_the_workspaces_root_spelling`, plus every integration test on this macOS tree — under `/var/folders` the hints only reach the engine because of it |
| the economy keeps the bookkeeping | `an_unwatched_session_keeps_epoch_semantics_while_watching_nothing` — epochs mint and replacement consumes with an inert lifecycle, `ready: false` observably |

**What none of it proves.** The `Degraded` signal path — a *running* backend reporting an error
or a dropped-events condition — is only half driven: `signal_of`'s mapping into `Degraded` is
unit-tested, but no test forces `notify` to emit either report deterministically, so the arm of
`absorb` that engages the fallback on a live report is reviewed, not driven. The
unavailable-root arm, which shares `engage_polling`, is the arm the tests drive. The ~65 command tests say nothing about the watcher
any more — their sessions are `unwatched()` by §2.9's economy, and the claims they used to carry
incidentally are carried deliberately by `watch_check` and `dispatch_check`. Nothing here proves
an observation is *consumed* — the production sink discards by design — and nothing exercises the
suppression predicate, the ledger, a queue, an event or a command, because none of them may exist
yet. The corpus fixtures and the real corpus were not involved at all: this step's tests are
about delivery and lifetime, not byte fidelity, which 2d-1 already pinned over both corpora.

---

## 4. The gates

| Gate | Before 2d-2 | Round 1 | After the fix round | After the round-2 fix round | After the round-3 fix round | After the round-4 fix round |
|---|---|---|---|---|---|---|
| `cargo test --workspace` | 1198 passed, 0 failed | 1206 passed, 0 failed | **1220 passed, 0 failed** (exit 0; the figure is the sum of the run's own 26 `test result` lines) | **1222 passed, 0 failed** (exit 0; 26 `test result` lines, run twice on the final tree) | **1223 passed, 0 failed** (exit 0; the sum of the run's own 26 `test result` lines) | **1223 passed, 0 failed** (exit 0; 26 `test result` lines — a wording-only round, the count re-measured rather than carried) |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1`, twice | — | 6 tests; failed 3-of-6 on the sandboxed review host, 6/6 twice on the supported host (§6 item 1) | **15 passed, 0 failed — twice, serially** (53.0 s and 53.3 s) | **17 passed, 0 failed — twice, serially** (56.7 s and 50.2 s) | **18 passed, 0 failed — twice, serially** (62.4 s and 54.5 s) | **18 passed, 0 failed — twice, serially** (60.1 s and 54.1 s) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | clean | **clean** (exit 0) | **clean** (exit 0) | **clean** (exit 0) | **clean** (exit 0) |
| `cargo fmt --check` | clean | clean | **clean** (exit 0) | **clean** (exit 0) | **clean** (exit 0) | **clean** (exit 0) |
| `cargo tree -p espansoconfig-core \| rg tauri` | empty | empty | **empty** (no match — the fix round's one core change, `watch/native.rs`, pulls nothing in) | **empty** (no match — round 2 changed no core file) | **empty** (no match — round 3 changed no core file) | **empty** (no match — round 4 changed no core file) |

**The integration tests were run repeatedly, not once**: the fifteen `watch_check` tests passed
in the full-suite run above and in two further focused serial runs, plus a 15/15 development run
(50.6 s) before the final gates; in round 2's fix round the grown seventeen passed in two
full-suite runs and in **four** focused serial runs (two before the formatting pass, two on the
final tree — the recorded pair); in round 3's fix round the grown eighteen passed in the
full-suite run and in two focused serial runs, plus two single-test runs of the new check
(9.7 s and 8.5 s); in round 4's wording-only round the eighteen passed in a full-suite run
and two focused serial runs (60.1 s and 54.1 s) taken with nothing else running. The failures
ever observed on the supported host were the pre-§2.9 starvation (two bounded-wait timeouts
in the 217 s run, which §2.9 exists to prevent, not recurred since), the deliberate neuter
runs §6 records — round 1's two, round 2's two and round 3's one — each of which was the
point, and round 4's one contended workspace run: ten `watch_check` bounded-wait timeouts
(exit 101, the bin target at 320.8 s) with the host under other load, on the identical tree
the quiet-host runs above passed. §6's round-4 closure records that run; the gate's
precondition it makes explicit is that the workspace and focused suites are evidence on a
quiet host, and a host running concurrent FSEvents-establishing work is not one.

**The test count moved by 22 over the pre-2d-2 baseline and every one is accounted for**: 15
tests in `src-tauri/src/watch_check.rs` (6 at round 1, +8 matrix cells replacing the principal
test, +1 deadlock, +1 exhaustion, −1 principal), 4 module tests in `src-tauri/src/watch.rs`
(2 at round 1, +2 in the fix round), and 3 new `signal_of` tests in the core's `native.rs` —
all counted from the runs' own `test result` lines rather than copied forward. **Round 2's fix
round moved it by 2 more, to 24 over the baseline**: the two callback-initiated teardown tests
in `watch_check.rs` (17 there now); `watch.rs` stays at 4 module tests, one of them extended
with the teardown-completion handshake, and the exact-bytes closure added assertions to
existing tests through a shared helper rather than new tests — again counted from the runs'
own `test result` lines (1222 = 1220 + 2). **Round 3's fix round moved it by 1 more, to 25
over the baseline**: the reaper-starvation check in `watch_check.rs` (18 there now); the
reaper rewrite itself changed no test — again counted from the run's own `test result` lines
(1223 = 1222 + 1). The focused suite's wall-time growth (17 tests ≈ 50–57 s → 18 tests at
62.4 s and 54.5 s) is one more test holding two real sessions, proportionate to §2.9's
per-stream cost. **Round 4's fix round moved it by 0**: a wording-only round — code docs,
comments and this record — and the unchanged figure was re-measured on the final tree
(1223, 26 `test result` lines), never carried forward.

**The frontend gates were not run, per this step's boundary**: `git status --short
--untracked-files=all` shows changes only under `src-tauri/src/`,
`crates/espansoconfig-core/src/watch/native.rs` and this record — no `src/`, no i18n path, no
corpus path.

**The suite's wall time is protected by §2.9's economy, and the residual cost is named**: real
FSEvents streams run only where the lifecycle claims live — `watch_check`'s real-filesystem
tests and `dispatch_check`'s production-built sessions — and each active stream still costs seconds of
process-wide serialized establishment and teardown, which is why those tests' bounded waits are
generous and why the bin target's wall time is higher than 2d-1 left it.

---

## 5. Holes, stated rather than hoped about

1. **Observations are produced and discarded in production.** No queue, no wake event, no drain
   command (2d-4), no suppression ledger (2d-3): a committed save's own post-rename observation
   is currently produced like any other and dropped like any other. Nothing acts on any
   observation yet, so nothing can act wrongly — but nothing can act at all.
2. **The engine's snapshot store and the `Workspace` cache are still two stores.** Consult Q1's
   "one observation/coalescing coordinator" is not yet wired: in 2d-2 the watcher never touches
   the workspace cache, so the race the consult forbids cannot occur yet, and the serialization
   point it prescribes — install under the session mutex — is where 2d-3/2d-4 must put the
   installation when a consumer exists. Nothing here performs or prevents it.
3. **Polling, once engaged, is never disengaged within a watcher's life** (§2.5). A fresh install
   whose `config/` directory never appears rescans every two seconds until the workspace is
   replaced. The interval is the cost ceiling; the next open is the reset.
4. **`open` itself still pays the join, once per ordinary reopen.** The join runs after the
   session lock is released (§2.1), so commands no longer wait behind it — they see the
   installed successor — but the reopening caller does: the worker being joined may be
   mid-`NativeWatch` teardown, which measures in seconds on this machine, and `open` returns
   only after it. A user reopening a workspace pays it once per open; nothing else pays it — a
   callback-initiated reopen cannot wait for its own thread and pays nothing, and the reaper
   pays that join later (§2.1).
5. **The epoch tag has no reader yet** (§2.2). Today's fence is the per-watcher channel plus the
   join-before-`open`-returns order for every teardown not initiated on the worker itself
   (§2.1) — which permits interleaved epochs at the sink while a replacement is in flight, and
   after a callback-initiated one until the old worker exits, with the tag as the only
   discriminator there; when 2d-4 builds the shared queue, observations outlive their watcher
   and the queue **must** check the tag — this record is where that obligation is written until
   the queue exists to carry it.
6. **`HintSpelling` reconciles root-prefix aliases only** (§2.6). A backend that reports a path
   differing by case alone, or through a root whose symlinked ancestor appeared after worker
   start, still misses the tracked entry — 2d-1 §5 item 3's residue, narrowed but not closed.
   Production espanso roots contain no symlinked ancestor in the default layout; the alias table
   is empty there and respelling is the identity.
7. **The live `Degraded` emission is reviewed, not driven** (§3). `signal_of`'s mapping of a
   backend error or a dropped-events report into `Degraded` is unit-tested, but forcing a live
   `notify` backend to emit either deterministically is not portable; the arm of `absorb` that
   acts on one shares `engage_polling` with the tested unavailable-root arm, and that sharing is
   the argument, not a proof.
8. **The replacement test's negative window is bounded, and a slower leak escapes it** (§2.10). A
   replaced watcher that somehow survived the join *and* delivered later than the 600 ms grace
   window would pass; the deterministic half — `open` returns only after the join — is structural,
   and the window exists to catch the structural claim being wrong quickly rather than to bound
   all possible leaks.
9. **The scoped dead-code allowances must come off as consumers land** (§2.8). Each names its
   pending consumer; 2d-4 removing the allowance when it wires the queue is the intended end
   state, and an allowance surviving its consumer is the smell to sweep for.
10. **Baseline-window hints are dropped while the enumeration is failing** (§2.3). A hint that
    arrives between a failing enumeration and the successful retry is consumed and not
    replayed; the successful baseline reads the tree as it is then, so no *state* is lost — but
    an external change that both happens and is fully reverted inside that window is invisible,
    exactly as it would be to the baseline itself.
11. **An unwatched session is constructible in test builds** (§2.9), and nothing but review
    stops a future watcher-relevant test from using it for speed. The `cfg(test)` gate proves
    the built application always watches; it proves nothing about which sessions a *test*
    should build, and that judgement stays with whoever writes the test.
12. **The reaper is a process-lifetime thread; each sweep joins every handle it observes
    finished, without blocking on unfinished handles and irrespective of earlier handoffs**
    (§2.1). Once spawned it lives until the process exits and nobody joins it; while it
    holds no handle it blocks
    on its channel, and while it holds any it wakes every `REAPER_SCAN_MS` (50 ms) to sweep. A
    worker that never exits — a sink callback parked forever has hung its own worker — costs
    exactly its own reap: its handle stays held for the life of the process, one `Reap` of
    memory per permanently stuck worker, and every worker that does exit is joined within
    about one sweep interval, whatever was handed over before it. (Round 2's reaper joined
    serially in hand-over order, and one stuck worker starved every later reap, defeating
    those workers' completion handshakes and retaining their handles unboundedly — round 3's
    High, §6.) If the reaper thread cannot be spawned, or its channel is gone, the handle is
    dropped and the worker is detached: it still stops on the message already in its inbox,
    and the only loss is the join and the completion flag it would have stored.

---

## 6. The round-1 review and its closures

`docs/reviews/phase-2d-2-lifecycle.md` round 1 answered NOT READY — two High, two Medium, one
Low — and every finding was verified against the code. The closures, each checked back against
the code after fixing (a record claiming a guarantee the code does not give is this project's
worst defect class):

1. **High — the native-ready handoff and the failed focused gate.** Two halves, closed
   differently because they are different claims. **The empirical half is a sandbox confound,
   recorded here for round 2 to rule on**: the review host's focused run failed 3 of 6 tests,
   all three at the full 120 s with **zero** observations seen — and the failing three are
   exactly the delivery-dependent subset (the principal delivery test and both reopen tests),
   while the two that pass (unavailable-root polling, shutdown) are exactly the ones that need
   no FSEvents delivery. That signature is a blocked events service, not a latency shortfall or
   a race: a slow-but-working backend produces *late* observations, not none, and a
   lifecycle defect would not partition the failures along the needs-native-delivery line. The
   coordinator then ran the identical command twice on the supported macOS host — **6/6 both
   times, ~19 s each** — beside the implementer's three green whole-bin-target runs; after this
   fix round the grown suite passed **15/15 twice serially** on the same host. **The
   substantive half is the ordering question, and the answer is the argument now written in
   §2.3**: no missed-write window exists between the baseline read and native liveness, because
   `notify` 8.2.0's macOS backend blocks `watch` until `FSEventStreamStart` has run (verified
   in its vendored `fsevent.rs`, cited in `establish_native`'s doc), the baseline runs strictly
   after establishment, and a successful baseline consumes no queued hint. `ready`'s doc now
   states what it does not claim — that the backend can deliver — because a sandbox that blocks
   delivery without reporting anything is indistinguishable from a healthy quiet stream, which
   is precisely what the review host observed. **The shape sweep found one real narrower
   instance and closed it in core**: a backend dropped-events report (`notify`'s rescan-flagged
   event for FSEvents' `MustScanSubDirs`) was forwarded as hints whose directory paths the
   engine's YAML filter silently drops — the one notification that writes were missed,
   discarded, with no rescan to recover them. `native.rs`'s new `signal_of` maps it to
   `Degraded`, whose existing policy (engage the rescan cadence) is exactly the sweep the flag
   demands; three unit tests pin the mapping. Polling remains fallback-only: no new engagement
   case exists (§2.5), and the healthy path still never rescans on a timer.
2. **High — the replacement join could deadlock against a re-entering sink.** Closed in code,
   not prose: `open` now holds the session lock only for the swap — mint the epoch, start the
   successor, install it — and cancels-and-joins the replaced watcher after releasing the lock,
   before returning (§2.1). The record's "safe, because the worker never takes that lock"
   sentence was false for every path reached through the sink and is corrected in §2.1. Pinned
   by `a_sink_that_reenters_the_session_during_replacement_does_not_deadlock`, whose sink parks
   inside its callback and calls `watch_status` while a reopen joins that very worker: run
   against the under-lock join and failed (a clean 120 s timeout panic, 129 s run), passes
   deterministically now. The sweep for the shape — a blocking wait under a lock a worker
   callback can acquire — found no second instance: the only other join site is
   `WatcherLifecycle::Drop`, which runs with no session lock held (dropping a mutex is not
   locking it), and the session's `epochs` mutex is a leaf no caller code runs under.
3. **Medium — epoch reuse at the `saturating_add` boundary.** Closed with `WorkspaceEpochs`, a
   checked allocator with the typed terminal state `EpochSpaceExhausted` and the stated
   call-site policy — the open succeeds, the workspace watches nothing, status reports the
   reserved `NO_EPOCH` zero (§2.2). Pinned twice, both runs against the saturating shape and
   failed: the allocator boundary test (allocates `u64::MAX` exactly once, refuses forever
   after) and the session-level exhaustion test, whose failure under the neutered allocator
   displayed the reused `u64::MAX` verbatim. The record's false ordering sentence — "the old
   worker is joined before the new epoch exists", written while the code computed `next` before
   `shut_down()` — is corrected in §2.2 to what the code now does: the successor is minted and
   started first, the old worker is joined before `open` returns (since round 2: unless that
   open ran inside the old worker's own sink callback — §2.1), and the tag is the only
   discriminator while a replacement is in flight. The sweep for the shape — silent saturation
   on an identity-bearing counter — found no second instance: the remaining saturations
   (`Millis::plus`, `wake_after`'s subtraction, the wire scanner's depth, backup rotation
   arithmetic) clamp schedules or counts, not identities, and the core pins its clock
   saturation as intended behaviour by test.
4. **Medium — the operation matrix did not cover both roots.** Closed by replacing the single
   principal test with **one isolated test per operation-root cell** — eight tests, each over
   its own tree, session and sink, asserting revisions (this sentence said "exact bytes and
   revisions" until round 2 found the cells compared only hashes; the byte comparison itself
   is round 2's closure, §6 round 2 item 2), the baseline's `previous_revision`, membership
   classification (`FileKind`) on creates, epoch 1 on every observation, and `polling: false`
   after every native delivery (§3). Isolation is the
   reviewer's "preferably" taken literally: an early timeout in one cell can no longer hide the
   other seven. The name positions the finding cited — the test's own doc claim and this
   record's headline — now describe the shipped matrix. Cost, measured: the serial focused
   suite grew from ~19 s / 6 tests to ~50 s / 15 tests, almost all of it per-session FSEvents
   establishment/teardown (§2.9's known per-stream cost), which is proportionate to doubling
   the matrix and isolating every cell.
5. **Low — overstated recoverability of discarded observations.** Both sites — `watch.rs`'s
   `discarding_sink` doc and §2.4 — now claim only the 2d-2 guarantee: observations are
   produced and deliberately unconsumed in production until 2d-4, a dropped value is gone, and
   whatever recovery 2d-4 offers is 2d-4's to claim when it is code. The concept sweep (`rg`
   over "lost", "drain", "recover" in the watch files and this record) found no third site;
   §5 item 1 already stated the discard without a recovery promise.

**The sweeps were run as two passes per finding, the second over name positions** — module
headlines, markdown headings, bold rulings, first sentences, test names — exactly because
2d-1's rounds 2–4 each found a just-closed claim surviving as a name. The name-position pass
renamed or rewrote: this record's headline and §§2.1–2.2 headings, `watch.rs`'s opening
paragraph and its "# Epochs" section, `commands.rs`'s `open` doc and the `Open.watcher` field
doc, and the reopen test's doc sentence plus its two inline comments ("joined before epoch 2
existed" → "joined before the reopen returned"). The reopen test's *name* — cancels and joins
the old watcher and bumps the epoch — survives because it is still exactly true. Searches were
written from the fixed code's claims (join-outside-lock, checked allocation, matrix per cell,
deliberately unconsumed), not from the round-1 wording.

The gates in §4 were re-run and re-measured after these fixes; the test delta over round 1's
1206 is +14 — nine `watch_check` tests net (the matrix's eight for the principal one, plus the
deadlock and exhaustion checks), two `watch.rs` module tests, and three `native.rs` mapping
tests — every figure from the runs' own `test result` lines rather than copied forward.

### The round-2 review and its closures

Round 2 (`docs/reviews/phase-2d-2-lifecycle.md`, "## Round 2") confirmed five of the six round-1
closures — the handoff argument, the un-locked replacement join, the checked epochs, the
eight-cell matrix's existence and substance, the recovery-claim narrowing, and the `signal_of`
mapping — and answered NOT READY on two findings. Both are closed; each closure was checked back
against the code after fixing.

1. **High — a re-entering sink could still make the watcher join its own worker thread.** Round
   1's fix moved the join outside the session mutex, which closed the lock cycle — and left two
   paths on which the join itself executes **on the worker being joined**: a sink callback that
   calls `open` (the replacement consumes the callback's own lifecycle), and a sink callback
   that upgrades a `Weak`, becomes the last strong owner, and drops the session — and its
   current watcher — on the worker. A thread synchronously waiting to join itself can never be
   satisfied; on this platform the self-join fails as std's "Resource deadlock avoided" panic
   inside the callback, and the teardown it was performing never completes. **Closed by making
   the join's thread a decision, not an assumption**: `WatcherLifecycle::Drop` compares the
   worker's thread id against the current thread's — every teardown on any other thread joins
   in place exactly as before, keeping join-before-return for ordinary replacement and
   shutdown, and a teardown on the worker's own thread hands the `JoinHandle` to the **reaper**
   (a process-lifetime thread that is never a worker) and returns without waiting. The precise
   guarantee for the callback-initiated case is stated in §2.1 and in the code docs — what
   holds on the worker (stop already in its inbox; exit after the initiating callback returns
   and its engine pass completes; old-epoch observations possible at the sink until then,
   tagged), what holds on the reaper (the join, and the completion flag stored only after it) —
   and join-before-return is claimed nowhere the code cannot give it. The handshake is the
   `joined` flag behind the test-only `JoinProbe` / `watcher_join_probe`, stored only after the
   join actually returned. **Pinned by the two commissioned tests**, both riding the polling
   fallback (match-only trees) so no FSEvents delivery decides a verdict:
   `a_sink_that_reopens_the_workspace_does_not_join_its_own_worker` and
   `a_sink_that_becomes_the_last_owner_drops_the_session_without_joining_itself` (§3's teardown
   row). Both were run against the neutered always-join-in-place shape and **failed** — the
   reopen as a clean bounded 120 s timeout (129 s run), the last-owner drop as the self-join
   panic itself (1.6 s) — and pass deterministically with the fix. **The shape sweep** — a
   join or teardown that can run on the thread being torn down, over drop paths, panic
   unwinding and the polling arm — found no further instance: the only `JoinHandle` joins in
   both crates are `Drop`'s (now routed), the reaper's own loop (the reaper is never a worker,
   and nobody joins the reaper), and a test joining its spawned opener thread; `NativeWatch` is
   dropped only on the worker, never on the backend's callback thread, and no drop or unwind
   path holds a join besides `Drop`'s.

   > **Correction (round 3).** The reaper half of this closure claimed more than the reaper it
   > shipped gave: "what holds on the reaper (the join, and the completion flag stored only
   > after it)" was written of a consumer that joined **serially, in hand-over order**, so
   > behind one worker parked forever in its sink callback the join of a later worker that had
   > already exited never ran at all — the handshake defeated, and the handed handle set
   > growing without bound across generations. Round 3 found it (its one High); the item above
   > is left as written, and the round-3 closure below, with §2.1 and §5 item 12, carries what
   > the exit-order reaper now actually gives.

2. **Low — the matrix claimed "exact bytes" while comparing hashes.** The create, edit and
   atomic-rename cells asserted `StableContent::revision()` against a hash of the expected
   bytes and never destructured the `Projected` snapshot, so the headline and decision-table
   claims were stronger than the tests. **Closed with one named payload helper**,
   `assert_exact_source_bytes` in `watch_check.rs`: it destructures the snapshot, compares
   `snapshot.source` byte for byte against what the test wrote, and then checks the revision
   hashes those same bytes — used by all six content-bearing matrix cells and, by the shape
   sweep, by the rescan-delivery test's `Added`, the fourth site that carried a revision-only
   check on a content payload. Removal cells correctly carry no content payload and are
   unchanged. **The sweep for the shape** — an assertion claiming exact bytes while checking a
   hash — found nothing further: the core's `watch_engine.rs` already compares
   `snapshot.source` wherever it claims exact text, and its remaining "hash of the exact
   bytes" messages describe hash comparisons truthfully (one of them over `revision_of`, which
   exposes no payload to compare).

**The name-position pass was run as its own sweep**, written from what the fixed code now says
(join routed by thread id; payload bytes compared, not hashed): it rewrote `watch.rs`'s opening
paragraph and its "# Epochs" section, the `WatcherLifecycle`/`shut_down`/`Drop` docs, the
`ObservationSink` contract, `commands.rs`'s `Open` doc, `Open.watcher` field doc and both
join paragraphs of `open`'s doc plus its call-site comment, the ordinary reopen test's doc
sentence (now scoped to an ordinary reopen), this record's §§1, 2.1, 2.2, 2.10, §3's matrix and
replacement rows, and §5 items 4 and 5. The reopen test's *name* survives unchanged because the
shape it drives — an ordinary, test-thread reopen — still gets exactly what the name says.
`main.rs`'s crate-doc sentence ("cancelled and joined on successful replacement") survives
because it names no thread and no return-ordering. No text in the review file was edited;
this section is the record's answer to it.

The gates after this fix round are §4's fifth column — workspace 1222/0 twice on that tree,
the focused seventeen at 17/17 twice serially, clippy and fmt clean, the core still Tauri-free —
and the +2 test delta is accounted for above.

### The round-3 review and its closure

Round 3 (`docs/reviews/phase-2d-2-lifecycle.md`, "## Round 3") confirmed round 2's finding 2
closed and finding 1 closed as to self-join routing, and answered NOT READY on one High: the
**serial reaper**. It is closed; the closure was checked back against the code after fixing.

1. **High — one non-returning sink callback blocked the process-global serial reaper.** Round
   2's reaper read one `Reap` at a time and performed a blocking `JoinHandle::join()` before
   reading the next, so a worker permanently parked in its sink callback held the reaper in
   that join forever: successor workers that exited cleanly behind it were never joined, their
   `joined` flags never stored — the completion handshake defeated — and repeated
   callback-initiated generations grew the queued handle set without bound. The thread-id
   routing itself was and is correct, and is untouched. **Closed by making the reaper join in
   exit order, never hand-over order** (`reap_forever` in `src-tauri/src/watch.rs`): the
   reaper holds every handed handle, sweeps them with `JoinHandle::is_finished()`, joins
   exactly the workers that have already exited — a finished handle's join returns promptly —
   and stores each `joined` flag only after that worker's own join returned, keeping the
   handshake honest. While it holds no handle it blocks on its channel and costs no wakeups;
   while it holds any it parks `REAPER_SCAN_MS` (50 ms) between sweeps, so a worker that
   exits is joined within about one interval, whatever was handed over before it. **The
   bounded policy for a permanently unfinished worker is explicit**: its handle simply stays
   held — one `Reap` (a `JoinHandle` and a flag) of memory per permanently stuck worker, for
   the life of the process, blocking no other worker's join — and the held set grows with
   nothing else, because every worker that does exit is joined and released by the next
   sweep. **This shape was chosen over one detached joiner thread per handle deliberately**:
   the held-handle reaper keeps the single process-lifetime thread every existing doc, note
   and teardown test already leans on, and bounds a stuck worker's cost to one `Reap` of
   memory, where a joiner-per-handle design pays a thread spawn that can fail on every
   teardown and pins a whole OS thread per stuck worker. **Pinned by the commissioned test**,
   `a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it` (§3's new
   row): the first teardown's worker parks in its callback strictly after its own reap is
   handed over, a second last-owner teardown's worker exits behind it, and the second
   worker's handshake must complete while the first is still parked — no hand-over-order
   release can produce that, because the stuck reap is queued first; the parked probe must
   still read incomplete at that moment, and after the release the stuck worker's own reap
   must complete, which is the held-handle policy observed and the suite exiting cleanly.
   Both trees hold only `match/`, per the two round-2 teardown tests' technique, so no
   FSEvents delivery decides a verdict and every wait is bounded. Run against the serial
   hand-over-order shape and **failed** (127.6 s: the park's own PATIENCE bound eventually
   released the worker, the serial reaper then joined in hand-over order — the parked worker
   first — and the assertion that the parked worker had not been joined while its successor's
   handshake completed is what failed); passes in ~9 s with the fix. **The record was
   rewritten to claim only what the code gives**: §2.1's reaper sentences, §5 item 12 (whose
   "delays" understated a starvation to a delay), §1's two bullets, §2.10 and §3's table —
   and the round-2 closure's reaper sentence carries a correction block above rather than a
   silent rewrite, because §6 is closure history.

**The shape sweep** — one blocked item starving a set queued behind it: a channel drained
serially while holding something, or any other blocking join in a loop — found no further
instance. The only `JoinHandle` joins outside tests are the reaper's sweep join, now gated by
`is_finished()`, and `WatcherLifecycle::Drop`'s in-place join, which blocks one dropping
thread on one worker deliberately — that is the join-before-return guarantee — with nothing
queued behind it. `menu.rs`'s `on_main_thread` blocks on a one-shot channel for its own
closure's answer, nothing behind it, with a documented no-deadlock argument. The worker's own
inbox is drained serially by the worker that owns it: a sink callback that never returns
parks that one worker and lets that one per-worker channel grow with that tree's events — the
stated `ObservationSink` contract, no cross-worker set behind it, and the production
`discarding_sink` never blocks. Test-side, `within()` in the core's `persist/write.rs`
abandons its thread rather than joining it, by its own stated design, and the deadlock test
joins one opener thread whose completion is the test's own verdict.

**The name-position pass was run as its own sweep**, written from what the fixed code now says
(exit order, never hand-over order; a held handle per stuck worker): it rewrote
`hand_to_reaper`'s doc — "Reaps are joined serially, and that is enough" was the finding's own
sentence and is gone — added `reap_forever`'s and `REAPER_SCAN_MS`'s docs stating the order
and the held-handle policy, and updated `watch_check.rs`'s module doc and `match_only_tree`'s
doc (the "two teardown tests" sentences now count three). `WatcherLifecycle`'s, `shut_down`'s,
`Drop`'s, `JoinProbe`'s, the `joined` field's and `commands.rs`'s reaper sentences survive
unchanged because each says only that the join is the reaper's and the flag stores after that
join returns — true in exit order exactly as it was claimed before — and `main.rs`'s
crate-doc sentence names no thread and no ordering, exactly as round 2 recorded. In this
record, §2.1, §5 item 12, §1, §2.10 and §3 now state the exit-order guarantee, and the
unconditional "the join completes after that exit" shape survives nowhere: `rg` over "after
that exit", "serial", and "hand-over" across `src-tauri/src`, the core's `watch/` directory
and this file finds the new text stating the order, this section and the correction block
quoting history, the gate table's "twice, serially" run descriptions, and the pre-existing
"serialized process-wide" FSEvents-daemon sentences — none of them an unconditional
reaper-join claim. No text in the review file was edited; this section is the record's
answer to round 3.

The gates after this fix round are §4's last column — workspace 1223/0 (26 `test result`
lines), the focused eighteen at 18/18 twice serially (62.4 s and 54.5 s), clippy and fmt
clean, the core untouched this round and still Tauri-free — and the +1 test delta
(1223 = 1222 + 1) is the reaper exit-order check, accounted in §4.

> **Correction (round 4).** This closure's headline — "making the reaper join in exit order,
> never hand-over order" — and everything downstream of it claimed a chronological guarantee
> the swept implementation does not give. `reap_forever` retains `Reap`s in hand-over order
> and each sweep iterates that vector in that order; `JoinHandle::is_finished()` reports only
> whether a worker is finished at the instant inspected, never when it exited — so two handed
> workers that both exit between the same two sweeps are joined in hand-over order within
> their sweep, whichever exited first. What the reaper actually gives is narrower and is what
> the starvation fix needed: **each sweep joins every handle it observes finished, without
> blocking on unfinished handles and irrespective of earlier handoffs.** The commissioned test
> proves exactly that narrower property and never proved the chronological one. The
> name-position-pass paragraph above — "§2.1, §5 item 12, §1, §2.10 and §3 now state the
> exit-order guarantee" — recorded the propagation of the false ruling as if it were the
> sweep's success, its gates paragraph named the test "the reaper exit-order check", and the
> round-3 correction block under the round-2 closure carries the same defect in its phrase
> "the exit-order reaper". Round 4 found it (its one High); this closure and that block are
> left as written, and the round-4 closure below, with §1, §2.1, §2.10, §4 and §5 item 12,
> carries the exact property. No code behavior was wrong: the starvation closure, the bounded
> held-handle policy and the completion handshake stand as verified above.

### The round-4 review and its closure

Round 4 (`docs/reviews/phase-2d-2-lifecycle.md`, "## Round 4") verified the round-3
starvation mechanism closed — a `Reap` taken into exactly one sweep, an unfinished handle
returned to `pending`, a finished one joined once with its flag stored only after that join,
the timed receive, the disconnection arm, the bounded held-handle policy, and the
commissioned test genuinely rejecting the old hand-over-order blocking join — and answered
NOT READY on one High: the wording. It is closed; the closure was checked back against the
code after fixing.

1. **High — the code and record promised chronological "exit-order" joining the sweep cannot
   give.** `reap_forever` retains `Reap`s in hand-over order and each sweep iterates that
   vector in that order; `JoinHandle::is_finished()` reports only whether a worker is
   finished at the instant inspected, never when it exited — so when two handed workers both
   exit between sweeps, the loop joins whichever was handed over first, even when the other
   exited first. "Joins workers in the order they exit, never in the order they were handed
   over" was therefore a guarantee the implementation does not give — this project's worst
   defect class, in name positions throughout the module — and the commissioned test cannot
   prove it: it proves the narrower property that a still-unfinished earlier handoff cannot
   block a finished later handoff. **Closed by rewriting every such position to the exact
   property the code gives** — *each sweep joins every handle it observes finished, without
   blocking on unfinished handles and irrespective of earlier handoffs* — with the non-claim
   stated beside it where the guarantee is load-bearing (`reap_forever`'s doc and §2.1: no
   chronological ordering among the workers one sweep meets finished is claimed; within one
   sweep they are joined in hand-over order). **No exit-order mechanism was added**, because
   nothing needs chronological order — the honest wording is the whole fix, so no code
   behavior changed and no test changed. The rewritten positions: `hand_to_reaper`'s and
   `reap_forever`'s docs and the sweep's inline comment in `watch.rs`; the commissioned
   test's doc headline, the module doc's "reaper-order test" name and the exiting-callback
   comment in `watch_check.rs`; and this record's §1 (both reaper bullets), §2.1, §2.10 and
   §4 (the test's name), and §5 item 12 — with the round-4 correction block above appended
   to the round-3 closure rather than any silent rewrite, because §6 is closure history.
   **The test's name survives unchanged deliberately**:
   `a_parked_worker_does_not_block_the_reap_of_a_worker_that_exited_behind_it` states
   exactly the narrower property the test proves — the parked worker never exits, so the
   name orders a finished handoff against a permanently unfinished one and claims nothing
   about two exited workers' relative order.

**The name-position and prose sweeps were run as their own passes**, written from what the
code now says (finished handles joined per sweep; no chronological claim): `rg` over
"exit order", "order they exit", "as they exit", "order they finish", "oldest", "chronolog",
"exited first" / "exits first" and the joins/order shapes across `watch.rs`,
`watch_check.rs`, `commands.rs`, `main.rs` and this record finds, outside §6's quoted
history and the correction blocks, only true sentences: the historical descriptions of the
round-3 defect ("joined serially in hand-over order, and one such worker blocked every join
handed over behind it" — the rejected shape, described truthfully), §3's "no hand-over-order
release can produce that" (a claim about the test's construction, not the reaper),
`commands.rs`'s "epochs install in the order they are allocated" (the allocator under the
session lock — a different mechanism, and true), and `main.rs`'s crate-doc sentence, which
names no ordering, exactly as rounds 2 and 3 recorded. "Whatever was handed over before it"
survives wherever it stands because it states the starvation property, not an order. No text
in the review file was edited; this section is the record's answer to round 4.

The gates after this fix round are §4's round-4 column — workspace 1223/0 (exit 0; the sum
of the run's own 26 `test result` lines), the focused eighteen at 18/18 twice serially
(60.1 s and 54.1 s), clippy and fmt clean, the core untouched this round and still
Tauri-free. A wording-only round, so the test delta is zero — re-measured on the final tree,
not assumed. The round-3 closure's "§4's last column" sentence above predates this column
and denotes the round-3 column; it is left as written, like everything else in this
section's history.

One further observation from this round's gate-taking is recorded because it was measured:
before the quiet-host runs above, a full `cargo test --workspace` run taken with the host
under other load exited 101, its bin target at 320.8 s, with ten `watch_check` tests failed
— every failure a bounded-wait `PATIENCE` timeout at `watch_check.rs:128` (the eight matrix
cells, the failed-reopen check and the parked-worker check). The identical tree then passed
1223/0 and 18/18 twice with nothing else running. That is consistent with §2.9's measured
per-stream establishment cost being paid by every concurrently running session, and it makes
the gate's precondition explicit rather than hoped about: these suites are evidence on a
quiet host, and a host concurrently establishing other FSEvents streams is not one.

### Round 5 — READY, and the review is closed

Round 5 (`docs/reviews/phase-2d-2-lifecycle.md`, "## Round 5") verified the round-4 wording
closure with no findings and ruled **READY**, closing the phase review at five rounds. It
confirmed the five closures by name: the reaper guarantee now matches the implementation
exactly; every rewritten name and prose position is honest, the kept test name included; §6
preserves and corrects history rather than rewriting it; the gate and contention records
match the measurements without claiming causation; and no behavior or scope expansion is
present — the executable `reap_forever` body is the same swept loop round 4 reviewed, and the
round-4 fix sites are documentation and comments only. The frontend gates were then re-derived
on this closure tree, unchanged as this step's boundary requires: 431 `svelte-check` files,
2125 tests, 184 build modules, bundle oracle server-only tokens absent and client-only
present (2) — measured, not carried.
