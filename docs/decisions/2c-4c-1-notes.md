# Phase 2c-4c-1 — decision record

**The creation and risk contract in Rust, with no command, no `DocumentEdit` variant, no second
writer and no control anywhere.** `NewMatch` widened from two mandatory fields to those two plus four
optional ones, and `FindingCode::NewMatchRepeatsLiteralTrigger { revision }` is new, produced by a
pure candidate inspection inside `save_document` for insertion batches only. **No `.svelte` file was
touched**, no command was added, and the twelve registered commands are the twelve that were there.

The authority for this step is `docs/reviews/phase-2c-4c-design.md` — the design consult — under its
**Q1** (the trigger is an editable literal, never auto-suffixed; an exact repeat is reported as risk
by a new transaction finding), **Q5** (the two core changes, and nothing more) and the **step cut**'s
item 1. Where this record and that document disagree, the consult is right and this is a bug.

---

## 1. What this step built

| File | What changed |
|---|---|
| `crates/espansoconfig-core/src/draft/new_match.rs` | `NewMatch` gained `label`, `word`, `left_word`, `right_word`, each `Option<String>` with `#[serde(default)]`; `fields()` emits only the present ones, in one documented order; six unit tests, four of them new |
| `crates/espansoconfig-core/src/draft/mod.rs` | the module paragraph that described `NewMatch` as closed at two mandatory keys now describes the six (review finding 3) |
| `crates/espansoconfig-core/src/validate/mod.rs` | `FindingCode::NewMatchRepeatsLiteralTrigger { revision }`; `ALL_NAMES` 12 → 13; the `name()` arm; the `class()` arm (`SuspiciousButPermitted`); the module paragraph and three doc blocks; the `the_code_name_table_matches_the_codes` fixture |
| `crates/espansoconfig-core/src/patch/edit.rs` | `replay_item_positions` and `SlotOrigin`, private, extracted out of `fold_item_expectations` so the fold and the save transaction share one arithmetic; `insertion_landings`, **public**, and its private `index_within` (review finding 1); `ItemPlacement::items_above` now answers `Option<usize>` and `insertion_landings` checks all three of its derivations, with `plan_item_insertion` taking the new `None` arm as the `NoSuchDestinationItem` it already had (confirmation-pass finding 6, §6.3) |
| `crates/espansoconfig-core/src/patch/mod.rs` | `insertion_landings` re-exported |
| `crates/espansoconfig-core/src/persist/save.rs` | `new_match_repeats_literal_trigger`, `matches_directly_in` and `literal_trigger_texts`, all private; `findings_of` inspects **every** `InsertItem` in the batch, at the address `insertion_landings` gives; one unit test for the undecodable-scalar exclusion (review findings 1 and 4) |
| `crates/espansoconfig-core/tests/patch_item.rs` | `insertion_landings_names_the_index_each_new_item_took`, over four batch shapes; and two more at the confirmation pass — `items_above_answers_nothing_for_an_anchor_with_no_successor` and `insertion_landings_answers_nothing_when_the_arithmetic_names_no_index` (§6.3) |
| `crates/espansoconfig-core/tests/persist_save.rs` | sixteen acceptance tests and five helpers (`creation`, `new_match`, `removal`, `repetitions`, `at`) |
| `crates/espansoconfig-core/tests/validate_semantics.rs` | `NOT_VALIDATES` 2 → 3 entries, and the paragraph that says why each is exempt |
| `src-tauri/src/commands.rs` | three existing `NewMatch` literals in tests gained the four `None` fields; `create_match`'s doc now describes six fields; **one new test**, `an_ordinary_creation_carries_six_fields_and_reports_a_repeated_trigger` (review findings 2 and 3). **One production line changed, at the confirmation pass** (§6.3): `create_one_match`'s post-save address is now an `Option<DocumentPath>` passed as `at: landed.as_ref()`, following `items_above`'s new signature. Through the review round this row correctly read *no production line changed*; finding 6 is what made that stop being true |
| `src-tauri/src/dictionary_contract.rs` | `("findingCode", 12)` → `13` |
| `src-tauri/src/dispatch_check.rs` | claim 2 of the creation dispatcher test now says which payload it sends and what that pins (review finding 3) |
| `src-tauri/src/wire_contract.rs` | the sample in `finding_code_samples`; the three non-vacuity counts: 205 → 206 variants, 205 → 206 placeholder checks, and `(checked, nested, unit)` 122/12/71 → 123/12/71; `member_declarations` and `interface_properties` extracted/added, and `the_creation_payload_declares_exactly_the_properties_serde_reads` (review finding 5) |
| `src/lib/i18n/{en,es}.json` | one key per language, 769 → 770 |
| `src/lib/ipc/types.ts` | `FindingCodeName` and `FindingCode` gained the variant; `NewMatch` gained the four optional properties |
| `src/lib/ipc/commands.ts`, `src/lib/ipc/commands.test.ts`, `src/lib/browser/workspace.svelte.ts`, `src/lib/browser/matchCreation.ts` | the creation boundary's own two-value descriptions, corrected to the widened shape or narrowed to the creator *form* they were really about (review finding 3) |

