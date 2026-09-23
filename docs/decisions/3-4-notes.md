# Phase 3-4 — Bounded creation for the wider editor

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-4", §3 rulings 4, 5, 8, 9, 10, 23 and 30, and the
consult reply's 3-4 entry and Q13 (`docs/reviews/phase-3-design.md:245`, `:365`, `:429-439`).
**Risk:** high. **Core and command**, with no new UI control: the two existing TypeScript producers of a
`NewMatch` were adapted to the new shape without changing what they send.

3-4 widens `NewMatch` from six scalar fields (two required, four optional) to the whole Phase 3
creation surface, and widens `InsertItem` so one new item may hold a flat list of scalars. It never
accepts arbitrary nested YAML or an author-chosen key: D1 of `2b-2b-2-notes.md` stands.

No window reading was performed or claimed.

---

## 1. What the tree could not do before this phase

- `NewMatch` could say `trigger` + `replace` + `label`/`word`/`left_word`/`right_word`, nothing else. A
  snippet could not be created with `triggers`, `regex`, `markdown`, `html`, `image_path`, `form`,
  `comment`, `search_terms` or six of the nine options.
- `InsertItem` carried `Vec<(String, String)>`, so a new item could hold scalars only; a `triggers` or
  `search_terms` list could not be born with the item.
- The wire struct ignored unknown properties, so a misspelled TypeScript key was silently dropped
  (the wire contract test existed to keep the typo out of `types.ts` for that reason).

## 2. What changed

### 2.1 The engine (`patch/edit.rs`, `patch/mod.rs`)

- `InsertItem.fields` is now `Vec<(String, EntryValue)>`. `InsertItem::typed` is the new constructor;
  `InsertItem::at`/`new`/`after`/`to_front` keep their scalar signatures and wrap each value as
  `EntryValue::Scalar`, so every existing caller and test is unchanged. `InsertItem::fields()` now
  answers `&[(String, EntryValue)]` (one test in `tests/patch_item.rs` reads `.as_scalar()`).
- `render_item` renders a list-valued field the way `FieldInsertGroup` does (ruling 5): a non-empty
  list is its key alone on a line and one `- item` line per item, an empty one is `key: []`. Each item
  is spelled by `render_scalar_item`, the call `ScalarItemInsert` makes. Lines are joined by
  `join_rendered_lines`, which already carried the "break in front at end of file" rule, so a file
  with no final newline keeps not having one and a CRLF file's ending is copied.
- **The list step.** A list's items sit `list_step` columns past the item's key column. The step is
  the document's own dominant block-child step (`observed_steps` over every mapping, the second pass of
  `indentation_step`), falling back to two only when the document shows none. There is no local
  mapping to consult — the item does not exist yet — so the first pass of `indentation_step` has no
  subject here.
- `NewItem::Mapping` holds `(String, EntryValue)` pairs, and `verify_inserted_item` checks each value
  with `verify_entry_value` — the function `FieldInsertGroup`'s verification already used — so a list
  must reparse as a sequence of exactly the requested scalars, in order, block style when non-empty and
  flow `[]` when empty, each decoded twice. `check_inserted_fields` is unchanged apart from its type.
- The licence text on `InsertItem` and the module headers of `patch/edit.rs` and `patch/mod.rs` now say
  that a new item's field may be a flat `EntryValue::ScalarList`, and nothing deeper.

### 2.2 The creation type (`draft/new_match.rs`, `draft/mod.rs`)

`NewMatch` is a closed struct, `#[serde(deny_unknown_fields)]`:

| Field | Type | Written as |
|---|---|---|
| `trigger` | `NewTrigger` — `Single(String)` \| `Multiple(TriggerList)` \| `Regex(String)` | `trigger:`, a block `triggers:` list, or `regex:` |
| `content` | `NewContent` — `Replace` \| `Markdown` \| `Html` \| `ImagePath` \| `Form`, each `(String)` | the one content key |
| `label`, `comment` | `Option<String>` | the key, only when `Some` |
| `search_terms` | `Option<Vec<String>>` | a block list when non-empty, `[]` when `Some(vec![])`, nothing when `None` |
| `word`, `left_word`, `right_word`, `propagate_case`, `uppercase_style`, `force_mode`, `force_clipboard`, `paragraph`, `anchor` | `Option<String>` | the key, only when `Some` |

