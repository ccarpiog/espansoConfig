# Review of Phase 2c-4b step 3d-2a — rebuilt window-reading instrument

This review checked `2c-4b-3d-2a-instrument-rebuild.md` against the rebuilt scratch tree, all six
raw `probe.log`, `probe.err`, and `bytes.txt` artifacts, the surviving TypeScript and Rust probe
sources, the three construction records, and step 3d-1's §7 screen-reading work list. Counts and byte
predicates below were re-derived from those artifacts rather than accepted from the deliverable's
summary table.

## 1. Does the record claim anything the artifacts do not support?

- **Medium — The opening turns evidence about two rebuilt fixtures into a claim about every
  fixture.** The record says, **“§4.2 gives the observation that proves they are not byte-identical to
  the originals”** (`docs/decisions/2c-4b-3d-2a-instrument-rebuild.md:14-18`). Section 4.2 and the raw
  transcripts supply old-versus-new digests only for `base-r0.yml` and `elsewhere-r1.yml`: P01
  `probe.log:8` prints `91f2c4df… / cfa69124… / cfa69124…`, while
  `2c-4b-3b-instrument.md:188-189` records `507e98f5…` and `31be59eb…`. There is no surviving original,
  old digest, or before-manifest for the other seventeen fixture files. Section 4.2 itself correctly
  narrows the contradiction to **“R0 and `elsewhere-r1.yml`”** at lines 203-208; the opening must use
  that same scope.

- **Low — The fixture-provenance sentence omits the third source it actually used.** The record says,
  **“every fixture here is re-authored from the descriptions in `2c-4b-3b-instrument.md` §4 and
  `2c-4b-3c-1-notes.md` §2”** (`2c-4b-3d-2a-instrument-rebuild.md:14-17`).
  `reordered-beta-first-r1.yml` and `mover-end-expected.yml` instead come from
  `2c-4b-3c-2-window-reading.md` §1.3 (lines 98-110), as the record's own file table correctly says at
  lines 69-70. The opening's exhaustive **“every fixture”** claim is therefore false as written.

- **Low — Two historical no-change claims have no before-image.** The categorical sentences
  **“this step did not touch any of them”** and **“No source file in the repository was changed”**
  (`2c-4b-3d-2a-instrument-rebuild.md:9-12`, `:50-54`) cannot be verified from the retained artifacts.
  `manifest-3d-2a-post.sha256:33-34` binds only the post-step versions of the two probe sources, and
  the record itself concedes at lines 72-76 and 320-323 that no 3c-2 manifest survives. Current
  `git diff` does confirm exactly the four expected hook lines and current `git status` confirms the
  two modified hooks, two untracked probe files, and this untracked record; it cannot establish what
  this step did not alter before that post-image was made.

- **Low — “Freshly built” is not bound by a retained build artifact.** The recipe says the script
  **“assembles the `.app` from the freshly built binary”**
  (`2c-4b-3d-2a-instrument-rebuild.md:119-124`). `launch.sh:33` accepts an arbitrary existing
  `ECFG_BINARY`, and `launch.sh:103` merely copies it. The six retained app executables are mutually
  byte-identical and currently match `target/debug/espansoconfig`, but neither the 34-entry manifest
  nor a retained build transcript binds that binary to the stated `npm run build` / `cargo build`
  sequence. The record already discloses at lines 341-342 that no gate transcript was retained, so
  the launch artifacts prove which binary bytes ran, not their freshness or source provenance.

- **Observation — The remaining count, structure, geometry, and scoped qualitative claims checked
  out.** The scratch tree has 19 fixture files (10 R0/R1 documents and 9 expected documents), six
  launch directories, and a 34-line manifest; `shasum -a 256 -c` succeeds for all 34 entries. The
  `runPlan` switch (`src/probe.ts:951-999`) and `launch.sh:61-82` each have 20 cases. The six logs show
  all six surfaces, three English and three Spanish picker results, the stated revision relations,
  choice/readiness lines, and the quoted rectangles. Comparing those rectangles with
  `2c-4b-3c-2-window-reading.md` §4.1 (lines 321-328) confirms four exact reproductions and the stated
  +17 px differences for P02 and P05. The dead scratch path and both old manifest names are absent;
  the replacement path contains the sole `launch.sh` found under `/private/tmp` at depth eight.

## 2. Are the six proof launches proof of what the record says?

- **Observation — All six raw transcripts reached `--- end`, and none contains `--- failed`.** The
  terminal line is P01 `probe.log:37`, P02 `:36`, P03 `:34`, P04 `:23`, P05 `:37`, and P06 `:49`.
  A literal search of each complete log finds zero `--- failed` lines. Each corresponding
  `probe.err` has an observed size of 0 bytes, agreeing with `bytes.txt:3` in P01-P06.

