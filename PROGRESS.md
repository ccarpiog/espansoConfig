# PROGRESS — espansoConfig

**This file is the authoritative project state.** The conversation is not. A fresh session
should be able to resume from this file alone, without any conversation history.

Plan of record: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (§12 holds the phase plan).

---

## Status

| Phase | Scope | State |
|---|---|---|
| **0a** | Workspace scaffold · golden corpus · parser evaluation | ✅ complete |
| **0b-1** | Byte-accurate span layer: `CharToByte`, BOM/line endings, `SyntaxIndex`, span trimming | ✅ complete |
| **0b-2** | Gap scanner: trivia classification, comment ownership, safety gate | ✅ complete — **Phase 0b done**, after the review fix round below |
| **0c-1** | Scalar codec: decode/encode, `choose_scalar`, style preservation | ✅ complete — after the review fix round below |
| **0c-2a** | Structural path resolver: `DocumentPath`, `resolve`, `path_to` | ✅ complete — after the review fix round below |
| **0c-2b** | Span replacement, reparse-verify, the hazard gate at the mutation entry point | ✅ complete — after the review fix round below |
| **0c-3a** | Insert/remove a mapping field · the removal envelope · the block-collection extent (R3) | ✅ complete — after the review fix round below |
| **0c-3b-1** | The run-based envelope (R21 / D2o): an envelope is an ordered set of owned runs, not a hull | ✅ complete — after the review fix round below |
| **0c-3b-2** | Move a match · the stronger whole-document invariant · the round-trip property test · R16 | ⬜️ **next** — **this is the Phase 0 gate** |
| 1 | Read-only browser | ⬜️ blocked on the Phase 0 gate |
| 2–5 | See plan §12 | ⬜️ not started |

Phase 0 as written in the plan was split into **0a / 0b / 0c** because it was too large for one
coherent unit of work, and **0c** was split again into **0c-1 / 0c-2 / 0c-3** for the same reason:
0c-1 is value-level and mutates nothing, 0c-2 mutates one scalar, 0c-3 mutates structure.
**0c-2 was split once more into 0c-2a / 0c-2b**: addressing a node and mutating one are
independent problems, and the addressing half is what the mutating half's verification step
depends on, so it had to be correct and independently tested first. **0c-3 was split into 0c-3a /
0c-3b** along the cut its own "Next action" predicted: 0c-3a changes a mapping's *membership*, where
every byte the edit touches stays in place; 0c-3b *relocates* bytes, which is what breaks the
byte-identity invariant and forces a stronger one. **0c-3b was then split into 0c-3b-1 / 0c-3b-2**
along its own dependency order: a move carries an envelope, and while an envelope is a contiguous
hull it would carry the file's comments to the destination — worse than deleting them — so the
envelope had to become a set of runs before the move could be written at all. The
plan's stated exit criterion for Phase 0 — *the round-trip property test passes on the full
corpus* — is unchanged and lands at the end of **0c-3b-2**. The architectural gate is not cleared
until then; no UI work begins before it.

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

---

## Decisions (and why — this is what a fresh session cannot re-derive)

### D1 — the real espanso config is never committed

The GitHub repo `ccarpiog/espansoConfig` is **public**, and the owner's live config contains
personal email templates. The product owner chose: **real files stay out of git.**

- Committed fixtures are **synthetic only**, with neutral content.
- [`scripts/sync-real-corpus.sh`](scripts/sync-real-corpus.sh) copies the live config into
  `crates/espansoconfig-core/tests/corpus/real/`, which is **gitignored**
  (`.gitignore:107`).
- [`tests/real_corpus.rs`](crates/espansoconfig-core/tests/real_corpus.rs) **skips cleanly** when
  that directory is absent, so a fresh clone and any CI still pass.

This supersedes plan §11's "checked into the repo" wording for the real-file tier. Do not
re-litigate it, and **never** paste real config content into a committed file, a doc, or a
report.

### D2 — parser substrate is `saphyr-parser` 0.0.11 plus two adapters we own

`saphyr-parser` is the only one of the three candidates that reports where a node **ends**, and
span surgery is impossible without that.

**Corrected twice.** The first write-up claimed end offsets were "exact, every style"; the Phase 0a
review narrowed that to **flow** scalars — 727 in the synthetic corpus then, 877 today, and 980 in the
13 real files reproduce their source token byte for byte, **zero mismatches**, which is what the suite
asserts rather than the count — and **false for block scalars**.

**Phase 0c-2b narrowed it again, to *plain* scalars only.** The flow figure was a statement about
the corpus, not about the substrate. A **quoted** scalar's reported end is also the next token on
its line, so it swallows trailing spaces and a following comment: `a: 'x' # c` reports `'x' # c`,
and `a: ["x" , "y"]` reports `"x" `. A *plain* scalar's end really is exact (`a: x  # c` reports
`x`), which is why nothing noticed — **no corpus fixture puts a comment or a trailing space after a
quoted scalar**, so all 1 892 quoted scalars the two corpora held at the time happened to end their line at their
closing quote. See the 0c-2b disposition for how it was found and fixed.

A `|`/`>` span's end is the position of the next non-whitespace character, so it
swallows trailing blank lines and the next line's indentation: 30 of the 31 block scalars the
synthetic corpus held when this was measured overshot, and **85 of 87 in the real corpus** do. The
old test hid this by
asserting `ScalarStyle::Literal | ScalarStyle::Folded => true` while still counting those
scalars toward the headline figure.

The block-scalar end is still *usable*: it is reconstructible from the reported span, the
`Marker::col()` indentation and the header's chomping indicator, and every corpus block scalar
re-decodes byte-for-byte from those three inputs. The figures the suite pins today are **47 synthetic
block scalars, 44 of them overshooting**; the three that do not are the ones with no following token —
`block-scalar-header-tails.yml`'s `>2` at end of file, `block-scalar-terminal-spaces.yml`'s block that
ends the file, and `multi-document.yml`'s. The growth from 31 is fixtures added by later phases.

Rejected: `yaml-rust2` 0.11 (start `Marker` only, no end) and `marked-yaml` 0.8 (scalar `end()`
is always `None`; also drags in an older `yaml-rust2` 0.10 and rejects anchors outright).

The parser is **not** sufficient alone. Two adapters are ours:

