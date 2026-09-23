# Review brief — Phase 2d-6-9b-3

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** tree against `HEAD`).
- **Phase:** 2d-6-9b-3 — entry 15 enforced on the reconciliation coordinator's automatic reread.
- **Goal:** while a file is under an uncertainty hold (a write with an unknown outcome), the coordinator's
  automatic reread is refused, and the refused observation is registered as an acknowledgeable origin, so
  the resulting `stale` file keeps an exit (acknowledge, then reread). The manual `requestFileReread`
  path must not change. Ruling and gap: `docs/decisions/2d-6-split-notes.md` §2 (the 9b-3 bullet) and §3
  entries 13-18; `docs/decisions/2d-6-9b-1-notes.md` §6 item 1.
- **Changed files:** `src/lib/browser/workspace.svelte.ts`, `observationTransitions.ts`,
  `reconciliationStatus.ts`, `conflictSource.ts`; `src/lib/i18n/en.json`, `es.json`;
  `src/lib/browser/workspace.test.ts`, `src/lib/components/ReconciliationStatus.test.ts`,
  `src/lib/i18n/reconciliationStatusCodes.test.ts`; `docs/decisions/2d-6-split-notes.md`; new
  `docs/decisions/2d-6-9b-3-notes.md` (the worker's record, including pre-fix failures and open items).
- **Not in scope — ignore:** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`,
  `src/probe.ts` are a deliberately uncommitted window-reading instrument; `PROGRESS.json` is a workflow record.
- **Verification run (orchestrator):** `npm test` exit 0, 3364 passed (69 files); `npm run check` exit 0,
  457 files, 0 errors, 0 warnings; `npm run build` exit 0, 200 modules; server-only bundle markers absent,
  client-only present. No Rust changed.
- **Risks to probe:**
  1. Is the automatic reread refused on every path where the hold is live, including a hold that begins
     while an automatic read is in flight (the notes §6 names one dead end — is it real and is the
     record honest about it)?
  2. Does registering the refused observation through the new `takeInObservation` preserve every
     invariant `observeExternalChange` had (ordering, supersession, projection generations,
     `selectGeneration` bumps)?
  3. Is `requestFileReread` / `rereadDocument` behaviour truly unchanged?
  4. Do comments or the notes claim a guarantee the code does not give (this project's worst defect class)?
  5. Are the changed EN and ES sentences true of what the code does, with placeholder parity?
- **Review file:** `docs/reviews/phase-2d-6-9b-3.md`
- **Time budget:** 15 minutes.
