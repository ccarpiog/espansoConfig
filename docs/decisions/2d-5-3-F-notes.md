# Phase 2d-5-3-F — the round §7.1 commissioned for 2d-5-3-E's fix

**Risk class high; worker model `opus`.** No implementation worker: the phase's product is a review
and its fix, both taken by the orchestrator. Review:
[`docs/reviews/phase-2d-5-3-F.md`](../reviews/phase-2d-5-3-F.md). Verdict **`ship-with-fixes`, 0
blockers**, 0 Medium and 3 findings the reviewer graded SHOULD-FIX (one record defect, two Lows).
**All three were re-derived by the orchestrator against the code before any fix was applied**, all
three hold, and all three are fixed.

**Scope.** §7.1 commissioned this round for 2d-5-3-E's fix and for nothing else: the two rewritten
paragraphs in `src/lib/browser/reconciliationCoordinator.ts`, `docs/decisions/2d-5-3-E-notes.md` in
full, the correction blocks it added to `2d-5-3-D-notes.md` and `2d-5-3-C-notes.md` §1, the two marker
blocks in `next-action-history.md`, and `PROGRESS.md`'s header, status row, Next-action and baseline
updates.

**This is the fifth round of the tail and the first whose findings are not all in the previous round's
fix** — one is, one is a record-keeping defect, and one is an ambiguity 2d-5-3-E's fix inherited rather
than created. **The severity fell too**: three rounds of Mediums, then none.

---

## 1. The record defect — one file both closed and left open the same numbered item

`2d-5-3-E-notes.md` §3 wrote *"2d-5-3-D's thin item 4 is closed by measurement"* while describing the
**citation-anchor** item, which is 2d-5-3-D's §8 item **5**. Its item **4** is *"Phase 2d-5-3's
able-to-fail claims for seven of its eight cases … still unreproduced"*, marked *actionable* — and
2d-5-3-E's own §7 says in as many words that it cleared **none** of that residue.

So one file **closed and left open the same numbered item**, and the wrong number propagated to three
positions in `PROGRESS.md`. All four are corrected, and the two that are prose-in-place carry the
correction rather than a silent renumber, because *which* item a round discharged is exactly the sort
of claim a later phase inherits without re-checking.

**Why no gate could catch it and no reader was likely to.** Both items are real, both are in the same
section, and the sentence around the number is true of item 5. Only opening `2d-5-3-D-notes.md` §8 and
counting settles it — which is the same act the whole chain keeps proving necessary.

## 2. Low — the paragraph count was six, and it was repeated inside the warning against repeating it

2d-5-3-D's §8 asserted the three-state claim is *"asserted in five comment paragraphs and tested by
none"*. Its reviewer recorded the count as `NOT-VERIFIED`; 2d-5-3-E did not enumerate it either and
**carried the figure into its own §8 item 3 — the item whose whole point is that a count must be
re-derived rather than inherited**.

Enumerated this round, the answer is **six**: `reconciliationCoordinator.ts`'s module doc, the
`awaitingWorkspaceReady` doc comment, three paragraphs of `runOneDrain()`'s `staleOpen` arm, and
`workspace.svelte.ts`'s failed-open arm. **2d-5-3-E's own fix added the sixth.**

**And the other half of the sentence is false as well.** *"Tested by none"* stopped being true at
2d-5-3-E, whose Medium 1 established that the **workspace half is pinned in Rust** by
`a_failed_reopen_keeps_the_previous_watcher_watching`. A round can therefore falsify a sentence in its
own notes by fixing the code the sentence is about, and nothing links the two.

§8 item 3 of `2d-5-3-E-notes.md` is **left standing with its correction attached rather than
rewritten**. The failure it now demonstrates — a count copied forward into the paragraph forbidding
exactly that — is worth more than a tidy number.

## 3. Low — "never this one" is true of provenance and not of the property, and the two readings differ

The third-state paragraph defines that state by **provenance** (*a refused `open_workspace` … returns
from `Workspace::discover(root)?` before it takes the lock*) and then states a **property** as its
consequence (*its `newest_sequence` really is a watermark for the lifecycle Rust is still holding*).
2d-5-3-E's `list_documents` paragraph closes *"and never this one"*.

**Under the provenance reading that is exact. Under the property reading it is short by a case**, and
the case is reachable: `open()` has no re-entrancy guard, so a batch produced after open #1's swap
(case 2) followed by a **later** open refusing at `Workspace::discover(root)?` leaves Rust holding the
very workspace that batch came from — the property holds while the provenance is still case 2.

