# Review brief — Phase 3-13-2

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2, Svelte 5, TypeScript; Rust core).
- **Phase:** 3-13-2 — display names and creation defaults: the components and the i18n.
- **Goal:** draw 3-13-1's closed model. `Sidebar.svelte` shows display names with the real filename always
  visible and applies the `sortOrder` rank; `MatchCreator.svelte` receives `browser.creationDefaults()` and
  draws the seven options as textual controls (never checkboxes), seeded defaults visible and removable,
  removal suppressing the key, empty distinct from absent, a later preference change not touching an open
  draft, recovery values never overridden; a preferences control (`FilePreferences.svelte` over
  `src/lib/browser/preferencesControl.ts`) sets a file's display name and defaults through the workspace's
  serial preference queue and draws the sidecar codes through the `index.ts` reactive wrappers; an absent or
  corrupt sidecar leaves creation working; EN and ES keys; mounted tests.
- **Spec:** `docs/decisions/3-split-notes.md` §2 step 3-13 and its 2026-09-24 addendum (lines 455-498);
  the model is `docs/decisions/3-13-1-notes.md`; this phase's record is `docs/decisions/3-13-2-notes.md`.
  Project rules: `CLAUDE.md` (§2 i18n, §5 conventions, §6 invariants — especially the `\r` normalization of
  `<input>`/`<textarea>`, D2u, and "decisions live in `src/lib/browser/` as values").
- **Changed files (uncommitted tree):** new `src/lib/browser/preferencesControl.ts` (+ test),
  `src/lib/components/FilePreferences.svelte` (+ test), `docs/decisions/3-13-2-notes.md`; modified
  `src/lib/components/{Sidebar,MatchCreator,SnippetList,DetailPane}.svelte`, `MatchCreator.test.ts`,
  `src/lib/browser/{workspace.svelte,sidebar,preferences}.ts`, `src/lib/i18n/{en,es}.json`,
  `scripts/lint/composition-guards.test.ts`. `PROGRESS.json` is a workflow record — ignore it.
- **Verification run (all exit 0):** `cargo test --workspace -- --test-threads=1` 1534 passed; clippy
  `-D warnings`; `cargo fmt --check`; `npm run check` 487 files, 0 errors/warnings; `npm test` 4062 passed;
  `npm run build` 214 modules; bundle oracle correct (server-only markers absent, client-only present).
- **Risks to probe:** a seeded default emitted without having been drawn; removal not suppressing the key;
  empty collapsed into absent (or the reverse); a preference update reaching an open draft; recovery values
  overwritten by seeding; a sidecar failure breaking creation; a preference write bypassing the serial queue;
  a value holding `\r`/`\n` put into an `<input>` (would be silently altered); hardcoded user-facing strings
  or hand-built i18n keys; comments or the notes claiming a guarantee the code does not give; the sidebar
  hiding the real path behind a display name.
- **No window reading** was performed or claimed (that is 3-13-3).
- **Review file:** `docs/reviews/phase-3-13-2.md`.
- **Time budget:** 15 minutes.
