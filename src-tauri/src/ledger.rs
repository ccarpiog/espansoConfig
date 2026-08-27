//! The app-write ledger and the observation admission gate — Phase 2d-3.
//!
//! `espansoconfig_core::watch` owns what a filesystem observation *means* and
//! `crate::watch` owns the lifetime of the worker that produces one. This
//! module owns the third thing, and it is a fact about **this application
//! session** rather than about a directory: *which of the bytes now on disk are
//! bytes this application itself committed a moment ago* (the 2d design
//! consult's Q2, and Q7 item 3).
//!
//! # The record, and the one sentence it licenses
//!
//! [`WriteLedger`] holds one [`AppWrite`] per document — `{ workspace_epoch,
//! revision }`, keyed by [`DocumentId`] exactly as the consult specifies — and
//! [`WriteLedger::record_app_write`] is its only producer. `crate::commands`'s
//! `commit_and_record` — the one window `run_one_save` runs its transaction
//! in — calls it for `Ok(SavedDocument { committed: true, .. })` and for
//! nothing else. The predicate it feeds is the core's one definition,
//! [`espansoconfig_core::watch::self_write_suppresses`], and the truthful
//! sentence is the consult's, verbatim:
//!
//! > **This application ignores a filesystem hint when the bytes now on disk
//! > hash to the latest revision it recorded after committing that file; this
//! > proves the text is identical, not who wrote it.**
//!
//! An external process rewriting byte-identical content is indistinguishable by
//! this predicate, and ignoring it is acceptable because the file text — the
//! source of truth — did not change. **Nothing built on this module may claim
//! that the ignored event "was ours", that no external write occurred, or that
//! metadata stayed unchanged**, and hash equality proves byte identity only
//! subject to the hash's collision limit.
//!
//! # The commit gate: a commit and its record are one window
//!
//! A record taken *after* the rename it describes is a record with a hole in
//! it. `espansoconfig_core::persist::save_document` performs the rename before
//! it returns, and the watcher's worker thread enters [`WriteLedger::admit`]
//! under no session lock at all — so with the state mutex alone, a save could
//! rename to revision A, be descheduled, and have its own bytes admitted as an
//! **external** change before it ever recorded A. Suppression would already
//! have failed, and the mirror interleaving would leave a stale A record behind
//! an external admission. That was this step's round-1 High.
//!
//! [`WriteLedger`] therefore holds a second mutex, the **commit gate**, and it
//! is not the state mutex:
//!
//! - `crate::commands`'s `commit_and_record` takes it with
//!   [`WriteLedger::begin_commit`] **before** calling `save_document` and holds
//!   it until **after** [`WriteLedger::record_app_write`] — or after the
//!   exhaustive `committed_revision` decided there was nothing to record, since
//!   the guard is an RAII value dropped by the block's end and not a call some
//!   arm can miss;
//! - [`WriteLedger::admit`], [`WriteLedger::mark_under_the_session_lock`],
//!   [`WriteLedger::withhold_under_the_session_lock`] and
//!   [`WriteLedger::begin_epoch`] take it briefly before touching the state.
//!
//! The lock order is therefore always **session → gate → state**, never the
//! reverse: the worker takes gate → state with no session lock at any point,
//! and the two callers that hold the session lock (a save, and
//! `WorkspaceSession::open`) take the gate below it. It is deadlock-free
//! against all four shapes 2d-2 left live — `WorkspaceSession::open`'s
//! cancel-and-join, [`crate::watch::WatcherLifecycle`]'s same-thread `Drop`
//! routed to the reaper, a save in flight under the session lock, and a
//! downstream sink re-entering the session — and the argument is one sentence:
//! **nothing that holds a ledger lock ever waits for the session lock.** Not
//! `record_app_write`, not either `admit`, not `begin_epoch`, and not
//! `save_document`, which is the one thing that runs under the gate. So a
//! thread waiting for a ledger lock is waiting for a holder that will get there
//! on its own, whatever else the waiter is holding.
//! `record_app_write` takes a `&`[`CommitGate`], so *a record
//! is taken inside a commit window* is a property of the signature. **What the
//! type does not force**, in the same sentence as what it does: that the gate
//! belongs to *this* ledger, and that it was taken before `save_document`
//! rather than after it. Both are kept by `commit_and_record` being one
//! function with one caller, and by this paragraph.
//!
//! **No caller-supplied code runs while either lock is held.** Under the state
//! mutex there is no closure and no callback, and the only call that leaves this
//! module is [`Instant::now`], taken by [`WriteLedger::record_app_write`] on the
//! line that inserts a record — a clock read that takes no lock of this
//! process's, can block on nothing a caller controls, and is named here rather
//! than covered by an *"and no I/O at all"* that stopped being exactly true when
//! the stamp arrived. Under the gate
//! there is exactly one thing, `save_document`, whose [`SaveRequest`]
//! carries no closure and which cannot reach this module: it writes through
//! `crate::persist`'s own per-path registry, which excludes only this process's
//! cooperating callers, so the window the gate holds is one save's own I/O and
//! never an unbounded wait on another process.
//!
//! [`SaveRequest`]: espansoconfig_core::persist::SaveRequest
//!
//! # The stamp: a gate cannot reach a read that already happened
//!
//! The commit gate makes a commit and its record one window **no decision can
//! cross**. It cannot make them one window no *read* can cross, because an
//! observation's reads happen in the engine, one debounce plus one probe before
//! the gate ever sees it. That gap was this step's round-2 High: disk holds P,
//! the engine completes both stabilizing reads and constructs the observation,
//! a save then takes the gate, commits A, records A and releases — and P, which
//! has been parked at the gate all along, decides that P is not A, **clears A's
//! record** and publishes P. The save's own hints of A then find no record and
//! are admitted as **foreign**: this application reporting its own committed
//! write as somebody else's, which the consult's Q8 calls the sharpest failure
//! mode there is.
//!
//! Every **watcher** observation therefore carries
//! [`crate::watch::EpochObservation`]'s
//! `read_after`: an [`Instant`] taken **before** the reads that produced it,
//! and [`WriteLedger::record_app_write`] takes one **after** the rename
//! `save_document` performed — the path's [`CommitAnchor`]. Comparing the two is
//! the whole rule for a reading
//! this session cannot otherwise place — and *cannot otherwise place* is the
//! condition, not a universal: the save path's own two refreshes prove the same
//! ordering by construction and carry no stamp at all, which is the *two proofs*
//! section below. **The
//! accepted condition is the strict one — `read_after > anchor` — and
//! equality is refused**, which was this step's round-3 second High: `Instant`
//! is documented monotonic and *not* documented strictly increasing, so two
//! ordered calls may answer the same value and equality orders nothing.
//!
//! The implication the accepted condition carries, in one direction only, and
//! in two steps because the two steps are about different things:
//!
//! > **On the values:** `read_after > anchor`.
//! >
//! > **On real time:** a monotonic, nondecreasing clock cannot answer a
//! > *strictly greater* value to a call made earlier, so the `Instant::now()`
//! > that produced `read_after` was made at or after the one that produced the
//! > anchor. With the stamp taken before its reads and the anchor taken
//! > after its rename, that gives `read >= stamp >= anchor >= rename`: the read
//! > observed the disk at or after the commit landed, so what it read is a state
//! > that commit did not undo.
//!
//! Neither step needs a filesystem chronology or an inference from hashes: the
//! two events being ordered are **this session's own**, one read it performed
//! and one write it performed. At equality the second step collapses — the read
//! may have preceded the rename — which is why equality is on the refusing side
//! of the comparison and not on the accepting one.
//!
//! An observation that cannot make that claim is [`Admission::PrecedesACommit`]
//! and is **discarded**, mutating nothing but the tally — exactly like
//! [`Admission::StaleEpoch`], and for the same kind of reason: a reading this
//! session cannot place after its own last write to that path may not decide
//! anything about that path. It may not publish, because the bytes it describes
//! are bytes this application has since replaced; and it may not clear any
//! app-write record, because such a record describes a write made **after** this
//! reading was taken, and clearing it is what makes the save's own hints foreign.
//! Neither sentence claims a record describes what is on disk *now* — an external
//! writer may have replaced those bytes too, and the observation that says so
//! will be a later reading with a later stamp. **And neither sentence needs a
//! record to exist at all**, which is round 9's second High: the refusal stands
//! on the anchor, so a commit whose record has since been cleared still refuses a
//! reading older than it. See *the anchor outlives the record* below.
//!
//! **The converse is deliberately not claimed**: `read_after <= anchor`
//! does *not* prove the read preceded the rename, only that this session cannot
//! prove it did not. The stamp is a lower bound on the read, so the check
//! over-refuses across the window between the stamp and the read — microseconds,
//! bounded by one [`crate::watch::EpochObservation`]-producing engine pass.
//!
//! **Over-refusal is not a safe direction by itself, and saying it was is what
//! this step's round-3 first High corrected.** A refused observation is not
//! merely delayed: `espansoconfig_core::watch::engine::ObservationEngine::tick`
//! has already installed the state it describes as the engine's tracked one, so
//! the same bytes re-read afterwards stabilize to the tracked state and coalesce
//! **inside the engine**, emitting nothing — and a genuine external change
//! refused once would never be reported again, with native delivery working
//! perfectly. What makes the direction safe is that this arm is **answered**
//! rather than swallowed, and that is a fact about this module's own wiring:
//! [`admitting_sink`] returns [`crate::watch::ObservationOutcome::Undecided`]
//! for it and `crate::watch::deliver` takes the engine's settlement back
//! (`revert_settlement`). **What that rollback restores, and what it promises
//! about anything arriving afterwards, is
//! [`espansoconfig_core::watch::liveness`]** — the one statement of it in this
//! workspace, which this module points at and never paraphrases. What the
//! recovery depends on is one *engine pass* and never native delivery, and the
//! holes are stated rather than smoothed over
//! (`docs/decisions/2d-3-notes.md` §5 items 13 and 14).
//!
//! # Two proofs of chronology, because one of the two callers needs no stamp
//!
//! This step's **round-4 High**. A stamp is a proof about a reading whose
//! ordering against this session's own writes is otherwise unknown — which is
//! the watcher's worker thread exactly, since it holds no session lock and its
//! reads happen in an engine pass of their own. The save path's two refreshes
//! are not in that position, and treating them as if they were is what the
//! round-4 finding was:
//!
//! - a refusal of a *watcher* observation is **answered** — [`admitting_sink`]
//!   returns [`crate::watch::ObservationOutcome::Undecided`] and
//!   `crate::watch::deliver` calls
//!   `espansoconfig_core::watch::engine::ObservationEngine::revert_settlement`.
//!   That call is the whole of what *answered* names here, and **what it
//!   restores, what it re-owes and what it does not promise is
//!   [`espansoconfig_core::watch::liveness`]**;
//! - a refusal of a *save-path* refresh was answered by nothing. Those two
//!   callers settle nothing in any engine, so there was nothing to take back,
//!   and they run once per save rather than in a loop, so nothing retried them.
//!   A clock-resolution collision between the commit anchor's instant and the
//!   refresh's
//!   — two adjacent [`Instant::now`] calls on one thread — therefore did not
//!   cost *one publication*, as this module and the record both said: it cost
//!   the **external observation itself**, because the native hint that would
//!   otherwise carry that state is not guaranteed to arrive:
//!   `docs/decisions/2d-2-notes.md` §2.3 expressly declines to cover *a backend
//!   that stops delivering without reporting anything*. The consult requires a
//!   disagreeing post-save refresh to be *queued as external*
//!   (`docs/reviews/phase-2d-design.md` Q2), and a lost one is not.
//!
//! What closes it is the second proof, and it is stronger than the stamp rather
//! than a relaxation of it. **A record can only be inserted by a thread holding
//! the session lock**: [`WriteLedger::record_app_write`] is the one producer, its
//! one production caller is `crate::commands::commit_and_record`, that is reached
//! only from `run_one_save`, and every route to `run_one_save` passes through
//! `WorkspaceSession::with_open`, which holds the session mutex across the whole
//! closure. `crate::commands`'s `after_a_save` and `conflict_after_the_lock` run
//! **inside that same closure**, holding that same lock. So every record they can
//! observe was inserted either by this thread earlier in this call, or by a
//! previous holder that released the lock before this one took it — both of which
//! order the record before the refresh's read in program order, with no clock
//! consulted and therefore no resolution to collide. That is what the
//! `…_under_the_session_lock` half of
//! [`WriteLedger::mark_under_the_session_lock`] and
//! [`WriteLedger::withhold_under_the_session_lock`] is named for, and it is why
//! neither entry point takes an `Instant`: there is nothing left for one to
//! prove.
//!
//! **No entry point that brings a reading lets its caller choose.** The mode is
//! the private [`AdmissionDoor`], built by the three deciding methods and by
//! nothing else, so the
//! worker thread cannot ask to skip a check it could not justify skipping and
//! neither save-path caller can ask to spend a sequence — there is no parameter
//! to ask through. **Three, and the fourth entry point added by the round-9 fix
//! round is not a door**:
//! [`WriteLedger::adopt_reloaded_revision_under_the_session_lock`] brings no
//! reading, so there is no decision for a door to steer — it removes what a
//! reload made untrue and answers nothing. **What that does not force**, in the same sentence: that a
//! future caller of either serialized door really holds the session lock.
//! Nothing in the type system carries a lock this module does not own, and a
//! caller that does not hold it silently restores the round-2 High. The two
//! callers and this paragraph are what keep it.
//!
//! **What the types do not force, in the same sentence as what they do.** The
//! parameter is an `Instant` and every `Instant` type-checks: nothing makes a
//! caller take it before its read rather than after, and a stamp taken after the
//! read silently restores the defect. What keeps it is that there is exactly
//! **one** producer of a stamp — `crate::watch::WatchWorker::observe`, one
//! two-line function with one caller, taking the stamp and then running the
//! engine pass — and this paragraph. **Neither save-path caller stamps at all**,
//! since the round-4 fix round: they come through the two serialized doors,
//! neither of which takes an `Instant`, so
//! there is no second producer here to keep honest. Restoring a stamp on that
//! path would restore round 4's High with it — two adjacent clock reads on one
//! thread, into a comparison that accepts only a strictly later value, with
//! nothing to answer the refusal.
//!
//! # A read the save path could not use — or could not prove stable — is
//! re-observed
//!
//! This step's **round-5 High** and its **round-6 second** one, which are the
//! same sentence about two different arms.
//!
//! Round 5's arms are the ones where a save-path caller has **no** reading to
//! bring: `Workspace::refresh` raised, or the transaction's own outcome is an
//! uncertain write that read nothing back. Such a caller must not admit
//! anything — a single failed read proves no state, and publishing an `Absent`
//! from it would clear the app-write record and make the save's own hints
//! foreign — and until round 5 it therefore did nothing at all, leaving the disk
//! state to a native hint `docs/decisions/2d-2-notes.md` §2.3 expressly declines
//! to guarantee. That is round 4's exposure reached through an `Err`.
//!
//! Round 6's arms are the ones where such a caller **does** hold a reading it
//! acted on and cannot prove stable. `Workspace::refresh` is **one** read where
//! the engine takes two, so a foreign non-atomic write in progress can present a
//! parseable intermediate state that never stably existed.
//!
//! What closes all of them is not in this module and deliberately so: the caller
//! asks the running watcher to observe that path again
//! (`crate::watch::ReObserver::re_observe`), and the state that eventually
//! reaches this ledger is one the engine read **twice**, carrying a stamp, going
//! through [`WriteLedger::admit`] like any other observation. So no third proof
//! of chronology exists: what changed is that a reading nobody could use, or
//! nobody could prove, is **asked** to be followed by one somebody can — asked
//! and not guaranteed. The reasons an ask may go unanswered are the *not
//! guaranteed* half of [`espansoconfig_core::watch::liveness`], stated there
//! once rather than here again (and §5 items 19 and 21 of
//! `docs/decisions/2d-3-notes.md` are this step's own record of two of them).
//! **This heading's *re-observed* is the contrast with *published*, and never a
//! promise of arrival** (round 13's first High).
//!
//! # The marker and the publication are two jobs, and one map did both
//!
//! This step's **round-7 High**, and it is the round-6 arms above finished. Until
//! round 7 a single save-path read was **published**: it spent a sequence and it
//! entered the coalescing map, and the argument for that was that the stabilized
//! reading asked for beside it arrives at a *later* sequence, which consult Q3
//! makes harmless. **Q3 says no such thing.** Its rule is that a consumer acts
//! only on the highest sequence it has *accepted*, which forbids regressing to an
//! older sequence and obliges nobody to wait for one that does not exist yet — so
//! a drain landing between the phantom and its correction accepts the phantom,
//! and a person confirming a reload against it loses a draft no later sequence
//! can give back.
//!
//! So the two jobs the one map was doing are now two:
//!
//! - **the publication** spends a sequence and reaches the downstream sink, and
//!   [`WriteLedger::admit`] is the only door that performs one. Its readings are
//!   the engine's two equal consecutive reads, which is the consult's *stabilized*
//!   (`docs/reviews/phase-2d-design.md` Q2). **No single unstabilized read can
//!   spend a sequence**, and that is now a property of which methods exist rather
//!   than of what a caller remembers to do;
//! - **the marker** records a state in [`LedgerState::announced`] and spends
//!   nothing. [`WriteLedger::mark_under_the_session_lock`] performs one, for
//!   `crate::commands::conflict_after_the_lock` alone, because consult Q5's rule
//!   — *a save-origin conflict registered by `conflict_after_the_lock` wins over
//!   a native duplicate at the same document/revision … the duplicate is
//!   coalesced* — needs the coalescing entry and needs no sequence. The person
//!   has been shown that state; they have been shown it in the payload.
//!
//! **And a third door records neither**, which is the half no reading of the
//! review asked for and the code requires: `crate::commands::after_a_save`'s
//! disagreeing refresh shows its state to **nobody**, so marking it would make
//! the engine's own later reading of the same state a `Duplicate` and consult
//! Q2's *the differing post-save observation is queued as external* would be met
//! by nothing at all — round 3's swallowed-change defect reached from the other
//! side. [`WriteLedger::withhold_under_the_session_lock`] therefore decides the
//! **record** and nothing else.
//!
//! **What this costs is a watcher-less workspace**, and it is stated at both
//! doors rather than smoothed over: with nothing to ask, a conflict's disk side
//! is announced only in its payload and a disagreeing post-save read is announced
//! nowhere at all (`docs/decisions/2d-3-notes.md` §5 items 3 and 19). What such a
//! workspace got instead, before round 7, was a single read that no second read
//! ever confirmed and that nothing could correct.
//!
//! # Suppression is the stamped door's question, because only a publication can
//! misreport
//!
//! This step's **round-8 High**, and it is the round-7 split finished. Until
//! that round every door was asked every check, which read as symmetry and was
//! really a shared step meaning three different things. Suppression exists for
//! one purpose, stated by consult Q2 in the same breath as the rule itself:
//! *keep a matching entry long enough to absorb the several native
//! notifications one atomic replacement may generate*. A **native
//! notification** arrives through exactly one door — the watcher's stamped
//! one — so on the other two the check has no work to do and only harm to do.
//!
//! **The harm is a stale record, and it needs no race to reach.** The record
//! says *the last revision this application committed for this path*, and
//! before the round-9 fix round nothing outside this ledger kept it describing
//! what the session now believes: `crate::commands::reload_document` accepted a
//! foreign revision into the workspace and touched the ledger not at all, and a
//! save returning `committed: false` records nothing, so the previous entry
//! stands. **Round 9 closed the first of those two routes and not the second**,
//! which is why this section's argument is unchanged rather than superseded: a
//! reload now reports what the workspace accepted (see *a reload accepts a
//! foreign revision* below), while a `committed: false` save still leaves an
//! earlier commit's entry standing, and door-scoping is what makes the check
//! right about *which readings it is for* whatever put the entry there. The two
//! fixes are complementary and neither is the other's alternative. A save tail
//! that then reads exactly those recorded bytes answered `SelfWrite` — retaining
//! the record, announcing nothing, marking nothing — although that tail had
//! independently established that its reading differs from the transaction it
//! just ran. What that cost was **both** halves of round 7's split: the marking
//! door lost the coalescing entry consult Q5 requires, so a native duplicate
//! would raise a second conflict at 2d-5, and the withholding door left the
//! record standing, so the owed stabilized reading it asks for in the same
//! breath met that same record and was suppressed too — consult Q2's *the
//! differing post-save observation is queued as external* met by nothing at all,
//! which is the swallowed change the withholding door exists to prevent, reached
//! through the check above it.
//!
//! **Why the narrowing is safe rather than merely useful.** The mistake
//! suppression prevents is *reporting this application's own write as somebody
//! else's* — the consult's Q8, and reporting is what a **publication** does.
//! Since round 7 neither serialized door publishes, so neither can make that
//! mistake whatever it decides: the marking door announces to the coalescing map
//! alone and the withholding door records nothing. And **where a serialized
//! reading equals the entry it meets, that entry was never taken by the running
//! transaction**: `conflict_after_the_lock` runs where the transaction was
//! refused, which records nothing, and `after_a_save`
//! reaches its door only where the refresh **disagrees** with the revision its
//! transaction last saw, which no record of that transaction can equal. So the
//! entry a `SelfWrite` used to protect on these doors was always an earlier
//! save's, and never the one the running save had just taken.
//!
//! **What it costs, said in the same place**, because clearing a record whose
//! bytes are still on disk gives up two things:
//!
//! - **the suppression of that write's own pending hints.** On the marking door
//!   the marker takes the job over **while it stands**: the state is in
//!   [`LedgerState::announced`], so a hint stabilizing at it answers
//!   [`Admission::Duplicate`] instead of [`Admission::SelfWrite`] — a different
//!   counter, the same silence. What removes a marker is a committed app write
//!   or a differing announcement, and after either the chronology check is what
//!   places an older hint: refused if its reads preceded the newer record, and
//!   otherwise describing a disk somebody wrote those bytes back to. On the
//!   withholding door nothing takes it over, and such a hint is **published**.
//!   That is deliberate, and **it is not over-reporting** — which is what this
//!   paragraph called it until the round-9 fix round, and round 9's second Low.
//!   The withholding door is reached only where the file no longer holds the
//!   revision its transaction last saw, so a real post-read disk transition is
//!   its premise; a later hint at bytes equal to an earlier app write is a
//!   **genuine external change whose bytes happen to equal an earlier app
//!   revision**, and byte equality with something this application once wrote
//!   does not make that transition false. What stays forbidden is unchanged and
//!   is the whole of what suppression ever licensed: **byte identity, never
//!   authorship** — nothing here may claim the write was ours;
//! - **nothing else**, and specifically not the chronology anchor. That bullet
//!   said the opposite until the round-9 fix round, and it was round 9's second
//!   High: see *the anchor outlives the record* below, and [`CommitAnchor`].
//!
//! # A reload accepts a foreign revision, and the ledger is told
//!
//! This step's **round-9 first and third Highs**, which are one root cause:
//! *nothing told the ledger when the workspace accepted a foreign revision.*
//! Two of this ledger's per-path facts describe what the session believes about
//! a file, and both could be left describing a state the session had moved past:
//!
//! - the **app-write record**, whose licence is suppression. A record naming A
//!   met by an external return to A after the workspace had accepted B answered
//!   [`Admission::SelfWrite`] at the one door still allowed to suppress, and that
//!   B→A change never entered the sequence;
//! - the **announced state**, which answers *does a consumer already have this*.
//!   An entry naming B met by an external return to B after the workspace had
//!   accepted C answered [`Admission::Duplicate`] — round 3's swallowed change
//!   reached through coalescing rather than through suppression. **Leaving that
//!   to 2d-5's per-document accepted sequence cannot work**, which is the
//!   argument that decided it: a `Duplicate` sends that layer no value to
//!   arbitrate.
//!
//! `crate::commands::reload_document` is the **only** command that can *leave*
//! either of those describing a state the session has moved past, and that was
//! established rather than assumed. `rg '\.refresh\('` over this crate finds
//! exactly three `Workspace::refresh` call sites: `WorkspaceSession::reload`, and
//! the two save tails, which have told this ledger through doors of their own
//! since round 7. Every other read path — `WorkspaceSession::document` and
//! `text` — is served from the parse cache (`Workspace::document_view`,
//! `Workspace::document_text`) and installs nothing. So the fix
//! is one call at that one command —
//! [`WriteLedger::adopt_reloaded_revision_under_the_session_lock`] — taken under
//! the session lock the command already holds, and it invalidates each of the two
//! **only where it differs**.
//!
//! **The *differs* condition is the whole safety of it.** Clearing a record whose
//! bytes the reload just read would unsuppress that write's own pending native
//! hints with nothing announced to absorb them, and this application would report
//! its own commit as somebody else's. Clearing an announced state the reload just
//! confirmed would take consult Q5's coalescing entry away from the person who
//! chose *Reload disk version* on a save conflict, so the native duplicate Q5
//! rules is coalesced would become a second conflict.
//!
//! **This is not a seventh door and not a writer.** It brings no reading, takes
//! no [`AdmissionDoor`], answers no [`Admission`], spends no sequence, moves no
//! tally and announces nothing; it removes two entries, and only where they have
//! stopped being true of the path.
//!
//! # The anchor outlives the record, because they answer different questions
//!
//! This step's **round-9 second High**, and it is the price the round-8 clearing
//! extension turned out to carry. Until round 9 the instant a record was taken
//! was a **field of that record**, so every clearing took the chronology anchor
//! with it — supersession, and since round 8 a serialized reading of the recorded
//! bytes too. A settlement produced *before* a commit and delivered *after* the
//! clearing then found no instant to be compared against, was admitted, and
//! published bytes the commit had since replaced.
//!
//! **Nothing bounds that delay.** Only the settlement's *production* is
//! pre-commit; its delivery waits on thread scheduling and on the commit gate,
//! and neither places any bound on it. The record used to say the exposure was
//! one debounce plus one probe wide, and that was false.
//!
//! So the instant lives in [`LedgerState::latest_commit_at`], keyed by **path**,
//! and the two lifetimes are one clause of
//! [`espansoconfig_core::watch::retained_state`] — its ninth — rather than a
//! rule this module states twice. What belongs here is which value carries
//! which: the **record** is [`LedgerState::writes`], whose entry lives as long
//! as its suppression licence, and the **anchor** is
//! [`LedgerState::latest_commit_at`], whose **per-path slot** the epoch keeps
//! while a later commit to that path **replaces the value in it**. This
//! paragraph said *whose life is the epoch* until Phase 2d-4a-C's round 1,
//! which is one lifetime asserted for a value, a slot and a fact that do not
//! share one; the contract's clause 9 is where the three are separated.
//!
//! **The record's second end is *a reading that survives both retaining
//! checks*, and this paragraph said *a serialized reading* until Phase
//! 2d-4a-C.** That was narrower than [`decide`], which reaches its clearing step
//! for every reading that neither fails the chronology check nor is suppressed
//! as a self-write — every serialized reading, and also **every stamped reading
//! whose state the record does not name**, which is the ordinary external change
//! to a file this application had written. [`decide`]'s own documentation has
//! said so since the round-8 fix round (*"narrowing step 2 sends more readings
//! through step 3, which clears"*); this list did not.
//!
//! The anchor is written by [`WriteLedger::record_app_write`] under the same
//! state guard as the record, so **no decision can interleave with that
//! insertion and observe a half-written pair** — the guard proves that, and
//! nothing wider. It does **not** say the two are always seen together: the
//! decision reads them through a helper each, and every path below the two
//! retaining checks clears the record while leaving the anchor standing, so
//! **a decision seeing an anchor with no record is what this whole section is
//! for**. This paragraph asserted the wider co-existence until Phase
//! 2d-4a-C's round 2 — one sentence above the *keyed by path* paragraph that
//! refutes it, which is the third round running that this file has held its
//! own refutation.
//!
//! Keyed by path rather than by [`DocumentId`] because [`decide`]'s step 3
//! removes the `documents_by_path` entry a path-to-record lookup goes through: an
//! anchor behind that index would become unreachable at exactly the moment it has
//! to keep answering. And **widening the refusal is safe in the direction that
//! matters**: a refusal at the stamped door is *answered* — [`admitting_sink`]
//! returns [`crate::watch::ObservationOutcome::Undecided`] and the engine's
//! settlement is taken back, on the terms
//! [`espansoconfig_core::watch::liveness`] states and this module does not
//! repeat — and *if* another
//! settlement for that path is produced, its stamp is taken after the anchor
//! **in program order only**, which makes one refusal per commit the usual
//! outcome and not a guaranteed one, because [`std::time::Instant`] is monotonic
//! and expressly not guaranteed strictly increasing while [`decide`] puts
//! equality on the refusing side, so the same anchor can refuse successive
//! re-readings until one stamp *strictly* exceeds it and nothing in the type
//! system forces the two clock reads apart.
//!
//! **What the host clock advancing bounds is narrower than the retry, and
//! saying it bounded the retry is round 13's first High.** It bounds the run of
//! *repeated chronology refusals* once another settlement for that path is
//! produced — and **nothing here makes one be produced**, so the clock may
//! advance indefinitely with the retry never completing. Why no settlement is
//! promised is the *not guaranteed* half of
//! [`espansoconfig_core::watch::liveness`], which is where this workspace states
//! it; the three enumerations that used to stand in this paragraph were review
//! findings twice over. **The safe direction is the half that holds without any
//! of it**: a refusal here mutates nothing but the tally, publishes nothing and
//! clears no record, so it is never a state reported wrongly and never a record
//! cleared by a reading older than the commit — whatever does or does not arrive
//! afterwards.
//!
//! # The gate is a leaf, and that is load-bearing
//!
//! [`admitting_sink`] wraps the downstream sink: it takes one decision under
//! this module's mutexes, **drops both guards**, and only then calls the sink
//! it wraps. They therefore run no caller-supplied code, exactly as
//! `crate::watch::WorkspaceEpochs`'s does, so they cannot participate in a lock
//! cycle — and the worker thread that calls the gate never touches the session
//! mutex at all. A downstream sink is free to call back into the session *and*
//! into this ledger; `the_downstream_sink_runs_outside_the_ledger_lock` is that
//! as a bounded test rather than as a claim.
//!
//! # What this module is not
//!
//! **No wire.** An [`Admission::Admitted`] carries a sequence and reaches a
//! downstream sink, and since Phase 2d-4a that sink is
//! `crate::reconciliation::queueing_sink`: the queue, the wake event and
//! `drain_external_changes` are that step's (consult Q3), and nothing about
//! them is decided here. What this module owns is which observations reach that
//! sink at all and what number each one carries; **the sequence is spent here
//! and read there**, and what it *does* inside this module is make the next
//! hint at the same state a duplicate.

