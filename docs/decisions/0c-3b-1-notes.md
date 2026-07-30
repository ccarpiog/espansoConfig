# Phase 0c-3b-1 — the removal envelope becomes a set of owned runs

Phase 0c-3b-1 closes risk **R21** and completes decision **D2o**. A structural edit's envelope was
one contiguous [`ByteSpan`]; it is now an ordered, disjoint set of **runs**, spliced as several
replacements. The removal the Phase 0c-3a review's finding 1 demonstrated — the one that deleted a
comment the ownership rules give to the file — is a real edit again, and the comment comes out byte
for byte.

The code is [`crates/espansoconfig-core/src/patch/edit.rs`](../../crates/espansoconfig-core/src/patch/edit.rs);
the acceptance sweep is [`crates/espansoconfig-core/tests/patch_structure.rs`](../../crates/espansoconfig-core/tests/patch_structure.rs).

**Out of scope, deliberately not started:** moving a match, the whole-document multiset invariant a
move needs, the full R9 round-trip property test, and R16. Those are **0c-3b-2**. This phase is the
prerequisite the "Next action" section of `PROGRESS.md` names as scope item 1.

**This record was extended by the phase's own adversarial review.** Section 8 dispositions both of its
findings — what was adopted, what was declined and why — and sections 2.1, 2.2, 3, 4, 5, 6 and 7.3
carry the corrections it forced. Where a claim in this document was withdrawn, the withdrawal is stated
next to it rather than the sentence quietly rewritten.

---

## 1. What a hull could not say

`TriviaIndex::subtree_extent` returns the smallest **contiguous** span covering everything an
entry's subtree owns. A comment the file owns has no owning node, so it never *widens* that hull —
but one lying between two descendants is inside it anyway:

```yaml
a:
  x: 1
  # keep this file comment

  y: 2
b: 3
```

Removing `a` deleted the comment, and all four layers of Phase 0c-3a certified the result. That is
D2o. The 0c-3a fix round answered with a refusal, `EditError::RemovalWouldDeleteAFileComment`, and
recorded plainly that the refusal was the safe half of an unfinished answer: **one span cannot say
"delete the entry and keep that comment."**

It can now, and the removal produces exactly:

```yaml
  # keep this file comment

b: 3
```

Pinned byte-exactly by `removing_a_collection_that_holds_a_file_comment_keeps_the_comment_byte_for_byte`
in `tests/patch_structure.rs` and by `a_removal_whose_envelope_crosses_a_file_comment_keeps_the_comment`
in `src/patch/edit.rs`. The kept bytes are the comment's own line — its two leading spaces, its `#`,
its text and its break — plus the blank line under it.

---

## 2. How the run set is derived

Three steps, and the first is unchanged from Phase 0c-3a:

1. **The hull.** `entry_extent` takes `subtree_extent` over the entry's key *and* its value, then
   `removal_span` widens it to whole lines: back to the start of the entry's first line, which must
   hold nothing but indentation, and forward past the break that terminates its last. Anything else
   on either side is still `EntryDoesNotOwnItsLines`.
2. **The holes** (`preserved_regions`). For every comment `TriviaIndex::file_comments` gives to the
   file whose span intersects the hull: the whole line it occupies, indentation and terminating break
   included, grown over every `TriviaIndex::blank_runs` entry that touches that line at either end.
   The regions are then sorted and merged, so two comment blocks separated by the entry's own bytes
   stay two holes and two comments of one block become one.
3. **The runs** (`runs_between`). The set difference `hull − preserved`, in ascending order, every
   run non-empty. `plan_removal` emits one `Replacement` per run with empty text, and `apply_edits`
   sorts the whole batch's flat replacement list, rejects overlaps and splices from the highest
   offset downwards exactly as before.

### 2.1 The blank-run rule, in both directions

**A blank run survives a removal exactly when it touches the line of a file-owned comment the removal
preserves. Every other blank run inside the hull is deleted with the entry.** The review's finding 1
is why that is written down here rather than left implicit, and why the two halves are argued
separately instead of under one slogan:

- **The run below a kept comment is ownership.** Plan section 6.2 rule 2 reads the blank line *below*
  a comment to give that comment to the file, so deleting it hands the surviving comment to whatever
  ends up underneath — a re-attribution the edit was never asked to make. This half is not a choice.
- **The run above a kept comment is adjacency, not ownership.** Deleting it would leave the comment
  file-owned all the same; the rule does not pretend otherwise. It survives because the unit the
  derivation preserves is the neighbourhood `blank_runs()` groups with the comment's line, and
  deciding *per side* which of the ownership layer's blank runs "counts" is exactly the re-decision
  the gap layer is not allowed to make (D2 / D2d).
- **A blank run touching no kept comment is interior trivia of the removed entry**, and goes with it.
  It lies inside the span the user asked to delete, and the premise this crate defends is that every
  byte *outside* an intended span is identical — not that bytes inside a deliberately removed entry
  survive. Preserving it would additionally invent a leading blank line at document start where the
  file had none, which is an infidelity of its own.

The first phrasing of this section said the run above was preserved "for symmetry" and because "a
blank line is the file's layout rather than the entry's trivia". That second reason is the one the
review demolished: it would apply equally to a blank run touching no comment, and such a run is
deleted. The wording is withdrawn from here, from `PROGRESS.md`, from `preserved_regions` and from
the fixture's own comment. Both directions are now pinned byte-exactly by
`a_blank_run_survives_only_where_it_touches_a_kept_comment` in `src/patch/edit.rs`, so a future change
to either half fails loudly.

