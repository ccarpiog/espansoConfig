# Phase 3-1 — Compositional mapping edits and scalar form substitution

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-1", and §3 rulings 2, 4, 5, 15 and 34.
**Risk:** high. **Core-only**, with no production UI caller.

3-1 takes the two limits ruling 2 named. Several absent fields can now be inserted in one batch. The
first entry of a compact item can now change key without its `-` moving.

No window reading was performed or claimed.

---

## 1. The limits, re-derived on the tree before this phase

- `plan_match_edits` anchored every insertion after the same last nameable key
  (`crates/espansoconfig-core/src/draft/plan.rs:135-141` before this phase).
- `check_every_anchor_survives` refused two insertions sharing an anchor (`draft/audit.rs:387-391`).
- Below both, `apply_edits` refuses two replacements that share a start. Two `FieldInsert`s after one
  anchor are two zero-width replacements at one offset, so the engine had no way to write two new
  entries after one anchor either.
- Removing the first entry of a compact item is refused as `EntryDoesNotOwnItsLines`
  (`patch/edit.rs` `removal_span`, with its test in the structural tests module). So remove-then-insert
  could not spell a `trigger`→`regex` switch on a `- trigger: …` line. No substitution intent existed.

## 2. Failing-first evidence

The first test of `crates/espansoconfig-core/tests/draft_compose.rs`,
`one_save_adds_two_absent_options`, was written and run on the unchanged tree before any source
changed:

```
cargo test -p espansoconfig-core --test draft_compose
test one_save_adds_two_absent_options ... FAILED
thread 'one_save_adds_two_absent_options' panicked at crates/espansoconfig-core/tests/draft_compose.rs:59:49:
two absent options plan as one batch: SharedInsertionAnchor { first: 0, second: 1 }
test result: FAILED. 0 passed; 1 failed
```

After the change it passes. Its expected text changed once, before the fix landed: the codec writes
the drafted string `true` as `'true'`, because a drafted value is a string (D2u). Its assertion and
its independent checks are otherwise the same.

## 3. What changed

### 3.1 The engine (`patch/edit.rs`, `patch/mod.rs`)

- **`FieldInsertGroup` / `DocumentEdit::InsertFields`.** One edit holds an ordered, never-empty
  list of `(key, value)` entries. It is written as **one** replacement at the anchor's insertion
  point, each entry on its own line at the mapping's column, in the stated order. `FieldInsert` now
  goes through the same planner (`plan_insertion_group`) as a group of one. A key the mapping already
  holds, or that the group holds twice, is `KeyAlreadyPresent`. At end of file with no final newline,
  each entry gets its break in front and the file still does not end in one. Empty groups cannot be
  built: the constructors return `None`.
- **`KeySubstitution` / `DocumentEdit::SubstituteKey`.** It replaces the entry's **key token and
  nothing else**. It re-spells the key in the old key's own style through `preserve_scalar` in key
  context, so a plain key stays plain and a quoted key stays quoted. The value's bytes are not
  touched. When a new value is given, it is rendered exactly as a scalar edit renders one:
  `plan_one`'s body became `plan_scalar_node`, and both callers share it. The engine refuses:
  - a path that names no mapping entry (`NotAMapping`);
  - a value that is not a scalar (`NotAScalar`), because this is scalar-to-scalar only;
  - a new key the mapping already holds (`KeyAlreadyPresent`);
  - a key that is not a single-line, decoded, non-block scalar (new `EditError::KeyNotSubstitutable`);
  - a flow or hazardous mapping (through `editable_mapping`, as for an insertion).
- **Verification.** Both edits go through the existing mapping fold. A rename is a removal of the old
  key and an insertion of the new one at the same position, with the count unchanged: the old key
  must be gone, and the new key present, decoding (twice) to the kept or the new value. `verify_field`
  gains property 5, **every key at the position the batch intended**. The intended order is derived
  from the original entries before the splice: kept entries in place, a renamed entry under its new
  key, and each insertion's keys directly after its anchor. It fails as the new
  `VerificationFailure::EntriesNotInTheIntendedOrder`. A unit test drives it directly
  (`verification_rejects_a_group_or_a_rename_out_of_place`): swapped group entries, a group after
  the wrong anchor, a moved rename, and an old key kept beside the new one.

### 3.2 The draft (`draft/{match_draft,plan,audit,error,mod}.rs`)

- **`FieldSubstitution`**, closed by its type:
  - `Trigger { from: TriggerForm, to: TriggerForm }` covers `trigger`/`regex`;
  - `Content { from: ContentForm, to: ContentForm }` covers `replace`/`markdown`/`html`/`image_path`/`form`.

  No variant carries a key string or YAML. `FieldSubstitution::between` is the one place a pair of
  `MatchField`s is judged, and the closed-surface guard asks it too.
