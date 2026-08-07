# Phase 2c-4b-1 — decision record

**Cross-revision correspondence as a core primitive, and its answer on the conflict payload — with
no control, no choice and no behaviour change anywhere.** `crates/espansoconfig-core/src/reconcile.rs`
is new; `SaveResult::Conflict` gained a sixth operand; **all six** writing commands build the question
before the transaction and `conflict_after_the_lock` computes the answer from the same fresh snapshot
as `disk_revision`. The question is a `ReapplyRequest` with **two** operands — the operation's own
item and the item it is placed after — and the answer is a `ReapplyEvidence` with one resolution for
each. **No `.svelte` file was touched, no command was added, no `ConflictChoice` gained a member, and
`conflictChoicesFor` is byte-for-byte as it was.**

The authority for this step is `docs/reviews/phase-2c-4b-design.md` — the design consult. It
discharges the "### 2c-4b-1" subsection of that document's **Q8**, under the rulings of **Q2** (the
tiers), **Q3** (where the algorithm lives), **Q4** (per-surface confidence) and **Q5** (what must not
be built), and it takes **Q9 item 2** as its central constraint. Where this record and that document
disagree, the consult is right and this is a bug.

---

## 1. What this step built

| File | What it is |
|---|---|
| `crates/espansoconfig-core/src/reconcile.rs` | **new.** `ReapplyAnchor`, `TriggerFingerprint`, `ReapplyConfidence`, `ReapplyMode`, `PlacementMode`, `ReapplyRequest`, `ReapplyRefusal`, `ReapplyResolution`, `ReapplyPlacement`, `ReapplyEvidence`, `ReapplyAnchor::capture`, `ReapplyMode::anchored`, `PlacementMode::anchored`, `reconcile`, and seven unit tests |
| `crates/espansoconfig-core/src/lib.rs` | `pub mod reconcile;`, the module-map row and the phase-status paragraph |
| `crates/espansoconfig-core/src/patch/edit.rs` | `item_owned_runs`, a `pub(crate)` wrapper over the existing private `entry_owned_runs` with the item's node as both key and value — the call the removal guard and the duplicate oracle already make |
| `crates/espansoconfig-core/src/patch/mod.rs` | `pub(crate) use edit::item_owned_runs;` |
| `crates/espansoconfig-core/tests/reconcile.rs` | **new.** 25 acceptance tests: the eight named rewrites, three positives, four snapshot-level refusals, six placement cases, and the two corpus sweeps |
| `src-tauri/src/save.rs` | `SaveResult::Conflict::reapply: ReapplyEvidence`, its documentation, the module paragraph, `operand_count` 5 → 6 for that arm, the hand-written `Serialize` field, and the `every_save_result()` fixture's two `Identified` arms |
| `src-tauri/src/commands.rs` | `view_at` → `document_at` (a `&SourceDocument`, not a `&DocumentView`); `item_address` takes a resolved `MatchView` and `addressed_item` is gone; `anchor_index` → `anchor_item`, which answers the anchor's projection beside its index; `placement_of` answers the anchor it resolved; the `OneSave` request struct; `run_one_save` and `conflict_after_the_lock` carry a `ReapplyRequest`; six commands build one; the module paragraph |
| `src-tauri/src/dictionary_contract.rs` | three `CODE_ENUMS` entries, three `VARIANT_COUNTS` rows, and the paragraph saying why they are codes |
| `src-tauri/src/wire_contract.rs` | `reapply_refusal_samples`, `reapply_resolution_samples` and `reapply_placement_samples`, all registered in `save_transaction_enums`; `ReapplyEvidence` in `save_transaction_structs`; `tagged_variant_fields` reads a payload that is **exactly** `Record<string, never>`, and nothing else, as a checked empty payload, with `one_variant_union` and `only_the_exact_empty_payload_spelling_is_a_checked_zero_field_payload` as its own parser test; and the non-vacuity counts moved: 189 → 205 variants, and `(checked, nested, unit)` 115/12/62 → 122/12/71 |
| `src/lib/ipc/types.ts` | `ReapplyRefusal`, `ReapplyResolutionName`, `ReapplyResolution`, `ReapplyPlacementName`, `ReapplyPlacement`, `ReapplyEvidence`, `ConflictResult.reapply` |
| `src/lib/i18n/{en,es}.json` | sixteen keys per language, 729 → 745 |
| `src/lib/i18n/codes.ts` | `reapplyResolutionKey`, `reapplyPlacementKey`, `reapplyRefusalKey`, `describeReapplyResolution`, `describeReapplyPlacement`, `describeReapplyRefusal` |
| `src/lib/i18n/index.ts` | the six re-exports and the reactive `tReapplyResolution` / `tReapplyPlacement` / `tReapplyRefusal` |
| `src/lib/i18n/reapplyCodes.test.ts` | **new.** 16 cases, exhaustive over all three enums by `ExpectNever`/`Missing` |
| 17 test files | `reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } }` added to every `ConflictResult` literal, because the field is required and TypeScript said so |

**No fixture under `crates/espansoconfig-core/tests/corpus/` was touched**, none was added, and
`CLAUDE.md` §4's table is unchanged: every case in `tests/reconcile.rs` is a hand-authored, neutral
string literal in the test file itself.

---

## 2. The decisions

