# Phase 2d-5-3-M — the round §7.1 commissioned for 2d-5-3-L's fix

**Round 13 of the `reconciliationCoordinator.ts` review tail**, and the thirteenth consecutive round
commissioned by its predecessor's fix. Scoped to 2d-5-3-L's comment-only source diff (`c39831f`,
11 insertions and 9 deletions in one file), to `docs/decisions/2d-5-3-L-notes.md` in full, to the two
correction blocks that round wrote into `docs/decisions/2d-5-3-K-notes.md` and to the block it amended
in place inside `docs/decisions/2d-5-3-J-notes.md`.

Review: [`docs/reviews/phase-2d-5-3-M.md`](../reviews/phase-2d-5-3-M.md), written by **Codex** from the
brief at [`docs/reviews/phase-2d-5-3-M.brief.md`](../reviews/phase-2d-5-3-M.brief.md). Verdict
**`ship-with-fixes`, 0 blockers**, **2 SHOULD-FIX** — one Medium in source, one Low in the record.
**Both were re-derived against the code by the orchestrator before any fix was applied, and both
hold.** **This round found a real defect in what 2d-5-3-L's fix wrote** — which is the claim this
round can make about itself, and it asserts nothing about the tail's other rounds.
*(2d-5-3-N: this read "**Twelve of the thirteen rounds `2d-5-3-A` … `2d-5-3-M` have found a real
defect in the previous round's fix**; the denominator is the letter sequence, and the one exception is
still 2d-5-3-F." **The tally is dropped rather than renumbered.** It is false as written:
`2d-5-3-F-notes.md`'s own header says of its three findings "**one is**" in the previous round's fix,
and its §2 shows why — 2d-5-3-E carried a stale paragraph count into its own §8 item 3 and **E's own
fix added the sixth paragraph** that falsified it. So F is no exception to the predicate the sentence
states. Renumbering it to thirteen would assert an audit of thirteen rounds that no round of this tail
has performed, which is the inherited-figure failure `PROGRESS.md`'s header names; the sentence above
claims only what this round re-derived.)*

---

## 1. What was in scope, and two things about how the round was run

Scope is 2d-5-3-L's fix and nothing else — the two passages it rewrote at
`reconciliationCoordinator.ts:789-800`, the L notes in full, and the three record blocks it wrote or
amended in the K and J notes. The inherited tree is `ed00fb3`, which carries only `PROGRESS.md` and
`PROGRESS.json` over the `c39831f` the fix landed in.

### 1.1 The reviewer was Codex, and the script's own exit decided that

`autoclaude-review.sh` was run first, per the workflow's *Codex first, the agent as fallback, never
both*, and it **exited 0** with `ship-with-fixes — 2 finding(s), 0 blocker(s)`, so the review file is
Codex's and no agent was spawned. 2d-5-3-L is the round that ran the agent, because there the script
did not answer; the two rounds are therefore reviewed by **two different providers**, which is worth
having on a tail this long.

### 1.2 The report's finding detail is truncated in the file, and every finding was re-derived from the code

The script renders each finding's body to a fixed width and ends it with an ellipsis: the Medium's
reasoning stops at *"This universal fails under an injected reporter that synchronously…"*, and the
Low's at *"Counting it() declarations in the specified range on 26f…"*. The script removes its private
state root on success, so the unabridged envelope does not survive the run. **Neither finding was
accepted on the strength of the report**: both are re-derived below from the code and the test files,
and both were found to hold on their own evidence. The truncation is recorded as a host fact — not as
a criticism of the review, whose two headline sentences and two fix instructions came through intact
and were enough to locate the claim.

---

## 2. Finding 1 (SHOULD-FIX, Medium, in source) — the replacement parenthesis was a universal the code does not give

`reconciliationCoordinator.ts:799-800` as 2d-5-3-L left it: *"a superseded open returns at a
generation check and never reaches `workspaceReady()`"*.

**Re-derived against `open()` in `src/lib/browser/workspace.svelte.ts`.** The sentence this replaced —
K's *"(the superseded one returns before it)"* — predicated the return of **the** superseded open in
one named test. L's rewrite predicates it of **a** superseded open, which reads as a claim about the
mechanism, and as a claim about the mechanism it is false:

- `open()` holds three generation checks (`2604`, `2625`, `2661`), and the third is **inside** the
  per-document loop, after that document's `await`. Between the loop's end and
  `reconciliation.workspaceReady()` at `2687` there is no generation check and **no await at all**.
- `report` is an injected parameter of `createBrowserState` (`1715`, defaulting to
  `reportIpcFailure`) and is called **inside** that loop, at `2672`, for a document the host refused.
