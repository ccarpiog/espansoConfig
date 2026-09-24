# Phase 3-9-1 — The file-scope inspector: the model, the components and the i18n

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-9" and its addendum of 2026-09-24 (the 3-9-1 /
3-9-2 cut); §3 ruling 14; §4.3. 3-9-2 owns the window half.
**Risk:** routine. **Display only** — no writer, no import resolution, no rename control.

No window reading was performed or claimed.

Everything below that says a sentence or a row is drawn is **mounted jsdom evidence** (ruling 30): it
proves a node is in the DOM, never that a window draws it.

---

## 1. What changed, and why

### 1.1 The model (`src/lib/browser/fileScope.ts`, new)

- **`importsStateOf(view)`** answers one of five states: `notRead` (the substrate did not accept the
  file), `absent` (no `imports` key), `empty` (`imports: []`, or an `Items` presence counting none),
  `unsupportedShape` (written as something other than a list, carrying the `ValueKind` found) and
  `listed` (one row per projected entry).
- **Rows are the file's order.** `listed` maps `DocumentView.imports` one-to-one, 1-based position
  included. A scalar entry is an `asWritten` row carrying `scalarDisplay` of the projected
  `ScalarView` untouched (D2u). An entry the core elided in place (a collection or an alias) is an
  `unsupported` row at its own position with its reason code (`found: ValueKind`) and its node; the
  `Sequence`, `Mapping` and `Alias` arms of `ValueView` are handled too, so a wider projection cannot
  drop an entry silently.
- **Any projected entry makes the state `listed`**, whatever `imports_presence` says, so a
  disagreement between the two fields can hide nothing.
- **No resolution.** No row holds a path, an existence or a missing flag; the module makes no request
  and joins nothing to the configuration root. The sentence over the list tells the reader so.
- **`autoLoadOf(file)`** reads the core's `disabled` flag (espanso's default include pattern skips a
  file whose name starts with `_`) and the file's `kind` from a `DocumentSummary` or a `DocumentView`:
  `notAutoLoaded` (a snippet or package file), `underscoreProfile` (a configuration profile — see
  §5) or `default`. `default` draws nothing — whether an ordinary file is loaded depends on include and
  exclude rules this app does not evaluate, so the inspector never claims "loaded automatically".
- Key functions beside the types: `importsStateKey`, `unsupportedImportKey`, `autoLoadKey`.

### 1.2 The i18n

- Twelve `browser.fileScope.*` keys, EN and ES (ten, plus the two `underscoreProfile.*` keys of §5).
  Accessors in `src/lib/i18n/codes.ts` (`describeAutoLoadNote`, `describeImportsState`,
  `describeUnsupportedImport`; the two operand sentences take `{kind}` through `describeValueKind`)
  with reactive wrappers in `index.ts` (`tAutoLoadNote`, `tImportsState`, `tUnsupportedImport`). No Rust code was added, so
  `dictionary_contract.rs` is untouched.
- **`browser.sidebar.notAutoLoaded` became `browser.fileScope.notAutoLoaded.mark`** (same words in both
  locales), so the mark and its explanation are one accessor's two placements.

### 1.3 The components

- **`src/lib/components/FileScope.svelte`, new.** Draws `describeFileScope(document)`: the `_`
  explanation paragraph, the *Imports* heading, the state sentence and, for `listed`, an `<ol>` whose
  items are the entries through `SourceText` (the empty, style and YAML 1.1-ambiguity markers as the
  detail pane draws them) or the unsupported reason. No button, input or link.
- **`SnippetList.svelte`** mounts it when one file is in scope (`browser.scopedDocument`), after the
  file's findings and before the rows; the "All" scope is no file and draws none.
- **`Sidebar.svelte`**: the mark is decided by `autoLoadOf`, reads `tAutoLoadNote(state, 'mark')`,
  and carries the whole explanation of the same state as its `title`.
