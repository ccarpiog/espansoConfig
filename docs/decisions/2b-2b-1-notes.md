# Phase 2b-2b-1 — the draft, and the batch it refuses to grow

The sub-phase that turns *what the user wants this match to say* into the **smallest** edit
batch that says it. One type, one function, two guards, no caller: no `#[tauri::command]`
reaches any of it and no screen shows it, which is 1b-1's and 2b-1's shape repeated on purpose.

---

## 1. What was built

| Piece | Where |
|---|---|
| `DraftField<T>` — the tri-state, and its `Default` | `crates/espansoconfig-core/src/draft/field.rs` |
| `MatchDraft`, `ItemDraft`, `MatchField`, `SequenceField`, `DraftTarget` | `crates/espansoconfig-core/src/draft/match_draft.rs` |
| `DraftError` — twenty named refusals, `Serialize` only | `crates/espansoconfig-core/src/draft/error.rs` |
| `plan_match_edits` — the minimal-diff engine | `crates/espansoconfig-core/src/draft/plan.rs` |
| `check_closed_surface`, `check_batch_independence` — the two guards | `crates/espansoconfig-core/src/draft/audit.rs` |
| 51 acceptance tests, two of them corpus sweeps | `crates/espansoconfig-core/tests/draft_plan.rs` |
| Five `NOT_A_CODE` entries, one of them temporary **with an enforced expiry** | `src-tauri/src/dictionary_contract.rs` |
| `mentions_identifier`, `modules_not_gated_by_cfg_test` — the expiry's scanners | `src-tauri/src/rust_source.rs` |

Registered commands: **7** in `commands.rs` and **1** in `menu.rs` — unchanged. The only things
touched in `src-tauri/` are the exclusion table §9 explains, the test that gives its temporary
entry an expiry (§9.1), and the two scanners in `rust_source.rs` that test needed. No command,
no IPC type, no i18n key and no frontend change.

---

## 2. The tri-state, and the failure mode it avoids

`DraftField<T>` is an explicit, externally tagged `{ Unchanged, Set(T), Remove }`. The two
alternatives were considered and both lose:

- **`Option<Option<T>>`** spells all three states and is the dangerous one. `undefined`, a
  missing key and `null` are routinely collapsed into one another by TypeScript types, form
  libraries, serializers and generated clients, and the value they collapse to is `Some(None)`
  — a **removal**. A field the user never touched would delete itself on a boundary nobody
  looks at.
- **A `touched_fields` list** puts the values and the touch metadata in different places, so a
  misspelling, a stale name, a duplicate or a "touched" with no matching value produces the
  wrong edit with nothing to catch it.

The enum fails the other way, and that is the whole argument for it: a casing slip or a `null`
where a tag belongs is a **deserialization error**, not an unintended mutation. Refusing to
read a malformed draft is the desirable failure;
`a_null_draft_field_is_a_deserialization_error_and_never_a_removal` is the test that says so.

Two decisions travel with it. **Omission means `Unchanged`** — every field carries
`#[serde(default)]`, so a partial draft is legal and means what it looks like; absence is the
one collapse that is safe, because it collapses towards doing nothing. And **an unknown field
is an error**: `MatchDraft` is `deny_unknown_fields`, so a typo, a stale field name or a `vars`
the caller hoped would work is a refusal rather than silence.

---

## 3. The equality rule, and why the tempting wrong test is wrong

**A field is unchanged when the drafted logical value equals the existing scalar's decoded
logical value. Nothing else is the test.**

Two comparisons are tempting and both are wrong:

- **against the source text.** A file may validly hold `'hello'` where the draft says `hello`.
  Those are one value written two ways, and calling them different rewrites quoting the user
  chose.
- **against what the codec would re-emit.** `choose_scalar` may canonically render `"hello"`
  for a value the file spells `'hello'`, so `codec_emit(draft) != source_text` is true for a
  field nobody touched. This is the cheaper mistake to make, because the codec already exists
  and the comparison is a one-liner — and it is **precisely the preservation bug this
  sub-phase exists to prevent**. It compares representations, not values.

`ScalarView::text` is already a logical value: `crate::emit::decode`'s output, with escapes
resolved and a block scalar de-indented, folded and chomped. So the comparison is one `==`
between two `String`s, and the interesting answer is *no edit*.

The headline test is
`every_field_set_to_its_own_projected_value_derives_an_empty_batch_and_moves_no_byte`. A match
holding **all eighteen** schema-known scalar fields, written across all five scalar styles —
plain, single-quoted, double-quoted with escapes, literal block and folded block — is drafted
with every field and every sequence element `Set` to its own currently-projected value. The
derived batch must be **empty**; the empty batch is then run through `apply_edits`, and the
document must come back byte-identical with zero `PresentationNote`s.