- So a host whose `report` synchronously re-enters `open()` on the **last** refused document bumps
  `openGeneration` after the running open's final check. That open is now superseded, the loop then
  ends, and it runs `status = 'ready'` and `workspaceReady()` — a superseded open reaching
  `workspaceReady()`. Nothing about that route is exotic: `open()` is the only writer of
  `openGeneration` (`2554`), and a synchronous callback is the only way to bump it where no check
  follows.

**And the sited half needed reading too.** `PROGRESS.md`'s handoff asked which check the losing open
of the cited test actually hits. In `workspace.test.ts:1229` *"lets the newer open win, however late
the older one answers"*, `openWorkspace` is scripted to hand the first call an unresolved deferred and
the second an immediate success; the second `open()` therefore completes while the first is parked on
`await commands.openWorkspace(root)`, and when `first.resolve(...)` finally runs the first open
resumes **at the generation check directly under that await** (`2604`) and returns there. It is the
first of the three, and it is the only one it can reach.

**Fixed in source**, scoped to the test and to that check: *"the open this test supersedes returns at
the generation check directly under its own `openWorkspace` await, so it never reaches
`workspaceReady()`"*. **Nothing wider is asserted, in either direction** — the comment does not now
claim that some superseded open *can* reach `workspaceReady()` either, because the paragraph does not
need it and an unasserted universal cannot go stale (2d-5-3-E's shape, which was a false *absence*
written to replace a false *coverage* claim). **Fixed in the record** by a correction block in
`2d-5-3-L-notes.md` §3, which is where that round wrote its replacement account.

**Why the earlier rounds did not catch it.** K's text was definite and scoped; L's was indefinite and
therefore wider, and it was written as a *tightening*. The second half of the same sentence — the
two-statement body of `workspaceReady()` — was the finding L was answering, and it is correct; the
parenthesis rewritten beside it was collateral. **A removal has to check what else the removed clause
was carrying** is 2d-5-3-H's rule; this is its mirror — a replacement has to check what the
replacement newly carries.

---

## 3. Finding 2 (SHOULD-FIX, Low, in the record) — the lifecycle suite holds ten tests, not eleven

`2d-5-3-L-notes.md` §4 claimed *"among the eleven `the reconciliation lifecycle` tests at
`workspace.test.ts:7535-7790`"*, and §7 item 3 repeated *"the eleven lifecycle tests at
`workspace.test.ts:7535-7790`"*.

**Re-derived by counting.** `describe('the reconciliation lifecycle', …)` opens at
`workspace.test.ts:7535` and closes at **7779** (`}); // End of the "reconciliation lifecycle"
suite`), and it holds **ten** `it(` blocks — 7536, 7549, 7566, 7591, 7628, 7650, 7677, 7698, 7732 and
7758. So **two** numbers in that citation were wrong, not one: the count was one too many, and the
end line lay eleven lines past the block. The review named the count; the end line came out of the
orchestrator's re-derivation of it.

**Fixed in both passages: the range is dropped and the count is corrected to ten.**
*(2d-5-3-N: this read "**both numbers are dropped rather than renumbered**", which is false of the
replacement quoted in the same sentence — **one** number was dropped, the range, and the other was
renumbered from eleven to **ten**. 2d-5-3-K's precedent covers the anchor that drifts, which is the
range; it never covered the count, and the sentence after this one says why the count stays.)* The
sentence now reads *"among the **ten** tests of `workspace.test.ts`'s `the reconciliation lifecycle`
suite"*, with the correction marked in place. The
`describe` title is what names the block and cannot drift; the count is the claim a reader checks.
**The bounded absence claim itself survives the correction** — no test in that suite drives an open
during an in-flight drain, whether it holds ten or eleven — so nothing in source depended on the
figure. `docs/reviews/phase-2d-5-3-L.md:45` carries the same range and is **left as written**: a
review report is the record of what a reviewer said, and the chain corrects notes rather than
rewriting reviews.

---

## 4. What was checked and found sound

- **`workspaceReady()`'s body is exactly two statements, in the stated order** —
  `openInProgress = false;` then `requestDrain('workspaceOpened');` (`1168-1174`), with the function's
  own comment saying the gate opens first *"so the request below is the flush"*. That was L's finding 2
  and it stands.
- **"Of the two tests cited here" cites exactly two.** The paragraph (`787-812`) names
  `./workspace.test.ts`'s *"lets the newer open win, however late the older one answers"* and
  `./reconciliationCoordinator.test.ts`'s *"installs nothing from a drain an open overtook"*, and no
  third. The next paragraph's `watch_check.rs` and `workspace.test.ts` citations are outside the
  *"here"*, which is what a reader of the sentence has to accept and can now check.
