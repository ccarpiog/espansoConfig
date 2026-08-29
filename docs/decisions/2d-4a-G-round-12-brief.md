# Round 12's brief — Phase 2d-4a-G, the fourth corrective phase

_Written and dispatched 2026-08-29 under `/autoclaude-opus` in driven mode, to the workflow's own
`autoclaude-reviewer` agent on `model: "opus"`. Kept so the round can be audited against what it was
actually asked. Round 11's brief is [`2d-4a-F-round-11-brief.md`](2d-4a-F-round-11-brief.md), and this
one copies its shape._

**A coverage bound this brief cannot fix, stated up front because it changes how you should read.**
Rounds 1–6 of this tail went to Codex. Rounds 7 through 11 were adversarial Opus agents, and you are
the **sixth consecutive one**. Round 11 is evidence that a cold Opus round is not worthless here — it
found a High the four before it had read past — and it is **not** evidence that the bound is
discharged. So do not assume a claim is safe because a previous round read the same paragraph and let
it stand: **rounds 8, 9, 10 and 11 each found a defect in the fix that answered the round before
them**, and round 11's High was in a clause that had been sitting in that paragraph, in a weaker
spelling, since before the fix it was reviewing. Look hardest exactly where an Opus reviewer would
nod.

---

Do NOT use web search and do NOT fetch URLs. Answer from the repository in front of you and from your
own knowledge, and finish promptly.

Repository: `/Users/ccarpio/Developer/espansoConfig`. Rust workspace plus a Svelte/Tauri frontend.
**Do not run `cargo` or `npm`**: the orchestrator ran every gate itself, alone, on exactly this source
tree, and a round that cannot run a gate must not report one. The workspace suite takes over four
minutes and one of its gates false-fails when a second Cargo process is on the machine, so starting
one would both blow your time budget and corrupt the orchestrator's measurement. **Review by
reading.** Your time budget is **12 minutes**.

**Write exactly one file: your report, to `docs/reviews/phase-2d-4a-round-12.md`.** Change nothing
else — you are reviewing a fix, not making one.

