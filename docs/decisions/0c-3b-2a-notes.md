# Phase 0c-3b-2a — moving a match, and the invariant a relocation forces

Phase 0c-3b-2a adds the first edit in this crate that **relocates** bytes. A whole
sequence item — a match — moves to another position in its own sequence, as a
removal plus an insertion in one batch, through the same `apply_edits` every other
edit goes through. Nothing is rendered and nothing is re-indented: the bytes
written at the destination are the bytes taken from the source, copied.

The code is [`crates/espansoconfig-core/src/patch/edit.rs`](../../crates/espansoconfig-core/src/patch/edit.rs);
the acceptance sweep is [`crates/espansoconfig-core/tests/patch_move.rs`](../../crates/espansoconfig-core/tests/patch_move.rs),
a new file rather than a fourteenth column in `tests/patch_structure.rs`.

**Out of scope, deliberately not started:** cross-**document** and cross-**file**
moves (plan section 8.4, a UI-phase concern with restrictions of its own), the full
R9 round-trip property test, and R16's second YAML 1.1 oracle. Those are
**0c-3b-2b**.

> **This document has been rewritten by the phase's own review round.**
> `docs/reviews/phase-0c-3b-2a-move-and-invariant.md` found that the three
> production properties jointly certify presentation corruption, that the EOF
> rotation this phase invented violates D2p, and that "three seams" is not the
> complete set. All of that is fixed, and the sections it touched — 3, 4.1, 4.2,
> 5, 6.2, 7.2, 7.4, 7.5 — say what is true **now**, with the earlier claim quoted
> beside it wherever it was wrong. **Section 9 disposes of every finding.** Section
> 7.7 is the scope sentence the review closed with, and it is the most important
> paragraph in this file for whoever writes the cross-collection move.

**Scope, in one sentence, before anything else:** everything below is about
relocating an item **between two positions of the same block sequence**. See
section 7.7.

---

## 1. What byte identity stopped being able to say

Every phase since 0c-2b has rested on one sentence: *every byte outside the
replaced spans is identical*. It was doing more work than it looked, and the reason
is that neither an insertion nor a removal **relocates** anything. Bytes are
written where nothing was, or deleted where something was, and everything else
stands still — so a neighbour's meaning could only change through bytes the edit
itself declared, and `bytes_outside_the_replacements_match` plus the local sibling
digest between them covered the ground.

A move declares that its bytes moved. The sentence is then satisfied **by
construction**: the replacement list says the source runs became empty and says
some text appeared at the destination, and the check confirms exactly that. It can
no longer see:

- a block scalar at the destination swallowing the arriving match's first line;
- a block scalar the *arriving match* ends with swallowing what already followed
  the destination;
- a block scalar above the source swallowing what rises when the source closes;
- a `|+` block inside the moved match whose value is the blank lines **after** it,
  which belong to whatever follows the block rather than to the block;
- the moved bytes coming out re-indented, re-terminated or one line short.

None of those is a byte outside a replaced span. All of them are a construct the
edit never named saying something else afterwards. Section 3 is the replacement.

---

## 2. How the envelope and the destination are derived

### 2.1 The source half is a removal, by the same call

`plan_move` does not derive an envelope. It calls `removal_envelope`, which is
`plan_removal`'s own derivation factored out in this phase for exactly this reason:
a move that deleted a different set of bytes from the one a removal deletes would
be a second answer to a question D2o spent a whole phase settling. The steps are
unchanged — the ownership hull from `TriviaIndex::subtree_extent`, widened to whole
lines by `removal_span`; the file's own comments and the blank runs beside them
punched out by `preserved_regions`; the ordered disjoint runs left by
`runs_between`; and the three residual refusals, each read off the document.

Two things about a **sequence item** rather than a mapping entry:

- **there is no key half.** `entry_extent` takes `subtree_extent` over an entry's
  key *and* its value because the `:` belongs to the key and the inline comment to
  the value. An item has one node, and the `-` that introduces it is trivia the
  item itself owns (D2d), so one subtree extent is the whole of it. `removal_span`
  then widens back to the line start, which must hold nothing but indentation — the
  reachable failure being a nested compact item, `- - a`, whose inner dash has the
  outer one before it;
- **the envelope is built from `items_owned_by_subtree` / `comments_owned_by_subtree`
  by way of `subtree_extent`, never from the direct queries.** That is inherited
  rather than re-decided, and it is what makes a leading comment block and a
  trailing inline comment travel with the match while a comment the ownership rules
  give to the **file** stays exactly where it is.

That last point is the one a reader should check against `0c-3b-1-notes.md` section
5.2, which predicted it: *"With a hull [a move] would carry the file's comment
**with** the entry, which is worse than deleting it — the comment would appear
somewhere it never was. There is no version of the move that is correct on a
hull."* Measured, that is exactly what happens: moving
`move-a-match.yml`'s second match carries its `first`/`second` entries away and
leaves the three comment lines and the blank runs around them where the user put
them, byte for byte, pinned by
`a_move_carries_the_matchs_own_comments_and_leaves_the_files_where_they_are`.

### 2.2 The destination

`ItemMove::after(item, k)` writes the match after the item at index `k` **in the
original sequence**; `ItemMove::to_front(item)` writes it above the sequence's
first item. "In the original sequence" is load-bearing: the batch is planned
against the document as it stands, so an index never means "after whatever ends up
there".

The offset itself comes from two calls that already existed:

| Request | Offset | Why that call |
|---|---|---|
| `after(k)` | `insertion_point(source, subtree_extent(items[k]), …)` | the same point `FieldInsert` writes at: past the anchor's own trailing spaces, to just after the break that ends its last line |
| `to_front` | `removal_span(source, …, subtree_extent(items[0])).start` | the start of the **first item's own hull**, so a leading comment block that belongs to that item stays with it rather than being adopted by the arrival |

**A move can go to the front; an insertion cannot.** `FieldInsert` deliberately
does not offer "before the first entry", because a mapping's first entry may share
its line with the `-` of a compact item and there is then no line to write above.
A sequence item always begins its own line — `removal_span` refuses it otherwise —
so the front is a well-defined line boundary, and reordering a match to the top of
a file is the canonical thing a user wants. Pinned by
`a_move_to_the_front_goes_above_the_first_items_own_leading_comments`.

The index arithmetic is the whole of the "where does it end up" question:

```text
to = 0                      for to_front
to = k + 1  if k < from     an anchor above it keeps its index
to = k      if k > from     an anchor below it loses one
```

and `to == from` is refused (`MoveChangesNothing`). Three requests land there —
moving the first item to the front, moving an item after itself, and moving an item
after its immediate predecessor — and all three leave the sequence in the order it
was already in. They are refused rather than answered with the document unchanged,
because the document would **not** be unchanged: an item whose hull is split by a
comment the file owns would be lifted over that comment and written back below it,
which is a real edit nobody asked for.

`to != from` is also what guarantees the arrival lies strictly outside the source
hull, so the two halves never overlap; `plan_move` asserts it anyway and answers
`MalformedSpan` — "a bug in this crate" — rather than trusting the argument.

### 2.3 What could contradict the derivation

The charge every review since 0c-2b has brought is that an edit's own declaration
authorises the bytes it destroys. So the question is not "is this right" but "what
would say it is wrong".

