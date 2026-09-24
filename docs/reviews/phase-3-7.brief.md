# Review brief — phase 3-7, the local raw-item core edit

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** tree against HEAD `5c7d64d`).
- **Phase and goal:** step 3-7 of `docs/decisions/3-split-notes.md` §2, with rulings 11 and 12 (§3). A Rust-cut,
  contiguous owned-range text for one snippet and an exact replacement of that range, carried as
  `SaveContent::Edits` through `run_one_save` / `save_document` — never `ReplaceText` scrolled to the snippet.
- **Acceptance (from the record):** refused — zero or two items in the result, escaped indentation, a changed
  sibling, a result that does not parse, an owned range with holes; the BOM and every byte outside the range
  preserved; both block-scalar seams checked; a stale identity refused; an unknown entry inside the range may
  change deliberately and those outside it survive. No window half (ruling 30).
- **Changed files:** new `crates/espansoconfig-core/src/patch/edit/raw_item.rs`,
  `crates/espansoconfig-core/tests/patch_raw_item.rs`, `crates/espansoconfig-core/tests/persist_raw_item.rs`,
  `docs/decisions/3-7-notes.md`; modified `crates/espansoconfig-core/src/patch/{edit.rs,mod.rs}`,
  `crates/espansoconfig-core/src/draft/audit.rs`, `src-tauri/src/{commands,error,main,wire_contract,dictionary_contract,dispatch_check,retained_state_contract}.rs`,
  `src/lib/ipc/{types,errors,commands,commands.test}.ts`, `src/lib/i18n/{en.json,es.json,codes.test.ts}`, `CLAUDE.md`.
- **Verification run (orchestrator, all exit 0):** `cargo test --workspace -- --test-threads=1` (33 result
  lines, 1464 passed, 0 failed); `cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`;
  `cargo tree -p espansoconfig-core` (no tauri); `npm test` 3693 passed; `npm run check` 466 files 0/0;
  `npm run build` 201 modules. Rung `1430 / 466 / 3692 / 201` → `1464 / 466 / 3693 / 201`.
- **Risks to probe hardest:**
  1. Locality: can any accepted replacement change a byte outside the owned range, or change another match's
     meaning (block scalar above absorbing the first line, block scalar in the text swallowing the line below,
     a comment changing owner, indentation escaping the item)?
  2. Contiguity: is "owned range with holes" detected from the same run derivation move/delete/duplicate use,
     and is the refusal typed so 3-8 can offer the whole-document editor?
  3. `\r` handling (read and edit refusal for the snippet's own text only), BOM, no-final-newline files.
  4. The worker relaxed the YAML 1.1 ambiguous-scalar audit (`draft/audit.rs`) for plain scalars the author
     writes inside the edited item — is that sound and is it narrowly scoped?
  5. A contract test's writer count changed from six to seven (`save_match_item_text`); confirm the new writer
     ends in `run_one_save` and nothing writes outside `save_document`.
  6. Stale `MatchId` (D2v) refused on both read and save; the edit must be the only edit in its batch.
  7. Records: `3-7-notes.md` and the `CLAUDE.md` §6 sentence must not claim a guarantee the code does not give;
     no real-config content quoted anywhere.
- **Review file:** `docs/reviews/phase-3-7.md`.
- **Time budget:** 25 minutes.