- **Observation — The four positives ended at the hand-authored expected bytes and have backups.**
  The raw `bytes.txt` files report `bytes=MATCH` and `backups=PRESENT` for P01
  (`editor-exact-expected.yml`, lines 4-5), P03 (`creator-front-expected.yml`, lines 4-5), P05
  (`deleter-exact-expected.yml`, lines 4-5), and P06 (`duplicator-exact-expected.yml`, lines 4-5).
  Independent `cmp` of each retained `xdg/espanso/match/conflict.yml` against that named fixture also
  returns equal, and each retained launch tree contains
  `xdg/espanso/.espansoconfig-backups`. Their logs provide the surface-specific path evidence: P01
  lines 25-36, P03 lines 27-33, P05 lines 24-36, and P06 lines 23-48.

- **Observation — The two refusals ended byte-identical to R1 with no backup directory.** P02
  `bytes.txt:4-5` says `MATCH against target-changed-r1.yml (R1)` and `backups=none`; P04
  `bytes.txt:4-5` says the same for `elsewhere-r1.yml`. Independent `cmp` of both retained targets to
  those R1 files succeeds, and a directory search under each launch finds no
  `.espansoconfig-backups`. P02 `probe.log:23-35` shows the pressed refusal and resulting
  `manualResolution` blocks; P04 correctly stops with the raw surface's absent reapply controls at
  lines 12-23.

- **Observation — The six launches prove exactly the bounded conjunction the record assigns them.**
  The three printed revisions in every log have `expected != found` and `diskRevision == found`; the
  control and action path required for that surface is present; and the raw byte predicates above
  hold. This does not mechanize the conjunction or prove mechanism, command history, human
  readability, or any of the fourteen unlaunched cases, matching the limits at
  `2c-4b-3d-2a-instrument-rebuild.md:267-318`.

## 3. Is the rebuilt instrument sufficient for step 3d-2b's work list?

- **High — No case can draw `browser.notice.gone`.** The missing artifact is an R0/R1 pair and plan
  that retain a selection at a position which ceases to exist after R1 shortens the sequence.
  Step 3d-1 reworded `gone` in both languages and explains the earlier-deletion length case
  (`2c-4b-3d-1-notes.md:81-89`), while 3c-2 records that its predicate is the length check
  `view.matches[previous.position] === undefined` and that it **“was not drawn in any launch”**
  (`2c-4b-3c-2-window-reading.md:886-900`). The surviving driver always selects `:beta`
  (`src/probe.ts:682-686`, and `openSnippet(TARGET_TRIGGER)` in every selection-holding plan), which is
  position 1 in `base-r0.yml`. The shortest rebuilt R1, `fixtures/target-deleted-r1.yml:2-6`, still has
  two items, so position 1 exists and the `gone` length predicate cannot fire. None of the 20 case rows
  changes the selected trigger or supplies a shorter R1. The record's claim that this rebuild exists
  **“before 3d-2b depends on it”** (`2c-4b-3d-2a-instrument-rebuild.md:3-7`) and its §6 limits omit this
  strand-the-reading gap.

- **High — No fixture makes a drafted editor field newly ineligible.** The missing artifact is the
  R0/R1 pair required to draw the ineligibility half of
  `browser.matchEditor.reapply.fieldCollisions`. Step 3d-1 explicitly says **“No fixture that makes a
  field ineligible. §11.5's arm remains without a screen behind it”**
  (`2c-4b-3d-1-notes.md:514-515`), and its §7 requires the corrected `fieldCollisions` sentence in full
  in both languages (`:477`). All rebuilt editor R1 files retain an ordinary editable `replace:` field:
  `elsewhere-r1.yml`, `target-changed-r1.yml`, `target-labelled-r1.yml`,
  `target-satisfied-r1.yml`, and both `:beta` items in `target-ambiguous-r1.yml`; the deleted-target
  fixture reaches the separate missing-target refusal. Thus `editor-collision` can draw only the
  already-measured value-collision subcase described at
  `2c-4b-3c-2-window-reading.md:442-457`, not the predicate arm for which the text was corrected.

- **Observation — The other §7 paths have corresponding cases, though several remain unproved in
  this rebuild.** Refused reapply/report-position and optional second-press paths exist for all five
  match surfaces through `editor-collision`, `creator-anchor`, `deleter-changed`,
  `duplicator-changed`, and `mover-changed`, with `:twice` handled by `src/probe.ts:653-680`.
  Successful reapply cases exist for all five through `editor-exact`, `creator-front`,
  `deleter-exact`, `duplicator-exact`, and `mover-exact`; the first four were proved in P01/P03/P05/P06,
  while `mover-exact` was not launched. `editor-fallback` supplies §7(e)'s L43-L44
  `differentMatch` pair. RawEditor has the intended no-reapply `raw-negative` case. Existence is
  sufficient to schedule those readings, but the record correctly warns at lines 289-312 that the
  unlaunched rows and expected files are predictions rather than observations.