use std::collections::BTreeMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Instant;

use espansoconfig_core::watch::engine::Observation;
use espansoconfig_core::watch::self_write_suppresses;
use espansoconfig_core::{ContentRevision, DocumentId};

use crate::watch::{EpochObservation, ObservationOutcome, ObservationSink, NO_EPOCH};

/// The first sequence an epoch numbers its admitted observations from.
///
/// One rather than zero, so a zero read anywhere downstream can only mean
/// *unset* — the same convention [`crate::watch::FIRST_WORKSPACE_EPOCH`]
/// follows, and for the same reason.
pub const FIRST_OBSERVATION_SEQUENCE: u64 = 1;

/// The stabilized state one observation asserts about one path.
///
/// Three states rather than an `Option<ContentRevision>`, because absence and
/// unreadability are states the engine reports and coalesces on, not missing
/// content: a removal that repeats is a duplicate of the removal, and a
/// recreation after one is a **second** observation even at identical bytes
/// (consult Q3). Comparing this value is the whole of the coalescing rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ObservedState {
    /// The path stably holds bytes hashing to this revision.
    Content(ContentRevision),
    /// The path is stably gone.
    Absent,
    /// The path stably fails to read, with this failure kind read twice.
    Unreadable(io::ErrorKind),
}

/// What one observation asserts about its path — see [`ObservedState`].
pub fn observed_state(observation: &Observation) -> ObservedState {
    match observation {
        Observation::Changed { content, .. } | Observation::Added { content, .. } => {
            ObservedState::Content(content.revision())
        }
        Observation::Removed { .. } => ObservedState::Absent,
        Observation::Unreadable { kind, .. } => ObservedState::Unreadable(*kind),
    }
} // End of function observed_state()

/// The path one observation is about, whatever its kind.
///
/// A delegation to [`Observation::path`] since the round-3 fix round, not a
/// second implementation: `crate::watch::deliver` needs the same answer to take
/// a refused settlement back, and *which path an observation names* is one rule
/// wherever it is asked.
pub fn observed_path(observation: &Observation) -> &Path {
    observation.path()
}

/// What the ledger decided about one observation.
///
/// Returned rather than acted on, because the ledger's mutex must never run
/// caller code: [`admitting_sink`] takes this answer, drops the guard, and only
/// then calls the sink it wraps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Admission {
    /// Discarded: the observation carries a workspace epoch this session has
    /// already replaced, so nothing about it may name a document — the fence
    /// `docs/decisions/2d-2-notes.md` §5 item 5 left without a reader.
    StaleEpoch,
    /// Discarded: this observation's reads cannot be placed at or after the
    /// latest write this application committed to that path, so it may not be
    /// taken as a statement about what the file holds now.
    ///
    /// The round-2 High, and the residue the commit gate alone could not
    /// reach — see this module's *stamp* section for the implication it turns
    /// on and for the direction it deliberately over-refuses in. Like
    /// [`Admission::StaleEpoch`] it mutates nothing but the tally: it publishes
    /// nothing, and it **retains** any app-write record for the path, because
    /// such a record describes a write made after this reading was taken, and
    /// clearing it is what makes that write's own hints foreign. Neither half
    /// claims a record describes what the file holds *now* — see the *stamp*
    /// section for what is and is not claimed.
    ///
    /// **It does not need a record to exist**, since the round-9 fix round: the
    /// value it is refused by is the path's [`CommitAnchor`], and the path holds
    /// one until the epoch is replaced — no clearing of the record touches it,
    /// and a later commit to that path replaces its value rather than emptying
    /// the slot. So a commit whose record has since been cleared still refuses a
    /// reading older than it. Before that round the anchor was a field of the
    /// record, and clearing one cleared the other — round 9's second High.
    ///
    /// **It is the one arm a producer must answer**, and the round-3 fix round
    /// is why: it says *this reading decided nothing*, so the state it described
    /// is still unreported while the engine that produced it has already
    /// recorded that state as tracked. [`admitting_sink`] therefore maps this
    /// arm — and only this arm — to
    /// [`crate::watch::ObservationOutcome::Undecided`], which takes the
    /// settlement back; **what the rollback restores and what it does not
    /// promise is [`espansoconfig_core::watch::liveness`]**. **A refusal whose
    /// answer re-reading cannot change must not join it**: reverting one of
    /// those would spin the pipeline over the same path forever.
    ///
    /// **Only [`WriteLedger::admit`] can answer it**, since the round-4 fix
    /// round. A save-path refresh has no settlement to take back and no loop to
    /// retry it, so a refusal there was a lost external observation rather than
    /// a delayed one; the two serialized doors prove the
    /// ordering by construction instead of by a clock, and never reach this
    /// arm. See this module's *two proofs* section.
    PrecedesACommit,
    /// Suppressed: the bytes hash to the latest revision this application
    /// recorded after committing that file. **Byte identity, never
    /// authorship** — see this module's own documentation for the exact
    /// sentence this licenses and the three it forbids. The record is retained,
    /// so the several native hints one atomic replacement generates are all
    /// suppressed by the same entry. It is one of the **two** decisions that
    /// retain one — [`Admission::PrecedesACommit`] is the other, and it was
    /// added by the round-2 fix round — and the only one of those two that
    /// makes a claim about the bytes: see [`decide`].
    ///
    /// **Only [`WriteLedger::admit`] can answer it**, since the round-8 fix
    /// round, and for the same shape of reason [`Admission::PrecedesACommit`]
    /// is that door's alone: the several hints this arm exists to absorb are
    /// native ones, and a native hint has exactly one door. A serialized
    /// save-tail reading of the recorded bytes is not one of them, and
    /// answering `SelfWrite` to it withheld the marker consult Q5 needs and
    /// kept a record that then suppressed the owed stabilized reading. See this
    /// module's *suppression is the stamped door's* section.
    SelfWrite,
    /// Coalesced: this path's last announced state is already exactly this
    /// state, so a consumer that acted on the earlier one has nothing new to act
    /// on.
    ///
    /// **Announced, since the round-7 fix round, means one of two things**: a
    /// state a publication spent a sequence on, or a state
    /// [`Admission::Marked`] recorded because the person is being shown it as
    /// the disk side of a save conflict. Both answer the question coalescing
    /// asks — *does a consumer already have this state* — and that is why they
    /// are one map (see [`LedgerState::announced`]).
    ///
    /// Any app-write record for that path is **cleared** on the way here, like
    /// every arm below the retaining checks — which for a *stamped* reading
    /// means its reads are placed after this application's last commit at that
    /// path and the bytes are not the ones it committed there, and for a
    /// serialized one means [`decide`]'s step 3 second bullet.
    Duplicate,
    /// Refused: this epoch has spent every sequence `u64` can carry. Terminal
    /// until the next workspace open, because an observation that cannot be
    /// given a distinct sequence must not be published — the same policy
    /// `crate::watch::EpochSpaceExhausted` takes for epochs, and unreachable in
    /// any physical execution for the same reason.
    ///
    /// **Only a publishing door can answer it**, since the round-7 fix round:
    /// the other two spend no sequence, so there is no space for them to
    /// exhaust.
    SequenceSpaceExhausted,
    /// Admitted, and numbered.
    ///
    /// **The one decision that spends a sequence, and since the round-7 fix
    /// round only [`WriteLedger::admit`] can answer it** — the stamped door,
    /// whose readings are the engine's two equal consecutive reads. That is what
    /// makes *no single unstabilized read enters the observation sequence* a
    /// property of the doors rather than of a caller's discipline; see this
    /// module's *the marker and the publication* section.
    Admitted {
        /// This observation's sequence: unique and strictly increasing within
        /// its workspace epoch, and meaningless across epochs —
        /// [`espansoconfig_core::watch::retained_state`]'s clause 3, of which
        /// this field is the source.
        sequence: u64,
    },
    /// Recorded as this path's coalescing marker and **not published**: no
    /// sequence was spent, no observation was emitted, and nothing downstream
    /// was told.
    ///
    /// [`WriteLedger::mark_under_the_session_lock`]'s answer and no other
    /// door's, and this step's **round-7 High**. `crate::commands`'s
    /// `conflict_after_the_lock` reads the disk once to build the conflict
    /// payload the person is shown; one read is not stability, so that reading
    /// may not enter the sequence — but the person *has* been shown it, so
    /// consult Q5's rule that a native duplicate at the same document and
    /// revision is coalesced rather than raised as a second conflict needs the
    /// state to be in the coalescing map. Marking is exactly that half and no
    /// more.
    ///
    /// Like every arm below the retaining checks it **clears** any app-write
    /// record for the path, and since the round-8 fix round it reaches a record
    /// naming the observed bytes too: neither retaining check is asked of this
    /// arm's door at all.
    Marked,
    /// Withheld: neither published nor marked, and nothing about this state was
    /// recorded anywhere.
    ///
    /// [`WriteLedger::withhold_under_the_session_lock`]'s answer and no other
    /// door's. `crate::commands`'s `after_a_save` reads the disk once after its
    /// **transaction returned** — which is not the same as after a commit, and
    /// saying *after a commit* was round 9's fourth Low: that tail also runs for
    /// `committed: false`, where nothing was renamed at all — and it may find a
    /// revision its transaction never saw. Nobody is shown
    /// that state — the answer that tail returns carries no disk side — so
    /// marking it would make the engine's later stabilized reading of the same
    /// state a `Duplicate` and consult Q2's *the differing post-save observation
    /// is queued as external* would be met by nothing at all. What this reading
    /// is allowed to decide is the **record** and only the record: the file does
    /// not hold the revision the transaction last saw, so the entry for that
    /// path — this save's own, or an earlier save's where this one committed
    /// nothing — has stopped describing what any consumer should decide on.
    ///
    /// Like every arm below the retaining checks it **clears** any app-write
    /// record for the path — which is the whole of its effect, and since the
    /// round-8 fix round it reaches a record naming the observed bytes too, not
    /// only one naming different ones.
    Withheld,
}

/// One document's latest committed app write — the consult's
/// `last_app_write[DocumentId] = { workspace_epoch, revision }`.
///
/// **Exactly the consult's two fields and no third one.** The instant at which
/// the record was taken is a fact about this session's **chronology** rather
/// than about the write, and since the round-9 fix round it lives in a map of
/// its own ([`LedgerState::latest_commit_at`]) rather than beside this value.
/// That separation is the fix: the two lifetimes are
/// [`espansoconfig_core::watch::retained_state`]'s clause 9, and pairing them in
/// one struct made clearing the first clear the second — see the module's
/// *the anchor outlives the record* section for what that cost.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppWrite {
    /// The workspace epoch this save committed under.
    ///
    /// Redundant with [`WriteLedger::begin_epoch`]'s discard **today**, and
    /// stored and checked anyway: the entry's own claim is *committed under
    /// this epoch*, and the two statements of that rule — the discard and the
    /// tag — are checked separately so a future path that discards late cannot
    /// silently start suppressing across a workspace replacement. Nothing in
    /// the type system ties them together.
    pub epoch: u64,
    /// The revision the transaction read back from disk after its rename.
    pub revision: ContentRevision,
}

/// The instant of the latest committed app write to one **path**, in one epoch.
///
/// This step's **round-9 second High**, and the whole of it is *which value this
/// lives in*. Until that round the instant was a field of the app-write record,
/// so every clearing of that record — supersession, and since the round-8 fix
/// round a serialized reading of the recorded bytes — took the chronology anchor
/// with it, and an arbitrarily delayed pre-commit settlement then found nothing
/// to be refused by and published bytes the commit had since replaced.
///
/// **The path's slot is maintained until the epoch is replaced; this value is
/// not.** [`WriteLedger::record_app_write`] inserts a fresh anchor on every
/// committed write, so a later commit to the same path drops the one before it —
/// and the chronology fact the slot answers, *when did this session last commit
/// to this path*, stays true exactly because it does: that replacement is what
/// *latest* means, and it never leaves the slot empty.
///
/// So what the epoch keeps is the slot and that fact. **The slot** is created
/// by [`WriteLedger::record_app_write`], its value is read by [`decide`]'s
/// step 1, and the slot is **removed** by [`WriteLedger::begin_epoch`] alone —
/// no clearing of the
/// app-write record removes it, neither a door's nor the reload invalidation's,
/// since none of them says anything about *when* this session last wrote to that
/// path, and the one event that also ends a record by supersession is a later
/// committed write, which **replaces** this value rather than removing it.
///
/// This is [`espansoconfig_core::watch::retained_state`]'s clause 9, of which
/// this type is the source. **The paragraph above said *its life is the epoch
/// and nothing shorter* until Phase 2d-4a-C's round 1** — one lifetime asserted
/// for the value, the slot and the fact at once, and false of the first;
/// [`WriteLedger::record_app_write`]'s own insertion comment has said the value
/// is replaced since round 9, and nothing compared the two.
///
/// **Keyed by path rather than by document**, which is not an economy: step 3
/// removes the `documents_by_path` entry a path-to-record lookup goes through,
/// so an anchor keyed by [`DocumentId`] would become unreachable at exactly the
/// moment it has to keep answering.
#[derive(Debug, Clone, Copy)]
struct CommitAnchor {
    /// The workspace epoch the commit happened under.
    ///
    /// Redundant with [`WriteLedger::begin_epoch`]'s discard **today**, and
    /// stored and checked anyway, for [`AppWrite::epoch`]'s reason and no other:
    /// the two statements of *this belongs to this epoch* are checked separately
    /// so a future path that discards late cannot silently start refusing
    /// observations of a workspace this anchor knows nothing about.
    epoch: u64,
    /// When [`WriteLedger::record_app_write`] took it, which is **after** the
    /// rename `espansoconfig_core::persist::save_document` performed — the
    /// transaction had already returned. That inequality is the load-bearing
    /// half: an observation whose `read_after` is at or after this instant read
    /// the disk at or after the rename landed, so what it read is a state the
    /// rename did not undo. Taking this stamp anywhere earlier — at the gate
    /// acquisition, say — would break the implication in the direction that
    /// silently restores the round-2 High, and nothing in the type system
    /// prevents that: this field is private and has one writer.
    at: Instant,
}

