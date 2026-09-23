# Review brief — Phase 3-4, bounded creation for the wider editor

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 editor for espanso YAML; every edit is a byte-span replacement, everything outside the intended span byte-identical). Rules: `CLAUDE.md`.
- **Phase and goal:** 3-4 per `docs/decisions/3-split-notes.md` §2 (lines 144-160). A wider `NewMatch`: typed trigger alternatives (single, multiple, regex), typed content alternatives, the optional Phase 3 scalar fields, `triggers`/`search_terms` lists. Never arbitrary nested YAML or an author-chosen key.
- **Acceptance:** every supported form creates exactly one item; `None` differs from `Some("")` for every optional field; list order survives; no arbitrary key or collection can be expressed, and the type is what enforces it; creation still ends in `run_one_save`.
- **Changed files (uncommitted):** `crates/espansoconfig-core/src/draft/{new_match,mod}.rs`, `crates/espansoconfig-core/src/patch/{edit,mod}.rs`, `crates/espansoconfig-core/tests/{new_match_creation (new),persist_save,patch_item}.rs`, `src-tauri/src/{commands,wire_contract,dictionary_contract,dispatch_check}.rs`, `src/lib/ipc/{types,commands}.ts`, `src/lib/browser/{matchCreation,recovery,workspace.svelte}.ts` and their tests, `docs/decisions/3-4-notes.md` (new). `PROGRESS.json` is a workflow record.
- **Verification run (orchestrator, all exit 0):** `cargo test --workspace -- --test-threads=1` → 1412 passed, 0 failed; clippy `-D warnings`; `cargo fmt --check`; `npm test` 3549 passed; `npm run check` 461 files 0/0; `cargo tree -p espansoconfig-core | rg tauri` empty. Worker also: `npm run build` 200 modules, oracles correct.
- **Risks to probe:**
  1. Emission of new list and optional scalar values: YAML 1.1-ambiguous plain scalars, quoting, indentation of lists under CRLF / no-final-newline files; byte identity outside the inserted item.
  2. `None` vs `Some("")` really distinct on the wire (TS → serde) and in the emitted text, for every optional field and for `search_terms` (`Some([])` → `[]`).
  3. The wire shape changed (`{trigger:{Single|Multiple|Regex}, content:{…}, …}`): is it closed (unknown fields refused), and does an empty `triggers` list get refused as a typed `CommandError` or only by a serde rejection (worker reports: untyped)? Is that acceptable against the "type enforces it" criterion?
  4. `recovery.ts` carriage-return check now reads a `NewMatch` through a new `textsOfNewMatch` — does it cover every text field including list items (CLAUDE.md §6: text containing `\r` is refused)?
  5. The patch-engine change in `patch/edit.rs` (item insertion holding a flat scalar list, verified on reparse) — any path where verification is weaker than before for existing callers?
  6. Worker-noted pre-existing issue: `matches:` items at column 0 refuse every creation. Confirm whether pre-existing (out of scope if so).
  7. Any comment or notes sentence claiming a guarantee the code does not give (the project's worst defect class).
- **Review file:** `docs/reviews/phase-3-4.md`
- **Time budget:** 15 minutes.
