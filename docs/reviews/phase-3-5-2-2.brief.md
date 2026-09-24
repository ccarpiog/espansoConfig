# Review brief — Phase 3-5-2-2 (the window half of step 3-5)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 espanso-config editor).
- **Phase and goal:** 3-5-2-2 closes step 3-5 (scalar content and options editor, and the cursor
  action). It is the step's *window half* (ruling 30, §4.1 and ruling 31 of
  `docs/decisions/3-split-notes.md`): a model's look at `screencapture -l` captures of a visible,
  unlocked window, EN and ES set through the picker, including one block-scalar content conflict,
  through a minimal **uncommitted** instrument brought inside this single review. Records only in
  tracked files; no tracked source may change.
- **Changed files (uncommitted):** new `docs/decisions/3-5-2-2-notes.md`,
  `docs/decisions/3-5-2-2-window-reading.md`; the instrument, untracked, under
  `instrument-3-5-2-2/` (`vite.config.ts`, `probe.ts`, `launch.sh`, `winid.swift`, `snippets.yml`,
  `default.yml`), hashes listed in the notes §2; `PROGRESS.json` (one row status). Captures live in
  `/private/tmp/3522/L01` … `L10` (PNG; readable with your file viewer) — spot-check the claims.
- **Verification run (orchestrator, instrument present):** `cargo test --workspace --
  --test-threads=1` → 30 result lines, 1419 passed, 0 failed; `npm test` 3617 passed (74 files);
  `npm run check` 463 files 0/0. Worker also: clippy `-D warnings`, `cargo fmt --check`,
  `npm run build` 200 modules with both bundle oracles held. Rung unchanged `1419 / 463 / 3617 / 200`.
  `git diff --stat` touches only `PROGRESS.json`.
- **Risks to check:**
  1. Does any record claim more than the captures show? Every *read* claim must cite a capture that
     actually shows it, as a model's look, on an unlocked screen; nothing credited from mounted tests
     or hidden-page snapshots; script-dispatched events must not be passed off as real input.
  2. Row 5 (R38 touch): does the record name the exact screen and action, and is it honest that the
     conflict came from the file watcher, not a save meeting a changed revision?
  3. Privacy (public repo): only synthetic content in captures/records; the instrument must not be able
     to point the app at the owner's real espanso config; no real config content quoted anywhere.
  4. The instrument: minimal, outside every committed path, cannot leak into the production build or
     a tracked file (e.g. its `vite.config.ts` must not shadow the tracked one), and hashes match.
  5. Open items (defects seen) recorded, not fixed; unread rows stated as unread.
  6. The worst defect class here: a record that claims a guarantee the code or the captures do not give.
- **Review file:** `docs/reviews/phase-3-5-2-2.md`.
- **Time budget:** 15 minutes.