- **Wording.** No user-facing string said "inactive" before this phase (the sidebar already read "Not
  loaded automatically"); the one wording that implied it was a module doc in
  `crates/espansoconfig-core/src/discovery.rs` ("show such files as intentionally disabled"), now "as
  not auto-loaded (never "inactive")". A test holds both dictionaries free of `inactiv`.

### 1.4 Tests

- `src/lib/browser/fileScope.test.ts` (24 after the §5 fix): one `describe` per acceptance clause — order and
  positions, unsupported entries in place, no resolution (row shapes pinned, the scalar passed by
  identity), the four non-list states, the `_` state from a summary and a view, per file kind (§5), and every
  accessor in both locales.
- `src/lib/components/FileScope.test.ts` (17 after the §5 fix, jsdom, invoke guard at exact zero): the inspector alone
  per state per locale, no controls, a live language switch; then `Sidebar.svelte` and
  `SnippetList.svelte` over a real `BrowserState` built from scripted commands — only the `_` file is
  marked, the mark's `title` is the explanation, a `_` profile carries its own mark and sentence, the inspector follows the selected file and is absent
  for "All".
- `scripts/lint/composition-guards.test.ts` inventories the new mounted suite (`invokeZero`).

## 2. Decisions

- **D1 — absent and empty are drawn as two states.** The fallback in §2 and §4.3 was not needed:
  3-2's `imports_presence` already tells them apart, and the Rust projection was not widened.
- **D2 — an unparsed file is its own state.** Rust answers `Absent` for it; drawing that as "no
  imports key" would claim something nobody read.
- **D3 — the placement is the list pane, not the detail pane.** The spec names "the document and
  detail components". The list pane is the file-level pane that is reachable for every file,
  including a `_` file holding only `imports` (no snippet to select), and it already carries the
  file's findings for that reason (`findings.ts`). The detail pane is about one snippet or the file's
  whole text; drawing the inspector there as well would show the same block twice beside itself, so
  `DetailPane.svelte` was not changed.
- **D4 — the wire field keeps its name.** `disabled` on `DocumentSummary` / `DocumentView` is internal;
  renaming it would widen the wire contract for no user-visible gain. Its doc comments already say
  "espanso's default include glob skips the file".

## 3. Verification

| Gate | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace -- --test-threads=1` | 1465 passed, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `npm run check` | 474 files, 0 errors, 0 warnings |
| `npm test` | 80 files, 3822 passed (3815 before the §5 fix) |
| `npm run build` | 207 modules |

Rung: **1465 / 474 / 3822 / 207** after the §5 fix (3815 before it; previous `1465 / 470 / 3773 / 204`). The +3 modules are the new
`fileScope.ts` (one) and the styled `FileScope.svelte` (two). Bundle oracle after the build: the
server-only pattern is absent; the client-only pattern is present (2).

## 4. Open items

1. **The window half** — 3-9-2: EN and ES through the picker, a `_` file with imports, an unsupported
   entry and the absent/empty states, on a visible, unlocked screen.
2. **A `_` file under `config/`.** The sentence is now profile-specific (§5). Still open: whether
   espanso itself skips or loads a `_` profile was not checked, so the core's `disabled` flag on a
   profile is unconfirmed; a later phase may verify against espanso's source and then either widen
   the profile sentence or change the core flag.
3. **An entry whose text holds a line break or a `\r`** is drawn through `SourceText`, which draws the
   break and names invisibles; no fixture pins that for imports specifically.

## 5. Review fix

**Finding (SHOULD-FIX, `docs/reviews/phase-3-9-1.md`):** the `_` explanation ignored `FileKind`. For
`config/_chrome.yml` both the inspector and the sidebar tooltip said its contents are used only
through `imports` or a profile's `extra_includes` — wrong for a configuration profile — and the
snippet-file guidance omitted a configuration's `includes`.

**Resolution:**

- `autoLoadOf` in `src/lib/browser/fileScope.ts` now reads `kind` as well: a flagged
  `ConfigProfile` is `underscoreProfile`; a flagged `MatchFile` or `Package` (a package file lives
  under `match/`, which the default pattern covers) stays `notAutoLoaded`. `autoLoadKey(note,
  placement)` and the accessor `describeAutoLoadNote(locale, note, placement)` / `tAutoLoadNote`
  replace `describeNotAutoLoaded` / `tNotAutoLoaded`; both components draw any non-`default` state.
- The snippet-file explanation now names all three routes: another file's `imports`, or a
  configuration's `includes` or `extra_includes`.
- A `_` profile gets `browser.fileScope.underscoreProfile.{mark,explanation}`: the mark reads "Name
  starts with “_”" and the sentence says only that the name starts with `_`, that the default include
  pattern skips such names for snippet files, and that this app does not check how espanso treats a
  configuration file named this way. **It makes no loading claim** — espanso's handling of `_`
  profiles was not verified (open item 2), so even "not loaded automatically" is not said of one.
- Tests: the model suite covers a `_` snippet file, a `_` package file, a `_` profile and an ordinary
  profile, and holds the profile words free of `imports`/`includes`/"not loaded" in both locales; the
  mounted suite adds `config/_chrome.yml` to the scripted workspace (its own mark and title in the
  sidebar, its own sentence in the inspector) and mounts the inspector alone over a `_` profile.

Gates after the fix: `cargo test --workspace -- --test-threads=1` 1465 passed, 0 failed; clippy,
`cargo fmt --check`, `npm run check` (474 files, 0 errors, 0 warnings), `npm test` (80 files, 3822
passed) and `npm run build` (207 modules) all exit 0. Rung **1465 / 474 / 3822 / 207**. Bundle oracle:
server-only pattern absent, client-only pattern present.
