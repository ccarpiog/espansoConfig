# Review brief — Phase 2d-8: instrument removal and harness-free closure

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (uncommitted tree against `HEAD` `051bc0f`).
- **Goal:** delete the temporary window-reading instrument and its harness per the deletion manifest
  `docs/decisions/2d-7-10-notes.md` §4, correct the `"permissions": []` comment in `src-tauri/src/main.rs`
  (`docs/decisions/2d-6-split-notes.md` §7 item 7), re-derive the gates harness-free, and bring
  `CLAUDE.md` §6 *Window readings* to present state. Spec: `docs/reviews/phase-2d-design.md` item 8,
  `docs/decisions/2d-7-split-notes.md` §3 entry 32.
- **Changed files:** `src-tauri/src/main.rs` (doc comment on `register()` only), `CLAUDE.md` (§6
  *Window readings*), `docs/decisions/2d-7-split-notes.md` (§7 row "one drain" → "one per event"), new
  `docs/decisions/2d-8-notes.md`. `PROGRESS.json` is the orchestrator's in-progress marker; ignore it.
  The previously uncommitted `src-tauri/src/probe.rs`, `src/probe.ts` and the hook lines in `main.rs` /
  `src/main.ts` were never committed and are now gone (`git diff src/main.ts` is empty).
- **Verification run:** `cargo test --workspace -- --test-threads=1` → 26 `test result: ok`, 1323 passed,
  0 failed; clippy `-D warnings`, `cargo fmt --check` exit 0; `npm run check` 461 files 0/0; `npm test`
  3546; `npm run build` 200 modules, server-only oracle absent, client-only present;
  `cargo tree -p espansoconfig-core | rg tauri` empty. Expected harness-free rung `1323 / 461 / 3546 / 200`
  (2d-7-10's re-derivation) — met.
- **Risks to check:**
  1. Does the new `register()` comment in `main.rs` claim anything the code / `capabilities/default.json`
     / `dispatch_check.rs` does not give? (This project's worst defect class is a comment claiming a
     guarantee the code does not give.)
  2. Does `CLAUDE.md` §6 now describe present state accurately, dropping instrument facts and keeping
     only host facts that remain true?
  3. Does `2d-8-notes.md` match the manifest (every §4.1–§4.5 entry accounted for, §4.6 reported only,
     §4.7 untouched), cite CF-1 … CF-55 without shrinking or reclassifying, and avoid converting deletion
     into proof? It must quote no real-config content (`CLAUDE.md` §1).
  4. Any remaining reference to `probe` in `src/`, `src-tauri/src/` that now dangles.
- **Review file:** `docs/reviews/phase-2d-8.md`.
- **Time budget:** 10 minutes.
