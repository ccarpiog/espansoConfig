# Review brief — phase 3-11-1 (bulk selection: the model and the coordination)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (uncommitted working tree against `HEAD` = `150d5d8`).
- **Phase and goal:** 3-11-1, the first of three pieces of step 3-11 (bulk selection and inspector).
  Spec: the dated addendum under "### 3-11" in `docs/decisions/3-split-notes.md` §2 and rulings 19–22
  in §3. A browser bulk model over 3-10's `applyBulkOptions`: multi-selection and staleness, **Mixed**
  by exact source spelling sliced in Rust (ruling 20), explicit intents for the seven allowed options
  only, an untouched Mixed control emitting nothing, exclusions (open drafts), consent review over
  `BulkConsent`, partial outcomes (exclusions and execution failures counted separately), draft undo
  with no disk batch undo, and workspace coordination after committed files. No components (3-11-2).
- **Changed files:** new `src/lib/browser/bulkEdit.ts`, `bulkEdit.test.ts`, `docs/decisions/3-11-1-notes.md`;
  core `crates/espansoconfig-core/src/draft/{bulk,mod}.rs` (new read-only `option_spellings`),
  `tests/draft_bulk.rs`; Tauri `src-tauri/src/{commands,main,wire_contract,dictionary_contract,dispatch_check}.rs`
  (new read-only command `match_option_spellings`); frontend `src/lib/ipc/{types,commands,commands.test}.ts`,
  `src/lib/browser/workspace.{svelte,test}.ts` (`BrowserState.applyBulkOptions`, the eighth writer;
  `adoptTheReplacedDocument` split), `src/lib/i18n/{codes.ts,index.ts,en.json,es.json}`, stubs in five
  component test files. `PROGRESS.json` and `3-split-notes.md` are workflow records.
- **Verification run (orchestrator, all exit 0):** `cargo test --workspace -- --test-threads=1` 1504
  passed / 0 failed; clippy `-D warnings`; `cargo fmt --check`; `cargo tree -p espansoconfig-core` has no
  tauri; `npm run check` 477 files 0/0; `npm test` 3880 passed; `npm run build` 208 modules; bundle
  oracle correct (server markers absent, client markers present).
- **Risks to probe:**
  1. Mixed must compare exact source spelling cut in Rust — any JS byte slicing or comparison on decoded
     `ScalarView.text` is a blocker. Is `option_spellings` correct for block/flow/quoted scalars, absent
     keys and non-scalars, and are spellings read at the same revision the submission is bound to?
  2. Stale selection must block: every lookup crossing a reparse handles `StaleRevision`; a confirmation
     comparing two values minted together observes nothing (CLAUDE.md §6).
  3. Only the seven options submittable; untouched Mixed emits nothing; Mixed never sent.
  4. Consent: exact multiset, no force path; a committed write is never reported as an error; after a
     committed file the old identities are stale; the ruling-27 barrier opens and closes correctly on
     every exit path (including a throw).
  5. Exclusions vs execution failures counted separately; the open-editor exclusion semantics and its
     wording (must not claim unsaved edits exist).
  6. The `adoptTheReplacedDocument` split must not change `saveRawDocument` behaviour.
  7. Comments or notes claiming guarantees the code does not give (CLAUDE.md §5 — worst defect class);
     i18n via typed accessors only; JSDoc and closing-bracket comments.
- **Review file:** `docs/reviews/phase-3-11-1.md`.
- **Time budget:** 15 minutes.
