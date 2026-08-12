NOT READY

## Findings

### Medium — The inserted-item locator is unsound for legal edit batches

**Location:** `crates/espansoconfig-core/src/persist/save.rs:1487`, `crates/espansoconfig-core/src/persist/save.rs:1610`, `crates/espansoconfig-core/src/patch/edit.rs:3042`, `docs/decisions/2c-4c-1-notes.md:207`

`findings_of` runs the new inspection whenever a batch contains exactly one
`InsertItem`, not when that insertion is the batch's only cardinality-changing
edit. The locator then treats `candidate_items.len() - 1` as the source
sequence's old length. `apply_edits`, however, explicitly accepts mixed batches
and folds multiple changes to one sequence. An insertion combined with an
earlier `RemoveItem` therefore makes the `After(k)` result shift left while
`items_above(candidate_items.len() - 1)` still looks at `k + 1`.

A concrete failure is a sequence whose first item is removed while a unique new
trigger is inserted after original item 1, with original items 1 and 2 already
sharing a literal trigger. The candidate is `[old-1, new, old-2]`, but the code
inspects `old-2`, sees its repetition with `old-1`, and emits
`NewMatchRepeatsLiteralTrigger` against an existing item even though the new
trigger is unique. That violates the finding's narrow contract: it may fire only
when the newly inserted match repeats. Conversely, two insertions skip the
inspection altogether. The decision record acknowledges only the latter
under-report and incorrectly treats one insertion as enough to make the address
derivable.

**Specific fix:** either make an insertion that receives this transaction
finding the only sequence-cardinality edit in its batch, enforced by the patch
contract, or derive every inserted candidate address from the verified aggregate
batch rather than from candidate length. Add accepted mixed insert/remove cases
on both sides of the anchor and a multiple-insertion case; assert both the code
and the finding path.

### Medium — The claimed ordinary-creation evidence does not traverse `create_match`

**Location:** `crates/espansoconfig-core/tests/persist_save.rs:1075`, `src-tauri/src/commands.rs:1246`, `src-tauri/src/commands.rs:5018`, `docs/decisions/2c-4c-1-notes.md:111`

The persistence tests call a local `creation` helper that reconstructs today's
`create_one_match` lowering. They establish the save transaction's behavior for
a hand-built `InsertItem`, but they cannot establish the record's claim that the
plain `create_match` path was measured directly. The command-level creation test
uses a unique `:greet` trigger and is refused for an unresolved reference, so it
never observes `NewMatchRepeatsLiteralTrigger`; no command-level test sends the
four optional fields either.

A mutation that made `create_one_match` drop all optional fields would leave the
six-field persistence test green, because that test calls `NewMatch::fields`
itself. A mutation that changed ordinary creation's lowering so the new risk
producer was bypassed would likewise leave the claimed repeated-trigger test
green. This is the project's known non-falsifiable-test shape: the test asserts
the downstream property without crossing the code path that can break it.

**Specific fix:** add a `WorkspaceSession::create_match` or dispatcher test that
sends all four optional fields, repeats an existing literal trigger, asserts the
new finding and refusal, returns the exact findings, then asserts the committed
six-field bytes and preservation of the pre-existing bytes.

### Medium — The widened public contract still has several two-field descriptions

**Location:** `crates/espansoconfig-core/src/draft/mod.rs:76`, `src-tauri/src/commands.rs:1800`, `src/lib/ipc/commands.ts:465`, `src-tauri/src/dispatch_check.rs:542`, `src/lib/ipc/commands.test.ts:238`

The type now carries six schema-known fields, but the draft module still says it
is closed at two mandatory keys, the IPC command says it carries "two values and
nothing else," and the dispatcher and IPC tests repeat an exactly-two/closed-at-two
contract. These are not harmless historical notes: they describe the public Rust
and TypeScript boundaries that the recovery step will call next.

