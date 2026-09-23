# Review brief — Phase 2d-7-5

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 app; read `CLAUDE.md` first).
- **Phase and goal:** 2d-7-5, *G1 — delivery, watcher and counters*: a window reading, records only.
  Spec: `docs/decisions/2d-7-split-notes.md` §2 *2d-7-5*, bound by §3 entries 15-19, 23, 24.
  The instrument (the uncommitted `src-tauri/src/probe.rs`, `src/probe.ts`, the hook lines in
  `src-tauri/src/main.rs` and `src/main.ts`, and the harness under
  `/private/tmp/espansoconfig-harness-2d-6-6c-2/`) is frozen at the hashes of
  `docs/decisions/2d-7-4-2-notes.md` §5.3 (`/private/tmp/2d7-instrument-reviewed/SHA256SUMS`).
- **Changed files (the deliverables — all new, untracked):**
  `docs/decisions/2d-7-5-window-reading.md`, `docs/decisions/2d-7-5-notes.md`. `PROGRESS.json`
  carries only the in-progress marker. The four instrument paths are dirty deliberately and are
  **not** under review.
- **Acceptance to check:** one line per G1 row with tallies, witness and class (entry 17); emits
  equal deliveries or each difference written as an application fact (entry 15); no launch with a
  Rust/page command mismatch, or each voided and re-run; each window statement carries the three
  visibility conditions or is named unread (entry 18); instrument hashes unchanged; no tracked
  source changed.
- **Verification run by the orchestrator:** instrument hashes equal `SHA256SUMS` (repo four and
  `launch-7.sh`); `git diff --stat src-tauri/src/main.rs src/main.ts` = `5 insertions(+), 1
  deletion(-)`; `npm test` 3547 passed; `npm run check` 462 files 0/0; the worker's cargo log has 26
  `test result: ok` lines, 0 failed. Worker ran the full `CLAUDE.md` §4 gate, all exit 0.
- **Risks — focus here:**
  1. Records claiming more than was read: every row marked *read* must be backed by transcript lines
     quoted in the window reading; check "partial" self-save suppression is not described as met.
  2. Four rows are **unread** because the frozen instrument has no plan for them (self-save in
     isolation, workspace reopen with a late old callback under `delay`, adding a readable file,
     script-side add/remove under `config/`). The worker judged this non-blocking. Is it honest to
     close the phase with those rows unread, and do the records say so without softening, per
     the spec's rule that a missing plan is recorded unread or stops BLOCKED?
  3. Retained plans cannot show per-path no-write evidence (2d-7-4-2 review S5); check the notes do
     not claim such evidence.
  4. Screen locked for every launch, `:keepalive` used: check no visual claim is made without the
     three visibility conditions.
  5. No real-config content quoted anywhere (the repo is public).
- **Review file:** `docs/reviews/phase-2d-7-5.md`.
- **Time budget:** 15 minutes.