1. **`CharToByte` table.** All three crates report offsets counted in **Unicode scalar values**
   (exactly Rust's `char`) — not bytes, not UTF-16 code units, not grapheme clusters, and despite
   saphyr's own getter documentation claiming bytes. `unicode-offsets.yml` separates all four
   schemes and the test asserts the three rivals are *wrong*. 29 of 33 spans in the non-ASCII
   fixture truncate if the value is trusted as a byte index. Silent-corruption trap, pinned.
2. **Gap scanner.** Comments, blank lines, block-scalar header text, chomping indicators and
   anchor names are exposed by *no* parser — but all of them fall in the gaps *between* reported
   spans. So the scanner is a **gap lexer, not a YAML lexer**: it never decides what a scalar is,
   because the parser already said. This confirms plan §6.2's anticipated outcome while making
   the scanner's job much smaller than feared.

### D2c — one content-start convention for every block scalar

Closed out from the Phase 0b-1 review
([`docs/reviews/phase-0b-1-span-layer.md`](docs/reviews/phase-0b-1-span-layer.md)),
whose top-ranked failure mode was that the span layer used **two** conventions: an
ordinary block started at the first content *character*, leaving that line's indentation
in the gap, while a block opening with empty lines started just past the header's break.
A uniform emitter cannot serve both and would under- or double-indent the first line,
changing YAML structure rather than a value.

**The content span now always begins immediately after the line break that terminates the
header line**, so it carries every body line's indentation, the first included. Decoding is
uniformly "strip `indent` columns from each line", replacement is uniformly "write whole,
`indent`-indented lines", and a block opening with blank lines needs no special case. The
rule is documented on `ScalarPresentation::content_span` and enforced across all three
shapes — ordinary, leading-blank, truncated header (R5) — by
`every_block_shape_uses_the_same_content_start_convention` in `tests/syntax_index.rs`.

Two consequences worth recording:

- A block scalar's reported *end* is no longer the only overshoot: the reported **start**
  is one line's indentation too late for every ordinary block, which
  `docs/parser-evaluation.md`'s "block-scalar start — exact, at the content indent column"
  overstated.
- Corpus-wide blank-line recovery from the gaps dropped from 667 to 636 over the original
  19 fixtures — exactly the 31 block scalars in them. Each one used to leave its first
  line's indentation in the preceding gap, where a per-gap line scan counted that fragment
  as a blank line it never was. The figure is real recovery now, not an artefact.

### D2b — the gap frontier is **trimmed leaf spans**

Measured, not assumed: saphyr's spans **do not nest**. Block collection markers are zero width,
flow ones cover exactly one bracket, document markers exactly `---`/`...`; no non-leaf span
encloses a leaf span anywhere in the corpus. So the review's predicted failure — a comment lost
inside a mapping span — does not occur, and complement-of-all-spans loses no comment today.

It is still the wrong definition. **The frontier is `Scalar` and `Alias` spans only, with every
block-scalar end trimmed to its true content end.** Reasons, both measured:

- Untrimmed, the frontier loses 36 blank lines corpus-wide (631 vs 667) inside block-scalar
  spans — trivia by YAML's own chomping rules.
- Leaf-only rather than all-spans because it stays correct if a future saphyr release gives
  collections real enclosing extents, which is exactly the change the review anticipated.

### D2d — trivia ownership: one deterministic answer per construct

Phase 0b-2 completes Phase 0b. The gaps are no longer opaque: `crate::syntax::trivia`
classifies every gap byte into a typed `TriviaItem`, and `crate::syntax::ownership` attributes
it. **Every byte of a document now belongs to exactly one frontier leaf or exactly one trivia
item** — the Phase 0b-1 reconstruction property, which any ordered disjoint frontier satisfied
trivially, is now a tiling property that cannot hold by accident.

The scanner stays a **gap lexer, not a YAML lexer** (D2). It re-lexes nothing Phase 0b-1 already
decided: block-scalar header spans come from `block::layout` and `---`/`...` spans from the
document nodes, because a second opinion could disagree with the one the trimmed spans were
derived from.

Two primitives decide every attribution, and they are deliberately asymmetric:

- **the deepest node ending at or before a position, on the same line** — what an inline comment
  trails and what a `:` terminates. Deepest, so `trigger: :a # why` attaches to the value rather
  than to the mapping and sequence item that end in the same place. **Zero-width nodes are
  excluded**: they own no bytes, and in `empty: # why` the substrate reports the empty value at
  the byte *before* the colon, so using it would put a trailing comment on the wrong side of the
  punctuation it trails.
- **the outermost node starting at or after a position**, then descended into its first child
  while that child still starts after the position — what a leading comment introduces and what a
  `-`, `?`, `&` or `!` decorates. Outermost-then-descend, because a block sequence's span starts
  at its first item's dash, so the raw answer is the sequence and the wanted answer is the item.

Each of the four plan §6.2 rules is individually observable through `CommentAttachment::rule`,
so each has its own test. The implementation is **not** a literal transcription of §6.2, and
two of the differences are deliberate extensions rather than oversights. Both are recorded here
because a reader comparing plan to code will otherwise find them and distrust one of the two:

- **Rule 3 says "mapping entry"; there is no mapping-entry node.** The index has separate
  `MappingKey` and `MappingValue` children, so an inline comment attaches to the nearest
  non-zero-width node instead — normally the value scalar, and the key when the value is empty
  or written on later lines. Two logically identical entries therefore get different owners
  depending on presentation. That is why the envelope queries below exist: a consumer that means
  "the whole entry" asks for the subtree and gets the whole entry regardless.
- **Rule 1 says "sequence item"; the code accepts any following node.** Any non-header,
  non-blank-separated leading block goes to whatever node follows it, a second top-level mapping
  key included. Restricting it to sequence items would leave those comments owned by nobody,
  which is worse: they would not travel when their key does.

**The rules can overlap, and a fixed precedence resolves them.** A header followed by a blank
line satisfies both rule 4 and rule 2; a header immediately above a root sequence item satisfies
both rule 4 and rule 1. Exactly one rule is ever emitted, decided by
**flow-interior → inline → file-header → blank-line-separated → leading block**, with a trailing
comment falling through to the file. The order is chosen so the safest answer wins every
overlap: the file keeps anything a reorder could otherwise carry away.

The ambiguous cases the 0b-1 review raised now have documented, pinned policies:

| Construct | Policy |
|---|---|
| `empty:` + inline comment (review §3) | Both the `:` and the comment belong to the **key**; the zero-width value is never an owner. No hazard. |
| Bare `- ` item | The `-` belongs to the **item the dash introduces** — the zero-width scalar when the item is empty. An inline comment on that line, having no node before it, attaches forwards to the same item. |
| Compact `- key: value` | The `-` belongs to the **item mapping**, never to its first key, so a reorder moves the dash with the item. |
| Explicit `? key` / `: value` (R7) | `?` owns the key it introduces, a line-leading `:` owns the value; the enclosing mapping raises `HazardKind::ExplicitKeyMapping`. |
| Comment inside a flow collection (R6) | It belongs to the **innermost enclosing flow collection**, which raises `HazardKind::CommentInFlowCollection` and is then refused **outright, whole-collection replacement included**. An earlier draft of this file called that replacement legal while `is_safely_editable` refused it; the gate is the answer of record, because it is the one that cannot lose a comment, and because the gate has no way to express "safe to replace, unsafe to reorder". |

**Direct ownership is a diagnostic; subtree ownership is the envelope.** Trivia is attributed to
the deepest node a rule can name, so a sequence item almost never owns the trivia that visually
belongs to it: the inline comment after its last value is owned by that *value*, the colon after
each key by that *key*. `items_owned_by` / `comments_owned_by` answer "what does this exact node
own", and building a move or delete envelope from them **strands the final inline comment on the
snippet below**. `items_owned_by_subtree` / `comments_owned_by_subtree` are the envelope queries
and the default for Phase 0c; `file_comments()` is what must stay put.

`HazardKind` is the "refuse rather than guess" channel, and it covers every construct plan §7
(rows 6–8, 13) and §13 say must not be edited visually: `CommentInFlowCollection`,
`ExplicitKeyMapping`, `TruncatedBlockScalarHeader` (R5), `UnclassifiedTrivia`,
`AnchorDefinition`, `AliasReference`, `MergeKey` (R8), `DuplicateMappingKey`, `ExplicitTag` and
`MultiDocumentStream`. `TriviaIndex::is_safely_editable` answers pessimistically — a hazard on
the node, on any ancestor or on any descendant disqualifies it, and a hazard with **no** node
(bytes we could not name, lying outside every node) disqualifies the **entire document** —
because refusing a safe edit costs one fallback to the raw YAML editor while accepting an unsafe
one costs the user their file.

**Measured, and pinned exactly for the synthetic corpus:** 3 072 trivia items, 250 comments,
108 blank lines in 104 runs, **18 hazards**, and **0 unclassified spans**. (2 687 / 197 / 94 / 90
when 0b-2 closed; every later delta is one added fixture's own shape, tabulated in that phase's notes
doc, and **the hazard count has never moved** — not one fixture added since raises one.) The hazard
figure was 1
before the 0b-2 review fix round, which was precisely the reviewer's evidence that the gate was
not pessimistic; the 18 are pinned *per family* as well as in aggregate — 3 `AnchorDefinition`,
5 `AliasReference`, 2 `MergeKey`, 2 `ExplicitTag` (all from `anchors-aliases-tags-merge.yml`),
2 `DuplicateMappingKey` (`duplicate-keys.yml`), 3 `MultiDocumentStream` (`multi-document.yml`)
and 1 `CommentInFlowCollection` (`flow-collections.yml`) — so two opposing drifts cannot cancel
inside the total. The 13 real files also produce **0 unclassified spans**; no count from private
data is hard-coded. A truncation sweep over 3 000+ prefixes of three fixtures tiles every prefix
that parses, with 0 unclassified spans.

**Reconstruction is not a semantic oracle, and is no longer the only assertion.** Tiling proves
contiguity and byte-for-byte rebuild, all of which a comment mislabelled as a tag survives
unharmed. Two further layers now sit on top: exact `(span, kind)` goldens for every documented
token spelling, verbatim tags included, and exact `(span, owner, rule)` goldens for ownership;
plus two corpus-wide oracles that re-derive every item's kind and every comment's owner
relationship from the source text independently of the scanner, over **both** corpora.

Two count conventions now coexist and both are pinned, deliberately:
`tests/syntax_index.rs` keeps its per-gap line scan (245 comments, 773 blank lines) as the 0b-1
tripwire on the block-scalar trim; `tests/trivia_scanner.rs` pins the scanner's token-accurate
figures (250 comments, 108 blank lines). The comment difference is five inline comments that share
a line with something else — two with structural punctuation (`matches: # …`), two added by
Phase 0c-2b with a block-scalar header (`replace: | # …`) and one added by Phase 0c-3a with an empty
entry (`label: # …`) — none of which a whole-line scan can
see. Every fixture added since is a cross-check on both conventions at once: it must move the two
counts by amounts that differ by exactly its own inline comments, which is 0 for
`file-comments-and-mixed-endings.yml`, for `run-based-removal-envelope.yml` and for
`run-based-removal-boundaries.yml`. The blank-line
difference is that the line scan counts every gap line that trims to nothing, including the break
that merely *terminates* a content line; the scanner calls that a `LineBreak` and reserves
`BlankLine` for a line that lies wholly inside a gap and holds nothing.

### D2e — the codec is honest or it refuses; it is never silently approximate

Phase 0c-1. The whole crate rests on "everything outside the intended span comes out
byte-identical", so a codec that *usually* reproduces its input is worthless: the failure is
invisible at the call site and lands in the user's file. `reencode_in_place` therefore has exactly
two outcomes — byte-identical, or a typed `NotReencodable` naming the presentation that cannot be
reproduced. The refusal variants are `FoldedStyle`, `FoldedFlowScalar`, `NonCanonicalEscaping`,
`NonCanonicalBlankLine`, `MixedLineBreaks`, `BareCarriageReturn`, `SynthesisedFinalBreak` and
`Undecodable`.

Decisions inside that contract, each pinned by a test:

- **`>` is decode-only.** Folding turns line breaks into spaces, so re-emitting a folded scalar
  means choosing where to fold, and every choice rewrites bytes the user did not edit. Editing a
  multi-line folded scalar rewrites it as `|`. **A single-line replacement falls through to plain
  or single-quoted instead** — the policy is not "folded always becomes literal", and the doc
  comment says so, because the first draft claimed the stronger thing and it was false.
- **A single-line value keeps an existing block scalar.** The user chose that presentation and a
  one-line `|` is idiomatic in espanso; collapsing it to plain would be exactly the unrequested
  reformatting this crate exists to avoid.
- **Prefer single quotes, and quote `,` `[` `]` `{` `}` `\` even in block context.** This is what
  makes a regex trigger come out single-quoted with its backslashes intact.
- **The plain-safety predicate is generous on purpose.** It rejects every YAML 1.1 boolean and
  null spelling (`y`, `n`, `on`, `off`, …), sexagesimals like `12:30`, timestamps, and anything
  that merely *starts* like a number. Espanso's stack is YAML 1.1-ish, and a bare `no` silently
  becoming `false` is the exact corruption this crate exists to prevent. Over-quoting costs two
  apostrophes; under-quoting costs the user their value.
- **`ScalarPlan` holds logical values, not pre-escaped text** — a deliberate deviation from the
  plan §6.3 code sketch, which escaped at construction. Escaping once, in `render_content()`,
  makes double-escaping structurally impossible.
- **`ScalarContext` carries `parent_indent` and a `ScalarRole`.** The indentation indicator is
  relative to the parent node, and a mapping **key** can never be a block scalar.

### D2f — an unrepresentable body column moves the body; it does not clamp the indicator

The Phase 0c-1 review's top finding. YAML's indentation indicator is a single digit `1..=9`, so a
block body more than nine columns past its parent cannot describe itself. The first implementation
clamped the indicator to `9` and still indented the body to the requested column — which does not
fail loudly, it **silently moves the surplus columns into the value**: `" x\n"` at relative indent
10 reparsed as `"  x\n"`.

The fix picks the body column and the indicator **together** (`representable_body_indent`), and
when an indicator is genuinely needed it puts the body at `parent + 9` rather than clamping. The
invariant `indent == parent_indent + indicator` is asserted over a 6×14 sweep.

This is a deliberate divergence from the reviewer, who offered "a different representation **or** a
typed refusal". Re-indentation is chosen because the value survives **byte for byte** and only its
column differs from what the caller asked for — making `choose_scalar` fallible for a case with an
exact lossless answer would push a refusal onto every caller for no gain. `LiteralBlockPlan::indent`
still reports the column actually used, so a caller that cares can see it. Note the same bug
existed independently in `preserved_block`, which copied the source's *relative* indicator digit
onto an *absolute* column; the wider test set is what exposed it.

### D2g — the block-scalar span layer was wrong about the final line, and was fixed, not waived

Also from the 0c-1 review. `block::content_len` decided whether a terminal run of spaces at
end-of-source was scalar content or the next token's indentation **without knowing the block's
indentation column**, so a whitespace-only *final* line was always dropped:
`key: |2-\n   \n   ` decoded to `" "` where the substrate said `" \n "`. The projection was
missing logical data, which is worse than a formatting difference — a value displayed from it and
then saved cannot write back what it never had.

`block::layout` and `content_len` now take the indentation column, threaded from the start
marker's column in `index.rs`, and apply the substrate's own rule: **a whitespace-only final line
at EOF is content exactly when it is wider than `indent`.** The round-trip test's
`known_shortfalls` waiver is **deleted** — a green suite must not depend on an exemption for real
data loss — and the old "known shortfall" test is inverted into one that asserts correct decoding,
plus eight neighbouring shapes.

No committed corpus count moved **at the time**, because no synthetic fixture has a whitespace-only
final line inside a block at EOF: the Phase 0b figures were untouched by this fix. They have since
moved, but only because Phase 0c-2b's fix round added a fixture — see that phase's disposition, not
this one.

### D2h — the destination parser is YAML 1.1, so saphyr agreeing is not sufficient

The round-trip oracle reparses with saphyr, which is YAML 1.2. Espanso's own stack is 1.1-ish, and
three character classes diverge:

- **U+2028 / U+2029** are line separators in YAML 1.1 but ordinary characters in 1.2, and Rust's
  `char::is_control()` is **false** for both (they are categories Zl/Zp). They were passing the
  plain predicate and being emitted raw. They now force double quotes and are emitted as the
  `\L` / `\P` escapes the decoder already understood — encoder and decoder are exact inverses.
- **Unicode noncharacters** (U+FDD0–U+FDEF and `U+xFFFE`/`U+xFFFF` in every plane) are also not
  `is_control()`. Measured first rather than assumed: saphyr accepts them raw *and* escaped, so
  escaping is lossless and was chosen over refusing. They are emitted as `\uNNNN`/`\UNNNNNNNN`.
- **A bare `\r`** inside a block body has no `LineEnding` variant to represent it, so re-encoding
  would rewrite it as LF. It is now refused (`BareCarriageReturn`) instead of silently normalised.

The general lesson, worth keeping for 0c-2: **an oracle that only asks the parser we build on
cannot prove compatibility with the parser that consumes the file.**

### D2i — the block header's indicator order is recorded, not normalised

YAML permits both `|2+` and `|+2`. `ScalarPresentation` recorded the indentation and chomping
meanings but not their **source order**, so a `|+2` header re-encoded to `|2+` and still returned
`Ok` — a byte difference with nothing lossy about it. `HeaderIndicatorOrder` now travels on
`BlockHeader`, `ScalarPresentation` and `LiteralBlockPlan`, and `render_header` reproduces the
order it was given. Recording beats refusing here: the file stays byte-identical, which is the
product's whole premise.

### D2j — the path is document-scoped, refuses ambiguity, and knows nothing about hazards

Phase 0c-2a. Five decisions, each pinned by a test:

- **Document-scoped, not stream-scoped.** A path carries a zero-based document index. Espanso
  loads only the first document, but a file may hold several, and a path that could not say which
  one it meant would silently address the wrong half of the file. The textual form spells a
  non-zero document `#N`; document 0 omits the prefix, except for the root path, which renders
  `#0` so that it is not the empty string.
- **A key segment matches the *decoded* value of the mapping key.** `replace:`, `'replace':` and
  `"replace":` are one segment, so a style change to a key cannot silently break every path
  through it. A key that is not a scalar at all — an alias, or a collection used as a key — never
  matches, and `path_to` refuses it with `NonScalarKey` rather than approximating it from source
  text. This is R13 seen from the resolver's side.
- **A duplicate key refuses in both directions**, and this is the resolver's *only* concession to
  semantics. A duplicate does not make a node unsafe to edit, it makes the path **meaningless**:
  `matches[0].replace` names two nodes in `duplicate-keys.yml`. Ambiguity propagates to
  descendants — the reported key is the duplicated ancestor's, not the descendant's — because
  otherwise `resolve(path_to(n)) == n` would hold only where duplicates happen not to occur.
- **The hazard gate is deliberately not consulted here.** The resolver answers "which node does
  this path name"; `is_safely_editable` answers "may it be edited". Keeping them apart is what
  lets the resolver stay a total function of the text while the gate stays free to be pessimistic.
  The reviewer's condition on this, adopted: **the mutation entry point in 0c-2b must own the gate
  check internally.** Making safety a caller convention would be unacceptable.
- **The textual form is exact, not legible.** A YAML key may hold a NUL or a line break, and
  `Display` emits it verbatim so `FromStr` returns it unchanged. Escaping inside the format was
  rejected: it would buy log-legibility by inserting an unescaping step into the middle of the
  round trip the type exists to guarantee. Callers that need a log-safe rendering use
  `str::escape_debug`.

Nodes inside **flow** collections are addressed exactly like block ones (`vars[0].name`). See R17
for what that costs 0c-2b.

### D2k — R17 is closed by guaranteeing flow-legal bytes, not by refusing flow interiors

Phase 0c-2b's headline decision. R17 was open because the hazard gate does **not** refuse a flow
collection — only `CommentInFlowCollection` exists — while a block scalar is illegal inside
`{…}`/`[…]`, so an edit that turned a short value into a multi-line one would emit invalid YAML.
R17 named two acceptable answers; **option (b) was chosen: thread flow context into rendering.**

`scalar_context()` marks the target `ScalarContextKind::Flow` whenever **any** enclosing collection
is bracket-delimited, and the Phase 0c-1 emitter already refuses to put a block *or* a plain scalar
into flow context (`choose_scalar`'s `!context.is_flow()` guard and
`ScalarContext::can_hold_a_block_scalar`). A multi-line value inside a flow collection therefore
becomes a **double-quoted scalar with `\n` escapes** — one physical line, brackets undisturbed.

Why not refuse:

- **Refusing costs a real espanso config something; this costs it nothing.** `triggers: [":a", ":b"]`
  and inline `vars: [{name: …, type: …}]` are idiomatic espanso, and `flow-collections.yml` alone
  holds 11 editable flow-interior scalars. Refusing would mean the visual editor cannot change a
  trigger list.
- **Refusing is not the cheaper implementation.** Detecting flow context is the same walk either
  way, so (a) is (b) minus the two lines that pass the context on. The safety (a) would buy is
  already provided by construction.
- **Byte fidelity is unaffected.** Only the scalar's own token changes; the commas, brackets and
  spacing around it lie outside every replaced span.

The one cost, documented on the entry point: a **plain** scalar inside a flow collection is requoted
on edit (`vars: [one, two]` → `vars: [one, 'three']`), because a plain scalar in flow context is
terminated by `,`, `]` and `}` and the emitter never writes one there. Two apostrophes inside the
edited token, nothing outside it. Pinned in **both** directions — the same multi-line value becomes
`"one\ntwo\n"` in flow context and a `|` block in block context — and a flow collection that *does*
carry a comment is still refused outright.

### D2l — a block scalar's trailing line breaks keep their layout; the indicator reinterprets them

A block scalar's trailing line breaks are shared property: the chomping indicator decides how many
of the breaks *physically present* after the last content line belong to the value, and the rest are
blank-line trivia the edit must leave alone. `breaks_to_emit()` therefore emits **exactly as many
trailing breaks as the replaced region already held**, so the document's line structure is unchanged
and only the header's indicator changes meaning:

| Source | New value | Result |
|---|---|---|
| `k: \|` + `  a` | `a` | `k: \|-` + `  a` — the terminating break stays put |
| `k: \|-` + `  a` | `a\n` | `k: \|` + `  a` — the break already there serves |
| `k: \|+` + `  a` + 2 blanks | `a\n` | `k: \|` + `  a` + 2 blanks — they become trivia |

Two adjustments, each forced rather than chosen:

- clip and strip need the last body line **terminated**, so when neither the region nor the source
  after it holds a break, one is written — except at end of file, where a strip block legitimately
  ends a file with no final newline (`no-trailing-newline.yml`).
- **keep chomping counts every physical break**, so it is the one indicator that cannot leave a
  trailing break as trivia. There the count is exact, and when the document already holds more
  breaks than the value wants the edit is **refused** (`TrailingNewlinesNotRepresentable`) rather
  than made to absorb blank lines silently.

### D2m — the gate is structural, and a presentation change is reported rather than refused

Two decisions about where safety lives.

**The gate cannot be bypassed, by construction rather than by convention.** The 0c-2a reviewer's
condition was that the mutation entry point must own the check internally (D2j). It is met by the
signature: `apply_scalar_edits` takes the source *text*, so a caller cannot hand it a `TriviaIndex`
that describes a different document, and `plan_one` asks `disqualifying_hazard` **before** it renders
anything. `resolve` is untouched and still knows nothing about hazards. One additive Phase 0b change
supports this: `TriviaIndex::disqualifying_hazard()` returns *which* hazard disqualifies a node and
`is_safely_editable` is now "that returned `None`", so the answer and the reason cannot drift apart
and the mutation layer can refuse by name.

**A spelling change is a `PresentationNote`, not an error.** `PROGRESS.md` previously instructed that
"a scalar that `reencode_in_place` refuses must not be silently rewritten". The operative word is
*silently*: a `>` block rewritten as `|`, a double-quoted scalar re-escaped canonically, or a plain
scalar requoted are all cases where the value is preserved exactly and only its presentation moves.
`PresentationNote` carries `from`, `to` and the `NotReencodable` reason to the caller, which
discharges plan §6.2's "never silently normalise" without blocking an edit that `preserve_scalar`
documents as intended behaviour. Refusing instead would make a folded scalar permanently
uneditable.

### D2n — the collection end marker is unusable, so the published span stays child-derived

Phase 0c-3a, closing **R3**. The substrate's own end marker for a block collection was measured over
both corpora before any rule was adopted: it **overshot in 223 of the 235 synthetic block collections
then in the corpus and in 228 of 240 real ones**, never undershoots, and lands at EOF, on an unrelated
node, or in the middle of trivia
(111 / 42 / 298). Unlike a block scalar's end — which D2 records as *reconstructible* from three known
inputs — a collection's is neither usable nor reconstructible. (The synthetic figure the suite pins
today is **246 of 273**, the difference being fixtures added since; the verdict is unchanged.)