`TriggerList` is a non-empty `Vec<String>`: its only constructor answers `None` for an empty vector,
and serde goes through the same constructor (`try_from`), so `{"Multiple": []}` is refused while the
command's arguments are read. `NewMatch::new(trigger, content)` builds one with every optional field
absent. `NewMatch::entries()` replaces `fields()` and answers `Vec<(String, EntryValue)>` in this write
order: trigger form, content form, `label`, `comment`, `search_terms`, then the nine options in
`MatchField::ALL`'s relative order. Every key comes from `MatchField::key` or `SequenceField::key`.

### 2.3 The command and the save (`src-tauri/src/commands.rs`, `persist` unchanged)

`create_one_match` builds `InsertItem::typed(sequence, placement, new_match.entries())` and still ends
in `run_one_save`; nothing else in the command changed. The save transaction needed no change: its
creation finding (`NewMatchRepeatsLiteralTrigger`) reads the candidate's projection, which already
counts every `triggers` item as a literal, and a `regex` that does not compile is already
`RegexDoesNotCompile`, an editor-model error no acknowledgement passes. Both are exercised by a new
command test.

### 2.4 The wire, the dictionaries and the contracts

- `src/lib/ipc/types.ts`: `NewTrigger` and `NewContent` are all-object unions
  (`{ readonly Single: string }`, `{ readonly Multiple: readonly [string, ...string[]] }`, …), so the
  non-empty rule is in the TypeScript type too; `NewMatch` declares the fourteen properties.
- `src-tauri/src/dictionary_contract.rs`: `NewTrigger` and `NewContent` are on `NOT_A_CODE` as protocol
  tags, for `NewMatchPosition`'s reason. Their TypeScript unions have no single-quoted member, so the
  TypeScript scan skips them as structural types and its exemption list is unchanged.
- `src-tauri/src/wire_contract.rs`: the creation-payload test now covers fourteen properties, checks each
  required property's declared type against the named union, and checks that an unknown property is
  refused. A new test, `the_creation_alternatives_declare_exactly_the_rust_variants`, reads the two
  unions' tags and payload types (`object_union_tags`) and compares them with what serde writes.
- `src-tauri/src/dispatch_check.rs`: the over-IPC creation sends the new shape, and three payloads are
  now refused at the boundary: a missing content, the pre-3-4 flat shape, and an empty `Multiple`.
- **No new wire code, dictionary key or `codes.ts` accessor.** Every refusal this phase adds is a
  deserialization refusal of a value the TypeScript type cannot express (§5 item 3).

### 2.5 The TypeScript callers

`newMatchOf` (`src/lib/browser/matchCreation.ts`) and `newMatchOfRecovery`
(`src/lib/browser/recovery.ts`) now send `{ trigger: { Single: … }, content: { Replace: … } }` plus the
same optional keys as before; the requests mean the same snippet. Two carriage-return gates read the
old flat properties and were adapted so they still check the same text:

- `beginCreate` reads the submission's candidate (`trigger`, `replace`) directly;
- `beginRecoveryCreate` read `Object.values(newMatch)` and kept only strings. With the typed
  alternatives that would have skipped the trigger and the body, so it now reads every text through the
  new exported `textsOfNewMatch`, which descends one object or array level. It is registered in the
  module's export partition (`NOT_A_FORM_TRANSITION`) and has its own vitest case.

## 3. Which fields, and why

- **The trigger alternatives** are espanso's three trigger keys, which ruling 4 and rule 2 of the
  validator already treat as exactly-one-of. A `Several`/`Absent` trigger has no spelling.
- **The content alternatives** are the five keys `ContentForm` names (3-1) and 3-5's acceptance calls
  "the five content fields". `form` is layout text only (ruling 9): creation writes no `form_fields`,
  which stays read-only until Phase 4 and would be a nested mapping.
- **The optional scalar fields** are `label`, `comment` and the nine options — the "`label`, `comment`,
  the nine options" 3-5 must make editable, and the fields `MatchDraft` names as schema-known strings
  apart from the trigger and content keys. `anchor` is the espanso key, not YAML `&anchor` syntax
  (ruling 10). Every option is text, never a boolean (D2u, ruling 10, ruling 28).
