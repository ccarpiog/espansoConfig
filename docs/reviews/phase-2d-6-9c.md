Reviewer: autoclaude adversarial reviewer

# Phase 2d-6-9c — adversarial review

Scope: the working-tree diff of `ReconciliationStatus.svelte` and `ReconciliationStatus.test.ts`, and the two new records. Codex was unavailable, so this is the phase's only review.

## BLOCKERS

None found.

## SHOULD-FIX

1. `docs/decisions/2d-6-9c-notes.md:78`: the clause "A narrow window reading" is marked **met** with no qualification. Ruling 38 (`2d-6-split-notes.md:568-572`) says: "Reuse the harness and `lifecycle-delivery`, touch none of the four instrument paths, inspect a **visible** window". This reading breaks all three.
   - It extended both `src/probe.ts` and `src-tauri/src/probe.rs` (notes §5). 8c changed only `probe.ts`.
   - It ran its own plans, not `lifecycle-delivery`.
   - The window was hidden: "No person looked at a live window" (`2d-6-9c-window-reading.md:20`).

   8c recorded the same three departures as deviations from ruling 38 and marked this clause "met, **with the §5 deviations and two narrowings**" (`2d-6-8c-notes.md:70`, `:140-149`). 9c's §5 calls the probe extension a "deviation" but never says it goes against ruling 38. It does not mention the hidden window or the missing `lifecycle-delivery` at all. Line 83 then states "2d-6-9's whole acceptance is met". Under `CLAUDE.md` §5 this is a claimed guarantee the evidence does not give. The fix is to qualify the clause as 8c did and to carry "a visible-window reading remains owed" into §6.
2. `2d-6-9c-window-reading.md:463` lists "a composited, visible window" as unread. The line after it cites ruling 38 as excluding only wake/resume. It does not say that ruling 38 *requires* a visible window. The unread list should say that plainly.

## Checked and found sound

- **Test discrimination.** The new case reads the `.reconciliation { … }` body from source and matches `max-height:…vh;`, `overflow-y: auto;` and `flex-shrink: 0;`. It would fail without the CSS, and the recorded pre-fix failure agrees. The comment correctly says the case pins the rule, not the layout, and that an overriding rule would defeat it (notes §4). The file ran locally: 34 passed.
- **The fix fits the host.** `.shell` is `flex-direction: column; height: 100vh`, and `.panes` is `flex: 1 1 auto; min-height: 0` (`AppShell.svelte:182-220`). A bounded region with its own scroll and `flex-shrink: 0` does address the measured squeeze. The record admits the acknowledgement sits below the region's fold.
- **Substituted states.** The preamble (`window-reading.md:24-29`) and the plan table say the cause of each state is the probe's, and each substitution prints the real answer. The `SyncDirectory`, `may_have_written: true` shape exists in core (`write.rs:1388`).
- **Other claims.** The ten states and five controls match the evidence cited. The "51 `it` sites" figure checks out. The fixtures are synthetic and no real-config content is quoted.

## NOT-VERIFIED

- Harness, transcripts, snapshots and `verbatim-9c.cjs` live under `/private/tmp`, outside the repo, so the launch results and "0 problems" are taken from the record. The record does not state the attribution pass's limit: greedy longest-match proves each drawn string exists in the active dictionary, not that the state-correct key produced it. That is proved only for `--- sentence` lines.
- The full `npm test` / `check` / `build` gates were not re-run; only the one suite was.