**No fixture under `crates/espansoconfig-core/tests/corpus/` was touched**, none was added, and
`CLAUDE.md` §4's table of fifteen is unchanged: every case below is a hand-authored, neutral string
literal in the test file itself.

**`src/lib/i18n/codes.ts` did not change, and that is a fact about the code rather than an
omission.** `findingCodeKey(name: FindingCodeName)` already builds `code.findingCode.${uncapitalize(name)}`
for *every* member of the union and declares its return type as `TranslationKey`, which is
`keyof typeof en`. Adding a name to the union without adding the key is therefore a **compile error in
`codes.ts`**, which is exactly the check §2.8 of this record relies on; adding the accessor a second
time would have been a second producer of the same key. `describeFindingCode` reaches the new code
through `wireVariantName` with no arm to add, and `MatchCreator.svelte:796` already renders it with
`tFindingCode(finding.code)`.

---

## 2. The decisions

### 2.1 D1 — `NewMatch` is six fields, and it is still closed

Two mandatory (`trigger`, `replace`) and four optional (`label`, `word`, `left_word`, `right_word`) —
the same six `src/lib/browser/matchEditor.ts` names in `EditableField`. Every key is spelled by
`MatchField::key()` rather than typed, so the strings this crate emits as keys still have one source.

What the type still refuses, unchanged: a `MatchDraft`, a raw key/value list, a projection, a comment,
and YAML source. **The enforcement is that there is no field any of them could arrive through** —
six `String`-shaped fields and nothing else. That is a claim about the struct's shape, and it is the
whole of the enforcement; nothing stops a caller putting YAML *text* in one of the six, and it would
be written as the text it is by `choose_scalar` rather than interpreted, which is the same guarantee
`trigger` and `replace` already had.

### 2.2 D2 — `None` is not `Some("")`, and the type carries the caller's decision

An absent optional field is a key the new item is not born holding at all. A present empty one is
`label: ''` written into the file. This is Phase 2c-2's `Unchanged`/`Set` distinction restated for a
creation, and the reason is the same: a blank control cannot tell the two cases apart, so the caller
decides. `fields()` emits the second and omits the first, and
`an_absent_field_and_an_empty_one_are_not_the_same_request` is the test.

**`Option<String>` does not force the caller to have thought about it.** A caller that always sends
`None` compiles, and a caller that always sends `Some(buffer)` compiles; what the type gives is the
*ability* to express the difference and a `fields()` that respects it, not a proof that any caller
uses it correctly. 2c-4c-2 is where the six transfer decisions are made.

### 2.3 D3 — one write order, documented, and it is the file's key order

`trigger`, `replace`, `label`, `word`, `left_word`, `right_word`. `InsertItem` renders one line per
pair, so the vector `fields()` returns *is* the new item's key order in the file. The order agrees
with `MatchField::ALL`'s relative order over these six and with `EDITABLE_FIELDS`'s screen order —
but it is written out literally in `fields()` rather than derived from either, so a future reorder of
`MatchField::ALL` would not silently reorder written bytes. `all_six_present_fields_are_written_in_the_documented_order`
pins the order and `an_absent_optional_field_is_omitted_and_the_order_survives` pins each omission
alone.

### 2.4 D4 — the three word-boundary fields are `Option<String>`, not `Option<bool>`

The reason a word-boundary *control* may not be a checkbox, at the layer below it: deciding that
`word: on` means boolean true is a claim about how espanso's YAML 1.1 resolver reads a plain scalar,
and D2u forbids this application making one. What is written is the caller's text, spelled by the
encoder — which is why `a_six_field_creation_writes_all_six_keys_and_still_reports_the_repetition`
expects `word: 'true'` quoted and `replace: a recovered body` plain: the spelling is
`choose_scalar`'s decision, not this type's.

### 2.5 D5 — a new `FindingCode`, and deliberately not the duplicate's

`FindingCode::NewMatchRepeatsLiteralTrigger { revision }`, `SuspiciousButPermitted`, one operand.
`DuplicateKeepsTriggerDefinition` is produced only for a `DuplicateItem` batch; borrowing its name for
an insertion would be the 2c-3c precedent reused **under a false name** — and concretely, it would make
consent recorded for a duplicate readable as consent for a creation, since an acknowledgement is a
multiset of `Finding`s and a `Finding` is its code plus its address. What transfers is the *pattern*:
a save-transaction code, content-addressed by the candidate's own `ContentRevision`, acknowledged by
the ordinary exact-multiset round trip.

### 2.6 D6 — produced inside `save_document`, for insertion batches only

`new_match_repeats_literal_trigger` is called from `findings_of`, beside the duplicate's producer and
after the projection pass, so the editor-model findings keep their precedence in `verdict`. It is not
a `validate` rule, and the two reasons are recorded on the enum: a rule over every candidate would
interrupt saves of unrelated edits to files this application never wrote, and a check in the window
would be bypassed by every other caller of the command.

**It therefore reaches ordinary `create_match`, and that is the design.** Exact repetition is a
property of the candidate rather than of the route that built it.

