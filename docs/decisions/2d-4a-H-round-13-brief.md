# Round 13's brief — Phase 2d-4a-H, the fifth corrective phase

_Written and dispatched 2026-08-30 under `/autoclaude-opus` in driven mode, to the workflow's own
`autoclaude-reviewer` agent on `model: "opus"`. Kept so the round can be audited against what it was
actually asked. Round 12's brief is [`2d-4a-G-round-12-brief.md`](2d-4a-G-round-12-brief.md), and this
one copies its shape._

**A coverage bound this brief cannot fix, stated up front because it changes how you should read.**
Rounds 1–6 of this tail went to Codex. Rounds 7 through 12 were adversarial Opus agents, and you are
the **seventh consecutive one** — this run is now longer than the Codex run it replaced. Round 11 is
evidence that a cold Opus round is not worthless here: it found a **High** in a clause the four Opus
rounds before it had read past, in a paragraph each of them had been asked to read hardest. That is
not evidence the bound is discharged — a prior all seven share is invisible to all seven. So do not
assume a claim is safe because previous rounds read the same paragraph and let it stand. **Look
hardest exactly where an Opus reviewer would nod.**

---

Do NOT use web search and do NOT fetch URLs. Answer from the repository in front of you and from your
own knowledge, and finish promptly.

Repository: `/Users/ccarpio/Developer/espansoConfig`. Rust workspace plus a Svelte/Tauri frontend.
**Do not run `cargo` or `npm`**: the orchestrator runs every gate itself, alone, on exactly this
source tree, and a round that cannot run a gate must not report one. The workspace suite takes over
four minutes and one of its gates false-fails when a second Cargo process is on the machine, so
starting one would both blow your time budget and corrupt the orchestrator's measurement. **Review by
reading.** Your time budget is **12 minutes**.

**Write exactly one file: your report, to `docs/reviews/phase-2d-4a-round-13.md`.** Change nothing
else — you are reviewing a fix, not making one.

**The tree you are reading.** `HEAD` is `1be260f`, whose only change over the reviewed commit
(`e334d5b`) is a `PROGRESS.md` record entry. The working tree additionally carries **uncommitted,
record-only** edits made by this iteration before you were spawned: `PROGRESS.md` and
`docs/progress-archive/phase-2d.md`, moving a spent verification block into the archive to stay inside
the checkpoint's size budget. **No source file differs from `e334d5b`**, and those record edits are
**not in your scope**.

The gates were run on the round-12 fix by the orchestrator alone, each command issued separately and
**redirected to a file rather than piped** so every status is the tool's own: `cargo test --workspace`
1313 passed / 0 failed over 26 `test result: ok` lines, exit 0; `cargo clippy --workspace
--all-targets -- -D warnings` clean; `cargo fmt --check` clean; `cargo doc --workspace --no-deps` exit
0 with 73 warnings, all `private_intra_doc_links`, and 0 unresolved, run after `touch`ing
`reconciliation.rs`; `cargo tree -p espansoconfig-core | rg tauri` empty; `npm run check` 431 files /
0 errors; `npm test` 2125 over 56 files; `npm run build` 184 modules with the server-only bundle
oracle absent and the client-only one present. **They are context, not something you are asked to
trust** — and **a green suite is no evidence at all about a comment**, which is your entire scope.

## What this round is

This is **round 13** of Phase 2d-4a's review tail, running as its own corrective phase (2d-4a-H).
`CLAUDE.md` §7.1 commissions a round for exactly one reason: **a fix round that changed at least one
source file.** Round 12's fix changed one — `src-tauri/src/reconciliation.rs`, comment-only, **+3 /
−4**, a single sentence — so this round exists. Its scope is **that fix and nothing else**: not rounds
1–11, not the phase's design, not the queue.

**Read `CLAUDE.md` §7 before you write your verdict.** Whether this tail ends at round 13 is decided
by what your findings make the fix round touch: a finding whose fix is prose-only commissions nothing
and the tail ends, and a finding whose fix touches a source file commissions round 14. That is not a
reason to soften or to sharpen anything — it is a reason to be exact about **where** each finding
lives. **§19.4 predicted this tail would end at round 11 and was wrong**; §20.4 and §21.4 both
deliberately make no prediction. Do not read any of them as telling you what to find.

## The exact scope — one commit, one sentence, and the record that describes it

**The source change.** `git show e334d5b -- src-tauri/src/reconciliation.rs`. It is one edit inside
`address_of_minted`'s doc comment (the function is at `:1522`), and it does **two things at once**:

