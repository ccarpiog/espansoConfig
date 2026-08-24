# Phase 2c-5-6a — instrument extension review (round 1)

> **Capture note.** The reviewer's sandbox was read-only and no review file was created,
> exactly as happened in 5a's rounds 6 and 7 and in 5b's round 1. The orchestrator captured
> the reviewer's final message below verbatim, unedited and unabridged, under the standing rule
> that a sandbox limit must not affect the verdict. The Codex session id at the foot is part of
> the captured message.

---

The workspace is read-only, so no review file was created.

## Findings

1. **Medium — the new driver documentation falsely claims that committed unparseable YAML causes reprojection failure.**

   Evidence:

   - [src/probe.ts](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:1043) says the `findings` tail commits and its “window-side re-read fails on the same unparseable text.”
   - [src/probe.ts](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:1372) repeats that the text does not parse, “so the window’s own re-read fails” and `windowOutOfStep` appears.
   - The shipped implementation does the opposite. [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:3444) treats reprojection as failed only when `commands.getDocument` returns `!fresh.ok`; otherwise it installs the returned projection at line 3451. A parse diagnostic is therefore not an IPC read refusal.
   - P60 confirms the successful path: `/private/tmp/espansoconfig-harness-2c-5/launches/P60/probe.log:20-22` has `replaced=present`, `nothingToWrite=absent`, and `windowOutOfStep=absent`.
   - The decision record itself correctly recognizes this at [2c-5-6a-instrument-extension.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:277) and in §6.4 at lines 391–402.

   Action: correct both `src/probe.ts` comments to state that unparseable text reprojects as a successful projection carrying diagnostics, as P60 demonstrates. Do not describe this tail as reaching committed-but-reprojection-failed.

2. **Low — the decision record misstates two geometry transcript readings.**

   Evidence:

   - [2c-5-6a-instrument-extension.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:245) says P58’s five controls have `hit=isTheControl`, then parenthetically acknowledges the entry row was `descendantOfTheControl`. The actual P58 transcript has four `isTheControl` results and one `descendantOfTheControl`: `/private/tmp/espansoconfig-harness-2c-5/launches/P58/probe.log:14-18`.
   - [2c-5-6a-instrument-extension.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:298) calls P62’s four off-screen controls “catalogue controls.” The transcript identifies them as `Close`, `List them again`, the batch row, and the entry row; only the latter three are catalogue controls: `/private/tmp/espansoconfig-harness-2c-5/launches/P62/probe.log:24-27`.
   - The viewport summary at record lines 194–195 also mentions `1080x728` only for P62, while `/private/tmp/espansoconfig-harness-2c-5/launches/P61/probe.log:3` and `P62/probe.log:3` both report that width.

   Action: describe P58 as four direct-control hits plus one descendant hit; call P62’s four entries “upper-pane controls” or enumerate them; include P61 among the `1080x728` launches.

## Verified areas

- The four unreachability arguments are supported by the shipped code:

  - Open-surface refusal: [DetailPane.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/DetailPane.svelte:664) makes all write surfaces mutually exclusive, and its `{#if}/{:else if}` rendering chain at lines 828–959 prevents another surface from coexisting with restore.
  - Persistent `targetMoved`: [RestorePane.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/RestorePane.svelte:387) re-observes the projection; [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1675) re-points a moved non-null revision through `measuredAgainst`, while [restore.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/restore.ts:1746) orders `alreadyRestored` ahead of `targetMoved`.
  - Adoption `alreadyThere`/`refused`: their guards are exactly at [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:2045), including `alreadyThere` at line 2111 and the generation refusal at line 2119. No reachable restore-pane control independently moves the projection.
  - Committed reprojection failure: [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:3444) requires the post-commit `getDocument` call itself to fail. Existing restore inputs and writers cannot deterministically interpose a non-UTF-8, missing, or unreadable target between commit and that read.

- All seven new `launch.sh` case rows and their fixtures agree with the driver dispatch.
- The seeded catalogue matches `backup.rs`: `.espansoconfig-backups`, mode `0700`, valid `2026-08-20T101500Z` grammar, `.espansoconfig-batch` containing `espansoconfig-backup-batch 1\n`, and `match/conflict.yml` mapping.
- The three junk shapes correctly produce `ForeignName`, `NotADirectory`, and `NoMarker`; none produces `Unreadable`.
- The live byte fixtures match the record’s hashes. The preview fixture is 82 bytes and contains BOM `ef bb bf`, CRLFs, BEL `07`, and a bare CR `0d 20`; the non-UTF-8 fixture starts with `ff`.
- `launch.sh` records its filesystem predicates independently and performs no logical conjunction.
- The 6a manifest verifies all 38 entries.
- `src-tauri/src/probe.rs` has the same SHA-256 digest, `19747e8c…`, in both 5b manifests and the 6a manifest. Its `TARGET_TAIL` remains `xdg/espanso/match/conflict.yml`; confinement was not widened.
- Git state is the expected two modified hooks, two untracked probe files, and the untracked 6a record. The hook diff remains five insertions and one deletion.
- P54 is honestly retained as the symlink-loop demonstration: its `tree.diff` contains exactly two “Directory loop detected” lines. P55 supersedes it with `tree-diff=0`.
- P57 is honestly superseded: its retained entry is 77 bytes with digest `545f8642…` and no bare CR; P58 uses the corrected 82-byte fixture.
- P55–P62 byte lines otherwise support the record. P60’s minted batch contains exact R0 bytes, while P62’s minted batch contains exact `elsewhere-r1.yml` bytes.
- The defect-shape sweep found no new check-and-spend result discard, no harness conjunction, and no unbounded final-state absence claim. The material over-claim found is finding 1.

**NOT READY**

Codex session ID: 01a033ec-9cd5-7053-9a56-31cfa036168a
Resume in Codex: codex resume 01a033ec-9cd5-7053-9a56-31cfa036168a
