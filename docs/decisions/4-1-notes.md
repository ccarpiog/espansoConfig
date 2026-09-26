# Phase 4-1 — A1 across creation and single-match editing

**Status:** implementation record for step 4-1 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 1–3 of §3 and the narrowings §4.2 and §4.3. Source consult:
[`../reviews/phase-4-design.md`](../reviews/phase-4-design.md) Q1. No window reading was performed or
claimed; the optional visible confirmation of A1 rides in 4-13.

---

## 1. What changed and why

**One emission contract for match options, on every writing path.** Until now only the bulk edit
(Phase 3-10) wrote options as source text; creation (`NewMatch::entries`) and the single-match planner
(`plan_scalar`) wrote every option as a logical string, so a typed `true` reached the file as
`word: 'true'` (A1). The fix follows ruling 2: eight options are validated plain source, `anchor` stays a
string.

- **`MatchField::PLAIN_SOURCE_OPTIONS` / `MatchField::writes_plain_source`**
  (`crates/espansoconfig-core/src/draft/match_draft.rs`) — the one list of the eight: `word`,
  `left_word`, `right_word`, `propagate_case`, `uppercase_style`, `force_mode`, `force_clipboard`,
  `paragraph`.
- **New refusal `DraftError::OptionNotPlainSource { field }`** (`draft/error.rs`). Text that fails
  `is_plain_source` (`draft/bulk.rs`) — empty, a line break, a quote, `#`, a flow indicator, an alias, a
  tag, a nested mapping — is refused by name and never quoted. It carries the option's schema key, never
  the text. It crosses inside the existing `CommandError::DraftRefused`, so no new command-error code.
- **Creation** (`draft/new_match.rs`): `NewMatch::entries()` now returns
  `Result<Vec<(String, EntryValue)>, DraftError>`; the eight options become `EntryValue::PlainSource`,
  `anchor` and every other value stay `EntryValue::Scalar`. The signature change makes the check
  impossible to skip for any caller of `entries()`; a hand-built `InsertItem` is still caught inside the
  transaction by `PlainSourceNotReadBack`. `create_one_match` (`src-tauri/src/commands.rs`) calls it
  first, before resolving the document, so the refusal comes before any transaction. The `NewMatch` doc
  comments (the "options are text" and "decoded text, never YAML" sections, and the nine field docs) were
  rewritten to state the split.
