# Phase 2d-5-1-C — the round that ended the 2d-5-1 tail by rule

**Date:** 2026-09-04
**Risk class:** routine · **Worker model:** opus (the reviewer; there was no phase worker)
**Review:** [`docs/reviews/phase-2d-5-1-C.md`](../reviews/phase-2d-5-1-C.md) — verdict **ship**,
**0 blockers, 0 should-fix, 0 Low**
**Gates:** `1320 / 436 / 2205 / 185`, unchanged — no file outside `docs/` was touched by this phase
**What it commissions:** **nothing.** This phase's fix round changed **no source file**, so
`CLAUDE.md` §7.1 commissions no round and §7.2 closes the step. **Phase 2d-5-1 and its whole
corrective tail — 2d-5-1 → A → B → C — are CLOSED.**

---

## 1. What this phase was

**One adversarial review round, scoped to one comment in one file.** Phase 2d-5-1-B's round
returned 0 blockers and 0 should-fix with a single Low — a false sentence in the inline comment
that 2d-5-1-A's *source* fix had brought with it. The orchestrator fixed it, together with a second
defect its own sweep found in the same comment, and that fix changed `src/lib/browser/restore.ts`.
§7.1 owes a source-changing fix a round whatever its size, because the unit is the file.

The reviewed hunk was `restore.ts:608-617` in commit `1d623dc` — `-3/+10`, every changed line a
`//` comment. The round confirmed the scope itself before reading anything: of that commit's four
files, three are on §7's closed record list.

## 2. The result: all four claims true, each derived independently

The round did not check the comment against this project's notes. It derived each claim from the
code, and several of its derivations are **stronger than the ones that produced the comment**:

1. **Gated on `creatorEligible`.** Four sites hold `unnamedCreator`; the only non-initialiser write
   is `:624`, whose sole guard is the `if` at `:623` opening `eligibility === 'creatorEligible' &&`.
   Everything the variable ever holds passed that gate.
2. **Gate false ⇒ nothing kept, answer `null`.** `CreatorEligibility` (`:513`) has exactly two
   members, so *"anything else"* is `notCreatorEligible`; `:623` is then always false, `:624` is
   unreachable, and `:638` returns the `null` from `:618`. **Independent of how many `unknown`
   targets the list holds**, because the loop has no other write — which is the clause the comment
   makes and the reason it is worth making.
3. **`:623` is a first-wins guard.** `surface.kind` is a string-literal union (`:340-353`) and so
   never nullish, so after one assignment the second conjunct is false for every later `unknown`
   surface. The non-nullishness is the step the comment's author did not write down.
4. **`:638` is the deferred read.** `:629` returns from inside the loop; `:638` runs only on loop
   completion. The round also checked what the comment does **not** claim — it never says `:629` is
   the *only* in-loop return, so the `never` terminus at `:634` does not contradict it.

**Frequency.** The round searched `608-617` for *once*, *each*, *every* and *per* and found none.
The one count phrase — *"however many such creators the list holds"* — counts list members, not
executions. This was checked because a frequency claim is exactly what would have been false: the
loop read sits behind `&&` and does not execute at all when the gate fails.

**"Two reads, two rules" is exact.** `:623` and `:638` are the only syntactic reads; `:618` and
`:624` are writes.

**The noun was verified rather than assumed.** `OpenWriteSurface` (`:423-435`) gives every
non-`matchCreator` arm a `WriteSurfaceDocumentTarget`, so `target.kind === 'unknown'` implies
`kind === 'matchCreator'`: *"destination-less creator"* is the right noun and not a loose one.

## 3. The one observation, and why it is recorded rather than fixed

**The first-wins guard is behaviourally inert today, and the comment does not claim otherwise.**
The round recorded this as *not a finding*, and the orchestrator re-derived it before agreeing:
because only the `matchCreator` arm of `OpenWriteSurface` carries a `WriteSurfaceTarget`
(`restore.ts:423-435`), every destination-less surface has kind `'matchCreator'`. So
`unnamedCreator` can only ever be assigned that one string, and deleting `&& unnamedCreator === null`
would change no value this function returns.

**The comment is still true.** It says the loop read *"keeps a later destination-less creator from
displacing an earlier one"* — a statement about the variable, which is exactly what the guard does.
It makes no claim about the answer differing.