So the published span **deliberately does not change**. Extending it to the measured end would move a
key's `:` and its inline comment into the mapping, breaking the D2d ownership the whole trivia layer
rests on. Instead `CollectionExtent::owned_end()` is a **second, fallible** derivation, cross-checked
against `TriviaIndex::subtree_extent` on every block collection of both corpora, with
`unaccountable_collection_extents()` as the counted observable pinned at zero and
`overshooting_block_collections()` as the R3 observable — the exact counterpart of
`trimmed_block_scalars()`, and restricted to the block styles for the same reason R20 gives.

`owned_end()` returns `Option<usize>`, `None` exactly when the derivation is `Unaccountable`, and the
field is private. That is the review's finding 4: a value known to be wrong must not be publishable as
an ordinary `usize` that a future consumer can read without confronting it. It is the same discipline
`quoted_span` got from 0c-2b's finding E5.

### D2o — the removal envelope is an ordered set of owned **runs**, because a hull is not a set

The Phase 0c-3a review's finding 1, and the phase's most important admission — **completed in
0c-3b-1**, which is where the second half of this entry begins. In 0c-3a a removal envelope was one
contiguous `ByteSpan`, so it necessarily covered everything between the entry's first and last byte —
including trivia that **no node in the entry owns**. The concrete case the reviewer built:

```yaml
a:
  x: 1
  # keep this file comment

  y: 2
b: 3
```

By D2d that comment is separated from `y` by a blank line, so it belongs to the **file** and must
survive any edit. Removing `a` deleted it, and all four layers certified the result: `subtree_extent`'s
hull already crossed it, `StructuralGuard` examined no trivia, the sibling digest compares decoded
nodes and holds no comments, and the external oracle had the same blind spot. This is the structural
form of 0c-2b's E1/E3 — a synthesized envelope, authorised by the very declaration that should have
been checked against it.

**A single contiguous span cannot express "remove the collection but keep this interior file comment."**
0c-3a's answer was to **refuse** such a removal (`EditError::RemovalWouldDeleteAFileComment`) rather than
perform it minus the comment, and to record the cost as **R21**: a removal that ought to be legal is
refused. One synthetic removal hit it; zero real ones did.

The refusal alone was explicitly judged insufficient, because it leaves the *class* invisible.
`VerificationFailure::FileCommentLost` derives the loss from `file_comments()` rather than from the
edit, and the test oracle compares file-owned comments before and after using a comment scan written
independently of `TriviaIndex`. All three layers were confirmed to catch it **independently**, by
disabling each in turn — and re-confirmed the same way in 0c-3b-1, whose notes doc §6 records the four
runs of that experiment and the exact message each layer produced.

**Phase 0c-3b-1 — the set.** The envelope is now the ordered, disjoint set of runs left when every whole
line a file-owned comment occupies, and every blank run touching one of those lines, is punched out of
the hull. `blank_runs()` is used rather than a textual "all spaces" test because it is a gap-only answer
and so can never preserve a fragment of a block scalar's body. The reviewer's example now yields
`  # keep this file comment\n\nb: 3\n`, pinned byte-exactly.

**The blank-run rule, both directions** — implicit and overstated until the 0c-3b-1 review's finding 1
made it explicit. *A blank run survives exactly when it touches the line of a file-owned comment the
removal preserves; every other blank run inside the hull goes with the entry.* The run **below** a kept
comment is ownership: rule 2 reads it, so deleting it re-attributes the comment. The run **above** is
adjacency — deleting it would leave the comment file-owned all the same — and survives because the unit
preserved is the neighbourhood `blank_runs()` groups with the comment's line, which the gap layer does
not arbitrate side by side. **The phrase "a blank line is the file's layout rather than the entry's
trivia" is withdrawn from this entry**: it would apply equally to a blank run touching no comment, and
such a run is deleted. What is declined, and why, is in `0c-3b-1-notes.md` §8.1 — an interior blank run
lies *inside* the span the user asked to remove, and preserving it would invent a leading blank line at
document start that the file never held.

Four things about that are worth keeping:

- **The invariant got stronger.** A hull covered the whole entry by construction; a set does not, and
  the empty set satisfies "touches nothing outside the entry" perfectly. `StructuralGuard::Removal`
  now asserts both directions, the second through
  `VerificationFailure::EnvelopeMissesTheEntry` over the entry's frontier leaves. Nothing was weakened
  to accommodate runs. **What the two halves prove is the entry's *nodes*** — every frontier leaf, no
  foreign node — and **not** its trivia, because both are stated over node spans. The claim that
  together they say "the run set is exactly the entry" is withdrawn (review, finding 1).
- **`RemovalWouldDeleteAFileComment` survives as an assertion, not a policy.** It is now checked against
  the *derived runs*, using `file_comments()` rather than the punch-out's arithmetic, and is argued
  unreachable and pinned at 0 — with experiment 1 of §6 showing it firing, which is more than R22's
  pinned zero can offer.
- **Punching the comments out is not sufficient, and neither this entry nor the review said so.** A
  comment left directly under a block scalar's content, **at that block's body column or deeper**,
  becomes content of the block. Refused by name, `EditError::RemovalWouldExtendABlockScalar`, with a
  fixture written for it because neither corpus held the shape — and a **second** fixture written when
  the review's finding 2 showed the refusal ignored columns and so refused a column-zero comment under
  a folded block, which cannot be absorbed at all (R23).
