# Phase 2c-5-6a — instrument extension review (round 2, scoped to the fix round)

> **Capture note.** The reviewer's sandbox was read-only and no review file was created. The
> orchestrator captured the reviewer's final message below verbatim, unedited and unabridged,
> under the standing rule that a sandbox limit must not affect the verdict. The Codex session id
> at the foot is part of the captured message.

---

The workspace is read-only, so no review file was created.

## Findings

None.

- Both [src/probe.ts](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:1043) and [src/probe.ts](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:1372) now correctly describe successful reprojection with diagnostics. This matches [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:3444), which fails only on `!fresh.ok` and otherwise installs the projection, and [types.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/types.ts:590), where an unparsed document remains a `DocumentView` carrying diagnostics. P60 lines 20–22 confirm `replaced=present`, `nothingToWrite=absent`, and `windowOutOfStep=absent`.

- All three §4 corrections are transcript-exact:
  - [Record lines 245–246](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:245) correctly report P58’s four `isTheControl` hits and one `descendantOfTheControl`.
  - [Record lines 298–300](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:298) correctly enumerate P62’s four off-screen upper-pane controls and distinguish *Close* from the three catalogue controls.
  - [Record lines 194–195](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:194) correctly credit `1080x728` to both P61 and P62.

- [§10](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:469) stays within the evidence:
  - `manifest-2c-5-6a-cases.sha256` has exactly 38 entries; verification from its harness directory produces exactly one mismatch, `src/probe.ts`.
  - `manifest-2c-5-6a-fix.sha256` has exactly two entries, and both current files verify.
  - Its unchanged-gate account matches the post-fix re-derivation supplied in the review brief: cargo 1153/0, svelte-check 432 clean, vitest 2124, build 185, clippy/fmt clean, and bundle oracle absent/2.

- The shape-based sweep found no remaining sentence claiming that the findings tail—or another implemented tail—reaches failed rereading, committed-but-reprojection-failed, or `windowOutOfStep=present`. [src/probe.ts line 1246](/Users/ccarpio/Developer/espansoConfig/src/probe.ts:1246) only defines what the dictionary sentence means. [Record lines 365–367](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-5-6a-instrument-extension.md:365) discuss the hypothetical failed-re-read state while proving another sentence unreachable; they do not claim any tail reaches it.

- The §6.4 clarification accurately distinguishes the absent outcome sentence from P60’s always-emitted `windowOutOfStep=absent` measurement line. No fix-round edit introduces a false replacement or regresses a previously true statement.

READY

Codex session ID: 01a033f6-ea8d-7f61-90c3-ce49536abd29
Resume in Codex: codex resume 01a033f6-ea8d-7f61-90c3-ce49536abd29
