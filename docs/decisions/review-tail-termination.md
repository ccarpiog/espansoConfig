# The review-tail problem: why `/goahead-opus` never finishes a phase here

> **Status: resolved, 2026-08-29.** This started life as a brief
> (`docs/goahead-review-tail-issue.md`) and is kept as a decision record, because its measurements
> are the evidence for the rule that replaced the defect. **Everything below the resolution is the
> diagnosis exactly as it was written**, including its line references — `CLAUDE.md:353` names the
> file *before* this fix, and that paragraph has since been rewritten and now points at `CLAUDE.md`
> §7. Its *"What to change"* list is likewise the **original proposal**, not the rule that shipped:
> items 1–3 there were reshaped by the review recorded in the resolution, and `CLAUDE.md` §7 is
> authoritative over both.

## Resolution — 2026-08-29, amended the same day after review

**What was decided.** A review tail ends by a rule the `.md` files can evaluate, never by an owner
ruling — and where a tail will not end that way, the files say so as `BLOCKED` rather than as another
round. The rule is **one generator with one consequence**, stated in **`CLAUDE.md` §7,
"Review rounds and when a tail ends"**:

> **A round is commissioned by exactly one thing: a fix round that changed at least one source file.**
> **A step closes as soon as no round is commissioned.**

Three things follow from it, and none of them is a second rule:

1. **"A fix is a change" is bounded to source, and it is the only thing that commissions a round**
   (§7.1). A prose-only fix is recorded, not reviewed, whatever the severity of the finding it
   answered. A fix that changes source is owed a round scoped to that change **even when the finding
   was a Low**. The rule itself stays — it is a real lesson (2c-3a-1) — but it can no longer take the
   record's own sentences as its subject.
2. **Closure is that rule's outcome, not a clause of its own** (§7.2). A 0-High/0-Medium verdict is
   the *common case* — a round with nothing to fix changes no source file, so it commissions nothing
   — and not an independent stopping condition. What the shape guarantees is stated precisely and no
   wider: each round exists only because the previous round's fix changed source, so **a tail ends
   the first time a fix stops touching source**, which is how every tail this project has actually
   run has ended. It does **not** bound a tail in which each fix keeps introducing a real source
   defect, and it is not meant to — that tail is finding real defects, and §7.2 sends it to `BLOCKED`
   rather than weakening the generator.
3. **"What this round does not close, and where it is thin" stops being an automatic work list**
   (§7.3). The section stays and each item is marked **actionable** or **recorded only**, and
   **neither mark commissions a round**: the marks distinguish what a later phase may adopt from what
   is written down and left. But an **actionable** item naming a **correctness defect in source** is
   not adoptable at all — it is a blocker under §7.2, fixed now or the step does not close and is
   marked `BLOCKED` with the item named. *"A later phase may adopt it"* stays for the genuinely
   optional kind, which is what **recorded only** is for. Unmarked counts as recorded only, and
   **existing notes files are deliberately not retro-marked**.

**What the first draft got wrong, and what replaced it.** The first draft of §7 was reviewed
(`docs/reviews/phase-M2-review-tail-termination.md`, `not-ready`: 2 High, 2 Medium, 1 Low) and three
of its five findings had one root cause — rounds were *commissioned* by one rule and *stopped* by a
different, independently counted one, so the two could disagree:

| Verdict shape | Under the first draft | Under the rule as it now stands |
|---|---|---|
| 0 High/0 Medium, plus a **Low whose fix changes source** | "a step closes" **and** "that fix is owed a round" — contradictory, and the unsafe arm won | one round, scoped to that fix |
| Round 1 returns **High findings that are all about the record** | prose-only fix commissions nothing, yet closure needed *two* consecutive no-source rounds — neither closed nor able to close | the step closes |
| 0 High/0 Medium carrying an **actionable** "where it is thin" item | closure required, while §7.3 said the item "can commission a round" — undecided, and "can" named no decider | the step closes and the item is carried, not executed — unless it names a correctness defect in source, which is a blocker and holds the step open as `BLOCKED` |