- it turns the **full stop** that ended *"…clause 5."* back into a **comma with an appositive** —
  *"…clause 5, **a rule that does not know this assertion exists**:"* — and changes the following
  *"the rule"* to *"that rule"*; and
- it **deletes** the clause *"so this escape waits on a state it cannot bring about"*.

The sentence now reads, at `:1499-1506`:

> `[ReconciliationQueue::enqueue]` evicts, so an arrival taking the pending map past `[QUEUE_CAPACITY]`
> costs the offending entry its place **when `[evictable_sequence]` picks it** — and what it picks is
> fixed by a rule about paths and their pending counts, stated whole as
> `[espansoconfig_core::watch::retained_state]`'s clause 5, **a rule that does not know this assertion
> exists**: the offending entry goes when that rule happens to name it, never because it is the entry
> that trips here; and `[ReconciliationQueue::begin_epoch]` assigns an empty state over the whole of
> it, so reopening the workspace discards the entry too.

**The record.** [`docs/decisions/2d-4a-notes.md`](2d-4a-notes.md) **§21** (§21.1 finding by finding,
§21.2 by file, §21.3 the gates, §21.4 where it is thin), plus the **three round-12 correction blocks**
that fix names: one under the round-11 L1 block inside **§18.3**, one under **§20.4**'s third item,
and one under §20.4's ordinal-fragility item. The reviewer's own report,
[`docs/reviews/phase-2d-4a-round-12.md`](../reviews/phase-2d-4a-round-12.md), is context and was not
modified by the fix round.

## What to check, hardest first

### 1. Count the list. This paragraph has produced both Highs of this tail, and both were enumeration miscounts

At `:1491` the paragraph declares **"Three things end that loop"**. Round 8 found an earlier draft
claiming these were enforcements; round 9 found the draft that replaced it **closing the list at
two**. Round 12's L2 was a **punctuation change that damaged the same enumeration**: a full stop
introduced by the round-11 fix had ended list item 2, so item 3 hung off a sentence about item 2's
rule. The fix under review is the repair of that.

So: **count them.** Read `:1491-1506` and answer, pointing at lines:

- Are there exactly three items, and does the punctuation now carry them as *A; B; and C*?
- Does the appositive-plus-colon construction re-open item 2 in a way that swallows item 3, or does
  the semicolon before *"and `[ReconciliationQueue::begin_epoch]`"* survive as the list separator?
- The summary at `:1506-1510` says **"All three are escapes rather than repairs"** and **"each waits
  on something outside this function: a caller's watermark, an overflow that selects this entry, and
  a reopen."** Do those three match the three items, **in order**? Does *"an overflow that selects
  this entry"* name item 2 as item 2 now states it?
- `:1512-1516` says the closure at three is **clause 4's claim rather than this paragraph's**. Is
  that still true of the paragraph as it now reads?

### 2. The appositive — is its antecedent any clearer than the pronoun it replaced?

This is the specific question the previous round's fix round left open, and it is the reason it is
first in this brief after the count. The appositive **"a rule that does not know this assertion
exists"** now sits directly after *"clause 5"*. The nouns in front of it are, in order: *a rule about
paths and their pending counts*, *`[espansoconfig_core::watch::retained_state]`*, and *clause 5*.

- Which of those does the appositive attach to by ordinary reading, and is that the one the sentence
  needs it to attach to?
- The clause that follows says **"the offending entry goes when *that rule* happens to name it"**.
  Which rule is *that rule*? Before the fix the same clause read *"the rule"*, and the fix changed it
  to *"that rule"* — does the demonstrative resolve to the appositive, to *"a rule about paths and
  their pending counts"*, or to clause 5 itself, and are those the same thing?
- Is *"a rule that does not know this assertion exists"* a **true** claim about `evictable_sequence`?
  Round 12 established that it is a pure function of `pending` over paths, counts and sequences,
  reading no `DocumentId` and no assertion state (`:921-935` — check the line numbers are still
  right). Does the sentence claim more than that derivation supports?

### 3. The deleted clause — did anything go with it?

*"so this escape waits on a state it cannot bring about"* was deleted as a Low: three candidate
antecedents for *"this escape"*, and a duplicate of the summary four lines below.

- Read `:1506-1510` and say whether the summary carries what the deleted clause carried. Not
  "something similar" — say what the deleted clause asserted, what the summary asserts, and whether
  the second entails the first.
- If the deleted clause carried anything the summary does not — that the escape is not merely
  *outside* this function but **unreachable by anything this function can do** — say so and quote both.
- Is *"never because it is the entry that trips here"*, now the sentence's last clause before the
  semicolon, doing the work the deleted clause did, or is it a different claim?

