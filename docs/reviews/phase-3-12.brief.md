# Review brief — Phase 3-12, the application sidecar store

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core `crates/espansoconfig-core`, Tauri layer `src-tauri/`, Svelte/TS `src/`). Review the **uncommitted** working tree against `HEAD`.
- **Phase and goal:** 3-12 — a versioned per-workspace application-metadata store in a new `src-tauri` module, confined to the app's own storage: lossless path keying, atomic replacement, truthful quarantine, last-write-wins, orphan retention. Binding spec: `docs/decisions/3-split-notes.md` §2 under "### 3-12" (acceptance list), §3 rulings 25–28, §5 rows 6–8. Draws nothing; no window reading.
- **Changed files:** new `src-tauri/src/sidecar.rs`, `src-tauri/src/sidecar/{format,store,tests}.rs`, `src/lib/i18n/sidecarCodes.test.ts`, `docs/decisions/3-12-notes.md`; modified `src-tauri/{Cargo.toml,src/main.rs,src/commands.rs,src/dictionary_contract.rs,src/wire_contract.rs,src/dispatch_check.rs}`, `Cargo.lock`, `src/lib/ipc/{types.ts,commands.ts,commands.test.ts}`, `src/lib/i18n/{codes.ts,codes.test.ts,en.json,es.json}`, `CLAUDE.md` (§6 first bullet — ruling 25's sentence). `PROGRESS.json` is a workflow record; ignore it.
- **Verification run (orchestrator, all exit 0):** `cargo test --workspace -- --test-threads=1` (1529 passed), `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`, `npm run check` (480 files, 0 errors/warnings), `npm test` (3936 passed), `npm run build` (210 modules); bundle oracle correct; `cargo tree -p espansoconfig-core | rg tauri` empty.
- **Risks to probe hardest:**
  1. Can the writer be steered to write anywhere outside app storage (any path-taking argument, a workspace-root value from the frontend reaching the file name unhashed, a symlink)? Ruling 25: the writer takes no destination path.
  2. Failed quarantine: are the original bytes provably untouched, and are all later writes refused? Is a rename reported only after it happened?
  3. Future schema version: never rewritten on any path (load, update, orphan pruning)?
  4. Atomic replacement: temp in the same dir, fsync, rename; is an interrupted replacement truly old-or-new valid; are temp files leaked on error paths?
  5. Lossless keying: the root-path hash encoding and the `u:`/`x:` relative-key encoding — any two distinct byte paths mapping to one key, or one path to two keys?
  6. Last-write-wins claim and the reload-before-mutation rule — does the record claim more than the code gives (this project's worst defect class is a record claiming a guarantee the code does not give)?
  7. The 30-day orphan policy — clock injected, boundary correct, tests use controlled paths and time.
  8. Defaults are optional **text**, never booleans; absent distinct from empty (ruling 28). i18n: every new user-facing code in EN and ES with typed accessors.
  9. `CLAUDE.md` §6 first bullet: present-state wording matching ruling 25, and accurate.
  10. `3-12-notes.md` accuracy against the code.
- **Review file:** `docs/reviews/phase-3-12.md`.
- **Time budget:** 15 minutes.
