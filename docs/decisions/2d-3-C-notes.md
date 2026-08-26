# Step 2d-3-C — the liveness contract and its check

**The observation pipeline's liveness contract is now stated in exactly one place, twenty positions
across the two source trees point at it instead of restating it, and a test fails the build on a
liveness-shaped position no inventory entry covers.** The contract is
`crates/espansoconfig-core/src/watch/liveness.rs`; the check is
`src-tauri/src/liveness_contract.rs`.

This step exists to **end an open-ended review tail**, by owner decision. Fourteen consecutive rounds
of the 2d-3 ledger review each found a false claim about this pipeline's liveness, and rounds 12, 13
and 14 each found a High that a *previous fix round* had written. `2d-3-notes.md` names the root cause
twice — §19.7 item 38 and §20.7 item 41 — and both fix rounds declined to build the remedy, each for
the same stated reason: *inventing machinery while fixing eight positions is how a fix round produces
the next round's finding*. This step is that machinery, built on its own, with nothing else in it.

There is no round 15.

---

## 1. What was built, and why this and not something else

Three parts, and each answers a named residue.

**One canonical statement** (residue 38). The true contract lived in three doc comments —
`ObservationEngine::observe_owed`'s *what this does not do*, `ReObserveOutcome`'s *neither variant
claims anything about what will be observed*, and `revert_settlement`'s conditional *a debt is
restored with the state* — and roughly twenty positions paraphrased them. **Every paraphrase is a
surface on which the claim can be false, and empirically most were.** The remedy is not a better
paraphrase; it is one statement with pointers at it.

**It lives in the core crate**, and that was not arbitrary. The core owns the primitive, it already
denies `missing_docs`, and — the decisive property — a doc comment there can be reached from
`src-tauri` by a **rustdoc intra-doc link, which is compile-checked**. A markdown file under `docs/`
cannot be: a renamed or deleted heading orphans every reference silently, which is exactly the failure
mode this step exists to remove. Both crates now carry
`#![deny(rustdoc::broken_intra_doc_links)]`, so a rename of the contract **breaks the build**.

