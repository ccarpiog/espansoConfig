# Review brief — Phase 2d-6-6c-2

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 + Svelte 5 app editing espanso YAML
  without reformatting untouched bytes). Rules: `CLAUDE.md`.
- **Phase and goal:** 2d-6-6c-2, the second half of 2d-6-6c. (1) Two code fixes carried from
  `docs/decisions/2d-6-6c-1-notes.md` §4: item 6 — `MatchEditor.svelte`'s component-wide `copied` flag replaced
  by feedback bound to the exact conflict and text copied (as 6c-1 fixed `MatchCreator.svelte`); item 7 —
  `BrowserState.saveMatch` (`src/lib/browser/workspace.svelte.ts`) no longer reports a committed write as an
  unsuccessful save when adoption or the reread throws (as 6c-1 fixed `createMatch`). (2) A narrow window
  reading of the three authored panels drawing an external conflict, EN and ES. (3) 2d-6-6's whole acceptance
  (split record `docs/decisions/2d-6-split-notes.md`, the `### 2d-6-6` entry) checked in one place.
- **Changed files (the review subject is the uncommitted tree):**
  `src/lib/components/MatchEditor.svelte`, `src/lib/components/MatchEditor.test.ts`,
  `src/lib/browser/workspace.svelte.ts`, `src/lib/browser/workspace.test.ts`,
  `docs/decisions/2d-6-6c-2-notes.md`, `docs/decisions/2d-6-6c-2-window-reading.md` (new).
  **Out of scope:** `src/probe.ts`, `src-tauri/src/probe.rs`, and the two hook lines in `src/main.ts` /
  `src-tauri/src/main.rs` — the temporary, never-committed window-reading instrument (2d-8 deletes it);
  `PROGRESS.json`.
- **Verification run by the orchestrator, each exit read directly:** `npm test` 2924 passed / 65 files;
  `npm run check` 449 files, 0 errors, 0 warnings; `npm run build` 193 modules, server-only markers absent,
  client-only present; `cargo test --workspace -- --test-threads=1` 1323 passed, 0 failed; clippy `-D warnings`
  exit 0; `cargo fmt --check` exit 0.
- **Risks to probe:**
  1. Item 7: does `saveMatch` now ever report *success* for a write that did not commit, or drop a failure the
     adoption already answered? Is a replaced projection left installed when it should be dropped? Compare
     against `createMatch`'s fix for divergence. Check-and-spend / property-read-between-check-and-use
     (`CLAUDE.md` §6) in the new code.
  2. Item 6: can a new conflict, an edited draft, or a late clipboard answer still claim "copied" for text
     that was not copied? Are there other `copied`-shaped flags left in the editor?
  3. The notes and the window-reading record: does any sentence claim a guarantee the code or the
     evidence does not give (this project's worst defect class)? In particular, claims about what the
     window drew versus what the WebKit snapshots/recorder show, the copy result, and the "every clause met"
     acceptance table.
  4. i18n: no hardcoded user-facing strings introduced.
- **Review file:** `docs/reviews/phase-2d-6-6c-2.md`. Verdict line one of `ship`, `ship-with-fixes`,
  `do-not-ship`; list BLOCKERS and SHOULD-FIX separately, each with file:line and a concrete failure scenario.
- **Time budget:** 15 minutes.
