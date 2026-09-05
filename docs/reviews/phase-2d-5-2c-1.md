Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-2c-1 — adversarial review

## Blockers

None.

## Medium

**1. `docs/decisions/2d-5-2c-1-instrument-rebuild.md:785-787` (§9.1) claims a guarantee the driver
does not give, in the section the next step executes as instructions.**

> "adding `deleter-changed`, `mover-changed` and `duplicator-changed` to `launch.sh` needs no driver
> edit and therefore no rebuild of the frontend."

`runCase` (`src/probe.ts:889-910`) has no arm for any of those three names. Its `default:` throws
``new Error(`unknown case ${name}`)``, and its own doc comment at `src/probe.ts:877-879` says exactly
that: *"A name this switch does not know is a `--- failed` line."* The `'changed'` variant is a
**parameter** of `deleterPlan`/`moverPlan`/`duplicatorPlan` (`src/probe.ts:757,786,820`), never a
dispatchable case name. 2d-5-2c-2 following §9.1 adds three rows, pays the full cargo rebuild §3
requires, and gets three `--- failed` launches.

§5.4 states both halves in one paragraph and contradicts itself: line 534 *"can add those rows to
`launch.sh` without touching the driver"*, then line 535 *"a case name goes in three places
(`launch.sh`'s table, `runCase`'s switch and a plan function)"*. This is the project's own named
worst defect class. Prose-only fix, so `CLAUDE.md` §7.1 commissions no round.

## Low

2. `…-1-instrument-rebuild.md:529-530` names the four dropped rows as "the *changed* variants of the
   creator, the deleter, the mover and the duplicator". 2c-5-5a §4 line 335 names the creator's row
   `creator-anchor`, which §9.1:787 gets right. One record, two names.
3. §4.4's C02 row and §4.5's C05 row print **`decoy=unchanged`** in bold. In `confine.sh` `source`
   mode the decoy is the *read* path (`confine.sh:89`) and in `adversary.sh` `target-elsewhere` no
   decoy is ever referenced (`adversary.sh:109-111`), so for those two rows the column is vacuous.
   The scripts' headers caveat the general reading of final bytes; the record does not caveat this
   narrower emptiness.
4. `confine.sh:101` and `adversary.sh:124` break only on `--- end`, which never arrives in a control
   whose pass is `--- failed`. All five confinement launches burn the full 25 s and the wait
   establishes nothing; the post-hoc `grep -m1 '--- failed'` is what carries them.
5. `src-tauri/src/probe.rs` and `src/probe.ts` are untracked and un-gitignored, and the two hook
   lines sit in tracked files. The only guard against a public commit is a sentence at §9.1. Per
   2c-5-5a's design; recorded, not new.

## Checked and sound (not findings)

`register_with_probe` (`probe.rs:171-193`) names all 17 commands `main.rs:229-262` registers —
diffed mechanically, identical. `manifest-2d-5-2c-1-post.sha256` verifies with zero mismatches,
including both repo probe sources. All nine fixtures hash distinct, so no `bytes=MATCH` is a
tautology; `mover-exact-expected.yml` ≠ `elsewhere-r1.yml`. Triggers across every fixture are
`:alpha :beta :gamma :probe` only. All fifteen proof-generation `bytes.txt` files match §4's tables
exactly, on one binary digest. `resolve_config_dir` (`discovery.rs:218-248`) probes only the two
env-derived candidates both scripts set per launch. `rawPlan` does press save
(`src/probe.ts:868`), so Q28's `bytes=MATCH` discriminates a refusal rather than an absent action.
`launches/` holds 29 entries because `C04-plant` is disclosed at §1 line 45 as not a launch.

## NOT-VERIFIED

- The four gate figures (`cargo test --workspace -- --test-threads=1`, `npm run check`, `npm test`,
  `npm run build`) were not re-run; a serial workspace run exceeds the 20-minute budget. The
  orchestrator's own figures are taken as given.
- The 28 retained `.app` binaries were not searched for owner data — the record discloses this at
  §10 item 7 and §11.
- No launch was re-taken. Every launch claim here is read from `bytes.txt` only; §4.1's per-launch
  narrative (panel geometry, choice ordering, `arm=` values, quoted sentences) is unchecked against
  the `probe.log` transcripts.
- The four confinement rebindings of §4.5 are unconstructed by design and were not attempted.
- Whether `tauri::Builder::invoke_handler` is a plain setter (`probe.rs:156-157`) was not confirmed
  against the tauri source; the eight plan launches reaching real commands is indirect evidence.