### 2.1 D1 — the anchor is made before the transaction, and only the answer comes from the fresh read

This is Q9 item 2, and it is the whole shape of the change. `conflict_after_the_lock` runs **after**
`Workspace::refresh` has replaced the session's cached snapshot, so anything derived there describes
the bytes that *caused* the conflict, not the bytes the person was working on. A `reconcile` call
that fetched its own "base" would therefore be a perfectly correct algorithm resolving the wrong
observation.

So the question and the answer are separated in time and in place:

- each command calls `ReapplyMode::anchored(base, found, …)` — and, where it names one,
  `PlacementMode::anchored(base, anchor)` — while it still holds the `&SourceDocument` that
  `document_at` validated `base_revision` against;
- the resulting **owned `ReapplyRequest`** travels through `run_one_save` into
  `conflict_after_the_lock`;
- that function calls `reconcile(reapply, fresh)` **once** between taking `fresh.source` and cloning
  `fresh.view`, so all four operands of the payload — and both halves of the evidence — come out of
  one `SourceDocument`.

**What Rust forces and what it does not.** It forces that `reconcile` cannot read a snapshot the
caller did not hand it, and — separately — `ReapplyAnchor::capture` refuses any `MatchView` whose
`id.document` or `id.revision` is not the handed-in snapshot's, so an anchor captured from a
refreshed cache is a `NoAnchorInBase` rather than a wrong answer. It does **not** force that
`conflict_after_the_lock` computes the answer from the same snapshot as the text: `SaveResult::Conflict`
is an ordinary struct variant and Rust ties no field to another. What holds that is the same thing
that already held it for `disk_text` — **one production construction site**, named in that function's
own doc comment.

**And one test, since the review round.** `a_conflicts_anchored_answer_is_of_the_fresh_read` captures
a real anchored request from R0, provokes a real conflict with R1, replaces the file with R2 and then
builds the payload — with R1 and R2 chosen so that the *same* anchors resolve differently in each
(R1 answers `AmbiguousTrigger` for the subject and `NoExactCorrespondence` for the placement; R2
identifies both). It asserts that both halves are R2's and that the identified subject's own
`id.revision` equals `disk_revision`. Before it, the only test that reached
`conflict_after_the_lock` directly passed the anchorless `Unsupported` mode, which never reads a
snapshot at all — so an implementation that answered the anchored question from the wrong
observation would have left every test green.

### 2.2 D2 — two confidence policies, and the item index is never a tie-break

`ReapplyConfidence::ExactItem` for a move's, a deletion's and a duplication's subject;
`ReapplyConfidence::ExactItemOrUniqueTrigger` for a drafted match save, and for nothing else. A
**placement** takes no confidence at all: `PlacementMode` has no such parameter, and
`reconcile_placement` resolves at exact item correspondence, always.

**What the type forces and what it does not.** `ReapplyMode::anchored` accepts either confidence for
any target, so nothing in `reconcile.rs` stops a caller selecting the weaker policy for a
destructive operation. What enforces the mapping is the command layer — one call per command, each
with the comment saying why — and the tests over it. The record said the opposite for one round
("a property of what the operation would then do to the item"), which was a guarantee the code did
not give.

The tier walk is Q2's, in Q2's order, in `resolve()`:

1. document identity, a parsed snapshot, and at least one item at the anchor's sequence address;
2. the **owned-run** digest — one is an identification, more than one is `AmbiguousExact`, none
   continues, or refuses with `NoExactCorrespondence` for `ExactItem`;
3. the **mapping-slice** digest, editor only — one is an identification, more than one is
   `AmbiguousExact`, none continues;
4. the **trigger fingerprint**, editor only, required unique in the base sequence *and* in the fresh
   one.

`ReapplyAnchor::item_index` exists and is read by **nothing** in the decision path. The test
`the_old_index_is_carried_but_never_consulted` (in the module) and
`a_reordered_sequence_identifies_the_item_and_not_its_former_index` (in the acceptance file) are
what say so rather than the comment above them: both reorder a two-item sequence and check that the
item, not the index, is what comes back.

**What no test can establish**: that a future tier will not be added below tier 4. The refusals are
exhaustive over what is written today, and nothing in the type system says a fifth tier would be
wrong.

### 2.3 D3 — the trigger fingerprint is the **source spelling**, in source order

Not the resolved value (D2u), and not `TriggerSpec::primary()`. `trigger_fingerprint()` walks the
match mapping's own entries through `crate::model::mapping_entries` — which is source order — and
records, for every occurrence of `trigger`, `triggers` and `regex`, the **decoded key** and the value
node's **source bytes verbatim**, length-prefixed. A duplicate key is recorded twice, because the
file writes it twice.