The working tree is clean at `HEAD` = `4d90177`, whose only change over the reviewed commit is a
`PROGRESS.md` record entry. **The gates were run on the round-11 fix by the orchestrator alone**,
before you were spawned, each command issued separately and **redirected to a file rather than piped**
so every status is the tool's own: `cargo test --workspace` 1313 passed / 0 failed over 26 `test
result: ok` lines, exit 0; `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt
--check` clean; `cargo doc --workspace --no-deps` exit 0 with 73 warnings, all
`private_intra_doc_links`, and 0 unresolved, run after `touch`ing `reconciliation.rs`; `cargo tree -p
espansoconfig-core | rg tauri` empty; `npm run check` 431 files / 0 errors; `npm test` 2125 over 56
files; `npm run build` 184 modules with the server-only bundle oracle absent and the client-only one
present. **They are context, not something you are asked to trust** — and **a green suite is no
evidence at all about a comment**, which is your entire scope.

## What this round is

This is **round 12** of Phase 2d-4a's review tail, running as its own corrective phase (2d-4a-G).
`CLAUDE.md` §7.1 commissions a round for exactly one reason: **a fix round that changed at least one
source file.** Round 11's fix changed one — `src-tauri/src/reconciliation.rs`, comment-only, **+4 /
−3**, a single sentence — so this round exists. Its scope is **that fix and nothing else**: not rounds
1–10, not the phase's design, not the queue.

**Read `CLAUDE.md` §7 before you write your verdict.** Whether this tail ends at round 12 is decided
by what your findings make the fix round touch: a finding whose fix is prose-only commissions nothing
and the tail ends, and a finding whose fix touches a source file commissions round 13. That is not a
reason to soften or to sharpen anything — it is a reason to be exact about **where** each finding
lives. **§19.4 predicted the tail would end at round 11 and was wrong**, and §20.4 deliberately makes
no prediction; do not read either as telling you what to find.

## The exact scope — one commit, one sentence, and the record that describes it

Everything is in commit **`b854de5`** ("Run 2d-4a review round 11, and move \"never\" onto the reason
it was true of"). `git show b854de5 -- src-tauri/src/` gives you the hunk and nothing else. Read the
paragraph whole as it now stands — the doc comment on `fn address_of_minted`, ~lines 1481–1522 — not
just the diff, because the edit was made *inside* a passage whose other sentences did not move, and
**that is exactly how round 11's High survived four rounds**.

**The edit.** The sentence used to end:

> …stated whole as [`espansoconfig_core::watch::retained_state`]'s clause 5, **so the victim is
> whatever that rule names and never whichever entry this assertion trips over**; and

It now ends:

> …stated whole as [`espansoconfig_core::watch::retained_state`]'s clause 5. **That rule does not
> know this assertion exists**: the offending entry goes when the rule happens to name it, **never
> because it is the entry that trips here**, so this escape waits on a state it cannot bring about;
> and

Round 11's High was that the old wording denied the very thing the escape requires: the same
sentence's own condition is *"costs the offending entry its place **when** [`evictable_sequence`]
**picks it**"*, the paragraph's summary four lines below names what this escape waits on as *"an
overflow that **selects this entry**"*, and the `INVENTORY` `reason` at
`src-tauri/src/retained_state_contract.rs:1089` calls it *"an overflow evicting **it** inside the
enqueue"*. The repair **keeps the word *never* and moves it from the victim onto the reason.**

**The record under review** is `docs/decisions/2d-4a-notes.md` **§20** (four subsections) and the
**two `> **Correction, round 11 …**` blocks** the fix added — one under §19.1's closing paragraph, one
under §18.3's round-10 block. Check these against the hunk rather than the other way round: *a
decision record that claims a guarantee the code does not give is this project's worst defect class.*

You may read anything you need to judge those. `CLAUDE.md` is the rulebook;
`docs/reviews/phase-2d-4a-round-11.md` is round 11's own report, and its *Cleared by derivation*
section lists six things it established from the code — **you are not asked to redo those**, but you
may break any of them if you find it wrong.

## What to check, hardest first

- **A repair that relocates a word can relocate the defect.** *Never* now attaches to the **reason**
  rather than to the **victim**. Test the new sentence exactly as round 11 tested the old one: read it
  against its own condition four lines above, against the paragraph's summary at *"an overflow that
  selects this entry"*, and against the `reason` at `retained_state_contract.rs:1089`. Can all four
  now be true together? Is *"never because it is the entry that trips here"* actually true of
  `evictable_sequence` (`src-tauri/src/reconciliation.rs`, around `:921-935`) — i.e. is the selection
  genuinely independent of which entry tripped the assertion, or is there any coupling, however
  indirect, between the offending entry and the rule's inputs?
- **The three new clauses each make a separate claim, and each can be wrong on its own.** (a) *"That
  rule does not know this assertion exists"* — is *the rule* clause 5, `evictable_sequence`, or both,
  and is the sentence's antecedent unambiguous to a reader who arrives here cold? (b) *"the offending
  entry goes when the rule happens to name it"* — is *happens to* right, or does it understate a
  condition that is in fact characterisable (the offending entry's path holding the most pending
  entries, and the entry being that path's lowest sequence)? A description that is right and vague
  where the old one was wrong and precise is a trade worth naming if you think it was made. (c) *"so
  this escape waits on a state it cannot bring about"* — what does **it** refer to, and is the claim
  true of that referent? Note the paragraph already says, four lines below, that each escape *"waits
  on something outside this function"*; is the new clause a duplicate of that, a sharpening of it, or
  in tension with it?
- **`retained_state.rs`'s module header says *point, do not restate*** (around `:55-61`), and both
  round-10 edits were justified by it. Does the new sentence honour it, or has the repair grown a new
  paraphrase of clause 5 beside the pointer it kept? This is the discipline round 10's M2 was about,
  and a fix written to answer a *correctness* finding is exactly where it would be forgotten.
- **The surrounding sentences are in scope for the same reason round 11's High was.** Round 11 found a
  defect that predated the fix under review, in a clause the previous fix had preserved while
  rewriting its neighbours. The clauses this fix preserved are the ones to read hardest: the
  `after_sequence` escape, the `begin_epoch` escape, *"All three are escapes rather than repairs"*, the
  poisoning claim, and the clause-4 hand-off. **A rewrite is not a review of what it preserves.**
- **Did the rewrite move any inventoried count?** §20.3 claims none did, and says the check was run
  **before** the edit was applied by counting all 88 `RETAINED_STATE_SHAPES` and 61 `LIVENESS_SHAPES`
  phrases against the exact prose removed and the exact prose added. **You cannot run the guard, so do
  not claim it passes or fails** — what you can do is read those phrase lists against the diff and say
  whether any phrase appears in the added prose or vanished from the removed prose. A discrepancy
  found by reading is a real finding; a green suite you did not run is not evidence.
- **Is §20 true of the hunk?** §20.1 (finding by finding), §20.2 (by file — including the claims *+4 /
  −3*, *every added and removed line begins `///`*, *the link set is untouched*, and *the paragraph is
  still six occurrences over five targets*), §20.3 (the gates and the phrase check) and §20.4 (where
  it is thin, with §7.3 marks). Derive any figure you cite. Check especially that §20.4's marks are
  right: an **actionable** item naming a correctness defect in a source file is a blocker under §7.3,
  and §20.4 asserts that none below it is one.