Three assertions keep that test from going vacuous if the fixture is ever edited: all five
styles must be present, all eighteen fields must be present, and **no two fields may decode to
the same string** — otherwise a planner that read one field's value while writing another
field's path would still derive nothing.

### 3.1 The same property, over both corpora

One inline fixture is a shape its author thought of. The review round added the sweep the
project's own standard asks for (`PROGRESS.md`, Phase 0's exit criterion; the pattern is
`saving_the_real_configuration_is_refused_by_neither_gate` in `tests/persist_save.rs`): **every
match of a corpus is drafted with each in-scope field set to its own projected logical value,
and the derived batch must be empty.**

| Sweep | Result |
|---|---|
| `every_match_of_the_synthetic_corpus_drafts_to_an_empty_batch_or_a_named_refusal` | 33 files, 150 matches, **139 planned to an empty batch**, 315 intents drafted; refusals `MatchNotEditable` ×9, `AmbiguousKey` ×2 |
| `every_match_of_the_real_configuration_drafts_to_an_empty_batch_or_a_named_refusal` | 13 files, 65 matches, **65 planned to an empty batch**, 303 intents drafted; **zero refusals** |

An identity draft asks for no insertion, no removal, no new element and no element the
projection elided, so most of the taxonomy is unreachable by construction; the sweep pins the
four that are not (`MatchHasNoPath`, `MatchNotEditable`, `AmbiguousKey`, `NotDecodable`) and
**fails on any other refusal** rather than counting it. It also asserts it drafted something —
a zero is worth nothing if the sweep had nothing to look at (R24).

The real sweep **skips cleanly** without the gitignored corpus and honours
`ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1` to fail instead. Counts, file names and refusal codes
only: `DraftError` carries no byte of a document by construction (§5), and the sweep prints the
tag alone even so (`CLAUDE.md` §1).

---

## 4. The boundary, stated three times

> This engine may modify or remove existing addressable nodes, and may insert **scalar-valued**
> mapping entries. It may **never change a sequence's cardinality** and **never synthesize a
> collection node**.

It is stated three times, and only one of the three is a sentence:

1. in **`MatchDraft`**, which carries `String`s — so a destination that *needs* a collection
   cannot be expressed at all. The type is the refusal;
2. in **`plan_match_edits`**, which refuses an element `triggers` does not have and refuses to
   take one away;
3. in **`check_closed_surface`**, which reads the derived batch back and refuses any edit
   naming something else (`PROGRESS.md` R24, the same shape as `patch::edit::StructuralGuard`),
   and it is public so that a test can hand it a batch the planner would never build.

The test name carries the invariant:
`a_drafted_batch_never_changes_sequence_cardinality_and_never_synthesizes_a_collection`.

**What the third statement is, and what it is not** — the review's finding 4, and it was right.
The guards are a **closed-surface check and a batch-dependency check over a derived batch**, not
an independent validation of the planner's intent, and the earlier claim that they were "a second
statement in terms a defect in the planner cannot bend" overstated all three words:

- they read **paths, never nodes**. Nothing in `audit.rs` consults the document, so a hand-built
  scalar edit naming `triggers[999]` — an element no sequence has — passes both. Only
  `apply_edits` can answer that, and it does;
- they share the planner's **vocabulary**: `MatchField::from_key` and `SequenceField::from_key`
  decide what "inside the surface" means for both sides, so a defect in that vocabulary is not a
  defect these guards can see;
- they know nothing about **how many intents produced the batch**, which is exactly why the
  duplicate-index check had to move to intent level (§4.1).

What they do establish is worth having and is exactly this: *every edit of the batch names
something inside one match's closed scalar surface, and no edit of the batch depends on another
edit of the batch.* `audit.rs`'s module documentation now says that and no more.

### 4.1 Ruling 4, narrowed: **neither** direction of a shape change is available here

The earlier wording said deleting an existing collection and writing a scalar in its place is
*expressible*. **It is not**, and the review's finding 2 is why. Two separate facts:

- **A `Set` over a collection-valued key cannot be expressed at all.** No primitive replaces a
  collection node with a scalar one, and *remove then insert* is not a spelling of it: an
  insertion is planned against the **original** index, where the key is still present, so the
  insertion is refused as a duplicate key. `FieldHasAnUnmodelledShape` is that refusal, and its
  documentation now says this rather than the opposite.
- **A `Remove` over such a key *is* expressible** — `FieldRemoval` deletes a whole entry, subtree
  included — **and this phase refuses it anyway. That is a decision, and it is recorded as one.**

**Decision (2b-2b-1 review round): keep the refusal, and name it for its reason.** Removing a
`replace:` that holds a nested mapping discards bytes the visual editor never displayed to the
user. Deleting what was never shown is the class of silent destruction this application refuses
on principle, and a sub-phase whose entire purpose is conservatism is the wrong place to grant
that power. The review's suggested widening — allow `Remove` whenever the known key exists — is
therefore **not taken**.