| Check | What it reads | What it would catch |
|---|---|---|
| `StructuralGuard::Removal`, half one | the **original index's** node spans | a source run reaching into a node that is neither of the item nor an ancestor of it (`EnvelopeCoversAnotherNode`) |
| `StructuralGuard::Removal`, half two | the same | the runs leaving a **frontier leaf of the item** behind (`EnvelopeMissesTheEntry`) — experiment C4 in section 6 shows it firing for a move |
| `StructuralGuard::Insertion` | the same | an arrival point strictly inside a token (`InsertionPointInsideANode`) |
| the per-run `file_comment_inside` assertion | `TriviaIndex::file_comments` | a punch-out off by one byte |
| `check_source_runs` in the sweep | the source text, the node spans and the trivia index, written independently of the engine | the eight envelope properties `0c-3b-1-notes.md` section 4 lists |
| **`the_arrival_is_the_departure`'s hull bound**, in production | the item's own lines, found textually by `item_own_lines` | a run that carries away one line too many **without reaching a node** — see below (`MoveCarriesMoreThanTheItem`) |
| the sweep's **hull bound** | the same lines, found textually again by `item_lines` / `hull_lines` | the same thing, from outside the crate |
| the sweep's arrival-point derivation | the anchor's own lines, found textually | the engine writing its bytes anywhere other than where the document puts them |

The hull bound is new in this phase and it exists because of a measured hole.
Property 5 of `check_source_runs` — no run covers a node outside the item — is the
only property that bounds the envelope from outside, and it cannot see a run that
swallows a **blank line**: a blank line holds no node, conserves the document's
lines when it travels, and changes no decoded value. Experiment C5 in section 6 is
that engine, and before the bound was added **every check in the tree passed it**.
The bound is stated over the item's own physical lines, walked textually, so it owes
nothing to the `subtree_extent` the engine used.

**The phase put the bound in the sweep only, and its review moved it into
`verify`.** `PatchedDocument` has no public constructor precisely so that candidate
bytes cannot exist without having passed verification, and a bound that lives in a
test does not defend that type; the production copy is `item_own_lines` and the
sweep keeps its own, because two derivations of one boundary can disagree and one
cannot.

**One thing both walks had to learn, and it is a corpus finding.** A `#` at the
start of a line is a comment only if it does not lie inside a frontier leaf: a line
whose first non-blank byte is `#` inside a `|` block's body looks exactly like a
leading comment to a textual walk. The real corpus contains one, and the first
version of this file's walk started an envelope one line too high because of it —
caught by the arrival-point and refusal-flag assertions rather than by inspection.
`tests/patch_structure.rs`'s `entry_hull_lines` had the same weakness; this phase
left it and its review had it **ported** (section 7.5), because a derivation known
to be wrong cannot be treated as authoritative merely because no fixture reaches it
yet.

---

## 3. The stronger whole-document invariant

`PROGRESS.md`'s scope item 3 offers *"a multiset of bytes or of lines preserved
under the move, plus every construct the edit did not name decodes to the same
value as before"*. Both halves are implemented, and the first is implemented as
**lines** rather than bytes for a reason worth stating: a multiset of bytes cannot
tell `ab` from `ba`, so an engine that scrambled a line's characters would satisfy
it. What a move promises is the same lines in a different order.

### 3.1 What it states

**Five** properties, run when the batch contains a move, each derived from the
**original** document and never from the edit. The first and the last were added by
this phase's review; the middle three are what the phase shipped.

1. **`the_arrival_is_the_departure`.** The text written at the destination is, byte
   for byte, the concatenation of the source runs the same edit deleted — and every
   one of those runs lies inside the item's **own physical lines**, derived
   textually from the source and the item's node span rather than from the
   `subtree_extent` the planner used. Two typed failures,
   `MovedBytesWereRewritten` and `MoveCarriesMoreThanTheItem`, because they are two
   different defects and a shared figure is how one hides behind the other (R20).
2. **`document_lines_are_conserved`.** The document's physical lines, each **paired
   with its own terminator**, compared as one multiset. It pins that no line was
   invented, lost, truncated or re-indented, that no line ending was invented, lost
   or rewritten — a bare `\r` becoming `\r\n` fails, and so does a CRLF document
   that came back with one LF in it — and that no two lines **exchanged** their
   endings.
3. **`items_are_in_the_intended_order`.** The sequence holds the permutation the
   move asked for, compared over **subtree digests**, so an item that arrived at the
   right index carrying the wrong bytes fails too. The permutation is stated over
   the original sequence's child *positions*, which is checkable across a reparse
   that mints entirely new identifiers (D2j).
4. **`constructs_outside_the_move_are_unchanged`.** The two indexes are walked in
   lockstep from every document root, with the moved sequence's children taken in
   the intended order on the original's side. Kinds, decoded scalar values and child
   counts must agree at every node.
5. **`comment_ownership_survives`.** Every comment of the original document, paired
   with the answer the ownership layer gives for it — is it the file's? — against
   every comment of the candidate paired with the answer the ownership layer gives
   for **that**. Compared as a multiset of (text, file-owned) pairs, because a move
   relocates comments on purpose and their offsets are expected to change while
   their attribution is not.

Property 4 of `verify` — byte identity outside the replacements — is **not**
removed. It still holds and still runs; it simply stopped being sufficient.

### 3.1.1 Why properties 1 and 5 had to be added, in the reviewer's own shape

Phase 0c-3b-2a shipped properties 2 to 4 and asserted the byte-relocation property
only in the external sweep, in `check_the_arrival_is_the_departure`. Its review
showed why that is the wrong side of the boundary. `PatchedDocument` has no public
constructor *precisely* so that candidate bytes cannot exist without having passed
`verify()` — so a property that lives only in a test certifies nothing about the
type. The counterexample is small:

```yaml
matches:
  - trigger: ':a'
    # first
    # second
    replace: x
  - trigger: ':b'
    replace: y
```

Move item 0 after item 1 with a planner that swaps `# first` and `# second` in the
carried text. Line contents and terminators are the same multisets; the item
digests are unchanged because a digest holds **no comments**; the reparsed tree is
identical; neither comment is file-owned, so `file_comments_survive` adds nothing;
and `bytes_outside_the_replacements_match` compares the candidate against the
source with *the planner's own insertion text* applied, so it positively authorises
the corruption. **Every production property accepted it.** That is not an argument
in this document — it is
`every_other_move_property_certifies_the_permuted_candidate`, a retained test that
runs all four of the others against the corrupted candidate and asserts each
returns `Ok`.

Property 5 covers the one variant property 1 cannot: swallowing the blank line
*below* a file-owned comment and writing it back at the destination. The arrival
really is the departure, the lines really are conserved, the tree really is
identical and the comment's text really is still there — but rule 2 of plan section
6.2 no longer applies to it, so it now belongs to whatever ended up underneath.
Ownership is the only thing that changed, so ownership is what has to be compared.

### 3.2 Why each line is paired with its own terminator

Phase 0c-3b-2a compared line contents and line terminators as **two separate
multisets**, and this section used to explain why:

> Because one legal relocation moves a break from one line to another. A move whose
> destination is the end of a file that does not end in a line break writes the
> match's own trailing break in front of it instead of behind it […] Pairing
> contents with terminators would reject that.

**That relocation is refused now** (section 7.2), so the reason is gone and the
weaker comparison went with it. The pairing is strictly stronger: it refuses two
lines that *exchanged* their endings, which separate multisets accept by
definition, and that is the review's second listed variant of the same blind spot —
an engine that gives a carried LF line a CRLF and the CRLF line an LF. Both
directions are pinned by `the_line_conservation_check_names_the_line_that_went`,
which now also drives the exchange and the old rotation and requires both to fail.

### 3.3 Why this is an oracle and not a restatement

The expectation is *the original document plus one permutation of positions*.
Nothing in it is anything the edit rendered, chose or declared — the move renders
nothing at all, and the permutation is the one fact the user did supply, which is
the same status "the field is present or absent as asked" has for an insertion.