/// Every decision this ledger has taken, counted for the life of the session.
///
/// **Cumulative and never reset**, unlike the maps and the sequence allocator,
/// which a workspace replacement discards — this is the one exception
/// [`espansoconfig_core::watch::retained_state`]'s clause 8 names, and the type
/// it is derived from. It exists because four of these
/// decisions are otherwise indistinguishable from silence: a suppressed
/// observation, a coalesced one, one discarded for a replaced epoch and one
/// discarded as older than a commit all look exactly like a watcher that noticed
/// nothing (`PROGRESS.md` R24).
///
/// **It counts seven of the eight decisions, and the eighth is deliberately
/// absent.** [`Admission::SequenceSpaceExhausted`] is unreachable in any
/// physical execution and is directly observable through
/// [`WriteLedger::admit`]'s own answer, which the boundary test drives, so a
/// counter for it would be surface with no reader. Anyone adding a ninth
/// decision should ask the same two questions rather than assume this struct
/// is exhaustive — the round-2 fix round added
/// [`LedgerTally::preceded_a_commit`] by asking them, and the round-7 fix round
/// added [`LedgerTally::marked`] and [`LedgerTally::withheld`] the same way.
/// **The counts in this paragraph are derived by counting
/// [`Admission`]'s variants and this struct's fields**, not by reading the
/// numbers the previous sentence gave.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct LedgerTally {
    /// Observations admitted and numbered.
    pub admitted: u64,
    /// Observations suppressed as this application's own committed bytes.
    ///
    /// **Only [`WriteLedger::admit`] can move it**, since the round-8 fix
    /// round: the several native hints one atomic replacement generates are
    /// what this decision absorbs, and they all arrive through the stamped
    /// door. A serialized save-tail reading is never counted here, whatever it
    /// read — see [`Admission::SelfWrite`].
    pub suppressed: u64,
    /// Observations coalesced into the state already **announced** for their
    /// path — by a publication or by a marker, which [`Admission::Duplicate`]
    /// deliberately cannot tell apart.
    pub coalesced: u64,
    /// Observations discarded for carrying a replaced workspace epoch.
    pub stale_epoch: u64,
    /// Observations discarded because their reads could not be placed at or
    /// after this application's latest committed write to their path — see
    /// [`Admission::PrecedesACommit`].
    ///
    /// **Zero is the usual outcome for a save-generated hint, and a non-zero
    /// value is not by itself a fault** — the second half is round 10's single
    /// Low, and until that round this paragraph said instead that on a healthy
    /// production path this stays zero. **The first half is round 11's first
    /// High, and until that round it said *never*:** the engine's debounce puts
    /// at least one debounce plus one probe (240 ms at the default timing)
    /// between a save's own hint and the pass that settles it, while the anchor
    /// follows the rename by one read-back, so a save's own hints are **usually**
    /// decided after that commit's anchor — and usually is all it is, because
    /// that is a comparison of a probe interval against a rename-to-record
    /// window, it is reasoned and never measured, and **nothing enforces it**.
    /// A save thread stalled between the rename and
    /// [`WriteLedger::record_app_write`] for longer than one debounce plus one
    /// probe lets the worker stamp and settle the saved bytes first, and this arm
    /// then refuses them — correctly, and with nothing wrong. §16.6 item 30 of
    /// `docs/decisions/2d-3-notes.md` is that residue, and `crate::watch_check`'s
    /// `a_committed_save_is_suppressed_while_a_later_external_write_is_not`
    /// carries the same concession beside the wait that does the detecting.
    ///
    /// **But since the round-9 fix round a path keeps an anchor until the epoch
    /// is replaced, whatever becomes of its record**, so a
    /// perfectly healthy observation can move this counter too: a watcher
    /// completes a stable reading, its worker is descheduled, this application
    /// commits and records, a serialized decision clears that record, and the
    /// completed reading is only then decided — refused, correctly, against an
    /// anchor that may name a commit made long ago. **Nothing malfunctioned in
    /// that story and debounce cannot prevent it**, because the reading was
    /// already produced when the commit happened. That interleaving is driven by
    /// `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading`.
    ///
    /// **It is not bounded by any window**, and saying it was is round 9's third
    /// Low: only the *production* of such an observation is pre-commit, and
    /// nothing bounds how long a completed settlement waits at the gate or on a
    /// descheduled worker before it is admitted.
    ///
    /// What is left to diagnose bad stamping is therefore narrower than any
    /// single non-zero reading, and both halves of it are stated as what they
    /// are rather than as what they enforce:
    ///
    /// - **sustained growth out of proportion to this session's commits** —
    ///   especially growth for a path this session has stopped committing to,
    ///   which a correctly stamped pipeline cannot produce, because a refusal
    ///   here takes the engine's settlement back on the terms
    ///   [`espansoconfig_core::watch::liveness`] states —
    ///   and *any* settlement that then follows is stamped after the
    ///   anchor, so one commit **usually** refuses one reading once — usually
    ///   and not always, for two independent reasons stated here and not
    ///   elsewhere: that stamp follows the anchor in program order
    ///   only while [`std::time::Instant`] is not guaranteed strictly increasing
    ///   and [`decide`] refuses at equality, so a clock collision can make one
    ///   anchor refuse successive re-readings until one stamp *strictly* exceeds
    ///   it, and **nothing makes a further settlement happen at all**, which is
    ///   that same contract's *not guaranteed* half (round 13's first High) —
    ///   **and no threshold is enforced anywhere for it**: nothing in the
    ///   type system and no test
    ///   distinguishes proportionate growth from disproportionate, the tally
    ///   keeps no per-path count to read one from, and nothing fails when the
    ///   counter climbs, so this is a suspicion to read and never a diagnosis
    ///   this crate can make. That whole sentence is round 11's second High —
    ///   the claim and its concession stood as two sentences while §16.1 of the
    ///   record said, in as many words, that they were one — and its *one
    ///   refusal per commit* clause is round 12's first High, which is why the
    ///   clock concession above sits inside the same sentence too;
    /// - `crate::watch_check`'s
    ///   `a_committed_save_is_suppressed_while_a_later_external_write_is_not`,
    ///   whose **bounded positive wait** for a suppression is what detects a
    ///   stamp permanently taken too early. It asserted an exact zero beside that
    ///   wait through round 10; round 11 removed the assertion, because the stall
    ///   above makes it a line that can fail with no defect present — and the
    ///   removal is a real loss of coverage, not a free one, because that line
    ///   also failed on a stamp taken too early only *intermittently*, which the
    ///   surviving wait cannot see: the tally is cumulative, so one transient
    ///   refusal left it non-zero for the session, while a rollback and a
    ///   correctly stamped re-pass satisfy the wait. Round 12's second High is
    ///   that this was recorded as costing nothing.
    ///
    /// It counts **refusals, never losses**, and since the round-4 fix round
    /// that sentence is true of everything it can count: only
    /// [`WriteLedger::admit`] reaches the arm, and every refusal of a watcher
    /// observation takes the engine's settlement back
    /// (see [`Admission::PrecedesACommit`]) — *answered* being that rollback and
    /// **not** an arriving re-reading. **What the rollback restores, and what it
    /// promises about a re-reading, is
    /// [`espansoconfig_core::watch::liveness`]**, stated there and not restated
    /// here: two paraphrases of it stood in this doc comment and each was a
    /// review finding. What makes this a refusal rather than a loss needs
    /// neither half of that contract — the state is left **un-concluded**
    /// instead of concluded, so nothing has consumed it.
    /// A count
    /// that climbs steadily for one path is therefore a pipeline re-running, not
    /// a change disappearing. Before round 4 the same sentence stood over a
    /// counter that could also count a save-path refresh, which **was** a loss —
    /// see this module's *two proofs* section.
    pub preceded_a_commit: u64,
    /// Save-tail readings recorded as their path's coalescing marker and
    /// published nowhere — see [`Admission::Marked`].
    ///
    /// Only `crate::commands`'s `conflict_after_the_lock` can move it, and only
    /// on the arm where its single read succeeded. A non-zero count is
    /// therefore a count of conflicts whose disk side the person was shown.
    pub marked: u64,
    /// Save-tail readings withheld from the sequence and from the coalescing
    /// map alike — see [`Admission::Withheld`].
    ///
    /// Only `crate::commands`'s `after_a_save` can move it, and only on the arm
    /// where its refresh found a revision the transaction never saw. A non-zero
    /// count is therefore a count of external writes that landed between a save
    /// transaction's **last locked read** and its **tail refresh**, each of which
    /// is owed a stabilized reading from the watcher rather than a publication
    /// from here.
    ///
    /// **Not *between a commit and its read-back***, which is what this
    /// paragraph said until the round-9 fix round and is round 9's fourth Low:
    /// `after_a_save` runs for `Ok(SavedDocument { committed: false, .. })` too,
    /// where no rename happened, and an external write landing before that
    /// refresh increments this counter with no commit anywhere in the story.
    pub withheld: u64,
}

/// The per-document app-write record, the announced-state map and the
/// per-epoch sequence allocator, behind two leaf mutexes.
///
/// **Beside the open session, never in core global state and never in the
/// frontend** (consult Q2). **The object outlives any one workspace and its
/// contents do not** — the sink that reads it is the session's, shared across
/// replacements — which is why the discard on replacement is an explicit call
/// ([`WriteLedger::begin_epoch`]) rather than a value going out of scope. What
/// that call scopes is [`espansoconfig_core::watch::retained_state`]'s clause 2,
/// and what it deliberately leaves standing is that contract's clause 8.
///
/// The two mutexes are deliberately separate and are always taken **gate
/// first**; see this module's *commit gate* section for the whole order and its
/// deadlock argument.
#[derive(Debug)]
pub struct WriteLedger {
    /// The commit gate — held across one whole save transaction and its record,
    /// and taken briefly by every decision, so that no admission can observe
    /// the instant between a rename and the record that describes it.
    ///
    /// It guards **no data**: what it carries is the right to be the only
    /// thread inside a commit-or-decide window. `()` rather than a field of
    /// [`LedgerState`] because a decision needs the state guard *inside* this
    /// window, and one mutex cannot be taken twice.
    gate: Mutex<()>,
    /// How many threads are between the gate's waiter count and their
    /// acquisition of it — a **test-only** observability seam, and the whole
    /// reason the concurrency tests are deterministic rather than timed.
    ///
    /// A test that holds the gate can wait *positively* until this reads one,
    /// which proves an admission is parked at the gate and therefore has not
    /// decided; a build with the gate acquisition removed never moves it, so
    /// that wait times out instead of racing. Incremented and decremented only
    /// by [`WriteLedger::enter_gate`], so removing the acquisition removes the
    /// counter with it.
    #[cfg(test)]
    gate_waiters: std::sync::atomic::AtomicUsize,
    state: Mutex<LedgerState>,
}

/// One held commit gate: the right to run a commit and its record as one
/// window no admission can cross.
///
/// Produced only by [`WriteLedger::begin_commit`] and required by
/// [`WriteLedger::record_app_write`], so *a record is taken inside a commit
/// window* is a property of the signature. **What the type cannot force**, said
/// beside what it does: that this gate is the same ledger's, and that it was
/// taken before the transaction rather than after it.
///
/// Released by dropping — deliberately, so that an early return or a panic
/// between the transaction and the record cannot strand it.
#[derive(Debug)]
pub struct CommitGate<'a> {
    /// The guard whose lifetime *is* the window; nothing reads it.
    _held: MutexGuard<'a, ()>,
}

/// Everything [`WriteLedger`] holds, and the mutex holds all of it at once.
#[derive(Debug)]
struct LedgerState {
    /// The workspace epoch this session is currently observing under.
    /// [`NO_EPOCH`] before the first open, and after an open whose epoch space
    /// was exhausted.
    epoch: u64,
    /// The consult's `last_app_write`, keyed exactly as it specifies.
    ///
    /// **What an entry licenses is suppression, and nothing about chronology.**
    /// Until the round-9 fix round each entry carried the instant it was taken,
    /// which meant the two lifetimes were one; the instant now lives in
    /// [`LedgerState::latest_commit_at`], whose per-path slot the epoch keeps
    /// and whose value a later commit to that path replaces. See
    /// [`CommitAnchor`].
    writes: BTreeMap<DocumentId, AppWrite>,
    /// The path each recorded write is at, because an observation names a path
    /// and never an identity.
    ///
    /// Not a second source of truth: it is written and erased in the same two
    /// statements as `writes`, and the identity table a `DocumentId` comes from
    /// answers one number per path on
    /// [`espansoconfig_core::watch::retained_state`]'s clause 1 terms
    /// (`docs/decisions/2d-1-notes.md` D7), so the two directions cannot
    /// disagree about which document a path is. What is **not** forced is that
    /// the workspace's spelling of a path and the watcher's are the same
    /// string; that agreement is `crate::watch::HintSpelling`'s and discovery's,
    /// and 2d-1 §5 item 3's residue is inherited here unchanged.
    documents_by_path: BTreeMap<PathBuf, DocumentId>,
    /// The last state **announced** for each path, which is the whole of the
    /// coalescing rule.
    ///
    /// An entry is written by exactly two things, and the round-7 fix round is
    /// what made them two: a **publication**, which spent a sequence and sent
    /// the observation downstream, and a **marker**, which spent nothing because
    /// the state was announced to the person as the disk side of a save conflict
    /// instead ([`Admission::Marked`]). One map rather than two, because
    /// coalescing asks one question — *does a consumer already have this state*
    /// — and both entries answer it yes; a second map would be a second
    /// statement of one rule, and the arm that forgot to consult it would
    /// coalesce nothing or coalesce everything.
    ///
    /// **What is deliberately absent from it** is `crate::commands`'s
    /// `after_a_save`'s disagreeing read ([`Admission::Withheld`]): nobody was
    /// shown that state, so an entry for it would coalesce the engine's later
    /// stabilized reading of the same state into silence — round 3's
    /// swallowed-change defect reached from the other side.
    ///
    /// **Nothing prunes this map as a whole before the epoch ends** — entries
    /// leave one at a time, where a particular path's announcement stops being
    /// true — which is
    /// [`espansoconfig_core::watch::retained_state`]'s second *expressly not
    /// guaranteed* clause.
    announced: BTreeMap<PathBuf, ObservedState>,
    /// When this session last **committed** a write to each path — the
    /// chronology anchor [`decide`]'s step 1 refuses against.
    ///
    /// Separate from `writes` on purpose, and the separation is round 9's second
    /// High: see [`CommitAnchor`] for why one value could not carry both, and
    /// [`espansoconfig_core::watch::retained_state`]'s clause 9 for the two
    /// lifetimes themselves. **Nothing prunes this map within an epoch**, which
    /// that contract's second *expressly not guaranteed* clause is about.
    latest_commit_at: BTreeMap<PathBuf, CommitAnchor>,
    /// The next sequence to hand out; `None` once this epoch's space is spent.
    next_sequence: Option<u64>,
    /// See [`LedgerTally`].
    tally: LedgerTally,
}

impl WriteLedger {
    /// A ledger with nothing recorded and no workspace epoch yet.
    pub fn new() -> WriteLedger {
        WriteLedger {
            gate: Mutex::new(()),
            #[cfg(test)]
            gate_waiters: std::sync::atomic::AtomicUsize::new(0),
            state: Mutex::new(LedgerState {
                epoch: NO_EPOCH,
                writes: BTreeMap::new(),
                documents_by_path: BTreeMap::new(),
                announced: BTreeMap::new(),
                latest_commit_at: BTreeMap::new(),
                next_sequence: Some(FIRST_OBSERVATION_SEQUENCE),
                tally: LedgerTally::default(),
            }),
        }
    } // End of function new()

