# Phase 2b-1 — the wire boundary for the save transaction

**What this sub-phase is.** The piece `PROGRESS.md` called **indivisible**: every type the save
transaction can hand a caller now crosses the IPC boundary, with its localized strings and the
contracts that pin both. Nothing in `crate::persist` derived `Serialize` before this change —
deliberately, since Phase 2a-1 — because the day any of it does, **every variant owes a `code.`
namespace in both `src/lib/i18n/en.json` and `es.json`**, and `src-tauri/src/dictionary_contract.rs`
fails the build without them.

It is **not** the commands. No `#[tauri::command]` was added: the count is **7 before and 7 after**,
and `wire_contract.rs`'s forbidden-name assertion still holds. `SaveResult`, `SaveMatchRequest`,
`Conflict`, the optimistic-concurrency token, the app-owned `BackupSession` and the first call to
`forgetFileText()` are all Phase 2b-2's. This is 1b-1's shape repeated: the whole i18n layer shipped
with no command behind it, for the same reason.

**The one sentence that defines it:**

> **157 variants of 18 enums and 7 structs reached the wire in one change, each with two dictionary
> entries, because one variant serialized without its string is a test failure and half an enum on the
> wire is worse than none of it.**

---

## 1. What was decided about the wire shape, and why

### 1.1 The core's convention, not the shell's — externally tagged, `snake_case` fields

This repository already has **two** wire conventions, and the choice between them is not a style
question.

- **`src-tauri/src/error.rs`'s `CommandError`** is `{ "code": "notUtf8", "path": …, "offset": … }` —
  one flat `camelCase` code plus operands. Its own doc comment says why: the frontend's `switch` on
  `error.code` has to be *exhaustive*, and the core's two-level nesting put the code the frontend most
  needs to branch on two levels deep, spelled in a different convention from its neighbours.
- **The core's own model** — `DiagnosticCode`, `UnknownReason`, `ValueView`, `PathSegment` — is
  `serde`'s default **external tagging** with the Rust variant name verbatim and `snake_case` fields:
  `{ "ParseFailed": { "byte_index": 3 } }`.

The save transaction's types took the **core convention**, and the reason is where they live. They are
`espansoconfig-core` types; `CommandError` is a type of the shell, minted *at* the boundary to flatten
three core errors into nine switchable codes. A `SaveError` that arrived pre-flattened would have made
the core's own shape unavailable to any later consumer, and 2b-2 still needs to build a shell-side
answer over it. The flattening remains available and is now explicitly named as 2b-2's decision, in
`SaveError`'s `Serialize` doc comment: *"a shell type that wants nine flat codes to switch on builds
them from these, the way `CommandError` already does for the read surface; it does not get them from
here."*

The naming formula both conventions share is `code.<enum>.<variant>` with each name's first letter
lowercased, and it is what makes `WriteStep::code()`'s existing `"resolveTarget"` and the dictionary
key `code.writeStep.resolveTarget` coincide rather than collide.

### 1.2 Nested errors stay whole

`SaveError::Target`, `Patch`, `Refused`, `Backup` and `Write` each carry a whole inner value rather
than a flattened copy of its fields. This is load-bearing rather than lazy: **`WriteError::may_have_written`
is computed from the `WriteStep`**, and it is the one question whose answer changes what a caller does
next. A flattened `SaveError::Write { path, kind }` would drop the step, and with it the difference
between *this call did not replace your file* and *this call replaced it and could not verify the
result*. `a_save_error_carries_its_write_error_whole` in `wire_contract.rs` asserts it.

### 1.3 Five hand-written `Serialize` impls, and why they are not derives

`SaveError`, `WriteError`, `BackupError`, `TargetDifference` and `BackupRecord` have hand-written
impls. Two properties are bought with them, and neither is obtainable from a derive.

- **Every path crosses through `WirePathRef`.** `wire.rs` has said since 1b-2a that `serde`'s own
  `PathBuf` serializer *fails* on a path that is not valid UTF-8, and that such a failure arrives
  **after** a command has already answered `Ok` — so the typed refusal that was supposed to carry the
  news is the value that cannot be written. Every variant of `WriteError` and `BackupError` carries a
  path; five of `SaveError`'s nine do. `a_non_utf8_path_crosses_every_save_transaction_error` asserts
  the premise (a bare `PathBuf` really does fail) before asserting the fix.
- **A new variant is a compile error.** A derive would serialize a newly added variant silently, with
  no dictionary entry on the other side. The `match` makes it fail at build time, which is the prompt
  to write the two strings.

The remaining thirteen enums and five structs are plain derives, because none of them carries a path
or an `io::Error`.

### 1.4 An `io::Error` crosses as `kind` plus `raw_os_error`, never as `source`