`TriviaIndex::blank_runs` is the source of truth for which lines those are, and the choice matters
for a reason that is easy to miss: it is a **gap-only** answer. A whitespace-only line inside a block
scalar's body is that scalar's *content* and is never a blank run, so the derivation can never
preserve a fragment of a value. A textual "this line is all spaces" test would.

### 2.2 Why this is not a restatement of the planner's intent

The reviewer's charge against Phase 0c-3a — and against 0c-2b before it — was that the edit's own
declaration authorised the bytes it destroyed. So the question this section has to answer is not
"is the derivation correct" but "what could contradict it".

**Every input is an ownership fact the planner does not choose.** The hull comes from
`subtree_extent`, which is plan section 6.2's rules applied to the entry's two node identifiers; the
holes come from `file_comments()` and `blank_runs()`, which are the same layer's answers about the
same document. `plan_removal` supplies the entry's key and value node identifiers and nothing else.

**Four checks sit on the output, and none of them is the derivation restated:**

| Check | What it reads | What it would catch |
|---|---|---|
| `StructuralGuard::Removal`, half one | the **original index's** node spans | a run reaching into a node that is neither of the entry nor an ancestor of it (`EnvelopeCoversAnotherNode`) |
| `StructuralGuard::Removal`, half two | the same | the runs failing to cover a **frontier leaf of the entry** (`EnvelopeMissesTheEntry`) |
| the per-run `file_comment_inside` assertion | `TriviaIndex::file_comments` | a punch-out off by one byte (`RemovalWouldDeleteAFileComment`) |
| `check_removal_runs` in the sweep | the source text, the node spans and the trivia index, written independently of the engine | eight properties, section 4 |

**Half two is new, and it is the reason the move from hull to set is a strengthening rather than a
weakening.** With a hull, "the envelope covers the whole entry" was true *by construction* and
therefore unstated. With a set it is a claim, and the empty set satisfies "the envelope touches
nothing outside the entry" perfectly. The guard now asserts both directions. Stated over frontier
leaves rather than over every node, because a collection's span inside the entry legitimately
straddles a preserved comment — it is derived from children that lie on both sides of it — while a
token never can.

**What the two halves prove, stated exactly — the first write-up overstated this and the review was
right about it.** They say the run set covers *exactly the entry's **nodes***: every frontier leaf of
it is deleted, and no node outside it is touched. They say **nothing about trivia**, because both
halves are stated over node spans. Trivia interior to the hull that no node owns is invisible to them,
so an envelope can satisfy both and still delete a comment the ownership rules give to the file —
which is precisely the defect D2o records. The claim "together they say the run set is exactly the
entry" is therefore withdrawn; what governs the trivia is the punch-out, the per-run `file_comments()`
assertion, `VerificationFailure::FileCommentLost` and the sweep's property 6, and those are four
different layers rather than a corollary of the guard.

Nothing was weakened to accommodate runs. `StructuralGuard`, the sibling digest, the file-comment
check, `bytes_outside_the_replacements_match`, `replacements_stay_inside_the_permitted_spans` and the
`OverlappingEdits` rejection all still apply, and the last of them now matters more: **one removal
contributes several replacements to one flat batch list**, so a per-edit disjointness check would
have missed a scalar edit inside the *second* run. Pinned by
`every_run_of_a_multi_run_envelope_takes_part_in_the_batch_protocol`.

---

## 3. The residual shape: a kept comment under a block scalar

Punching the comments out is **not** sufficient, and neither D2o nor the review said so. A comment
line left where it is, directly under a block scalar's content and at or past that block's own body
column, is **content of the block** rather than a comment:

```yaml
matches:
  - trigger: ':block-scalar-above'
    replace: |
      the content of this block ends where the next entry begins
    vars:
      only: 'one'
      # a comment the file owns

      last: 'two'
```

The `|` block's content span ends exactly where the `vars:` line begins (D2c). Deleting `vars`'s two
runs while keeping the comment would put `# a comment the file owns` immediately below `the content
of this block…` at the same indentation, so `replace` decodes with an extra line although nothing
about it was edited. It is the same class as `RemovalWouldExtendAKeptBlock` — a neighbour's value is
not local — reached from the other direction: that one is about blank lines a *deletion* hands to a
keep-chomped block, this one about bytes a *preservation* hands to any block, keep-chomped or not.

**It is refused by name, `EditError::RemovalWouldExtendABlockScalar`.** The condition was first stated
without an indentation comparison — the removal has something to preserve **and** some block scalar's
content ends at or before the envelope's first run with nothing but blank lines in between — on the
grounds that a block's body column is only *reconstructible* (D2). **The review's finding 2 showed that
to be over-broad, and it now compares columns.** Three clauses:

1. the removal has something to preserve;
2. some block scalar's content ends at or before the envelope's first run with nothing but blank lines
   in between;
3. **the first non-blank line the removal preserves sits at that block's own body column or deeper.**

Clause 3 is the fix. A preserved line *shallower* than the body column ends the block, exactly as the
removed entry's own key already did, so the block's decoded value cannot change and the removal is
legal. The reviewer's document is the case:

```yaml
replace: >
  body
vars:
  first: one
# keep this file comment

  second: two
tail: 3
```

