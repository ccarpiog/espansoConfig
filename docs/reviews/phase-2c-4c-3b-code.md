# Phase 2c-4c-3b — code review

## Round 1

**Provenance.** This round ran with the workspace mounted read-only, so Codex could not append its
own section. The brief asked for the full review text in the final message; what follows is that
message **transcribed by the orchestrator**, not Codex's own bytes. The job is
`task-msqhfd0u-t2j3ys`, Codex session `019ff772-8b6b-7251-8dc3-0b21b1f0b16c`. The brief forbade web
search, named the dirty tree at baseline `a93323e` as the review target, put the step's **two
deviations** at the centre of the review — the `recoveryAvailability` reordering and the decision
not to mount `RecoveryPanel.svelte` — listed the six rules the step is bound by, and stated the
five gates as already independently verified so they would not be re-run.

**Verdict: NOT READY.**

### Transcribed review

# NOT READY

The workspace is read-only, so the full review is here.

## High

- `docs/decisions/2c-4c-3b-notes.md:34`, with duplicated renderers at `MatchDeleter.svelte:560`,
  `MatchMover.svelte:828`, `MatchDuplicator.svelte:721`, and `RawEditor.svelte:552`: not mounting
  `RecoveryPanel` is correct—its product name and controls would be false on these surfaces—but the
  replacement repeats a second recovery renderer four times. `recoveryWithoutCreation` centralizes
  which reason is returned, but it does not render it; each host independently decides to include
  the `<p>` and call the accessor. One host can therefore omit the sentence while consuming the
  model correctly elsewhere, exactly the documented failure mode. The decision record compounds this
  by claiming "one function, six callers, one suite": the function has four component callers, while
  its model suite cannot prove any component renders its answer. This would be right if the four
  hosts mounted a small shared reason-only renderer, or if `RecoveryPanel` were safely redesigned as
  a discriminated form/reason renderer without new-snippet semantics or nullable no-op collaborators.
  Each host's mounted suite should still prove that shared renderer is mounted.

## Medium

- `docs/decisions/2c-4c-3b-notes.md:195`: the evidence record says that on "each surface" the mounted
  cases prove survival through a reapply resolving nothing, an unconfirmed reload, and a refused
  reload, with nothing closing. That is false for the raw editor: its reapply is deliberately
  unavailable, and `RawEditor.test.ts:1178` exercises only the two reload endings. Those raw cases
  also do not assert `closed() === 0`; because the test's `close` callback is a spy rather than an
  actual parent unmount, continued local rendering does not prove the surface was not told to close.
  This would be right if the record distinguished the raw editor's reachable endings and the tests
  asserted that `close` was not called for each tested ending.

## Verified without findings

The `recoveryAvailability` reorder has a complete disagreement matrix:

- With a conflict, old and new answers are identical for every draft kind and reapply arm.
- Without a conflict, the intended non-creating answers change from
  `operationDraft`/`wholeDocumentDraft` to `noConflict`.
- The two creating kinds also change from `notFromManualResolution` to `noConflict` when the attempt
  is null or non-manual. That exposed reason changes, but both are non-answerable, so neither
  creating surface draws anything; a manual-resolution attempt already returned `noConflict` before
  the reorder.

The empty-argument dependency is real, documented at `recovery.ts:491` and `recovery.ts:2580`, and
pinned by `recovery.test.ts:664`: moving either the reapply or destination check above the
non-creating route check changes the narrow answer and fails the agreement case.

The diff does not touch `browser.saveOutcome.reloadClosesSurface`, adds no hardcoded user-facing
string, makes no new `sourceConflictState` outcome claim, and changes no write or committed-result
path.

### End of the transcribed review

## Round 1 disposition

| # | Finding | Disposition |
|---|---|---|
| H1 | Four hosts each decide independently whether to draw the sentence — the rule-in-a-renderer failure mode — and the record's "one function, six callers, one suite" is false of it | **Fixed by building the shared reason-only renderer** Codex names as the first of its two right answers, plus the record correction |
| M1 | The evidence record claims three surviving endings on "each surface"; the raw editor has only two reachable, and no raw case asserts `close` was not called | **Fixed by doing the work**: the record distinguishes the raw editor's reachable endings, and every tested ending on all four surfaces asserts `close` was not called |

