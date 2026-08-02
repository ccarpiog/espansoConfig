# Phase 2b-2c-2 — decision record

`create_match` and `delete_match`, the ninth and tenth `#[tauri::command]`, over the `InsertItem`
and `RemoveItem` primitives Phase 2b-2c-1 shipped with no caller. **This application can now change
how many snippets a user's file holds**, and it does it through
`espansoconfig_core::persist::save_document` and through nothing else.

`save_raw_document` is untouched and remains 2b-2c-3's. No `SaveRequest` variant was added and
`save_document` gained no whole-text path.

The design authority is `docs/reviews/phase-2b-2c-2-design.md` (seven rulings), as amended by the
brief in one place — Q1's reasoning, corrected in §2.1. **Q6 was deferred when the phase was first
written and is delivered by the fix round**; §9 records that round, whose two findings come from
`docs/reviews/phase-2b-2c-2-code.md`.

---

## 1. What this phase built

| Piece | Where |
|---|---|
| `ItemPlacement { Front, After(usize), End }`, and `ItemPlacement::items_above` | `crates/espansoconfig-core/src/patch/edit.rs` |
| `InsertItem` re-shaped around it, plus `InsertItem::to_front` and `placement()` | same |
| `plan_item_insertion`'s front branch — `removal_span`, the call `plan_move` makes | same |
| `insert_item()` takes an `ItemPlacement` instead of an `Option<usize>` | same |
| `NewMatch { trigger, replace }` and `NewMatch::fields()` | `crates/espansoconfig-core/src/draft/new_match.rs` |
| `NewMatchPosition { Front {}, After { anchor }, End {} }`, the wire's three-valued position | `src-tauri/src/commands.rs` |
| `WorkspaceSession::create_match` / `delete_match`, and `create_one_match` / `delete_one_match` | same |
| `match_list_of()` and `placement_of()`, the two things this layer alone can refuse | same |
| `create_match` and `delete_match`, the two `#[tauri::command]`s | same |
| `CommandError::DocumentHasNoMatchList { document }`, with both sentences | `src-tauri/src/error.rs`, `src/lib/i18n/{en,es}.json` |
| `createMatch` / `deleteMatch`, `NewMatch`, `NewMatchPosition`, `DocumentHasNoMatchListError` | `src/lib/ipc/{commands,types,errors}.ts` |
| `every_edit_error_variant_crosses_as_an_object`, the check Q5 is conditional on | `src-tauri/src/wire_contract.rs` |
| **Fix round (§9):** `PresentationNote` as a union, and `removal_doubles_a_blank_separation` | `crates/espansoconfig-core/src/patch/edit.rs` |
| **Fix round (§9):** the `presentationNote` namespace, two sentences each in `en`/`es`, `PresentationNote`/`PresentationNoteName`, `presentationNoteKey`, `describePresentationNote`, `tPresentationNote` | `src-tauri/src/dictionary_contract.rs`, `src/lib/i18n/{en,es}.json`, `src/lib/ipc/types.ts`, `src/lib/i18n/{codes,index}.ts` |

**Neither command derives a batch.** Each builds exactly one primitive — one `InsertItem`, one
`RemoveItem` — hands it to the transaction and stops. That is `move_match`'s shape rather than
`save_match`'s, and for `move_match`'s reason: there is nothing to diff.

---

## 2. The decisions, each with its reason

### 2.1 D1 — `NewMatch` is closed, and both fields are mandatory

Consult ruling Q1, adopted. A `MatchDraft` was the alternative and is refused because it advertises
a structure creation cannot spell: a draft names twenty-two fields, four of them collections, and
`InsertItem` synthesizes **one flat block mapping with scalar fields**. A caller handed a draft
would learn the difference from a refusal instead of from the type. A raw `Vec<(String, String)>`
is refused by a rule that predates this phase — 2b-2b-2's D1 forbids this engine emitting a key
string no schema fixes — and the two keys are therefore spelled by `MatchField::key()` rather than
written out in `new_match.rs`.

**`replace` is mandatory on the ground that a trigger with no body is not a usable espanso match and
this application should not create one.** The consult's own justification — that `save_match` could
not later insert a missing `replace` — is **wrong**, and is not repeated anywhere in the code:
2b-2b-2's D1 permits exactly one insertion, *a schema-known scalar key into the match's own
mapping*, which is precisely what a later `replace` would be. The ruling stands on the other ground.

### 2.2 D2 — the front insertion is a planner operation, not an append-then-move

