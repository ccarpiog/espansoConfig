> Capture note: the reviewer's sandbox was read-only and could not write this file; the
> orchestrator captured the reviewer's final message verbatim below, exactly as the 5a rounds 6-7,
> 5b round 1 and both 6a rounds were captured. Nothing below this note is the orchestrator's.

# Phase 2c-5-6b review — bilingual restore window reading

The requested file was not written because `docs/reviews/` is read-only in this sandbox.

## Evidence checked

I compared the record directly with retained `probe.log`, `bytes.txt`, and `tree.diff` artifacts for eleven launches: P67, P68, P73, P75, P76, P79, P80, P83, P84, P85, and P86. This spans both parts, both languages, both binaries, the original defect, and its re-takes.

The quoted sentences, geometry, outcome marks, `failed-lines`, `end-lines`, binary digests, and byte-result lines agree with those artifacts:

- P67/P68 contain the stated committed outcome sentences, `replaced=present`, `nothingToWrite=absent`, `windowOutOfStep=absent`, `tree-diff=18`, `entry-cmp=MATCH`, and batch count `1 → 2`.
- P73 contains exactly the two generic refusal sentences and no specific reason.
- P75/P76 contain the 82-byte/80-character preview and the three named BOM/BEL/CR characters, with the stated focus and hit-test results.
- P79/P80 contain the parse refusal, line 3/column 0, acknowledgement re-ask, committed outcome, `tree-diff=14`, and `entry-cmp=MATCH`.
- P83/P84 contain the R0/R1/R1 revisions, conflict choices, maximum scroll positions, disabled covered prepare control, clean conflict-choice hit tests, adoption/re-confirmation chain, and committed outcome.
- P85/P86 contain the added NotUtf8 sentence with offset 0 in the selected language, `candidateStep=absent`, `failed-lines=0`, `end-lines=1`, the new binary digest, and unchanged byte results.

The six recorded by-hand displaced-byte comparisons also reproduce: P67/P68/P79/P80 minted entries equal `base-r0.yml`, and P83/P84 minted entries equal `elsewhere-r1.yml`. Their retained `tree.diff` files contain only the newly minted batch and target-file change.

Across P63–P86, every `bytes.txt` reports `reached-end=yes end-lines=1 failed-lines=0`. P75–P84 all report `visibility=hidden hasFocus=false`; P63–P74 report visible/focused, while P85/P86 again report hidden/unfocused.

## Scope and coverage

The restore-only scoping resolution is supported by the design. Q7 item 6 explicitly enumerates restore catalogue, preview, refusal, confirmation, conflict/adoption, and committed-outcome states. It does not require re-reading the six other write surfaces whose bilingual readings belonged to their own phases.

The §8 coverage table accounts for every Q7 item 6 state in both languages or supplies a 6a §6 unreachability argument. The cited arguments match the code:

- `DetailPane.svelte` renders the seven write modes through one exclusive branch chain and withdraws their openers while `busy`; a shipped-window click sequence cannot retain a competing surface beside restore.
- `targetRevisionObserved` re-points a changed non-null base and withdraws confirmation, preventing a persistent `targetMoved` sentence.
- The reachable restore controls cannot move the projection between conflict arrival and adoption, so `alreadyThere` and `refused` require machinery the instrument lacks.
- Reprojection failure requires a non-UTF-8, unreadable, or missing file during the immediate post-commit read; the available writers cannot deterministically create that interval.

The design’s “where reachable” qualifier is used only for the two unreachable adoption answers. The other dispositions stand on their separate unreachability arguments rather than stretching that qualifier.

## Fix and re-take scope

The product fix follows the required typed-accessor route. `backupReadReasonOf()` narrows only a command-level `backupReadFailed` and returns its typed nested `BackupReadError`; both failed panels render the result through `tBackupReadError`. No key is constructed dynamically.

Both panels shared the same defect shape: `entriesRefused` and `tIpcFailure` each supplied a generic promise while `describeCommandError` could not render the nested reason.

