# Phase 2b-2b-2 — `vars` and `form_fields`, the open key surface

The sub-phase that lets the draft engine reach the half of a match espanso does **not** fix the
keys of. Still no caller: no `#[tauri::command]` reaches any of it and no screen shows it, which
is 1b-1's, 2b-1's and 2b-2b-1's shape repeated on purpose.

Registered commands: **7** in `commands.rs` and **1** in `menu.rs` — unchanged. The only thing
touched in `src-tauri/` is one new `NOT_A_CODE` entry and one rewritten justification (§9). No
command, no IPC type, no i18n key, **no frontend file at all**.

---

## 1. What was built

| Piece | Where |
|---|---|
| `VariableField` — a variable's three schema-known scalars, spelled as espanso spells them | `crates/espansoconfig-core/src/draft/match_draft.rs` |
| `EntryDraft`, `VariableDraft`, `FormFieldDraft`, and `MatchDraft::{vars, form_fields}` | same file |
| `DraftTarget` — seven new variants, **indices only** | same file |
| `DraftError` — eleven new refusals, none carrying a key text | `crates/espansoconfig-core/src/draft/error.rs` |
| `plan_vars`, `plan_form_fields`, `plan_open_mapping`, `nameable_key` | `crates/espansoconfig-core/src/draft/plan.rs` |
| `check_no_index_is_drafted_twice` generalised; `check_no_entry_drafts_two_shapes` added | same file |
| `check_closed_surface` widened to seven scalar shapes and four removable ones | `crates/espansoconfig-core/src/draft/audit.rs` |
| `NestedKeys`, and `check_every_named_key_is_unique` restated per parent mapping | same file |
| 31 new acceptance tests, and both corpus sweeps extended | `crates/espansoconfig-core/tests/draft_plan.rs` |
| One new `NOT_A_CODE` entry (`VariableField`) and one rewritten (`DraftTarget`) | `src-tauri/src/dictionary_contract.rs` |

---

## 2. What the surface now is

Seven scalar shapes, and **nothing deeper and nothing else**:

| Path | What it is |
|---|---|
| `<match>.<scalar key>` | a schema-known scalar field (2b-2b-1) |
| `<match>.<triggers\|search_terms>[i]` | an existing element of a string sequence (2b-2b-1) |
| `<match>.vars[i].<name\|type\|inject_vars>` | a variable's schema-known scalar |
| `<match>.vars[i].params.<key>` | one entry of a variable's open `params` mapping |
| `<match>.vars[i].params.<key>[j]` | one element of such an entry's sequence |
| `<match>.form_fields.<key>.<key>` | one option of one form field |
| `<match>.form_fields.<key>.<key>[j]` | one element of such an option's sequence |

A **removal** may name the four of those that end in a key segment. A path ending in an index is a
sequence element, and deleting one is a cardinality change this engine never makes. An
**insertion** may still only join the match's own mapping (§3).

`a_path_one_segment_deeper_than_the_surface_is_refused` drives one segment past the deepest legal
path of every shape, as a scalar edit *and* as a removal, and each must fail. That is what stops
the widening from quietly becoming "anything under `vars`".

---

## 3. D1 — this phase inserts nothing below the match mapping

**Decision, with its reason, taken up front rather than discovered late.**

A drafted entry the projection does not hold is **refused by name**, never created. Inserting an
author-chosen key would be the first time this engine writes a key string that no schema fixes,
and that is a different operation from everything the engine does today:

- it needs its own **per-mapping anchor machinery** — `check_every_anchor_survives` is written for
  the match's own mapping and its `original_keys`, and every anchor hazard (removed, inserted, not
  original, shared) would have to be restated for each open mapping separately;
- it needs its own **emission checks**: a key written into a `params` mapping inherits that
  mapping's indentation, its flow-or-block context and its own quoting decision, none of which
  `FieldInsert` has been exercised against below the match level;
- it needs its own **review**, because the failure mode is silent: a new key in the wrong mapping
  changes what espanso does without changing anything the user asked about;
