Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-3-H — round 8, scoped to 2d-5-3-G's fix (`c67404d`)

Verdict **ship-with-fixes**. 0 blockers, 1 Medium in source, 1 Medium in the record, 3 Low.

**Re-derived and holding**: M1's code argument (`afterSequence` captured at line 717 pre-await;
`batch.newest_sequence` read only at line 683 inside `accept()`; the arm returns at 814-815);
M2's Rust (`reconciliation: Arc<ReconciliationQueue>` at `commands.rs:398`, a `WorkspaceSession`
field whose own doc says the queue is *"emptied by a replacement rather than replaced by one"*;
`guard.replace(Open { … })` at 715 does not touch it); both line anchors `:70-71` and `:440`;
provenance (`git log -S` puts the false clause on `b1c7b4b`); comment-only diff; no line > 90.

## Medium 1 — source (comment). `reconciliationCoordinator.ts:774-778`

> In case 2 the batch already *is* the incoming lifecycle's queue and Rust is still holding that
> lifecycle, so the property … is satisfied there outright

Present tense, unqualified, and evaluated where the arm runs — after the await, on a generation
mismatch. Nothing stops a **second successful** open landing before this line; the round's own M3
cites `workspace.test.ts`'s *overlapping requests* suite driving two. Then Rust holds lifecycle
N+1 and the property is false. It is true only at the instant of the drain, and the sentence this
round **deleted** ("a *later* open refusing at `Workspace::discover(root)?`") was the only one that
made the time index visible. Fix: give the claim its time index, or say what must not have happened.

## Medium 2 — record. `2d-5-3-G-notes.md` §2

*"nothing has replaced that lifecycle since"* — a guarantee the code does not give, asserted one
sentence after removing *"`open()` has no re-entrancy guard"* as unverified. Same absence, opposite
sign, no more evidence.

## Low 1 — record. §4 vs the block it wrote

§4: *"**No number is written down as the answer**"*; the same commit writes *"this round gets
**eight**"* (§4) and *"gives **eight** in production"* (`2d-5-3-E-notes.md` §7 correction).

## Low 2 — record. Three fresh uncounted counts in the commit whose Low 2 was two

*"the fifth time"*, *"a **sixth** opening-words anchor"*, *"nominated a citation checker five
times"*. The last is underived: `next-action-history.md:11531` (2d-5-3-F block) and `:11651`
(2d-5-3-G block) **both** say *"four times"*.

## Low 3 — source (comment). `:798-800`

Cites the paragraph opening *"Which lifecycle the batch describes"* as saying the refusal rests on
unattributability; that paragraph says only it *"is not knowable here, and the refusal does not need
it to be"* — no justification. And *"asserted by the paragraph above"* is now ambiguous: this
round's own rewrite (775-778) made a second site assert the property.

## NOT-VERIFIED

`cargo test`/`npm` gates (brief forbids; orchestrator running them) — no gate reads prose anyway.
Rust claims in the file's **untouched** comments beyond the two cited (§7 item 6's own warning).
Whether *"sixth opening-words anchor"* is right — the predicate is ambiguous, which is §4's point.
The concurrent `PROGRESS.md` block move.
