# Round 10's brief — Phase 2d-4a-E, the second corrective phase

_Written and dispatched 2026-08-29 under `/autoclaude-opus` in driven mode, to the workflow's own
`autoclaude-reviewer` agent on `model: "opus"`. Kept so the round can be audited against what it was
actually asked. Round 9's brief is [`2d-4a-D-round-9-brief.md`](2d-4a-D-round-9-brief.md), and this
one copies its shape._

**A coverage bound this brief cannot fix, stated up front because it changes how you should read.**
Rounds 1–6 of this tail went to Codex. Rounds 7, 8 and 9 were adversarial Opus agents, and you are
the **fourth consecutive one**. Each was cold and each re-derived rather than accepted — but a prior
of yours that the last three shared is invisible from inside all four. So do not assume a claim is
safe because a previous round read the same paragraph and let it stand: **rounds 8 and 9 each found a
defect in the fix that answered the round before them**, both times in prose the previous round had
just read. Look hardest exactly where an Opus reviewer would nod.

---

Do NOT use web search and do NOT fetch URLs. Answer from the repository in front of you and from your
own knowledge, and finish promptly.

Repository: `/Users/ccarpio/Developer/espansoConfig`. Rust workspace plus a Svelte/Tauri frontend.
**Do not run `cargo` or `npm`**: the orchestrator runs every gate itself, alone, afterwards, and a
round that cannot run a gate must not report one. The workspace suite takes over four minutes and one
of its gates false-fails when a second Cargo process is on the machine, so starting one would both
blow your time budget and corrupt the orchestrator's measurement. **Review by reading.** Your time
budget is **12 minutes**.

**Write exactly one file: your report, to `docs/reviews/phase-2d-4a-round-10.md`.** Change nothing
else — you are reviewing a fix, not making one.