- and **nothing in the current UI can produce one.** There is no screen, so there is no user
  waiting for it.

So it is deferred, deliberately. Two consequences are worth stating:

1. **A variable's absent `name`, `type` or `inject_vars` is refused too**
   (`VariableFieldHasNoScalar`), even though those are keys espanso's schema *does* fix. The
   projection reports `None` both for a key that is not there and for one holding a shape the
   schema does not use, and this phase inserts in neither case.
2. **`check_every_anchor_survives` did not need generalising**, and that is a consequence of D1
   rather than an oversight. Every `FieldInsert` a drafted batch can hold still names the match's
   own mapping — `check_closed_surface` refuses any other, independently — so `original_keys` is
   still the one list an anchor has to be found in. The function's own doc comment now says so,
   and says what a later phase owes it.

---

## 4. D2 — an address is an index, and never a key the owner wrote

**A hard privacy constraint, not a preference.** A refusal crosses the process boundary and the
owner's configuration is private (`CLAUDE.md` §1). A `MatchField`, a `SequenceField` and now a
`VariableField` are names espanso's schema fixes, so they are safe to carry. The text of a key the
schema does **not** fix is not, and no `DraftTarget` variant and no `DraftError` variant holds one.

So a variable, a `params` entry, a `form_fields` entry and one of its options are each named by
their **index in the projection**, exactly as `ItemDraft` names a sequence element. Rust reads the
key text out of the projection to build the `DocumentPath`. **The caller can only name what it was
shown.**

`a_draft_target_names_an_open_entry_by_index_and_never_by_key` pins the wire spelling of all seven
new addresses. `no_open_refusal_carries_a_key_the_owner_wrote` walks the serialized form of every
new refusal and asserts that every string in it is a schema key or a variant tag — a key the owner
wrote would show up as a string that is neither.

---

## 5. The equality rule is inherited verbatim, and is still one line

`scalar.text == value`, against the projection's decoded value, through the same private
`plan_scalar`. **A `params` entry, a form-field option and a nested sequence element all go through
it.** There is one comparison in `plan.rs` and there is not a second one; `ScalarView::decoded ==
false` still refuses with `NotDecodable` rather than comparing a raw source slice as a logical
value.

The headline property is stated twice more because of it — §8 — and the answer is the same at every
depth: **a draft holding the values the file already holds derives an empty batch.**

§10 hole 1 records what that rule cannot express.

---

## 6. The refusal taxonomy

Eleven new variants, on top of 2b-2b-1's twenty. Every one has a test; four of them are
**unreachable from any document that reaches the planner**, and each says so in its own test's
documentation rather than implying coverage it does not have.

| Refusal | What it catches | Reached through |
|---|---|---|
| `TargetDoesNotExist { target, length }` | an address below the match mapping the projection cannot resolve — a variable, a `params` entry, a `form_fields` entry, an option, a nested element. **D1 as a refusal** | the planner, five ways |
| `VariableFieldHasNoScalar { variable, field }` | a variable's `name`/`type`/`inject_vars` that is absent, or present holding a shape the schema does not use | the planner |
| `VariableHasNoPath { index }` | a variable nothing can address | **forced state** — a variable reached through `matches` always has a path |
| `EntryDraftsAScalarAndASequence { target }` | one entry drafted as both, refused **before any diffing** | the planner |
| `TargetIsNotNameable { target }` | a key that is not a scalar, or that did not decode | **forced state** — a complex key raises `HazardKind::ExplicitKeyMapping` and the gate refuses the match first |
| `TargetKeyIsAmbiguous { target, other }` | two entries of one open mapping decoding to one key | **forced state** — a repeated key raises `HazardKind::DuplicateMappingKey` anywhere in the match's subtree |
| `NestedValueIsACollection { target, found }` | a `Set` over an entry whose value is a collection | the planner |
| `NestedRemovalWouldDiscardUnshownStructure { target, found }` | a `Remove` over such an entry: expressible, refused by decision | the planner |
| `NestedItemRemoval { target }` | deleting an element of a nested sequence — a cardinality change | the planner |
| `TargetDraftedTwice { target, first, second }` | two intents at one index of any nested list, caught **before diffing** | the planner, five ways |
| `AmbiguousNestedKey { edit }` | a key a **nested** mapping writes more than once, stated over a batch | the guard |

