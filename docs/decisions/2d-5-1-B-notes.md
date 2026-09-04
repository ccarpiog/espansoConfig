# Phase 2d-5-1-B — the round Phase 2d-5-1-A's three comment corrections commissioned

**Date:** 2026-09-04
**Risk class:** routine · **Worker model:** opus (the reviewer; there was no phase worker)
**Review:** [`docs/reviews/phase-2d-5-1-B.md`](../reviews/phase-2d-5-1-B.md) — verdict **ship**,
**0 blockers**, **0 should-fix**, 1 Low
**Gates:** `1320 / 436 / 2205 / 185`, every one unmoved from the baseline
**What it commissions:** **Phase 2d-5-1-C.** This phase's fix changed
`src/lib/browser/restore.ts`, which is a source file, so `CLAUDE.md` §7.1 owes it a round and this
phase's one review invocation is spent (§7.4).

---

## 1. What this phase was

**One adversarial review round and nothing else.** There was no feature, no worker and no new
capability. Phase 2d-5-1-A's own review returned three should-fix findings, every one a **false
claim in a comment**; the orchestrator fixed all three inside that phase, and those corrections
changed two source files. `CLAUDE.md` §7.1 owes a fix like that a review round, **the unit being
the file and not the line**, and a comment-only change to a source file counts deliberately — so
that nobody has to argue about which comment was load-bearing, which matters here because several
of this project's contracts live in comments.

The reviewed diff was the fix-round half of commit `1ff4f34`:

1. `src/lib/browser/restore.test.ts:528-534` — the `closedByReplacementOf` docblock, rewritten to
   say the `invalidateEverySurface` rule is **unpinned on both sides** rather than pinned by the
   mounted `DetailPane.test.ts` suite.
2. `src/lib/browser/restore.ts:583` — `targetingSurfaceFor`'s docblock fallback sentence, given
   back the `creatorEligible` gate it had dropped.
3. `src/lib/browser/restore.ts:588` — *"the six named kinds"* corrected to **seven**.

That commit's *other* half — the `targetingSurfaceFor` preference change and the
`closedByReplacementOf` recorder — was reviewed at 2d-5-1-A and was explicitly out of scope. The
brief said so, and said which recorded item (`invalidateEverySurface`'s missing coverage, which
2d-5-2 inherits) not to spend budget re-reporting.

## 2. The round's result: all three corrections are true

**This is the round's principal result and it is a real one, not an empty one.** The reviewer
re-derived each correction from source rather than from the notes, and reported the derivation
rather than the conclusion:

- **`invalidateEverySurface` is reached by no case in `DetailPane.test.ts`.** Traced: its only
  call site is the `invalidate` prop at `DetailPane.svelte:972`, consumed once by
  `RestorePane.svelte:515` inside the send path, and that suite's two restore cases stop at
  `browser.restore.listBatches` without sending. **Then checked empirically**, in a scratch copy
  of `src/` outside the repository: with `creating = false` deleted from `DetailPane.svelte:562`
  the full vitest run was byte-identical to the unmodified control. So *"breaks nothing"* holds
  repository-wide, not merely for that one suite — a stronger result than the comment claims.
- **Seven and six.** `OpenWriteSurfaceKind` (`restore.ts:340-354`) has seven members;
  `CompetingWriteSurfaceKind` is `Exclude<…, 'restore'>` and has six. Counted in the file.
- **The fallback sentence**, the array-order claim, the *no yes/no answer changes* claim and the
  unchanged-null-set claim are all true of the shipped function.
- **The `DetailPane.svelte` line citations** in the `closedByReplacementOf` docblock —
  `:525-527`, `:529-535`, and *"five identity comparisons"* — were re-derived and are exact. That
  check was asked for by name because stale line citations cost this project an eight-round tail.

## 3. The one Low, re-derived rather than accepted

