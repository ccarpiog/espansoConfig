# Review brief — Phase 2d-6-9c

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (uncommitted tree; base `c288ece`).
- **Phase and goal:** 2d-6-9c — the narrow window reading of the reconciliation status built by
  2d-6-9a/9b (all ten drawn states, five controls, the panels' snapshot acknowledgement, 9b-3's
  refused automatic reread), EN and ES, over a ruling-38 hard fixture
  (`docs/decisions/2d-6-split-notes.md` ruling 38 and the 2d-6-9 block of §2), and 2d-6-9's whole
  acceptance checked clause by clause.
- **Changed files (the review scope):**
  - `docs/decisions/2d-6-9c-window-reading.md` (new) — the reading.
  - `docs/decisions/2d-6-9c-notes.md` (new) — acceptance, deviations, defects, open items.
  - `src/lib/components/ReconciliationStatus.svelte` — a layout fix the reading found: the route
    region is bounded (`max-height: 45vh`, own scroll, `flex-shrink: 0`) because a whole-snapshot
    route squeezed sidebar and pane to 0 px.
  - `src/lib/components/ReconciliationStatus.test.ts` — +1 test for that fix.
  - `PROGRESS.json` — the in-flight marker only (ignore).
- **Out of scope:** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`,
  `src/probe.ts` are the deliberately uncommitted window-reading instrument (`CLAUDE.md` §6); do not
  review them as product code, but do check the records describe their extension honestly.
- **Verification run by the orchestrator:** `npm test` exit 0 (3366 passed, 69 files);
  `npm run check` exit 0 (457 files, 0 errors, 0 warnings); `npm run build` exit 0 (200 modules);
  server-only bundle oracle absent, client-only present (2). No Rust changed.
- **Risks to probe:**
  1. Does any record claim a reading, a guarantee or an acceptance clause as met that the evidence
     does not support (this project's worst defect class — `CLAUDE.md` §5)? Is the *unread* list
     complete and honest, and are acceptance clauses left unmet marked as such rather than met?
  2. States produced by the probe altering or delaying a command's answer rather than by the disk:
     does the record say what that does and does not prove?
  3. Does the layout fix's test actually discriminate (would it fail without the CSS)? jsdom does
     not lay out — check what the test asserts and whether the comment over-claims.
  4. Does the fixture meet ruling 38; is any real-config content quoted anywhere (`CLAUDE.md` §1)?
  5. Are the ES/EN verbatim matches genuinely out-of-app and does the record state the script's
     limits?
- **Review file:** `docs/reviews/phase-2d-6-9c.md`.
- **Time budget:** 15 minutes.
