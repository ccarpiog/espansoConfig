# Review brief — Phase 2d-6-9b-1

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** tree against `HEAD`).
- **Review file:** `docs/reviews/phase-2d-6-9b-1.md`. Time budget: 15 minutes.
- **Phase and goal:** the first half of 2d-6-9b (cut recorded in `docs/decisions/2d-6-split-notes.md` §2).
  `AppShell.svelte`, `Sidebar.svelte` and `DetailPane.svelte` draw the reconciliation-status decisions of
  `src/lib/browser/reconciliationStatus.ts` (2d-6-9a) and wire the five controls (membership reload,
  lost-history exit, stale-file reread, retry, uncertainty acknowledgement). Plus the orchestrator's ruling:
  **`stale` means the window holds a disk snapshot newer than the installed projection, from an observation
  or from a save refused as a conflict** — marked on the save wrappers' conflict arm, cleared on the
  `adoptDiskVersion` install. A new reader `heldDocuments()` lists held files no row or surface names.
- **Record:** `docs/decisions/2d-6-9b-1-notes.md` (read first). Binding: `docs/reviews/phase-2d-6-design.md`,
  `2d-6-split-notes.md` §3 entries 13-18, 26-32, 34-40; `2d-6-9a-notes.md` §5.
- **Changed files:** `src/lib/browser/{workspace.svelte.ts, reconciliationStatus.ts, observationTransitions.ts,
  workspace.test.ts, reconciliationStatus.test.ts}`; `src/lib/components/{AppShell.svelte, AppShell.test.ts,
  Sidebar.svelte, DetailPane.svelte}`; new `src/lib/components/{FileReconciliationStatus.svelte,
  ReconciliationStatus.svelte, ReconciliationStatus.test.ts}`; `src/lib/i18n/{en.json, es.json, codes.ts,
  index.ts, reconciliationStatusCodes.test.ts, externalConflictCodes.test.ts}`; `docs/decisions/2d-6-split-notes.md`.
- **Not in scope, do not review:** the four uncommitted instrument paths (`src-tauri/src/main.rs`, `src/main.ts`,
  `src-tauri/src/probe.rs`, `src/probe.ts`) — deliberate, deleted in 2d-8. `PROGRESS.md`/`PROGRESS.json`.
- **Verification run by the orchestrator:** `npm test` exit 0 (3271 passed, 69 files); `npm run check` exit 0
  (456 files, 0 errors, 0 warnings); `npm run build` exit 0 (198 modules); server-only bundle markers absent,
  client-only present. No Rust changed.
- **Risks to probe:**
  1. The `stale` mark/clear: is it set only when the conflict's disk revision differs from the installed
     projection? Can the clear on `adoptDiskVersion` erase a newer observation-derived `stale` (the worker
     guards "only if nothing wrote the status since the conflict arrived" — is that guard sound)?
  2. Does any component re-decide what 9a decides, instead of drawing the value?
  3. The route acknowledgement: does it draw the standing origin's disk text and mint from the **same**
     source object (a check and a spend separated by a property read are not atomic — `CLAUDE.md` §6)?
  4. Reactivity: do the drawn states update on the `holdRevision` signal and coordinator revision?
  5. The worker found entry 15 (no automatic reread while a write outcome is unknown) **not enforced** in the
     model and changed the wording rather than the model — is every drawn sentence now true? Any comment or
     record claiming a guarantee the code does not give is this project's worst defect class.
  6. Hardcoded user-facing strings; keys built by hand instead of typed accessors; missing JSDoc.
  7. Does the new jsdom suite's invoke guard actually catch a command, and does the locale-switch case prove
     "no unrelated mutation"?
