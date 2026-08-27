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
