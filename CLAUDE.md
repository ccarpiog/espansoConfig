# espansoConfig — project instructions

A macOS Tauri v2 app for editing espanso YAML configuration **without ever reformatting the parts of
the file the user did not edit**. `IMPLEMENTATION_PLAN.md` is the specification; `PROGRESS.md` is the
live project state and names the next action. This file holds only the project rules that are easy
to violate by accident. **It holds no review or phase rule of its own** — those are the autoclaude
workflow's (`~/.claude/scripts/autoclaude-base.md`); §7 says what that means here.

---

## 1. Corpus privacy — read this first

**The GitHub repository is PUBLIC. The owner's live espanso config contains personal email
templates and must never be committed.**

- Committed test data lives in `crates/espansoconfig-core/tests/corpus/synthetic/` and is
  hand-authored with neutral content. No real names, addresses or email bodies, ever.
- The real config is copied on demand into `crates/espansoconfig-core/tests/corpus/real/`, which is
  **gitignored** (`.gitignore`, "Real-config test corpus — PRIVACY CRITICAL"). Populate it with
  `./scripts/sync-real-corpus.sh`; that script refuses to copy anything if the ignore rule is missing.
- Tests that use the real corpus **skip cleanly** when it is absent, so a fresh clone and CI both pass.
- Never quote real config content in a document, a commit message, a code comment or a report. File
  names, counts and error line numbers are fine; content is not.

After touching `.gitignore` or the sync script, verify:

```sh
./scripts/sync-real-corpus.sh
git check-ignore -v crates/espansoconfig-core/tests/corpus/real/match/base.yml
git status --short --untracked-files=all   # no real-config path may appear
```

## 2. Localization

**English and Spanish, both, from day one, via i18n** (plan §2 — a locked decision). **Never hardcode
a user-facing string.** Every label, message and error the user can see goes through the i18n layer
(`src/lib/i18n/{en,es}.json`). A component renders a code by calling a typed `describe*` accessor in
`src/lib/i18n/codes.ts` (wrapped reactively in `index.ts`), never by building a key by hand — the
accessors make a missing key a compile error, and a hand-built key opts out of that check. On the
Rust side, `src-tauri/src/dictionary_contract.rs` fails `cargo test` for a variant with no string.
The i18n suites check key parity and placeholder agreement, not meaning.

All code, comments, documentation, README files and commit messages are in **English**, including
the Spanish translation files' own comments.

## 3. Architecture rule

**`crates/espansoconfig-core` must never depend on `tauri`**, directly or transitively. It is the
standalone, independently testable and fuzzable domain library (plan §6.1). Tauri lives in
`src-tauri/`, whose commands are thin wrappers over the core. The check:

```sh
cargo tree -p espansoconfig-core | rg tauri     # must find nothing
```

(`rg -c tauri Cargo.lock` is not evidence — `src-tauri/` exists, so the lockfile contains tauri
legitimately.)

The file text on disk is the source of truth. The typed model is a read-only *projection* over it.
Every edit is a byte-span replacement, and everything outside the intended span must come out
byte-identical.

## 4. Build and test

```sh
cargo build --workspace
cargo test --workspace -- --test-threads=1
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --check

npm run check      # svelte-check, run with --fail-on-warnings
npm run build      # vite
npm test           # vitest — i18n key parity, placeholder parity, the markup scan

# The Phase 0 parser evaluation, with its evidence printed
cargo test -p espansoconfig-core --test parser_evaluation -- --nocapture --test-threads=1

# Regenerate the five script-built byte-exact corpus fixtures
./scripts/build-byte-exact-fixtures.sh

# Copy the live espanso config into the gitignored real corpus
./scripts/sync-real-corpus.sh
```

- **`--test-threads=1` is the authoritative form of the Rust gate on this host.** The `watch_check`
  tests run real filesystem watchers and time out under parallelism; a parallel run that fails only
  `watch_check` says nothing about source. Never read a cargo exit status through a pipe — redirect to
  a file and grep it.
- **`PROGRESS.md` carries the live gate baseline** (Rust tests / `svelte-check` files / vitest tests /
  Vite modules). The module count is a regression guard: a new `.ts` module costs one, a new styled
  component costs two. Rebaseline by building a pristine `git archive HEAD` copy and subtracting, never
  by editing the condition.
