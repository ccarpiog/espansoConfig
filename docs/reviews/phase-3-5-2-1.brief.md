# Review brief — phase 3-5-2-1

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 + Svelte 5 + TypeScript; Rust core). Review the **uncommitted** working tree against `HEAD`.
- **Phase and goal:** 3-5-2-1 — scalar content and options: the components and the i18n. The component layer over the 3-5-1 model: `MatchEditor.svelte`, `RecoveryPanel.svelte` and the detail integration draw the 17-field editor (control choice from the model), textual option groups with one *Insertion* group holding `force_mode` and `force_clipboard` as two labelled controls, the content-switch preview and confirmation (unsaveable until confirmed), the `$|$` cursor action for `replace` only (undoable, several-markers advisory with count), sentences for every rendered code (including `switchRemovesCompanion`) in EN and ES, mounted tests. **No window half** — it is the later phase 3-5-2-2; the record must say "No window reading was performed or claimed."
- **Spec:** `docs/decisions/3-split-notes.md` step 3-5 (around line 162) and its two addenda; §3 rulings 9, 10, 18, 23, 24, 29, 30, 31. Model record: `docs/decisions/3-5-1-notes.md`. Phase record: `docs/decisions/3-5-2-1-notes.md`. Project rules: `CLAUDE.md` (§2 i18n, §5 conventions, §6 invariants — D2u no inferred types, the `\r` normalization rule for textarea/input, decisions live in `src/lib/browser/` as values).
- **Changed files:** `src/lib/components/{MatchEditor,RecoveryPanel}.svelte`, `src/lib/browser/{matchEditor,recovery}.ts`, `src/lib/i18n/{en.json,es.json,index.ts}`, `src/lib/browser/{scalarFields,recovery}.test.ts`, `scripts/lint/composition-guards.test.ts`; new `src/lib/components/MatchEditorScalar.test.ts`, `docs/decisions/3-5-2-1-notes.md`. Workflow records (not deliverables): `PROGRESS.json`, `docs/decisions/3-split-notes.md` (the 2026-09-24 addendum).
- **Verification run (orchestrator, each exit 0):** `cargo test --workspace -- --test-threads=1` → 30 result lines, 1419 passed, 0 failed; clippy `-D warnings`; `cargo fmt --check`; `npm run check` 463 files 0/0; `npm test` 3615 passed (74 files); `npm run build` 200 modules, server-only oracle absent, client-only 2; `cargo tree -p espansoconfig-core | rg tauri` empty.
- **Risks to probe:**
  1. The worker rendered the new model codes through key functions in the model plus `t*` wrappers in `index.ts` (the `tFieldRefusal` pattern), not new `codes.ts` accessors. Is every new key still compile-checked, or is any key built by hand?
  2. Any new `<input>`/`<textarea>` that can receive a value holding `\r` — is it read-only and drawn through `SourceText`?
  3. Any option control that infers a boolean or normalizes a value; suggestions compared by `===` only; an unfamiliar value kept as written.
  4. The switch confirmation: can save be reached before confirmation, or after the draft changes post-confirmation, from the component?
  5. Decisions made in a component rather than the model (CLAUDE.md §6 *Frontend structure*).
  6. `switchRemovesCompanion`'s sentence is pinned only by a dictionary test; companion keys shown as spelled in the file.
  7. Records claiming a guarantee the code does not give (the project's worst defect class); the recovery body-label change.
  8. ES sentences: present, parity, placeholders; the notes' inventory table complete.
- **Review file:** `docs/reviews/phase-3-5-2-1.md`.
- **Time budget:** 15 minutes.