    /// Opens one commit window: the caller may run its transaction and take its
    /// record with no admission deciding in between.
    ///
    /// **The gate is held across `espansoconfig_core::persist::save_document`**
    /// — that is the whole point, because the rename happens inside it — and
    /// released by dropping the returned value. See this module's *commit gate*
    /// section for the lock order, the deadlock argument and the one thing that
    /// is allowed to run under it.
    pub fn begin_commit(&self) -> CommitGate<'_> {
        CommitGate {
            _held: self.enter_gate(),
        }
    }

    /// Adopts `epoch` and **discards everything the previous workspace
    /// recorded** — the app writes, their path index, the announced states
    /// (publications and markers alike), the per-path commit anchors and the
    /// sequence allocator.
    ///
    /// Consult Q2's *discard the whole map on workspace replacement*, and this
    /// is the ledger's half of
    /// [`espansoconfig_core::watch::retained_state`]'s clause 2. The reason is
    /// not tidiness: that contract's clause 1 is why an entry kept across a
    /// replacement could suppress an observation of a different directory's file
    /// that happens to hash the same. Called from `WorkspaceSession::open`
    /// **before** the
    /// successor watcher starts, so the first observation of a new epoch can
    /// never be discarded as stale by an epoch the ledger had not yet adopted.
    ///
    /// Takes the commit gate first, like every other mutation and every
    /// decision, so that a replacement can never land inside a commit window.
    /// It is already serialized against [`WriteLedger::record_app_write`] by
    /// the session lock both callers hold — the gate is the second statement of
    /// that rule, not a substitute for it, and it costs nothing because the one
    /// thread that could hold the gate for any length of time is a save, which
    /// holds the session lock too.
    pub fn begin_epoch(&self, epoch: u64) {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        ledger.epoch = epoch;
        ledger.writes.clear();
        ledger.documents_by_path.clear();
        ledger.announced.clear();
        // **The one place a commit anchor's slot is removed**, and the only
        // place a path stops having one: the fact it carries is about *this*
        // epoch's chronology, so the slot is discarded with the epoch and by
        // nothing shorter.
        // The *value* is shorter-lived than the slot —
        // `record_app_write` replaces it on every later commit to the same path
        // — and `espansoconfig_core::watch::retained_state`'s clause 9 is where
        // the two are kept apart. See [`CommitAnchor`] and this module's *the
        // anchor outlives the record* section.
        ledger.latest_commit_at.clear();
        ledger.next_sequence = Some(FIRST_OBSERVATION_SEQUENCE);
    } // End of function begin_epoch()

    /// Records `revision` as the latest revision this application committed for
    /// `document`, at `path`, **and invalidates whatever was last announced for
    /// that path**.
    ///
    /// **The one producer of an [`AppWrite`]**, and its one production caller is
    /// `crate::commands::commit_and_record`, which calls it for
    /// `Ok(SavedDocument { committed: true, .. })` and for nothing else — see
    /// `committed_revision` there, which is exhaustive over the transaction's
    /// outcome so that no error, including one that
    /// `SaveError::may_have_written`, can reach this function.
    ///
    /// `gate` is the window this record shares with its transaction; it is read
    /// for nothing, and holding it is the whole of its contribution. See
    /// [`CommitGate`] for what that forces and what it does not.
    ///
    /// **The instant is taken here**, on the line that inserts the anchor, and
    /// therefore after `save_document` returned and after the rename inside it.
    /// It is what lets [`decide`] refuse an observation whose reads it cannot
    /// place at or after that rename ([`Admission::PrecedesACommit`]); see
    /// [`CommitAnchor::at`] for why *after the rename* rather than before it is
    /// the half that matters.
    ///
    /// **The record and the anchor are written together and cleared apart**,
    /// which is round 9's second High: they are inserted under this one state
    /// guard, so no decision can interleave with *this insertion* and observe
    /// a half-written pair — which is all the guard proves, and **not** that
    /// the two are always seen together. From then on the record's life is
    /// *how long suppression is licensed* while the path keeps an anchor until
    /// the epoch is replaced. Anything that clears the record leaves the anchor
    /// standing, so the next decision can and routinely does see an anchor with
    /// no record; the wider co-existence claim stood in this doc comment, three
    /// lines above that sentence, until Phase 2d-4a-C's round 2.
    ///
    /// **A second call here ends both, and it ends
    /// neither by clearing**: a later commit to the same path supersedes the
    /// record and replaces the anchor's value in the same two
    /// statements, which is why the slot survives what the value does not — see
    /// the insertion comment below, and
    /// [`espansoconfig_core::watch::retained_state`]'s clause 9 for the three
    /// lifetimes this passage stated as one until Phase 2d-4a-C's round 1.
    ///
    /// Replaces any earlier record for the same document, which is the consult's
    /// *replace it on the next committed app save*. It replaces the path index
    /// entry too, so a document whose path this session re-resolved cannot leave
    /// a second key pointing at it.
    ///
    /// # Why the announced state is invalidated, and why it is done here
    ///
    /// This step's round-1 second High. The announced-state map answers *what
    /// was a consumer last told about this path*, and a committed app write
    /// makes every earlier answer for it obsolete: the bytes on disk are now
    /// this application's, and the entry that still names some earlier external
    /// revision B would coalesce a genuine post-commit external replacement
    /// back to B into a `Duplicate` — reporting nothing, and retaining a record
    /// that then suppresses a later real change. Invalidating rather than
    /// publishing the committed revision is the deliberate direction: nothing
    /// was published for this write, no sequence was spent, and no consumer was
    /// told, so the map must not claim one was. It happens in **this** function,
    /// under the same state guard as the record, so no decision can interleave
    /// with this insertion and meet the new record while the stale announcement
    /// still stands. That is an atomicity claim about this one function and not
    /// a claim that the two are always observed together: below the retaining
    /// checks a decision clears the record and may then announce a state, so a
    /// path holding an announcement and no record is ordinary. This sentence
    /// asserted the wider co-existence until Phase 2d-4a-C's round 2, where the
    /// sweep for that claim family found it beside the two the review named.
    ///
    /// **The round-7 fix round changed neither the call nor that argument**, and
    /// it widened what the call reaches: since that round the entry it removes
    /// may be a **marker** ([`Admission::Marked`]) rather than a publication,
    /// and removing it is right for the same reason and for one more. The same
    /// reason: a committed app write makes the disk side of the conflict that
    /// marked it obsolete, so a later external write back to that state is news
    /// again. The one more: the person who was shown that disk side has since
    /// saved over it, so the sentence *a consumer already has this state* has
    /// stopped being true of them.
    pub fn record_app_write(
        &self,
        gate: &CommitGate<'_>,
        document: DocumentId,
        path: &Path,
        revision: ContentRevision,
    ) {
        let _ = gate;
        let mut ledger = self.lock();
        let epoch = ledger.epoch;
        ledger.writes.insert(document, AppWrite { epoch, revision });
        ledger
            .documents_by_path
            .retain(|_, recorded| *recorded != document);
        ledger
            .documents_by_path
            .insert(path.to_path_buf(), document);
        // The anchor, taken on the same line group and under the same guard as
        // the record. It replaces any earlier anchor for this path, because
        // *latest* is what it claims. **A path this document has moved away
        // from keeps its own anchor**, which nothing removes before the epoch
        // ends (`espansoconfig_core::watch::retained_state`, clause 9). One
        // number per path makes this unreachable today
        // (`docs/decisions/2d-1-notes.md` D7), and
        // if it ever does happen the residue is one path over-refusing readings older
        // than a commit this session really made — a refusal that takes the
        // settlement back, never a lost change, on the terms
        // `espansoconfig_core::watch::liveness` states and this comment does not
        // restate.
        ledger.latest_commit_at.insert(
            path.to_path_buf(),
            CommitAnchor {
                epoch,
                at: Instant::now(),
            },
        );
        ledger.announced.remove(path);
    } // End of function record_app_write()

    /// The decision for one observation of `path`, produced under `epoch`.
    ///
    /// The watcher's entry point: the epoch is the tag the observation carries,
    /// and an observation from a replaced watcher is discarded here before
    /// anything can name a document.
    ///
    /// **Takes the commit gate before the state**, so a decision can never land
    /// between a save's rename and the record that describes it; both guards are
    /// released before this returns, which is what lets [`admitting_sink`] call
    /// a downstream sink that re-enters either.
    ///
    /// `read_after` is an instant the observation's reads are known to follow —
    /// [`crate::watch::EpochObservation::read_after`], taken by the worker
    /// before the engine pass that produced this state. The gate cannot reach a
    /// read that already happened, so this is what places one; see the *stamp*
    /// section of this module for the implication, and for the fact that
    /// **nothing in the type system makes a caller take it before its read**.
    ///
    /// **This is the entry point that can answer
    /// [`Admission::PrecedesACommit`], and it is the only one.** A caller here
    /// holds no session lock and its reads happened in an engine pass of their
    /// own, so a stamp is the only ordering it can offer — which is why the mode
    /// is built here rather than taken as an argument: a worker thread must not
    /// be able to ask for the proof it cannot give.
    pub fn admit(
        &self,
        epoch: u64,
        path: &Path,
        state: ObservedState,
        read_after: Instant,
    ) -> Admission {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        if epoch != ledger.epoch {
            ledger.tally.stale_epoch += 1;
            return Admission::StaleEpoch;
        }
        decide(
            &mut ledger,
            path,
            state,
            AdmissionDoor::StampedPublication(read_after),
        )
    } // End of function admit()

    /// The decision for one single read this session took and **showed to the
    /// person**: it is checked against this path's announced state and, if it
    /// survives, it supersedes the app-write record and is recorded as the
    /// path's coalescing marker rather than published.
    ///
    /// **Two of [`decide`]'s five steps are not asked of it**, and each has its
    /// own round: chronology, because it read no clock (round 4), and
    /// suppression, because it is not one of the native hints a commit generates
    /// (round 8). The consequence of the second is the one to state here: a
    /// reading that finds **exactly** the recorded bytes now clears the record
    /// and marks, where it used to answer [`Admission::SelfWrite`] and do
    /// neither. What that gives up is the suppression of that write's own
    /// pending hints — and the marker takes the job over **while it stands**,
    /// since a hint stabilizing at the marked state answers
    /// [`Admission::Duplicate`], which is the same silence through a different
    /// counter; see this module's *suppression is the stamped door's* section
    /// for what happens after a later commit or announcement removes it. What it buys is consult
    /// Q5's coalescing entry in the one case a stale record could withhold it,
    /// and the removal of an entry that would otherwise suppress the owed
    /// stabilized reading this caller asks for in the same breath.
    ///
    /// `crate::commands::conflict_after_the_lock`'s refresh, and it has no other
    /// caller. That function reads the disk once to build the disk side of a
    /// save conflict, so the state it holds is a state a consumer already has —
    /// through the payload, not through the sequence.
    ///
    /// **It cannot answer [`Admission::Admitted`], and that is this step's
    /// round-7 High.** A `Workspace::refresh` is **one** read where the engine
    /// takes two, so a foreign non-atomic write in progress can hand it a
    /// parseable intermediate state that never stably existed. Until round 7
    /// this door published such a reading — spending a sequence on a phantom and
    /// leaving it as the last word on that path — and the record argued that a
    /// stabilized reading arriving at a *later* sequence made it harmless under
    /// consult Q3. **That reading of Q3 is backwards**: Q3 says a consumer acts
    /// only on the highest sequence it has *accepted*, which forbids regressing
    /// to an older one and obliges nobody to wait for one that does not exist
    /// yet. A drain landing between the phantom and its correction legitimately
    /// accepts the phantom, and a person confirming *Reload* against it loses
    /// their draft, which no later sequence can give back.
    ///
    /// **What it does instead is the half consult Q5 needs and no more.** Q5
    /// rules that a save-origin conflict wins over a native duplicate at the
    /// same document and revision, and that *the duplicate is coalesced*; that
    /// requires the state to be in the coalescing map, and it requires nothing
    /// about a sequence. So the state is marked ([`Admission::Marked`]) and
    /// published nowhere, and the caller asks the running watcher to observe the
    /// path (`crate::watch::ReObserver::re_observe`). What the engine's two
    /// reads then settle on is what enters the sequence: the same state
    /// coalesces against the marker, which is Q5's rule holding; a different one
    /// is admitted and published, which is the truth entering the sequence while
    /// the phantom never did.
    ///
    /// **What that costs, said in the same place**: with no watcher to ask (see
    /// `docs/decisions/2d-3-notes.md` §5 item 19) the marker is the end of it,
    /// and the conflict's disk side enters the observation sequence not at all.
    /// The person who saved still sees it in their payload; what no consumer
    /// learns is that the file changed. That is a workspace with no watcher
    /// observing nothing, which is what such a workspace already does — and it
    /// is strictly better than the phantom this door used to leave there, which
    /// nothing could correct either.
    ///
    /// **There is no epoch to check** — this caller runs under the session lock,
    /// which is the lock a workspace replacement takes to change the epoch.
    ///
    /// **It takes the commit gate, so it must not be called from inside a
    /// commit window**: a `std::sync::Mutex` is not reentrant, and a second
    /// acquisition on one thread would deadlock against the first. Its caller is
    /// outside one by construction — `crate::commands::commit_and_record` drops
    /// its [`CommitGate`] when it returns, and only then does `run_one_save`
    /// reach `conflict_after_the_lock`. Nothing in the type system forces that
    /// ordering; the block scope of that one function is what keeps it.
    ///
    /// **It carries no stamp, and the name says why**, since the round-4 fix
    /// round. A record can only be *inserted* by a thread holding the session
    /// lock — [`WriteLedger::record_app_write`] is the one producer,
    /// `crate::commands::commit_and_record` its one production caller,
    /// `run_one_save` the only route to that, and
    /// `WorkspaceSession::with_open` the only route to *that*, holding the
    /// session mutex across its whole closure. This caller runs inside that same
    /// closure. So every record it can observe was inserted either by this
    /// thread earlier in this call or by a previous holder that released the
    /// lock before this one took it, and in both cases the record precedes the
    /// read in program order. There is nothing left for an `Instant` to prove,
    /// and [`Admission::PrecedesACommit`] is therefore unreachable from here —
    /// see this module's *two proofs* section for the whole argument.
    ///
    /// **That is a fix and not an economy**, and round 4's High is what it
    /// closes: the parameter used to exist, the save path stamped microseconds
    /// after its own save recorded, and [`decide`] accepts only a strictly later
    /// stamp — so a clock-resolution collision between two adjacent
    /// `Instant::now()` calls on one thread refused the refresh. Unlike a
    /// watcher observation there was no settlement to take back and no loop to
    /// retry it, so what that cost was not one publication but the **external
    /// observation itself**.
    ///
    /// **What the type cannot force**, beside what it does: that a caller really
    /// holds the session lock. This module owns no such lock and can require no
    /// witness of one, and a caller that skipped it would restore the round-2
    /// High in silence. One caller and this paragraph are what keep it.
    pub fn mark_under_the_session_lock(&self, path: &Path, state: ObservedState) -> Admission {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        decide(&mut ledger, path, state, AdmissionDoor::SerializedMarker)
    } // End of function mark_under_the_session_lock()

    /// The decision for one single read this session took and **showed to
    /// nobody**: it is checked against this path's announced state and, if it
    /// survives, it supersedes the path's app-write record and is recorded
    /// nowhere else.
    ///
    /// **The same two steps are not asked of it** as of
    /// [`WriteLedger::mark_under_the_session_lock`], for the same two reasons,
    /// and here the suppression exemption is the whole of round 8's High rather
    /// than half of it. This door's *only* effect is the record removal, so a
    /// `SelfWrite` answer left it with no effect at all — and the caller's owed
    /// stabilized reading then met the same retained record and was suppressed
    /// in its turn, so the differing post-save observation consult Q2 requires
    /// to be queued as external reached the sequence not at all. Nothing takes
    /// the suppression job over here, which is deliberate: this door is reached
    /// only where an external write landed between a save transaction's last
    /// locked read and this tail refresh, so a later hint at those bytes is a
    /// **genuine external change** — announced rather than absorbed, whatever its
    /// bytes happen to equal — and announcing a state the disk demonstrably holds
    /// is the direction this module takes over silence.
    ///
    /// `crate::commands::after_a_save`'s disagreeing refresh, and it has no
    /// other caller. That function re-reads the file **after its transaction
    /// returned** — not after a commit, since it runs for `committed: false`
    /// too — and may find a revision its transaction never saw; the answer it
    /// returns is a `SaveResult::Saved`, which carries no disk side, so nothing
    /// about that state reaches anybody.
    ///
    /// **It cannot publish, for round 7's reason** — one read is not stability,
    /// and the phantom it might be must not spend a sequence; see
    /// [`WriteLedger::mark_under_the_session_lock`] for the whole finding.
    ///
    /// **It cannot mark either, and that is this door's own reason for
    /// existing.** Marking a state means *a consumer already has this*, so the
    /// engine's later stabilized reading of the same state coalesces. Here
    /// nobody has it. A marker would therefore convert round 7's
    /// over-publication into a **swallowed change**: the external write that
    /// landed between this transaction's last locked read and this refresh would
    /// be announced by
    /// the marker to nobody and by the sequence never, and consult Q2's ruling
    /// that *the differing post-save observation is queued as external* would be
    /// met by nothing at all. Q5's coalescing rule is expressly about a conflict
    /// *registered by `conflict_after_the_lock`*, and there is no such conflict
    /// on this path.
    ///
    /// **What it does decide is the record**, and it is the one thing this
    /// reading can prove: the file does not hold the revision this caller's
    /// transaction last saw, so the entry for that path has stopped describing
    /// what any consumer should be deciding on, and leaving it there is what
    /// suppresses the owed stabilized reading. That is [`decide`]'s supersession
    /// step, and it is why this is a door rather than nothing at all.
    ///
    /// **The sentence is deliberately not *the file does not hold the bytes this
    /// application committed***. That was true of every reading this door could
    /// act on before the round-8 fix round, and is false of the one it added:
    /// where this save committed, the entry names `saved.revision` and the
    /// reading differs from it by this door's own condition; where it committed
    /// nothing, the entry is an **earlier** save's and may name the very bytes
    /// just read.
    ///
    /// **What that costs, said in the same place**: with no watcher to ask (see
    /// `docs/decisions/2d-3-notes.md` §5 item 19) nothing publishes this state,
    /// where before round 7 the single read did. The disagreeing post-save read
    /// was the one external change a watcher-less session could still announce,
    /// and it is now announced only when there is a watcher to stabilize it.
    /// What it announced without one was a state no second read had confirmed.
    ///
    /// The gate, the absent epoch check and the absent stamp are
    /// [`WriteLedger::mark_under_the_session_lock`]'s, for the same reasons and
    /// with the same obligation on the caller.
    pub fn withhold_under_the_session_lock(&self, path: &Path, state: ObservedState) -> Admission {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        decide(
            &mut ledger,
            path,
            state,
            AdmissionDoor::SerializedWithholding,
        )
    } // End of function withhold_under_the_session_lock()

    /// Tells this ledger that the **workspace accepted `revision` for `path`**
    /// from an explicit re-read of disk, and invalidates whatever it holds for
    /// that path that describes a different state.
    ///
    /// This step's **round-9 first and third Highs**, which are one root cause:
    /// until this method existed *nothing told the ledger when the workspace
    /// accepted a foreign revision*. `crate::commands::reload_document` re-reads
    /// the file and installs the result in the session's cache; every other read
    /// path — `WorkspaceSession::document` and `text` — is served from that same
    /// cache and cannot accept anything, so this is the one command that can
    /// make what this ledger holds stop describing what the session believes.
    ///
    /// **It is not a door.** It brings no observation, takes no [`AdmissionDoor`],
    /// answers no [`Admission`], spends no sequence, moves no tally and announces
    /// nothing. It removes, and only removes:
    ///
    /// - **the app-write record, when it names different bytes.** The record
    ///   licenses [`Admission::SelfWrite`], and the licence says *the bytes now
    ///   on disk are the ones this application committed*. A reload that
    ///   installed different bytes is this session establishing the opposite, so
    ///   the licence has outlived the last reading that could honestly spend it —
    ///   and the one door still allowed to suppress would otherwise answer
    ///   `SelfWrite` to a genuine external return to the recorded bytes, which is
    ///   round 9's first High;
    /// - **the announced state, when it is not this state.**
    ///   [`LedgerState::announced`] answers *does a consumer already have this
    ///   state*, and after a reload the answer for the old entry is no. Leaving
    ///   it makes a genuine external return to the announced bytes an
    ///   [`Admission::Duplicate`] — round 3's swallowed change reached through
    ///   coalescing, and round 9's third High. **Deferring it to 2d-5 cannot
    ///   work**: a `Duplicate` sends that layer no value to arbitrate.
    ///
    /// # Why both conditions are *differs*, and why the equal case must not clear
    ///
    /// **This is the direction that would be wrong**, and it is the one part of
    /// `docs/decisions/2d-3-notes.md` §14.2's rejection that survives round 9.
    /// Clearing a record whose bytes the reload just read would unsuppress that
    /// write's own pending native hints with nothing announced to absorb them,
    /// and this application would report its own commit as somebody else's — the
    /// one outcome this module may not produce. Clearing an announced state the
    /// reload just confirmed would do the same to consult Q5's coalescing entry:
    /// *Reload disk version* is exactly what a person does with a save conflict,
    /// and the marker `crate::commands::conflict_after_the_lock` installed must
    /// survive it, or the native duplicate Q5 rules is coalesced becomes a second
    /// conflict.
    ///
    /// So the equal cases are **kept deliberately**, and the two comparisons are
    /// independent: a reload can leave the record standing and drop the
    /// announcement, or the reverse.
    ///
    /// # What it does not touch, said in the same sentence
    ///
    /// **The commit anchor**, which is why round 9's second High is a separate
    /// fix rather than this one's consequence. A reload says nothing about *when*
    /// this session last wrote to that path, and an anchor removed here would
    /// leave a pre-commit settlement nothing to be refused by. See
    /// [`CommitAnchor`].
    ///
    /// # Lock order and what the caller owes
    ///
    /// Gate then state, briefly, exactly like every other mutation — so the
    /// order stays **session → gate → state** for a caller that already holds the
    /// session lock, which `crate::commands::reload_document` does
    /// (`WorkspaceSession::with_workspace` holds it across the whole closure).
    /// **It must therefore not be called from inside a commit window**, for
    /// [`WriteLedger::mark_under_the_session_lock`]'s reason: a
    /// `std::sync::Mutex` is not reentrant. Its caller runs no save, so it is
    /// outside one by construction.
    ///
    /// **The suffix is an obligation and not decoration, and here is what it
    /// buys.** The two serialized *doors* hold the session lock so that their
    /// reads provably follow every record in program order (this module's *two
    /// proofs* section). This entry point needs it for the mirror of that: the
    /// read and this report must be one window **no record can land inside**.
    /// Were the ledger told after the session lock had been released, a save
    /// could commit C and record C in between, and this call would then compare
    /// C against the revision the reload read, find them different, and clear the
    /// record a commit had just taken — which is precisely what makes that save's
    /// own hints foreign, round 2's High reached through a read-only command.
    /// `crate::commands::reload_document` keeps the window because
    /// `WorkspaceSession::with_workspace` holds the session mutex across the
    /// whole closure and the refresh and this call are both inside it.
    ///
    /// **What the type cannot force**, beside what it does: that the caller
    /// really holds the session lock, and that `revision` is what the workspace
    /// actually installed rather than some revision the caller had lying about.
    /// The first is this module's standing obligation on every
    /// `…_under_the_session_lock` entry point; the second is kept by the one
    /// caller taking it out of the value `Workspace::refresh` just returned.
    ///
    /// **Both invalidations happen under one state guard**, taken once here, so
    /// no decision can observe the record cleared and the announcement still
    /// standing, or the reverse.
    ///
    /// # Why a [`ContentRevision`] rather than an [`ObservedState`]
    ///
    /// Because a successful reload can only ever have read content. An absence
    /// or an unreadable state is an `Err` from `Workspace::refresh` and never
    /// reaches this call, and a parameter that could express one would be a
    /// parameter a later edit could use to report a state nobody observed.
    pub fn adopt_reloaded_revision_under_the_session_lock(
        &self,
        path: &Path,
        revision: ContentRevision,
    ) {
        let _gate = self.enter_gate();
        let mut ledger = self.lock();
        if record_at(&ledger, path).is_some_and(|recorded| recorded.revision != revision) {
            clear_the_record_at(&mut ledger, path);
        }
        let observed = ObservedState::Content(revision);
        if ledger
            .announced
            .get(path)
            .is_some_and(|announced| *announced != observed)
        {
            ledger.announced.remove(path);
        }
    } // End of function adopt_reloaded_revision_under_the_session_lock()

    /// The workspace epoch this ledger is observing under.
    // Read by this crate's tests today, and by 2d-4's wake payload when it
    // exists; the allow is scoped to non-test builds so the accessor stays
    // lint-armed exactly where its consumers exist.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn current_epoch(&self) -> u64 {
        self.lock().epoch
    }

    /// The app write recorded for `document`, if any. See [`AppWrite`].
    // Same scoped allow, same reason: an observability accessor, never a
    // control surface — nothing can steer suppression through it.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn recorded_write(&self, document: DocumentId) -> Option<AppWrite> {
        self.lock().writes.get(&document).copied()
    }

    /// The state last announced for `path`, if any — by a publication or by a
    /// marker, which this accessor deliberately cannot tell apart because
    /// coalescing cannot either (see [`LedgerState::announced`]).
    ///
    /// **It was called `published_state` until the round-7 fix round**, and the
    /// rename is the finding rather than tidiness: a marker is not a
    /// publication, and an accessor that called one the other would have let a
    /// test assert *published* over a state no sequence was ever spent on.
    // Same scoped allow, same reason.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn announced_state(&self, path: &Path) -> Option<ObservedState> {
        self.lock().announced.get(path).copied()
    }

    /// Every decision this ledger has taken. See [`LedgerTally`].
    // Same scoped allow, same reason.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn tally(&self) -> LedgerTally {
        self.lock().tally
    }

    /// Puts the sequence allocator at `next` — the boundary test's seam, so the
    /// exhausted arm can be reached without spending `u64` sequences first.
    #[cfg(test)]
    pub(crate) fn seed_sequence(&self, next: u64) {
        self.lock().next_sequence = Some(next);
    }

    /// The commit anchor [`WriteLedger::record_app_write`] took for `path` — the
    /// **test-only** seam that makes the equality case drivable.
    ///
    /// [`CommitAnchor::at`] is private and its writer reads the clock itself, so
    /// no test can inject a colliding stamp; reading the recorded one back and
    /// handing it straight to [`WriteLedger::admit`] is what turns *two ordered
    /// `Instant` calls may answer the same value* from a reviewed argument into a
    /// driven one. Test-only because it is a chronology fact about this session
    /// and nothing in production may decide on it outside [`decide`].
    ///
    /// **Keyed by path since the round-9 fix round**, because the anchor is —
    /// see [`CommitAnchor`].
    #[cfg(test)]
    pub(crate) fn commit_anchor(&self, path: &Path) -> Option<Instant> {
        self.lock()
            .latest_commit_at
            .get(path)
            .map(|anchor| anchor.at)
    }

    /// Moves `path`'s commit anchor to `at` — the **test-only** seam that makes
    /// a clock collision drivable on a path whose caller takes no stamp.
    ///
    /// [`WriteLedger::commit_anchor`] makes the collision drivable where the
    /// stamp is an *argument*, by handing the anchor's own instant back to
    /// [`WriteLedger::admit`]. The save path has no such argument since the
    /// round-4 fix round: `crate::commands::after_a_save` calls
    /// [`WriteLedger::withhold_under_the_session_lock`], which reads no clock at
    /// all. So the collision is asked for from the **other** side — the anchor is
    /// put where no later `Instant::now()` can beat it, which is a clock
    /// collision and worse. A build that still consulted a stamp on that path
    /// refuses deterministically; the shipped one cannot notice.
    ///
    /// Test-only for [`WriteLedger::commit_anchor`]'s reason, and it writes
    /// rather than reads, so it is the one seam that could steer a production
    /// decision if it ever stopped being `#[cfg(test)]`.
    #[cfg(test)]
    pub(crate) fn stamp_the_anchor_at(&self, path: &Path, at: Instant) {
        if let Some(anchor) = self.lock().latest_commit_at.get_mut(path) {
            anchor.at = at;
        }
    }

    /// How many threads have announced themselves at the commit gate and not
    /// yet acquired it — see [`WriteLedger::gate_waiters`].
    #[cfg(test)]
    pub(crate) fn commit_gate_waiters(&self) -> usize {
        self.gate_waiters.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Takes the commit gate, announcing the wait first so that a test holding
    /// the gate can observe — positively — that a decision is parked behind it.
    ///
    /// **The announcement and the acquisition are one function on purpose**: a
    /// build with the acquisition removed loses the announcement with it, so the
    /// concurrency tests' positive wait times out rather than quietly racing.
    ///
    /// Every caller binds the guard to `_gate` rather than to `_`. That is not
    /// style: `let _ = …` drops a guard at the semicolon, which would leave the
    /// gate open across the very window it exists to close. It is the one
    /// spelling of this mistake the compiler catches — rustc's
    /// `let_underscore_lock` is deny-by-default and rejects it, measured rather
    /// than assumed — and it is the only one, so a guard bound and then dropped
    /// early is still a defect no tool reports.
    ///
    /// Poisoning is absorbed for [`WriteLedger::lock`]'s reason, and here the
    /// argument is stronger still: the gate guards no data at all, so a panic
    /// under it cannot have left anything half-written.
    fn enter_gate(&self) -> MutexGuard<'_, ()> {
        #[cfg(test)]
        self.gate_waiters
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let held = self.gate.lock().unwrap_or_else(PoisonError::into_inner);
        #[cfg(test)]
        self.gate_waiters
            .fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
        held
    } // End of function enter_gate()

    /// Locks the ledger, absorbing poisoning for `crate::commands`'s reason: a
    /// poisoned mutex means some other call panicked, and refusing every later
    /// decision because of it would turn one panic into a session that can
    /// neither suppress nor observe.
    fn lock(&self) -> MutexGuard<'_, LedgerState> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
} // End of impl WriteLedger