- **`resolve.conditions` in `vite.config.ts` is set conditionally, and that is load-bearing.** The
  option *replaces* Vite's defaults; set unconditionally it pulls Svelte's **server** build into
  production with nothing failing. Searching the bundle for the literal `svelte/internal/server` is
  vacuous (Vite minifies specifiers away). Use the oracle that discriminates, and read **both** lines:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # server-only — must be ABSENT
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    # client-only — must be PRESENT
```

**Fifteen corpus fixtures must never be "fixed" by an editor or a formatter.** Their whitespace *is*
the test data — a stray "trim trailing whitespace", "add final newline" or "reindent" on save destroys
what they exist to pin:

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
| `single-line-no-line-ending.yml` | one line and **no line break at all** |
| `run-based-removal-boundaries.yml` | four comment lines at **column zero** under a folded block indented six, and a comment block flush against the `vars:` below it |
| `move-block-scalar-seams.yml` | two `\|` block bodies at **column five**, one leading comment block at column five and one at column two |
| `move-run-joins.yml` | two `\|` block bodies at **column seven**, one leading comment block at column seven and one at column four, and four blank lines |
| `move-kept-comment-joins-a-block.yml` | two `\|` block bodies at **column five**, a comment block at column five and another at column two, and four blank lines |

`.gitattributes` in the corpus directory marks it `-text` so git never converts line endings, and
`tests/corpus_integrity.rs` fails the build if any of the fifteen loses its distinguishing bytes.

## 5. Coding conventions (plan §14)

- All code, comments, docs, README files and commit messages in **English**.
- **JSDoc on every JavaScript/TypeScript function.** In Rust, a doc comment on every public item;
  `#![deny(missing_docs)]` enforces it in `espansoconfig-core`.
- Any function or loop longer than 10 lines gets a closing-bracket comment, e.g.
  `// End of function choose_scalar()` or `// End of the loop over the rows array`.
- No TitleCase unless explicitly requested.
- Never run git or clasp unless explicitly asked; an autoclaude run is that authorization for its own
  commits and pushes.
- When telling the user to run a function, always name the file it lives in
  (e.g. "`resolve_config_dir()` in `crates/espansoconfig-core/src/discovery.rs`").
- Commit messages never mention Claude or AI assistance.
- Where TypeScript or Rust cannot force something, the comment that describes what the code does force
  says so in the same sentence. A record or a comment that claims a guarantee the code does not give is
  this project's worst defect class, because no test can fail it.

## 6. Invariants and gotchas

Facts about this codebase that are easy to break while looking correct. Each was learned the hard way;
the phase records under `docs/decisions/` hold the details.

**Writing files**

- `espansoconfig_core::persist::save_document` (`crates/espansoconfig-core/src/persist/write.rs`) is
  the **only** entry point that may write a user's file. Never call `replace_file_atomically` or
  `replace_locked_file` from a command or from inside the transaction: **the lock is not reentrant, so
  the process hangs silently and forever.** Forcing a write into existence anywhere else bypasses the
  lock, the revision check, the reparse, the validation verdict, the acknowledgement and the backup
  while appearing to work.
- A save is refused, never forced. **There is no `force` flag and adding one would undo the design.**
  Findings go out and the acknowledged subset comes back, matched as an exact multiset.
  `committed: false` and `backup: None` are both legal on a success.
- **A committed write is never afterwards reported as an error**, in TypeScript as well as Rust
  (`saveRawDocument` returns `RawSaveOutcome` for exactly this reason).
- A raw save may write text the YAML parser rejects — the owner's settled ruling, so the app can repair
  a file that is already broken. It comes back with an acknowledgeable `DocumentDoesNotParse` finding
  content-addressed to that exact text, so consent for one draft cannot be spent on another.
- All writing commands in `src-tauri/src/commands.rs` end in one `run_one_save`, which holds this
  layer's single cache-coherency policy. A new writer calls it; it is never copied.
- **D2u:** the UI shows a scalar's source text as written, never an inferred type; flagging one as YAML
  1.1-ambiguous is allowed (a claim about risk, not meaning). **D2r:** `ItemMove` is same-sequence
  only. **R25:** a move is the only edit in its batch. **Duplicate** is a true duplicate — the item's
  owned runs cloned byte-identically, trigger included — never a projection copy, which would drop
  comments, key order and scalar spelling.
- `word`, `left_word` and `right_word` are three independent source-text fields and stay textual
  controls; a checkbox would have to decide that `word: on` means boolean true, which D2u forbids.

**Text on the wire and on screen**

- `document_text` answers valid UTF-8 or a typed `NotUtf8 { path, offset }` refusal, never raw bytes.
  Byte spans are sliced **in Rust**: a JavaScript string index is a UTF-16 code unit and a `ByteSpan`
  counts bytes, so `text.slice(span.start, span.end)` is wrong for any document with a non-ASCII
  character before the span.
- `documentStart` in `src/lib/browser/rawDocument.ts` has exactly one caller; it is the only producer
  of a `bom` segment, and a slice must never pass it.
- **A `<textarea>` value has every line break normalized to LF, and an `<input type="text">` deletes a
  carriage return outright** (measured in the shipped WKWebView). The raw editor therefore refuses any
  text containing `\r` rather than reconstructing one — `file-comments-and-mixed-endings.yml` has two
  CRLF lines among bare-LF ones, so re-applying a dominant convention would reformat untouched lines.
  A projected value holding a real `\r` is read-only and is drawn through `SourceText`, never into a
  box; the refusal is enforced at eligibility, at `editField` and at `beginSave`, the last because
  `MatchBuffers` carries no brand. Every new editor that drafts through a textarea or an input meets
  the same normalization and must decide it deliberately.
