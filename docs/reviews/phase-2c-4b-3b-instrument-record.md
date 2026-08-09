# Phase 2c-4b step 3b — review of the instrument record

The subject is `docs/decisions/2c-4b-3b-instrument.md`, audited sentence by sentence against the
harness, the launch script and the retained transcripts. Round 1, Codex.

# Verdict: NOT READY

The recorded byte outcomes are largely accurate, but the document repeatedly labels compatible outcomes as proof of internal mechanism. It also overstates what `--- end`, the absent-plan hooks, and the retained gate evidence establish.

## Findings

### High — §4 claims internal mechanisms the cases cannot distinguish

The “What it proves” column at [2c-4b-3b-instrument.md:121](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:121) overstates several cases:

- Line 123 says the editor proves “**the exact-item tier**.” L02 proves the final bytes: `bytes=MATCH` ([L02/bytes.txt:4](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L02/bytes.txt:4>)), with the external alpha edit and drafted beta edit both present ([L02/bytes.txt:14](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L02/bytes.txt:14>)). It cannot distinguish exact-digest correspondence from trigger fallback, as §8.6 itself admits at [lines 287–291](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:287).

- Line 125 says creator-front proves creation “**needs no correspondence**” and “**is revalidated against the new destination**.” L16 establishes only that the control was pressed, a conflict/reapply path was displayed, and the expected final bytes resulted ([L16/probe.log:8](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L16/probe.log:8>), [L16/bytes.txt:4](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L16/bytes.txt:4>)). It does not observe revalidation or correspondence internally.

- Line 126 says an `After` placement “**resolves its anchor**” and “refuses before writing.” L17 shows the displayed anchor-refusal sentence ([L17/probe.log:16](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L17/probe.log:16>)) and an unchanged R1 with no backup ([L17/bytes.txt:4](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L17/bytes.txt:4>)); it does not independently verify that anchor resolution caused the refusal.

- Lines 127 and 129 claim “**strict owned-run correspondence**” and that the clone uses the “**newly adopted** item’s bytes.” The target’s bytes are identical in R0 and `elsewhere-r1.yml` ([base-r0.yml:5](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/fixtures/base-r0.yml:5>), [elsewhere-r1.yml:5](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/fixtures/elsewhere-r1.yml:5>)). Consequently, L10 and L13 cannot distinguish an adopted target from the old target; they establish expected deletion/duplication bytes and renewed controls only ([L10/probe.log:13](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L10/probe.log:13>), [L13/probe.log:15](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L13/probe.log:15>)).

- Line 131 says mover-exact proves `top` was “**lowered afresh against the new sequence**” and moved the target “rather than its former index.” But `elsewhere-r1.yml` does not reorder the sequence ([elsewhere-r1.yml:3](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/fixtures/elsewhere-r1.yml:3>)). Old-index and freshly lowered implementations yield the same L05 result. Section 8.5 concedes the missing reordered case at [lines 280–285](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:280), directly contradicting the §4 “proves” wording.

Correction: rename the column to “Observed result” and describe only displayed outcomes and final-byte predicates. Retain the mechanism claims as hypotheses covered by the cited Rust tests, not as conclusions of this instrument. Expand §8.6 to name creator revalidation, anchor resolution, owned-run correspondence, adoption, and move lowering—not only editor fallback.

### High — `--- end` does not prove that the plan finished successfully

Section 8.9 says: “**`--- end` proves the plan finished**” ([2c-4b-3b-instrument.md:301](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:301)). That is false.

`startProbe` catches every plan exception, prints `--- failed`, and then prints `--- end` unconditionally ([probe.ts:668](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:668)). The launch script treats only the presence of `--- end` as `reached-end=yes` ([launch.sh:110](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launch.sh:110>)). L07 demonstrates the false predicate exactly:

> `--- failed timed out waiting for the deletion request control`  
> `--- end`

([L07/probe.log:4](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L07/probe.log:4>)).

Likewise, `reportConflict` labels any last status block containing one long hexadecimal run as `outcome=conflict`; it does not assert three revisions, `expected != found`, or `diskRevision == found` ([probe.ts:344](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:344)).