### 3.3.1 A move is the only edit in its batch — a scope limit, not an invariant

`EditError::MoveMustBeTheOnlyEditInItsBatch` stays, and the argument this document
used to give for it does not:

> A second edit would have to be modelled inside the expectation — the scalar
> edit's *intended* new value, the insertion's intended key — and the expectation
> would then be authorised by the very declaration it exists to check.

The reviewer is right that this is unconvincing. **Verifying a caller-requested
value against the caller's intended value is exactly how a scalar edit is already
verified**, and a combined expectation could apply the permutation and exempt
precisely the independently verified rewritten node — which is what
`fold_expectations` already does when a scalar edit and a field edit touch one
mapping. There is no circularity here; there is unwritten work.

So the honest description is: **a deliberate scope limit of this phase.** Making
move verification compositional is real work, it does not belong in a review fix
round, and the batch is refused rather than half-verified. What it costs is written
down rather than glossed:

- a safe, obvious request is refused — *move this match and change its `replace`
  value* — and the caller must send two batches;
- **`OverlappingEdits` is never exercised against a conflict between a move and
  another edit**, because this check rejects such a batch before overlap analysis
  runs. Its coverage is the scalar and structural cases only, and that gap is this
  restriction's, not the overlap check's.

Pinned in both directions by `a_move_may_not_share_a_batch_with_any_other_edit`:
one move applies, a move plus a scalar edit is refused in either order, and two
moves are two batches.

### 3.4 What it cannot see, stated by a hostile reader

- **A decoded value is blind to presentation.** A scalar re-quoted from `'a'` to
  `"a"`, a block re-chomped, a comment deleted: property 4 sees none of them.
  Properties 1 and 2 see all three, because each changes a byte the move claims to
  have relocated verbatim, or a line's content. A change that alters *neither* a
  line's bytes nor any decoded value is a change to nothing.
- **Line conservation is blind to order, deliberately.** That is what a move is. It
  therefore cannot tell a correct move from one that put the match at the wrong
  index; property 3 is what does that, and property 4 subsumes it.
- **Two identical lines are interchangeable.** A move that swapped two
  byte-identical lines would pass property 2. Property 4 catches it only if the swap
  changes a decoded value, and property 1 catches it only if the swap crosses the
  boundary of the carried bytes. In a document with two identical lines in
  different matches, an engine that swapped them would go unnoticed — and would also
  have produced a byte-identical document, so there is nothing to notice.
- **The permutation is compared, not proved minimal.** Nothing asserts that the
  bytes *between* the runs and the arrival stayed in the same relative order; that
  is `bytes_outside_the_replacements_match`'s job, and it still runs.
- **Both parses come from saphyr.** Properties 4 and 5 compare two YAML 1.2
  readings and prove nothing about what espanso's 1.1-ish stack makes of either.
  R16 is still open and this phase did not close it.
- **The sweep's own copies of properties 1, 2 and 4 share this file's `shape` and
  `physical_lines`, not the engine's.** They are independent of the engine and not
  independent of each other; an error in the *specification* of a multiset would be
  made twice. Section 6's engine-breaking experiments are what makes them
  falsifiable rather than merely present, and section 6.2 is now a **retained test
  file** rather than a record of runs nobody can repeat.
- **The sweep has no second derivation of property 5.** Comment ownership is
  compared once, in production, and the external oracle checks only that no
  file-owned comment was *lost*. A second scan of every candidate would double a
  quadratic cost (R19) for a property whose engine-breaking experiment already
  exists as a retained test; the asymmetry is recorded rather than hidden.

---

## 4. The move's version of R23, and the blank-run rule at the destination

### 4.1 A move does not re-indent, and that is measured rather than assumed

`PROGRESS.md` warns that a move "re-indents what it carries as well as relocating
it", and that R23's column comparison therefore cannot be reused unchanged. Half of
that is right and half is not, and the difference is the phase's scope.

**Within one sequence there is nothing to re-indent.** Two positions in one block
sequence sit at the same column by construction — a block sequence whose items
disagreed about their column does not parse — so the bytes travel verbatim and every
column in them, including the columns of the match's own leading comment block,
comes out exactly as the user wrote it. That is not an assumption: the hull bound of
section 2.3, `the_arrival_is_the_departure` in production, its twin
`check_the_arrival_is_the_departure` in the sweep, and line conservation on both
sides each fail if a single byte of indentation changes, and experiment C1 in
section 6.2 is an engine that changes one. **Section 7.7 states the boundary of that
argument**, which is the whole of what this phase implements and no more.

**What R23 has to be restated for is not indentation but adjacency.** A removal
opens one seam — what followed the deleted lines rises to sit under what preceded
them. A move opens more, and each is the same condition asked at a different place.

Phase 0c-3b-2a claimed the set was **three**. Its review disproved the claim, and
the correct model is **three external seams plus one internal seam for every
adjacent pair of carried runs**:

| Seam | What comes to sit under what | How many |
|---|---|---|
| `SourceCloses` | what followed the match rises under what preceded it | one |
| `ArrivalLands` | the match's own first non-blank line lands under whatever precedes the destination | one |
| `ArrivalCloses` | whatever followed the destination comes to sit under the match's own last line | one |
| `CarriedRunsJoin` | the line the next carried run begins with comes to sit under the line the previous one ends with | **one per adjacent pair of runs** |

All four report `MoveWouldExtendABlockScalar`, tagged with the seam.

**Why the fourth exists at all** is D2o. Since the envelope became a *set of runs*
with the file's own comments punched out of it, the runs are concatenated at the
destination — so **every hole in the envelope is a new adjacency that exists nowhere
in the original document**. An envelope of one run has no internal join; one of *n*
runs has *n − 1*. The reviewer's shape:

```yaml
matches:
  - trigger: ':a'
    vars:
      x: |
        body

      # file-owned; preserved at the source

        # leading comment owned by y
      y: one
    replace: done
  - trigger: ':b'
    replace: done
```

Move item 0. The envelope splits around the file-owned comment, and concatenating
the two runs puts the deeper-indented comment directly under the block body, where
it becomes content of `x`. The decoded-tree walk rejects the candidate generically,
so this was never silent corruption — but "three is the complete set" was false and
the planner owed a typed refusal it did not have. `move-run-joins.yml` is that shape
with a fixture on **each side**: column seven is refused, column four moves.

The condition itself is stated **once**, in `block_absorbing_a_line`, which
`block_scalar_the_kept_bytes_would_join` also calls: some block scalar's content
ends at or before the boundary with nothing but blank lines in between, **and** the
line in question sits at that block's own body column or deeper. The body column is
`ScalarPresentation::indent`, read off the span layer and never re-lexed (D2 / D2d),
and a block whose content span is empty is refused whatever the column is, because
`indent` then holds the header's column rather than any observed body's. One
document fact, one implementation of it, four questions.

The four are **counted separately** (`MoveSeam`), not folded into one figure. R20's
lesson is that two distinct overshoots inside one number is how the quoted-scalar
overshoot hid for three phases, and each seam has a fixture on **each side** of its
condition — the three external ones in `move-block-scalar-seams.yml`, the internal
one in `move-run-joins.yml` — where the refused case and its safe twin differ only
in a comment's column.

R23 itself — `RemovalWouldExtendABlockScalar`, the bytes a removal *preserves*
joining a block above — is inherited unchanged and is the right check for a move
too, because its boundary is `runs[0].start`, which is what precedes the envelope
whether the entry is deleted or carried away. Phase 0c-3b-2a pinned it at **0** and
called the zero a coverage hole rather than a proof; the review asked for the
fixture on both sides, and `move-kept-comment-joins-a-block.yml` is it. **3
synthetic refusals now, and still 0 real ones.**

