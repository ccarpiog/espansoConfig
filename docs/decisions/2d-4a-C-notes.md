# Step 2d-4a-C-1 — the scoped-lifetime contract, and the pointers at it

**The observation pipeline's scoped-lifetime contract — the family of claims of the form *how long
does X survive, and under what scope* — is now stated in exactly one place, and 45 passages across
eight files in the two source trees point at it instead of restating it.** The contract is
`crates/espansoconfig-core/src/watch/retained_state.rs`.

This step is the analogue of **2d-3-C** for a different claim family, commissioned by owner decision
on 2026-08-27 (`PROGRESS.md`, "Next action"): the 2d-4a review tail is **paused at round 6** and the
mechanism is built first. **Step 1 is this — the contract and the pointers, with no check.** Step 2
owes the check: the shared prose-sweep machinery, the phrase family, the inventory, the
both-direction guard and the proof it fails, the way `src-tauri/src/liveness_contract.rs` covers
liveness.

`2d-4a-notes.md` §15.4 names the absence in one sentence — *"Nothing in the boundary or the watermark
wording is enforced mechanically"* — and §15.4's R8 paragraph predicts where round 7 will find its
next defect: **the epoch-scoped watermark wording, a new claim at nine positions**. Two consecutive
rounds found the same failure shape (a rule stated without the epoch that scopes it), and this step
found a **third instance one subsystem over**, in the ledger, which no round of this phase had
looked at (§4).

---

## 1. What was built, and why this and not something else

**One canonical statement.** The family was paraphrased at some fifty passages across the two trees.
The retention boundary alone stood at **twelve** positions (§14.2 of `2d-4a-notes.md`), the
epoch-scoped watermark at **nine** (§15.2), and R9's unbounded identity register at one in the core
and several in the shell. **Every paraphrase is a surface on which the claim can be false**, and
rounds 5 and 6 each showed one of them was. The remedy is not a better paraphrase; it is one
statement with pointers at it.

**It lives in the core crate, under `watch/`, beside `liveness.rs`**, and that was argued rather than
assumed. Four things decided it:

1. **A doc comment in the core can be reached from `src-tauri` by a rustdoc intra-doc link, which is
   compile-checked.** Both crates already carry `#![deny(rustdoc::broken_intra_doc_links)]`, so a
   rename or a deletion of the contract **breaks the build**. A contract module in `src-tauri` could
   not be pointed at from the core at all, and a markdown file under `docs/` could not be pointed at
   from anywhere in a checked way — a renamed heading orphans every reference silently, which is
   exactly the failure mode this step exists to remove. §8 records the probe that drove this to red.
2. **The family has a core-side member.** R9 — `espansoconfig_core::workspace`'s process-wide
   identity register, unbounded, unevicted, uncapped and unmeasured — is the clause the whole family
   is anchored on, and it is core-side. A `src-tauri` contract could not have carried it.
3. **A doc comment creates no dependency**, so CLAUDE.md §3 is not at risk:
   `cargo tree -p espansoconfig-core | rg tauri` is still empty (§8).
4. **`watch/` rather than the crate root**, because `liveness.rs` is already there and does exactly
   this job for exactly this pipeline. A reader who has found one finds the other. The two modules
   are the same shape — no type, no function, no constant; the module documentation *is* the item.

**The tension, stated rather than smoothed over.** Two of the three holders of retained pipeline
state are the **application shell's** — the write ledger and the reconciliation queue — and the core
does not own either. It states their lifetime rules anyway, for `liveness.rs`'s own reason: the
halves are one contract, and keeping them apart is what let a paraphrase of one be written as a claim
about the other. Where the item a clause is derived from lives in `src-tauri`, the contract names it
as **plain text** rather than as a link, exactly as `liveness.rs` names `ledger.rs`'s `decide`.

**Where the family's boundary is drawn, and why.** Around the **claims**, never around the vocabulary
of the mechanism — `liveness.rs`'s own principle, applied to a second family. The subject is
**retained pipeline state**: the values this application keeps *between* one observation and the next
so that a later observation, a later drain or a later save decision can be taken against them. There
are exactly three holders, and the family spans two crates because they do: the core's identity
register, the shell's write ledger, and the shell's reconciliation queue — plus the numbers derived
from them that a consumer stores.

`crates/espansoconfig-core/src/persist/backup.rs` has ~38 hits for retention vocabulary and is about
**backup-file rotation**, a different subsystem about files on disk; a pattern widened to every
occurrence of *retained* buys that noise and not one claim. So are the scopes the language already
keeps — a mutex guard, a borrow, a `NativeWatch` handle, a worker's inbox. §5 lists every position
judged out and the closest calls.

---

## 2. The contract, clause by clause, with the code each is derived from

Every clause was derived from the code by reading it, never from the existing prose — the existing
prose is what has been wrong three times in this phase. The contract's own text carries these
citations; this section is the audit trail for them.

### 2.1 What is guaranteed

| # | Clause | Derived from |
|---|---|---|
| G1 | A path's identity outlives every other scope in this application: one path answers one number for as long as the process runs, a workspace replacement, a new epoch and a recreation at that path included | `SessionIdentities::by_path` and `identity_of` in `crates/espansoconfig-core/src/workspace/mod.rs` — `identity_of` inserts on first sight and **no path in the file removes an entry**; `identity_already_issued` reads and mints nothing. `Workspace::document_id` is the separate question, and the two answers legitimately differ |
| G2 | Everything else the pipeline retains is scoped to one workspace epoch, and a replacement discards it whole | `WriteLedger::begin_epoch` clears `writes`, `documents_by_path`, `announced`, `latest_commit_at` and resets `next_sequence`; `ReconciliationQueue::begin_epoch` assigns a fresh `QueueState`, so `pending`, `acknowledged` and `discarded` go together. Both are called from `WorkspaceSession::open` in one session-lock block |
| G3 | A sequence is unique and strictly increasing within its epoch and means nothing across two | `FIRST_OBSERVATION_SEQUENCE`, `LedgerState::next_sequence` (reset by that same `begin_epoch`), and `Admission::Admitted`, the only decision that spends one — `decide`'s step 5 |
| G4 | A stored queue entry leaves in exactly three ways, and only the first two depend on the entry; the third is counted nowhere | `QueueState::pending` is mutated in exactly four places: `insert` and `remove` in `enqueue` (`reconciliation.rs:1090`, `:1095`), `retain` in `drain` (`:1186`), and the whole-state assignment in `begin_epoch`. **Established by reading every mutation of that field**, which is what the contract says of it |
| G5 | The pending set is bounded and the bound counts entries; a path with one pending entry is never the victim while another path has two | `QUEUE_CAPACITY` and `evictable_sequence`, whose `min_by_key((Reverse(count), lowest))` is the busiest-path rule and its tie-break |
| G6 | Within the epoch a batch names, `newest_sequence` never falls; across a replacement epoch it falls, and that is not a walk-back | `drain`'s `.max(guard.acknowledged)` over a `guard` that `begin_epoch` replaced whole, plus G3 — there is no order between two epochs' numbers for anything to walk backwards along |
| G7 | A batch's loss count is cumulative and monotonic within the epoch, and reads zero again in the successor | `QueueState::discarded`, incremented in `enqueue` alone (the watermark refusal and the overflow) and reset by `begin_epoch` |
| G8 | The ledger's decision tally is the one retained value whose life is the session | `LedgerState::tally` is the one field `WriteLedger::begin_epoch` does **not** touch — verified by reading its five statements |
| G9 | An app-write record lives as long as its suppression licence; a commit anchor lives as long as the epoch | The record: `writes.insert` in `record_app_write` (supersession), `clear_the_record_at` from `decide`'s step 3 and from `adopt_reloaded_revision_under_the_session_lock`, and `writes.clear()` in `begin_epoch`. The anchor: `latest_commit_at.clear()` in `begin_epoch` **alone** — `clear_the_record_at` does not touch it, and its own doc says so |

G4's *exactly three* and G8's *the one exception* both rest on **a reading and not on a test**, and
the contract says so in the same sentence that states them. That is deliberate: it is the honest form
of a claim nothing fails when a fifth mutation or a sixth field appears.

### 2.2 What is expressly NOT guaranteed