- `src/lib/components/clipboard.ts` refuses the `<textarea>` carrier for text holding a `\r`; only
  `navigator.clipboard.writeText` preserves one, so a failed copy promises no hand copy.

**Frontend structure**

- Decisions live in `src/lib/browser/` as values (`matchEditor.ts`, `rawEditor.ts`, `matchMove.ts`,
  `matchDuplication.ts`, …); components draw them. A rule written into one renderer is carried by that
  renderer's mounted suite alone, and a second renderer can omit it while walking the model faithfully.
  Deciding *what* to draw and *whether* to draw it are two rules, and only a renderer can own the
  second (`RecoveryWithoutCreation.svelte` is the pattern).
- Only the files that opt into jsdom by docblock mount a component; `environment: 'node'` stays the
  default. A mounted test proves a handler fires, not that a window draws. **A green suite is not a
  screen**: a claim about what a window draws needs a look at a window.
- `MatchBaseline` is what the file held, including whether it held the key at all; `MatchBuffers` is
  what the controls hold; `fieldIntent` is the only function that reads both. **An initially absent
  field left blank is `'Unchanged'`, not `Set("")`.**
- `conflictChoicesFor` is the only producer of a conflict choice list, and `adoptDiskVersion` is the
  only door that installs a disk version (`DiskAdoptionOutcome` = `installed | alreadyThere | refused`;
  callers stop only on `refused`). A conflict installs nothing until a confirmed reload.
- The selection machinery is **two counters**: per-document `projectionGenerations` (this file's
  projection was replaced) and the global `selectGeneration` (the intent this lookup served is gone).
  Every write to `selected` bumps one in the same synchronous block, through `replaceSelection` or by
  the two documented exceptions. Nothing in TypeScript enforces that.
- `documentHasUnsavedDraft` measures *any open match editor*, dirty or not; the refusal sentences say
  so and must not claim unsaved edits exist.
- **A check and a spend separated by any property read are not atomic**: a property read runs
  arbitrary code through a getter or a `Proxy` trap, and `readonly` does not freeze at runtime. A
  consuming operation whose result is discarded (`set.delete(x)` with the boolean thrown away) is a
  check-and-spend defect.
- `openWholeDocumentSave(sealed, forget)` in `src/lib/browser/invalidation.ts` is the only way to learn
  a whole-document save outcome; after a committed replacement every `MatchId` in that file is stale.
  In `draft.ts`, `isDirty` is derived and consent is opaque — `acknowledgeRefusal` is the only producer.
- A `MatchId` is refused across a revision change (D2v): every lookup that can cross a reparse handles
  `IdentityError::StaleRevision` rather than unwrapping it. A confirmation that compares two values
  minted together observes nothing; compare against the live projection.

**Window readings**

- A WKWebView whose window is occluded stops running `setTimeout` about six seconds after launch, and
  LaunchServices drops `--env` for a bundle path it thinks is already running: one plan per launch, into
  a fresh bundle path (`docs/decisions/1c-2b-2b-2-notes.md` §6.1).
- The webview's `localStorage` follows the **bundle identifier**, not `HOME`, so a language override
  survives across probe bundles; a plan sets the language through the picker explicitly.
- The temporary window-reading instrument (`src-tauri/src/probe.rs`, `src/probe.ts`, two hook lines
  each in `src-tauri/src/main.rs` and `src/main.ts`) is never committed; stage by path, never
  `src-tauri/src/` as a directory.

## 7. Reviews and phases

The autoclaude workflow owns the review policy and this file adds nothing to it: **one adversarial
review per phase; blockers fixed and verification re-run; the phase closes.** Concretely:

- **A fix is not owed a review.** Fixing what a review found and closing the phase is the whole
  procedure. No phase is ever created to review a fix, and no phase is named as a letter appended to
  its parent.
- **A corrective phase exists only for substantial new work** a review finds out of the phase's scope,
  with its own acceptance criteria. It is never a re-review.
- **A fix answers the findings the review named, in the files it named.** Anything else noticed on the
  way is written into the phase's notes as an open item for a later phase to take deliberately, not
  fixed in the same phase.
- **Records under `docs/` are records.** A wrong sentence in one is corrected, not reviewed.
- **One notes file per phase**, recording what changed and why.

The rule this replaces — *a fix round that changed at least one source file commissions a review
round* — turned every blocker fix into a new phase and produced a fourteen-round tail on 2d-5-3 and a
seven-phase one on 2d-5-4 (`2d-5-4-A` … `G`) that delivered no feature. It was removed on 2026-09-20;
the previous text of this file is archived at `docs/progress-archive/claude-md-2026-09-20.md`.