`WriteError::Io` and `BackupError::Io` write `{ step, path, kind, raw_os_error }`, where `kind` is the
`std::io::ErrorKind` **variant name** — `NotFound`, `PermissionDenied`. The field is *renamed on the
wire*, deliberately, so nothing downstream can mistake it for the operating system's own message in
the operating system's own language (plan §9). `an_io_errors_message_is_not_on_the_save_wire_but_its_kind_is`
asserts all three halves: the sentence is absent, the kind is present, and no `source` field survives.

**`raw_os_error` is the review's addition (A-ii, §7).** `ErrorKind` is a small stable set, so several
genuinely different operating-system failures collapse into one name — most of all into `Other`, which
says nothing at all — and `raw_os_error()` was being discarded. The errno now rides alongside the kind:

- **a number, not a code.** It gets **no dictionary entry**, nothing branches on it, and no message
  interpolates it. `an_io_errors_raw_os_error_crosses_as_a_number_beside_its_kind` pins that it is a
  JSON number; `saveCodes.test.ts` pins that a rendered sentence does not contain it. It is not the
  operating system's prose either — a number is not prose, and plan §9's rule is about prose;
- **nullable, never absent**, following the convention `src/lib/ipc/types.ts` states for the whole
  wire (*"nullable, never optional"*): an error this crate built itself has no errno, and it writes
  `null` rather than inventing one. The same test asserts both directions.

Doing it now was the point. The wire format has no consumer, so this was the last moment at which
adding a field cost nothing; after 2b-2 it is a format change Phases 2c–5 inherit.

The rule now has **one spelling in the workspace**: `io_kind_name` moved into
`crates/espansoconfig-core/src/wire.rs`, `io_raw_os_error` was added beside it, and
`src-tauri/src/error.rs`'s private copy delegates to the first. **`CommandError::Io` deliberately did
not change**: it is the *read* surface's shell type, it has its own TypeScript mirror and its own
operand table in `errors.ts`, and widening it is a separate decision from widening the save wire.

### 1.5 Serialize only — the acknowledgement does not yet come back

`Acknowledgement`, `Finding` and `FindingCode` serialize and do **not** deserialize. When this phase
was written that was a decision with a concrete *type-level* blocker behind it:

> `FindingCode::VariableMissingRequiredParam` carries `param: &'static str`, which `serde` cannot read
> back into. Adding `Deserialize` means changing that field first.

**The review closed that half (A-i, §7): `param` is an owned `String`.** Nothing gained `Deserialize`
— that is still 2b-2's design decision, and deliberately untaken here — but the obstruction that was a
*property of the type* rather than a choice is gone. Review A weighed the three ways out and this was
the soundest: an index-based selection is unstable if findings reorder between calls, and handing back
the exact JSON bytes is brittle because JSON permits insignificant byte differences, object-key order
is not semantic, and Tauri's IPC parses the JSON before Rust ever sees it.

An acknowledgement is content-addressed and has to travel *back in*, so this is genuinely unfinished —
see §5. What this phase establishes is the half that is a **data format decision**: the findings a
refusal carries out have a shape, and it is the shape the request type will have to accept. There is
deliberately **no boolean anywhere on this wire**;
`an_acknowledgement_crosses_as_its_findings_and_not_as_a_flag` asserts that too, because a
`force: true` would undo the whole design and the cheapest moment to make that impossible is before a
command exists.

### 1.6 No enum-valued operand is interpolated

`codes.ts` already translates three operand names that are themselves enums (`found`, `shape`, `kind`)
for diagnostics. The save transaction's codes deliberately translate **none**, and the reason is an
ambiguity that table cannot survive: `kind` means a `NodeKind` in `EditError::NotAScalar`, a
`VariableKind` in `FindingCode::VariableMissingRequiredParam` and a `std::io::ErrorKind` name in
`WriteError::Io`. One operand-name-to-namespace table would have to be wrong about two of the three.
No message written for these 157 codes names such an operand, `scalarOperands` in `codes.ts` keeps only
strings and numbers, and `every_save_transaction_placeholder_names_an_operand_serde_writes` fails the
build if a message ever names one.

### 1.7 `NodeKind` moved out of `NOT_A_CODE`

`NodeKind`'s exclusion read *"a substrate detail the read projection never carries: `SyntaxIndex` nodes
do not cross the boundary, and no wire type mirrors this enum"*. That stopped being true the moment
`EditError::NotAScalar { kind: NodeKind }` reached the wire. **An exclusion is a claim about what
crosses the boundary, and it expires when the boundary moves** — worth recording, because the list is
designed not to rot into a suppression list and this is what that costs in practice.

---

## 2. The complete list, and what each contributed

