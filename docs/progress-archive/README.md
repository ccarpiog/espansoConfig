# Progress archive

`PROGRESS.md` is the **live head** of the project checkpoint: current phase, next action,
standing rules, the phase table, open risks, key paths, the verification baseline and git
state. Everything a closed phase left behind lives here.

The split was taken on **2026-08-29**, when `PROGRESS.md` had grown to **21,803 lines /
1.99 MB**. Every `goahead` iteration is a fresh process that resumes from that file, so its
size was a tax on every restart — and the tax was compounding, because each review round
made the file bigger and every later iteration then paid more to read it.

**Nothing was edited on the way in.** The split was performed by a script that proved, line
by line, that all 21,803 source lines appear exactly once across these files and the new live
head, unaltered and in order. Where a file adds anything, it is a short provenance header
above a `---` rule; everything below that rule is the original text.

## What is where

| File | Lines | What it holds |
|---|---|---|
| [`status-table.md`](status-table.md) | 376 | The full phase status table, with each row's complete narrative. `PROGRESS.md` keeps a condensed version. |
| [`completed.md`](completed.md) | 1034 | The phase-by-phase "Completed" narrative, 0a through 2d-4a-C. |
| [`decisions.md`](decisions.md) | 820 | "Decisions (and why)" — the reasoning a fresh session cannot re-derive. The still-binding ones are distilled in `CLAUDE.md` and in `PROGRESS.md`'s standing rules. |
| [`phase-0.md`](phase-0.md) | 451 | Phase 0 verification sections and review dispositions — the parser evaluation, the span layer, the gap scanner, the codec, the patch engine, the architectural gate. |
| [`phase-1.md`](phase-1.md) | 662 | Phase 1 — the read-only browser, 1a through 1c-2b-2b-2. |
| [`phase-2a.md`](phase-2a.md) | 492 | Phase 2a — the save transaction in Rust, with no caller. |
| [`phase-2b.md`](phase-2b.md) | 736 | Phase 2b — the Tauri command surface, up to the six writing commands. |
| [`phase-2c.md`](phase-2c.md) | 4022 | Phase 2c — the editing UI, all ten sub-phases of the split, 2c-1a through 2c-5-7. |
| [`phase-2d.md`](phase-2d.md) | 2772 | Phase 2d — external-change reconciliation: the observation engine, the write ledger, the liveness contract, the reconciliation wire. |
| [`2d-4a-c-closure.md`](2d-4a-c-closure.md) | 304 | The 2d-4a-C closure narrative: why the owner ended the nine-round tail, and the record reorganization that answered §22.6. |
| [`phase-m2.md`](phase-m2.md) | 32 | Phase M2 — the review-tail termination rule (`CLAUDE.md` §7): its two review rounds, what each found, and why no third was owed. |
| [`next-action-history.md`](next-action-history.md) | 9147 | Every superseded "Next action" handoff, newest first. Each was the live instruction once. **They are kept for the record they carry, never as an instruction** — read them as history only. |

## How to find a phase

The phase files are grouped by top-level phase and each keeps its original `## Verification —
Phase …` and `## Phase … review disposition` headings, so `rg -n '^## ' docs/progress-archive/phase-2c.md`
lists every sub-phase in it, and `rg -n '2c-4b-3d-2a' docs/progress-archive/` finds a specific one.

## The one thing to be careful about

`next-action-history.md` is a stack of instructions that were true when written and are now
false. Several of them say "THE NEXT ACTION IS …" in bold capitals about work that is long
finished. **The only live next action is the one in `PROGRESS.md`.**