### 4.2 A further hazard the design did not anticipate, found by the sweep

`scalar-styles.yml`'s `:literal-keep` match ends in a `|+` block whose value is
`"keeps the blank lines below\n\n\n"`. A keep-chomped block's value is every line
break physically present after its last content line, and those breaks belong to
whatever follows the block rather than to the block itself — so they are not
something a move can carry, even though the span layer puts them inside the block's
content span and therefore inside the match's hull.

Moving that match under a blank line gives it one more. Refused by name,
`EditError::MoveWouldExtendAKeptBlock`, the mirror of
`RemovalWouldExtendAKeptBlock`: that one is about a keep-chomped block *above* the
deleted lines, this one about a keep-chomped block *inside* the relocated ones. One
clause, about the block whose content ends the match's own bytes: the block is
keep-chomped and the first line at the destination is **blank**.

Phase 0c-3b-2a had a second clause beside it — *the move rotates a line ending and
the block is keep- or clip-chomped, either of which counts that break as part of its
value*. The rotation is refused since this phase's review (section 7.2), so nothing
rotates and the clause described nothing. It is gone, from the engine and from the
sweep's independent derivation, and the measured cost is zero: `mkeep` stayed at 8.

**It was found by the whole-document invariant, on corpus data, before the refusal
existed** (experiment B1, section 6). That is the strongest single argument this
phase can make for section 3: the invariant caught a hazard nobody had thought of,
in a fixture written four phases ago for something else.

### 4.3 The blank-run rule at the destination

`PROGRESS.md` asks for D2o's blank-run rule to be *"restated at the destination,
not only at the source"*. Restated, it is:

> **A move writes no blank run and splits none.** The preservation rule is a
> statement about which bytes a removal leaves behind, and only the source half of a
> move deletes anything. At the destination the arrival is a **zero-width
> replacement at a line boundary**, so every blank run in the document keeps every
> byte it had; what changes is only which lines lie on either side of it.

Two consequences are worth writing down because they are choices rather than
consequences of the arithmetic:

- **The arrival goes *above* the blank run that follows the anchor, not below it.**
  `insertion_point` stops just after the break that ends the anchor's own last line,
  so a blank line separating two matches ends up **below** the arriving match. That
  is the same answer `FieldInsert` gives, and it is why the two share the call: a
  blank run between two matches is the file's layout and stays attached to the
  boundary it was written at, not to the match that happened to be above it.
- **A blank run that a preserved file comment holds open at the *source* stays
  open.** When the match leaves, the comment and the blank runs the rule protects
  stay exactly where they were, so a comment that was file-owned before the move is
  still file-owned after it — the ownership the run below it establishes is the whole
  point of preserving it (D2o section 2.1), and a move that carried the run away
  would re-attribute the comment just as a removal that deleted it would.

---

## 5. What the move cost and gained — measured, both corpora

### 5.1 The move sweep

**Synthetic: 2 571 attempted moves** — every item of every block sequence of all
thirty-two fixtures, offered every position in its own sequence, the front, and one
index the sequence does not have. (2 532 over thirty fixtures before this phase's
review added two more.)

| Category | Synthetic | Real | Where it comes from |
|---|---|---|---|
| applied | **1 790** | **126** | — |
| refused by the gate | 128 | 0 | `anchors-aliases-tags-merge.yml` 54, `flow-collections.yml` 50, `duplicate-keys.yml` 15, `multi-document.yml` 9 |
| flow collection | 96 | 0 | `flow-collections.yml` 48, `config-profile.yml` 24, `unicode-offsets.yml` 24 |
| changes nothing | 346 | 132 | two per item per sequence, by construction |
| no such destination | 173 | 82 | one per item per sequence, by construction |
| shares a line | **0** | **0** | unreached by a fixture — see below |
| keeps a block above (`RemovalWouldExtendAKeptBlock`) | 10 | 0 | `scalar-styles.yml`'s `\|+` seen from below |
| file comment in a run | **0** | **0** | unreachable, inherited argument |
| R23 (`RemovalWouldExtendABlockScalar`) | **3** | 0 | `move-kept-comment-joins-a-block.yml` — **0 before this phase's review** |
| moved block would change (`MoveWouldExtendAKeptBlock`) | 8 | 0 | `scalar-styles.yml`'s `\|+` seen from above |
| seam `SourceCloses` | 5 | 0 | `move-block-scalar-seams.yml` |
| seam `ArrivalLands` | 2 | 0 | `move-block-scalar-seams.yml` |
| seam `ArrivalCloses` | 2 | 0 | `move-block-scalar-seams.yml` |
| seam `CarriedRunsJoin` | **2** | 0 | `move-run-joins.yml` — **the seam that did not exist before this phase's review** |
| would invent a line ending | 3 | 0 | `block-scalar-terminal-spaces.yml` 1, `file-comments-and-mixed-endings.yml` 2 |
| would terminate the final line | **3** | 0 | `block-scalar-terminal-spaces.yml` 1, `file-comments-and-mixed-endings.yml` 2 — **applied before this phase's review, by rotating a break** |

**Real corpus: 13 files, 340 attempted moves, 126 applied**, and **zero** in every
refusal category except the two that are arithmetic — unchanged by the review's fix
round, so neither the EOF refusal nor the internal seam costs the owner's real
configuration a single edit. No figure from it is hard-coded, and the real-corpus
test skips cleanly when the directory is absent.

**What the fix round moved, and what accounts for each delta:**

- **applied 1 780 → 1 790.** The two new fixtures contribute +13 (9 and 4); the EOF
  refusal takes 3 away (1 in `block-scalar-terminal-spaces.yml`, 2 in
  `file-comments-and-mixed-endings.yml`).
- **R23 0 → 3** and **`CarriedRunsJoin` 0 → 2**, both entirely from the new
  fixtures: two refusals a phase had pinned at zero and described as unreached now
  have a fixture on each side of their condition.
- **`MoveWouldTerminateTheFinalLine` 0 → 3**, exactly the 3 applied moves the
  rotation used to produce.
- **`MoveWouldExtendAKeptBlock` unchanged at 8**, which is the measurement that
  says removing its rotation clause cost nothing.

**One pinned zero that is a coverage hole rather than a proof**, named as such in
the sweep next to the assertion that pins it:

- **`shares_a_line`** needs a sequence item nested directly inside another sequence
  item, which neither corpus contains. It is **reachable, and reachable in a way
  worth writing down**: a *compact nested sequence*, `- - first`, whose inner item
  has the outer dash before its own and therefore owns no line of its own.
  `a_sequence_item_that_shares_its_line_is_refused` drives exactly that document and
  pins the safe side (the outer item, which does begin its line) beside it. No
  fixture was invented because the refusal is *inherited* from the removal, where
  the corpus does reach it; a unit test is weaker than corpus coverage and this is
  recorded as such rather than as an unexplained zero.

### 5.2 The four fixtures, and every pinned count they moved

`move-a-match.yml` — 25 nodes = 1 document + 6 collections (the root mapping, the
`matches` sequence, 3 item mappings and one nested `vars` mapping) + 18 scalars, of
which 10 are keys and 8 are values, none zero width, none a block. 8 comments, **1
of them inline, after a single-quoted scalar**, 2 blank lines in 2 runs, no CRLF, a
final newline, 0 hazards.

`move-block-scalar-seams.yml` — 34 nodes = 1 document + 8 collections + 25 scalars,
13 keys and 12 values, none zero width, **2 of them `|` blocks with their bodies at
column five**. 21 comments, **none inline**, no blank line at all, a final newline,
0 hazards.

Added by this phase's **review**:

`move-run-joins.yml` — 31 nodes = 1 document + 7 collections (the root mapping, the
`matches` sequence, 3 item mappings and 2 nested `vars` mappings) + 23 scalars, 13
keys and 10 values, none zero width, **2 of them `|` blocks with their bodies at
column seven**. 22 comments, none inline, **4 blank lines in 4 runs**, all four of
them ownership: each pair is what gives an interior comment to the file and
therefore splits an envelope into two runs. A final newline, 0 hazards.

`move-kept-comment-joins-a-block.yml` — 28 nodes = 1 document + 6 collections (the
root mapping, the `matches` sequence and 4 item mappings) + 21 scalars, 11 keys and
10 values, none zero width, **2 of them `|` blocks with their bodies at column
five**. 20 comments, none inline, **4 blank lines in 4 runs**, all four ownership. A
final newline, 0 hazards.

| Pin | 0c-3b-1 | 0c-3b-2a | after its review | Why the last column moved |
|---|---|---|---|---|
| fixtures | 28 | 30 | **32** | the two above |
| nodes (`patch_path`) | 1 237 | 1 296 | **1 355** | 31 + 28 |
| addressable | 713 | 747 | **780** | (7 + 10) + (6 + 10) |
| documents | 30 | 32 | **34** | two more single-document fixtures |
| mapping keys | 490 | 513 | **537** | 13 + 11 |
| scalars (`syntax_index`) | 929 | 972 | **1 016** | 23 + 21 |
| frontier members | 929 | 972 | **1 016** | none of the 44 is zero width |
| collections | 273 | 287 | **300** | 7 + 6 |
| flow collections | 11 | 11 | 11 | neither has one |
| block scalars | 47 | 49 | **53** | two `\|` blocks apiece |
| overshooting block scalars | 44 | 46 | **50** | all four are followed by a further match |
| overshooting block collections | 246 | 260 | **273** | **all 13**, because both files end with a line break |
| collections owning a tail past their span | 7 | 8 | 8 | neither ends a collection with an inline comment |
| zero-width leaves | 5 | 5 | 5 | neither has one |
| gap comments (line scan) | 245 | 274 | **316** | +42 |
| scanner comments | 250 | 279 | **321** | +42 — both conventions move together, neither file has an inline comment |
| blank lines (line scan) | 773 | 804 | **843** | the loose convention, +39 |
| scanner blank lines | 108 | 110 | **118** | 4 + 4, and **all eight are ownership** |
| blank runs | 104 | 106 | **114** | each of the eight is isolated |
| trivia items | 3 072 | 3 246 | **3 458** | +212 |
| hazards | 18 | 18 | 18 | neither raises one |
| decoder agreement (`scalar_codec`) | 924 | 967 | **1 011** | all 44, none skipped |
| re-encoded identically | 910 | 953 | **997** | all 44 — every block is `\|`, which is not decode-only (D2e) |
| attempted scalar edits (`patch_edit`) | 5 220 | 5 460 | **5 700** | (10 + 10) values × 12 |
| of which applied | 4 879 | 5 119 | **5 359** | all 240; nothing about a move reaches the scalar path |
| attempted structural edits (`patch_structure`) | 2 696 | 2 838 | **2 974** | 62 + 74, and no attempt changed category |
| attempted moves (`patch_move`) | — | 2 532 | **2 571** | section 5.1 |

**The comment counts moved by the same amount in both conventions, and D2d would
lead a reader to expect otherwise.** D2d records five inline comments that "a
whole-line scan cannot see", and `move-a-match.yml` adds a sixth inline comment
while the difference between the two conventions stays at exactly 5. Measured, the
rule is narrower than the prose: the five that differ all follow **punctuation** —
`matches: #`, `replace: | #`, `label: #` — so the gap they lie in begins at the `:`
or the `|` and the line the scan sees trims to punctuation rather than to a `#`. An
inline comment following a **scalar value token** lies in a gap that begins after
that token, so the scan does see it. Section 7 records this as a correction, and it
still holds after the fix round restored that comment's single-quoted spelling: the
two conventions still differ by exactly 5.

### 5.3 Runtime (R19)

`TriviaIndex::scan` is still quadratic and this phase did not touch it — and the
fix round made a move pay for **one more scan**, of the candidate, for
`comment_ownership_survives`. Measured on the machine with the real corpus present:
`patch_edit` **22.1 s**, `patch_structure` **19.1 s**, `patch_move` 10.6 s →
**13.9 s**, of which the real corpus is about 4 s. The synthetic move sweep is a
full cross product (item × destination) and is quadratic in a sequence's length by
design — `plain-scalar-hazards.yml`'s 37-item sequence alone is 1 443 of the 2 571
attempts. The **real** sweep is thinned two ways, both documented on the constants:
every third item, and five destinations (the front, both ends, the middle and one
impossible index). R19 stays open, unchanged, and the extra scan is the first time a
verification property has cost measurable time rather than none.

---

## 6. The visibility layers, disabled one at a time — and the engine broken on purpose

Each new failure class must be visible to the planner, to verification and to the
test oracle **independently**, and each has to be *demonstrated* rather than
asserted. Every run below is recorded with the message the catching layer produced.

**Section 6.2 is no longer history.** Phase 0c-3b-2a ran its engine-breaking
experiments by hand and wrote the messages down; its review's finding 4 is that a
repository which cannot reproduce them has documented an anecdote. They are now
retained tests in `src/patch/edit.rs`'s `move_tests`, driven through
`tampered_move`, which plans a real move, lets the test rewrite the plan a defective
planner could have produced, and then runs the **whole** post-planning pipeline:
disjointness, both structural guards, the splice and all ten verification
properties. Section 6.3 records the experiments the review itself demanded.

### 6.1 Breaking a layer, to measure visibility

| # | What was disabled | What caught it, and how it said so |
|---|---|---|
| A1 | the three external seam checks in `plan_move` | **Layer 2, verification.** `ItemsNotInTheIntendedOrder`: *"synthetic/move-block-scalar-seams.yml sequence 3 item 0 -> Some(1): unexpected outcome edit 0: sequence position 1 does not hold the item the move intended to put there"* |
| A2 | A1 **plus** `items_are_in_the_intended_order` | **Layer 2, second view.** `ConstructChangedOutsideTheMove`: *"…: unexpected outcome edit 0: candidate node 13 is not what the original document said, although the move did not name it"* |
| A3 | A1, A2 **plus** `constructs_outside_the_move_are_unchanged` | **Layer 3, the sweep's own seam derivation:** *"synthetic/move-block-scalar-seams.yml sequence 3 item 0 -> Some(1): applied although the document justifies a refusal (keep false file-comment false r23 false moved-keep false seam1 false seam2 false seam3 true break false)"* |
| A4 | A1, A2, A3 **plus** the sweep's refusal-flag assertion | **Layer 3, second view.** The sweep's own `stream_shape` comparison: *"…: a construct the move did not name is not what it was"* |
| B1 | `MoveWouldExtendAKeptBlock` in `plan_move` | **Layer 2, verification.** `ItemsNotInTheIntendedOrder`: *"synthetic/scalar-styles.yml sequence 3 item 7 -> Some(0): unexpected outcome edit 0: sequence position 1 does not hold the item the move intended to put there"* |
| B2 | B1 **plus** `items_are_in_the_intended_order` | **Layer 2, second view.** *"synthetic/scalar-styles.yml sequence 3 item 7 -> Some(0): unexpected outcome edit 0: candidate node 13 is not what the original document said, although the move did not name it"* |
| B3 | B1, B2 **plus** `constructs_outside_the_move_are_unchanged` | **Layer 3, the sweep:** *"…: applied although the document justifies a refusal (keep false file-comment false r23 false moved-keep true seam1 false seam2 false seam3 false break false)"* |