**Eighteen enums, 157 variants, 314 dictionary entries.** Counts are the ones
`dictionary_contract.rs`'s `VARIANT_COUNTS` pins, measured by `crate::rust_source`'s `syn`-based
parser rather than counted by hand.

| Enum | Declared in | Variants |
|---|---|---|
| `SaveError` | `persist/save.rs` | 9 |
| `SaveVerdict` | `persist/save.rs` | 3 |
| `WriteError` | `persist/write.rs` | 7 |
| `WriteStep` | `persist/write.rs` | 13 |
| `TargetDifference` | `persist/write.rs` | 4 |
| `BackupError` | `persist/backup.rs` | 8 |
| `BackupStep` | `persist/backup.rs` | 12 |
| `RotationOutcome` | `persist/backup.rs` | 4 |
| `FindingCode` | `validate/mod.rs` | 10 |
| `FindingClass` | `validate/mod.rs` | 2 |
| `EditError` | `patch/edit.rs` | 28 |
| `MoveSeam` | `patch/edit.rs` | 4 |
| `VerificationFailure` | `patch/edit.rs` | 26 |
| `SyntaxError` | `syntax/error.rs` | 3 |
| `InvariantViolation` | `syntax/error.rs` | 5 |
| `PathError` | `patch/path.rs` | 9 |
| `DecodeError` | `emit/decode.rs` | 5 |
| `NodeKind` | `syntax/node.rs` | 5 |
| **Total** | | **157** |

**The last eight of those were not on `PROGRESS.md`'s list, and that is the point of the phase's
shape.** `PROGRESS.md` named sixteen types; the transitive closure of `SaveError` is larger, because
`EditError` carries `SyntaxError`, `PathError`, `MoveSeam` and `VerificationFailure`, and those carry
`InvariantViolation`, `ParseFailure`, `OffsetOutOfDomain`, `DecodeError` and `NodeKind`. A phase that
had serialized only the named sixteen would not have compiled.

**Seven structs**, which owe no dictionary namespace (they have no variants) but are pinned by shape:
`Finding`, `SaveRefusal`, `Acknowledgement`, `Rotation`, `BackupRecord`, `ParseFailure`,
`OffsetOutOfDomain`.

By variant shape, which is what the operand check is counted on: **94 struct variants** (named
operands), **11 newtype variants** (a nested wire value: `SaveError::Target`/`Patch`/`Refused`/
`Backup`/`Write`, `EditError::SourceDoesNotParse`/`Verification`,
`VerificationFailure::DoesNotParse`, `SyntaxError::Parse`/`Offset`/`Invariant`) and **52 unit
variants**.

---

## 3. How the dictionary contract now fails, and the evidence that it does

### 3.1 What was extended

- **`CODE_ENUMS`** gained the eighteen entries above; **`VARIANT_COUNTS`** gained their counts, which
  is the non-vacuity guard — a parser that stopped recognising declarations fails there with a number
  rather than downstream with a list of keys that merely look surplus.
- **`NOT_A_CODE`** lost `NodeKind` (§1.7). It is asserted in both directions, so a stale exclusion
  fails as loudly as a missing registration.
- **`declared_variants_of`** and **`dictionary_values`/`code_key`** are new `pub(crate)` helpers, so
  `wire_contract.rs` reads *one* table of where each enum lives and *one* implementation of the naming
  formula. A second copy could disagree, and only one of the two would be wrong in a way anybody
  noticed.

`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` needed no change and did its job
unprompted: it walks both source trees, so each newly serializable enum was reported as unaccounted
until it was registered. `every_typescript_wire_union_has_a_namespace` did the same from the frontend
side.

### 3.2 The deletion experiment

`code.backupError.destinationExists` was deleted from `src/lib/i18n/en.json`, and **both** checks
fired:

| Check | Command | Message |
|---|---|---|
| `dictionary_contract::the_code_dictionary_is_exactly_the_declared_variants` | `cargo test` | *en.json, the backupError namespace: missing ["code.backupError.destinationExists"]* |
| `dictionary_contract::the_spanish_dictionary_declares_the_same_code_keys` | `cargo test` | *es.json … declares ["code.backupError.destinationExists"] that en.json does not* |
| `dictionaries.test.ts > key sets > are exactly equal` | `npm test` | 1 failed / 670 passed |

The key was then restored and both suites returned to green. Note the second row: deleting an
**English** key is reported by the *Spanish* check as well, because that check compares the two files
against each other. Deleting a Spanish key fails the same test from the other side.

### 3.3 The check that is new, and the hole it closes

