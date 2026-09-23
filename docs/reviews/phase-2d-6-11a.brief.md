# Review brief — Phase 2d-6-11a

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** tree against `HEAD`).
- **Phase and goal:** 2d-6-11a, the first half of 2d-6-11 "complete composition evidence and baseline
  accounting" (`docs/decisions/2d-6-split-notes.md` §2, the 2d-6-11 block and the new split passage
  under it; binding entries 36, 37, 41, 42). 11a delivers: the cross-surface matrix completed; finite
  drain scripts with exact counts in `DetailPane` cases that start reconciliation; the scoped
  architectural import and guard inventory check, pinned to fail on an unguarded synthetic fixture.
  11b (not this phase) owns the reviewed bilingual fixtures, the production-comment sweep and baselines.
- **Changed files:** new `scripts/lint/composition-guards.ts`, `scripts/lint/composition-guards.test.ts`,
  `docs/decisions/2d-6-11a-notes.md`; modified `docs/decisions/2d-6-split-notes.md` and eleven
  `src/lib/components/*.test.ts` suites (DetailPane, AppShell, ReconciliationStatus, RestorePane,
  MatchEditor, MatchCreator, RecoveryPanel, MatchDeleter, MatchMover, MatchDuplicator, RawEditor).
  No component, no Rust.
- **Ignore:** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts` — the
  user's uncommitted window-reading instrument, not part of this phase. `PROGRESS.json` is a workflow record.
- **Verification run (orchestrator, each alone):** `npm test` exit 0, 3525 passed (71 files, +143);
  `npm run check` exit 0, 461 files, 0/0; `npm run build` exit 0, 201 modules; server-only bundle
  markers absent, client-only present.
- **Risks to probe:**
  1. Does the architectural check really fail on an unguarded suite and on a direct command import
     from a surface component, and pass only the composition root? Is its discovery of mounted
     suites sound (could a real suite escape discovery)? Do its comments claim more than a static
     check gives (entry 37: not proof against dynamic execution)?
  2. Entry 36: `invoked` exact zero in injected suites; `AppShell.test.ts`'s existing per-case list and
     counts unchanged (only additions allowed); drain scripts exact, never a relaxed allowance.
  3. Is the "matrix complete" claim in the notes true against the record's matrix rows, and does the
     notes file claim any guarantee the tests do not give (this project's worst defect class)?
  4. New tests that pass vacuously (assertions that cannot fail, awaited nothing, EN/ES cases that
     compare `translate` to itself).
  5. The worker's reported possible defect (a `stale` mark kept after a reading is dropped as our own
     save, `workspace.svelte.ts` ~4634, `observationTransitions.ts` ~1203): is it recorded accurately,
     and is the test around it left honest (not asserting the defective state as correct)?
- **Review file:** `docs/reviews/phase-2d-6-11a.md`.
- **Time budget:** 15 minutes.