**The evidence for that crosses `create_match` itself**, and at the first round it did not.
`a_creation_that_repeats_a_literal_trigger_refuses_until_it_is_acknowledged` in
`tests/persist_save.rs` builds its `InsertItem` from `NewMatch::fields()` **in the test**, so it
reconstructs `create_one_match`'s lowering rather than crossing it: a mutation that dropped the four
optional fields on the way in, or that reached the transaction by a route the risk producer does not
run on, would have left it green (the review's finding 2).
`an_ordinary_creation_carries_six_fields_and_reports_a_repeated_trigger` in `src-tauri/src/commands.rs`
starts at `WorkspaceSession::create_match` with all six fields set and a trigger the file already
holds, and ends at the bytes on disk: the suspicion arm refuses, nothing is written, the exact
findings come back and let it proceed, and the committed file holds all six keys in the documented
order with the two pre-existing snippets byte-identical.

**What this changes for a person, today, with no component change:** creating a snippet whose trigger
exactly repeats another in the same list is refused once, the sentence renders in both languages
through `tFindingCode`, and *Save anyway* commits. That path already existed and needed nothing added:
`refusalAcknowledgement` in `src/lib/browser/rawSave.ts:275` answers an acknowledgement for **any**
`RefusedForUnacknowledgedSuspicions` with findings, and `refusalChoices` at `:291` derives
`saveAnyway` from that answer — so the offer is driven by the **verdict** and never by which code the
finding carries. **No mounted test and no window reading covers this new code specifically**; see §4.5.

### 2.7 D7 — the new item is found by the engine's own arithmetic, over the **whole batch**

> **Corrected at the review round.** The first version of this decision derived the address from the
> insertion alone — `ItemPlacement::items_above` of the candidate's own count minus one — and this
> section claimed that made it derivable. **It did not, and the code was wrong for batches
> `apply_edits` accepts.** What that version got right is stated below; what it got wrong is §6.1.

The index the new item took is `crate::patch::insertion_landings(edits, sequence, items)`, in
`crates/espansoconfig-core/src/patch/edit.rs` — the patch engine's own arithmetic over the **whole
batch**, called rather than re-spelled. `items` is `matches_directly_in(view, sequence).len()`: every
match the candidate projects as a **direct** item of the destination sequence, checked on both the
document index and the parent segments, because a `DocumentPath` names no file and two documents can
carry the same path.

That count is the sequence's own item count only because **every `matches` entry produces exactly one
`MatchView`**, an unrecognised one included — recorded by span and not descended into. That is
`create_one_match`'s own recorded precedent, and this step pins it rather than inheriting it:
`a_matches_entry_that_is_not_a_mapping_still_occupies_its_slot`.
`the_finding_names_the_slot_the_insertion_landed_for_every_placement` pins the arithmetic for all
three placements by asserting the finding's *path*, which a wrong derivation could not produce.

**One arithmetic, and it lives in the engine.** `insertion_landings` and `fold_item_expectations` —
the fold that builds what `verify` must find in a changed sequence — both call one private
`replay_item_positions`, which is the pass over the original positions the fold's own doc comment
already described. That is what the previous version of this decision *claimed* by calling
`items_above`: a caller and the engine that cannot disagree. Before the extraction, the fold spelled
the replay and the save transaction spelled a simplification of it, and the simplification was wrong.

**Every insertion in the batch is located, and every one is inspected.** `findings_of` loops the batch
in order; each `InsertItem` is looked up in the landings for its own destination by its batch
position. The comparison is against the **candidate's** list, so a batch inserting two items that
repeat each other reports both — the repetition really is in the list the person would be left with.
Nothing in `DocumentEdit` forbids such a batch and no caller in `src-tauri/` builds one:
`create_one_match` issues exactly one insertion.

**The arithmetic is checked at all three of its steps, and one answer covers all three** (added at the
confirmation pass; §6.3 is the finding). `insertion_landings` derives the original item count as the
candidate's count **plus** the batch's removals **minus** its insertions, and then asks
`ItemPlacement::items_above` for each anchor. All three can fail to name a `usize`, and every one of
them answers the **empty vector** — the "say nothing" the underflow already used, applied to the other
two rather than a second convention beside it. One anchor with no landing empties the whole answer,
because a list a caller reads as complete while a position is silently missing from it is worse than
no list, and `findings_of` looks each insertion up by its own batch position and produces nothing when
it is absent either way.

### 2.8 D8 — "modelled literal trigger text", and what produces no claim at all

`literal_trigger_texts` answers, for a match:

- `TriggerKind::Single` → the `trigger` scalar's text, when this crate **decoded** it;
- `TriggerKind::Multiple` → each scalar entry of `triggers`, on the same terms;
- `Regex`, `Several`, `Absent` → nothing.

An undecodable `ScalarView` holds the raw source slice rather than the logical text, so comparing one
would be comparing bytes against text and calling the result equality; it is excluded on both sides.
`triggers` entries are included because excluding them would under-report: a file writing
`triggers: [':one', ':alt']` really does already use `:alt` as literal trigger text.

**The exclusion is pinned by a unit test that sets the flag by hand, and the reason is measured
rather than assumed.** Reaching `decoded == false` through a saved candidate would need a
double-quoted scalar the **substrate** accepts and `crate::emit::decode` rejects, and no such text
has been found: measured against `SyntaxIndex::parse`, an unknown escape (`\q`), a malformed numeric
escape (`\uZZZZ`, `\x+1`), a lone surrogate (`\uD800`, and a surrogate *pair*) and an out-of-range
code point (`\U00110000`) are each rejected by the parser first, so the projection never gets the
chance. `save.rs`'s `an_undecodable_trigger_scalar_contributes_no_literal_text` therefore projects a
real repetition, asserts the premise on both items and asserts that the finding **is** produced, then
clears the flag on the existing item and on the new one in turn and asserts silence each time.
Deleting the `filter(|scalar| scalar.decoded)` fails it — checked by deleting the line (the review's
finding 4). What no test can hold is that this is the *only* way an undecodable scalar could arise;
the search above is a search, not a proof.

The comparison is **exact string equality of decoded text**, and nothing else. `Several` and `Absent`
are already `MatchHasSeveralTriggerForms` and `MatchHasNoTriggerField` — `EditorModelError`s that win
in `verdict` and that no acknowledgement passes — so the suspicion stays silent beside them rather
than weakening that precedence, exactly as the duplicate's does.

Six tests carry this: `a_regex_trigger_produces_no_finding_on_either_side` (both directions),
`an_entry_of_a_triggers_list_counts_as_literal_trigger_text`,
`a_trigger_that_only_overlaps_another_produces_no_finding`,
`a_created_item_with_no_trigger_is_refused_for_the_model_error_alone` and
`a_created_item_with_several_trigger_forms_is_refused_for_the_model_error_alone`.

### 2.9 D9 — the sentence claims repetition and inability, and nothing else

> The new snippet repeats trigger text another snippet in this list already writes, and espansoConfig
> cannot determine how espanso will handle overlapping definitions.

It does not say *invalid*, *collision*, or which snippet wins. It does not say that a **non**-repeating
trigger is safe — the silence in §2.8 is a refusal to claim, not a clearance. That is D2u: a claim
about risk is permitted, a claim about espanso semantics is not. The Spanish is the same sentence, and
neither has a placeholder, so `every_save_transaction_placeholder_names_an_operand_serde_writes` is
satisfied vacuously for this code rather than by agreement.

**One word of it is loose for a batch nobody builds, and the sentence was left alone deliberately.**
Since the review round the comparison is against the candidate's whole list, so a batch inserting two
items that repeat *each other* reports both — and for those two, "another snippet in this list
**already** writes" describes the list they would leave behind rather than the one that was there
before. The repetition claimed is real either way, and rewording a shipped bilingual sentence to cover
a batch no caller in `src-tauri/` can build is a change with more risk than value. Recorded, not fixed.

### 2.10 D10 — content-addressed by the candidate's revision

The operand is the whole candidate's `ContentRevision`, for `DocumentDoesNotParse`'s and the
duplicate's reason: the new item's path, span and node are all equal across a same-length rewrite
above the insertion point, so all three bind consent to a *shape* rather than to a text.
`a_creation_acknowledgement_does_not_transfer_across_a_same_length_rewrite` builds exactly that pair
and asserts the premise — path, span and node equal, findings unequal — rather than assuming it.

---

## 3. What this step deliberately did **not** do

- **No thirteenth command.** `create_match` is unchanged; the registered set is still the twelve
  `the_registered_commands_are_the_workspace_twelve_and_the_menu_command` names.
- **No new `DocumentEdit` variant, no second writer, no `force` flag.**
  `espansoconfig_core::persist::save_document` remains the only entry point that may write.
- **No new `EditError`, and no batch `apply_edits` used to accept is refused now.** The review round
  added one public *function* to `crates/espansoconfig-core/src/patch` — `insertion_landings`, pure
  arithmetic over a request that writes nothing and reads no document — and no type, no variant and
  no refusal. §4.1 records why that was the trade taken.
- **No `.svelte` file, no control, no new choice.** `npm run build` still transforms **175** modules,
  which is the guard for that.
- **No `codes.ts` change** — see §1.
- **No recovery anything.** No transfer decision, no destination selection, no `manualResolution` arm.
  Those are 2c-4c-2 and 2c-4c-3. The four optional fields have **no producer that fills them** yet.

---

## 4. What this step does not cover, stated as holes

### 4.1 ~~A batch with two or more insertions produces no finding at all~~ — closed, and the hole as first written was wrong

> **Correction, at the review round.** What this section said was: the inspection is skipped for a
> batch with two insertions; that is an under-report; and one insertion is enough to make the address
> derivable. **The first two sentences were true and the third was false**, and the third is the one
> that mattered — it is the sentence that made the defect look like a scoping choice. One insertion
> makes the address derivable only when it is the batch's **only cardinality-changing edit**, which
> nothing enforces: `apply_edits` explicitly accepts an insertion beside a `RemoveItem` and folds both
> claims about one sequence into a single expectation. So a removal above the anchor shifted the
> arrival left while the old derivation still looked at the higher slot, and the finding could be
> attached to a **pre-existing item whose trigger the new one never repeated**. That is not an
> under-report; it is a false report about someone else's snippet, and the review found it.
>
> Both are now closed by the same change (§2.7): the address comes from
> `crate::patch::insertion_landings` over the whole batch, and **every** insertion is inspected.
> `a_removal_above_the_insertion_does_not_report_an_existing_item` is the review's own scenario;
> `a_removal_above_the_anchor_shifts_the_address_the_finding_names` and
> `a_removal_below_the_anchor_leaves_the_address_alone` are the two sides of the anchor;
> `two_insertions_in_one_batch_are_each_located_and_each_reported` is the multiple-insertion case;
> `a_scalar_edit_beside_the_insertion_moves_no_address` is the accepted mixed batch that changes no
> cardinality; and `insertion_landings_names_the_index_each_new_item_took` pins the arithmetic at the
> patch layer against the engine's own bytes.

What remains, stated as the narrower hole it is: **the landing is arithmetic over the request, not a
lookup in the candidate.** `insertion_landings` reads no document, so it cannot tell that the sequence
it was asked about exists, and it trusts that only `InsertItem` and `RemoveItem` change a sequence's
cardinality — true because `ItemMove` and `DuplicateItem` are each refused unless they are alone in
their batch (`MoveMustBeTheOnlyEditInItsBatch`, `DuplicateMustBeTheOnlyEditInItsBatch`), and false the
moment a future edit kind changes a sequence's length without that rule. Nothing in the type system
says so; this sentence is the whole of the guard.

**What it *is* now closed against is the other half of "validates nothing": the arithmetic itself.**
Since §6.3 all three derivations are checked, so for any `usize` a caller can put in an `InsertItem`,
a `RemoveItem` or `items_in_candidate`, none of the three panics in an overflow-checking build or
answers a wrapped index in one that does not check. **That is a claim about those three steps and
nothing else**, and the difference matters: an `items_in_candidate` near `usize::MAX` that *survives*
them — one insertion, no removals — is then answered by replaying that many positions and allocating
a slot for each. Time and memory, never a wrong index, and the only thing keeping a real caller away
from it is that an item needs at least one byte on disk. No type says that either, and it is stated
here rather than left to be found.

**Why the address was fixed rather than the batch narrowed.** The review offered two options, and the
other one — make an insertion that receives this finding the only sequence-cardinality edit in its
batch, enforced by the patch contract — was **not** taken, for three reasons. It would delete a
capability `apply_edits` deliberately has: `an_insert_and_a_removal_in_one_batch_land_where_the_bytes_say`
in `tests/patch_item.rs` pins it, and `fold_item_expectations`'s one-pass design exists *for* it. It
would need a new `EditError` variant, which is a user-facing refusal and therefore a sentence in both
dictionaries — prose describing a batch no caller can build and no window can show, which is this
project's own worst defect class. And it would turn the multiple-insertion under-report into a
refusal rather than closing it, where deriving the address closes both. The cost of the option taken
is the one named above: arithmetic that has to agree with the engine — paid down by moving it *into*
the engine and having the fold call the same function.

### 4.2 Exact equality is the whole of the comparison

Not covered, in either direction, and none of it is a defect: an overlapping trigger (`:one` against
`:oneself`), a case-differing one, two plain scalars YAML 1.1 and 1.2 disagree about, a repetition
across two **files**, and a repetition inside a sequence other than the destination. The finding's
silence about any of these is not a claim that they are safe, and D9's sentence is written so that it
does not become one — but **that is a property of the sentence, not of anything executable**.

### 4.3 The item-count precedent is pinned by one shape, not proved

§2.7 depends on every `matches` entry producing exactly one `MatchView`.
`a_matches_entry_that_is_not_a_mapping_still_occupies_its_slot` measures that for a plain scalar
entry. It is one shape; a projection change that dropped or doubled a `MatchView` for some other
entry shape would move the derived index silently, and the failure mode is a finding attached to the
wrong item or no finding at all — never a wrong write, because the address is only used to *report*.

A destination sequence the projection models no matches for — `global_vars`, say — makes
`insertion_landings`'s underflow guard answer an empty list, and no finding is produced, silently.
(The guard moved there at the review round; the first version of this paragraph named a `checked_sub`
in `save.rs` that no longer exists.) That is correct for what this code is about and is not
distinguishable, from outside, from "no repetition".

### 4.4 ~~No test pins the TypeScript `NewMatch` against the Rust struct~~ — closed at the review round

> **Correction.** This was recorded as a hole and left open on the ground that 2c-4c-2 would make it
> reachable. The review's finding 5 is that recording it does not make the value safe to build on,
> and it is right: the whole point of 2c-4c-2 is to be the first caller that fills these four fields,
> so shipping the hole into the step that spends it is the wrong order.

`wire_contract.rs`'s `the_creation_payload_declares_exactly_the_properties_serde_reads` now compares
`NewMatch`'s Rust properties against the TypeScript interface. It is a **deserialize-side** check and
is not the serialize-side one restated: `serde` *ignores* a JSON property no field claims, so renaming
TypeScript `right_word` to `rightWord` used to compile, type-check, send an unknown property, default
the Rust field to `None`, and silently drop the key from the created snippet. The test asserts the
name sets agree; that the whole payload round-trips to an equal value, so a property being ignored on
the way in is visible; that a property TypeScript declares required is one `serde` refuses to default
**and** refuses as `null`; that one declared `?:` is accepted omitted and accepted as `null`, meaning
absent in both cases; and that an optional property's declared type admits `null`. All six properties
contribute to a count of 6. Falsifiability was checked by renaming the TypeScript key and watching it
fail.

What it still does not check is the **type text of a required property beyond its being `string`**:
this harness resolves no TypeScript types, which is the limit `wire_contract.rs`'s own header records.

### 4.5 No mounted test and no window reading

Owed by this step's brief, and correct — no component changed. But the consequence is worth naming:
the new sentence, in both languages, has **never been drawn on a screen**, and the ordinary-creation
refusal it introduces (§2.6) has not been seen in a window. 2c-4c-5 is the reading; nothing before it
is evidence about a screen.

### 4.6 The i18n suites check parity and placeholders, not meaning

Both dictionaries hold the key and neither names a placeholder, so
`dictionaries.test.ts` and `every_save_transaction_placeholder_names_an_operand_serde_writes` pass.
**No executable test pins what the sentence claims.** Reverting D9's wording to one that says
*collision* or *invalid* would leave every suite green — which is this project's recorded worst defect
class and is why D9 is written out here in full.

### 4.7 Nothing here has been checked against a running espanso

Inherited from `crates/espansoconfig-core/tests/persist_save.rs`'s own header. Every claim about what
espanso does is a claim this crate declines to make; the finding exists precisely because the crate
cannot make it.

### 4.8 A raw whole-document save produces no such finding

`findings_of_replacement` does not call the inspection, so text a person writes by hand into the raw
editor that repeats a trigger is not reported. Deliberate — a raw save is authored text and there is
no modelled creation to be about — and recorded rather than assumed.

---

## 5. Evidence

Rust tests only, as the step's brief requires.

| Claim | Test |
|---|---|
| Optional-field order, all six present | `new_match.rs::all_six_present_fields_are_written_in_the_documented_order` |
| Optional-field omission, each alone | `new_match.rs::an_absent_optional_field_is_omitted_and_the_order_survives` |
| `None` ≠ `Some("")` | `new_match.rs::an_absent_field_and_an_empty_one_are_not_the_same_request` |
| The two mandatory keys still required; the four default to absent | `new_match.rs::both_fields_are_mandatory_on_the_wire` |
| The four cross the wire; `null` is absent, `""` is present | `new_match.rs::the_four_optional_keys_cross_the_wire` |
| Exact repeat → finding, refusal, acknowledged retry commits, **byte identity outside the insertion span** | `persist_save.rs::a_creation_that_repeats_a_literal_trigger_refuses_until_it_is_acknowledged` |
| Non-repeat → no finding | `persist_save.rs::a_creation_with_a_trigger_nobody_else_uses_commits_without_a_finding` |
| Overlap is not repetition | `persist_save.rs::a_trigger_that_only_overlaps_another_produces_no_finding` |
| The finding names the slot the insertion landed, for all three placements | `persist_save.rs::the_finding_names_the_slot_the_insertion_landed_for_every_placement` |
| A non-mapping entry still occupies its slot | `persist_save.rs::a_matches_entry_that_is_not_a_mapping_still_occupies_its_slot` |
| No semantic claim for a regex, on either side | `persist_save.rs::a_regex_trigger_produces_no_finding_on_either_side` |
| A `triggers` entry is literal trigger text | `persist_save.rs::an_entry_of_a_triggers_list_counts_as_literal_trigger_text` |
| No trigger form → model error alone | `persist_save.rs::a_created_item_with_no_trigger_is_refused_for_the_model_error_alone` |
| Several trigger forms → model error alone | `persist_save.rs::a_created_item_with_several_trigger_forms_is_refused_for_the_model_error_alone` |
| A changed candidate revision invalidates an old acknowledgement | `persist_save.rs::a_creation_acknowledgement_does_not_transfer_across_a_same_length_rewrite` |
| Six-field creation writes six keys, omits the absent one, still reports the repetition | `persist_save.rs::a_six_field_creation_writes_all_six_keys_and_still_reports_the_repetition` |
| A removal above the insertion does not make the finding fire against an existing item | `persist_save.rs::a_removal_above_the_insertion_does_not_report_an_existing_item` |
| A removal above the anchor shifts the reported address, and the finding follows it | `persist_save.rs::a_removal_above_the_anchor_shifts_the_address_the_finding_names` |
| A removal below the anchor moves nothing | `persist_save.rs::a_removal_below_the_anchor_leaves_the_address_alone` |
| Two insertions are each located, each reported, and the two-finding round trip holds | `persist_save.rs::two_insertions_in_one_batch_are_each_located_and_each_reported` |
| An accepted mixed batch that changes no cardinality moves no address | `persist_save.rs::a_scalar_edit_beside_the_insertion_moves_no_address` |
| The landing arithmetic itself, against the engine's own bytes, over four batch shapes | `patch_item.rs::insertion_landings_names_the_index_each_new_item_took` |
| `items_above` answers `None` for the index with no successor, and still checks nothing else | `patch_item.rs::items_above_answers_nothing_for_an_anchor_with_no_successor` |
| `insertion_landings` answers nothing rather than panicking or wrapping, at both arithmetic extremes | `patch_item.rs::insertion_landings_answers_nothing_when_the_arithmetic_names_no_index` |
| An undecodable scalar is not literal trigger text, on **either** side | `save.rs::tests::an_undecodable_trigger_scalar_contributes_no_literal_text` |
| **Ordinary `create_match`**, crossed: six fields in, repeated trigger, refusal, exact findings back, six-field bytes out, pre-existing bytes untouched | `commands.rs::an_ordinary_creation_carries_six_fields_and_reports_a_repeated_trigger` |
| The TypeScript `NewMatch` is the Rust struct `serde` reads, required-versus-optional included | `wire_contract.rs::the_creation_payload_declares_exactly_the_properties_serde_reads` |
| The code is declared, named, classed and unreachable from `validate` | `validate/mod.rs::the_code_name_table_matches_the_codes`, `validate_semantics.rs::every_finding_code_is_reachable` |
| It crosses the wire as a struct variant with exactly `revision` | `wire_contract.rs`'s four save-transaction checks |
| Both dictionaries hold its key | `dictionary_contract.rs::the_code_dictionary_is_exactly_the_declared_variants`, `dictionaries.test.ts` |

**Gates, on this tree, after the review round's fixes and the confirmation pass's (§6.3):**

| Command | Result |
|---|---|
| `cargo test --workspace` | **1112 passed, 0 failed** (1086 before the step; 15 at the first round, 9 more at the review round, 2 more at the confirmation pass) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output — the core is still tauri-free |
| `npm test` | **1633 passed, 49 files** — unchanged, as it must be |
| `npm run check` | **418 files, 0 errors, 0 warnings** |
| `npm run build` | **175 modules** — unchanged, no new source module |

---

## 6. The review round

`docs/reviews/phase-2c-4c-1-code.md` returned **NOT READY** on three Mediums and two Lows. All five
are closed; each is recorded where it belongs above rather than only here, because a fix whose only
trace is a change log is a fix nobody will find from the code. **Its confirmation pass returned NOT
READY again, on one Low the fix round had itself introduced** — finding 6 below, and §6.3.

| # | Finding | Where it is now |
|---|---|---|
| 1 | Medium — the inserted-item locator is unsound for legal edit batches | §2.7 (the fix), §4.1 (the correction, and why the other option was refused) |
| 2 | Medium — the claimed ordinary-creation evidence does not traverse `create_match` | §2.6 |
| 3 | Medium — the widened public contract still has two-field descriptions | §1's table, last row |
| 4 | Low — no test makes the undecodable-scalar exclusion falsifiable | §2.8 |
| 5 | Low — Rust and TypeScript `NewMatch` have no property-parity check | §4.4 |
| 6 | Low — `insertion_landings` can overflow on its documented unvalidated input (**the confirmation pass**) | §2.7 (the fix), §4.1 (what is closed and what is not), §6.3 |

### 6.1 What the first round got wrong, stated plainly

**A decision record that claims a guarantee the code does not give is this project's worst defect
class, and §4.1 was one.** It said the address was derivable from a single insertion. It is derivable
only from a single insertion *that is the batch's only cardinality-changing edit*, and nothing
enforces that — `apply_edits` accepts an insertion beside a removal by design, with a test and a
design rationale of its own. The gap between those two sentences is the whole of the defect, and it
was invisible because the section named a **narrower** hole (two insertions) truthfully and then
generalised from it in the wrong direction. Reading that section, the two-insertion under-report looks
like the only cost of the shape; it was not.

Two things follow for later steps. **The finding's contract is narrow and the code must be checked
against the contract, not against the batch today's callers build** — "no caller builds one" is a
statement about `src-tauri/` in August 2026, not about `DocumentEdit`. And **where an address is
derived, it is derived from the whole request**: §2.7's `replay_item_positions` is one function
precisely so that a second derivation cannot be written without deleting it.

### 6.2 What the review round's own fixes could still be wrong about

Named rather than left to be found, since a fix round earns its own scrutiny:

- `insertion_landings` is arithmetic over a request and validates nothing (§4.1's remaining hole) —
  **and this bullet was right for a reason it did not know**: the confirmation pass read the same
  sentence and asked whether the arithmetic itself survived the inputs the signature accepts. It did
  not, and that is finding 6 (§6.3). The half that remains open is the half this bullet named;
- the undecodable-scalar test sets a flag the parser has never been seen to set, so it pins the rule
  and not the route to it (§2.8);
- the wire-parity test compares property names and optionality, never a required property's type text
  beyond `string` (§4.4);
- **the sentence D9 fixes is still checked by no executable test** (§4.6), unchanged by this round;
- and this step still owes **no** mounted test and **no** window reading (§4.5), so nothing here is
  evidence about a screen — including the sentence the two new mixed-batch cases would produce.

### 6.3 The confirmation pass, and the sixth finding

The confirmation pass confirmed all five round-1 findings closed and the `fold_item_expectations`
refactor behaviour-preserving, and then returned **NOT READY** on one **Low the fix round had itself
introduced**. That is this project's own rule arriving on its own record: a fix is a change, and the
round that reviews it is not optional.

**The finding.** `insertion_landings` documents itself as pure arithmetic that validates nothing, and
`replay_item_positions` documents that an anchor above the original item count simply contributes
nothing. The wrapper did not uphold that domain. Two inputs the public signature accepts reached
unchecked additions:

- one `InsertItem::after(sequence, usize::MAX, fields)` with `items_in_candidate == 1`.
  `ItemPlacement::items_above` computed `usize::MAX + 1`, which **panics** in an overflow-checking
  build — before the promised no-contribution behaviour — and **wraps to `0`** in a build that does
  not check, i.e. a plausible but false *front* landing;
- `items_in_candidate == usize::MAX` beside one direct removal. `items_in_candidate + removals.len()`
  overflowed *before* the checked subtraction that was already there.

**What it did and did not threaten.** The save caller cannot reach either case after a document has
actually been applied, so finding 1 is not reopened and no write was ever at risk — the landing is
only ever used to *report* an address. What was unsound is the newly public request-level API and,
worse, its documentation: the sentence "it is pure arithmetic and validates nothing" was true of
`Front` and `End` and false of `After`, where the function panicked. **A doc comment claiming a
guarantee the code does not give is this project's worst defect class**, and the fix had to close the
sentence as well as the arithmetic.

**The fix.** Checked arithmetic at all three derivations, every failure answering the **empty vector**
— the same "say nothing" the existing underflow rule already used, extended rather than joined by a
second convention. §2.7's new paragraph is the rule; §4.1's new paragraph is what it does and does not
close.

**`items_above` is checked at its own site, and that was the deliberate choice.** The review offered
the alternative — guard before calling it — and it was refused for the reason the function's own doc
comment already gave about a *third* spelling: `items_above` is the one place `Front`, `After(k)` and
`End` are turned into a count, so a caller testing `After(usize::MAX)` before calling would be a
second copy of exactly that case analysis, in the function written to be its only copy. It is also
where the false sentence lived, and the next caller will read it there. Its signature is therefore
`Option<usize>`, `None` for the single input whose successor is not a `usize`, and it still compares
`items` with nothing — an `After(k)` above the sequence's own count answers `Some(k + 1)` here and is
`EditError::NoSuchDestinationItem` at `plan_item_insertion`, which is where a document exists to judge
it against.

**Its two other callers, and neither changes behaviour for an input it can reach:**

| Caller | Reachable input | What changed |
|---|---|---|
| `plan_item_insertion`, `crates/espansoconfig-core/src/patch/edit.rs` | none — the anchor resolution above it already required `at < children.len()` for every `After`, so the successor is a `usize` by the time the line runs | `.ok_or(EditError::NoSuchDestinationItem { .. })?`, reusing the variant that already says *this sequence has no such destination item* rather than inventing a refusal, and therefore no new dictionary sentence. Written as a refusal and not an `expect`, because a total function's `None` arm is not a place to start panicking |
| `create_one_match`, `src-tauri/src/commands.rs` | none — `placement_of` builds an `After` only from the index `anchor_item` reads out of a match that same projection holds, so it is bounded by the file's own item count | the address becomes `Option<DocumentPath>` and is passed as `at: landed.as_ref()`. `at: None` is already how this layer says *this save has no match afterwards*, so the save still runs and reports `moved: None` — **no address rather than a wrong one**, and no new refusal, string or command |

`ItemMove::resulting_index` was checked too and needed nothing: its `anchor + 1` is guarded by the
`anchor < from` arm above it, so the successor exists whenever that arm is taken.

**The fold is untouched**, which is the property the confirmation pass had just verified and the
thing this fix most easily could have broken. `replay_item_positions` takes the same
already-derived `usize` anchors it always did and its body is unchanged, so claims are still grouped
in first-seen order, insertions still retain claim order, insertions at a given `before` count still
precede the original item, a claimed removal still suppresses that item, and the dressing step still
computes the same touched-subtree digest for every kept slot. The whole change is upstream of it, in
how the anchors are derived. Its doc comment now says why there is no arithmetic left in it to
overflow.

**Falsifiable, and measured rather than assumed.** Reverting `index.checked_add(1)` to `index + 1`
fails both new tests with *attempt to add with overflow*; restoring it and reverting only
`checked_add(removals.len())` to `+` fails
`insertion_landings_answers_nothing_when_the_arithmetic_names_no_index` alone, at the second of its
two assertions. Both halves were reverted and restored to see it.

**What the type system still does not enforce**, on top of §4.1's standing hole: nothing forces a
future cardinality-changing `DocumentEdit` variant to be accounted for here, because the filters
match with a wildcard; nothing bounds the replay's cost or its allocation for an `items_in_candidate`
that survives the three checks, so "checked arithmetic" must not be read as "total for every input the
signature accepts" — §4.1 says which of the two it is, in the sentence that says what *is* checked;
and nothing but this record and the doc comments says the empty vector is the *only* failure answer,
so a later derivation added beside these three could reintroduce a second convention without a test
noticing.
