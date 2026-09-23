# Review brief — phase 3-3, flow scalar-list cardinality

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** tree against HEAD).
- **Phase and goal:** 3-3 of `docs/decisions/3-split-notes.md` §2 (line ~127). Core only, no UI caller.
  Delimiter-aware insertion and removal of items inside flow scalar lists (`triggers`, `search_terms`,
  `imports`), empty ones included, **never converting presentation** (`[a, b]` never becomes block).
  Acceptance: first/middle/last positions; the commented multi-line flow list in
  `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:16-22` covered; trailing commas
  where accepted, Unicode and mixed quoting covered; retained tokens and every outside byte identical;
  ambiguous trivia refused by name.
- **Changed files:** new `crates/espansoconfig-core/src/patch/edit/flow.rs`, `tests/flow_list.rs`,
  `docs/decisions/3-3-notes.md`; modified `src/patch/edit.rs`, `src/patch/mod.rs`, `src/syntax/index.rs`
  (a flow collection opened by `[ ` / `{ ` was read as block — fixed), `src/draft/{plan,error,mod,sequence}.rs`,
  `tests/draft_sequence.rs` (two 3-2 tests rewritten); `src-tauri/src/{dictionary_contract,wire_contract}.rs`,
  `src/lib/i18n/{en,es}.json`, `src/lib/ipc/types.ts` (three new wire codes: `FlowListTriviaAmbiguous`,
  `FlowListLayoutUnsupported`, `SequenceStyleChanged`).
- **Verification run (orchestrator, each exit 0):** `cargo test --workspace -- --test-threads=1` (1398
  passed, 0 failed, 29 result lines), clippy `-D warnings`, `cargo fmt --check`, `npm test` (3548),
  `npm run check` (461 files 0/0), `cargo tree -p espansoconfig-core` has no tauri. Worker: `npm run build`
  200 modules, oracles correct.
- **Risks to probe:**
  1. Byte preservation: any edit that touches bytes outside the intended span, or rewrites a retained
     item's token/quoting/separator.
  2. Separator choice on removal (take the following comma, or the preceding one for the last item) —
     trailing-comma lists, adjacent removals in one batch, multi-line one-item-per-line lists with
     comments after commas, CRLF line endings.
  3. The comment-hazard relaxation for these edits on this one list: can it leak to other edits or
     other nodes? Is every ambiguous trivia shape refused rather than guessed?
  4. Emission of new items into flow context: always quoted — is escaping correct for `"`, `\`,
     control characters, non-ASCII, and does it respect the YAML 1.1 ambiguity rules?
  5. The `syntax/index.rs` fix: could it misclassify any block construct as flow?
  6. Verification soundness: does the engine still reparse and check intended positions, and does
     `SequenceStyleChanged` fire on any style change, block lists included?
  7. Records claiming guarantees the code does not give (CLAUDE.md §5) in `3-3-notes.md` and doc comments.
  8. Known limits the notes state (draft layer still refuses the commented list's whole match,
     §7.1; insert-at-front + rewrite-first overlap, §7.2) — confirm they are stated honestly.
- **Review file:** `docs/reviews/phase-3-3.md`.
- **Time budget:** 15 minutes.
- Never quote content from `tests/corpus/real/` (gitignored, private).