### 4. The preserved clauses — a rewrite is not a review of what it preserves

Round 12 checked these and reported them true. **Check them again anyway**, because that is exactly
the shape rounds 8–12 kept finding: a clause that survived a rewrite unexamined. Point at the code.

- `after_sequence` **crosses the wire as an unvalidated `u64`** — is it, and does a caller passing a
  watermark at or above the offending entry's sequence prune it at the retain *before* the projection
  runs?
- `[ReconciliationQueue::enqueue]` **evicts** past `QUEUE_CAPACITY` — find the loop and check its
  condition; the record says it is `while … > QUEUE_CAPACITY`.
- `[ReconciliationQueue::begin_epoch]` **assigns an empty state over the whole of it.**
- **All three take this queue's lock through `PoisonError::into_inner`** — the paragraph says so at
  `:1510-1512`; find all three sites.
- `[espansoconfig_core::watch::retained_state]`'s **clause 5** is what `evictable_sequence`
  implements, and **clause 4** is where a stored entry's exits are enumerated. Are those the right
  ordinals **today**? They are hand-numbered prose, and §20.4 records that inserting a clause
  renumbers every citation in the workspace with nothing failing.

### 5. Re-derive every figure §21 cites — "measure one span, label another" is a named shape here

§21.4 names it: **a figure measured over one span and labelled with another**, found three times in
three rounds (round 10's L1, round 12's M1, round 12's L3). Every figure §21 cites is the fix round's
**own** derivation, with one pair of eyes on it. **Re-derive each, and check it is labelled with the
span it was taken over.** Do not re-read the sentence; take the measurement.

- **`+3 / −4`** for `src-tauri/src/reconciliation.rs` in `e334d5b`, by `git diff --numstat`.
- **"every added and removed line begins `///`"** and **"no executable line changed"**.
- **"the paragraph is still six occurrences over five targets"** — over the *paragraph*.
- **"the doc comment still 13 over 10"** — over the *doc comment*, which is a larger span than the
  paragraph. §21.2 asserts both, unchanged, on the ground that the link set was untouched.
- **"88 retained-state and 61 liveness phrases", 149 in total** (§21.3), extracted from their own
  contract modules and counted against the exact prose removed and added.
- **"85 citations over nine files"** — the corrected figure from round 12's L3, where the superseded
  83 was `rg -c` counting *lines*.

State plainly for any figure you could not derive that you could not, rather than passing it.

## Two things not to spend budget on

1. **L2 of round 10 stays declined, on three rounds' reading.** It is the precedent claim in
   `src-tauri/src/retained_state_contract.rs:1089`'s `reason`. §19.1 has the argument in full; rounds
   11 and 12 both read it and both agreed. If you think all three were wrong, that is a finding worth
   making — but make it against the argument as written, in one paragraph, and do not re-derive it
   from scratch.
2. **Rounds 1–11 themselves.** They are closed. A round-12 correction block that misstates what an
   earlier round found **is** in scope, because the fix round wrote it; the earlier round's own
   verdict is not.

## Rules

- **Verify before asserting: open the file and quote the line.** A finding you cannot point at in the
  code is a question, not a finding — mark it as one.
- No praise, no summary of what the code does, no restating the plan or this brief.
- Finding nothing at a severity is a valid answer. Say so rather than inventing.
- **Say where each finding lives** — source file or record — because that decides what the fix
  commissions.
- Severities: **High** = a correctness defect, or a claim in source or record that is false in a way
  that could mislead a later change. **Medium** = a claim that is incomplete or unsupported.
  **Low** = imprecision with no path to a wrong change.

## Report format

Two audiences, one report. **Return to the orchestrator only the verdict lines your agent definition
names**, and **write the full report to `docs/reviews/phase-2d-4a-round-13.md`**. Both use this
vocabulary:

```
VERDICT: ship | ship-with-fixes | do-not-ship
BLOCKERS: <file:line — the claim, why it is false, and what the code actually does>
SHOULD-FIX: <same shape>
NOT-VERIFIED: <what you could not check, and why>
```

**Tag every finding with this project's severity** — `High`, `Medium` or `Low` as defined above — so
round 13 can be compared with rounds 1–12, which are all recorded in that vocabulary. A **High** is a
`BLOCKER`; a **Medium** or a **Low** is a `SHOULD-FIX` carrying its tag, e.g.
`SHOULD-FIX: [Medium] src-tauri/src/…`.

The report file must open with the line your agent definition requires and then a `# Phase 2d-4a-H —
review round 13` heading; use `###` for anything below that. 600 words max.
