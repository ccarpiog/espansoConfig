# Phase 0c-3a — decisions, new error variants, and what turned out to be wrong

Phase 0c-3a is the first code in the crate that changes a document's **structure** rather than one
scalar's bytes: [`crates/espansoconfig-core/src/patch/edit.rs`](../../crates/espansoconfig-core/src/patch/edit.rs)
gains `FieldInsert` and `FieldRemoval`, and
[`crates/espansoconfig-core/src/syntax/collection.rs`](../../crates/espansoconfig-core/src/syntax/collection.rs)
answers risk R3. This file records the decisions a reader cannot re-derive from the code, and the
claims already in `PROGRESS.md` or in the source that this phase found to be false.

Out of scope, and deliberately not started: moving a whole match, the stronger multiset invariant a
move needs, and the full R9 round-trip property test. Those are **0c-3b**.

> **This file was written before the phase's adversarial review and has been corrected by its fix
> round.** The review is
> [`docs/reviews/phase-0c-3a-structural-edits.md`](../reviews/phase-0c-3a-structural-edits.md); its
> verdict was **do not accept**, on five findings. Section 10 dispositions all five. Two claims this
> file made are now known to have been **false**, and both are corrected in place rather than left
> standing with a footnote: section 5's account of what verification covers, and section 9's "every
> refusal reason is re-derived independently". Section 2's description of the envelope was also
> wrong about file-owned comments, and section 8 has been retabulated.

> **Superseded in part by Phase 0c-3b-1**
> ([`docs/decisions/0c-3b-1-notes.md`](0c-3b-1-notes.md)). The envelope is **no longer a contiguous
> hull**: it is an ordered, disjoint set of owned runs, so the removal section 2.1 records as
> *refused* is now performed and the file's comment is kept byte for byte. Wherever this file says
> "the envelope is one `ByteSpan`", "such a removal is refused" or "0c-3b owns it", read the 0c-3b-1
> notes instead. Two of this file's own predictions were also measured wrong there — section 2.1
> overstated what the change would disturb, and neither this file nor the review noticed that keeping
> a comment can feed it to a block scalar above (now **R23**). Every count in section 8 still
> describes the fixtures it names correctly; the corpus-wide totals have since moved, and 0c-3b-1's
> section 5 carries the current ones.

---

## 1. R3 — where a block collection really ends

### 1.1 What was measured, before anything was decided

The substrate reports a `SequenceEnd` / `MappingEnd` event for every collection. Measured over both
corpora as they stood before this phase — 246 synthetic collections and 240 real ones:

| Collection | Marker | Measurement |
|---|---|---|
| flow | the closing `]` / `}`, one byte wide | **exact**: 11 of 11 agree with the published extent |
| block | a **zero-width position** past the last child | overshoots in **223 of 235** synthetic and **228 of 240** real, and **never undershoots** (0 of 475) |

Where the overshoot lands, over the 451 overshooting collections: **111** at end of file, **42**
exactly on the following node's first byte, **298** in the middle of trivia. So it is *not* "the next
token's start", and it cannot be recovered by finding that token. Unlike a block scalar's end — which
is reconstructible from the header, the indentation column and the chomping indicator (D2) — a block
collection has no header to reconstruct anything from.

**Every one of the 451 overshoot regions held nothing but whitespace, line breaks and comments.** That
is a fact about the corpus, not about YAML; see §1.4.

### 1.2 The rule adopted, and why the published span did *not* change

Two numbers, not one, and the split is forced rather than chosen:

- **`Node::span` still ends at the collection's last child.** This was a workaround before; it is now
  a decision with a reason. `ownership.rs`'s `ending_before` attributes a trailing `:` and an inline
  comment to the node with the **greatest end**, so a mapping whose span reached past its own deepest
  key would take both away from that key. Measured on `empty: # why`, whose comment `PROGRESS.md` D2d
  pins to the **key**: extending the span moves it to the mapping and breaks the documented policy.
  Pinned by `a_collection_span_never_out_ends_its_own_deepest_child` in `tests/syntax_index.rs`.
- **`CollectionExtent::owned_end` is the number a structural edit needs.** `collection::owned_end`
  scans the substrate's overshoot **forwards** from the published end. Forwards is safe where
  backwards is not: the region lies past every child leaf, so it is entirely gap and nothing in it can
  be scalar content — which is exactly the argument R14 says a backwards lexer cannot make.

The scan's classes, each a rule:

| Class | Verdict | Why |
|---|---|---|
| spaces, tabs, line breaks | skipped | layout |
| `:` `-` `?` `,` | **kept** | the collection's own last entry's punctuation. The substrate reports an empty value and an empty item as zero-width scalars positioned *before* their `:` and *after* their `-`, so the published span stops short of bytes the entry plainly owns |
| a comment on the same line as the last kept byte | **kept** | plan §6.2 rule 3 — an inline comment belongs to its entry |
| a comment on a later line | skipped | rules 1, 2 and 4 give it to the file or to what follows |
| anything else | **refusal**, `None` | never a silently published known-bad extent |