**`restore.ts:609-610` claimed `unnamedCreator` *"is read only after the whole list has failed to
produce an exact match"*. It is read inside the loop**, as the second operand of
`eligibility === 'creatorEligible' && unnamedCreator === null`. The orchestrator re-derived this
before accepting it — the standing rule is to check the code, never the reviewer's word — and it
is correct. Behaviour is unaffected and the intended sense is recoverable, which is why it is a
Low; but it is a false sentence in a comment, and that is this project's named worst defect class
whatever its severity.

**Those two line numbers, and every other one in the round's report, are against the pre-fix file.**
The fix below is seven lines longer than what it replaced, so it moved everything under it. The
post-fix numbers are in §3.2, and they were re-derived on the edited file rather than adjusted by
arithmetic.

### 3.1 The sweep found a second defect in the same comment, and it is the recurrence pattern

`CLAUDE.md` says to **sweep for what the type now says, not for the words the finding used**,
because a fix that closes a finding everywhere but one narrower instance is this project's most
repeated failure. Sweeping `restore.ts` for descriptions of the fallback turned up that the same
inline comment opened *"The first destination-less creator the list holds"* — **with no
`creatorEligible` gate**. That is the identical omission correction 2 had just repaired in the
docblock four lines above, standing in the inline comment underneath it, unreported by the round.

The sentence is false whenever `eligibility` is not `creatorEligible`: nothing is kept in that
variable at all, and no such creator is ever the answer.

The sweep covered the rest of the repository too (`rg` over `destination-less`, `unnamedCreator`,
*"creator the list holds"*, outside `docs/` and `PROGRESS.md`). The only other hit,
`restore.test.ts:887`, is about `competingSurfaceFor` and is accurate. **Two instances, both in
one comment, both fixed.**

### 3.2 What shipped

One comment, at `restore.ts:608-617`. It now states the gate, states what happens when the gate
does not hold, and separates the **two reads** that the old sentence had collapsed into one:

- the read **inside the loop** is the first-wins guard, keeping a later destination-less creator
  from displacing an earlier one;
- the read **at the return** is the preference, and only that one waits for the whole list — an
  exact match returns from inside the loop and never reaches it.

**Re-derived on the file that now carries them**, after the edit rather than before it: the comment
is `:608-617`, the loop read is `:623`, the exact-match return is `:629` and `return unnamedCreator`
is `:638`. Before the edit those last three were `:616`, `:622` and `:631`.

Every clause was checked against the function before it was written. The phrasing deliberately
avoids claiming *how often* either read happens: the loop read is guarded by `&&`, so it does not
run at all when `eligibility` is not `creatorEligible`, and a "once per surface" sentence would
have been a third false claim in the position of the two being fixed.

## 4. The four gates, measured

Run by the orchestrator, on the tree carrying the fix, each command on its own. **Every figure is
unchanged from the baseline**, which is what a comment-only change predicts — and the point of
measuring is that it is a measurement rather than the prediction.

