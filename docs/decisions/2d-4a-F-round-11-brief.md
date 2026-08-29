# Round 11's brief — Phase 2d-4a-F, the third corrective phase

_Written and dispatched 2026-08-29 under `/autoclaude-opus` in driven mode, to the workflow's own
`autoclaude-reviewer` agent on `model: "opus"`. Kept so the round can be audited against what it was
actually asked. Round 10's brief is [`2d-4a-E-round-10-brief.md`](2d-4a-E-round-10-brief.md), and this
one copies its shape._

**A coverage bound this brief cannot fix, stated up front because it changes how you should read.**
Rounds 1–6 of this tail went to Codex. Rounds 7, 8, 9 and 10 were adversarial Opus agents, and you are
the **fifth consecutive one**. Each was cold and each re-derived rather than accepted — but a prior of
yours that the last four shared is invisible from inside all five. So do not assume a claim is safe
because a previous round read the same paragraph and let it stand: **rounds 8, 9 and 10 each found a
defect in the fix that answered the round before them**, every time in prose the previous round had
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

**Write exactly one file: your report, to `docs/reviews/phase-2d-4a-round-11.md`.** Change nothing
else — you are reviewing a fix, not making one.

The working tree is clean at `HEAD` = `f7bbf6d`, whose only change over the reviewed commit is a
`PROGRESS.md` record entry. **The gates were run on the round-10 fix by the orchestrator alone**,
before you were spawned, each command issued separately: `cargo test --workspace` 1313 passed / 0 failed over 26 `test result: ok` lines, exit 0 (redirected to a file, never piped, so the status is Cargo's); `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean; `cargo doc --workspace --no-deps` exit 0 with 73 `private_intra_doc_links` and 0 unresolved; `cargo tree -p espansoconfig-core | rg tauri` empty; `npm run check` 431 files / 0 errors / 0 warnings; `npm test` 2125 over 56 files; `npm run build` 184 modules, the server-only bundle oracle absent and the client-only one present with 2 matches. **They are context, not something
you are asked to trust** — and **a green suite is no evidence at all about a comment**, which is your
entire scope.

## What this round is

This is **round 11** of Phase 2d-4a's review tail, running as its own corrective phase (2d-4a-F).
`CLAUDE.md` §7.1 commissions a round for exactly one reason: **a fix round that changed at least one
source file.** Round 10's fix changed one — `src-tauri/src/reconciliation.rs`, comment-only, two
hunks — so this round exists. Its scope is **that fix and nothing else**: not rounds 1–9, not the
phase's design, not the queue.

**Read `CLAUDE.md` §7 before you write your verdict.** Whether this tail ends at round 11 is decided
by what your findings make the fix round touch: a finding whose fix is prose-only commissions nothing
and the tail ends, and a finding whose fix touches a source file commissions round 12. That is not a
reason to soften or to sharpen anything — it is a reason to be exact about **where** each finding
lives. The record already predicts the tail ends here (§19.4); **a prediction in the record is not a
finding you owe it**, and if the fix is genuinely wrong, say so.

## The exact scope — one commit, two comment hunks, and the record that describes them

Everything is in commit **`22d1afb`** ("Run 2d-4a review round 10, and answer it by pointing rather
than restating"). `git show 22d1afb -- src-tauri/src/` gives you both hunks and nothing else. Read the
paragraph whole as it now stands — `src-tauri/src/reconciliation.rs` ~1481–1521, the doc comment on
`fn address_of_minted` — not just the diff, because both edits were made *inside* a passage whose
other sentences did not move.

**Edit 1 (round 10's M1) — the eviction sentence stopped paraphrasing and started pointing.** It read
*"the victim is the lowest pending sequence of the path holding the most, so it is that path's oldest
pending entry that goes and not whichever one this assertion trips over"*, which was silent about the
tie-break. It now reads *"what it picks is fixed by a rule about paths and their pending counts,
stated whole as [`espansoconfig_core::watch::retained_state`]'s clause 5, so the victim is whatever
that rule names and never whichever entry this assertion trips over"*.

**Edit 2 (round 10's M2) — clause 4's caveat was deleted, leaving the pointer alone.** The hand-off
*"That the list is closed at three is clause 4's claim rather than this paragraph's"* used to be
followed by a restatement of clause 4's own methodological caveat (*exactly three* rests on a reading
of every mutation of the pending map). That restatement is gone; what remains is *"clause 4 is where a
stored entry's exits are enumerated, where what that count rests on is stated, and where a fourth
would have to be added."*

**The record under review** is `docs/decisions/2d-4a-notes.md` **§19** (four subsections) and the
**one `> **Correction, round 10 (L1)**` block** the fix added inside **§18.3**. Check these against
the hunks rather than the other way round: *a decision record that claims a guarantee the code does
not give is this project's worst defect class.*

You may read anything you need to judge those. `CLAUDE.md` is the rulebook;
`docs/reviews/phase-2d-4a-round-10.md` is round 10's own report.

## What to check, hardest first

- **Did pointing lose something the paraphrase carried?** That is the central question of this round,
  and it cuts both ways. Open `crates/espansoconfig-core/src/watch/retained_state.rs` clause 5 and
  read it against the new sentence. Is *"a rule about paths and their pending counts"* an honest
  summary of what clause 5 states, or does it under-describe it to the point of saying nothing? Does
  clause 5 in fact state the rule **whole, tie-break included**, so that *"stated whole as … clause
  5"* is true? And read `evictable_sequence` itself: does clause 5 describe what that function
  computes? A pointer to a contract that does not say what the pointer claims it says is worse than
  the paraphrase it replaced.
- **Read the new eviction sentence together with the sentence four lines below it.** The paragraph
  goes on: *"each waits on something outside this function: a caller's watermark, **an overflow that
  selects this entry**, and a reopen."* Set that beside *"the victim is whatever that rule names and
  **never** whichever entry this assertion trips over."* Are both true at once? Decide what the
  eviction escape requires in order to *be* an escape for the offending entry, and say whether the
  word *never* is right, wrong, or ambiguous in a way that could mislead a later change. Note that
  the sentence's own condition is *"costs the offending entry its place **when [`evictable_sequence`]
  picks it**"*. Round 9's High was an enumeration wrong by one; an escape that cannot fire would be
  the same defect arrived at from the other side.
- **Is the clause-4 hand-off still true of clause 4 after the deletion?** The surviving sentence makes
  three claims about clause 4: that it enumerates a stored entry's exits, that it states **what that
  count rests on**, and that it is where a fourth would have to be added. Read clause 4 and check all
  three, the middle one hardest — it is the residue of the caveat M2 deleted, and it is the sentence
  most likely to have kept the paraphrase's meaning while claiming to have dropped it. §19.1's M2 says
  *"Nothing local was judged to need saving"*: is that right, or did the deleted caveat carry
  something this passage needed?
- **`retained_state.rs`'s own module header states the rule both edits invoke** — *point, do not
  restate* (around `:55-61`). Read it and check that it says what §19.1 twice claims it says,
  including the *"has bought nothing"* reasoning attributed to it. A rule cited to justify two source
  edits should be quoted correctly.
- **The two link counts in the record disagree with each other, and at most one framing can be
  right.** §18.3's round-10 correction block says it states the figure *"of the paragraph as it now
  stands"* and gives **five link occurrences over four targets**. §19.3 says the same edit takes *"the
  paragraph to six link occurrences over five distinct targets"*. Count the intra-doc links in the
  paragraph yourself, distinguishing *added by the round-9 hunk* from *present in the paragraph*, and
  say which figure is wrong, or whether they are counting different things and one is mislabelled.
- **Did the rewrite move any inventoried count?** The hunk both adds and removes prose in a swept
  file. §19.3 claims all 298 `(file, phrase)` pairs are unmoved, on a replica you cannot run. **You
  cannot run the guard, so do not claim it passes or fails** — what you can do is read `PHRASES` in
  `src-tauri/src/prose_sweep.rs` and `src-tauri/src/retained_state_contract.rs` against the added and
  deleted text, and say whether any phrase appears in the new prose, or vanished from the old, without
  a matching `INVENTORY` count. A discrepancy found by reading is a real finding; a green suite you
  did not run is not evidence.
- **Is §19 true of the hunks?** §19.1 (finding by finding, including the declined L2), §19.2 (by
  file), §19.3 (the gates) and §19.4 (where it is thin, with §7.3 marks). Derive any figure you cite.
  Check especially that §19.4's marks are right: an **actionable** item naming a correctness defect in
  a source file is a blocker under §7.3, and §19.4 asserts that none below it is one.

## Three claims the record makes that you should re-derive rather than accept

Rounds 8, 9 and 10 were each given three of these and cleared or broke them by their own derivation.
Yours:

1. **L2 was considered and declined, and a declined finding is not a closed one** (§19.1, §19.4).
   Round 10 found the precedent claim in `src-tauri/src/retained_state_contract.rs:1089`'s `reason`
   overstated — it says its three escapes each name clause 4's corresponding way *"exactly as this
   file's `discards everything` entry does for the third"*, and that precedent entry at `:1005` never
   spells *clause 4*. The fix round agreed the form matches and declined the edit, and §19.1 records
   the argument **in full so that a later round can disagree with it rather than rediscover it**. You
   are that later round. Read both entries and the argument, and say whether the argument holds. It is
   a legitimate answer that it does; it is also legitimate to break it. What is not legitimate is
   ignoring it.
2. **"The `reconciliation.rs` hunk is comment-only, +9 / −9, every added and removed line beginning
   `///`"** (§19.2), and **"`retained_state_contract.rs` is unchanged by this fix round"**. Check both
   yourself against `22d1afb`. The second matters more than it looks: §19.1's closing paragraph
   argues that the `reason` at `:1089` is *"still true, and more nearly true than before"* of the
   edited comment, which is the whole justification for not touching it. Is it?
3. **"A pointer's target is checked for existence, not for content"** (§19.4). Both crates deny
   `rustdoc::broken_intra_doc_links`, so deleting or renaming `retained_state` breaks the build — but
   *clause 4* and *clause 5* are ordinals in a hand-numbered list, and **inserting a clause renumbers
   every citation of it in this workspace with nothing failing**. This round's two edits lean on that
   harder than any before them. Is the item's conclusion — that both edits are nonetheless strictly
   better than what they replace — sound? And is the ordinal exposure it describes actually confined
   to what §19.4 names, or does the workspace cite these clauses in more places than that item
   accounts for?

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
names**, and **write the full report to `docs/reviews/phase-2d-4a-round-11.md`**. Both use this
vocabulary:

```
VERDICT: ship | ship-with-fixes | do-not-ship
BLOCKERS: <file:line — the claim, why it is false, and what the code actually does>
SHOULD-FIX: <same shape>
NOT-VERIFIED: <what you could not check, and why>
```

**Tag every finding with this project's severity** — `High`, `Medium` or `Low` as defined above — so
round 11 can be compared with rounds 1–10, which are all recorded in that vocabulary. A **High** is a
`BLOCKER`; a **Medium** or a **Low** is a `SHOULD-FIX` carrying its tag, e.g.
`SHOULD-FIX: [Medium] src-tauri/src/…`.

The report file must open with the line your agent definition requires and then a `# Phase 2d-4a-F —
review round 11` heading; use `###` for anything below that. 600 words max.
