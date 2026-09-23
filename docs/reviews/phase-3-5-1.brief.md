# Review brief — Phase 3-5-1 (scalar content and options: the model and the coordination)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig — review the **uncommitted** working tree against `HEAD`.
- **Review file:** `docs/reviews/phase-3-5-1.md`
- **Time budget:** 15 minutes.

## Phase and goal
First piece of step 3-5 (cut recorded as the 2026-09-23 addendum under 3-5 in
`docs/decisions/3-split-notes.md` §2). Widens the match-editor model to every eligible scalar field (five
content keys, `label`, `comment`, nine options); content-kind switch as one compound, all-or-nothing,
confirmation-gated save intention (new `MatchDraft.content_switch` in the core, a key rename in place
keeping value bytes); buffer-only `$|$` cursor action for `replace` only, undoable, several-markers
advisory as a code; exact-string suggestions for `uppercase_style`/`force_mode`; `\r` refused at
eligibility, `editField` and `beginSave`; save / conflict compare / copy / reapply / recovery cover every
field with a model test per path; R36's conservative rule (a stale open draft withholds moves in its
document). Binding rulings: 8, 9, 10, 18, 23, 24 in `3-split-notes.md` §3. Worker's record:
`docs/decisions/3-5-1-notes.md`. Project rules: `CLAUDE.md` §2, §5, §6.

## Changed files
Rust: `crates/espansoconfig-core/src/draft/{match_draft.rs,plan.rs,mod.rs}`,
`crates/espansoconfig-core/tests/draft_compose.rs`, `src-tauri/src/{commands.rs,dictionary_contract.rs}`.
TS: `src/lib/ipc/types.ts`, `src/lib/browser/{matchEditor.ts,recovery.ts,matchMove.ts,saveOutcome.ts}`,
`src/lib/i18n/{index.ts,en.json,es.json}`, `src/lib/components/MatchEditor.svelte` (the control choice now
asked of the model so multi-line fields are not put in an `<input>`). Tests: new
`src/lib/browser/scalarFields.test.ts` and updates to existing suites. Records: `CLAUDE.md`,
`docs/decisions/3-5-1-notes.md`, `docs/decisions/3-split-notes.md`, `PROGRESS.json`.

## Verification run (orchestrator, each exit 0)
`cargo test --workspace -- --test-threads=1` → 1418 passed, 0 failed; clippy `-D warnings`; `cargo fmt
--check`; `npm test` → 3590 passed (73 files); `npm run check` → 462 files, 0/0; `npm run build` → 200
modules, server-only oracle absent, client-only present; `cargo tree -p espansoconfig-core | rg tauri`
empty. Prior rung `1412 / 461 / 3550 / 200`.

## Risks to press on
1. **The content switch in the core**: does the rename keep every byte outside the key, refuse a target
   key that already exists, refuse companion-field removal, and compose with other field edits in one
   batch without overlap bugs? Is it all-or-nothing at the TS layer (no partial intent can be saved)?
2. **Check-and-spend** (`CLAUDE.md` §6): does `beginSave`/`editField` validate the value it captured, or
   re-read buffers (getter / Proxy)?
3. **`'Unchanged'` vs `Set("")`** for an initially absent field left blank, for all 17 fields.
4. **R36**: is the rule producer-free of arena-node lookups, and does "stale" really mean revision older
   than the live projection? Does it withhold *every* target-changing structural action it claims to,
   and does any record claim more than the code enforces (worker notes deletion is not covered)?
5. **D2u**: no boolean inferred anywhere; suggestions compared by exact string; unfamiliar value kept.
6. **Behaviour change**: single-line fields holding a line break became read-only — correct, and does
   it regress any previously editable path?
7. Records claiming guarantees the code does not give (the project's worst defect class).