`wire_contract::every_save_transaction_placeholder_names_an_operand_serde_writes` reads every one of
the 157 messages **in both languages** and asserts that each `{placeholder}` names an operand `serde`
really writes for that variant, as a string or a number. Nothing else could see this: the dictionary
contract sees only keys, `dictionaries.test.ts` only checks that the two languages agree *with each
other*, and `translate` leaves an unmatched placeholder visible on purpose — so a message naming
`{path}` for a variant with no path reaches a screen with a brace in it.

It was verified non-vacuous by temporarily rewriting `code.saveError.write` to begin `{path} could not
be replaced`; the test failed with *"names ["path"], which SaveError::Write does not write as a string
or a number"*, and the string was restored.

### 3.4 One check had to be repaired to be extended

`tagged_variant_fields` in `wire_contract.rs` located a variant's payload with
`body.find("readonly Variant: ")` and then took the **next** `{`. For a payload written as a type
reference — `readonly Parse: ParseFailure` — that brace belongs to a *later* variant, so the scan
compared one variant's operands against another's and failed with a message pointing at the wrong
declaration entirely. It now returns `None` unless the payload is an inline object, and the new
operand test counts the three shapes it sees (`94 / 11 / 52`) so that a struct variant silently
declared as a type reference is a failure rather than a skip.

---

## 4. What 2b-2 inherits, and must not rebuild

- **The wire shape is decided.** Externally tagged, Rust variant names verbatim, `snake_case` fields,
  paths as lossy strings, `io::Error` as a `kind` code plus a nullable `raw_os_error` number.
  `src/lib/ipc/types.ts` mirrors all of it and `wire_contract.rs` fails on drift in either direction.
  A command that reshapes any of this is changing a format Phases 2c–5 inherit.
- **A wire path is display text. It is never an identifier and never round-trippable** (A-iii, §7 —
  recorded rather than coded, because the code is already right). `WirePathRef` renders bytes no
  encoding can name as `U+FFFD`, so **two distinct filenames can render to the same string**, and that
  string handed back to the filesystem would name neither of them. The real `PathBuf` stays in the
  transaction, and identity is `DocumentId` — an opaque session-local integer unaffected by what the
  path's bytes are. Concretely, 2b-2's UI must not key a map by a wire path, compare two of them to
  decide two errors are about one file, or send one back in a request. On macOS the lossy branch is
  unreachable in practice (APFS and HFS+ reject a non-UTF-8 filename with `EILSEQ`), which makes the
  rule cheap to keep rather than unnecessary to state. `src/lib/ipc/types.ts`'s convention 2 says it at
  the boundary itself.
- **Every save-transaction type already has its two strings and its accessor.** 18 `describe*`
  builders in `src/lib/i18n/codes.ts`, 18 reactive `t*` wrappers in `src/lib/i18n/index.ts`. A
  component renders a code by calling `tSaveError(…)`, never by building a key — the key builders'
  template-literal return types are the only check that catches a missing entry, and building a key by
  hand opts out of it.
- **`SaveError` is not flattened, and flattening it is 2b-2's call to make explicitly** (§1.2). If the
  frontend wants nine switchable top-level codes it builds a shell type the way `CommandError` does;
  it does not get them from the core.
- **`SavedDocument` is *not* serialized.** It carries `Replacement` and `PresentationNote`, which are
  neither on `PROGRESS.md`'s list nor in `SaveError`'s closure, and which owe their own dictionary
  entries the day they cross. What `SaveResult::Saved` carries out of a successful save is 2b-2's
  design, not a leftover.
- **The five inheritances `PROGRESS.md` names are untouched by this phase and still stand**: an
  acknowledgement is content-addressed and a `force: true` would undo the design; nothing in the core
  can establish that a human saw a finding, so enforcing presentation is the interface's obligation;
  `save_document` is the only entry point that may write a user's file; `SaveRequest::backups` is an
  `Option` and a `None` means no backup at all; and `SavedDocument::committed == false` and
  `SavedDocument::backup == None` are both **successes**, for four documented reasons each.
- **`forgetFileText()` in `src/lib/browser/workspace.svelte.ts` still has no caller.** Unchanged.
- **The strings' register is set, and 2b-2 must not break it.** No message says *espanso will reject
  this*, *your edit cannot be lost*, *this file is valid*, *your file is recoverable* or *nothing was
  written*. **The review found four messages that did** (§7, B-1 to B-3 and B-0), and the shape of all
  four is worth carrying forward: each named *espanso* or *YAML* as the authority instead of
  espansoConfig. The rule stated positively — **describe risk under this app's own model; never predict
  espanso's behaviour and never pronounce a file valid or invalid absolutely** — is what a new string
  is checked against, and no mechanical check in this repository can see a violation of it.
  Two further consequences that a fresh session would otherwise re-derive wrongly:
  `code.saveError.write` says *"Reload it to see what it holds now"* and **not** *"the file was left as
  it was"*, because `SaveError::Write` is the one variant whose rename may have completed; and every
  backup string is about *tidiness*, never about recoverability, because retention is ten sessions.