The consequence is deliberate and is asserted: `a_respelled_trigger_is_not_the_same_trigger` shows
that a formatter rewriting `':one'` as `":one"` produces `TargetMissingOrTriggerChanged`. The consult
predicted exactly this ("a wholesale formatter that respells every trigger therefore produces an
honest refusal") and it is the conservative direction.

The key is decoded and the value is not, and that asymmetry is on purpose: which key an entry *is* is
already a decoded-text question everywhere else in this crate (the path resolver compares decoded
keys), while what the value *says* is a claim D2u forbids this crate to make.

### 2.4 D4 — the evidence is digested, never carried

Every field of `ReapplyAnchor` that describes bytes is a `ContentRevision` over a domain-separated
input, so an anchor never holds a copy of the owner's configuration text (`CLAUDE.md` §1). The
domains are three distinct constants, so two tiers cannot compare equal through a coincidence of
their inputs.

**Each owned run is length-prefixed before hashing.** Concatenating the runs alone would let two
different *splittings* of the same text hash equal — and the splitting is exactly what changes when a
comment changes hands, which is the case tier 2 exists to see.

**What a digest does not exclude is a SHA-256 collision.** The guarantee is hash equality, never
byte identity, and that is the same statement `disk_text`'s pairing already rests on.

### 2.5 D5 — the ownership rule has one implementation, and `reconcile` reads it rather than restating it

`item_owned_runs` in `patch/edit.rs` is a `pub(crate)` wrapper over `entry_owned_runs`, which is the
textual derivation the removal guard bounds runs by and the duplicate's oracle compares its clone
against. `reconcile` hashes what that function answers. A change to what an item owns therefore
changes the correspondence **by construction**, not by two copies of a rule agreeing.

It is `pub(crate)` and not `pub`: a run is a byte offset into one parse, and handing one across the
IPC boundary would be handing out a position again — the exact thing this module exists because
positions cannot do.

### 2.6 D6 — `ReapplyMode` has four arms, and `Refused` is one of them

*"No anchor could be captured"* is a fact about the **base** snapshot and is known before the
transaction runs. Folding it into a `ReapplyMode::Refused(ReapplyRefusal)` there keeps `reconcile` a
total function of a mode and a snapshot, with no second failure channel and no `Result` for a caller
to discard.

It is reachable rather than defensive: `save_match` is the one writing command that does **not**
require its target to be an item of a sequence, so a match the projection carries no
sequence-item path for produces `NoAnchorInBase` on that path and nowhere else.

### 2.7 D7 — `targetless` and `unsupported` are two facts, and a creation's `after` is a **placement**

Q3 says not to collapse `targetless` and `unsupported`, and they are not. `create_one_match`'s
*subject* is `Targetless` whatever its placement is — a creation brings its own snippet and names no
existing one — while `save_one_raw_document`'s is `Unsupported`, permanently and by construction
rather than for want of an implementation.

**Where a creation's `After { anchor }` is answered changed at the review round.** It used to be
captured as the *subject*, which is what the consult's single-resolution sketch allowed; it is now a
`PlacementMode`, the same operand a move's `after` is. The reason is the review's High finding turned
around: once a move answers a subject and a placement separately, a creation whose anchor sat in the
subject slot would mean `Identified` had two meanings depending on which command produced it — the
exact conflation the finding names.

### 2.8 D8 — the evidence crosses as two one-key objects inside one struct; a refusal crosses as a bare string

`ReapplyEvidence` is an ordinary struct and crosses as `{"subject":…,"placement":…}`.
`ReapplyResolution`'s four variants and `ReapplyPlacement`'s three are all struct variants, including
the empty ones, so `serde`'s externally tagged representation writes `{"Targetless":{}}` and
`{"NotAnchored":{}}` rather than the bare strings unit variants would produce. That is the rule
`NewMatchPosition` and `DraftError` already follow (`2b-2b-3-notes.md` D5): one shape per wire enum is
what lets a frontend type-guard it without a special case per variant. `ReapplyRefusal` is all unit
variants and crosses as a string, exactly as `MoveSeam`, `DuplicateSeam` and `SaveVerdict` do — it is
carried *inside* the tagged arm, so it needs no tag of its own.

**Two enums rather than one reused, and the empty arms are why.** `ReapplyResolution::Targetless`
says *this change brings its own snippet*; `ReapplyPlacement::NotAnchored` says *this change is not
placed after a named one*. They are two facts about two slots, and one set of sentences for both
would be untrue of one of them — the same argument that kept `Targetless` and `Unsupported` apart.
`reapplyCodes.test.ts` asserts that no placement sentence is any subject sentence, in both languages.

**Deviation from the consult's sketch, recorded rather than hidden.** Q3 writes the identified arm as
`{ kind: "identified", match: MatchView }` and gives the payload one resolution. What shipped is
`{ Identified: { target: MatchView } }` inside a two-field evidence struct: the tag convention is the
core's own rather than a `kind` discriminant (the shell/cargo split `save.rs` §"The wire convention"
states), the field is `target` because `match` is a Rust keyword and `r#match` on a wire type buys
nothing, and the second slot exists because Q4 requires a move's `after` to survive only when its
anchor has unique exact owned-run correspondence — a fact no consumer can derive from a stale
`MatchId` or from the subject's projection. The `MatchView`s are boxed, for the reason
`SaveResult::Conflict::disk` is; `Box<T>` serializes as `T`, so the wire shape is unaffected.

### 2.9 D9 — `OneSave`, because `run_one_save` reached eight parameters

Adding `reapply` took it past clippy's `too_many_arguments` threshold, and this repository carries no
`#[allow(clippy::…)]` anywhere. The parameters are now a struct whose fields are **named at the call
site**, which is worth more here than the argument count: three of them are `Option`-or-scalar values
of similar shape, and a positional mistake between them would compile. The shape mirrors
`espansoconfig_core::persist::SaveRequest`, which is what `run_one_save` turns most of it into.

