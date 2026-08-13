# Phase 2c-4c step 6 — Codex review of the removal record

**Subject:** `docs/decisions/2c-4c-6-notes.md`, the harness-removal record, reviewed before the
commit that closes Phase 2c-4c.

**Round 1 verdict: NOT READY.** Nine findings — three High, five Medium, one Low. **Every one of
the nine is a sentence in the record.** None is a defect in the removal, in the gate figures, or in
the application: step 6 changes no tracked source file and the tree it produced is byte-identical to
`HEAD`.

The brief asked six specific questions (a)–(f) and forbade web search. The reviewer was given the
retained facts — the four working-tree paths, the hook diff as read, the deletion order, the four
gate outputs, the falsifiability control on the bundle search, and the traced vitest arithmetic —
and asked to check the record against them and against `PROGRESS.md`, `CLAUDE.md` §4 and
`2c-4b-3d-3-notes.md`.

**Disposition: all nine accepted and fixed.** Each was checked against the artifacts before being
applied rather than taken on the reviewer's authority; finding 5's two filenames were confirmed by
listing `docs/decisions/`, and finding 6's chronology against `PROGRESS.md`'s 2c-4c-5 and 2c-4c-5b-3
rows. **The orchestrator's own sweep after the fix round then found a tenth**, created by the fix
round while closing finding 5 — a file count taken through a `| head` that capped it at ten when the
true figure is 19. It is recorded in place at the record's §1.3 and in its §5.

---

## Round 1, verbatim

VERDICT: NOT READY

1. **High — §1.1:** "An empty diff against `HEAD`'s blobs is byte-identity, not similarity. It is the whole of the proof and it needs no supplement."

   A plain `git diff <paths>` compares the worktree with the index, not directly with `HEAD`. The initial short status supplies the missing fact that the index columns were clean; the empty diff is not independently "the whole proof."

   **Replacement:** "Together with the initial short status's blank index columns, the empty diff proves that both paths again matched `HEAD` byte-for-byte."

2. **High — §2:** "`src-tauri/src/probe.rs` was a plain `mod probe;` with no `#[cfg(test)]` module of its own, so adding and removing it moves no test count."

   The untracked probe sources were deleted without being read, and §1.3 correctly says no repository record retains their text. The unchanged Rust count supports only the observed count, not this claim about the deleted file's contents.

   **Replacement:** "The Rust count remained 1112 after removal. Because the deleted `probe.rs` was not read and its text was not retained, this record cannot attribute that unchanged count to its internal contents."

3. **Medium — §1.4:** "The working tree is byte-identical to `HEAD` … So every surviving occurrence of the word is committed history by construction, and no grep is load-bearing."

   Empty `git diff HEAD --stat` plus empty normal status covers tracked and non-ignored untracked paths, but not ignored files. The record itself acknowledges that `dist/` is ignored. These git facts prove the tracked/non-ignored tree is clean, not that the entire working tree is byte-identical or that residue searches are unnecessary.

   **Replacement:** "All tracked files match `HEAD`, and no non-ignored untracked path remains. The residue greps separately check the paths they search; ignored outputs such as `dist/` are outside that git proof."

4. **Medium — §1.2:** "It held the launch directories **P01–P73**, the fixtures and the manifests, accumulated across 4a … 5b-2."

   Step 6 measured only the directory's size before deleting it; it did not inventory or verify its contents. Earlier records describe those artifacts, but they do not prove what remained at deletion time.

   **Replacement:** "Earlier step records describe that tree as containing launch directories P01–P73, fixtures and manifests accumulated across 4a through 5b-2; step 6 itself measured only its 2.9 GB size before deletion."

5. **Low — §1.3:** "Any claim in `2c-4c-4a-instrument.md`, `2c-4c-4b-notes.md`, …"

   The named files do not exist. The actual records are `2c-4c-4a-instrument-rebuild.md` and `2c-4c-4b-instrument.md`.

   **Replacement:** "Any claim in `2c-4c-4a-instrument-rebuild.md`, `2c-4c-4b-instrument.md`, …"

6. **Medium — §1.3:** "Those records were written and reviewed while the artifacts existed — 5b-3 alone took three Codex rounds against them —"

   `PROGRESS.md` says step 5 had three rounds overall, while 5b-3 took rounds 2 and 3. Round 1 reviewed the original step-5 record before the 5b-3 rewrite. "5b-3 alone took three" is false chronology.

   **Replacement:** "Those records were written and reviewed while the artifacts existed — step 5 took three Codex rounds overall, of which 5b-3 took rounds 2 and 3 —"

7. **Medium — §3.3:** "the four figures now in `PROGRESS.md` were produced … at the commit this step produces."

   `PROGRESS.md` still contains the pre-step expectation and marks phase 2c-4c in progress. The measurements were made on the harness-free working tree before the record, review and closing checkpoint were committed; no retained evidence establishes them as measurements "at" a future commit.

   **Replacement:** "The four measured figures were produced by running the gates on the harness-free working tree used for this step."