Three shared with 2b-2b-1 and now reached at nested depths too: `NotAScalar`, `NotDecodable` and
`TargetOwnsNoBytes`, each because `DraftTarget` grew the addresses to name them.

### 6.1 The four that are unreachable, and why that is honest rather than convenient

`disqualifying_hazard` refuses a match when the flagged node is the match, an **ancestor** of it or
a **descendant** of it. A duplicate key or a complex key inside a variable's `params` is a
descendant, so the whole match is refused before the planner sees the draft. The two refusals about
those shapes are therefore **defence in depth**: they exist so that a future phase that narrows the
gate, or a caller that hands the planner a view it assembled itself, does not get a path that names
the wrong node. Their tests project the real fixture, assert the hazard the gate actually raises,
and then clear it — which is the only honest way to reach the branch, and is 2b-2b-1's own
technique for `NotDecodable`.

`VariableHasNoPath` and the nested `NotDecodable` are unreachable for the projection's own reasons,
and are forced the same way.

---

## 7. The two batch guards

### 7.1 `check_no_scalar_is_edited_twice` and `check_no_removal_contains_another_edit` — unchanged

Both are path-prefix based and depth-agnostic, and reading them established that rather than
assuming it. `a_removal_in_an_outer_mapping_containing_a_nested_edit_is_caught` is the test: a
removal at `…params.values` and a scalar edit at `…params.values[1]` is one conflict, and the
existing code names it.

**The invariant underneath is now written down where the check lives**, because it is load-bearing
and was unwritten. Containment is decided by segment-wise **path** prefix and stands in for
containment of **bytes**. The two agree only because a `DocumentPath` addresses concrete syntax
nodes of one immutable parse and follows no semantic indirection: the resolver walks a mapping's own
children and a sequence's own children, and never expands an alias or a merge key (`ValueView::Alias`
is projected unfollowed, and D4 refuses any draft naming one). If a path could traverse an alias, a
semantic descendant could sit **outside** the removed byte span and the two notions would disagree.
Since this phase a batch mixes depths freely, so the invariant carries more weight than it did when
every path was two segments long. The one harmless disagreement is trivia: a removal's envelope
swallows comments and blank runs that no path names, which is `FieldRemoval`'s own contract rather
than a batch dependency.

### 7.2 `check_closed_surface` — widened, and widening it is half the safety of this phase

`MatchDraft` gaining `vars` without `check_closed_surface` gaining it produces a batch that
**refuses itself**. That is the failure mode this arrangement is designed to have
(`2b-2b-1-notes.md` §11), it is what happened first, and the fix was to widen the guard rather than
to loosen it. §2 is the result.

### 7.3 `check_every_named_key_is_unique` — restated per parent mapping

The flat version reduced an edit to *the key it names directly inside the match mapping* and looked
that key up in one list. It is now stated at **every** depth, because ambiguity is true at every
depth.

**The decomposition, and why it is this one.** Each edit is reduced to *the mapping it names a key
inside, and that key* — trailing index segments stripped first, so `…params.values[2]` and
`…params.values` reduce to the same pair, which is right, because they are the same entry seen
through two paths. The pair is then looked up in the one key list that describes that mapping:
`original_keys` for the match's own, and the new `nested: &[NestedKeys]` for anything below it.
Grouping by parent path is the only decomposition that stays true to what ambiguity *is* — a fact
about one mapping's own entries — and it needs no traversal of the batch's shape.

