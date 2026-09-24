# Review brief — phase 3-13-1

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 + Svelte 5 + Rust; edits espanso
  YAML byte-preservingly). Rules: `CLAUDE.md` (binding).
- **Phase:** 3-13-1 — display names and visible creation defaults: the model and the coordination.
  Scope: the 3-13-1 bullet of the dated addendum under "### 3-13" in `docs/decisions/3-split-notes.md`
  §2, and rulings 25-30 in §3 of the same file. Builds on 3-12's sidecar (`docs/decisions/3-12-notes.md`).
- **Goal:** browser models for display names (real filename always visible), ordering, and the seven
  per-file creation defaults as optional text (absent distinct from empty, never booleans); seeding a
  new-snippet draft once and visibly, removable, removal suppresses the key, later preference changes do
  not touch an open draft, recovery values never overridden; workspace coordination loading the sidecar
  on open and before each mutation, absent/corrupt sidecar leaving creation working; the no-timeout
  lock kept from freezing the UI. No components and no window half in this piece.
- **Record:** `docs/decisions/3-13-1-notes.md` (decisions, acceptance → tests, not-guaranteed, open items).
- **Changed files (uncommitted tree):** new `src/lib/browser/preferences.ts`, `preferences.test.ts`,
  `creationDefaults.test.ts`, the notes; modified `src-tauri/src/commands.rs` (sidecar commands made
  `#[tauri::command(async)]`), `src-tauri/src/wire_contract.rs`, `src/lib/browser/{matchCreation,recovery}.ts`,
  `src/lib/browser/workspace.svelte.ts`, `src/lib/i18n/{codes.ts,index.ts,en.json,es.json}`, and several
  test files. `PROGRESS.json` and the split notes' addendum are workflow records.
- **Verification run by the orchestrator, all exit 0:** `cargo test --workspace -- --test-threads=1`
  (1534), clippy `-D warnings`, `cargo fmt --check`, `npm run check` (483 files, 0/0), `npm test` (4002),
  `npm run build` (211 modules); bundle oracle correct; core has no tauri.
- **Risks to probe:** a default emitted that was never in the draft (seeding invisibly or after the
  snapshot); empty vs absent collapsed anywhere on the path to YAML; a preference change mutating an open
  draft through shared references; recovery drafts receiving defaults; a sidecar load/update failure or
  hang reaching the creation path or throwing; races between a pending load and a mutation (stale
  overwrite, ordering of the one-at-a-time queue); whether the async-command change is correct in Tauri v2
  and whether any caller still blocks; display-name decisions (blank clears, line break refused) and
  `sortOrder` rank semantics; the seven options now entering the creator's draft (ruling 23) — could that
  change what an existing creation emits when the user touches nothing; notes claiming guarantees the
  code does not give (this project's worst defect class); i18n accessor use (never hand-built keys).
- **Review file:** `docs/reviews/phase-3-13-1.md`.
- **Time budget:** 15 minutes.