**The refusal is unaffected either way**, and that is why this is a Low rather than a Medium: the arm
below rests on *unattributability*, never on the queue being intact, which the closing paragraph has
said since 2d-5-3-C. The comment now says which reading it means and why the distinction costs the
refusal nothing.

**This one was inherited rather than introduced.** The ambiguity predates 2d-5-3-E — the property
sentence is 2d-5-3-C's — and 2d-5-3-E's fix merely put a classifying sentence next to it, which is what
made the two readings visible.

## 4. What was checked and left standing

Each re-derived rather than accepted from the review:

- **The Rust citation is accurate.** `a_failed_reopen_keeps_the_previous_watcher_watching` refuses via
  a path that is not a directory — the `Workspace::discover(root)?` early return the comment is about,
  not some other refusal path — and asserts the session still open, `epoch == 1`, `ready`, and a live
  edit delivered. `main.rs` declares the module under `#[cfg(test)]` with no `#[ignore]`.
- **The queue half really is unpinned.** Nothing asserts the reconciliation queue survives a refused
  open, so 2d-5-3-E's narrowed claim is not the same defect its predecessor's was.
- **The lock-race attribution holds.** State 1 remains reachable when a `list_documents` refusal is
  what is observed, because the drain's service point is independent of it.

## 5. Verification

Every gate run by the orchestrator, each command on its own, **twice** — once on the tree as inherited
(which is the tree 2d-5-3-E committed and measured, so this round's inherited figures and that round's
committed figures are the same measurement) and once on the tree this phase commits. Figures and the
three host-scar consequences are in `PROGRESS.md`'s verification baseline, which is the live head.

The structural checks, on the committed tree: the diff is **comment-only, proven mechanically** (`git
diff -U0` filtered to changed lines that are neither comments nor blank returns nothing); **no line in
the edited file exceeds 90 characters**; the instrument's pin held at `5 insertions(+), 1 deletion(-)`
and `git status --short --untracked-files=all` names exactly the four harness paths.

## 6. §7.1 disposition

The fix changed **one source file** — `src/lib/browser/reconciliationCoordinator.ts` — so **§7.1
commissions a round** and this phase is **`SUPERSEDED BY 2d-5-3-G`, never complete**. Two of the three
fixes were prose and commission nothing; **the third is why a round is owed**, and it is a Low, which
is exactly the case §7.1 was rewritten to cover: the first version of that rule said fixing a Low opens
no round, and that was backwards for a Low whose fix edits source.

**Nothing is `BLOCKED`.** No item in §7 names an unfixed correctness defect in a source file.

## 7. Where it is thin

1. **The clarification added in §3 is itself a new comment claim about `open()`'s re-entrancy —
   *actionable*, and not a correctness defect in source.** It asserts that `open()` has no re-entrancy
   guard and that a second open can reach Rust while the first's effects stand. That was re-derived
   from `workspace.svelte.ts`'s generation checks, which supersede a stale open's *frontend* effects
   without unwinding its *Rust* ones — but **nothing in this repository drives two overlapping opens**,
   so the sentence is reasoned rather than executed, exactly like the paragraph it qualifies. A later
   phase may adopt it.
2. **The paragraph count is now six and nothing holds it at six — *recorded only*.** The figure was
   enumerated once, by hand, and the next comment added to any of those six sites falsifies it silently.
   This is the fourth time this chain has recorded a count with no mechanism behind it.
3. **The cross-language anchor added at 2d-5-3-E is unchanged and unenforced — *recorded only*.**
   Renaming `a_failed_reopen_keeps_the_previous_watcher_watching` breaks a TypeScript comment and no
   gate. `PROGRESS.md` has now nominated a citation checker four times.
4. **2d-5-3's able-to-fail residue (2d-5-3-D §8 item 4) is still unreproduced — *actionable*, and not a
   correctness defect in source.** Three consecutive rounds have now cleared none of it. This round is
   the first to say so with the item numbered correctly, which is the only thing that changed about it.
5. **The reviewer re-ran no gate — *recorded only*.** Every figure in its report is inherited from the
   orchestrator's runs, and it says so. The orchestrator ran all four itself, twice, which is where the
   evidence actually comes from; a reviewer that inherits figures cannot catch a figure that is wrong.
