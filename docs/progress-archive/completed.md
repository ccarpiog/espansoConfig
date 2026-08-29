# Completed — the phase-by-phase narrative

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

---

## Completed

### Phase 0a — foundation, corpus, parser evaluation

**Workspace.** Cargo workspace at the repo root with a single crate,
[`crates/espansoconfig-core/`](crates/espansoconfig-core/), which has **no tauri dependency** and
never will (verified: `rg -c tauri Cargo.lock` finds nothing). Module skeleton follows plan §6.1:
`discovery` · `syntax` · `model` · `patch` · `emit` · `validate` · `persist` · `watch`.
`#![deny(missing_docs)]` and `-D warnings` are on from the first commit.

**Implemented for real:** [`discovery.rs`](crates/espansoconfig-core/src/discovery.rs) — config
directory resolution (explicit override → `$XDG_CONFIG_HOME/espanso` →
`~/Library/Application Support/espanso`), recursive file enumeration, and classification into
match file / config profile / package, with the `_`-prefixed-disabled flag. 13 unit tests against
synthetic temp trees.

**Defined as types** (from plan §6.2), everything else is a documented stub: `ByteSpan`,
`ScalarStyle`, `Chomping`, `ScalarPresentation`, `ContentRevision` (sha256), `LineEnding`,
`DocumentId`, `SourceDocument`.

**Golden corpus.** 19 valid synthetic fixtures + 4 deliberately invalid ones, in
[`crates/espansoconfig-core/tests/corpus/synthetic/`](crates/espansoconfig-core/tests/corpus/synthetic/),
covering every category in plan §11: all scalar styles, comments in every position, blank-line
runs, anchors/aliases/tags/merge keys, duplicate keys, flow collections, multi-document streams,
CRLF, BOM, no-trailing-newline, non-ASCII (Spanish accents and `⌘`/`⌥`/`⇧`), plus espanso shapes
(form + `choice`, a `form`→`date`→`shell` variable chain, `html`, `imports`, `global_vars`).
Two fixtures were added when the Phase 0a review was closed out: `block-scalars.yml` (the full
`|`/`>` × clip/strip/keep × explicit-indent matrix) and `unicode-offsets.yml` (precomposed `é`,
**decomposed** `é`, astral `😀`, `tail` — the file that pins the offset-counting scheme, and
which must never be Unicode-normalised).

**Parser evaluation.** [`docs/parser-evaluation.md`](docs/parser-evaluation.md) — the full
scorecard, probe evidence and division of labour. Backed by 31 executable tests in
[`tests/parser_evaluation.rs`](crates/espansoconfig-core/tests/parser_evaluation.rs) that pin
every measured behaviour. An adversarial review
([`docs/reviews/phase-0a-parser-substrate.md`](docs/reviews/phase-0a-parser-substrate.md))
found four verification holes; all four are now closed, and one of them **overturned a headline
claim** (see D2).

### Phase 0b — the span-accurate `SyntaxIndex`

Split into **0b-1** (byte-accurate spans) and **0b-2** (trivia and ownership) because one worker
could not hold both coherently. Both are complete; each was adversarially reviewed and each
review's findings were fixed *before* the phase was recorded done.

**0b-1 — the span layer.** `CharToByte` converts saphyr's Unicode-scalar-value offsets to bytes
so no char offset escapes `crate::syntax`, rejecting out-of-domain and inverted spans rather than
clamping. `DocumentPreamble` strips and records a BOM before parsing and detects the line ending;
**every span is a byte offset into the original on-disk bytes, BOM included**. `SyntaxIndex` is an
arena of nodes with stable `NodeId`, parent/child links, kind, scalar style and anchor/tag/alias
data. Block-scalar ends are trimmed off the substrate's overshoot into trailing blank lines and
the next node's indentation; a block whose header cannot be located is **rejected** rather than
published with a known-bad span (R10). The frontier is the ordered, disjoint, non-zero-width
`Scalar` + `Alias` spans, and `segments()`/`gaps()` partition the document.

**0b-2 — trivia and ownership.** `TriviaIndex::scan` classifies every gap byte into a typed
`TriviaItem` — comment, blank line, line break, indentation, spacing, block header, anchor, tag,
directive, document marker, eight punctuation kinds, BOM, unclassified — reusing `block.rs` rather
than re-lexing. `ownership.rs` implements the plan §6.2 comment rules with the precedence and two
documented extensions recorded in D2d, and `HazardKind` / `is_safely_editable` is the
refuse-rather-than-guess gate Phase 0c must consult.

**What is actually proven, over the synthetic corpus (22 fixtures when 0b-2 closed; 28 today) and
the 13 real files:** every byte is
either a frontier leaf or a named trivia item, the two concatenate back to the file **byte for
byte**, and **0 bytes are unclassified in either corpus**. Because tiling alone cannot catch a
*mislabelled* byte, two corpus-wide oracles independently re-derive each item's kind and each
comment's owner from the source text — they re-check 3 072 synthetic and 2 901 real trivia items,
and 77 comment attachments on the real corpus alone. That distinction is not theoretical: injecting
an `Indentation`→`Spacing` mislabel left every tiling and count assertion passing and was caught
**only** by those oracles.

### Phase 0c-1 — the scalar codec

The value-level half of the patch engine: **decode** a scalar's source bytes into its logical
string, and **encode** a logical string back into YAML source bytes. It mutates no document —
that is 0c-2 and 0c-3.

Three entry points, in [`src/emit/`](crates/espansoconfig-core/src/emit/):
`decode()` handles all five styles (plain, single-, double-quoted, literal, folded);
`choose_scalar(value, context)` is plan §6.3's style selector for a **new** value; and
`preserve_scalar(value, presentation, context)` is §6.3's "editing an existing scalar" path, which
keeps the current style whenever the new value is still safely representable in it.
`reencode_in_place()` is the codec's self-check: it returns either **byte-identical** output or a
**typed `NotReencodable` refusal**, never a silent difference.

**What is proven.** Our decoder agrees with the saphyr substrate's own decoded value on
**924/924** synthetic and **1067/1067** real scalars — zero
disagreements, so the decoder is
checked against an independent implementation rather than against itself. (The synthetic figure was
825 when 0c-1 closed and has moved only because later phases added fixtures; every delta is
tabulated in that phase's own notes doc. The five zero-width scalars of
`empty-entries-and-extents.yml` are excluded by name — see D2o's neighbour, `0c-3a-notes.md` §7.2.)
Decode-then-re-encode
is **byte-identical on 910 synthetic and 1056 real** scalars; every remaining scalar is covered by
a named refusal, and the refusals are **structural predicates on the source text**, never "the
bytes came out different" — a self-fulfilling check would prove nothing. `choose_scalar`'s output
is round-tripped through the substrate for 149 adversarial values plus a 1 500-value seeded sweep,
across nine block sites (LF and CRLF, nested indents, deltas of 9, 10 and 20, at EOF and followed)
plus a flow site and a mapping-key site.

### Phase 0c-2a — the structural path resolver

The addressing half of the patch engine, in [`src/patch/path.rs`](crates/espansoconfig-core/src/patch/path.rs).
It mutates nothing; 0c-2b is the first code that does.

`DocumentPath` is a document index plus an ordered list of `PathSegment::Key`/`Index`, with an
exact textual serialization (`matches[3].replace`). `resolve` walks it to the value node's
`NodeId`, `resolve_key` to the key node that introduces it, `resolve_full` reports value, key and
parent together, and `path_to` is the inverse. Every refusal is typed: `PathError` has nine
variants and `AddressError` six, each carrying the segment position and the node the walk reached.

**Why this exists at all, and why it is not a match identity.** Plan §6.2 requires the engine to
reparse the whole candidate document after every edit, and a reparse mints a *new* arena whose
`NodeId`s bear no relation to the ones the edit was planned against. A path is what survives that
reparse, so it is the mechanism the verify step re-finds the edited node with. It is emphatically
**not** the match identity §6.2 forbids being positional — `matches[3]` shifts on reorder, and
`NodeId` remains the session-local identity.

**What is proven.** The headline is a corpus-wide **inverse-pair oracle** over every synthetic
fixture and the 13 real files: for every node, either `path_to` refuses for a reason the test
**re-derives from the tree itself**, or `resolve(path_to(n)) == n` and the path's textual form
re-parses to the same path. The re-derivation matters — a resolver that refused everything would
satisfy "no round trip ever failed" while being useless. Synthetic figures are pinned per
category so two opposing drifts cannot cancel: **1 237 nodes = 713 addressable + 30 documents +
490 mapping keys + 4 ambiguous + 0 non-scalar keys.** The 30 is itself a cross-check: 27
single-document fixtures plus `multi-document.yml`'s three. (These were 1 095 / 634 / 24 / 433 when
0c-2a closed; every later delta is one added fixture's own shape, tabulated in that phase's notes
doc — `0c-2b-notes.md` §7, `0c-3a-notes.md` §8 and §8.1, `0c-3b-1-notes.md` §5.4.) No count from the
real corpus is hard-coded.