- **Single-match editor** (`draft/plan.rs`): a new intent-level check `check_options_are_plain_source`
  (after the coherence checks, before any diffing) refuses bad text whether or not the field already
  holds it. `plan_field` inserts an absent option as `EntryValue::PlainSource` (so a lone absent option
  is a one-entry `FieldInsertGroup`, not a `FieldInsert`) and rewrites a present one through
  `plan_plain_source_scalar`, which derives nothing only when the scalar is already plain and byte-equal
  (`style == Plain && text == value && span.len() == value.len()`; the comment says this is an argument
  from YAML's plain-scalar grammar, not something a type forces) and otherwise emits
  `ScalarEdit::plain_source`. So `Unchanged` keeps `'true'`, and an explicit `Set("true")` rewrites it to
  `true`, as bulk does. The planner's module doc gained a section stating the exception to its
  decoded-equality rule.
- **Ambiguity exemption, exactly as wide as ruling 3 allows** (`patch/edit.rs`): `plain_source_nodes`
  now also takes the batch's `ItemExpectation`s and, through the new `inserted_plain_source_nodes`, names
  only the value node at the **position** of each requested `PlainSource` field of an inserted item whose
  decoded key is that field's key. The candidate sequence is re-resolved and zipped with the folded slots,
  so preceding insertions and removals shift nothing; any count disagreement names nothing (charged, the
  safe direction). The `render_item` comment that said nothing builds such an entry was corrected.
- **Bulk** (`draft/bulk.rs`): comments only — the sentence saying the single-match planner quotes options
  was false after this step and now states the shared contract.
- **Wire and i18n:** `DraftErrorName` and the `DraftError` union in `src/lib/ipc/types.ts`;
  `code.draftError.optionNotPlainSource` in both `src/lib/i18n/{en,es}.json` (with a `{field}` operand,
  a schema key); the `describeDraftError` comment in `src/lib/i18n/codes.ts` (its claim that no draft
  message interpolates an operand was already false for `switchWouldDiscardItems` and now names both);
  the count 43→44 in `src-tauri/src/wire_contract.rs`, `src-tauri/src/dictionary_contract.rs`,
  `draftCodes.test.ts` and the `DraftError` doc. The existing `describeDraftError` accessor and its
  reactive wrapper `tDraftError` cover the new variant; no new accessor was needed.
- **`CLAUDE.md` §6**: the options bullet now states the eight-versus-`anchor` split as present state.

**Sidecar:** no change. `src-tauri/src/sidecar/format.rs` already stores defaults as text, and an empty
default (`"word": ""`) **is** storable (its module example holds `"force_mode": ""`). Such a default is
still seeded, shown and removable in the creator, and still sent exactly as stored; `create_match` now
refuses it by name before the transaction (§4.3), and the creator's failure lines show the
`OptionNotPlainSource` sentence beside the still-visible `''` option (`creationDefaults.test.ts`).

## 2. Failing-first evidence (unchanged tree)

Three regression tests were written first and run against the unchanged source; outputs are in
`/private/tmp/4-1/failing-first-*.txt`.

| Test | Unchanged tree |
|---|---|
| `a1_a_seeded_true_default_is_written_as_plain_source` (`tests/new_match_creation.rs`) | FAILED: wrote `word: 'true'`, expected `word: true` |
| `a1_the_single_match_editor_writes_an_option_as_plain_source` (`tests/draft_plan.rs`) | FAILED in all three states: absent → `'true'`; `word: false` → `'true'`; `word: 'true'` → no edit, `'true'` kept |
| `a1_both_writing_paths_write_an_option_as_plain_source` (`src-tauri/src/commands.rs`) | FAILED: `create_match` wrote `word: 'true'` |

All three pass after the fix.

**Mutation check of the exemption.** With `inserted_plain_source_nodes` temporarily changed to exempt the
whole inserted item, three of the new negative tests failed (the corrupted neighbour, the equal-text
cases, the shifted-index case); the change was reverted (`/private/tmp/4-1/mutant-whole-item.txt`).

## 3. Tests added

- Core unit (`draft/new_match.rs`): the eight/`anchor` split; refusal by name for 16 non-plain texts in
  each of the eight options, the first refused option in write order named, `anchor` accepting them.
- Core engine (`patch/edit/corrupted_candidate_tests.rs`): honest exempted insertion; a corrupted
  neighbouring string (`'yes'` → `yes`) refused as `AmbiguousPlainScalarIntroduced`; the same `true` in a
  key, a sibling inserted item and a scalar-list element refused the same way; two inserted items plus a
  removal (index shifts) verify honestly and a corrupted neighbour in the shifted item is refused.
- Core planner (`tests/draft_plan.rs`): the failing-first test; `Unchanged` keeps `'true'` and a `Set`
  of the plain text already held derives nothing; refusal by name for each option, absent and present.
- Command layer (`src-tauri/src/commands.rs`): the failing-first test; `""`, `a #b` and `'true'` refused
  as `draftRefused` / `OptionNotPlainSource { field: "force_mode" }` on both `create_match` and
  `save_match`, file byte-identical.
- Frontend: `creationDefaults.test.ts` (empty default refused by name, still visible, removable);
  `matchEditor.test.ts` (a quoted option stays `Unchanged` through typing and undo, and through retyping
  the baseline text).

**Existing tests whose expectations changed** (each pinned the A1 behaviour): `draft_compose.rs` (six
literals), `new_match_creation.rs` (the full creation literal — `right_word` now `no` instead of `''` —
and the none/empty test), `persist_save.rs`, `draft_plan.rs` (the headline helper sets a plain-source
option only where the file already writes it plain, because `Set` over a quoted option is now a
deliberate rewrite; the lone-insertion test now uses `comment`; the anchor test expects a group),
`src-tauri/src/commands.rs` (two literals) and `preservation_check.rs` (three literals).

## 4. Gate and rung

All run serially, output under `/private/tmp/4-1/`: `cargo build --workspace` 0;
`cargo test --workspace -- --test-threads=1` 0; `cargo clippy --workspace --all-targets -- -D warnings`
0; `cargo fmt --check` 0; `npm run check` 0 (487 files, 0 errors, 0 warnings); `npm test` 0;
`npm run build` 0; bundle oracle — server-only markers absent, client markers present (2);
`cargo tree -p espansoconfig-core | rg tauri` empty.

**Rung:** `1567 / 487 / 4076 / 214` against `1555 / 487 / 4074 / 214` — twelve Rust tests and two
vitest tests added. **Module count unchanged:** no new `.ts` module or styled component.

## 5. Open items noticed, not fixed

1. The pre-existing (3-10) field-insertion branch of `plain_source_nodes` exempts by **key name** within
   the changed mapping rather than by position. Duplicate keys are refused earlier, so it is exact in
   practice, but it is not the positional form ruling 3 describes for inserted items.
2. `plan_bulk_option_edits` keeps its own quoted-spelling rewrite branch, now duplicated by the planner's
   `plan_plain_source_scalar`; a later step may let bulk delegate.
3. Recovery's recreate-as-new builds a `NewMatch` from retained draft text; option text that is not plain
   source is now refused by name at *Create* rather than written quoted. No test drives that path with
   such text.
4. The creator does not pre-check option text on the client; the refusal arrives from Rust after
   *Create*. A client-side affordance would be a new surface and was not added.
5. Neither sentence of `code.draftError.optionNotPlainSource` has been read on a window, in either
   language (4-13; the Phase 4 translation inventory, 4-24).
6. No test proves a "same spelling exempted globally" mutant fails; the whole-item mutant was the one run.