impl Default for WriteLedger {
    /// [`WriteLedger::new`].
    fn default() -> WriteLedger {
        WriteLedger::new()
    }
}

/// Which door a reading came through, which decides **three** things about it:
/// how its caller can place its reads against the latest write this application
/// committed to the same path, whether it is one of the native hints such a
/// write generates, and what this ledger may do with a state that survives the
/// checks this door **is** asked. The count is re-derived by counting
/// [`decide`]'s matches over this enum.
///
/// **Private, and built by the three *deciding* entry points rather than passed
/// to them**,
/// which is the whole of its design. A mode that a caller could choose would be
/// a caller-supplied licence to skip a safety check or to spend a sequence it
/// has not earned; here both are properties of the door. [`WriteLedger::admit`]
/// can build only the first variant, [`WriteLedger::mark_under_the_session_lock`]
/// only the second and [`WriteLedger::withhold_under_the_session_lock`] only the
/// third, so the watcher's worker thread has no way to ask for a proof it could
/// not give and neither save-path caller has any way to ask for a publication.
///
/// **It is one enum rather than two, and the round-7 fix round is why.** The two
/// questions have three legal answers between them and six combinations, and the
/// three illegal ones are exactly the mistakes that matter: a stamped reading
/// that only marks would drop the watcher's own observations on the floor, and a
/// single unstabilized read that publishes is round 7's High itself. A door
/// cannot express them.
///
/// [`decide`] matches it exhaustively **three times** — since the round-8 fix
/// round, which made suppression the third — so a fourth door is a compile error
/// in every one of them rather than a silently skipped check or a silently spent
/// sequence. The three questions are *can this reading be placed after this
/// session's latest commit to that path*, *is this reading one of the hints a
/// commit generates*, and *what may
/// a state that survives do*; a future caller that can place its reads some
/// other way, that is not a native hint, or that may do something else with what
/// it read has to answer each of them for itself.
enum AdmissionDoor {
    /// The producer took this [`Instant`] **before** the reads that stabilized
    /// the state, and this session knows nothing else about when they happened;
    /// a state that survives every check — and this is the one door asked every
    /// one of them — is **published**, spending a sequence
    /// and reaching the downstream sink.
    ///
    /// The watcher's case, and since the round-7 fix round the only door that
    /// publishes. Its worker holds no session lock and its reads happen inside
    /// an engine pass of their own, so the stamp is the only ordering it can
    /// offer — see this module's *stamp* section for the implication the
    /// accepted condition carries and for the direction it over-refuses in. Its
    /// readings are also the only ones this application can call **stable**:
    /// two equal consecutive reads, which is what the consult's *a different
    /// stabilized revision* asks for.
    StampedPublication(Instant),
    /// The caller holds the lock that every producer of a record must hold, so
    /// every record and every commit anchor it could meet was written before
    /// this reading
    /// was taken, in program order; a state that survives the checks it is asked
    /// is **marked** for coalescing and published nowhere. **It is asked neither
    /// the chronology question nor the suppression one**, the first because it
    /// consulted no clock and the second because it is not a native hint — the
    /// round-4 and round-8 Highs respectively.
    ///
    /// `crate::commands::conflict_after_the_lock`'s case. The chronology half is
    /// the round-4 fix round's mechanism: no clock is consulted, so no clock
    /// resolution can collide, and [`Admission::PrecedesACommit`] is
    /// unreachable. The publication half is the round-7 fix round's: one read is
    /// not stability, and consult Q5 needs the coalescing entry rather than the
    /// sequence. The obligation this carries is the caller's and is stated at
    /// [`WriteLedger::mark_under_the_session_lock`] — nothing in the type system
    /// can carry a lock this module does not own.
    SerializedMarker,
    /// The same chronology proof as [`AdmissionDoor::SerializedMarker`], and the
    /// same exemption from suppression; a state that survives the checks it is
    /// asked is recorded **nowhere**: it supersedes the app-write record and nothing
    /// else.
    ///
    /// `crate::commands::after_a_save`'s disagreeing case, and the reason it is
    /// a third door rather than the second one reused is at
    /// [`WriteLedger::withhold_under_the_session_lock`]: nobody was shown this
    /// state, so a coalescing marker for it would swallow the engine's later
    /// stabilized reading of the same state.
    SerializedWithholding,
}

/// The app write recorded for `path` **in this epoch**, if there is one.
///
/// One statement of *which record this path has*, for the two readers that ask:
/// [`decide`]'s suppression step and
/// [`WriteLedger::adopt_reloaded_revision_under_the_session_lock`]. Written as a
/// function rather than repeated, because two copies of a two-map traversal are
/// two places for a future change of key to be applied to one of them — the
/// shape this step has already shipped twice.
///
/// The epoch filter is [`AppWrite::epoch`]'s second statement of the discard on
/// workspace replacement, unchanged.
fn record_at(ledger: &LedgerState, path: &Path) -> Option<AppWrite> {
    let document = ledger.documents_by_path.get(path).copied()?;
    let recorded = ledger.writes.get(&document).copied()?;
    (recorded.epoch == ledger.epoch).then_some(recorded)
} // End of function record_at()

/// When this session last **committed** a write to `path` in this epoch, if it
/// did — the chronology anchor, and never the record's own life.
///
/// See [`CommitAnchor`] for the whole of why this is a second map rather than a
/// field, and [`decide`]'s step 1 for what it answers.
fn commit_anchor_at(ledger: &LedgerState, path: &Path) -> Option<Instant> {
    ledger
        .latest_commit_at
        .get(path)
        .filter(|anchor| anchor.epoch == ledger.epoch)
        .map(|anchor| anchor.at)
} // End of function commit_anchor_at()

/// Removes `path`'s app-write record **and** its path-index entry, which are one
/// fact written in two maps.
///
/// The two callers are [`decide`]'s supersession step and
/// [`WriteLedger::adopt_reloaded_revision_under_the_session_lock`]. It is a
/// function so that *the record and its index are erased together* stays one
/// statement, exactly as [`WriteLedger::record_app_write`] writes them together
/// (§2.2 of the record).
///
/// **It does not touch [`LedgerState::latest_commit_at`]**, and that is the
/// point rather than an omission: see [`CommitAnchor`].
fn clear_the_record_at(ledger: &mut LedgerState, path: &Path) {
    if let Some(document) = ledger.documents_by_path.remove(path) {
        ledger.writes.remove(&document);
    }
} // End of function clear_the_record_at()

/// The decision itself, with the epoch already agreed.
///
/// A free function over the locked state rather than a method, so that it
/// cannot be reached without the guard and cannot take the guard twice — a
/// `std::sync::Mutex` is not reentrant, and the three public entry points that
/// reach it differ
/// only in whether they check the tag and in which [`AdmissionDoor`] they can
/// build. (The fourth public entry point,
/// [`WriteLedger::adopt_reloaded_revision_under_the_session_lock`], brings no
/// reading and does not come here at all.)
///
/// The order of the checks is the contract:
///
/// 1. **chronology**, which retains its record: an observation whose reads
///    cannot be placed at or after this session's latest **commit** to that path
///    — the path's [`CommitAnchor`], **not** the app-write record, since the
///    round-9 fix round — **may** describe bytes
///    this application has since replaced, so it may neither publish nor
///    supersede. The check proves only that the session cannot rule that out.
///    The round-2 High, and its round-9 second one: the path keeps an anchor
///    until the epoch is replaced, so a commit whose record has since been
///    cleared still refuses a
///    reading older than it. See this module's *stamp* and *the anchor outlives
///    the record* sections for the implication
///    and for the direction it over-refuses in. A serialized caller
///    ([`AdmissionDoor::SerializedMarker`],
///    [`AdmissionDoor::SerializedWithholding`]) has already placed its reads by
///    construction, so this step asks it nothing — the round-4 High, and this
///    module's *two proofs* section;
/// 2. **suppression**, which retains its record too — the several native hints
///    one atomic replacement generates must all meet the same entry. **It is
///    asked of the stamped door alone**, since the round-8 fix round: a native
///    hint arrives through exactly one door, and a serialized caller brings a
///    read of its own taken under the session lock after the record, through a
///    door that cannot publish. See this module's *suppression is the stamped
///    door's* section, and step 3 below for what that changes about it;
/// 3. **supersession**, which clears any app-write record for this path. It
///    needs no condition of its own, in either direction, and since the round-8
///    fix round the reason is **two** reasons rather than one, because the doors
///    reach this step differently:
///    - a *stamped* `Content` state was proved by step 2 not to be the recorded
///      bytes, and an `Absent` or `Unreadable` state — through **any** door,
///      which is what makes these two bullets a partition — says the file holds
///      no bytes at all. Either way the record would from here on suppress a
///      real observation — a later external revert to those exact bytes —
///      rather than this application's own write;
///    - a *serialized* `Content` state may be **exactly** the recorded bytes,
///      and clearing the record is still right. The reading was taken under the
///      session lock, after the record in program order, by a save tail that
///      has already classified it: `conflict_after_the_lock` read a file its
///      own transaction did not write, and `after_a_save` reaches its door only
///      where the read disagrees with the revision its transaction last saw. The
///      entry cleared is therefore one of two, and both are right to clear:
///      **this save's own**, which the reading differs from — the only case that
///      could reach this step before the round-8 fix round — or an **earlier**
///      save's, which is the only entry that can name the bytes just read, and
///      whose licence this reading is the moment to spend rather than let a
///      record made stale by anything outside this ledger go on suppressing the
///      owed stabilized reading these doors ask for. What the removal costs is at
///      [`WriteLedger::mark_under_the_session_lock`] and
///      [`WriteLedger::withhold_under_the_session_lock`];
/// 4. **coalescing**, against the state last announced for this path — by a
///    publication or by a marker, which are the same answer to *does a consumer
///    already have this state*;
/// 5. **what the door may do with a state that got this far**, which is the
///    round-7 fix round's split and the one step that is not the same for
///    everybody: a publication spends one sequence, announces the state and
///    reaches the downstream sink; a marker announces the state and spends
///    nothing; a withholding records nothing at all.
///
/// **Step 3 sits above steps 4 and 5 rather than inside step 5**, which is this
/// step's round-1 second High read as a shape rather than as a sentence: an arm
/// that returns early must not skip a mutation a later arm performs unless
/// skipping it is the point. Only steps 1 and 2 have that licence, and both say
/// so. The arms below step 3 are `Duplicate` and `SequenceSpaceExhausted` —
/// and, since round 7, `Marked` and `Withheld` — and clearing on any of them is
/// the same fact: the file no longer holds what this application committed. That
/// is true even of `SequenceSpaceExhausted`, which is terminal within its epoch
/// and therefore cannot act on it, and it is the whole of what a `Withheld`
/// reading is allowed to decide.
///
/// **Step 1 sits above step 2, and the order decides only which counter moves.**
/// The two overlap on exactly one input — a *stamped* reading of the recorded
/// bytes, stamped before the anchor — and both answers are true of it, both
/// retain the
/// record and both publish nothing. **They no longer overlap only there**, and
/// that is round 9's second High rather than a widening of step 2: since the
/// anchor outlives the record, step 1 also refuses readings step 2 could not
/// have seen at all, because the record they would have been decided against is
/// gone. Which door asks which is unchanged, and since the
/// round-8 fix round that is a property of the doors as well as of the states:
/// the serialized doors are asked neither question, one because they read no
/// clock and one because they are not native hints. Chronology is asked first
/// because it is a
/// question about the *reading* rather than about the bytes, which is the same
/// class as [`WriteLedger::admit`]'s epoch check; a consequence worth stating is
/// that a self-write hint stamped before its own commit is counted as
/// `preceded_a_commit` rather than as `suppressed`, which is what makes
/// `crate::watch_check`'s positive wait on the suppression tally bite against a
/// stamp taken too early on the production path.
///
/// The one early return **above** all of this is
/// [`WriteLedger::admit`]'s stale-epoch discard, which deliberately mutates
/// nothing but the tally: an observation carrying a replaced epoch may not name
/// a document, so it may not clear that document's record either.
///
/// **No public sequence can currently reach step 4 with a record standing**,
/// because [`WriteLedger::record_app_write`] invalidates the path's announced
/// state, so the first decision after a record can never be a `Duplicate` — and
/// step 1, which is the only arm added since that argument was written, neither
/// announces nor clears, so it cannot put one back either. Round 7's marker does
/// not weaken that: it announces only below step 3, where the record has just
/// been cleared. Round 8's door-scoping does not weaken it either, and in the
/// one direction worth naming it strengthens it: narrowing step 2 sends *more*
/// readings through step 3, which clears, and none through a new early return.
/// **Round 9's reload invalidation does not weaken it either**, and the reason
/// is the shape of that method rather than its conditions:
/// [`WriteLedger::adopt_reloaded_revision_under_the_session_lock`] only
/// **removes**, so it can neither write a record nor announce a state and
/// therefore cannot put a path into a shape no other path can reach.
/// Step 3's position is therefore reviewed rather than driven — the second
/// statement of one rule, exactly as [`AppWrite::epoch`] is for the discard on
/// workspace replacement.
fn decide(
    ledger: &mut LedgerState,
    path: &Path,
    state: ObservedState,
    door: AdmissionDoor,
) -> Admission {
    // **The two retaining checks read two different values, and that is round
    // 9's second High.** Step 1 asks *when did this session last commit to this
    // path*, which is [`CommitAnchor`]; step 2 asks *what does the app-write
    // record license*. Their two lifetimes are
    // `espansoconfig_core::watch::retained_state`'s clause 9. Until round 9 both
    // came out of one struct, so clearing the
    // record cleared the anchor and an arbitrarily delayed pre-commit settlement
    // published bytes the commit had replaced.
    //
    // Both lookups go through a helper each, so *which entry this path has* is
    // one statement rather than one per reader — the shape this step has already
    // shipped twice.
    let anchor = commit_anchor_at(ledger, path);
    let recorded = record_at(ledger, path);
    // **Strictly greater, and equality is a refusal.** `Instant` is monotonic
    // but expressly *not* guaranteed strictly increasing, so two ordered clock
    // reads may answer the same value — and at equality this comparison proves
    // nothing about which of the two calls came first. Accepting there would let
    // a reading taken before the rename clear the record and make the save's own
    // hints foreign, which is round 2's High restored by a clock-resolution
    // collision. See this module's *stamp* section for the implication the
    // accepted condition carries.
    //
    // **A serialized caller is asked nothing**, which is round 4's High: it did
    // not read a clock, so it cannot lose to one, and every record and every
    // anchor it could meet provably precedes its read in program order (this
    // module's *two proofs* section). The match is over the door rather than
    // over the anchor, so a fourth door cannot be added without answering this
    // question for itself.
    let precedes_a_commit = match door {
        AdmissionDoor::StampedPublication(read_after) => anchor.is_some_and(|at| read_after <= at),
        AdmissionDoor::SerializedMarker | AdmissionDoor::SerializedWithholding => false,
    };
    if precedes_a_commit {
        ledger.tally.preceded_a_commit += 1;
        return Admission::PrecedesACommit;
    }
    // **Suppression is the stamped door's question and nobody else's**, which is
    // round 8's High. It exists so that the several native hints one atomic
    // replacement generates all meet one retained entry, and a native hint
    // arrives through exactly one door. A serialized caller brings a read it
    // performed itself, under the session lock, after the record it is being
    // decided against and after the transaction whose tail it is — and since
    // round 7 neither serialized door can publish, so neither can commit the
    // error suppression exists to prevent. What a `SelfWrite` costs *them* is
    // the two things their door exists to do: the marker consult Q5 needs, and
    // the removal of a record whose licence has outlived the last reading that
    // could spend it — an entry that in this arm is always an *earlier* save's,
    // never the running transaction's. See this module's *suppression is the
    // stamped door's* section for the whole argument, including what the
    // removal costs.
    //
    // The match is over the door, exactly as the chronology check's is, so a
    // fourth door cannot be added without answering this question for itself.
    let suppressed_as_a_self_write = match door {
        // Absence and unreadability are deliberately not routed through the
        // predicate: this application never removes a file and never makes one
        // unreadable, so neither state can be a self-write, and asking the
        // predicate about a revision that no longer describes the file would be
        // asking it a question it does not answer. The chronology check above
        // is **not** narrowed that way: a stale reading of an absence would
        // otherwise clear the record of a file this application has since
        // written, which is the round-2 High with a different state in it.
        AdmissionDoor::StampedPublication(_) => match state {
            ObservedState::Content(observed) => {
                self_write_suppresses(recorded.map(|entry| entry.revision), observed)
            }
            ObservedState::Absent | ObservedState::Unreadable(_) => false,
        },
        AdmissionDoor::SerializedMarker | AdmissionDoor::SerializedWithholding => false,
    };
    if suppressed_as_a_self_write {
        ledger.tally.suppressed += 1;
        return Admission::SelfWrite;
    }
    // Step 3, and it clears the **record** alone: the anchor above it is not a
    // licence to suppress and this step has no reason to touch one. See
    // [`CommitAnchor`].
    clear_the_record_at(ledger, path);
    if ledger.announced.get(path) == Some(&state) {
        ledger.tally.coalesced += 1;
        return Admission::Duplicate;
    }
    // **Step 5, and the only step that is not the same for every door** — the
    // round-7 fix round. A single read may not spend a sequence, because one
    // read is not stability and a phantom in the sequence is a phantom a
    // consumer acts on; and a single read nobody was shown may not be announced
    // either, because announcing it would coalesce the stabilized reading that
    // is supposed to replace it. Each door says which of the three it is, and a
    // fourth has to say so too.
    match door {
        AdmissionDoor::StampedPublication(_) => {
            let Some(sequence) = ledger.next_sequence else {
                return Admission::SequenceSpaceExhausted;
            };
            ledger.next_sequence = sequence.checked_add(1);
            ledger.announced.insert(path.to_path_buf(), state);
            ledger.tally.admitted += 1;
            Admission::Admitted { sequence }
        }
        AdmissionDoor::SerializedMarker => {
            ledger.announced.insert(path.to_path_buf(), state);
            ledger.tally.marked += 1;
            Admission::Marked
        }
        AdmissionDoor::SerializedWithholding => {
            ledger.tally.withheld += 1;
            Admission::Withheld
        }
    } // End of the match over what each door may do with a surviving state
} // End of function decide()

/// One admitted observation: the engine's conclusion, its watcher's epoch, and
/// the sequence this session gave it.
///
/// What a downstream sink receives, and the shape
/// `crate::reconciliation`'s queue carries. A
/// value of this type has already passed the epoch check, the suppression
/// predicate and the coalescing rule — which is why it is a different type from
/// [`EpochObservation`] rather than the same one with a number added.
///
/// **Every field has a production reader since Phase 2d-4a**, which is what
/// removed the non-test `dead_code` allow this declaration used to carry: the
/// queue keys its pending set by the sequence, refuses an epoch it is not
/// holding, and projects the observation into a wire value.
#[derive(Debug)]
pub struct AdmittedObservation {
    /// The sequence, unique and increasing within [`AdmittedObservation::epoch`].
    pub sequence: u64,
    /// The workspace epoch the producing watcher was started under.
    pub epoch: u64,
    /// The engine's stabilized conclusion, unchanged.
    pub observation: Observation,
}

/// Where admitted observations go.
///
/// An `Arc` so one session's sink outlives every watcher it starts;
/// `Send + Sync` because the gate calls it from the watcher's worker thread,
/// synchronously, so a callback that never returns hangs its own worker — the
/// same contract [`ObservationSink`] states. It runs **outside** the ledger's
/// mutex, so it may call back into the session and into the ledger.
pub type AdmittedSink = Arc<dyn Fn(AdmittedObservation) + Send + Sync>;