- **The lists** are `triggers` (through `NewTrigger::Multiple`) and `search_terms`, the two lists
  ruling 1 keeps in Phase 3. `vars`, `form_fields`, `params` and any other collection are Phase 4 or
  unmodelled and have no field here.

## 4. Decisions

1. **The wire shape changed, and old payloads are refused.** A flat `trigger` string beside `replace`
   cannot carry the alternatives the type must enforce, so the payload is
   `{ trigger: {Single|Multiple|Regex: …}, content: {Replace|…: …}, …optional }`. Every caller is in
   this tree and was changed with it.
2. **`deny_unknown_fields` on `NewMatch`.** The project's pattern for inbound draft types
   (`MatchDraft`, `menu.rs`), and it turns the silent-drop failure the old wire test described into a
   refusal.
3. **`Multiple` may not be empty, `search_terms` may.** `triggers: []` cannot fire and the validator
   raises nothing for it, so the only place to refuse it is the type; the same judgement makes content
   mandatory. An empty `search_terms` is an explicit request for `search_terms: []`, the distinction
   3-2's presence projection draws, and is kept (ruling 5).
4. **Write order** is trigger form, content form, `label`, `comment`, `search_terms`, the nine options.
   It extends the old order (trigger, replace, label, word, left_word, right_word) without reordering
   any pair it held, so `EDITABLE_FIELDS`' order still agrees with it.
5. **`InsertItem` was widened rather than a second item primitive added.** One item, one hull, one
   verification: the list case reuses `EntryValue`, `render_scalar_item`, `join_rendered_lines` and
   `verify_entry_value`, all of which already existed for 3-2's list fields.
6. **Empty strings are not refused in the core**, for any field, including `Single("")`. That was the
   core's behaviour before this phase; the creation form refuses an empty trigger or body itself.

## 5. Acceptance, criterion by criterion

- **Every supported form creates exactly one item.** `every_trigger_and_content_alternative_creates_exactly_one_item`
  (`tests/new_match_creation.rs`): all 3 × 5 trigger/content pairs, each in an LF, a CRLF and a
  no-final-newline spelling of the same inline file (45 creations). Each is checked independently of the
  engine's verifier: one zero-width replacement, every byte before and after it identical, the
  projection one match longer, and the keys and kinds read back by **yaml-rust2** and by the projection.
- **`None` differs from `Some("")` for every optional field.** Unit test
  `none_and_empty_differ_for_every_optional_field` (`draft/new_match.rs`) and
  `none_and_empty_differ_in_the_file_for_every_optional_field` (all eleven scalar options read back by
  yaml-rust2 as `""`, never null; `search_terms: []` projects `SequencePresence::Empty`, an absent one
  `Absent`). Through `run_one_save`, `a_wide_creation_reaches_the_disk_in_crlf_and_without_a_final_newline`
  asserts a present-empty `comment` and an absent `label`.
- **List order survives.** `every_placement_keeps_the_lists_in_order` (Front, After(0), End), the full
  byte-exact test, and the command test, each with deliberately unsorted aliases and terms.
- **No arbitrary key or collection can be expressed, enforced by the type.** The struct has no map, no
  free key and no YAML value; every value is `String` or `Vec<String>`; `EntryValue` has no nested
  shape; `deny_unknown_fields` refuses unknown properties. `the_wire_form_is_closed` refuses a `vars`
  key, a misspelled key, the pre-3-4 shape, an unknown tag, a nested object as a trigger and a nested
  array as an alias.
- **Creation still ends in `run_one_save`.** `create_one_match`'s only change is the constructor call;
  the two new command tests run through `WorkspaceSession::create_match`, and the dispatcher test through
  Tauri's own IPC.
- **Byte identity outside the item over CRLF and no-final-newline text**:
  `a_full_creation_is_written_exactly_in_crlf_and_without_a_final_newline` (core, whole file as a
  literal) and the command test (whole file on disk as a literal). The fixtures are inline; no corpus
  fixture was added or touched.
- **Conservative emitter.** `on`, `yes`, `true`, `false`, `off`, `~` and `*alias` are written quoted,
  and yaml-rust2 reads each back as a string.

## 6. Gates and the rung

