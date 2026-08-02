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

# Regenerate the five script-built byte-exact corpus fixtures
# (CRLF, BOM, no final newline, Unicode offsets, block-scalar terminal spaces)
./scripts/build-byte-exact-fixtures.sh

# Copy the live espanso config into the gitignored real corpus
./scripts/sync-real-corpus.sh
```

**Fifteen corpus fixtures must never be "fixed" by an editor or a formatter.** Their whitespace
*is* the test data — a stray "trim trailing whitespace", "add final newline" or "reindent" on save
destroys what they exist to pin:

| Fixture | Bytes that must survive |
|---|---|
| `crlf-line-endings.yml` | `\r\n` line endings |
| `bom-utf8.yml` | the leading `ef bb bf` |
| `no-trailing-newline.yml` | absence of a final newline |
| `unicode-offsets.yml` | precomposed **and** decomposed `é`, astral `😀` — never normalise |
| `block-scalars.yml` | deliberate blank runs inside block scalars |
| `block-scalar-terminal-spaces.yml` | two real trailing spaces, then EOF with no newline |
| `block-scalar-leading-blank-lines.yml` | empty lines directly under a `\|`/`>` header |
| `folded-more-indented.yml` | the extra indentation of more-indented folded lines |
| `block-scalar-header-tails.yml` | three real spaces after a `\|-` indicator, plus comments on a `\|` and a `>2` header line |
| `file-comments-and-mixed-endings.yml` | exactly two CRLF lines among bare-LF ones, the blank line under an interior comment, no final newline |
| `single-line-no-line-ending.yml` | one line and **no line break at all** — the only document that gives an insertion no ending to copy |
| `run-based-removal-boundaries.yml` | four comment lines at **column zero** under a folded block indented six, and a comment block flush against the `vars:` below it with no blank line between — both are indentation, and re-indenting either silently swaps the shape the fixture tests |
| `move-block-scalar-seams.yml` | two `\|` block bodies at **column five** — deeper than their `replace:` key and shallower than the six an emitted block uses — with one leading comment block at column five and one at column two. Every column is the test: "tidying" a body to six, or re-indenting either comment, turns a refused move into its own safe twin |
| `move-run-joins.yml` | two `\|` block bodies at **column seven**, one leading comment block at column seven and one at column four, and the four blank lines that give two interior comments to the file. The blank lines split each envelope into two runs; the columns decide whether concatenating those runs feeds the second one's first comment to the block the first one ends with |
| `move-kept-comment-joins-a-block.yml` | two `\|` block bodies at **column five**, a file-owned comment block at column five and another at column two, and the four blank lines that make both file-owned. The columns are the two sides of R23 seen by a move |

`.gitattributes` in the corpus directory marks it `-text` so git never converts line endings, and
`tests/corpus_integrity.rs` fails the build if any of the fifteen loses its distinguishing bytes.

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

**Phase 0 is complete and its architectural gate is PASSED.** The round-trip property test passes
over **every eligible target of both corpora**, so plan §12's exit criterion is discharged in its
strong reading. `PROGRESS.md` is the authoritative state file; the gate verdict with its evidence
is `docs/decisions/0c-3b-2b-notes.md` §8.

The substrate verdict is `docs/parser-evaluation.md` — **`saphyr-parser` 0.0.11 plus a
character-to-byte adapter and our own gap scanner**. On it sit the `SyntaxIndex` (0b), the scalar
codec, path resolver and patch engine (0c), and four operations: edit a scalar, insert and remove
a mapping field, and move a match within one sequence.

**Phase 1 — the read-only browser — is complete through 1c-2b-2b-2, and its stated exit is met.** 1a
(the core-side read model), 1b-1 (the Tauri shell, the Svelte scaffold and the i18n layer), 1b-2a (the
read-only IPC surface), 1b-2b (the Rust-code→string dictionaries, the exhaustiveness check and the
localized macOS menu), 1c-1 (the three-pane shell, the sidebar, the snippet list, search and the
selection), 1c-2a (the detail pane's match), 1c-2b-1 (the hazards and diagnostics), 1c-2b-2a (the
raw-text boundary) and 1c-2b-2b (source text on screen, then the whole document) are all done.

**Plan §12's Phase 1 exit — *the owner can browse their entire real config and every snippet renders
correctly* — was checked in a running window over the real corpus, not assumed**: 13 files, zero load
failures, zero findings, every file's text rendered and all 65 snippets rendered.
`docs/decisions/1c-2b-2b-2-notes.md` §8 is the verdict, recorded as counts and file names only (D1).
It names three things it does not cover; the sharpest is that the real configuration produces **zero**
unmodelled entries, so synthetic fixtures are that surface's only coverage, permanently.

**Phase 2 — editing — is under way, and since 2b-2a this application can write a user's file from a
window.** 2a built the whole save transaction in Rust with no caller (plan §6.6, all thirteen steps);
2b-1 put its types on the wire with no command behind them; **2b-2a registered `move_match`, the
seventh `#[tauri::command]` and the first that is not read-only.**

**2b is complete as of 2b-2c-3b: eleven commands exist and five of them write** — `move_match`,
`save_match`, `create_match`, `delete_match` and `save_raw_document`. **All five end in one
`run_one_save`** in `src-tauri/src/commands.rs`, which carries a `SaveContent` and holds this
layer's single cache-coherency policy; a sixth writing command **calls it rather than copying it**,
because it was four copies once.