Removing `vars` now applies and yields `replace: >\n  body\n# keep this file comment\n\ntail: 3\n`,
pinned byte-exactly by `a_kept_comment_shallower_than_the_block_above_it_is_not_absorbed` in
`src/patch/edit.rs` and, on corpus data, by
`a_kept_comment_shallower_than_the_folded_block_above_it_applies_byte_for_byte` in
`tests/patch_structure.rs`.

**The body column is read, not re-derived.** It is `ScalarPresentation::indent`, which the span layer
already publishes — the substrate's own start-marker column, documented as the content-indentation
column exactly. The earlier "only reconstructible" objection conflated two things: reconstructing a
block's *end* needs three inputs and is genuinely delicate (D2), while its body *column* is a fact the
span layer decided in Phase 0b and that the decoder already strips on every read. Re-lexing it in the
gap layer would be a second answer to a question that has one, which is what D2/D2d forbid.

**One case has no observed column, and is still refused whatever the comment's column is:** a block
scalar whose content span is **empty** — `replace: |` with the next sibling directly under it, the R5
shape a desktop editor sees on every keystroke. There `indent` holds the column of the *header* rather
than of any body line, so comparing against it would compare against a number that means something
else. Where the span layer observed nothing, the conservative answer is the only honest one, and it
costs a removal the user can perform as soon as the block has a first body line.

**Why this was not caught by verification instead.** It would have been: the sibling digest sees
`replace` change and answers `SiblingChanged`. But a verification failure is a defect in the
planner, not an expected answer — `audit` panics on one — so the shape has to be refused before a
byte moves.

**No fixture in either corpus held it (R20, the fifth time).** So one was written:
[`run-based-removal-envelope.yml`](../../crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml),
whose two matches are exactly the two shapes that tell a run set from a hull — one where the removal
succeeds with blank lines preserved on both sides of the kept comment, one where it is refused. A
unit test alone was not accepted as sufficient, per R20's standing instruction; there are unit tests
too, in `src/patch/edit.rs`, and they cover CRLF, a BOM, a missing final newline, two comment blocks
in one entry and a multi-line blank run.

**The review made it R20's sixth occurrence, and a second fixture was written:**
[`run-based-removal-boundaries.yml`](../../crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-boundaries.yml),
whose two matches are the two shapes finding 2 named and neither corpus held:

- a **folded `>`** block above a removal whose preserved comment block sits at **column zero**, so the
  narrowed refusal must let the removal through. It is deliberately the counter-example to
  `run-based-removal-envelope.yml`'s second match, which is the same construct with the comment at the
  body column: the two fixtures differ in `block_absorbs` (0 against 1) and nowhere else, so the
  narrowing is pinned as a difference between two corpus files rather than only in a unit test;
- an **entry-owned leading comment block paired with an interior file comment**, which the first
  write-up of this phase admitted neither corpus contained. That combination is what makes a removal
  envelope start *above* the entry's own first line, and it is why the sweep's own R23 derivation now
  measures from `entry_hull_lines` rather than from `entry_lines`. The two used to disagree for exactly
  this shape, with the sweep's answer documented as "answers `false` where the engine refuses, which is
  the direction that has to be safe" — an admitted hole rather than a property, now closed.

**This fixture *does* join `CLAUDE.md` section 4's table, taking it from eleven to twelve, and the
older one still does not.** The distinction is which bytes carry the test.
`run-based-removal-envelope.yml` has no trailing spaces, no CRLF and a final newline: nothing a "tidy
on save" destroys. `run-based-removal-boundaries.yml` is the opposite case — its column-zero comments
and its leading block flush against `vars:` are *indentation*, and an editor that re-indents comment
lines (several offer to) silently turns the safe case into the refused one and dissolves the
run-boundary construct. `the_boundaries_fixture_keeps_its_column_zero_comments_and_its_leading_block`
in `corpus_integrity.rs` guards both. Both fixtures are in that file's coverage list, so a rename or a
deletion fails loudly either way.

---

## 4. What the sweep proves, and the eight properties

`check_removal_runs` replaces 0c-3a's four-property `check_removal_envelope` with eight — seven when
this phase first landed, and the review rewrote property 6 and split property 8 out of it. Four exist
only because an envelope can now be a set:

1. every run is non-empty, and the runs are in ascending order and disjoint;
2. every run starts a line and ends a line or the file;
3. no run reaches into the BOM;
4. the runs together cover **every frontier leaf of the entry**, so no token of it survives;
5. no run covers a node that is neither part of the entry nor an ancestor of it;
6. **the runs and the bytes the preservation rule protects partition the envelope's own byte range**,
   in both directions: no byte the rule protects is deleted, and no byte the rule does not protect is
   kept;
7. no run intersects a comment the file owns;
8. every gap holds whole lines and holds nothing but comment and blank lines.

### 4.1 Property 6 was the review's finding 1, and it was not an oracle

What this phase first wrote was *"every gap between two runs exists for a comment the file owns"*, and
the review's judgement on it is correct and worth keeping verbatim in effect: it **codified** the
behaviour instead of checking it. Two consequences, and the first is the serious one:

- **It could not see under-preservation at all.** Delete the blank line that makes a kept comment
  file-owned and the gap still holds a comment, so the property passes. Nothing else in the sweep
  looks: the comment's *text* survives, so `lost_file_comment` passes; comments are not in a decoded
  value, so the sibling digest passes. Demonstrated, not argued — see experiment 5 in section 6, where
  the engine is made to stop preserving the ownership blank run and **both corpus sweeps pass**.