- **`plan_match_edits_with_substitutions(view, draft, &[FieldSubstitution])`**. `plan_match_edits`
  is now this with no substitutions, and derives exactly what it did before, except for the two
  behaviours below. `MatchDraft`'s wire shape is unchanged. The substitution is an argument, not a
  field, so no TypeScript mirror of `MatchDraft` moved and no production caller exists.
- **Planning an insertion.** Every absent field is written after **one** anchor. The anchor is the
  last nameable entry the batch neither removes nor renames, and whose next visible entry the batch
  does not remove (§4.2). One field is a `FieldInsert`. Two or more are **one** `FieldInsertGroup`
  in `MatchField::ALL` order.
- **Audit.** The closed surface admits a group of schema-known keys, and a substitution between two
  forms of one family on the match's own mapping. The anchor check reads a group's anchor like a
  single insertion's. It counts a substituted-away key as removed and a substituted-to key as
  inserted. Two insertion **edits** sharing an anchor are still `SharedInsertionAnchor`. A new check 8
  refuses a substitution to a key in `original_keys`. For containment, a substitution counts as a
  removal of its entry, so an edit of the renamed value or a second substitution of it is
  `RemovalContainsAnEdit`.
- **Three new `DraftError`s:**
  - `SubstitutionSourceAbsent { field }`: the stale intent, where the key to rename is not there;
  - `SubstitutionTargetPresent { field }`: the duplicate key;
  - `SubstitutionConflictsWithField { field }`: the source key carries another intent, the destination
    key carries a `Remove`, or two substitutions name one key.

### 3.3 The wire and the dictionaries

There are five new codes, each mirrored in `src/lib/ipc/types.ts` and worded in both `en.json` and
`es.json`: `editError.keyNotSubstitutable`, `verificationFailure.entriesNotInTheIntendedOrder` and
`draftError.substitution{SourceAbsent,TargetPresent,ConflictsWithField}`. The pinned counts moved
with them:
- `dictionary_contract.rs`: editError 41, verificationFailure 31, draftError 35;
- `wire_contract.rs`: EditError 41, DraftError 35, the save-transaction sample list 208, the operand
  check (125, 12, 71), the placeholder check 208, and the "thirty-five" prose;
- `draftCodes.test.ts`: names, samples and the count 35.

No new `codes.ts` accessor was needed. The existing `describe*` accessors resolve every variant of
these three unions through their keys.

The new Spanish sentences belong in the Phase 3 translation-review inventory (ruling 29):
`code.editError.keyNotSubstitutable`, `code.verificationFailure.entriesNotInTheIntendedOrder` and
the three `code.draftError.substitution*` keys. Their producers are `plan_substitution` in
`patch/edit.rs` and `verify_field`, `plan_substitution` in `draft/plan.rs`, and
`check_no_substitution_duplicates_a_key` in `draft/audit.rs`.

## 4. Design choices

### 4.1 A group is one edit, not a relaxed overlap rule

Batch order is not an ordering in this engine: `apply_edits` splices by offset. Letting two
`FieldInsert`s share an offset would make batch position decide the file. A group **states** its
order, so the shared-anchor refusal stays, both in the engine and in the audit. It now has a legal
alternative.

### 4.2 An anchor never sits before a removed entry

An insertion after entry A lands at the end of A's line. If the batch removes A's successor, that
removal's run starts at the same offset, and `apply_edits` refuses two replacements that share a
start. `inserting_at_the_start_of_a_removed_item_is_an_overlap` in `tests/patch_item.rs` pins this
deliberately. This phase does not relax that engine rule. The planner skips such an anchor instead.

So "remove `label` (the last entry) and add `word`" on `trigger, replace, label` now writes `word`
after `trigger`. Before this phase it was refused as `InsertionAnchorRemoved`. The test
`the_planner_anchors_an_insertion_on_an_entry_the_batch_leaves_alone` in `tests/draft_plan.rs` pins
the placement. A renamed successor does not trigger the skip: a key token in a match mapping never
starts a line.

### 4.3 Substitution keeps the value unless the destination is drafted