## 4. Are the deviations and bounds complete and stated at the right strength?

- **High — The bounds are incomplete because they never disclose the two missing §7 cases.** Section
  6 says **“3b §8 and 3c-1 §7 are inherited whole, and this section adds what this step's own shape
  costs”** (`2c-4b-3d-2a-instrument-rebuild.md:267-270`), but the actual downstream work list is the
  newer `2c-4b-3d-1-notes.md` §7. Neither §6 nor the deviations section states that `notice.gone` is
  unreachable or that the newly-ineligible `fieldCollisions` arm has no fixture. Those are not merely
  unlaunched rows; the necessary cases do not exist at all, as the two High findings in question 3
  establish.

- **Observation — The re-authorship deviation is disclosed, but its proof must remain limited to two
  files.** Section 5.2 accurately says the fixtures are re-authored and identifies the unconstrained
  leading comment (`2c-4b-3d-2a-instrument-rebuild.md:221-225`). The current R0 digest `91f2c4df…`
  differs from 3b's `507e98f5…`, and current `elsewhere-r1.yml` `cfa69124…` differs from `31be59eb…`.
  The revision implementation is unchanged between the 3c-2 commit and HEAD and is SHA-256 over file
  bytes (`crates/espansoconfig-core/src/watch/mod.rs:33-43`), so those two byte differences are
  established. No equivalent old evidence exists for the other seventeen files; this is the scope
  correction required by question 1's Medium.

- **Observation — The unlaunched-case and expected-byte bounds are arithmetically exact and stated at
  the right strength.** The six distinct cases in P01-P06 leave 14 of the 20 switch/table cases
  unlaunched, exactly the names at `2c-4b-3d-2a-instrument-rebuild.md:289-299`. Four positives compare
  four distinct authored expected files, leaving five of nine uncompared, exactly the list at lines
  301-312. The record calls the latter predictions and directs a later `DIFFER` to the fixture first;
  it does not turn existence into proof.

- **Observation — The geometry deviation and causal bound are accurate.** Raw P05 reports English
  deleter `491x758` (`probe.log:8`) against `491x741` in 3c-2 §4.1; P02 reports Spanish mover
  `491x775` (`probe.log:7`) against `491x758`. The +17 px arithmetic is correct. The record names both
  intervening component changes and re-authored fixture text and says **“this step separates neither”**
  (`2c-4b-3d-2a-instrument-rebuild.md:187-197`), which is the strongest conclusion these artifacts
  support.

- **Observation — The nine enumerated implementation deviations are otherwise present in the
  scratch artifact.** The stable scratch path, re-authored fixtures, synthetic `default.yml`, two-part
  backup search and its empty-directory limitation, `expect=` line, post-wait `pkill`, hand-assembled
  bundle, P-prefix names, and 34-entry post-image described in §5 correspond to `launch.sh:31-33`,
  `:91-120`, `:149-194`, the launch directory names, and the manifest. No additional difference from
  the cited old recipe was found beyond the two missing downstream cases and the provenance/freshness
  qualifications already reported.

## 5. Are the two corrections right and discoverable?

- **Observation — “Twenty cases, not nineteen” is correct and discoverable.** Independent counts give
  20 `case` arms in `src/probe.ts:951-999` and 20 rows in `launch.sh:61-82`. The scratch tree has 19
  fixture files: 10 R0/R1 documents plus 9 expected-byte documents. The correction appears under the
  dedicated heading **“Two things the step brief said that the surviving driver corrects”** at
  `2c-4b-3d-2a-instrument-rebuild.md:83-94`, is repeated in `launch.sh:5-8`, and the complete table is
  in `launch.sh`; a later reader will find it.

- **Observation — `BLOCK_TEXT_LIMIT` is 4000, and the correction is correctly sourced and placed.**
  `src/probe.ts:397` defines `const BLOCK_TEXT_LIMIT = 4000`, used by `reportReapply` at line 438 and
  `reportFinal` at line 457. `2c-4b-3c-1-notes.md:290` is the stale 1500 figure, while
  `2c-4b-3c-2-window-reading.md:82-90` explicitly records the 1500-to-4000 change. The rebuild record
  puts the correction beside the case-count correction at lines 83-94, so it is discoverable without
  reconstructing the history.

## Verdict

**NOT READY** for step 3d-2b. The six proof launches are sound for the six cases they actually ran,
but the instrument has no case capable of drawing `browser.notice.gone` and no fixture capable of
drawing the newly-ineligible arm of `fieldCollisions`; proceeding would strand two explicit §7 screen
obligations in exactly the way an absent fixture pair stranded the earlier reading.