- **It rejected any change to the rule mechanically.** Had a later round decided to preserve unowned
  blank runs — which is what the review asked for and section 9 declines — the property would have
  failed with "the envelope is split for no file-owned comment", which is an assertion about the old
  rule dressed as a defect report.

The replacement is `preserved_by_the_rule`, which states the rule once on the test side, from
`file_comments()` and `blank_runs()` with this file's own line arithmetic, clamp and merge. The
comparison against the observed gaps runs both ways and names bytes:

- *"the envelope deletes 294..482, which the preservation rule protects for a comment the file owns"*;
- *"the envelope keeps X..Y, which the preservation rule does not protect"*.

So an engine that violates the rule is caught with the region and the direction, and a *deliberate*
change to the rule has exactly one function to edit and a real disagreement to read until it is
edited. Both messages are driven directly, against run sets no planner in the tree can produce, by
`the_preservation_rule_oracle_reports_a_disagreement_in_both_directions` — the same technique
`the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts` uses, and for the same reason.

Property 8 keeps the two sub-assertions the old property 6 carried, because they are independent of
`preserved_by_the_rule` rather than implied by it: they read the *source text*, so a
`preserved_by_the_rule` that protected a content line would be caught by them instead of agreed with.

Everything 0c-3a checked from outside the engine still is: the candidate is the source with the
reported replacements applied, the candidate parses, the field is present or absent as asked, every
sibling still decodes to what it decoded to before, every line break an insertion writes is
byte-identical to the one already in use where it lands, and every comment the file owns is still
there.

---

## 5. What R21's closure cost, and what it gained — measured, both corpora

### 5.1 The structural sweep

**Synthetic: 2 572 → 2 634 attempted structural edits.**

| Category | 0c-3a | 0c-3b-1 | Why it moved |
|---|---|---|---|
| inserted | 1 503 | 1 544 | +41, all `run-based-removal-envelope.yml` |
| removed | 248 | 256 | +7 from the new fixture, **+1 because R21 closed** — `file-comments-and-mixed-endings.yml`'s `vars` entry, refused for the whole of 0c-3a |
| gate | 256 | 256 | — |
| flow | 24 | 24 | — |
| last-entry | 28 | 29 | +1, the new fixture's root mapping |
| shares-a-line | 136 | 138 | +2, the new fixture's two compact `- trigger:` entries |
| duplicate-key | 182 | 187 | +5, one per mapping of the new fixture |
| kept-block | 5 | 5 | — |
| **file-comment** | **1** | **0** | the refusal became an assertion; the one attempt is now a success |
| **block-absorbs** | — | **1** | new category, the residual shape of section 3 |
| no-such-sibling | 182 | 187 | +5, one per mapping of the new fixture |
| inconsistent-indentation | 0 | 0 | still unreachable (R22) |
| no-line-ending | 7 | 7 | — |

62 of the 63 category moves are the new fixture's own shape; the 63rd is the single attempt that
crossed from `file-comment` to `removed`, which is R21's entire measured gain on the corpus as it
stood.

**The review's fix round: 2 634 → 2 696.** Every one of the 62 new attempts is
`run-based-removal-boundaries.yml`'s own shape, and **no attempt changed category**: +41 inserted,
+8 removed, +1 last-entry, +2 shares-a-line, +5 duplicate-key, +5 no-such-sibling. `block_absorbs`
stays at **1** — the narrowed refusal still fires for `run-based-removal-envelope.yml`'s second match
and does not fire for the new fixture's first, which is the narrowing measured rather than asserted.
The new fixture contributes 8 removals rather than 7 because *both* of its `vars` entries are
removable, where the older fixture has one refused.

| Category | 0c-3a | 0c-3b-1 | after the review | Why it moved the second time |
|---|---|---|---|---|
| inserted | 1 503 | 1 544 | 1 585 | +41, all `run-based-removal-boundaries.yml` |
| removed | 248 | 256 | 264 | +8, both of the new fixture's `vars` entries among them |
| gate | 256 | 256 | 256 | — |
| flow | 24 | 24 | 24 | — |
| last-entry | 28 | 29 | 30 | +1, the new fixture's root mapping |
| shares-a-line | 136 | 138 | 140 | +2, its two compact `- trigger:` entries |
| duplicate-key | 182 | 187 | 192 | +5, one per mapping |
| kept-block | 5 | 5 | 5 | — |
| file-comment | 1 | 0 | 0 | still pinned at zero, still argued unreachable |
| block-absorbs | — | 1 | **1** | **unchanged: the narrowing let one new attempt through and turned none away** |
| no-such-sibling | 182 | 187 | 192 | +5, one per mapping |
| inconsistent-indentation | 0 | 0 | 0 | still unreachable (R22) |
| no-line-ending | 7 | 7 | 7 | — |

**Real corpus: 1 856 attempted structural edits — 928 inserted, 419 removed, and 0 in every refusal
category except 44 last-entry, 103 shares-a-line, 181 duplicate-key and 181 no-such-sibling.
Identical to Phase 0c-3a and unchanged by this review's fix round, every figure** — the narrowed
refusal fired zero times before and after, and the rewritten property 6 found no disagreement on any
of the 419 removals. No count from it is hard-coded.

### 5.2 So what was it worth?

Stated plainly, because the number is small and pretending otherwise would be dishonest:

- **The gain on today's corpora is one synthetic removal and zero real ones.** That is exactly the
  cost D2o measured for the refusal, seen from the other side, and 0c-3a said as much.
- **The gain that matters is not in the corpus.** Three things:
  1. the class of refusal is gone for a user who comments their config by hand, which is the whole
     population this product is for;
  2. **the invariant got stronger, not weaker** (section 2.2): `EnvelopeMissesTheEntry` states
     something a hull made unstatable, and the two halves of the guard now pin the entry's **nodes**
     from both sides. Not its trivia — see section 2.2 for what that claim does and does not cover;
  3. **0c-3b-2 needs it.** A move carries an envelope to a destination. With a hull it would carry
     the file's comment *with* the entry, which is worse than deleting it — the comment would appear
     somewhere it never was. There is no version of the move that is correct on a hull.
- **The cost is one new refusal** (`RemovalWouldExtendABlockScalar`), one synthetic attempt, zero
  real ones, and one new fixture. After the review's finding 2 narrowed that refusal it is still one
  synthetic attempt and zero real ones — the narrowing bought a *class* of removal rather than a
  count, exactly as R21's closure did.

### 5.3 Runtime (R19)

`TriviaIndex::scan` is still quadratic and neither this phase nor its review's fix round touched it.
The derivation adds one pass over `file_comments()` and one over `blank_runs()` per removal, both
linear and both over lists that are small; the column comparison finding 2 added is one pass over the
preserved regions, which are smaller again. Measured on the machine with the real corpus:
`patch_structure` 17.4 s → 18.2 s → 18.6 s and `patch_edit` 20.6 s → 21.6 s → 21.4 s, and the moves
are the new fixtures' attempts rather than either derivation. R19 stays open, unchanged.

### 5.4 Every other pinned count the two fixtures moved

`run-based-removal-envelope.yml`: **26 nodes** = 1 document + 6 collections (the root mapping, the
`matches` sequence, 2 item mappings and their 2 nested `vars` mappings) + **19 scalars** (11 keys, 8
values), none zero width, one of them a `|` block, with 9 whole-line comments, 3 real blank lines, no
CRLF, no trailing spaces and a final newline.

`run-based-removal-boundaries.yml`, the review's fixture, has the **same tree** — 26 nodes, 6
collections, 19 scalars (11 keys, 8 values), none zero width — and differs only in its trivia and in
the style of its one block scalar: **12** whole-line comments, 2 real blank lines, and a `>` where the
other has a `|`. That is deliberate: two fixtures with identical shapes and different trivia make each
trivia figure's delta attributable, and the `>`/`|` difference is a live cross-check on D2e.

| Pin | 0c-3b-1 | after the review | Why |
|---|---|---|---|
| fixtures | 26 → 27 | **28** | the second fixture |
| nodes (`patch_path`) | 1 185 → 1 211 | **1 237** | the same 26-node shape again |
| addressable | 685 → 699 | **713** | its 6 collections + 8 values |
| documents | 28 → 29 | **30** | one more single-document fixture |
| mapping keys | 468 → 479 | **490** | `matches`, each item's `trigger`/`replace`/`vars`, and the four keys inside the two `vars` mappings |
| scalars (`syntax_index`) | 891 → 910 | **929** | 19 scalars |
| frontier members | 891 → 910 | **929** | none of the 19 is zero width |
| collections | 261 → 267 | **273** | 6 |
| flow collections | 11 → 11 | 11 | neither fixture has one |
| block scalars | 45 → 46 | **47** | its one `>` |
| overshooting block scalars | 42 → 43 | **44** | that block is followed by a further entry, so it has somewhere to overshoot into |
| overshooting block collections | 234 → 240 | **246** | **all 6**, because the file ends with a line break: a collection that reaches end of file still has that break to overshoot into. `file-comments-and-mixed-endings.yml` contributed only 3 of its 6 precisely because it has *no* final break — the cross-check between the fixtures |
| collections owning a tail past their span | 7 → 7 | 7 | it ends no mapping with an empty entry or an inline comment |
| zero-width leaves | 5 → 5 | 5 | it has none |
| gap comments (line scan) | 224 → 233 | **245** | its 12 whole-line comments |
| scanner comments | 229 → 238 | **250** | the same 12 — it has **no** inline comment, so here the two conventions agree, which is its own cross-check (D2d) |
| blank lines (line scan) | 738 → 756 | **773** | the loose convention, which also counts content-line terminators |
| scanner blank lines | 103 → 106 | **108** | its 2 real blank lines, and **both** are ownership: one gives the column-zero comment block to the file, the other the interior comment of its second match |
| blank runs | 99 → 102 | **104** | one per blank line; both are isolated |
| trivia items | 2 923 → 2 996 | **3 072** | — |
| hazards | 18 → 18 | 18 | it raises none |
| decoder agreement (`scalar_codec`) | 886 → 905 | **924** | all 19, none skipped |
| re-encoded identically | 873 → 892 | **910** | **18 of its 19**, not all 19: its one block scalar is a `>`, which is decode-only (D2e), so it joins the `FoldedStyle` refusal family (11 → 12) and is named in `SYNTHETIC_REFUSALS` by span. The `\|` of the other fixture re-encoded identically — the same-shape pair makes that asymmetry visible |
| attempted scalar edits (`patch_edit`) | 5 028 → 5 124 | **5 220** | its 8 value scalars × 12 |
| of which applied | 4 687 → 4 783 | **4 879** | all 96; nothing about a run-based *structural* envelope reaches the scalar path |
| attempted structural edits | 2 572 → 2 634 | **2 696** | section 5.1 |