- **The sweep's own statement of the rule was not an oracle, and now is.** "Every gap holds a file-owned
  comment" could not see the ownership blank line being deleted, and rejected any change to the rule
  mechanically. It is a two-way partition against `preserved_by_the_rule` since the review's fix round,
  with the blindness demonstrated rather than asserted (`0c-3b-1-notes.md` §6, experiments 5 and 5b).

**What R21's closure was worth, measured:** one synthetic removal and zero real ones — exactly the cost
the refusal was measured to have. Its real value is that **there is no version of the move that is
correct on a hull**: a hull would carry the file's comment to the destination, which is worse than
deleting it.

### D2p — a line ending is copied from the most local evidence, never voted on

The review's finding 2, and a defect the fix round then found live in the **scalar** path too, which
the reviewer had not named. `LineEnding::detect` answers LF for a single-line document **by defaulting,
not by measuring**, and both edit paths were writing that document-wide answer. Two failures follow: a
file with no final newline gets an invented LF, and in a mixed document an insertion after a
CRLF-terminated sibling writes LF whenever LF is globally dominant.

The rule is now: **copy the break already in use where the bytes land** — the anchor's own terminated
line for an insertion, the scalar's own line terminator for a scalar edit — and when the document
supplies no break at all, **refuse by name** (`NoObservableLineEnding`) rather than guess. Choosing a
line ending the file never contained is precisely the silent reformatting this crate exists to prevent,
and a document-wide majority is a guess dressed as evidence.

The scalar half is worth recording separately from the insertion half because of **how it was found**:
the two fixtures written to prove the insertion fix walked straight into it, and it had been passing
every sweep for two phases. Fourth time in this project that the corpus, not the code, was the weak
link (R20), and the second time in two rounds that a fixture written for one defect uncovered another.

### D3b — incomplete input never panics

21 054 prefixes of the valid corpus plus 15 hand-written half-states: **0 panics**, 11 clean
errors with a char index + line + column, 4 accepted. Two accepted classes produce misleading
spans and need Phase 0b guards: a truncated block header (`replace: |`) reports a span that
*includes* the header — the only case where that happens — and implicit/empty nodes produce
zero-width spans.

### D3 — the BOM is stripped and recorded before the parser runs

No parser strips it, and a BOM preceding a comment makes the parse fail outright. `SourceDocument`
carries a `bom` flag so the byte is restored verbatim on write.

---

## Open risks and deviations

| # | Risk | Mitigation / state |
|---|---|---|
| R1 | `saphyr-parser` is **pre-1.0 (0.0.11)**; the API can break between patch releases | Confined to `crate::syntax` — no other module imports it. 31 pinned tests fail loudly on any behaviour change. Deliberately **not** vendored: vendoring creates ownership without removing upgrade risk. |
| R2 | If a future saphyr release "fixes" `index()` to genuinely return bytes, the `CharToByte` adapter silently becomes wrong | Desired failure mode already wired: `all_three_crates_report_character_offsets_not_byte_offsets` and `saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes` both fail immediately. |
| R3 | **Block-scalar** and block **collection** end offsets overshoot into trailing trivia | **Closed in 0c-3a (D2n).** The block-scalar half was trimmed in 0b. The collection half was *measured* before a rule was chosen — the end marker overshot 223 of the 235 synthetic block collections then in the corpus and 228 of 240 real ones (246 of 273 synthetic is what the suite pins today), never undershoots, and lands at EOF, on a node or mid-trivia (111/42/298), so it is neither usable nor reconstructible. The published span therefore stays child-derived on purpose, and `CollectionExtent::owned_end()` is a second, fallible derivation cross-checked against `TriviaIndex::subtree_extent` over both corpora, with 0 unaccountable extents. |
| R4 | Phase 0 gate is **not yet cleared** — the round-trip property test does not exist yet | Lands in 0c. No UI work until it passes. |
| R5 | An empty block scalar (`replace: \|` mid-keystroke) reports a span that **includes** its header — the one exception to "the header is outside the span" | Phase 0b: the backwards header lexer must refuse to run when the span itself starts with `\|` or `>`. Pinned by `a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header`. The content span now starts past the header *line*, never past the indicator alone, so rewriting it cannot splice a value onto the header line. |
| R6 | **Flow-collection comment ownership** is undefined: in `items: [one, # why` / `two]` the comment belongs to no obvious node | **Closed in 0b-2 (D2d).** The comment attaches to the innermost enclosing flow collection and raises `HazardKind::CommentInFlowCollection`; the collection is then refused **outright**, whole-collection replacement included. Pinned by `a_comment_inside_a_flow_collection_belongs_to_the_collection_and_flags_it`. |
| R7 | **Empty and implicit nodes** (`empty:`, bare `- `, `? key` / `: value`, compact `- key: value`) create zero-width or shared boundaries with no unique owner | **Closed in 0b-2 (D2d).** One documented, tested policy each — see the D2d table. The explicit `?`/`:` form additionally raises `HazardKind::ExplicitKeyMapping`; the other three are safely editable once their punctuation and comments are attributed. |
| R8 | **Merge keys and aliases** can defeat a path resolver that assumes key/value scalar pairs — `<<` arrives as an ordinary scalar key, aliases are not scalar values | **Closed in 0b-2's fix round.** Both are classified syntactically, never positionally: a merge key is a *plain* scalar in key position spelled exactly `<<` (a quoted `'<<'` is an ordinary string key and is deliberately not flagged), and an alias is `NodeKind::Alias`. Each raises its own hazard, so the enclosing mapping and the alias are refused rather than resolved. Pinned by `a_merge_key_is_recognised_syntactically_and_refuses_its_mapping` and `an_anchor_definition_and_its_alias_are_both_refused`. |
| R12 | **Refusal for anchors, aliases, tags, merge keys, duplicate keys and multi-document streams is broad, and was previously recorded here as *total*.** A file using any of them is largely, but not entirely, non-editable in the visual UI | Accepted, and it is the specified behaviour: plan §7 rows 7–8 say *detect and refuse*, and §13 defers visual editing of anchors, aliases, tags and merge keys out of v1. **"Total" was wrong, and 0c-2b measured it.** The gate refuses the flagged node, its ancestors and its descendants, so a **sibling** stays editable: `anchors-aliases-tags-merge.yml` refuses 12 addressable scalars and **applies 5** — `matches[2].trigger` is editable although the explicit-tag hazard sits on the `replace` beside it — and `duplicate-keys.yml` is 2 refused / 8 applied. Only a hazard on a **document** node reaches everything, which is why `multi-document.yml` really is total. The gate's behaviour is unchanged and safe; only this prose needed narrowing. Pinned by `the_hazard_gate_refuses_by_scope_and_not_by_file`. R12's other claim is confirmed: **2 004 of 2 004** attempted real-corpus edits applied, zero refusals, so the breadth costs this corpus nothing today. If a future corpus does trip it, the escape hatch is a *narrower* hazard scope, not a weaker gate. |
| R13 | **Duplicate-key detection compares decoded scalar values only.** A non-scalar key — an alias or a collection used as a mapping key — is skipped by the duplicate check | Accepted: every such key already raises `AliasReference` or sits inside a refused construct, so the mapping is refused anyway. Revisit only if a case appears where a non-scalar key exists without any other hazard. |
| R9 | The missing evaluation criterion is **replacement-envelope correctness**, not endpoint accuracy | Phase 0c. Mutate real documents and assert: the span matches the requested structural path despite duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys and empty values; the replacement reparses to the intended value and stays valid YAML; every byte outside the envelope is identical (CRLF/LF, BOM, missing final newline, trailing spaces, comments, block-scalar terminal newlines). This is the Phase 0 gate's round-trip property test. |
| R14 | **A Markdown table inside `replace: \|` rejected the whole document.** `locate_header` treated any block whose first body line opens with `\|` or `>` as a truncated R5 header | **Fixed in 0c-1.** The backwards lexer runs first and the forward R5 path is the fallback; a genuinely truncated header has nothing but its key on the preceding line, so backwards finds nothing and forwards still fires. Reviewer-approved. Pinned by `a_body_line_opening_with_a_block_indicator_is_not_a_truncated_header`. This was a latent **Phase 0b** bug that the codec work surfaced — a real espanso config with a Markdown table would have been entirely unopenable. |
| R15 | **`NonCanonicalEscaping` is deliberately over-broad**: it refuses every double-quoted source containing any backslash, including already-canonical `\\`, `\"`, `\n`, `\t` | Accepted for now, and safe — it only costs the ability to re-encode such a scalar byte-identically, never correctness. Carries a `TODO(0c-2)` in its doc comment. Narrow it only if 0c-2 finds real files where editing an escaped double-quoted value matters. |
| R16 | **The round-trip oracle parses with saphyr (YAML 1.2), but espanso consumes with a YAML 1.1-ish stack.** Agreement with saphyr does not prove the file means the same thing to espanso | Partly mitigated in 0c-1 (D2h): the three known divergent character classes are escaped or refused, and the plain predicate rejects every YAML 1.1 boolean/null/sexagesimal spelling. **Not** fully closed — there is still no second parser in the test suite. Revisit in 0c-3: the cheapest real mitigation is to reparse the round-trip corpus with a 1.1 implementation as a second oracle. |
| R17 | **A flow collection is not refused by the hazard gate.** `HazardKind` has only `CommentInFlowCollection`, so `matches: [{trigger: ":a", replace: old}]` both resolves *and* passes `is_safely_editable`. A block scalar is illegal inside `{…}`/`[…]`, so an edit that turns a short value into a multi-line one would emit invalid YAML | **Closed in 0c-2b (D2k)**, by the second of the two answers R17 named: flow context is threaded into rendering, so a multi-line value inside a flow collection becomes a double-quoted one-liner and a block scalar is never emitted there. Flow-interior edits are **not** refused, because refusing them would cost the visual editor the ability to change a trigger list. The one collateral effect is that a plain scalar in flow context is requoted on edit. Pinned in both directions; a flow collection carrying a comment is still refused outright. |
| R18 | **A node in key position cannot be verified by the path that found it.** Renaming the `replace` of `replace: old` makes the path `replace` resolve to `NoSuchKey` in the reparsed document, so the verify step fails on a *correct* edit | Accepted and bounded. A scalar edit targets `Resolved::value` only; `resolve_key` exists for the **spans** a structural edit needs (where an entry begins, so removing it takes its key too), not as an edit target. Documented on `resolve_key` itself. A key-rename operation needs its own protocol — verify against the **intended new** path, not the old one — and is 0c-3's problem if it is wanted at all. Editing an ordinary value that merely equals some other entry's key string is harmless. |
| R19 | **`TriviaIndex::scan` is quadratic** — `ownership.rs`'s primitives (`ending_before`, `starting_after`, `enclosing_flow`, `innermost_containing`) each scan **every node** and are called **once per trivia item**, so the cost is O(items × nodes). Measured: the largest real file (17.8 KB, 477 nodes) takes **2.6 ms to parse and 20 ms to scan** | Open, correctness-neutral, and **pre-existing since Phase 0b-2** — deliberately not changed in 0c-2b, which is a mutation phase, not an optimisation one. It has one testing consequence today: the safe entry point re-scans on every call by design, so the real-corpus sweep gives each scalar 4 of the 12 replacement values, rotated by node index, keeping every value exercised at a quarter of the cost; the synthetic corpus keeps the full cross product. **0c-3's gate test will be larger again**, so if its runtime bites, memoising the ownership primitives by position is the cheapest fix and is confined to `ownership.rs`. It also matters for the UI: 20 ms per keystroke-triggered rescan is not viable, so Phase 1 will need either memoisation or a cached index. |
| R20 | **A quoted scalar's reported end overshoots trailing spaces and a following comment**, exactly as a block scalar's does (R3) — the same class of latent silent-corruption bug, in a layer everything else rests on | **Fixed in 0c-2b, in the span layer rather than worked around in the edit engine.** `SyntaxIndex::quoted_span()` trims the reported end back to the closing delimiter, lexing forwards from the opening one (`''` and `\"` are data, not terminators; the scan crosses line breaks so multi-line quoted scalars trim correctly). Unlike `block_layout` it falls back to the reported span rather than rejecting the index, because a quoted scalar with no closing quote inside its own reported span cannot come from a document the substrate accepted, and making a file unopenable for an unreachable case is the R14 mistake. **The residual risk is the corpus, not the code:** this was invisible for three phases because no fixture exercised the shape. `trimmed_block_scalars()` is now restricted to the two block styles so the two overshoots can never again be folded into one figure — which is precisely how this one hid. **Standing instruction, and the 0c-3b-1 review added its second half:** a new hazard gets a *fixture*, not only a unit test — and **a new refusal gets a fixture on each side of its condition**, not one inside it. R23 was pinned as correct for a whole phase with only the refused shape in the corpus, and its over-breadth was invisible until a reviewer constructed the safe one. Six occurrences now. |
| R10 | A block scalar whose header cannot be located has **no correct span**: the reported one runs into trailing blank lines and the next node's indentation | The index is **rejected** with `InvariantViolation::BlockHeaderNotFound` rather than publishing the known-bad span. There is deliberately no fallback. From the Phase 0b-1 review, ranked failure mode 3. |
| R11 | **Terminal spaces or tabs at end-of-source** are scalar content, not the next token's indentation — there is no next token | `block::content_len` takes `at_end_of_source` and keeps a trailing run that sits on a content line. Pinned by `terminal_spaces_at_end_of_source_stay_inside_the_block_scalar` and the `block-scalar-terminal-spaces.yml` fixture. |
| R21 | **A removal envelope is a contiguous hull, so it cannot express "remove this entry but keep the file-owned comment inside it."** Such a removal was refused rather than performed | **Closed in 0c-3b-1 (D2o).** The envelope is now an ordered, disjoint set of **runs** — the hull with every file-owned comment's whole line, and the blank runs touching it, punched out — spliced as several replacements. The refusal became an *assertion* on the derived run set, argued unreachable and pinned at 0, and the three-layer visibility discipline was re-confirmed by disabling each layer in turn (`docs/decisions/0c-3b-1-notes.md` §6). The change made the invariant **stronger**: `VerificationFailure::EnvelopeMissesTheEntry` states what a hull made unstatable. Measured gain: **1** synthetic removal, **0** real ones — exactly the cost the refusal had — and the real value is that a move is impossible on a hull. Cost: one new refusal, `RemovalWouldExtendABlockScalar`, for the one shape a run set cannot express (a kept comment directly under a block scalar's content, **at or past that block's body column** — the column comparison came from this phase's own review, finding 2), 1 synthetic attempt and 0 real ones. **Re-confirmed after that review**, which changed layer 3: every experiment of §6 was re-run, and two more break the *engine* rather than a layer, which is what shows the sweep can disagree with it. |
| R23 | **A comment a removal *keeps* can be absorbed by a block scalar above it**, changing that block's decoded value although nothing about it was edited — the shape neither D2o nor the 0c-3a review named | Accepted and refused by name (`EditError::RemovalWouldExtendABlockScalar`), the twin of `RemovalWouldExtendAKeptBlock`. **Narrowed by the 0c-3b-1 review's finding 2, which found the first form over-broad.** It now fires on three clauses, not two: the removal has something to preserve, *and* some block scalar's content ends at or before the envelope's first run with nothing but blank lines in between, *and* **the first non-blank line the removal preserves sits at that block's own body column or deeper**. A shallower line ends the block instead of extending it, exactly as the removed entry's key already did, so the reviewer's `>` block above a column-zero comment is a legal removal and is pinned byte-exactly. The body column is `ScalarPresentation::indent`, **read off the span layer and never re-lexed** (D2/D2d); the earlier "only reconstructible" objection was about a block's *end*, not its body column. One case still refuses unconditionally: a block whose content span is **empty** (`replace: \|` with the next sibling under it, the R5 shape), where `indent` holds the header's column rather than any observed body's. Costs the synthetic corpus **1** attempt, in `run-based-removal-envelope.yml`, and the real corpus **0** — unchanged by the narrowing, which let one attempt through and turned none away. `run-based-removal-boundaries.yml` pins the safe side. |
| R22 | **`InconsistentEntryIndentation` is pinned at 0 and is argued to be *unreachable*, not merely unreached** — a coverage hole and a proof look identical in a count | Accepted, with the argument recorded in `docs/decisions/0c-3a-notes.md` §3: a valid block mapping cannot have its keys at two columns, and the two shapes that can are refused earlier by other variants. No fixture was invented to reach it, because an impossible fixture would prove nothing. This is the one refusal family whose pinned zero rests on an argument rather than on a construction — treat it as the weakest pin in the table, and revisit if a real file ever trips it. |