The new value comes from the draft's own field for the **destination** key, for example
`MatchDraft::regex` for `trigger`→`regex`. If that field is `Unchanged`, or `Set` to the value the
source already decodes to (the module's one comparison, `plan_scalar`), the value's bytes are kept
verbatim. The key token is the only replacement.

### 4.4 Substitution is an argument, not a `MatchDraft` field

`MatchDraft` crosses the wire with `deny_unknown_fields`, and `types.ts` mirrors it. A new field
would have committed a wire shape before any UI step needed one. The core API is enough for this
core-only step.

## 5. Acceptance, criterion by criterion

| Criterion | Evidence |
|---|---|
| One save adds two absent options; failing first | `one_save_adds_two_absent_options` (§2); also through `save_document`: `a_composed_batch_commits_through_the_save_transaction` |
| `replace`→`markdown` in either source order | `replace_becomes_markdown_after_the_trigger`, `replace_becomes_markdown_before_the_trigger` (the content key on the compact line) |
| `trigger`→`regex` on a compact first line | `trigger_becomes_regex_on_a_compact_first_line`, `…_with_a_new_value` |
| Stale anchor refused by name | `SubstitutionSourceAbsent` (planner), `InsertionAnchorNotInOriginal` (guard), `EditError::NoSuchSibling` (engine, batch applied to a newer text) |
| Removed anchor refused by name | `InsertionAnchorRemoved` for a group anchored on a removed key **and** on a renamed key (guard) |
| Duplicate key refused by name | `SubstitutionTargetPresent` (planner and guard), `EditError::KeyAlreadyPresent` (engine: substitution, group key already present, group key twice); a refused substitution through `save_document` writes nothing |
| Independent checks on every success | `assert_independently` in `tests/draft_compose.rs`: its own walk of the bytes outside the reported spans, comment text line by line, and a re-projection comparing every untouched field's value **and** source spelling in every match. It checks carried values byte for byte, and the counts of `triggers`/`search_terms`/`vars`/`form_fields`/unknown entries. Most successes also assert the exact expected text. |
| Core free of tauri | `cargo tree -p espansoconfig-core \| rg tauri` printed nothing |

## 6. Gates and the rung

Every gate was run on 2026-09-23 and exited 0:
- `cargo build --workspace`;
- `cargo test --workspace -- --test-threads=1 > /private/tmp/3-1-cargo.log 2>&1`, read from the log;
- `cargo clippy --workspace --all-targets -- -D warnings`;
- `cargo fmt --check`;
- `npm run check`;
- `npm test`;
- `npm run build`.

The server-only oracle `rg -c '\$\$payload|head_payload|push_element'` found nothing. The client-only
oracle `rg -c 'window\.__svelte|svelte-trusted-html'` found 2.

| | Baseline | 3-1 | Why |
|---|---|---|---|
| Rust tests passed | 1323 | **1352** | +28 in the new `tests/draft_compose.rs`, and +1 unit test (`verification_rejects_a_group_or_a_rename_out_of_place`). Two tests in `tests/draft_plan.rs` were rewritten in place (§7), so their count is unchanged. |
| svelte-check files | 461 | **461** | No `.ts`/`.svelte` file was added. |
| vitest tests | 3546 | **3546** | `draftCodes.test.ts` gained samples inside its existing cases, not new cases. |
| Vite modules | 200 | **200** | No module was added. |

## 7. Tests changed rather than added

- `inserting_after_a_key_the_same_batch_removes_is_refused` became
  `the_planner_anchors_an_insertion_on_an_entry_the_batch_leaves_alone`. Its old assertion stated
  the limit this phase removes. The guard-level twin
  (`the_guard_refuses_an_insertion_anchored_on_a_key_the_batch_removes`) is unchanged.
- `two_insertions_sharing_one_anchor_are_refused` now drives the hazard through the guard on a
  hand-built batch. It also asserts that the planner emits one group for the same draft.

## 8. Open items

1. **No UI caller.** A content-kind switch (ruling 8) and a trigger switch (ruling 4, 3-2) will call
   `plan_match_edits_with_substitutions`. Each owes the preview and confirmation its ruling requires.
   The switch may also need a place on the wire, which §4.4 deliberately did not add.
2. **Placement after a removed last entry** (§4.2) is correct but may surprise: the new key lands
   after the last entry whose successor survives. A later UI step may prefer to offer "save twice".
   Relaxing the engine's shared-start rule for a zero-width insertion before a deletion would allow
   the natural placement. That is an engine decision with its own pinned test, so it is not taken here.
3. **A substitution cannot yet switch between a scalar and a list** (`trigger`↔`triggers`). That is
   3-2's typed sequence work. `FieldSubstitution` has no variant for it by design.
4. **A key substitution in a flow mapping** (`- {trigger: a, replace: b}`) is refused through
   `editable_mapping` as `FlowCollection`, as every structural edit is. No test here drives that
   refusal. A later step that wants flow-mapping switches owes the comma-and-spacing rules first.