---

## 6. The visibility layers, disabled one at a time — and the engine broken twice

`PROGRESS.md`'s "Next action" requires the three-layer discipline that 0c-3a's finding 1 forced to
survive this phase, and requires it to be **demonstrated** rather than asserted. Each layer was
disabled in turn, in the order the bytes flow, and each time the next one down caught the class on
its own. The runs of the experiment are recorded here rather than left as a claim.

| Experiment | What was disabled | What caught it, and how it said so |
|---|---|---|
| 1 | `preserved_regions` made to return the empty set, so the envelope is a hull again | **Layer 1, the planner.** `EditError::RemovalWouldDeleteAFileComment`: *"edit 0: a run of the removal envelope still covers the file-owned comment at bytes 12..36"* |
| 2 | experiment 1 **plus** the per-run `file_comment_inside` check in `plan_removal` | **Layer 2, verification.** `VerificationFailure::FileCommentLost { at: 12 }`: *"the file-owned comment at byte 12 is not in the candidate"* |
| 3 | experiments 1 and 2 **plus** `file_comments_survive` in `verify` | **Layer 3, the sweep.** `check_removal_runs` property 7 fired first, on corpus data: *"file-comments-and-mixed-endings.yml mapping 4 remove 7: an envelope run covers a comment the file owns"* |
| 3b | experiments 1, 2 and 3 **plus** property 7 | **Layer 3, second view.** The rewritten property 6: *"file-comments-and-mixed-endings.yml mapping 4 remove 7: the envelope deletes 294..482, which the preservation rule protects for a comment the file owns"*. Before the review this experiment reached `lost_file_comment` — property 6 could not fire, because with nothing preserved there are no gaps for it to look at |
| 3c | experiments 1, 2, 3 and 3b **plus** the rewritten property 6, to isolate the before/after scan | **Layer 3, third view.** `lost_file_comment`, the oracle's own comment scan, which shares no code with `TriviaIndex`: *"file-comments-and-mixed-endings.yml mapping 4 remove 7: the file-owned comment at byte 300 was deleted"* |
| **5** | **nothing disabled — the *engine* made to violate the preservation rule.** `preserved_regions` still punches out each comment's line but no longer grows over the blank runs beside it, so a kept comment loses the blank line that makes it file-owned | **Layer 3, property 6, on corpus data:** *"file-comments-and-mixed-endings.yml mapping 4 remove 7: the envelope deletes 294..482, which the preservation rule protects for a comment the file owns"* |
| **5b** | experiment 5 **plus** the rewritten property 6, to measure what the *old* property 6 could see | **Nothing. Both corpus sweeps pass.** 2 696 synthetic and 1 856 real attempted structural edits, all green, with the engine deleting the byte that decides a kept comment's ownership |

All four of experiments 1 to 3c were re-run after the review's fix round, because layer 3 changed.
Experiments 1, 2 and 3 produce the same messages as recorded; 3b's catcher changed, and 3c is new
because a third view now stands between property 7 and the comment scan.

**Experiment 5b is the review's finding 1 demonstrated rather than accepted on argument.** The old
property 6 asked only that every gap hold a file-owned comment, and the gap here *does* hold one — the
comment's line is still punched out, only the blank line under it is gone. So the property passed, the
comment's text survived and `lost_file_comment` passed, no decoded value changed and the sibling digest
passed, and the sweep certified an engine that re-attributes a comment the ownership rules give to the
file. Experiment 5 is the same engine against the rewritten property, which names the bytes and the
direction. That is the difference between an oracle and a restatement.

Three more things are worth keeping.

**Experiment 1's message is the answer to "is `RemovalWouldDeleteAFileComment` now dead code".** It
is not. It is no longer a *policy* — the removal it used to refuse now succeeds — but it is a live
assertion on the derived run set, reading the document's own ownership answer rather than the
arithmetic that produced the runs. It is argued unreachable (every file-owned comment occupies whole
lines strictly inside the hull, and the punch-out removes whole lines) and the sweep pins it at
**0** over both corpora. That makes it the second pinned zero in this table resting on an argument
rather than on a construction, alongside `InconsistentEntryIndentation` (R22) — with the difference
that experiment 1 shows this one firing, which no fixture can do for R22.

**Experiment 3 found that the sweep now has *three* independent views of the class**, not one: property
7 on the run set, the rewritten property 6 against `preserved_by_the_rule`, and the before/after
comment scan 0c-3a added. They fire in that order and any of the three would have. The third arrived
with this phase and the second with its review, and neither was set out to be a strengthening.

**Experiment 5 also answers "does the sweep still only *restate* the planner".** The two make different
mistakes: experiments 1 to 3c break a *layer* and leave the engine correct, so they measure visibility;
experiment 5 breaks the *engine* and leaves every layer in place, so it measures detection. An oracle
that only ever sees experiments of the first kind has never been shown to disagree with anything.

---

## 7. Claims this phase proved false

### 7.1 `docs/decisions/0c-3a-notes.md` section 2.1 overestimated what a run set would disturb

It predicted the change would alter "the shape of `PlannedEdit`, of `StructuralGuard`, of the
permitted-span check and of the per-fixture golden tables, and it interacts with the whole-document
invariant 0c-3b needs for a move."