So the **"two consecutive rounds"** clause was deleted outright — it was the independent counter, and
what it reached for is now derived — and **"fixing a Low does not open a round"** was narrowed to
what is actually true: fixing a Low *without touching source* opens no round.

**The definition of "source" was inverted so that an omission fails safe.** It named three
directories, which excluded — by omission, not by decision — `src-tauri/tauri.conf.json`,
`src-tauri/capabilities/default.json`, `src-tauri/build.rs`, `src-tauri/Cargo.toml`, the root
`Cargo.toml`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `package.json`, the lockfiles
and `scripts/`. **"The record" is now the closed list** — `PROGRESS.md`, `CLAUDE.md`,
`IMPLEMENTATION_PLAN.md`, any `README*`, everything under `docs/` — **and every other file is
source, even when it looks like documentation.** The sequence that made this a High: a round finds
the `custom-protocol` feature wrong in `src-tauri/Cargo.toml`, the fix introduces a second mistake,
and no round follows; that feature decides whether the production build loads the bundled assets or
a dead development URL, and its earlier absence shipped a blank application.

**What round 2 found, and what this fix round did.** The amended §7 was reviewed again
(`docs/reviews/phase-M2-review-tail-termination.md` § *Round 2*, `not-ready`: 1 High, 1 Medium, 3
Low), and the High had two halves needing different answers. Outside a `goahead` run, §7.2 claimed
flatly that *"the rule terminates"* — false of a tail in which every fix changes source to answer a
real defect. The **claim** was narrowed to what is true; the mechanism was deliberately left alone,
and a tail that will not end that way is now named as a signal about the work and routed to `BLOCKED`.
Under a `goahead` run the opposite gap: review 1 → source fix → review 2 → source fix → the cap closes
the phase with that second fix unreviewed. §7.4 now carries the debt into a corrective phase. The
Medium closed the last route by which a known defect could close with its step — an **actionable**
item naming a source correctness defect is a blocker, not something a later phase may adopt. The three
Lows were the off-by-one about 2d-4a-C step 2 (corrected below and in `CLAUDE.md`), two sentences that
blamed the new source-bounded rule for tails its **unbounded predecessor** ran, and the provenance
sentence below. That review was the second and last of this phase, so this fix round is not reviewed
again.

**Round 1's second High is confirmed closed by an independent reader.** Round 2 found **no closed-list
ambiguity**: every manifest, config, script and lockfile round 1 named is now source, both tracked
`README*` files are prose, and every tracked file under `docs/` is markdown.

**The outer bound.** `~/.claude/scripts/goahead-base.md` caps a phase at two review invocations and
45 minutes, and says that cap outranks every project convention. §7.4 states that these project
rules are the **inner** bound: under a `goahead` run the workflow's cap binds first and is tighter,
and nothing in §7 authorises a third invocation. The conflict is one-way — §7 only ever subtracts
rounds — so it needs no ruling. **What the cap does not do is cancel a review §7.1 owed.** When it
closes a phase with a source fix still unreviewed, §7.4 now says what the workflow already said: the
remaining work becomes a **new corrective phase**, with its own acceptance criteria, its own commit
and its own mandatory review, and the original phase is recorded as **superseded by it, never as
complete**. That corrective phase's review is what discharges §7.1; the debt is carried, not written
off.

**Files changed.**

- `CLAUDE.md` — the "a fix is a change" paragraph in §6 is bounded to source and points at §7; new
  **§7** carries the single generator, the closed-list definition of the record, the "where it is
  thin" marks and the `goahead` precedence. Round 2's fix then narrowed §7.2's termination claim to
  what is true, named the two shapes the table does not list, made an **actionable** source
  correctness defect a blocker in §7.3, and gave §7.4 the carried-review-debt paragraph.
- `PROGRESS.md` — the standing-rules bullet that said a tail *"ends by an **owner ruling**, never by
  a session's judgement"* now states the generator, the closed list, and cites 2d-3-C and 2d-4a-C as
  the evidence **for** the rule rather than as precedents for owner rulings.
