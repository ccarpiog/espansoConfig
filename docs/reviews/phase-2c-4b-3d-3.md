# Phase 2c-4b-3d step 3 — aggregate review (Codex)

**Round 1 verdict: NOT READY.** One High, four Medium, three Low. **Every finding is prose**; none is
a defect in the removal, and none changes a byte written to a user's file. The reviewer independently
confirmed the step's central result: *"The current production count is unambiguously 1633 passed /
49 files, because it was measured after removal on a clean tree."*

The brief given to the reviewer named the measured gates, the arithmetic behind the 1633 conclusion,
and asked specifically for the conclusion to be **refuted** if it could be. It was not refuted; the
findings are against the record's wording.

---

## The verdict on the central question

> The measured **1633** result is sound. […] The only intended lost test is the generated
> `ipc-detail.test.ts` case for `src/probe.ts`. The checkout of the two entry points cannot plausibly
> explain a ten-test loss: the complete unstaged diff contained only hook changes, neither file was
> deleted, and Rust remained at 1086.

And on §1.3, the manifest bound, which the brief asked to be tested for an implied check:

> §1.3 is honest and adequate. […] It does not imply that a check occurred at deletion. No additional
> manifest run was owed, provided the historical 3d-2b results are accurately quoted.

---

## Findings and disposition

### High

**H1 — the claimed `PROGRESS.md` correction had not happened.** The record's §3 said *"The three stale
statements are corrected in place in `PROGRESS.md`"* while `PROGRESS.md:82`, `:3450`, `:3562` and
`:6589` all still read `1623`. The sentence described work the step intended and had not yet done.

**Fixed by doing the work, not by rewording.** All four sites are now annotated in place — the status
table row, the 3d-2a and 3d-2b verification sections and the "Next action" — each carrying the
correction beside the original figure rather than replacing it silently, the way 3d-2a annotated
`BLOCK_TEXT_LIMIT`. The record's sentence is now true and names the sites.

**The orchestrator's own sweep then found two more, and they are recorded here rather than quietly
folded in.** Re-reading *every* occurrence of `1623` — sweeping for what the tree says, not for the
sites the finding listed — turned up two further stale instances inside **superseded "Next action"
blocks**, 3d-2a's and 3d-2b's identical *"if it does not, they are the production ones (1623 / 418 /
175)"*. Both were written after 3d-1 and were therefore stale when written. Both are now annotated.
**Six sites, not four** — which is the same narrowing pattern the previous seven rounds of 3d produced,
appearing this time in the fix for the round's own High.

The other occurrences were checked and deliberately **left alone as accurate history**: 3a's
verification section records 1623 as what it measured, 3b's records `1624 = 1623 + 1`, and the older
checkpoints quote it from before 3d-1 existed. Rewriting those would destroy the arithmetic the
correction rests on.

### Medium

**M1 — `git checkout -- <paths>` restores from the *index*, not from `HEAD`.** The record argued
byte-identity "by construction" from `HEAD`, which is not what the command does; and plain `git diff`
does not show staged differences, so the pre-command check the record cited did not establish what it
claimed.

**Fixed.** §1.1 now says what was actually observed and in what order: the pre-command
`git status --short` showed both files with an **unmodified index column**, so the index equalled
`HEAD` before the command ran; the command restored the worktree from that index; and the empty
`git status --short --untracked-files=all` and empty `git diff` afterwards establish the result equals
`HEAD`. The claim is now carried by two observations instead of by a false description of the command.

**M2 — §5 said the tracked tree was byte-identical at the step's start and end.** False: at the start
the two tracked entry points held four uncommitted hook lines.

**Fixed.** §5 now says the tracked files end byte-identical **to `HEAD`** and to their pre-harness
versions, and that the step introduced no new tracked source state — which is the true statement that
discharges the window-reading rule.

**M3 — §3 overstated the artifact proof for 3d-1's ten cases.** A ten-file stat and a commit message
saying "1634" do not prove ten added registered cases; additions and removals could net to ten.

**Fixed by measuring, which strengthened the claim rather than softening it.** Over
`git show a2069db -- 'src/**/*.test.ts'`: **34** added `it(`/`test(` lines against **24** removed —
**net +10**, matching the gate delta exactly. The line count is exact here because
`rg -c '^[-+].*\.each'` over the same diff finds **nothing**, so no parametrized block hides a case on
either side. Both the condition and the count are now in the record.

**M4 — §4.2 called an unmeasured future reconstruction cost "measured", and overstated what a rebuild
needs.** The 75 retained launch directories are historical output; they are not inputs a new launch
requires, so "the whole scratch tree would have to be reconstructed" was wrong, and 3.0 GB is the
accumulated size after 75 launches rather than a reconstruction footprint.

**Fixed.** §4.2 now separates what is demonstrated (feasibility — 2c-4a-3c-5 deleted a harness and
3d-2a rebuilt one) from what is unmeasured (effort), and names the actual inputs a first new launch
needs: the two probe sources, the four hook lines, `launch.sh`, the driver's case table and the
required fixtures — **not** `launches/P01…P75/`.

### Low

**L1 — §2.1 stated a general rule bundler counts do not obey.** Module counts do not move one-for-one
with source files in general; imports, tree-shaking and virtual modules break the correspondence.

**Fixed.** The general sentence is now attributed to `CLAUDE.md` §6 as this project's guard, and the
attribution for *this* tree is argued from what was observed on it: one frontend source file removed,
the count down exactly one, and both regression signatures absent from `dist/assets/`. The phrase
"175 is unchanged by this step" is corrected — the **baseline** stayed 175 while the observed build
count moved 176 → 175.

**L2 — "the numbers a fresh clone produces" was not measured.** The measurement was on the cleaned
working tree. (A fresh clone additionally needs `npm install` before any frontend gate runs.)

**Fixed.** The record now says "the measured harness-free working-tree values" and notes the
`npm install` precondition.

**L3 — "the ten R1 files" enumerated eleven.** Eleven is also what makes the stated total of 21
(1 base + 11 R1 + 9 expected).

**Fixed** — "eleven", with the 1 + 11 + 9 = 21 arithmetic shown so the count is checkable rather than
assertable.

---

## What the reviewer said the step did **not** owe

> The step did not owe another window reading, mounted test, launch, or manifest verification. The
> missing work is documentary.

That is the disposition this step closes on: the three documentary items the reviewer listed are the
eight fixes above.

---

## The one thing this review could not do

The reviewer read the record, `PROGRESS.md`'s relevant sections and the repository, but **ran no
gate**. Every number in the record is the orchestrator's own measurement on the exact tree, re-run
before and after the removal; the review checked the *arithmetic and the claims*, not the runs. The
brief said so, and this file records it rather than leaving a reader to infer that a second party
re-measured anything.
