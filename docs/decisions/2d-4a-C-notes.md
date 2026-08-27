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