---

## Phase 0b-2 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0b-2-trivia-and-ownership.md`](docs/reviews/phase-0b-2-trivia-and-ownership.md).
Its verdict was that the layer was sound as gap tiling and attribution but **not** sound as the
advertised pessimistic safety gate or as a source of move/delete envelopes — "substantive
correctness issues, not polish". Phase 0b was held open and every finding fixed before it was
recorded complete.

| # | Finding | Disposition |
|---|---|---|
| G1 | Direct-owner queries strand a descendant-owned comment on move/delete | **Fixed.** `items_owned_by_subtree` / `comments_owned_by_subtree` added and made the documented default; the direct queries stay, relabelled as diagnostics. |
| G2 | The hazard set is far too narrow to be a pessimistic gate | **Fixed.** Six new `HazardKind` variants: `AnchorDefinition`, `AliasReference`, `MergeKey`, `DuplicateMappingKey`, `ExplicitTag`, `MultiDocumentStream`. Corpus hazards 1 → 18. |
| G3 | A hazard with `node: None` disabled nothing | **Fixed.** Any node-less hazard now refuses the whole document. |
| G4 | Docs said whole-flow replacement stayed legal; the gate refused it | **Fixed, in the gate's favour.** Docs corrected here, in `ownership.rs` and in the test's own prose. |
| G5 | Verbatim tags (`!<…>`) were mis-tokenised despite being documented | **Fixed.** A verbatim tag is lexed to its closing `>`; an unterminated one falls back to the shorthand scan. |
| G6 | Tests checked tiling, never classification or ownership | **Fixed.** Exact `(span, kind)` and `(span, owner, rule)` goldens, plus two corpus-wide oracles that re-derive both from the source independently of the scanner. |
| G7 | A header before the next document's `---` was filed under the previous document | **Fixed.** The file-header rule takes the document from its target node, not from the comment's offset. |
| G8 | `PROGRESS.md` overclaimed the §6.2 rules as implemented "verbatim" | **Fixed.** D2d now states both extensions and the precedence that resolves rule overlaps. |

Two of the reviewer's framings were adjusted rather than adopted verbatim, and both are
recorded above as new risks: the gate's refusal is **total** for anchor/alias/tag/merge/duplicate
/multi-document files rather than scoped (R12), and duplicate detection covers scalar keys only
(R13). Neither weakens the gate; both are cases where a narrower answer would have needed a
policy Phase 0c has not written yet.

## Phase 0c-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-1-scalar-codec.md`](docs/reviews/phase-0c-1-scalar-codec.md). Its verdict
was **"should not be accepted unchanged"** — two logical-value corruptions, two byte-identity
violations, and three compatibility gaps. Phase 0c-1 was held open until every one was fixed.

| # | Finding | Disposition |
|---|---|---|
| F1 | Relative indent > 9 clamped the indicator to `\|9` while still indenting the body deeper, moving the surplus columns **into the value** | **Fixed** — body column and indicator chosen together (D2f). Also fixed the same bug independently present in `preserved_block`. |
| F2 | A whitespace-only final line at EOF was dropped by `content_len`, so the projection lost logical data | **Fixed, not waived** (D2g). The indentation column is threaded into `block::layout`; the `known_shortfalls` test waiver is deleted. |
| F3 | U+2028 / U+2029 emitted raw — YAML 1.1 line separators that `char::is_control()` does not catch | **Fixed** — forced to double quotes and emitted as `\L` / `\P` (D2h). |
| F4 | A bare `\r` in a block body returned `Ok` and was rewritten as LF | **Fixed** — new `NotReencodable::BareCarriageReturn`. |
| F5 | `\|+2` re-encoded as `\|2+`, breaking byte identity with nothing lossy | **Fixed** — `HeaderIndicatorOrder` records the source order (D2i). |
| F6 | `is_conservatively_safe_plain_scalar("<<")` was true; no mapping-key role existed | **Fixed** — `ScalarRole` added; `<<` rejected from the plain-safe set unconditionally; a key can never be a block scalar. |
| F7 | Unicode noncharacters had no printability policy | **Fixed** — substrate behaviour measured first, then escaped rather than refused (D2h). |

Coverage gaps the reviewer named are also closed: block sites now cover indent deltas of 9, 10 and
20, a bare-CR body, both header orders, noncharacters, and mapping-key emission; and the corpus
refusal set is pinned **per scalar** (file + byte range + family, 17 entries) rather than per
family, so two scalars can no longer swap eligibility inside one family undetected.

One divergence from the reviewer, recorded in D2f: F1 is fixed by re-indenting rather than by a
typed refusal. Decisions A, B, D and E were approved as implemented.

## Phase 0c-2a review disposition

The review is
[`docs/reviews/phase-0c-2a-path-resolver.md`](docs/reviews/phase-0c-2a-path-resolver.md).
Verdict: **accept with fixes**. Unlike the three previous rounds it found **no counterexample to
either round-trip property and no reachable panic** — it verified `resolve(path_to(n)) == n` by
direct argument and `parse(display(p)) == p` for every Rust `String`, and confirmed
`Resolved::parent` correct. What it did find was one **false claim in the documentation** and a
set of contract-critical branches that were advertised and untested. All six are fixed.

| # | Finding | Disposition |
|---|---|---|
| P1 | The module doc claimed the gate refuses every flow collection a path resolves into. It does not — only `CommentInFlowCollection` exists | **Fixed, and promoted to a risk.** Doc corrected to say exactly which constructs the gate does refuse; the true flow behaviour pinned in both directions by a new test. Recorded as **R17**, which 0c-2b must close. |
| P2 | Editing a node in key position invalidates the path that found it, so the advertised verify cycle cannot check a key rename | **Fixed as documentation plus a constraint.** `resolve_key`'s doc now states that a scalar edit targets `Resolved::value` only and that a rename needs its own protocol. Recorded as **R18**. |
| P3 | `parse(display(p)) == p` and `parse`'s totality were universal claims backed by a hand-picked table | **Fixed.** Two seeded sweeps: 4 000 generated paths round-trip byte for byte, 20 000 generated strings parse with zero panics, over an alphabet holding controls, both YAML 1.1 line separators, the BOM and astral characters. |
| P4 | `AddressError::NonScalarKey` was unreachable from the corpus, so the pinned `0` documented a coverage hole rather than proving the branch; duplicate-key *descendants* and duplicates across scalar presentations were unpinned | **Fixed.** Three new tests: a collection used as an explicit key, a duplicated key with children (ambiguity must name the *ancestor*), and `a` / `'a'` / `"a"` as three spellings of one duplicated key. |
| P5 | `an_unknown_node_identifier_is_refused_not_panicked_on` never passed an unknown `NodeId` to `path_to` | **Fixed.** It now takes a high `NodeId` from a larger index and calls `path_to` on a smaller one, asserting `AddressError::UnknownNode`. |
| P6 | The textual form emits control characters verbatim, which is exact but poor for logs | **Fixed by describing it accurately**, which is the reviewer's first option. Escaping was rejected: it would put an unescaping step inside the round trip the type exists to guarantee. The doc now says the form is an exact serialization, not a log-safe rendering, and points at `str::escape_debug`. |

The reviewer's assessment of the pinned counts is recorded because it is fair and should temper
how much they are trusted: `addressable`, `mapping_keys` and `ambiguous` catch coarse
reachability regressions, the node total is mostly a corpus-shape lock, and **no count can
detect compensating category changes**. That is why the per-category split exists and why the
sweeps and the re-derivation oracle carry the real weight.

