# Review brief — Phase 3-11-3 (bulk selection: the window half)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** working tree against `HEAD`)
- **Review file:** `docs/reviews/phase-3-11-3.md`
- **Time budget:** 15 minutes

## Goal
Take step 3-11's window half (ruling 30, §4.1 of `docs/decisions/3-split-notes.md`): a model's reading of the
bulk UI 3-11-2 drew — the *Select several* toggle and toggle rows in `src/lib/components/SnippetList.svelte`,
`src/lib/components/BulkInspector.svelte` (Mixed, the seven option controls, exclusions with reasons, consent
review, a partial outcome with exclusions and execution failures listed apart, draft Undo/Redo, the no-disk-undo
sentence) and the pending-apply lock (`bulkApplyPending` in `src/lib/browser/workspace.svelte.ts`) — in **EN and
ES** (language set through the picker), **including a partial success**, plus one R38 touch (ruling 31: a
read-only, excluded selection). Records only; this phase closes step 3-11.

**The uncommitted instrument was deleted before this review.** Judge the records against the source and against
the captures that remain outside the repository. A byte copy of the deleted instrument is at
`/private/tmp/3-11-3/instrument-copy/instrument-3-11-3/` (for checking the notes' §2 description and hashes only;
it is not part of the tree).

## Changed files
New: `docs/decisions/3-11-3-window-reading.md`, `docs/decisions/3-11-3-notes.md`, this brief.
No source file changed (`git diff --stat -- src src-tauri crates` is empty). `PROGRESS.json` is a workflow
marker — ignore.

## Where the captures are
- `/private/tmp/3-11-3/L01/` (EN) and `/private/tmp/3-11-3/L02/` (ES): `caps/cNN.png` (2360 × 1520),
  `small/cNN.png` (1400 px), `badge/cNN.png` (badge crops, labelled), `launch.txt` (lock state per capture),
  `disk.diff` (what the run wrote), `before/` (fixtures as launched).
- `/private/tmp/3-11-3/L01/cmp-toggle.png`, `/private/tmp/3-11-3/L01/cmp-pending-list.png` (the two
  zero-pixel-difference comparisons behind open item 1).
- `/private/tmp/3-11-3/ls-before.txt`, `ls-after.txt` (instrument deletion evidence), `check.log`,
  `vitest.log`, `plain-build.log`, `gates.txt`, `build.log` (the instrumented build).

## Verification run
`npm run check` exit 0 (479 files, 0 errors, 0 warnings); `npm test` exit 0 (3930 passed); `npm run build` exit 0
(210 modules; server-only oracle absent, client-only present; no probe string in `dist/`). Exit statuses were
written to `gates.txt`, not read through a pipe. The Rust gate was not run: no Rust changed. Rung
`1505 / 479 / 3930 / 210`, unchanged.

## Risks to probe
1. **Does every claim about a window match its cited capture?** Spot-check the reading's §§1–8 against
   `small/cNN.png` in both launches, especially the partial outcome (L01 `c62`, L02 `c60`), the consent review
   (L01 `c44`/`c51`, L02 `c43`/`c49`), the pending lock (L01 `c55`, L02 `c54`) and the R38 exclusion (`c26`). The
   badge is redrawn 500 ms after each action, so a capture can show the next step under the previous badge.
2. **Is the partial success real, not staged?** It rests on a read-only directory making one file's temporary-file
   creation fail after two files committed (notes §2). Check that against `src-tauri/src/bulk.rs` (preflight, then
   ordered saves, stop at first non-success) and `crates/espansoconfig-core/src/persist/write.rs`, and against
   `disk.diff` in each launch.
3. **Rows classed honestly:** is anything marked *read* that was only seen in the DOM line, or credited from a
   mounted test? Is every owed row either read or unread with a reason (notes §3)?
4. **The three candidate defects (notes §5 items 1–3):** are they stated as observations with evidence and no
   claim beyond it? Item 1 rests on `SnippetList.svelte` having no `:disabled` style; item 2 on
   `BulkInspector.svelte` drawing only `tCommandError(line.error)` for a failed file.
5. **Privacy (CLAUDE.md §1):** only synthetic fixtures under `/private/tmp`; no real configuration content in any
   record.
6. **Instrument gone:** no `instrument-3-11-3/` in the tree, no `src/` hook, `git status` shows only the records
   and `PROGRESS.json`.