Experiment B is not a hypothetical reconstruction. `MoveWouldExtendAKeptBlock` did
not exist while the sweep was first run, and B1's message is the one the sweep
actually produced — the refusal was written **because** of it.

### 6.2 Breaking the engine, to measure detection — retained as tests

These break the **engine** and leave every layer in place, so they measure whether
the layers can disagree with it at all. Each row is a test; each message is the one
that test's `EditError` prints today.

| # | What the engine was made to do | What caught it, verbatim |
|---|---|---|
| **M1** | **permute two carried comment lines** — the review's headline counterexample, and the first mutation that changes **no multiset count at all** | `MovedBytesWereRewritten`: *"edit 0: the bytes written at byte 100 are not the bytes taken from the source; they first differ 24 bytes in"* |
| **C1** | **"tidy" the bytes it carries**, trimming trailing whitespace from each line before writing it at the destination | `MovedBytesWereRewritten`: *"edit 0: the bytes written at byte 47 are not the bytes taken from the source; they first differ 17 bytes in"* |
| **C2** | **vote on a line ending** — copy the destination's onto every carried line, which is precisely what D2p forbids | `MovedBytesWereRewritten`: *"edit 0: the bytes written at byte 46 are not the bytes taken from the source; they first differ 17 bytes in"* |
| **C2b** | **exchange two carried lines' terminators**, so the terminator multiset is unchanged | `MovedBytesWereRewritten`: *"edit 0: the bytes written at byte 61 are not the bytes taken from the source; they first differ 17 bytes in"* |
| **M3** | **shuffle a blank line between two strip-chomped blocks**, so no decoded value and no line multiset moves | `MovedBytesWereRewritten`: *"edit 0: the bytes written at byte 129 are not the bytes taken from the source; they first differ 43 bytes in"* |
| **C4** | **leave the item's first token behind**, shortening the first run by eight bytes | **Layer 1, the guard, before a byte is spliced.** `EnvelopeMissesTheEntry`: *"no removal envelope run covers bytes 13..20 of node 5, which the entry owns"* |
| **C5** | **carry one blank line too many**, extending the last run to the end of the following line and writing it back at the destination | `MoveCarriesMoreThanTheItem`: *"edit 0: the envelope run 9..28 reaches outside the item's own lines 9..27"* |
| **M4** | **swallow the blank line below a file-owned comment** and relocate it, re-attributing that comment without losing its text | `CommentOwnershipChanged`: *"edit 0: the comment at byte 45 of the original document is owned by something else in the candidate"* |

### 6.3 The next view down, measured — which is where the review's findings live

The rows above say a check exists. These say what happens **without** it, which is
the only way to tell a check that is load-bearing from one that is decoration.

| # | What was disabled | What the eight engines above did then |
|---|---|---|
| **D1** | `the_arrival_is_the_departure`, the property this fix round added | **M1: *"APPLIED, nothing objected"*. M3: *"APPLIED, nothing objected"*. C5: *"APPLIED, nothing objected"*.** C1, C2 and C2b fall through to `DocumentLinesNotConserved`: *"the line at byte 9 of the original document is not in the candidate; a move relocates lines and creates none"*. C4 and M4 are unaffected. |
| **D2** | `comment_ownership_survives` | **M4: *"APPLIED, nothing objected"*.** Everything else is unaffected. |

D1 is the review's finding 1 measured rather than argued: **three of the eight
defective engines produce a `PatchedDocument` that every other production property
certifies.** M1 is a permutation, M3 is a blank line moved between two blocks whose
chomping hides it, and C5 is one extra blank line carried away — none of them
changes a multiset count, a digest, a tree or a byte the replacement list did not
declare. `every_other_move_property_certifies_the_permuted_candidate` pins the M1
half of that as a retained test, by running the other four properties against the
corrupted candidate and asserting each returns `Ok`.

D2 is the same measurement for the fifth property: nothing else in the tree can see
a comment change hands while keeping its text.

### 6.4 The internal seam, and the EOF rotation — layers disabled in turn

Both are refusals the review forced, so the question for each is *what stands behind
the refusal*. Both were measured by disabling the refusal and then each catching
layer in turn.

| # | What was disabled | What caught it, verbatim |
|---|---|---|
| **E1** | the `CarriedRunsJoin` refusal in `plan_move` | **Layer 2.** `ItemsNotInTheIntendedOrder { edit: 0, position: 1 }` — the comment became content of the block, so the item at position 1 no longer digests to what it did |
| **E2** | E1 **plus** `items_are_in_the_intended_order` | **Layer 2, second view.** `ConstructChangedOutsideTheMove { edit: 0, node: NodeId(21) }` — the decoded-tree walk, which is why this was never silent corruption |
| **E3** | E1, E2 **plus** `constructs_outside_the_move_are_unchanged` | **Layer 2, third view.** `CommentOwnershipChanged { edit: 0, at: 1297 }` — the comment stopped being a comment at all, so the ownership multiset lost it |
| **E4** | E1, E2, E3 **plus** `comment_ownership_survives` | **Layer 3, the sweep's own seam derivation:** *"synthetic/move-run-joins.yml sequence 3 item 0 -> Some(1): applied although the document justifies a refusal (keep false file-comment false r23 false moved-keep false seam1 false seam2 false seam3 false **seam4 true** break false eof false)"* |
| **F1** | `MoveWouldTerminateTheFinalLine`, with Phase 0c-3b-2a's rotation restored in its place | **Layer 2.** `MovedBytesWereRewritten`: *"synthetic/block-scalar-terminal-spaces.yml sequence 3 item 0 -> Some(1): unexpected outcome edit 0: the bytes written at byte 712 are not the bytes taken from the source; they first differ 0 bytes in"* |
| **F2** | F1 **plus** `the_arrival_is_the_departure` | **Layer 2, second view.** `DocumentLinesNotConserved`: *"…: the line at byte 603 of the original document is not in the candidate; a move relocates lines and creates none"* — the **paired** comparison of section 3.2, which the separate-multiset version accepted by construction |
| **F3** | F1, F2 **plus** `document_lines_are_conserved` | **Layer 3, the sweep:** *"synthetic/block-scalar-terminal-spaces.yml sequence 3 item 0 -> Some(1): applied although the document justifies a refusal (… **eof true**)"* |

F1 and F2 are worth reading together with section 7.2. Phase 0c-3b-2a's rotation was
not merely a policy this phase disagrees with: with the refusal removed and the
rotation put back, **verification rejects the candidate** — twice over, and for the
right reasons. The typed refusal is what turns two verification failures into an
answer a caller can act on.

**C5 is the experiment that changed the code, twice.** Before Phase 0c-3b-2a added
the sweep's hull bound, an engine that carried away one extra **blank** line passed
everything: the guard sees no node in a blank line, line conservation sees the same
lines in a different order, the whole-document walk sees no changed value, and
`bytes_outside_the_replacements_match` positively authorises it. That phase caught
it in **layer 3 only**, and its review named the gap: the type whose whole purpose
is that candidate bytes cannot exist without passing `verify()` was not checking it.
`MoveCarriesMoreThanTheItem` is that bound in production, derived textually from the
item's own lines so that it owes nothing to the `subtree_extent` the planner used.

**C1 is the one to keep in mind when reading section 3.** It is an engine that does
something an editor does by default, and until this fix round the only check in the
whole tree that saw it lived in a test file.

---

## 7. Claims this phase proved false, or narrowed

### 7.1 `PROGRESS.md`'s prediction that a move re-indents what it carries