So this is **not a correctness defect in source**, and `CLAUDE.md` §7.3 does not hold the step open
for it. Adding the inertness would make the comment more informative; it would also touch a source
file, commission a fourth corrective phase under §7.1, and correct nothing false. **That trade is
not worth taking, and naming it here is the alternative to taking it.** If a later phase gives a
second kind a `WriteSurfaceTarget`, the guard stops being inert on its own and this note is what
says so.

## 4. Verification

**No gate was re-run, and that is a deliberate statement rather than an omission.** This phase
changed no file outside `docs/`: its whole product is a review report and this record. The figures
that stand are 2d-5-1-B's, measured by the orchestrator on the tree this phase reviewed —
`1320 / 436 / 2205 / 185`, with clippy, fmt, the architecture check and both bundle oracles clean.
`PROGRESS.md`'s verification baseline carries them.

The round ran `npx vitest run src/lib/browser/restore.test.ts` itself (**221 passed**) and reported
the rest of the gate figures as **NOT-VERIFIED**, taken from its brief. That is the honest label:
it did not re-measure them, and `cargo test --workspace` is not safe to run concurrently in this
repository.

## 5. The tail ends here, by rule

**This is the third review tail this project has ended by rule rather than by an owner ruling**,
after 2d-4a's at round 13 (`811d180`) and 2d-4b's at round 8 (`21cbef8`).

§7.1 has exactly one mechanism: *a round is commissioned by a fix round that changed at least one
source file.* This round found nothing to fix. Its fix round therefore touches
`docs/reviews/phase-2d-5-1-C.md`, this file and `PROGRESS.md` — all three on §7's closed list — and
**changes no source file**. Nothing is commissioned, so §7.2 closes the step. Nobody decided this
and nobody had to; it is the same shape both earlier closures took.

**The chain's arithmetic, as the argument rather than a curiosity.** Four phases,
2d-5-1 → A → B → C. 2d-5-1's fix changed source and bought A; A's changed source and bought B; B's
changed source and bought C; C's changes none and buys nothing.

**Two things this closure does not mean.** It is a fact about the fix round's *diff*, never about
the round's thoroughness — so it discharges no coverage bound the tail was carrying, and the items
in §6 below survive it. And it does not make the closing round a formality: round C's four
derivations were checked, and the one claim in its report worth doubting — that the first-wins guard
is inert — was re-derived from the union declaration rather than accepted (§3).

**What was avoided.** `2d-5-1-B-notes.md` §6 said that if round C returned another source-changing
finding in this same comment, the step should be held open and marked `BLOCKED` under §7.2 rather
than spelled *"one more round"*. It did not, so that clause was not reached — but it was written
before the round ran, which is the point of writing it.

## 6. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here is a correctness defect in a source file**, so none is
a blocker and none holds this step open. No item commissions a round.

1. **recorded only** — **Nothing in this repository checks a comment**, and the entire 2d-5-1 tail
   after its first phase was about comment text. No test, type or lint fails when any of it goes
   false. A review round is the only instrument that has ever caught one of these, and the tail is
   now closed, so `restore.ts:608-617` is unpinned from here on in the ordinary way.
2. **recorded only** — **The first-wins guard is inert today** (§3). It becomes live the moment a
   second surface kind is given a `WriteSurfaceTarget`, which is a change 2d-5-2 could plausibly
   make when it assembles the live registry.
3. **actionable, not a blocker** — **`invalidateEverySurface` (`DetailPane.svelte:545-563`) is
   reached by no test.** Recorded at 2d-5-1-A, confirmed and strengthened at 2d-5-1-B, and it
   **survives this closure** because a closure is a fact about a diff and not a discharge of a
   coverage bound. It is a coverage gap and not a correctness defect. **2d-5-2 owns it** — that
   step already owns `DetailPane` and already owes it mounted evidence.
4. **recorded only** — **Five of `openWriteSurfaces()`'s six literals cannot execute**, in
   production or in any test, because that function has one caller inside a conditional arm. Stated
   at 2d-5-1 and unchanged by this tail; 2d-5-2's narrow window regression reading is the first
   reading of the new shape and inherits them.
