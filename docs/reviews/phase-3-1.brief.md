# Review brief — Phase 3-1: compositional mapping edits and scalar form substitution

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** working tree against `HEAD`).
- **Review file:** `docs/reviews/phase-3-1.md`. **Time budget:** 20 minutes.
- **Binding definition:** `docs/decisions/3-split-notes.md` §2 "3-1" (~line 72) and §3 rulings 2, 4, 5, 15, 34. Project rules: `CLAUDE.md` (§3 byte-span edits and core free of tauri, §5 conventions, §6 invariants).
- **Worker's record:** `docs/decisions/3-1-notes.md`.

## Goal
Core-only (Rust, `crates/espansoconfig-core`), no UI caller:
1. One batch adds several absent fields — an ordered insertion group (`FieldInsertGroup`) with its own verified expectation, anchored after a key the batch neither removes nor renames. Before this phase two insertions shared an anchor and were refused (`SharedInsertionAnchor`).
2. A closed scalar-to-scalar substitution intent (`FieldSubstitution` → `KeySubstitution` edit; `trigger`↔`regex`, content key↔content key) that rewrites only the key token, works on a compact first entry (`- trigger: …`) without removing the dash, and keeps value bytes unless the draft sets a different value.
3. Stale anchor, removed anchor and duplicate key refused by name.
4. Every success checked byte-for-byte outside the planned spans independently of the engine's verifier.

## Changed files
`crates/espansoconfig-core/src/draft/{audit,error,match_draft,mod,plan}.rs`, `src/patch/{edit,mod}.rs`, `tests/draft_plan.rs` (two tests rewritten), new `tests/draft_compose.rs` (28 tests); `src-tauri/src/{dictionary_contract,wire_contract}.rs`, `src/lib/ipc/types.ts`, `src/lib/i18n/{en,es}.json`, `src/lib/i18n/draftCodes.test.ts` (five new wire codes: `KeyNotSubstitutable`, `EntriesNotInTheIntendedOrder`, three `Substitution*` draft refusals); `docs/decisions/3-1-notes.md`.

## Verification already run (all exit 0)
`cargo test --workspace -- --test-threads=1` (1352 passed, 27 result lines, 0 failed); clippy `-D warnings`; `cargo fmt --check`; `npm run check` (461 files, 0/0); `npm test` (3546); `npm run build` (200 modules, oracles correct per worker); `cargo tree -p espansoconfig-core | rg tauri` empty. Rung `1352 / 461 / 3546 / 200` against `1323 / 461 / 3546 / 200`.

## Risks to probe hardest
- **Behaviour change in existing tests:** two `draft_plan.rs` tests that asserted a refusal were rewritten. "Remove the last entry and add another" used to be refused and is now accepted with the new key placed after the last entry whose successor survives. Is this sound, byte-preserving, and does it stay consistent with the engine rule that refuses an insertion starting at the same offset as a removal?
- **Preservation:** any path where a grouped insertion or a key substitution changes a byte outside its span. Look closely at comments, blank lines, CRLF, BOM, block scalars, flow mappings, compact `- key:` first entries, quoted keys and key/value spacing (`trigger :`, `trigger:  x`).
- **Verifier soundness:** does the new "every key at its intended position" check (`EntriesNotInTheIntendedOrder`) really verify, or can the expectation be built from the same data it checks (a verifier agreeing with itself)?
- **Substitution closure:** can the intent be abused to produce a duplicate key, rename a key into a non-scalar value, or target a key that is absent or hazard-gated (anchors, aliases, tags, merge keys)?
- **Claims:** does any doc comment or `3-1-notes.md` sentence claim a guarantee the code does not give (the project's worst defect class)?
- **i18n:** new codes have EN and ES strings with matching placeholders, and each is mirrored in `types.ts` and the contract tests.
