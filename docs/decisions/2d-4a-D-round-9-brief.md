# Round 9's brief — Phase 2d-4a-D, the corrective phase

_Written 2026-08-29 for `/goahead-opus`, and **re-dispatched the same evening under
`/autoclaude-opus`** when that iteration ended before the round went out. This is the brief actually
dispatched for round 9, kept so the round can be audited against what it was asked. What changed
between the two versions is the reviewer and therefore the delivery: the `/goahead-opus` version
addressed a read-only Codex agent whose final message was the deliverable, and this one addresses the
`autoclaude-reviewer` agent, which writes its own report file. **The scope, the checks and the three
claims to re-derive are unchanged.** Round 7's brief is
[`2d-4a-round-7-brief.md`](2d-4a-round-7-brief.md); the Codex dispatch procedure, unused this round,
is [`codex-dispatch-procedure.md`](codex-dispatch-procedure.md)._

**Why not Codex.** `PROGRESS.md` had planned round 9 as a Codex round on the grounds that Codex's
usage window reopened at 19:07. That plan belonged to `/goahead-opus`; the workflow that ran this
round is `/autoclaude-opus`, whose review step names exactly one mechanism — a fresh
`autoclaude-reviewer` on `model: "opus"` that did not write the code. Using the workflow's own
reviewer was preferred over reaching for another provider fourteen minutes before its window opened.
Round 9 is therefore the third consecutive adversarial-Opus round of this tail, and that is a
coverage bound worth naming rather than a defect: no round of 2d-4a since round 6 has had a second
model's eyes on it.

---

Do NOT use web search and do NOT fetch URLs. Answer from the repository in front of you and from your
own knowledge, and finish promptly.

Repository: `/Users/ccarpio/Developer/espansoConfig`. Rust workspace plus a Svelte/Tauri frontend.
**Do not run `cargo` or `npm`**: the orchestrator runs every gate itself, alone, afterwards, and a
round that cannot run a gate must not report one. The workspace suite takes over four minutes and one
of its gates false-fails when a second Cargo process is on the machine, so starting one would both
blow your time budget and corrupt the orchestrator's measurement. **Review by reading.** Your time
budget is **12 minutes**.

**Write exactly one file: your report, to `docs/reviews/phase-2d-4a-round-9.md`**, overwriting the
placeholder that is there now. Change nothing else in the repository — you are reviewing a fix, not
making one, and a reviewer that edits the code it reviews destroys the only cold reading this round
gets.

