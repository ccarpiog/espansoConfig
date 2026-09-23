# Review brief — Phase 2d-6-7c

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the uncommitted tree)
- **Phase:** 2d-6-7c, the last third of 2d-6-7: the operation panels' (deleter, mover, duplicator)
  narrow window reading in EN and ES over a file changed on disk, and 2d-6-7's whole acceptance
  checked clause by clause. Scope and acceptance: `docs/decisions/2d-6-split-notes.md` §2, the
  `### 2d-6-7` entry and "The orchestrator's cut of 2d-6-7"; what 7c must look at:
  `docs/decisions/2d-6-7b-notes.md` §4.
- **Changed files (the phase's product):** `docs/decisions/2d-6-7c-window-reading.md`,
  `docs/decisions/2d-6-7c-notes.md`. No tracked source changed. The uncommitted window-reading
  instrument (`src-tauri/src/probe.rs`, `src/probe.ts`, hook lines in `src-tauri/src/main.rs` and
  `src/main.ts`) was extended (a fourth writer, four probe cases) and is never committed — it is
  context, not deliverable; `PROGRESS.json` is a workflow record.
- **Verification run:** `npm run check` 449 files 0/0; `npm test` 3057 passed (re-run by the
  orchestrator, exit 0); `npm run build` 193 modules, server markers absent, client markers present;
  `cargo test --workspace -- --test-threads=1` 1323 passed; clippy and fmt exit 0.
- **Risks to probe:**
  1. Records claiming more than the evidence gives — this project's worst defect class
     (`CLAUDE.md` §5). Does every "proved in the window" claim match what the launches actually
     did (programmatic `click()`, WebKit page snapshots, not real input or screen captures)? Are
     mounted-only items labelled as such?
  2. Is every sentence the record cites as drawn really a verbatim value of `src/lib/i18n/en.json`
     / `es.json` under the key it names?
  3. Does the acceptance check in the notes cover every clause of the 2d-6-7 entry and the
     orchestrator's cut, with no clause marked met on weak evidence?
  4. Privacy: no real espanso config content quoted anywhere (`CLAUDE.md` §1).
  5. Open items: are the gaps (supersededConflict reason never drawn, choice row below the fold,
     shared ES label) recorded as open rather than silently dropped?
- **Review file:** `docs/reviews/phase-2d-6-7c.md`
- **Time budget:** 15 minutes.