| # | Clause | Derived from |
|---|---|---|
| N1 | That the identity register is bounded. It grows by one entry per distinct path this process has ever named, and **nothing evicts from it, nothing caps it and nothing measures it** | `session_identities()`'s own *# Its size is unbounded* section, `Workspace::from_tree`'s `identity_of` per enumerated file, and `watch::engine`'s at every projection. This is **R9**, open by three review rounds' verdicts, and it is stated as the unbounded retention it is (requirement 7 of this step's brief) |
| N2 | That the ledger's per-epoch maps are bounded within their epoch | `announced` and `latest_commit_at` are emptied only by `begin_epoch`; entries leave one at a time where a path's fact stops being true. `2d-3-notes.md` §5 item 27 is the inherited residue |
| N3 | That the queue's bound is a bound on memory | `QUEUE_CAPACITY`'s own first paragraph: a `Changed` carries a whole file's text and its projection |
| N4 | That an eviction preserves any document's state | `QUEUE_CAPACITY`'s *"It still preserves no document"*, and `evictable_sequence`'s tie-break, which draws the victim from whichever equally busy path holds the lower sequence rather than from the one that caused the overflow — R10's round-6 correction |
| N5 | That a stored entry reaches a consumer | The overflow arm of `enqueue` and `begin_epoch`. The first is reported in `discarded` and obliges a whole-workspace reload; **nothing enforces that reading** (R4). The second is reported by the batch's epoch and counted nowhere |
| N6 | That a value describing one moment says anything over time | `QueueState::owed_wake` and `ReconciliationWake::newest_sequence` — swept and cleared by round 6 as exactly this, and now judged into the family rather than left uncounted |
| N7 | That two numbers from two epochs are comparable at all | G2 and G3 together |
| N8 | That any of this is measured | R9 (the register), R7 (the per-drain clone), and nothing anywhere counting the ledger's maps |

### 2.3 What the contract deliberately does not say

It says nothing about **whether anything will ever be observed again** — that is
`crate::watch::liveness`, the other contract this workspace states once, and the two meet nowhere
today. It says nothing about **backup-file retention** — `crate::persist::backup` rotates on a policy
of its own, neither derived from nor constrained by anything here. And it does not make a consumer
point rather than restate: **that is step 2's**.

---

## 3. The pointer inventory, with the judgement for each position

**A pointer replaces a paraphrase; it does not delete a local fact.** *Replaced + kept* means the
passage restated the contract and the restatement is gone while the local half stays; *kept +
pointer* means the passage is the clause's **source** and keeps its content, with the pointer naming
the contract as where the clauses are collected.

**45 passages now point**, verified by `rg -n 'retained_state'` over both trees.

### 3.1 `crates/espansoconfig-core` — the core side (4)

| Position | Judgement |
|---|---|
| `lib.rs`, `DocumentId`'s doc | **kept + pointer.** *Session-local identity of a file, for the life of the process* is G1 at the type every consumer holds; it is cited by the contract |
| `workspace/mod.rs`, `SessionIdentities` | **kept + pointer.** The primitive's own doc and G1's source. The pointer also names the contract as where *nothing bounds this table* is stated once instead of at each reader |
| `workspace/mod.rs`, `session_identities()`'s *# Its size is unbounded* | **kept + pointer.** N1's source, and the honest paragraph round 4 of this phase's review wrote. Nothing in it is weakened |
| `workspace/mod.rs`, `identity_already_issued` | **kept + pointer.** *It is not scoped to a workspace, an epoch or a moment* is the sentence G1 is derived from |

### 3.2 `src-tauri/src/reconciliation.rs` — the queue (**22 pointers over 24 judged positions**)

Two of the rows below carry a judgement and no link, and are counted in the 24 and not in the 22:
*the case that would be a fourth*, which was **kept** unchanged because it states a fact about the
allocator and this queue's map key rather than a clause; and `ReconciliationBatch::discarded`'s
cumulative paragraph, which names the clause in prose one sentence after the link above it rather
than linking twice inside one doc comment.

| Position | Judgement |
|---|---|
| module doc, guarantee 1 | **kept + pointer.** *Sequences increase within one workspace epoch* is G3 read as this queue's guarantee; the local half — the numbers are the ledger's and this module invents none — stays |
| module doc, guarantee 3's folded-entry sentence | **replaced + kept.** *"until a drain acknowledges it, an eviction removes it, or a replacement epoch discards it"* was G4 restated inside a sentence about the fold; the local fact — a folded entry is out of the *batch* and not out of the *queue* — stays |
| module doc, guarantee 4 | **replaced + kept.** This was the canonical restatement, opening *"in the one wording every position in this module and in `crate::commands` states"* — the sentence this step makes false by construction. What stays is this queue's own two ends: which arrivals `enqueue` refuses, and that the overflow is the one of the three ways **this module** decides |
| module doc, *the case that would be a fourth* | **kept.** A fact about `crate::ledger`'s allocator and this queue's map key, not a restatement |
| module doc, *what it does not do*, closing paragraph | **kept + pointer.** It already pointed at `liveness`; it now points at the scoped-lifetime contract beside it, in the same shape |
| module doc, *Where the identities come from* | **replaced + kept.** *"a path keeps one number for the life of the process"* is G1 restated |
| `QUEUE_CAPACITY` | **kept + pointer.** G5, N3 and N4's source. Every sentence of the policy stays; the pointer names the three clauses it feeds |
| `ReconciliationWake::newest_sequence` | **kept + pointer.** N6's source — *not a count and not a promise of a batch size*. **The probe sweep did not match this unit at all**; it was found by reading |
| `ObservedDocument`, enum doc | **replaced + kept.** *A process-lifetime identity is not an address in the current workspace* now carries the clause rather than the explanation |
| `ObservedDocument::Named`, second bullet | **replaced + kept.** *"the core keeps one number per path for the life of the process, a recreation at that path included"* is G1 restated; the local half — which two cases reach this arm — stays |
| `ReconciliationBatch::newest_sequence` | **replaced + kept.** G6's source. The whole claim and the out-of-order-drain example stay; what goes is the restatement of what `begin_epoch` discards and of *a sequence means nothing across two epochs* |
| `ReconciliationBatch::discarded`, the third-way paragraph | **replaced + kept.** The enumeration is a pointer; *why* it is counted nowhere is a fact about this field and stays |
| `ReconciliationBatch::discarded`, the cumulative paragraph | **kept + pointer.** G7's source |
| `QueueState::discarded` | **replaced + kept.** *"which is why the count is per epoch and why the third way … is not in it"* is G2 and G4 restated |
| `ReconciliationQueue::begin_epoch`, the third-way paragraph | **replaced + kept.** *"beside a later drain acknowledging it and an overflow evicting it"* is gone; *this is the third way* is the local fact and stays |
| `ReconciliationQueue::begin_epoch`, the identity paragraph | **replaced + kept.** G1 restated; the local half — that this queue once kept an epoch-scoped copy and why it does not — stays |
| `ReconciliationQueue::drain`, the folded-slot paragraph | **replaced + kept.** G4 restated inside the fold's own sentence |
| `ReconciliationQueue::drain`, the watermark paragraph | **replaced + kept.** G6 restated in full, ending *"The field's own doc is the whole claim"* — which is what a pointer is for. What stays is the local fact: the `max` **here** is what makes the field's claim a property of this function |
| `drain`'s inline comment over the `max` | **replaced + kept.** *"since the epoch in `guard` was adopted, which is the only watermark this state holds"* is G2 and G6; the reasoning about why every pending entry is above `acknowledged` stays. **Another unit the probe sweep did not match** |
| `external_observation` | **replaced + kept.** A complete restatement of G4, three ways and all. The local fact — *an entry survives its own drain*, which is why this clones — stays and is now the sentence in bold |
| `address_of` | **replaced + kept.** *"not scoped to a workspace, an epoch or a moment"* is G1 |
| `address_of_minted` | **replaced + kept.** *"the process-wide register holds every path anything in this process has ever named, and the open workspace holds only what it discovered"* is G1 and G2 restated; the whole `assert_eq!` policy paragraph is untouched |
| test comment in `a_repeat_of_one_paths_state_coalesces_onto_the_newer_sequence` | **replaced + kept.** G4 restated in a test comment; *the fold is a property of the batch and not of the queue* stays |
| test comment in `an_identity_survives_a_replacement_and_the_epoch_is_what_makes_a_batch_stale` | **replaced + kept.** G1 and G2 restated; what the test exercises and what it does not assert stays |

### 3.3 `src-tauri/src/ledger.rs` — the write ledger (12)

| Position | Judgement |
|---|---|
| module doc, *# The anchor outlives the record*, the two-lifetime list | **replaced + kept, and one clause of it was false — see §4.** The list is now a pointer at G9; which value carries which stays, and the correction block beneath it names the defect |
| `Admission::Admitted::sequence` | **kept + pointer.** G3's source |
| `AppWrite` | **replaced + kept.** *"this record's life is how long suppression is licensed, and the chronology fact's life is the epoch"* is G9 restated at a type that is not either map |
| `CommitAnchor` | **kept + pointer.** G9's second half at its source. **The probe sweep did not match this unit**; found by reading. One word also changed: *"not by a serialized door"* became *"not by any door"*, which is what `clear_the_record_at` actually does |
| `LedgerTally` | **kept + pointer.** G8's source — *cumulative and never reset, unlike the maps and the sequence allocator* |
| `WriteLedger` | **kept + pointer.** *It outlives any one workspace* is about the **object**; the pointer separates that from its **contents**, which G2 scopes, and names G8 as what the discard leaves standing |
| `LedgerState::documents_by_path` | **replaced + kept.** *"the identity table … is itself keyed by path for the life of the process"* is G1 |
| `LedgerState::announced` | **kept + pointer** (new paragraph). N2's other half, which nothing anywhere said. **Not matched by the probe sweep** |
| `LedgerState::latest_commit_at` | **replaced + kept.** *for the life of the epoch* is G9; the pointer also names N2, and *what each of the two lifetimes is* moves to the contract |
| `WriteLedger::begin_epoch` | **replaced + kept.** *"a document identity survives a replacement (the process-wide table is keyed by path)"* is G1; consult Q2, the call ordering and the gate argument stay |
| `record_app_write`'s inline anchor comment | **replaced + kept.** *"which nothing removes before the epoch ends: the identity table is keyed by path for the life of the process"* is G9 and G1; the residue it describes stays |
| `decide`'s inline comment over the two lookups | **replaced + kept.** *"lives as long as the epoch … lives exactly as long as the licence"* is G9; round 9's history stays |

### 3.4 The composition (7)

| Position | Judgement |
|---|---|
| `commands.rs`, `WorkspaceSession::open`'s doc | **replaced + kept.** *"a document identity survives a replacement, because the process-wide identity table is keyed by path"* is G1; this is now named as G2's call site |
| `commands.rs`, `WorkspaceSession::open`'s inline comment beside `reconciliation.begin_epoch` | **replaced + kept.** G1, G2 and G4 all restated in five lines of comment |
| `commands.rs`, `WorkspaceSession::drain_external_changes` | **replaced + kept.** G4 and G6 restated in full. What stays is this command's own: the acknowledgement-watermark semantics, the idempotence condition, and the two consequences that belong to a *command* rather than to a queue |
| `commands.rs`, the `drain_external_changes` command | **replaced + kept.** The same restatement one layer up, in the argument's own bullet |
| `main.rs`, the module header's mechanism list | **replaced + kept.** *"which outlives the app-write record it was taken with"* is G9. This is the file `2d-3-notes.md` §20.7 item 41 is about — round 13's sweep enumerated four files and this one survived it |
| `dispatch_check.rs`, `drain_external_changes_is_reachable_and_its_watermark_deserializes` | **replaced + kept.** The scope sentence is a pointer; what stays is what **this test** covers — the claim inside its scope, never across a replacement. This file was first swept at round 6 |
| `watch_check.rs`, the round-12 trade paragraph | **replaced + kept.** *"`LedgerTally` is cumulative for the session"* is G8; what the removal costs stays |

### 3.5 Collateral

- `crates/espansoconfig-core/src/watch/mod.rs` gains the `retained_state` row in its module map and
  `pub mod retained_state;`.
- `src-tauri/src/liveness_contract.rs` gains **one inventory entry**: the new contract's
  *"whether anything will ever be observed again"* disclaimer matches `LIVENESS_SHAPES`'s
  `observed again`. It is filed as **a pointer** — the sentence names
  `espansoconfig_core::watch::liveness` as where that family is stated — and **not reworded to dodge
  the sweep**, which `2d-4a-notes.md` §14.2 records as the questionable move. The check was watched
  failing on it and passing after (§8).
- **No other liveness count moved**, so no other inventory entry needed touching: the sweep's
  both-direction guard would have failed on a deletion as loudly as on an addition.

---

## 4. A false claim found in the tree, and fixed — reported loudly

**`src-tauri/src/ledger.rs`'s module doc said the app-write record ends at four things and named one
of them too narrowly.** Verbatim, as it stood:

> the **record** lives as long as its suppression licence is honest, and four things end that:
> supersession, **a serialized reading**, a reload onto other bytes, and a workspace replacement

`decide` reaches its clearing step — `clear_the_record_at`, its step 3 — for **every** reading that
neither fails the chronology check nor is suppressed as a self-write. That is every serialized
reading, **and also every stamped reading whose state the record does not name**, which is the
ordinary external change to a file this application had written. So the second item was narrower than
the code by the most common case on the production path.

**Three things are worth saying about it.**

1. **It is the same failure shape rounds 5 and 6 found, one subsystem over.** Round 5: the retention
   boundary counted the ways an entry leaves *by the entry's own properties* and missed the one that
   depends on nothing about it. Round 6: the watermark, one level up. This one enumerates the ways a
   record ends and misses the one that depends on the *reading* rather than on the door. **No round of
   this phase had swept `ledger.rs` for this family at all.**
2. **The codebase already held its own refutation.** `decide`'s own doc has said, since the round-8
   fix round, *"narrowing step 2 sends **more** readings through step 3, which clears"*. The module
   doc's list did not, and nothing compared the two.
3. **The fix is words, and the behaviour is untouched.** The list is now a pointer at G9, with a
   correction block naming the defect, quoting the old wording and citing `decide`'s sentence.
   `clear_the_record_at`, `decide` and `record_app_write` are not modified.

**One narrower instance was fixed with it**, found by the same reading: `CommitAnchor`'s doc said the
anchor is removed by `begin_epoch` alone, *"not by supersession, not by **a serialized door**, and not
by the reload invalidation"*. The list is true but the middle item was written from the same wrong
generalization; it now reads *not by **any** door*, which is what `clear_the_record_at`'s own doc
says.

**No behaviour was changed anywhere in this step**, per the brief. Had the code been wrong rather
than the comment, this section would say so and change nothing.

---

## 5. What this step does **not** close, and where it is thin

Stated plainly, because getting this wrong would reproduce, inside the mechanism built to stop it,
this project's declared worst defect class.

1. **There is no check, and that is the whole of step 2.** Nothing fails today if a future edit drops
   a qualification, writes a fresh paraphrase, or deletes a pointer and restates the claim beside it.
   What this step bought is the **reduction of surface** — one place to be right instead of fifty —
   and the compile-checked pointer, which is a real guarantee about the *link* and none at all about
   the *sentence*.
2. **Eight of the 45 pointers are not compile-checked, and 37 are.** `dispatch_check` and
   `watch_check` are `#[cfg(test)]` modules that a doc build never compiles, and five further
   pointers — `reconciliation.rs`'s two test comments and its inline comment inside `drain`,
   `commands.rs`'s inline comment inside `open`, and `ledger.rs`'s two inline comments — are `//`
   comments, which rustdoc does not resolve either. All eight carry the module path as **plain
   text** for that reason, which is the same decision 2d-3-C took for its two links to test-only
   items. A rename of the contract breaks the build through the other 37 and leaves these eight
   silently stale.
3. **The contract's own clauses are prose over code, and no test fails if one drifts from the code it
   cites.** §2's tables are an audit trail, not an oracle. What changed is the count: one passage to
   check against `begin_epoch` instead of twelve.
4. **G4's *exactly three* and G8's *the one exception* both rest on a reading.** Each was established
   by reading every mutation of one field; nothing fails when a fifth mutation or a sixth reset
   appears. The contract says so where it states them, which is the most a doc comment can do.
5. **The sweep that found the positions is a human reading with a throwaway script, and claiming it is
   complete is what rounds 3, 4 and 5 of this phase each claimed and were wrong about.** It ran over
   `src-tauri/src` and `crates/espansoconfig-core/src` **recursively**, never over a file list
   (`2d-3-notes.md` §20.7 item 41), joining runs of comment lines into prose units before matching —
   33 probe phrases over 85 prose units. **Four of the 45 pointer passages sit in units none of the 33
   phrases matched** — `ReconciliationWake::newest_sequence`, `drain`'s inline `max` comment,
   `CommitAnchor`, and `LedgerState::announced` — and they were found by reading the files. That is
   direct evidence that a phrase family is not the family, and step 2 inherits it as its sharpest
   limit rather than as a detail.
6. **No count of the positions left as local facts is asserted here.** The sweep's grain is a *prose
   unit* (a whole module doc is one) and the pointer's grain is a *passage*, and reconciling the two
   by hand is exactly the arithmetic `2d-4a-notes.md` §15.1's L5 and 2d-3's round 14 both got wrong.
   §3 lists the 45 pointers, this section lists what was judged out, and everything else in the two
   trees was read and left alone.
7. **What was judged out of the family, by file** — 31 prose units, and the boundary is the argument
   rather than the pattern:
   - **the vocabulary trap**: `crates/espansoconfig-core/src/persist/backup.rs` (3) — backup-file
     rotation, a different subsystem about files on disk;
   - **resource and thread lifetimes**: `src-tauri/src/watch.rs` (5) — the reaper's held `Reap` set,
     the worker's unbounded inbox, a watcher's own polling mode. (`watch/native.rs`'s `NativeWatch`
     handle is the same judgement and is **not** in this count: none of the 33 probe phrases matched
     it, which is §5 item 5 again.)
   - **the parse cache**: `src-tauri/src/error.rs` (2) — *this crate evicts its cached parse* is
     keyed by revision, not scoped by an epoch, and no observation is decided against it;
   - **the determinism qualification**: `crates/espansoconfig-core/src/watch/engine.rs` (5),
     `lib.rs`'s crate doc (1) and `watch/mod.rs` (1) — *identity values come from the process-wide
     table* is a claim about what the engine's determinism excludes, not about how long anything
     survives;
   - **the other contract**: `crates/espansoconfig-core/src/watch/liveness.rs` (1);
   - **plain false positives**: `discovery.rs` (1), `emit/choose.rs` (2), `model/value.rs` (1),
     `persist/save.rs` (1), `persist/write.rs` (4), `src-tauri/src/rust_source.rs` (1),
     `commands.rs` (2 — the FSEvents daemon, and `Instant`'s monotonicity), `watch_check.rs` (1).
8. **The closest call, recorded rather than left silent.**
   `crates/espansoconfig-core/src/persist/write.rs`'s lock registry is *"one entry per real path ever
   written"*, process-wide, never evicted, leaking a `&'static Mutex<()>` per path — **R9's exact
   shape in a second subsystem, and unmeasured**. It is judged **out**, because nothing decides an
   observation, a drain or a save admission against it: it serializes writes to one path and is read
   only by the writer of that path. That is a boundary drawn on the claim and not on the shape, and it
   is the entry a future round is most likely to disagree with. Step 2's phrase family will hit it;
   it must then be **inventoried as a judged position**, never pattern-narrowed away.
9. **R9 is OPEN and this step does not close it.** N1 states it as the unbounded retention it is —
   unbounded, unevicted, uncapped, unmeasured — and adds nothing to the three rounds' verdicts. A
   bound needs a rule for when an identity may be forgotten, which needs to know no consumer still
   holds it (2d-5's knowledge); a measurement first means something in 2d-7. Writing it into a
   contract is **not** a closure, and the contract says so in its own words.
10. **`docs/` is not covered and cannot be.** `2d-4a-notes.md` quotes the false sentences of six
    review rounds **on purpose**, and any check over it would fail on its own record. So this file and
    that one point at the contract as prose, with nothing enforcing that they keep pointing —
    2d-3-C's §5 limit 4, inherited unchanged.
11. **This step wrote sentences, and the round that reviews them is not optional.** `2d-4a-notes.md`
    §15.4's R8 paragraph is the standing prediction: every fix round of this phase has written the
    next round's findings. This one wrote **nine guaranteed clauses and eight negative ones** in a
    single new module, and the likeliest sites are the two that rest on a reading (G4, G8), the one
    that spans a subsystem this phase had never swept (G9, §4), and the boundary in §5 item 8.
    **That round has now run — §9 — and this prediction half held**: the High landed on G9, one of
    the three named. The Low landed on the introductory sentence at line 8, which this list did not
    name at all.

---

## 6. What changed, file by file

This list names **every** file in the step — the record files included, which is
`2d-4a-notes.md` §15.1's L5 applied to the section that failed it.

- **`crates/espansoconfig-core/src/watch/retained_state.rs`** — **new.** The contract. It declares no
  type, no function and no constant; its module documentation *is* the item, and the file contains
  **no non-comment line**.
- **`crates/espansoconfig-core/src/watch/mod.rs`** — `pub mod retained_state;` and the module map's
  row.
- **`crates/espansoconfig-core/src/lib.rs`** — `DocumentId`'s pointer (§3.1). **Doc comment only.**
- **`crates/espansoconfig-core/src/workspace/mod.rs`** — the three pointers of §3.1. **Doc comments
  only.**
- **`src-tauri/src/reconciliation.rs`** — the 22 positions of §3.2. **Comments and doc comments only.**
- **`src-tauri/src/ledger.rs`** — the 12 positions of §3.3, including §4's false claim and the
  narrower instance beside it. **Comments and doc comments only; `decide`, `clear_the_record_at`,
  `record_app_write` and `begin_epoch` are untouched.**
- **`src-tauri/src/commands.rs`**, **`src-tauri/src/main.rs`**,
  **`src-tauri/src/dispatch_check.rs`**, **`src-tauri/src/watch_check.rs`** — the seven positions of
  §3.4. **Comments and doc comments only. No signature, no control flow, no assertion and no
  assertion message added, removed or changed.**
- **`src-tauri/src/liveness_contract.rs`** — one new `Judged` entry (§3.5). This is the step's only
  non-comment change beside the module registration.
- **`docs/decisions/2d-4a-C-notes.md`** — this record.
- **no `src/` path, no command, no wire type, no event, no queue, no i18n key and no user-visible
  string.** `git diff --stat` names no path under `src/`.

**Two non-comment lines of source, plus five lines of inventory data.**
`git diff -U0 -- crates/espansoconfig-core/src src-tauri/src` filtered to non-comment, non-blank
lines shows exactly seven added lines and **zero removed**: `pub mod retained_state;`, and the six
lines of the new `Judged { … }` literal. Everything else in both trees is a comment or a doc comment.

---

## 7. Effect on the residues this step touches

- **`2d-4a-notes.md` §15.4's *"Nothing in the boundary or the watermark wording is enforced
  mechanically"* is HALF closed.** The wording is now **stated once** and pointed at over
  compile-checked links, which is the surface reduction; **nothing is enforced yet**, which is step
  2's. Saying it is closed would be this project's worst defect class inside the record that exists
  to prevent it.
- **R8 — *every claim about what the code does is prose over code* — is NARROWED and not closed.**
  Twelve retention positions and nine watermark positions became one clause each. What replaces them
  is §5 limit 3: one passage to keep true instead of twenty-one, and nothing making that one true.
- **R9 is OPEN**, for the fourth consecutive record (§5 item 9).
- **R10 is unchanged**, bounded by the narrow rule; N4 states its tie case rather than R10's
  corrected sentence, so the two now agree.
- **`2d-3-notes.md` §5 item 27 — *`latest_commit_at` is never pruned within an epoch* — is stated in
  the contract as N2** and is otherwise untouched.
- **`2d-3-notes.md` §20.7 item 41 is respected**: the sweep walked directory trees, and `main.rs` —
  the file round 13's four-file sweep could not see — is one of the eight files that now points.

---

## 8. The gates

Every one measured on this tree, as a separate command, with `pkill -f 'target/debug/deps/espansoconfig-'`
run before the workspace suite and nothing else running on the host.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1309 passed, 0 failed**, exit 0, summed over **26** `test result` lines. The baseline is 1309; **the move is exactly 0** — this step adds no test and removes none |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean**, exit 0 |
| `cargo fmt --check` | **clean**, exit 0 |
| `cargo doc --workspace --no-deps` | **exit 0**, **73** `private_intra_doc_links` warnings — the pre-existing count — and **zero** unresolved or ambiguous links |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** |
| `git diff --stat` | **no path under `src/`.** The frontend is untouched, so 431 / 2125 / 184 carry |
| `cargo test -p espansoconfig --bin espansoconfig liveness_contract::` | **4 passed**, 0 failed — the existing check still holds over both trees with the new module in them |

**The intra-doc gate was driven to red, not argued.** One pointer in `src-tauri/src/ledger.rs` was
renamed to `espansoconfig_core::watch::retained_stateXX` and `cargo doc --workspace --no-deps`
failed:

```
error: unresolved link to `espansoconfig_core::watch::retained_stateXX`
   --> src-tauri/src/ledger.rs:709:15
    |
709 |         /// [`espansoconfig_core::watch::retained_stateXX`]'s clause 3, of which
    |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ no item named `retained_stateXX` in module `watch`
note: the lint level is defined here
   --> src-tauri/src/main.rs:147:9
--
error: could not document `espansoconfig`
```

That is the property §1 chose the core crate for: **a rename of the contract breaks the build from
the application shell.** The probe was reverted with the **inverse edit**, never with
`git checkout`, and the doc build re-run clean.

**The liveness check was also driven to red**, by the new module's own text rather than by a plant:
`every_liveness_claim_is_judged` failed with
`crates/espansoconfig-core/src/watch/retained_state.rs / "observed again": found 1, inventory says 0`,
and passed after the inventory entry of §3.5 was added. Two contracts, one sweep, and the second one
was caught by the first.

**Do not commit** — the orchestrator commits at the phase boundary.

---

## 9. Review round 1, and the fix round that answers it

`docs/reviews/phase-2d-4a-C.md` is the review. Verdict **NOT READY**, two findings — one High and
one Low, **both prose-only** — and a closing instruction that is the reason this round exists:
*step 2 should not be built on the current text, because a checker over a false lifetime claim makes
it harder to remove.* **Nothing about step 1's boundary, placement or pointer inventory was
rejected**; the clause audit derived all 17 clauses from the code and found one wrong.

### 9.1 The High — G9 gave an individual commit anchor an epoch lifetime

**`crates/espansoconfig-core/src/watch/retained_state.rs:131`, clause 9**, said *"a commit anchor
lives as long as the epoch"* and *"Exactly one thing removes an anchor: the workspace replacement."*
That is one lifetime asserted for **three different things**:

1. the **app-write record** — four ends, and that half was correct (§4 is where it was fixed);
2. the **per-path slot and the latest-commit chronology fact** it answers — *epoch-lived*, and
   removed by `WriteLedger::begin_epoch` alone;
3. the concrete **`CommitAnchor` value** — **not** epoch-lived: `WriteLedger::record_app_write`
   (`src-tauri/src/ledger.rs:1270`) does `latest_commit_at.insert(path, CommitAnchor { … })`, so
   every later commit to the same path drops the value before it.

The distinction is a defect and not a quibble because **the module defines its own family as
retained *values*** (its lines 18–20). The same overstatement stood in the cited source,
`CommitAnchor`'s own doc (*"Its life is the epoch and nothing shorter"*, *"removed by …
`begin_epoch` alone — not by supersession"*), so the pointer and its source doubled down on the same
wrong subject — which is exactly what step 2 would have mechanically protected.

**The tree already held its own refutation, for the second time in two rounds.** The insertion
comment at `src-tauri/src/ledger.rs:1258` has correctly said *"It replaces any earlier anchor for
this path, because* latest *is what it claims"* since round 9. §4 records the same pattern one
subsystem over — a true local statement beside a false general one in one file, with nothing
comparing them. **That pattern is the finding, not a coincidence**, and it is the sharpest thing
step 2 inherits: a checker that enforces *pointing* cannot compare a general claim against the local
fact three lines below it.

**How the guarantee was restated.** The clause is not deleted and not hedged; its **subject** is
corrected and it stays usable. G9 now reads, in substance: *an app-write record lives as long as its
suppression licence; a path's latest-commit anchor is maintained until the epoch is replaced, and a
later commit to that path supersedes its value.* The anchor half is stated as a claim about the
**per-path slot and the chronology fact it answers** — *when did this session last commit to this
path* — of which **exactly one thing removes it, the workspace replacement**; and it says expressly
that it is **not** a claim about the concrete value, which is replaced on every commit, leaving the
slot never empty and the fact true *because* the value changed. The consumer-facing guarantee is
called out as unchanged: **none of the record's four ends touches the anchor**, so a reading older
than this session's latest commit to a path is refused even where the record it would have been
matched against is gone.

### 9.2 The Low — three "consecutive review rounds" were not three review rounds

**`retained_state.rs:8`** called the three discoveries *"three consecutive review rounds of Phase
2d-4a"*, while its own enumeration was round 5, round 6, and **the implementation step that wrote
the module** — not a review round, and no round 7 had run when the sentence was written. Line 12
already said it accurately. The sentence now says **three consecutive audits**, names the third as
the implementation step, and states in the same breath why the word changed. It also records that
**round 1 of this phase's own review then found a fourth instance, in clause 9** — so the paragraph
no longer implies the module's text is unreviewed.

### 9.3 The sweep, and what it found beyond the reviewer's two positions

The recorded failure mode — `CLAUDE.md`, and `2d-4a-notes.md` §7.6.2 — is that **four consecutive
rounds each closed a finding and left a narrower instance standing, every time because the search
was written from the previous wording**. So the sweep was written from **what the sentence now
says**: *every position that says anything about how long a `CommitAnchor`, a latest-commit fact, an
announced state or an app-write record survives.*

It ran over `src-tauri/src` and `crates/espansoconfig-core/src` **recursively, never a file list**,
test names, test comments and assertion messages included, **joining runs of comment lines into
prose units** before matching — this workspace wraps doc comments at ~76 columns, so a claim
straddles a line break as a matter of course and a line-based grep cannot see it — and then splitting
each unit into sentences and keeping every sentence that names one of the family's subjects **and**
says something about how long it survives. **152 such sentences**, of which 132 are in the ten files
that hold the pipeline; each was judged against the code.

**The first pattern was too narrow and is reported as such**: it matched `commit anchor`,
`CommitAnchor`, `latest_commit_at` and `latest commit`, and **missed two false test comments that say
only "the anchor"** — the recorded failure mode reproduced inside the sweep meant to prevent it,
caught by widening to `\banchor` before any edit was made.

**Ten positions were false and are fixed. Eight of them are beyond the reviewer's two.**

| # | Position | What it said | Why it is false |
|---|---|---|---|
| 1 | `retained_state.rs`, clause 9 | *a commit anchor lives as long as the epoch* | the reviewer's High |
| 2 | `ledger.rs`, `CommitAnchor`'s doc | *Its life is the epoch and nothing shorter*; *not by supersession* | the reviewer's cited source |
| 3 | `ledger.rs`, module doc, *the anchor outlives the record* | *the **anchor** is `LedgerState::latest_commit_at`, whose life is the epoch* | value, slot and fact under one lifetime, in parallel with the record's per-entry one |
| 4 | `ledger.rs`, `Admission::PrecedesACommit` | *the path's `CommitAnchor`, whose life is the epoch* | same |
| 5 | `ledger.rs`, `LedgerTally::preceded_a_commit` | *since the round-9 fix round the anchor's life is the epoch* | same |
| 6 | `ledger.rs`, `LedgerState::writes` | *the instant now lives in `latest_commit_at`, whose life is the epoch* | grammatically the map, but one clause after *the two lifetimes were one*, which is the conflation one step removed |
| 7 | `ledger.rs`, `begin_epoch`'s inline anchor comment | *that is the whole of its lifetime rule … by nothing shorter* | *the one place an anchor is removed* is true; *the whole of its lifetime rule* is not |
| 8 | `ledger.rs`, `record_app_write`'s doc | *the anchor's is the epoch* | stated in the doc comment of the function whose own body replaces the value eight lines below |
| 9 | `ledger.rs`, `decide`'s check-order list, step 1 | *the anchor's life is the epoch* | same |
| 10 | `ledger.rs`, two test comments (`a_commit_anchor_outlives_the_record_it_was_taken_with`, `a_settlement_produced_before_a_commit_is_counted_once_and_admitted_on_its_next_reading`) | *the anchor now lives as long as the epoch*; *the anchor's life is the epoch* | the two the narrow pattern missed |

Every one of them now says what the code does: **the path keeps an anchor until the epoch is
replaced, and a later commit to that path replaces its value**. The three positions that state the
*consequence* — *a commit whose record has since been cleared still refuses a reading older than it*
— keep it verbatim, because that consequence was never in doubt and is what a consumer depends on.

**Positions judged true and deliberately left**, so that a later round can see they were read rather
than missed:

- `ledger.rs`, `LedgerState::latest_commit_at` — *"Nothing prunes this map within an epoch"*: true,
  there is no `remove` on that map anywhere;
- `ledger.rs`, `LedgerState::announced` — *"entries leave one at a time, where a particular path's
  announcement stops being true"*: true, `announced.remove(path)` fires in `record_app_write` and in
  the reload invalidation;
- `ledger.rs`, `begin_epoch`'s doc, and `record_app_write`'s insertion comment (**kept verbatim, as
  the review asks**) — both already correct;
- the seven *"outlives the record"* positions in `commands.rs`, `main.rs` and `ledger.rs`: a
  **relative** claim, and true — no clearing of a record touches the anchor;
- `ledger.rs:3067`, *"into a map whose life is the epoch"*: the subject is unambiguously the map, and
  the map's life **is** the epoch;
- `reconciliation.rs:1393`, *"scoped by clause 1 and by nothing shorter"*: that is G1, the
  process-wide identity register, and it is true.

**Two test-only seams exist that no clause mentions and none needs to**: `WriteLedger::commit_anchor`
reads an anchor back and `WriteLedger::stamp_the_anchor_at` mutates a live one's instant in place.
Both are `#[cfg(test)]`, both already document that, and the contract is about production retention.

### 9.4 The two already-known-thin positions the review flags — both true, both left

- **N2's plural treatment of the announced and anchor maps.** **True as written, and left.** It
  denies a *capacity policy*, and neither map has one: `announced` grows by one entry per distinct
  path announced under the epoch, `latest_commit_at` by one per distinct path committed to under it,
  and only `begin_epoch` empties either. Its *"entries leave them one at a time only where a
  particular path's fact stops being true"* is a **restriction**, so it is true of `announced`
  (which really does remove) and vacuously true of `latest_commit_at` (which never removes an entry
  individually at all). The reviewer's caution stands and is not a falsehood: **the clause must not
  be read as claiming a second streaming source for anchors**, and their sources of growth are not
  identical.
- **N5's *"take entries no drain ever returned."*** **True as written, and left.** It is an
  existence counterexample inside a negative clause — an overflow can evict an entry no drain
  returned, and a replacement discards entries no drain returned — and it is exactly as narrow as
  `enqueue`'s eviction arm and `begin_epoch`'s whole-state assignment. It becomes false only if a
  future pointer restates it **universally**, because drained entries remain stored and can be
  evicted or replacement-discarded afterwards too.

### 9.5 What changed, file by file

- **`crates/espansoconfig-core/src/watch/retained_state.rs`** — clause 9 restated (§9.1) and the
  introductory sentence narrowed (§9.2). **Module documentation only; the file still contains no
  non-comment line.**
- **`src-tauri/src/ledger.rs`** — the eight remaining false positions of §9.3's table.
  **Comments and doc comments only.** `decide`, `clear_the_record_at`, `record_app_write`,
  `begin_epoch` and `adopt_reloaded_revision_under_the_session_lock` are untouched, and
  `record_app_write`'s insertion comment is kept exactly as it stood.
- **`docs/decisions/2d-4a-C-notes.md`** — §5 item 11's prediction verdict, and this section.
- **no other source file, no `src/` path, no command, no wire type, no event, no queue, no i18n key
  and no user-visible string.**

**Prose only, and verified rather than claimed.**
`git diff -U0 -- crates/espansoconfig-core/src src-tauri/src` filtered to non-comment, non-blank
changed lines is **zero lines**, in both directions:

```sh
git diff -U0 -- crates/espansoconfig-core/src src-tauri/src \
  | rg '^[+-]' | rg -v '^(\+\+\+|---)' | sed 's/^[+-]//' | rg -v '^\s*(//|$)' | wc -l
# 0
```

### 9.6 The gates after this round

Each run as a separate command, with `pkill -f 'target/debug/deps/espansoconfig-'` before the
workspace suite and nothing else running on the host.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1309 passed, 0 failed**, exit 0, summed over **26** `test result` lines — the baseline, unmoved, as prose-only work requires |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean**, exit 0 |
| `cargo fmt --check` | **clean**, exit 0 |
| `cargo doc --workspace --no-deps` | **exit 0**, **73** `private_intra_doc_links` warnings — unchanged — and **zero** unresolved or ambiguous links |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** |
| `git diff --stat` | two source files and this record; **no path under `src/`.** The frontend gates were therefore not re-run and no figure for them is claimed here — §8's carry unchanged |

**No gate is recorded here that was not run.** In particular the doc build was **not** re-driven to
red this round — §8's probe stands as step 1's evidence and is not re-claimed — and
`liveness_contract::` was not re-run separately, because the workspace suite that contains it passed
whole.

### 9.7 What this round did not do, and where it is thin

1. **The review is not closed by this round.** It closed two findings and wrote sentences, and
   §5 item 11 applies to *these* sentences exactly as it applied to step 1's: every fix round of this
   phase has written the next round's findings. Round 2 is owed, and **step 2 must not start before
   it** — the reviewer's closing instruction was about building a checker over false text, and text
   this round changed is text no reviewer has read.
2. **Nothing here is enforced.** No test fails if clause 9 drifts from `record_app_write` again;
   §5 items 1 and 3 are untouched, and this round is a second demonstration of why — the false
   clause survived 1309 passing tests, `cargo doc`, `clippy` and a written audit trail.
3. **The sweep is a human reading with a throwaway script**, §5 item 5's limit inherited verbatim,
   with one new piece of evidence for it: **the first pattern of this round's own sweep missed two
   positions** and only a widened one found them. A phrase family is not the family.
4. **The judged-true positions of §9.3 are judgements, not proofs.** `LedgerState::writes`'s
   sentence (row 6) was changed although it is grammatically about the map, and `ledger.rs:3067`'s
   was **not**, although it is the same shape. The difference is the clause beside it — *the two
   lifetimes were one* — and a later round may reasonably rule the other way on either.
5. **No behaviour was changed**, and had the code been wrong rather than the comment this section
   would say so and change nothing. Ten passages were false; **no code defect was found.**

### 9.8 Likeliest sites for a later round, so step 2 and round 2 start from them

The reviewer's own list, carried here verbatim in substance and with this round's outcome against
each:

- **G4's *"exactly three"*** — it depends on production provenance and a human enumeration of
  mutation sites, while `enqueue` and `AdmittedObservation` do not encode uniqueness. Untouched this
  round;
- **G8's *"one retained value"*** — an addition to either holder can silently create another
  non-epoch field. Untouched this round;
- **G9's distinction among record, per-path slot/latest chronology fact, and concrete `CommitAnchor`
  value** — the defect this round closed, and therefore the text most worth re-reading, because a
  fix is a change;
- **N2's plural treatment of the announced and anchor maps**, whose sources of growth are not
  identical (§9.4 — judged true and left);
- **N5's *"take entries no drain ever returned"***, correct as an existence counterexample and false
  only if a future pointer restates it universally (§9.4 — judged true and left);
- **the `persist::write` lock-registry boundary** (§5 item 8), which step 2 must **inventory as
  judged-out** rather than pattern-narrow away;
- **the introductory review-history sentence** at `retained_state.rs:8` — this round's Low, rewritten
  and therefore new text.

**Do not commit** — the orchestrator commits at the phase boundary.

## 10. Review round 2, and the fix round that answers it

`docs/reviews/phase-2d-4a-C.md` § *Round 2 — step 1, against the round-1 fix* is the review. Verdict
**NOT READY**, two findings — one **High** and one **Medium**, **both prose-only** — and the same
closing instruction as round 1: step 2 must not be built on text a reviewer has not read.

**Round 2 reviewed round 1's fix, and both of its findings are about that fix's own shape.** The
first is a sentence the fix round wrote; the second is an older claim of a **different shape** that
the fix round's sweep **could not see by construction**. §9.7 item 1 predicted the first — *every fix
round of this phase has written the next round's findings* — and did not predict the second.

### 10.1 The High — G9's new consumer summary was false of two of the record's four ends

The round-1 fix ended clause 9 with *"**What a consumer depends on is unchanged**: none of the
record's four ends touches the anchor"* (`retained_state.rs:152`). **That is false under both of the
senses the same fix had just separated**, and it collapses the distinction three sentences after
drawing it:

| End of the record | What it does to anchor state |
|---|---|
| supersession by a later committed write | `record_app_write` ends the old record (`ledger.rs:1284`) **and replaces the old `CommitAnchor`** (`ledger.rs:1303–1309`) — the **value** |
| a reading that survives both retaining checks | nothing — `clear_the_record_at` (`ledger.rs:1922–1927`) |
| a reload onto other bytes | nothing — same function |
| a workspace replacement | `begin_epoch` clears the record map **and** `latest_commit_at` (`ledger.rs:1195` and `:1206`) — the **slot** |

**How the conclusion was restated: three distinct cases, and not one universal.** The consequence the
false premise was reaching for is still true, and it now rests on the true premises:

1. **within the retained epoch**, a reading or a reload that clears a record does not touch the
   anchor — `clear_the_record_at` removes the record and its path index and expressly leaves
   `latest_commit_at` alone;
2. **supersession preserves the per-path slot**, replacing its value with the *newer* anchor, so the
   committed write that ends a record by superseding it leaves the path anchored;
3. **epoch replacement does clear the anchor**, and it costs nothing: a predecessor epoch's
   observation is refused by the epoch fence **before** chronology is consulted, and clause 3 is why
   its numbers have nothing to be compared along.

So *a stamped reading older than **this epoch's** latest commit to a path is refused even where the
record it would have been matched against is gone* — kept, and now derived. The clause also names the
false sentence, says which two ends refute it, and records it as this phase's **round-2 High**, so a
later reader can see the text was corrected rather than quietly rewritten.

### 10.2 The Medium — a co-existence claim the round-1 sweep could not see

**`ledger.rs:494` (the module's *the anchor outlives the record* section) and `ledger.rs:1232`
(`record_app_write`'s doc)** both said, unqualified, that because the anchor is written under the
same state guard as the record, **no decision can see one without the other**. That is false, and
**seeing an anchor after its record is gone is the intended design** — it is Phase 2d-3 round 9's
mechanism, and **clause 9's consumer guarantee relies on exactly that state**:

- `decide` reads the two **independently** (`ledger.rs:2071–2072`), through a helper each;
- every path below its two retaining returns calls `clear_the_record_at` (`ledger.rs:2137`), which
  removes the record and its path index and **expressly does not touch `latest_commit_at`**.

**What the mutex actually proves is only that a decision cannot interleave with `record_app_write`
and observe a partially inserted pair.** Both sentences now say that and nothing wider, each states
expressly that it is **not** a claim that the two are always seen together, and each names the
decision that routinely sees an anchor with no record.

**The file held its own refutation for the third round running.** `record_app_write`'s doc made the
claim and then, two sentences later, said *"Anything that clears the record leaves the anchor
standing"*; §9.1 records the same pattern for the anchor's lifetime, and §4 records it one subsystem
over. **A checker that enforces *pointing* cannot compare a general claim against the local fact
three lines below it**, and that is now demonstrated three times in three rounds.

### 10.3 The two sweeps, and what each found

**This is a co-existence claim, not a duration claim, and that is the most valuable thing this round
produced.** Round 1's sweep was written from what its own corrected sentence said — *how long does a
`CommitAnchor`, a latest-commit fact, an announced state or an app-write record survive* — and it was
**widened** during that round when its first pattern missed two positions. **It still could not see
round 2's Medium by construction**: those sentences assert that two values are always **observed
together** and use none of the vocabulary of lifetime, removal or survival. The reviewer calls it *"a
genuine miss by the widened sweep"*, and it is not a failure of diligence but of the family: **a
phrase family is not a claim family**, and step 2's phrase list inherits that limit whole (§5 item 5,
§9.7 item 3).

Both sweeps ran over `src-tauri/src` **and** `crates/espansoconfig-core/src`, **recursively, never a
file list**, test names, test comments and assertion messages included, **joining runs of comment
lines into prose units before matching** — this workspace wraps doc comments at ~76 columns, so a
claim straddles a line break as a matter of course and a line-based grep cannot see it.

**Family 1 — co-existence** (*observed, inserted, cleared or removed together with*; atomicity,
pairing, *both*, *never one without the other*, *as a pair*, *in step with*, *under the same guard*):

- the bare pattern matched **339** positions in the two trees, most of them the words in unrelated
  senses — `pair` as a tuple, `atomic` as a rename, `apart` as *told apart*;
- conjoined with a subject of the retained-state family (record, anchor, announced state, queue
  entry, watermark, tally, identity, slot, sequence, map) it came to **66** positions, and each was
  judged against the code;
- **3 are the claim shape, and all 3 were false**: the review's two, **plus one more the review did
  not name** — `record_app_write`'s *"It happens in **this** function, under the same state guard as
  the record, so the two cannot be observed apart"* (`ledger.rs:1261–1263`), about the **announced
  state** and the record. Below the retaining checks a decision clears the record and may then
  announce a state, so a path holding an announcement and no record is ordinary. Narrowed to the
  interleaving claim, exactly as the other two.

**Positions in family 1 judged true and deliberately left**, so a later round can see they were read:
`clear_the_record_at`'s *"the record and its index are erased together"* (a statement about that one
function, and true of it); `enter_gate`'s *"the announcement and the acquisition are one function on
purpose"*; `watch.rs`'s two *"the two halves are one function on purpose"*; `reconciliation.rs:625`'s
*"where two `Option`s would let one be present without the other"* (a type-shape claim the enum
enforces); and the three backup-listing *"never one without the other"* passages, which are about a
struct's two fields and are outside this contract's boundary in any case.

**Family 2 — duration, re-checked** (subject + *lives*, *life*, *lifetime*, *outlives*, *survives*,
*nothing removes*, *never removed*, *removed by*, *prunes*, *until the epoch*, *as long as*,
*nothing shorter*, *epoch-lived*, *session-lived*, *process-wide*): **199** sentences over the two
trees — 54 in `ledger.rs`, 22 in `commands.rs`, 18 in `reconciliation.rs`, 14 in
`retained_state.rs`, the remainder spread over 28 further files. **No new false position.** The only
duration positions changed this round are the two the review flagged as ambiguity (§10.4).

**Positions found beyond the reviewer's three: family 1 → one; family 2 → none.**

### 10.4 The three positions the review left to judgement — what was done with each

- **`ledger.rs:1198`, `begin_epoch`'s *"the one place a commit anchor is removed"* — tightened.** It
  now says *"the one place a commit anchor's **slot** is removed"* and *"the **slot** is discarded
  with the epoch and by nothing shorter"*. Nothing else moved: the next sentence already said the
  *value* is shorter-lived than the slot. A subject correction, not a change of claim, and it removes
  the slide the reviewer predicted.
- **`ledger.rs:805`, `CommitAnchor`'s *"removed by `begin_epoch` alone"* — tightened.** The triple
  *"Written by …, read by …, and **removed** by … alone"* had no explicit subject, which is the
  whole of the ambiguity. It now reads *"**The slot** is created by `record_app_write`, its value is
  read by `decide`'s step 1, and the slot is **removed** by `begin_epoch` alone"*. The clause after
  it — supersession **replaces** the value rather than removing it — is untouched.
- **N2 at `retained_state.rs:176` — tightened, and the review did not ask for it.** The reviewer
  confirms N2 is **true**, read as a restriction on **map slots** leaving, and notes only that G9's
  now-explicit slot/value distinction makes *"entries leave"* a likely future ambiguity. *"Entries
  leave them one at a time only where a particular path's fact stops being true"* is now *"**A
  path's slot** leaves them one at a time only where that path's fact stops being true — clause 9's
  distinction read here too, since an anchor's *value* is dropped by every later commit to that path
  while its slot stays"*. **This is not a weakening**: under the *value* reading the old sentence
  would be **false** of the anchor map — a value leaves on every supersession, precisely where the
  path's fact keeps being true — so naming the slot selects the reading the reviewer certified as
  true. The denial itself is untouched: neither map has a capacity policy, and nothing prunes either
  as a whole before the epoch ends.

**What round 2 expressly cleared was left alone**: G4's *exactly three* (the four production mutation
sites at `reconciliation.rs:1097`, `:1102`, `:1187–1189`, `:1029–1030`), G8's *one retained value*,
N5, and the slot/value account of G9 **before** the false summary. Only the summary was rewritten.

### 10.5 What changed, file by file

- **`crates/espansoconfig-core/src/watch/retained_state.rs`** — clause 9's conclusion restated as
  three distinct cases (§10.1), and N2's subject named (§10.4). **Module documentation only; the file
  still contains no non-comment line.**
- **`src-tauri/src/ledger.rs`** — the two false co-existence sentences narrowed and the third one the
  sweep found (§10.2, §10.3), and the two flagged ambiguities tightened (§10.4). **Comments and doc
  comments only.** No function body, signature, field, type or test was touched.
- **`docs/decisions/2d-4a-C-notes.md`** — this section.
- **no other source file, no `src/` path, no command, no wire type, no event, no queue, no i18n key
  and no user-visible string.**

**Prose only, and verified rather than claimed.**

```sh
git diff -U0 -- crates/espansoconfig-core/src src-tauri/src \
  | rg '^[+-]' | rg -v '^(\+\+\+|---)' | sed 's/^[+-]//' | rg -v '^\s*(//|$)' | wc -l
# 0
```

### 10.6 The gates after this round

Each run as a separate command, with `pkill -f 'target/debug/deps/espansoconfig-'` before the
workspace suite and nothing else running on the host.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1309 passed, 0 failed**, exit 0, summed over **26** `test result` lines — the baseline, unmoved |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean**, exit 0 |
| `cargo fmt --check` | **clean**, exit 0 |
| `cargo doc --workspace --no-deps` | **exit 0**, **73** `links to private item` warnings — unchanged — and **zero** unresolved or ambiguous links. Re-run after `touch`ing both edited files, so the figure is not an incremental cache's |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** |
| `git diff --stat` | two source files and this record; **no path under `src/`** |

**No gate is recorded here that was not run**, and one deviation is recorded rather than smoothed
over: **the workspace suite ran twice**, because the first invocation's tail did not show the summary
lines and the second was piped through the `test result` fold. Both were green with identical counts.
Host discipline says *once*; this round ran it twice. The frontend gates were not re-run and no
figure for them is claimed — §8's carry is unchanged.

### 10.7 What this round did not do, and where it is thin

1. **The review is not closed by this round.** It closed two findings and wrote sentences, and §5
   item 11 applies to *these* sentences exactly as it applied to round 1's. **Round 3 is owed, and
   step 2 must not start before it.** Both rounds so far found the previous round's fix defective;
   assuming this one is the exception is the assumption each round has falsified.
2. **Nothing here is enforced.** No test fails if clause 9's conclusion drifts again, and none fails
   if a co-existence claim is written back into `ledger.rs`. The false universal survived 1309
   passing tests, `cargo doc`, `clippy` and a written audit trail — for the second round running.
3. **Round 2's Medium is a claim family the round-1 sweep could not see, and this is the fact step 2
   must absorb.** Its phrase family is being derived from *lifetime* vocabulary; a co-existence
   assertion about the same two values uses none of it and is invisible to that list. **Step 2 owes
   at least two phrase families, not one** — *how long does it survive* and *are these two always
   seen together* — and it owes the admission that a third family is discoverable the same way: by a
   reviewer, after the checker is green.
4. **The sweep is a human reading with a throwaway script.** §5 item 5 and §9.7 item 3, inherited
   verbatim, with one new piece of evidence: the bare co-existence pattern matched **339** positions
   and **3** of them were the claim, and the signal was recovered only by conjoining a subject list
   that is itself a human enumeration.
5. **N2 was tightened although the reviewer did not ask for it** (§10.4). That is new text no
   reviewer has read, in a clause round 2 expressly certified as true — the exact shape §9.7 item 1
   warns about. It is recorded here so round 3 attacks it first.
6. **No behaviour was changed, and no code defect was found.** Three passages were false and two were
   ambiguous; in every case the code was right and the comment was wrong. Had it been the other way
   round this section would say so and change nothing.

### 10.8 Likeliest sites for round 3, so step 2 and round 3 start from them

The reviewer's own list, carried here with this round's outcome against each:

- **G9's corrected conclusion at `retained_state.rs:152`** — rewritten this round into three cases,
  and therefore the text most worth re-reading: it must keep record clearing, anchor replacement and
  epoch clearing distinct **without weakening the chronology refusal**;
- **`CommitAnchor`'s *removed* wording (`ledger.rs:805`) and `begin_epoch`'s (`ledger.rs:1198`)** —
  tightened this round to name the slot (§10.4), and therefore also new text;
- **N2 at `retained_state.rs:176`** — tightened this round, against a clause round 2 certified true
  (§10.7 item 5);
- **the three narrowed co-existence sentences** (`ledger.rs:494`, `:1232`, `:1261`) — all new text,
  all asserting what a mutex proves, which is a claim about interleaving that no test in this
  repository makes;
- **G4's *exactly three*** and **G8's *one retained value*** — round 2 confirmed both true at their
  stated boundary and both structurally unguarded: neither the set of `pending` mutations nor the
  absence of another session-lived field is encoded. Untouched this round;
- **N5's *take entries no drain ever returned*** — true as an existence counterexample, false if a
  future pointer restates it universally. Untouched this round;
- **the `persist::write` lock-registry boundary** (§5 item 8), which step 2 must **inventory as
  judged-out** rather than pattern-narrow away.

**Do not commit** — the orchestrator commits at the phase boundary.

## 11. Review round 3, and the fix round that answers it

`docs/reviews/phase-2d-4a-C.md` § *Round 3 — step 1, against the round-2 fix* is the review. Verdict
**NOT READY**, **one finding — a Medium, prose-only** — and everything else on the attack list
**explicitly cleared**. The finding is the **fourth** member of the claim family round 2 discovered,
and round 2's own sweep could not see it: that sweep's pattern was written from the two *insertion*
sentences the reviewer had named, and this one is about two **conditional removals**.

**Round 3 reviewed round 2's fix.** Unlike rounds 1 and 2, its finding is **not** text a previous fix
round wrote — the false sentence predates this phase. What the fix rounds did was narrow three
sentences of the same family and leave the fourth standing, which is §10.7 item 3's prediction
arriving from the direction that item did not name.

### 11.1 The Medium — a shared guard promoted into a correlated post-state over two independent predicates

`src-tauri/src/ledger.rs`, in `adopt_reloaded_revision_under_the_session_lock`'s doc comment, said:

> **Both invalidations happen under one state guard**, taken once here, so no decision can observe
> the record cleared and the announcement still standing, or the reverse.

**That is false, and the same doc comment refutes it twelve lines above**: *"the equal cases are kept
deliberately, and the two comparisons are independent: a reload can leave the record standing and
drop the announcement, or the reverse."* The body is where the correction is derived from, and it is
two independently conditional removals:

| Mutation | Its predicate | When the reload matches |
|---|---|---|
| `clear_the_record_at(&mut ledger, path)` | a record exists **and** `recorded.revision != revision` | the record is **kept** |
| `ledger.announced.remove(path)` | an announcement exists **and** `*announced != ObservedState::Content(revision)` | the announcement is **kept** |

Nothing ties the two predicates. A reload whose revision the announcement already names but the
record does not clears the record and keeps the announcement — **an announcement with no record**;
the converse keeps the record and drops the announcement — **a record with no announcement**. Both
are the states the *equal cases are kept deliberately* paragraph calls intended, and both are legally
observable **after the method returns**.

**What the guard does prove, and it is the only thing it proves:** the gate and the state mutex are
held across both checks and across whatever removals they select, so no decision can interleave
between them and meet a **half-applied** invalidation. That is a claim about **interleaving during
this call**, never about the pair of values afterwards.

**How it was restated.** The sentence now says exactly that, then denies the wider reading in the
same breath: it names the two predicates as they are written in the body, **points at** the *equal
cases are kept deliberately* paragraph rather than restating its argument (the reviewer's own
suggestion, and the correct one — this file has now held a correct local statement beside a false
general one four times, and a fourth restatement would be a fourth thing to drift), names **both**
one-sided outcomes as legal after the return, and records itself as this phase's **round-3 Medium**
so a later reader sees corrected text rather than quietly rewritten text.

### 11.2 The four things this fix was told not to do, verified by reading after the edit

1. **The true local facts survive intact.** The independence paragraph (`ledger.rs:1612–1614`) and
   the two predicates in the body are **byte-identical** to what they were — the whole diff is 14
   inserted and 2 deleted lines in one doc comment, and `git diff --stat` names one source file.
2. **The three insertion-atomicity passages were not homogenized.** `ledger.rs:494–500`, `:1243–1251`
   and `:1279–1284` are untouched. They describe genuinely **unconditional** paired
   insertion/invalidation — `record_app_write` inserts the record, rewrites the path index, inserts
   the anchor and removes the announcement with no condition on any of them — so their wording is
   right and the reload method's is a **different** claim. Making them read alike would have been the
   regression, not the fix.
3. **`clear_the_record_at`'s pairing was not generalized.** Untouched. It still says the record and
   its path index are one fact in two maps, and still says expressly that it does **not** touch
   `latest_commit_at`.
4. **No behaviour changed.** Zero non-comment, non-blank changed lines (§11.5).

### 11.3 The sweep — pattern, counts, and what it found

Same discipline as rounds 1 and 2: both trees (`crates/espansoconfig-core/src` and `src-tauri/src`),
**recursive, never a file list**, `#[cfg(test)]` modules, test names and plain `//` comments included,
and **runs of comment lines joined into prose units before matching**, because this workspace wraps at
~76 columns and a claim straddles a line break as a matter of course.

**The pattern was derived from the claim, not from the finding's words.** Round 3 states the family
precisely, and it is narrower than *two values are always seen together*: **atomic execution
incorrectly promoted into a correlated post-state when the mutations have different predicates.** So
the pattern matched anything that turns a critical section into a statement about what can or cannot
be observed, or that binds two mutations into one outcome.

| | Pass 1 | Pass 2 (widened) |
|---|---|---|
| regexes | 26 | 39 |
| comment runs joined and scanned | 4950 | 4950 |
| runs matching | 97 | 166 |
| prose windows read and judged | 138 | 252 (**114 new**) |

**252 windows judged in all. 12 are the claim's subject matter — two retained values said to move as
one. 1 was false and is fixed; 11 are true and were left**, listed here so a later round can see they
were read rather than skipped:

- **`ledger.rs:494–500`** (module) and **`:1243–1251`** (`record_app_write`) — record/anchor. True:
  both narrow themselves to the insertion and deny the wider reading. Round 2's fix, round 3 cleared.
- **`ledger.rs:1279–1284`** — record/announcement at the **insertion**. True for the same reason, and
  it is the sentence whose *insertion* framing is why round 2's sweep could not see the reload one.
- **`ledger.rs:1314–1325`** — the insertion comment, *"taken on the same line group and under the
  same guard as the record"*. True and safe: a statement about **where the code is**, with no
  post-state attached.
- **`ledger.rs:1208–1216`** (`begin_epoch`) and **`:1948–1963`** (`clear_the_record_at`, whose
  post-edit lines these are — round 3 cited it as `:1936–1950`, and this round's twelve inserted
  lines sit above it) — round 2's tightenings, round 3 cleared. Verified against the bodies:
  `begin_epoch` clears all **four** maps unconditionally and resets the epoch and the sequence
  allocator beside them; `clear_the_record_at` touches two of those maps and expressly not
  `latest_commit_at`.
- **`ledger.rs:1093–1104`** — `documents_by_path`'s field doc, *"written and erased in the same two
  statements as `writes`"*. **True of every mutation site**: construction, `begin_epoch` (two
  adjacent unconditional clears), `record_app_write` (one insert plus a retain-and-insert) and
  `clear_the_record_at`. **Left as it stands, and here is the residue it rests on and Rust does not
  force.** In `clear_the_record_at` the `writes` removal is conditional on the index removal
  answering `Some`, so a `writes` entry whose path-index key was already gone would not be reached.
  Only one thing could produce one — two `DocumentId`s recorded at a single path, where the second
  `insert` replaces the index value and orphans the first's `writes` entry — and the field doc
  **already names the invariant that excludes it**, one `DocumentId` per path
  (`retained_state.rs` clause 1, `2d-1-notes.md` D7). Nothing in the type system enforces that
  invariant. Were it ever violated the residue is an orphaned `writes` entry **no decision reads** —
  `decide` and `record_at` both enter through the path index — discarded at the next `begin_epoch`.
  So: true as written, correctly hedged, and not the family shape, because its two removals share one
  predicate rather than carrying two.
- **`retained_state.rs` clause 2** — *"the pending set, the acknowledged watermark and the loss count
  go together"*. True by construction: the queue's `begin_epoch` is a **single whole-value
  assignment**, `*state = QueueState::empty(epoch)` (`reconciliation.rs:1029–1030`). Three fields of
  one struct replaced in one statement is not two predicates.
- **`commands.rs`'s two `begin_epoch` call comments** (~`:665–671`, `:702–706`) and
  **`:8847–8848`** — *"emptied here, in the same block"*, *"adopts the same epoch in the same
  block"*. True: both calls are inside the session-lock block, and — the point — **none of the three
  says a decision cannot observe one done and not the other.** They state execution location and
  point at the contract for scope. That is the correct shape, arrived at without this round's help.

**The remaining 242 windows were judged out by subject**, and the categories are worth naming because
they are where the pattern's noise lives: `rename()` atomicity in `persist::write`/`persist::save`
(each already hedged as *"not a compare-and-swap"*); `patch::edit`'s lockstep tree walks, paired lines
and *two removals*; type-level bundling where a struct's own shape is the guarantee
(`BackupBatchScan`/`BackupBatchListing`'s *never one without the other*, `SessionSideOfASave`'s three
borrows that *travel together*, `reconciliation`'s struct variants that keep operand sets together);
lock-ordering and validation-coupling statements in `watch.rs` and `watch_check.rs`; and
`watch::engine`'s *"in the same call"* passages, which state an execution fact and then describe the
**problem** it causes rather than a guarantee.

**Positions found false beyond the reviewer's one: zero.** The widening from 26 regexes to 39 —
adding the generic *together*, *at the same time*, *while holding*, *the two are*, *both maps*,
*in one call/block/step* forms — produced **114 further windows and no further defect.** That is
evidence the pattern was adequate **this time**, and no evidence whatever that a fifth family does
not exist: rounds 1, 2 and 3 each ended with a sweep its author believed adequate.

### 11.4 What round 3 cleared — this shrinks the unreviewed remainder, and is evidence in its own right

Recorded because a *cleared* position is a position a later round need not re-derive from scratch:

- **G9's corrected conclusion** (`retained_state.rs:152–170`) — the round-2 rewrite holds. Record
  clearing, anchor replacement and epoch clearing stay distinct, and the chronology refusal is
  preserved. **The two false universals of rounds 1 and 2 are both gone and neither came back.**
- **The three narrowed co-existence sentences** — all three match the single state guard and
  correctly disclaim permanent co-existence.
- **The slot/value wording at `CommitAnchor` (`:807–821`) and `begin_epoch` (`:1208–1216`)** —
  neither slides back from slot or chronology fact to the concrete value.
- **N2** (`retained_state.rs:191–195`) — *a path's slot* selects the true reading; the
  expressly-not-guaranteed bound is unchanged.
- **G4's *exactly three*** — still the whole set of production mutations of `QueueState::pending`;
  no fifth has appeared, and the queue still states that same-key uniqueness is not type-enforced.
- **G8's *the one exception*** — `begin_epoch` still resets every `LedgerState` field but `tally`;
  no second session-lived value has appeared inside the contract's boundary.
- **N5** — the counterexample is still existential and no pointer has made it universal.

Both structural risks named in round 2 remain **unencoded and unchanged**: nothing in the type system
fixes the number of `pending` mutations, and nothing prevents a second session-lived field.

### 11.5 What changed, file by file

- **`src-tauri/src/ledger.rs`** — one doc comment sentence in
  `adopt_reloaded_revision_under_the_session_lock` (§11.1). **Comments only.** No function body,
  signature, field, type or test was touched, and no other passage in the file moved.
- **`docs/decisions/2d-4a-C-notes.md`** — this section.
- **no other source file, no `crates/espansoconfig-core` path, no `src/` path, no command, no wire
  type, no event, no queue, no i18n key and no user-visible string.**

**Prose only, and verified rather than claimed.**

```sh
git diff -U0 -- crates/espansoconfig-core/src src-tauri/src \
  | rg '^[+-]' | rg -v '^(\+\+\+|---)' | sed -E 's/^[+-][[:space:]]*//' \
  | rg -v '^(///|//!|//|$)' | wc -l
# 0
```

### 11.6 The gates after this round

Each run as a separate command, with `pkill -f 'target/debug/deps/espansoconfig-'` before the
workspace suite and nothing else running on the host.

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1309 passed, 0 failed**, exit 0, summed over every `test result` line — the baseline, unmoved |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean**, exit 0 |
| `cargo fmt --check` | **clean**, exit 0 |
| `cargo doc --workspace --no-deps` | **exit 0**, **73** `links to private item` warnings — unchanged — and **zero** unresolved or ambiguous links |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** |
| `git diff --stat -- crates/espansoconfig-core/src src-tauri/src` | one source file, `+14 −2`; **no path under `src/`** |

**No gate is recorded here that was not run**, and two deviations are recorded rather than smoothed
over. **The workspace suite ran twice** — the first invocation's tail did not show the summary lines
and the second was piped through the `test result` fold — which is the same deviation §10.6 recorded;
host discipline says *once*. And the **73** figure is `espansoconfig-core`'s, a crate this round did
not edit: `src-tauri`, which holds the one edited file, emitted **no doc warning at all**, so the new
`[`ObservedState::Content`]` link resolves and costs nothing. The frontend gates were **not** run and
no figure for them is claimed — this step touches no path under `src/`, and §8's carry is unchanged.

### 11.7 What this round did not do, and where it is thin

1. **The corrected sentence is new text no reviewer has read.** §9.7 item 1 applies to it exactly as
   it applied to rounds 1 and 2, and it is the *only* new prose this round produced — which narrows
   the target for round 4 rather than removing it. **Every fix round of this phase has written a
   later round's finding**, and rounds 1, 2 and 3 each found the previous fix defective.
2. **Nothing here is enforced, and the false sentence proves how little that costs.** It stood
   through 1309 passing tests, `clippy`, `cargo doc`, a written audit trail and **two** review rounds
   whose sweeps were aimed at its own family. No test fails if it drifts back.
3. **The interleaving claim the corrected sentence now makes is itself untested.** It rests on
   reading the code: the method takes `enter_gate()` then `lock()`, and `decide`'s entry points take
   the same two in the same order, so no decision can run between the two checks. **No test in this
   repository races a decision against this method**, and none can be written against a
   `std::sync::Mutex` without a scheduler hook. The sentence claims what the guard proves; the proof
   is a reading, not an execution.
4. **The sweep is still a human reading with a throwaway script**, and this round adds the sharpest
   evidence yet for §10.7 item 3: the pattern that must find these claims cannot be derived from the
   words of the last one. Round 2's pattern was insertion-oriented and missed a removal; this round's
   was widened by 13 regexes **after** the first pass, on suspicion rather than on a hit, and the
   widening found nothing. A family is discovered by a reviewer, after the sweep is green.
5. **One true position was examined and deliberately left with its residue written down rather than
   removed** — `documents_by_path`'s field doc (§11.3). Its pairing rests on an invariant Rust does
   not force, the doc already names that invariant, and the residue of violating it is unreachable
   today and harmless if reached. Recorded so round 4 can disagree with the judgement rather than
   rediscover the position.
6. **No behaviour was changed, and no code defect was found.** One passage was false; the code it
   describes was right and remains untouched. Had it been the other way round this section would say
   so and the change would not be prose-only.

### 11.8 Likeliest sites for round 4, so step 2 and round 4 start from them

The reviewer's own list, carried here with this round's outcome against each:

- **the correction at `ledger.rs:1656`** — rewritten this round, and therefore the text most worth
  re-reading. The regression the reviewer names is a sentence that says both invalidations or both
  values are always absent or present together instead of only that no decision interleaves. The new
  text denies exactly that reading twice, in the same paragraph, and names both asymmetric outcomes
  as legal — **which is itself new prose that could be wrong in a way this round cannot see**;
- **the independence statement above it (`:1612–1614`) and the two predicates below it** —
  **untouched, verified byte-identical after the edit** (§11.2 item 1);
- **the three insertion-atomicity passages (`:494–500`, `:1243–1251`, `:1279–1284`)** — **untouched**,
  and the sweep was run with their correctness as a hypothesis to be preserved, not a shape to
  propagate (§11.2 item 2);
- **`clear_the_record_at` (`:1948–1963` after this round's insertion; `:1936–1950` in round 3's own
  numbering)** — **untouched**, and its non-generalization re-verified against the body
  (§11.2 item 3);
- **`documents_by_path`'s field doc (`:1093–1104`)** — examined this round, judged true, left, and
  its unenforced premise written down (§11.3, §11.7 item 5). Not on round 3's list; added by this
  round;
- **G4's *exactly three***, **G8's *the one exception***, **N5** — all three cleared by round 3 and
  untouched here, all three still structurally unguarded;
- **the `persist::write` lock-registry boundary** (§5 item 8), still to be **inventoried as
  judged-out** by step 2 rather than pattern-narrowed away.

## 12. Review round 4 — **READY**, no fix round, and step 1 closes

Appended verbatim to `docs/reviews/phase-2d-4a-C.md` under `## Round 4`. Codex ran **read-only** and
wrote no file; its final message was the deliverable and the orchestrator appended it. Job
`task-mtbk9hs8-ubpryt`, high effort, **141 s** — less than half of round 3's 301 s, which is what a
target narrowed to one paragraph costs.

**Round 4 is the first round of this phase to find nothing, and it says so without being asked
twice.** Counts across the phase: round 1 — 1 High, 1 Low; round 2 — 1 High, 1 Medium; round 3 —
0 High, 1 Medium, prose-only; **round 4 — 0 findings**. It cleared **all six** attack-list items and
states plainly that **no round 5 is warranted**. The brief carried the standing instruction — *if
everything you find is a restatement of wording already fixed, say so plainly in the verdict* — and
the answer came back stronger than that: not a restatement, but nothing at all.

**So the trend the round-3 handoff reported to the owner was the right read.** The judgement recorded
there was to run round 4 and expect it to be the last, on the grounds that the unreviewed remainder
had shrunk to one twelve-line paragraph while the finding severity fell round on round. That is now
measured rather than predicted.

### 12.1 What the round cleared, against what round 3 left open

- **The corrected paragraph itself** — the only new prose the round-3 fix wrote. Cleared against the
  method body: the record is removed only when its revision differs, the announcement only when its
  state differs, so the two asymmetric outcomes the paragraph names as legal *are* legal, and they
  agree with the *equal cases are kept deliberately* statement twelve lines above. The regression
  round 3 predicted — a sentence re-promoting the guard into a correlated post-state — was **not**
  written.
- **The interleaving claim** — §11.7 item 3 flagged it as resting on a reading and on no test. Round
  4 checked the reading and confirmed it, and **the orchestrator then checked it independently**
  rather than accepting the claim (§12.2).
- **`documents_by_path`'s field doc**, judged true and left by round 3 on an unenforced invariant.
  Round 4 was told it could disagree; it examined `identity_of`, `record_app_write` and
  `clear_the_record_at` and found **no concrete production violation**, so the judgement stands with
  a second reader behind it.
- **G4's *exactly three*, G8's *the one exception*, N5** — re-derived from the mutation sites and
  cleared again, all three still structurally unguarded.
- **The four regressions round 3 told the fix round to avoid** — the independence statement above,
  the two predicates below, the three insertion-atomicity passages, and `clear_the_record_at`'s
  unconditional pairing. All confirmed intact, which independently corroborates §11.2, where the fix
  round asserted the same thing from its own reading.
- **The `persist::write` lock-registry boundary** — cleared **as judged out**, with the reason stated
  in the reviewer's own words: those mutexes serialize disk writes and are **not** retained
  observation state that any observation, drain, suppression, coalescing or save-admission decision
  consults. Step 2 inherits this as an inventory obligation, never as a pattern to narrow.

### 12.2 The one claim the orchestrator verified rather than accepted

**A review's report is a claim, and the load-bearing one here was checked.** Round 4's clearance of
the interleaving statement rests on *"Those are the only source-tree calls to `decide`"* — if a
fourth entry point reached decision state without both acquisitions, the corrected paragraph would be
false and the round's central clearance with it.

- `rg -n 'decide\(' src-tauri/src/ crates/ --type rust` returns **exactly three** call sites of this
  `decide` — `ledger.rs:1373`, `:1483`, `:1558` — plus its definition at `:2088`. The only other
  match is `syntax/ownership.rs`'s own unrelated `decide`, a different function in a different crate.
- Each of the three takes `let _gate = self.enter_gate();` then `let mut ledger = self.lock();`, in
  that order, immediately before the call — `:1367–1368`, `:1481–1482`, `:1556–1557` — which is the
  same pair in the same order as `adopt_reloaded_revision_under_the_session_lock` at `:1683–1684`.

**The claim is therefore verified by reading, twice, by two readers — and it is still not tested.**
§11.7 item 3 stands unchanged: no test in this repository races a decision against this method, and
none can be written against a `std::sync::Mutex` without a scheduler hook. Round 4 records the same
limit in its own words, correctly calling the absence *unenforced evidence, not proof that the claim
is false*.

### 12.3 The gates after round 4 — nothing was measured, because nothing changed

**No fix round ran.** Round 4 found nothing to fix, so **no file in either source tree was
modified**; `git status --short --untracked-files=all` was **empty** immediately after the job, which
also confirms the read-only sandbox wrote nothing. The step-1 gate figures therefore stand exactly as
the round-3 fix measured them and are **not** re-measured here, because re-running a suite over an
unchanged tree measures the host, not the work:

- **`1309 / 431 / 2125 / 184`** (`cargo test --workspace` / `npm run check` files / `npm test` /
  `npm run build` modules). The three frontend figures remain carried forward unverified from 2d-4a
  round 6, as §11.6 says, and **must be re-measured by any step that touches `src/`**.

### 12.4 What this round did not do, and where it is thin

1. **A READY is a reader's judgement, not a proof.** Round 4 read the same tree rounds 1–3 read, with
   a narrower brief, and found nothing. That is evidence the paragraph holds; it is not evidence that
   no claim in step 1 can drift. **Nothing in step 1 is enforced by anything** — §11.7 item 2's
   measurement stands: the round-3 falsehood survived 1309 passing tests, `clippy`, `cargo doc`, a
   written audit trail and two review rounds aimed at its own family. **That is what step 2 is for**,
   and a clean round 4 does not reduce the case for it by one line.
2. **The three enumerations round 4 cleared are the ones it also names as the highest-risk drift
   sites** — G4's *exactly three* and G8's *the one exception* are true today and guarded by nothing,
   so a fourth mutation site or a second session-lived field would falsify them silently. Round 4
   says this in its round-5 list, and step 2 should treat both as inventory positions.
3. **The residue at `documents_by_path` is unchanged**, only better attested: two readers now agree
   the pairing claim is true and that the invariant behind it is not encoded in `record_app_write`'s
   types.
4. **`docs/` was not reviewed and cannot be**, for the reason step 2 must also state in its module
   doc: `2d-4a-notes.md` quotes six rounds' false sentences on purpose, so sweeping the documentation
   tree would flag the record of every defect this phase fixed.

### 12.5 Step 1 is closed

Every clause of the contract has been read by a reviewer at least once; the four rounds' findings are
all fixed and each fix has itself been reviewed by the round after it — including round 3's, which is
what round 4 was for. **The unreviewed remainder of step 1 is empty.**

**Step 2 is now unblocked**, and it inherits from this round: the six cleared positions as inventory
entries rather than as re-litigable questions, the `persist::write` boundary as a **judged-out**
position, N5's **existential** reading, and the phrase family as round 3 named it — *atomic execution
incorrectly promoted into a correlated post-state when the mutations have different predicates* —
covering **both** the unconditional paired insertion and the conditional paired removal.

---

# Step 2d-4a-C-2 — the check

**The scoped-lifetime contract is now enforced by a test.** `src-tauri/src/retained_state_contract.rs`
sweeps both source trees for a family of retained-state claims and fails on any position its recorded
inventory does not carry — the analogue of `src-tauri/src/liveness_contract.rs`, built on the same
machinery rather than on a copy of it. The three modules are:

| File | Lines | What it is |
|---|---|---|
| `src-tauri/src/prose_sweep.rs` | 236 | the shared walk, prose-unit split, matcher, window and tally, **extracted** from `liveness_contract.rs` |
| `src-tauri/src/retained_state_contract.rs` | 1281 | the new check: 88 phrases, 140 inventory entries, four tests |
| `src-tauri/src/liveness_contract.rs` | 845 (was 1013) | unchanged except for its module doc and a thin `sweep()` wrapper |

## 13. What step 2 built

### 13.1 The machinery is shared, and the older check's tests prove the extraction took nothing away

`prose_sweep.rs` holds `rust_files_under`, `ProseUnit`, `prose_units`, `Hit`, `window_around`,
`workspace_root`, `sweep` and `Judged` — every item the two checks need identically. Nothing of that
list remains in `liveness_contract.rs`; what stays there is what makes it *that* check, its phrase
family, its trees, its skip list and its inventory.

**The proof that the extraction is lossless is that the older check's four tests pass unchanged.**
Verified as bytes, not as a claim: the whole `#[cfg(test)] mod tests { … }` block of
`liveness_contract.rs`, its `INVENTORY` and its `LIVENESS_SHAPES` are **identical character for
character** to `HEAD` — the tests block is 5512 characters on both sides of the split — and its four
tests are green. **No test expectation was
edited to accommodate the refactor**, which is the whole point: an extraction that had to relax the
older guard would not be an extraction.

> **Correction, step 2 round 1 (§17).** The paragraph above is **historical as of that round**, and
> the measurement it reports can no longer be re-derived from the current tree. It was true of the
> tree committed at **`65a0138`**, and that commit is where it stands. Round 1's fix folded the
> comparison loop into `prose_sweep::complaints_against`, which rewrote `liveness_contract.rs`'s
> guard test — so the `mod tests` block is **no longer byte-identical to the pre-split `HEAD`**.
> `LIVENESS_SHAPES` and that file's `INVENTORY` still are, and were re-measured in §17.4. What
> replaces the byte-identity proof is weaker and is stated as such in §17.3: the older check's four
> tests are still green, and its inventory and phrase family are still untouched, but the *tests
> themselves* changed, so they are no longer independent evidence about the refactor that moved them.

Two shape changes were needed and are the only ones. `sweep` now takes the phrase family, the trees
and the skip list as arguments, so `liveness_contract::sweep()` is a two-line wrapper over it; and
the skip list is a slice rather than one `&str`, so a later check can skip more than one file. The
`assert!` that every skipped file exists moved with the function and still fires per path, which is
what stops a rename silently emptying a skip list and turning a check into a vacuous pass.

**`prose_units`'s comment-run joining was not touched.** It is load-bearing rather than convenient:
this workspace wraps its doc comments at about 76 columns, so a claim of eleven words straddles a
line break as a matter of course. The probe run in §13.5 shows it firing — the planted `two ways`
matched only because the run was joined.

### 13.2 The family, and why it has two halves

`RETAINED_STATE_SHAPES` is 88 phrases in three groups, drawn around the **claims** and never around
the vocabulary:

1. **how long a retained value survives, and what removes it** — the enumeration Phase 2d-4a's round 5
   found counting two ways where the code has three;
2. **what a number a consumer stores claims over time** — the monotonicity round 6 found unscoped, on
   the watermark, which is round 5's finding one level up;
3. **atomic execution promoted into a correlated post-state when the mutations have different
   predicates** — step 1's round 3 named this one, and the wording is the specification. Group 3
   carries **both** the vocabulary of the guard (`under one state guard`, `can interleave`,
   `half-written pair`, `half-applied`, `no decision can`) and the vocabulary of two values said to
   move as one (`seen together`, `observed together`, `co-existence`, `written together`,
   `cleared apart`, `without the other`, `travel together`, `in lockstep`). **A family drawn from
   either half alone ships with the blind spot that produced round 3's finding**: round 2 corrected
   three sentences of the *unconditional paired insertion* form, its sweep was written from those
   three, and the *conditional paired removal* in `adopt_reloaded_revision_under_the_session_lock`
   one method away was invisible to it.

Both halves are demonstrably reached in the shipped tree. Group 3 fires on `ledger.rs`'s module doc
and `record_app_write` (the insertions round 2 corrected) **and** on
`adopt_reloaded_revision_under_the_session_lock` (`under one state guard`, `can interleave`,
`half-applied` — round 3's Medium), which is the case a one-sided family could not see.

**Phrases with no hit today are kept deliberately — twenty of the 88.** `no decision can observe`,
`cannot interleave`, `discarded whole`, `moves as one` and `both maps` are among them: a fix round
removed the sentence that held one, or the wording is an obvious inflection nobody has written yet.
They stay so that writing one of them is a finding rather than a silent arrival — the same reason
2d-3-C kept phrases its own tree no longer held.

**What was deliberately left out, and why**, because a pattern that is only ever widened is a pattern
nobody can read, all five figures measured rather than estimated: `backwards` (36 hits, of which
**4** are the watermark claim — 12 are `syntax/block.rs`'s backwards header lexer and 10 the backup
catalogue's clock-ordering argument), `process-wide` (19, pure vocabulary and not one claim by
itself), `one way` (12, six of them `commands.rs` saying it *writes a file exactly one way*),
`monotonic` (18, nine of them `ledger.rs` on `Instant` being documented monotonic and expressly not
strictly increasing) and `in the same breath` (5, rhetorical — where a sentence sits, not what a
value does). Each was replaced by the claim-shaped form that carries the same claim —
`watermark backwards`, `monotonic within`, `nothing evicts`, `for the life of`. This is the one judgement in step 2 that a
later round is most likely to disagree with, and §14 item 4 says so.

### 13.3 The inventory: 224 hits over 29 files, every one judged

Not one hit was dropped by narrowing the pattern. The kinds, as the check's own taxonomy:

| Kind | Entries | Hits | Files |
|---|---|---|---|
| **the contract itself** | 29 | 34 | `watch/retained_state.rs` |
| **a pointer** | 3 | 3 | `lib.rs`, `ledger.rs`, `reconciliation.rs` |
| **a pointer *and* a local fact** | 1 | 2 | `reconciliation.rs` |
| **a pointer *and* a false positive** | 2 | 4 | `reconciliation.rs` |
| **a local fact** | 61 | 119 | `ledger.rs`, `reconciliation.rs`, `commands.rs`, `dispatch_check.rs`, `workspace/mod.rs` |
| **a false positive** | 39 | 56 | 25 files |
| **judged out** | 5 | 6 | `persist/write.rs` |

The seven rows are **140 entries and 224 hits**, and the totals are derived by summing the rows
rather than asserted over them — saying *six* over a list of seven was 2d-3's round 14's second Low.
Three rows are mixed because one `(file, phrase)` key can cover two passages of different kinds; the
row names both rather than picking the flattering one.

The false positives are the pattern meeting unrelated subsystems — the patch engine's lockstep tree
walks, backup-file rotation, the codec's unconditional quoting, two ways an enum reaches `serde`.
**They are carried, not filtered.** A pattern narrowed to make today's noise go away is a pattern that
misses tomorrow's claim, and the noise costs 39 inventory lines once.

### 13.4 The judged-out positions, recorded rather than pattern-tuned away

**`crates/espansoconfig-core/src/persist/write.rs`'s lock registry is in the inventory as a judged-out
position**, which is what step 1 §5 item 8 and round 4 both required. The family hits it five ways —
`path ever written`, `one entry per`, `the process has ever`, `leaked deliberately`, `for the life of`
— and every one of those entries carries round 4's reason in its own words: those mutexes **serialize
disk writes** and are **not retained observation state** that any observation, drain, suppression,
coalescing or save-admission decision consults. The registry really is R9's shape in a second
subsystem (one entry per real path ever written, process-wide, never evicted, a leaked
`&'static Mutex<()>` per path) and it is **out on the claim, not on the shape**.

`crates/espansoconfig-core/src/persist/backup.rs` — backup-file rotation, step 1's *vocabulary trap* —
is out for the same kind of reason and is carried as five false-positive entries.

**Narrowing the pattern until a hit disappears is the one move this check cannot catch**
(`2d-4a-notes.md` §11.4), which is exactly why both boundaries are written beside the hit rather than
into the pattern. Step 1's other 31 judged-out prose units were not re-litigated: where the family
reaches them at all they are inventoried with the judgement step 1 gave them (the resource and thread
lifetimes in `watch.rs`, the parse cache, the determinism qualification, the plain false positives).

### 13.5 The proof that the check fails — two probes, two files, the actual historical defects

2d-3-C §4.4's standard: an argued guard is how round 11 removed an assertion and round 12 found the
removal had cost a detection. **This one was driven, twice, on two different files, with the two
defects the review actually shipped.** Each probe was reverted by the **inverse edit** — never by
`git checkout`, which on a tree carrying unstaged work is not an undo — and the revert was verified by
`shasum -a 256` matching the pre-probe digest exactly.

**Probe 1 — a retention position, `src-tauri/src/reconciliation.rs`**, Phase 2d-4a round 5's Medium:
the boundary counting two ways where the code has three. The module doc's *"Of the three ways a
**stored** entry then leaves"* was replaced by *"A **stored** entry leaves this queue in exactly two /
ways"*, wrapped so the phrase straddles a line break. Digest before: `120583fe…4330`.

```
test retained_state_contract::tests::every_retained_state_claim_is_judged ... FAILED
    src-tauri/src/reconciliation.rs / "leaves this queue": found 3, inventory says 2
    src-tauri/src/reconciliation.rs / "three ways": found 1, inventory says 2
    src-tauri/src/reconciliation.rs / "two ways": found 2, inventory says 1
            line 1: …A **stored** entry leaves this queue in exactly two ways, and the one this module decides is the overflow…
```

Three phrases fired on one planted sentence, and **`two ways` fired across the line break** — the
joined-unit sweep doing the thing a line sweep cannot. The inverse edit restored digest
`120583fe…4330`.

**Probe 2 — a watermark position, `src-tauri/src/dispatch_check.rs`**, Phase 2d-4a round 6's Medium:
`newest_sequence` told a caller to store it *unconditionally* with no scope. The sentence *"**Both
drains here are the same epoch's**, which is the scope that claim carries … so what this test covers
is the claim inside its scope and never across a replacement"* was deleted, leaving the
unconditional half standing. Digest before: `98a989ff…fd1db`.

```
test retained_state_contract::tests::every_retained_state_claim_is_judged ... FAILED
    src-tauri/src/dispatch_check.rs / "across a replacement": inventory says 1, found none — reworded or removed, so judge it again
```

The inverse edit restored digest `98a989ff…fd1db`, and all four tests were green again.

**Both directions were watched failing.** Probe 1 is the *unrecorded hit* direction — a position
nobody judged, printed with its line and its context; probe 2 is the *inventory entry matching
nothing* direction — a passage reworded or removed without being judged again. Note what probe 2
shows about the check's grain: **dropping the scope did not remove the claim**, it removed the
qualification, and the check caught it because the qualification carried a phrase of the family. Had
round 6's defect been written with no family phrase in the deleted clause, nothing would have fired —
which is §14 item 1.

## 14. What step 2 does **not** close, and where it is thin

Stated plainly, because getting this wrong would reproduce, inside the mechanism built to stop it,
this project's declared worst defect class.

1. **The check cannot judge whether a passage's claim is true.** It catches an **unmarked** claim and
   a **new** claim. A passage that carries a pointer and still says something false passes it, and so
   does a rewording that keeps the same phrase in the same file — the key is `(file, phrase)`, so
   swapping one recorded sentence for a different sentence using the same phrase moves no count.
   **The reason it is worth having is the reduction of surface — one place to be right instead of
   fifty — and never the check's judgement.**
2. **A paraphrase built from none of the 88 phrases is invisible, and this is measured rather than
   feared.** Step 1's sweep ran 33 probe phrases over 85 prose units of these two trees, comment runs
   joined, and **four of its 45 pointer passages sat in units none of the 33 matched** —
   `ReconciliationWake::newest_sequence`, `ReconciliationQueue::drain`'s inline `max` comment,
   `CommitAnchor`, `LedgerState::announced` — with a fifth in `watch/native.rs`. They were found by
   **reading the files**. That is direct evidence that **a phrase family is not the family**, and the
   module doc says so rather than letting the guard look stronger than it is. A future round writing
   *"the queue keeps this until the session ends"* with none of the 88 phrases in it would pass.
3. **Nothing forces a new passage to point rather than restate.** The check forces it to be *judged*.
   A maintainer who judges a fresh paraphrase acceptable and records it has satisfied every test in
   this workspace.
4. **Narrowing the pattern is the move it cannot catch**, and step 2 exercised exactly that move five
   times in §13.2 when it dropped `backwards`, `process-wide`, `one way`, `monotonic` and `in the same
   breath`. Each drop is argued and each was replaced by a claim-shaped form, but **a later round is
   free to disagree with any of them**, and nothing in the repository records that a phrase was ever
   in the list. That is a hole in the same class as the one the check closes.
5. **The sweep skips exactly one file: the check's own source.** A retained-state claim written into
   `retained_state_contract.rs` is invisible to it. The sweep asserts the skipped file exists, so a
   rename cannot silently empty the skip list, and nothing else defends this hole. **The two checks do
   not exempt each other** — `the_sweep_reaches_both_trees` asserts that `liveness_contract.rs` is
   swept by this one — but each is blind to itself.

   > **Amended, step 2 round 1 (§17.2).** The middle clause is **no longer what the assertion says**.
   > Round 1's fix moved the comparison — and with it the one retained-state-shaped wording
   > `liveness_contract.rs` held, its own duplicate-detection assertion message — into
   > `prose_sweep.rs`, leaving the sibling's source with nothing for this sweep to find. The
   > assertion now names **`src-tauri/src/prose_sweep.rs`**, the machinery both checks are built on,
   > and reads *the machinery both contract checks share is swept too — neither exempts it*. Both
   > files are still swept rather than skipped; what changed is which one carries a hit, and the
   > claim the assertion is allowed to make about it. Each check is still blind to itself.
6. **It sweeps two source trees and no document.** `docs/` is deliberately not swept and **cannot be**:
   `2d-4a-notes.md` quotes six review rounds' false sentences on purpose, so a check over the
   documentation tree would fail on the record of every defect this phase fixed. This file and that one
   point at the contract as prose, with nothing enforcing that they keep pointing — 2d-3-C §5 limit 4,
   inherited unchanged.
7. ~~**The both-direction comparison is duplicated between the two checks, and that is a deliberate
   trade with a real cost.**~~ **DISCHARGED at step 2 round 1 (§17).** What this item said, kept
   because the round that closed it is the concrete instance of what it predicted: `prose_sweep.rs`
   held the machinery; the ~45-line comparison loop stayed in each check's own guard test, because
   the proof that the extraction took nothing away from the older check is that **its four tests pass
   unchanged**, and folding the comparison into a shared helper would have rewritten them. So there
   were two copies of one loop, which is the exact shape this project's recurring failure mode takes.
   It was named in the module doc as well as here, and *a later step that is willing to re-review the
   liveness guard should fold it*.

   **That step is step 2's round 1, and it did not have the luxury of choosing.** The review found a
   Low-severity **code defect** in the duplicated loop — zero used as an "unseen" sentinel — and it
   was in **both** copies, because the copy carried it. The comparison is now
   `prose_sweep::complaints_against`, written once, and neither guard holds a copy; each keeps only
   its own final assertion sentence, which names its own contract module and its own `INVENTORY`
   path. **The trade this item described is therefore no longer current, and its statement of the
   cost is now a statement about the past.**

   **What the discharge cost is exactly the thing this item was protecting.** `liveness_contract.rs`'s
   guard test is **no longer byte-identical to what it was**, so §13.1's *its four tests pass
   unchanged* proof of the extraction is now **historical** — it stands recorded at commit
   **`65a0138`** and **cannot be re-derived from the current tree**. §17.3 says what is left in its
   place and why that is weaker.
8. **The contract's own clauses are still prose over code.** No test fails if a clause drifts from the
   code it cites; §2's tables remain an audit trail rather than an oracle. G4's *exactly three* and
   G8's *the one exception* still rest on a reading of every mutation of one field. What the check
   adds is that a **restatement** of those clauses elsewhere must be judged — not that the clause is
   true.
9. **Eight of step 1's 45 pointers are still not compile-checked**, and this step changed nothing
   about that. `#[cfg(test)]` modules and `//` comments are not resolved by rustdoc, so a rename of the
   contract leaves those eight silently stale. Both new modules are themselves `#[cfg(test)]`, so
   their own intra-doc links are in that same unchecked set.
10. **R9 is still OPEN.** The identity register's unbounded retention is stated in the contract and
    now inventoried at `workspace/mod.rs`, which is not a bound and not a measurement.
11. **This step wrote sentences, and the round that reviews them is not optional.** Every fix round of
    this phase has written the next round's findings. This one wrote a module doc with five stated
    limits, 88 phrases with their group comments, and 140 reason lines — and a reason line is exactly
    the kind of prose that can claim more than the code gives. The likeliest sites are the reasons that
    summarise several passages in one line (`ledger.rs`'s `outlives` covers twelve hits, `until the
    epoch` seven, `no decision can` five) and the five phrase drops in §13.2.

## 15. What changed, file by file

**Five files, and none of them under `src/`.** Five, not four: this record is one of them, and
listing the code and forgetting the record is the exact habit Phase 2d-4a's round 6 filed as L5 and
Phase 2d-3's round 12 found before it. `PROGRESS.md` is the orchestrator's and is written in its own
commit, as every step of this phase has been.

- **`src-tauri/src/prose_sweep.rs`** — new, 236 lines. The shared machinery, moved out of
  `liveness_contract.rs` with `sweep`'s signature widened to take the family, the trees and the skip
  list, and `Judged`'s `reason` doc generalised from *this module's subject is
  `espansoconfig_core::watch::liveness`* to a statement true of both checks.
- **`src-tauri/src/retained_state_contract.rs`** — new, 1281 lines. The module doc with its five
  limits, `RETAINED_STATE_SHAPES` (88), `SWEPT_TREES`, `SKIPPED`, `INVENTORY` (140), the `sweep()`
  wrapper and four tests: `every_shape_is_lowercase`, `the_sweep_reaches_both_trees`,
  `a_claim_that_wraps_across_a_line_break_is_seen` and the guard,
  `every_retained_state_claim_is_judged`.
- **`src-tauri/src/liveness_contract.rs`** — 1013 lines to 845. The machinery deleted, a
  `use crate::prose_sweep::{…}` added, a *where the machinery lives* section added to the module doc,
  and `sweep()` reduced to a wrapper. **`LIVENESS_SHAPES`, `INVENTORY` and the whole `mod tests` block
  are byte-identical to `HEAD`.**
- **`src-tauri/src/main.rs`** — two `#[cfg(test)] mod` declarations, in alphabetical position.
- **`docs/decisions/2d-4a-C-notes.md`** — this step-2 record: §13 to §16 and the header above them.

**`crates/espansoconfig-core` is untouched**: no core file changed, and
`cargo tree -p espansoconfig-core | rg tauri` is still empty. **No Svelte component, no TypeScript and
no i18n key changed**, so the three frontend figures are carried forward from 2d-4a round 6 exactly as
step 1 carried them, unverified by this step.

## 16. The gates

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1313 passed, 0 failed**, 26 result lines all `ok`, exit 0. **+4** — the new check's four tests, and nothing else moved |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** — the host-scar gate |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean, exit 0 |
| `cargo fmt --check` | clean, exit 0 (one string literal was re-wrapped by `cargo fmt` before this run) |
| `cargo doc --workspace --no-deps` | exit 0, **73** `private_intra_doc_links` warnings — the pre-existing count, unmoved — and **zero** unresolved links |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** |
| `git status --short --untracked-files=all` | four paths, **none under `src/`** |
| `liveness_contract.rs`'s four tests | green, and byte-identical to `HEAD` |

The frontend baselines **431 / 2125 / 184** are carried forward unverified, because this step touched
no path under `src/`. Any step that does must re-measure them.

---

## 17. Step 2, review round 1, and the fix round that answers it

**Verdict: NOT READY**, one finding, Low. `docs/reviews/phase-2d-4a-C.md`, section
*Step 2 — round 1 (the check, the shared machinery and the record)*. The inventory, the phrase family,
the five phrase drops and both insertion/removal halves all held up; what did not was the guard's own
comparison loop.

### 17.1 The finding — a **code defect**, and the first of this phase that was not prose-only

Every previous round of 2d-4a-C found a sentence that claimed more than the code gave. **This one
found code.** The guard compared what the sweep found against what the inventory records using **zero
as an "unseen" sentinel**, and that sentinel defeated two invariants the test's own doc comment states
it enforces:

1. **Duplicate detection was defeated for a zero-count key.** The uniqueness check was
   `assert_eq!(*slot, 0, …)` against a slot created by `.or_insert(0)`. A first entry with `count: 0`
   left the slot holding `0`, so a **second entry for the same `(file, phrase)` also saw `*slot == 0`
   and passed**. The sentinel and a legitimate value were the same value.
2. **A phantom entry passed the reverse check.** The reverse loop was
   `if !found.contains_key(key) && *count > 0`, so an inventory entry with `count: 0` that matched
   **nothing** was skipped in silence — the *reworded or removed, so judge it again* direction, which
   is the whole reason the reverse loop exists.

Neither is broken in the shipped tree: all 86 liveness entries and all 140 retained-state entries carry
positive counts. **It is latent, which is why it is a Low — and it is real, and it was in both guards.**

**The defect was pre-existing in `liveness_contract.rs`** — it shipped with the first prose-contract
check in Phase 2d-3-C — and step 2's extraction, which copied the comparison rather than sharing it,
**propagated it into the new guard**. The review says so in its own words: keeping the comparison
unchanged *"was reasonable evidence for the extraction, but the duplication has now propagated the same
zero-sentinel defect into both guards."*

**This is the concrete instance of what §14 item 7 predicted.** That item named the duplicated
comparison as *"the exact shape this project's recurring failure mode takes"* and said a later step
should fold it. It did not have to wait long: one review round after the copy was made, one defect was
sitting in both copies. The prediction and its instance are two commits apart.

### 17.2 The fix — extracted once, and the two positions the extraction moved

The comparison now lives once, as `prose_sweep::complaints_against(hits, inventory, shapes)
-> Vec<String>`. **Neither guard holds a copy.** Each guard's test is now one call and its own
`assert!`, and the assertion sentence stays with the check because the two differ: each names its own
contract module and its own file's `INVENTORY` path.

What the shared function does, and what changed inside it:

| | Before, in two copies | Now, once |
|---|---|---|
| phrase membership | `SHAPES.contains(&entry.phrase)` | unchanged, asserted for the caller's `shapes` |
| non-empty reason | asserted | unchanged |
| **zero counts** | legal, and used as the sentinel | **`assert!(entry.count > 0)`** — a zero-count entry can match nothing and is indistinguishable from the entry's absence, so it is a hard error |
| **duplicates** | `assert_eq!(*slot, 0)` against a sentinel | **`recorded.insert(key, count).is_none()`** — the map's own answer about what was already there |
| forward | count mismatch, absent key giving an expected 0 | unchanged, and the per-hit `line`/`context` detail is kept verbatim |
| **reverse** | `!found.contains_key(key) && *count > 0` | **`!found.contains_key(key)`** — the `count > 0` condition is gone, and is now unreachable anyway |

Making zero illegal and dropping the reverse condition are one decision, not two: once no entry can
carry a zero, the reverse loop's guard could only ever have hidden the case it was written to hide.

**The extraction moved two recorded positions, and both had to be judged again — by the guard, out
loud, on the first run.** This is worth recording because it is the check working on its own author:

- **`liveness_contract.rs` / `"one entry per"` → `prose_sweep.rs`.** The duplicate-detection assertion
  message *"one entry per file and phrase"* is a **retained-state family phrase**, and the
  retained-state inventory carried it as a false positive at the sibling check's path. Moving the
  assertion into `prose_sweep.rs` produced an unrecorded hit there and a phantom entry at the old
  path, and the guard printed both. **The one entry was re-pointed: `file` and `reason` changed,
  `phrase` and `count` did not, and the judgement — *false positive: a contract check's own assertion
  message* — did not.** The inventory still holds 140 entries. This is the single exception to *the
  inventory does not change*, and it is stated as an exception rather than folded into the fix.
- **`the_sweep_reaches_both_trees`'s last assertion.** It asserted that
  `src-tauri/src/liveness_contract.rs` appears among this sweep's hits — *"the other contract check is
  swept too — neither exempts the other"*. With the one retained-state-shaped wording gone from that
  file, the assertion became false while the property it was defending was untouched: the sibling is
  still swept, it simply has nothing to find. It now names **`src-tauri/src/prose_sweep.rs`**, the
  machinery both checks are built on, and reads *the machinery both contract checks share is swept
  too — neither exempts it*. §14 item 5 carries the amendment.

### 17.3 What the fix costs, said plainly

**§13.1's byte-identity proof is now historical.** It read: the extraction is lossless because
`liveness_contract.rs`'s whole `mod tests` block is identical character for character to `HEAD` and its
four tests are green. Folding the comparison **rewrote that block**, so the measurement stands recorded
at commit **`65a0138`** and **cannot be re-derived from the current tree**. §13.1 carries a correction
block saying so.

What is left in its place is weaker, and is not a substitute:

- `LIVENESS_SHAPES` and `liveness_contract.rs`'s `INVENTORY` are **still byte-identical to the
  pre-split `HEAD`** — re-measured in §17.4 — so nothing about *what the older check judges* moved;
- its four tests are still green;
- but the tests themselves changed, so they are **no longer independent evidence** about the split
  that moved the machinery out from under them. A future round wanting that evidence has to read
  `65a0138`.

This was not a free choice. Leaving the copies to preserve the proof would have left a known defect in
two places, which is the trade §14 item 7 had already lost.

### 17.4 The three data arrays, verified unchanged

Verified by extracting each array from `git show HEAD:<path>` and from the working tree and comparing
the two byte for byte, not by reading the diff:

| Array | `HEAD` | now | identical | entries |
|---|---|---|---|---|
| `LIVENESS_SHAPES` | 2765 bytes | 2765 bytes | **yes** | — |
| `liveness_contract.rs`'s `INVENTORY` | 20088 bytes | 20088 bytes | **yes** | 86 → 86 |
| `RETAINED_STATE_SHAPES` | 4009 bytes | 4009 bytes | **yes** | — |
| `retained_state_contract.rs`'s `INVENTORY` | 35100 bytes | 35324 bytes | **no — one entry** | 140 → 140 |

The one difference is §17.2's re-pointed entry and nothing else: the unified diff of the two array
texts is exactly that entry's removal at its old alphabetical position and its reinsertion at its new
one, with `phrase` and `count` unchanged. **No entry was added, removed or re-counted, and no phrase in
either family was touched.**

### 17.5 The three new failure modes, watched failing — eight probes, both guards

`docs/decisions/2d-3-C-notes.md` §4.4 requires that a check of this kind is **watched failing**, not
asserted to fail. Each probe was applied by a textual edit, the guard run, and the edit **reverted by
its inverse** — the probe text replaced by the original text — with `shasum -a 256` before and after.
Every revert digest equals its pre-probe digest.

Pre-probe and post-revert digest of `src-tauri/src/liveness_contract.rs`:
`14229287e6abff2d2a007b226aca5b4d841903e2f7d3e127492ff1f3c1eaae50`
Pre-probe and post-revert digest of `src-tauri/src/retained_state_contract.rs`:
`0ecdc2f3448491490bd02904d7442f7c71df61a17d2799d4104e008d80db8997`

| Probe | Planted | Probed digest | Exit | What the test printed |
|---|---|---|---|---|
| L1 phantom | `Judged { probe_nonexistent.rs, "must answer", 1 }` | `0da12420…bb6b67` | 101 | `src-tauri/src/probe_nonexistent.rs / "must answer": inventory says 1, found none — reworded or removed, so judge it again` |
| L2 duplicate, first `count: 0` | two entries, same key, counts 0 then 1 | `aa633bac…113ca0` | 101 | `an inventory entry records at least one occurrence — a count of zero can match nothing and is indistinguishable from the entry's absence: src-tauri/src/probe_nonexistent.rs / must answer` |
| L3 duplicate, both positive | two entries, same key, counts 1 and 1 | `d1d65736…acc235` | 101 | `one entry per file and phrase: src-tauri/src/probe_nonexistent.rs / must answer` |
| L4 existing entry to `count: 0` | `watch_check.rs / "observation arrives"` 2 → 0 | `b0813f49…cac838` | 101 | `an inventory entry records at least one occurrence … : src-tauri/src/watch_check.rs / observation arrives` |
| R1 phantom | `Judged { probe_nonexistent.rs, "one entry per", 1 }` | `e4bd7038…cb93bf8` | 101 | `src-tauri/src/probe_nonexistent.rs / "one entry per": inventory says 1, found none — reworded or removed, so judge it again` |
| R2 duplicate, first `count: 0` | two entries, same key, counts 0 then 1 | `78ba0a85…814913` | 101 | `an inventory entry records at least one occurrence … : src-tauri/src/probe_nonexistent.rs / one entry per` |
| R3 duplicate, both positive | two entries, same key, counts 1 and 1 | `373941ca…61a252` | 101 | `one entry per file and phrase: src-tauri/src/probe_nonexistent.rs / one entry per` |
| R4 existing entry to `count: 0` | `watch.rs / "two ways"` 2 → 0 | `2ee9bdc6…8341ce` | 101 | `an inventory entry records at least one occurrence … : src-tauri/src/watch.rs / two ways` |

Three things the table shows that are worth naming:

- **L2 and R2 are the reported defect's exact shape**, and they now fail. Under the shipped code they
  passed in silence.
- **L3 and R3 panic from `src-tauri/src/prose_sweep.rs:314` and L2/L4/R2/R4 from
  `prose_sweep.rs:307`** — from the shared function, reached through *both* guards. That is the
  positive evidence that the comparison is genuinely shared rather than merely copied into a third
  place: one line number serves two checks.
- **L1 and R1 panic from each check's own file**, at its own assertion sentence — the half that
  deliberately did not move.

A zero-count phantom is now caught by the `count > 0` assertion rather than by the reverse loop, which
is why the reverse loop no longer needs the condition: the case it was hiding cannot be constructed.

### 17.6 What changed, file by file

**Four files, none under `src/`.** Four, not three: this record is one of them.

- **`src-tauri/src/prose_sweep.rs`** — 236 lines to 349. `complaints_against` added with its doc
  comment: what it asserts about the inventory before comparing anything, why a zero count is now a
  hard error, why duplicates are detected by `insert(..).is_none()`, and why both directions are
  unconditional. The module doc's *judging those occurrences stays the caller's* paragraph was
  narrowed to what is still true — the inventory and the final assertion sentence are the caller's.
  **`prose_units` was not touched**: its comment-run joining is load-bearing, and this fix had no
  business anywhere near it.
- **`src-tauri/src/liveness_contract.rs`** — 845 lines to 804. The guard test's ~45-line body replaced
  by one call, its doc comment given a sentence naming where the comparison now lives, and the `use`
  narrowed (`tally` and `std::collections::BTreeMap` are no longer needed here). **`LIVENESS_SHAPES`
  and `INVENTORY` are byte-identical to `HEAD`.**
- **`src-tauri/src/retained_state_contract.rs`** — 1281 lines to 1247. The same replacement and the
  same `use` narrowing; §17.2's one re-pointed `INVENTORY` entry; and
  `the_sweep_reaches_both_trees`'s last assertion re-pointed at `prose_sweep.rs` with its doc comment
  saying why it moved. **`RETAINED_STATE_SHAPES` is byte-identical to `HEAD`.**
- **`docs/decisions/2d-4a-C-notes.md`** — this section, the correction block in §13.1, and the
  amendments to §14 items 5 and 7.

**`crates/espansoconfig-core` is untouched.** No path under `src/` changed, so the three frontend
figures are carried forward unverified, exactly as step 2 carried them.

### 17.7 The gates after this round

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1313 passed, 0 failed**, 26 result lines all `ok`, exit 0 — **unmoved**, as a pure refactor of two test bodies should be |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** — the host-scar gate |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean, exit 0 |
| `cargo fmt --check` | clean, exit 0 |
| `cargo doc --workspace --no-deps` | exit 0, **73** `links to private item` warnings — the pre-existing count, unmoved — and **zero** unresolved links |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** |
| `git status --short` | `docs/decisions/2d-4a-C-notes.md`, `docs/reviews/phase-2d-4a-C.md` and the three `src-tauri/src` files — **none under `src/`** |
| The eight probes of §17.5 | all red, all reverted, all digests matched |

The frontend baselines **431 / 2125 / 184** are carried forward unverified, because this round touched
no path under `src/`.

### 17.8 What this round does **not** close

1. **The zero-count hole is closed by making zero illegal, not by making it meaningful.** There is now
   no way to record *"this phrase deliberately appears nowhere in this file"*. If a later round wants
   that — a pinned absence — it needs a different field, not a count of zero, and the assertion
   message says why in the same breath as refusing it.
2. **The `(file, phrase)` key is unchanged, so §14 item 1 stands untouched.** Swapping one recorded
   sentence for a different sentence using the same phrase in the same file still moves no count, and
   the repaired comparison does not see it.
3. **`INVENTORY` is now known to move when code moves, and nothing warns before the fact.** §17.2's
   re-pointing was discovered by the guard failing on the first run of the fix — which is the guard
   working — but it means **any future refactor that relocates an inventoried assertion message
   relocates an inventory entry**, and the only notice is a red test. The assertion messages of these
   checks are prose in the swept trees like any other, and nothing marks them as such.
4. **Nothing pins what `complaints_against`'s doc comment claims.** Its contract — three asserted
   properties, two unconditional directions — is prose, and reverting any sentence of it while keeping
   the code leaves every test green. That is `CLAUDE.md`'s stated worst defect class, and this round
   added ~50 lines of exactly that kind of prose.
5. **The eight probes prove the three failure modes fire; they do not prove the comparison is
   otherwise correct.** No probe exercised a forward count mismatch, an out-of-family phrase or an
   empty reason — those paths are unchanged from `65a0138` and were re-run only as part of the
   two guards passing over their real data.
6. **This round wrote sentences, and the round that reviews them is not optional.** Every fix round of
   this phase has written the next round's findings. The likeliest sites are §17.2's account of the
   re-pointed entry — whose new `reason` line now carries a small history and could easily claim more
   than it should — and §17.3's claim about what survives of the byte-identity proof.
