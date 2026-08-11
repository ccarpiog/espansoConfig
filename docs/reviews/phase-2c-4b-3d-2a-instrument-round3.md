# Prose review of Phase 2c-4b step 3d-2a — instrument record, round 3

This round reviewed only `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md`. It used the round-2
review to identify the four findings being dispositioned, and cross-checked §6.7 against §6.2,
§6.3, the launch table and cautions in the same record, and `2c-4b-3d-1-notes.md` §7. It did not
re-verify the instrument, fixtures, launches, manifest, or counts, and used no URL or external
source.

## Findings

### Medium — the checkpoint prediction is already incomplete, and §1 still restates its pre-commit state without the new time bound

Section 1 predicts:

> **“The checkpoint stages `PROGRESS.md` and the three documents under `docs/` by path, and leaves
> the four harness paths — `src/main.ts`, `src-tauri/src/main.rs`, `src/probe.ts`,
> `src-tauri/src/probe.rs` — in the working tree for 3d-2b to use and 3d-3 to delete. So after it, the
> eight-path list above is four, and the branch tip is no longer `e494095`.”** (§1, lines 82–87)

The paragraph is prospective — “after it” makes clear that the checkpoint has not happened — so it
does not falsely report the commit as observed. Its predicted four-path result is nevertheless no
longer true on its own stated staging plan. This round must create a third review, while the prediction
stages only the decision record and its **two** existing reviews among the three `docs/` paths. Staging
those named paths leaves this round-3 review untracked in addition to the four harness paths: the
post-checkpoint status has five paths unless the checkpoint plan is amended to stage this review too.
Section 7 repeats the same false result:

> **“§1 says what this step's checkpoint commit then does to both readings: it stages `PROGRESS.md`
> and the three documents by path, so the list becomes the four harness paths and the tip moves.”**
> (§7, lines 537–539)

There is also a narrower survivor of the time-binding problem inside §1 itself:

> **“What the artifacts do support are present-state readings, and they are the whole of it — the
> tracked diff against `HEAD` is the four hook lines §2 quotes plus `PROGRESS.md`'s checkpoint entry,
> and the branch tip is 3d-1's commit, so no commit of this step's work exists.”** (§1, lines 95–99)

Unlike the corrected reading at lines 72–80, this sentence does not say “when this record was last
amended.” It asserts the pre-checkpoint tip and absence of the step commit in the present tense, even
though the next paragraph predicts that both will cease to be true. The durable record therefore both
limits the reading correctly and repeats it once outside that limit.

### Medium — §6.7 misclassifies the uninstrumented reload surfaces as a coverage gap

Section 6.7 defines a hole as a path with no case row and no `runPlan` arm, and a coverage gap as an
existing case that no launch took. It then says:

> **“2 is a coverage gap in one half and not a gap at all in the other — the `fieldCollisions`
> obstacle exists on one surface only, which is a scoped justification rather than anything missing,
> while the confirmed-reload transition exists on all five match surfaces and was launched on one.”**
> (§6.7, lines 487–490)

The `fieldCollisions` half is classified correctly: §6.7's table and caution 2 limit that obstacle to
the editor, so the absence of four cross-surface cases is justified scope, not missing coverage. The
reload half is not a coverage gap under §6.7's own definition. Caution 2 immediately says, **“Only the
editor has an ineligibility case, and only the editor has a reload case”** (§6.7, lines 501–503).
Section 6.2's complete list of fourteen existing-but-unlaunched cases contains no creator, deleter,
mover, or duplicator reload case, and §6.3 lists only expected-byte files for existing positive cases.
The launch table records only `editor-reload-gone` (P09/P10). Thus the other four confirmed-reload
surface paths have no case to launch: on the record's terms they are holes, not coverage gaps.

This distinction is operational, not cosmetic. The record says a coverage gap costs a launch while a
hole first costs a fixture or plan function (§6.7, lines 491–492). Calling these four paths a coverage
gap sends 3d-2b to launch cases that the same record says do not exist. Cautions 1, 3, and 4 are
correctly classified: caution 1 lacks a row/arm; `editor-fallback` exists but is unlaunched; and the
`:twice` mechanism can be applied to an existing case and therefore needs a launch rather than a new
case.