/// The gate itself: an [`ObservationSink`] that asks `ledger` about every
/// observation and forwards only the admitted ones to `downstream`.
///
/// **This is where the intake sits**, and it is installed by
/// `WorkspaceSession::observing`, which every constructor of a session goes
/// through — so a production session and a test session get the same gate, and
/// the only thing a test injects is what happens *after* it.
///
/// **Both** guards — the commit gate and the state mutex — are dropped before
/// `downstream` runs, and [`WriteLedger::admit`] is what drops them, by
/// returning a value. That is not an optimisation: the worker calls this
/// closure synchronously and a downstream sink is allowed to call back into the
/// session and into this ledger, so holding either across the call would make a
/// re-entering sink deadlock against its own gate — the shape `crate::watch`'s
/// round-1 review found between the session mutex and the replacement join.
/// It is also why a downstream sink may call `WorkspaceSession::open`, which
/// takes the session lock and then this ledger's gate: the worker is holding
/// neither by then.
///
/// **It answers the producer**, since the round-3 fix round. Every decision but
/// [`Admission::PrecedesACommit`] is a
/// [`crate::watch::ObservationOutcome::Decided`]; that one is `Undecided`, and
/// `crate::watch::deliver` responds by taking the engine's settlement back. The
/// answer is produced by the **same** exhaustive match that decides whether the
/// observation reaches `downstream`, so no arm can do both — see the match
/// itself for why that had to be structural rather than two expressions. **What
/// the types do not force**, beside what they do: nothing makes a caller of this
/// sink act on the answer at all, and a caller that drops it silently restores
/// the round-3 High. `crate::watch::deliver` is the one call site.
pub fn admitting_sink(ledger: Arc<WriteLedger>, downstream: AdmittedSink) -> ObservationSink {
    Arc::new(move |observed: EpochObservation| {
        let admission = ledger.admit(
            observed.epoch,
            observed_path(&observed.observation),
            observed_state(&observed.observation),
            // The producer's stamp, forwarded rather than re-taken: an
            // `Instant::now()` here would be taken **after** the reads it is
            // meant to bound, which is exactly the value that loses the race
            // this stamp exists to decide.
            observed.read_after,
        );
        // **One exhaustive match decides both halves**, and that is the point
        // rather than concision: *does this reach the consumer* and *may the
        // producer keep its settlement* are two answers about one decision, and
        // written as two expressions a future arm could forward a value
        // downstream while the worker un-concluded it underneath — a consumer
        // told about a state the engine has since taken back. Here the arm that
        // forwards **is** the arm that answers `Decided`.
        //
        // A ninth `Admission` is a compile error in this block, and its author
        // has to answer the question the block asks: *would re-reading the path
        // change this answer?* Only `PrecedesACommit` can say yes, and only it
        // may — a revert re-hints the path, so an arm whose answer a re-read
        // cannot change would re-observe that path forever.
        match admission {
            Admission::Admitted { sequence } => {
                downstream(AdmittedObservation {
                    sequence,
                    epoch: observed.epoch,
                    observation: observed.observation,
                });
                ObservationOutcome::Decided
            }
            // The reading decided nothing and the state it described is still
            // unreported, while the engine has already installed that state as
            // its tracked one.
            Admission::PrecedesACommit => ObservationOutcome::Undecided,
            // The other four end here, and end silently — which is exactly what
            // the tally exists to make observable — and the engine's settlement
            // stands for each:
            // - `SelfWrite` and `Duplicate` are answers about these exact
            //   bytes, and re-reading them yields the same answer;
            // - `StaleEpoch` comes from a watcher this session has already
            //   replaced, whose engine is going away and whose successor's
            //   baseline scan re-reads every file under both roots, so nothing
            //   is carried by taking a doomed engine's settlement back;
            // - `SequenceSpaceExhausted` is terminal within its epoch by policy,
            //   so a re-read reaches the same refusal.
            Admission::SelfWrite
            | Admission::Duplicate
            | Admission::StaleEpoch
            | Admission::SequenceSpaceExhausted => ObservationOutcome::Decided,
            // **Unreachable from this door, and answered rather than
            // panicked.** This sink calls `WriteLedger::admit`, which builds
            // `AdmissionDoor::StampedPublication` and can build nothing else, so
            // neither of these two can come back here — they are the two
            // save-path doors' answers (the round-7 fix round). The answer is
            // still `Decided`, and the block's question is why: a re-read cannot
            // change a decision that was about publication authority rather than
            // about the bytes, and taking a settlement back for one would
            // re-observe the path forever. A `panic!` here would be a panic on
            // the watcher's worker thread, which is the one place this crate
            // must not take one.
            Admission::Marked | Admission::Withheld => ObservationOutcome::Decided,
        } // End of the match over every decision this ledger can take
    })
} // End of function admitting_sink()

#[cfg(test)]
mod tests {
    use super::*;
    use espansoconfig_core::watch::engine::StableContent;
    use std::sync::mpsc::RecvTimeoutError;
    use std::time::Duration;

    /// A bound for the one test that would otherwise hang on a regression.
    const PATIENCE: Duration = Duration::from_secs(30);

    /// A ledger already observing epoch 1, which is every test's starting
    /// point: a ledger with no epoch has no observations to decide about.
    fn ledger_at_epoch(epoch: u64) -> WriteLedger {
        let ledger = WriteLedger::new();
        ledger.begin_epoch(epoch);
        ledger
    }

    /// A revision, from bytes that say what they are.
    fn revision(text: &str) -> ContentRevision {
        ContentRevision::of_bytes(text.as_bytes())
    }

    /// One observation admitted with a stamp taken **at the call**, which is
    /// what an ordinary hint carries: a reading later than everything the test
    /// has already done, records included.
    ///
    /// Every test that is not about chronology uses this, so that the parameter
    /// which decides chronology is spelled out only where it is the subject.
    /// The tests that stamp explicitly are the ones below whose whole question
    /// is *which side of a commit this reading is on*.
    fn admit_now(ledger: &WriteLedger, epoch: u64, path: &Path, state: ObservedState) -> Admission {
        ledger.admit(epoch, path, state, later_than_now())
    }

    /// An instant strictly later than every clock read taken before this call.
    ///
    /// **`Instant::now()` alone would not be**, which is round 3's second High
    /// seen from the test side: the clock is monotonic and not guaranteed
    /// strictly increasing, so a read taken microseconds after a record can
    /// answer the record's own value — and [`decide`] refuses at equality, by
    /// design. The offset makes these helpers' claim (*a reading later than
    /// everything this test has already done*) true by construction rather than
    /// by the host clock's resolution. The one test that wants the collision
    /// asks for it explicitly, through [`WriteLedger::commit_anchor`].
    fn later_than_now() -> Instant {
        Instant::now() + Duration::from_nanos(1)
    }

    /// An instant **no** later clock read in this test can be strictly greater
    /// than, for the tests that want the refusing side by construction.
    ///
    /// [`later_than_now`]'s mirror image. Put on a path's **commit anchor**
    /// through [`WriteLedger::stamp_the_anchor_at`], it is a clock collision and
    /// worse:
    /// any comparison of a subsequently taken `Instant::now()` against it lands
    /// on [`Admission::PrecedesACommit`], whatever the host clock's resolution.
    /// That is what makes *this door consults no clock* a driven claim rather
    /// than a reviewed one.
    fn beyond_every_later_clock_read() -> Instant {
        Instant::now() + Duration::from_secs(3600)
    }

    /// One committed app write, taken in a commit window of its own.
    ///
    /// A helper rather than four lines in every test, and the window is scoped
    /// to this call for a reason worth naming: the commit gate is a plain
    /// `std::sync::Mutex`, so a test that kept the guard alive and then called
    /// [`WriteLedger::admit`] on the same thread would deadlock against itself.
    /// The two concurrency tests below take their gate explicitly, because for
    /// them the window's width is the thing under test.
    fn record(ledger: &WriteLedger, document: DocumentId, path: &Path, revision: ContentRevision) {
        let gate = ledger.begin_commit();
        ledger.record_app_write(&gate, document, path, revision);
    }

    /// Waits — **positively** — until some thread is parked at `ledger`'s commit
    /// gate, and panics if none arrives.
    ///
    /// This is what makes the concurrency tests deterministic rather than
    /// timed. The caller holds the gate, so a non-zero waiter count proves the
    /// other thread is inside [`WriteLedger::admit`], past the announcement and
    /// unable to decide; the caller may then take its record knowing exactly
    /// what the other thread has *not* done. A build whose `admit` does not
    /// take the gate never announces, so this fails instead of racing.
    fn await_a_waiter_at_the_gate(ledger: &WriteLedger) {
        let deadline = std::time::Instant::now() + PATIENCE;
        while std::time::Instant::now() < deadline {
            if ledger.commit_gate_waiters() >= 1 {
                return;
            }
            std::thread::yield_now();
        }
        panic!("no admission ever reached the commit gate — is `admit` taking it?");
    } // End of function await_a_waiter_at_the_gate()

    /// One observation as a watcher hands it to the gate, stamped **now** —
    /// later than anything the test has already done, exactly as
    /// [`admit_now`] is for a direct admission.
    fn hinted(epoch: u64, observation: Observation) -> EpochObservation {
        EpochObservation {
            epoch,
            read_after: later_than_now(),
            observation,
        }
    }

    /// A `Changed` observation carrying `revision` and nothing that needs a
    /// projection: `StableContent::NotUtf8` hashes exact bytes and holds no
    /// snapshot, which is all the gate reads.
    fn changed_at(path: &Path, revision: ContentRevision) -> Observation {
        Observation::Changed {
            path: path.to_path_buf(),
            previous_revision: None,
            content: StableContent::NotUtf8 {
                revision,
                offset: 0,
            },
            correspondences: None,
        }
    }