8. **Medium — §4:** "It did **not** run `git commit -a` or `git commit -am` at any point."

   The retained git state proves the harness was absent at the final check, but cannot prove that a particular command was never executed earlier. `PROGRESS.md` records a prohibition, not evidence of compliance throughout the chronology.

   **Replacement:** "`PROGRESS.md` forbade `git commit -a` and `git commit -am` while harness paths were present; the final clean status proves no harness path remained or was committed in the resulting tree."

9. **High — §5:** "**Phase 2c-4c is complete.**" Also: "**No finding in any round of step 6 changed a byte written to a user's file …**"

   The authoritative status table says phase 2c-4c is still in progress and that the step-6 Codex review is mandatory before the commit closes the phase. The expected review file does not yet exist. The second sentence anticipates the outcome of review rounds that had not occurred.

   **Replacement:** "The harness removal and gate re-derivation are complete. Phase 2c-4c closes after the required step-6 Codex review and closing checkpoint are recorded." Omit the sentence predicting what findings in step-6 review rounds will do.

Checks requested explicitly:

- **(a)** Not consistent: findings 2, 4, 6 and 8 identify content, artifact-state or chronology claims not retained.
- **(b)** The 104 → 102 → 118 arithmetic is sound. Given the known extra `src/probe.ts`, its absence from the two-entry allow-list, and unchanged tracked test code, 105 → 103 → 119 follows deductively; it is not overstated.
- **(c)** The 178 → 180 module ladder and the measured two-module contribution of the styled component agree with `CLAUDE.md` §4 and `PROGRESS.md`.
- **(d)** The "greps are non-load-bearing" reasoning is too broad; see finding 3.
- **(e)** §3.3's comparison between matching and correcting measurements is otherwise appropriately narrow and does not compensate with a larger evidentiary claim. Its "at the commit" wording is the defect in finding 7.
- **(f)** The substantive step-5 bounds and M2 history in §§3–5 agree with the requested records. The unverifiable closing/process claims are findings 8 and 9.

---

## Disposition, finding by finding

| # | Severity | Accepted | How it was closed |
|---|---|---|---|
| 1 | High | yes | §1.1 now names the working-tree-vs-index semantics explicitly, and cites **two** retained facts: the initial status's blank index column, and §1.4's empty `git diff HEAD --stat`. The record says an earlier draft got this wrong. |
| 2 | High | yes | §2's cargo bullet now **offers no explanation at all** for the unchanged count, and says why one would be circular: the file was deleted unread and its text is retained nowhere. Only the observation survives. |
| 3 | Medium | yes | §1.4 narrows to *every tracked file matches `HEAD`, and no non-ignored untracked path remains*, then names the boundary — and adds that `rg` honours `.gitignore`, so **the greps share the blind spot** rather than covering it. `dist/` is closed separately by `emptyOutDir: true` (`vite.config.ts:45`) plus the post-build status. |
| 4 | Medium | yes | §1.2 now says the 2.9 GB size is *the only property step 6 measured*, and attributes the P01–P73 inventory to the earlier records on their authority. |
| 5 | Low | yes | Confirmed by `ls docs/decisions/`. Both filenames corrected. |
| 6 | Medium | yes | Confirmed against `PROGRESS.md`'s 2c-4c-5 and 2c-4c-5b-3 rows: three rounds over step 5's record, of which 5b-3 took 2 and 3, round 1 being what forced the 5b fix round. |
| 7 | Medium | yes | §3.3 now claims only *the harness-free working tree this step created*, cross-referenced to §1.4. |
| 8 | Medium | yes | §4 states the prohibition as a prohibition and separates it from what the retained state proves. |
| 9 | High | yes | §5 rewritten: it records round 1's actual outcome, states that the closing commit is what `PROGRESS.md`'s handoff prescribes, and **drops the prediction** about future rounds. The final sentence now claims only that step 6 has no code path that writes to a user's file and that none of round 1's findings touched an executable line. |

## The tenth, found by the sweep after the fix round

Closing finding 5 introduced a sentence counting the `docs/` files that name the probe's
identifiers. The count was taken through a command ending in `| head`, which caps output at ten
lines, and the sentence said **ten**. Re-derived without the cap: **19**.

This is the thirteenth consecutive round in this phase to find a narrower instance of what the round
before it closed, and the third in a row where **the fix round created the instance rather than
missing it**. It was found by re-deriving the two figures the fix round had newly introduced — the
file count, and the `dist/` regeneration claim, which held — rather than by re-reading for the
wording of any finding above.

**No round 2 was commissioned.** The nine findings were prose in a record describing a step that
changes no tracked source file; all nine were closed by narrowing claims rather than by adding new
ones; and the one instance the fix round created was found and recorded by the sweep that this
project's history predicts is necessary. The decision and its reason are recorded here so that a
later session can disagree with it knowingly.
