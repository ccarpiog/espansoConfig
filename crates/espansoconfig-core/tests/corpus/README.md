# Golden corpus

The corpus is the evidence behind the project's one hard guarantee: **an edit
changes the bytes it was asked to change, and nothing else.** It backs the
round-trip property test of `IMPLEMENTATION_PLAN.md` section 11 and the parser
evaluation of section 12, Phase 0.

It has two tiers.

## `synthetic/` — committed

Hand-authored fixtures with neutral content. No personal data, ever. These are
the files CI runs against and the files a fresh clone gets.

| File | Covers |
|---|---|
| `scalar-styles.yml` | plain, `'single'`, `"double"`, `\|`, `\|-`, `\|+`, `\|2`, `>`, `>-`, plus multi-line quoted scalars whose value contains a blank line |
| `block-scalars.yml` | the full header matrix: `\|`/`>` × clip/strip/keep × explicit indent (`\|2-`, `\|2+`), a blank line that is scalar content, a `#` that is shell text, a comment directly after a block |
| `block-scalar-leading-blank-lines.yml` | blocks that **open** with one or more empty lines, in all three chomping modes plus folded, and one block that is nothing but empty lines |
| `block-scalar-terminal-spaces.yml` | a block whose last line ends in genuine trailing spaces at end-of-source, with no final newline: there is no next token, so the spaces are content |
| `folded-more-indented.yml` | folded blocks with **more-indented** lines, which YAML never folds — including a run between blank lines and an explicit `>2` indicator |
| `unicode-offsets.yml` | precomposed `é`, **decomposed** `é`, astral `😀`, `tail` — the fixture that pins the offset-counting scheme |
| `comments-everywhere.yml` | file header, leading, trailing, inline, between sequence entries |
| `blank-lines.yml` | runs of 2+ blank lines, blank lines inside a mapping and inside a block scalar |
| `anchors-aliases-tags-merge.yml` | anchors, aliases, explicit `!!str` tags, `<<` merge keys |
| `duplicate-keys.yml` | duplicate mapping keys (parse-valid, compose-ambiguous) |
| `flow-collections.yml` | `[a, b]`, `{k: v}`, multi-line flow with an interior comment, empty collections |
| `multi-document.yml` | `---` / `...` streams, plus a `---` that is block-scalar content |
| `non-ascii.yml` | Spanish accents, `⌘ ⌥ ⇧ ⌃`, accented mapping keys, astral-plane emoji |
| `plain-scalar-hazards.yml` | the `choose_scalar()` table: `yes`, `~`, `1.50`, `:sig`, `- item`, `  padded  `, backslash regex, … |
| `form-layout-and-choice.yml` | shorthand `form` + `form_fields`, verbose `type: form` with `layout` and `fields`, `choice` in both value shapes |
| `variable-chain.yml` | `form` → `echo` → `date` → `shell` → `script` ordered by `depends_on`, plus `inject_vars: false` |
| `html-and-markdown.yml` | `html`, `markdown`, `image_path`, `paragraph` |
| `imports-and-global-vars.yml` | `imports`, `global_vars`, word-boundary and case options |
| `config-profile.yml` | a `config/*.yml` profile, not a match file |
| `crlf-line-endings.yml` | CRLF throughout, including inside a literal block |
| `bom-utf8.yml` | leading UTF-8 BOM (`EF BB BF`) |
| `no-trailing-newline.yml` | final byte is not a newline |
| `invalid/*.yml` | deliberately broken YAML, in its own directory so valid-file tests can glob cleanly |

### ⚠️ Eight files must never be "fixed"

`crlf-line-endings.yml`, `bom-utf8.yml`, `no-trailing-newline.yml`,
`unicode-offsets.yml`, `block-scalars.yml`,
`block-scalar-leading-blank-lines.yml`, `block-scalar-terminal-spaces.yml` and
`folded-more-indented.yml` exist precisely because they violate what an editor
considers tidy. Editors and formatters will offer to normalise the line endings,
strip the byte-order mark, add the missing final newline, normalise the
decomposed `é` to NFC, collapse the deliberate blank runs after and under the
block scalars, trim the two terminal spaces at end-of-source, and re-indent the
more-indented folded lines. **Every one of those "fixes" silently deletes the
test.**

Guards in place:

- `.gitattributes` marks the corpus `-text`, so git never converts line endings
  on checkout or commit.
- `scripts/build-byte-exact-fixtures.sh` regenerates the four `printf`-authored
  ones from explicit escapes and asserts the bytes afterwards.
- `tests/corpus_integrity.rs` fails the build if any of the eight loses its
  distinguishing bytes.

Verify by hand at any time:

```sh
xxd crates/espansoconfig-core/tests/corpus/synthetic/crlf-line-endings.yml | grep -m1 0d0a
xxd -l 3 crates/espansoconfig-core/tests/corpus/synthetic/bom-utf8.yml     # efbb bf
tail -c 1 crates/espansoconfig-core/tests/corpus/synthetic/no-trailing-newline.yml | xxd  # 27, not 0a
xxd crates/espansoconfig-core/tests/corpus/synthetic/unicode-offsets.yml | grep -m1 65cc  # 65 cc 81
tail -c 3 crates/espansoconfig-core/tests/corpus/synthetic/block-scalar-terminal-spaces.yml | xxd  # ends 20 20
```

### A note on `duplicate-keys.yml`

It sits in `synthetic/` rather than `invalid/` on purpose. Duplicate keys are
well-formed at the token level and only ill-defined at the composition level;
parsers disagree about which. That disagreement is itself something the parser
evaluation measures, and the editor's job is to warn about the duplication
rather than silently drop one of the pair while saving.

## `real/` — gitignored, never committed

The repository is **public** and the owner's live espanso config contains
personal templates. Real files are therefore never committed, and the directory
is ignored via `crates/espansoconfig-core/tests/corpus/real/` in `.gitignore`.

Populate it on demand:

```sh
./scripts/sync-real-corpus.sh
```

That copies `~/Library/Application Support/espanso/{match,config}` into
`real/`. Every test that touches the real corpus **skips cleanly** when the
directory is absent or empty, so a fresh clone and CI both pass without it.

If you ever see a file from `real/` in `git status`, stop and fix the ignore
rule before doing anything else.