- This file — its content originated as an untracked working-tree brief at
  `docs/goahead-review-tail-issue.md`, which was never committed. **Git records no rename, and cannot
  support one**: nothing was ever tracked to rename, so all the repository shows is this file, new and
  untracked, and no tracked deletion anywhere. That is the whole checkable claim; there is no move in
  the history to point at.

**What the rule would have done to the measured tails.** **2d-4a-C step 2 ends after round 4 instead
of running to 9**: round 3's fix was the last of that tail to touch a source file, so it commissioned
round 4, and round 4's fix changed no source file at all (`2d-4a-C-notes.md` §20.8 — *"One file. No
source file changed"*), so **round 5 was never commissioned**. Four rounds, not nine. 2d-3 is not a
second measurement of the same kind — what is recorded of its
round 14 is that it changed zero *non-comment* lines under `src-tauri/src/`, and a comment-only
change to a source file is a source change under §7, whose unit is the file and not the line.

**Item 4 of "What to change" below — splitting the checkpoint — was already done before this fix.**
`PROGRESS.md` is the live head and closed-phase narrative lives in `docs/progress-archive/`, so the
~1.99 MB / 21,803-line figure in "A second, compounding problem" is historical.

**How to tell whether it worked.** The test is unchanged and is at the foot of this file: a fresh
reader, holding a round's verdict and the previous round's diff, can answer *does another round run
— yes or no?* from the `.md` files alone. §7.2's table of five verdict shapes, plus the two shapes
named under it — a fix that changes source *and* the record, and a fix that reverts an earlier source
change — is where that answer now lives.

**One observation from the rule's own first application.** This fix round, the one that answers round
2, changed `CLAUDE.md`, `PROGRESS.md` and this file and nothing else. All three are the record, so
**no source file changed and §7.1 commissions nothing**: the tail ends here by the rule, at exactly
the point the workflow's two-invocation cap ends it as well. The two bounds agree on this case, which
is worth recording as the observation it is — and not as proof the rule is right. A conventions change
is the easiest case a source-bounded rule can meet; the shapes that will test it are the ones where a
fix touches code.

---

**For a fresh session.** This is a brief, not a record. It describes a defect in **this project's
`.md` conventions** — not in the `goahead` command, which does exactly what the plan tells it — and
asks you to fix it in the `.md` files.

## Symptom

`/goahead-opus`, driven by `~/.claude/scripts/goahead-run.sh`, runs for hours on this repo and
produces no commit. On 2026-08-29 one driver ran **2h 01m on a single iteration** and committed
nothing; its last commit was **2h 22m** old when it was stopped. It was not wedged, not blocked, and
not waiting on anything. It was executing the plan exactly as written.

## Root cause: the plan tells it to loop forever

The rule is at **`CLAUDE.md:353`**:

> **A fix is a change, and the round that reviews it is not optional.**

`PROGRESS.md` restates it eleven times (`rg -ci "a fix is a change" PROGRESS.md`; the `-i` matters —
five of the eleven open a sentence and are missed without it). With three
supporting conventions it forms a closed loop that has no exit:

| # | Convention | Where | Effect |
|---|---|---|---|
| 1 | A fix is a change, so it is owed a review round | `CLAUDE.md:353` | every round commissions the next round |
| 2 | Each round ends with *"What this round does not close, and where it is thin"*, nominating its own likeliest failure sites | every `§N.n` in `docs/decisions/*-notes.md` | the next round starts with a pre-written work list |
| 3 | A reviewer's incidental attribution is a claim like any other | `PROGRESS.md` | prose about prose becomes reviewable subject matter |
| 4 | Nothing closes a step except a `READY` verdict or an owner decision | `PROGRESS.md` | there is no measured stopping rule |

**Rule 1 does not distinguish a source fix from a prose fix.** Once the code is clean, each round
edits only the record — and that edit is itself "a change", owed a round. The subject silently
becomes the record's own sentences about its own sentences.

## Was the problem that the workers could not get an answer from a human?