A developer following those comments can legitimately rebuild or sanitize a
`NewMatch` as only `trigger` plus `replace`, silently discarding `label`, `word`,
`left_word`, and `right_word` while still satisfying the documented contract and
all present callers. That is precisely the decision-record-versus-code defect
class this project treats as most serious.

**Specific fix:** sweep the public creation boundary and its contract tests for
the widened shape. Say "two required and four optional schema-known scalar
fields" where the generic `NewMatch` is meant. Keep the existing two-value
description only where it is explicitly about today's ordinary creator form,
which still authors two values.

### Low — No test makes the undecodable-scalar exclusion falsifiable

**Location:** `crates/espansoconfig-core/src/persist/save.rs:1685`, `crates/espansoconfig-core/tests/persist_save.rs:1330`, `docs/decisions/2c-4c-1-notes.md:146`

Production filters on `ScalarView.decoded`, which conforms to the contract. The
new tests cover regex on both sides, a `triggers` scalar, overlap, `Absent`, and
`Several`, but none supplies an undecodable literal scalar. Removing the
`filter(|scalar| scalar.decoded)` line would therefore leave every new test
green, even though raw source text would then be compared as if it were decoded
logical text.

**Specific fix:** add an accepted candidate whose existing `trigger` or one
entry of `triggers` is projected with `decoded == false` and whose stored text
equals the new literal trigger; assert the premise and assert that no
`NewMatchRepeatsLiteralTrigger` is produced.

### Low — Rust and TypeScript `NewMatch` still have no property-parity check

**Location:** `src/lib/ipc/types.ts:2167`, `src-tauri/src/wire_contract.rs:2190`, `docs/decisions/2c-4c-1-notes.md:237`

The four optional TypeScript properties were added by hand, while the existing
wire-contract machinery checks the new finding but does not register the
deserialize-side `NewMatch` struct. The record correctly admits that a typo in
one optional TypeScript key compiles today because no frontend producer sends
it. Recording that hole does not make the recovery value safe to build on in the
next step.

For example, renaming only TypeScript `right_word` to `rightWord` would leave the
verified gates green. A future recovery caller following that type would send an
unknown JSON property; Serde would ignore it, default Rust `right_word` to
`None`, and the saved snippet would silently lose that field.

**Specific fix:** extend the static wire contract to compare `NewMatch`'s Rust
deserialize properties with the TypeScript interface, including required versus
optional/null behavior, and make all six properties contribute to a non-vacuity
count.

## Confirmed properties

`NewMatch::fields()` distinguishes `None` from `Some("")`, emits only the six
schema-known fields that are present, and preserves the documented
`trigger`, `replace`, `label`, `word`, `left_word`, `right_word` order. The new
finding is a distinct `SuspiciousButPermitted` code carrying the exact candidate
`ContentRevision`; it is produced beside `validate` inside the one
`save_document` path and is not a generic validator rule. For the command's
current one-`InsertItem` batch, the new item is found through
`ItemPlacement::items_above`, comparison is exact decoded-string equality within
the destination sequence, and regex, `Several`, and `Absent` shapes make no
claim. `DuplicateKeepsTriggerDefinition` remains unchanged and separate.

The English and Spanish dictionary sentences claim only repeated trigger text
and uncertainty about espanso's handling of overlapping definitions. Neither
says invalid, collision, which definition wins, or that silence proves safety.
No command, `DocumentEdit` variant, writer, force flag, or `.svelte` change was
added. The byte-preservation assertion is falsifiable for its end-insertion
case: it performs the refused/acknowledged save, reads the committed disk text,
and independently compares both sides of the reported insertion replacement;
the six-field test also requires the complete original text as a prefix before
checking the exact inserted bytes.

## Confirmation pass

NOT READY

All five round-1 findings are closed, but the fix round introduced one Low
finding in the new public patch API.

### Round-1 dispositions

