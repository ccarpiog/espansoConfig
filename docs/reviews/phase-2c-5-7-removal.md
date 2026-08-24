# Review — phase 2c-5 step 7 (the instrument's removal) and the phase closure

Commissioned by the orchestrator; the reviewer's sandbox was mounted read-only, so this round is
captured here verbatim under the standing capture rule (the reviewer's final message is the
deliverable). The reviewer's environment note and session line are retained at the end.

## Round 1

1. **Severity: High — phase closure lacks final on-file closure for steps 1–3.**
   **Exact files/sections:** [phase-2c-5-1-confirmation.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-5-1-confirmation.md:1) ends `VERDICT: NOT READY`, with a High explicitly not closed at line 33. [phase-2c-5-2-confirmation.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-5-2-confirmation.md:1) likewise ends `VERDICT: NOT READY`. The fourth-pass verdict in [phase-2c-5-3-confirmation.md](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-5-3-confirmation.md:114) leaves M5 and L3 outstanding. No later READY or explicit owner-equivalent closure for these steps exists under `docs/decisions/` or `docs/reviews/`; their completion appears only in `PROGRESS.md`.
   **What would discharge it:** Add or capture final review files under `docs/reviews/` confirming the recorded fixes and returning READY, or add explicit owner-authorized equivalent closure records under `docs/decisions/` that enumerate and accept the unreviewed changes. Phase 2c-5 cannot close until all three have an on-file closure.

2. **Severity: Medium — the record repeats an unverifiable command-history claim rejected by the precedent.**
   **Exact file/section:** [2c-5-7-notes.md §4](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-7-notes.md:315), especially lines 317–318: "exactly one git command" and "No `git add`, no commit, no stash, no blanket checkout." Current status and diff prove the resulting tree, not which commands were or were not run earlier. The preceding phase's removal review rejected this exact evidentiary shape.
   **What would discharge it:** Replace the chronology with observable facts: the current tracked tree matches `HEAD`, the two probe sources are absent, and the only untracked path is this record. State any command prohibition as a prescribed rule rather than as proven history.

3. **Severity: Medium — the final status sentence is false of the tree containing it.**
   **Exact file/section:** [2c-5-7-notes.md §5](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-7-notes.md:332), line 339 says the working tree is "byte-identical to `HEAD` with this record as its only addition." `git status --short --untracked-files=all` reports `?? docs/decisions/2c-5-7-notes.md`; therefore the working tree is not byte-identical to `HEAD`.
   **What would discharge it:** Say: "Every tracked file is byte-identical to `HEAD`, and this record is the only non-ignored untracked path."

4. **Severity: Low — a residue-search count is false of the unchanged searched corpus.**
   **Exact file/section:** [2c-5-7-notes.md §1.5](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-7-notes.md:145), lines 154–159. Re-running the stated broad case-insensitive `probe` search outside `docs/` and `PROGRESS.md` returns **29 files**, not 30. The targeted harness-identifier search correctly returns nothing. The documentation identifier search now returns 30 because this newly written record is the additional document, consistent with 29 before it was created.
   **What would discharge it:** Correct the broad-search figure from 30 to 29 and retain the temporal qualification on the documentation count.

The observable removal outcome otherwise agrees with the specification: `git diff HEAD` is empty; status contains exactly the step record; both probe sources and all five named `/private/tmp` targets are absent; the hook identifiers are absent from the reverted source files; the targeted residue search is empty; `cargo fmt --check` is clean; the core dependency tree contains no Tauri dependency; and the retained bundle has server tokens absent and client tokens present. The four residual rebindings are honestly classified as deleted-not-closed.

### Phase closure

| Step | Record/review files | Closure state |
|---|---|---|
| 1 | `phase-2c-5-1-code.md`; `phase-2c-5-1-confirmation.md` | **Not closed on file:** final verdict is NOT READY. |
| 2 | `phase-2c-5-2-code.md`; `phase-2c-5-2-confirmation.md` | **Not closed on file:** final verdict is NOT READY. |
| 3 | `2c-5-3-notes.md`; `phase-2c-5-3-code.md`; `phase-2c-5-3-confirmation.md` | **Not closed on file:** final review leaves M5 and L3. |
| 4a | `2c-5-4a-notes.md`; `phase-2c-5-4a-code.md`; `phase-2c-5-4a-confirmation.md` | Equivalent closure: confirmation says ready after its Low correction, which the decision record contains. |
| 4b | `2c-5-4b-notes.md`; code review and confirmation rounds 1–4 | Equivalent closure: round 4's sole Low is corrected in decision-record §12. |
| 5a | `2c-5-5a-instrument-rebuild.md`; instrument reviews rounds 1–7 | Equivalent owner closure in §16; explicitly no READY and the declined eighth round is recorded. |
| 5b | `2c-5-5b-instrument-cases.md`; `phase-2c-5-5b-instrument.md` | READY, no findings. |
| 6a | `2c-5-6a-instrument-extension.md`; instrument review and round 2 | READY in round 2. |
| 6b | `2c-5-6-window-reading.md`; `phase-2c-5-6b-reading.md` | READY in round 2. |
| 7 | `2c-5-7-notes.md`; this review | **Not ready:** findings above. |

The next phase must explicitly inherit:

- The four probe-writer pathname rebindings as deleted, never proven closed; any rebuilt harness inherits them.
- The four live-window-unreachable states: open-surface refusal, adoption `alreadyThere`, adoption `refused`, and committed-but-reprojection-failed.
- The unmeasured enabled-state half of the conflict-moment covering.
- The lack of real Tab/default keyboard activation evidence and the limited pointer-path evidence.
- The no-command-counter/no-invoke-spy limitation: unchanged final bytes do not distinguish no write from an identical or transient write.
- The fifteen corpus fixtures and the owner's real configuration remain unexercised by the window harness.

I could not create `docs/reviews/phase-2c-5-7-removal.md` because the workspace is mounted read-only.

Codex session ID: 01a034ae-85d6-7502-b0e4-e1315f7a91f1

## Round 2

Captured verbatim by the orchestrator; the reviewer's sandbox was again read-only.

VERDICT: NOT READY

1. **Medium — `crates/espansoconfig-core/src/persist/backup.rs:2097–2101` — marker prose still claims provenance.** The comment says the marker file "says this application minted this batch" and is what rotation "trusts." Its generic, forgeable contents establish only recognition and rotation eligibility, as the same file correctly states at lines 2135–2139. This is a narrower instance of the marker/provenance finding's shape.
   **Discharge:** Describe it as writing the recognition marker that makes the newly created directory eligible for rotation, explicitly without proving who created the directory.

The four round-1 findings are otherwise discharged: the commissioned rounds plus the three fixes close steps 1–3; the command chronology is framed as prescription; the status claim is properly scoped; and the independently re-measured counts are 29 outside docs/`PROGRESS.md` and 30 documentation files including the record. Phase 2c-5 remains open solely on the finding above.

Codex session ID: 01a034c1-04de-74b0-adac-a75038e7c977

## Round 3

READY — step 2c-5-7 closes, and with it phase 2c-5.

The sole Round 2 finding is discharged at
`crates/espansoconfig-core/src/persist/backup.rs:2097–2104`. The current text is:

> Writes the recognition marker that makes this newly created directory
> **eligible for rotation** — proving nothing about who created it, since
> anything able to write here can forge one.
>
> A timestamp-shaped name is a shape, and a shape is not a claim of ownership: a
> user, an archiver or another program can create one innocently, and [`rotate`]
> would then recursively delete it. The marker is what rotation actually
> recognises, and recognition is not provenance.

I independently re-ran the requested case-insensitive sweep over
`crates/espansoconfig-core/src/persist/` and
`crates/espansoconfig-core/tests/persist_backup.rs`, then read every hit in context.
Every hit classifies as (a) discharged/factual/recognition-not-provenance; there are
no (b) live findings:

- Explicit recognition-not-provenance or anti-provenance statements:
  `persist/mod.rs:62–63`; `backup.rs:66–86`, `196–199`, `1272–1273`,
  `2097–2104`, `2131–2142`, `2323–2324`, `2966–2970`, `3427–3434`,
  `4469–4475`; and `persist_backup.rs:156–160`. These expressly deny that a
  name or forgeable marker proves authorship, creation, preserved bytes, or
  provenance.
- Factual statements about a directory/root the executing session, helper, or
  test itself creates: `backup.rs:18–26`, `264–274`, `323–324`, `606–609`,
  `809–812`, `982–990`, `2217–2218`, `2329–2340`, `2980–2984`, `3393–3399`,
  `4044–4058`, `4379–4396`, `4696–4700`, `4796–4803`, `4900–4902`; and
  `persist_backup.rs:347`, `523–529`, `576–580`, `594–595`, `960–968`,
  `1044–1046`. None infers creation from a marker or name; each describes the
  operation under test or the session that actually performed creation.
- Grammar/name-generation statements: `persist_backup.rs:7–9` and
  `backup.rs:1387–1398`, `2396–2407`, `2564–2567`, `4083–4098`. Here “trusts”
  and “mints” describe the strict grammar or the set of names/stamps the module
  generates. The nearby contracts explicitly say a name is only a shape and
  require a forgeable marker solely for recognition, so these do not claim
  creator proof.
- The identity-recheck hit at `backup.rs:2753–2761` says an identity is not
  trusted from when the identity value was minted and immediately allows an
  admissible identity that never resolved. It attributes no provenance to the
  directory.
- The remaining `minted`/`mints`/`provenance` hits in
  `persist/save.rs:834–835`, `1322–1332`, `1463–1470`, `1534–1543`,
  `2220–2227` and `persist/write.rs:411–416`, `1217–1222` concern fresh temp
  names, candidate-byte provenance, parser-result attribution, node numbers, or
  temp-name collision retries. They do not concern backup-marker or batch-name
  provenance.
- The non-comment `minted` identifier/test-name hits at
  `persist_backup.rs:602`, `626`, `635`, `638` and `backup.rs:4087`, `4098`,
  `4382`, `4396` are factual bookkeeping or test names for values/directories
  those tests create; they make no marker-based inference.

The additional marker/ownership-shaped reads at `backup.rs:246–257`,
`379–385`, `2045–2056`, `2396–2407`, `2621–2624`, `2954–2970`,
`3427–3434`, `4044–4055`, `4506–4535`, `4796–4798`,
`persist/save.rs:767–770`, and `persist_backup.rs:682`, `942–952`,
`965–968` are likewise either explicit recognition language, descriptions of
concrete code-created fixtures, or bookkeeping/path names. None claims that the
marker or a timestamp-shaped name establishes provenance, ownership, or who
created a directory.