Every gate was run on 2026-09-23 and exited 0: `cargo build --workspace`;
`cargo test --workspace -- --test-threads=1 > /private/tmp/3-4-cargo.log 2>&1` (1412 passed, 0
failed); `cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`; `npm run check`
(461 files, 0 errors, 0 warnings); `npm test` (3549 passed, 72 files); `npm run build` (200 modules).
The server-only oracle found nothing; the client-only oracle found 2. `cargo tree -p
espansoconfig-core | rg tauri` printed nothing.

| | 3-3 | 3-4 | Why |
|---|---|---|---|
| Rust tests passed | 1400 | **1412** | +8 in the new `tests/new_match_creation.rs`; `draft/new_match.rs` unit tests went from 6 to 7; +2 command tests; +1 wire contract test. |
| svelte-check files | 461 | **461** | No `.ts`/`.svelte` file was added. |
| vitest tests | 3548 | **3549** | +1 case for `textsOfNewMatch`. |
| Vite modules | 200 | **200** | No module was added. |

### 6.1 Tests changed rather than added

- `draft/new_match.rs`'s six unit tests were rewritten for the new type (the file's whole subject).
- `the_creation_payload_declares_exactly_the_properties_serde_reads` (`wire_contract.rs`): fourteen
  properties, typed required properties, unknown-property refusal.
- `create_and_delete_match_are_reachable_and_their_arguments_deserialize` (`dispatch_check.rs`): the new
  payload shape and two more boundary refusals.
- `tests/persist_save.rs`, `tests/patch_item.rs` and four `commands.rs` tests construct `NewMatch` or
  read `InsertItem::fields()` in the new shape; what they assert is unchanged.
- Thirteen vitest expectations of a sent `NewMatch` (`commands`, `workspace`, `matchCreation`,
  `MatchCreator`, `MatchEditor`, `recovery`, `RecoveryPanel` tests) now expect the typed shape.

## 7. Open items

1. **A `matches:` list whose dashes sit at the key's own column (`matches:\n- trigger: a`) refuses
   every creation** with `MalformedSpan` at the first item's span — with or without lists, so it
   predates this phase. Found while probing the list step; not investigated here.
2. **Repeated aliases inside one new `triggers` list are not detected.** The creation finding compares
   the new item with the *other* items; `[":a", ":a"]` is written as given.
3. **A boundary refusal is not a typed code.** An empty `Multiple`, an unknown property or the old
   shape is refused by serde inside Tauri's command macro, which reaches TypeScript as a rejected
   invoke rather than a `CommandError`. The TypeScript types cannot build any of the three, so only a
   hand-built payload meets it.
4. **No control authors the new fields yet.** The creation form still sends `Single` + `Replace`, and
   recovery still carries only the six editor fields. 3-5 (content, options), 3-6 (lists, trigger
   forms) and 3-13 (visible defaults) own the controls and recovery's widening (ruling 23).
5. **The list step is document-wide.** A new item's lists take the document's dominant block-child
   step, ties to the smaller; a file with different steps in different places gets one of them.
6. **Carriage returns are refused in TypeScript only**, as before this phase; the core writes a `\r`
   it is given.

## 8. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

**None.** This phase adds no dictionary key and changes no existing sentence in `en.json` or `es.json`.

## 9. Review fix

`docs/reviews/phase-3-4.md`: ship-with-fixes, one SHOULD-FIX, fixed in the file it named.

1. **The creation gate reread the buffers** (`src/lib/browser/matchCreation.ts`, `beginCreate`): after
   `newMatchOf` captured the values, the carriage-return check read `submission.candidate` a second
   time, so a getter-backed `CreationBuffers` could answer clean text to the check and a `\r` to the
   capture (a check-and-spend split by a property read, `CLAUDE.md` §6). The gate now reads the strings
   captured in `newMatch`, through a local `capturedTexts` (the payloads of the two typed
   alternatives). It is not `recovery.ts`'s `textsOfNewMatch`, because `recovery.ts` already imports
   `matchCreation.ts` and the reverse import would be a cycle. Regression: `checks the captured payload,
   not a second read of getter-backed buffers` (`matchCreation.test.ts`). Its getter answers a `\r` on
   exactly the k-th read, for k = 1 … 12. With the old gate restored it failed: a create started
   carrying `:n\rew`.

Gates after the fix, each exit 0: `npm test` (3550 passed, +1), `npm run check` (461 files, 0
errors, 0 warnings), `npm run build` (200 modules). No Rust file changed.