`run_one_save` remains the single tail every writing command takes, and `save_document` remains the
only entry point that writes.

---

## 3. What this step deliberately did **not** do

- **No control, no choice, no capability.** `ConflictChoice` is unchanged, `conflictChoicesFor` is
  unchanged, `ConflictCapabilities` is unchanged, and no `.svelte` file was touched. `keepMyDraft` is
  not a word anywhere in the source tree.
- **No adoption, no rebasing, no request rebuilding.** `adoptDiskVersion` and every browser model are
  untouched. `ConflictModel` gained no field: it already carries the whole `ConflictResult` as
  `source`, so 2c-4b-2 can reach `source.reapply` without a wire change.
- **No new command, no `force`, no second writer.** Twelve commands, six of them writing, exactly as
  before.
- **No behaviour change of any kind.** The only way a running window differs is that a conflict's IPC
  response carries one more JSON property that nothing reads.

---

## 4. What this step does not cover, stated as holes

### 4.1 The evidence answers two operands, and only two

**Closed at the review round; kept as the record of what the shape now claims.** A
`ReapplyEvidence` answers a subject and a placement, which is every identity the six writing
commands can name today: a move's moved item and its `after` anchor, a deletion's and a
duplication's item, a drafted save's item, and a creation's `after` anchor. It does **not**
generalise. An operation that named a third identity — a cross-sequence move, say, which D2r
forbids — would need a third operand, and nothing in the type system would notice its absence.

### 4.2 "Multiple sequences" is reached by re-addressing a candidate, not by a fixture

The consult asks for a multiple-sequence case, and `two_sequences_of_one_document_are_two_sequences`
(in the module) and `a_moves_anchor_in_another_sequence_is_not_its_anchor` (in the acceptance file)
are it. Today's projection exposes exactly one match list per document (`DocumentView::matches` is
the top-level `matches` key), so **no file can be written that produces two**; both tests therefore
clone a snapshot and move one candidate's public `MatchView::path` under a different sequence head,
which is all `in_sequence()` reads.

The premise is asserted first in the module test: with both twins under `matches`, the anchor is
`AmbiguousExact`, and it becomes an identification only once one twin is addressed elsewhere. That
is what makes the test fail if `in_sequence` ignored the path head. What it does **not** establish is
that a real projection with two match lists would produce those paths — nothing can, until a
projection does.

`a_snapshot_of_another_file_is_refused_even_at_the_same_path` is still there and is a different
claim: `matches[0]` of two *documents* is one `DocumentPath` and two sequences, kept apart by
`ReapplyAnchor::document`.

### 4.3 The empty arms are checks, and one parser change is what makes them checks

`every_save_transaction_variant_declares_exactly_the_operands_serde_writes` reads a variant's
declared payload with `tagged_variant_fields`. Until the first review round that helper required a
braced block, so `Record<string, never>` — the spelling `NewMatchPosition` already uses for the same
shape — was classified as an unresolvable type reference and **skipped**: nothing pinned that Rust
writes `{}` for `Unsupported`, `Targetless` and `NotAnchored` and that TypeScript declares no
operands for them. It now recognises exactly that one spelling as a checked zero-field payload, which
is why the count is `(122, 12, 71)`.

**Exactly that spelling, and the word is load-bearing — since the *second* review round.** The first
round's fix tested `starts_with`, so `Record<string, never> | { readonly force: boolean }` was still
read as the empty field set: a real operand declared on the TypeScript side alone, kept out of the
counts, and compared clean against the `{}` `serde` writes. The payload must now be that spelling and
then the `}` that closes the one-key variant object; a union, an intersection, an array suffix or an
identifier suffix answers `None` instead, which moves the variant from `checked` to `nested` and
fails the `(checked, nested, unit)` assertion.

`{}` is deliberately **not** accepted as the same thing: in TypeScript it means *any non-nullish
value*, so reading it as an empty payload would let a real operand hide behind it. **That sentence
was written one round before the code did it.** Through the first round `{}` took the braced-block
branch, `block_fields("")` answered the empty set, and it was counted as a *checked* zero-field
payload — this record claiming a guarantee the code did not give, the defect class the project's own
rules name as its worst. The second round made it a `None`, and
`only_the_exact_empty_payload_spelling_is_a_checked_zero_field_payload` is what says so: five
spellings rejected, the exact one accepted, and an ordinary braced payload beside it asserted
unaffected so a rejection cannot come from the harness.

### 4.4 Nothing establishes that the sentences are true

Sixteen dictionary keys were added in two languages. `dictionary_contract.rs` checks that each
variant has a key and each key names a variant; `reapplyCodes.test.ts` checks that each renders a
non-empty sentence with no leftover placeholder and no Rust variant name. **Nothing checks what any
of them claims.** Reverting a prose fix while keeping the key leaves every suite green — this
repository's worst defect class, and Q9 item 1 predicted it for this phase specifically. The review
round found eight sentences and doc comments that had already fallen into exactly that gap.

Three partial mitigations, and all three are narrower than the problem: the four resolution
sentences are asserted **distinct** (so `Targetless` and `Unsupported` cannot share one), the three
placement sentences are asserted distinct from each other **and from every resolution sentence**, and
the English `identified` sentence is asserted to contain the words *"not proof"*, because the
likeliest false sentence in this phase is one that reads *"the same snippet"*. None is a check on
meaning.