The two universal contracts are swept rather than sampled, after the review found them advertised
and untested: **4 000 seeded paths** round-trip through their textual form byte for byte (keys
drawn from an alphabet holding the grammar's own punctuation, `'`, `#`, NUL, BEL, DEL, ESC, `\n`,
`\r`, `\t`, U+0085, U+00A0, the BOM, `é` and `😀`), and **20 000 seeded strings** go through
`DocumentPath::parse` with zero panics. Both use the same hand-written xorshift64* generator
`tests/scalar_codec.rs` already uses, so the crate gains no dependency.

### Phase 0c-2b — the first code that mutates a document

The mutating half of the scalar patch engine, in
[`src/patch/edit.rs`](crates/espansoconfig-core/src/patch/edit.rs). Everything before it read;
this writes.

`apply_scalar_edits(source, &[ScalarEdit])` takes the **source text**, not a pre-built index, so it
parses and scans internally and there is no argument a caller can get wrong. Per edit it resolves
the path, **asks the hazard gate**, renders with `preserve_scalar`, and works out which spans it
replaces. A block scalar's `header_span` and `content_span` are replaced as **two separate spans,
never as one envelope spanning both** — the bytes between them are the header line's tail and its
line break (D2c), they belong to neither span, and rewriting them is the byte-fidelity defect the
review caught. The batch is rejected if any two replacements overlap, spliced **from the highest
byte offset downwards**, then the whole candidate is reparsed and verified. `PatchedDocument` has **no public constructor and no public field**, so the
only way to hold candidate bytes is to have been handed them after `verify()` passed: there is no
code path from a verification failure to a document a caller could write.

Verification is four assertions, each a typed failure rather than a panic: the candidate still
parses; **re-resolving the same `DocumentPath`** against the freshly parsed index decodes — by both
our decoder and the substrate's — to exactly the intended value; **every byte outside the replaced
spans is identical**; and every replacement lies wholly inside a span the syntax index says the
scalar owns. That fourth one is the review's finding 3: without it an oversized *intended* span is
authorised by the very declaration it should be checked against. `VerificationFailure` has nine
variants and `EditError` nine; no variant carries scalar text, because these errors are printed by
tests that sweep the private corpus.