The mounted NotUtf8 case uses offset 7, verifies both generic sentences, the English specific sentence with the transported operand, then the Spanish specific sentence after re-rendering. It also verifies that the Tauri `invoke` mock was not called. The batch-listing case verifies the same typed path with `RootNotADirectory.path`.

The driver’s third wait is dictionary-resolved through:

`named('code.backupReadError.notUtf8', { offset: 0 })`

`src-tauri/src/probe.rs` retains the same SHA-256 recorded in all relevant manifests. The dictionaries have no diff; both specific keys pre-existed in `HEAD`, and English/Spanish retain matching `{offset}` and `{path}` placeholders.

The re-take scope is correct. The component edit affects only `batches.kind === 'failed'` and `entries.kind === 'failed'`; among reachable launch cases, only `restore-notutf8` enters either branch. The driver edit is confined to `reportRefusedEntryRead`, called only by that tail. Consequently P85/P86 are the affected re-takes, while P73/P74 correctly remain as evidence of the pre-fix wording.

## Judgements and gates

The Medium’s disposition is supported: the missing reason was added through the typed accessor, proved in mounted English/Spanish evidence, and re-taken bilingually in P85/P86.

The Low’s disposition is within the evidence. At the measured conflict moment the covered prepare control is disabled; both actionable conflict choices hit-test correctly and take programmatic focus in both languages. The record explicitly leaves enabled-state covering unmeasured and does not claim it either way.

The focus discussion is otherwise bounded honestly: `focused=true` is identified as an in-document `activeElement` reading, not system focus; real Tab traversal and keyboard activation are not claimed; `HTMLElement.click()` is distinguished from pointer evidence.

The prediction/measurement gate table is internally consistent, including the with-harness baseline `1153 / 432 / 2126 / 185`. I did not re-run those gates because the orchestrator’s independent derivation was supplied as authoritative for this review.

## Shape sweep

After the fix, the two generic “beside this” sentences have an actual specific reason beside them for `backupReadFailed`. The candidate’s “written below by name” claim is fulfilled by the immediately following `SourceText`. I found no other restore-surface sentence promising adjacent information that the rendered branch cannot supply.

I found no additional fix-round comment, JSDoc, record sentence, or driver sentence asserting a reach or guarantee contradicted by the component branches or sampled transcripts, apart from the timer/occlusion claim below. The fix does not regress a previously true screen or driver sentence.

## Findings

**Medium — Completed short timer plans do not establish that the hidden launches became unoccluded.** The record derives that P75–P84—and, by reference, P85/P86—could not have remained occluded because every timed wait reached `--- end`. The driver says background timers continue for about six seconds before stopping, however, and these plans impose only 250 ms settles after clicks; successful `waitFor` calls return immediately and impose no minimum duration. Even the reload chain has only roughly three seconds of mandatory settles. Therefore a plan can complete while remaining hidden throughout, and the retained artifacts contain no later visibility reading or timestamp proving otherwise. The claim must be removed or replaced with actual evidence of an unoccluded interval; if unoccluded presentation is a required launch precondition, the affected readings require evidence that satisfies it. [docs/decisions/2c-5-6-window-reading.md:324](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6-window-reading.md:324), [docs/decisions/2c-5-6-window-reading.md:759](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6-window-reading.md:759), [src/probe.ts:21](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:21)

**Low — The limits section miscounts the unreachable coverage states.** Section 8 dispositions four demanded states as unreachable: open-surface refusal, adoption `alreadyThere`, adoption `refused`, and committed-but-reprojection-failed. Section 9 calls these “the three unreachable states of §8.” The table itself is complete, so this is an accounting error rather than a coverage omission, but the count should be four. [docs/decisions/2c-5-6-window-reading.md:622](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6-window-reading.md:622)

VERDICT: NOT READY

Codex session ID: 01a03422-cd9e-7e52-8d3c-df8772c3c2da
Resume in Codex: codex resume 01a03422-cd9e-7e52-8d3c-df8772c3c2da