### 4.5 The corpus property is self-resolution, not cross-revision resolution

`every_synthetic_anchor_finds_its_own_item` and its real-corpus twin capture an anchor from a
snapshot and resolve it **in that same snapshot**. That is a necessary condition — a search that
cannot find an item in the document it came from could not be trusted anywhere — and it is not a
cross-revision property. The cross-revision cases are the hand-authored R0 → R1 pairs, and they are a
table rather than a sweep.

**Since the review round the sweep cannot shrink itself.** Eligibility is decided by `is_eligible` in
the test file — a parsed snapshot and a projected match addressed as an item of a sequence — and
never by whether `capture` succeeded; a capture that refuses for an eligible target fails the test
with the fixture's name. Four counts are kept separately (eligible, captured, identified, ambiguous),
eligible and captured are asserted equal, and the real-corpus test asserts a **non-zero** eligible
count when the corpus is present, which is what stops it passing vacuously exactly when it matters.

The one permitted alternative outcome, `AmbiguousExact`, is checked rather than accepted: another
match of the file must really carry the same `source_text`, which is a necessary condition for two
items to have the same owned bytes. It is not sufficient, so a defect that made two *differently
written* items hash equal would be caught by the identification arm rather than by that check.

### 4.6 An indistinguishable replacement cannot be detected, at any tier

If something outside this application deletes a snippet and writes a byte-identical one in its place,
every tier here identifies it. That is stated in the module documentation as the definition of the
policy rather than papered over, and it is why the weaker tier is confined to non-destructive field
intent: being wrong there costs a rewritten field, and being wrong about a delete costs somebody
else's snippet.

---

## 5. Evidence

Measured after the **second** review round; the figures of the first round are in section 6 and the
step's own are in that section's preamble.

| Command | Result |
|---|---|
| `cargo test --workspace` | 1086 passed, 0 failed (was 1048 before the step, 1071 after it, 1081 after review round 1) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output — the architecture rule holds (D2x) |
| `npm test` | 1499 passed, 48 files (was 1482, 47) |
| `npm run check` | **416** files, 0 errors, 0 warnings (was 415; the one new file is `reapplyCodes.test.ts`) |
| `npm run build` | 174 modules — **unchanged**, and correct: this step added one *test* file and no source module |

i18n is **745** keys per language, at parity — measured, not assumed.

---

## 6. Review round 1 — what changed

`docs/reviews/phase-2c-4b-1-code.md` returned **NOT READY** with six findings. Every one is closed
below, with what the fix was and what it did *not* establish. The step was uncommitted, so this is
one working tree rather than a follow-up commit — and sections 1 to 5 above have been rewritten to
describe what now exists, not what the first round shipped. **Check this record against the code.**

The figures the first round reported, kept so the deltas are readable: `cargo test --workspace` 1071,
`npm test` 1495 in 48 files, i18n 742, wire variants 202, `(checked, nested, unit)` `(117, 14, 71)`.

### 6.1 High — a move placed `after` another snippet had only half its evidence

`move_one_match` threaded one anchor. A move sent `after` a named snippet has **two** cross-revision
identities, and answering only the moved item produced an `Identified` that looked like a whole
answer while saying nothing about whether the requested destination was still expressible — which
2c-4b-2 could not have derived from a stale `MatchId` or from the subject's projection without
recreating this algorithm or guessing by position.

**This is a deliberate wire-shape change**, taken rather than deferred:

- the core gained `PlacementMode` (`NotAnchored` / `Anchored(ReapplyAnchor)` / `Refused(reason)`),
  `ReapplyRequest { subject, placement }`, `ReapplyPlacement`
  (`NotAnchored {}` / `Identified { target }` / `Refused { reason }`) and
  `ReapplyEvidence { subject, placement }`;
- `reconcile` now takes a request and answers an evidence, resolving **both** operands against the
  same `fresh` in one call — `reconcile_subject` and `reconcile_placement` are private halves of one
  expression, so no caller can hand them two reads;
- a placement is **always** `ExactItem` and there is no parameter that could ask for less;
- `SaveResult::Conflict::reapply` is a `ReapplyEvidence`; `ConflictResult.reapply` is a
  `ReapplyEvidence`; six commands build a `ReapplyRequest`;
- a creation's `after` moved from the subject slot to the placement slot (D7 above says why);
- `anchor_index` became `anchor_item`, which answers the anchor's projection beside its index, so the
  anchor is resolved **once** and both the placement index and the placement anchor come from that
  one lookup. `addressed_item` lost its last caller and was deleted rather than left as dead code.

Six acceptance cases now cross the two operands: both found; the anchor missing while the subject is
found; the anchor's bytes changed; the anchor ambiguous; the anchor addressed in another sequence;
and an anchor that could not be captured from the base at all. Two module tests cover the placement's
empty and refused modes and its refusal to fall back to a trigger.

**What it does not establish.** That two operands are enough for every future operation (4.1), and
that any consumer reads the second one — nothing does yet, by design.

### 6.2 Medium — the interleaving test could not discriminate provenance