## Phase 0c-2b review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-2b-span-replacement.md`](docs/reviews/phase-0c-2b-span-replacement.md).
Verdict: **do-not-accept** — one demonstrated byte-fidelity defect, which is the exact failure this
crate exists to prevent. Phase 0c-2b was held open until all five findings were fixed. The review
cleared five categories explicitly, and that distinction is worth keeping: logical value corruption,
R17 flow legality, gate/API bypass, batching, and the BOM/no-final-newline/terminal-spaces/tabs/
non-ASCII set were each **examined and found clean**, not merely unexamined.

| # | Finding | Disposition |
|---|---|---|
| E1 | **High, demonstrated.** A block-to-flow change replaced one synthesized envelope `header_span.start .. content_span.end`. By D2c the content span starts *after* the header line's break, so the envelope swallowed bytes belonging to **neither** span: `k: \|\r\n  body\n` → `""` returned a bare LF, making a CRLF document mixed, and `k: \|   \n  body\n` silently lost the three spaces after the indicator | **Fixed.** The two spans are now replaced **separately**, so the bytes between them are never written. Same class as R3 and R20: the substrate's spans are not the envelope, and a synthesized one is a guess. |
| E2 | **Medium, demonstrated.** `CommentOnBlockHeader` and `LineNotFreeForBlockScalar` refused edits that have an exact lossless answer, and the notes doc's claim that a block-header comment "cannot" survive a style change was **false** | **Fixed.** Both variants **deleted**, not left as dead branches: with the split replacement, `k: \| # why` → `""` is just `k: '' # why`, and a multi-line value on an occupied line renders as a quoted flow scalar. The false claim is corrected. |
| E3 | **Medium.** Verification could not catch E1: it checked the candidate against the **declared** replacements, so an oversized *intended* span was authorised by the very declaration it should have been checked against | **Fixed.** `permitted_spans` derives the allowed spans from immutable syntax facts — a block scalar's `header_span` and `content_span`, and nothing between them — and any replacement outside them is `VerificationFailure::SpanNotPermitted`. What verification still cannot catch is recorded rather than glossed: a defect shared by both decoders, a YAML 1.1 disagreement the 1.2 substrate accepts (**R16**, open), and an addressing mistake made identically in planning and verification. |
| E4 | **Low.** The advertised per-fixture pinning did not exist — one aggregate tally, so two fixtures could exchange eligibility undetected — and the test's allowed-span helper shared the production policy, which is why it authorised E1 | **Fixed.** `SYNTHETIC_OUTCOMES` pins a complete **per-fixture** row and is asserted to cover the corpus exactly, so a new fixture must be given a row. The test's permitted-span derivation is now independent of the planner. |
| E5 | **Low, suspected.** `quoted_span` silently returned the known-bad overshooting span whenever a precondition failed. No reachable counterexample was found, and the forward lexer was confirmed correct on escaped backslashes, backslash parity, doubled-quote runs, multi-line quotes, flow values and keys | **Fixed as an observable, not a refusal.** `quoted_span` returns `Option` and every fallback is **counted** (`SyntaxIndex::unlexable_quoted_scalars`), pinned at zero across both corpora. Rejecting the index was considered and refused: making a real file unopenable for an unreachable case is the **R14** mistake. |

**The coverage hole was the defect.** The first draft pinned a `comment_on_block_header` count at 0
and noted that no fixture carried a comment on a block-scalar header line. That gap was not
harmless — it was precisely the shape whose bytes were being destroyed. The fix round added
[`block-scalar-header-tails.yml`](crates/espansoconfig-core/tests/corpus/synthetic/block-scalar-header-tails.yml),
which pairs a block scalar with a header-line comment, with three trailing spaces after a `|-`
indicator, and with a `>2` header carrying both an indicator and a comment. All **72** of its
attempted edits apply. This is the second time in two phases that the corpus, not the code, was the
weak link (R20), which is why R20 now carries an explicit instruction for 0c-3.

It is the **ninth** fixture whose whitespace *is* the test data, so `CLAUDE.md` §4 lists it and
`tests/corpus_integrity.rs` fails the build if an editor trims it. Every pinned count it moved is
tabulated in `docs/decisions/0c-2b-notes.md` §7, and each delta is exactly the fixture's own shape —
the sharpest cross-check being that the whole-line comment scan gained **6** while the token-accurate
scanner gained **8**, the difference being its two comments that share a header line, which is the
documented distinction between the two conventions (D2d).

## Phase 0c-3a review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-3a-structural-edits.md`](docs/reviews/phase-0c-3a-structural-edits.md).
Verdict: **do not accept** — "finding 1 is silent deletion of a byte ownership explicitly says must
remain, and present verification certifies the corrupted result." The phase was held open until all
five were fixed, as the four before it were.

The review also cleared a substantial set **explicitly**, and that distinction is worth keeping:
ordinary removal envelopes correctly use subtree rather than direct ownership; inline comments, leading
comments, file headers, blank runs either side, CRLF, empty values, block scalars, first/last entries
and compact sequence mappings are handled or refused as documented; indentation is learned from sibling
keys including in compact items and deep nesting; node-level verification detects a changed or deleted
kept sibling including nested collections; normal overlap cases classify correctly with no corrupt
interleaving; and the flow, compact-first-entry, last-entry and `RemovalWouldExtendAKeptBlock` refusals
are correctly scoped. Each of those was **examined and found clean**, not merely unexamined.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High, demonstrated.** Removing a collection-valued entry deletes file-owned comments, and every layer certifies the result | **Fixed at four layers** (D2o). `subtree_extent`'s doc claim that file comments are excluded was **false** and is corrected — it is a hull. `EditError::RemovalWouldDeleteAFileComment` refuses; `VerificationFailure::FileCommentLost` makes the class visible to verification, derived from ownership rather than from the edit; the external oracle compares file-owned comments before and after with its own scan. All three confirmed to catch it **independently**, by disabling each in turn. The run-based envelope the reviewer names as the real answer was scheduled into 0c-3b as **R21** with its cost measured, **and landed in 0c-3b-1**: the removal is now performed and the comment kept byte for byte. |
| 2 | **Medium, demonstrated.** Insertion defaults its line ending — and learns from the document's dominant style rather than the anchor | **Fixed** (D2p), **and the same defect fixed in the scalar path**, which the review did not name. The break is copied from the most local evidence; a document supplying none is refused by name rather than given LF. |
| 3 | **Medium, demonstrated.** `[remove a, remove a, remove a]` panics — `fold_expectations` ran before the overlap check and underflowed `usize` | **Fixed twice over**: disjointness is now checked **before** expectations are folded, *and* the fold's arithmetic is checked, so no ordering can panic. Backed by the specific case and a 600-batch seeded sweep. This restores the standing "a public entry point never panics on bad input" property (D3b). |
| 4 | **Medium, suspected.** The collection extent publishes a known-bad `owned_end` as an ordinary `usize` | **Fixed** (D2n). `owned_end()` returns `Option<usize>`, `None` exactly when the derivation is `Unaccountable`, field private. Counted observable still pinned at zero. |
| 5 | **Medium, demonstrated test-claim gap.** "Every refusal is independently re-derived" was false in four ways | **Fixed, all four**, and the false claim corrected rather than softened: `KeyAlreadyPresent` is now checked against a re-derived fact instead of counted blind; `NoSuchSibling` and `InconsistentEntryIndentation` are categories in the tally and the sweep; the removal oracle compares file-owned comments; and two fixtures add the missing shapes. |
| — | The reviewer's optional hardening of the zero-width decoder skip | **Adopted.** `compare_decoders` asserts every skipped node is plain, headerless and has substrate value `~`, so the skip cannot widen later to cover a genuine disagreement. |

**One defect this fix round found that the review did not**, and it is recorded because of how it was
found rather than for its size: the line-ending invention of finding 2 was **also live in the scalar
path**, and the two fixtures written to prove the *insertion* fix walked straight into it. It had been
passing every sweep for two phases. Fourth time the corpus rather than the code was the weak link
(R20), and the second consecutive round in which a fixture written for one defect uncovered another.

## Phase 0c-3b-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-3b-1-run-based-envelopes.md`](docs/reviews/phase-0c-3b-1-run-based-envelopes.md).
Two findings, and the phase was held open until both were closed. The full disposition, with the
measured effect of each fix on both corpora, is `docs/decisions/0c-3b-1-notes.md` §8.

The review also cleared a substantial set **explicitly**: run ordering and disjointness; folded `>`
absorption as a *class* (the defect was over-refusal, not under-refusal); reparenting a kept comment
under another mapping or sequence item; empty mapping values, single and batched; first and last document
position; flow collections; `---`/`...` adjacency, where the reviewer found no path by which an entry
hull crosses a document marker; the `RemovalWouldDeleteAFileComment` unreachability argument, accepted as
sound *and* as demonstrably live; line endings including mixed CRLF/LF sites; and batch interaction
across several runs of one envelope. Each was examined and found clean.

| # | Finding | Disposition |
|---|---|---|
| 1 | **Major.** An interior blank run of a removed entry is deleted, while the identical run adjacent to a kept comment survives — so the justification is inconsistent, the rule is implicit, the external oracle *requires* every gap to hold a file comment and therefore codifies the behaviour, and `StructuralGuard`'s two halves do not say the runs are "exactly the entry" | **Partly adopted.** The behaviour the reviewer asks for — preserving the interior blank run — is **declined**: that byte lies *inside* the span the user asked to remove, and preserving it invents a leading blank line at document start the file never held, which is the unrequested reformatting this crate exists to prevent (`0c-3b-1-notes.md` §8.1). The other three claims are **adopted and fixed**: the "layout the user chose" wording is withdrawn from the fixture, from `preserved_regions`, from the notes and from D2o; the rule is now explicit and **pinned in both directions**; the oracle's property 6 is rewritten as a two-way partition against `preserved_by_the_rule`, which names the bytes and the direction of a disagreement instead of rejecting any change to the rule mechanically; and the guard's two halves are restated as proving the entry's **nodes**, not its trivia. The oracle's old blindness is **demonstrated**, not argued: with the engine made to delete a kept comment's ownership blank line, the old property let **both corpus sweeps pass** (§6, experiments 5 and 5b). |
| 2 | **Minor.** `RemovalWouldExtendABlockScalar` (R23) is over-broad — `block_scalar_ending_above` compares no columns, so it refuses removals whose preserved comment is shallower than the block's body indent and therefore cannot become block content | **Adopted in full.** The refusal now compares the first non-blank preserved line's column against `ScalarPresentation::indent`, the body column the span layer already published — read, never re-lexed (D2/D2d). The reviewer's `>` case applies and is pinned byte-exactly in a unit test **and** on corpus data; the indented case is still refused for `>` as well as `\|`; a block with no observed body column (empty content span) is still refused unconditionally. **Two fixtures rather than a unit test** (R20): `run-based-removal-boundaries.yml` carries the safe folded case *and* the entry-owned-leading-comment-block-plus-interior-file-comment pairing the notes had admitted neither corpus held — closing that also let the sweep's own R23 derivation move from `entry_lines` to `entry_hull_lines`, removing a documented oracle/engine disagreement. |

**What this round measured.** Synthetic: 2 634 → **2 696** attempted structural edits, all 62 of them
the new fixture's own shape, with **`block_absorbs` unchanged at 1** — the narrowing let one attempt
through and turned none away. Real corpus: **unchanged in every figure** (1 856 / 928 / 419), and the
rewritten property 6 found **zero** disagreements across 264 synthetic and 419 real applied removals.

**The pattern this round adds to R20**, recorded because it is the sixth occurrence: a new refusal needs
a fixture on **each side** of its condition. R23 was pinned as correct for a whole phase with only the
refused shape in the corpus, and its over-breadth was invisible until a reviewer constructed the safe
one.

## Verification — Phase 0c-3a