| Gate | Command | Result |
|---|---|---|
| Rust tests | `cargo test --workspace` | **1320** passed across **26** binaries, every one `0 failed`, exit 0 |
| Type check | `npm run check` | **436** files, **0 errors, 0 warnings** |
| Frontend tests | `npm test` | **58** files, **2205** passed |
| Production build | `npm run build` | **185** modules transformed |
| Lint | `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| Format | `cargo fmt --check` | clean |
| Architecture (D2x) | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |

**Both bundle oracles were read, and both lines are reported**, because the second exists to prove
the search can match at all: server-only markers (`$$payload|head_payload|push_element`)
**absent**; client-only markers (`window.__svelte|svelte-trusted-html`) **present, 2 matches**.

**The Rust half was proven untouched before it was re-run**, not instead of being re-run:
`git diff --stat HEAD -- crates/ src-tauri/` is empty, and `cargo test --workspace` then ran
anyway, alone. Running it alone is not a formality — two overlapping runs of it in this repository
make two `watch_check` cases fail spuriously, and **no conclusion about source may be drawn from a
concurrent run**.

## 5. One correction to the review report itself

**`docs/reviews/phase-2d-5-1-B.md` item 4 cites `restore.ts:625` for the exact-match return. On the
file that round read, that return was at `:622`; `:625` was the `default:` arm.** Re-derived from
the file. The report's neighbouring citation, `:631` for `return unnamedCreator`, was correct on
that same file — and was the one the orchestrator initially misread, which is why both were counted
in the file rather than argued about.

Both are now stale in the ordinary way as well, because this phase's own fix moved them (§3.2). The
finding is not that they went stale — that is what line citations do — but that `:625` was **wrong
when it was written**, three lines below the statement it named.

This correction is to a file under `docs/`, which is on §7's closed list, so **it commissions
nothing**. It is recorded because a wrong line number in a review report is exactly what the next
round would inherit and re-derive at its own cost.

## 6. What this phase commissions, and why the tail has not ended

**Phase 2d-5-1-C is owed.** §7.1 has exactly one mechanism: a fix round that changed at least one
source file. This phase's fix changed `src/lib/browser/restore.ts`. So a round is commissioned,
scoped to that one comment, and it runs in a corrective phase because `/autoclaude` caps a phase
at one review invocation and this phase spent its own on round B (§7.4).

**This is the rule working, not the rule failing.** The round it commissions is not a formality:
the fix under review is a comment that replaces a false sentence with four new claims about a
function's control flow, written by the same session that just found two false claims in the
sentence it replaces. That is precisely the shape §7.1 exists to catch — three of 2c-3a-1's ten
findings were regressions introduced by a previous round's fix.

**The tail can still end at C**, and the shape it would end in is on file twice: `811d180`
(2d-4a-H) and `21cbef8` (2d-4b-H) are the only two commits in this project's history whose review
round produced a fix touching no source file, and each ended its tail by rule with nobody deciding
anything. If round C finds nothing in source, C's fix touches no source file and §7.1 commissions
nothing.

**What would make this a signal about the work rather than about the rule** is a tail in which each
fix keeps introducing a real source defect. It is not there yet: round B found **0 blockers and 0
should-fix**, and its single Low was a recoverable sentence with no behavioural consequence. But
the tail is now four phases long (2d-5-1 → A → B → C) over a step whose subject is two files, and
**if round C returns another source-changing finding in the same comment, that is the point to hold
the step open and mark it `BLOCKED` under §7.2 rather than spell it "one more round"** — naming the
comment as the defect that keeps coming back.

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here is a correctness defect in a source file**, so none is
a blocker and none holds this step open. No item commissions a round; §7.1 reads a diff and is the
only mechanism.

1. **recorded only** — **Nothing in this repository checks a comment.** The whole subject of this
   phase is comment text, and no test, type or lint fails when any of it goes false. That is a
   permanent property, restated here because it is the reason this tail exists and the reason its
   rounds are the only instrument that has ever caught one of these.
2. **recorded only** — **The new comment at `restore.ts:608-617` makes four claims about control
   flow and is pinned by nothing.** `targetingSurfaceFor`'s behaviour is pinned by cases in
   `restore.test.ts`; the *description* of it is not, and a later change to the function leaves the
   comment silently stale in the ordinary way. Stated in the same breath as what the round did
   force: every clause was derived from the shipped function before it was written.
3. **recorded only** — **The empirical `creating = false` deletion result is a snapshot.** It was
   taken in a scratch copy outside the repository, on today's tree, and it is what makes *"breaks
   nothing"* true repository-wide rather than only for one suite. It stops being evidence the
   moment 2d-5-2 adds the coverage it inherits — which is the outcome to want, not a risk.
4. **actionable, not a blocker** — **`invalidateEverySurface` (`DetailPane.svelte:545-563`) is
   reached by no test.** Unchanged from 2d-5-1-A, where it was recorded; this round confirmed it
   independently and more strongly. It is a **coverage gap and not a correctness defect** — the
   function is correct as written — so §7.3 does not hold a step open for it. **2d-5-2 owns it**,
   because that step already owns `DetailPane` and already owes it mounted evidence.
5. **recorded only** — **The review report's `:625` citation is wrong** (§5 above). Corrected here
   rather than in the report, because a review report is a record of what a round found and is not
   edited after the fact.