The only test that called `conflict_after_the_lock` directly passed `ReapplyMode::Unsupported`, an
arm that never reads a snapshot, so a mutation resolving the anchored question against the cached or
refusing observation would have stayed green.

`a_conflicts_anchored_answer_is_of_the_fresh_read` is the new test, and D1 above describes it. Its
fixtures are chosen so the same anchors resolve **differently** in R1 and R2 — `AmbiguousTrigger` and
`NoExactCorrespondence` there, an identification of both operands here — and it asserts the
identified subject's `id.revision` equals `disk_revision`. The older test keeps the anchorless
request and now says in its own comment which claim it does *not* discriminate.

### 6.3 Medium — both corpus sweeps let `capture` choose what they audited

They `continue`d on refusal, so a change that newly refused a class of matches removed that class
from the audit instead of failing it; the real-corpus test had no non-zero assertion at all and was
vacuous whenever a present corpus produced nothing.

Eligibility is now `is_eligible` in the test file, written independently of the implementation — a
parsed snapshot and a projected match addressed as an item of a sequence. A capture that refuses for
an eligible target panics with the fixture's name. The sweep returns a `Sweep` of four counts
(eligible, captured, identified, ambiguous), asserts eligible equals captured and that the two
permitted outcomes account for every capture, and the real-corpus test asserts a non-zero eligible
count when the corpus is present. The false file-level claim at `tests/reconcile.rs:5` was replaced
with the review's own wording.

### 6.4 Medium — eight sentences claimed more than their predicates

All eight corrections were applied, seven of them verbatim from the review:

| Where | What it said | What it says |
|---|---|---|
| `reconcile.rs` module doc | *"does the snapshot on disk still contain the item this operation named, beyond reasonable doubt?"* | the exactly-one-candidate question, plus *provisional correspondence, not proof that the original item remains* for the trigger tier |
| `ReapplyConfidence` | *"Not a preference and not a caller's opinion: it is a property of what the operation would then do"* | the command layer must select it; the type does not prevent a caller selecting the weaker policy |
| `SaveResult::Conflict::reapply` | *"whether the item … can be identified, beyond reasonable doubt"* | exactly one candidate carrying evidence at a tier the command selected; the trigger tier is provisional |
| `reapplyRefusal.noAnchorInBase` | *"could not record what this change was about … nothing to look for"* | could not record the **correspondence evidence** this change requires |
| `reapplyRefusal.diskDoesNotParse` | *"cannot be read as YAML, so it holds no list of snippets"* | could not be **parsed**, so there is no parsed snippet list to search |
| `reapplyRefusal.sequenceMissing` | *"holds no list of snippets where this change's snippet was"* | found **no snippet candidate** at the recorded sequence address |
| `reapplyRefusal.ambiguousExact` | *"is written exactly the way … was written"* | carries the same **exact correspondence evidence** |
| `reapplyRefusal.noExactCorrespondence` | *"This action moves, removes or copies a snippet's own lines"* | this **operation or positional anchor** requires exact owned-line correspondence |

Both languages, in the review's own Spanish where it gave it. The sweep that followed — for what the
predicates now say rather than for the words the finding used — found four more instances the
finding did not quote: `ReapplyRefusal`'s own enum doc (*"identified beyond doubt"*), the same
sentence in `types.ts`, `ReapplyRefusal::DiskDoesNotParse`'s rustdoc (*"holds no sequence to
search"*) and `ReapplyRefusal::TargetMissingOrTriggerChanged`'s rustdoc, which stated a disjunction
as fact where the dictionary hedges it. `SequenceMissing`'s rustdoc also now says explicitly that it
covers an addressed sequence that exists but projects nothing.

**Nothing here is testable**, and 4.4 says so. The i18n suites check parity, placeholders and
distinctness; no suite can fail because a sentence became untrue again.

### 6.5 Low — the multiple-sequence property had no discriminating test

The only claimed case changed `DocumentId` and exited at `WrongDocument` before `in_sequence` ran.
`two_sequences_of_one_document_are_two_sequences` (module) and
`a_moves_anchor_in_another_sequence_is_not_its_anchor` (acceptance) place otherwise-matching
candidates under two sequence heads in **one** document by re-addressing a cloned `MatchView::path`,
and the module test asserts the ambiguous premise first so that it really fails if `in_sequence`
ignored the head. 4.2 states what the technique cannot establish.

### 6.6 Low — the two empty resolution arms were skips

`tagged_variant_fields` now reads `Record<string, never>` as a checked zero-field payload, so
`ReapplyResolution::Unsupported`, `ReapplyResolution::Targetless` and
`ReapplyPlacement::NotAnchored` are compared against the `{}` `serde` writes rather than skipped.
**This fix was incomplete and section 7.3 is where that is closed**: it tested `starts_with`, so a
one-sided TypeScript operand hidden behind the spelling still passed, and `{}` was still accepted as
the empty payload despite the sentence below saying it was not. The counts moved from `(117, 14, 71)` to
`(122, 12, 71)`: two arms crossed from `nested` to `checked`, and `ReapplyPlacement` added three
checked ones. The variant total moved 202 → 205, in two places — the sample-list check and the
placeholder check — because both count the same list.

### 6.7 What the review confirmed and this round had to keep