1. **Closed — inserted-item locator.** `findings_of` now inspects every
   `InsertItem`, and obtains each post-batch index from `insertion_landings` over
   all insertions and direct removals in that sequence. The original false-report
   scenario, removals on both sides of the anchor, multiple insertions and a
   non-cardinality edit beside an insertion are asserted through the save
   transaction, including finding paths. Taking the review's second option was
   the right trade: mixed insert/remove batches are a deliberate patch-engine
   capability, and deriving their actual landings closes both the false report
   and the multiple-insertion under-report without adding a refusal no present
   caller can produce.
2. **Closed — ordinary-creation evidence.** The new command test enters through
   `WorkspaceSession::create_match` with all six fields, observes the precise
   repeated-trigger suspicion and no write, retries with the returned exact
   findings, and asserts the complete committed bytes. Dropping optional fields
   in `create_one_match` or bypassing the transaction producer now breaks it.
3. **Closed — widened public contract.** The named Rust, command, dispatcher and
   IPC sites now say two required plus four optional fields. The additional
   sweep reached `workspace.svelte.ts`, both formerly ambiguous creation-module
   descriptions, and `newMatchOf`; remaining two-field descriptions are
   explicitly and accurately scoped to the present two-control creator form or
   to a bare value with all four optionals absent. No narrower stale two-field
   contract remains in the creation boundary.
4. **Closed — undecodable-scalar exclusion.** The substitute unit test first
   proves that the projected decoded pair produces the finding, then clears
   `decoded` on the existing and inserted sides separately and requires silence.
   Deleting `filter(|scalar| scalar.decoded)` therefore makes both negative
   assertions fail. The record is honest that parser-first rejection of the
   explored escape shapes is a search rather than proof that no real document
   can ever project such a scalar.
5. **Closed — Rust/TypeScript property parity.** The wire test compares the six
   TypeScript property names with the keys serialized by Rust, round-trips the
   complete value, checks required versus optional/null behavior property by
   property, and requires a non-vacuous count of six. Renaming only TypeScript
   `right_word` to `rightWord` changes the compared name set and fails the test.

The `fold_item_expectations` refactor preserves the old pass exactly: claims are
still grouped in first-seen order; insertions retain claim order; for every
original position, insertions at that `before` count precede the original item;
and any claimed removal suppresses that item. The dressing step still computes
the same touched-subtree digest for every kept slot. `replay_item_positions`
therefore changes no verified candidate or byte-splice behavior.

The remaining hole stated for `insertion_landings` is correctly bounded for
accepted batches today. Moves and duplicates are refused unless batch-of-one;
the other mapping/scalar edits do not change sequence cardinality; and the
function accounts for every current cardinality-changing variant that can share
a batch. The wildcard matches mean the compiler will not force this arithmetic
to be updated for a future cardinality-changing variant, so the record is also
right that the type system does not preserve that fact.

The English and Spanish finding sentences satisfy D2u: both claim only repeated
trigger text and uncertainty about espanso's treatment of overlapping
definitions, with no placeholders in either language. The fix added no command,
`DocumentEdit` variant, writer, force flag or `.svelte` change, and
`save_document` remains the sole production write entry point.

### Low — `insertion_landings` can overflow on its documented unvalidated input

**Location:** `crates/espansoconfig-core/src/patch/edit.rs:4155`,
`crates/espansoconfig-core/src/patch/edit.rs:4160`

The new public function says it is pure arithmetic that validates nothing, and
the shared replay says an anchor above the original item count simply
contributes nothing. Its wrapper does not uphold that domain: it adds
`items_in_candidate + removals.len()` without `checked_add`, and it calls
`ItemPlacement::items_above`, whose `After(index)` computes `index + 1` without
a checked operation. A safe public call with one `InsertItem::after(sequence,
usize::MAX, fields)` and `items_in_candidate == 1` panics in overflow-checking
builds before the promised no-contribution behavior; in a non-checking build it
wraps to a plausible but false front landing. Likewise,
`items_in_candidate == usize::MAX` plus one direct removal overflows before the
existing checked subtraction.

