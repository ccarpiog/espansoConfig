# Review brief — Phase 2d-6-11b

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** working tree against HEAD `def3564`).
- **Phase and goal:** 2d-6-11b, the last half of 2d-6-11 (spec: `docs/decisions/2d-6-split-notes.md`,
  the 2d-6-11 block ~lines 343-367 and binding entries 35, 40, 41, 42 ~lines 569-620). Delivers:
  (1) reviewed bilingual EN/ES fixtures pinning literal strings for entry 40's seven semantic bounds,
  with a recorded bilingual prose review; (2) the factual production-comment sweep over entry 41's
  eight classes (comments only, `src-tauri/src/main.rs:214-227` left alone); (3) all four baselines
  re-measured with the instrument and normalized, with both comparisons; (4) the earlier narrow window
  readings consolidated in one record that is not the 2d-7 matrix and makes no new window claim.
  Components: none planned (two `.svelte` files touched in comments only).
- **Changed files:** new `src/lib/i18n/bilingualFixtures.test.ts`, `docs/decisions/2d-6-11b-notes.md`,
  `docs/decisions/2d-6-window-readings-consolidated.md`; modified `src/lib/i18n/{es.json,codes.ts,index.ts,
  externalConflictCodes.test.ts,reconciliationStatusCodes.test.ts}`, `src/lib/components/{MatchDeleter.test.ts,
  DetailPane.svelte,RestorePane.svelte}`, `src/lib/browser/{workspace.svelte.ts,reconciliationCoordinator.ts,
  writeSurfaceRegistry.ts,observationTransitions.ts,matchEditor.ts,matchCreation.ts,restore.ts,recovery.ts}`,
  `src-tauri/src/{events.rs,reconciliation.rs}`.
- **NOT part of the phase — ignore:** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`,
  `src/probe.ts` (the uncommitted window-reading instrument, `CLAUDE.md` §6); `PROGRESS.json`.
- **Verification run (orchestrator, exit 0 each):** `npm test` 3535 passed (72 files); `npm run check`
  462 files 0/0; `npm run build` 201 modules; bundle oracle server markers absent, client present (2);
  `cargo test --workspace -- --test-threads=1` 1323 passed; clippy clean. `cargo fmt --check` exits 1
  **only on `probe.rs`** (instrument, not committed).
- **Risks to probe:**
  1. **Replacement comments claiming more than the code does** (`CLAUDE.md` §5 last bullet — this
     project's worst defect class). Check every rewritten comment against the code it describes:
     caller counts ("five of them are called", "six reapplying surfaces", "seven top-level write
     surfaces", "nothing in production calls X"), release paths, uncertainty exits. Use `rg` to verify
     caller claims.
  2. **Any non-comment change** in a production `.ts`/`.rs`/`.svelte` file (must be none).
  3. **ES wording changes** in `es.json` (three): do they keep entry 40's bound, match the EN meaning,
     and not collide with other labels? Are the fixtures' literals exactly the dictionary strings, going
     through typed accessors (no hand-built keys)?
  4. **Baseline arithmetic** in the notes (with-instrument `1323 / 462 / 3535 / 201`, normalized
     `1323 / 461 / 3534 / 200`) and the claimed instrument share; comparisons against
     `1320 / 438 / 2254 / 186`, `1323 / 444 / 2474 / 191`, `1323 / 443 / 2473 / 190`, live rung
     `1323 / 461 / 3526 / 201`.
  5. Consolidated readings record: makes no new window claim, not called the 2d-7 matrix, owed readings
     named as owed.
  6. Sweep completeness: a false sentence of the eight classes left in production code.
- **Review file:** `docs/reviews/phase-2d-6-11b.md`
- **Time budget:** 15 minutes.