The anchor is still captured **before** the transaction from the revision-validated snapshot;
`conflict_after_the_lock` is still the sole production `SaveResult::Conflict` construction site and
still derives `disk`, `disk_text`, `disk_revision` and now both halves of `reapply` from one refresh;
`save_document` is still the only entry point that writes and no `force` flag exists; the item index
is still never a tie-break; D2r and R25 are untouched. `cargo tree -p espansoconfig-core | rg tauri`
still finds nothing. No `.svelte` file was touched in this round either, and `ConflictChoice`,
`ConflictCapabilities` and `conflictChoicesFor` remain byte-for-byte as they were.

---

## 7. Review round 2 — what changed

`docs/reviews/phase-2c-4b-1-code-round2.md` returned **NOT READY**. It confirmed findings 1, 2, 3 and
5 of the first round closed, found **narrower instances of findings 4 and 6 still standing**, and
added two Mediums. Four items, all closed below. The step is still uncommitted, so this is one
working tree; sections 1 to 5 above describe what now exists, not what either earlier round shipped.
**Check this record against the code.**

The rule this round paid for again, and it is the same one section 6 opened with: *each round's fix
produced the next round's finding, every time because the search that followed the fix was written
from the previous wording rather than from what the predicate now says.* Both surviving findings are
that, exactly.

### 7.1 Finding 4 — the narrower instances, in strings, rustdoc and a test comment

The eight named corrections and the four follow-ups of round 1 were present and correct. What the
sweep had missed:

| Where | What it said | What it says |
|---|---|---|
| `code.reapplyRefusal.noExactCorrespondence` (en, es) | *"No snippet in that list is written exactly the way the one this change was about was written"* | *carries the exact **owned-line correspondence evidence** recorded for this change* |
| `code.reapplyResolution.refused` (en, es) | *"could not identify … in the file as it is now"* | *could not **establish correspondence** for what this change was about* |
| `code.reapplyPlacement.refused` (en, es) | *"could not find … in the file as it is now"* | *could not **establish correspondence** for the snippet this change was placed after* |
| `ReapplyPlacement::Refused` rustdoc | *"The anchor could not be found again"* | *Correspondence for the named anchor could not be established, so no destination may be derived from this evidence* |
| `tests/reconcile.rs` | *"A snapshot that did not parse holds no sequence to search"* | *…**produces no parsed sequence** to search* |

All five are the review's own wording, applied verbatim in both languages.

The first row is the one with a **counterexample already in the repository**.
`a_comment_changing_hands_separates_the_two_exact_tiers` builds a disk snapshot whose match mapping
is byte-identical to the base's and whose *envelope* lost a comment to the file; exact owned-run
correspondence refuses there while the snippet is written exactly as it was. So the old sentence was
false of the case the test exists to pin.

**Two further instances the sweep found beyond the review's list**, both the same defect one layer
out — a summary line claiming the fresh read was consulted for *every* arm:
`SaveResult::Conflict::reapply`'s rustdoc opened *"What the correspondence attempts found in that
same fresh read"*, and `ConflictResult.reapply`'s JSDoc in `src/lib/ipc/types.ts` opened with the
same sentence. Both now say the answers are of that read **where answering one required a search**,
and both then name the arms that require none: a whole-document replacement, a creation, an operation
with no positional anchor, and an operand the *base* snapshot could not produce.

**Nothing here is testable, and section 4.4 still says so.** `reapplyCodes.test.ts` checks parity,
placeholders, distinctness and one word of one sentence; no suite fails because a sentence became
untrue again.

### 7.2 Medium — the placement and refusal prose claimed a search that may never happen

The same edits close it, and the reason it was a finding of its own is where the claim lived rather
than what it said. `PlacementMode::Refused(NoAnchorInBase)` is decided from the **base** snapshot and
`reconcile_placement` returns it without touching `fresh`, so *"the anchor could not be found again"*
was false for it — and it was written into the **enum's own contract**, where a later consumer would
have copied it.

It also could not be rendered beside its own reason. `code.reapplyRefusal.noAnchorInBase` correctly
ends *"The file on disk was not examined"*, and a screen showing the generic sentence above it would
have contradicted itself in two consecutive lines. The generic sentences are now reason-neutral and
the search detail is left entirely to `ReapplyRefusal`, which is the only operand that knows whether
there was one.

Two sentences were **examined and kept**, and this records why rather than leaving the reader to
re-derive it. `code.reapplyRefusal.wrongDocument` — *"The file that was examined is not the file this
change was about"* — is true: `resolve()` compares the snapshot's identity before anything else, so a
snapshot really was examined, and the sentence claims no candidate search.
`code.reapplyRefusal.targetMissingOrTriggerChanged` says no snippet is *written the way* this
change's was; for that variant **all three** tiers failed, so both the envelope and the mapping slice
really do differ, and the sentence already hedges what it cannot know.

### 7.3 Finding 6 — the wire-contract parser admitted a one-sided operand

Round 1's `tagged_variant_fields` accepted any payload that merely **started with**
`Record<string, never>`. `Record<string, never> | { readonly force: boolean }` therefore came back as
the empty field set, kept `(122, 12, 71)` exactly where it was, and compared clean against the `{}`
`serde` writes — a real operand declared on the TypeScript side alone, admitted by the check whose
whole purpose is to forbid that. The mutation the finding required still passed.