**Phase 2c — the editing UI — is split, and the split is `docs/decisions/2c-split-notes.md`.** Ten
sub-phases, 2c-1a first: the draft spine, with no editor and no screen. Three of its rules bind
before any code: **undo is not a sub-phase** — the draft state shape must be able to express it in
2c-1a or it will be rewritten under two editors later; **a committed whole-document replacement
must produce a typed invalidation effect**, because every `MatchId` in the file is stale and the
obligation is today represented in no type; and **a projection-based copy is not a duplicate** —
it drops comments, key order and scalar spelling, so calling it *Duplicate* breaks the
preservation promise in the one place nobody checks. Every sub-phase of 2c owes **three** kinds of
evidence: model tests, a **mounted-component test** (new to this project, taken deliberately in
2c-1b — `vite.config.ts` has held the decision open since 1b-1), and a manual window reading.

**`espansoconfig_core::persist::save_document` is the only entry point that may write a user's file.**
Never call `replace_file_atomically` or `replace_locked_file` from a command, and never from inside the
transaction — **the lock is not reentrant, so the process hangs silently and forever.** A save is
refused, not forced: findings go out and the acknowledged subset comes back, matched as an **exact
multiset**. **There is no `force` flag and adding one would undo the design.** `committed: false` and
`backup: None` are both legal on a *success*.

**2b-2 was split three ways because three of its six commands had no primitive behind them**, and
that is now discharged: 2b-2c-1 added `InsertItem` and `RemoveItem` to `DocumentEdit`, and 2b-2c-3a
added `SaveContent::ReplaceText` beside `SaveContent::Edits` **inside** the one entry point that
writes. The rule that forced the split still binds every later phase: **forcing a write into
existence outside `save_document` bypasses the lock, the revision check, the reparse, the validation
verdict, the acknowledgement and the backup — while appearing to work.**

**A raw save may write text the YAML parser rejects.** That is the owner's settled ruling, not an
oversight: refusing would mean this application cannot repair a file that is *already* broken. It is
never refused and never silent — the candidate comes back with an acknowledgeable
`DocumentDoesNotParse` finding **content-addressed to that exact text**, so consent collected for
one draft cannot be spent on another. **A committed write is never afterwards reported as an error**,
and that binds the TypeScript boundary too, not only Rust — `saveRawDocument` returns
`RawSaveOutcome` precisely because a rejecting reload callback once hid a committed save.

**The raw YAML viewer is a mode of the third pane**, and `documentStart` has **exactly one caller** —
it is the only way a `bom` segment is produced, and a slice must never pass it. `src/lib/browser/`
holds what a test can reach (`rawDocument.ts`); the component gets the walk.

**A window reading must be a short, single-purpose run.** A WKWebView whose window is occluded stops
running `setTimeout` about six seconds after launch — `open -a` does not restart it and
`-NSAppSleepDisabled` does not prevent it — and LaunchServices silently drops `--env` for a bundle path
it thinks is already running. One plan per launch, into a fresh bundle path
(`docs/decisions/1c-2b-2b-2-notes.md` §6.1).

**A raw-text command answers valid UTF-8 or refuses.** `document_text` returns
`CommandResult<string>`; a file that is not valid UTF-8 becomes a typed `NotUtf8 { path, offset }` and
**cannot be displayed at all**. That is exact preservation of valid UTF-8 plus a typed refusal — never
"the raw file bytes", and widening it later is a wire-format change Phases 2–5 inherit. Byte spans are
sliced **in Rust**: a JavaScript string index is a UTF-16 code unit and a `ByteSpan` counts bytes, so
`text.slice(span.start, span.end)` is wrong for any document with a non-ASCII character before the span.

**Nothing in this project renders a Svelte component in an automated test.** The frontend suite passes
without instantiating one, so a component that throws produces a blank pane the suite cannot see. A
claim about a screen therefore needs a **reading of a screen**, re-taken after any change to a
component — `docs/decisions/1c-1-notes.md` §10 records the technique.

**A component renders a code by calling an accessor, never by building a key.**
`src/lib/i18n/codes.ts` gives twelve typed `describe*` functions over sixteen enum namespaces, and
`index.ts` wraps each in a reactive `t*`. The builders' return types make a **missing key a compile
error in that file**; building a key by hand opts out of the only check that catches it. On the Rust
side, a variant with no string — or a whole new enum — is a `cargo test` failure
(`src-tauri/src/dictionary_contract.rs`). The one construct that still escapes is an enum a
`macro_rules!` expands to; that is written down rather than hoped about.

**The architecture-rule check changed at 1b-1 (D2x).** §3 above is unchanged and absolute, but
`rg -c tauri Cargo.lock` is no longer evidence for it — `src-tauri/` exists, so the lockfile contains
tauri legitimately. The check is now:

```sh
cargo tree -p espansoconfig-core | rg tauri     # must find nothing
```

**Frontend build and test:**

```sh
npm run check      # svelte-check, run with --fail-on-warnings
npm run build      # vite
npm test           # vitest — i18n key parity, placeholder parity, the markup scan
```

Three things the gate deliberately does **not** license, each with a reason recorded in `PROGRESS.md`:

- **presenting a plain scalar's *type*** to the user — R16's open half: the projection of a
  pre-existing plain scalar is not proven to match espanso's YAML 1.1 resolver. **Decided (D2u): the
  UI shows a scalar's source text as written, never an inferred type.** Flagging one as
  1.1-ambiguous is permitted — that is a claim about risk, not about meaning;
- **moving a match between files or between sequences** — D2r; `ItemMove` is same-sequence only;
- **combining a move with any other edit in one batch** — R25.