The working tree is clean at `HEAD` = `3df75b1` apart from two untracked files, this brief and that
placeholder report. **The gates were run on exactly this commit** by the previous iteration's
orchestrator, an hour before you were spawned, and no file has changed since — the figures are in
`PROGRESS.md` under "Verification baseline": `cargo test --workspace` 1313 passed / 0 failed, exit 0;
`cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean; `cargo doc
--workspace --no-deps` exit 0; `cargo tree -p espansoconfig-core | rg tauri` empty; `npm test` 2125;
`npm run check` 431 files / 0 errors; `npm run build` 184 modules. **They are given to you as context,
not as something you are being asked to trust**: this round's verdict must not rest on any of them,
and the orchestrator re-measures every one after your findings are fixed. **A green suite is not
evidence about a comment** anyway, and this round's scope is almost entirely comment and record — the
guard described below is the only executable thing that reads any of it.

## What this round is

This is **round 9** of Phase 2d-4a's review tail, running as its own corrective phase (2d-4a-D)
because the workflow's cap of two review invocations per phase was spent on rounds 7 and 8.

`CLAUDE.md` §7.1 commissions a round for exactly one reason: **a fix round that changed at least one
source file.** Round 8's fix changed two, so this round exists. Its scope is **that fix and nothing
else** — not the whole of 2d-4a, not rounds 1–7, not the phase's design.

## The exact scope — two source hunks, and the record section that describes them

Everything is at `HEAD` (`3df75b1`); the working tree is clean. Both hunks landed in commit
`125dfa8`, which also carries round 7's fix, so **the commit is wider than your scope.** Review these
two hunks only.

**1. `src-tauri/src/reconciliation.rs`** — one comment hunk inside the doc comment on
`fn address_of_minted` (the function begins around line 1505). The hunk is the passage now reading
from **"What that does not buy is a queue this caller can drain"** through **"neither touches the
disagreement, and nothing here prevents either"** — roughly lines 1487–1500. What it replaced said the
caller *"cannot acknowledge past a sequence it was never handed"*. Round 8 found that claim false;
this is the sentence written in its place.

**2. `src-tauri/src/retained_state_contract.rs`** — one new `INVENTORY` entry, around line 1083:

```rust
Judged {
    file: "src-tauri/src/reconciliation.rs",
    phrase: "things end",
    count: 1,
    reason: "local fact: the two escapes from `address_of_minted`'s repeating assertion — an unvalidated watermark pruning the entry, and `begin_epoch` discarding it. The second cites clause 6's consequence on one path rather than restating the scope, exactly as this file's `discards everything` entry does",
},
```

**This entry is the sharper half of your scope, and it is the half nothing has reviewed.** It was
written *after* round 8 had read the diff, because the guard that demanded it —
`retained_state_contract::tests::every_retained_state_claim_is_judged` — had not yet been run against
the M1 comment. The first `cargo test --workspace` after the fix failed, exit 101, naming
`reconciliation.rs:1425`, phrase `"things end"`, *found 1, inventory says 0*. So round 8 reviewed the
comment and **not** the judgement recorded for it. Start here.

**3. `docs/decisions/2d-4a-notes.md` §17** — the record of round 8 and its fix. Read it, and check it
against the two hunks rather than the other way round: *a decision record that claims a guarantee the
code does not give is this project's worst defect class.*

You may read anything in the repository you need in order to judge those three. `CLAUDE.md` is the
project's rulebook; `docs/reviews/phase-2d-4a-round-8.md` is round 8's own report.

## What to check, hardest first

- **Are the M1 paragraph's two escapes actually true of the code?** It asserts (a) `after_sequence`
  crosses the wire as an unvalidated `u64`, so a caller passing a watermark at or above the offending
  entry's sequence prunes that entry **at the retain, before the projection runs**; and (b)
  `ReconciliationQueue::begin_epoch` assigns an empty state over the whole of it, so reopening the
  workspace discards the entry too. Trace both through `ReconciliationQueue::drain`,
  `ReconciliationQueue::begin_epoch`, and the command path that supplies `after_sequence`
  (`src-tauri/src/commands.rs`). Say where each is wrong, or say it holds.
- **Does the paragraph claim anything else it cannot?** It also says "Both are escapes rather than
  repairs — neither touches the disagreement, and nothing here prevents either", and "None of this
  paragraph is asserted by anything". Are those true? Is there a third way the loop ends that the
  paragraph's "**Two** things end that loop" excludes? A closed enumeration that is wrong by one is
  exactly what round 5 of this tail found in this same file.
- **The `INVENTORY` judgement, on its own terms.** `retained_state_contract.rs`'s module header
  defines the taxonomy the guard asks about — the contract itself, a pointer, a local fact, or a false
  positive. Is **local fact** the right cell for this comment? Is `count: 1` right? Is the `reason`
  accurate — does the `begin_epoch` half really cite clause 6's consequence on one path rather than
  restating the scope, and is the cited precedent (this file's `discards everything` entry) actually
  the same shape? Read
  `crates/espansoconfig-core/src/watch/retained_state.rs` clause 6 yourself rather than trusting the
  citation.
- **Did the new comment move any other inventoried count?** The hunk adds prose to a swept file. Every
  phrase in `PHRASES` that the new text contains has to agree with `INVENTORY`. The guard passes
  today, so this is a question about whether the guard *can* see what it would need to — not about
  whether it currently fails.
- **Is §17 of `2d-4a-notes.md` true of the two hunks?** In particular §17.1's M1 bullet, §17.2's
  by-file list, and §17.3's account of the guard firing. Three prior rounds of this tail found a
  reviewer's or a fix round's *count* wrong; derive any figure you cite yourself.

## Three claims the record makes that you should re-derive rather than accept

Round 8 was given three of these and cleared all three by its own derivation. Yours:

1. **"This is the round's only source change"** (§17.1's M1 bullet) — said of `reconciliation.rs`,
   while §17.2 and §17.3 both record the `INVENTORY` entry as a **second** source change made later.
   Is the record self-consistent, or does one of those sentences have to go?
2. **"It changed no executable line."** Verify it for the round-8 fix's two hunks rather than assuming
   it: `git diff` the two files across `125dfa8` and read what is inside `///`, `//!` and string
   literals. A `const` array entry is not a comment.
3. **"The fix made the paragraph *say less*, which is why it is safe without a test"** (§17.4). Does
   the new paragraph genuinely claim strictly less than the one it replaced, or does it trade one
   claim for two new ones?

## Rules

- **Verify before asserting: open the file and quote the line.** A finding you cannot point at in the
  code is a question, not a finding — mark it as one.
- No praise, no summary of what the code does, no restating the plan or this brief.
- Finding nothing at a severity is a valid answer. Say so rather than inventing.
- Use `###` for any internal headings, so the report files as one section.
- Severities: **High** = a correctness defect, or a claim in source or record that is false in a way
  that could mislead a later change. **Medium** = a claim that is incomplete or unsupported.
  **Low** = imprecision with no path to a wrong change.


## Report format

Two audiences, one report. **Return to the orchestrator only the verdict lines your agent definition
names**, and **write the full report to `docs/reviews/phase-2d-4a-round-9.md`**, overwriting the
placeholder. Both use this vocabulary:

```
VERDICT: ship | ship-with-fixes | do-not-ship
BLOCKERS: <file:line — the claim, why it is false, and what the code actually does>
SHOULD-FIX: <same shape>
NOT-VERIFIED: <what you could not check, and why>
```

**Tag every finding with this project's severity** — `High`, `Medium` or `Low` as defined above — so
round 9 can be compared with rounds 1–8, which are all recorded in that vocabulary. A **High** is a
`BLOCKER`; a **Medium** or a **Low** is a `SHOULD-FIX` carrying its tag, e.g.
`SHOULD-FIX: [Medium] src-tauri/src/…`.

The report file must open with the two lines your agent definition requires and then a `# Phase
2d-4a-D — review round 9` heading; use `###` for anything below that, so the file reads as one
section. 600 words max.