**No, and this matters for the fix.** Nothing was ever blocked waiting on the owner:

- The one open owner decision (the §18–§20 record-structure question) was explicitly marked
  *"Round 9 may proceed without this decision; it is not a blocker."* Round 9 ran without it.
- **Continuing never required a human — only stopping did.** Every round was locally justified by
  rule 1, so "run another round" was always the correct next action under the plan. The loop never
  reached a state it could recognise as *done*, so it never had a reason to raise its hand.
- Round 8's reviewer **was** invited to recommend on the open question **and gave none**, then the
  tail continued. Even a direct invitation to help the owner decide did not produce an escalation.

So the fix is not a better channel for asking the owner. It is a **stopping rule the files can
evaluate on their own**.

## The measured evidence

Both completed tails ended by **owner decision**, never by the rules:

| Phase | Rounds | How it ended | What the late rounds changed under `src-tauri/src/` |
|---|---|---|---|
| **2d-3** | **14** | owner decision, 2026-08-26 | round 14: **zero** non-comment lines |
| **2d-4a-C step 2** | **9** | owner decision, 2026-08-29 | rounds 4–9: **no source file at all** |

`PROGRESS.md`'s own words before the close: *"Eight consecutive rounds have now found their entire
finding list in the previous fix round's own words."* Round 9 made it nine, returning **0 High, 0
Medium, 4 Low** — all four prose overclaims — with the reviewer recording that *"the Rust machinery
and inventories remain cleared."*

## A second, compounding problem: checkpoint size

`PROGRESS.md` is **~1.99 MB / 21,803 lines**. Every `goahead` iteration is a fresh process that
resumes from it, so each restart re-reads the whole file before doing anything. The tail grows the
file, and the bigger file makes every later iteration more expensive.

## What to change

Fix this in the `.md` files. Refine the shape as you see fit, but the result must be **checkable
without an owner ruling**:

1. **Bound rule 1 to source changes.** At `CLAUDE.md:353`, state that a fix round which changes no
   file under `src/`, `src-tauri/src/` or `crates/` does **not** commission a new review round. A
   prose-only fix is recorded, not reviewed.
2. **Give every review tail a stated termination condition**, in `CLAUDE.md` and in `PROGRESS.md`'s
   standing rules. One that matches what both tails actually showed: **a step closes when a round
   returns 0 High and 0 Medium, or after two consecutive rounds whose findings change no source
   file.** Closing then becomes the rule's outcome rather than a decision the owner must make.
3. **Stop "where it is thin" from being an automatic work list.** Keep the section — it is genuinely
   valuable — but require each item to be marked **actionable** or **recorded only**, and say that
   only *actionable* items can commission a round.
4. **Split the checkpoint.** Keep `PROGRESS.md` to the live head — current phase, next action,
   standing rules, phase table — and move closed-phase narrative into `docs/progress-archive/`. A
   fresh iteration should resume from something small.

## What has already been done — do not redo it

On **2026-08-29** the owner closed 2d-4a-C at round 9 and answered the record-structure question.
Already in the working tree (**uncommitted**; three files, no source modified):

- **`PROGRESS.md`** — phase closed; *"there is no round 10"* recorded with its ground; next action is
  2d-4a review round 7, then 2d-4b; the 2d-4a-C-2 phase-table row flipped to ✅.
- **`docs/decisions/2d-4a-C-notes.md`** — round 9's fix round (§25), plus **§26** and **Appendix A**:
  §14 item 5's three amendment blocks and §17.2's two moved verbatim into the appendix, with one
  current-claim block left in the body for each. §18.6 and §19.7 were deliberately **not** moved;
  §26.1 gives the reason.
- **`docs/reviews/phase-2d-4a-C.md`** — round 9's verdict.

**Do not run a step-2 round 10, and do not reopen the tail to "review" the closure.**

## How to check that your fix works

The fix is good when a fresh reader can answer this from the `.md` files alone, without asking the
owner:

> **Given this round's verdict, does another round run — yes or no?**

Today that question has no answer in the files. That is why both tails needed a human to stop them.
