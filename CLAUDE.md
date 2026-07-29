# espansoConfig — project instructions

A macOS Tauri v2 app for editing espanso YAML configuration **without ever reformatting the
parts of the file the user did not edit**. `IMPLEMENTATION_PLAN.md` is the authoritative
specification; this file records only the rules that are easy to violate by accident.

---

## 1. Corpus privacy — read this first

**The GitHub repository is PUBLIC. The owner's live espanso config contains personal email
templates and must never be committed.**

- Committed test data lives in `crates/espansoconfig-core/tests/corpus/synthetic/` and is
  hand-authored with neutral content. No real names, addresses or email bodies, ever.
- The real config is copied on demand into
  `crates/espansoconfig-core/tests/corpus/real/`, which is **gitignored**
  (`.gitignore`, "Real-config test corpus — PRIVACY CRITICAL"). Populate it with
  `./scripts/sync-real-corpus.sh`; that script refuses to copy anything if the ignore rule is
  missing.
- Tests that use the real corpus **skip cleanly** when it is absent, so a fresh clone and CI
  both pass.
- Never quote real config content in a document, a commit message, a code comment or a report.
  File names, counts and error line numbers are fine; content is not.

After touching `.gitignore` or the sync script, verify:

```sh
./scripts/sync-real-corpus.sh
git check-ignore -v crates/espansoconfig-core/tests/corpus/real/match/base.yml
git status --short --untracked-files=all   # no real-config path may appear
```

## 2. Localization

**English and Spanish, both, from day one, via i18n** (plan §2 — a locked decision).
**Never hardcode a user-facing string.** Every label, message and error the user can see goes
through the i18n layer (`src/lib/i18n/{en,es}.json`).

All code, comments, documentation, README files and commit messages are in **English**,
including the Spanish translation files' own comments.

## 3. Architecture rule

**`crates/espansoconfig-core` must never depend on `tauri`**, directly or transitively. It is
the standalone, independently testable and fuzzable domain library (plan §6.1). Tauri lives in
`src-tauri/`, whose commands are thin wrappers over the core.

The file text on disk is the source of truth. The typed model is a read-only *projection* over
it. Every edit is a byte-span replacement, and everything outside the intended span must come
out byte-identical.

## 4. Build and test

```sh
cargo build --workspace
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --check

# The Phase 0 parser evaluation, with its evidence printed
cargo test -p espansoconfig-core --test parser_evaluation -- --nocapture --test-threads=1

# Regenerate the three byte-exact corpus fixtures (CRLF, BOM, no final newline)
./scripts/build-byte-exact-fixtures.sh

# Copy the live espanso config into the gitignored real corpus
./scripts/sync-real-corpus.sh
```

Three corpus fixtures must never be "fixed" by an editor or a formatter:
`crlf-line-endings.yml`, `bom-utf8.yml`, `no-trailing-newline.yml`. `.gitattributes` in the
corpus directory marks it `-text` so git never converts line endings, and
`tests/corpus_integrity.rs` fails the build if any of the three loses its distinguishing bytes.

## 5. Coding conventions (plan §14)

- All code, comments, docs, README files and commit messages in **English**.
- **JSDoc on every JavaScript/TypeScript function.** In Rust, a doc comment on every public
  item; `#![deny(missing_docs)]` enforces it in `espansoconfig-core`.
- Any function or loop longer than 10 lines gets a closing-bracket comment, e.g.
  `// End of function choose_scalar()` or `// End of the loop over the rows array`.
- No TitleCase unless explicitly requested.
- Never run git or clasp unless explicitly asked.
- When telling the user to run a function, always name the file it lives in
  (e.g. "`resolve_config_dir()` in `crates/espansoconfig-core/src/discovery.rs`").
- Commit messages never mention Claude or AI assistance.

## 6. Current phase

Phase 0a is complete: workspace scaffold, `discovery` implemented, golden corpus built, parser
evaluation done. The verdict is in `docs/parser-evaluation.md` — **`saphyr-parser` 0.0.11 plus
a character-to-byte adapter and our own gap scanner**. Phase 0b builds the `SyntaxIndex` on
that; Phase 0c the patch engine and emitter. No UI work begins until the round-trip property
test passes on the full corpus (plan §12, Phase 0).