So the refusal stopped being an accident of shape-checking and became its own variant:
`RemovalWouldDiscardUnshownStructure { field, found }`, whose name states the reason and whose
documentation says plainly that the primitive *could* do it. It is not permanent: a phase that
shows such a subtree, or that asks for the power by name, may grant it. This one does not.

**It is reachable, and a test says so rather than an argument.**
`a_known_key_holding_a_collection_reaches_the_planner_at_all` asserts that such a match is
`safely_editable`, carries no `blocking_hazard` and has a path — so the hazard gate does *not*
refuse it first and both refusals below are decisions this planner takes rather than shapes it
never meets. The two are then pinned separately by
`setting_a_field_whose_existing_value_is_a_collection_is_refused_as_unmodelled` and
`removing_a_field_whose_value_was_never_displayed_is_refused_as_a_decision`.

Editing an existing element of `triggers` or `search_terms` is in scope for the original
structural reason, unchanged: it is a scalar-node replacement at a position that already exists,
not a sequence mutation.

---

## 5. The refusal taxonomy

Twenty variants — eighteen, plus the two the review round added. Every one has a test, and every
one is reachable — a refusal no test can reach is a sentence rather than a rule.

| Refusal | What it catches | Reached through |
|---|---|---|
| `MatchHasNoPath` | a match nothing can address | the planner |
| `MatchNotEditable { hazard }` | the hazard gate says no, with or without a named hazard | the planner, twice |
| `AmbiguousKey { field }` | the mapping writes one key twice, so no path names one node | the planner **and** the guard |
| `NotDecodable { target }` | `ScalarView::decoded == false` — its `text` is a raw source slice | the planner |
| `NotAScalar { target }` | a sequence element the file writes as a collection | the planner |
| `FieldHasAnUnmodelledShape { field, found }` | a `Set` over a key that exists with a shape the schema does not use | the planner |
| `RemovalWouldDiscardUnshownStructure { field, found }` | a `Remove` over such a key: expressible, refused by decision (§4.1) | the planner |
| `TargetOwnsNoBytes { target }` | an entry written `label:`, whose value node is zero width | the planner |
| `SequenceItemDoesNotExist { … }` | adding an element — a cardinality change | the planner |
| `SequenceItemRemoval { … }` | deleting an element — a cardinality change | the planner |
| `SequenceItemDraftedTwice { … }` | two intents about one element, caught **before diffing** (§5.3) | the planner |
| `NoInsertionAnchor { field }` | no original sibling to write a new entry after | the planner |
| `InsertionAnchorRemoved { edit }` | hazard 1: the anchor is removed by the same batch | the planner **and** the guard |
| `InsertionAnchorIsInserted { edit }` | hazard 2: the anchor is inserted by the same batch | the guard |
| `InsertionAnchorNotInOriginal { edit }` | the anchor is not in the original mapping at all | the guard |
| `RemovalContainsAnEdit { … }` | hazard 3: a removal whose subtree holds another edit | the guard |
| `ScalarEditedTwice { … }` | hazard 4: one scalar named twice **in a batch** | the guard (§5.3) |
| `SharedInsertionAnchor { … }` | hazard 6: two insertions at one offset, with no order between them | the planner |
| `OutsideTheClosedSurface { edit }` | `vars`, `form_fields`, another match, a new sequence item | the guard |
| `MoveIsNotADraftEdit { edit }` | R25: a drafted batch never moves anything | the guard |

**No variant carries a byte of the document.** A `MatchField` is a key espanso's schema fixes
and is safe to name; the text of a key the schema does not fix, and the text of any value, is
the owner's private configuration (`CLAUDE.md` §1) and is deliberately absent even where it
would make a message friendlier — which is why `AmbiguousKey`'s `field` is an `Option` and
`None` means *the repeated key is one this surface does not model*.

`DraftError` **serializes and does not deserialize**. A refusal travels out; nothing hands one
back. `HazardKind` is the same, so the two agree.

### 5.1 Two orderings that are decisions, not accidents

**The ambiguity check runs before the hazard gate.** A duplicate key raises
`HazardKind::DuplicateMappingKey`, so the gate would refuse the same mapping a step later; the
ordering therefore decides the *name* of the refusal rather than whether there is one, and the
specific name is the useful one. The justification is that this function's entire output is
paths, and a path that names two nodes is not a path.

**The preconditions are about the match, not about the batch.** A draft that would change
nothing is still refused for a match that cannot be edited, because the answer to *may I edit
this match* is no whatever is asked of it
(`an_empty_draft_is_still_refused_for_a_match_that_cannot_be_edited`).