---

## 5. Holes this phase leaves open

1. **Nothing deserializes — but the hole is now narrower than this phase first recorded.** The
   acknowledgement still has to arrive *from* the interface, and nothing in `crate::persist` or
   `crate::validate` can read one. What is **no longer** part of the hole is the `&'static str`:
   `FindingCode::VariableMissingRequiredParam` carries an owned `String` since the review (A-i, §7),
   so the last obstruction that was a *type* rather than a decision is gone. What remains is exactly
   two things:

   - **`Deserialize` is absent** from `Finding`, from `ByteSpan` and from `VariableKind`. All three are
     plain data and all three are derivable; deriving them is 2b-2's change, not this phase's, because
     the direction an acknowledgement travels is 2b-2's design.
   - **2b-2 must compare acknowledgements as an exact multiset.** Review A is specific about this: the
     core compares what arrived against *freshly recomputed* suspicious findings using `Finding::eq`,
     **including duplicate counts**, so `[A, A]` must differ from `[A]`. A set-membership test is
     insufficient — it would let one acknowledgement of a finding wave past two occurrences of it —
     so the implementation consumes each matching entry, or otherwise counts occurrences.

   Both are recorded here rather than left to be rediscovered, and neither is started.
2. **No command answers with any of it.** 157 variants have strings and shapes and **zero callers**.
   The dictionary contract and the wire contract prove the wiring is consistent; nothing proves it is
   *useful*, and nothing will until 2b-2. This is the same exposure 1b-1 accepted for the i18n layer,
   and it is why the phase is a phase rather than a commit.
3. **No screen has been read.** CLAUDE.md is explicit that nothing in this project renders a Svelte
   component in an automated test, so a claim about a screen needs a reading of a screen. This phase
   makes no such claim: no component calls any of the new accessors, and the first one that does owes
   a window reading.
4. **Nothing *mechanical* establishes that the Spanish is Spanish.** 157 new Spanish values were
   written by this phase and checked only for being non-blank, non-identical to their English twin,
   and in placeholder agreement with it. That is the untranslated-value *heuristic*, and
   `dictionaries.test.ts` says so itself. A bilingual reviewer is the only thing that closes it
   (`1b-1-notes.md` §9, hole 9). **This phase got one** — `docs/reviews/phase-2b-1-strings.md` — and
   its eleven Spanish findings are applied (§7), so the hole is closed *for these 157 values by one
   reading*. It stays open as a standing hole: no check in the repository would catch the next
   calque, and a reader of a diff sees only what the diff shows. Defects the reviewer did not report
   were found afterwards by sweeping the whole family rather than the diff (§7.3), which is the
   evidence that a reading is not a check.
5. **The sentences are unreviewed for accuracy against the code they describe.** Each was written from
   the variant's own doc comment, but nothing mechanical checks that
   `code.editError.moveWouldExtendAKeptBlock` describes what `EditError::MoveWouldExtendAKeptBlock`
   actually means. A wrong-but-plausible sentence passes every check in this repository.
6. **`Rotation::bounded()` and `SaveError::is_refusal()` do not cross.** Both are *predicates over* wire
   values rather than fields, so a frontend that wants either must reimplement it — and a
   reimplementation could disagree with the Rust. 2b-2 should decide whether to send the answer as a
   field or to keep the predicate in Rust and expose it through the command's own result shape.
7. **An enum a `macro_rules!` expands to still escapes the registration check.** Unchanged from 1b-2b,
   restated because this phase added eighteen registrations and none of them tested that residue.

---

## 6. Verification

All run at the repository root.

Every number below is **after** the review dispositions of §7.

| Command | Result |
|---|---|
| `cargo test --workspace` | exit 0 — **798 passed / 20 binaries / 0 failed** (796 before the review, baseline 787) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output, `rg` exit 1 — the architecture rule holds |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, 16 warnings — **the same 16 as before this phase** |
| `npm run check` | exit 0 — 375 files, 0 errors, 0 warnings |
| `npm run build` | exit 0 |
| `npm test` | exit 0 — **671 passed / 28 files** (baseline 662 / 27) |
| `rg -c '#\[tauri::command\]' src-tauri/src/commands.rs` | **6 before, 6 after** (7 across `src-tauri/src/`, unchanged) |
| `git status --short` on `crates/espansoconfig-core/tests/corpus/` | no fixture modified |