Correction: say that `--- end` proves only that the outer probe wrapper reached its final logging statement. Explicitly admit that success is a human conjunction: no `--- failed`, the expected conflict/revision lines, the expected control/action lines, and the intended byte predicate. The stored successful cases satisfy that conjunction, but the harness itself does not enforce it.

### Medium — §8 omits two material limits

Section 8.5 says, “**Q7 asks for more cases than section 4 builds**” and lists missing fixture shapes ([2c-4b-3b-instrument.md:280](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:280)), but omits:

1. **Incomplete bilingual surface coverage.** Spanish was exercised only for editor (L19), mover refusal (L20), raw (L22), and deleter positive (L23). Creator and duplicator have no Spanish launch, and mover has no Spanish positive. Compare [L19/probe.log:1](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L19/probe.log:1>) through [L23/probe.log:1](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L23/probe.log:1>) with Q7’s “Across the matrix, read both languages” requirement ([phase-2c-4b-design.md:150](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-4b-design.md:150)).

2. **No proof that a refusal issued no save command.** Section 5 says no backup is “the strongest available statement that the transaction never reached its write” ([2c-4b-3b-instrument.md:162](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:162)). Final R1 bytes and no backup prove final filesystem state, not whether a command was invoked or whether an identical/transient write occurred. The harness has no invoke spy or command counter; `reportReapply` only prints status blocks ([probe.ts:391](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:391)). This matters because Q7 explicitly requires “no save command is issued” ([phase-2c-4b-design.md:144](/Users/ccarpio/Developer/espansoConfig/docs/reviews/phase-2c-4b-design.md:144)).

Correction: add both limitations to §8 and narrow “transaction never reached its write” to “the retained artifacts show final bytes exactly R1 and no backup directory.”

### Medium — absent probe variables still change the instrumented application

Section 7 says: “**No production behaviour changed**” ([2c-4b-3b-instrument.md:252](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:252)). The stronger version is not supported.

Even without `ECFG_PROBE_PLAN`:

- `main.rs` uses `register_with_probe` instead of the shipped registration path ([main.rs:123](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/main.rs:123)).
- That registers three extra callable IPC commands ([probe.rs:127](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/probe.rs:127)).
- The frontend always calls `startProbe()` ([main.ts:37](/Users/ccarpio/Developer/espansoConfig/src/main.ts:37)).
- `startProbe()` always invokes `probe_plan` before deciding to return ([probe.ts:656](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:656)).

The safe narrower claim is that, with the variables absent, no plan drives the DOM or invokes the second writer. The instrumented build still has a wider IPC surface and one additional startup IPC round trip.

Correction: replace “No production behaviour changed” with that narrower statement.

### Low — two recorded historical causes are not preserved by the artifacts

The L01 row says “**hung on `requestAnimationFrame`**” and L04 says the absence of `--- end` was fixed by a “**timing fix**” ([2c-4b-3b-instrument.md:81](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:81), [line 84](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:84)).

The retained evidence establishes only:

- L01 printed `--- begin` and nothing further ([L01/probe.log:1](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L01/probe.log:1>)).
- L04 reached the reapply reports, produced matching bytes, but no `--- end` ([L04/probe.log:12](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L04/probe.log:12>), [L04/bytes.txt:2](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L04/bytes.txt:2>)).

The earlier harness revisions containing `requestAnimationFrame` and twelve settles were not retained. The current source uses `setTimeout` ([probe.ts:82](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:82)).

Correction: record those causes as contemporaneous diagnoses, not facts recoverable from the retained artifact; narrow “never fires” to what L01 observed under that launch condition.

### Low — one measured coordinate and the git-status count are wrong

- Section 5 says the report was at “**`y = -87` (L06, L14, L20)**” ([2c-4b-3b-instrument.md:169](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:169)). L20 reports `box=658,-104,491x141` ([L20/probe.log:13](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launches/L20/probe.log:13>)). Correction: list L20 as `y = -104`.