**The list handed to each group is the whole mapping's keys, in source order and with
repetitions** — not the keys the batch happens to name. That distinction is the trap, and it is
tested as one: `params` written `format`, `offset`, `format`, with a batch naming `format`, is
refused; the same list with a batch naming `offset` is admitted. A check that only looked at the
keys the batch mentions would pass the first case, and the engine would rewrite the **first**
`format` while the caller believed it had edited the third — because `crate::patch::path::resolve`
resolves a key to the first entry that carries it. The planner's own `nameable_key` refuses the same
class at intent level, over the whole mapping, for the same reason.

The refusals differ because their payloads must: a repeated key of the match mapping may be one
espanso's schema fixes, so `AmbiguousKey` can name it; a repeated key of an open mapping is the
owner's own text, so `AmbiguousNestedKey` carries a position in the batch and nothing else.

A mapping the caller described nothing about is **not judged**
(`a_nested_mapping_with_no_key_list_is_not_judged`). This module reads paths and never documents, so
it has nothing to judge it against, and inventing a claim would be worse than declining to make one.

`check_batch_independence` therefore takes a fourth argument. Every existing call site passes `&[]`
and means exactly what it meant before.

---

## 8. The headline property, over both corpora

**Every match, drafted with every in-scope `vars` and `form_fields` value `Set` to the value the
file already holds, derives an empty batch.** Counts, file names and refusal codes only
(`CLAUDE.md` §1).

| Sweep | Result |
|---|---|
| `every_match_of_the_synthetic_corpus_drafts_to_an_empty_batch_or_a_named_refusal` | 33 files, 150 matches, **139 planned to an empty batch**, 369 intents drafted; open half: 14 variables, 20 `params` entries, 3 form fields, 5 options; refusals `MatchNotEditable` ×9, `AmbiguousKey` ×2 |
| `every_match_of_the_real_configuration_drafts_to_an_empty_batch_or_a_named_refusal` | 13 files, 65 matches, **65 planned to an empty batch**, 417 intents drafted; open half: 38 variables, 48 `params` entries, **0 form fields, 0 options**; **zero refusals** |

The intent counts rose from 315 and 303 — the open half contributed 54 synthetic and **114 real**
intents that nothing had drafted before.

Both sweeps assert they had something to look at: `planned > 0`, `intents > 0`, and now
`variables > 0` and `params > 0` as well, because a zero is worth nothing if the sweep reached no
open mapping (R24). The synthetic twin additionally asserts `form_fields > 0`, which the real one
cannot — see §10 hole 2.

The real sweep **skips cleanly** without the gitignored corpus and honours
`ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1` to fail instead. Both were checked by moving the corpus aside
and putting it back (§11).

There is an inline twin as well —
`every_open_key_set_to_its_own_projected_value_derives_an_empty_batch_and_moves_no_byte` — on a
fixture holding two variables, three `params` entries, two `form_fields` entries and four options
across four scalar styles. Its empty batch is then run through `apply_edits` and the document must
come back byte-identical with no presentation note. Three assertions keep it from going vacuous if
the fixture is edited: the variable and form-field counts, the presence of more than one scalar
style among the parameters, and the exact intent count.

---

## 9. The one change in `src-tauri/`

`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` found `VariableField`
immediately, which is the check working. It is a **permanent** exclusion with the same reason as
`MatchField` and `SequenceField`: it names an espanso key, it serializes as that key (`inject_vars`,
not `InjectVars`), and `every_variable_field_serializes_as_its_espanso_key` pins the spelling
variant by variant against `key()`.

`DraftTarget`'s justification was **rewritten rather than left alone**, because its old wording said
"both things it can name are rendered literally" and there are now nine. The new wording says every
operand is a schema key or an index, *deliberately, because an author-chosen key's text is the
owner's private configuration* — which is D2 stated where the exclusion is claimed.

**`DraftError`'s temporary entry was not touched.** It expires in 2b-2b-3, when something names the
type; `the_temporary_draft_error_exclusion_expires_when_anything_names_it` still guards it and still
passes, because nothing in any production module of `src-tauri/` or in `types.ts` names `DraftError`.

---

## 10. Holes this phase leaves open

