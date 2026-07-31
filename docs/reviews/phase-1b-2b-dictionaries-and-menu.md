# Phase 1b-2b review — the code dictionaries, the exhaustiveness check and the localized menu

Adversarial review of the Phase 1b-2b working tree (HEAD `be08bad`, work uncommitted), covering
the Rust-code→string dictionaries, the exhaustiveness check in `src-tauri/src/dictionary_contract.rs`,
the `classifyFailure` `detail` guard, and the localized macOS menu.

The reviewer was asked to attack seven specific areas and to prefer a counterexample to an opinion.
The disposition of every finding is in `PROGRESS.md` under "Phase 1b-2b review disposition".

---

## Findings

### High — Six wire-visible Rust enums have no dictionary entries

File: `src/lib/ipc/types.ts:108`, `src-tauri/src/dictionary_contract.rs:84`,
`docs/decisions/1b-2b-notes.md:402`

Concrete failure: `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind`, and
`VariableKind` already cross the wire as fields in the read projection, but neither dictionary has
corresponding keys and `codes.ts` has no accessors for them. For example, a projected match with
`trigger.kind = "Single"` and `content.kind = "Replace"` reaches Phase 1c; the UI must either render
the raw Rust identifiers, invent an unchecked mapping, or show nothing. The decision record
explicitly defers all six despite the Phase 1b-2b requirement that every UI-reachable code and
operand enum receive strings.

Suggested fix: add all six enums to the Rust contract, both dictionaries, and typed
key/description accessors now. Do not defer this foundation work to the first component that happens
to render each field.

### High — The "exhaustiveness" contract fails open for both new enum types and valid variant syntax

File: `src-tauri/src/dictionary_contract.rs:84`, `src-tauri/src/dictionary_contract.rs:184`

Concrete failures:

- Add a new wire enum, `DisplayMode`, with a serialized field and TypeScript union. If it is not
  manually added to `CODE_ENUMS`, the expected key set is unchanged, so both dictionaries and every
  dictionary-contract test pass with no `code.displayMode.*` entries.
- Add a real variant on one line with its attribute:

  ```rust
  #[cfg(feature = "new-ui")] AddedWithNoString,
  ```

  Line 193 skips the whole line because it starts with `#`. The variant count remains pinned at its
  old value and the missing dictionary entry is invisible.
- Likewise, `Regex, AddedWithNoString,` on one line is valid enum syntax, but the scanner records
  only the first leading identifier. Again, the pinned count need not change.

By contrast, a renamed enum, generic header, or moved file panics and therefore fails closed. A
conventional `#[cfg]` line followed by the variant on the next line is also detected. The unsafe
cases are specifically syntax that preserves the scanner's observed count and entirely new enums
outside the fixed registry.

Suggested fix: parse Rust with `syn` or compiler-produced metadata rather than line scanning.
Separately, derive the set of wire-reachable enums from a schema/type-generation source; an AST
parser alone still cannot detect that a newly introduced enum was omitted from `CODE_ENUMS`.

### Medium — Menu version skew produces untyped serde prose and is silently discarded

File: `src/lib/ipc/menu.ts:67`, `src-tauri/src/dispatch_check.rs:283`, `src/main.ts:20`

Concrete failure: Rust version N+1 requires 16 fields while an N frontend sends 15. Deserialization
fails inside Tauri's command macro before `set_menu_labels` runs, yielding English text such as
`invalid args ... missing field quit`. The test confirms this rejection has no `code`.
`setMenuLabels()` classifies it only as `unexpected`, and `main.ts` discards the returned promise and
result. The old/default English menu remains indefinitely with no report to the UI. The
documentation calling this a "typed refusal" is false — it is fail-fast, but not typed.

Suggested fix: accept an untyped envelope at the command boundary, deserialize and validate inside
the command, and return a stable `invalidMenuLabels`/`incompatibleMenuProtocol` code.

### Medium — The `detail` guard does not enforce "never rendered"

File: `scripts/lint/ipc-detail.ts:19`, `scripts/lint/ipc-detail.test.ts:150`,
`docs/decisions/1b-2b-notes.md:453`

Concrete failure: a component doing `JSON.stringify(classifyFailure(...))` contains no guarded
identifier, so the lint passes, yet renders `detail` at runtime. The notes admit computed/positional
reads but still overclaim "a component that renders it fails npm test."

Suggested fix: exclude developer detail from the renderable `IpcFailure` value entirely; route
diagnostics to logging/telemetry instead of a name scanner.

### Medium — A successful menu command does not mean a menu was built

File: `src-tauri/src/menu.rs:183`, `src-tauri/src/menu.rs:189`, `src/main.ts:20`

Concrete failure: the main-thread task is posted and the command resolves `{ ok: true }` before
`build_menu()`/`set_menu()` runs; an error or panic inside that closure is discarded, leaving Tauri's
English default menu while the caller believes success. If the webview never runs, the English
default remains permanently.

Suggested fix: use a one-shot channel to return the closure's actual result, and consume/report it
in `main.ts`.

### Medium — The "no string literal in menu.rs" scanner has a concrete false-negative

File: `src-tauri/src/menu_contract.rs:141`

Concrete failure: comment masking blanks a whole line whenever it begins inside a block comment, even
if the comment closes mid-line (`*/ let title = "Edit";`), letting a hardcoded English string slip
past the literal, field-use, and predefined-item checks.

Suggested fix: use an AST/lexer for string-literal detection; make comment masking character-aware.

### Low — The frontend test claiming to render every command error omits `menuUnavailable`

File: `src/lib/i18n/codes.test.ts:174`, `src/lib/i18n/codes.test.ts:221`,
`src/lib/i18n/codes.test.ts:344`

Concrete failure: `COMMAND_ERRORS` pins nine values though `CommandError` now has ten variants;
`describeCommandError('menuUnavailable')` could return an empty string and the "render every command
error" test would still pass.

Suggested fix: add the missing case and change the expected count to ten, asserting bidirectionally
against `COMMAND_ERROR_CODES`.

---

## Clean checks

- Capability decision: correct for this configuration — no application ACL manifest governs local
  calls to registered application commands.
- Architecture rule: clean — no core-crate changes in the diff, and
  `cargo tree -p espansoconfig-core | rg tauri` finds nothing.
- `identityWrongDocument` has both English and Spanish dictionary entries.
- File/header renames in the source scanner fail loudly rather than passing vacuously.

---

## Verdict

Phase 1b-2b is not ready to commit as the foundation for Phase 1c. The fixed enum registry omits six
codes already present on the wire and cannot detect newly introduced enum types, while its source
parser has valid-syntax false negatives. The `detail` property remains trivially renderable through
object serialization, and menu protocol/build failures are untyped or unobservable. The capability
and core-dependency decisions are sound, but Phase 1c should not build UI rendering on the current
dictionary/exhaustiveness claims until the two High findings and the version-skew/detail defects are
fixed.