- Section 7 says `git status --short --untracked-files=all` “**shows exactly four files**” ([2c-4b-3b-instrument.md:250](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:250)). It currently shows five paths: the two modified hook files, the two untracked probe files, and the untracked decision record itself. Correction: say “four harness paths, plus this decision record.”

## Answers to the seven questions

1. **Launch results and counts:** The substantive counts are correct: 23 launch directories, 21 with `reached-end=yes`, and all 23 `bytes.txt` files report `probe.err bytes=0`. The five successful positive cases are L02, L05, L10, L13, and L16; their `bytes.txt:4` lines all say `MATCH`. The six canonical refusal cases are L03, L06, L11, L14, L17, and L18; each has `bytes=MATCH` against R1 and `backups=none` at lines 4–5. No §3 row overstates its final byte result, but L01 and L04 overstate the retained evidence for their historical causes. L20’s coordinate is also misstated outside §3.

2. **§4 “what it proves”:** It claims substantially more than the cases distinguish. Exact-tier selection, creator revalidation, anchor-resolution mechanism, strict owned-run correspondence, adoption, and fresh move lowering are not observable from these fixtures. §8.6 recognizes the category but concedes only the editor example and leaves the contradictory “What it proves” wording intact.

3. **Five match surfaces:** Supported for programmatic `HTMLElement.click()`. The relevant present-and-pressed evidence is editor L02 lines 12–13, creator L16 lines 14–15, deleter L10 lines 12–13, duplicator L13 lines 11–12, and mover L05 lines 11–12. Raw absence is shown in both L18 and L22 at line 11. This does not establish mouse, keyboard, focus, or scroll operability; §8.3 correctly admits that limit.

4. **Gate numbers:** The delta account is internally consistent with the repository: 1623/418/175/1086 are recorded before the harness at [2c-4b-3a-notes.md:207](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3a-notes.md:207), and the scanner really does create one test per newly discovered source file ([ipc-detail.test.ts:54](/Users/ccarpio/Developer/espansoConfig/scripts/lint/ipc-detail.test.ts:54), [line 79](/Users/ccarpio/Developer/espansoConfig/scripts/lint/ipc-detail.test.ts:79)). Thus 1624/419/176 and unchanged 1086 have the stated shape; 155 is consistent with an unchanged app-crate test set. However, no raw gate transcript is retained, so the exact successful executions cannot be independently checked from the supplied artifacts. “Unmoved” is evidence of unchanged test count, not broader correctness, and the “exactly four files” status claim is false.

5. **Completeness of §8:** Not complete. It omits incomplete bilingual coverage, inability to prove that no save command was issued, and the fact that `--- end` can follow `--- failed`. It also fails to enumerate the non-editor mechanism ambiguities conceded generically by §8.6.

6. **Harness soundness:** The second writer is a genuine separate `/bin/sh` filesystem process that bypasses workspace/cache ([probe.rs:98](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/probe.rs:98)); its `cp`/`mv` completion is awaited, so writer ordering is not wall-clock scheduled. The evidence is nevertheless not self-validating: failures still produce `--- end`, conflict predicates are printed rather than asserted, and absent variables still leave extra IPC registration plus a startup `probe_plan` invocation. The actual retained successful transcripts can be human-validated despite those harness weaknesses.

7. **Corpus privacy:** No violation found. The launcher constructs synthetic `XDG_CONFIG_HOME` and `HOME` trees ([launch.sh:63](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launch.sh:63>), [lines 99–103](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launch.sh:99>)), and discovery prefers that synthetic XDG tree before the HOME fallback ([discovery.rs:209](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/discovery.rs:209)). The fixtures and transcripts contain only neutral `:alpha`, `:beta`, `:gamma`, and `:probe` content. Nothing inspected reaches or quotes the owner’s real espanso configuration.

Codex session ID: 019fe5e6-8dc4-7f93-bbcf-cd33bf2b0a1a
Resume in Codex: codex resume 019fe5e6-8dc4-7f93-bbcf-cd33bf2b0a1a

---

# Round 2 — the confirmation pass

The fix round rewrote the record 303 → 418 lines. This round audits what the corrected sentences now
say, per the standing rule that a fix is a change and the round reviewing it is not optional.

