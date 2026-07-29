# espansoConfig — implementation plan

**App name:** espansoConfig
**Target:** a small, beautiful, downloadable macOS app for creating, editing and deleting espanso snippets.
**Date:** 2026-07-29

**Naming conventions derived from the app name** (see [§10](#10-packaging-and-distribution)):

| Thing | Value |
|---|---|
| Product / display name | `espansoConfig` |
| Bundle identifier | `cc.carpio.espansoConfig` *(assumed from the `carpio.cc` domain — confirm)* |
| App bundle | `espansoConfig.app` |
| Cargo workspace root | `espansoConfig/` |
| Core crate | `espansoconfig-core` |
| Tauri crate | `espansoconfig` |
| Backup directory | `.espansoconfig-backups/` |
| Temp file suffix | `.espansoconfig-<random>.tmp` |

> The core crate is **not** named `espanso-config`: espanso itself ships an internal crate by
> exactly that name, and the collision would be confusing on crates.io and in error messages.

---

## 1. Product vision

Espanso is a superb text expander with a terrible authoring experience. Its power lives in
YAML that is actively hostile to non-experts: nested variable arrays, block scalar chomping,
`{{template}}` interpolation, `$|$` cursor hints, and escaping rules that silently corrupt data
when you get them wrong.

This app is a **native-feeling editor for that YAML**. You point it at your espanso config
directory, and it gives you TextExpander-grade ergonomics over espanso's file format — without
ever taking ownership of the files. Your YAML stays yours: hand-written comments, formatting,
and file organisation survive every edit.

The guiding constraint:

> Creating a plain `trigger → text` snippet must take three seconds.
> Forms, dates, shell commands and regex must remain discoverable — and must never be
> reachable by accident.

---

## 2. Locked decisions

These were decided by the product owner and are **not** to be re-litigated during implementation.

| Decision | Choice | Consequence |
|---|---|---|
| Stack | **Tauri v2** (Rust core + web UI) | ~10–20 MB universal DMG; WebKit not Chromium |
| Localization | **English + Spanish from day one** | No hardcoded UI strings, ever |
| Scope | **Editor only** | No daemon control, no install management, no Hub browsing |

Espanso's own file watcher (`auto_restart: true`, the default) reloads changes, so the app
never needs to touch the daemon.

**Accepted risks of the Tauri choice** (documented so they are not surprises):

- WebKit-specific text-editor and selection bugs that Chromium-based stacks do not have.
- Rust ↔ frontend state coordination is more complex than a single-process native app.
- macOS signing, entitlements, notarization and updater complexity.
- The code editor component may dominate frontend bundle size.
- **The YAML fidelity work is custom regardless of stack** — Tauri neither helps nor hurts here.

Tauri remains the right call: the UI is a good fit for web tech, the filesystem logic genuinely
belongs in Rust, and the "small download" goal rules out Electron.

---

## 3. Espanso domain model (authoritative reference)

Verified against espanso 2.3.0, the official docs, and the upstream JSON schemas
(`schemas/config.schema.json`, `schemas/match.schema.json`).

### 3.1 Directory layout

```
~/Library/Application Support/espanso/
  config/          # HOW espanso behaves — default.yml + app-specific profiles
    default.yml
  match/           # WHAT espanso types — snippets
    base.yml
    *.yml
    packages/      # installed Hub packages — TREAT AS READ-ONLY
```

- Default include glob: `../match/**/[!_]*.yml`
- **Files starting with `_` are not auto-loaded.** This is the mechanism for
  scoping snippets to specific apps via `extra_includes`.
- `espanso path` reports Config / Packages / Runtime locations.

### 3.2 Match file top-level keys

| Key | Type | Notes |
|---|---|---|
| `matches` | array | the snippets |
| `global_vars` | array | variables visible to every match in the file |
| `imports` | array of paths | pull in other match files, incl. absolute paths |
| `anchors` | — | reusable YAML anchor definitions |

### 3.3 The match object — every field

**Trigger side** (choose one):

| Field | Type | Notes |
|---|---|---|
| `trigger` | string | single trigger |
| `triggers` | array | multiple aliases for the same expansion |
| `regex` | string | Rust `regex` crate; named groups `(?P<name>…)` become `{{name}}` |

**Content side** (exactly one):

| Field | Type | Notes |
|---|---|---|
| `replace` | string | plain text; supports `{{vars}}` and `$|$` |
| `form` | string | shorthand form with `[[field]]` placeholders |
| `markdown` | string | rendered to rich text |
| `html` | string | rendered to rich text |
| `image_path` | string | supports `$CONFIG/…` |

**Metadata:** `label`, `comment`, `search_terms` (array)

**Word boundary:** `word`, `left_word`, `right_word` (booleans)

**Case:** `propagate_case` (bool), `uppercase_style` (`capitalize` | `capitalize_words` | `uppercase`)

**Injection:** `force_mode` (`clipboard` | `keys`), `force_clipboard` (legacy bool)

**Other:** `paragraph` (bool, markdown only), `form_fields` (object), `vars` (array), `anchor`

**Cursor hint:** `$|$` inside `replace` positions the caret after expansion.

### 3.4 The nine variable types

Every variable also accepts `inject_vars` (bool) and `depends_on` (array of names).
Referenced in content as `{{name}}`; form fields as `{{formvar.fieldname}}`.

| Type | Params |
|---|---|
| `date` | `format` (chrono strftime), `offset` (seconds), `tz` (IANA), `locale` (BCP47) |
| `choice` | `values`: array of strings **or** array of `{label, id}` |
| `random` | `choices`: array of strings |
| `clipboard` | none |
| `echo` | `echo`: string |
| `shell` | `cmd`, `shell` (bash\|sh\|zsh\|fish\|nu\|cmd\|powershell\|pwsh\|wsl\|wsl2), `trim`, `debug` |
| `script` | `args`: array of strings, `trim` |
| `form` | `layout` (string with `[[field]]`), `fields` (object) |
| `match` | `params.trigger` — nested match reference |

### 3.5 Forms

Shorthand:

```yaml
- trigger: ":greet"
  form: |
    Hey [[name]],
    [[body]]
  form_fields:
    body:
      multiline: true
```

Field types: **text** (default; `multiline`, `default`), **choice**, **list**
(`values` as array or multiline string, `default`, `trim_string_values`).

The verbose equivalent is a var of `type: form` with `params.layout` and `params.fields` —
this is what allows form values to feed into shell/script variables.

### 3.6 Config profiles (`config/*.yml`)

- **Filters** (all regex-matched): `filter_title`, `filter_exec`, `filter_class`, `filter_os`
- **Only one profile is active at a time**; ties broken **alphabetically by filename**
- **Scoping:** `includes`, `extra_includes`, `excludes`, `extra_excludes`, `use_standard_includes`
- Plus ~35 behaviour options (`backend`, `clipboard_threshold`, `toggle_key`, `search_shortcut`,
  `undo_backspace`, `word_separators`, `key_delay`, `inject_delay`, `paste_shortcut`, …)
- Typing `#detect#` in any app reveals its `title` / `exec` / `class` values — worth surfacing
  as a hint in the profile editor.

### 3.7 YAML hazards the editor must handle

- Strings containing `' " [] {} > | * & ! % # ` @` or leading indicators must be quoted.
- `\xC4`, `€`, `\U00000105` escapes only work in **double-quoted** scalars.
- Block scalars `|` / `|-` / `|+` / `>` differ in trailing-newline semantics — round-tripping matters.
- Backslashes in regex double up inside double-quoted scalars — **single quotes avoid this entirely**.
- `{{name}}` and `$|$` are espanso syntax, not YAML syntax, and must pass through untouched.

---

## 4. Real-world usage data

Measured directly against the product owner's live config (espanso 2.3.0, 13 files, 1365 lines,
~65 matches). This is the primary design corpus.

**Field frequency:**

| Field | Count |
|---|---|
| `replace` | 63 |
| `word` | 62 |
| `force_mode` | 62 |
| `label` | 49 |
| `vars` | 30 |
| `html` | 2 |

**Variable type frequency:**

| Type | Count |
|---|---|
| `form` | 24 |
| `choice` | 17 |
| `date` | 9 |
| `shell` | 3 |
| `clipboard` | 2 |

### What this tells us

1. **Forms are not an edge case — they are the dominant power feature.** 24 form variables
   across ~65 matches. A visual form builder is a **v1 requirement**, not a nice-to-have.
2. **`choice` fields inside forms are the workhorse.** The form builder must make
   "dropdown with a fixed list of values" a first-class, two-click operation.
3. **Nearly every match carries `word: true` + `force_mode: clipboard`.** These are artefacts
   of the Typinator migration. Two implications:
   - Sensible **per-file defaults for new snippets** would remove enormous repetition.
   - **Bulk edit** ("set injection mode on all selected") has real value.
4. **Variable chains exist in the wild.** One real match chains `form` → `date` → `shell`
   (a Python heredoc slicing a form value). Variables are an *ordered, interdependent list*,
   not a flat set. The UI must respect ordering and `depends_on`.
5. **HTML content is used for rich email templates** with `{{form1.field}}` interpolated into
   markup. The content editor needs a real code editor for the HTML case, not a plain textarea.
6. **Files map cleanly onto "collections"** — `sql.yml`, `javascript.yml`, `ai.yml`,
   `colegio-correos.yml`. The sidebar metaphor is already latent in the data.

---

## 5. Competitive UI analysis

### Shared skeleton (TextExpander and Typinator both)

A **three-pane layout**:

1. **Sidebar** — snippet groups / sets, with counts.
2. **Middle list** — snippets in the selected group, columns for abbreviation and label.
3. **Right pane** — the editor: content plus options.

Plus: a toolbar with *New Snippet* / *New Group* / search; drag-and-drop between groups;
per-group settings (case sensitivity, expansion behaviour, app scoping); and inline search
across title, abbreviation and content.

### Where they differ

| | TextExpander | Typinator |
|---|---|---|
| Organisation | Groups, with team sharing + permissions | Sets, exported/imported manually |
| Fill-ins | single-line, multi-line, popup menus, optional sections | dropdowns + cursor positioning |
| Scripting | JavaScript, AppleScript, shell; nested snippets | AppleScript, shell, regex |
| Search | inline by title/abbreviation/content | quick search + type-ahead |

### What we take, and what we deliberately reject

**Take:** the three-pane skeleton; the abbreviation+label list columns; inline search across all
fields; progressive disclosure of advanced options; a fill-in builder.

**Reject:** the pretence that snippets live in a database. They live in *files* that the user
may also edit by hand. See [§8.4](#84-files-are-not-a-database).

---

## 6. Architecture

### 6.1 Workspace layout

Keep the domain logic in a **standalone Rust library** that has no Tauri dependency. This keeps
the hard part testable in isolation and independently fuzzable.

```
espansoConfig/
├── crates/
│   └── espansoconfig-core/         # NO tauri dependency
│       ├── discovery.rs            # locate config dir, enumerate files, classify
│       ├── syntax/                 # span-aware parse + syntax index
│       ├── model/                  # semantic projection (MatchView, etc.)
│       ├── patch/                  # the edit engine — byte-span surgery
│       ├── emit/                   # scalar style selection + block emitter
│       ├── validate/               # structural + espanso-semantic validation
│       ├── persist/                # atomic save transaction, backups
│       └── watch/                  # debounced fs watching, revision hashing
├── src-tauri/
│   ├── commands.rs                 # IPC surface — thin wrappers over core
│   ├── events.rs                   # Rust → frontend event bridge
│   └── main.rs
└── src/                            # frontend (Svelte 5 + TypeScript + Vite)
    ├── lib/
    │   ├── i18n/                   # en.json, es.json
    │   ├── stores/                 # draft state
    │   └── components/
    └── routes/
```

**Frontend framework: Svelte 5 + TypeScript.** Smallest bundle of the mainstream options,
compiles away the runtime, and its fine-grained reactivity suits a form-heavy editor.
**CodeMirror 6** for the content editor (HTML/code/regex cases) — it is modular enough that we
only ship the language modes we need.

### 6.2 The YAML fidelity subsystem — the central risk

> **This is the project's core technical risk. Not Tauri. Not the UI.**
> It gets built and proven *first*, against real files, before any UI work.

#### Why the obvious approaches fail

| Approach | Fidelity | Verdict |
|---|---|---|
| Typed structs + full re-serialize | Destroys comments, key order, scalar styles, blank lines | **Reject** |
| Off-the-shelf comment-preserving DOM | Ideal — but no mature Rust crate provides it | **Cannot depend on** |
| **Span-based surgical rewriting** | Excellent when disciplined | **Chosen** |

`serde_yaml` is archived and, more importantly, is *structurally* wrong for this job:
deserialization discards exactly the information we must preserve. `yaml-rust2` and
`saphyr-parser` are actively maintained and YAML 1.2 compliant, and are the right tools —
but for **parsing and locating**, not for emitting. Their normal AST/emitter path is not a
lossless concrete-syntax round trip. `marked-yaml` is interesting precisely because source
marks are what we need.

**Treat comment/trivia preservation as our own product subsystem**, with its own test corpus.
Do not plan as though a crate solves it.

#### The model: lossless source + semantic projection

The **file text is the source of truth**. The typed model is a read-only *projection* over it.

```rust
pub struct SourceDocument {
    pub id:          DocumentId,
    pub path:        PathBuf,
    /// Exact bytes read from disk.
    pub source:      String,
    /// Hash of the disk contents this snapshot is based on.
    pub revision:    ContentRevision,
    /// Parser output with source locations.
    pub syntax:      SyntaxIndex,
    /// Typed, read-only view for the editor.
    pub model:       MatchFileModel,
    pub line_ending: LineEnding,
    pub bom:         bool,
}

#[derive(Clone, Copy)]
pub struct ByteSpan { pub start: usize, pub end: usize }  // half-open, UTF-8 bytes

pub struct ScalarPresentation {
    pub style:        ScalarStyle,   // Plain | SingleQuoted | DoubleQuoted | Literal | Folded
    pub header_span:  ByteSpan,
    pub content_span: ByteSpan,
    pub indent:       usize,
    pub chomping:     Chomping,      // Strip (|-) | Clip (|) | Keep (|+)
}
```

The semantic projection **must retain fields it does not understand**:

```rust
pub struct MatchView {
    pub id:          MatchId,
    pub source_node: NodeId,
    pub trigger:     Trigger,        // Literal | Multiple | Regex
    pub content:     Content,        // Replace | Form | Markdown | Html | ImagePath
    pub options:     MatchOptions,
    /// Unknown/unsupported entries are NEVER silently discarded.
    pub unknown_entries: Vec<UnknownEntry>,
}
```

> **`MatchId` must not be an array index.** Indexes shift when entries are reordered.
> Use a session-local identity derived from document ID + source-node identity.

#### Editing granularity — always the smallest safe edit

1. **Scalar value edit** → replace only the scalar token, or the block-scalar header/content.
2. **Existing property edit** → replace only that property's value node.
3. **Add / remove property** → rewrite the enclosing match mapping, preserving untouched
   entry slices verbatim.
4. **Reorder / move a match** → move the complete source slice, including attached leading
   comments and intentional blank lines.
5. **Unsupported or ambiguous syntax** → refuse visual editing; offer the raw YAML editor.

```rust
pub enum DocumentEdit {
    SetScalar    { target: NodeId, value: String, hint: ScalarHint },
    SetField     { mapping: NodeId, key: String, value: YamlValue },
    RemoveField  { mapping: NodeId, key: String },
    InsertMatch  { matches_sequence: NodeId, after: Option<NodeId>, value: NewMatch },
    MoveSourceBlock { source: ByteSpan, destination: InsertionPoint },
}
```

**Apply edits from the highest byte offset downwards** so earlier offsets stay valid.
Then **reparse the entire candidate document** and verify. Never trust local patching alone.

A full-match rewrite is an acceptable fallback, but it destroys comments *inside that match*.
Make it visible — never silently normalise:

> *"This snippet uses YAML the visual editor cannot preserve. Edit as YAML?"*

#### Comment ownership rules

Moving a snippet raises a genuinely ambiguous question: does the comment above it belong to
the snippet or to the gap? We cannot divine intent, so we adopt rules that are **predictable
and testable**:

- Contiguous comments immediately above a sequence item, **with no blank line between**,
  belong to that item.
- A comment separated by one or more blank lines belongs to the **file**.
- Inline comments belong to their mapping entry.
- **File-header comments before the first top-level key never belong to the first match.**
  (Critical here — the owner's files all open with a `# Generated from Typinator set …` header.)

### 6.3 Scalar style selection

Separate the **decoded string value** from its **YAML presentation**.

**When editing an existing scalar:**

1. Preserve its current style if the new value is safely representable in it.
2. Preserve block indentation where possible.
3. Derive chomping from the actual trailing-newline count.
4. Only if the old style is unsuitable, choose a new one (below).
5. Preserve raw UTF-8 — never gratuitously emit `\uXXXX`.

**For new scalars:**

```rust
fn choose_scalar(value: &str, context: ScalarContext) -> ScalarPlan {
    if value.contains('\n') {
        return literal_block_plan(value);      // never folded
    }
    if is_conservatively_safe_plain_scalar(value, context) {
        return ScalarPlan::Plain(value.to_owned());
    }
    ScalarPlan::SingleQuoted(escape_single_quotes(value))
} // End of choose_scalar()
```

**Multiline → always a literal block, never folded (`>`).** Folding *changes the data* and is
especially surprising for shell commands, HTML, Markdown and forms.

| Trailing newlines | Chomping |
|---|---|
| none | `|-` |
| exactly one | `|` |
| two or more | `|+` |

Add an explicit indentation indicator only when leading whitespace would otherwise be ambiguous.

**Quote a single-line scalar when it** is empty; has leading/trailing whitespace; starts with a
YAML indicator; contains `: ` or ` #`; resembles a bool/null/number/timestamp/inf/NaN; contains
control characters; could be confused with a document marker; is emitted into flow style; or
contains tabs in hazardous positions.

**Prefer single quotes.** Backslashes stay literal, which matters enormously for regex:

```yaml
regex: '(?P<ticket>[A-Z]+-\d+)'    # single-quoted: no backslash doubling
replace: 'Don''t panic'            # apostrophe doubles
```

Use double quotes only for control characters requiring escapes, or to preserve an existing
double-quoted presentation.

**The GUI must preserve whether text ends with a newline.** This is visually invisible in a
browser textarea, so show a subtle *"No final newline"* indicator in the advanced menu.

### 6.4 IPC surface

Rust owns disk snapshots, parsing, validation, revisions and writes.
The frontend owns the **current unsaved draft**.

**Do not send every keystroke to Rust.** The frontend edits a DTO locally and asks Rust to
validate on a debounce, and to save on demand.

```rust
#[tauri::command] async fn open_workspace(path: PathBuf)          -> Result<WorkspaceSummary, AppError>;
#[tauri::command] async fn list_documents()                       -> Result<Vec<DocumentSummary>, AppError>;
#[tauri::command] async fn get_document(id: DocumentId)           -> Result<DocumentDto, AppError>;
#[tauri::command] async fn get_match(id: MatchId)                 -> Result<MatchEditorDto, AppError>;
#[tauri::command] async fn validate_match(document: DocumentId, draft: MatchDraft)
                                                                  -> Result<ValidationReport, AppError>;
#[tauri::command] async fn save_match(request: SaveMatchRequest)   -> Result<SaveResult, AppError>;
#[tauri::command] async fn create_match(request: CreateMatchRequest) -> Result<SaveResult, AppError>;
#[tauri::command] async fn delete_match(request: DeleteMatchRequest) -> Result<SaveResult, AppError>;
#[tauri::command] async fn move_match(request: MoveMatchRequest)   -> Result<SaveResult, AppError>;
#[tauri::command] async fn save_raw_document(request: SaveRawDocumentRequest)
                                                                  -> Result<SaveResult, AppError>;
#[tauri::command] async fn reload_document(id: DocumentId)         -> Result<DocumentDto, AppError>;
```

**Every mutation carries an optimistic-concurrency token:**

```rust
pub struct SaveMatchRequest {
    pub document_id:   DocumentId,
    pub match_id:      MatchId,
    pub base_revision: ContentRevision,   // what the UI believed was on disk
    pub draft:         MatchDraft,
}

pub enum SaveResult {
    Saved    { revision: ContentRevision, match_id: MatchId },
    Conflict { disk_revision: ContentRevision,
               disk: MatchEditorDto, base: MatchEditorDto, draft: MatchDraft },
}
```

**Events (Rust → frontend):**

```
workspace://document-changed
workspace://document-added
workspace://document-removed
workspace://diagnostics-changed
```

### 6.5 External change reconciliation

Watch both `config/` and `match/`. Treat watcher notifications as **hints**, not truth:

1. Debounce 150–300 ms.
2. Wait until content stabilises across consecutive reads.
3. Read and hash.
4. **Ignore if the hash equals the revision the app just wrote** (this is how we avoid
   reacting to our own writes).
5. Parse and validate.
6. No dirty draft → reload automatically.
7. Dirty draft → enter conflict state; **overwrite neither side**.

**No automatic three-way YAML merging in v1.** Offer: *Keep my draft* · *Reload disk version* ·
*Compare* · *Copy draft to clipboard* · *Save draft as a new snippet*.

"Keep my draft" means **reapply the draft to the newly parsed disk document** — never blindly
overwrite the whole file with a stale snapshot. If the target match can no longer be identified
confidently, require manual resolution.

### 6.6 The save transaction

```
 1. Acquire an app-level per-path write lock
 2. Re-read target; verify hash == base_revision      ← conflict detection
 3. Apply patches in memory
 4. Parse the ENTIRE candidate document               ← syntax gate
 5. Structural validation (see below)                 ← semantic gate
 6. Write a uniquely-named temp file IN THE SAME DIRECTORY
 7. Apply the original file's permissions
 8. Flush / fsync
 9. Atomically rename over the target
10. Sync the containing directory
11. Re-read and hash the result                       ← verification
12. Update the in-memory snapshot
13. Rotate backups
```

Step 6's *same directory* requirement is not optional: `rename()` is only atomic within a
filesystem.

**Temp file naming matters here in a way it usually doesn't.** A temp file in `match/` could be
picked up by espanso mid-write. Name it so the default glob cannot match it:

```
_match-file.yml.espansoconfig-<random>.tmp
```

(The leading `_` excludes it from `[!_]*.yml`; the suffix means it isn't `.yml` at all.)

**Structural validation before every write:**

- Exactly one content field (`replace` / `form` / `markdown` / `html` / `image_path`)
- Valid trigger combination (`trigger` xor `triggers` xor `regex`)
- Valid variable types with required params present
- Unique variable names
- Valid `{{references}}` where statically knowable
- Regex compiles under the Rust `regex` crate

Diagnostics are classified: **YAML syntax error** · **editor model error** ·
**suspicious but permitted** · **cannot be preserved visually**.

Since the app does not control the daemon, it cannot *prove* espanso will accept a file.
Phrase diagnostics accordingly — "this looks wrong", not "espanso will reject this".

**Backups:** before the first modification of each file per session, into a location that is
**not** under an auto-loaded glob:

```
~/Library/Application Support/espanso/.espansoconfig-backups/2026-07-29T143012Z/match/example.yml
```

Retain the last 10 save batches. Offer *Reveal backups in Finder*. Backups are a safety net,
**not** a substitute for revision checks and atomic writes.

---

## 7. Corruption hazard register

Every one of these is a real way to destroy a user's config. Each needs a named defence.

| # | Hazard | Defence |
|---|---|---|
| 1 | Overwriting edits made in vim after the GUI loaded | `base_revision` check (§6.6 step 2) |
| 2 | Truncation from crash/power loss mid-write | temp file + atomic rename |
| 3 | Reacting to our own watcher event | ignore events matching our just-written hash |
| 4 | Writing semantically invalid espanso YAML | validation gate before rename |
| 5 | Valid YAML, wrong decoded string | parse-back verification (§6.6 step 11) |
| 6 | Losing comments on move/delete | comment ownership rules (§6.2) |
| 7 | Duplicate keys → parser-dependent behaviour | detect and refuse visual editing |
| 8 | Editing anchors/aliases as ordinary values | detect and refuse; raw editor only |
| 9 | Following a symlink to an unexpected target | resolve and confirm before writing |
| 10 | Temp file on a different filesystem | always same directory |
| 11 | Changing permissions / ownership / line endings / BOM | capture and restore all four |
| 12 | Two app windows writing the same document | per-path write lock |
| 13 | Losing unsupported fields | `unknown_entries` round-trip |
| 14 | Saving a half-entered form or variable | validate before enabling Save |
| 15 | Rename changing profile precedence or `_` auto-load | warn explicitly on rename |
| 16 | Case-insensitive filename collision on macOS | check case-insensitively |
| 17 | espanso reading our temp file | `_`-prefixed, non-`.yml` temp names |

---

## 8. UI and UX design

### 8.1 Three-pane skeleton

```
┌─────────────┬────────────────────┬──────────────────────────────┐
│ SIDEBAR     │ SNIPPET LIST       │ EDITOR                       │
│             │                    │                              │
│ All (65)    │ 🔍 search…         │  Abbreviation  [ :sig      ]  │
│ ─────────   │ ────────────────── │                              │
│ FILES       │ :sig    Signature  │  Expansion                   │
│  base (3)   │ :date   Today      │  ┌────────────────────────┐  │
│  ai (10)    │ _cuentas  Accounts │  │ Best regards,          │  │
│  sql (14)   │   ⌗form  ⌗html     │  │ Carlos                 │  │
│  javascript │ …                  │  └────────────────────────┘  │
│  …          │                    │  [ + Insert ]   [Preview ▸]  │
│ ─────────   │                    │                              │
│ PROFILES    │                    │  Title (opt.) [ Signature ]  │
│  default    │                    │                              │
│ ─────────   │                    │        [More options ▾] [Save]│
│ PACKAGES 🔒 │                    │                              │
└─────────────┴────────────────────┴──────────────────────────────┘
```

- List badges surface the interesting cases at a glance: `⌗form`, `⌗regex`, `⌗shell`,
  `⌗html`, and a "not auto-loaded" marker for `_`-prefixed files.
- Search covers **trigger, label, content, comment and search_terms**.
- `match/packages/` appears read-only, clearly marked with a lock.

### 8.2 The default editor is deliberately small

The initial state shows **only** abbreviation, expansion, and an optional title. Everything
else lives behind *More options*. Creating a normal snippet is: New Snippet → type trigger →
type expansion. Three seconds.

Trigger and content types are segmented controls, visually quiet, defaulting to Text/Text:

```
Trigger:  [ Text ] [ Multiple ] [ Regex ]
Content:  [ Text ] [ Form ] [ Markdown ] [ HTML ] [ Image ]
```

Regex options, form schemas and variable arrays **do not render at all** until selected.

### 8.3 The `+ Insert` affordance

This is the single most important control in the app — it is how espanso's power becomes
discoverable without becoming ambient noise. It inserts at the caret:

```
Cursor position          →  $|$
Clipboard                →  {{clipboard}} + var definition
Date / time…             →  popover
Choice…                  →  popover
Random choice…           →  popover
Form…                    →  form builder
Shell command…           →  popover
Script…                  →  popover
Another match…           →  popover
Regex capture            →  only shown when trigger type is Regex
```

Complex entries open a compact popover with a **live preview**. For a date:

```
Name       [ today        ]
Preset     [ 2026-07-29 ▾ ]
Format     [ %Y-%m-%d     ]
Offset     [ 0 ] [ days ▾ ]
Timezone   [ System     ▾ ]

Preview:   2026-07-29
                        [ Insert ]
```

Variable names are auto-generated collision-free (`date`, `date2`, …).

A **variables strip** under the content shows only variables actually in use:

```
Variables   [ today · Date · 2026-07-29 ]  [ clipboard · Clipboard ]
```

Clicking a chip edits it. Orphaned and unresolved references produce **warnings, never silent
deletion**. Because real configs chain variables (`form` → `date` → `shell`), the strip is
**ordered and reorderable**, and surfaces `depends_on`.

### 8.4 Files are not a database

The groups-and-snippets metaphor implies stable entities with IDs. YAML provides neither.
Files contain imports, anchors, globals, comments and hand-organised sections.

**Therefore:** call sidebar items **Files** by default. Let users attach display names, but
**never hide the file boundary**. This is an honesty-of-representation decision, and it
prevents a whole class of user surprise.

**Drag-and-drop between files is riskier than it looks.** A drag is not a `group_id` change —
it moves source text between documents with different indentation, headers, anchors, globals
and line endings. For v1:

- Restrict lossless drag to **ordinary self-contained matches** (no anchors, no aliases,
  no dependency on file-local `global_vars`).
- For anything else, copy semantically, warn that local formatting may change, and leave a backup.
- **Never** move a match that depends on file-local anchors or globals without dependency analysis.

### 8.5 More options — grouped by intent

Not a flat dump of every schema field:

- **Matching** — word boundary, case propagation, injection method
- **Discovery** — label, comment, search terms
- **Content** — type-specific options (e.g. `paragraph` for Markdown)
- **Variables and fill-ins**
- **File and scope**
- **Raw YAML** (always available as the escape hatch)

> Do not expose `force_mode` and `force_clipboard` as two unrelated checkboxes. Present a single
> **Insertion method** control, and preserve the legacy representation unless the user changes it.

### 8.6 Form builder

Given 24 form variables in the real corpus, this is a v1 headline feature. Two synchronized modes:

```
┌ Layout ────────────────┐  ┌ Fields ─────────────────────────┐
│ Saludo: [[saludo]]     │  │ saludo    [Choice ▾]            │
│ Nombre: [[nombre]]     │  │   values: Buenos días           │
│ Usuario: [[usuario]]   │  │           Buenas tardes    [+]  │
│                        │  │ nombre    [Text ▾]  ☐ multiline │
│                        │  │ usuario   [Text ▾]  ☐ multiline │
└────────────────────────┘  └─────────────────────────────────┘
```

- Fields are extracted from `[[placeholders]]` in the layout; adding a field in the right
  panel inserts the placeholder into the layout, and vice versa.
- Unknown or advanced form syntax stays visible and editable in the layout pane.
- Shorthand (`form:` + `form_fields:`) is preserved as shorthand; verbose (`vars:` with
  `type: form`) is preserved as verbose. **We do not convert between them behind the user's back** —
  the verbose form exists precisely so form values can feed shell/script variables.

### 8.7 Live preview — and its security boundary

Preview can safely and deterministically render: replacement text, cursor location, date
formatting, choices (with a selected example), echo variables, form layout with sample inputs,
and regex captures against a user-supplied test string.

> **Shell and script variables turn "preview" into arbitrary code execution.**
> They are **never** executed automatically. Show the command, plus an explicit
> *Run test* button with a clear warning and captured output.
> **Recommendation: defer command execution entirely from v1.**

Clipboard preview likewise shows a placeholder unless the user explicitly invokes it.

### 8.8 Bulk edit

Justified directly by the corpus: 62 of ~65 matches carry an identical `word: true` +
`force_mode: clipboard` pair, inherited from the Typinator migration. Editing those one at a
time is exactly the drudgery this app exists to remove.

**Multi-select in the snippet list** (⌘-click, ⇧-click, ⌘A) enables an inspector that shows
only the fields that are safely bulk-editable:

```
4 snippets selected

Matching
  Word boundary      [ Whole word ▾ ]        ← "Mixed" when they differ
  Insertion method   [ Clipboard   ▾ ]
  Case propagation   [ — Mixed —   ▾ ]

Move to file         [ sql.yml     ▾ ]
                                   [ Apply to 4 snippets ]
```

Rules that keep this safe:

- Only **scalar option fields** are bulk-editable: `word`, `left_word`, `right_word`,
  `propagate_case`, `uppercase_style`, `force_mode`/`force_clipboard`. **Never** content,
  triggers, or variables.
- A control showing **"— Mixed —"** leaves that field untouched on apply. Only fields the
  user actively changes are written.
- The whole operation is **one save transaction per file**, with one `base_revision` check
  per file. If any file fails validation, **nothing is written anywhere**.
- One backup per affected file, and a single undo entry covering the batch.
- Snippets whose YAML the visual editor cannot preserve are excluded from the selection and
  listed explicitly: *"3 of 7 snippets were skipped — they use YAML that must be edited directly."*

**Per-file defaults for new snippets** solve the same problem from the other end: each file
remembers the option values to pre-fill on *New Snippet*, stored in the sidecar (§8.9), so
they never pollute the user's YAML.

### 8.9 Sidecar metadata

Users want to see "School emails" in the sidebar, not `colegio-correos.yml`. But the espanso
config directory must stay clean — the app never adds files to a directory espanso scans.

**Therefore: a sidecar in the app's own container**, keyed by workspace:

```
~/Library/Application Support/espansoConfig/
  workspaces/
    <hash-of-config-dir-path>.json
```

```jsonc
{
  "schemaVersion": 1,
  "configDir": "/Users/ccarpio/Library/Application Support/espanso",
  "files": {
    "match/colegio-correos.yml": {
      "displayName": "School emails",
      "sortOrder": 3,
      "newSnippetDefaults": { "word": true, "forceMode": "clipboard" }
    }
  }
}
```

Design constraints:

- **Purely cosmetic.** Deleting the sidecar loses display names and nothing else. The app must
  be fully functional with it absent or corrupt — on a parse error, rename it aside and start fresh.
- **Keyed by path relative to the config dir**, so the whole workspace can move.
- **Rename handling:** when the app renames a file it moves the sidecar entry too. When a file
  is renamed *externally*, the entry is orphaned; keep orphans for 30 days rather than deleting
  immediately, so a rename-and-rename-back does not lose the name.
- The real filename is always visible — as a subtitle in the sidebar, and in the file inspector.
  A display name is a label, never a disguise (§8.4).
- Written with the same atomic temp-then-rename discipline as YAML, but **without** the
  revision-conflict machinery: last write wins is acceptable for cosmetic data.

### 8.10 Profiles are a separate surface

The profile model — regex filters, filename-alphabetical precedence, include/exclude rules and
~35 behaviour options — can easily double the project's scope.

**v1 ships:** a profile browser, raw YAML editing of profiles, a visualisation of which match
files each profile includes/excludes, and a prominent warning about alphabetical precedence.
Dedicated per-option profile UX comes later.

---

## 9. Localization

- **No hardcoded UI strings, from the first commit.** Rust returns *error codes and structured
  data*, never user-facing prose.
- Frontend dictionaries: `src/lib/i18n/en.json`, `es.json`, with a typed key union so a missing
  key is a compile error.
- Localize the macOS app menu and `Info.plist` (`CFBundleLocalizations = [en, es]`).
- Language follows the system locale, with a manual override in preferences.
- **Documentation, code, comments and commit messages stay in English** regardless of UI language.
- Watch for layout breakage: Spanish strings run ~20–25% longer than English. No fixed-width
  buttons.

---

## 10. Packaging and distribution

- Ships as `espansoConfig.app`, bundle identifier `cc.carpio.espansoConfig`.
- Universal binary: `--target universal-apple-darwin` (~10–20 MB DMG).
- Developer ID signing + notarization (Tauri v2 handles notarization from env credentials;
  universal binaries need no special handling).
- Hardened runtime. Entitlements kept minimal — this app needs **file access only**, no
  accessibility permissions, no input monitoring. That is a meaningful trust advantage over
  the expanders it sits alongside, and worth saying out loud in the README.
- DMG with a background image and `/Applications` symlink.
- **Distribution: direct download only for v1.** No Homebrew cask, no Mac App Store.
- **Sandboxing / MAS:** the App Store is a poor fit anyway — the app must read an arbitrary
  user-chosen directory outside its container, which means security-scoped bookmarks and a
  weaker UX. Not planned.
- A Homebrew cask is cheap to add later (it just points at the signed DMG) and needs no code
  changes, so nothing here forecloses it.

### 10.1 Updater

**Decision: the Tauri v2 built-in updater.**

Reasoning:

- **Nothing extra ships in the bundle.** Sparkle means embedding a framework, which works
  against the "small download" goal that drove the whole stack choice.
- **Sparkle's main advantages don't apply here.** Delta updates and the appcast ecosystem earn
  their complexity for large apps shipping frequently; at a ~15 MB DMG, a full download is a
  non-event.
- **One signing story instead of two.** The updater needs only its own keypair alongside the
  Developer ID identity already required for notarization.
- **Version-locked to our Tauri.** No third-party integration to re-validate on every
  Tauri upgrade.

What this requires:

- An updater keypair; the **private key never enters the repo** — CI secret only.
- A static `latest.json` manifest plus signed artifacts on any static host (GitHub Releases is fine).
- The public key baked into `tauri.conf.json`.
- **Set this up in Phase 5 but ship v1.0.0 with the updater already active**, so the very first
  release can update itself. An app that needs a manual re-download to gain auto-update has no
  auto-update.

Revisit Sparkle only if delta updates or staged rollouts become genuinely necessary.

> A late reinforcement of this choice: Sparkle typically requires the
> `com.apple.security.cs.disable-library-validation` entitlement to load its framework. The
> Tauri updater needs no entitlement at all. Fewer entitlements is a materially better security
> posture for an app whose whole pitch is "I edit your files safely".

### 10.2 Signing and notarization

**Credentials and the full procedure already exist — see [`SIGN_AND_NOTARIZE.md`](SIGN_AND_NOTARIZE.md).**
The App Store Connect API key, Key ID, Issuer ID and Developer ID certificate are all on disk at
documented paths, and the runbook is written to be idempotent and unattended.

Do not duplicate any of those values here. Per that runbook's own rule, read `Key ID.txt` and
`Issuer ID.txt` at runtime rather than hard-coding them.

> **Notation.** In this subsection only, `RB §n` means a section of `SIGN_AND_NOTARIZE.md`;
> a bare `§n` still means this document. The two numbering schemes overlap.

#### Deltas for a Tauri build

The runbook assumes an Xcode archive (RB §3) or manual inside-out `codesign` (RB §4).
**Neither applies to the normal Tauri path** — `tauri build` bundles, signs and notarizes in one
step. The adaptation is environment variables, not commands:

| Runbook concept | Tauri equivalent |
|---|---|
| `SIGNING_IDENTITY` passed to `codesign` | `APPLE_SIGNING_IDENTITY` env var |
| `notarytool --keychain-profile` | `APPLE_API_KEY` (the Key ID), `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` |
| Manual inside-out signing (RB §4) | handled by Tauri's bundler |
| `ditto` + `notarytool submit` + `stapler` (RB §§5–6) | handled by Tauri when the API-key vars are set |
| `hdiutil` DMG creation (RB §8) | Tauri's DMG bundler |

```bash
# Derived exactly as the runbook does — values never hard-coded.
export APPLE_SIGNING_IDENTITY="$SIGNING_IDENTITY"
export APPLE_API_KEY="$KEY_ID"
export APPLE_API_ISSUER="$ISSUER_ID"
export APPLE_API_KEY_PATH="$P8_PATH"

npm run tauri build -- --target universal-apple-darwin
```

*(Env var names verified against the [Tauri v2 macOS signing docs](https://v2.tauri.app/distribute/sign/macos/):
`APPLE_API_KEY` is the **Key ID**, not the key file; `APPLE_API_KEY_PATH` is the `.p8` path.)*

`APPLE_API_KEY_PATH` takes an explicit path, so the `.p8` does **not** need copying into
`~/.appstoreconnect/private_keys/`. It is read in place, satisfying runbook rule 5. Its existing
`AuthKey_<KEYID>.p8` filename already follows Apple's convention, so nothing needs renaming either.

> **Repo hygiene — handled.** `SIGN_AND_NOTARIZE.md` contains the Key ID and Issuer ID inline.
> The actual secret — the `.p8` private key — lives outside the repo, so this was never a
> credential leak, but those identifiers should not be published either.
>
> **`.gitignore` now excludes it**, along with `*.p8` / `*.p12` / `*.cer`, the updater private
> key, and notarization run output. Because the project is not yet under version control, this
> takes effect from the very first commit — there is no history to scrub. That property is worth
> preserving: `.gitignore` only protects a file that was *never* committed.
>
> Consequence to accept: the runbook will not travel with the repo. That is the right default for
> a solo, direct-download project. If it ever needs to be shared, strip the two identifiers and
> rely on the runtime reads from `Key ID.txt` / `Issuer ID.txt` that the runbook already mandates
> (RB §0), then un-ignore it.

**What still applies verbatim from the runbook:**

- **RB §1.1** — verify the Developer ID identity is in the keychain; fail with the import
  instructions if not. The `.p12` password is deliberately not on disk, so this step can still
  need the user once.
- **RB §1.3** — command-line tools check.
- **RB §7** — final `spctl --assess` verification, expecting `source=Notarized Developer ID`.
- **RB §10** — the troubleshooting table; the `--timestamp` and `--options=runtime` failure modes
  apply to Tauri builds identically, since Tauri passes both.
- **RB §11** — the agent rules, especially: never print or copy the `.p8` or `.p12`.

The runbook's **RB §4** manual path stays useful as a **fallback** if we ever ship a sidecar
binary that Tauri does not sign for us. None is currently planned.

#### Two different signing systems — do not conflate them

| | Purpose | Key | Where it lives |
|---|---|---|---|
| **Apple codesign + notarization** | Gatekeeper trusts the app | Developer ID cert + App Store Connect API key | login keychain + documented paths |
| **Tauri updater signature** | The app trusts an update payload | updater minisign keypair (§10.1) | CI secret; **never** in the repo |

Both are required. Neither substitutes for the other. A build signed by Apple but with a wrong
updater key produces an app that installs fine and then refuses every update.

#### Entitlements and permissions

- **No sandbox** (direct distribution), so no `com.apple.security.app-sandbox`.
- Hardened runtime on, `--timestamp` on — both are Tauri defaults and are what notarization checks.
- **No JIT, no unsigned executable memory, no library-validation exceptions.** Tauri's WKWebView
  content process is separate and Apple-signed, so the main bundle needs none of these. If a
  notarization log ever demands one, treat it as a signal that something was added that shouldn't
  have been.
- **No accessibility or input-monitoring entitlements.** This app reads and writes files; it never
  observes keystrokes. Worth stating in the README — it is a real trust advantage over the
  expanders it sits beside, espanso included.
- **TCC:** `~/Library/Application Support/espanso` is not a TCC-protected location, so the default
  case prompts for nothing. But users do relocate their config into Dropbox, iCloud Drive or
  `~/Documents` — all of which *are* protected. Always obtain the directory through the system
  open-panel (Tauri dialog plugin) so the user's own selection grants access, and degrade with a
  clear message rather than a silent read failure.
- `CFBundleIdentifier` in `tauri.conf.json` must match the bundle ID in the naming table at the
  top of this document. A mismatch surfaces as a confusing notarization or update failure.

---

## 11. Testing strategy

The test suite is the deliverable that makes this app trustworthy.

**Golden corpus** — checked into the repo, built from the real 13-file config plus synthetic
adversarial cases:

- every scalar style (`plain`, `'`, `"`, `|`, `|-`, `|+`, `>`)
- comments in every position: leading, trailing, inline, between entries, file header
- blank-line patterns
- anchors, aliases, explicit tags, merge keys
- duplicate mapping keys
- flow-style collections
- multi-document streams
- CRLF line endings, BOM, no-trailing-newline
- non-ASCII content (Spanish accents, `⌘`/`⌥` symbols — both present in the real config)
- deliberately invalid YAML

**Round-trip property test (the core invariant):**

> Parse → apply an edit to exactly one field → emit → the output must be **byte-identical to the
> input outside the intended span**, and the reparsed value at that span must equal the intended value.

Run this as a `proptest` fuzz over generated documents *and* as a fixed test over the corpus.

**Other layers:**

- Unit tests for `choose_scalar` against a table of tricky strings (`yes`, `no`, `~`, `1.5`,
  `:sig`, `Don't`, `- item`, `a: b`, `  padded  `, `""`, regex with backslashes).
- Save-transaction tests with injected failures at each of the 13 steps.
- Concurrency tests: external modification between load and save must produce `Conflict`.
- Snapshot tests on emitted YAML.
- Frontend component tests (Vitest) and a small Playwright/WebDriver smoke suite.
- **A "destroy the config" adversarial session** before each release: edit, move, rename,
  delete, external-edit, force-quit mid-save, and diff against git.

**Practical safeguard:** keep the real config directory under git during development so any
unintended byte change is immediately visible in `git diff`.

---

## 12. Phase plan

### Phase 0 — fidelity spike ⛔️ architectural gate

**No UI work begins until this passes.**

- Parse all 13 real files; produce a syntax index with byte spans.
- Edit individual scalars; insert and remove match fields; move whole matches.
- Assert byte-for-byte equality outside intended spans.
- Build the golden corpus (§11).
- Evaluate `yaml-rust2` vs `saphyr-parser` vs `marked-yaml` **empirically** against the corpus,
  specifically for: exact end offsets, block scalar header/indent/chomping recovery, comment
  positions, and blank-line attribution.
- If no parser gives reliable boundaries, combine parser marks with a small lexical scanner.

**Exit criteria:** the round-trip property test passes on the full corpus.
**If this phase fails, the source-editing layer changes — not the UI.**

### Phase 1 — read-only browser

Config directory discovery and picker · file enumeration and classification (match / profile /
package / `_`-disabled) · parse with diagnostics · three-pane navigation · search · raw YAML
viewer · **i18n infrastructure with both languages wired from the start** · detection and
flagging of constructs the visual editor cannot preserve.

**Exit:** the owner can browse their entire real config and every snippet renders correctly.

### Phase 2 — safe basic editing (first usable alpha)

Literal trigger + `replace` · label · word boundary · new / duplicate / delete / move snippet ·
surgical scalar edits · **the full save transaction: revision hashes, atomic writes, backups** ·
external-change detection and conflict UI · draft-level undo · restore from backup.

**Exit:** the owner uses it for a week on their real config with zero data loss.

### Phase 3 — complete match editing

`triggers` (multiple) and `regex` · Markdown / HTML / `image_path` / shorthand forms · all
metadata and matching options · cursor hint insertion · `imports` and `_`-disabled files ·
raw YAML escape hatch per snippet · unknown-field preservation verified end to end ·
**multi-select bulk edit (§8.8)** · **sidecar display names and per-file new-snippet
defaults (§8.9)**.

Bulk edit lands here rather than in Phase 2 because it depends on the full option model, and
because it is the single highest-leverage feature for this corpus — 62 snippets currently carry
the same two hand-repeated options.

### Phase 4 — variables and forms

All nine variable types · the `+ Insert` popovers · variable chips with ordering and
`depends_on` · **the visual form builder** · reference diagnostics · deterministic preview ·
regex test bench.

*Given the real-usage data, consider promoting the form builder and `choice` fields earlier —*
*they are more valuable to this user than `script` or `match` variables.*

### Phase 5 — profiles, polish, ship

Profile browser and raw editor · include/exclude visualisation · alphabetical-precedence
warning · app filter helper (with the `#detect#` hint) · full keyboard navigation · drag and
drop within the documented safety limits · accessibility pass · **signing and notarization via
[`SIGN_AND_NOTARIZE.md`](SIGN_AND_NOTARIZE.md) with the Tauri deltas in §10.2** ·
**Tauri updater wired and live in v1.0.0 (§10.1)** · recovery UX · adversarial
destructive-operation testing · DMG.

Two gates before announcing v1.0.0:

1. `spctl --assess --type execute` on the shipped DMG's app reports
   `source=Notarized Developer ID` (`SIGN_AND_NOTARIZE.md` §7).
2. **A real update is installed end-to-end** — build v1.0.0, publish v1.0.1, confirm the
   shipped binary updates itself. The updater signature is a separate key from the Apple
   identity (§10.2), and this is the only way to prove both are right.

---

## 13. Deliberately deferred

Out of scope for v1, by decision:

- Starting, stopping or querying the espanso daemon
- Installing or updating espanso itself
- Espanso Hub package browsing or installation
- Cloud sync
- Git integration (beyond the user's own repo)
- Automatic semantic three-way merge
- Executing shell/script variables for preview
- A general-purpose YAML editor
- Visual editing of anchors, aliases, tags or merge keys
- Dedicated controls for all ~35 profile behaviour options (raw YAML covers them)
- **Typinator / TextExpander importers** — genuinely valuable given the owner's migration
  history, but v1.1
- Homebrew cask and Mac App Store distribution (§10)
- Sparkle, delta updates and staged rollouts (§10.1)
- Bulk editing of content, triggers or variables — only scalar options are bulk-editable (§8.8)

---

## 14. Coding conventions

Per the project's global standards:

- All code, comments, documentation, README files and commit messages in **English**.
- **JSDoc on every JavaScript/TypeScript function.**
- Any function or loop longer than 10 lines gets a closing-bracket comment
  (`// End of function choose_scalar()`).
- No TitleCase unless explicitly requested.
- Never use git unless explicitly asked.
- When telling the user to run a function, always name the file it lives in.

---

## 15. Success criteria for v1

1. The owner's 13-file, ~65-match config opens, browses and edits correctly.
2. **Every edit leaves the rest of the file byte-identical** — provable via `git diff`.
3. A plain `trigger → text` snippet takes under three seconds to create.
4. A form snippet with a choice field takes under a minute — versus hand-writing ~15 lines of
   nested YAML today.
5. Zero data loss across a week of daily real use.
6. Universal DMG under 25 MB, signed, notarized, and able to auto-update itself from v1.0.0.
7. Full UI available in English and Spanish.
8. Setting `word` + `force_mode` across all 62 affected snippets is one operation, not 62.
9. External edits (vim, another machine via sync) never silently clobber, and never clobber
   silently in the other direction either.

---

## 16. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| No Rust crate does lossless comment-preserving round trips | **Critical** | Phase 0 gate; own subsystem + corpus; lexical scanner fallback |
| Comment ownership on move is genuinely ambiguous | High | Deterministic documented rules; refuse ambiguous cases |
| Cross-file drag corrupts formatting or breaks anchor/global deps | High | Restrict to self-contained matches; dependency analysis; warn |
| External edit races the GUI | High | `base_revision` optimistic concurrency; conflict UI |
| Shell/script preview = arbitrary code execution | High | Never auto-execute; defer entirely from v1 |
| Scope creep via profile options | Medium | Raw YAML for profiles in v1 |
| WebKit text-editor quirks | Medium | CodeMirror 6; test in WKWebView early |
| Espanso reads a temp file mid-write | Medium | `_`-prefixed, non-`.yml` temp names |
| Spanish string overflow breaks layout | Low | No fixed-width controls; both locales in CI screenshots |
| Updater key and Apple identity conflated → app installs but never updates | Medium | Two-systems table (§10.2); verify an update end-to-end before announcing v1.0.0 |
| Config dir relocated into a TCC-protected folder (Dropbox, iCloud, Documents) | Medium | Always acquire the directory via the system open panel; explicit error on denial (§10.2) |
| ~~Key ID / Issuer ID published if the repo goes public~~ | ~~Low~~ | **Closed** — `.gitignore` excludes `SIGN_AND_NOTARIZE.md` and all key material, effective from the first commit (§10.2) |

---

## 17. Open questions

### Resolved

| # | Question | Decision |
|---|---|---|
| 1 | App name | **`espansoConfig`** — derived identifiers in the table at the top |
| 2 | Updater | **Tauri built-in updater** — see [§10.1](#101-updater) |
| 3 | Bulk edit in v1 | **Yes**, Phase 3 — see [§8.8](#88-bulk-edit) |
| 4 | Sidebar display names | **Yes, via sidecar** — see [§8.9](#89-sidecar-metadata) |
| 5 | Distribution | **Direct download only** for v1 |

### Still open

1. **Bundle identifier confirmation.** `cc.carpio.espansoConfig` is assumed from the
   `carpio.cc` domain. Confirm before the first signed build — changing a bundle ID after
   release breaks the update path and discards macOS-stored per-app permissions.

> **Naming caveat worth noting once.** `espansoConfig` is also the name of this repository *and*
> a natural way to refer to the espanso config directory the app edits. In prose, keep "the
> espanso config directory" for the data and `espansoConfig` for the app, so the two never blur.

---

## Appendix A — sources

- [Espanso — match basics](https://espanso.org/docs/matches/basics/)
- [Espanso — extensions](https://espanso.org/docs/matches/extensions/)
- [Espanso — forms](https://espanso.org/docs/matches/forms/)
- [Espanso — regex triggers](https://espanso.org/docs/matches/regex-triggers/)
- [Espanso — organizing matches](https://espanso.org/docs/matches/organizing-matches/)
- [Espanso — configuration basics](https://espanso.org/docs/configuration/basics/)
- [Espanso — configuration options](https://espanso.org/docs/configuration/options/)
- [Espanso — app-specific configurations](https://espanso.org/docs/configuration/app-specific-configurations/)
- [Espanso — include and exclude](https://espanso.org/docs/configuration/include-and-exclude/)
- [Espanso — packages](https://espanso.org/docs/packages/basics/)
- Espanso JSON schemas: [`config.schema.json`](https://raw.githubusercontent.com/espanso/espanso/dev/schemas/config.schema.json),
  [`match.schema.json`](https://raw.githubusercontent.com/espanso/espanso/dev/schemas/match.schema.json)
- [TextExpander](https://textexpander.com/) · [Typinator](https://ergonis.com/typinator) ·
  [Typinator vs TextExpander comparison](https://textexpander.com/blog/typinator-vs-textexpander)
- [Tauri v2 — DMG distribution](https://v2.tauri.app/distribute/dmg/) ·
  [Tauri v2 — macOS code signing](https://v2.tauri.app/distribute/sign/macos/) ·
  [Building a universal binary with Tauri v2](https://dev.to/hiyoyok/building-a-universal-binary-with-tauri-v2-its-easier-than-you-think-1b53)
- [`SIGN_AND_NOTARIZE.md`](SIGN_AND_NOTARIZE.md) — the project's own signing/notarization runbook
  and credential inventory (supplied by the product owner)
- [saphyr-parser](https://github.com/saphyr-rs/saphyr-parser) · [RUSTSEC-2024-0320 (serde_yaml deprecation)](https://osv.dev/vulnerability/RUSTSEC-2024-0320)
- Primary corpus: the product owner's live espanso config (13 files, 1365 lines, ~65 matches)
- Architecture review: Codex (session `019fae09-7436-7983-b6f4-c5f7e3e9603d`)