All run at the repo root by the orchestrator, independently of the phase worker's own claims, all
exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **366 tests pass** (202 unit + 13 corpus integrity + 32 parser evaluation + 12 patch edit + 15 patch path + 11 patch structure + 4 real corpus + 15 scalar codec + 30 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — 366 pass; `patch_structure` drops from 17.8 s to 3.7 s and `patch_edit` from 21.1 s to 7.8 s, which is the real-corpus sweep skipping cleanly |
| `./scripts/build-byte-exact-fixtures.sh` | exit 0 — regenerating the fixtures leaves the seven previously tracked ones **byte-identical** (`git status` reports no modification), so the generator is faithful rather than merely present |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

The three regression tests that decide whether the fix round succeeded, all passing:
`removing_a_collection_that_holds_a_file_comment_is_refused_rather_than_applied` (renamed
`…_keeps_the_comment_byte_for_byte` in 0c-3b-1, where the refusal became a real edit),
`the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts` (the finding-1 class is visible
to the *oracle*, not merely refused by the planner), and
`a_malformed_batch_is_refused_by_name_and_never_panics`.

Test output prints counts, file names, byte offsets and synthetic values only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-3b-1

All run at the repo root, all exit 0. The real corpus **was present**, so the real-corpus sweeps ran
rather than skipping:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **383 tests pass** (213 unit + 14 corpus integrity + 32 parser evaluation + 12 patch edit + 15 patch path + 16 patch structure + 4 real corpus + 15 scalar codec + 30 span layer + 32 trivia scanner). It read 377 when the phase first closed; the review's fix round added 2 unit tests, 1 corpus-integrity byte guard and 3 corpus tests |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — 377 pass; `patch_structure` drops from 18.2 s to 4.0 s and `patch_edit` from 21.1 s to 8.2 s, which is the real-corpus sweep skipping cleanly. Not re-run in the review's fix round: the real corpus was present throughout and both real-corpus sweeps ran |
| `./scripts/build-byte-exact-fixtures.sh` | exit 0 — regenerating leaves every previously tracked fixture **byte-identical** (`git status` reports no modification) |
| `git check-ignore -v …/corpus/real/match/base.yml` | ignored via `.gitignore:107` ✅ |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

The tests that decide whether this phase succeeded, all passing:
`removing_a_collection_that_holds_a_file_comment_keeps_the_comment_byte_for_byte` (the D2o example,
asserted as exact bytes), `the_one_shape_a_run_based_envelope_still_refuses_is_the_block_scalar_above`
(R23, on corpus data), `a_kept_file_comment_keeps_the_blank_lines_on_both_sides_of_it`,
`every_run_of_a_multi_run_envelope_takes_part_in_the_batch_protocol` and
`the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts`, which is layer 3 of the
visibility discipline and had to stay live now that the planner no longer refuses.

The six the **review's fix round** turns on, also all passing:
`a_kept_comment_shallower_than_the_block_above_it_is_not_absorbed` and
`a_kept_comment_shallower_than_the_folded_block_above_it_applies_byte_for_byte` (finding 2, the
reviewer's own case, in a unit test and on corpus data),
`a_blank_run_survives_only_where_it_touches_a_kept_comment` (the blank-run rule, both directions),
`the_preservation_rule_oracle_reports_a_disagreement_in_both_directions` (the rewritten oracle, driven
against run sets no planner can produce),
`an_entry_owned_leading_comment_block_is_deleted_and_the_interior_file_one_is_kept` (the run-boundary
construct neither corpus held), and
`the_boundaries_fixture_keeps_its_column_zero_comments_and_its_leading_block` (the byte guard on the
twelfth fixture whose whitespace is the test data).

**The three visibility layers were re-demonstrated, not asserted — twice.** Each was disabled in turn and
the next one down caught the class on its own; the runs and the exact message each layer produced are
recorded in `docs/decisions/0c-3b-1-notes.md` §6. All of them were **re-run after the review's fix
round**, because layer 3 changed: experiments 1, 2 and 3 produce the same messages, 3b's catcher moved to
the rewritten property 6, and 3c is new because a third independent view now stands between property 7
and the before/after comment scan. Two further experiments break the **engine** rather than a layer, which
is what shows the oracle can disagree with something: experiment 5 catches an engine that deletes a kept
comment's ownership blank line, and experiment 5b shows the *old* property 6 passing that same engine on
both corpora.

Test output prints counts, file names, byte offsets and synthetic values only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-2b

All run at the repo root by the orchestrator, independently of the phase worker's own claims, all
exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **307 tests pass** (163 unit + 11 corpus integrity + 32 parser evaluation + 11 patch edit + 15 patch path + 4 real corpus + 14 scalar codec + 25 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — 307 pass; `patch_edit` drops from 20.3 s to 6.9 s, which is the real-corpus sweep skipping cleanly |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

Test output prints counts, file names, byte offsets and synthetic values only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-2a

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **256 tests pass** (126 unit + 10 corpus integrity + 31 parser evaluation + 15 patch path + 4 real corpus + 14 scalar codec + 24 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — the real-corpus tests skip cleanly |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

Test output prints counts, file names and synthetic path shapes only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-1

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **223 tests pass** (108 unit + 10 corpus integrity + 31 parser evaluation + 4 real corpus + 14 scalar codec + 24 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — the real-corpus tests skip cleanly |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

Test output prints counts and file counts only — no line of real-configuration content.

## Verification — Phase 0b-2

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **166 tests pass** (65 unit + 10 corpus integrity + 31 parser evaluation + 4 real corpus + 24 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — the four real-corpus tests skip cleanly |

No test prints a line of real-configuration content: file names, counts and byte offsets only.

## Verification — Phase 0a

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **62 tests pass** (20 unit + 7 corpus integrity + 31 parser evaluation + 4 real corpus) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `git check-ignore -v crates/espansoconfig-core/tests/corpus/real/match/sql.yml` | ignored via `.gitignore:107` ✅ |
| `git status --short --untracked-files=all` | **no real-config path present** ✅ |

Byte-exactness of the awkward fixtures, confirmed with `xxd`: CRLF file contains `0d0a`; BOM file
starts `efbb bf`; no-trailing-newline file ends `0x27` (`'`) with no `0a`; `unicode-offsets.yml`
contains `c3a9` (precomposed é), `65cc81` (**decomposed** é) and `f09f9880` (😀).
`git hash-object`, `--no-filters` and `-c core.autocrlf=true` all agree, proving the corpus
`.gitattributes` `-text` rule stops CRLF normalisation.

---

## Next action

**Start Phase 0c-3b-2 — move a match, the stronger whole-document verification invariant, and the full
round-trip property test. This is the Phase 0 architectural gate (R4), and no UI work begins until it
passes.**

Everything below is now in place and independently tested: 0b gives byte-exact spans, trivia
classification, comment ownership and the hazard gate; 0c-1 the scalar codec; 0c-2a the path that
survives a reparse; 0c-2b the mutation entry point and the splice-and-verify cycle; 0c-3a insert and
remove, the removal envelope, and a measured answer to the collection extent; **0c-3b-1 the run-based
envelope (R21 closed, D2o complete), which is what makes a move expressible at all.** 0c-3b-2 is the
only remaining operation that **relocates** bytes, which is exactly what breaks every invariant proven
so far — and it is why the gate lands here.

The exact scope of 0c-3b-2, in the order the dependencies run:

1. ~~**Run-based envelopes first, before the move.**~~ **Done in 0c-3b-1.** The envelope is an ordered,
   disjoint set of runs; the hull is gone; D2o's refusal is a real edit. Two things to inherit rather
   than rediscover: `StructuralGuard::Removal` now pins the run set from **both** sides
   (`EnvelopeCoversAnotherNode` and `EnvelopeMissesTheEntry`) and a move's envelope must do the same —
   noting that both halves are stated over **node** spans and see no trivia at all, which is what the
   0c-3b-1 review corrected; and a comment a removal *keeps* can be absorbed by a block scalar above it
   (**R23**), a hazard a move inherits in a worse form because it changes indentation as well as
   position — and R23's condition is now a **column comparison**, so a move that re-indents what it
   carries cannot reuse the refusal unchanged. Also inherit the **blank-run rule** (D2o): a blank run
   survives exactly when it touches a kept file-owned comment's line, which a move has to restate at the
   destination rather than at the source.
2. **Move a whole match** within a sequence, and between files if the plan asks for it. A move is a
   removal plus an insertion whose spans do not overlap, so it should fall out of `apply_edits` rather
   than needing a second engine. `OverlappingEdits` is already load-bearing (0c-3a finding 3); a move
   is the case that makes ordering matter most.
3. **The stronger invariant.** "Every byte outside the replaced spans is identical" survived 0c-3a only
   because insert and remove never relocate anything. A move does, so the natural replacement is a
   **multiset of bytes or of lines preserved under the move**, plus "every construct the edit did not
   name decodes to the same value as before" — which 0c-3a's sibling digest already provides in local
   form and which now has to become global. Design this deliberately; it is the heart of the gate, and
   0c-3a's experience is that the check which cannot see the destroyed byte is the one that lets it
   through.
4. **The full round-trip property test of R9**, over both corpora: mutate real documents and assert the
   span matches the requested structural path despite duplicate keys, nested sequence mappings, merge
   keys, aliases, explicit keys and empty values; the result reparses to the intended value and stays
   valid YAML; and every byte outside the envelope is identical — across CRLF/LF, BOM, missing final
   newline, trailing spaces, comments and block-scalar terminal newlines.
5. **Close R16, or state plainly that it stays open.** The verify step reparses with saphyr, which is
   YAML 1.2, while espanso consumes with a 1.1-ish stack. Cross-checking our decoder against the
   substrate's catches a disagreement between *our two* implementations and still proves nothing about
   espanso. The cheapest real mitigation named so far is to reparse the round-trip corpus with a 1.1
   implementation as a second oracle. **This is the last phase where deferring it is cheap**, because
   the gate is what the UI is allowed to trust.

What 0c-3b-2 inherits and must not undo:

- **The envelope is a set of runs, and both halves of `StructuralGuard::Removal` are load-bearing
  (D2o).** Do not collapse it back to a hull "for the move", and do not drop
  `EnvelopeMissesTheEntry`: it is the half that a hull made unstatable, and without it the empty run
  set passes every other check. `RemovalWouldDeleteAFileComment` is now an assertion on the derived
  runs, pinned at 0 — do not delete it as dead code; `docs/decisions/0c-3b-1-notes.md` §6 shows it
  firing.
- **Line endings are copied from local evidence, never voted on (D2p).** A move writes bytes at a
  destination whose line ending may differ from the source's. Copy the destination's, and refuse when
  there is no evidence — do not reuse the moved text's own breaks blindly.
- **The three-layer visibility discipline.** 0c-3a's finding 1 was caught by none of four checks. The
  fix made the class visible to the planner, to verification and to the test oracle *independently*,
  each confirmed by disabling the other two, and 0c-3b-1 re-confirmed all three the same way after
  changing the planner's answer — then re-ran every experiment again when its own review changed layer
  3. A move's envelope deserves the same treatment.
- **An oracle must be able to disagree, not merely to pass (0c-3b-1 review, finding 1).** The sweep's
  old property 6 restated the engine's rule as a requirement, so it could not see the engine
  *under*-preserving and would have rejected any deliberate change to the rule as a defect. The
  replacement states the rule once, in `preserved_by_the_rule`, and compares **both** directions naming
  bytes. When 0c-3b-2 writes the move's oracle, break the **engine** and check the oracle fires — not
  only break the oracle and check something else fires.
- **Move and delete envelopes** must include the trivia a node's whole **subtree** owns —
  `TriviaIndex::items_owned_by_subtree` and `comments_owned_by_subtree` are the source of truth
  for which dash, colon, anchor, tag and comment travel with a node, and `file_comments()` for
  what must stay put. The direct queries `items_owned_by` / `comments_owned_by` are diagnostics
  and **must not** be used to build an envelope: the trivia a reader attributes to a sequence
  item is mostly owned by its descendants, so a direct-ownership envelope strands the final
  inline comment on the snippet below.
- **Collection-end overshoot (R3) is closed, and the answer is "the marker is unusable" (D2n).** The
  published span stays child-derived *deliberately*; `CollectionExtent::owned_end()` is the second,
  fallible derivation. Do not "fix" this by extending the published span to the measured end — that
  moves a key's `:` and inline comment into the mapping and breaks D2d.
- **A scalar that `reencode_in_place` refuses must not be silently rewritten.** 0c-2b discharged
  this with `PresentationNote` rather than a refusal (D2m) — the reason travels to the caller and the
  edit proceeds. Structural edits must keep that property: the user is told what changed spelling.
- **Agreement with saphyr is not agreement with espanso (R16).** Do not let the single-parser oracle
  stand past the gate; see scope item 5.
- **The resolver knows nothing about hazards, and that is deliberate (D2j).** Do not "fix" it by
  making `resolve` consult the gate. 0c-2b put the check inside `plan_one`, before anything is
  rendered, and made it structural by having `apply_scalar_edits` take the source *text* — keep that
  shape for structural edits rather than adding a second, checkable-by-convention entry point.
- **`PatchedDocument` has no public constructor on purpose.** It is the type-level guarantee that
  candidate bytes cannot exist without having passed `verify()`. Do not add one, and do not add a
  public field.
- **The corpus is the weak link, not the code (R20), and this is now a six-time pattern.** Three
  phases missed the quoted-scalar overshoot; 0c-3a's review then found a file-comment shape no fixture
  held, and the fixtures written to fix *that* uncovered the scalar line-ending defect (D2p); 0c-3b-1
  then found that keeping a file comment can feed it to a block scalar above (R23), a shape neither
  corpus held either; and 0c-3b-1's **own** review found that the refusal written for R23 was
  over-broad, because the corpus held the shape *inside* its condition and nothing on the safe side.
  When 0c-3b-2 finds a construct the corpus does not cover, **add the fixture**; do not settle for a
  unit test alone; give every new refusal a fixture on **each side** of its condition; and never fold
  two distinct overshoots into one measured figure.
- **`TriviaIndex::scan` is quadratic (R19).** The gate test will be the largest sweep yet; if it is
  slow, memoise `ownership.rs`'s primitives rather than thinning the sweep.

---

## Key paths

| Path | Why it matters next |
|---|---|
| [`crates/espansoconfig-core/src/patch/edit.rs`](crates/espansoconfig-core/src/patch/edit.rs) | **Where 0c-3b-2 lands.** `apply_edits` is the one batch protocol for `ScalarEdit`, `FieldInsert` and `FieldRemoval`: plan against the original index, reject overlaps, splice highest-offset-first, reparse, verify. Also `EditError`, `VerificationFailure`, `StructuralGuard`, `PresentationNote`, `PatchedDocument`, and 0c-3b-1's run derivation (`preserved_regions`, `runs_between`, `block_scalar_the_kept_bytes_would_join`, `first_kept_column`, `absorbs_a_line_at`) |
| [`crates/espansoconfig-core/tests/patch_structure.rs`](crates/espansoconfig-core/tests/patch_structure.rs) | **Phase 0c-3a/0c-3b-1 acceptance**, and the sweep 0c-3b-2 extends: the per-fixture `SYNTHETIC_OUTCOMES` table, the independently re-derived refusals, `check_removal_runs`'s **eight** envelope properties, `preserved_by_the_rule` — the preservation rule written down once on the test side — the insertion oracle, and the before/after file-comment scan that finding 1 forced |
| [`docs/decisions/0c-3b-1-notes.md`](docs/decisions/0c-3b-1-notes.md) | Phase 0c-3b-1's decision record: how the run set is derived and what could contradict it (§2), the blank-run rule in both directions (§2.1), the narrowed block-scalar refusal (§3), the eight envelope properties and why the old property 6 was not an oracle (§4), what R21's closure and the narrowing measured (§5), every disabling experiment verbatim including the two that break the engine rather than a layer (§6), what 0c-3a's and this phase's own notes got wrong (§7), and **the review disposition (§8)** |
| [`crates/espansoconfig-core/src/syntax/collection.rs`](crates/espansoconfig-core/src/syntax/collection.rs) | The block-collection extent (D2n, closing R3): the textual derivation, `CollectionExtent::owned_end()` and the `Unaccountable` fallback |
| [`docs/decisions/0c-3a-notes.md`](docs/decisions/0c-3a-notes.md) | Phase 0c-3a's own decision record: what was measured about collection ends before any rule was chosen, the hull-versus-set argument (§2.1), the line-ending rule (§3.1–3.2), the verification invariant (§5), and every claim the review proved false |
| [`crates/espansoconfig-core/tests/patch_edit.rs`](crates/espansoconfig-core/tests/patch_edit.rs) | Phase 0c-2b acceptance: the corpus-wide edit sweep with independently re-derived refusals, the pinned per-fixture counts, the flow-legality pins (R17/D2k) and the hazard-scope pin (R12) |
| [`docs/decisions/0c-2b-notes.md`](docs/decisions/0c-2b-notes.md) | The phase's own decision record: the R17 rationale, every new error variant and why it exists, the three claims it found false, and the coverage holes it pinned at 0 rather than papered over |
| [`crates/espansoconfig-core/src/patch/path.rs`](crates/espansoconfig-core/src/patch/path.rs) | **0c-2a**: `DocumentPath`, `resolve`, `resolve_key`, `resolve_full`, `path_to`. What the edit engine calls to find its target and to re-find it after the reparse |
| [`crates/espansoconfig-core/tests/patch_path.rs`](crates/espansoconfig-core/tests/patch_path.rs) | Phase 0c-2a acceptance: the inverse-pair oracle, the two seeded sweeps, the pinned per-category counts, and the flow-collection gate pin (R17) |
| [`docs/parser-evaluation.md`](docs/parser-evaluation.md) | The Phase 0b build order, in the division-of-labour table |
| [`crates/espansoconfig-core/src/syntax/mod.rs`](crates/espansoconfig-core/src/syntax/mod.rs) | Where 0b is implemented |
| [`crates/espansoconfig-core/src/emit/choose.rs`](crates/espansoconfig-core/src/emit/choose.rs) | `choose_scalar`, `preserve_scalar`, `reencode_in_place`, `NotReencodable` — what 0c-2 calls to render a new value |
| [`crates/espansoconfig-core/src/emit/plan.rs`](crates/espansoconfig-core/src/emit/plan.rs) | `ScalarPlan`, `ScalarContext`, `ScalarRole`; `render_header`/`render_content` give the exact bytes for the header and content spans |
| [`crates/espansoconfig-core/src/emit/decode.rs`](crates/espansoconfig-core/src/emit/decode.rs) | `decode()` — the value a span currently holds |
| [`crates/espansoconfig-core/tests/scalar_codec.rs`](crates/espansoconfig-core/tests/scalar_codec.rs) | Phase 0c-1 acceptance: the substrate-agreement oracle, the corpus identity suite, the adversarial and seeded round-trips |
| [`crates/espansoconfig-core/src/syntax/trivia.rs`](crates/espansoconfig-core/src/syntax/trivia.rs) | The gap scanner: `TriviaKind`, `TriviaIndex`, `HazardKind`, and the envelope queries |
| [`crates/espansoconfig-core/src/syntax/ownership.rs`](crates/espansoconfig-core/src/syntax/ownership.rs) | The §6.2 ownership rules, the ambiguous-case policy table (D2d) and hazard collection |
| [`crates/espansoconfig-core/tests/trivia_scanner.rs`](crates/espansoconfig-core/tests/trivia_scanner.rs) | Phase 0b-2 acceptance: tiling, the four rules, the ambiguous cases, the hazard set, and the classification/ownership goldens |
| [`crates/espansoconfig-core/tests/parser_evaluation.rs`](crates/espansoconfig-core/tests/parser_evaluation.rs) | The 31 pinned parser tests — the upgrade tripwire |
| [`docs/reviews/phase-0a-parser-substrate.md`](docs/reviews/phase-0a-parser-substrate.md) | The adversarial review; R5–R9 come from it |
| [`docs/reviews/phase-0b-1-span-layer.md`](docs/reviews/phase-0b-1-span-layer.md) | The Phase 0b-1 review; D2c and R10–R11 come from it |
| [`docs/reviews/phase-0b-2-trivia-and-ownership.md`](docs/reviews/phase-0b-2-trivia-and-ownership.md) | The Phase 0b-2 review; G1–G8 and R12–R13 come from it |
| [`docs/reviews/phase-0c-1-scalar-codec.md`](docs/reviews/phase-0c-1-scalar-codec.md) | The Phase 0c-1 review; F1–F7, D2f–D2i and R14–R16 come from it |
| [`docs/reviews/phase-0c-2a-path-resolver.md`](docs/reviews/phase-0c-2a-path-resolver.md) | The Phase 0c-2a review; P1–P6, D2j and R17–R18 come from it |
| [`docs/reviews/phase-0c-2b-span-replacement.md`](docs/reviews/phase-0c-2b-span-replacement.md) | The Phase 0c-2b review; D2k–D2m and R19–R20 come from the phase, and this review's findings are dispositioned above |
| [`docs/reviews/phase-0c-3a-structural-edits.md`](docs/reviews/phase-0c-3a-structural-edits.md) | The Phase 0c-3a review; D2n–D2p and R21–R22 come from the phase and this review, dispositioned above. Its finding 1 is the hull-versus-set argument in its concrete form, and is what Phase 0c-3b-1 answered |
| [`docs/reviews/phase-0c-3b-1-run-based-envelopes.md`](docs/reviews/phase-0c-3b-1-run-based-envelopes.md) | The Phase 0c-3b-1 review, dispositioned above and in `0c-3b-1-notes.md` §8. Finding 1 is why the blank-run rule is explicit and why the sweep's property 6 is an oracle rather than a restatement; finding 2 is why R23 compares indentation columns |
| [`crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml`](crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml) | The Phase 0c-3b-1 fixture: the two shapes that tell a run set from a hull — a file-owned comment with blank lines on both sides, and one whose lines would join a block scalar above (R23) |
| [`crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-boundaries.yml`](crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-boundaries.yml) | The fixture that phase's **review** forced: the *safe* side of R23 (a folded block above a column-zero comment) and an entry-owned leading comment block paired with an interior file comment. Same node shape as the fixture above and different trivia, deliberately, so every trivia delta is attributable — and the **twelfth** entry in `CLAUDE.md` §4's table, because its comment *columns* are the test data |
| [`crates/espansoconfig-core/tests/corpus/synthetic/`](crates/espansoconfig-core/tests/corpus/synthetic/) | The committed corpus |
| [`scripts/sync-real-corpus.sh`](scripts/sync-real-corpus.sh) | Run once locally to enable the real-corpus tests |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) §6.2, §6.3, §11 | Fidelity model, scalar style rules, testing strategy |
| [`CLAUDE.md`](CLAUDE.md) | Project conventions, corpus privacy rule, build commands |

---

## Git state

_Updated at each phase boundary._

| Phase | Commit | Push | Tree |
|---|---|---|---|
| 0a | `10f3e70` | ✅ pushed to `origin/main` | clean |
| 0b-1 | `813f809` | ✅ pushed to `origin/main` | clean |
| 0b-2 | `9825d9e` | ✅ pushed to `origin/main` | clean |
| 0c-1 | `f8693cd` | ✅ pushed to `origin/main` | clean |
| 0c-2a | `f56d5dd` | ✅ pushed to `origin/main` | clean |
| 0c-2b | `4f92c03` | ✅ pushed to `origin/main` | clean |
| 0c-3a | `8989c16` | ✅ pushed to `origin/main` | clean |
| 0c-3b-1 | _uncommitted_ | — | **dirty on purpose** — the phase worker left the work in the tree for the orchestrator to verify and commit |

Two follow-ups landed after `4f92c03`, both documentation only: `3b76697` recorded the commit here,
and `2eb12cb` reconciled the Phase 0a–0c-2a corpus figures in this file with the fixture Phase 0c-2b
added, so no historical paragraph states a count the suite no longer pins.

`8989c16` is Phase 0c-3a **including its review fix round** — the phase was held open until all five
findings were closed, so there is no intermediate commit holding the demonstrated defect. It contains
the implementation, the three new fixtures, the review, the notes doc and this checkpoint. A fresh
session should start from `8989c16` or later.

Phase 0c-3b-1's work is in the tree at the time of writing and has **not** been committed: the run
derivation in `src/patch/edit.rs`, the `subtree_extent` doc correction in `src/syntax/trivia.rs`, the
new fixture `run-based-removal-envelope.yml`, the retabulated pins in six test files,
`docs/decisions/0c-3b-1-notes.md`, and this checkpoint. It has **not** had its once-per-phase
adversarial review yet.

Note: commit `123f5c0` ("Ignore the .claude directory and untrack its settings") landed
out-of-band between the plan commit and 0a. It untracks `.claude/settings.json` and ignores
`.claude/`. Benign and left in place.
