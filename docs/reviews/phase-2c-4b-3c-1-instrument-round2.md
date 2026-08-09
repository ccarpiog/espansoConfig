# NOT READY

## High

1. [docs/decisions/2c-4b-3c-1-notes.md:387](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4b-3c-1-notes.md:387)

   Exact sentences: “**Q7 is covered case by case**” and “point 6’s three placement shapes … all have a case and a launch.”

   Why wrong: this is the stronger coverage claim that survived after the title was narrowed. The same subsection immediately acknowledges that `end` after reorder remains unbuilt. Therefore Q7 is not covered case by case without qualification, and point 6 is not exhaustively covered.

   Concrete fix: say that every numbered Q7 point has at least one case, while coverage remains bounded; change “point 6’s three placement shapes” to “the three placement shapes built here.” Explicitly assign `end`-after-reorder to the next construction step, not merely “whoever builds next.”

## Medium

2. [launch.sh:50](</private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad/launch.sh:50>)

   Exact code: `# Phase 2c-4b-3c-1's six rows.`

   Why wrong: phase 3c-1 now owns eight rows. The next comment separates the fix round’s two rows, but that does not make the unqualified phase count of six true. This is the “updated everywhere” count residue.

   Concrete fix: change it to “the first draft’s six rows” or consolidate all eight under “Phase 2c-4b-3c-1’s eight rows.”

## Round-1 findings

1. High 1 — **closed but with new residue**. `mover-after-changed` genuinely selects `After :gamma`; R1 changes only `:gamma`, leaves target `:beta` exact, and the refusal names the anchor. The stale six-row count remains.

2. High 2 — **closed but with new residue**. `editor-missing` genuinely removes `:beta`; its report is distinct from the ambiguous-trigger and field-collision reports. The title is bounded, but §7.6 reintroduces a stronger Q7-coverage claim.

3. Medium 3 — **closed**. The source limit is 1500, L37–L39 retain the formerly truncated sentences, §7.3 cites L37/L38, and L27/L30/L34 are marked truncated. L36’s current retained log also contains its complete quoted sentence. The artifacts therefore contradict the prompt’s statement that L35–L36 were captured at 300; they agree with the record’s L35–L39 timeline.

4. Medium 4 — **closed**. The Spanish accounting consistently identifies two previously unlaunched surfaces, one missing mover positive, and the creator refusal.

5. Medium 5 — **closed**. `launch.sh` now expressly disclaims evidence about whether a save command was issued, and the record does not reinstate that guarantee.

6. Medium 6 — **closed**. The manifest is consistently described as a post-image for later comparison, never as proof of non-modification during 3c-1.

7. Low 7 — **closed**. Both the record and `moverPlan` documentation restrict the conclusion to why this anchored move required a driver change.

The retained artifacts otherwise support 8 new cases, 19 total cases, 16 launches, 9 new fixtures, and 8 cases with Spanish launches. L37/L38/L39 are clearly identified as reruns and are not improperly mixed with the truncated quotation evidence.

Codex session ID: 019fe7a2-513a-7b12-930f-7ec8eb6dc05d
Resume in Codex: codex resume 019fe7a2-513a-7b12-930f-7ec8eb6dc05d