- **The two-witness attribution is right way round.**
  `reconciliationCoordinator.test.ts:749` starts a drain, asserts one is outstanding, then does
  `control.generation += 1; coordinator.workspaceOpened();` before answering it — an open landing
  while a drain is in flight, on `controlledHost()`, the **injected** host, with the outcome asserted
  as `staleOpen`. `workspace.test.ts:1229` overlaps two `open()` calls and issues no drain at all.
  So one drives that overlap and the other does not, exactly as L wrote it.
- **The surviving K-era propositions.** `createBrowserState` constructs the coordinator
  unconditionally; every `open()` calls `reconciliation.workspaceOpened()` at `2569`, synchronously,
  before its first await; `openGeneration` is written in one place only (`2554`); the cited test never
  calls `start()`, so `drainMayStart()` is false and the request is remembered rather than issued.
  Spot-checked rather than inherited, because a false *"holds"* is worse than a missed finding.
- **The instrument's pin held at `5 insertions(+), 1 deletion(-)`** over
  `src-tauri/src/main.rs` and `src/main.ts`, checked on the inherited tree and again after the fix.
- **The fix is comment-only, proven mechanically** — `git diff -U0` filtered to changed lines that are
  neither comment lines nor blank returns nothing — and **no line in the edited file exceeds 90
  characters** (`awk`).

---

## 5. Verification

**Two complete runs, one on the inherited tree and one after the fix, and both green at
`1320 / 441 / 2307 / 188`.** The two-reading convention is restored: 2d-5-3-L had one run only,
because the inherited-tree attempt died twice on a stale `target/` from the repository's previous
location. **That host finding did not recur** — the full `cargo clean` and rebuild L took is holding,
which is what §5 of its notes predicted a later round would meet.

Both runs were taken by **one sequential script** with each command redirected to its own file, so no
cargo status was read through a pipe and nothing ran concurrently with anything (the `watch_check`
scar's three consequences). `cargo test --workspace -- --test-threads=1` → **1320 passed** summed over
**26** `test result` lines, **and** the complementary question asked: **no line lacking `0 failed`**,
exit 0 both times. `cargo clippy --workspace --all-targets -- -D warnings` exit 0;
`cargo fmt --check` exit 0; `cargo tree -p espansoconfig-core | rg tauri` finds nothing.
`npm run check` → **441 files, 0 errors, 0 warnings**; `npm test` → **60 files, 2307 passed**;
`npm run build` → **188 modules**. **Both bundle oracles were read and both lines are reported**:
server-only markers (`$$payload|head_payload|push_element`) **absent**, client-only markers
(`window.__svelte|svelte-trusted-html`) **present (2)**.

**Nothing moved, and nothing could have.** The source diff is comment-only in one file — 2 insertions,
1 deletion — so no file entered or left the program, no new reachable module, no new component and no
new case. **This is the thirteenth consecutive ladder rung that repeats**, and a rung that repeats
proves the gates were run, never that they could see what these rounds keep finding. **No gate reads
prose**: both of this round's findings were invisible to all four, and the Medium was invisible to two
reviewers before this one.

---

## 6. Where it is thin

Marks per `CLAUDE.md` §7.3. **No item names an unfixed correctness defect in a source file**, so
nothing here holds the step open.

1. **recorded only.** The new sentence's *"the generation check directly under its own `openWorkspace`
   await"* identifies the check by position rather than by line, which is drift-proof, but it is still
   prose about a test this file does not own. Move the deferred-promise scripting out of
   `workspace.test.ts:1229` and the sentence becomes false with every gate green.
2. **recorded only.** The counterexample §2 gives — an injected `report` re-entering `open()` on the
   last refused document — is **reasoned from the code, not executed**: nothing in this repository
   drives it, and the fix deliberately does not assert it in the comment. If a later phase wants the
   general property, it needs a test, not a sentence.
3. **actionable**, and a later phase may adopt it: nothing in this repository resolves a `file:line`
   citation in a comment or a record. This round found **two** wrong numbers in one citation of one
   notes file — dropping the range and correcting the count to ten *(2d-5-3-N: this read "and dropped
   both", the same false claim §3 carried)*; the candidate corrective phase under *Next action* in
   `PROGRESS.md` is unchanged, and this round added no citation to source.
4. **recorded only.** The review's finding bodies reach the review file **truncated** (§1.2), and the
   script deletes the envelope that held them in full. A later round that needs a reviewer's full
   reasoning cannot recover it after the fact; re-derivation from the code is the only route, and it
   is the route this round took.
5. **recorded only.** §4's *"cites exactly two"* check is a count over a paragraph whose boundaries are
   blank comment lines. A later round that splits that paragraph, or adds a third citation inside it,
   falsifies the sentence at `790` without touching it.
6. **recorded only.** The count fixed in §3 was in the *record*, and the same figure sits uncorrected
   in `docs/reviews/phase-2d-5-3-L.md:45` by policy. A reader who checks the review rather than the
   notes will meet the wrong range there, which is the cost of not rewriting reviews.
