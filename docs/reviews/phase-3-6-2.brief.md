# Review brief — Phase 3-6-2

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 + Svelte 5 + Rust; edits espanso YAML byte-preservingly). Rules: `CLAUDE.md`.
- **Phase and goal:** 3-6-2 — trigger forms and `search_terms`: the components and the i18n. Draw 3-6-1's model values (`docs/decisions/3-6-1-notes.md`) in `MatchEditor.svelte` and `RecoveryPanel.svelte`: list controls for `triggers` and `search_terms`, the trigger-form switch with confirmation, the `Several`/`Absent` presentation with the raw-repair offer, the `wouldDropAliases { count }` refusal, the Rust `RegexDoesNotCompile` finding with the draft kept; fix RecoveryPanel's regex label and carried-`triggers` box; EN and ES keys via compile-checked wrappers; mounted tests. Spec: `docs/decisions/3-split-notes.md` §2 step 3-6 and its 2026-09-24 addendum (3-6-2 bullet). No window reading is claimed.
- **Changed files (uncommitted tree):** `src/lib/components/MatchEditor.svelte`, `src/lib/components/RecoveryPanel.svelte`, `src/lib/browser/matchEditor.ts`, `src/lib/browser/matchLists.ts`, `src/lib/browser/recovery.ts`, `src/lib/i18n/{index.ts,en.json,es.json}`, tests `src/lib/components/MatchEditorTriggers.test.ts` (new), `MatchEditor.test.ts`, `RecoveryPanel.test.ts`, `src/lib/browser/triggerLists.test.ts`, `scalarFields.test.ts`, `scripts/lint/composition-guards.test.ts`; notes `docs/decisions/3-6-2-notes.md` (new). `PROGRESS.json` is a workflow record.
- **Verification run (all exit 0):** `npm test` 3689 passed (76 files); `npm run check` 466 files 0/0; `npm run build` 201 modules, server-only oracle absent, client-only 2; `cargo test --workspace -- --test-threads=1` 1430 passed 0 failed (no Rust changed); clippy `-D warnings`; `cargo fmt --check`.
- **Risks to probe:**
  1. Components deciding things the model should (CLAUDE.md §6 "Frontend structure"); markup rules that a second renderer could omit.
  2. `\r` handling for every new input/textarea (refused at eligibility, `editField`, `beginSave`; `\r`-holding values read-only via `SourceText`).
  3. `saysAbsent` changed to `false` for the literal trigger (notes §3) — does that misstate anything, or break "an initially absent field left blank is `Unchanged`"?
  4. The alias-drop refusal and form-switch confirmation: can the UI reach a save that drops an alias or skips confirmation?
  5. RecoveryPanel: does it now claim to carry something the model refuses, or vice versa?
  6. Hardcoded user-facing strings; ES correctness (articles, sentence case); any sentence that claims a guarantee the code does not give.
  7. Records (`3-6-2-notes.md`) claiming more than the code does.
- **Review file:** `docs/reviews/phase-3-6-2.md`
- **Time budget:** 15 minutes.