### 5.2 The three answers nobody had written down

- **`Remove` on a field that is already absent ⇒ no edit.** The desired state is the actual
  state.
- **`Set` on an absent field ⇒ exactly one `InsertField`.**
- **`Set` to the value already there ⇒ no edit.** §3's rule, applied.

### 5.3 Duplicate intents are refused **at intent level**, not by auditing the batch

The review's finding 1, and it was a real hole. With `triggers[0]` holding `:one`, a draft
carrying `Set(":one")` and then `Set(":changed")` at index 0 used to plan **successfully**: the
first intent was erased as a logical no-op — correctly, §5.2 — the second produced one edit, and
both guards saw a batch of one edit that named one node. Nothing was left for
`ScalarEditedTwice` to catch, and draft order had silently become *last effective value wins*,
which is exactly what `MatchField::ALL`'s own note forbids.

**The fix cannot be an audit.** By the time there is a batch, the erased intent is gone, and a
batch of one edit is indistinguishable from a draft that only ever said one thing. So
`plan_match_edits` now runs `check_no_index_is_drafted_twice` as **step 4, before any diffing**:
each sequence's drafted elements are scanned for two non-`Unchanged` intents naming one index,
and the refusal is `SequenceItemDraftedTwice { field, index, first, second }`, whose positions
index the **draft's own list** because there is no batch when it fires. An `Unchanged` element is
not an intent and is skipped — repeating one asks for nothing twice.

Two consequences worth writing down:

- **`ScalarEditedTwice` is now guard-only.** The planner cannot produce it: two schema-known
  fields name two keys, and two intents about one element are refused earlier and by a better
  name. The guard keeps it because a later phase may hand it a batch it did not derive
  (`the_guard_refuses_two_scalar_edits_naming_one_node`).
- **The same class is closed for `MatchField` by the type**, so no check was needed there:
  `MatchDraft` has one struct field per key, and `serde` refuses a JSON object that writes one of
  them twice rather than keeping the last
  (`a_field_written_twice_in_the_json_is_a_deserialization_error_and_never_last_wins`).

The test whose name is the point is
`a_no_op_intent_followed_by_a_real_one_at_one_index_is_refused_not_silently_resolved`: it first
asserts that the no-op intent *alone* derives nothing — which is what made it invisible — and
then that the pair is refused.

---

## 6. Where an insertion goes, and why two of them refuse

Every insertion is written after an **anchor entry** (`FieldInsert`'s own contract; inserting
before the first entry has no line to insert before). This planner picks the anchor itself:
**the last entry of the match mapping it can see**, by byte offset, whose key a path segment
can name — and it names that anchor **explicitly**, so `plan_insertion` resolves the same entry
this module chose rather than re-deriving "last" from a mapping this module cannot fully see.

Ruling 5 requires an anchor to be a unique original sibling **unaffected by the batch**, and
two consequences follow that a caller will feel:

- **A draft that removes the last visible entry and adds a field is refused**
  (`InsertionAnchorRemoved`). Re-anchoring would silently write the new key somewhere the
  caller cannot predict from the document it is looking at; refusing is the conservative
  answer, and a caller that wants both changes saves twice.
- **A draft that adds two absent fields is refused** (`SharedInsertionAnchor`). This one is not
  a policy choice: both insertions are zero-width replacements at one offset, and `apply_edits`
  refuses two replacements that share a start outright. There is no spelling of "two new keys"
  in the current primitives — chaining the second anchor onto the first would name a key that
  is not in the original index, which is hazard 2.
  `the_patch_engine_also_refuses_two_insertions_at_one_point` pins that the engine underneath
  agrees, so the draft's refusal is a better name for an existing limit rather than a new one.

**"Can see" is a real limit.** `vars` and `form_fields` are projected as their own structures
and carry no key span here, so a match whose last entry is one of those two is anchored
*before* it. That changes where a new key lands and nothing else: the entry itself is never
named, never moved and never rewritten.

---

## 7. What this phase deliberately does not do

- **It writes nothing.** No `force` flag, no acknowledgement, no path to a file. It produces a
  `Vec<DocumentEdit>` and stops. `persist::save_document` remains the only entry point in this
  crate that may write a user's file, and this module does not call it.
- **It has no caller.** No command, no IPC type, no i18n key, no frontend change. The
  dictionary entries `DraftError` will owe belong to the sub-phase that puts it on a screen —
  §9.1 is the test that makes that debt fail the build rather than a note that hopes about it.
- **It does not touch `vars` or `form_fields`.** Their keys are the author's rather than the
  schema's and their values may be collections. 2b-2b-2's problem, deliberately.
- **It does not add or delete a sequence element**, nor create a match, nor delete one. Those
  need primitives `DocumentEdit` does not have (2b-2c).