- **Are the two round-11 correction blocks true of what they correct?** The one under §19.1 claims the
  round-10 check was run against M2 and not M1, and that *unchanged* was the wrong outcome to be
  reassured by. The one under §18.3 gives six-over-five and says §19.3 was right all along. Both are
  checkable against the files they name.

## Three claims the record makes that you should re-derive rather than accept

Rounds 8 through 11 were each given three of these and cleared or broke them by their own derivation.
Yours:

1. **"The ordinal-fragility surface is nine Rust files and 83 citations"** (§20.4). That count is the
   *orchestrator's*, taken with `rg -c 'clause [0-9]'` while round 11 was in flight, and **round 11
   did not verify it**. The record says so in the same sentence. Re-derive it, and say whether the
   conclusion drawn beside it is sound — that inserting a clause into
   `crates/espansoconfig-core/src/watch/retained_state.rs`'s hand-numbered list renumbers every
   citation in the workspace **with nothing failing**, because `rustdoc::broken_intra_doc_links`
   checks a target's existence and not its content.
2. **"L2 stays declined on two rounds' reading"** (§20's opening, §19.1). The precedent claim in
   `retained_state_contract.rs:1089`'s `reason` — *"exactly as this file's `discards everything` entry
   does for the third"* — against that entry at `:1005`, which never spells *clause 4*. §19.1 has the
   argument in full and round 11 agreed with it. **Do not spend your budget rediscovering it**; say in
   one line whether you also agree, and move on. If you think both previous rounds were wrong, that is
   a finding worth making, but make it against the argument as written.
3. **"H1 was older than the fix that was under review"** (§20.4, and §20.1's closing sentences). The
   claim is that the pre-M1 text carried the same shape with *not*, so rounds 9 and 10 both read it,
   and that it is nonetheless in round 11's scope because M1 deliberately kept and strengthened that
   clause. Check the first half against `git show 6572a29 -- src-tauri/src/reconciliation.rs`. Is the
   scoping argument in the second half honest, or is it a record claiming credit for finding a defect
   it should be recording as inherited?

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
names**, and **write the full report to `docs/reviews/phase-2d-4a-round-12.md`**. Both use this
vocabulary:

```
VERDICT: ship | ship-with-fixes | do-not-ship
BLOCKERS: <file:line — the claim, why it is false, and what the code actually does>
SHOULD-FIX: <same shape>
NOT-VERIFIED: <what you could not check, and why>
```

**Tag every finding with this project's severity** — `High`, `Medium` or `Low` as defined above — so
round 12 can be compared with rounds 1–11, which are all recorded in that vocabulary. A **High** is a
`BLOCKER`; a **Medium** or a **Low** is a `SHOULD-FIX` carrying its tag, e.g.
`SHOULD-FIX: [Medium] src-tauri/src/…`.

The report file must open with the line your agent definition requires and then a `# Phase 2d-4a-G —
review round 12` heading; use `###` for anything below that. 600 words max.