**What is proven.** A corpus-wide sweep attempts every addressable scalar × 12 adversarial
replacement values: **5 220 attempted edits on the synthetic corpus = 4 879 applied + 276 gate
refusals + 60 `EmptyTarget` + 3 `NoObservableLineEnding` + 2
`TrailingNewlinesNotRepresentable`** — and the split is pinned
**per fixture**, a complete row each, so two fixtures cannot exchange eligibility undetected. (It was
4 728 = 4 450 + 276 + 2 + 0 when 0c-2b closed. The `EmptyTarget` zero was a coverage hole rather than
a property and Phase 0c-3a's fixture closed it; the `NoObservableLineEnding` three were *applied*
edits that invented a line ending until the 0c-3a review's fix round, D2p.) Every
refusal reason is **re-derived independently by the test**, walking the tree itself rather than
calling the gate, so an implementation that refused everything fails. The permitted spans are
likewise derived independently of the planner, which is what the review's finding 3 forced. On the
real corpus **2 004 of 2 004 attempted edits applied**, and no count from it is hard-coded.

Two error variants an earlier draft of this phase had are **gone**, because the fix round found they
were refusing edits with an exact lossless answer: `CommentOnBlockHeader` and
`LineNotFreeForBlockScalar`. See the review disposition.

### Phase 0c-3a — the first edits that change a document's structure

0c-2b changed one scalar's bytes in place. 0c-3a changes a mapping's **membership**: `FieldInsert` and
`FieldRemoval` join `ScalarEdit` in a single `DocumentEdit` batch, applied by `apply_edits`
(`apply_scalar_edits` is now a thin wrapper over it). Every byte the edit touches still stays where it
is — *relocating* bytes is 0c-3b-2, and is why the invariant has to change again there.

**The envelope is the phase, not the bytes.** Which colon, line break, blank line and comment travel
with a removed entry is the whole problem; writing the replacement is trivial once that is settled. The
envelope is built from `items_owned_by_subtree` / `comments_owned_by_subtree`, never the direct
queries, and is then widened to whole lines. In 0c-3a it was a **contiguous hull**, and D2o records what
that cost; **0c-3b-1 replaced the hull with an ordered set of runs** and D2o now records both halves.

**R3 is closed by measurement, not by assumption** (D2n). A block collection's end marker was measured
across both corpora *before* any rule was written: it overshoots in 223 of the 235 synthetic block
collections then in the corpus and 228 of 240 real ones, never undershoots, and lands at EOF, on a node
or mid-trivia (111/42/298). It is therefore
unusable *and* unreconstructible, so the published span deliberately stays child-derived and
`CollectionExtent::owned_end()` is a second, **fallible** derivation cross-checked against
`TriviaIndex::subtree_extent` on every block collection of both corpora. (The overshoot count the suite
pins today is **246 of 273** synthetic, the difference being fixtures added since; the ratio and the
verdict are unchanged.)

**Verification is generalised, not weakened** (D2p). "Every byte outside the replaced spans is
identical" cannot survive a removal, which deliberately deletes bytes. The invariant is now: *the
candidate is exactly the source with the declared replacements applied, and every declared replacement
lies wholly inside a span derived from immutable syntax facts.* Byte identity alone cannot police a
removal — an envelope one entry too long confirms itself — so three checks carry the weight, none of
them a restatement of what the planner decided: `StructuralGuard` against the **original** index, a
**sibling digest** proving every unnamed entry still decodes to what it decoded to before (kinds and
lengths as well as values, so `{a: "1"}` and `[a, 1]` cannot collide), and a **file-comment check**
that the review's finding 1 forced.

**What is proven.** A structural sweep over every mapping of every synthetic fixture — every entry
offered for removal, insertions attempted at every position, plus one duplicate key and one missing
sibling per mapping — pinned **per fixture, a complete row each**, with the table asserted to cover the
corpus exactly. When 0c-3a closed it read **2 572 attempted structural edits = 1 503 inserted +
248 removed + 256 gate + 24 flow + 28 last-entry + 136 shares-a-line + 182 duplicate-key +
5 kept-block + 1 file-comment + 182 no-such-sibling + 0 inconsistent-indentation +
7 no-line-ending**; the figures the suite pins today are 0c-3b-1's, below. On the real corpus
**1 856 attempted structural edits — 928 inserted, 419 removed** — and no count from it is hard-coded.
Applied edits are
re-verified from **outside** the engine: the removal envelope satisfies four properties none of which
restates how it was built (eight since 0c-3b-1 and its review), the insertion point three, every line break an
insertion writes is byte-identical to the one already in use where it lands, and every comment the file
owns is still there.

### Phase 0c-3b-1 — the envelope becomes a set of owned runs

**R21 is closed and D2o is complete.** A structural edit's envelope was one contiguous `ByteSpan`; it is
now an **ordered, disjoint set of runs**, spliced as several replacements. The removal the 0c-3a review's
finding 1 demonstrated — the one that deleted a comment the ownership rules give to the file — is a real
edit again, and the comment, its indentation and the blank line under it come out byte for byte. The
decision record is [`docs/decisions/0c-3b-1-notes.md`](docs/decisions/0c-3b-1-notes.md).

**The derivation is three steps, and every input is an ownership fact the planner does not choose.** The
hull comes from `subtree_extent` over the entry's key and value, widened to whole lines exactly as
before; the holes come from `file_comments()` — each comment's whole line, grown over every
`blank_runs()` entry that touches it; the runs are the set difference. `blank_runs()` rather than a
textual "all spaces" test, because it is a **gap-only** answer: a whitespace-only line inside a block
scalar's body is that scalar's content and can never be preserved by mistake.

**The blank-run rule, stated in both directions, because the first write-up left it implicit and
overstated** (the review's finding 1). *A blank run survives a removal exactly when it touches the line
of a file-owned comment the removal preserves; every other blank run inside the hull is deleted with the
entry.* The run **below** a kept comment is ownership: rule 2 reads it to give the comment to the file,
so deleting it re-attributes the very comment the edit kept. The run **above** is adjacency, not
ownership — deleting it would leave the comment file-owned — and it survives because the unit preserved
is the neighbourhood `blank_runs()` groups with the comment's line, which the gap layer does not
arbitrate side by side (D2/D2d). Neither is "the layout the user chose": that wording is **withdrawn**,
because it would apply equally to a blank run touching no comment and such a run is deleted. Both
directions are pinned byte-exactly by
`a_blank_run_survives_only_where_it_touches_a_kept_comment`.

**Moving from a hull to a set made the invariant stronger, not weaker.** With a hull, "the envelope
covers the whole entry" was true by construction and therefore unstated — and the empty set satisfies
"the envelope touches nothing outside the entry" perfectly. `StructuralGuard::Removal` now asserts both
directions, the second by a new `VerificationFailure::EnvelopeMissesTheEntry` over the entry's
**frontier leaves** (a collection's span inside the entry legitimately straddles a preserved comment;
a token never can). Nothing was weakened: the sibling digest, the file-comment check,
`bytes_outside_the_replacements_match`, the permitted-span check and `OverlappingEdits` all still apply,
and the last matters more now that one removal contributes several replacements to one flat batch list.
**What those two halves prove is stated exactly since the review:** the run set covers exactly the
entry's **nodes** — every frontier leaf of it, no node outside it. They say nothing about trivia, because
both are stated over node spans, so unowned trivia inside the hull is invisible to them. The earlier
claim that together they say "the run set is exactly the entry" is withdrawn.

**Punching the comments out is not sufficient, and nothing before this phase said so.** A comment left
directly under a block scalar's content, **at that block's own body column or deeper**, is *content of
the block*: the neighbour's value changes although nothing about it was edited. Refused by name,
`EditError::RemovalWouldExtendABlockScalar` — the same class as `RemovalWouldExtendAKeptBlock` reached
from the other direction. No fixture held the shape (R20, the fifth time), so
`run-based-removal-envelope.yml` was written for it. **The refusal's first form compared no columns and
was therefore over-broad** (the review's finding 2): it turned down a folded block above a *column-zero*
comment, which cannot become block content at all. It now compares the first non-blank preserved line's
column against `ScalarPresentation::indent`, the body column the span layer already published — read,
never re-lexed (D2/D2d) — and refuses unconditionally only where that column was never observed, which
is a block whose content span is **empty**. `run-based-removal-boundaries.yml` was written for the safe
side of the condition, R20's sixth occurrence, together with the entry-owned-leading-comment-block plus
interior-file-comment pairing the notes had admitted neither corpus held.

**What is proven.** The structural sweep now reads **2 696 attempted structural edits = 1 585 inserted +
264 removed + 256 gate + 24 flow + 30 last-entry + 140 shares-a-line + 192 duplicate-key + 5 kept-block
+ 0 file-comment + 1 block-absorbs + 192 no-such-sibling + 0 inconsistent-indentation +
7 no-line-ending**, still per fixture and still asserted to cover the corpus exactly. Every applied
removal's run set satisfies **eight** externally derived properties, four of which only a set needs —
the runs cover every frontier leaf of the entry, **the runs and the bytes the preservation rule protects
partition the envelope's byte range in both directions**, no run intersects a file-owned comment, and
every gap holds whole lines of nothing but comment and blank lines. The real corpus is **unchanged in
every figure**: 1 856 attempts, 928 inserted, 419 removed, before and after the review's fix round.
R21's measured gain is one synthetic removal and zero real ones — exactly the cost D2o measured for the
refusal — and its real value is that a move is impossible on a hull.

**Property 6 was rewritten in the review's fix round, and this is the important half of finding 1.** It
used to require every gap between two runs to hold a file-owned comment, which **codified** the
behaviour: delete the blank line that makes a kept comment file-owned and the gap still holds a comment,
so the property passed, the comment's text survived, no decoded value moved, and the sweep certified a
re-attribution. Demonstrated rather than argued — with the engine broken that way, **both corpus sweeps
pass** (experiment 5b of `0c-3b-1-notes.md` §6). It is now a partition against `preserved_by_the_rule`,
the rule written down once on the test side, and it names the bytes and the direction of any
disagreement: *"the envelope deletes 294..482, which the preservation rule protects…"*. An oracle that
cannot fail for the right reason is not an oracle.

### Phase 0c-3b-2a — the first edit that relocates bytes, and the invariant that forces

`ItemMove` joins `ScalarEdit`, `FieldInsert` and `FieldRemoval` in the `DocumentEdit` batch. A move
relocates a whole **sequence item** — a match — to another position **in the same block sequence**. It is
a removal plus an insertion and needs no second engine: it shares `removal_envelope` with `FieldRemoval`
and `insertion_point` with `FieldInsert`, which is exactly what 0c-3b-1's run set made expressible.

**The carried bytes are copied verbatim — no rendering, no re-indentation** — and that is measured, not
assumed. `PROGRESS.md` predicted a move would re-indent what it carries and that R23's column comparison
could not be reused unchanged; **the prediction was wrong**, because the valid items of one block sequence
share their structural indentation (D2r, notes §7.1). The proof is scoped to that operation and does not
transfer to a differently indented or nested destination.

**Byte identity stopped being sufficient, and the replacement is five production properties** (D2q).
"Every byte outside the replaced spans is identical" survived 0c-3a only because insert and remove never
relocate anything. A move does, so `verify()` now also asserts: the document's lines are conserved as
paired multisets of content and terminator; the items are in the intended order; every construct the move
did not name decodes to the same value, by a lockstep tree walk; **the arrival is the departure**; and
**comment ownership survives**.

**Six typed refusals**: `NotASequenceItem`, `NoSuchDestinationItem`, `MoveChangesNothing`,
`MoveMustBeTheOnlyEditInItsBatch`, `MoveWouldInventALineEnding`, `MoveWouldTerminateTheFinalLine`,
plus `MoveWouldExtendAKeptBlock` and `MoveWouldExtendABlockScalar` at four separately counted `MoveSeam`s.

**What is proven.** A move sweep over every block sequence of all 32 synthetic fixtures and the real
corpus: **2 571 synthetic attempts, 1 790 applied**, pinned per fixture with the table asserted to cover
the corpus exactly, every refusal re-derived independently by the test. The real corpus is **340 attempted,
126 applied**, computed and never hard-coded. `MoveWouldExtendAKeptBlock` was found **by the new invariant**
on `scalar-styles.yml` before the refusal existed — the invariant caught a real defect rather than merely
passing, which is what gives it credibility.

**The review's two High findings were real, and both are closed** — see the disposition below. The
headline one is that the check proving the carried bytes were copied verbatim lived **only in the test
sweep**, so a defective planner that permuted what it carried could still mint a `PatchedDocument`. It is
now a production property derived from independently bounded source runs. Every one of the review's
concrete counterexamples is a **retained test** that fails without the fix, and
`every_other_move_property_certifies_the_permuted_candidate` pins that the other four properties **accept**
the corrupted candidate — so the new one is demonstrably the thing doing the work.

### Phase 0c-3b-2b — the gate, and the verdict

**The Phase 0 architectural gate (R4) is PASSED, with four qualifications.** The full verdict, with its
evidence, is [`docs/decisions/0c-3b-2b-notes.md`](docs/decisions/0c-3b-2b-notes.md) §8. Plan §12's exit
criterion — *"the round-trip property test passes on the full corpus"* — is met, and **"full corpus" means
every eligible target in every file**, not merely every file.

**The R9 sweep** ([`tests/gate_roundtrip.rs`](crates/espansoconfig-core/tests/gate_roundtrip.rs)) crosses
twelve axes — CRLF/LF, BOM, no final newline, trailing spaces, comments, block-scalar terminal newlines,
duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys, empty values — with all four
operations, over both corpora: **2 080 synthetic attempts (1 696 applied) and 1 998 real (1 851 applied),
with no stride and no thinning**. Eight properties are checked on every applied edit; not one verification
failure occurred anywhere. Every refusal is typed, and the hazard families are re-derived from the
document. The 48-cell axis×operation matrix has **no `Absent` cell**; 18 are `RefusedOnly`, each
enumerated and asserted against the measurement rather than read off the table.

**R16 is answered without a second parser, and the reasoning is D2s.** An in-house YAML 1.1 / 1.2-core
tag-resolution table lives in the **library** ([`src/emit/tags.rs`](crates/espansoconfig-core/src/emit/tags.rs)),
is consulted by the emitter, and is asserted in `verify()` as a **differential** property. R16 nonetheless
**stays open** for the projection half — see the risk row, worded so it cannot be mistaken for mitigated.

**The oracle immediately found a real defect, which is the whole argument for building it.** D2h's
plain-safety predicate was **incomplete**: it wrote **34 distinct 1.1-ambiguous values plain** — `=`, an
`._7`/`.__2` family, and `2001-1-1 10:00:00`. Every one of those is a value espanso would have read as a
non-string. Fixed in `is_conservatively_safe_plain_scalar`.

**The first verdict was wrong, and the review caught it.** This section's first draft said PASSED on
evidence that included E5 — a demonstrated production escape — as *supporting* evidence. See the
disposition below. The phase was held open, the blocker was closed **in production**, and the verdict was
**re-derived rather than reworded**.

### Phase 1a — the core-side read model

The first work after the gate, and still **no UI**: `crate::model` projects a parsed document into the
read-only view the browser will render, and `crate::workspace` is the load-and-cache layer Phase 1b's
Tauri commands wrap. The decision record is
[`docs/decisions/1a-notes.md`](docs/decisions/1a-notes.md).

**The projection is a projection, and D2u is a type rather than a note.** `DocumentView` → `MatchView`
(all 22 of plan §3.3's fields) / `VariableView` (the nine §3.4 types, `params` shallow) /
`ConfigProfileView`, with every user-authored scalar exposed as a `ScalarView` holding `decode()`'s
**source text**. There is no `bool`, no `i64` and no value enum anywhere a user's scalar can reach —
`word` and `propagate_case` included, which is the whole point: rendering `on` as a boolean is R16's
open half making a claim this project has not earned. `ScalarView` carries an `ambiguous_yaml_1_1` flag
read off `emit::tags` — a claim about *risk*, which D2u permits. A badge likewise comes from a key's
presence or a `type` field's text, **never from a value**, so there is deliberately no "word boundary
ON" badge; `badges_come_from_key_presence_and_type_text_never_from_a_scalar_value` pins the absence.

**"No key is dropped" is a checked accounting, not a promise.** Every key is either modelled, or
recorded as an `UnknownEntry` by name and path, or **lies inside a recorded undescended span** — the
third clause is the review's finding 2, and it is stated as a bound rather than folded into the claim.
The library checks it itself (`DocumentView::unaccounted_keys` → `DiagnosticCode::KeyNotAccountedFor`),
which is R24 applied before a reviewer had to; and the test-side oracle derives its expectation from
the **document tree**, not from the records the projection emitted, which is what the first version got
wrong. Measured: **546 synthetic keys = 518 named + 28 span-accounted**, and **566 real = 566 named**.

**Identity is scoped to the parse that minted it, and a stale one is refused** (D2v). This is the
review's finding 1 and it was a real defect: `NodeId` is the parser's arena index, so exchanging two
equally shaped matches and reparsing handed `:a`'s identity to `:b`. `MatchId` now carries the
document's `ContentRevision` and `match_by_id` returns `Result<_, IdentityError>`; `DocumentId` comes
from a monotonic session counter keyed by path rather than from sorted enumeration position, so adding
an alphabetically earlier file no longer re-points a retained id at another file.

**The cache is R19's remaining half, answered.** `Workspace::{discover, summary, list_documents,
get_document, get_match, document_view, document_text, refresh, load_all, evict}` builds the
`SyntaxIndex` + `TriviaIndex` **once per `ContentRevision`** and serves views from the cache;
`loading_every_document_parses_each_exactly_once` and
`a_second_view_of_one_revision_is_served_without_reparsing` pin it against an instrumented parse
counter. A cache slot may hold only what the disk held — the draft-injecting entry point the first
version exposed is gone (finding 3), because plan §6.4 gives disk state to Rust and the draft to the
frontend.

**What is proven.** Every match in all 33 synthetic fixtures projects, pinned per fixture in a table
asserted to cover the corpus exactly, and the real corpus projects with every figure computed. Every
fixture survives truncation at every character without a panic; the four deliberately invalid fixtures
yield typed diagnostics and still expose their raw text; a document that is not espanso-shaped at all
projects rather than failing. **471 tests pass**, up from Phase 0's 465.

**Five review findings, all closed, and two of them were real defects** — see the disposition below.

### Phase 1b-1 — the shell, the scaffold, and the i18n layer

The first code in this repository that a user could ever see. `src-tauri/` and `src/` both exist for
the first time; the workspace is no longer a single crate. The decision record is
[`docs/decisions/1b-1-notes.md`](docs/decisions/1b-1-notes.md).

**The architecture rule survived the phase that could break it, and its check changed** (D2x). `src-tauri`
depends on `espansoconfig-core` by path and the arrow points one way only: `cargo tree -p
espansoconfig-core` lists `saphyr-parser`, `serde` and `sha2` and nothing else. **`rg -c tauri Cargo.lock`
is no longer a check** and must not be quoted as one — the lockfile now legitimately contains tauri, so
the old one-liner passes vacuously exactly when it would matter most.

**A missing translation is a compile error in both directions, and that is a type rather than a
convention.** `TranslationKey = keyof typeof en` makes `en.json` the schema, and the binding
`const spanish: ExactDictionary<typeof es> = es` makes a key **missing from** *or* **surplus in**
`es.json` fail `svelte-check`. The second direction is the one a plain `Record<TranslationKey, string>`
would have missed, because excess-property checking does not apply to a non-literal assignment — so
`ExactDictionary` maps every surplus key to `never`. Both directions were verified by disabling
experiments rather than asserted (notes §2).

**Four runtime checks cover what the types cannot see**, because a type says nothing about what a string
*contains*: key-set parity read from the two files rather than from a list, `{placeholder}`-set parity
per key (a translator who drops `{language}` produces a string that type-checks and renders), a
**untranslated-value** heuristic with its exceptions **listed by key** so the exception set is
auditable, and the markup scan below. 71 frontend tests across 8 files.

**That fourth check is a heuristic and its name now says so** — the review's finding 5. It establishes
**non-identity**, not that a value is Spanish: renaming `language.label` to `"Sprache"` leaves it
non-blank, trimmed, unequal to the English and placeholder-clean, so every check passes. The notes said
the runtime tests covered "whether a Spanish value is actually Spanish". They did not, and both the
assertion and every sentence claiming it have been corrected. *An oracle must be able to disagree* (R24)
applies to a test's **name** as much as to its body.

**The hardcoded-string check is stated with its blind spots, not with its result.** It scans
`src/**/*.svelte` markup for literal text that did not come through `t()`, and it **cannot see**
`<script>` bodies, `{'literal'}` expressions, `.ts` string constants or props. A clean run therefore
means *"no literal sits in markup"*, which is weaker than *"no hardcoded string exists"* — the notes say
so in those words (§7). Its blind spots are themselves pinned as tests, and it was proven able to fire
against the real tree rather than only to pass.

**Locale follows the first *servable* tag of `navigator.languages`, not the head of the list.** A user
whose preferences read `[fr, es, en]` gets Spanish, where reading only the head would have given them
English via the fallback. The override lives behind a storage port and is stored as **absence of an
override** rather than as a snapshot of the detected locale, so a user who never chose keeps following
their system.

**What is not there, on purpose:** no IPC command (1b-2), no router, no CodeMirror (Phase 3), no
three-pane layout (1c). **The Tauri capability set is empty** — `"permissions": []` — because the 1b-1
frontend calls no Tauri API at all, and the production CSP has no `'unsafe-inline'`.

**Both of those are the review's High findings, and both were real grants rather than theoretical ones.**
The capability set was `core:default`, which the phase described as "nothing else — no filesystem
permission": it expands to the path, event, window, webview, image, menu and tray defaults, and
`image:allow-from-path` + `image:allow-rgba` alone let a compromised renderer read the pixels of any
local image. The production CSP allowed `'unsafe-inline'` styles although the production bundle emits an
**external** CSS asset and only Vite's dev server ever needed it — so injected markup could hide the
interface and paint its own text. The relaxed policy now lives in `devCsp`, where it is true.

**The declared macOS floor and the compile target now state the same thing, which they did not.**
`vite.config.ts` targets `safari16` while `tauri.conf.json` declared `minimumSystemVersion: "11.0"`,
whose WKWebView predates `Object.hasOwn` (Safari 15.4+) — and `translate()` calls it on the first render,
so a macOS 11 user would have met `TypeError: Object.hasOwn is not a function` and a blank window. The
floor is **13.0** (the release that ships Safari 16), the call is now
`Object.prototype.hasOwnProperty.call`, and `webview-floor.test.ts` fails if the two ever disagree
again. Widening the floor later means lowering the esbuild target, not editing the plist — that is a
Phase 5 packaging decision, recorded so it cannot be taken by accident.

**The fix round found a defect neither the phase nor the review reached, and it invalidated the phase's
own smoke test.** `src-tauri/Cargo.toml` declared no `custom-protocol` feature, so
`tauri::is_dev()` — literally `!cfg!(feature = "custom-protocol")` — was true in every build, and every
binary loaded the dead `devUrl`. The window that 1b-1 reported as "launched and stayed up" was
**blank**. It was separated from a frontend exception by planting a static `<h1>` in `dist/index.html`
and watching that fail to render too. The feature is now declared and off by default. This is R32 in its
sharpest form: *a process that stays up is not a screen that renders*, and only something that looks at
the pixels can tell the two apart.

**Twelve coverage holes are stated as holes** (notes §9) — the unlocalized macOS menu chief among them.
The reviewer argued the phase should not close while it is open; the rebuttal is that localizing it
needs either Spanish strings in Rust (plan §9 forbids) or an IPC command (1b-2 by design). **Both the
objection and the rebuttal are recorded in the notes as a live disagreement**, not resolved by silence.

### Phase 1b-2a — the read-only IPC surface, and the identity claim it had to withdraw

The **boundary**. 1b-1 shipped no command on purpose, so that `t()` was the only route any string
could take to a screen; 1b-2a is the first code that carries data across it. The decision record is
[`docs/decisions/1b-2a-notes.md`](docs/decisions/1b-2a-notes.md).

**Five read-only commands, and nothing else.** `open_workspace`, `list_documents`, `get_document`,
`get_match`, `reload_document` are one-line wrappers over a `WorkspaceSession` holding `Workspace`
behind a std `Mutex`. They are **synchronous**, which is the whole reason no guard can cross an
`.await` — the deadlock class is designed out rather than reviewed for. **No mutating command
exists**, and that is now enforced rather than asserted: `wire_contract.rs` parses the complete
`generate_handler!` list independently and compares it bidirectionally against the frontend's names,
then asserts that none of the six Phase 2 names appears in either set. Before the review that test
compared only one direction, so registering `commands::save_match` and changing nothing else left it
**green** — the oracle could not disagree with the thing it was named for.

**The wire error carries codes and operands, and has no `Display` impl at all.** Nine flat codes with
structured operands, a hand-written `Serialize` that writes `code()` so each code has exactly **one**
spelling in the crate, and `From` impls that match the core's three error enums exhaustively — a new
core variant fails the build. Plan §9's "codes and structured data, never prose" is a property of the
type rather than a habit: there is no developer rendering to leak, because none was written.

**`"permissions": []` is now evidence rather than argument.** `dispatch_check.rs` drives all five
commands through the real Tauri dispatcher (`MockRuntime` plus the **shipped** `tauri.conf.json` and
capability file), so the claim that the empty capability set suffices is measured. A first attempt
used `http://tauri.localhost`, which macOS does not treat as local, and every command was refused;
that accident became `a_remote_origin_is_refused`, pinning **both** sides of the access check. The
1b-1 review's High finding — that `core:default` was a real grant, not a theoretical one — stays
closed.

**R27 was stated falsely in three files and in this checkpoint, and the review caught it.** See the
correction below. `identityRecovery()` now returns
`{action: 'reresolve', mayFind: ['sameMatch', 'differentMatch', 'gone']}` — the three answers as
**data**, so a caller cannot skip one — and `a_document_path_is_positional_so_a_deletion_repoints_it`
is the counterexample in test form.

**A non-UTF-8 path could turn a typed failure into untyped prose, and that is fixed in the core.**
serde's `PathBuf` serializer rejects non-UTF-8 paths, so `list_documents` could return `Ok(...)` and
then fail *during response serialization* — and an `Io` error carrying the same path could fail to
serialize too, delivering serde's generic English to the webview. `crate::wire`'s `WirePath` now
backs all five wire path fields and all four `CommandError` path operands. macOS APFS refuses to
create such a filename (`EILSEQ`, confirmed by trying), so the tests drive the serialization path
directly rather than through the filesystem, and **say so** instead of skipping.

**What is proven.** **514 tests pass** (core 478, up from 471; shell 36, up from 1). Thirteen
disabling experiments are recorded — six of them run against the committed code, including the one
the review required: `commands::save_match` added to `generate_handler!`, the test observed
**failing**, reverted, tree verified clean. Four coverage holes remain, each numbered with the phase
that owns it named.

**Ten review findings, all closed, and two of them were real defects** — see the disposition below.

### Phase 1b-2b — the prose, the exhaustiveness check, and the menu

The **prose**. 1b-2a made the boundary carry codes and structured data with no rendering anywhere;
1b-2b is what turns those codes into sentences a user can read, in both languages, and what makes a
code without a sentence a **build failure** rather than an empty label. The decision record is
[`docs/decisions/1b-2b-notes.md`](docs/decisions/1b-2b-notes.md).

**Sixteen namespaces, 111 code keys, 138 keys per dictionary.** Every enum that can reach the UI —
`DiagnosticCode` (23), `MatchBadge` (10), `HazardKind` (10), `CommandError` (12), `UnknownReason` (4),
`WorkspaceError` (5), `IdentityError` (3), `ValueKind` (5), `DocumentShape` (3), `DiscoveryError` (3),
plus `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind`, `VariableKind` — has an
`en` and an `es` entry under `code.<enum>.<variant>`. The scheme is an **identity formula** from the
Rust variant name, which is what lets the check below compute the expected key set instead of reading
a list. `src/lib/i18n/codes.ts` gives typed key builders whose template-literal return types make a
missing key a **compile error**, and the operands ride the existing `{placeholder}` interpolation, so
the placeholder-parity test covers them for free.

**The last six were deferred to 1c and the review took the deferral away.** `ScalarStyle`,
`LineEnding`, `FileKind`, `TriggerKind`, `ContentKind` and `VariableKind` already cross the wire in
the read projection; a 1c component meeting `trigger.kind = "Single"` with no string could only render
a raw Rust identifier or invent an unchecked mapping. They are in, and the phase's own argument for
deferring them is withdrawn rather than softened.

**The exhaustiveness check parses Rust properly, because scanning lines failed open three ways.**
`src-tauri/src/rust_source.rs` uses `syn` and `proc-macro2` — **dev-dependencies of `src-tauri` only**,
never of the core — and `dictionary_contract.rs` compares the derived variant set against both
dictionaries **bidirectionally**: a variant with no key fails, and a stale key with no variant fails
too. The registry it checks is no longer trusted either: `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`
walks both source trees for `Serialize`-carrying enums and
`every_typescript_wire_union_has_a_namespace` walks `types.ts`'s unions, so a **brand-new enum** is
caught by derivation rather than by someone remembering to add a row. Four enums are excluded by name,
each with a reason.

**What still escapes is written down with a worked example.** A parser cannot expand a macro, so an
enum produced by `macro_rules!` is invisible to both derived checks — planted, all eight
`dictionary_contract` tests observed **passing**, recorded as experiment 12E and as a coverage hole.
The limit is stated because the alternative is a check whose name outruns what its body can see.

**The developer string left the type, because a name scanner could never enforce "never rendered".**
`classifyFailure()`'s `detail` was guarded by a lint forbidding the identifier — and
`JSON.stringify(classifyFailure(x))` names no identifier at all. It is now non-enumerable and
symbol-keyed, readable only through `developerDetail()`, with `reportIpcFailure()` as its console
destination. `JSON.stringify` of a failure is pinned at `{"kind":"unexpected"}`, spread and
`structuredClone` included, so putting it back under any name fails. The notes' claim that "a component
that renders it fails `npm test`" was **false when written** and is withdrawn.

**The macOS menu is localized and no Rust file holds a label.** Tauri v2 builds the menu in Rust, so the
three submenus' 16 labels are translated on the frontend and handed across a sixth command,
`set_menu_labels`; `menu.rs` contains **zero user-facing string literals**, and a check that *lexes* the
file — rather than masking comment lines, which let `*/ let title = "Edit";` through — pins that. The
locale link is `LocaleState.subscribe`, not an `$effect`, because an effect is a no-op under vitest's
node environment and would have been untestable.

**`"permissions": []` survived the phase 1b-1 expected would need the first entry.** A capability governs
**plugin** commands; `set_menu_labels` is this application's own command, and `core:menu` is what a
renderer driving `@tauri-apps/api/menu` itself would need — granting it would let a compromised renderer
replace the application menu. `dispatch_check.rs` drives all **six** commands through the real dispatcher
with the shipped config, so this is measured rather than argued, and `core:default` stays gone.

**Two failure paths were invisible and both are now typed.** A version skew was refused *inside Tauri's
command macro*, producing English prose with no `code`, and `main.ts` dropped the promise — so an English
default menu could stay up forever with nothing reported. The command now takes an untyped envelope and
validates it itself, answering `invalidMenuLabels { missing, unexpected }`. Separately, `{ ok: true }` was
returned before `build_menu()`/`set_menu()` ran; `menu::on_main_thread` now waits on a one-shot channel and
answers `menuBuildFailed`. Waiting cannot deadlock, and the reason is read from the runtime source rather
than assumed: a main-thread post runs **inline** when the caller is already on the main thread.

**What is proven.** **544 Rust tests and 214 frontend tests pass** (from 514 and 104). Sixteen disabling
experiments are recorded verbatim across the two halves and the fix round, and the load-bearing ones break
the *engine* rather than a layer: adding a real `MatchBadge` variant to the core fired both new Rust tests
while all ten `wire_contract` tests passed, which is 1b-2a's hole 4 demonstrated rather than argued.

**Seven review findings, two of them High, all dispositioned** — see the disposition below. Eleven coverage
holes remain, each with the phase that owns it named, and the largest is the honest one: **nothing renders
any of these 111 strings yet**, and nothing establishes that any of the Spanish values is Spanish.

### Phase 1c-1 — the three-pane shell, and the first screen that shows a configuration

The first phase in this project whose deliverable is something a person looks at. `AppShell.svelte` no
longer holds a placeholder: it calls the read-only IPC boundary on mount and renders plan §8.1's three
panes over the result. The decision record is
[`docs/decisions/1c-1-notes.md`](docs/decisions/1c-1-notes.md).

**Four states before there are three of anything**, each localized: reading, read-and-empty, failed, and
ready. The failure arm has two headings and one message — `configDirNotFound` is separated from
everything else, because "espanso is not installed on this machine" is an ordinary state a first-run user
is in and "something went wrong" is not. Every failure sentence is `tIpcFailure`, so no code can reach the
screen without prose.

**Search reads one field, and that is the point.** The core precomputes `MatchView.search_text` from the
five fields plan §8.1 names; the frontend owns only the *matching rule* — case folding via
`toLocaleLowerCase`, and the decision that several words must all appear. Re-deriving the haystack in
TypeScript would make the plan's list two facts in two languages with nothing comparing them.
**The review found the core's own join was short**: it took `ContentSpec::primary()`, so a match holding
`replace` **and** `html` was unsearchable by its `html`. `collect_scalars` replaced it.

**Badges come from badge data.** `MatchView.badges`, rendered verbatim through `tMatchBadge`; nothing in
the frontend derives a badge from a value, and `shows no badge for a field the core did not badge` fires
if anything starts to.

**R32's first half is discharged, and this is the oldest debt in the project.** `open_workspace`,
`list_documents`, `get_document` and `get_match` all survive tree-shaking into `dist` — verified against
the built bundle, not argued. Five readings were taken from a **running window** against a synthetic
config: the populated screen in both languages, a count-of-one tooltip, the partial-total block, and the
no-configuration state; the detail pane was clicked and rendered in both languages. The readings were
**re-taken after the review fix round**, because that round edited two of the components and this project
has already reported a window that "launched and stayed up" while being blank. What the technique
establishes is **layout and text, not pixels** — colour, contrast and paint are unverified, and that
stays a stated hole.

**The review's two High findings were both real, and the first was the serious one.** The selection's
fingerprint compared `search_text`, the badge list and two shape codes — so `word`, `propagate_case`,
variables, form fields, unmodelled entries and every non-primary content field were **invisible to it**.
Two matches differing only in `word: true` / `word: false` fingerprinted identically, and re-resolution
answered `sameMatch` for the wrong snippet. That is the R27 class of defect exactly. It is closed by
**`MatchView.source_text`**, the match's own bytes, which is a fact about how the file is written and so
is D2u-safe. The second: recovery installed the re-resolved identity but never replaced the stale
`DocumentView`, so `selectedMatch` kept resolving the old node behind a fresh id.

**What is proven.** **354 frontend tests across 23 files** (from 318 and 21) and the Rust suite unchanged
in verdict, with `search_text`'s widening pinned in `model_projection.rs`. **Twenty-two disabling
experiments** across the phase and its fix round, each run, recorded and reverted; all fired. One did
**not** fire until its test was strengthened, and that is recorded in the notes rather than tidied away.

### Phase 1c-2a — the detail pane's match, and D2u seen on a screen

The third pane no longer holds a placeholder. `DetailPane.svelte` renders the selected match field by
field: plan §3.3's trigger, content, metadata and option fields, §3.4's nine variable types with their
parameters, §3.5's form fields, and the entries the projection did not model. The decision record is
[`docs/decisions/1c-2a-notes.md`](docs/decisions/1c-2a-notes.md).

**The logic is not in the component, and that is a structural decision rather than a style one.**
Nothing in this repository renders a Svelte component in an automated test, so anything deciding *what*
appears is logic no test can reach. `describeMatch()` and `flattenValue()` live in
[`src/lib/browser/detail.ts`](src/lib/browser/detail.ts) with a suite of their own; the component is
five snippets and one walk. The phase caught itself violating this once — a variable card filtering its
own rows in markup — and moved it.

**D2u was seen rather than asserted.** In a running window, `word: on` renders as the two characters
`on`, the 1.1-ambiguity chip sits on `on`, `true`, `false` and `0` and *not* on `capitalize` or `UTC`,
and a block scalar keeps its lines under the label "Written as a literal block". There is no checkbox
anywhere in the pane and no badge derived from any value.

**Absent is not empty, and both were on screen at once.** A present `comment:` with nothing after it
shows "written as empty text"; a match with no `comment:` key shows no Comment row at all. The one place
the wire cannot tell them apart is a sequence — `triggers: []` and no `triggers:` key both arrive as
`[]` — and that is recorded as a hole whose fix belongs in the core, not guessed at in TypeScript.

**The trigger and content sides are never collapsed.** A match holding both a `trigger` and a `regex`
draws both rows, which is what the 1c-1 review's High finding was about.

**The review found no High finding, and its two Mediums were both real.** The first is the one worth
remembering: the pane told the reader an unmodelled entry was "shown as written" **and did not show
it** — `UnknownEntry` carries `value_kind` and `value_span` but **no value text at all**, so the pane
could not have. Reworded in both languages to claim only what is true (the entry was *recorded and left
untouched* — a statement about the file, not about the screen), with `value_kind` now rendered and the
missing value written down as hole 13 and as Rust-side work for a later phase. The second: a sequence
item's bullet was modelled in `detail.ts` and rendered by nothing, so two `search_terms` whose first
item spanned two lines were indistinguishable from three items.

**D2w recurred, and was closed properly.** The field-coverage test built an input with every field, then
audited only what `describeMatch()` chose to emit and asserted the count was 24 — so a field added to
the union and never emitted would have passed. It is now an **equality** against `EVERY_DETAIL_FIELD`,
pinned to `DetailFieldName` in both directions by two `assertNever<Exclude<…>>()` calls, so the same
omission is a failing test and a new member is a compile error.

**What is proven.** **412 frontend tests across 24 files** (from 410 and 24 at 1c-1's close, itself 354),
the Rust suite unchanged in verdict, and **eighteen disabling experiments** — fourteen in the phase, four
in the fix round — each run, recorded and reverted. **Two deliberately did not fire**, and they retire a
claim it would have been easy to make: neither `svelte-check` nor `vite build` reports an unused CSS
selector, so a `depth-*` rule's presence in `dist` is *not* evidence that it is used.

---

### Phase 1c-2b-1 — the typed judgements, and the third time a written claim ran ahead of its data

The app now says things *about* a snippet and the file behind it. Thirty-two strings that had existed
since 1b-2b with **no caller at all** — ten `tHazard`, twenty-two `tDiagnostic` — reach a screen, and
the load-failure conflation 1c-1 named for 1c-2 is closed. The decision record is
[`docs/decisions/1c-2b-1-notes.md`](docs/decisions/1c-2b-1-notes.md). **No command and no wire field
were added**; every judgement here is read from data that was already on the wire and unread.

**Editability is a verdict plus a reason, and the permissive arm draws nothing.**
`matchEditability()` reads `safely_editable` (the verdict) and `blocking_hazard` (the reason) into
three arms. The pane draws the two refusals and **nothing at all** for the permission — Phase 1 is
read-only, so "this snippet can be edited safely" would be a promise the app cannot keep.

**The findings live in the middle pane, not the detail pane, and the reason is reachability.** A file
that fails to parse has no matches, so it can never be selected into the third pane; a diagnostic
rendered there would be unreachable in exactly the case it exists for.
[`src/lib/browser/findings.ts`](src/lib/browser/findings.ts) unions `DocumentView.hazards` with the
kinds named by `Hazard` diagnostics, filters those diagnostics out of the sentence list, and
deduplicates the rest.

**Could not is now distinguishable from have not.** `loadFailures` carries the `DocumentId` rather
than the path — path matching is unsound because `WirePath` renders unencodable bytes as U+FFFD — so
a refused file's row says "Could not be read" where a never-projected profile shows `–`, and a
refused file is no longer counted as *pending*.

**The review's High finding was this sub-phase's own failure mode, and it recurred twice more.** The
sub-phase existed to avoid claiming on screen what the app does not do, and shipped
`AdditionalDocumentNotProjected` saying a second YAML document "is shown but not interpreted" — while
nothing shows it and the viewer that would is in 1c-2b-2. The string-versus-data sweep that fix forced
then found a **second**: `notEditable` said the *snippet* contains the hazard, but
`disqualifying_hazard` ranges over node-less, same-node, ancestor **and** descendant hazards, so it now
says *this file contains*. A second review pass found the **third**: the notes asserted that profiles
contribute "no snippet-list row" and "stay out of `scopedMatches`" — both false at the time they were
written, because the fix that projected profiles had not guarded the list.

**Projecting profiles was a fix, and it introduced the regression above.** Profiles were skipped at
`open()` on the grounds that they hold no matches — true, and the wrong test: a profile has
*diagnostics*, and a profile with broken YAML was silent in every pane. They are projected now, and
`holdsMatches` governs *counting* only. The leak was that `scopedMatches()` consulted neither. It
consults it in both branches now, **on `kind` (where the file lives — espanso does not load snippets
from `config/`) rather than on `shape` (what its content looks like)**, which is exactly the
distinction a match-shaped profile turns on.

**A displayed index is one-based, and the conversion is a mapped type.** `document_index` is a
zero-based wire operand that was reaching the screen as "Document 0". The conversion happens at the
display boundary and emits under a *display* operand name, so a stale dictionary leaves a visible
`{document_index}` rather than a wrong number. Keyed on the operand spelling it would have let a future
`match_index` render zero-based in silence, so it is now `DIAGNOSTIC_DISPLAY_INDICES`, **a mapped type
over `DiagnosticCodeName` with a row per variant** — a new code without a row is a `svelte-check`
failure naming the variant.

**What is proven.** **479 frontend tests across 25 files** (from 412 at 1c-2a's close), the Rust suite
unchanged in verdict at 547, and **twenty-five disabling experiments** — twenty-two in the phase, three
in the two fix rounds — each run, recorded and reverted. **Three deliberately did not fire**, and the
third is the sharpest the project has recorded: `tHazard(` left in a comment while the markup renders
the raw identifier passes every test, which is the reviewer's own Low 3 scenario demonstrated rather
than asserted. Two window readings were taken across the phase and its fix rounds, in **both
languages**, and the second showed the profile fix on screen: the "All" list reading 7 of 7 against a
sidebar total of 7 where it had read nine rows before.

**One instrument lesson, recorded because it silently invalidated a reading.** `custom-protocol`
embeds `dist` into the binary, so **`cargo build` must follow every `npm run build`** — one reading was
taken against the previous bundle and looked entirely normal.

### Phase 1c-2b-2a — the boundary, and what a byte-fidelity API can actually promise

**`document_text` is a command now, and it never was one.** The claim carried in this file for two
sub-phases — that it was "the one command with no frontend caller, tree-shaken out of `dist`" — was
false: it was a `Workspace` method that `main.rs` had never registered. It is the **seventh** registered
command (six read-only plus `set_menu_labels`), wrapped as `documentText()` in `src/lib/ipc/commands.ts`,
and `dispatch_check.rs` proves seven reachable with `"permissions": []` by invoking each one, not by
arguing from the handler list.

**`UnknownEntry.value_text` closes the known lie-by-omission**, and it is the one wire-field addition of
the sub-phase. An unmodelled entry carried `value_kind` and `value_span` and no text, so the pane could
only say the entry was *recorded and left untouched*. The value's source text is now sliced **in Rust**
and carried, because a JavaScript string index is a UTF-16 code unit and a `ByteSpan` is not — the same
confusion the core's `CharToByte` adapter exists to prevent, prevented once more at the boundary.
**Nothing renders it yet**: `detail.ts` and `DetailPane.svelte` deliberately do not read it, so the
existing "the value is not on screen" strings stay true. Rendering it and changing those strings happen
together in 1c-2b-2b, or not at all.

**The fidelity claim is measured, not argued.** The whole synthetic corpus is copied into a workspace and
asked for over the **real IPC dispatcher**, each answer compared byte for byte with `std::fs::read` —
**33 fixtures, 37 406 bytes, identical**. CRLF, the UTF-8 BOM, a missing final newline, precomposed *and*
decomposed `é`, astral `😀`, block-scalar terminal spaces, NUL and U+2028 / U+2029 all survive. Every
Unicode assertion is written as a `\u{…}` escape, because a literal `é` in a test file can be normalised
by an editor, at which point the test would agree with a normalising boundary instead of catching it.

**What a `CommandResult<string>` can promise, stated narrowly after the review made it say so.** The
contract is **exact preservation of valid UTF-8, and a typed refusal otherwise** — not "the raw file
bytes". A file containing byte `0x80` reads fine with `std::fs::read` and then becomes
`WorkspaceError::NotUtf8 { path, offset }`; it does not panic and is never decoded lossily, but the raw
pane cannot show it at all. That is the sub-phase's most consequential inheritance: widening the wire to
carry arbitrary disk bytes later is a **format change Phases 2–5 would pay for**, and it is recorded as a
decision with its cost rather than discovered in Phase 3.

**Two limits are named rather than implied.** `mock_builder()` swaps out the platform webview, so every
measurement stops at Tauri's own response-body encoder and decoder and says **nothing** about WKWebView,
`postMessage`, or a lone surrogate — closing that needs a reading of a running window, which is 1c-2b-2b's
because it is the sub-phase that will have something on screen to read. And `value_text` is **uncapped**:
disjoint spans bound *duplication* to about one extra document, which is not a bound on *size*, so one
unknown block scalar spanning a very large file is owned by the cache, cloned by `get_document` and
encoded again, on the main thread.

**The review found six claims outrunning their evidence, and four were test names.** A test called
`an_unmodelled_entrys_value_crosses_as_its_own_bytes` never built an app; `a_remote_origin_is_refused`
said "any of the seven commands" and attempted three; `every_command_refuses_before_a_workspace_is_open`
never called `text`; and `capabilities/default.json` said the harness drives "all six commands". All are
closed **in production** — the remote-origin table is now asserted equal in both directions to the names
parsed out of `generate_handler!`, so a command added without an entry fails the test rather than sliding
past it.

**What is proven.** **559 Rust tests across 16 binaries**, 0 failed (547 at 1c-2b-1's close), the frontend
suite unchanged in verdict at **480 across 25 files**, and **fifteen disabling experiments** — ten in the
phase, five in the fix round — each run, recorded and reverted. One (field reordering) correctly fired
nothing, two fired less than they should have and are recorded as such, and one could not be constructed
at all: **this application publishes no per-command ACL manifest**, so no per-command remote break exists
to make; a vacuity check was run in its place and the impossibility is written down as hole 11 rather
than as coverage. **226 dictionary keys, unchanged** — the sub-phase adds no user-facing string, which is
the one thing that makes its "no hardcoded string" claim cheap to believe.

### Phase 2a-1 — the first code that modifies a user's file, and the promise it had to withdraw

**`crates/espansoconfig-core/src/persist/write.rs` is the only code in the crate that opens a file for
writing.** It implements plan §6.6 steps **1, 2 and 6–11** and nothing else: an app-level per-path write
lock, a base-revision re-check, a uniquely named temp file in the target's own directory, a mode-bit
copy, an fsync, an atomic rename, a directory sync, and a read-back-and-hash verification. It takes
**finished bytes** — it does not build them, parse them, validate them, or write a backup. Steps 3–5 and
12–13 are 2a-2's and 2a-3's. Nothing crosses the IPC boundary: no command, no wire type, no dictionary
key, no screen. `WriteError` deliberately does **not** derive `Serialize`, because a wire-visible enum
needs strings in both dictionaries and the save command that will need them does not exist yet.

**The sub-phase's defining sentence was wrong, and the review is what made it right.** It began as *it
replaces the bytes of an existing regular file, atomically and durably, only if the file still holds what
the caller believed it held.* No POSIX or macOS operation can deliver that "only if" against a
non-cooperating writer — the process-wide mutex excludes this app's own threads and nothing else, so vim,
espanso, Dropbox or iCloud Drive can replace the target between the hash and the rename and lose an edit
while the save reports success. **What is built is atomic replacement plus optimistic conflict
detection**, and every doc comment now says so. **D4 records it.**

**The window is narrowed rather than papered over.** `recheck_target()` runs immediately before the
rename — three lines above it — and re-resolves the caller's path, compares device and inode and type
against the object whose bytes were hashed, and re-hashes. A mismatch is `TargetChangedDuringWrite`, a
**refusal that has written nothing to the target**, with a four-arm `TargetDifference`
(`Retargeted` · `Vanished` · `Identity` · `Contents`). It is a separate variant from `RevisionMismatch`
on purpose: the `Identity` arm has an *equal* hash and a different meaning for the user. The residual
race is now **one rename wide**, and is stated as narrowed and not closed.

**`inspect_target()` does one `open` + `fstat` + `read` on a single descriptor**, with `O_NOFOLLOW`, so
the mode bits, the bytes and the `(dev, ino)` identity provably come from one inode. The flag's value is
spelled out per target family rather than pulled from `libc` — this crate still has **no new
dependency** — and a test pins its *meaning* by asserting `ELOOP`, so a wrong constant fails rather than
silently opening a weaker file.

**Two claims were weakened and one reviewer premise was rebutted from the toolchain source.** The
reviewer held that macOS `sync_all()` is plain `fsync`; reading the local `rust-src`
(`library/std/src/sys/fs/unix.rs`) shows `std` issues `fcntl(fd, F_FULLFSYNC)` on Apple targets, which
the 4 ms measurement corroborates. But `ENOTSUP` has no fallback and the **directory** sync measurably
does not do the same work (<0.1 ms), so every durability claim was weakened anyway and the directory sync
is called best effort in the code and in the notes. **The saved bytes are power-cut durable; the rename
that publishes them is not.**

**The guarantee is mode bits, not permissions**, and §4 of the notes enumerates the eight classes a
temp-file-and-rename drops that a truncate-in-place would have kept — owner and group, POSIX ACLs,
extended attributes including Finder tags, resource forks, creation time, BSD flags such as `uchg`, and
hard-link relationships. The consequence that is not cosmetic is called out: **dropping a denying ACL
broadens access.** Implementing any of it needs `libc`; it is recorded as a hole addressed to a later
phase rather than silently accepted.

**The review's sharpest half was the test audit, and it was right.** Four of the ten stated guarantees
were pinned by tests that would have passed against a weaker implementation. The byte-exact fixture
sweep seeded each temp copy with **the fixture's own bytes**, so a writer that did nothing at all passed
it; it now seeds a `PLACEHOLDER` that contradicts all five properties under test, and a companion test
asserts both that the fixtures really contain the hazards and that the placeholder really contradicts
them. The concurrency test had each writer *replace* the file, which passes with no mutex at all, since
any single winner leaves a complete file; it is replaced by
`concurrent_read_modify_write_never_loses_an_update`, where each writer **appends** a unique line under
read-then-write-with-retry so a lost update is a missing line — and it fails with the lock removed. The
`chflags uchg` test could print a skip and pass when `chflags` could not be run; that path is gone.

**What is proven.** **600 Rust tests across 17 binaries**, 0 failed (559 at 1c-2b-2a's close), of which
25 integration and 14 unit tests are new. Six disabling experiments in the phase and more in the fix
round, each run, recorded and reverted. **Two coverage holes are stated in the reviewer's own terms
rather than presented as covered**: no test would fail if either `sync_all` or the read-back
verification were removed, and no test involves a second process. The frontend was not touched and its
suite was not run — this sub-phase adds **no user-facing string and no dictionary key**, which is what
makes its CLAUDE.md §2 compliance cheap to believe.

### Phase 2c-1a — the draft spine, with no editor and no screen

**Three modules in `src/lib/browser/`, and not one line of Rust, Svelte or IPC registration.** The
same shape as 1b-1 (the i18n layer with no command) and 2b-2c-3a (the core mode with no caller):
the state everything later stands on, proven before anything stands on it. `cargo test --workspace`
is in the verification table **precisely because** this phase should not have moved it, and it did
not — 1007, unchanged.

**`draft.ts` — `Draft<T>`, generic over the drafted value**, because the raw editor drafts a
`string` and 2c-2 will draft a structured `MatchDraft`. It carries a base revision **and** a base
value, a current value, past and future steps, and **`isDirty` derived from the base** rather than
stored — editing back to the base value makes it clean again, and there is no flag to forget to
clear. A draft is constructed with **rules**, `{ same, snapshot }`, not merely an equality: every
value it records is a deep-frozen snapshot, which is what stops an in-place mutation of a nested
field moving the base, the history and the consent candidate all at once. Undo, redo, redo cleared
on branching, and a bounded hundred-step history are all here, because
`docs/decisions/2c-split-notes.md` §3 makes undo a property of the shape rather than a later
sub-phase.

**Consent is opaque, branded, and derived — never handed in.** `acknowledgeRefusal(draft,
submission, refusal)` is the only producer, and it checks the base revision, the candidate identity
and acknowledgeability before it will issue one. Editing or undoing invalidates it. This is the
protocol's own content-addressing rule (`FindingCode::DocumentDoesNotParse` carries the candidate's
revision) meeting the fact that undo changes the candidate — put in the state shape because that is
the only place it cannot be forgotten.

**`invalidation.ts` — the obligation that was represented in no type.** After a committed
whole-document replacement every `MatchId` in the file is stale and `moved` is `null` permanently,
and until this phase a caller that ignored that compiled (`2b-2c-3b-notes.md` §7.2). Now the
outcome arrives **sealed**: the sealed object is an empty frozen husk, its payload lives in a
module-private `WeakMap`, and `openWholeDocumentSave(sealed, forget)` is the only way to learn
anything at all — so a caller that does not discharge the invalidation does not have a save result.
The seal is **one-shot**, and the entry is deleted *before* the callback runs, so a `forget` that
re-enters cannot be served either. **A throwing `forget` never unwrites the file**: the throw is
classified and returned beside the committed outcome, because *a committed write is never
afterwards reported as an error* and a previous review had already found that invariant broken in
TypeScript once.

**`saveOutcome.ts` — all three arms, returning codes and never sentences.** `Saved` including
`committed: false` as a legal success and its `notes` disclosures; `Refused` with the
acknowledgeable subset and the **exact-multiset** re-submission, delegating the
`DocumentDoesNotParse` case to `rawSave.ts` rather than restating it; and `Conflict` as the
terminal, honest state of `2c-split-notes.md` §6, whose model **carries the actual `Draft<T>`** and
whose reload is a confirmed transition rather than a descriptive boolean. There is no `scope`
string for a caller to get wrong — `describeWholeDocumentSave` and `describeEditSave` are separate
producers, and the whole-document saved arm **types** `moved: null`. **No affordance is named or
coded "keep my draft"**, and that is a rule rather than an oversight: the phrase means 2c-4b's
rebase.

**Three of the eight review findings were High, and two of the eight were this file's sibling
document claiming a guarantee the code did not give** — that the seal was unreadable, and that a
dishonest conflict model was "not expressible". Both were false as written, both are corrected in
the same words rather than softened, and the honesty rule they produced is now the first rule of
every 2c fix round: **where TypeScript cannot force something, say so in the same sentence that
describes what it does force.**

### Phase 2c-1b — the raw editor, and the first screen that writes a user's file

**Five commands could write a user's file and no screen called any of them. Now one does.** The raw
YAML viewer of 1c-2b-2b-2 became an editor: `rawEditor.ts` holds the whole state machine as a value
and `RawEditor.svelte` is a thin walk over it, which is the standing idiom — `src/lib/browser/`
holds what a test can reach, the component gets the walk. **No Rust: `cargo test --workspace` is
1007, unchanged, and run to prove it.**

**It reuses 2c-1a wholesale rather than restating it.** The drafted value is a `Draft<T>` with
dirty, undo and redo derived; the three arms come from `describeWholeDocumentSave`; the
`DocumentDoesNotParse` refusal is presented by `rawSave.ts`; consent is produced only by
`acknowledgeRefusal` and withdrawn the instant the text changes, with a sentence saying why.

**Hole 4.2 of 2c-1a is decided: sealed.** `BrowserState.saveRawDocument` answers a
`SealedWholeDocumentSave`, because `describeWholeDocumentSave` accepts only what the seal produces
— the alternative was every call site re-asserting the document/result pairing, which is what the
seal exists to stop. What it did **not** buy is written down beside what it did: the seal's callback
is not the cache invalidation, which the workspace already performs, earlier and correctly.

**This project's first mounted-component test, and the jsdom decision `vite.config.ts` had held open
since 1b-1.** It is scoped, not retroactive: `environment: 'node'` stays the default, the component
files opt in by docblock, and the existing six components are **not** back-filled. A first attempt
at `resolve.conditions` silently broke the production build — that option *replaces* Vite's
defaults, so `vite build` went 154→180 modules and pulled in Svelte's server build. **154 modules is
now a regression guard**, checked on every round.

**The window reading is the reason this phase is honest, and it is why the rule exists.** Two real
defects survived 883 passing tests, `svelte-check` and two Codex passes, and were caught only by
looking at a running window:

1. **CRLF was silently normalized.** A `<textarea>`'s value is the HTML **API value**, which the
   specification defines as having every line break normalized to LF — so the first keystroke in a
   CRLF file rewrote every line ending, the save wrote it, and the panel said *"exactly the text
   that was sent"*. **That is this project's central promise broken on the one screen that writes.**
   `crlf-line-endings.yml` exists to pin exactly this, and **no test in the project contained a
   single `\r`.**
2. ***Copy my text* did not copy**, on the one control that exists to keep a draft from being lost
   before the person discards it.

**(1) was fixed as a refusal, not a reconstruction** (D13 of the notes). Reconstruct-on-save is
named and refused: `file-comments-and-mixed-endings.yml` has exactly **two** CRLF lines among
bare-LF ones, so re-applying a dominant convention would reformat lines the user never touched —
the same violation wearing a different hat. The cost is stated rather than hidden: **a CRLF file
now cannot be repaired in the one editor that can repair a broken file.**

**The refusal is structural.** The drafted value is a branded `RoundTripText` whose only constructor
applies the check, so a bare `string` no longer type-checks into a draft, a submission, a history
step or a candidate; all three doors mint one or refuse; and `beginSave` re-checks anyway, because a
brand is a cast at bottom and that is the last line before a wire that replaces a user's file.

**Three of the nine findings were a document claiming a guarantee the code did not give** — the
same class that produced two of 2c-1a's eight. The third occurrence was D13's own first version,
asserting that TypeScript forced what only a `<textarea>`'s behaviour happened to make true. D13 is
now written in three named categories: what the type system enforces, what the run-time guards
enforce, and **what merely happens to be true of the current component path** — that last written as
no guarantee at all.

---

