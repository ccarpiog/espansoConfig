# Review brief — Phase 3-15-1, cross-layer preservation evidence

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (uncommitted working tree; review the diff against HEAD).
- **Phase and goal:** 3-15-1, the first piece of step 3-15 (`docs/decisions/3-split-notes.md` §2, step
  3-15 and its 2026-09-24 addendum). Tests only, plus a notes file mapping them. Acceptance:
  1. every writer Phase 3 added has a success case and a refusal case;
  2. unknown bytes and coverage are conserved outside explicit raw edits, checked through the command
     path (disk bytes and the refreshed projection);
  3. stale, uncertain and partial bulk outcomes are covered;
  4. a deliberately corrupted candidate fails the oracle.
  Where an existing test discharges a clause, the notes cite it by name.
- **Changed files:**
  - new `src-tauri/src/commands/preservation_check.rs` (14 tests: command-path conservation and refusals)
  - new `crates/espansoconfig-core/src/patch/edit/corrupted_candidate_tests.rs` and
    `crates/espansoconfig-core/src/patch/edit/raw_item/corrupted_candidate_tests.rs` (6 tests: a
    test-only copy of `apply_edits` / the raw-item path hands corrupted candidates to the real verifier)
  - `src-tauri/src/commands.rs`, `crates/espansoconfig-core/src/patch/edit.rs`,
    `crates/espansoconfig-core/src/patch/edit/raw_item.rs` — module declarations only
  - new `docs/decisions/3-15-1-notes.md` — the clause-to-test map, "Not guaranteed", open items
  - `docs/decisions/3-split-notes.md` (the cut addendum) and `PROGRESS.json` — workflow records
- **Verification run (orchestrator, all exit 0):** `cargo test --workspace -- --test-threads=1` 1554
  passed; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`; `npm run check`
  487 files 0 errors 0 warnings; `npm test` 4064; `npm run build` 214 modules; bundle oracle correct;
  `cargo tree -p espansoconfig-core | rg tauri` empty. Rung `1554 / 487 / 4064 / 214` (from
  `1534 / 487 / 4064 / 214`).
- **Risks to probe:**
  - Does each test actually prove what the notes claim? This project's worst defect class is a record
    claiming a guarantee the code does not give (`CLAUDE.md` §5). Check every row of the notes' map
    against the named test.
  - Is the writer enumeration complete for Phase 3 (3-1 … 3-13)? A missing writer is a gap in clause 1.
  - Clause 2 must go through the command path. Does `preservation_check.rs` exercise the real command
    layer (`run_one_save` and the session), or a re-implementation of it?
  - Clause 4 uses a test-only copy of `apply_edits`. Could the copy verify something the real path does
    not, so the tests pass while the real oracle has a hole? Is the drift risk bounded honestly?
  - Tests must be deterministic, synthetic-only (no real-config content, `CLAUDE.md` §1), and must not
    touch the fifteen byte-exact fixtures (`CLAUDE.md` §4).
  - Negative-control tests: can they fail? A comparison that cannot fail proves nothing.
- **Review file:** `docs/reviews/phase-3-15-1.md`
- **Time budget:** 15 minutes.