The two Rust tests the review added are
`an_io_errors_raw_os_error_crosses_as_a_number_beside_its_kind` in `src-tauri/src/wire_contract.rs`
and `an_io_error_carries_a_kind_always_and_an_errno_only_from_the_system` in
`crates/espansoconfig-core/src/wire.rs`. The frontend suite count is unchanged: the review edited
sentences and the `Io` samples that carry the new field, and added no case.

The nine new Rust tests of the phase itself are `every_save_transaction_sample_list_is_its_enums_declaration`,
`every_save_transaction_union_declares_exactly_the_rust_variants`,
`every_save_transaction_struct_declares_exactly_the_properties_serde_writes`,
`every_save_transaction_variant_declares_exactly_the_operands_serde_writes`,
`a_non_utf8_path_crosses_every_save_transaction_error`,
`an_io_errors_message_is_not_on_the_save_wire_but_its_kind_is`,
`a_save_error_carries_its_write_error_whole` and
`an_acknowledgement_crosses_as_its_findings_and_not_as_a_flag`, plus
`every_save_transaction_placeholder_names_an_operand_serde_writes`. The new frontend suite is
`src/lib/i18n/saveCodes.test.ts`, which renders one sample per accessor in both locales and asserts
that no sentence holds `undefined`, an unsubstituted `{placeholder}`, `[object Object]`, an
`ErrorKind` name or a Rust variant name.

**The first of those is the one worth naming.** `every_save_transaction_sample_list_is_its_enums_declaration`
compares each of the eighteen sample lists against the enum declaration parsed out of the core's own
source, rather than against itself — the vacuous-audit corollary (`PROGRESS.md`, D2w) applied to a
sample list, and the same guard `crate::error`'s
`every_declared_variant_has_an_instance_in_the_enumeration` gives `CommandError`. Without it, a variant
added to the core and forgotten in every list here would leave all four shape checks passing over the
variants that happened to be listed.

No test prints a line of real-configuration content, and no test in this phase reads the real corpus
at all.

---

## 7. Review disposition

Two external reviews were taken on the finished phase and are committed beside this record:

- **Review A**, on the wire format — [`docs/reviews/phase-2b-1-wire-boundary.md`](../reviews/phase-2b-1-wire-boundary.md);
- **Review B**, on the English and Spanish strings — [`docs/reviews/phase-2b-1-strings.md`](../reviews/phase-2b-1-strings.md).

Every finding of both is listed below with what was done about it. Nothing was declined.

### 7.1 Review A — the wire format

| # | Finding | Disposition |
|---|---|---|
| A-i | `FindingCode::VariableMissingRequiredParam` carries `&'static str`, which `serde` cannot read back into — the one type-level obstruction to deriving `Deserialize` | **Applied.** The field is an owned `String`. Four construction sites changed: `check_variable_type` in `crates/espansoconfig-core/src/validate/mod.rs`, that module's own `the_code_name_table_matches_the_codes`, `a_match_variable_without_a_trigger_param_is_reported` in `crates/espansoconfig-core/tests/validate_semantics.rs`, and `finding_code_samples` in `src-tauri/src/wire_contract.rs`. §1.5 records why this option beat the other two |
| A-i (scope) | — | **Deliberately not done: no `Deserialize` was added to anything, and the acknowledgement's inbound direction was not designed.** Choosing how an acknowledgement round-trips is 2b-2's decision; this change only removes the obstruction to it. `ByteSpan` and `VariableKind` **still lack `Deserialize`**, exactly as hole 1 claimed, and hole 1 is rewritten to say so precisely |
| A-ii | `io::Error::raw_os_error()` is discarded, so several actionable OS failures collapse into one `ErrorKind` — most of all into `Other` | **Applied.** `io_raw_os_error` in `crates/espansoconfig-core/src/wire.rs`, serialized by `WriteError::Io` and `BackupError::Io` as a **nullable number** named `raw_os_error`, mirrored in `src/lib/ipc/types.ts` and pinned by `an_io_errors_raw_os_error_crosses_as_a_number_beside_its_kind`. **No dictionary entry**: it is diagnostic data, not a user-facing code, and the dictionary contract is unaffected because it registers *enums*, not fields. `kind` is unchanged and is still what a frontend categorizes on. The operating system's prose is still absent. §1.4 has the full argument, including why `CommandError::Io` did not change |
| A-iii | A lossy path can render two distinct filenames identically and cannot be copied back to name either | **Recorded, not coded — the code is already right.** The transaction keeps the real `PathBuf` and identity is `DocumentId`. Folded into §4 as an inheritance, with the three concrete things 2b-2's UI must not do; `src/lib/ipc/types.ts`'s convention 2 now states it at the boundary itself |
| A-iv | 2b-2 must compare acknowledgements as an exact **multiset**, so `[A, A]` differs from `[A]`; set membership is insufficient | **Recorded.** It is now half of hole 1, and it is restated in `persist/save.rs`'s module documentation so the next session meets it in the code as well as in this file |
| A (§2) | No wire-format inconsistency found: the hand-written impls do reproduce `serde`'s externally tagged representation | **No action.** Recorded as a positive finding |
| A (§4) | No behavioural change in `persist/save.rs`, `write.rs` or `backup.rs` — imports, documentation, derives and serialization only | **No action.** This is the claim §1 of this record makes, checked independently |