Round 2, reviewing the fixes, is below.

## Round 2

**Verdict: NOT READY.**

### Medium

- `docs/decisions/2c-4c-3b-notes.md:290` says every tested non-committed ending on all four
  surfaces asserts that `close` was not called. The new recovery cases do assert it for the three
  enumerated surviving endings on each match surface, the two on the raw editor, and dismissal,
  but the claim is broader than those cases. Existing no-write endings still omit the assertion:
  the mover's `alreadySatisfied` reapply at `MatchMover.test.ts:1444` and refused reapply at
  `MatchMover.test.ts:1466`, the duplicator's refused reapply at
  `MatchDuplicator.test.ts:1239`, and the deleter's refused renewed confirmation at
  `MatchDeleter.test.ts:1096`. The first of those also shows why this is not merely duplicate
  coverage of the three endings listed in section 5: `alreadySatisfied` is a distinct tested
  non-committed ending. This would be right if every test that reaches a no-write ending asserted
  `closed() === 0`, or if section 6 accurately limited the claim to the enumerated conflict-
  surviving endings and dismissal rather than saying every tested non-committed ending.

### Verified without findings

H1 is closed. All four hosts mount `RecoveryWithoutCreation.svelte` without a condition about its
sentence; the raw mount is only inside the block that decides whether an editor exists. None of the
hosts calls the accessor or carries the sentence's `{#if}`. Each conflicted mounted suite queries
the child-owned `data-recovery-without-creation` marker through the exported constant and expects
its surface-specific reason, so deleting the mount or replacing it with identical host text fails.

The generic is sound: `ConflictModel<T>` carries `Draft<T>`, while the renderer and
`recoveryWithoutCreation` inspect neither the draft nor its value. The data attribute is neither
rendered text nor an ARIA attribute and is not referenced by accessibility markup. Its markup
literal and exported constant are deliberately separate; changing either alone makes all four
marker queries fail.

The component reaches both languages through `tRecoveryUnavailable`, never through a built key.
The changed component and host comments agree with the current shape, including the narrowed
no-host-condition claim. The record no longer claims that a retained operation is drawn through
every ending. No copy, save-as-new, or create control was added to these four surfaces;
`browser.saveOutcome.reloadClosesSurface` is untouched; and the cleared `recoveryAvailability`
ordering remains conflict first, route second, reapply later.

**Provenance.** Round 2 ran with the workspace writable and Codex appended the section above itself;
those are Codex's own bytes, unlike round 1's transcription. The job's brief scoped the round to the
fix, named both findings and the fix taken for each, and asked specifically whether either fix had
introduced a new defect — which is what it found.

## Round 2 disposition

| # | Finding | Disposition |
|---|---|---|
| M1 (round 2) | `2c-4c-3b-notes.md` claimed *every tested non-committed ending on all four surfaces* asserts `close` was not called, while four pre-existing no-write endings did not | **Fixed both ways by the orchestrator**, because the review's list was prefixed *including* and neither half alone is honest: the four named endings now assert `closed() === 0` (they pass, so `close` genuinely was not called in any of them), **and** the record's sentence is narrowed to the endings this step enumerates plus those four, claiming no exhaustiveness over the four suites that nothing verified |

**This is the sixth consecutive round on this phase in which a fix produced the next round's
finding, and the first in which the over-claim was written by the fix for an over-claim.** Round 1's
M1 was a record claiming more evidence than existed; the fix for it wrote a record claiming more
evidence than existed, one scope wider. The orchestrator's own brief contributed to it — it asked
for the assertion on "every tested non-committed ending on all four surfaces", and the worker wrote
that sentence into the record while implementing it only for its own cases.

**No round 3 was commissioned.** The remaining change is four one-line assertions that pass and one
narrowed paragraph, all made by the orchestrator rather than a worker, and the frontend suite was
re-run over them (1767 passed, 51 files). That judgement is recorded here so it can be overruled on
evidence.
