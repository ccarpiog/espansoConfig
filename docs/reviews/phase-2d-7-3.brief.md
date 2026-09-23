# Review brief — Phase 2d-7-3: the instrument, Rust side

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core + Svelte frontend).
- **Phase and goal:** 2d-7-3. Bring the temporary window-reading instrument's Rust half,
  `src-tauri/src/probe.rs`, up to the spec in `docs/decisions/2d-7-split-notes.md` §2 *2d-7-3*
  (lines ~153-190) with §3 entries 2-5 and 8-13 and the §5 narrowings they cite (§5.1, §5.10, §5.12,
  §5.13, §5.16).
- **The subject of this review is `src-tauri/src/probe.rs`.** It is deliberately **untracked and never
  committed** (project `CLAUDE.md` §6, *Window readings*), so `git diff` shows nothing for it. **Diff it
  against the pre-step copy:** `diff -u /private/tmp/2d7-3-probe.rs.orig src-tauri/src/probe.rs`.
  The uncommitted tree also holds `src/probe.ts` and two hook lines each in `src-tauri/src/main.rs` and
  `src/main.ts`; those are unchanged by this phase and are **not** its subject. This review **is not
  the instrument review** (that is 2d-7-4's): a page-side (`probe.ts`) finding is reported as an open
  item for 2d-7-4, not a blocker here.
- **Changed files:** `src-tauri/src/probe.rs` (untracked), `docs/decisions/2d-7-3-notes.md` (new),
  `PROGRESS.json` (in-progress marker only).
- **Verification run by the orchestrator:** `cargo fmt --check` exit 0; `cargo clippy --workspace
  --all-targets -- -D warnings` exit 0; `cargo test --workspace -- --test-threads=1` exit 0, 1328 passed
  / 0 failed (baseline 1323, +5 = the tests added); `rg -c "\.setup\(" src-tauri/src/probe.rs` finds
  nothing; the save-path name check finds only the safety doc comment (line 93); `git diff --stat
  src-tauri/src/main.rs src/main.ts` is `5 insertions(+), 1 deletion(-)`. The worker reports `npm run
  check`, `npm test` (3547) and `npm run build` (201 modules) exit 0 (no TS changed), and the parity
  test shown failing once (exit 101) with a command removed.
- **Risks to probe hardest:**
  1. Does anything in `probe.rs` reach a write path (`save_document`, `replace_file_atomically`,
     `replace_locked_file`, `run_one_save`, `begin_commit`) or write a user file? `probe_witness` must
     be read-only.
  2. The dispatch-tally wrapper around the invoke handler: can it change what a real command does,
     drop or reorder a command, or miscount? Does the parity test really compare the `main.rs`
     handler list against `PROBE_COMMANDS`, and would it fail on a drift in either direction?
  3. The wake-emit tally from `on_page_load`: re-installed per page load — double counting, a leak, or
     a claim in a comment that the code does not enforce?
  4. `probe_lock_other` through an `O_NOFOLLOW` descriptor and the `shots` confinement: is the fifth
     rebinding truly closed and the sixth honestly disclosed? Any symlink/TOCTOU gap the comments
     deny?
  5. The snapshot request token: does it fix the race of §5.10, or only relabel it?
  6. Comments or header counts that claim a guarantee the code does not give (this project's worst
     defect class); the notes file's accuracy against the code.
- **Review file:** `docs/reviews/phase-2d-7-3.md`.
- **Time budget:** 15 minutes.
