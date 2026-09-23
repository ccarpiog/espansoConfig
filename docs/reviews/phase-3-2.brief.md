# Review brief — phase 3-2

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (uncommitted tree; base `9513c5c`).
- **Phase and goal:** 3-2 — sequence projection and block scalar-list edits. Spec:
  `docs/decisions/3-split-notes.md` §2 entry "3-2" (~lines 100-126), §4.3, §3 rulings 4, 5, 23, 34.
  Worker notes: `docs/decisions/3-2-notes.md`.
- **Acceptance:** absent vs present-empty lists (`triggers`, `search_terms`, `imports`) project
  differently; the empty-sequence anchor limit lifted with a test; multi-item insertion + removal in
  one batch beside an edited survivor, byte-exact outside spans; removing the last item refused or an
  explicit key-removal intent, never a stranded null; item-owned comments travel, file-owned stay; any
  request outside `triggers`/`search_terms` refused by the closed-surface audit; new wire codes
  mirrored EN/ES, `types.ts`, contract tests.
- **Changed files:** core `crates/espansoconfig-core/src/{lib.rs, model/{value,project,match_view,document,variable,mod}.rs, patch/{edit,mod}.rs, draft/{plan,audit,error,match_draft,mod,sequence}.rs}`,
  tests `tests/draft_plan.rs`, new `tests/draft_sequence.rs`; mirrors `src-tauri/src/{dictionary_contract,wire_contract}.rs`,
  `src/lib/ipc/types.ts`, `src/lib/i18n/{en.json,es.json,codes.ts,index.ts,codes.test.ts,draftCodes.test.ts}`,
  `src/lib/browser/{fixtures.ts,workspace.svelte.ts}`.
- **Verification run (orchestrator, exit 0 each):** `cargo test --workspace -- --test-threads=1`
  (1372 passed, 28 result lines, no failure); `npm test` (3548); `npm run check` (461, 0/0); clippy
  `-D warnings`; `cargo fmt --check`; `cargo tree -p espansoconfig-core` has no tauri. Worker also ran
  `npm run build` (200 modules, oracles correct).
- **Risks to probe hardest:**
  1. The worker changed the patch engine: scalar-edit paths are now remapped across a same-batch
     removal before verification. This also changes behaviour for a match insertion beside an edit of
     a later match. Is the remap correct in every ordering, and does it weaken any existing
     verification (byte-exactness outside spans, R25 move exclusivity)?
  2. `ShapeSwitch` (`trigger`↔`triggers`) and whole-list group insertion (block style, or `[]` when
     empty): byte-exactness, indentation, compact `- trigger:` dash, CRLF/BOM documents.
  3. Comment ownership on item insertion/removal; last-item removal refusal; no stranded null.
  4. The closed-surface audit: can any path reach `vars`, `depends_on`, `params`, `matches` or a
     nested list through the new intents?
  5. `item_positions` claims to map original→result positions — is it computed or asserted?
  6. Records claiming guarantees the code does not give (this project's worst defect class), in
     doc comments and `3-2-notes.md`.
  7. i18n: every new code has EN and ES strings and goes through `codes.ts` accessors.
- **Review file:** `docs/reviews/phase-3-2.md`.
- **Time budget:** 15 minutes.