The payload must now be that spelling and then, after whitespace, the `}` that closes the one-key
variant object. Anything else answers `None`, which makes the variant a counted **skip** and moves
`checked` down by one — and the `(checked, nested, unit)` assertion then fails. `{}` answers `None`
too, which is the first round in which the code does what section 4.3 has claimed since it was
written.

`only_the_exact_empty_payload_spelling_is_a_checked_zero_field_payload` is the parser test the
finding asked for. It builds its TypeScript by hand — `one_variant_union` — because the point is what
the parser does with spellings `src/lib/ipc/types.ts` does not contain: a union, an intersection, an
array suffix, an identifier suffix and `{}` are each rejected, the exact spelling is accepted, and an
ordinary braced payload declared beside it is asserted to still read as its own operands, so a
rejection cannot come from the harness having stopped working.

**What it does not establish**: that `Record<string, never>` is the only spelling of an empty payload
a future `types.ts` might use. A second spelling would be a silent skip again, caught only by the
count.

### 7.4 Medium — no test pinned the production command-to-request mapping

The six placement acceptance cases build their `ReapplyRequest` in
`crates/espansoconfig-core/tests/reconcile.rs`'s own helpers, and the provenance test constructs its
request by hand. Every one of them therefore establishes what the **algorithm** answers and nothing
about which question a **command** asks. Mutating `move_one_match` to send
`PlacementMode::NotAnchored` always would have left all of them green, and the only end-to-end move
conflict sent `after: None`, where `NotAnchored` is the right answer anyway.

Four command-level tests now drive the six writing commands through their public
`WorkspaceSession` methods and assert the answer the **production** request produces:

- `a_drafted_save_is_the_only_writing_command_that_may_fall_back_to_a_trigger` — the same snippet is
  `Identified` for `save_match` and `Refused(NoExactCorrespondence)` for `move_match`,
  `delete_match` and `duplicate_match`, and a fifth case moves a snippet whose bytes survived and
  requires it to be identified, so the three refusals are not vacuous;
- `a_creation_answers_targetless_and_a_raw_save_answers_unsupported` — `Targetless` for a creation at
  the front and at the end, `Unsupported` for a raw save, and `NotAnchored` for all three;
- `a_move_after_an_anchor_answers_that_anchors_correspondence` — a move after a surviving anchor
  identifies it; a move after the rewritten one refuses by name, which is also what says a placement
  may not use the trigger tier;
- `a_creation_after_an_anchor_answers_that_anchors_correspondence` — the same pair for a creation,
  with the subject asserted `Targetless` in both, which is what stops a creation's anchor drifting
  back into the subject slot.

**The fixture is the discrimination, and it is deliberate.** `POLICY_DISK` changes exactly one
snippet's `replace` value, so that snippet's owned-run envelope *and* its mapping slice both differ
while its trigger keeps its source spelling and stays unique on both sides: exact correspondence
refuses for it and the editor's trigger tier identifies it. The other two snippets are byte-identical,
so exact correspondence identifies them — which is what lets an anchor be pinned as *found* or as
*specifically refused* rather than merely as *not `NotAnchored`*. Every case takes a fresh session,
because the refresh a conflict performs replaces the cached projection and would leave a second
case's identities stale.

**Measured, not argued.** Four mutations were applied to the production code one at a time and each
flipped exactly one assertion and no other: `move_one_match`'s placement forced to `NotAnchored`
(fails the move-after test), `create_one_match`'s placement forced to `NotAnchored` (fails the
creation-after test), `delete_one_match` given the editor's confidence, and `save_one_match` given
`ExactItem` (both fail the confidence test). All four were reverted; `rg 'ReapplyConfidence::Exact'`
over `src-tauri/src/commands.rs` shows the four production call sites back as D2 states them.

**What these four tests do not establish**, and nothing in Rust forces any of it:

- **that a seventh writing command would be covered.** No test enumerates the writers; these four
  name six commands by hand, so a new one built with the wrong request is caught only by writing a
  fifth test. The command *count* is pinned elsewhere, and a count is not a policy;
- **that the request was inspected.** They observe the answer, never the `ReapplyRequest`, so what
  they pin is the selected policy *through a fixture in which the policies disagree*. A later edit
  that made `POLICY_DISK` differ in some other way could make exact and trigger answers agree again,
  and the discrimination would vanish silently. That is what the comment on `POLICY_DISK` exists to
  stop;
- **that `ReapplyConfidence` prevents anything.** It does not, and D2 already says so: the enum
  accepts either policy for any target, and what maps an operation to its policy is the command layer
  plus these tests.

### 7.5 What round 2 confirmed and this round had to keep

Round 2 verified, and none of it was touched: `conflict_after_the_lock` is still the **sole**
production `SaveResult::Conflict` construction site, and `subject`, `placement`, `disk_text`,
`disk_revision` and `disk` all still come out of the one `fresh` snapshot; `save_document` is still
the only entry point that writes, with no `force` flag and no second lock; the item index is still
read by nothing in the decision path; placement is still hard-coded to `ExactItem` with no parameter
that could ask for less; D2r and R25 are intact; `cargo tree -p espansoconfig-core | rg tauri` still
finds nothing. No `.svelte` file, no control, no choice, no capability and no user-visible behaviour
changed in this round either — the four items are prose, one parser predicate and five tests.