The refusal is **counted**, exactly like the quoted-scalar trim (the 0c-2b review's finding 5):
`SyntaxIndex::unaccountable_collection_extents` records it, pinned at zero over both corpora.
Rejecting the whole index was considered and refused for the R14 reason — making a real file
unopenable for a case no accepted document reaches is the worse outcome.

**It publishes no number at all**, which is a correction the review's finding 4 forced: the first
draft fell back to the span's own end, and a value known to under-claim exactly the bytes a removal
needs must not merely be counted, it must be impossible to read by accident. `owned_end()` returns
`Option<usize>` — see §6.1.

One correction the measurement itself forced: the same-line test must anchor on the **last owned
character**, not on the owned *position*. A block scalar's content span ends immediately after its
final line break (D2c), so the position sits at column 0 of the next line and every comment on that
line looked inline. `scalar-styles.yml` had exactly that shape and was mis-claimed until the anchor
was fixed.

### 1.3 The cross-check that makes either derivation trustworthy

`collection::owned_end` derives the number **textually**, from the substrate's marker.
`TriviaIndex::subtree_extent` derives it from the plan §6.2 **ownership rules**, as the hull of
everything the collection's subtree owns. They share no code, and
`the_collection_extent_agrees_with_the_ownership_rules_over_both_corpora` asserts they agree on every
block collection of both corpora. A single derivation checked against itself would prove nothing.

Flow collections are deliberately outside that equality: their span ends at the closing bracket, which
is exact and is asserted separately, while an inline comment *after* the bracket is still attached to
the collection by rule 3 and so widens the ownership hull. Two different questions; folding them into
one figure is the R20 mistake.

`subtree_extent` is a hull, so the one thing that could go wrong is that it swallows a neighbour.
`a_subtree_extent_never_reaches_into_a_node_outside_the_subtree` checks every node of both corpora:
no byte of a hull falls inside a node that is neither an ancestor nor a descendant.

### 1.4 The corpus did not contain the shape that matters (R20, third time)

Not one of the 451 overshoot regions held a `:` or a `-`, because **no fixture in either corpus had a
mapping entry with no value**. A hand-written `a:\n  b: 1\n  c:\nnext: 2\n` does. Per R20 that is a
corpus problem, so
[`empty-entries-and-extents.yml`](../../crates/espansoconfig-core/tests/corpus/synthetic/empty-entries-and-extents.yml)
was added rather than a unit test being called sufficient. §8 tabulates every count it moved.

It is **not** one of the "whitespace is the test data" fixtures: nothing in it depends on an invisible
byte — no trailing spaces, no CRLF, a final newline present — so it needs no byte guard in
`corpus_integrity.rs`. It is listed in that file's fixture-coverage test so a rename or deletion still
fails loudly. (The review's fix round added two fixtures that **are** byte-critical, and they did move
`CLAUDE.md` §4's table, from nine entries to eleven — see §8.1.)

---

## 2. The envelope: which bytes are one mapping entry

**Built from `TriviaIndex::subtree_extent` on both halves of the entry — its key and its value — and
never from the direct-ownership queries.** Trivia is attributed to the deepest node a rule can name
(D2d), so an entry's inline comment belongs to its *value scalar* and its colon to its *key*: an
envelope built from either node alone leaves the other's trivia behind.

Then the envelope is widened to **whole lines**: back to the start of the entry's first line, which
must hold nothing but indentation, and forward past the break that terminates its last.

### 2.1 A hull is not a set — the review's finding 1, and what this section used to claim

This section, and `subtree_extent`'s own doc comment, said that comments the **file** owns "are
excluded by construction, which is what keeps a file header in place when the first entry goes".
**That is true only of comments outside the subtree's byte range, and the difference is a demonstrated
byte loss.** `subtree_extent` returns a *hull*: the smallest contiguous span covering everything the
subtree owns. A file-owned comment never widens it — the file's comments have no owning node — but one
lying **between two descendants** is inside it anyway. The reviewer's input:

```yaml
a:
  x: 1
  # keep this file comment

  y: 2
b: 3
```

A blank line separates that comment from `y`, so D2d rule 2 gives it to the **file**. Removing `a`
produced `b: 3` and deleted it, and the deletion passed every check the phase had: `StructuralGuard`
permits every descendant and reads no trivia, the sibling digests record decoded nodes and hold no
comments, and `bytes_outside_the_replacements_match` positively *authorises* the deletion, because
the envelope declared those bytes replaced. This is the structural twin of the 0c-2b review's
finding 3 — the edit's own declaration certifying the bytes it destroyed.

**The fix, and what it costs.** A removal whose final envelope intersects a file-owned comment is
refused by name, `EditError::RemovalWouldDeleteAFileComment`. The check is on the envelope *after*
widening, because widening is what can pull a comment in at either end, and it uses
`TriviaIndex::file_comments` — the document's own ownership answer — rather than anything the planner
computed. The cost is real and is not hidden: **a removal that ought to succeed, minus the comment,
now fails.** It costs the synthetic corpus exactly 1 attempt, in the fixture written for it, and the
real corpus **0** of 1 856.

**The right answer, deliberately not implemented now.** One `ByteSpan` cannot express "remove the
collection but keep this interior file comment". The eventual fix is an envelope of owned **runs** —
an ordered list of disjoint spans, with the file's comments and the blank lines around them punched
out of it — spliced as several replacements rather than one. That changes the shape of
`PlannedEdit`, of `StructuralGuard`, of the permitted-span check and of the per-fixture golden
tables, and it interacts with the whole-document invariant 0c-3b needs for a move. Doing it here
would mean rewriting the verification layer in the same round that is fixing it. **0c-3b owns it.**

> **Landed in 0c-3b-1, and this paragraph was measurably too pessimistic.** `PlannedEdit` did not
> change shape at all — it already held a `Vec<Replacement>`, because a block scalar is two
> replacements (D2c) — and neither did the permitted-span check, and nothing about the move's
> whole-document invariant was touched. `StructuralGuard` and the golden tables did change, as
> predicted, and the guard got a **second** half a hull had made unstatable. The paragraph also missed
> the one thing punching the comments out is not sufficient for: a kept comment directly under a block
> scalar's content becomes that block's content, now refused as `RemovalWouldExtendABlockScalar`
> (**R23**). See [`0c-3b-1-notes.md`](0c-3b-1-notes.md) §3 and §7.1.

**And the refusal alone was not accepted as sufficient.** A refusal in the planner leaves the
*verification* layer exactly as blind as it was, so the next envelope defect would hide the same way.
`verify` now also requires that every comment the original document assigns to the file is still
present in the candidate (`VerificationFailure::FileCommentLost`), derived from ownership rather than
from the edit's declarations — finding E3's lesson applied to trivia. `tests/patch_structure.rs`
carries the same comparison, written independently: its comment scan finds a `#` that opens a line or
follows white space outside every frontier leaf, so the oracle and the production check share no
code and either can contradict the other.

Edge cases, each decided deliberately:

| Case | Answer |
|---|---|
| a leading comment block immediately above the entry | **travels with it** — rule 1 gives it to the key, which is in the envelope |
| a comment separated **from what follows** by a blank line | it is the **file's** — rule 2. It stays where it is, and if the entry's envelope would cross it the **removal is refused** (§2.1). Note the blank line that matters is the one *below* the comment, not above it; a comment with a blank line above and none below is still a leading block |
| a file-header comment above the first top-level key | stays — rule 4, the load-bearing one |
| a blank line above or below the entry | **stays.** A blank line is the file's layout, not the entry's trivia; the user's visual grouping is not ours to delete |
| an entry whose value is a block scalar | the content span already ends past its final break (D2c), so the envelope is already whole lines and no further break is taken. Getting this wrong walked into the next entry's indentation and refused ordinary removals |
| an entry with **no value** (`label:`) | the value is zero width, so the envelope comes from the **key's** subtree, which owns the colon |
| the **first entry of a compact `- key: value` item** | **refused**, `EntryDoesNotOwnItsLines`. It shares its line with the `-` that introduces the mapping, and the dash belongs to the item rather than to the entry: deleting the line strands the dash, deleting only the entry re-indents everything below. Both change bytes nobody asked about |
| the mapping's **last remaining entry** | **refused**, `LastEntryOfMapping`. `a:` with nothing under it is an implicit null — that changes what the file *means*, not what it contains. Emptying a mapping is a decision about the parent entry; remove that instead |

---

## 3. Inserting a field

**Every insertion is "after an existing entry"** — the mapping's last by default, or the one
`FieldInsert::after` names. That makes the insertion point a single well-defined offset (the anchor
**entry's** ownership extent, past its trailing spaces, just after the break that ends its line) and
the bytes written a single well-defined shape.

**Inserting before the first entry is deliberately not offered.** The first entry of a mapping may
share its line with the `-` that introduces the mapping, so there is no line to insert before without
stranding that punctuation or re-indenting what follows — the same reason removing it is refused.

**The indentation comes from the mapping's own keys and never from a default.** Every key must already
sit at one column, and a mapping whose keys disagree is refused with `InconsistentEntryIndentation`
rather than guessed at. The "no siblings to learn from" case the brief asks about **cannot arise for a
block mapping**: an empty block mapping has no YAML spelling, so there is always at least one entry.
It can arise for a flow mapping `{}`, which is refused outright — see §4.

`InconsistentEntryIndentation` is **unreachable rather than merely unreached**, and the review's fix
round measured that rather than assuming it. A block mapping whose keys sit at two columns does not
parse; the two shapes that *can* disagree are a flow mapping written across lines, which
`FlowCollection` refuses first, and an explicit `? key` mapping, which the `ExplicitKeyMapping` hazard
refuses first. So the sweep pins it at **0** and no fixture can be written that moves it — this is one
place where R20's "add the fixture" has no fixture to add, and saying so is better than leaving a
category in the table that reads like a coverage hole. The branch stays, because a refusal that
cannot fire costs nothing and a guess that can costs bytes.

### 3.1 The line ending is copied, never chosen — the review's finding 2

The first draft wrote `SyntaxIndex::preamble().line_ending`, which is `LineEnding::detect`'s
**document-wide majority vote**. Two things are wrong with that, and both are demonstrated:

- `detect` **defaults** a document with no `\r\n` in it to LF. A single-line file with no final
  newline holds no line break at all, so inserting into it invented one.
- In a mixed document the majority is not the anchor. `file-comments-and-mixed-endings.yml` is
  LF-dominant and has two CRLF-terminated entries; inserting after one of those wrote LF.

**The rule now:** the break is taken from the anchor's own terminated line, or — when the anchor ends
the file — from the last break before the insertion point, which is a nearby sibling's. If the
document holds none, or holds only bare carriage returns (which `LineEnding` cannot express), the
insertion is refused: `EditError::NoObservableLineEnding`. Guessing a line ending is the silent
reformatting this crate exists to prevent, so a refusal is the only honest answer. It costs the
corpus 7 attempts, all in `single-line-no-line-ending.yml`, and the real corpus 0.

### 3.2 The same defect was live in the **scalar** path, and the new fixtures found it

The review demonstrated finding 2 on an insertion, and fixing only `plan_insertion` would have left
the cause in place: `scalar_context` took the same document-wide `preamble().line_ending` and handed
it to the emitter, which uses it for every break of a newly rendered `|` block. Both halves of the
finding were reachable through it, and — the part that matters — **the two fixtures this fix round
added for the insertion defect immediately exercised the scalar one**, while the sweep pinned the
results as successes:

- `single-line-no-line-ending.yml` holds no break byte at all. Editing its one entry to a multi-line
  value produced `only: |` + two body lines — three invented LFs, and **a final newline in a file
  that had none**, which is exactly the byte-fidelity class `no-trailing-newline.yml` exists to
  guard;
- `file-comments-and-mixed-endings.yml` is LF-dominant with two CRLF entries. A multi-line value on
  one of the CRLF lines came out with an LF-bodied block — a scalar whose own breaks are mixed, which
  `reencode_in_place` itself refuses as `NotReencodable::MixedLineBreaks`.

So the rule is now stated once and applied at both entry points, with the lookup direction chosen per
caller because the two stand in different places:

| Caller | Where its evidence is | Why |
|---|---|---|
| an insertion point | **behind** it (`line_ending_before`) | it sits immediately after the terminator it must copy |
| a scalar | **ahead** of it (`line_ending_after`), then behind | its own line's terminator follows it; the break behind it belongs to the previous entry |

A block scalar still prefers its **own body's** ending when that body's breaks are consistent, which
is the most local evidence of all and was already correct. And a scalar edit refuses with the same
`NoObservableLineEnding` — but only when the bytes it is about to write actually contain a break and
the document holds none to copy, so the other 9 edits to that fixture's single entry still apply.
Refusing a single-line value there would be refusing more than the evidence supports (R12).

This was not in the review's finding, and it is recorded here rather than quietly folded in: the
review's own sentence — *"guessing a line ending is exactly the silent reformatting this project
exists to prevent"* — is a statement about writing bytes, not about insertions, and a fix round that
left the twin live would have shipped a fixture that proves a defect while pinning it as success.
That is the R20 mistake in its purest form.

Two shapes of written bytes, and the second exists to preserve a file with no final newline:

- the anchor's line is terminated → `indent + key: value` and **that line's own break**, unless the
  rendered value already ends with one (a clip or keep block does);
- the anchor ends the file → the break goes **in front**, so the file still does not end in one, and
  it is the last break the document contains before that point.

The value and the key both go through `choose_scalar` with a `ScalarContext` built by the same walk
D2k uses, so a multi-line value becomes a `|` block indented from its own entry, a value that merely
looks like a number or a YAML 1.1 boolean is quoted, and a key is never written as a block scalar.

**No `PresentationNote` is emitted for a structural edit.** The note reports that an *existing*
scalar's spelling changed; an inserted value had no previous spelling and a removal rewrites nothing.
The `PROGRESS.md` constraint "a scalar that `reencode_in_place` refuses must not be silently
rewritten" is therefore vacuous here rather than unmet — no structural edit rewrites a scalar it did
not create.

---

## 4. Flow collections: D2k does **not** extend to structural edits

D2k threads flow context into *rendering*, so a scalar edit inside `{…}`/`[…]` writes flow-legal bytes
and is allowed. A structural edit is a different question and is **refused by name**
(`EditError::FlowCollection`), for reasons this phase did not measure an answer to:

- a flow mapping has no line of its own to add an entry to and no line to delete; an insertion there
  is a question about commas and spacing;
- an empty flow mapping `{}` additionally has no sibling entry to take an indentation from.

Refusing costs the corpus 22 attempts in `flow-collections.yml`, all of them insertions and removals
inside inline `vars: [{…}]`. It costs the **real** corpus nothing: 0 of 1 675 attempted structural
edits were refused for flow.

---

## 5. Verification, and the invariant a removal needs

### 5.1 The generalisation of "byte-identical outside the intended span"

0c-2b's headline assertion was "every byte outside the replaced spans is identical". A removal
deliberately deletes bytes, so the invariant is **generalised, not weakened**, to:

> The candidate is exactly the source with the declared replacements applied, and every declared
> replacement lies wholly inside a span derived from immutable syntax facts.

`bytes_outside_the_replacements_match` already stated the first half in that form — it walks the two
texts together using the replacement list — so an insertion (a zero-width span with non-empty text)
and a removal (a span with empty text) both pass through it unchanged. What had to be added is the
second half for the new span kinds:

- an **insertion**'s permitted span is the zero-width insertion point, computed from the anchor
  entry's ownership extent and the line it ends, and therefore independent of anything rendered;
- a **removal**'s permitted span is the envelope, computed from the entry's key and value node
  identifiers and the source text.

**Why that was claimed to be strong enough, and where the claim was wrong.** Byte identity alone
cannot police a removal, because the bytes it deletes are exactly the ones it claims to delete — an
envelope one entry too long confirms itself. That is the 0c-2b review's finding 3 in its structural
form, so two further checks carry the weight, and neither is a restatement of what the planner
decided. **Both of them are about nodes, and that is exactly the gap the review found**: a comment
the file owns is not a node, so neither check could see one being deleted (§2.1). A third check was
added for it, and it is listed below as such rather than folded into the original two, because the
original two really did not cover it.

1. **`StructuralGuard`**, run against the **original** index before a byte moves. A removal envelope
   may not overlap a node that is neither part of the entry nor an ancestor of it; an insertion point
   may not fall strictly inside a frontier leaf. Both are statements about node spans, which the
   planner did not choose.
2. **The sibling check**, run against the reparsed candidate: the mapping is still there, the named
   entry is present with its intended value (insert) or absent (remove), the entry count moved by
   exactly one, and **every entry the edit did not name still decodes — key and whole value subtree,
   in the same order — to exactly what it decoded to before**. The subtree comparison is a structural
   digest that records kinds and lengths as well as values, so `{a: "1"}` and `[a, 1]` cannot collide.

3. **Every comment the document assigns to the file is still in the candidate**, added by the
   review's fix round. The comments that must survive come from `TriviaIndex::file_comments` on the
   **original** — the document's own ownership answer, not the edit's — and the comments that did
   survive from a fresh classification of the candidate. The comparison is on multisets of comment
   *text*, so a legal edit that moves a comment or hands it to a different owner passes, and a
   deletion does not. It is one-sided on purpose: a candidate with more comments is not a failure,
   because an inserted block scalar may legitimately contain a `#` line.

   The candidate side deliberately uses `TriviaIndex::comment_spans` — classification without the
   ownership pass — because a candidate only has to be asked "which comments are in you". The
   ownership pass is quadratic (R19) and this runs on every edit.

Together those say: the bytes moved are the entry's, the entry went or arrived, nothing else in the
mapping means anything different, and no comment belonging to the file was destroyed. That is the
strongest local statement available without the whole-document multiset invariant a **move** needs,
which is 0c-3b's problem.

Two composition rules fell out of writing it:

- **Expectations are folded per mapping.** Two removals from one mapping must ask for two fewer
  entries, not one each. Folding by the mapping's identifier in the original index is also where two
  insertions of the same key are caught: neither alone is a duplicate, and together they are.
- **A sibling a scalar edit rewrites is exempt from the digest**, and only from the digest — its key
  and its position are still compared. Its value is checked by that scalar edit's own verification.
  Without this, a batch mixing a scalar edit and a removal in one mapping fails on a correct edit.

### 5.2 `OverlappingEdits` becomes load-bearing

For scalars it only ever caught the same path requested twice. Here:

- two removals of the same entry produce identical spans;
- a scalar edit inside a removed entry lies within the envelope;
- **two insertions at the same point are both zero width and share a start**, which `end > start`
  alone cannot see. The disjointness test therefore also rejects two replacements that share a start.

Adjacent-but-not-overlapping is the boundary case and is exercised: two removals of neighbouring
entries touch at a byte, both apply, and the highest offset goes first.

### 5.3 The order of the batch checks, and why it is not a detail — the review's finding 3

The disjointness test used to run **after** the expectations were folded, and the fold's arithmetic
was unchecked. `[remove a, remove a, remove a]` on `"a: 1\nb: 2\n"` therefore did not reach the
`OverlappingEdits` it was heading for: each removal planned successfully against the original mapping
of two entries, and the fold subtracted 1 from 2 three times. In a debug build that is a **panic**
from a public entry point, on input a caller is entitled to hand it — against the standing property
(D3b) that this crate answers bad input rather than aborting on it.

Both halves are fixed, and one would have sufficed:

- **disjointness is checked first**, before the guards and before the fold, because a batch whose
  replacements overlap is nonsense whatever else is true of it and every later step assumes it is not
  looking at one;
- **the fold's arithmetic is checked**, so no ordering of any future step can reintroduce the panic.

Refusing the underflow needed a name, and it did not need a new one: a batch that removes more
entries than a mapping has is the degenerate case of emptying it, which is already
`LastEntryOfMapping`. The fold now also refuses a batch whose *final* entry count is zero — two
removals that are individually legal can still empty a two-entry mapping — and it is the final count
that is tested, not an intermediate one, so `[remove a, remove b, insert c, insert d]` is still
legal.

A seeded sweep of 600 generated batches (1–4 edits, mixed kinds, paths drawn from a small set so
duplicates and nesting occur often, over five documents including one with no line break) now backs
the specific case up. It uses the same hand-written xorshift64\* generator `tests/scalar_codec.rs`
already has, so the crate still gains no dependency.

---

## 6. New typed variants, and why each exists

`EditError` — ten new variants, all diagnostics rather than user-facing prose, none carrying key or
value text because these errors are printed by tests that sweep the private corpus (`CLAUDE.md` §1):

| Variant | Why it exists |
|---|---|
| `NotAMapping` | the path names a sequence, a scalar, or an entry no key introduces |
| `FlowCollection` | §4 |
| `KeyAlreadyPresent` | a second entry with one key makes every path through the mapping ambiguous and raises `DuplicateMappingKey`, so the mapping would be uneditable the moment the edit landed |
| `NoSuchSibling` | `FieldInsert::after` named an entry the mapping does not have |
| `InconsistentEntryIndentation` | §3 — an inserted entry's column comes from its siblings, so a mapping that cannot agree with itself has no answer to give. Unreachable from a valid document, and §3 says why that is a fact rather than a hole |
| `EntryDoesNotOwnItsLines` | §2 — the first entry of a compact `- key: value` item |
| `LastEntryOfMapping` | §2 — the mapping would become an implicit null. Since the review's fix round it also answers a **batch** that would empty one, §5.3 |
| `RemovalWouldExtendAKeptBlock` | §7 |
| `RemovalWouldDeleteAFileComment` | §2.1 — the review's finding 1. The envelope is a contiguous hull, so a comment the file owns can sit inside it |
| `NoObservableLineEnding` | §3.1 — the review's finding 2. The document supplies no line break an insertion could copy, and one is never invented |

`VerificationFailure` — eight new variants: `MappingLost`, `FieldNotInserted`, `FieldNotRemoved`,
`SiblingChanged`, `EntryCountChanged`, `EnvelopeCoversAnotherNode`, `InsertionPointInsideANode` and
`FileCommentLost`. Every one discards the candidate, as before; `SiblingChanged` identifies the entry
by **position**, never by key text, and `FileCommentLost` carries the comment's offset in the
original and never its text.

`SyntaxIndex` gains `unaccountable_collection_extents()` (the counted refusal of §1.2) and
`overshooting_block_collections()` (the R3 observable, the exact counterpart of
`trimmed_block_scalars()` and restricted to the block styles for the same reason). `TriviaIndex`
gains `comment_spans()`, the classification-only comment scan the verification step uses (§5.1).

### 6.1 The collection extent's owned end is fallible — the review's finding 4

`CollectionExtent::owned_end` was a plain `usize`, and when the textual derivation returned `None`
the index published the node's own `span.end` with `derivation: Unaccountable` beside it. Nothing
enforced reading the second field. The counted observable was pinned at zero across both corpora and
no 0c-3a edit consumed the field, so no byte loss was traced — but a value known to under-claim
exactly the bytes a removal envelope needs must not look like an answer.

It is now `owned_end()` returning **`Option<usize>`**, `None` exactly when the derivation is
`Unaccountable`, with the field private and one constructor that keeps the two in step. A structural
consumer has to confront the failure. This is the same discipline the 0c-2b review's finding 5 forced
on `quoted_span`, and the counted observable stays as well: the type makes the failure impossible to
ignore, the count makes it impossible to miss in CI.

---

## 7. Things that turned out to be false, or that the corpus found

### 7.1 A removal below a `|+` block changes that block's value (**found by the sibling check**)

`block-scalar-leading-blank-lines.yml` has:

```yaml
  - trigger: :leading-blank-keep
    replace: |+

      kept between two blank lines

    label: after-leading-blank-keep

  # …the next match
```

Removing `label` deletes the line that **terminates** the `|+` block's trailing-break run, so the
blank line below moves up into the block's value: `replace` gains a newline although nothing about it
was edited. Nothing is wrong with the removal; a keep-chomped block's value simply is not local.

Refused by name, `RemovalWouldExtendAKeptBlock`, under a condition stated exactly rather than
conservatively so it costs only the shape it must: a keep-chomped block whose content ends at or
before the removal with nothing but blank lines in between, **and** a blank line immediately after the
removal. End of file does not qualify — a block's run is bounded by the end of the document either
way. It fires **5 times** in the synthetic corpus and **0** in the real one.

This was not reasoned about in advance. It was caught by the sibling check on corpus data, which is
the strongest argument available for keeping that check.

### 7.2 Our decoder and the substrate disagree on every implicit node

`empty-entries-and-extents.yml` gave the corpus its first entry written `label:`. The substrate
resolves the absent value and reports `~`; our `decode()` reads the span, which is empty, and returns
`""`. `PROGRESS.md` claims **838/838** synthetic and **1067/1067** real scalars decoded in agreement —
true, and true only because no fixture in either corpus had an empty entry.

The two are answering different questions and reconciling them needs a **null in the value model**,
which is a projection question rather than a codec one and is out of scope here. Nothing edits such a
node — `EditError::EmptyTarget` refuses it — so nothing is corrupted by it today. The divergence is
now pinned by name, with its corpus-wide count, in
`an_implicit_node_is_the_one_place_the_two_decoders_answer_differently`
(`tests/scalar_codec.rs`), and three corpus-wide oracles gained an explicit, **counted** skip for
zero-width scalars rather than a silent one:

- `saphyr_flow_scalar_end_offsets_are_exact_across_the_whole_valid_corpus` — an implicit node has no
  source token, so "the span is the exact token" is not a claim about it either way;
- `every_node_span_slices_the_source_it_was_written_as` — same reason;
- `our_decoder_agrees_with_the_substrate_on_every_synthetic_scalar` — the divergence above.

Each skip is bounded by a pinned count (`SYNTHETIC_ZERO_WIDTH_LEAVES = 5`), so it cannot grow into a
hiding place. **No existing assertion was weakened**: three new named categories were added for a
construct the corpus had never contained.

### 7.3 `patch_edit.rs`'s `empty_target = 0` was a coverage hole, not a property

The 0c-2b sweep pinned `total.empty_target` at **0** with a note saying no fixture held an addressable
empty entry. That was true and was precisely a gap. It is now **60** — 5 zero-width scalars × 12
replacement values — and the branch is exercised by corpus data as well as by its unit test.

### 7.4 What verification still cannot catch

Recorded rather than glossed, as 0c-2b did:

- a defect shared by both decoders;
- a YAML 1.1 disagreement the 1.2 substrate accepts — **R16 is still open**, and this phase did not
  close it. No second parser is in the test suite. 0c-3b inherits it, and it is the last phase where
  deferring it is cheap;
- an addressing mistake made identically in planning and in verification;
- a change to a construct **outside** the edited mapping. The sibling check covers the mapping the
  edit names and its subtrees; §7.1's hazard was found because the affected block was a sibling
  *inside* that mapping. A keep-chomped block in an enclosing mapping, terminated by a removal in a
  nested one, is not covered by construction — no corpus shape reaches it, and the whole-document
  invariant 0c-3b needs for a move is what would.

---

## 8. What the new fixtures moved

`empty-entries-and-extents.yml` adds **40 nodes** = 1 document + 1 root mapping + the `matches`
sequence + 4 item mappings + the nested `vars` sequence + its 1 item mapping + **31 scalars**, of which
**5 are zero width** (four empty entries and one bare sequence item).

| Pin | Old → new | Why |
|---|---|---|
| fixtures | 23 → 24 | the fixture itself |
| nodes (`patch_path`) | 1 114 → 1 154 | as above |
| addressable | 645 → 668 | its 8 collections + 10 values with a token + 5 zero-width values (four empty entries, one bare item) |
| documents | 25 → 26 | one more single-document fixture |
| mapping keys | 440 → 456 | `matches`, `trailing`, each item's `trigger`/`replace`/`label`, `vars`, and the nested `name`/`type` |
| scalars (`syntax_index`) | 838 → 869 | 31 scalars |
| frontier members | 843 → 869 | 31 − 5 zero width |
| collections | 246 → 254 | 8 |
| flow collections | 11 → 11 | it has none |
| overshooting block collections | 223 → 231 | all 8 of its block collections; none ends the file, so all have somewhere to overshoot into |
| collections owning a tail past their span | 4 → 7 | its three mappings that end in an empty entry. The 4 that were there before were **all inline comments**, so the entry-punctuation half of the rule was unreachable from corpus data |
| zero-width leaves | 0 → 5 | **the point of the fixture** |
| decoder agreement (`scalar_codec`) | 838 → 864 | 26 scalars with a token; the 5 implicit ones are skipped by name (§7.2) |
| re-encoded identically | 820 → 851 | all 31, an empty span re-encoding to no bytes |
| gap comments (line scan) | 201 → 218 | its 17 whole-line comments |
| scanner comments | 205 → 223 | those 17 **plus** the inline one sharing a line with `label:` — the documented difference between the two conventions (D2d), and the cross-check that both counted correctly |
| blank lines (line scan) | 697 → 720 | the loose convention, which also counts content-line terminators |
| scanner blank lines | 96 → 100 | the 4 real blank lines separating its items |
| blank runs | 92 → 96 | one per blank line |
| trivia items | 2 742 → 2 857 | — |
| hazards | 18 → 18 | it raises none |
| attempted scalar edits (`patch_edit`) | 4 728 → 4 908 | 15 more addressable scalars × 12 values |
| of which applied | 4 450 → 4 570 | the 10 with a token |
| of which `EmptyTarget` | 0 → 60 | the 5 zero-width ones (§7.3) |

### 8.1 What the review's fix round moved

Two more fixtures, for the two shapes the review showed the corpus could not see. R20's standing
instruction is to add the fixture rather than settle for a unit test, and both of these are files
whose **invisible bytes are the test data**, so `CLAUDE.md` §4's table grows from nine to eleven and
`tests/corpus_integrity.rs` gains a byte guard for each.

[`file-comments-and-mixed-endings.yml`](../../crates/espansoconfig-core/tests/corpus/synthetic/file-comments-and-mixed-endings.yml)
— **27 nodes** = 1 document + 6 collections (root mapping, `matches` sequence, 3 item mappings, the
nested `vars` mapping) + **20 scalars** (11 keys, 9 values), none zero width, with 6 whole-line
comments, 3 real blank lines, **two CRLF-terminated lines among bare-LF ones**, and no final break.
It carries finding 1's shape (a removable entry whose collection value holds a file-owned comment
between two descendants) and finding 2's (an LF-dominant document whose anchor ends with CRLF).

[`single-line-no-line-ending.yml`](../../crates/espansoconfig-core/tests/corpus/synthetic/single-line-no-line-ending.yml)
— **4 nodes** = 1 document + the root mapping + its one key and one value. One line, **no line break
at all**, and deliberately no explanatory header, because a comment line would add the very break the
fixture exists not to have. It is the only document in the corpus that offers an insertion nothing to
copy.

| Pin | Old → new | Why |
|---|---|---|
| fixtures | 24 → 26 | the two above |
| nodes (`patch_path`) | 1 154 → 1 185 | 27 + 4 |
| addressable | 668 → 685 | (6 collections + 9 values) + (1 collection + 1 value) |
| documents | 26 → 28 | two more single-document fixtures |
| mapping keys | 456 → 468 | 11 + 1 |
| scalars (`syntax_index`) | 869 → 891 | 20 + 2 |
| frontier members | 869 → 891 | none of the 22 is zero width |
| collections | 254 → 261 | 6 + 1 |
| flow collections | 11 → 11 | neither has one |
| overshooting block collections | 231 → 234 | 3 of the mixed fixture's 6; its root mapping, its sequence and its last item mapping all end at end of file, and the single-line fixture's one mapping does too |
| collections owning a tail past their span | 7 → 7 | neither ends a mapping with an empty entry or an inline comment |
| zero-width leaves | 5 → 5 | neither has one |
| decoder agreement (`scalar_codec`) | 864 → 886 | all 22, none skipped |
| re-encoded identically | 851 → 873 | all 22 |
| gap comments (line scan) | 218 → 224 | the mixed fixture's 6 whole-line comments |
| scanner comments | 223 → 229 | the same 6 — it has **no** inline comment, so here the two conventions agree, which is its own cross-check |
| blank lines (line scan) | 720 → 738 | the loose convention again |
| scanner blank lines | 100 → 103 | the mixed fixture's 3 real blank lines, one of which is what gives its interior comment to the file |
| blank runs | 96 → 99 | one per blank line; all three are isolated |
| trivia items | 2 857 → 2 923 | — |
| hazards | 18 → 18 | neither raises one |
| attempted scalar edits (`patch_edit`) | 4 908 → 5 028 | 10 more addressable scalars × 12 values |
| of which applied | 4 570 → 4 687 | 117 of the 120 |
| of which `NoObservableLineEnding` | — → 3 | a **new category** in that sweep: the three multi-line values of `REPLACEMENTS`, in `single-line-no-line-ending.yml`. They applied until §3.2, and gave a file with no final newline one |

**The structural sweep was retabulated for three separate reasons**, and they are worth keeping apart:

| Cause | Effect on the synthetic sweep |
|---|---|
| the sweep now attempts one **missing-sibling** insertion per mapping (§9.1) | **+205 attempts**: 182 answered `NoSuchSibling`, plus 21 that the hazard gate and 2 that the flow refusal answer first — which is exactly why `gate` moves from 235 to 256 and `flow` from 22 to 24 |
| a removal whose envelope crosses a **file-owned comment** is now refused | 1 attempt moves from `removed` to the new `file-comment` category, and it is in the new fixture: **no existing fixture is affected**, so the refusal costs the corpus as it stood nothing |
| two fixtures joined the corpus | **+66 further attempts** — the mixed fixture's 62 and the single-line fixture's 10, less the 6 missing-sibling attempts of theirs already counted in the row above. The single-line fixture's 7 `NoObservableLineEnding` refusals are the only ones in the sweep |

271 = 205 + 66, and the file-comment refusal moves an attempt between categories rather than adding
one.

Synthetic total: **2 301 → 2 572 attempted structural edits = 1 503 inserted + 248 removed + 256 gate
+ 24 flow + 28 last-entry + 136 shares-a-line + 182 duplicate-key + 5 kept-block + 1 file-comment +
182 no-such-sibling + 0 inconsistent-indentation + 7 no-line-ending.** Real corpus: **1 856 attempts,
928 inserted, 419 removed**, and **0** in each of the three new refusal categories — the two new
refusals cost real files nothing.

---

## 9. What this phase proved

**Structural sweep, synthetic corpus** — every mapping of all 26 fixtures, every entry offered for
removal, insertions attempted at every position plus one duplicate key and one missing sibling per
mapping:

> **2 572 attempted structural edits = 1 503 inserted + 248 removed + 256 gate + 24 flow +
> 28 last-entry + 136 shares-a-line + 182 duplicate-key + 5 kept-block + 1 file-comment +
> 182 no-such-sibling + 0 inconsistent-indentation + 7 no-line-ending.**

Pinned **per fixture, a complete row each**, and the table is asserted to cover the corpus exactly, so
a new fixture must be given a row rather than disappearing into a total.

### 9.1 "Every refusal reason is re-derived independently" — the claim, and how far it was false

This section used to say, flatly, that **every** refusal reason is re-derived independently by the
test. The review's finding 5 showed that was overstated in four separate ways, and all four are now
fixed rather than reworded:

| What the claim said | What was true | Now |
|---|---|---|
| every refusal is re-derived | `KeyAlreadyPresent` was **counted without checking the key was there** — the arm incremented the tally and asserted nothing | the sweep derives "the mapping already holds this key" from the decoded keys and asserts it |
| every refusal family is exercised | `NoSuchSibling` and `InconsistentEntryIndentation` were in neither `Tally` nor the sweep, so nothing said whether they were reachable | both are categories now; the sweep attempts one **missing sibling** per mapping, and `InconsistentEntryIndentation` is pinned at 0 with §3's argument that it is unreachable rather than unreached |
| the removal oracle re-checks the result | it compared entries, not trivia, which is precisely why finding 1 passed it | it compares the **file-owned comments** before and after, using a comment scan written independently of `TriviaIndex` |
| the corpus covers the shapes | `empty-entries-and-extents.yml` omitted CRLF and missing-final-newline, and no fixture held a removable collection containing an interior file comment | §8.1's two fixtures |

The refusal-side argument the claim was making is sound and still holds: the derived facts come from
walking the tree and reading the source rather than from calling the production gate, so an
implementation that refused everything fails on the applied counts and one that applied everything
fails on the derived refusals. What was wrong was the word *every*.

**Real corpus:** 13 files, **1 856 attempted structural edits — 928 inserted, 419 removed**, 0 gate,
0 flow, 44 last-entry, 103 shares-a-line, 181 duplicate-key, 0 kept-block, 0 file-comment,
181 no-such-sibling, 0 inconsistent-indentation, 0 no-line-ending. No count from it is hard-coded.

**Collection extents:** the textual derivation and the ownership hull agree on every block collection
of **both** corpora, 0 unaccountable extents, and each case of the rule has an exact byte golden.

The applied edits are re-verified from outside the engine: the candidate is the source with the
reported replacements applied, the removal envelope satisfies four properties none of which restates
how it was built, the insertion point satisfies three, every line break an insertion writes is
byte-identical to the one already in use where it lands, the candidate parses, the field is present or
absent as asked, every sibling still decodes — nested collections included — to what it decoded to
before, and **every comment the file owns is still there**.

---

## 10. The review's five findings, and what was done about each

The review is [`docs/reviews/phase-0c-3a-structural-edits.md`](../reviews/phase-0c-3a-structural-edits.md).
Verdict **do not accept**; the phase was held open until all five were fixed, as the four phases
before it were.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High, demonstrated.** Removing a collection-valued entry deletes file-owned comments, and every layer certifies the result | **Fixed at four layers** (§2.1). The doc comment on `subtree_extent` that claimed file comments were excluded is corrected — it is a *hull*, and an interior file comment is inside it. `EditError::RemovalWouldDeleteAFileComment` refuses the removal. `VerificationFailure::FileCommentLost` makes the loss visible to verification, derived from ownership rather than from the edit. The external oracle in `tests/patch_structure.rs` compares file-owned comments before and after, with its own comment scan. The run-based envelope the reviewer names as the real answer is **recorded and deferred to 0c-3b**, with its cost stated: a removal that would be legal becomes a refusal |
| 2 | **Medium, demonstrated.** Insertion defaults its line ending | **Fixed** (§3.1), **and the same defect fixed in the scalar path**, which the review did not name and the new fixtures immediately exercised (§3.2). The break is copied from the most local evidence — the anchor's own terminated line for an insertion, the scalar's own line terminator for a scalar edit — and a document that supplies none is refused by name rather than given LF |
| 3 | **Medium, demonstrated.** `[remove a, remove a, remove a]` panics | **Fixed twice over** (§5.3): disjointness is checked before expectations are folded, and the fold's arithmetic is checked. A batch that would empty a mapping is refused by name. Backed by the specific case and by a 600-batch seeded sweep |
| 4 | **Medium, suspected.** The collection extent publishes a known-bad `owned_end` | **Fixed** (§6.1). `owned_end()` returns `Option<usize>`, `None` exactly when the derivation is `Unaccountable`, with the field private. The counted observable stays, pinned at zero |
| 5 | **Medium, demonstrated.** Not every refusal is independently re-derived | **Fixed, all four parts** (§9.1), and the false claim in this file corrected rather than softened |
| — | The reviewer's optional hardening of the zero-width decoder skip | **Adopted.** `compare_decoders` now asserts every skipped node is plain, headerless and has substrate value `~`, so the skip cannot widen to cover a real disagreement |

### 10.1 What this fix round found that the review did not

One defect, and it is the same one as finding 2 seen from the other entry point: **a scalar edit
invented line endings too** (§3.2). It is recorded as a finding of its own because of how it was
found — the two fixtures added to prove finding 2's *insertion* fix walked straight into the scalar
version, which had been passing every sweep for two phases. That is the fourth time in this project
that the corpus, rather than the code, was the weak link (R20), and the second time in two rounds
that a fixture written for one defect uncovered another.

### 10.2 Still owed, and not by this fix round

Two things this round deliberately did not do, both of which belong to whoever opens 0c-3b:

- **The run-based envelope** (§2.1). Recorded here, in `EditError::RemovalWouldDeleteAFileComment`'s
  own doc comment, and on `TriviaIndex::subtree_extent`. Until it lands, a removal whose envelope
  crosses a file-owned comment is refused rather than performed-minus-the-comment. **Landed in
  0c-3b-1** — see [`0c-3b-1-notes.md`](0c-3b-1-notes.md).
- **`PROGRESS.md` is not updated by this round**, by instruction: no status row, no risk entry for the
  hull/file-comment refusal, no `Phase 0c-3a review disposition` section, no `Verification — Phase
  0c-3a` section. `PROGRESS.md` is the file this project declares authoritative for a fresh session,
  so until those land the deferral above lives only in this document. **That is the single highest-
  leverage thing outstanding**, and it is an orchestrator task rather than a phase-worker one.