### 7.2 Review B — the strings

**The three forbidden claims (B-1 to B-3), in both languages.** The rule is that the app may describe
**risk under its own model**, never predict espanso's behaviour and never pronounce a file valid or
invalid absolutely. All three are applied, and in each case the reviewer's proposal was used as the
correction to make rather than as the sentence to write — the sentence below is the one that matches
the surrounding dictionary's voice.

| # | Key | Was | Is |
|---|---|---|---|
| B-1 | `code.findingCode.matchHasSeveralTriggerForms` | *"…, where espanso expects exactly one."* | *"…, and espansoConfig models exactly one."* — the authority is this app, and the phrasing matches its sibling `matchHasSeveralContentFields`, which already said *"espansoConfig cannot read off the file which one would win"*. The reviewer's *"treats this as suspicious"* was **not** used: this code's `FindingClass` is `EditorModelError`, so calling it suspicious would contradict `code.findingClass.editorModelError` on the same screen |
| B-2 | `code.findingCode.duplicateVariableName` | *"…, and espanso keeps the last one."* | *"…, and espansoConfig cannot tell which definition would be used."* |
| B-3 | `code.verificationFailure.doesNotParse` | *"The result is no longer valid YAML."* | *"espansoConfig’s YAML parser could not read the result."* |

Their Spanish twins carried the identical claim and were rewritten with them: *"…, y espansoConfig
modela exactamente uno."*, *"…, y espansoConfig no puede determinar qué definición se usaría."* and
*"El analizador de YAML de espansoConfig no pudo leer el resultado."*

**B-0 — a fourth instance the review missed.** Review B read a diff and reported three. Sweeping all
157 of this phase's strings for the same defect found a fourth, and it is the exact twin of B-3:

| # | Key | Was | Is |
|---|---|---|---|
| B-0 | `code.editError.sourceDoesNotParse` | *"The file does not parse as YAML, so nothing in it can be addressed."* | *"espansoConfig’s YAML parser could not read this file, so nothing in it can be located."* |

It is the same absolute-validity claim as B-3, about the source rather than the result, and the review
did flag its **Spanish** twin — for being a calque, not for the claim. Its own proposed Spanish
(*"El analizador no puede interpretar el archivo…"*) fixes the claim by accident, which is how the
English half surfaced.

**Four pre-existing strings this phase did not add carried the same defect, and the orchestrator fixed
them here rather than deferring them.** `code.diagnosticCode.matchHasSeveralTriggerForms` and
`code.diagnosticCode.matchHasSeveralContentForms` both said *"and espanso expects exactly one"*;
`code.diagnosticCode.fieldHasUnexpectedShape` said *"the shape espanso expects there"*; and
`code.diagnosticCode.parseFailed` said *"This file is not valid YAML"*. All four shipped in Phase
1b-2b, all four are outside this phase's diff and outside its review, and the phase worker was
instructed not to rewrite strings it had not added — so it recorded them, correctly.

They were nevertheless corrected before the commit, and the reason is worth stating: the deferral named
*"whichever sub-phase next touches the diagnostic strings"*, and **2b-2 through 2d are all about
saving, not diagnostics** — so the named owner may never arrive. A rule violation that the project has
now *demonstrated* in its own review is worse to leave in place than a slightly wider phase is to
commit. The corrections keep each sentence's operands and shape and change only the claim:

| Key | Was | Now |
|---|---|---|
| `parseFailed` | *"This file is not valid YAML"* | *"espansoConfig's YAML parser could not read this file"* |
| `fieldHasUnexpectedShape` | *"the shape espanso expects there"* | *"the shape espansoConfig's model allows there"* |
| `matchHasSeveralTriggerForms` | *"and espanso expects exactly one"* | *"and espansoConfig's model allows exactly one"* |
| `matchHasSeveralContentForms` | *"and espanso expects exactly one"* | *"and espansoConfig's model allows exactly one"* |

Both languages, eight values. **What is still owed is a reading**: these four appear on the diagnostics
surface that Phase 1c-2b-1 read in a running window, and this change has not been re-read there.
CLAUDE.md's rule is that a claim about a screen needs a reading of a screen — so the claim made here is
narrower than that one. It is that the *strings* no longer predict espanso's behaviour, checked by
`npm test`'s key and placeholder parity, not that the diagnostics pane has been seen since. The next
phase that opens a window owes that look.