- **It does not present a plain scalar's type** (D2u, R16's open half). A drafted value is a
  string in and a string out; nothing here infers `true` from `on`.
- **It never combines a move with anything** (R25), and `check_closed_surface` refuses a batch
  holding one at all.

---

## 8. Holes this phase leaves open

1. **`DraftError` is on `NOT_A_CODE` rather than in a dictionary.** It is the only temporary
   entry in that table, and the entry says so by name (§9). Its removal is now **enforced by a
   test** rather than by a sentence — see §9.1 for the guard and for what it does not cover.
2. **A draft that *removes the anchor* and adds a field is refused, and so is a draft that adds
   two** (§6). The first is about the anchor, not about remove-plus-add as such: the anchor is
   the mapping's **last visible entry**, so removing `trigger` while inserting `word` after an
   untouched `label` is **accepted** and lands one removal and one insertion. What is refused is
   a removal that takes the anchor away (`InsertionAnchorRemoved`) — the earlier wording here
   said "a draft that both removes a field and adds one", which is false in general and was the
   review's finding 7. Both remaining refusals are honest refusals of a real limit in the
   primitives, and both are friction a user would feel through a form. 2b-2b-2 or 2b-2c has to
   decide whether to split such a save into two transactions or to add a primitive.
3. **The insertion anchor is the mapping's last visible entry, so a new key lands at the end.**
   No canonical espanso key order is invented, because inventing one is a claim about how a
   user's file should read. A form that adds `word` to a match therefore writes it after
   `label`, not next to the other options.
4. **`plan_removal` refuses the last entry of a mapping (`LastEntryOfMapping`), and this
   planner does not pre-check it.** A draft that removes the only entry a match has is refused
   by the patch engine rather than by the draft, so the caller sees an `EditError` where every
   other refusal on this path is a `DraftError`. The planner cannot count the mapping's entries
   reliably — it can only see the ones the projection names — so a pre-check would be a guess.
5. **Two duplicate keys the projection does not model are refused by the gate, not by
   `AmbiguousKey`.** `UnknownReason::RepeatedKey` is only recorded for a key the projection
   models, so `foo:` written twice falls through to `HazardKind::DuplicateMappingKey`. The
   match is refused either way; only the name differs.
6. **The `NotDecodable` state is reached in its test by setting the flag the projection sets.**
   No document in either corpus produces `decoded == false` — the corpus tests pin that count
   at zero — so the only honest way to test the refusal is to construct the view state. The
   refusal itself is real: it is what stops a raw source slice being compared as a logical
   value.
7. **Nothing here has met a user's real match through a screen.** The real corpus *is* now
   exercised (§3.1) — 65 matches, all planning to an empty batch — but a corpus sweep is not a
   window. Whether the eighteen fields are the eighteen a form would offer is a question 2b-2b-2
   answers.
8. **The batch's order is `MatchField::ALL` order, and nothing depends on it.** `apply_edits`
   plans against the original index and splices from the highest offset downwards, so a batch
   means the same whatever order it arrives in. Draft field order must not imply edit
   sequencing — and since §5.3 it is not merely undepended-on but **refused** when two intents
   name one element.
9. **An empty but present sequence is invisible as an insertion anchor.** `triggers: []` is an
   original, decoded, addressable sibling that a new key could be written after, and
   `visible_entries` cannot see it: a sequence's only offset in `MatchView` is its **first
   element's**, and an empty sequence has none. A match whose only entries are empty sequences
   therefore yields `NoInsertionAnchor` for an insertion that ought to work
   (`an_empty_sequence_is_invisible_as_an_insertion_anchor` pins it, so the limit is observed
   rather than assumed).

   **The sharper half of the review's finding 3 is the ambiguity underneath it: an empty
   `Vec<ValueView>` cannot distinguish *absent* from *present but empty*** — most visibly for
   `search_terms`, where the two mean different things to a form. No amount of care in the draft
   engine recovers information the projection did not carry.

   **This hole is addressed to the owner of the read model** — `MatchView` in
   `crates/espansoconfig-core/src/model/match_view.rs`, Phase 1a's — and **not** to the draft
   engine. The fix is to carry the sequence entry's own span and its presence, which is a change
   to the read model and out of 2b-2b-1's scope; it was deliberately not made here (the review's
   suggested fix was ruled out of scope for this sub-phase rather than rejected on its merits).

---

## 9. The changes in `src-tauri/`

`dictionary_contract.rs`'s `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`
found all five new enums immediately, which is the check working. Four of them are permanent
exclusions with real reasons:

- **`DraftField`** — a protocol tag, not a code. It travels *into* the core and is never
  rendered; the value inside a `Set` is what a screen shows.
- **`MatchField`** and **`SequenceField`** — field identifiers naming espanso keys, which are
  spelled one way in every language — **and which now spell that key on the wire too**. See
  §9.2: the justification was false when it was written.
