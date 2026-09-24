# Review brief — phase 3-6-1

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** tree against `HEAD`).
- **Phase:** 3-6-1 — trigger forms and `search_terms`: the model and the coordination. First of three
  pieces of step 3-6; the cut is the "Addendum, 2026-09-24 — cut into three pieces" under `### 3-6` in
  `docs/decisions/3-split-notes.md` §2. Rulings in §3 of the same file (notably 23, 30, 31).
- **Goal / acceptance (this piece):** trigger-form submodel (`trigger`/`triggers`/`regex`) and
  `search_terms` list editing in the editor model; block and flow lists keep their style; additions and
  removals keep the intended order; a failed regex keeps the draft and the finding is
  `RegexDoesNotCompile` from the Rust validator, never a JavaScript `RegExp`; multiple→single never
  silently drops an alias; external reorder or duplicate-list ambiguity refuses reapply for the whole
  list; recovery transfers everything or refuses explicitly; `\r` refused for every new text control at
  eligibility, `editField` and `beginSave`; `Several`/`Absent` presented with no silent winner and raw
  repair offered as a code; EN+ES strings for any new code. No component work (3-6-2) and no window
  reading (3-6-3).
- **Changed files:** `crates/espansoconfig-core/src/draft/{sequence,match_draft,plan,mod}.rs`,
  `crates/espansoconfig-core/tests/draft_wire.rs` (new), `src-tauri/src/{commands,dictionary_contract}.rs`,
  `src/lib/ipc/types.ts`, `src/lib/browser/{matchEditor,recovery,saveOutcome}.ts`,
  `src/lib/browser/matchLists.ts` (new), `src/lib/browser/triggerLists.test.ts` (new), several updated
  tests, `src/lib/i18n/{index.ts,en.json,es.json}`, `docs/decisions/3-6-1-notes.md` (new, the phase
  record), `docs/decisions/3-split-notes.md` (the cut addendum). `PROGRESS.json` is a workflow record.
- **Verification run (orchestrator, each exit 0):** `cargo test --workspace -- --test-threads=1` →
  31 result lines, 1428 passed, 0 failed; clippy `-D warnings`; `cargo fmt --check`; `npm run check`
  465 files 0/0; `npm test` 3651 passed. Worker also: `npm run build` 201 modules, server-only oracle
  absent, client-only present; `cargo tree -p espansoconfig-core | rg tauri` empty.
- **Risks to probe:** byte preservation of list edits (block vs flow, comments inside a flow list, the
  commented flow list at `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:16-22`);
  order preservation; the form-switch rename keeping value bytes; alias loss on multiple→single;
  reapply conservatism (reorder/duplicate/repeated key must refuse the whole list); recovery
  all-or-refuse; `\r` refusal at all three points for every new control; any JavaScript regex
  compilation; `CLAUDE.md` §6 invariants (save only through `run_one_save`/`save_document`, no force,
  D2u, R25, R36/R37); records that claim a guarantee the code does not give (`CLAUDE.md` §5, last
  bullet); i18n through typed accessors, EN and ES; JSDoc and closing-bracket comments.
- **Known deviations the worker reported (judge them):** literal trigger no longer removable (ruling 6);
  recovery of `Multiple`/`Regex` now carries the form; `triggerNotSingle` reworded EN+ES; no list
  reorder; replacing every item withheld; longer-list→single takes two saves; `RecoveryPanel.svelte`
  mislabels until 3-6-2.
- **Review file:** `docs/reviews/phase-3-6-1.md`.
- **Time budget:** 20 minutes.