The working tree is clean at `HEAD` = `d264012`. **The gates were run on the round-9 fix by the
orchestrator alone**, before you were spawned, each command issued separately with nothing else
running: `cargo test --workspace` 1313 passed / 0 failed over 26 result lines all `ok`, exit 0;
`cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean; `cargo doc
--workspace --no-deps` 73 `private_intra_doc_links` and 0 unresolved; `cargo tree -p
espansoconfig-core | rg tauri` empty; `npm run check` 431 files / 0 errors; `npm test` 2125; `npm run
build` 184 modules. **They are context, not something you are asked to trust** — and **a green suite
is no evidence at all about a comment**, which is nearly all of your scope.

## What this round is

This is **round 10** of Phase 2d-4a's review tail, running as its own corrective phase (2d-4a-E).
`CLAUDE.md` §7.1 commissions a round for exactly one reason: **a fix round that changed at least one
source file.** Round 9's fix changed two, so this round exists. Its scope is **that fix and nothing
else** — not rounds 1–8, not the phase's design, not the queue.

**Read `CLAUDE.md` §7 before you write your verdict.** Whether this tail ends at round 10 is decided
by what your findings make the fix round touch: a finding whose fix is prose-only commissions
nothing, and a finding whose fix touches a source file commissions round 11. That is not a reason to
soften or to sharpen anything — it is a reason to be exact about **where** each finding lives.

## The exact scope — one commit, two source hunks, and the record that describes them

Everything is in commit **`6572a29`** ("Run 2d-4a review round 9 as the corrective phase, and fix
what it found"). `git show 6572a29 -- src-tauri/src/` gives you both source hunks and nothing else.

**1. `src-tauri/src/reconciliation.rs`** — the doc comment on `fn address_of_minted`. The paragraph
that previously read *"**Two** things end that loop and neither is an enforcement this code
performs"* now reads **"Three things end that loop and none of them is an enforcement this code
performs"**, and the passage runs from there to *"…rather than on anything that fails when a fifth
mutation site appears."* Round 9's High was that the two-item list omitted **overflow eviction**.

**2. `src-tauri/src/retained_state_contract.rs`** — one `reason` string in the `INVENTORY` entry for
`("src-tauri/src/reconciliation.rs", "things end")`, around line 1089. Round 9's second High was that
it cited **clause 6** for a claim that is **clause 4's third way**.

**3. `docs/decisions/2d-4a-notes.md`** — **§18** (round 9's record, four subsections) and the **four
`> **Correction, round 9 …**` blocks** the fix added inside §17. Check these against the two hunks
rather than the other way round: *a decision record that claims a guarantee the code does not give is
this project's worst defect class.*

You may read anything you need to judge those three. `CLAUDE.md` is the rulebook;
`docs/reviews/phase-2d-4a-round-9.md` is round 9's own report.

## What to check, hardest first

- **Is the new enumeration right at three?** The paragraph now names an unvalidated `after_sequence`
  pruning the entry at the drain's retain, an overflow eviction inside
  [`ReconciliationQueue::enqueue`], and [`ReconciliationQueue::begin_epoch`] assigning a fresh state.
  Round 9 found a two-item list missing one. **A three-item list can be wrong the same way, and can
  also be wrong by having gained a member that does not belong.** Trace each against the code:
  `enqueue` (the eviction loop and `QUEUE_CAPACITY`), `evictable_sequence`, `drain`'s retain and its
  projection loop, `begin_epoch`, and the command path supplying `after_sequence` in
  `src-tauri/src/commands.rs`. Is a fourth way missing? Is any of the three not actually an escape
  *from this loop* — i.e. does it fail to remove the offending entry, or remove it only in a case the
  paragraph does not state?
- **The eviction sentence carries a condition, and conditions are where a rewrite goes wrong.** It
  says the entry loses its place *"when [`evictable_sequence`] picks it — the victim is the lowest
  pending sequence of the path holding the most, so it is that path's oldest pending entry that goes
  and not whichever one this assertion trips over."* Read `evictable_sequence` and say whether that
  describes what it computes, **including the tie-break**, which `retained_state.rs` clause 5 states
  in different words. A description that is right about the common case and silent about the
  tie-break is a Medium, not a nit.
- **The paragraph now claims all three escapes "stay reachable after the panic, because `drain`,
  `enqueue` and `begin_epoch` each take this queue's lock through `PoisonError::into_inner` as every
  lock in this module does."** Two claims in one: the three named functions, and *every lock in this
  module*. Check both, and check whether "reachable" is the right word for what poisoning absorption
  buys — the module's own header at the top of the panic policy talks about **two** mutexes, and this
  sentence is about one.
- **It hands the closed count to clause 4 rather than deriving it.** *"That the list is closed at
  three is clause 4's claim rather than this paragraph's"*, plus a restatement of clause 4's own
  caveat that *exactly three* rests on a reading of every mutation of the pending map. Read clause 4
  in `crates/espansoconfig-core/src/watch/retained_state.rs` and check the restatement against it —
  the caveat's wording, and whether handing the count away is honest given the paragraph still
  enumerates three items itself.
- **The `INVENTORY` `reason`, on its own terms.** It now says *"the three escapes … all three
  performed by this file's own code"*, that *"each names clause 4's corresponding way as it lands on
  one entry rather than restating the clause, exactly as this file's `discards everything` entry does
  for the third"*, and that *"the closed count is handed to clause 4 rather than derived beside the
  assertion"*. Is **each** escape really clause 4's corresponding way — first, second, third, in that
  order? Is *"performed by this file's own code"* true of all three, given `after_sequence` arrives
  from a caller? Is the narrowed precedent claim (*"for the third"*) right? `count: 1` and the **local
  fact** cell were checked by round 9 and stand — say so if you disagree, but they are not the target.
- **Did the rewrite move any inventoried count?** The hunk adds prose to a swept file. The fix round
  claims it replicated `prose_sweep::prose_units`/`sweep` and ran both guards' phrase families over
  both swept trees before and after, with every `(file, phrase)` pair agreeing. **You cannot run the
  guard, so do not claim it passes or fails** — what you can do is read `PHRASES` and the added text
  and say whether any phrase in that list appears in the new prose without a matching `INVENTORY`
  count. A discrepancy you find by reading is a real finding; a green suite you did not run is not
  evidence.
- **Is §18 true of the two hunks, and are the four correction blocks true of what they correct?**
  §18.1 (finding by finding), §18.2 (by file), §18.3 (the gates) and §18.4 (where it is thin, with
  §7.3 marks). Derive any figure you cite. Check especially that §18.4's marks are right: an
  **actionable** item naming a correctness defect in a source file is a blocker under §7.3, and §18.4
  asserts that none below it is one.

## Three claims the record makes that you should re-derive rather than accept

Rounds 8 and 9 were each given three of these and cleared or broke them by their own derivation.
Yours:

1. **"No `INVENTORY` count moved"** (§18.2 and §18.3). The evidence offered is a Python replica of the
   sweep, which no longer exists in the tree and which you cannot re-run. What can you establish by
   reading alone, and what remains unverified? Say both.
2. **"The `reconciliation.rs` hunk is comment-only"** — asserted from `git diff -U0`. Check it
   yourself against `6572a29`, and remember that a `const` array entry is not a comment: the second
   hunk is deliberately *not* covered by that claim, so check the claim is scoped to the file it is
   made about.
3. **"Neither High could have been caught by the guard that demanded the entry, and that is a
   property of the guard rather than a gap in it"** (§18.4). The argument is that the guard's key is
   `(file, phrase)` and a count wrong *inside* a sentence moves nothing. Is that argument sound, and
   is it true of **both** Highs — including the one about a citation to the wrong clause?

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
names**, and **write the full report to `docs/reviews/phase-2d-4a-round-10.md`**. Both use this
vocabulary:

```
VERDICT: ship | ship-with-fixes | do-not-ship
BLOCKERS: <file:line — the claim, why it is false, and what the code actually does>
SHOULD-FIX: <same shape>
NOT-VERIFIED: <what you could not check, and why>
```

**Tag every finding with this project's severity** — `High`, `Medium` or `Low` as defined above — so
round 10 can be compared with rounds 1–9, which are all recorded in that vocabulary. A **High** is a
`BLOCKER`; a **Medium** or a **Low** is a `SHOULD-FIX` carrying its tag, e.g.
`SHOULD-FIX: [Medium] src-tauri/src/…`.

The report file must open with the line your agent definition requires and then a `# Phase 2d-4a-E —
review round 10` heading; use `###` for anything below that. 600 words max.
