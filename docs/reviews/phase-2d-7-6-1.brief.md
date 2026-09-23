# Review brief — Phase 2d-7-6-1 (G2: retention, conflict timing, locale switch)

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 espanso config editor).
- **Phase and goal:** the first half of 2d-7-6, cut before it started (addendum under §2 *2d-7-6* in
  `docs/decisions/2d-7-split-notes.md`). A **records-only** real-window reading with the frozen,
  uncommitted instrument: the eight write surfaces' retention through an external change,
  disabled-state timing (under `delay`), enabled-state timing, and the locale switch per family. Bound
  by the record's §3 entries 15-18, 23, 25 and the §5 narrowings.
- **Changed files (uncommitted):** new `docs/decisions/2d-7-6-1-notes.md`, new
  `docs/decisions/2d-7-6-1-window-reading.md`; the orchestrator's cut addendum in
  `docs/decisions/2d-7-split-notes.md`; `PROGRESS.json` (in-flight marker). The four instrument paths
  (`src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts`) are deliberately
  dirty and **out of scope** — they were reviewed once at 2d-7-4-2 (entry 6) and are frozen; their hashes
  must equal `/private/tmp/2d7-instrument-reviewed/SHA256SUMS`.
- **Verification run:** instrument hashes 5/5 repo+launcher equal the frozen set (orchestrator), 18/18
  (worker, before and after); hook diff `5 insertions(+), 1 deletion(-)`; `cargo fmt --check`, clippy
  `-D warnings`, `cargo test --workspace -- --test-threads=1` (1330 passed, 26 ok lines), `npm run
  check` (462), `npm test` (3547, re-run by the orchestrator), `npm run build` (201, oracles correct) —
  all exit 0. Twenty launches G2-01 … G2-20 (EN and ES twins); transcripts under the harness at
  `/private/tmp/espansoconfig-harness-2d-6-6c-2/`.
- **Worker's own account of the gaps:** per-action no-write witness unread on all eight surfaces (plans
  checkpoint only at launch start/end); recovery retention partial; disabled-state timing read on the
  raw editor only; the locale switch read on the raw editor only — **the cut's acceptance clause
  "locale switch read on each family" is not met**; authored-text enabled-state timing partial.
- **Risks to probe:** (1) any claim classed *reached* whose transcript line does not show it, or any
  entry-16 no-write witness inferred from launch-wide tallies or a tree diff (2d-7-5's review finding);
  (2) any visual claim not named unread though the screen was locked (entry 18); (3) the ES verbatim
  match — is every drawn ES sentence really matched against `src/lib/i18n/es.json`?; (4) whether the
  unread rows are honestly unreachable with the frozen instrument or merely not attempted; (5) whether
  the acceptance section overstates what was met; (6) any real-config content quoted (`CLAUDE.md` §1).
- **Review file:** `docs/reviews/phase-2d-7-6-1.md`.
- **Time budget:** 15 minutes.