- **`DraftTarget`** — an address, exactly as `PathSegment` is: both things it can name are
  rendered literally, and §9.2 is what makes the nested spellings stable enough for that to
  hold.

**`DraftError` is the temporary one**, and its entry says so in capitals, names the sub-phase
that must delete it and names what that sub-phase owes instead: a `draftError` namespace in
both `en.json` and `es.json`, landed in the same change as the command, exactly as 2b-1 did for
the save transaction. A code with no string is worse than a code with no caller.

### 9.1 The temporary exclusion has an expiry the build enforces

The review's finding 5: a `NOT_A_CODE` entry makes the exhaustiveness test **pass**, so a later
sub-phase that serializes a `DraftError` from a command and forgets to delete the entry ships a
code with no sentence — it reaches a screen with nothing to render and no test fails. A note in
a decision record is not a mechanism.

`the_temporary_draft_error_exclusion_expires_when_anything_names_it` in `dictionary_contract.rs`
is the mechanism. While the entry is present, it fails if **any production module of
`src-tauri/`, or `src/lib/ipc/types.ts`, names `DraftError` at all**, and its failure message
says what to do: delete the entry and add the `draftError` namespace to both `en.json` and
`es.json` in the same change. When the entry is gone the test returns immediately — the
dictionary checks above own the type from then on.

It reuses `rust_source.rs` rather than inventing a second scanner, which is where the two new
functions came from:

- **`modules_not_gated_by_cfg_test`** derives *production* from `main.rs`'s own `mod`
  declarations, so the contract modules that legitimately discuss the type by name are out of
  scope and a new module is in scope the moment it is declared. A `#[cfg(not(test))]` module
  counts as production — the direction to be wrong in is the one that scans a file needlessly.
- **`mentions_identifier`** answers in **tokens**, so the three things that are not a mention
  are excluded for one reason rather than three: a comment never reaches the token stream, a doc
  comment is an attribute, and `"DraftError"` inside `NOT_A_CODE` is a string literal.
  `an_identifier_is_read_in_code_and_not_in_a_comment_or_a_literal` is its positive control — a
  scanner that answered `false` to everything would make the guard pass vacuously.

**What it does not establish:** that a type nobody names cannot reach a user some other way. It
is a tripwire on the one route this exclusion was written for, not a proof.

The dictionaries were **deliberately not paid now**. Nothing serializes a refusal yet, and 2b-1
established that shipping strings ahead of their caller is the pattern only when the wire type is
actually on the wire.

### 9.2 A field identifier now spells its espanso key on the wire

The review's finding 6, and it was a claim that was simply false. `MatchField::UppercaseStyle`
serialized as `"UppercaseStyle"` and `SequenceField::SearchTerms` as `"SearchTerms"`, while the
`NOT_A_CODE` justification for both said they are rendered literally as the espanso key. A later
translated refusal interpolating one would have shown a Rust identifier to the user in both
languages, and no dictionary test would have failed.

Both enums now carry `#[serde(rename_all = "snake_case")]`, and the justification is true.
`every_match_field_serializes_as_its_espanso_key` and
`every_sequence_field_serializes_as_its_espanso_key` pin the serialized spelling of **every**
variant against `key()` — the projection's own spelling, the one a path segment and an
insertion's key already use — and check it reads back and round-trips through `from_key`. One
existing wire-shape assertion moved with it:
`a_refusal_serializes_externally_tagged_with_snake_case_fields` now expects `"triggers"` where it
expected `"Triggers"`.

`DraftTarget`'s exclusion was defensible only if its nested fields acquired stable display
spellings; they have, and `a_draft_target_spells_an_espanso_key_and_an_index` says so.
`DraftField` stays a permanent protocol exclusion — it travels inwards and is never rendered.

---

## 10. Verification

All run at the repository root.

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **882 passed, 0 failed**, 21 binaries (867 before the review round, 828 before the phase) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `cargo test -p espansoconfig-core --test corpus_integrity` | exit 0 — 17 passed |
| `npm run check` | exit 0 — 375 files, 0 errors, 0 warnings |
| `npm test` | exit 0 — 685 passed, 28 files (unchanged) |
| `#[tauri::command]` count | **7** in `commands.rs`, **1** in `menu.rs` — unchanged |
| `git status --short --untracked-files=all` | no real-corpus path |

