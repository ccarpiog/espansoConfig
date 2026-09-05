Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2c-2 — adversarial review

Scope: `docs/decisions/2d-5-2c-2-window-reading.md`, `src/probe.ts`, the harness `launch.sh`, and the
15 retained launch directories. Read-only.

## What I re-derived and confirmed

Every `bytes.txt` in S01/R01–R13/N03 matches the §4.1 table cell for cell (`bytes`, `backups`,
`tree-diff`, `probe.err=0`, `reached-end=yes end-lines=1 failed-lines=0`). All 15 bundles and the
current `target/debug/espansoconfig` hash to `0af15a34…62e9`. Language: all 14 plan launches carry
`--- language picked=… lang=… label=ok`; 8 `:en` / 6 `:es` is right. §4.5's conjunction holds — S01's
backup is byte-identical to `fixtures/base-r0.yml`, one batch, `tree.diff` is exactly the
`.espansoconfig-backups` line. Every source citation in §2.1/§2.2/§3.1 resolves (`DetailPane.svelte:999`
includes `restoring`; `restore.ts:471` skips `restore`; `en/es.json:476-481`; `probe.ts` :94/:118/:932/
:966/:1005/:1048/:1115/:1133). `git diff --stat` = 5 insertions, 1 deletion. Privacy sweep reproduced:
no match for `Library`, `@` or `Dropbox` in any retained text artifact.

## Findings

**Medium — `2d-5-2c-2-window-reading.md:462-464`.** §9 item 11 is the one `actionable` item and it
under-enumerates. It lists decoys `C01`…`C05`; `/private/tmp/espansoconfig-probe-decoy-C06.yml`,
`-C07.yml` and both `.before` siblings also exist (mtime 03:31). The record's own §9 item 8 (`:455`)
says `C01`–`C07`. Executing the list as written leaves four files behind.

**Low — `:373`.** "10 files per restore launch, 8 per other launch" is false. Measured: R05–R10 hold
**10** each (they carry backups); only R11–R13/N03 hold 8. The sweep's *result* is still correct.

**Low — `:130-133`.** The leak-detector claim is unscoped for `matchCreator`. `competingSurfaceFor`
`break`s on `{kind:'unknown'}` (`restore.ts:476-479`) and `DetailPane.svelte:579-586` gives the creator
`unknown` when `creatorDestination === null`, so a leaked creator registration carrying no document is
undetectable by this case.

**Low — `:267`/`:270`.** "eight inherited cases" vs "all six write surfaces, the raw editor's
negative-capability case, and the two editor variants" — that sums to nine; `raw-negative` is counted
twice.

**Low — `:236-241`.** Presented as drawn "character for character", but the block is re-aligned with
padding absent from every transcript; and none of the four lines contains a batch label or any
language-dependent text, so the stated caveat is vacuous.

**Low — `:180-183`.** The 1/1/1 counts reproduce in `dist/assets/index-*.js` only; `restore-registry`
occurs **0** times in the binary. The searches show the code reached `dist`, not the binary.

## Not findings

§2.2's unreachability argument holds as written (`busy` at `:999` covers all seven; openers are in
later chain arms). §6 items 1–7 are honest; `--- creator destination=` is indeed a literal echo
(`probe.ts:1070`), exactly as §6 item 4 says. No production source changed, so §7.1 commissions nothing
and no item names a correctness defect in a source file.
