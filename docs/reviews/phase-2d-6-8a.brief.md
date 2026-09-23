# Review brief — Phase 2d-6-8a

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 app; Svelte 5 / TypeScript frontend, Rust core). Rules: `CLAUDE.md`.
- **Phase and goal:** 2d-6-8a, the first third of 2d-6-8 (raw and restore rendering). The owed model-side obligations for the raw and restore sessions, then their two receivers registered and delivered. **No new rendering** (8b draws, 8c reads a window). The cut is recorded in `docs/decisions/2d-6-split-notes.md` §2 under `### 2d-6-8`; the phase record is `docs/decisions/2d-6-8a-notes.md`.
- **What changed (uncommitted tree):**
  - Raw's `loadDiskVersion` (`src/lib/browser/rawEditor.ts`) and restore's `reloadTheDiskVersion` (`src/lib/browser/restore.ts`) no longer read session state after the post-adoption `current()` check (6b §7 item 1), failing-first.
  - The raw save wrapper in `src/lib/browser/workspace.svelte.ts`: a committed save answered as an error when the re-read threw an unclassifiable value, and a may-have-written save answered as an error when its re-read threw — both fixed failing-first. Restore wrapper audited, no defect; `restoreDocument` passing no reader recorded as already fixed at 2d-6-6a.
  - Raw and restore receivers reported by `RawEditor.svelte` / `RestorePane.svelte`, registered from `DetailPane.svelte` through `surfaceReceivers.ts`; `ReceivingSurfaceKind` now eight kinds. Smaller edits in `conflictSource.ts`, `editorSave.ts`, `observationDelivery.ts`, `observationTransitions.ts`, `saveOutcome.ts`, `writeSurfaceRegistry.ts`.
  - Tests: `rawEditor.test.ts`, `restore.test.ts`, `surfaceReceivers.test.ts`, `workspace.test.ts`, `DetailPane.test.ts`, `RawEditor.test.ts`, `RestorePane.test.ts`.
- **Do not review** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts`: the deliberately uncommitted window-reading instrument, not part of this phase. `PROGRESS.json` is a workflow record.
- **Verification run:** `npm run check` exit 0 (449 files, 0 errors, 0 warnings); `npm test` exit 0 (3077 passed, 65 files); worker also ran `npm run build` (193 modules, server-only markers absent), `cargo test --workspace -- --test-threads=1` (1323 passed), clippy `-D warnings` and `cargo fmt --check`, all exit 0.
- **Risks to probe:**
  1. Does any reload/door still read session or projection state after its last `current()` / reader check (a check and a spend separated by any property read are not atomic — `CLAUDE.md` §6)?
  2. Can a committed raw write ever still reach the caller as an error (the rule: a committed write is never afterwards reported as an error)?
  3. Receiver registration: can a raw editor or restore pane stay registered after unmount, or fail to withdraw when its document or selection changes; does a raw editor over text containing `\r` wrongly install anything?
  4. Does any comment or the notes claim a guarantee the code does not give (this project's worst defect class)?
  5. Are the mounted tests genuine (going through the real registry and coordinator), and do the failing-first claims in the notes match the fixes?
- **Review file:** `docs/reviews/phase-2d-6-8a.md`
- **Time budget:** 20 minutes.