51 of the tests are in `crates/espansoconfig-core/tests/draft_plan.rs` and three in
`src-tauri/` (`the_temporary_draft_error_exclusion_expires_when_anything_names_it`, plus
`rust_source.rs`'s two controls). Every **fixture** is inline, hand-authored and neutral; the two
corpus sweeps read files rather than fixtures and report counts, file names and refusal codes
only (`CLAUDE.md` §1).

Four things were checked by making them fail on purpose and putting them back, because a guard
that has never fired is a guard nobody has seen work:

| Made to fail | What was seen |
|---|---|
| a temporary `type Probe = …::DraftError;` in `save.rs` | `the_temporary_draft_error_exclusion_expires_when_anything_names_it` failed, naming `src-tauri/src/save.rs` and the two dictionary files |
| the real corpus moved aside | the sweep printed its `SKIP` line and passed |
| the same, with `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1` | the sweep failed, pointing at `./scripts/sync-real-corpus.sh` |
| `git check-ignore` on a real-corpus path after restoring it | still ignored, and `git status --untracked-files=all` shows no real path |

---

## 11. What 2b-2b-2 and 2b-2b-3 inherit

- **The equality rule is the contract, and it is one line of code.** `scalar.text == value`.
  Any future field — a `vars` entry's `name`, a form field's default — is compared the same
  way, against the projection's decoded value. A second comparison written anywhere else is a
  second answer to a question that has one.
- **The surface is closed by a type and by a guard, and widening it means widening both.**
  Adding `vars` to `MatchDraft` without adding it to `check_closed_surface` produces a batch
  that refuses itself, which is the failure mode this arrangement is designed to have.
- **`DraftField` is the shape for every future drafted value**, including ones whose payload is
  not a `String`. It is generic already; a `DraftField<VariableDraft>` costs nothing and keeps
  `null` failing closed.
- **An anchor is chosen once and named explicitly.** A later planner that lets a caller name an
  anchor inherits `check_batch_independence` unchanged — hazards 2 and 5 exist precisely for
  the caller-chosen case, which is why they are tested against hand-built batches today.
- **A `DraftError` position indexes something the caller never received, and that is the point
  to plan around.** An `Err` discards the batch, so there is no batch on the wire beside the
  refusal. What the positions index is *the batch `plan_match_edits` would have returned* — for
  `SharedInsertionAnchor`, `InsertionAnchorRemoved`, `ScalarEditedTwice` and friends, which are
  batch-level — and, for `SequenceItemDraftedTwice`, the **draft's own item list** for that
  sequence, which the caller *does* have. (The earlier wording here said "the batch the caller
  received"; the review's finding 7 is right that no such batch exists.) A command that plans
  and saves in one call, and that wants to point a form at the offending intent, must either
  re-derive the batch or carry the draft — and the draft-indexed refusal is the one it can
  render today with nothing extra.
- **The temporary `NOT_A_CODE` entry is a debt with a name on it, and now with an alarm on it**
  (§9.1). The sub-phase that gives `plan_match_edits` a command deletes the entry and pays both
  dictionaries in the same change; if it forgets, naming `DraftError` in any production module
  of `src-tauri/` or in `types.ts` fails
  `the_temporary_draft_error_exclusion_expires_when_anything_names_it` with a message that says
  what to do. The exhaustiveness test alone would have passed — that is why the guard exists.
- **`save_match` is still not written.** This module produces the batch; the transaction that
  writes it is `persist::save_document`, and the findings, the acknowledged multiset and the
  backup are unchanged. Nothing here weakens any of them, and there is still no `force` flag.

---

## 12. The review, and what closing it changed

`docs/reviews/phase-2b-2b-1-draft-engine.md` — six findings, two of them blocking, plus a
seventh that is a list of overclaims in this document. All are dispositioned below, **including
the two whose fix was narrowed or refused**, each with its reason. One further finding is the
orchestrator's own and is the last row.

### 12.1 Blocking — a duplicate sequence intent bypassed R5 and both guards

**Fixed in code, at intent level.** `Set` to the unchanged value followed by `Set` to a different
value at one index used to plan successfully, because the first intent was erased as a logical
no-op and the batch guards then saw one edit. `plan_match_edits` now pre-scans each sequence for
duplicate indices among non-`Unchanged` intents **before any diffing** and refuses with
`SequenceItemDraftedTwice`. §5.3 has the reasoning, the two consequences and the test whose name
is the point.

**The same duplication is not possible for a `MatchField`**, and it is closed by the type rather
than by a check: `MatchDraft` has one struct field per key and `serde` refuses a JSON object that
writes one of them twice. That is now a test rather than an assumption.

### 12.2 Blocking finding — accepted, **fix narrowed**

The review asks that `Remove` be allowed whenever the known key exists, regardless of value kind,
because `FieldRemoval` can delete the subtree.

**Ruling: the refusal stays.** Deleting bytes the visual editor never displayed to the user is
exactly the class of silent destruction this project refuses on principle, and a sub-phase whose
entire purpose is conservatism is the wrong place to grant that power. What changed instead:

1. **Reachability was established rather than assumed.**
   `a_known_key_holding_a_collection_reaches_the_planner_at_all` asserts that such a match is
   `safely_editable`, names no `blocking_hazard` and has a path — so the gate does *not* refuse it
   first, and both refusals below are decisions the planner takes.
2. **The refusal is now deliberate and named.** It was an accident of a shape check that meant
   "this shape is unmodelled"; the real reason for the removal half is "removing it would discard
   structure this editor never showed you", and that half is now its own variant,
   `RemovalWouldDiscardUnshownStructure`, whose documentation says plainly that the primitive
   *could* do it. `FieldHasAnUnmodelledShape` keeps the `Set` half, whose reason really is
   inexpressibility.
3. **The overclaim was corrected.** §4.1 replaced the sentence that said a collection-to-scalar
   transition is expressible. It is not, and the reason — an insertion is planned against the
   original index, where the key is still present — is now written down.

Neither half is permanent. A phase that shows such a subtree, or that asks for the power by name,
may grant it; this one does not, and now says so as a decision rather than leaving it to be read
as an oversight.

### 12.3 Should-fix — recorded, **code deliberately unchanged**

`triggers: []` is invisible to `visible_entries`, so a match whose only entries are empty
sequences yields `NoInsertionAnchor` for an insertion that ought to work.

**Ruling: this is a real limit, and the proper fix is out of scope.** Carrying the sequence
entry's own span is a change to `MatchView` — the read model, Phase 1a's — and 2b-2b-1 does not
touch it. What was done: the behaviour is **pinned** by
`an_empty_sequence_is_invisible_as_an_insertion_anchor`, so the limit is observed rather than
assumed, and §8 hole 9 records it — including the sharper half, which is the more valuable one:
**an empty `Vec<ValueView>` cannot distinguish "absent" from "present but empty"**. That
ambiguity belongs to whoever owns the read model, and the hole is addressed to `MatchView` in
`crates/espansoconfig-core/src/model/match_view.rs` by name.

### 12.4 Should-fix — the claim was fixed, the guards were kept

The guards reuse the planner's own `MatchField::from_key`/`SequenceField::from_key` vocabulary
and inspect **paths**, not nodes or original cardinality; a hand-built scalar edit to
`triggers[999]` passes both, and so did 12.1's case. Calling them "a second statement in terms a
defect in the planner cannot bend" was too strong.

`audit.rs`'s module documentation now describes what they are — a closed-surface check and a
batch-dependency check over a derived batch — and states the three things they do not establish.
§4 of this document carries the same correction. `check_batch_independence`'s own documentation
adds that `original_keys` is the *caller's* account of the mapping. The guards themselves are
unchanged.

### 12.5 Should-fix — the temporary exclusion now has an enforced expiry

A `NOT_A_CODE` entry makes the exhaustiveness test **pass**, so a later sub-phase could serialize
a `DraftError` from a command, forget the entry, and ship a code with no string with nothing
failing. `the_temporary_draft_error_exclusion_expires_when_anything_names_it` is the tripwire, it
reuses `rust_source.rs` rather than inventing a second scanner, and its failure message names the
two dictionary files and the entry to delete. §9.1 has the design and its limits.

**The dictionaries were deliberately not paid now** — nothing serializes a refusal yet, and 2b-1
established that shipping strings ahead of their caller is the pattern only when the wire type is
actually on the wire.

### 12.6 Should-fix — a field identifier now spells its espanso key

`MatchField::UppercaseStyle` serialized as `"UppercaseStyle"`, which made its own `NOT_A_CODE`
justification false. Both enums carry `#[serde(rename_all = "snake_case")]` now, two tests pin
every variant's spelling against `key()`, and one existing wire-shape assertion moved with it.
`DraftTarget`'s justification was rewritten to rest on that; `DraftField` stays a permanent
protocol exclusion. §9.2.

### 12.7 Note — the four overclaims

All four are corrected in place: §4.1 (collection-to-scalar is *not* expressible), §8 hole 2 (the
refusal is about the **anchor**, not about remove-plus-add — removing `trigger` while inserting
`word` after an untouched `label` is accepted), §11 (an `Err` discards the batch, so a position
indexes the batch that *would have been* returned, or — for `SequenceItemDraftedTwice` — the
draft's own list, which the caller does have), and §11 again (the dictionary contract would
**not** have failed, which is why 12.5 exists).

### 12.8 The orchestrator's finding — the headline property now runs over both corpora

*The draft that sets every field to its own projected value derives an empty batch* was tested
only against inline fixtures this phase wrote itself. It now runs match by match over **both**
corpora, following `saving_the_real_configuration_is_refused_by_neither_gate`'s conventions
exactly — skip cleanly without the corpus, fail instead under
`ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1`, counts and file names only. §3.1 has the numbers: **65 of
65 real matches plan to an empty batch, with zero refusals.**
