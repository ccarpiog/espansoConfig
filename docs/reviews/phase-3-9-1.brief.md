# Review brief — Phase 3-9-1

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** working tree against `HEAD`).
- **Phase:** 3-9-1 — the file-scope inspector: model, components and i18n. Step 3-9 of
  `docs/decisions/3-split-notes.md` §2 (see its 2026-09-24 addendum for the cut into 3-9-1 and 3-9-2),
  §4.3 and ruling 14. No window half in this phase (3-9-2 owns it).
- **Goal:** an ordered display of a file's imports (`DocumentView.imports`), with absent / empty /
  unsupported states, unsupported entries kept visible, **no invented resolution** (no path lookup, no
  exists/missing claim), and an accurate explanation of `_` files ("not auto-loaded", never
  "inactive"). No new writer, no rename control. EN + ES through typed i18n accessors.
- **Changed files:** new `src/lib/browser/fileScope.ts`, `src/lib/browser/fileScope.test.ts`,
  `src/lib/components/FileScope.svelte`, `src/lib/components/FileScope.test.ts`,
  `docs/decisions/3-9-1-notes.md`; modified `src/lib/components/SnippetList.svelte`,
  `src/lib/components/Sidebar.svelte`, `src/lib/i18n/{codes.ts,index.ts,en.json,es.json}`,
  `scripts/lint/composition-guards.test.ts`, `crates/espansoconfig-core/src/discovery.rs` (doc comment
  only), `docs/decisions/3-split-notes.md` (addendum). `PROGRESS.json` is a workflow record.
- **Verification run (orchestrator), all exit 0:** `cargo test --workspace -- --test-threads=1` 1465
  passed / 0 failed; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`;
  `npm run check` 474 files 0 errors 0 warnings; `npm test` 3815 passed; `npm run build` 207 modules
  (previous rung `1465 / 470 / 3773 / 204`). Bundle oracle: server-only markers absent, client-only
  present. `cargo tree -p espansoconfig-core | rg tauri` finds nothing.
- **Risks to probe:**
  1. Does the model faithfully reflect the projection — every import drawn in file order, unsupported
     entries visible at their position, absent vs empty correctly distinguished (or honestly merged)?
     Any state the projection can produce that the model mishandles?
  2. Any wording (EN or ES) that implies resolution, existence, or "inactive/disabled" for `_` files;
     does the ES text say the same thing as the EN?
  3. i18n rules: every string through typed `describe*` accessors, no hand-built keys; the renamed key
     `browser.sidebar.notAutoLoaded` → `browser.fileScope.notAutoLoaded.mark` has no stale reference.
  4. Placement: the inspector sits in the snippet-list pane, not `DetailPane.svelte` — does it draw for
     a `_` file with imports and no snippets, for a file that does not parse, and not twice?
  5. Byte/UTF-16 rules: any JavaScript slicing of source text by byte span?
  6. Records: does `3-9-1-notes.md` claim any guarantee the code does not give? It must say no window
     reading was performed or claimed.
  7. Worker's open question: the core also flags `_` profiles under `config/` as not auto-loaded — is
     the sentence accurate for them?
- **Review file:** `docs/reviews/phase-3-9-1.md`.
- **Time budget:** 15 minutes.
