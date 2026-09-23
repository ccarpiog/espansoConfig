# Review brief — Phase 2d-6-7a

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (Tauri v2 + Svelte 5 + TypeScript; Rust core)
- **Phase:** 2d-6-7a, the first third of 2d-6-7 (operation-surface rendering), cut as recorded in
  `docs/decisions/2d-6-split-notes.md` §2 under `### 2d-6-7`.
- **Goal:** (1) the `deleteMatch`, `moveMatch`, `duplicateMatch` wrappers in
  `src/lib/browser/workspace.svelte.ts` never report a committed write as an error when adoption or the
  reread throws, and `createMatch`'s classification of a thrown value is guarded so a throwing `code`
  getter cannot reject a committed write (all five now share `adoptAfterTheCommit`); (2) the three
  operation reapplies (`matchDeletion.ts`, `matchMove.ts`, `matchDuplication.ts`) read nothing after
  their last installed-session check, and recheck after adoption; (3) the delete, move and duplicate
  receivers are registered from `DetailPane.svelte` through `surfaceReceivers.ts`, pinned by mounted
  delivery tests through the real registry and coordinator. Rendering is 2d-6-7b's, not this phase's.
- **Record:** `docs/decisions/2d-6-7a-notes.md` (rulings, audit, pre-fix failures verbatim).
- **Changed files:** `git status --short` — everything modified except the four instrument paths
  `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts`, which are a
  deliberate uncommitted instrument and are **out of scope**. `PROGRESS.json` is a workflow record.
- **Verification run (orchestrator, each gate alone, exit 0):** `npm run check` 449 files 0/0;
  `npm test` 2960 passed; `npm run build` 193 modules, server-only markers absent, client-only present;
  `cargo test --workspace -- --test-threads=1` 1323 passed; clippy `-D warnings` and `cargo fmt --check` clean.
- **Risks to probe:**
  - Any path where a committed write can still reject or be reported as failed (`CLAUDE.md` §6).
  - Check-and-spend separated by a property read; reads after the last `current()` reader call in the
    three reapplies; the "wait recorded during adoption carried into the rebuilt session" claim.
  - Receiver registration/withdrawal lifecycle: a destroyed or reopened panel receiving an old
    instance's delivery; `ReceivingSurfaceKind` widened to six kinds — any exhaustiveness lost.
  - Records claiming guarantees the code does not give (this project's worst defect class).
  - `saveMatch` refactored onto the shared helper: behaviour must be unchanged.
- **Review file:** `docs/reviews/phase-2d-6-7a.md`
- **Time budget:** 15 minutes.