# Verdict: NOT READY

## Round-1 findings

1. **closed** — §4 now limits the table to observed UI and byte outcomes and explicitly disclaims correspondence, adoption, anchor-resolution, and move-lowering mechanisms ([record:133](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:133), [record:151](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:151)).

2. **closed but introduced “no part is mechanised”** — `--- end` is correctly narrowed to wrapper completion, but §8.9 now denies checks the harness actually performs ([record:382](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:382), [record:391](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:391)).

3. **closed** — §8.10 records incomplete bilingual coverage and §8.11 concedes that the artifacts cannot establish that no save command was issued ([record:403](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:403), [record:412](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:412)).

4. **closed** — §7 now states both residual changes in an unplanned launch: three extra IPC commands and one startup `probe_plan` invocation ([record:309](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:309)).

5. **closed but introduced “a byte match without `--- end` is not evidence”** — the historical L01/L04 causes are properly labelled contemporaneous diagnoses, but L04’s retained byte result is then incorrectly disclaimed ([record:226](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:226), [record:240](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:240)).

6. **closed** — L20 is correctly recorded at `y=-104`, the total is nine negative-y launches, and Git status is correctly described as four harness paths plus the decision and review files ([record:203](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:203), [record:303](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:303)).

## Fix-round self-reported corrections

1. **confirmed** — there are nine launches with negative-y status blocks: L02 (`-102`, `launches/L02/probe.log:14`), L03 (`-53`, `L03/probe.log:14`), L06 (`-87`, `L06/probe.log:13`), L11 (`-87`, `L11/probe.log:14`), L14 (`-87`, `L14/probe.log:13`), L17 (`-87`, `L17/probe.log:16`), L19 (`-170`, `L19/probe.log:14`), L20 (`-104`, `L20/probe.log:13`), and L21 (`-53`, `L21/probe.log:14`) under `/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/`.

2. **confirmed** — no numeric viewport height remains asserted; the record says it was not retained and separately identifies only the configured 1180×760 window, supported by [tauri.conf.json:18](/Users/ccarpio/Developer/espansoConfig/src-tauri/tauri.conf.json:18) and [record:208](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:208).

3. **confirmed** — the control rolls show four choices for editor/creator, three including the requested-action label for mover/deleter/duplicator, and three without either reapply label for raw; they do not expose the internal two-gate evaluation (`launches/L02/probe.log:8-13`, `L05/probe.log:8-12`, `L10/probe.log:9-13`, `L13/probe.log:8-12`, `L16/probe.log:10-15`, `L18/probe.log:8-11`).

4. **confirmed** — the record now limits an unmoved number to evidence of that count alone and admits that no gate transcript was retained; the launch harness writes only launch byte reports, not gate results ([record:291](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:291), `scratchpad/launch.sh:123-141`).

5. **confirmed** — L15’s transcript contains a pane and button dump from which the destination error can be inferred, but contains no disabled-state measurement; §6.6 now says exactly that (`launches/L15/probe.log:7-9`, [record:255](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:255)).

6. **confirmed** — the narrowed “recipe works” claim is supported at the stated case level: the five positive cases match in L02/L05/L10/L13/L16 `bytes.txt:4`, while the six canonical refusal cases match R1 with no backups in L03/L06/L11/L14/L17/L18 `bytes.txt:4-5` ([record:10](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:10)).

## New findings

### Medium — §8.9 over-corrects mechanisation

[record:391](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:391):

> “Success is a human conjunction, and no part of it is mechanised.”

The related sentence at line 397 says:

> “The harness enforces none of it: it prints, and a reader conjoins.”

That is false. `launch.sh` mechanically performs `cmp`, records `MATCH`/`DIFFER`, measures `probe.err`, searches for backups, and produces the tree diff (`scratchpad/launch.sh:123-141`). The probe also waits for required controls and throws when they are absent ([probe.ts:374](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:374)); L07 demonstrates that mechanism (`launches/L07/probe.log:4-5`).