Measured, two of the five are wrong:

- **`PlannedEdit` did not change shape at all.** It already held `replacements: Vec<Replacement>` and
  `permitted: Vec<ByteSpan>`, because a block scalar's header and content are two separate
  replacements (the 0c-2b review's finding 1, D2c). The batch protocol was written for a *list* of
  replacements from the day it was written, so a removal contributing several needed no new
  machinery — only the guard had to learn to hold several spans.
- **The permitted-span check did not change either.** `replacements_stay_inside_the_permitted_spans`
  takes a flat list of spans and asks containment; the runs are that list.
- **It did not interact with the move's whole-document invariant.** No verification check was
  weakened, relaxed or made conditional. Two were *added*.

`StructuralGuard` and the golden tables did change, as predicted. The lesson is small but worth
recording: the deferral in 0c-3a was justified by the *breadth* of the change, and the breadth was
overstated. The reason to defer it was sound anyway — rewriting the verification layer in the round
that was fixing it — but the estimate was not.

### 7.2 Punching the comments out is not sufficient, and nothing said so

Both D2o and the 0c-3a review describe the fix as "an envelope of owned runs, with the file's
comments and the blank lines around them punched out of it, spliced as several replacements rather
than one" — and stop there, as though that were the whole answer. It is not: a preserved comment
directly under a block scalar's content becomes that block's content, and the block's decoded value
changes although nothing about it was edited (section 3). Neither document names that, and no fixture
in either corpus held the shape.

This is the **fifth** time in this project that the corpus rather than the code was the weak link
(R20), and the third consecutive round in which the shape that mattered had to be *constructed*
rather than found. It is also the second time the promised "real fix" for a refusal turned out to
need a refusal of its own — the first was `RemovalWouldExtendAKeptBlock` in 0c-3a, and the two are
the same class of hazard.

**And the refusal written for it was too wide, which the review then found: the sixth occurrence.** The
shape that proves the refusal must be *narrow* — a folded block above a column-zero comment — was
absent from the corpus for the same reason the shape that proves it must *exist* was: nobody had
written either. Writing one and not the other is how a refusal ends up pinned as correct when only
half of its boundary has ever been observed. Recorded as a pattern rather than as an incident: **a new
refusal needs a fixture on each side of its condition**, not one inside it.

### 7.3 Doc comments that are now wrong, and were corrected in place

- **`EditError::RemovalWouldDeleteAFileComment`** said the refusal was "the smallest correct answer
  available today" and that it "costs something real: a removal that ought to succeed, minus the
  comment, becomes impossible". Both sentences described a policy that no longer exists.
- **`TriviaIndex::subtree_extent`** said a consumer that deletes these bytes "must therefore check
  `file_comments` against the span it is about to remove **and refuse** when the two intersect". The
  first half stands; "and refuse" is no longer the answer of record. The call itself is deliberately
  unchanged — it answers "which bytes could the subtree's own trivia reach", and turning that into an
  envelope is the edit layer's job.
- **`FieldRemoval`** said comments the file owns "have no owning node and are excluded by
  construction, which is what keeps a file header in place". That sentence was already known false —
  0c-3a corrected it on `subtree_extent` and left it standing here.

Three more were corrected by the review's fix round, and they are this phase's own:

- **the `patch::edit` module doc** said the two halves of `StructuralGuard::Removal` "together say the
  run set is exactly the entry". They say it of the entry's **nodes**; both halves are stated over node
  spans and neither sees trivia. Section 2.2 now says what the guard proves and what it does not, and
  the module doc names the four layers that govern the trivia instead.
- **`EditError::RemovalWouldExtendABlockScalar`** said the condition "does not compare indentation
  columns, because a block's body column is only reconstructible (D2)". It compares them now, off
  `ScalarPresentation::indent`, and the "only reconstructible" claim was about a block's *end* rather
  than its body column (section 3).
- **`preserved_regions`** said the blank run above a kept comment "is the layout the user chose", and
  the fixture's own comment said the same. Withdrawn: it would apply equally to a blank run touching no
  comment, and such a run is deleted (section 2.1).

### 7.4 What this phase and its review's fix round did **not** change

Every item in `PROGRESS.md`'s "must not undo" list is intact, and the four that a run-based envelope
could plausibly have disturbed are named explicitly:

- the published collection span stays **child-derived** (D2n); `CollectionExtent::owned_end()` is
  untouched and is still not consumed by any edit;
- `PatchedDocument` still has **no public constructor and no public field**;
- the resolver still knows nothing about hazards (D2j); the gate is still asked inside
  `plan_removal`'s `editable_mapping`, before anything is derived;
- a scalar whose `reencode_in_place` refuses is still reported through `PresentationNote` rather than
  refused (D2m), and a structural edit still emits no note, because it rewrites no scalar it did not
  create;
- line endings are still copied from the most local evidence and never voted on (D2p);
  `NoObservableLineEnding` still refuses rather than guessing. A removal writes no bytes at all, so
  it has no line ending to choose — the run set does not touch this.

The review's fix round adds two of its own, both worth stating because a "narrowed refusal" and a
"rewritten oracle" are exactly the shapes that hide a weakening:

- **no verification check was weakened, relaxed or made conditional.** Finding 2 narrows a *planner*
  refusal and touches nothing in `verify`; finding 1's fix is entirely in the test oracle. The three
  visibility layers were re-confirmed by re-running every experiment of section 6, and layer 3 gained a
  view rather than losing one;
- **the oracle got harder to satisfy, not easier.** Property 6 now constrains both directions where it
  constrained one, and property 8 keeps the source-text checks the old property 6 carried rather than
  folding them into the new derivation.

---

## 8. Review disposition — [`docs/reviews/phase-0c-3b-1-run-based-envelopes.md`](../reviews/phase-0c-3b-1-run-based-envelopes.md)

Two findings. Finding 2 is adopted as written. Finding 1 is **partly adopted**: three of its four
claims are correct and fixed, and the behaviour it asks for is declined with the reason recorded.

### 8.1 Finding 1 (major) — the interior blank run of a removed entry

The reviewer's document is

```yaml
a:
  x: 1

  y: 2
b: 3
```

and the claim is that removing `a` should leave `\nb: 3\n` rather than `b: 3\n`, because the blank line
is file layout that no node owns.

**Declined, and this is the judgement rather than an oversight.** Two reasons:

- **The blank line is *inside* the span the user asked to remove.** The premise this crate defends is
  that every byte **outside** an intended span comes out identical. It does not promise that bytes
  inside a deliberately removed entry survive — if it did, removing an entry could not delete its own
  line breaks either.
- **Preserving it would invent a leading blank line at document start** that the file never contained.
  That is unrequested reformatting in the other direction, and it is the exact class this crate exists
  to prevent. A rule that produces a document the user did not write is not more faithful than one that
  deletes what they asked to delete.

**What the reviewer is right about, and what was fixed:**

| Claim | Disposition |
|---|---|
| The justification is overstated and inconsistent — the fixture calls the preserved blank run "the layout the user chose" while the identical run is deleted when no comment touches it | **Adopted.** The wording is withdrawn from the fixture, from `preserved_regions`, from section 2.1 and from `PROGRESS.md` D2o. The narrow reason is recorded instead: the run *below* is literally what constitutes the comment's file-ownership under D2d, and the run *above* is the rest of the neighbourhood `blank_runs()` groups with that line, which the gap layer does not arbitrate side by side. Neither is claimed as layout |
| The rule is implicit | **Adopted.** Stated in `preserved_regions` and section 2.1, and pinned **in both directions** by `a_blank_run_survives_only_where_it_touches_a_kept_comment`: an interior blank run touching no kept comment is deleted with the entry; one touching a kept comment survives byte for byte. A future change to either half fails loudly |
| The external oracle *requires* every gap to hold a file comment, so it codifies the omission | **Adopted, and this was the most important half.** Property 6 is rewritten against `preserved_by_the_rule`, both directions, naming bytes. Section 4.1 has the argument; experiments 5 and 5b in section 6 have the demonstration — the old property passed an engine that deletes the byte deciding a kept comment's ownership, and the new one names the region |
| The claim that `StructuralGuard`'s two halves say the runs are "exactly the entry" is disproved | **Adopted.** They say it of the entry's **nodes**. Corrected in section 2.2, in section 5.2 and in the module doc |

**Measured effect.** Synthetic: no behaviour change, so no count moves for this finding — the two new
tests are additions. Real corpus: unchanged in every figure. The oracle rewrite found **zero**
disagreements across 264 synthetic and 419 real applied removals, which is the only outcome that leaves
the fix meaningful: a rewritten oracle that immediately disagreed would have meant the engine was
wrong, and one that cannot disagree at all is what was replaced.

### 8.2 Finding 2 (minor) — `RemovalWouldExtendABlockScalar` ignored indentation

**Adopted in full.** `block_scalar_ending_above` became
`block_scalar_the_kept_bytes_would_join`, and the refusal now compares the first non-blank preserved
line's column against the block's own body column, read off `ScalarPresentation::indent` (section 3).
The reviewer's `>` case applies and is pinned byte-exactly in both a unit test and a corpus test; the
indented case is still refused, for `>` as well as `|`; and the one block with no observed body column —
an empty content span — is still refused whatever the column is.

Two fixtures were written rather than one unit test, per R20's standing instruction, and the reviewer's
second paragraph is why: the corpus held the shape *inside* the refusal's condition and nothing on the
safe side of it. `run-based-removal-boundaries.yml` supplies both the safe folded case and the
entry-owned-leading-comment-block-plus-interior-file-comment pairing the notes admitted neither corpus
had. Closing that pairing also let the sweep's own R23 derivation move from `entry_lines` to
`entry_hull_lines`, which removes a documented disagreement between the oracle and the engine.

**Measured effect.** Synthetic: 2 634 → 2 696 attempted structural edits, all 62 of them the new
fixture's own shape, and `block_absorbs` **unchanged at 1** — the narrowing turned no attempt away and
let one new one through. Real corpus: unchanged in every figure; it never reached this refusal before
or after. Section 5.4 has the per-fixture pins.

---

## 9. What is still owed to 0c-3b-2

- **The move itself**, which is now unblocked: a move is a removal plus an insertion whose spans do
  not overlap, and the removal half now produces an envelope that can be carried without carrying
  the file's comments with it.
- **The stronger, whole-document invariant.** This phase kept the local one of D2p/D2o and
  strengthened the guard around it; a move relocates bytes and needs the multiset statement
  `PROGRESS.md` scope item 3 describes.
- **The full R9 round-trip property test**, the Phase 0 gate.
- **R16**, still open. No second parser is in the test suite, and this phase did not add one.
