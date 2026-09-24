# Review brief — Phase 3-6-3 (the window half of step 3-6)

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 + Svelte espanso config editor).
- **Phase and goal:** 3-6-3 — a records-only window reading, in EN and ES through the language picker,
  of what 3-6-2 draws for trigger forms (`trigger` / `regex` / `triggers`) and `search_terms`, including
  the commented multi-line flow list at `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:16-22`
  (ruling 31). It closes step 3-6. Governing text: `docs/decisions/3-split-notes.md` step 3-6 (lines
  220-266), rulings 30 and 31 (586-596), §4.1 (618-633); precedent `docs/decisions/3-5-2-2-notes.md` and
  `3-5-2-2-window-reading.md`.
- **Changed files (all uncommitted):**
  - `docs/decisions/3-6-3-window-reading.md`, `docs/decisions/3-6-3-notes.md` — the deliverables.
  - `instrument-3-6-3/` — the minimal uncommitted instrument (vite config, `probe.ts`, `launch.sh`,
    `winid.swift`, synthetic YAML plans). It is **never committed**; it is deleted after this review.
  - `PROGRESS.json` — the orchestrator's in-progress marker; not in scope.
  - Captures live outside the repo in `/private/tmp/3-6-3/` and may be opened to check a claim.
- **Verification run (orchestrator, instrument present, each exit 0):** `cargo test --workspace --
  --test-threads=1` → 31 result lines, 1430 passed, 0 failed; `npm test` 3692 passed; `npm run check`
  466 files 0/0; `npm run build` 201 modules. Worker also ran clippy `-D warnings` and `cargo fmt --check`,
  exit 0. Rung unchanged `1430 / 466 / 3692 / 201`. No tracked source file changed.
- **Risks to probe:**
  1. Does every "read" claim in the reading cite a capture that actually shows it (open a sample of
     the PNGs), and is anything credited from a mounted test, a hidden-page snapshot or the lock screen?
  2. Are "read in part" / "unread" classifications honest, with reasons (the recovery multi-item case,
     the flow list which is drawn "Not editable", real input, saves)?
  3. Open item 1 claims a likely defect: after a draft adds an item to a `triggers`/`search_terms`
     list, an on-disk change never raised the external-change panel (10 launches with, 7 without).
     Is the evidence stated without over-claiming a cause? Is it correctly handed to a later phase
     rather than fixed here?
  4. Privacy: no real-config content anywhere (CLAUDE.md §1); instrument content synthetic.
  5. Does any record claim a guarantee the evidence does not give (CLAUDE.md §5 last bullet)?
- **Review file:** `docs/reviews/phase-3-6-3.md`.
- **Time budget:** 15 minutes.