**The eight further Spanish quality findings**, all applied:

| # | Key | Defect | Fix |
|---|---|---|---|
| B-4 | `code.writeStep.inspectTarget` | *"leer qué es"*, an English-shaped calque | *"abrir el archivo y comprobar de qué tipo es"* |
| B-5 | `code.writeStep.copyMetadata` | *"lista de acceso"* mistranslates *access list* | *"la lista de control de acceso"* |
| B-6 | `code.backupError.backupRootNotPrivate` | *"A {path} puede llegar alguien"* reads as machine translation | *"A {path} pueden acceder otras personas además de su propietario, así que espansoConfig no guardará ahí copias de tu configuración."* |
| B-7 | `code.backupError.destinationExists` | *"no tenía derecho a elegir"* anthropomorphizes the copy | *"…, y no se podía elegir otro nombre para esta copia."* |
| B-8 | `code.editError.sourceDoesNotParse` | *"no se analiza"* and *"direccionarse"* are calques | rewritten with B-0 above; *"direccionarse"* became *"localizar"* |
| B-9 | `code.editError.verification` | *"no se sostuvo"* is unnatural and unclear | *"…, no superó esas comprobaciones y se descartó."* |
| B-10 | `code.verificationFailure.movedBytesWereRewritten` | *"aterrizaron" / "se levantaron"* is overly literal | *"Los bytes colocados en el destino no coinciden con los extraídos del origen."* |
| B-11 | `code.decodeError.spanOutsideSource` | *"no recorta el archivo"* is an incorrect calque of *slice* | *"no delimita una parte válida del archivo"* |

**The five English register findings**, all applied:

| # | Key | Defect | Fix |
|---|---|---|---|
| B-12 | `code.saveError.targetNotUtf8` | *"there is no text to change"* is overly absolute; the bytes exist | *"…, so espansoConfig cannot edit it as text."* |
| B-13 | `code.editError.malformedSpan` | *"did not slice the file"* leaks implementation jargon | *"A byte range did not identify a valid part of the file."* |
| B-14 | `code.editError.lastEntryOfMapping` | *"rather than what it contains"* contradicts removal changing the contents | *"…, turning it into an empty value and changing what the file means."* |
| B-15 | `code.editError.verification` | *"it did not hold"* is opaque | *"…, it did not pass those checks, and so it was discarded."* |
| B-16 | `code.saveVerdict.proceed` | two instances of *"it"* with unclear antecedents | *"Nothing found in the result prevents espansoConfig from saving it."* |

### 7.3 Four edits the review did not ask for, and why they were made anyway

Each is the same defect as an applied finding, in a string the reviewer's diff-reading did not reach.
Leaving them would have made the two languages disagree about register, which is worse than either
wording.

- **`code.decodeError.spanOutsideSource` (English)** — B-11 fixed *"no recorta el archivo"* in Spanish
  and B-13 fixed *"did not slice the file"* in English on a **different** key. The English of this key
  still said *"does not slice the file"*. Now *"does not identify a valid part of the file"*, matching
  both.
- **`code.editError.malformedSpan` (Spanish)** — the twin of B-13, which the review raised in English
  only. *"no recortó el archivo"* → *"no delimitaba una parte válida del archivo"*.
- **`code.pathError.emptyDocument` (Spanish)** — the second occurrence of the *"direccionarse"* calque
  B-8 names, in a string of the same phase. → *"no se puede localizar nada dentro de él"*.
- **The Spanish twins of B-12, B-14 and B-16**, which the review raised in English only. A fix to an
  English sentence that leaves its Spanish saying the old thing is a translation defect the parity
  checks cannot see: `dictionaries.test.ts` compares key sets and placeholders, never meanings.

### 7.4 The Spanish register question, settled

Review B's proposals mix **tú** (*"copias de tu configuración"*) and what looks like **usted**
(*"su propietario"*) in one sentence. `es.json` is **not** inconsistent, so no dominant-form judgement
was needed: it addresses the user as **tú** throughout and has since Phase 1b-1 — *"Edita tu
configuración de espanso"*, *"Selecciona un fragmento"*, *"Vuelve a cargar el archivo"*, *"el fragmento
que tenías seleccionado"*, *"requiere tu confirmación previa"*. Every string this phase touched agrees
with that.

The *"su propietario"* in B-6 is not a register break and was kept: the possessive is the **folder's**,
not the reader's — *the owner of `{path}`* — which is third person in either register. No string this
phase added or edited addresses the user as *usted*, and no string this phase did not add was
rewritten for register.