### Low — a categorical historical no-change claim remains in §2

Section 2 says:

> **“The four hook lines were checked and none needed restoring. `git diff` shows exactly `mod
> probe;` and `probe::register_with_probe(tauri::Builder::default())` in `src-tauri/src/main.rs`, and
> `import { startProbe } from './probe';` and `startProbe();` in `src/main.ts` — the four the records
> specify, unchanged.”** (§2, lines 133–136)

The current-diff portion supports that those four hook additions were present at the recorded git
reading. It cannot establish the historical clauses “none needed restoring” and “unchanged”: §1 says
there is no before-image of the working tree and expressly limits the artifacts to a present-state
reading. Unlike the corrected treatment of `src-tauri/src/probe.rs` at lines 129–131 and the corrected
§5.10 attribution, this sentence neither labels those clauses as the operator's account nor limits
them to the recorded state. This is a narrower surviving instance of round 2's Low 2.

## Round-2 finding disposition

| Round-2 finding | Status | Round-3 judgment |
|---|---|---|
| Medium — §8.4 inferred that refusals wrote nothing | **closed** | §8.4 now claims only final equality to each installed R1 and a negative two-part backup search, then expressly says this is not an observation that nothing was written and repeats the no-spy/no-counter bound. Elsewhere, §6.1 applies that bound to P02, P04, and all five §8 launches. The “Nothing was written” sentences at §8.2 lines 629–639 are quotations from the UI transcripts, not evidentiary conclusions; §6.1 explicitly says the harness cannot fail merely because such a rendered sentence is false. No document-level refusal claim still says or implies that no write issued. |
| Low 2 — historical no-change claims lacked a before-image | **partially closed** | The three sites cited by round 2 were corrected: the git-status statement is now a time-bound present-state reading, §5.11 makes §8.1 an account whose completeness cannot be checked, and §8.1 limits its tree evidence while rejecting “nothing else was touched.” The categorical hook-history sentence in §2 remains, as found above. |
| Low 3 — §5.10's causal build gloss outran retained evidence | **closed** | §5.10 now establishes only that the two measured executable digests differ, and labels the edit-and-rebuild statement as an account rather than a reading of the bundles. It expressly disclaims source snapshot, build command, and build-time provenance. |
| Low 4 — §6.7 called all four cautions holes | **partially closed** | The blanket label is gone and the definitions are useful. Cautions 1, 3, and 4, plus the `fieldCollisions` half of caution 2, are classified correctly. The cross-surface confirmed-reload half of caution 2 is still misclassified, now as a coverage gap rather than a hole. |

## Answers to the round-3 questions

1. Round 2's Medium and Low 3 are closed. Low 2 and Low 4 are only partially closed for the narrower
   instances above.
2. The rewording introduced a wrong per-caution classification, and the added checkpoint prose makes
   a four-path prediction that omits the review this round is required to create.
3. The old git-status and tip reading at lines 72–80 is soundly bound to the last amendment, and the
   checkpoint is described prospectively rather than as an observed commit. The prediction's path
   result is incomplete, and lines 95–99 separately reassert the pre-commit state in present tense.
4. Caution 1 is a hole; cautions 3 and 4 are coverage gaps; caution 2's `fieldCollisions` half is a
   scoped justification, but its four uninstrumented cross-surface reload paths are holes, not a
   coverage gap.
5. The §8.4 no-write correction is complete. No sentence outside a clearly attributed UI quotation
   asserts or implies that a refusal issued no write.

## Verdict

**NOT READY** for step 3d-2b to proceed on this record. Correct the checkpoint path prediction and
the untimed pre-commit restatement, classify the four reload surfaces by the record's own hole
definition, and narrow or label §2's hook-history clause. These are prose corrections; this review
requires no new launch, fixture, manifest work, or count verification.
