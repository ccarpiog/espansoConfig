# Phase 2c-3c-1 — decision record

**The core duplicate primitive, and nothing above it.** `DocumentEdit::DuplicateItem` exists, plans,
verifies and refuses; no Tauri command names it, no TypeScript calls it, and no `.svelte` file was
touched. Steps 2 and 3 of 2c-3c draw on what this decides.

The authority for the decisions below is `docs/reviews/phase-2c-3c-design.md` — the design consult
for this sub-phase, whose Q1, Q2, Q3, Q4 and closing "must not ship without" list are this step's
scope (Q7's split, item 1). Where this record and that document disagree, the consult is right and
this is a bug.

---

## 1. What this step built

| File | What it is |
|---|---|
| `crates/espansoconfig-core/src/patch/edit.rs` | `DuplicateItem`, `plan_duplicate`, `DuplicateSeam`, four `EditError` variants, four `VerificationFailure` variants, `DuplicateExpectation` and its four verification properties, `carve_envelope` factored out of `removal_envelope`, `block_the_eof_prefix_would_feed`, `compare_subtree` generalised over an intended order |
| `crates/espansoconfig-core/src/patch/mod.rs` | exports: `duplicate_item`, `DuplicateItem`, `DuplicateSeam` |
| `crates/espansoconfig-core/src/validate/mod.rs` | `FindingCode::DuplicateKeepsTriggerDefinition`, `ALL_NAMES` at twelve, classified `SuspiciousButPermitted` |
| `crates/espansoconfig-core/src/persist/save.rs` | `findings_of` takes the batch; `duplicate_keeps_trigger_definition` produces the finding from the candidate's own projection |
| `crates/espansoconfig-core/src/draft/audit.rs` | the closed surface refuses `DuplicateItem` as a cardinality change, beside the other two sequence primitives |
| `crates/espansoconfig-core/tests/patch_duplicate.rs` | **new** — 25 tests: the byte-exact table, the EOF seam, the terminal blocks, the destination seams, every named refusal, the three seam fixtures' rows, five byte-exact corpus fixtures, the real-corpus sweep |
| `crates/espansoconfig-core/tests/persist_save.rs` | three tests added: the finding's refuse-then-acknowledge round trip, the non-match item that owes no warning, the triggerless match where the model error wins |
| `crates/espansoconfig-core/tests/validate_semantics.rs` | the reachability check's exemption list grows to two, asserted from both sides |
| `src/lib/i18n/{en,es}.json` | twelve `code.*` keys per language, at parity |
| `src/lib/ipc/types.ts` | `DuplicateSeam`, four `EditError` arms, four `VerificationFailure` arms, one `FindingCode`/`FindingCodeName` member |
| `src-tauri/src/dictionary_contract.rs` | `DuplicateSeam` registered; `VARIANT_COUNTS` retabulated |
| `src-tauri/src/wire_contract.rs` | samples and counts retabulated: 177 → 189 variants, `EditError` 36 → 40 |

**No `.svelte` file was touched, no command was registered, and no fixture's bytes changed.**
Nothing under `src/lib/browser/`, `src/routes/` or `tests/corpus/` was edited, and
`tests/corpus_integrity.rs` still passes over the fifteen protected fixtures unchanged.

---

## 2. The decisions

### 2.1 D1 — the clone is the owned runs, derived where the lift derives them (consult Q1)

"The exact source subtree" is the item's **owned physical-line runs**: `editable_sequence_item`
establishes the item, `carve_envelope` — steps 1 to 3 of `removal_envelope`, factored out — widens
the hull to whole lines and punches out the file's comments with the blank runs beside them, and the
clone is the surviving runs concatenated in order. So the owned leading comment block, the dash,
every key, unknown subtree, block-scalar header and body, inline comment, trailing space and each
line's own terminator travel; a blank separator, a file-owned comment and its guarding blank runs do
not, because the ownership rules this crate already has say they are not the item's.

**`lift_item` was deliberately not called** (the consult's own warning). `removal_envelope` carries
three refusals whose premise is deletion — `RemovalWouldDeleteAFileComment`,
`RemovalWouldExtendAKeptBlock` per run, and `block_scalar_the_kept_bytes_would_join` over the
preserved regions — and a duplicate deletes nothing, so asking them would refuse legitimate copies
(a duplicate of any item that terminates a `|+` block, for one). The factoring keeps the shared
steps shared: a duplicate that copied a different set of bytes from the ones a lift takes would be a
second answer to the question D2o settled.

The one refusal the copy keeps from that set is re-stated under its own name:
`DuplicateWouldCopyAFileComment` asserts per run what `RemovalWouldDeleteAFileComment` asserts for a
deletion, because copying the file's own note is exactly as wrong as deleting it, and the punch-out
arithmetic is not its own witness.

### 2.2 D2 — no destination, and the arithmetic lives on the request (consult Q4)

`DuplicateItem { item }` has no placement argument. The landing is the slot immediately after the
source, derived by `insertion_point` over the item's own extent — the call every other insertion
makes — so there is no anchor that can go stale and no `MoveChangesNothing` analogue, because a
duplicate always changes the document. `resulting_index(from)` is `from + 1` and
`resulting_path()` is the same arithmetic as an address, both on `DuplicateItem` itself so the
planner, the save transaction and a later command cannot hold second copies that disagree.

**Same-sequence is recorded as this phase's own scope**, not blamed on D2r: the consult rules that
D2r is formally a move restriction whose rationale binds here, and this record says exactly that.

### 2.3 D3 — batch-only, under its own name (consult Q2)

`DuplicateMustBeTheOnlyEditInItsBatch` is a new variant, not a reuse of the move's, because R25 is
about a move and claiming it already covered this operation would be a false record. The rule serves
the same verification argument — the expectation is the original document plus one repeated
position — plus the one the consult adds: a batch that could also rewrite a field would quietly turn
"duplicate" into "duplicate except for one edit", and the byte-exact preservation claim would be
unverifiable. Clone-then-edit is two batches by design.

### 2.4 D4 — destination-only seams, and the asymmetry pinned on the fixtures (consult Q1)

`DuplicateSeam` is `MoveSeam` minus `SourceCloses`: an enum that could spell the source-close seam
could say something false about this operation. The three gates ask `block_absorbing_a_line` — the
one statement of the absorption condition, shared with the move and the removal — at the duplicate's
own places: the copy lands (`first_kept_column` of the runs against blocks ending the item), the
copy closes (`first_non_blank_column_from` the landing against the same boundary), and one
copied-runs join per adjacent pair of runs.

The three seam fixtures answer exactly as the absent source-close seam predicts, and
`the_three_seam_fixtures_duplicate_exactly_where_the_absent_source_close_says` pins the rows:

| Fixture | Move | Duplicate |
|---|---|---|
| `move-block-scalar-seams.yml` | 5 `SourceCloses`, 2 `ArrivalLands`, 2 `ArrivalCloses` refusals | **all six items copy** — the deep comment never parks under a foreign block, because the destination is beside the source |
| `move-run-joins.yml` | 2 `CarriedRunsJoin` refusals | item 0 refused at `CopiedRunsJoin`, items 1–2 copy — the internal seam is about the clone's own concatenated runs and survives whole |
| `move-kept-comment-joins-a-block.yml` | 3 source-side R23 refusals | **all four items copy** — the file's comment never moves, and `the_deep_kept_comment_stays_at_the_source_and_is_not_copied` shows it in the candidate exactly once |

`ArrivalLands` is genuinely reachable for a duplicate — an item that ends in a block scalar and owns
a leading comment block at that block's body column — and an inline pair
(`a_deep_leading_comment_on_a_block_ended_item_is_refused_at_the_landing`) drives both sides of it,
column five refused and column two applied, without touching any protected fixture's bytes.

### 2.5 D5 — the EOF seam is the insertion's, and it revives the withdrawn clip clause (consult Q1)

At an unterminated end of file the clone carries the **copied** line ending in front of it —
`line_ending_before`'s evidence or `NoObservableLineEnding`, never a default (D2p) — so the source's
last line becomes terminated, the clone retains the unterminated bytes, and the file keeps not
having a final newline. The one line that gains a terminator is the item being duplicated, which the
edit names; that is the difference from the move's refused rotation, where the terminated line was
untouched.

The prefix is a real byte beside a block scalar, so `block_the_eof_prefix_would_feed` refuses
**keep** always and **clip** exactly when the content's own last line is the unterminated one —
which is `MoveWouldExtendAKeptBlock`'s withdrawn second clause returned, because the duplicate
writes deliberately the byte the move stopped rotating. **Strip is safe and stays allowed**, which
is what lets `block-scalar-terminal-spaces.yml`'s ordinary item copy while its terminal item is
refused by name (`the_terminal_spaces_fixture_splits_exactly_at_the_eof_block`).

### 2.6 D6 — verification is its own class, derived from the text (consult Q1, the "must not ship without" list)

A duplicate does not weaken property 4 the way a move does — nothing relocates, so "every byte
outside the replaced spans is identical" does its full work over the one zero-width arrival — but
byte identity outside the arrival says nothing about the arrival, so four properties join it, none
reusing an `InsertItem` expectation and none pretending the copy was synthesized fields:

1. **`the_arrival_is_the_copy`** — the byte oracle plus the independent bound. The copied runs
   travel in `DuplicateExpectation` (a duplicate's replacement list has no departures to read them
   from) and are bounded by `item_own_lines`, the textual derivation
   (`DuplicateCarriesMoreThanTheItem`); the arrival's bytes must equal the concatenation of
   **`entry_owned_runs`'s** own answer — which consults nothing the planner built — apart from the
   separately identified EOF prefix (`DuplicatedBytesWereRewritten`). A planner that copied a
   neighbouring blank line or a file-owned comment fails the comparison, because the independent
   derivation excludes both.
2. **`the_duplicate_is_in_place`** — every original item present, in order, with its original
   subtree digest, and the source's digest repeated at `from + 1` (`DuplicateNotInPlace`).
3. **`constructs_outside_the_duplicate_are_unchanged`** — the lockstep walk with the duplicated
   order applied on the original's side (`ConstructChangedOutsideTheDuplicate`). `compare_subtree`
   was generalised to take the intended order rather than a `MoveExpectation`, so the move and the
   duplicate share one walk instead of two that agree today.
4. **`comment_ownership_survives_a_copy`** — the candidate trivia scan the consult requires, as an
   **exact multiset equality**: every original comment with its ownership class, plus one owned copy
   of each comment inside a copied run, and nothing else. Stronger than the move's one-sided form,
   because a duplicate's comment arithmetic is fully known in advance.

`StructuralGuard::Removal` with `CarriesTheItem` pins the runs against the original node spans
exactly as a move's source half is pinned, and `StructuralGuard::Insertion` pins the landing.

### 2.7 D7 — the ambiguity budget counts a duplicated subtree twice, and that is not a weakening

`no_ambiguous_plain_scalar_is_introduced` now takes the duplicated roots and budgets one extra
occurrence per ambiguous plain scalar inside them. A duplicate copies verbatim whatever the item
holds — real espanso files hold `true` and `100` — and refusing the copy would refuse the operation
itself; the property is unchanged for every byte the copy does not explain, and the copy's bytes are
pinned by the oracle in D6. The function's doc comment states this in the same breath as the rule.

### 2.8 D8 — the finding is transaction-produced, clone-addressed, and silent under a model error (consult Q3)

`FindingCode::DuplicateKeepsTriggerDefinition` is a unit variant, classified
`SuspiciousButPermitted`, produced only by `save_document`'s edits mode when the batch holds a
`DuplicateItem` **and** the clone — looked up in the candidate's own projection at
`resulting_path()` — is a match whose `TriggerSpec.kind` is `Single`, `Multiple` or `Regex`. The
`Finding` is attached to the clone's candidate path, span and node, which is its
content-addressing: the same base revision and batch always produce the same candidate bytes, so
the retry recomputes an identical finding and `Acknowledgement::covers_all`'s exact multiset does
the round trip with no new machinery.

When the source has no trigger form or several, `MatchHasNoTriggerField` /
`MatchHasSeveralTriggerForms` appear for the source and the clone both, `verdict` refuses for the
error class, and the suspicion is **not produced** — the precedence the consult requires, driven by
`a_duplicate_of_a_triggerless_match_is_refused_for_the_model_error_alone`. A duplicated item that
does not project as a match — a `triggers` item, say — owes no warning and commits on the first
attempt.

**A generic validator rule for repeated trigger text was considered and rejected**, for the
consult's own reasons, and `validate/mod.rs`'s module documentation records the rejection beside the
code. The English and Spanish sentences say the duplicate keeps the same trigger definition and that
espansoConfig cannot determine how espanso chooses between overlapping definitions; neither says
*invalid*, *will collide*, *will not work*, or which match wins (D2u).

### 2.9 D9 — a `|+` block's trailing blanks are value bytes, measured rather than assumed

The substrate's content span for a keep-chomped block runs over the blank lines below it — the
blanks are the value's trailing newlines — so the ownership hull covers them, the clone carries
them, and both copies decode to what the source decoded to.
`a_kept_blocks_trailing_blank_is_value_and_travels_with_the_clone` pins the bytes on both the
separated and the tight shape. This is why the landing clause of `DuplicateWouldExtendAKeptBlock`
(the non-EOF one) is believed unreachable: the blanks a landing could hand to a block are inside the
hull, not after it. The gate is kept anyway — see hole 3.

---

## 3. Verification

- `cargo test --workspace` — **1036 passed, 0 failed** (baseline 1008, plus 25 in
  `tests/patch_duplicate.rs` and 3 in `tests/persist_save.rs`).
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `npm test` — **1244 passed** (unchanged: the dictionary parity tests compare key sets, so the
  twelve new keys grew no test count).
- `npm run check` — 0 errors, 0 warnings.
- `npm run build` — **168 modules**, unchanged; no new frontend source module exists, so any other
  number would have been the regression the guard describes.
- `cargo tree -p espansoconfig-core | rg tauri` — empty.
- The real-corpus sweep (`every_real_corpus_duplicate_ends_in_a_typed_outcome`): **26 applied,
  0 refused**, every applied case passing the independent byte checks; counts only, per D1 of the
  corpus rules.

The dictionary cascade the new `FindingCode` forces (the Phase 2b-2c-3a precedent) came to: twelve
`code.*` keys per language (`editError` ×4, `duplicateSeam` ×3, `verificationFailure` ×4,
`findingCode` ×1); `DuplicateSeam` registered in `CODE_ENUMS`; `VARIANT_COUNTS` rows for
`findingCode` (12), `editError` (40), `duplicateSeam` (3) and `verificationFailure` (30);
`wire_contract.rs` samples for all four enums with its three tallies moved (177 → 189 variants,
`EditError` 36 → 40, struct/newtype/unit (106, 12, 59) → (114, 12, 63)); and the four TypeScript
union extensions plus the `DuplicateSeam` type in `src/lib/ipc/types.ts`. `codes.ts` needed
nothing: no accessor exists yet because no component renders these codes yet, and the parity suite
is satisfied by the dictionaries and the unions.

---

## 4. Holes this step leaves open, each with its reason

1. **`DuplicateSeam::ArrivalCloses` has no reaching test, and is believed unreachable.** The
   clone's last line is byte-identical to the source's, so the material following the landing meets
   the same bytes it already followed in the original — absorbed-after would imply absorbed-before,
   a contradiction. The one arm that could fire, an empty content span, is claimed first by
   `ArrivalLands` (checked before it, over the same blocks, with a column that always exists). The
   gate is kept for `InconsistentSequenceIndentation`'s reason: the argument rests on the planner
   checking seams in an order and on the substrate's spans, and a named refusal costs nothing while
   the guess it replaces could cost a value.
2. **`DuplicateWouldCopyAFileComment` has no reaching test, and is argued unreachable** — the same
   argument, and the same standing, as `RemovalWouldDeleteAFileComment`: the punch-out removes whole
   lines, so no run can cover a file comment. It is an assertion on the derived runs, live rather
   than decorative, and the verification-side comment multiset would catch the same defect a second
   way.
3. **The landing clause of `DuplicateWouldExtendAKeptBlock` has no reaching test** (D9): the
   substrate consumes a keep block's trailing blanks into its content span, so no blank follows the
   hull of an item such a block ends. "The substrate always does" is a claim about a pre-1.0
   dependency (R1), so the gate stays. Only the EOF clause is proven reachable, in both chomping
   modes it refuses and the one it permits.
4. **`NoObservableLineEnding` is not reached by a duplicate in any test.** The one shape that would
   reach it — a sequence at an unterminated end of file in a document whose only breaks are bare
   carriage returns — was not constructed, because a bare-CR document's parse behaviour is the
   substrate's business and no corpus fixture has the shape. The refusal is shared code with the
   insertion, where it is tested.
5. **The finding's precedence when the duplicated item is a match inside a *second* `matches`-like
   sequence is untested**, because today's projection gives a file exactly one snippet list — the
   same coincidence 2c-3b-1 refused to encode. `duplicate_keeps_trigger_definition` reads the
   projection by path, so a second list would be found or not found honestly; nothing asserts it.
6. **`SaveResult.moved` for a duplicate is step 2's business.** The core answers the clone's
   position through `resulting_index`/`resulting_path`; nothing yet threads it into
   `run_one_save`'s `at` argument, because no command exists. The consult's Q8 warning — the
   returned identity is the only safe continuation — binds 2c-3c-2, and this record repeats it so
   the step that owes it cannot claim it was already discharged.
7. **The `es.json` sentences have not been read on a screen.** The dictionary parity suite proves
   keys and placeholders, never prose; the window reading that would show the Spanish copy is
   2c-3c-3's, and nothing renders these codes until then.

---

## 5. What this step deliberately did not do

- **No `duplicate_match` command, no wrapper, no `matchDuplication.ts`** — step 2 (consult Q5, Q6).
- **No component, no mounted test, no window reading** — step 3, and `CLAUDE.md`'s standing rule
  that none of the three steps is independently the completed sub-phase.
- **No new corpus fixture.** Every byte shape the tests needed was already pinned by an existing
  fixture or expressible as an inline document; the fifteen protected fixtures were not touched, and
  `tests/corpus_integrity.rs` is unchanged. Nothing therefore needs adding to `CLAUDE.md` §4's
  table.
- **No `force` anywhere, no weakening of the acknowledgement protocol**: the finding rides the
  existing exact-multiset machinery unchanged.

---

## 6. The review round

`docs/reviews/phase-2c-3c-1-code.md` — Codex, READINESS: NOT READY, three High findings and one
Low. All four are accepted and fixed; none is disputed as a false positive. Sections 1–5 above are
left as they were written, per the standing rule; where a fix falsifies a sentence up there, this
section is the correction.

### 6.1 Finding 1 (High) — the acknowledgement transferred to a byte-different candidate. Accepted, fixed.

**What was wrong.** §2.8 claimed the clone's path, span and node bind the acknowledgement to one
candidate. They do not: rewrite the source trigger to another value of the **same byte length** and
the new candidate's clone has the same path, the same span and the same freshly minted node number,
so the recomputed finding equalled the retained one and `covers_all` let consent collected for the
`:one` clone commit a `:two` clone nobody was shown. Path, span and node bind consent to a *shape*,
not to a text — the exact class of defect `DocumentDoesNotParse`'s `revision` operand exists for,
re-learned one variant later. **This corrects §2.8's binding claim**; the precedence and
production-site decisions there stand.

**The fix.** `FindingCode::DuplicateKeepsTriggerDefinition` now carries the **candidate's own
`ContentRevision`** as its one operand, filled from the same hash `findings_of` already computes. A
different candidate is a different finding and the exact-multiset machinery does the rest — no new
concept, no protocol change. The cascade the struct variant forced: the wire sample, the
struct/unit tallies ((114, 12, 63) → (115, 12, 62)), and the TypeScript `FindingCode` member
becoming tagged with the operand; dictionaries and `VARIANT_COUNTS` unchanged, since the namespace
and the variant name did not move.
`a_duplicate_acknowledgement_does_not_transfer_across_a_same_length_rewrite` in
`tests/persist_save.rs` is the review's own two-revision construction, asserting the premise too:
the two findings agree in path, span and node, and only the operand tells them apart.

### 6.2 Finding 2 (High) — the arrival's boundary was never independently confirmed. Accepted, fixed.

**What was wrong.** The oracle proved one zero-width arrival with the right bytes and never asked
*where*. A defective planner landing the exact clone one blank separator further down produced
`a, blank, clone-a, b` — right order, right digests, right comments, right bytes, no source byte
moved — and every production property certified it while the design's derived immediate-after
landing was violated.

**The fix.** `the_arrival_is_the_copy` now requires `arrival.span.start` to equal the **end of the
item's own lines as `item_own_lines` re-derives them** — the same textual derivation that already
bounds the runs, consulting nothing of the planner's — and reports a mismatch as
`DuplicateNotInPlace`, whose sentence ("the copy immediately after its source") is exactly what the
byte-level violation breaks; the variant's doc comment now names its two producers.
`a_planner_that_lands_the_clone_past_the_separator_blank_is_rejected` is the review's adversarial
pair, driven through `tampered_duplicate` — the whole safety boundary, with the span, the permitted
set and the insertion guard all moved so the landing is the only thing wrong — plus the untampered
twin proving what is refused is the landing and not the request.

### 6.3 Finding 3 (High) — the run bound did not exclude file-comment provenance. Accepted, fixed.

**What was wrong.** The claimed runs were bounded only by the contiguous `item_own_lines` hull —
which *contains* the file-owned holes — and `entry_owned_runs`' independent run list was used only
to build the expected text, never compared against the claim. The copied-comment increment was then
derived **from the planner's own runs**, and the candidate side matched by a global (text, class)
multiset. Two equal spellings — an owned comment and a file-owned one in the same hull — are
indistinguishable to every one of those layers, so a defective claim could assert file-owned
provenance and the verifier would repeat the assertion back. **This corrects §2.6's claim** that a
copied file-owned comment "fails the comparison": the byte comparison pins the *string*, never the
*provenance*, and the code comments that said otherwise are rewritten.

**The fix**, in three parts, all reasoning from re-derived values. (1) The claimed run set must now
**equal** `entry_owned_runs`' set — not merely concatenate to the same bytes — reported as
`DuplicateCarriesMoreThanTheItem`; over the full table, the five corpus fixtures, the three seam
fixtures and the whole real corpus the two derivations agree everywhere, so the equality costs no
legitimate duplicate. (2) `the_arrival_is_the_copy` hands verification a `PlacedClone` — boundary,
EOF prefix and the **independent** run set — and `comment_ownership_survives_a_copy` derives the
copied increment from that, so no planner value reaches the comment arithmetic. (3) A new
clone-relative position check: each copied comment must appear in the candidate at exactly the
clone-relative offset the copy puts it at, same length, owner not the file — the check that tells
two equal spellings apart by where they are, which no global multiset can.
`a_claim_that_swaps_equal_spellings_between_owners_is_rejected` is the review's mutation — equal
spellings, the file's occurrence claimed, the owned one dropped, guards updated so only the claim is
wrong — plus the honest twin pinning three occurrences in the candidate and the file's uncopied.
`a_planner_that_permutes_the_copied_comment_lines_is_rejected` pins the byte oracle itself the way
the move's permutation experiment pins its own.

### 6.4 Finding 4 (Low) — the real-corpus sweep was satisfiable by refusing everything. Accepted, fixed.

**What was wrong.** Every `Err` was counted and accepted, nothing asserted that any attempt or
application happened, and the applied arm replayed the engine's own replacement text — so an
all-refused regression stayed green, and §3's sentence crediting the sweep with "the independent
byte checks" overclaimed. **This corrects that §3 sentence**: the independent proof lives in the
synthetic mutation tests (§6.2, §6.3), and the sweep's job is coverage and non-vacuity.

**The fix.** When the corpus is present the sweep now requires at least one attempt **and** at least
one applied duplicate; a refusal outside the classes a duplicate can legitimately produce — above
all a verification discard — panics with the file's name and never its content; and every applied
case must grow the reparsed `matches` sequence by exactly one. It still skips cleanly when the
corpus is absent. Re-run after the fixes: **26 applied, 0 refused**, unchanged.

### 6.5 The confirmation pass — one Low, accepted, fixed

The confirmation pass found the F3 mutation proving less than §6.3 claimed: the tamper rebuilt the
arrival's bytes **from the swapped claim**, and ascending, disjoint runs concatenate
order-preservingly, so those bytes differ from the honest concatenation — the honest one holds
`# same note` *above* `first:`, the swapped one below — and the pre-existing byte oracle would have
refused the candidate as `DuplicatedBytesWereRewritten` with the run-vector equality removed. The
test reached `DuplicateCarriesMoreThanTheItem` only because that check runs first: it pinned the new
producer without isolating it. **This corrects §6.3's sentence calling that mutation
"indistinguishable to the old layers"**; the production equality itself was confirmed closed.

**The fix isolates the provenance layer at pipeline level.** The mutation now tampers **only the
claim** — `DuplicateExpectation.runs` and the removal guard's copy, via the shared
`equal_spelling_swap` derivation — and leaves the arrival bytes honest, so the byte oracle, the
boundary check, the hull bound and both guards all have nothing to disagree with; the run-vector
equality is the one property that can refuse. That claim was **measured rather than asserted**:
with the equality temporarily disabled, the tampered plan came back `Ok` through the entire safety
boundary — guards, splice and every remaining verification property — and the test failed for the
provenance reason alone; restored, it refuses. A companion test,
`a_provenance_swap_that_rebuilds_the_bytes_is_caught_by_the_byte_oracle_instead`, records the
ascending/disjoint nuance as two measurements: the swapped concatenation is byte-unequal to the
honest one, and the rebuilt-bytes tamper is refused by the byte oracle — which is why it isolates
nothing and why the false-claim-over-honest-bytes channel is the one the equality exists for.
Nothing outside `edit.rs`'s test module and this record changed; production is untouched.

### 6.6 The gates, re-run after the round and again after the confirmation pass

- `cargo test --workspace` — **1041 passed, 0 failed** (1036 after the first pass, plus the three
  adversarial experiments in `edit.rs`'s test module, the transfer test in `persist_save.rs`, and
  the confirmation pass's byte-oracle companion test).
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `npm test` — **1244 passed** (unchanged; no key moved).
- `npm run check` — 0 errors, 0 warnings.
- `npm run build` — **168 modules**, unchanged.
- `cargo tree -p espansoconfig-core | rg tauri` — empty.