    #[test]
    fn an_observation_carrying_a_stale_epoch_is_discarded() {
        let ledger = ledger_at_epoch(2);
        let path = Path::new("/tree/match/base.yml");
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("old"))),
            Admission::StaleEpoch,
            "a replaced watcher's observation must not name a document"
        );
        assert_eq!(ledger.tally().stale_epoch, 1);
        assert_eq!(
            admit_now(&ledger, 2, path, ObservedState::Content(revision("new"))),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "the live epoch's observation is admitted"
        );
        // The discarded one spent no sequence and published nothing.
        assert_eq!(ledger.tally().admitted, 1);
    } // End of function an_observation_carrying_a_stale_epoch_is_discarded()

    #[test]
    fn the_recorded_revision_is_suppressed_and_survives_duplicate_hints() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(7);
        let committed = revision("committed");
        record(&ledger, document, path, committed);

        // One atomic replacement can generate several native notifications, and
        // every one of them must meet the same retained entry.
        for hint in 0..3 {
            assert_eq!(
                admit_now(&ledger, 1, path, ObservedState::Content(committed)),
                Admission::SelfWrite,
                "hint {hint} must be suppressed by the retained record"
            );
        } // End of the loop over the duplicate hints one replacement generates
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "suppression retains the record"
        );
        assert_eq!(ledger.tally().suppressed, 3);
        assert_eq!(ledger.tally().admitted, 0);
        assert_eq!(ledger.announced_state(path), None, "nothing was announced");
    } // End of function the_recorded_revision_is_suppressed_and_survives_duplicate_hints()

    #[test]
    fn a_different_revision_is_admitted_and_supersedes_the_record() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(7);
        let committed = revision("committed");
        let external = revision("external");
        record(&ledger, document, path, committed);

        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(external)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "a post-commit external replacement is not suppressed"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "an accepted different revision clears the record"
        );
        // …so the previously committed bytes are no longer suppressed either:
        // a revert to them is an external change like any other.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::Admitted { sequence: 2 }
        );
    } // End of function a_different_revision_is_admitted_and_supersedes_the_record()

    #[test]
    fn an_absence_or_an_unreadable_state_is_never_a_self_write() {
        let ledger = ledger_at_epoch(1);
        let gone = Path::new("/tree/match/gone.yml");
        let unreadable = Path::new("/tree/match/unreadable.yml");
        record(&ledger, DocumentId(1), gone, revision("committed"));
        record(&ledger, DocumentId(2), unreadable, revision("committed"));

        assert_eq!(
            admit_now(&ledger, 1, gone, ObservedState::Absent),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "this application removes no file, so a removal is never its own write"
        );
        assert_eq!(
            admit_now(
                &ledger,
                1,
                unreadable,
                ObservedState::Unreadable(io::ErrorKind::PermissionDenied)
            ),
            Admission::Admitted { sequence: 2 }
        );
        assert_eq!(ledger.recorded_write(DocumentId(1)), None);
        assert_eq!(ledger.recorded_write(DocumentId(2)), None);
    } // End of function an_absence_or_an_unreadable_state_is_never_a_self_write()

    #[test]
    fn sequences_increase_monotonically_within_one_epoch() {
        let ledger = ledger_at_epoch(1);
        let first = Path::new("/tree/match/a.yml");
        let second = Path::new("/tree/match/b.yml");
        let mut seen = Vec::new();
        for step in 0..3u32 {
            for path in [first, second] {
                if let Admission::Admitted { sequence } = admit_now(
                    &ledger,
                    1,
                    path,
                    ObservedState::Content(revision(&format!("{step}"))),
                ) {
                    seen.push(sequence);
                }
            }
        } // End of the loop driving six distinct states through the gate
        assert_eq!(seen, vec![1, 2, 3, 4, 5, 6], "sequences increase by one");
    } // End of function sequences_increase_monotonically_within_one_epoch()

    #[test]
    fn a_repeat_coalesces_while_removal_and_recreation_are_two_observations() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let bytes = revision("the same bytes");

        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(bytes)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(bytes)),
            Admission::Duplicate,
            "the state already announced produces no second observation"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Absent),
            Admission::Admitted { sequence: 2 },
            "a removal is a different state"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Absent),
            Admission::Duplicate,
            "a repeated removal coalesces too"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(bytes)),
            Admission::Admitted { sequence: 3 },
            "recreation at identical bytes is a second observation (consult Q3)"
        );
        assert_eq!(ledger.tally().coalesced, 2);
    } // End of function a_repeat_coalesces_while_removal_and_recreation_are_two_observations()

    #[test]
    fn workspace_replacement_discards_the_whole_map() {
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(7);
        let committed = revision("committed");
        record(&ledger, document, path, committed);
        assert!(matches!(
            admit_now(
                &ledger,
                1,
                Path::new("/tree/match/other.yml"),
                ObservedState::Absent
            ),
            Admission::Admitted { .. }
        ));

        ledger.begin_epoch(2);
        assert_eq!(ledger.current_epoch(), 2);
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "the map is discarded"
        );
        assert_eq!(
            ledger.announced_state(Path::new("/tree/match/other.yml")),
            None,
            "the announced states are discarded, publications and markers alike"
        );
        // The very bytes the previous workspace committed are now an ordinary
        // external observation, numbered from the start of the new epoch.
        assert_eq!(
            admit_now(&ledger, 2, path, ObservedState::Content(committed)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
    } // End of function workspace_replacement_discards_the_whole_map()

    #[test]
    fn an_exhausted_sequence_space_admits_nothing_further_in_its_epoch() {
        let ledger = ledger_at_epoch(1);
        ledger.seed_sequence(u64::MAX);
        let path = Path::new("/tree/match/base.yml");
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("one"))),
            Admission::Admitted { sequence: u64::MAX },
            "the last representable sequence is handed out exactly once"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("two"))),
            Admission::SequenceSpaceExhausted
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(revision("three"))),
            Admission::SequenceSpaceExhausted,
            "exhaustion is terminal within its epoch"
        );
        // …and the next workspace open resets it, like everything else.
        ledger.begin_epoch(2);
        assert_eq!(
            admit_now(&ledger, 2, path, ObservedState::Content(revision("four"))),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
    } // End of function an_exhausted_sequence_space_admits_nothing_further_in_its_epoch()

    #[test]
    fn the_gate_forwards_only_admitted_observations_and_numbers_them() {
        let ledger = Arc::new(ledger_at_epoch(1));
        let (sender, received) = std::sync::mpsc::channel::<AdmittedObservation>();
        let downstream: AdmittedSink = Arc::new(move |admitted| {
            let _ = sender.send(admitted);
        });
        let gate = admitting_sink(Arc::clone(&ledger), downstream);

        let path = Path::new("/tree/match/base.yml");
        let committed = revision("committed");
        record(&ledger, DocumentId(3), path, committed);

        // Suppressed: this application's own committed bytes.
        gate(hinted(1, changed_at(path, committed)));
        // Discarded: a replaced watcher's epoch.
        gate(hinted(
            99,
            changed_at(path, revision("from a replaced watcher")),
        ));
        // Admitted.
        let external = revision("external");
        gate(hinted(1, changed_at(path, external)));
        // Coalesced: the same state again.
        gate(hinted(1, changed_at(path, external)));

        let admitted = received.try_recv().expect("one observation was admitted");
        assert_eq!(admitted.sequence, FIRST_OBSERVATION_SEQUENCE);
        assert_eq!(admitted.epoch, 1);
        assert_eq!(observed_path(&admitted.observation), path);
        assert!(
            received.try_recv().is_err(),
            "nothing else may reach the downstream sink"
        );
        assert_eq!(
            ledger.tally(),
            LedgerTally {
                admitted: 1,
                suppressed: 1,
                coalesced: 1,
                stale_epoch: 1,
                // Every hint here is stamped after the commit anchor, so the
                // chronology arm is not on this test's path at all — the
                // literal says so rather than leaving it to be inferred.
                preceded_a_commit: 0,
                // Nothing here came through a serialized door: this test drives
                // the gate, which is `admit`'s. The literal says so, and the
                // round-7 fix round is why it can — a marker and a withholding
                // are decisions of their own now, countable apart from a
                // publication.
                marked: 0,
                withheld: 0,
            }
        );
    } // End of function the_gate_forwards_only_admitted_observations_and_numbers_them()

    #[test]
    fn the_downstream_sink_runs_outside_the_ledger_lock() {
        // A downstream sink is allowed to call back into the ledger, exactly as
        // it is allowed to call back into the session. Were the gate to hold
        // its guard across the call, this would deadlock against a mutex that
        // is not reentrant — so the verdict is taken on another thread and
        // bounded, and a regression fails as a timeout rather than hanging the
        // suite.
        let ledger = Arc::new(ledger_at_epoch(1));
        let (answers, reentered) = std::sync::mpsc::channel::<Option<AppWrite>>();
        let downstream: AdmittedSink = {
            let ledger = Arc::clone(&ledger);
            Arc::new(move |_| {
                let _ = answers.send(ledger.recorded_write(DocumentId(5)));
            })
        };
        let gate = admitting_sink(Arc::clone(&ledger), downstream);
        let path = Path::new("/tree/match/base.yml");
        record(&ledger, DocumentId(5), path, revision("committed"));

        std::thread::spawn(move || {
            gate(hinted(
                1,
                changed_at(Path::new("/tree/match/base.yml"), revision("external")),
            ));
        });
        match reentered.recv_timeout(PATIENCE) {
            Ok(seen) => assert_eq!(
                seen, None,
                "the re-entry read the ledger after the admission cleared the record"
            ),
            Err(RecvTimeoutError::Timeout) => {
                panic!("the downstream sink could not re-enter the ledger — the guard is held")
            }
            Err(other) => panic!("the gate thread died: {other:?}"),
        } // End of the match over the bounded re-entry verdict
    } // End of function the_downstream_sink_runs_outside_the_ledger_lock()

    #[test]
    fn a_committed_record_invalidates_the_announced_state_and_supersedes_itself() {
        // Round 1's second High, as its own sequence: `publish B → record A →
        // observe B → observe A`. Every step is a plain call on one thread, so
        // no interleaving is needed to reach it — which is what made it a
        // deterministic defect rather than a race.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(21);
        let ours = revision("what this application committed");
        let theirs = revision("what somebody else wrote");

        // 1. An external revision is admitted, so it becomes the published one.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(theirs)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(
            ledger.announced_state(path),
            Some(ObservedState::Content(theirs))
        );

        // 2. This application commits its own bytes over them.
        record(&ledger, document, path, ours);
        assert_eq!(
            ledger.announced_state(path),
            None,
            "a committed app write invalidates what was last announced for its path"
        );

        // 3. Its own hints are still suppressed, and the record survives them.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(ours)),
            Admission::SelfWrite
        );

        // 4. The post-commit external replacement — back to the very bytes that
        //    were published in step 1. Without the invalidation this coalesced
        //    into a `Duplicate`, reported nothing, and left the record standing.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(theirs)),
            Admission::Admitted { sequence: 2 },
            "a post-commit external replacement is an observation, not a duplicate"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "and it supersedes the record rather than leaving a stale one behind"
        );

        // 5. …so a genuine external revert to this application's own committed
        //    bytes is admitted too, rather than suppressed by that stale record.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(ours)),
            Admission::Admitted { sequence: 3 },
            "the bytes this application once committed are external now"
        );
        assert_eq!(ledger.tally().coalesced, 0, "nothing here was a duplicate");
    } // End of function a_committed_record_invalidates_the_announced_state_and_supersedes_itself()

    #[test]
    fn no_admission_can_decide_between_a_commit_and_its_record() {
        // Round 1's first High. The choreography is deterministic in both
        // directions and nothing here is timed: the watcher thread is released
        // into `admit` by a barrier, and the committing thread then waits — a
        // **positive** wait — until that admission has announced itself at the
        // commit gate. It cannot have decided, because the commit window holds
        // the gate. A build whose `admit` does not take the gate never
        // announces, so `await_a_waiter_at_the_gate` fails instead of racing.
        //
        // **The arm this ends in changed with the round-2 fix round, and the
        // claims did not.** A reading parked at the gate was necessarily taken
        // before the record the window takes, so it is now refused as older
        // (`PrecedesACommit`) rather than matched against the record
        // (`SelfWrite`). Both retain the record and publish nothing; what this
        // test exists to pin — that this application's own committed bytes are
        // never admitted as external, and that the parked thread really was
        // parked — is unchanged.
        let ledger = Arc::new(ledger_at_epoch(1));
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(31);
        let committed = revision("the bytes this application committed");
        // The worker's stamp: taken before the reads, therefore before the
        // window below. `Instant::now()` inside the thread would be the same
        // side of the record, so it is taken here to say which side it is.
        let stabilized = Instant::now();

        let (answers, decided) = std::sync::mpsc::channel::<Admission>();
        let start = Arc::new(std::sync::Barrier::new(2));
        let watcher = {
            let ledger = Arc::clone(&ledger);
            let start = Arc::clone(&start);
            std::thread::spawn(move || {
                start.wait();
                let answer = ledger.admit(
                    1,
                    Path::new("/tree/match/base.yml"),
                    ObservedState::Content(committed),
                    stabilized,
                );
                let _ = answers.send(answer);
            })
        }; // End of the block spawning the admitting thread

        let gate = ledger.begin_commit();
        // Inside the window: the transaction's rename has happened and its
        // record has not been taken. This is the instant the interleaving needs.
        start.wait();
        await_a_waiter_at_the_gate(&ledger);
        ledger.record_app_write(&gate, document, path, committed);
        drop(gate);

        let answer = decided
            .recv_timeout(PATIENCE)
            .expect("the parked admission must decide once the window closes");
        assert_eq!(
            answer,
            Admission::PrecedesACommit,
            "an admission parked at the gate decides against the record the window took"
        );
        watcher.join().expect("the admitting thread must not panic");
        assert_eq!(
            ledger.tally().admitted,
            0,
            "this application's own committed bytes were never admitted as external"
        );
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "a refusal retains the record"
        );
        assert_eq!(ledger.announced_state(path), None, "nothing was announced");
    } // End of function no_admission_can_decide_between_a_commit_and_its_record()

    #[test]
    fn a_reading_taken_before_a_commit_never_supersedes_its_record() {
        // **Round 2's High**, as the sequence the reviewer named:
        // `stabilize P → commit/record A → decide P → observe A`, with A
        // required to remain suppressible. Barrier-driven and deterministic:
        // the admitting thread is released into `admit` and parks at the gate,
        // and the committing thread waits — positively — until it is parked
        // before taking its record. So the decision is *after* the record while
        // the reading is *before* it, which is exactly the interleaving no gate
        // can prevent.
        //
        // This test replaces the round-1 fix round's
        // `an_external_admission_that_meets_a_commit_window_supersedes_its_record`,
        // whose scenario is this one and whose assertion was the round-2 defect
        // written down as a requirement: it demanded that the parked reading
        // clear the record, which is what makes the save's own hints foreign.
        // The half of round 1's finding that survives — a reading taken *after*
        // the commit does supersede the record — is step 5 below and
        // `a_different_revision_is_admitted_and_supersedes_the_record`.
        let ledger = Arc::new(ledger_at_epoch(1));
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(32);
        let committed = revision("the bytes this application committed");
        let before_the_save = revision("what the disk held before the save");
        let afterwards = revision("what somebody else wrote after the save");

        // 1. Stabilize P: the stamp a worker takes before the reads that settle
        //    the state the disk held before this application wrote anything.
        let stabilized = Instant::now();
        let (answers, decided) = std::sync::mpsc::channel::<Admission>();
        let start = Arc::new(std::sync::Barrier::new(2));
        let watcher = {
            let ledger = Arc::clone(&ledger);
            let start = Arc::clone(&start);
            std::thread::spawn(move || {
                start.wait();
                let answer = ledger.admit(
                    1,
                    Path::new("/tree/match/base.yml"),
                    ObservedState::Content(before_the_save),
                    stabilized,
                );
                let _ = answers.send(answer);
            })
        }; // End of the block spawning the admitting thread

        // 2. Commit and record A, with P parked at the gate for the whole
        //    window — proved by the positive wait, not assumed.
        let gate = ledger.begin_commit();
        start.wait();
        await_a_waiter_at_the_gate(&ledger);
        ledger.record_app_write(&gate, document, path, committed);
        drop(gate);

        // 3. Decide P. It read the disk before the rename, so it describes
        //    bytes this application has since replaced.
        assert_eq!(
            decided
                .recv_timeout(PATIENCE)
                .expect("the parked admission must decide once the window closes"),
            Admission::PrecedesACommit,
            "a reading this session cannot place after its own commit decides nothing"
        );
        watcher.join().expect("the admitting thread must not panic");
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "and above all it does not clear the record the window had just taken"
        );
        assert_eq!(
            ledger.announced_state(path),
            None,
            "nor does it publish bytes that are no longer on disk"
        );

        // 4. Observe A — the save's own native hints, which arrive after the
        //    record. **This is the whole point**: they must still be
        //    suppressible, or this application reports its own write as
        //    somebody else's.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::SelfWrite,
            "the save's own bytes are still this application's own write"
        );

        // 5. …and a genuine external replacement afterwards is still admitted
        //    and still supersedes the record: the refusal above is about the
        //    reading's age, never about the path being exempt.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(afterwards)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "a reading taken after the commit reports and supersedes"
        );
        assert_eq!(ledger.recorded_write(document), None);
        assert_eq!(
            ledger.tally(),
            LedgerTally {
                admitted: 1,
                suppressed: 1,
                coalesced: 0,
                stale_epoch: 0,
                preceded_a_commit: 1,
                marked: 0,
                withheld: 0,
            }
        );
    } // End of function a_reading_taken_before_a_commit_never_supersedes_its_record()

    #[test]
    fn a_reading_stamped_exactly_at_the_commit_anchor_is_refused() {
        // **Round 3's second High**, driven rather than reviewed. `Instant` is
        // documented monotonic and *not* documented strictly increasing, so two
        // ordered calls may answer the same value — and an equal stamp orders
        // nothing at all. A test cannot make the host clock collide on demand,
        // so it asks for the collision directly: the commit anchor's own
        // instant, read back and handed straight to `admit`, is exactly what a
        // coarse clock would have produced by itself.
        //
        // **The name says *anchor* since the round-9 fix round**, because the
        // value the comparison reads moved: it was a field of the record until
        // that round, and the record is now cleared without it.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(51);
        let committed = revision("the bytes this application committed");
        let theirs = revision("what somebody else wrote");
        record(&ledger, document, path, committed);
        let collided = ledger.commit_anchor(path).expect("the anchor was taken");

        assert_eq!(
            ledger.admit(1, path, ObservedState::Content(theirs), collided),
            Admission::PrecedesACommit,
            "an equal stamp does not prove the read followed the record"
        );
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "so it may not clear the record, which is what makes a save's own hints foreign"
        );
        assert_eq!(ledger.announced_state(path), None, "nor publish");
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::SelfWrite,
            "and the save's own bytes are still suppressible, which is the whole consequence"
        );

        // One nanosecond later is a different question, and it is answered:
        // the refusal is about what the stamp proves, never about the path.
        assert_eq!(
            ledger.admit(
                1,
                path,
                ObservedState::Content(theirs),
                collided + Duration::from_nanos(1)
            ),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(ledger.tally().preceded_a_commit, 1);
    } // End of function a_reading_stamped_exactly_at_the_commit_anchor_is_refused()

    #[test]
    fn a_serialized_door_reading_is_never_refused_by_a_commit_anchor() {
        // **Round 4's High** at this layer, and the discrimination that makes it
        // a property of the *door* rather than of the ledger going soft. The
        // path's commit anchor is put where no later clock read can beat it — a
        // collision and worse — and then the same ledger, the same path and the
        // same record are asked through both entry points.
        //
        // **The name says *anchor* since the round-9 fix round**: the instant
        // step 1 compares against moved out of the record and into a map whose
        // life is the epoch, and the name has to say which value cannot refuse
        // these doors.
        //
        // **What this proves is the serialized door's implementation, and not
        // the premise that licenses it** — round 5's second Low, and the name is
        // the half that was wrong. This test constructs a bare `WriteLedger`; it
        // owns no `WorkspaceSession` and locks nothing, so *the production
        // callers of this door hold the session lock* is established by the
        // call-graph audit in `docs/decisions/2d-3-notes.md` §10.1 **alone**,
        // and would stay green if a caller were moved outside `with_open`
        // tomorrow. §5 item 14's third half is the standing statement of that.
        //
        // **Since the round-7 fix round there are two serialized doors**, and
        // this test drives both: neither reads a clock, which is round 4's fix,
        // and neither publishes, which is round 7's.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(83);
        let committed = revision("the bytes this application committed");
        let theirs = revision("what somebody else wrote while the save ran");
        record(&ledger, document, path, committed);
        ledger.stamp_the_anchor_at(path, beyond_every_later_clock_read());

        // The marking door: it consults no instant, so no instant can refuse
        // what comes through it.
        assert_eq!(
            ledger.mark_under_the_session_lock(path, ObservedState::Content(theirs)),
            Admission::Marked,
            "the serialized door reads no clock, so no clock can refuse a reading through it"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "and it supersedes the record, exactly as any accepted different state does"
        );
        assert_eq!(
            ledger.announced_state(path),
            Some(ObservedState::Content(theirs)),
            "the external state is announced rather than lost"
        );
        assert_eq!(
            ledger.tally().admitted,
            0,
            "and announcing it spent no sequence, which is round 7's High"
        );

        // The withholding door, on a second path, against a record stamped the
        // same way: also unrefusable, and it announces nothing at all.
        let other = Path::new("/tree/match/other.yml");
        let another = DocumentId(84);
        record(&ledger, another, other, committed);
        ledger.stamp_the_anchor_at(other, beyond_every_later_clock_read());
        assert_eq!(
            ledger.withhold_under_the_session_lock(other, ObservedState::Content(theirs)),
            Admission::Withheld,
            "neither serialized door reads a clock"
        );
        assert_eq!(
            ledger.recorded_write(another),
            None,
            "and this one supersedes the record too, which is the whole of what it does"
        );
        assert_eq!(
            ledger.announced_state(other),
            None,
            "it announces nothing: nobody was shown this state, so nothing may coalesce against it"
        );
        assert_eq!(
            ledger.tally().preceded_a_commit,
            0,
            "no clock decided anything on this path"
        );

        // The watcher path, against a record stamped exactly the same way: still
        // refused, because a worker thread can prove nothing about when its
        // reads happened beyond the stamp it carries.
        let again = revision("a second external state");
        record(&ledger, document, path, committed);
        ledger.stamp_the_anchor_at(path, beyond_every_later_clock_read());
        assert_eq!(
            ledger.admit(1, path, ObservedState::Content(again), Instant::now()),
            Admission::PrecedesACommit,
            "the stamped door is unchanged: this reading cannot be placed after the commit"
        );
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "so it retains the record, which is what keeps the save's own hints suppressible"
        );
        assert_eq!(ledger.tally().preceded_a_commit, 1);
    } // End of function a_serialized_door_reading_is_never_refused_by_a_commit_anchor()

    #[test]
    fn a_refused_stabilized_state_is_re_observed_rather_than_lost() {
        // **Round 3's first High**, as the engine-plus-ledger sequence it asked
        // for, and deterministic: one real temp tree, one real engine whose
        // clock is an argument, the real `admitting_sink`, and the real
        // `crate::watch::deliver` the worker loop calls. No thread and no sleep.
        //
        // The scenario is the finding's: an external write stabilizes, `tick`
        // installs it as the engine's tracked state, this application then
        // commits and records a different revision, and the stabilized reading
        // is refused as older. Before the fix the engine kept believing it had
        // announced that state, so the second round below produced **nothing**
        // and the external change was lost with native delivery working
        // perfectly.
        use espansoconfig_core::watch::engine::{
            EngineConfig, FsWatchSource, Millis, ObservationEngine,
        };

        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let path = root.join("match/base.yml");
        let before = "matches: []\n";
        let theirs = "matches:\n  - trigger: ':theirs'\n    replace: theirs\n";
        std::fs::write(&path, before).expect("the tracked file");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");

        let ledger = Arc::new(ledger_at_epoch(1));
        let (sender, received) = std::sync::mpsc::channel::<AdmittedObservation>();
        let downstream: AdmittedSink = Arc::new(move |admitted| {
            let _ = sender.send(admitted);
        });
        let sink = admitting_sink(Arc::clone(&ledger), downstream);
        let document = DocumentId(61);
        let ours = revision("the bytes this application committed");

        // 1. An external writer replaces the file, and the engine stabilizes on
        //    it: two reads in two passes, the second stamped as the worker
        //    stamps it — before the reads of that pass.
        std::fs::write(&path, theirs).expect("an external replacement");
        engine.hint(&path, Millis(0));
        assert!(engine.tick(Millis(200), &mut source).is_empty());
        let stamped_before_the_record = Instant::now();
        let settled = engine.tick(Millis(240), &mut source);
        assert_eq!(settled.len(), 1, "one stabilized observation: {settled:?}");

        // 2. This application commits and records **after** that stamp and
        //    before the observation is decided. No thread is needed: the stamp
        //    is a value, and taking the record after it is the whole scenario.
        record(&ledger, document, &path, ours);

        // 3. Deliver the pass. The reading cannot be placed after the commit,
        //    so it decides nothing — and the settlement it produced is taken
        //    back rather than left standing.
        crate::watch::deliver(
            &mut engine,
            &sink,
            1,
            stamped_before_the_record,
            Millis(240),
            settled,
        );
        assert!(
            received.try_recv().is_err(),
            "a refused reading reaches no consumer"
        );
        assert_eq!(ledger.tally().preceded_a_commit, 1);
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: ours
            }),
            "and it does not clear the record"
        );
        assert_eq!(
            engine.revision_of(&path),
            Some(ContentRevision::of_bytes(before.as_bytes())),
            "the engine no longer believes it announced the refused state"
        );

        // 4. The path is pending again, and the same bytes — nobody wrote the
        //    file in between — stabilize a second time, now stamped after the
        //    record. **This is the assertion the whole test exists for**:
        //    without the revert the engine coalesces here and emits nothing.
        assert!(engine.tick(Millis(440), &mut source).is_empty());
        let stamped_after_the_record = later_than_now();
        let again = engine.tick(Millis(480), &mut source);
        assert_eq!(
            again.len(),
            1,
            "the refused external state is observed again: {again:?}"
        );
        crate::watch::deliver(
            &mut engine,
            &sink,
            1,
            stamped_after_the_record,
            Millis(480),
            again,
        );
        let admitted = received
            .try_recv()
            .expect("the second stabilization is admitted");
        assert_eq!(admitted.sequence, FIRST_OBSERVATION_SEQUENCE);
        assert_eq!(observed_path(&admitted.observation), path);
        assert_eq!(
            observed_state(&admitted.observation),
            ObservedState::Content(ContentRevision::of_bytes(theirs.as_bytes())),
            "and it carries the external writer's bytes, not this application's"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "an accepted external state supersedes the record, as it always did"
        );
    } // End of function a_refused_stabilized_state_is_re_observed_rather_than_lost()

    #[test]
    fn a_removal_the_save_path_could_not_read_is_stabilized_and_admitted() {
        // **Round 5's High**, as the engine-plus-ledger sequence its closure
        // rests on, and deterministic: one real temp tree, one real engine whose
        // clock is an argument, the real `admitting_sink`, and the real
        // `crate::watch::deliver` the worker loop calls. No thread and no sleep.
        //
        // The scenario is the finding's. This application commits revision A and
        // records it; an external process removes the file before `after_a_save`
        // re-reads it; `Workspace::refresh` raises, so **the save path publishes
        // nothing and clears nothing** — `commands.rs`'s
        // `a_failed_post_save_refresh_asks_for_a_re_observation_and_publishes_nothing`
        // is that half. What it does instead is ask the watcher, and the owed
        // request below is exactly what `WatchWorker::schedule_paths` makes of
        // that request.
        // This is the other half: the removal is stabilized by **two** reads,
        // admitted through the **stamped** door, and only then does the record
        // go — because the file no longer holds what this application committed,
        // so an entry naming A would from here on suppress somebody else's
        // recreation of those exact bytes.
        use espansoconfig_core::watch::engine::{
            EngineConfig, FsWatchSource, Millis, ObservationEngine,
        };

        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let path = root.join("match/base.yml");
        let ours = "matches:\n  - trigger: ':ours'\n    replace: ours\n";
        std::fs::write(&path, ours).expect("the committed file");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");

        let ledger = Arc::new(ledger_at_epoch(1));
        let (sender, received) = std::sync::mpsc::channel::<AdmittedObservation>();
        let downstream: AdmittedSink = Arc::new(move |admitted| {
            let _ = sender.send(admitted);
        });
        let sink = admitting_sink(Arc::clone(&ledger), downstream);
        let document = DocumentId(97);
        let committed = ContentRevision::of_bytes(ours.as_bytes());

        // 1. The commit and its record, exactly as `commit_and_record` takes it.
        record(&ledger, document, &path, committed);

        // 2. The external removal, and the refresh that could not read it. The
        //    save path admits nothing here; all it does is ask the watcher, and
        //    the owed request below is the one line `WorkerMessage::ReObserve`
        //    becomes (`WatchWorker::schedule_paths`, since the round-6 fix round
        //    — it was a plain hint before, and this path was tracked, so this
        //    particular scenario settles the same either way).
        std::fs::remove_file(&path).expect("an external removal");
        engine.observe_owed(&path, Millis(0));
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "the premise: the failed read left the record exactly as the save took it"
        );

        // 3. The ordinary two-read pipeline. One read is not enough — that is
        //    the whole reason the failed refresh may not publish — so the first
        //    pass settles nothing.
        assert!(
            engine.tick(Millis(200), &mut source).is_empty(),
            "one read is not stability"
        );
        let read_after = later_than_now();
        let settled = engine.tick(Millis(240), &mut source);
        assert_eq!(settled.len(), 1, "one stabilized observation: {settled:?}");

        crate::watch::deliver(&mut engine, &sink, 1, read_after, Millis(240), settled);
        let admitted = received
            .try_recv()
            .expect("the stabilized removal reaches the consumer");
        assert_eq!(
            observed_state(&admitted.observation),
            ObservedState::Absent,
            "and it is the removal, stabilized rather than guessed"
        );
        assert_eq!(observed_path(&admitted.observation), path);
        assert_eq!(admitted.sequence, FIRST_OBSERVATION_SEQUENCE);
        assert_eq!(
            ledger.announced_state(&path),
            Some(ObservedState::Absent),
            "the state enters the sequence through the stamped door, once"
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "and only an accepted stabilized state supersedes the record"
        );
        assert_eq!(ledger.tally().preceded_a_commit, 0);
    } // End of function a_removal_the_save_path_could_not_read_is_stabilized_and_admitted()

    #[test]
    fn a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does() {
        // **Round 6's second High and round 7's**, as the engine-plus-ledger
        // sequence they need, and deterministic: one real temp tree, one real
        // engine whose clock is an argument, the real `admitting_sink` and the
        // real `crate::watch::deliver`. No thread and no sleep.
        //
        // The scenario is the sharpest ordering of round 6's finding. A save-path
        // refresh is a **single** read, so a foreign non-atomic write in
        // progress can hand it an intermediate state that never stably existed —
        // and the commit gate serializes *decisions*, not reads, so that
        // decision can land **after** the engine has already admitted the
        // writer's final state. Until round 7 the tail *published* there, so the
        // phantom was the last word in the sequence as well as in the coalescing
        // map, and a 2d-4 drain landing before the correction would have acted on
        // it. **Now it marks**: the state is announced, because consult Q5 needs a
        // native duplicate at it to coalesce, and **no sequence is spent**, so
        // nothing that never stably existed is ever numbered.
        //
        // **The owed request is what puts the truth in the sequence, and an
        // ordinary hint could not**: the engine already tracks the final state,
        // so a hint stabilizes to it and coalesces to nothing inside the engine,
        // leaving the path announced as the phantom forever.
        use espansoconfig_core::watch::engine::{
            EngineConfig, FsWatchSource, Millis, ObservationEngine,
        };

        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let path = root.join("match/base.yml");
        let ours = "matches:\n  - trigger: ':ours'\n    replace: ours\n";
        let theirs = "matches:\n  - trigger: ':theirs'\n    replace: theirs\n";
        std::fs::write(&path, ours).expect("the committed file");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");

        let ledger = Arc::new(ledger_at_epoch(1));
        let (sender, received) = std::sync::mpsc::channel::<AdmittedObservation>();
        let downstream: AdmittedSink = Arc::new(move |admitted| {
            let _ = sender.send(admitted);
        });
        let sink = admitting_sink(Arc::clone(&ledger), downstream);
        let document = DocumentId(131);
        let committed = ContentRevision::of_bytes(ours.as_bytes());
        let final_state = ContentRevision::of_bytes(theirs.as_bytes());
        // The intermediate: bytes the writer had put down when the save's single
        // read happened, and that never stably existed.
        let phantom = ContentRevision::of_bytes(b"matches:\n  - trigger: ':theirs'\n");

        // 1. The commit and its record.
        record(&ledger, document, &path, committed);

        // 2. The writer finishes, and the watcher settles on the final state
        //    through its ordinary two reads. The ledger admits it: sequence 1.
        std::fs::write(&path, theirs).expect("the foreign writer finishing");
        engine.hint(&path, Millis(0));
        assert!(engine.tick(Millis(200), &mut source).is_empty());
        let read_after = later_than_now();
        let settled = engine.tick(Millis(240), &mut source);
        crate::watch::deliver(&mut engine, &sink, 1, read_after, Millis(240), settled);
        assert_eq!(
            received
                .try_recv()
                .expect("the stabilized final state reaches the consumer")
                .sequence,
            FIRST_OBSERVATION_SEQUENCE
        );
        assert_eq!(
            ledger.announced_state(&path),
            Some(ObservedState::Content(final_state))
        );

        // 3. Only now does the save tail decide, on the intermediate it read
        //    earlier. It **marks** and spends nothing: the phantom is the last
        //    word in the coalescing map, which is what Q5's duplicate rule
        //    needs, and it is not in the sequence at all, which is round 7's
        //    High.
        assert_eq!(
            ledger.mark_under_the_session_lock(&path, ObservedState::Content(phantom)),
            Admission::Marked
        );
        assert_eq!(
            ledger.announced_state(&path),
            Some(ObservedState::Content(phantom)),
            "the premise: a state that never stably existed is what the path now holds here"
        );
        assert_eq!(
            ledger.tally().admitted,
            1,
            "and it is announced without being numbered: no second sequence was spent"
        );

        // 4. The save tail asked for a stabilized reading in the same breath.
        //    The engine already tracks the final state, so this is exactly the
        //    case a plain hint answers with silence.
        engine.observe_owed(&path, Millis(400));
        assert!(engine.tick(Millis(600), &mut source).is_empty());
        let read_after = later_than_now();
        let answered = engine.tick(Millis(640), &mut source);
        assert_eq!(
            answered.len(),
            1,
            "the debt is answered even though nothing changed: {answered:?}"
        );
        crate::watch::deliver(&mut engine, &sink, 1, read_after, Millis(640), answered);
        let admitted = received
            .try_recv()
            .expect("and the stabilized state reaches the consumer again");
        assert_eq!(
            admitted.sequence,
            FIRST_OBSERVATION_SEQUENCE + 1,
            "the second sequence this epoch spends is the engine's, not the phantom's"
        );
        assert_eq!(
            observed_state(&admitted.observation),
            ObservedState::Content(final_state)
        );
        assert_eq!(
            ledger.announced_state(&path),
            Some(ObservedState::Content(final_state)),
            "so the last word on this path is a state the engine read twice"
        );
        let tally = ledger.tally();
        assert_eq!(
            (tally.admitted, tally.marked),
            (2, 1),
            "two publications and one marker: the phantom never entered the sequence, {tally:?}"
        );
    } // End of function a_marked_single_read_spends_no_sequence_and_the_stabilized_state_does()

    #[test]
    fn a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not() {
        // **Round 7's High, as the discrimination between its two doors**, and
        // the reason the review's own remedy could not be taken as written: it
        // asked for "a separate provisional save-conflict marker for Q5
        // duplicate suppression" from *both* save tails, and only one of them
        // may have one.
        //
        // The two paths below are the same sequence of events — a single
        // save-path read of some state, then the engine stabilizing on exactly
        // that state — and they must end differently:
        //
        // - `conflict_after_the_lock`'s read is **shown to the person**, in the
        //   conflict payload. Consult Q5 rules that a native duplicate at the
        //   same document and revision is coalesced rather than raised as a
        //   second conflict, so the stabilized twin must coalesce;
        // - `after_a_save`'s read is shown to **nobody** — the answer it returns
        //   is a `Saved`, which carries no disk side. A marker there would
        //   coalesce the engine's own stabilized reading into silence, and
        //   consult Q2's *the differing post-save observation is queued as
        //   external* would be met by nothing at all. That is round 3's
        //   swallowed-change defect reached from the other side, and it is why
        //   the withholding door exists.
        //
        // Neither read may spend a sequence, which is the High itself: the only
        // number handed out here is the stabilized reading's, on the second
        // path.
        let ledger = ledger_at_epoch(1);
        let shown = Path::new("/tree/match/shown.yml");
        let unshown = Path::new("/tree/match/unshown.yml");
        let state = ObservedState::Content(revision("what one read of the disk answered"));

        assert_eq!(
            ledger.mark_under_the_session_lock(shown, state),
            Admission::Marked
        );
        assert_eq!(
            admit_now(&ledger, 1, shown, state),
            Admission::Duplicate,
            "Q5: the person has this state already, so the stabilized twin coalesces"
        );

        assert_eq!(
            ledger.withhold_under_the_session_lock(unshown, state),
            Admission::Withheld
        );
        assert_eq!(
            admit_now(&ledger, 1, unshown, state),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "Q2: nobody has this state, so the stabilized reading is queued as external"
        );

        let tally = ledger.tally();
        assert_eq!(
            (
                tally.admitted,
                tally.marked,
                tally.withheld,
                tally.coalesced
            ),
            (1, 1, 1, 1),
            "one sequence spent in all, and it is the engine's reading, {tally:?}"
        );
    } // End of function a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not()

    #[test]
    fn a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes() {
        // **Round 8's High**, as the two doors' halves of it, and the ledger
        // reaches the scenario with no watcher, no thread and no clock: the
        // record goes stale because nothing outside this module keeps it fresh.
        // `crate::commands::reload_document` accepts a foreign revision into the
        // workspace and touches the ledger not at all, and a save that answers
        // `committed: false` records nothing, so an earlier commit's entry is
        // still standing when a save tail reads exactly those bytes back.
        //
        // Before the fix both doors answered `SelfWrite` there: the marking door
        // lost consult Q5's coalescing entry, and the withholding door — whose
        // *only* effect is the record removal — did nothing at all, so the owed
        // stabilized reading it asks for met the same record and was suppressed
        // in its turn.
        let ledger = ledger_at_epoch(1);
        let shown = Path::new("/tree/match/shown.yml");
        let unshown = Path::new("/tree/match/unshown.yml");
        let marking = DocumentId(97);
        let withholding = DocumentId(98);
        // A: what this application committed, and what the record still names.
        let ours = revision("the bytes an earlier save of this session committed");

        // The marking door: `conflict_after_the_lock` refreshing a file whose
        // disk state is the recorded revision.
        record(&ledger, marking, shown, ours);
        assert_eq!(
            ledger.mark_under_the_session_lock(shown, ObservedState::Content(ours)),
            Admission::Marked,
            "a serialized reading is not one of the native hints suppression absorbs"
        );
        assert_eq!(
            ledger.recorded_write(marking),
            None,
            "and it supersedes the record it was decided against"
        );
        assert_eq!(
            ledger.announced_state(shown),
            Some(ObservedState::Content(ours)),
            "consult Q5's coalescing entry is installed, which a `SelfWrite` withheld"
        );
        // …and the marker takes the suppression job over: a native hint at those
        // bytes is silent through a different counter.
        assert_eq!(
            admit_now(&ledger, 1, shown, ObservedState::Content(ours)),
            Admission::Duplicate,
            "the app's own pending hints still reach a consumer not at all"
        );

        // The withholding door: `after_a_save` refreshing after a save that
        // committed nothing, and finding the recorded bytes rather than the
        // revision its transaction last saw.
        record(&ledger, withholding, unshown, ours);
        assert_eq!(
            ledger.withhold_under_the_session_lock(unshown, ObservedState::Content(ours)),
            Admission::Withheld,
            "the same exemption, on the door whose only effect is the record"
        );
        assert_eq!(
            ledger.recorded_write(withholding),
            None,
            "the record removal is this door's whole effect, and a `SelfWrite` skipped it"
        );
        assert_eq!(
            ledger.announced_state(unshown),
            None,
            "it announces nothing, so nothing pre-coalesces the reading it asked for"
        );
        // The half the finding turns on: the owed stabilized reading of exactly
        // those bytes is now queued as external (consult Q2) rather than
        // suppressed by the record this door has just cleared.
        assert_eq!(
            admit_now(&ledger, 1, unshown, ObservedState::Content(ours)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "Q2: the differing post-save observation reaches the sequence"
        );

        // **The discrimination, in the same test**: the check was narrowed to
        // one door and not removed. The same record and the same bytes, through
        // the stamped door, are still the several native hints one atomic
        // replacement generates, and they still meet the retained entry.
        let hinted = Path::new("/tree/match/hinted.yml");
        let stamped = DocumentId(99);
        record(&ledger, stamped, hinted, ours);
        assert_eq!(
            admit_now(&ledger, 1, hinted, ObservedState::Content(ours)),
            Admission::SelfWrite,
            "consult Q2's suppression is unchanged where a native hint is what asks"
        );
        assert_eq!(
            ledger.recorded_write(stamped),
            Some(AppWrite {
                epoch: 1,
                revision: ours
            }),
            "and it retains the record, so the next hint of the same replacement meets it too"
        );

        let tally = ledger.tally();
        assert_eq!(
            (
                tally.suppressed,
                tally.marked,
                tally.withheld,
                tally.coalesced,
                tally.admitted
            ),
            (1, 1, 1, 1, 1),
            "one suppression, and its door is the stamped one, {tally:?}"
        );
    } // End of function a_stale_record_never_suppresses_a_serialized_reading_of_its_own_bytes()

    #[test]
    fn a_reading_of_an_absence_taken_before_a_commit_is_refused_too() {
        // The chronology check is deliberately **not** narrowed to `Content`,
        // unlike the suppression predicate below it. A stale reading of an
        // absence or of an unreadable state would otherwise clear the record of
        // a file this application has since committed — round 2's High with a
        // different state in it — and then the save's own hints would be
        // admitted as foreign exactly as before. No thread is needed: the stamp
        // is a value, and taking it before the record is the whole scenario.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(41);
        let committed = revision("the bytes this application committed");

        let stabilized = Instant::now();
        record(&ledger, document, path, committed);

        for state in [
            ObservedState::Absent,
            ObservedState::Unreadable(io::ErrorKind::PermissionDenied),
        ] {
            assert_eq!(
                ledger.admit(1, path, state, stabilized),
                Admission::PrecedesACommit,
                "a reading of {state:?} taken before the commit decides nothing"
            );
        } // End of the loop over the two states the predicate never sees
        assert_eq!(
            ledger.recorded_write(document),
            Some(AppWrite {
                epoch: 1,
                revision: committed
            }),
            "the record stands, so the save's own hints are still suppressible"
        );
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(committed)),
            Admission::SelfWrite
        );
        // …while a reading of the same absence taken afterwards is an ordinary
        // observation, which is what makes the refusal above about age.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Absent),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            }
        );
        assert_eq!(ledger.recorded_write(document), None);
    } // End of function a_reading_of_an_absence_taken_before_a_commit_is_refused_too()

    #[test]
    fn a_reload_that_accepts_other_bytes_ends_the_records_suppression_licence() {
        // **Round 9's first High**, as the reviewer's own regression: record A,
        // reload B, and the owed stabilized reading of A must be **admitted**
        // rather than suppressed. Nothing outside this module kept the record
        // describing what the session believed, so the one door still allowed to
        // suppress met an entry a reload had made stale and answered `SelfWrite`
        // to a genuine external return to those bytes.
        //
        // **The second half is the discrimination**, and it is the one part of
        // §14.2's rejection round 9 leaves standing: a reload that read exactly
        // the recorded bytes must **keep** the record, because that write's own
        // pending native hints have nothing else to absorb them and unsuppressing
        // them would report this application's own commit as somebody else's.
        let ledger = ledger_at_epoch(1);
        let moved_on = Path::new("/tree/match/moved-on.yml");
        let unchanged = Path::new("/tree/match/unchanged.yml");
        let reloaded_away = DocumentId(140);
        let reloaded_onto = DocumentId(141);
        let ours = revision("the bytes an earlier save of this session committed");
        let theirs = revision("the bytes the person reloaded into the workspace");

        record(&ledger, reloaded_away, moved_on, ours);
        ledger.adopt_reloaded_revision_under_the_session_lock(moved_on, theirs);
        assert_eq!(
            ledger.recorded_write(reloaded_away),
            None,
            "the licence has outlived the last reading that could honestly spend it"
        );
        assert_eq!(
            admit_now(&ledger, 1, moved_on, ObservedState::Content(ours)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "the external return to the recorded bytes enters the sequence"
        );

        record(&ledger, reloaded_onto, unchanged, ours);
        ledger.adopt_reloaded_revision_under_the_session_lock(unchanged, ours);
        assert_eq!(
            ledger.recorded_write(reloaded_onto),
            Some(AppWrite {
                epoch: 1,
                revision: ours
            }),
            "a reload that read the recorded bytes leaves the licence exactly where it was"
        );
        assert_eq!(
            admit_now(&ledger, 1, unchanged, ObservedState::Content(ours)),
            Admission::SelfWrite,
            "so this application's own commit is still not reported as somebody else's"
        );

        let tally = ledger.tally();
        assert_eq!(
            (tally.admitted, tally.suppressed, tally.coalesced),
            (1, 1, 0),
            "one admission and one suppression, and the reload decided which is which, {tally:?}"
        );
    } // End of function a_reload_that_accepts_other_bytes_ends_the_records_suppression_licence()

    #[test]
    fn a_reload_that_accepts_other_bytes_invalidates_the_announced_state() {
        // **Round 9's third High**, as the reviewer's own regression: announce B,
        // reload C, and the disk returning to B must be a **new admission**
        // rather than a `Duplicate`. The coalescing map answers *does a consumer
        // already have this state*, and after a reload the answer for the old
        // entry is no — while `Duplicate` sends 2d-5 no value to arbitrate, which
        // is why deferring this to that layer could not work.
        //
        // **The second half is consult Q5's**, and it is why the condition is
        // *differs* rather than *any reload*: choosing *Reload disk version* on a
        // save conflict is exactly a reload onto the marked state, and the marker
        // `crate::commands::conflict_after_the_lock` installed has to survive it
        // or the native duplicate Q5 rules is coalesced becomes a second
        // conflict.
        let ledger = ledger_at_epoch(1);
        let navigated_away = Path::new("/tree/match/navigated.yml");
        let reloaded_onto = Path::new("/tree/match/confirmed.yml");
        let told = revision("the state a consumer was told about");
        let elsewhere = revision("what the person then reloaded");

        assert_eq!(
            admit_now(&ledger, 1, navigated_away, ObservedState::Content(told)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "the premise: a publication announced this state"
        );
        ledger.adopt_reloaded_revision_under_the_session_lock(navigated_away, elsewhere);
        assert_eq!(
            ledger.announced_state(navigated_away),
            None,
            "the entry stopped answering its own question when the workspace moved past it"
        );
        assert_eq!(
            admit_now(&ledger, 1, navigated_away, ObservedState::Content(told)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE + 1
            },
            "so the disk returning to those bytes is news and is numbered"
        );

        assert_eq!(
            ledger.mark_under_the_session_lock(reloaded_onto, ObservedState::Content(told)),
            Admission::Marked,
            "the premise: a save conflict's disk side is marked for coalescing"
        );
        ledger.adopt_reloaded_revision_under_the_session_lock(reloaded_onto, told);
        assert_eq!(
            ledger.announced_state(reloaded_onto),
            Some(ObservedState::Content(told)),
            "a reload onto the marked state confirms it rather than invalidating it"
        );
        assert_eq!(
            admit_now(&ledger, 1, reloaded_onto, ObservedState::Content(told)),
            Admission::Duplicate,
            "consult Q5: the native duplicate at that revision is still coalesced"
        );

        let tally = ledger.tally();
        assert_eq!(
            (tally.admitted, tally.coalesced, tally.marked),
            (2, 1, 1),
            "two admissions of the same bytes, one of them because of the reload, {tally:?}"
        );
    } // End of function a_reload_that_accepts_other_bytes_invalidates_the_announced_state()

    #[test]
    fn a_commit_anchor_outlives_the_record_it_was_taken_with() {
        // **Round 9's second High**, as the engine-plus-ledger sequence it needs,
        // and deterministic: one real temp tree, one real engine whose clock is
        // an argument, the real `admitting_sink` and the real
        // `crate::watch::deliver`. No thread and no sleep.
        //
        // The scenario is the finding's. A settlement is produced **before** a
        // commit and delivered **after** a serialized reading has cleared that
        // commit's record — the clearing extension the round-8 fix round added.
        // Until round 9 the chronology anchor was a field of that record, so
        // clearing it left the delayed settlement nothing to be refused by, and
        // bytes the commit had since replaced were published. Nothing bounds the
        // delay: only the settlement's *production* is pre-commit, and its
        // delivery waits on thread scheduling and gate contention.
        //
        // The path now keeps its anchor until the epoch is replaced, so the
        // refusal still
        // happens — and, being a refusal, it is **answered**: the engine's
        // settlement is taken back and the path is observed again.
        use espansoconfig_core::watch::engine::{
            EngineConfig, FsWatchSource, Millis, ObservationEngine,
        };

        let dir = tempfile::TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        std::fs::create_dir_all(root.join("match")).expect("the watched root");
        let path = root.join("match/base.yml");
        let before = "matches: []\n";
        let theirs = "matches:\n  - trigger: ':theirs'\n    replace: theirs\n";
        std::fs::write(&path, before).expect("the tracked file");

        let mut source = FsWatchSource;
        let mut engine = ObservationEngine::start(&root, EngineConfig::default(), &mut source)
            .expect("a baseline scan");

        let ledger = Arc::new(ledger_at_epoch(1));
        let (sender, received) = std::sync::mpsc::channel::<AdmittedObservation>();
        let downstream: AdmittedSink = Arc::new(move |admitted| {
            let _ = sender.send(admitted);
        });
        let sink = admitting_sink(Arc::clone(&ledger), downstream);
        let document = DocumentId(142);
        let ours = revision("the bytes this application committed");

        // 1. The settlement, produced before anything else: two reads, and the
        //    stamp a worker takes before the pass that produced them.
        std::fs::write(&path, theirs).expect("an external replacement");
        engine.hint(&path, Millis(0));
        assert!(engine.tick(Millis(200), &mut source).is_empty());
        let stamped_before_the_commit = Instant::now();
        let settled = engine.tick(Millis(240), &mut source);
        assert_eq!(settled.len(), 1, "one stabilized observation: {settled:?}");

        // 2. The commit and its record, taken after that stamp.
        record(&ledger, document, &path, ours);

        // 3. **The serialized clearing**, which is the round-8 extension: a save
        //    tail reads exactly the recorded bytes and the withholding door
        //    clears the record without announcing anything.
        assert_eq!(
            ledger.withhold_under_the_session_lock(&path, ObservedState::Content(ours)),
            Admission::Withheld
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "the premise: the record is gone, so the anchor is all that is left"
        );

        // 4. Only now is the delayed settlement delivered. Its reads preceded the
        //    commit, so it may not publish bytes the commit replaced.
        crate::watch::deliver(
            &mut engine,
            &sink,
            1,
            stamped_before_the_commit,
            Millis(240),
            settled,
        );
        assert!(
            received.try_recv().is_err(),
            "a pre-commit reading reaches no consumer, record or no record"
        );
        assert_eq!(ledger.tally().preceded_a_commit, 1);
        assert_eq!(
            ledger.announced_state(&path),
            None,
            "and it announces nothing, so nothing coalesces the correction away"
        );
        assert_eq!(
            engine.revision_of(&path),
            Some(ContentRevision::of_bytes(before.as_bytes())),
            "the refusal was answered: the engine no longer believes it announced that state"
        );

        // 5. The correction, which is what makes the refusal a deferral: the same
        //    bytes stabilize again, now stamped after the commit, and are
        //    admitted.
        assert!(engine.tick(Millis(440), &mut source).is_empty());
        let stamped_after_the_commit = later_than_now();
        let again = engine.tick(Millis(480), &mut source);
        assert_eq!(
            again.len(),
            1,
            "the refused state is observed again: {again:?}"
        );
        crate::watch::deliver(
            &mut engine,
            &sink,
            1,
            stamped_after_the_commit,
            Millis(480),
            again,
        );
        let admitted = received
            .try_recv()
            .expect("the second stabilization is admitted");
        assert_eq!(admitted.sequence, FIRST_OBSERVATION_SEQUENCE);
        assert_eq!(
            observed_state(&admitted.observation),
            ObservedState::Content(ContentRevision::of_bytes(theirs.as_bytes())),
            "and it carries the external writer's bytes"
        );
    } // End of function a_commit_anchor_outlives_the_record_it_was_taken_with()

    #[test]
    fn a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading() {
        // **Round 10's Low, driven.** [`LedgerTally::preceded_a_commit`] used to
        // say that on a healthy production path it stays zero. Since the round-9
        // fix round a path keeps its anchor until the epoch is replaced, so it
        // does not: nothing in
        // the interleaving below malfunctioned — a stable reading completes, the
        // worker that carries it is descheduled, this application commits and
        // records, a serialized decision clears that record, and only then is the
        // completed reading decided — and the counter moves. Debounce cannot
        // prevent it, because the reading was already produced when the commit
        // happened.
        //
        // **The ledger alone, with no engine and no filesystem**, because this
        // test is about *what the counter means*.
        // `a_commit_anchor_outlives_the_record_it_was_taken_with` drives the same
        // interleaving through the real engine and the real `deliver`, and what
        // it proves there is the anchor's lifetime and the settlement's revert.
        // The two assertions this one exists for are the ones that make a single
        // increment a healthy reading rather than a fault: nothing was lost, and
        // the counter does not move again.
        let ledger = ledger_at_epoch(1);
        let path = Path::new("/tree/match/base.yml");
        let document = DocumentId(211);
        let ours = revision("the bytes this application committed");
        let theirs = revision("what the watcher had already settled on");

        // 1. The stable reading, completed before anything else. `Instant` is
        //    monotonic and nondecreasing, so this value cannot be strictly
        //    greater than the anchor taken below whatever the host clock's
        //    resolution — and equality is on the refusing side anyway.
        let stamped_before_the_commit = Instant::now();

        // 2. The commit and its record, taken while that reading waited.
        record(&ledger, document, path, ours);

        // 3. A serialized decision clears the record — the round-8 clearing
        //    extension, here through the withholding door because that one
        //    announces nothing, so nothing below can coalesce against it.
        assert_eq!(
            ledger.withhold_under_the_session_lock(path, ObservedState::Content(ours)),
            Admission::Withheld
        );
        assert_eq!(
            ledger.recorded_write(document),
            None,
            "the premise: the record is gone, so the anchor is all that is left"
        );

        // 4. Only now is the completed reading decided.
        assert_eq!(
            ledger.admit(
                1,
                path,
                ObservedState::Content(theirs),
                stamped_before_the_commit
            ),
            Admission::PrecedesACommit,
            "a reading produced before the commit may not report bytes the commit could have replaced"
        );
        let spanning = ledger.tally();
        assert_eq!(
            spanning.preceded_a_commit, 1,
            "the counter moves, and no component in this story misbehaved: {spanning:?}"
        );
        assert_eq!(
            (
                spanning.admitted,
                spanning.suppressed,
                spanning.coalesced,
                spanning.stale_epoch
            ),
            (0, 0, 0, 0),
            "no publication, suppression, coalescing or stale-epoch decision was taken, \
             so the increment is not a misfiled one: {spanning:?}"
        );
        assert_eq!(
            spanning.withheld, 1,
            "step 3's withhold is the one other decision this test takes, and it is counted \
             where it belongs rather than here — round 11's Low was this message claiming \
             no other decision at all: {spanning:?}"
        );
        assert_eq!(
            ledger.announced_state(path),
            None,
            "the refusal published nothing, which is why it costs a re-reading rather than a change"
        );

        // 5. **What makes the increment healthy rather than a fault**: the same
        //    state, read again after the commit, is admitted, and the counter
        //    does not move a second time. A stamp taken in the wrong place would
        //    keep refusing this path — sustained growth is the diagnosis, and a
        //    single non-zero value cannot support it.
        //
        //    **The single re-reading here is this test's construction and not a
        //    production guarantee**, which is round 12's first High seen from
        //    the test side: `admit_now` stamps through `later_than_now`, which
        //    is `Instant::now()` plus a nanosecond and therefore *strictly*
        //    greater than the anchor by construction, while a production stamp
        //    merely follows the anchor in program order and `decide` refuses at
        //    equality — so a clock collision can refuse successive re-readings
        //    of one path against one anchor.
        assert_eq!(
            admit_now(&ledger, 1, path, ObservedState::Content(theirs)),
            Admission::Admitted {
                sequence: FIRST_OBSERVATION_SEQUENCE
            },
            "the refusal deferred the reading rather than dropping it"
        );
        assert_eq!(
            ledger.tally().preceded_a_commit,
            1,
            "one increment for one commit spanned: this anchor refuses this re-reading no second \
             time, because `later_than_now` puts the stamp strictly beyond it — a production stamp \
             equal to the anchor would be refused again, which is round 12's first High"
        );
    } // End of function a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading()
}