**Twenty pointers** (residue 38's other half). Each position was judged one at a time: a passage that
states a fact about *its own* call site keeps that fact and points for the general contract; a passage
that merely restates the contract is replaced by the pointer. §3 records the judgement for every one.

**One check** (residue 41). Residue 41 is that *no file list is derivable* — nothing enumerates which
files describe this pipeline, so round 13's four-file sweep could not see the twin in `main.rs`, and
round 13's own High 2 sentence survived the round that closed it everywhere else. The check walks
**directory trees**, so a new file joins the swept set with no edit, and compares what it finds against
a recorded inventory in which every entry carries its reason.

---

## 2. The contract, clause by clause, with the code each is derived from

Every clause was derived from the code, never from the existing prose — the existing prose is what has
been wrong fourteen times. The contract's own text carries these citations; this section is the audit
trail for them.

### 2.1 What is guaranteed

| # | Clause | Derived from |
|---|---|---|
| G1 | An owed observation may not be discharged by **coalescing** it into silence | `ObservationEngine::observe_owed` inserts the path into `self.owed` beside the hint; `settle_present` skips its tracked-state comparison entirely under `if !owed`; `settle_missing` emits `Removed { previous_revision: None }` for an untracked path; `settle_failed` likewise |
| G2 | A debt stands until a settlement of that path **emits**, within one engine's life (N4 is the other side of the qualification) | `ObservationEngine::settle` does `let owed = self.owed.remove(path)` and **re-inserts** it when none of the three settlements produced an observation. Two requests are one debt: `owed` is a `BTreeSet<PathBuf>` and carries no identity of who asked |
| G3 | A rollback restores the prior tracked state, **unconditionally**, while the re-entry into the pipeline is **not** unconditional | `ObservationEngine::revert_settlement` takes `self.undo.remove(path)` and reinstalls `Undone::replaced`, or removes the entry where nothing was tracked. Both arms it ends in — `observe_owed` and `hint` — open with `if !self.watches(path) { return; }`, so an unwatched path is restored and not scheduled. This is `2d-3-notes.md` §5 item 17, the bold ruling line §20.4 named for having been right since round 5, and the contract states both halves rather than the first alone |
| G4 | A rollback restores a debt **only where the settlement being taken back had discharged one** | `Undone::owed`, captured by `settle` from the debt it removed, and `revert_settlement`'s closing `if owed { self.observe_owed(…) } else { self.hint(…) }` |
| G5 | A refusal at the admission gate publishes nothing and clears no record | `src-tauri/src/ledger.rs`'s `decide` and its `Admission::PrecedesACommit` arm, which mutates the tally and nothing else |

G5 is the application shell's half, named in the contract as **plain text** rather than as a link,
because the core never depends on `tauri`. It is stated there rather than only in `ledger.rs` because
the two halves are one contract, and keeping them apart is what let a paraphrase of one be written as a
claim about the other. **G5 stands on the rollback and the retained record alone**: no other clause is
a premise of it, which is why it survived every round that corrected the liveness clauses around it.

### 2.2 What is expressly NOT guaranteed

| # | Clause | Derived from |
|---|---|---|
| N1 | That any settlement will ever emit — a path written continuously never stabilizes and is never answered | `ObservationEngine::tick` advances only paths whose deadline has passed and settles only on `first == second`; the disagreeing arm re-arms `Pending::Probing { first: second }`. `observe_owed`'s own doc says the debt waits with it |
| N2 | That the caller keeps ticking | `now` is an argument everywhere; the engine reads no clock. A caller that stops calling `tick` has pending paths and no observations |
| N3 | That a request reaches a pipeline at all | `observe_owed`'s leading `if !self.watches(path) { return; }` — the path is dropped **and no debt is recorded**, exactly as `hint` drops it |
| N4 | That a worker outlives the request | `src-tauri/src/watch.rs`'s `WorkerMessage::ReObserve`, declared beside `WorkerMessage::Stop`; a worker may absorb the first and consume the second before its next tick, and an engine is dropped with its worker |
| N5 | That an `Asked` is an observation — it promises a worker's **inbox** | `ReObserver::re_observe` answers `Asked` on a successful `Sender::send` and `NoWatcher` on `Err`, and on nothing else |
| N6 | That a **plain hint** survives — it may be coalesced away | `settle_present`'s coalescing comparison, which runs whenever `!owed` and returns `None` at an equal revision. This is why G4 is conditional: the `else` arm of `revert_settlement` produces exactly this kind of hint |

N6 is the clause round 14's High 2 turned on, and it is why the contract states G4 and N6 **beside each
other**: thirteen positions claimed the anti-coalescing property for readings that do not carry it.

### 2.3 What the contract deliberately does not say

It says nothing about native delivery — whether the operating system reports a change, and with what
latency, is `crate::watch::native`'s subject and `docs/decisions/2d-2-notes.md` §2.3's, and the second
expressly declines to cover a backend that stops delivering without reporting anything. Every clause is
about what the engine does with a hint it is given.

---

## 3. The pointer inventory, with the judgement for each position

**A pointer replaces a paraphrase; it does not delete a local fact.** Twenty positions now point.
*Replaced* means the passage restated the contract and the restatement is gone; *kept + pointer* means
the passage says something true and specific about its own call site, and only the general claim moved.

### 3.1 `crates/espansoconfig-core/src/watch/engine.rs` — the primitive (3)

| Position | Judgement |
|---|---|
| module doc, *An observation can be owed* | **kept + pointer.** The section says what *this engine* does, which a reader of the engine needs; the pipeline-wide guarantee is now one link away |
| `observe_owed`, *what this does not do* | **kept + pointer.** This paragraph is the source of G1 and N1; it is cited by the contract, and it names the contract as where the clauses are collected |
| `revert_settlement`, *A debt is restored with the state* | **kept, completed + pointer.** The conditional's other half was implicit — the doc stated the `if owed` arm and left the `else` to the code. It now names both, which is the sentence thirteen positions got wrong |

### 3.2 `src-tauri/src/watch.rs` — the ask (4)

| Position | Judgement |
|---|---|
| module header, *A save may ask for one path to be observed again* | **replaced + kept.** The restatement of what a debt buys is gone; the local half — *why* an owed observation rather than a hint, given who the callers are — stays |
| `ReObserveOutcome` | **kept + pointer.** This doc is the source of N5, and the reviewer cited it as the authority that refused two Highs. The pointer names it as that clause's source rather than repeating it |
| `ReObserver::re_observe` | **replaced + kept.** *"so the next settlement of the path emits the state it stabilized to even when …"* is gone; the local half — why this method asks for a debt — stays, and is now labelled as the local half |
| `WatchWorker::baseline` | **replaced + kept.** *"A debt is the one form a settlement must answer"* is a liveness promise and is gone; *a hint at a path this baseline established coalesces to silence* is a fact about this function's own tree and stays |

### 3.3 `src-tauri/src/ledger.rs` — the gate (9)

| Position | Judgement |
|---|---|
| module doc, *Over-refusal is not a safe direction* | **replaced + kept.** The rollback description and *"does not produce a fresh observation"* are gone; which sink arm returns `Undecided`, and that `deliver` calls `revert_settlement`, stay — they are facts about this module's wiring |
| module doc, *Two proofs*, first bullet | **replaced + kept.** The whole rollback paragraph is one pointer now; the bullet keeps only the door and the outcome value |
| module doc, *…is re-observed* section, closing sentence | **replaced + kept.** The three-reason enumeration is gone (it was N1, N4 and N5 restated); the heading's own clarification — *re-observed* contrasts with *published* and is never a promise of arrival — stays, because it is about this heading |
| module doc, *the anchor outlives the record*, the widening sentence | **replaced + kept.** The rollback description is a pointer; the program-order chronology fact — the next stamp follows the anchor in program order only — stays |
| module doc, same section, the round-13 clock paragraph | **replaced + kept.** The three-reason enumeration is gone; *what the clock bounds* and the three safety negatives stay, and the paragraph now says in as many words that they hold whatever does or does not arrive |
| `Admission::PrecedesACommit` | **kept + pointer.** *The one arm a producer must answer* is a fact about `admitting_sink`'s mapping, not a liveness promise |
| `LedgerTally::preceded_a_commit`, first bullet | **replaced.** A restatement of the rollback and of N1 |
| `LedgerTally::preceded_a_commit`, closing paragraph | **replaced + kept.** *Refusals, never losses* stays, and the paragraph now says that it needs neither half of the contract |
| `record_app_write`'s inline comment | **replaced.** A restatement, in a comment about an unrelated residue |

### 3.4 The composition (4)

| Position | Judgement |
|---|---|
| `src-tauri/src/commands.rs`, module header's six-things list | **replaced + kept.** The list and its count stay; the owed-observation restatement is a pointer. One further word changed: *a refused reading is **answered** by `revert_settlement`* became *is **handed to*** it, because *answered* was the word two rounds of findings turned on |
| `src-tauri/src/main.rs`, the seven-things list's last item | **replaced + kept.** This is where round 13's High 2 survived its own fix round. The local facts — where the request is made, what it is retained across — stay |
| `src-tauri/src/main.rs`, the reload-and-rollback paragraph | **replaced + kept.** Round 14's High 1's twin. The local facts — which reading is discarded, and that it clears no record — stay |
| `src-tauri/src/watch_check.rs`, the round-12 paragraph | **replaced + kept.** The rollback description is a pointer; **which arm** runs there — the settlement taken back is this application's own native hint, which owes nothing — is a local fact about this test and stays |

### 3.5 The record, and the module map

- `docs/decisions/2d-3-notes.md` **§1's headline** now points at the contract for both liveness
  clauses, with a correction block beneath saying so. **Nothing below it is rewritten**: the nine
  blocks stacked there are the history of what that sentence claimed, and each is the record of the
  round that found it. §7–§20 and `docs/reviews/phase-2d-3-ledger.md` are untouched — they are
  append-only history, and rewriting them is residue 43's warning.
- **§5** gains one navigational note naming items 17, 19, 21 and 22 as sources of the contract. The
  items themselves are not rewritten.
- `crates/espansoconfig-core/src/watch/mod.rs`'s module map gains the `liveness` row.

### 3.6 Collateral the intra-doc gate required

`#![deny(rustdoc::broken_intra_doc_links)]` turned **eleven pre-existing** broken or ambiguous links
into errors, so they were fixed — doc comments only, no behaviour: five ambiguous `[`write`]` links in
`persist/mod.rs` (a module and the `write!` macro share the name, so they are now `[`mod@write`]`),
`[`MatchDraft`]` and `[`WriteStep`]` given their crate paths, two `[`CommandError`]` links in
`src-tauri/src/save.rs` given theirs, and two links to **test-only** items — `WorkspaceSession::unwatched`
and `every_command_error` — turned into plain names, because no link to a `#[cfg(test)]` item can
resolve in a doc build. `cargo doc --workspace --no-deps` now exits 0 with **zero** unresolved or
ambiguous links. The 73 warnings it still prints are all `private_intra_doc_links` — a different lint,
pre-existing, and not what the gate is about.

---

## 4. The check

### 4.1 What it does

`src-tauri/src/liveness_contract.rs`, in the register of `src-tauri/src/dictionary_contract.rs` and
`crates/espansoconfig-core/tests/corpus_integrity.rs`: a pinned, exhaustive set, compared both ways.

- It walks **`src-tauri/src/` and `crates/espansoconfig-core/src/` recursively**, every `.rs` file, so
  a new file joins the swept set with no edit here. That is residue 41's instance closed.
- It splits each file into **prose units**: a contiguous run of comment lines is joined into one
  string with its markers stripped, and every other line is a unit of its own.
- It matches **50 phrases** in five shape groups — *is/was/must be answered*, *stays owed / re-owed /
  owed again*, *observed again / re-observed / fresh observation*, *coalesced into silence / to
  nothing*, and *will arrive / next settlement* — case-insensitively, as plain substrings.
- Each match is a hit. Hits are tallied per `(file, phrase)` and compared against the recorded
  `INVENTORY`, **in both directions**: a hit no entry covers fails, and an entry that matches nothing
  fails too, because a reworded passage is a passage nobody has judged in its new wording.
- The failure message prints every unrecorded position with its line number and its context, and asks
  the four questions the inventory's reasons answer.

Three companion tests keep it from failing open: every phrase is lowercase (so the case-insensitive
comparison cannot silently miss), the sweep reaches both trees and the contract file itself, and a
claim that wraps across a line break is seen.

### 4.2 Joining comment runs is not a refinement — it is the difference between working and not

Measured on the tree this step started from: **seven** liveness claims span a line break and are
invisible to a line-based sweep, including `engine.rs`'s own module doc (*"put the state that stood
before it back and observe the path again"*), `ledger.rs`'s *"owed again only where the settlement
taken back had discharged a debt"*, `watch.rs`'s *"is never answered at all"* and `commands.rs`'s *"is
answered by `ObservationEngine::revert_settlement`"*. Every hand-run sweep of rounds 12, 13 and 14 was
`rg` over lines. This workspace wraps its doc comments at about 76 columns, so a claim of eleven words
straddles a break as a matter of course.

The proof run in §4.4 confirms it end to end: the planted claim wraps, and the check caught it.

### 4.3 The inventory: 125 hits over 17 files, every one classified

Not one hit was dropped by narrowing the pattern. The four kinds, as the task's own taxonomy:

| Kind | Entries | Hits | Where |
|---|---|---|---|
| **the contract itself** | 11 | 13 | `crates/espansoconfig-core/src/watch/liveness.rs` |
| **a pointer** | 1 | 1 | `ledger.rs` — the topic list of one pointer sentence names *re-owes* |
| **a local fact** | 50 | 78 | `engine.rs`, `watch.rs`, `ledger.rs`, `commands.rs`, `main.rs`, `watch_check.rs` — primitives' own docs, the doors' own wiring, test comments and assertion messages over engines the tests tick themselves |
| **a false positive** | 20 | 33 | `patch/edit.rs`, `persist/backup.rs`, `syntax/{collection,ownership}.rs`, `draft/match_draft.rs`, `watch/correspond.rs`, `src-tauri/src/{backup,commands,dictionary_contract,dispatch_check,error}.rs` |

The four rows are 82 entries and 125 hits, and the totals are **derived by summing the rows** rather
than asserted over them — saying *six* over a list of seven was round 14's second Low.

The false positives are the pattern meeting unrelated subsystems: the patch engine on *which questions
its arithmetic answers*, the backup catalogue on *what an occupied destination is answered with*, five
save assertions reading *a committed save is answered as `Saved`*, the dispatcher on *what
`document_text` must answer*. **They are carried, not filtered.** A pattern narrowed to make today's
noise go away is a pattern that misses tomorrow's claim, and the noise costs nineteen lines of
inventory once.

The judgement most worth naming, because it is the closest call: `engine.rs`'s module doc quotes the
instruction a caller gives — *"put the state that stood before it back and observe the path again"* —
which is round 14's High 1 wording in the imperative. It is kept, for round 14's own reason: the
primitive's doc is the **authority** the reviewer cited against those Highs, `revert_settlement`'s own
list says *it schedules a read, so it emits nothing itself* three paragraphs below, and the sentence is
the request rather than a promise. Recorded here rather than left silent.

The second closest: `ledger.rs`'s and `engine.rs`'s test assertion messages saying *the refused state
is observed again*. Round 14 cleared these — each ticks the engine itself, so the re-observation is
true by construction in that test — and this step keeps them on that reading.

### 4.4 The proof that the check fails

Argued guards are how round 11 removed an assertion and round 12 found the removal had cost a
detection. This one was **driven**.

A false claim was planted in `src-tauri/src/ledger.rs`'s module doc, deliberately **wrapped** across a
line break so the run would test the joined-unit sweep as well as the family. **The run below was
re-taken on the shipped tree**, after `cargo fmt`, so the line number it names is the one a reader
finds today — an earlier pair of runs on the pre-`fmt` tree said `:939:9` and was otherwise identical:

```
//! **A deliberately planted false claim, for the 2d-3-C proof run.** Every
//! refusal of a watcher observation is
//! answered by a re-observation the engine must answer.
```

`cargo test -p espansoconfig --bin espansoconfig liveness_contract::tests::every_liveness_claim_is_judged`
— **RED**:

```
running 1 test
test liveness_contract::tests::every_liveness_claim_is_judged ... FAILED

thread '…' panicked at src-tauri/src/liveness_contract.rs:941:9:
the liveness contract is stated once, in espansoconfig_core::watch::liveness, and every other
position points at it rather than restating it. These positions are not in
src-tauri/src/liveness_contract.rs's INVENTORY:
    src-tauri/src/ledger.rs / "answered by": found 2, inventory says 1
            line 1: …for the 2d-3-C proof run.** Every refusal of a watcher observation is answered by a re-observation the engine must answer.  # The gate is a leaf, and t…
    src-tauri/src/ledger.rs / "is answered": found 3, inventory says 2
            line 1: …m, for the 2d-3-C proof run.** Every refusal of a watcher observation is answered by a re-observation the engine must answer.  # The gate is a leaf, an…
    src-tauri/src/ledger.rs / "must answer": found 2, inventory says 1
            line 1: …l of a watcher observation is answered by a re-observation the engine must answer.  # The gate is a leaf, and that is load-bearing  …
Judge each one — is it the contract, a pointer, a local fact, or a false positive? — and record it
with its reason.

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 246 filtered out
```

Three phrases fired on one planted sentence, and **`answered by` fired across the line break**, which
is the joined-unit sweep doing the thing a line sweep cannot.

The three planted lines were then removed, with nothing else changed, and the same suite re-run —
**GREEN**:

```
running 4 tests
test liveness_contract::tests::every_shape_is_lowercase ... ok
test liveness_contract::tests::a_claim_that_wraps_across_a_line_break_is_seen ... ok
test liveness_contract::tests::the_sweep_reaches_both_trees ... ok
test liveness_contract::tests::every_liveness_claim_is_judged ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 243 filtered out
```

---

## 5. What this step does **not** close

Stated plainly, and in the same sentences that describe what it does — because getting this wrong
would reproduce, inside the mechanism built to stop it, this project's declared worst defect class.

1. **The check cannot judge whether a passage's claim is true.** It catches an **unmarked** claim and a
   **new** claim. A passage that carries a pointer and still says something false passes it, and so
   does a rewording that keeps the same phrase in the same file — the key is `(file, phrase)`, so
   swapping one recorded sentence for a different sentence using the same phrase moves no count. **The
   reason the step is nevertheless worth building is the reduction of surface — one place to be right
   instead of twenty — and never the check's judgement.** This sentence is written against what the
   test does, not against what would be pleasant to claim.
2. **A paraphrase built from none of the fifty phrases is invisible.** The family is a set of wordings,
   not a semantic test. It is drawn around *claims* — what will or will not be answered, observed, owed
   or coalesced — and deliberately not around the vocabulary of the mechanism: widening it to every
   occurrence of *discharge* adds nineteen entries of noise and not one claim. A future round writing
   *"the engine is obliged to emit"* would pass.
3. **The sweep skips exactly one file: the check's own source**, whose phrase table holds the whole
   family by construction. A liveness claim written into `src-tauri/src/liveness_contract.rs` is
   invisible to it. The sweep asserts that the skipped file exists, so a rename cannot silently empty
   the skip list, and nothing else defends this hole.
4. **It sweeps two source trees and no document.** `docs/` is not swept: it holds the append-only
   review history, where the false sentences of fourteen rounds are quoted **on purpose**, and a check
   over it would fail on its own record. So §1's headline and §5's note point at the contract as
   prose, with nothing enforcing that they keep pointing.
5. **Nothing forces a new passage to point rather than restate.** The check forces it to be *judged*.
   A maintainer who judges a fresh paraphrase acceptable and records it has satisfied every test in
   this workspace.
6. **The contract's own clauses are prose over code, and no test fails if one drifts from the code it
   cites.** That is residue 44 at the new position: the clauses were derived from the code by reading
   it, and §2's tables are the audit trail rather than an oracle. What changed is the count — one
   passage to check against `revert_settlement` instead of twenty.
7. **The two argued halves are still argued.** Residue 39 (a `PrecedesACommit` refusal publishes
   nothing and clears nothing, over an engine no test can hold permanently unstable) and residue 42
   (the negative arm of the conditional debt) are untouched by this step. Neither is a claim about
   where the contract is stated.

---

## 6. Effect on residues 38, 41 and 44

**Residue 38 — *nothing anywhere states the liveness contract in one place* — is CLOSED.** It asked for
"a single named statement every position points at instead of restating", and named the reason it was
not built: a fix round that invents machinery produces the next round's finding. Built here, alone.
What replaces it is limit 6 of §5: one passage to keep true instead of twenty, and nothing making that
one true.

**Residue 41 — *a sweep scoped to a file list cannot find the twin in the file the list omits* — is
CLOSED in its instance and in the class it named.** §20.4 closed the instance by sweeping the directory
once, by hand, and said in as many words that the class was open because **no list is derivable**. The
class's own remedy is stated there: *"a marker every such passage carries and a check that the marker's
set is the swept set"*. That is what §4 is, with the pointer as the marker and the inventory as the
recorded set — and it is stronger than the residue asked for in one respect and weaker in another. It
is stronger because the swept set is a **directory tree** rather than a marker set, so an unmarked
passage in a brand-new file fails rather than being missed. It is weaker because the marker is not
machine-checked as a marker: an inventory entry saying *pointer* and a passage that in fact restates
are indistinguishable to the test. **The document half stays open** — §5 limit 4.

**Residue 44 — *every correction is prose, and no test fails if a later round un-makes one* — is
NARROWED and not closed.** Un-making a correction by *deleting* the pointer and writing a paraphrase
fails the check, because the paraphrase adds a hit. Un-making it by *rewriting a recorded sentence into
a false one using the same phrase* does not. That is limit 1, and it is the honest shape of what a
textual guard can do. Residue 44's sharper half — a stack in which block *n* corrects block *n−1* —
is untouched: this step adds one block to §1's stack and rewrites none of the nine below it.

**Residue 43 is respected rather than affected**: no per-round section and no review file was swept or
rewritten.

---

## 7. What changed, file by file

Per §18.6's declaration, this list names every file in the step, and says which change is not
behaviour.

- **`crates/espansoconfig-core/src/watch/liveness.rs`** — **new.** The contract. It declares no type,
  no function and no constant; its module documentation *is* the item.
- **`crates/espansoconfig-core/src/watch/mod.rs`** — `pub mod liveness;` and the module map's row.
- **`crates/espansoconfig-core/src/lib.rs`** — `#![deny(rustdoc::broken_intra_doc_links)]` and the
  comment saying why.
- **`crates/espansoconfig-core/src/watch/engine.rs`** — three pointer positions (§3.1), one of which
  also completes `revert_settlement`'s conditional by naming its `else` arm. **Doc comments only.**
- **`crates/espansoconfig-core/src/{draft/new_match.rs,persist/mod.rs,persist/save.rs}`** — the
  pre-existing broken intra-doc links the new lint turned into errors (§3.6). **Doc comments only.**
- **`src-tauri/src/liveness_contract.rs`** — **new.** The check, its phrase family, its inventory of 82
  entries over 125 hits, and four tests.
- **`src-tauri/src/main.rs`** — `#[cfg(test)] mod liveness_contract;`,
  `#![deny(rustdoc::broken_intra_doc_links)]`, and the two module-header positions (§3.4).
- **`src-tauri/src/{ledger,watch,commands,watch_check}.rs`** — the fifteen pointer positions of §3.2,
  §3.3 and §3.4. **Comments and doc comments only. No signature, no control flow, no behaviour;
  `decide`, `revert_settlement` and `observe_owed` are untouched; no assertion and no assertion message
  added, removed or changed.**
- **`src-tauri/src/{error,save}.rs`** — the pre-existing broken intra-doc links (§3.6). **Doc comments
  only.**
- **`docs/decisions/2d-3-notes.md`** — §1's headline rewritten to point, with one correction block
  beneath it; one navigational note in §5. **Nothing else in that file is touched, and no per-round
  section is rewritten.**
- **`docs/decisions/2d-3-C-notes.md`** — this record.
- **no `src/` path, no command, no wire type, no event, no queue, no i18n key and no user-visible
  string.**

---

## 8. The gates

| Gate | Result |
|---|---|
| `cargo test --workspace` | **1272 passed, 0 failed** (exit 0, summed over **26** `test result` lines). Round 14's figure was **1268 over 26 lines**; the move is **exactly +4**, which is the four tests `src-tauri/src/liveness_contract.rs` adds and nothing else. No test was removed and no assertion changed |
| `cargo test -p espansoconfig --bin espansoconfig watch_check:: -- --test-threads=1` | **20 passed, 0 failed** (exit 0, **227** filtered out, 74.57 s, quiet host, no timeout). The filtered count moves 223 → 227 for the same four tests. Wall-clock is host state and is not a baseline: what the gate asserts is 20/20 and no timeout |
| `cargo clippy --workspace --all-targets -- -D warnings` | **clean** (exit 0) |
| `cargo fmt --check` | **clean** (exit 0) |
| `cargo doc --workspace --no-deps` | **exit 0, zero unresolved or ambiguous intra-doc links** — the gate that makes the pointers real |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** |
| the frontend | **untouched** — `git diff --name-only 08a3366 -- src/` is empty, so 431 / 2125 / 184 carry |

**The first run of the workspace suite failed with three `watch_check` timeouts**, all
*timed out waiting for the watcher's baseline scan*, while two shell poll loops of this session's own
were running against the same host. That is the documented scar rather than a defect: those tests are
bounded waits, and a busy host lengthens them past the bound. The loops were killed, orphans reaped
with `pkill -f 'target/debug/deps/espansoconfig-'`, and the suite re-run **once** on a quiet host —
the figures above. The focused serial gate passed 20/20 through both.

**Five non-comment lines** were added across the tracked Rust files, and
`git diff -U0 -- crates/espansoconfig-core/src src-tauri/src` filtered to non-comment lines shows
exactly them: two `#![deny(rustdoc::broken_intra_doc_links)]` attributes, `pub mod liveness;`, and
`#[cfg(test)] mod liveness_contract;`. Everything else in those files is a comment or a doc comment.