1. **A draft can never change a value's YAML *type* while leaving its text alone.** `decode()` maps
   a quoted `'true'` and a plain `true` to the same string `"true"`, so `scalar.text == value` calls
   them equal and no edit is derived. For `params` that is semantically real: espanso may treat
   `multiline: true` and `multiline: 'true'` differently, and this engine cannot express the change
   from one to the other. Combined with D2u — the UI shows a scalar's source text and never an
   inferred type — **neither the engine nor the interface can express it today**. The fix is not in
   the draft engine: it needs the read model to carry a value's *spelling* alongside its logical
   value, or a second, explicitly source-text-valued draft field. **This hole is addressed to the
   owner of the read model** (`ScalarView` in
   `crates/espansoconfig-core/src/model/scalar.rs`), and was deliberately not papered over here by
   writing a second comparison — 2b-2b-1 §11 is explicit that a second comparison is a second answer
   to a question that has one.

   **Two spellings that *are* distinguished, so they do not belong in this hole:** plain `null`
   decodes to the string `"null"`, and an entry written `key:` has a zero-width value whose text is
   `""`. A `Set` of `""` over `null` derives an edit, and a `Set` of anything over the empty one is
   refused by `TargetOwnsNoBytes`.

2. **The real configuration holds *no* `form_fields` at all — 0 entries, 0 options.** Every claim
   this phase makes about `form_fields` rests on synthetic fixtures and will keep doing so unless the
   owner's configuration changes. This is the same permanent shape as
   `1c-2b-2b-2-notes.md`'s finding about unmodelled entries, and it is recorded rather than smoothed
   over: 48 real `params` entries were swept and zero real form-field options were.

3. **A `params` mapping nested two levels deep is outside the surface.** A `type: form` variable
   writes `params.fields.<name>.<option>`, which is one segment past
   `<match>.vars[i].params.<key>`, and `a_path_one_segment_deeper_than_the_surface_is_refused` pins
   that it is refused. Those options are projected, and this phase cannot draft them. Widening to
   them means either an unbounded recursive address or one more explicit shape, and neither was
   chosen without a screen asking for it.

4. **A `form_fields` entry cannot be removed, and neither can a variable.** The first is a
   collection node, refused by the shape rules; the second is a change to a sequence's cardinality,
   which no primitive expresses. Both are honest refusals of real limits, and both are friction a
   user would feel through a form.

5. **`plan_removal` still refuses the last entry of a mapping, and this planner still does not
   pre-check it** — 2b-2b-1 hole 4, inherited and now reachable one level deeper: a draft removing
   the only entry a `params` mapping has is refused by the patch engine with an `EditError` where
   every other refusal on this path is a `DraftError`.

6. **`visible_entries` still cannot see `vars` or `form_fields`**, so a match whose last entry is one
   of those two anchors a new key *before* it (2b-2b-1 §6). That was deliberately left alone: this
   phase never inserts, so the only thing it would change is where an unrelated match-level
   insertion lands, and changing that is a behaviour change with no test asking for it.

7. **Nothing here has met a user's real match through a screen.** Both corpora are swept, and a
   corpus sweep is not a window. Whether these are the fields a form would offer is 2b-2b-3's
   question.

---

## 11. What 2b-2b-3 and 2b-2c inherit

- **Positional addressing makes the `base_revision` binding load-bearing in a way key-addressing was
  not.** A stale *key* names a missing entry and refuses; a stale *index* names a **different**
  entry and succeeds. What makes it safe is the optimistic-concurrency check already inside
  `persist::save_document`, taken **under the per-path lock**: the projection the draft was built
  against, the spans the batch names and the bytes the transaction writes must all be the same file.
  2b-2b-3 must not skip it, must not widen it, and must not plan a draft against one projection and
  save it against another.
- **The equality rule is still one line of code**, and §10 hole 1 is the one thing it cannot say.
- **The surface is closed by a type and by a guard, and widening it means widening both.** That is
  now demonstrated rather than predicted: adding `vars` to `MatchDraft` without adding it to
  `check_closed_surface` produced a batch that refused itself.