The "Next action" section says a move "re-indents what it carries as well as
relocating it, so it cannot reuse [R23's] refusal unchanged". Measured, a move
**within one sequence** re-indents nothing: two positions in one block sequence sit
at the same column, the bytes are copied verbatim, and three separate checks fail if
one byte of indentation changes. What R23 needed restating for was **adjacency**,
and it needed restating three times rather than once — four, once its review found
the internal seam (section 4.1). The prediction
would come true for the cross-collection move plan section 8.4 describes, which is
out of scope here — and when that lands, the column arithmetic is what will need the
refusal, not the seams.

### 7.2 The EOF rotation was wrong, and this section used to argue it was right

`PROGRESS.md` D2p and the phase brief both say: *"A move writes bytes at a
destination whose line ending may differ from the source's. Copy the destination's;
refuse when there is no evidence rather than inventing one."*

**What this section used to say, and it is wrong:**

> The move copies nothing. It carries the breaks it already has, verbatim, and there
> is exactly one case in which it writes a break at all — a destination at the end of
> a file that does not end in one — where it writes the match's **own** trailing
> break, rotated from behind the carried bytes to in front of them. No vote, no
> default, no evidence needed, and byte conservation exact. D2p's principle is
> satisfied *a fortiori* rather than by the mechanism it anticipated.

It is not satisfied *a fortiori*, and "byte conservation exact" is the sleight of
hand. **Byte conservation cannot see which unedited line owned a terminator.** The
rotation takes the moved match's own trailing break and prefixes it to the inserted
text, so the break ends up terminating the **destination's previously unterminated
last line** — a line the edit never named, and whose presentation therefore changed
silently. The review's byte shape makes it concrete:

```yaml
matches:                 # LF
  - trigger: ':a'        # CRLF
  - trigger: ':b'        # LF
    replace: tail        # EOF, no terminator
```

Move item 0 after item 1 and `replace: tail` acquires the moved match's **CRLF**, in
a file that is otherwise LF. Contents are conserved, the terminator multiset is
unchanged, the tree is unchanged and the permutation is right — so all three of the
phase's properties certified it.

D2p is not ambiguous about this case: **copy the break already in use where the
bytes land, or refuse when there is no such evidence.** At an unterminated end of
file there is no such break. Overriding a recorded decision is the product owner's
call, not a phase's, so the rotation is gone and the destination is refused by name,
`EditError::MoveWouldTerminateTheFinalLine` — a **sibling** of
`MoveWouldInventALineEnding` rather than a second reason inside it, because one is
about the moved item's own last line and the other about a line the move does not
touch, and R20's rule is that two distinct conditions never share a figure.

What it costs, measured: **3 synthetic moves and 0 real ones**, and
`block-scalar-terminal-spaces.yml` now offers no relocation at all — both of its two
requests are refused, for the two different reasons. That is recorded in the pinned
row and in
`the_terminal_spaces_fixture_offers_no_move_at_all_and_says_why` rather than left to
be discovered.

Two consequences elsewhere in this document, both of them simplifications:

- **section 3.2**: the two line multisets were separate *because of* the rotation.
  They are one paired multiset now, which additionally refuses two lines that
  exchanged their endings;
- **section 4.2**: `MoveWouldExtendAKeptBlock`'s second clause existed *because of*
  the rotation. It is gone, and the measured cost is zero.

The case D2p was really protecting against is still real and is still **refused**: a
match that is the document's last line where that line has no terminator has no
break of its own to carry, and writing it anywhere would need one. Taking a break
from the line above instead would delete a line the file holds. Refused by name,
`MoveWouldInventALineEnding`, three attempts across two fixtures — both of them
files whose bytes are the test data.

`NoObservableLineEnding` is therefore **unreachable from a move**: a sequence with
two items has at least one line break in it, and a sequence with one item offers no
move at all.

### 7.3 D2d's inline-comment rule is narrower than its prose

D2d says the two comment-count conventions differ by "five inline comments that
share a line with something else … none of which a whole-line scan can see".
`move-a-match.yml` adds a sixth inline comment and the difference stays at 5. The
five that differ all follow **punctuation**; an inline comment after a scalar value
token is visible to both conventions (section 5.2). The rule is about where the gap
begins, not about sharing a line.

### 7.4 A corpus hole this phase found, hid, and its review made it close

`move-a-match.yml` originally spelled its inline comment after a **single-quoted**
scalar. That made `saphyr_flow_scalar_end_offsets_are_exact_across_the_whole_valid_corpus`
fail:

> `synthetic/move-a-match.yml: style SingleQuoted span text "'the block above travels with me'  # and so does this inline comment" vs value "the block above travels with me"`

which is **R20's own overshoot**, the one `SyntaxIndex::quoted_span` exists to trim.
The phase changed the fixture to a plain scalar and recorded the hole as open.

**That was backwards, and the review said so.** Deleting the discovered evidence to
protect a test whose title claims exactness is how R20 happens; it is the seventh
occurrence of the same pattern and the first in which the corpus shape was
*found* and then removed.

The single-quoted spelling is back, and the corpus test states what is actually
true. A quoted scalar whose reported span overshoots its closing delimiter is now
**counted and skipped** by the exactness test — pinned at exactly 1, with the
fixture named, exactly as that test already counts and pins its implicit-node and
multi-line-plain skips — and **asserted in a test of its own**,
`saphyr_quoted_scalar_ends_overshoot_into_trivia_across_the_corpus`. What that one
asserts is not that overshoots are absent but that each is exactly trailing blanks
and an optional comment, and that the token trimmed back to its closing delimiter is
the exact source token — which is the property `SyntaxIndex::quoted_span` rests on,
measured without asking it. The closing delimiter is found by a lexer written from
scratch in `parser_evaluation.rs`, because that file is the substrate **upgrade
tripwire** (R1) and may not borrow the crate's answer to the question it measures.

Two figures, two tests, neither able to absorb the other. R20's own rule, applied to
R20.

### 7.5 A latent hole in the removal sweep, fixed rather than recorded

`tests/patch_structure.rs`'s `entry_hull_lines` walked up over comment-only lines
textually and could not tell a `#` inside a block scalar's body from a leading
comment. This file's `hull_lines` had the same defect and the real corpus caught it
immediately (section 2.3).

Phase 0c-3b-2a fixed its own copy and left the removal sweep's, on the grounds that
no removal in either corpus pairs the two shapes. Its review's answer is that a
sweep whose derivation is known to be wrong cannot be treated as authoritative even
when it is currently right, so the fix is **ported**: `entry_hull_lines` now takes
the index and asks it whether the `#` lies inside a frontier leaf, exactly as
`hull_lines` does. **No count moved**, which is the whole point — the defect was
latent, and waiting for a fixture to expose it would have meant trusting a wrong
derivation in the meantime.

### 7.6 What this phase did **not** change

Every item in `PROGRESS.md`'s "must not undo" list is intact, and the ones a move
could plausibly have disturbed are named explicitly:

- **the envelope is still a set of runs (D2o)**, derived by the very call
  `plan_removal` makes, and **both** halves of `StructuralGuard::Removal` are live
  for a move — experiment C4 shows the second one firing;
- **`items_owned_by_subtree` / `comments_owned_by_subtree` by way of
  `subtree_extent`** is still what builds the envelope; the direct queries are
  untouched and still unused by the edit layer;
- **the published collection span stays child-derived (D2n)**;
  `CollectionExtent::owned_end()` is still consumed by no edit;
- **`PatchedDocument` still has no public constructor and no public field**;
- **the resolver still knows nothing about hazards (D2j)**; the gate is asked inside
  `plan_move`, about the whole **sequence**, before a byte is read;
- **a scalar whose `reencode_in_place` refuses is still reported through
  `PresentationNote` rather than refused (D2m)**, and a move emits no note at all,
  because it rewrites no scalar — `a_move_relocates_the_bytes_and_writes_none_of_its_own`
  pins `notes()` empty;
- **no verification check was weakened, relaxed or made conditional.** Five were
  added — three by the phase and two by its review — and `document_lines_are_conserved`
  was **strengthened** from two multisets to one paired one. Property 4 still runs on
  every batch;
- **the crate gained no dependency**, and `espansoconfig-core` still does not know
  what Tauri is.

### 7.7 The scope of every proof in this document — the review's closing point

**"Copied verbatim without re-indentation" is safe only for the operation this
phase implements: movement between two positions of the *same* block sequence.**

The whole argument of section 4.1 rests on one fact — the valid items of one block
sequence share their structural indentation, because a block sequence whose items
disagreed about their column does not parse. That is what makes "the bytes travel
verbatim" both true and safe, and it is what lets deliberately unusual comment
indentation inside a carried match be preserved rather than recomputed.

Nothing else is in scope. Moving an item **between differently indented or nested
sequences** is not expressible by `ItemMove` at all — the request names one item and
one destination index in that item's own sequence — and that future operation must
either re-indent what it carries or refuse. **It cannot reuse these proofs
unchanged.** Concretely, at least the following would have to be re-derived rather
than inherited:

- `the_arrival_is_the_departure` becomes false by construction the moment the bytes
  are re-indented, so the byte-relocation property needs a *rendered* expectation,
  which is a different kind of oracle with a different circularity risk;
- `document_lines_are_conserved` becomes false for the same reason: a re-indented
  line is not the line that left;
- R23's column comparison compares a column at the source against a block's body
  column at the destination, and those are no longer the same column;
- `MoveSeam`'s four questions survive, but each has to be asked about the
  *re-indented* line rather than about the line as written.

`PROGRESS.md`'s prediction that a move "re-indents what it carries" (section 7.1) is
false for this phase and true for that one. Whoever writes it should read this
section first and section 4.1 second.

---

## 8. What is still owed to 0c-3b-2b

- **The full R9 round-trip property test**, the Phase 0 architectural gate.
- **R16.** Still open. No second parser is in the test suite, neither this phase nor
  its review fix round added one; section 3.4 says plainly what that costs the
  whole-document invariant.
- **Cross-document and cross-file moves** (plan section 8.4), which is where
  `PROGRESS.md`'s re-indentation prediction becomes true — **read section 7.7
  first**.
- **Compositional move verification**, which is what would let
  `MoveMustBeTheOnlyEditInItsBatch` go (section 3.3.1), and which would also give
  `OverlappingEdits` its first move-versus-edit test case.
- **The one remaining coverage hole of section 5.1**, `shares_a_line`: reachable
  through a compact nested sequence, driven by a unit test, not by a fixture.
- **A second derivation of `comment_ownership_survives` on the test side**
  (section 3.4), deferred on cost grounds rather than on principle.
- **R19.** Unchanged, and a move now pays for one extra `TriviaIndex::scan` of the
  candidate; section 5.3 has the measurement.

---

## 9. The review's findings, and what was done about each

`docs/reviews/phase-0c-3b-2a-move-and-invariant.md`, finding by finding. Nothing
below is a plan; every row is done, tested and measured.

### 9.1 High — the three properties do not prove the carried bytes were copied

**Adopted in full.** `the_arrival_is_the_departure` is a production verification
property with two typed failures, `MovedBytesWereRewritten` and
`MoveCarriesMoreThanTheItem`. The expected bytes are read out of the **original
document** at runs bounded independently — by `StructuralGuard::Removal` from both
sides, and by the item's own physical lines derived textually from the source and
the item's node span — so the insertion string is never an input to what it is
compared against. The test-side `check_the_arrival_is_the_departure` is **kept**: two
derivations of one property is the discipline, and a property that lives only inside
the thing it checks is not one.

All four listed variants close, each with a retained test that fails without the
fix (section 6.2): permuted carried lines (M1), exchanged LF/CRLF terminators (C2b,
and independently by the paired line comparison), blank lines shuffled between
strip-chomped blocks (M3), and a deleted ownership blank line relocated elsewhere
(M4, by `comment_ownership_survives` — the byte comparison cannot see it, and
section 3.1.1 says why). The review's remark that *"presentation-sensitive trivia
ownership also needs comparison if re-attribution is forbidden"* is what that fifth
property is.

### 9.2 High — the EOF rotation violates D2p

**Adopted in full: the rotation is gone and the destination is refused**, by name,
`MoveWouldTerminateTheFinalLine`. Section 7.2 is rewritten and quotes the argument
it used to make. Two simplifications fell out: the line multisets are paired again
(section 3.2) and `MoveWouldExtendAKeptBlock` lost its second clause (section 4.2),
both at a measured cost of nothing. Cost of the refusal: 3 synthetic moves, 0 real
ones. Experiments F1–F3 measure what stands behind it.

### 9.3 Medium — there are more than three seams

**Adopted in full.** `MoveSeam::CarriedRunsJoin` is the internal seam, asked once
per adjacent pair of carried runs, and the model in section 4.1 is now *three
external seams plus one internal seam per adjacent pair*. `move-run-joins.yml` is
the fixture, with the safe side beside the refused one, and experiments E1–E4 show
the four layers that stood behind the missing refusal.

### 9.4 Medium — the acceptance suite is stronger than the invariant it claims

**Adopted in full**, in both halves. The stronger property moved into `verify` (9.1),
and the C1–C5 experiments are **retained tests** rather than documented history:
`tampered_move` drives the complete post-planning pipeline over a plan a defective
planner could have produced. The permutation-preserving mutation the review asked
for is M1, and `every_other_move_property_certifies_the_permuted_candidate` pins the
uncomfortable half — that every *other* property returns `Ok` on the corrupted
candidate. C5, which the review identified as the production hole rather than merely
a weak mutation, is closed by `MoveCarriesMoreThanTheItem` and D1 measures what
happens without it.

### 9.5 Low — `MoveMustBeTheOnlyEditInItsBatch` is a workaround, not an invariant

**Adopted as a relabelling.** The restriction stays; the circularity argument is
**withdrawn** as unconvincing, in the doc comment and in section 3.3.1, and what it
costs is recorded — including that `OverlappingEdits` is never exercised against a
move-versus-edit conflict. Making move verification compositional is real work and
is owed to a later phase (section 8).

### 9.6 Coverage holes

| Hole | Disposition |
|---|---|
| the quoted-scalar / inline-comment fixture | **Closed.** The single-quoted spelling is restored in `move-a-match.yml`, the exactness test counts and pins the overshoot as a skip, and `saphyr_quoted_scalar_ends_overshoot_into_trivia_across_the_corpus` asserts it separately. Section 7.4. |
| R23 reached by a move | **Closed with a fixture on each side**, `move-kept-comment-joins-a-block.yml`: 0 → 3 synthetic refusals, 0 real. Section 4.1. |
| `entry_hull_lines` in `tests/patch_structure.rs` | **Fixed**, by porting `hull_lines`'s frontier-leaf test. No count moved, which is what "latent" means. Section 7.5. |
| `shares_a_line` | **Left as it is, described honestly.** It is reachable — a compact nested sequence, `- - first`, whose inner item has the outer dash before its own — and `a_sequence_item_that_shares_its_line_is_refused` drives exactly that with the safe side beside it. A unit test is weaker than corpus coverage and section 5.1 says so instead of calling the zero a proof. |

### 9.7 Scope

The review's closing point is section 7.7, and it is the one paragraph in this file
that constrains a phase that has not been written yet.