Consult ruling Q2, adopted whole. `InsertItem`'s `after: Option<usize>` had no spelling for *above
the first item* (2b-2c-1's hole 6), and widening the `Option` was not available: `ItemMove`'s `None`
already means the front, so one encoding would have meant two destinations depending on which edit
read it. `ItemPlacement` is therefore three values with three names.

The front destination is **`removal_span(…).start` on the first item's subtree extent** — the exact
expression `plan_move` evaluates for its own front — rather than a second derivation that agrees.
The consequence is the one that matters on a screen: a comment block belonging to the first snippet
stays with that snippet instead of being adopted by the new one.
`a_front_insertion_lands_where_a_front_move_lands` asserts the two offsets are equal, on a document
whose every item owns a leading comment.

**Append-then-move was rejected**, and R25 is why it could not even be one batch: a move may not be
combined with any other edit, so it would cost two transactions, two revision checks, two backups
and two acknowledgement rounds, and would leave an intermediate state on the user's disk between
them.

### 2.3 D3 — `create_match` targets the document's top-level `matches` value, by opaque identity

Consult ruling Q3. The target is `DocumentPath::root(0).with_key("matches")`, built from two
constants (`MATCH_LIST_KEY`, `LOADED_STREAM_DOCUMENT`) so that "which list does a new snippet join?"
has one answer. The document is named by `DocumentId` — never a wire `DocumentPath`, because
`WirePath` renders lossily and `wire_contract` records that two distinct filenames can arrive as one
string.

`match_list_of()` reads **`DocumentView::top_level_keys`**, not the syntax tree, and that is the
right source twice over: it is what the caller was shown, and it holds *decoded* key text, which is
exactly the comparison `resolve_full` makes when it walks the same path — so a document writing
`"matches":` in quotes is found by both or by neither.

### 2.4 D4 — a missing `matches:` key is a named `CommandError`, and a bare one is not

`CommandError::DocumentHasNoMatchList { document }`, in the **`Err`** channel, is 2b-2b-3's D1
applied unchanged: a planning-time refusal is one that no acknowledgement can move, and filing it
beside an overridable one invites a frontend to offer an *acknowledge and retry* button that can
never work. It is a struct variant, so it carries an operand rather than being a bare discriminant.

The refusal is not caution about a hard case; it is the licence running out. `InsertItem` may
synthesize *one flat block-mapping sequence item at a sequence-item boundary*, and adding a
`matches:` entry to the root mapping is a different edit that would have to choose where in the file
the key goes, what indentation its sequence takes, and which of the document's comments it lands
among — three layout decisions no primitive may make.

**A bare `matches:` is deliberately not this refusal**, and that is what lets the app create the
first snippet of a fresh file: the primitive promotes an implicit null into its first block-sequence
item. The two shapes are indistinguishable on a screen and produce opposite outcomes, so
`a_created_match_promotes_a_bare_matches_key` and
`a_document_with_no_matches_key_is_refused_by_name_and_writes_nothing` are written as a pair.

A document that **did not parse** reaches the refusal too, and honestly: it has no top-level keys at
all, and nothing can be said about the contents of a file the substrate rejected.

### 2.5 D5 — `delete_match` answers `moved: None`, and that is the routine correct answer

Consult ruling Q4. `SaveResult::Saved::moved` means *the new identity of the match acted upon*, and a
deleted match has none — by construction, not by accident. This is the first command for which
`None` is the ordinary answer rather than the defensive branch `after_a_save` documents.

**A neighbour's identity is not offered instead.** Doing so would overload one field with UI
selection policy, and worse, it would put a *position* back into the one field that exists to replace
positions with identities: "the snippet that is now where the deleted one was" is exactly the
reasoning `PROGRESS.md` R27 exists to stop. The caller re-reads the document and chooses.
`create_match`'s `moved` **is** the created match's identity, and it is the one answer no caller
could derive for itself — the snippet did not exist when the call was made.

### 2.6 D6 — the primitive is not pre-planned at the command layer

Consult ruling Q5. All eight of 2b-2c-1's named refusals — and every refusal `editable_sequence_item`
and `lift_item` make — are raised **inside** the transaction, under the lock, against the bytes the
transaction read, and arrive as `CommandError::SaveFailed { error: SaveError::Patch(EditError::…) }`.
Asking the planner a second time at this layer would resolve the document twice and let the command
layer and the transaction disagree about a file that changed in between.

What this layer refuses is only what it alone can see: the identities (`IdentityStaleRevision`,
`IdentityWrongDocument`, `MoveNotWithinOneSequence`) and whether the document names a match list at
all. Everything else is the core's.

The ruling was made **conditional** on the nested failure still crossing as a discriminated object,
and that check did not exist. `every_edit_error_variant_crosses_as_an_object` is it, and it asks the
question at both levels rather than one: `EditError` has 36 variants and `SaveError` has 9, and a
unit variant in *either* would cross as a bare JSON string, fail `isCommandError`, and show a user
the generic *something went wrong* in place of the sentence
`code.editError.removalWouldEmptyTheSequence` that both dictionaries already hold — which is
precisely the refusal a person meets by trying to delete the last snippet of a file. Both variant
sets are read out of the core's own source (D2w), so a unit variant added later fails the build.

### 2.7 D7 — an anchor is an identity, and it becomes an index in exactly one place

`placement_of()` is the only code that turns a `MatchId` into a sequence index, and it does it
through `addressed_item` — the same call `move_one_match` makes, against the same projection. A
creation's anchor therefore gets every refusal a move's anchor gets, by construction rather than by
agreement, and an anchor in another file is `IdentityWrongDocument` before anything is attempted
(D2r's reasoning, unchanged: a snippet is created in one document).

### 2.8 D8 — `NewMatchPosition` is a uniform object on the wire, and is not a code

Every arm is a **struct** variant, including the two that carry nothing, so `serde` writes
`{"Front":{}}` and `{"End":{}}` rather than the bare strings a unit variant would produce. That is
2b-2b-3's D5 applied to an inbound enum: one shape per wire enum is what lets the frontend type it
without a special case per variant, and it keeps the union out of
`every_typescript_wire_union_has_a_namespace`'s scan for the same reason `DraftError` is out of it.

It is registered in `NOT_A_CODE` with a reason, beside `DraftField`, because it is a **protocol tag**
travelling *into* a command rather than a code travelling out of one: nothing renders `Front`, and
its only operand is a `MatchId`.

---

## 3. The refusal taxonomy

One new `CommandError`. Everything else is reused, and each reuse is a decision rather than a
convenience.

| Refusal | Raised by | Channel | Because |
|---|---|---|---|
| `DocumentHasNoMatchList` | `create_match` | `Err` | **new.** The file names no `matches` key, so there is no list to join and no primitive may write one (D4) |
| `IdentityStaleRevision` | both | `Err` | the caller is acting against a parse this session no longer holds. Load-bearing for a deletion in its own way — see §4 |
| `IdentityWrongDocument` | `create_match` | `Err` | an anchor in another file (D7) |
| `MoveNotWithinOneSequence` | both | `Err` | the anchor, or the snippet to delete, could not be shown to be an item of the list. A **negative** claim, and the wording is already the negative one |
| `IdentityNoSuchMatch`, `UnknownDocument`, `NoWorkspaceOpen`, `Io`, `NotUtf8` | both | `Err` | inherited whole from the read path |
| `SaveFailed { SaveError::Patch(EditError::RemovalWouldEmptyTheSequence) }` | `delete_match` | `Err` | deleting the only snippet of a file. `matches: []` synthesizes a collection and a bare `matches:` is YAML null; neither is "remove one existing item" |
| `SaveFailed { SaveError::Patch(EditError::NoSuchDestinationItem { items: 0, … }) }` | the `InsertItem` primitive | `Err` | **added by the fix round (§9).** `ItemPlacement::After(k)` names an item of the *original* sequence, and an implicit-null `matches:` has none — the promotion creates the first one. Unreachable through `create_match`, which resolves an `After` anchor to a `MatchId` before it can ask, and refused anyway because the public core API must not accept an invalid coordinate |
| `SaveFailed` with any of 2b-2c-1's other seven insertion refusals | `create_match` | `Err` | raised inside the transaction, never pre-planned (D6) |
| `SaveResult::Refused` | both | `Ok` | the semantic gate found something. Expected, actionable, and answered by handing the findings back |
| `SaveResult::Conflict` | both | `Ok` | the file moved on under the lock. Nothing was written |

**`MoveNotWithinOneSequence` is reused for a deletion, and its English sentence is about a move.**
That is recorded as a hole (§6.4) rather than fixed: a second code would widen the wire, both
dictionaries, the TypeScript union and three contract tests for a condition that is unreachable
through either command as the projection stands — every match a `DocumentView` holds is an item of
the one `matches` sequence at the root of stream document 0.

---

## 4. The headline property

**`delete_match_never_deletes_the_item_at_a_stale_ids_old_path`**, the test the consult's Q7 named as
the highest-risk mistake this phase could make, written with that name.

A `DocumentPath` ending in an index is a **position**. Create a snippet at the front of a file and
every snippet below it shifts down one, so the path that named B a moment ago now names A perfectly
well — a `delete_match` that resolved a held identity's *path* against the new parse would delete A
and report success.

The test asserts the premise before the claim, so it cannot pass vacuously:

1. a file holds `:one` and `:two`; B's `MatchId` and the revision it was minted from are kept;
2. `create_match` puts `:new` at the **front**, and commits;
3. **the premise**: B's former path now resolves — to `:one`, the *other* snippet;
4. **the claim**: `delete_match` with B's stale identity and stale revision answers
   `identityStaleRevision`, the re-resolve instruction rather than a lookup miss;
5. **every byte** of the post-creation file is still there, and the snippet at the stale path is
   still there.

Beside it, five byte-exact command tests, each stating the **whole expected file** as a literal
rather than a proxy — a front insertion (with a comment block that must not change hands), an
after-insertion, an append, an insertion into a promoted bare `matches:` (with a second top-level key
below it), and a removal that takes the snippet's own leading comment and its inline comment and
leaves everything else alone.

The core suite gained the mirror of the same claims at the primitive level, including
`a_front_insertion_lands_where_a_front_move_lands` (D2), `every_placement_promotes_a_bare_key_to_the_same_bytes`
and a CRLF twin of the front insertion.

---

## 5. What was deliberately not done

- **No `force` flag, no acknowledgement bypass, no cached findings.** The acknowledgement travels out
  of a refusal and exactly those findings travel back in, matched as a multiset, for both new
  commands. `a_suspicion_refuses_a_creation_until_the_findings_come_back` drives the round trip.
- **No short-circuit for a batch of one.** Both commands go through the transaction, so the
  under-lock revision check runs (D3 of 2b-2b-3).
- **No second writer.** Neither command names `replace_file_atomically` or `replace_locked_file`.
- **No `SaveResult` variant.** Its wire shape did change in the fix round, and in exactly one place:
  `notes` still carries a list of `PresentationNote`, but a `PresentationNote` is now a tagged union
  rather than a flat object. No outcome, no operand and no discriminant of `SaveResult` itself moved.
  See §6.1.
- **No corpus fixture added, modified or removed.** Every document in every new test is a string
  constant in the test file, so `CLAUDE.md` §4's table of fifteen and `tests/corpus_integrity.rs` are
  untouched.

---

## 6. Holes this phase leaves open, and the one it closed

§6.1 is kept under its original number rather than moved, because §6.2 and every later phase that
reads this record refers to it. It records what was built; the rest of the section is still open.

### 6.1 The Hole 5 presentation note **is** emitted, and `PresentationNote` is a union to carry it

**Closed by the fix round (§9).** The brief's amendment 1 asked for a `PresentationNote` when a
deletion leaves two consecutive blank lines, emitted from the core planner, detected at the
`RemoveItem` planning level so that a move — which leaves the identical doubled blank at its origin —
keeps its documented *"notes are always empty for a move"* property. The phase as first written did
not deliver it, and the aggregate review reversed the deferral. What is built:

- **detection is local and cheap**, as the deferral itself had already established.
  `removal_doubles_a_blank_separation` reads `TriviaIndex::blank_runs` and asks, **per deleted run**,
  whether a blank run ends where it starts and another begins where it ends — both survive the
  deletion, so afterwards they are adjacent. **`lift_item()` is untouched**, and so is its signature
  and `ItemMove`'s output; the call sits in `plan_item_removal` and nowhere else;
- **the carrier was the blocker, and the carrier changed.** `PresentationNote` was
  `{ edit, from: ScalarStyle, to: ScalarStyle, reason: Option<NotReencodable> }` — a record of **one
  scalar's spelling** — and there is no honest `ScalarStyle` for "a deletion left two blank lines".
  It is now a **tagged union**: `ScalarRestyled` carries exactly the four operands the struct had,
  and `DoubledSequenceSeparation { edit }` carries only the edit it is about. Both are struct
  variants, so both cross as one-key objects (D5). It gained everything a wire enum owes — the
  `presentationNote` namespace in `CODE_ENUMS`, two English and two Spanish sentences, the
  `PresentationNote`/`PresentationNoteName` TypeScript pair, `presentationNoteKey`,
  `describePresentationNote`, `tPresentationNote`, and a place in `save_transaction_enums()` rather
  than in `save_transaction_structs()`.

**Neither blank line is collapsed**, and that is not a compromise: a blank line beside an item is not
the item's — plan section 6.2's rule 2 reads it to decide who owns a neighbouring comment — so
deleting one would remove user-owned trivia from outside the item. The bytes were already right; what
was missing was the disclosure, which is what §6.2 of the plan requires and what this note is.

Two tests state the two halves.
`a_deletion_between_blank_separated_snippets_leaves_both_blank_lines` still pins the bytes, and
`deletion_that_creates_doubled_separation_returns_a_layout_presentation_note` asserts the bytes
**and** the note in `SaveResult::Saved` **and** its one-key object on the wire, with the negative
beside it — the same deletion in a file with no blank line beside it reports nothing. The core has
the mirror in `a_removal_between_blank_separated_items_reports_the_doubled_separation`, with three
negatives: no blank line anywhere, nothing above the first item, nothing below the last.

### 6.2 A move leaves the identical doubled blank line and says nothing about it

The observation amendment 1 asked to be recorded, and **the removal side is now closed while the move
side is not**. `RemoveItem` and `ItemMove` share `lift_item`, so a move out of a blank-separated list
leaves exactly the same two consecutive blank lines at its source that a deletion does. After §6.1 a
deletion discloses it and a move still does not — deliberately, because `SaveResult::notes` is
documented as **always empty for a move** and that is a property of an already-shipped command's wire
behaviour. Changing it is its own step.

The asymmetry is pinned rather than left to drift:
`a_move_out_of_the_same_gap_still_reports_nothing` moves the very item whose removal produces the
note and asserts the empty list. A phase that gives the move its own disclosure has that test to
change, and the union `DoubledSequenceSeparation` already lives in is what it will reuse.

### 6.3 The real configuration exercises neither command

2b-2c-1's hole 2, unchanged and now one layer higher. Every document in every test of this phase is
written in the test file. Nothing has ever been inserted into or removed from a real espanso file by
this application, so the synthetic cases are that surface's only coverage.

### 6.4 A deletion can report a refusal whose sentence is about a move

`addressed_item` answers `CommandError::MoveNotWithinOneSequence` for a match this projection cannot
address as a sequence item, and `delete_match` reuses it. The code's own documentation is a negative
claim about sequence membership and reads correctly; the **dictionary sentence** said
*"espansoConfig moves a snippet only inside the list it is already in…"*, which is wrong for a
deletion. It is unreachable through either command today — every projected match is an item of the
one root `matches` sequence — so a second code was judged more expensive than the hole. A phase that
makes it reachable owes the split.

**Half-closed by the cleanup round (§10).** Three commands now raise this code — `create_match`
reaches it through `placement_of` for an anchor that is not an item of the list, and `delete_match`
through `addressed_item` — so a person pressing **delete** was being shown a sentence about
**moving**, in both languages. Both sentences were rewritten to describe the *address* rather than
the operation, and the Rust and TypeScript doc comments were corrected to say that three commands
raise it. What is still open is the **name**: `MoveNotWithinOneSequence` is narrower than what the
code means, and renaming it is a wire change. It is recorded as a follow-up in §6.11 rather than done
in passing.

### 6.5 `NewMatch` is two fields, and espanso matches are not

A created snippet holds `trigger` and `replace` and nothing else — no `label`, no `word`, no
`vars`, no regex trigger, no form. Everything else is reached by editing the snippet afterwards
with `save_match`, which can insert a schema-known scalar key into the match's own mapping. If a
non-text body is ever wanted, the consult's own instruction is to widen this into a **closed body
enum** rather than to open the struct.

### 6.6 The three new codes and both new wire types have never been drawn on a screen

`code.commandError.documentHasNoMatchList` has key parity, placeholder parity and a compile-checked
accessor, and no component produces it because no component calls `createMatch` yet. `NewMatch` and
`NewMatchPosition` are typed and unused. This is hole 1 of `2b-2b-3-notes.md` and hole 9 of
`2b-2c-1-notes.md`, restated with two more entries — and it stays open until Phase 2c builds the
editor screen.

### 6.7 One more Spanish sentence checked only by heuristic

`code.commandError.documentHasNoMatchList`'s Spanish value. Nothing establishes that it is
idiomatic. Hole 9 of `1b-1-notes.md`, one entry larger — and it is the first of them to interpolate a
YAML token (`matches:`) into prose, which is deliberate: the key is the same word in every language
and the user has to type it.

### 6.8 `create_match` counts the projection's matches to find the end of the list

`ItemPlacement::End` needs the index the new item will take, and the command layer derives it from
`view.matches.len()`. That is the sequence's own item count rather than an approximation — a
`matches` entry the schema does not recognise still produces one `MatchView`, recorded by span and
not descended into — but it is a property of the projection rather than of the patch engine, and it
is the one number in this phase that the engine does not hand back. It only affects the identity
answered in `moved`: a wrong count could not misplace a byte, because the placement the engine acts
on is `ItemPlacement::End` and not the number.

**Sharpened by the cleanup round (§10): "only the identity" is not "only cosmetic", and the failure
mode has a name.** The count the command layer holds and the count the planner holds agree today for
exactly one reason — the projection maps **1:1** over the sequence's items. Nothing enforces that. If
the projection ever drops or merges an entry — a merge key, an anchor or alias item, a malformed item
recorded whole rather than as one `MatchView` — the two counts diverge, the landing index points one
slot off, and `after_a_save` looks up **a different existing snippet** at that path and mints its
identity. The save is a **success**, the bytes are correct, and the answer is a `MatchId` naming a
snippet the user never touched; the window then edits or deletes that one. Nothing fails. The
identity simply lies, and there is no assertion anywhere that would catch it.

The cleanup round narrowed the arithmetic to one spelling — `ItemPlacement::items_above` is now
public and `create_one_match` calls it instead of re-implementing its three arms (§10) — but
deliberately did **not** change where the *count* comes from, because the honest fix is a design
change: the transaction already builds `PendingItem { inserted: Some((before, …)) }` while planning,
so it can **report where the item landed** and the command can count nothing at all. That is its own
step, with its own review.

### 6.9 The doubled-separation note is wired to one of the two removal planners

Found by the cleanup round (§10), recorded rather than fixed, because closing it changes what a save
answers.

`removal_doubles_a_blank_separation` is written **generally**, over *"a removal's runs"* — it reads
`TriviaIndex::blank_runs` and asks whether a blank run ends where a deleted run starts and another
begins where it ends. Nothing in it is about sequence items. But only `plan_item_removal` calls it;
`plan_removal`, the **mapping-entry** removal planner, still hardcodes `note: None`.

**This is reachable today, and not through some future command.** `save_match` → `plan_match_edits`
emits a `FieldRemoval` whenever a draft clears a field (`DraftField::Remove`), and clearing a field
that has a blank line above it and a blank line below it leaves the identical doubled gap a deletion
leaves — with **no** disclosure. So plan §6.2's *never silently normalise* is kept for one removal
primitive and broken for the other, and §6.1's whole argument applies unchanged to the half that is
missing.

The fix is not "call the same function from the second planner", because that would be the third
place the condition is computed from runs. It is to compute the condition **where the runs are
produced** and hand it to each planner as a fact, and to rename the variant to something
operation-neutral — `DoubledBlankSeparation` — so that `plan_removal`, and the move when §6.2's half
is decided, emit the same note rather than a near-duplicate of it. Both halves are wire changes: a
new note on a save that answered none, and a renamed enum variant with its two dictionaries.

### 6.10 `match_list_of` answers a weaker question than the model's, and re-spells the schema

`MATCH_LIST_KEY = "matches"` and `LOADED_STREAM_DOCUMENT = 0` in `src-tauri/src/commands.rs` restate
what `crates/espansoconfig-core/src/model/document.rs` already owns: `MATCH_FILE_KEYS` names the key,
`project_match_file` decides what it means, and it already builds the very path the command
reconstructs — `matches_path`, handed to `project_sequence` for every `MatchView`. Two spellings of
one schema fact, in two crates, and the plan's architecture rule says which crate owns it.

**The question the two ask is not the same, and the command's is weaker.** `match_list_of` succeeds
whenever the decoded key exists in `top_level_keys`. The model distinguishes a `matches:` **modelled
as a sequence** from a `matches:` **skipped by shape** (`skip_shape`, for a value that is not a
sequence). So `documentHasNoMatchList` means *no key*, and a document whose `matches:` is a scalar or
a mapping sails past the command's gate and is refused inside the transaction as
`saveFailed { error: Patch(NotASequence { … }) }` — a typed refusal, so nothing is lost to a user,
but the layer that exists to refuse what only it can see fails to see it.

The fix is for `DocumentView` to **publish the match-list path**, set where `project_match_file`
already computes it, plus a distinct state for *the key is there and is not a list*. The command then
reads a fact instead of rebuilding one, and the third state gets its own code instead of arriving as
a failed save.

### 6.11 The wire vocabulary for a position is split in two

`move_match` takes `after: Option<MatchId>`, where `null` means *the front*. `create_match` takes the
three-valued `NewMatchPosition`, whose own documentation diagnoses the `Option` encoding as the trap
it was built to avoid — and then leaves that trap in place next door. The result is that one boundary
spells *where does this snippet go* two different ways, and the two disagree about what `null` is
allowed to mean.

**"Move to the bottom" has no spelling at all.** A window that wants it must find the file's last
match itself and pass that identity as an anchor — which is exactly the positional reasoning
`MatchId` exists to keep out of the window, reintroduced because the vocabulary is missing a word.

The fix is one wire type — `MatchPosition`, three-valued, uniform-object-encoded — used by **both**
commands, and `ItemMove` taking an `ItemPlacement` the way `InsertItem` already does. That makes the
core's two item primitives agree about destinations as well, which is the same consolidation §6.9
asks for on the note side.

**The `MoveNotWithinOneSequence` rename belongs to this step** (§6.4). Three commands raise the code
and only one of them moves anything; the sentences were corrected in the cleanup round, but the code
itself is a wire value, shared by the Rust enum, the TypeScript union, the operand table, both
dictionaries and every `@returns` that names it. Renaming it with the position vocabulary means one
wire change instead of two.

---

## 7. Deviations from the brief, recorded rather than hidden

1. **`insert_item()`'s signature changed**, from `after: Option<usize>` to `at: ItemPlacement`. The
   brief authorised extending `InsertItem`'s destination; leaving the convenience entry point on the
   two-valued `Option` would have left the crate with two spellings of the same question, one of them
   unable to ask for the front. Nineteen call sites in `tests/patch_item.rs` moved mechanically; no
   assertion in that file changed.
2. **`every_command_refuses_before_a_workspace_is_open` grew from six methods to nine.** The test's
   name claims *every*, and `save_match` had been missing from it since 2b-2b-3. The two new
   commands were added and so was `save_match`.

---

## 8. Verification

Both rows of counts are after the fix round of §9.

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **983 passed, 0 failed** (979 before the fix round, 959 before the phase) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm test` | **700 passed, 0 failed** (698 before the fix round, 696 before the phase) |
| `npm run check` | 376 files, **0 errors, 0 warnings** |
| `git status --short --untracked-files=all` | no path under `tests/corpus/real/` |

The phase's +20 Rust tests are five in `tests/patch_item.rs`, two in
`crates/espansoconfig-core/src/draft/new_match.rs`, eleven in `src-tauri/src/commands.rs`, one in
`src-tauri/src/dispatch_check.rs` and one in `src-tauri/src/wire_contract.rs`. Its +2 frontend tests
are the two argument-shape cases in `src/lib/ipc/commands.test.ts`. No existing test was deleted or
weakened; four counts moved —
`commandError` 15 → 16, the registered command surface 9 → 11, the remote-origin sweep 9 → 11, and
`COMMAND_ERRORS` in `codes.test.ts` 15 → 16 — and each moved by exactly what this phase added.
`FORBIDDEN_COMMANDS` shrank from four names to two, which is the only way a name may leave it: the
command exists, is registered, and writes through the save transaction.

The fix round's +4 Rust tests are three in `tests/patch_item.rs`
(`a_promotion_refuses_every_after_anchor`,
`a_removal_between_blank_separated_items_reports_the_doubled_separation`,
`a_move_out_of_the_same_gap_still_reports_nothing`) and one in `src-tauri/src/commands.rs`
(`deletion_that_creates_doubled_separation_returns_a_layout_presentation_note`). Its +2 frontend
tests are one `it.each(LOCALES)` case in `src/lib/i18n/saveCodes.test.ts`. One test was **renamed
and narrowed** — `every_placement_promotes_a_bare_key_to_the_same_bytes` became
`front_and_end_promote_a_bare_key_to_the_same_bytes`, because the third placement it asserted was
the defect. Four pinned counts moved, each by exactly what the fix round added: the wire's variant
total 173 → 175, its struct-variant total 102 → 104, the placeholder sweep 173 → 175, and the
TypeScript-union floor 43 → 44.

---

## 9. The fix round, and what each finding cost

Both findings come from the aggregate code review, `docs/reviews/phase-2b-2c-2-code.md`, whose
readiness verdict was **NOT READY** on the first of them. Neither is a defect in bytes already
written to a user's file; both are the public surface promising something it did not deliver.

### 9.1 Finding 1 (Medium) — the Q6 layout note is now emitted

The review agreed with the deferral's diagnosis and reversed the deferral anyway, on the ground the
deferral itself could not answer: *a backend test cannot make a UI "not surprised"*. Plan section 6.2
forbids this application making an unrequested presentation change silently, `SaveResult::Saved::notes`
is the channel for exactly that, and pinning the bytes disclosed nothing to the person who pressed
delete.

The fix is the review's own prescription and nothing more. `PresentationNote` became a tagged union;
`plan_item_removal` detects the condition locally through `removal_doubles_a_blank_separation` and
carries it out through `PatchedDocument` and `SaveResult`; the command wrapper does **not**
re-inspect or reconstruct layout, because the planner is the only component that can identify the
condition. Neither blank line is collapsed. §6.1 has the whole shape and §6.2 the half deliberately
left open.

### 9.2 Finding 2 (Low) — an implicit-null `matches:` refuses every `After(_)`

`plan_item_insertion`'s implicit-null branch accepted `ItemPlacement::After(0)`, and
`every_placement_promotes_a_bare_key_to_the_same_bytes` codified all three placements as equivalent
there — the nonexistent anchor included. That contradicts `After(usize)`'s contract, which is *after
the item at this index in the **original** sequence*, and an implicit-null value has zero items.

It is Low because `create_match` cannot reach the state: an `After` position resolves a `MatchId` to
an index through `addressed_item` first, so an anchor that does not exist is refused a layer earlier.
The public core API accepted the invalid coordinate anyway, and now returns
`EditError::NoSuchDestinationItem { items: 0, … }` — the refusal that already existed for an
out-of-range anchor on a real sequence, which is the honest one here because zero items is exactly
what an implicit null has. `Front` and `End` are still accepted and are still proven to produce the
same bytes.

---

## 10. The cleanup round

**Quality only, no behaviour change but one.** After commit `8d223fc` this phase's diff was read by
**four independent code-quality reviews**, whose findings were deduplicated into one pass. Nothing
here fixes a defect in bytes written to a user's file; every item is duplication, a claim a doc
comment could no longer support, or a cost paid for nothing. The one intended user-visible change is
the pair of sentences in §6.4.

**What changed in the code:**

1. **The save-transaction tail is one function.** `run_one_save` in `src-tauri/src/commands.rs`
   replaces the ~28 lines that `move_one_match`, `save_one_match`, `create_one_match` and
   `delete_one_match` each carried: the context clone, the `SaveRequest` literal, and the four-arm
   `match save_document(request)`. Flagged by three of the four reviews, and the drift they predicted
   had already started — `delete_one_match` had lost the *"Never `None`. See `WorkspaceSession::open`"*
   comment its three twins carried. It is documented as the one place the cache-coherency policy
   (evict on `may_have_written`) lives, and a fifth writing command must call it rather than copy it.
2. **Two smaller repeats in the same four methods went with it.** `view_at` is the stale-revision
   refusal, written once; each call site keeps its own explanatory comment, because the *reason* a
   stale revision is fatal differs per operation. `WorkspaceSession::with_open` is `with_workspace`'s
   sibling for the writing half, so the *no workspace is open* refusal and the guard destructure are
   also written once.
3. **`ItemPlacement::items_above` is public, and `create_one_match` calls it.** The command layer had
   a hand-written three-arm match that was character-for-character the body of a function whose own
   documentation claimed to be *"the one place the three cases are turned into it"* — a sentence the
   copy made false. Flagged by all four reviews. `ItemMove::resulting_index` is public for exactly
   this reason and `move_one_match` already used it, so the two item primitives now answer *where did
   it land* the same way. **Where the count comes from did not change**; see §6.8.
4. **`InsertItem::at(sequence, placement, fields)` is the primary constructor.** Both `insert_item`
   in the core and `create_one_match` destructured an `ItemPlacement` only to pick one of three
   constructors that stored the same value back. The three named constructors are kept — they read
   well at their call sites and the test suite uses them heavily — as one-line sugar over `at`.
5. **`anchor_index` is the one place an identity becomes an index.** `placement_of` claimed to be
   that place while `move_one_match` ran the same three gates in the same order beside it. Its doc
   comment now says what it does. Two sub-points were verified against the code before acting, and
   both held: `placement_of`'s `document` parameter was `view.id` at its only call site and is gone,
   and the explicit `anchor.document != document` check was **exactly** redundant —
   `DocumentView::match_by_id` compares the same two operands first, and `From<IdentityError>` turns
   its `WrongDocument` into a byte-identical `CommandError::IdentityWrongDocument`. It is removed
   from both.
6. **`PresentationNote::edit()` is deleted.** Zero callers anywhere in the workspace; both variants
   already expose `edit` as a public field. Public API bought for a caller that does not exist.
7. **The wire-contract tests read `patch/edit.rs` twice instead of four times.**
   `variants_and_unit_variants_of` answers both questions from one read and one parse;
   `unit_variants_of`, left with no callers, is gone.
8. **`after_a_save` no longer clones a whole `DocumentView` per save.** A `DocumentView` owns every
   trigger and every `replace` body of its file, and the clone existed only to end a borrow before
   `workspace.evict` — so that two lines later one `MatchId` could be read out of it. A flag ends the
   borrow just as well. `delete_one_match` passes `at: None`, so the clone was allocated and dropped
   entirely unread on every deletion. The conditions are unchanged: `committed`, revision equality,
   and eviction on a failed refresh.
9. **The `moveNotWithinOneSequence` sentences describe the address, not the operation** (§6.4). Both
   dictionaries, plus the Rust and TypeScript doc comments. The enum variant is **not** renamed; that
   is a wire change and is recorded in §6.11.

**What changed in the tests** (no test was deleted and no assertion was weakened): `expect_created`
was collapsed into `expect_saved` with the operation parameterised, and four call sites that
destructured `SaveResult::Saved` inline to re-assert the same three facts now route through it;
`opened_on` replaces the four-line *tree, session, identity, projection* preamble twelve tests
opened with; `tree_holding` and `base_bytes` moved up beside `open_session` and `id_of`, and
`suspicious_tree()` is now `tree_holding(SUSPICIOUS_YML)`; and `opened_over_ipc` in
`src-tauri/src/dispatch_check.rs` replaces the twenty-two-line mock-application preamble four tests
opened with.

**What was recorded rather than done:** §6.8's sharpening, and §6.9, §6.10 and §6.11. Each is a
behaviour or design change that deserves its own step and its own review, not a cleanup pass.