The present save caller cannot reach either case after a successfully applied
real document, so this does not reopen finding 1 or threaten current writes.
It does make the newly public request-level API and its documentation unsound
for inputs its signature accepts. Use checked addition for both derivations and
return an empty answer on overflow, consistently with the existing underflow
rule; add direct public-API tests for both extremes.

## Third pass — the overflow fix

READY

Round 2's Low is **closed**. No new finding was found in the overflow fix.

`ItemPlacement::items_above` has four call sites in this tree when tests are
included: `insertion_landings`, `plan_item_insertion`, `create_one_match`, and
the new direct test. There is no omitted production caller. Making the result
`Option<usize>` at the conversion site is the sound signature change: this is
the only function that turns all three placement variants into a count, and
`After(usize::MAX)` is the one value for which that count cannot exist. Keeping
the check here avoids duplicating placement case analysis and makes the public
function's own contract true.

The two live callers absorb the option without weakening a reachable path.
`plan_item_insertion` has already resolved every `After(at)` through
`target.children.get(at)` before it asks for the count. Therefore its `None`
arm is unreachable after successful resolution, and
`NoSuchDestinationItem` is honest for `After(usize::MAX)`: such an index cannot
name an element of the sequence, so absence of the destination is the operative
request error as well as the check that occurs first. No arithmetic-only error
variant or user-facing sentence is warranted.

`create_one_match` obtains an `After` index only from `anchor_item`, which finds
the anchor in the same held projection and returns its enumerated sequence
position. That position cannot be `usize::MAX`, so the new `None` arm is likewise
unreachable for every command input. The defensive degradation is nevertheless
safe: `run_one_save` does not treat `at: None` as an error, and if a write has
committed then `after_a_save` still returns `SaveResult::Saved` with
`moved: None`. `BrowserState.createMatch` preserves that saved result, re-reads
the document, and sends a missing identity through the established positional
repair; a failed re-read is reported beside the committed result rather than in
place of it. No consumer interprets the missing address as permission to retry
the write or converts the committed command answer into an error. The comments'
"no address rather than a wrong one" claim is therefore accurate; it does not
claim that the invalid `After(usize::MAX)` edit itself would be committed.

The two tests are genuinely falsifiable in the reported ways.
`items_above_answers_nothing_for_an_anchor_with_no_successor` directly requires
`After(usize::MAX)` to return `None`; replacing the checked addition with `+ 1`
panics there. The first assertion in
`insertion_landings_answers_nothing_when_the_arithmetic_names_no_index` reaches
the same addition through the public wrapper, so the same mutation also panics
that test. Its second assertion supplies a same-sequence direct removal, one
insertion, and `items_in_candidate == usize::MAX`; thus it reaches
`checked_add(removals.len())`, and replacing only that operation with `+` panics
at precisely that assertion. Neither assertion can pass vacuously through the
early no-insertions return.

`insertion_landings` now checks the candidate-count addition, the existing
subtraction, and every placement-to-anchor conversion. Each failure returns the
empty vector, including the whole-answer rule when any one anchor is
unrepresentable. Its documentation and decision record narrowly claim safety
for those three derivations, and explicitly retain the surviving near-maximum
count's proportional replay and allocation cost; they do not over-claim totality
for all signature inputs.

`replay_item_positions`' body did not move in this fix. It still walks original
positions in order, emits same-anchor insertions in their input order before the
original item, and suppresses a claimed removal. `fold_item_expectations` still
groups sequence claims in first-seen order and only dresses that replay, with
the same touched-subtree digest for every kept slot. None of the behaviour the
confirmation pass verified changed.

The new and amended comments and `docs/decisions/2c-4c-1-notes.md` section 6
match the code, including the corrected `commands.rs` row in section 1. The fix
adds no command, `DocumentEdit` or `EditError` variant, writer, force flag,
`.svelte` change, or user-facing string; `save_document` remains the only write
entry point.