- **A later sequence-cardinality phase (2b-2c) must *undo* rules, not extend them.** Adding
  sequence-item insert and remove has to reverse D3's "edit existing elements only", D4's refusal to
  add or remove a variable, and any closed-surface rule that admits only scalar edits at item
  paths — that rule has to become **operation-sensitive**, because an insert target and an edit
  target are different claims about the same path shape. Index shifting also creates batch
  dependencies the current guards do not model: two removals, an insertion plus an edit, a move plus
  a removal. Those need original-snapshot coordinates, a deterministic application order and
  collision rules of their own.

  **D1's ban on author-chosen mapping keys does not need undoing**, and 2b-2c should not take it as
  licence: sequence insertion does not authorise mapping-key synthesis, and collection-entry removal
  is a separate question from sequence-item removal.
- **`DraftError` is still on `NOT_A_CODE` with an enforced expiry.** The sub-phase that gives
  `plan_match_edits` a command deletes the entry and pays both dictionaries in the same change; the
  taxonomy it owes strings for is now **thirty-one** variants, not twenty.

---

## 12. Verification

All run at the repository root.

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **913 passed, 0 failed**, 21 binaries (882 before) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `cargo test -p espansoconfig-core --test corpus_integrity` | exit 0 — 17 passed |
| `npm run check` | exit 0 — 375 files, 0 errors, 0 warnings |
| `npm test` | exit 0 — 685 passed, 28 files (unchanged) |
| `npm run build` | exit 0 |
| `#[tauri::command]` count | **7** in `commands.rs`, **1** in `menu.rs` — unchanged |
| `git status --short --untracked-files=all` | no real-corpus path |

All 31 new tests are in `crates/espansoconfig-core/tests/draft_plan.rs`, which now holds 82. Every
**fixture** is inline, hand-authored and neutral; the two corpus sweeps read files and report counts,
file names and refusal codes only.

Two things were checked by making them fail on purpose and putting them back:

| Made to fail | What was seen |
|---|---|
| the real corpus moved aside | the sweep printed its `SKIP` line and passed |
| the same, with `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1` | the sweep failed, pointing at `./scripts/sync-real-corpus.sh` |

and one was seen to fail on its own, which is the point of §7.2: adding `vars` and `form_fields` to
`MatchDraft` before widening `check_closed_surface` made
`the_closed_surface_guard_refuses_an_edit_that_touches_vars_or_form_fields` fail, exactly as
`2b-2b-1-notes.md` §11 predicted it would.

---

## 13. The design consult

`docs/reviews/phase-2b-2b-2-open-key-design.md` — Codex, on the six questions this phase's design
raised. It endorsed D1 to D6 and returned five items, all folded into the work rather than
retrofitted:

| Item | Where it landed |
|---|---|
| the nested duplicate-key list must be the **whole** mapping, not the edited keys | §7.3, and `the_guard_refuses_a_nested_key_the_mapping_writes_twice` with the duplicate at an index the batch does not name |
| the prefix-containment invariant is load-bearing and unwritten | §7.1, stated in `check_no_removal_contains_another_edit`'s own doc comment |
| the decoded-value rule cannot express a type change | §10 hole 1, addressed to the read model, with the `null`/empty distinction excluded from it |
| positional addressing makes `base_revision` load-bearing | §11, for 2b-2b-3 |
| a sequence-cardinality phase must undo rules rather than extend them | §11, for 2b-2c |

One point of the consult was **not** taken: it argues that `params` should compare **source text**
rather than decoded value, so that `yes` and `true` are distinct. Taking it would put a second
comparison in this module, which `2b-2b-1-notes.md` §11 names as a second answer to a question that
has one, and it would make the identity sweep's meaning differ between the closed half and the open
half of the same match. The limitation is real, so it is recorded as §10 hole 1 and addressed to the
layer that can actually fix it — the read model — rather than worked around here.