Specific correction: “Overall success is not mechanised as one conjunction. The harness mechanically records wrapper completion, byte equality, backup presence and some required-control waits; a reader must additionally verify the absence of `--- failed`, revision relationships, and the expected transcript sequence.”

### Medium — the opening universal claim is false

[record:18](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:18):

> “Every claim in this record is an observed outcome, and none of it is a proof of mechanism.”

The record itself contains unretained historical diagnoses ([record:226](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:226)), source-derived instrumentation claims ([record:269](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:269)), and gate results for which no transcript was retained ([record:300](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:300)).

Specific correction: replace “Every claim in this record” with “Every conclusion drawn from the launch cases,” or explicitly distinguish observed launch outcomes, source inspection, contemporaneous diagnoses, and unretained gate reports.

### Low — L04’s retained byte evidence is denied

[record:240](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:240):

> “What stands on the artifact alone is the ruling: a byte match without an `--- end` is not evidence…”

L04’s artifact does establish a final byte match and backup presence (`launches/L04/bytes.txt:2-5`). The missing terminator makes it insufficient evidence of complete plan success, not “not evidence.”

Specific correction: “A byte match without `--- end` is evidence of the final byte predicate, but insufficient to count the launch as a completed successful plan.”

### Low — the record claims it is committed while Git says it is untracked

[record:45](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:45):

> “Only this record and `PROGRESS.md` are committed…”

Current status lists the record as `?? docs/decisions/2c-4b-3b-instrument.md`, and §7 itself acknowledges that it and its review remain untracked ([record:303](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3b-instrument.md:303)).

Specific correction: “The harness is deliberately uncommitted. This record and its review are also currently untracked; `PROGRESS.md` is unchanged.”

## Git status / diff

The worktree check passed exactly:

- Modified: `src/main.ts`, `src-tauri/src/main.rs`
- Untracked: `docs/decisions/2c-4b-3b-instrument.md`, `docs/reviews/phase-2c-4b-3b-instrument-record.md`, `src/probe.ts`, `src-tauri/src/probe.rs`
- [src/main.ts](/Users/ccarpio/Developer/espansoConfig/src/main.ts:20) differs only by the `startProbe` import and call.
- [src-tauri/src/main.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/main.rs:47) differs only by `mod probe` and routing the builder through `register_with_probe`.

No files were edited during this review.

Codex session ID: 019fe5f6-801c-7b53-ad0d-fed9567f70a8
Resume in Codex: codex resume 019fe5f6-801c-7b53-ad0d-fed9567f70a8

---

# Round 3 — the narrow pass over the round-2 fixes

Scoped to the five passages the round-2 fix round changed, and to a sweep of that one file for
surviving instances of round 2 four claims.

## Verdict: NOT READY — one finding, and it was the round-2 fix itself

Passages 2 to 5 confirmed correct against the named evidence. Passage 1 was **still a false
universal**: `Every conclusion drawn from the launch cases is an observed outcome` conflicts with
section 6.6, which expressly calls the L15 cause an inference from a dump and from the fix working,
and the three-kind list that followed it omitted both launch-derived inferences and facts read from
the **application's** own source such as section 6.4.

The correction applied: the sentence now claims only the launch-case outcome claims of sections 3 to
5, and the paragraph that follows is explicitly **non-exhaustive** and names five categories,
including application-source facts and launch-derived inferences.

The sweep found **no** survivor of any round-2 claim: no remaining `no part is mechanised`, no
remaining universal `every claim`, no remaining denial of L04 byte evidence, and no present-tense
claim that the record is committed.

---

# Round 4 — the one-paragraph check

Scoped to the single paragraph round 3 sent back, and to nothing else.

## Verdict: READY

The headline sentence scopes cleanly to the launch-case outcome claims of sections 3 to 5, excluding
the L01/L04 diagnoses, the mechanism claims and the account of what `reportConflict` does. The
paragraph beneath it declares itself non-exhaustive and distinguishes application-source facts
(section 6.4) from launch-derived inference (section 6.6). The rewrite introduces no false or
over-strong claim.

**Four rounds, ten findings, and every one of them was prose in the record — no defect in the harness
and none in the application.**
