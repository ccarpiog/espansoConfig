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
| **0c-3b-2a** | Move a match · the stronger whole-document invariant · the move sweep | ✅ complete — after the review fix round below |
| **0c-3b-2b** | The round-trip property test over both corpora (R9) · R16 · the gate verdict | ✅ complete — after the review fix round below |
| **Phase 0** | **⛔️ architectural gate (R4)** | ✅ **PASSED**, with four named qualifications — see the verdict below |
| **1a** | The core-side read model: the semantic projection · the workspace and its per-revision cache | ✅ complete — after the review fix round below |
| **1b-1** | The Tauri v2 shell · the Svelte 5 + TypeScript + Vite scaffold · the i18n infrastructure in both languages | ✅ complete |
| **1b-2a** | The read-only IPC surface · the wire error type · the typed frontend boundary · R27 corrected | ✅ complete — after the review fix round below |
| **1b-2b** | The Rust-code→string dictionaries · the exhaustiveness check · the localized macOS menu | ✅ complete — after the review fix round below |
| **1c-1** | The three-pane shell and the data path: sidebar, snippet list, search, the selection | ✅ complete — after the review fix round below |
| **1c-2a** | The detail pane's match: plan §3.3's fields, §3.4's variables, §3.5's forms, D2u on a screen | ✅ complete — after the review fix round below |
| 1c-2b | The app's judgements: the hazards, the diagnostics, the raw YAML viewer, the load-failure marker | ⬜️ **next** — **Phase 1's exit lands here** |
| 2–5 | See plan §12 | ⬜️ not started |

**Phase 1 is split into 1a / 1b / 1c** for the reason every Phase 0 split had: one worker cannot hold
it coherently. The cut is by *medium*, not by feature — **1a is Rust with no UI at all**, and it is
what makes "every snippet renders correctly" a checkable claim before a single pixel exists; 1b is the
shell and the boundary, where nothing is yet rendered from real data; 1c is the browser itself. The
plan's stated exit for Phase 1 — *the owner can browse their entire real config and every snippet
renders correctly* — lands at the end of **1c**.

**1b was split once more into 1b-1 / 1b-2**, along the same cut every Phase 0 split used: a
dependency order, not a convenience. 1b-1 is *everything that must exist before a string can be
displayed at all* — the two scaffolds and the i18n layer — and it deliberately ships **no command**,
so a `t()` call is the only way any of its text reaches a screen and the CLAUDE.md §2 habit is
established while the surface is small enough to audit. 1b-2 is the **boundary**: the five read-only
commands over `crate::workspace`, and the dictionaries that turn Rust's codes into prose. The cut
matters because the two halves fail differently — a scaffold defect is loud and immediate, an IPC
defect is a data-format decision that later phases inherit.

**1c is split into 1c-1 / 1c-2**, cut by failure mode, which is the test every split in this project
has used. **1c-1 is the shell and the data path** — the layout, the sidebar, the snippet list, search
and the selection — and it fails **loudly**: wrong data, or nothing on screen at all. **1c-2 is the
detail pane** — plan §3.3's 22 fields, the hazards, the diagnostics and the raw YAML viewer — and it
fails **quietly**: a rendering that looks finished and states something the project has not earned.
Phase 1's stated exit lands at the end of **1c-2**.

**1c-2 was split once more into 1c-2a / 1c-2b**, by the same test. **1c-2a is the match itself** —
§3.3's fields, §3.4's nine variable types, §3.5's forms, the unmodelled entries and D2u's rule that a
scalar renders as source text — and it fails by **misrepresenting a snippet**. **1c-2b is what the app
says *about* that snippet and the file behind it** — the hazards, the diagnostics, the raw YAML viewer
and the load-failure marker — and it fails by **making a claim the project has not earned**. The cut
proved itself immediately: 1c-2a's own review found the pane telling the reader that an unmodelled
entry was "shown as written" while showing only its key, which is exactly 1c-2b's failure mode
appearing inside 1c-2a. Phase 1's stated exit now lands at the end of **1c-2b**.

**1b-2 was split into 1b-2a / 1b-2b** along the same cut: 1b-2a is the **boundary** — the five
read-only commands, the wire error type and the typed frontend mirror — and 1b-2b is the **prose**,
the code→string dictionaries and the localized menu that need a boundary to exist before they have
anything to translate. The two fail differently, which is the test every split in this project has
used: a boundary defect is a data-format decision later phases inherit, a dictionary defect is a
missing string.

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
envelope had to become a set of runs before the move could be written at all. **0c-3b-2 was split in
turn into 0c-3b-2a / 0c-3b-2b**, because building the operation that relocates bytes and proving the
whole corpus round-trips are different problems: 0c-3b-2a writes the move and the invariant a
relocation forces, and 0c-3b-2b is the gate itself, which needs that invariant to already exist. The
plan's stated exit criterion for Phase 0 — *the round-trip property test passes on the full
corpus* — is unchanged and lands at the end of **0c-3b-2b**. The architectural gate is not cleared
until then; no UI work begins before it.

**Cross-file move is deliberately not in Phase 0.** Plan §12 scopes the gate to "move whole matches";
drag between files is §8.4, which restricts it to self-contained matches and is a UI-phase concern with
its own dependency analysis. `ItemMove` moves within one document only, and 0c-3b-2a's proofs are
scoped to that (see D2r).

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

**0c-3b-2a extended D2p to the move, and its review had to enforce it against the first attempt.** A move
carries its own line breaks verbatim, so nothing is copied and nothing is voted on. The one case that
needs a break it does not have is a destination at the **end of an unterminated file**: the first
implementation *rotated* the moved item's own trailing break from behind the carried bytes to in front of
them. Byte conservation was exact and all the whole-document properties certified it — but the
previously-unterminated destination line thereby acquired a terminator it never had, possibly a CRLF
imposed on an LF file, and **global conservation cannot see which unedited line owned a break**. The notes
argued this satisfied D2p *a fortiori*; that argument was wrong and is withdrawn. The case is now
**refused by name**, `MoveWouldTerminateTheFinalLine`, at a measured cost of 3 synthetic moves and 0 real
ones. `NoObservableLineEnding` is unreachable from a move: a sequence with two items holds at least one
break, and a sequence with one item offers no move.

### D2q — a relocation needs five properties, and byte identity is not one of them

Phase 0c-3b-2a. Every invariant proven up to 0c-3a rested on *nothing moved*: insert and remove change a
mapping's membership, but every byte they do not delete stays at its offset. A move breaks that, so
"every byte outside the replaced spans is identical" stops being **sufficient** — it is still asserted,
but it now only says the splice did what it declared, not that the declaration was right.

The replacement, all five inside `verify()` and each a typed failure:

1. **`document_lines_are_conserved`** — the candidate's lines are the source's, as **paired** multisets of
   content and terminator.
2. **`items_are_in_the_intended_order`** — the sequence is the original permuted exactly as requested.
3. **`constructs_outside_the_move_are_unchanged`** — a lockstep tree walk: everything the edit did not
   name decodes to what it decoded before. This is 0c-3a's sibling digest promoted from local to global.
4. **`the_arrival_is_the_departure`** — the inserted bytes are **exactly** the removed bytes.
5. **`comment_ownership_survives`** — no comment changes owner.

**Why 4 and 5 exist is the important half, and it came from the review.** Properties 1–3 were the phase's
original answer, and they can **jointly certify a corrupted document**. Multiset conservation is
permutation-invariant *by construction*; the digests omit comments; the tree walk sees decoded values and
is blind to presentation. So a planner that swapped two carried comment lines, exchanged LF and CRLF among
carried lines, shuffled a blank line between two strip-chomped blocks, or deleted a comment's ownership
blank line while relocating that line elsewhere, passed all three — and
`bytes_outside_the_replacements_match` authorises the insertion text **the planner itself supplied**.

Property 4's expected bytes are therefore read out of the **original document**, at runs bounded
independently of the planner: by `StructuralGuard::Removal` from both sides, and by the item's own
physical lines derived textually from the source. The insertion string is never an input to what it is
compared against, or the check would be a restatement. Property 5 exists because **no byte comparison can
see re-attribution** — the bytes are all present and all identical; only their ownership moved.

The general lesson, and it is the one this phase cost the most to learn: **a safety property that lives
only in the test suite is not a safety property.** `PatchedDocument` has no public constructor precisely
so candidate bytes cannot exist without having passed `verify()`; a check kept outside `verify()` makes
that guarantee decorative. The test-side copy is **kept** as a second, independent derivation.

### D2r — "no re-indentation" is a fact about one operation, not about moves

Measured, and it corrects a prediction this file made. `ItemMove` moves an item between positions of the
**same block sequence**, and the valid items of one block sequence necessarily share their structural
indentation — so the carried bytes need no adjustment, and deliberately unusual comment indentation
inside the item is preserved rather than normalised.

The scope of that claim is exactly the implemented operation. **Moving between differently indented or
nested sequences is not expressible by `ItemMove`, and the future operation that does it must re-indent
or refuse — it cannot reuse these proofs unchanged.** R23's column comparison would then genuinely need
the rework 0c-3b-1 predicted; today it does not, because nothing moves across an indentation boundary.

### D2s — R16 is answered by our own tag table, not by a second parser

Phase 0c-3b-2b, decided by consultation with a second model and recorded in
[`docs/reviews/phase-0c-3b-2b-r16-consultation.md`](docs/reviews/phase-0c-3b-2b-r16-consultation.md).
**Do not re-open it by adding a YAML crate.**

**Why not a second parser.** A syntax-level reparse is close to theatre here: bytes outside an edit are
already proven identical, and every scalar the emitter *writes* is conservatively quoted. The real danger
class is **implicit type resolution** — in YAML 1.1 the plain scalars `y`, `n`, `on`, `off` are booleans,
`012` is octal and `12:30` is a sexagesimal, while YAML 1.2 core calls them strings. And **no maintained
crate faithfully implements 1.1 resolution**: libyaml's event parser provides no application-level
resolver, `yaml-rust` 0.4 is unmaintained with an unreliable one, `yaml-rust2` and `saphyr` target 1.2,
and `serde_yaml` is `0.9.34+deprecated` (verified against the registry). Adopting one would be
reassurance, not evidence — **a wrong second oracle is worse than an honest single one.**

**What was built instead.** A hand-written table of the 1.1 productions and the 1.2-core ones, in the
library so the **emitter** consults it, and asserted in `verify()`.

**The property is differential, and that is the design point.** It does **not** require the corpus to hold
zero ambiguous plain scalars — real espanso files legitimately contain `on` and `off`, and a test
demanding their absence would be wrong and would have to be deleted the first time it met a real config.
Instead: pre-existing ambiguity is **reported as data** (31 synthetic, 65 real plain scalars are non-`str`
under 1.1), and an edit that **introduces** a new ambiguous plain scalar or **changes** an existing
classification **fails** with `VerificationFailure::AmbiguousPlainScalarIntroduced`.

**The table is hand-maintained, and the first attempt to prove it was circular.** The generated sweep
compared `plain_scalar_is_ambiguous` against a predicate that itself called `plain_scalar_is_ambiguous`,
so "3 M values, 0 gaps" only measured that the emitter is a conservative superset of **its own table**.
The review caught that. There is now a **second, independently written transcription** of the 1.1 half,
swept differentially over 500 000 generated values (43 773 non-string resolutions, zero disagreements)
plus a 77-case hand table on both sides of every family. Four concrete errors the review named are fixed:
a date-only timestamp now admits one- or two-digit month and day (`2001-1-1`), an oversized sexagesimal
classifies by **shape** rather than returning nothing when `i128` overflows, the 1.2-core integer strips
the sign before the radix prefix (`+0o17`), and the `012` documentation was corrected after the *code* was
verified correct. **The 1.2-core half still has no second implementation** — see R16's row.

### D2t — the removal envelope needed a bound derived independently of itself

Phase 0c-3b-2b's blocking finding, and **R24's second occurrence in two phases**.

A removal whose deletion run swallowed one **following blank line the entry does not own** was accepted by
every production check: no node is crossed, the mapping loses exactly one entry, the sibling digests are
unchanged, nothing decodes differently — and `bytes_outside_the_replacements_match` **positively
authorises** the deleted byte, *because the envelope declared it*. Only the test-side sweep saw it.

That is circular authorisation: the envelope is checked against a permission the envelope itself granted.
`RemovalCarriesMoreThanTheEntry` is the sixth verification property (D2q's five plus this). It derives the
entry's allowed physical-line runs from the **key/value frontier**, the textual leading-trivia rule and
D2o's blank-run rule, and **consults nothing `removal_envelope` produced**. A move's source half keeps its
own two bounds via `EnvelopeKind`, so the earlier experiments still fail under their own names.

**The general rule, now twice-learned:** a bound that reads its own declaration proves nothing.
*"Deleting a user's blank line is not acceptable collateral. The distinction is ownership, not whether the
byte decodes to YAML data."*

### D2u — the UI shows a scalar's **source text**, never an inferred type

**Decided by the product owner at the Phase 0 / Phase 1 boundary. This is a locked decision — do not
re-litigate it, and do not "improve" the browser by adding type-aware rendering.**

R16's open half is that the *projection* of a **pre-existing** plain scalar is not proven to match
espanso's resolver. **31 synthetic and 65 real plain scalars resolve non-`str` under YAML 1.1 today**: a
bare `on`, `off`, `012` or `12:30` is a boolean, an octal or a sexagesimal to espanso, and a string to the
YAML 1.2 substrate we read with. So the moment a UI renders one of those *as a type* — a toggle, a
number field, a boolean chip — it makes a claim this project has not earned, in the one place the user
will trust it most.

**The rule:** the browser displays the scalar's source text as written. It may say what the *file* says;
it may not say what the value *means*. Where a type would be useful, show the source and let the user read
it.

**Why this is the right trade rather than a stopgap.** The cost is cosmetic — a value looks like text
instead of a toggle. The cost of the alternative is a user seeing `enable: on` rendered as a boolean,
trusting it, and being wrong about their own config in a tool whose entire promise is fidelity. That
asymmetry is the same one D2e made for the codec (*"over-quoting costs two apostrophes; under-quoting
costs the user their value"*) and the same one the hazard gate makes (*"refusing a safe edit costs one
fallback; accepting an unsafe one costs the user their file"*). This project resolves that asymmetry the
same way every time, and doing so consistently is most of why its guarantees are believable.

**What would unlock type-aware rendering**, if a later phase wants it: close R16's projection half —
prove the projection agrees with espanso's actual resolver, not merely with our own table. Until then a
type is a guess, however well-informed. **Flagging** a scalar as 1.1-ambiguous is permitted and
encouraged, because that is a statement about *risk*, which we can prove, rather than about *meaning*,
which we cannot.

### D2v — an identity is scoped to the parse that minted it, and a stale one is refused

From the Phase 1a review's finding 1, which was a **real defect and not a theoretical one**. `MatchId`
was `DocumentId` + `NodeId`, and both components are positional under the hood: `NodeId` is the parser's
arena index, assigned in emission order, and `DocumentId` was the file's position in the sorted
enumeration. So exchanging two equally shaped matches and reparsing handed `:a`'s former identity to
`:b` — **identity following position, which plan §6.2 forbids in as many words**. The test that claimed
to cover this was named `…survives_a_reordering` and never reordered anything: it is the third
occurrence of the oracle-that-cannot-disagree failure mode (R24), and the first one a reviewer rather
than the phase itself caught.

**The fix is refusal, not reconstruction.** A content-derived stable identity — matching nodes across a
reparse by their content — was considered and rejected: it is a much larger design, it must decide what
"the same match" means when the user edits the trigger, and Phase 1 does not need it. Instead:

- `MatchId` carries the document's `ContentRevision`, and `match_by_id` returns
  `Result<_, IdentityError>`. An identity from a different parse yields `IdentityError::StaleRevision`
  naming both revisions. It is never resolved to *a* match, and above all never to the wrong one.
- `DocumentId` is allocated from a **monotonic session counter keyed by path**, so reopening a directory
  keeps every existing id, a new file gets a fresh one, and a removed file's id becomes a typed
  unknown-document error rather than aliasing whatever slid into its position.

**What this costs, and who pays it.** Phase 1b and every later phase must handle `StaleRevision` on
every lookup that crosses a `refresh()` — which is the correct shape for a UI holding a selection across
an external file change, and is the same conversation plan §6.5's reconciliation already requires. The
mirror image is pinned too: reprojecting the *same* bytes mints the *same* identity, so the refusal is
about the revision changing and not merely about reparsing.

### D2w — an unmodelled subtree is accounted for by span, and that is a bound rather than a claim

Plan §6.2 says unknown entries are never silently discarded. The first Phase 1a draft recorded an
unrecognised key by name and **did not descend into it**, so `future_option: {nested_key: …}` recorded
`future_option` and left `nested_key` recorded nowhere — while every coverage check passed, because they
iterated the records the projection had chosen to emit. A missing record was therefore invisible: the
audit was vacuous in exactly the way `0c-3b-1`'s property 6 was.

**The claim is now stated so it can be false:** *every key is either modelled, or recorded by name and
path, or lies inside a recorded undescended span.* The third clause is a real bound — the span comes
from a node the index published — and it is checked in the **library**
(`DocumentView::unaccounted_keys` → `DiagnosticCode::KeyNotAccountedFor`), not only in a test, per R24.
The test-side oracle derives its expectation from the **document tree**; suppressing a coverage
record's *creation* now fails both corpus sweeps, which the old per-record audit could not see.

**What it does not say.** A key inside an undescended span is *accounted for*; it is **not** addressable,
searchable or displayable as a field. That is the deliberate trade, and a later phase that wants to
render such a subtree must decide how rather than assume the projection already did. Accounting is by
**containment**, so an over-wide recorded span would over-account — unreachable today, and weaker than
per-key attribution would be.

### D2x — the architecture-rule check changed in 1b-1, and the old one must not be quoted again

CLAUDE.md §3 — *`crates/espansoconfig-core` must never depend on `tauri`* — is unchanged and absolute.
**Its check is not.** Until 1b-1 the evidence was `rg -c tauri Cargo.lock` finding nothing. The moment
`src-tauri/` joined the workspace the lockfile gained tauri **legitimately**, so that command now finds
matches whether or not the rule holds — and, worse, a version of it that still passed would be passing
vacuously.

The check is now:

```sh
cargo tree -p espansoconfig-core | rg tauri     # must find nothing
```

It asks the resolver about **one crate's** dependency closure rather than about the workspace's, which is
the question the rule actually poses. Measured at 1b-1: `espansoconfig-core` resolves to `saphyr-parser`,
`serde` and `sha2` (plus four dev-dependencies), and the grep is empty.

The general lesson is the one R24 keeps teaching from a different angle: **a check can stop meaning
anything without ever starting to fail.** When the thing being checked gains a legitimate second source,
re-derive the check rather than keep running it.

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
| R4 | Phase 0 gate is **not yet cleared** — the round-trip property test does not exist yet | **CLOSED in 0c-3b-2b. The gate is PASSED**, with four qualifications, and the verdict with its evidence is `docs/decisions/0c-3b-2b-notes.md` §8. "Passes on the full corpus" is discharged in the strong reading: **every eligible target in every file of both corpora**, no stride and no thinning — 2 080 synthetic attempts (1 696 applied) and 1 998 real (1 851 applied), zero verification failures. **UI work is unblocked**, but only for the operations that exist: editing a scalar, adding and removing a field, and reordering matches **inside one sequence**. It does **not** license presenting a plain scalar's *type* to the user (R16), moving a match between files or sequences (D2r), or combining a move with any other edit in one batch (R25). |
| R5 | An empty block scalar (`replace: \|` mid-keystroke) reports a span that **includes** its header — the one exception to "the header is outside the span" | Phase 0b: the backwards header lexer must refuse to run when the span itself starts with `\|` or `>`. Pinned by `a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header`. The content span now starts past the header *line*, never past the indicator alone, so rewriting it cannot splice a value onto the header line. |
| R6 | **Flow-collection comment ownership** is undefined: in `items: [one, # why` / `two]` the comment belongs to no obvious node | **Closed in 0b-2 (D2d).** The comment attaches to the innermost enclosing flow collection and raises `HazardKind::CommentInFlowCollection`; the collection is then refused **outright**, whole-collection replacement included. Pinned by `a_comment_inside_a_flow_collection_belongs_to_the_collection_and_flags_it`. |
| R7 | **Empty and implicit nodes** (`empty:`, bare `- `, `? key` / `: value`, compact `- key: value`) create zero-width or shared boundaries with no unique owner | **Closed in 0b-2 (D2d).** One documented, tested policy each — see the D2d table. The explicit `?`/`:` form additionally raises `HazardKind::ExplicitKeyMapping`; the other three are safely editable once their punctuation and comments are attributed. |
| R8 | **Merge keys and aliases** can defeat a path resolver that assumes key/value scalar pairs — `<<` arrives as an ordinary scalar key, aliases are not scalar values | **Closed in 0b-2's fix round.** Both are classified syntactically, never positionally: a merge key is a *plain* scalar in key position spelled exactly `<<` (a quoted `'<<'` is an ordinary string key and is deliberately not flagged), and an alias is `NodeKind::Alias`. Each raises its own hazard, so the enclosing mapping and the alias are refused rather than resolved. Pinned by `a_merge_key_is_recognised_syntactically_and_refuses_its_mapping` and `an_anchor_definition_and_its_alias_are_both_refused`. |
| R12 | **Refusal for anchors, aliases, tags, merge keys, duplicate keys and multi-document streams is broad, and was previously recorded here as *total*.** A file using any of them is largely, but not entirely, non-editable in the visual UI | Accepted, and it is the specified behaviour: plan §7 rows 7–8 say *detect and refuse*, and §13 defers visual editing of anchors, aliases, tags and merge keys out of v1. **"Total" was wrong, and 0c-2b measured it.** The gate refuses the flagged node, its ancestors and its descendants, so a **sibling** stays editable: `anchors-aliases-tags-merge.yml` refuses 12 addressable scalars and **applies 5** — `matches[2].trigger` is editable although the explicit-tag hazard sits on the `replace` beside it — and `duplicate-keys.yml` is 2 refused / 8 applied. Only a hazard on a **document** node reaches everything, which is why `multi-document.yml` really is total. The gate's behaviour is unchanged and safe; only this prose needed narrowing. Pinned by `the_hazard_gate_refuses_by_scope_and_not_by_file`. R12's other claim is confirmed: **2 004 of 2 004** attempted real-corpus edits applied, zero refusals, so the breadth costs this corpus nothing today. If a future corpus does trip it, the escape hatch is a *narrower* hazard scope, not a weaker gate. |
| R13 | **Duplicate-key detection compares decoded scalar values only.** A non-scalar key — an alias or a collection used as a mapping key — is skipped by the duplicate check | Accepted: every such key already raises `AliasReference` or sits inside a refused construct, so the mapping is refused anyway. Revisit only if a case appears where a non-scalar key exists without any other hazard. |
| R9 | The missing evaluation criterion is **replacement-envelope correctness**, not endpoint accuracy | Phase 0c. Mutate real documents and assert: the span matches the requested structural path despite duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys and empty values; the replacement reparses to the intended value and stays valid YAML; every byte outside the envelope is identical (CRLF/LF, BOM, missing final newline, trailing spaces, comments, block-scalar terminal newlines). This is the Phase 0 gate's round-trip property test. |
| R14 | **A Markdown table inside `replace: \|` rejected the whole document.** `locate_header` treated any block whose first body line opens with `\|` or `>` as a truncated R5 header | **Fixed in 0c-1.** The backwards lexer runs first and the forward R5 path is the fallback; a genuinely truncated header has nothing but its key on the preceding line, so backwards finds nothing and forwards still fires. Reviewer-approved. Pinned by `a_body_line_opening_with_a_block_indicator_is_not_a_truncated_header`. This was a latent **Phase 0b** bug that the codec work surfaced — a real espanso config with a Markdown table would have been entirely unopenable. |
| R15 | **`NonCanonicalEscaping` is deliberately over-broad**: it refuses every double-quoted source containing any backslash, including already-canonical `\\`, `\"`, `\n`, `\t` | Accepted for now, and safe — it only costs the ability to re-encode such a scalar byte-identically, never correctness. Carries a `TODO(0c-2)` in its doc comment. Narrow it only if 0c-2 finds real files where editing an escaped double-quoted value matters. |
| R16 | **The round-trip oracle parses with saphyr (YAML 1.2), but espanso consumes with a YAML 1.1-ish stack.** Agreement with saphyr does not prove the file means the same thing to espanso | **Partly closed in 0c-3b-2b (D2s), and the open half is stated so it cannot be mistaken for mitigated.** *R16 stays open: byte preservation and conservative emission prevent edits from changing untouched bytes or introducing known YAML 1.1-ambiguous plain scalars, but the UI projection of pre-existing plain scalars is not yet proven to match espanso's resolver.* **Closed half:** an in-house 1.1/1.2-core tag table in the library, consulted by the emitter and asserted in `verify()` as a differential property, so an edit can neither introduce a new ambiguity nor change an existing classification. Building it found D2h's predicate writing **34 distinct 1.1-ambiguous values plain** — a real corruption path, now fixed. **Open half:** the *projection*. 31 synthetic and 65 real plain scalars resolve non-`str` under 1.1 today; the app would display them as strings. **The UI consequence is settled by D2u — the browser shows source text, never an inferred type — so the open half costs display richness, not correctness.** R16 closes only when the projection is proven against espanso's actual resolver, which is also what would unlock type-aware rendering. **Residual risk:** a pre-existing or explicitly tagged scalar may be displayed or used by the typed projection with a different type/value than espanso assigns, and an incomplete hand-maintained resolver table or an espanso-specific schema change could leave that disagreement undetected. **Two named weaknesses:** explicit tags are outside the table entirely, and the **1.2-core half has no second implementation** (the 1.1 half has one, differentially swept over 500 000 values with zero disagreements). Deliberately **no second parser crate** — see D2s for why, and do not add one without re-reading it. |
| R17 | **A flow collection is not refused by the hazard gate.** `HazardKind` has only `CommentInFlowCollection`, so `matches: [{trigger: ":a", replace: old}]` both resolves *and* passes `is_safely_editable`. A block scalar is illegal inside `{…}`/`[…]`, so an edit that turns a short value into a multi-line one would emit invalid YAML | **Closed in 0c-2b (D2k)**, by the second of the two answers R17 named: flow context is threaded into rendering, so a multi-line value inside a flow collection becomes a double-quoted one-liner and a block scalar is never emitted there. Flow-interior edits are **not** refused, because refusing them would cost the visual editor the ability to change a trigger list. The one collateral effect is that a plain scalar in flow context is requoted on edit. Pinned in both directions; a flow collection carrying a comment is still refused outright. |
| R18 | **A node in key position cannot be verified by the path that found it.** Renaming the `replace` of `replace: old` makes the path `replace` resolve to `NoSuchKey` in the reparsed document, so the verify step fails on a *correct* edit | Accepted and bounded. A scalar edit targets `Resolved::value` only; `resolve_key` exists for the **spans** a structural edit needs (where an entry begins, so removing it takes its key too), not as an edit target. Documented on `resolve_key` itself. A key-rename operation needs its own protocol — verify against the **intended new** path, not the old one — and is 0c-3's problem if it is wanted at all. Editing an ordinary value that merely equals some other entry's key string is harmless. |
| R19 | **`TriviaIndex::scan` is quadratic** — `ownership.rs`'s primitives each scan **every node** and are called **once per trivia item**, so the cost is O(items × nodes) | **Largely closed in 0c-3b-2b's fix round, by memoisation rather than by thinning any sweep** — which is what the 0c-3b-2a checkpoint instructed and what the first draft of the gate did *not* do (it strided the real corpus instead; the review caught it). The primitives now answer from precomputed orders, with a differential test asserting they agree with the linear scans they replaced. Measured: the gate binary went **34.3 s → 16.9 s while becoming exhaustive** (real attempts 1 373 → 1 998), `patch_edit` 23.6 s → 7.5 s, `patch_move` 16.4 s → 5.7 s, `patch_structure` 19.6 s → 5.9 s, and the whole suite **87.9 s → 39.4 s**. **Not fully closed:** the safe entry point still re-scans on every call by design, which is a Phase 1 concern — 20 ms per keystroke-triggered rescan is not viable, so the UI needs either a cached index or an incremental one. |
| R20 | **A quoted scalar's reported end overshoots trailing spaces and a following comment**, exactly as a block scalar's does (R3) — the same class of latent silent-corruption bug, in a layer everything else rests on | **Fixed in 0c-2b, in the span layer rather than worked around in the edit engine.** `SyntaxIndex::quoted_span()` trims the reported end back to the closing delimiter, lexing forwards from the opening one (`''` and `\"` are data, not terminators; the scan crosses line breaks so multi-line quoted scalars trim correctly). Unlike `block_layout` it falls back to the reported span rather than rejecting the index, because a quoted scalar with no closing quote inside its own reported span cannot come from a document the substrate accepted, and making a file unopenable for an unreachable case is the R14 mistake. **The residual risk is the corpus, not the code:** this was invisible for three phases because no fixture exercised the shape. `trimmed_block_scalars()` is now restricted to the two block styles so the two overshoots can never again be folded into one figure — which is precisely how this one hid. **Standing instruction, and the 0c-3b-1 review added its second half:** a new hazard gets a *fixture*, not only a unit test — and **a new refusal gets a fixture on each side of its condition**, not one inside it. R23 was pinned as correct for a whole phase with only the refused shape in the corpus, and its over-breadth was invisible until a reviewer constructed the safe one. **Seven occurrences now, and the seventh was closed rather than carried.** 0c-3b-2a's move fixture originally spelled an inline comment after a **single-quoted** scalar, which made the Phase 0a tripwire `saphyr_flow_scalar_end_offsets_are_exact_across_the_whole_valid_corpus` fail — revealing that **no synthetic fixture had ever held a quoted scalar carrying an inline comment**, so that test's claim of exactness was "exact in this corpus" rather than exact. The phase's first response was to change the fixture to a plain scalar and record the hole; **its review overruled that**, on the ground that deleting discovered evidence to preserve a claim is backwards. The quoted shape is now back in `move-a-match.yml` and `parser_evaluation.rs` classifies quoted overshoots in a separately counted, separately asserted bucket, so the tripwire states what is actually true. |
| R10 | A block scalar whose header cannot be located has **no correct span**: the reported one runs into trailing blank lines and the next node's indentation | The index is **rejected** with `InvariantViolation::BlockHeaderNotFound` rather than publishing the known-bad span. There is deliberately no fallback. From the Phase 0b-1 review, ranked failure mode 3. |
| R11 | **Terminal spaces or tabs at end-of-source** are scalar content, not the next token's indentation — there is no next token | `block::content_len` takes `at_end_of_source` and keeps a trailing run that sits on a content line. Pinned by `terminal_spaces_at_end_of_source_stay_inside_the_block_scalar` and the `block-scalar-terminal-spaces.yml` fixture. |
| R21 | **A removal envelope is a contiguous hull, so it cannot express "remove this entry but keep the file-owned comment inside it."** Such a removal was refused rather than performed | **Closed in 0c-3b-1 (D2o).** The envelope is now an ordered, disjoint set of **runs** — the hull with every file-owned comment's whole line, and the blank runs touching it, punched out — spliced as several replacements. The refusal became an *assertion* on the derived run set, argued unreachable and pinned at 0, and the three-layer visibility discipline was re-confirmed by disabling each layer in turn (`docs/decisions/0c-3b-1-notes.md` §6). The change made the invariant **stronger**: `VerificationFailure::EnvelopeMissesTheEntry` states what a hull made unstatable. Measured gain: **1** synthetic removal, **0** real ones — exactly the cost the refusal had — and the real value is that a move is impossible on a hull. Cost: one new refusal, `RemovalWouldExtendABlockScalar`, for the one shape a run set cannot express (a kept comment directly under a block scalar's content, **at or past that block's body column** — the column comparison came from this phase's own review, finding 2), 1 synthetic attempt and 0 real ones. **Re-confirmed after that review**, which changed layer 3: every experiment of §6 was re-run, and two more break the *engine* rather than a layer, which is what shows the sweep can disagree with it. |
| R23 | **A comment a removal *keeps* can be absorbed by a block scalar above it**, changing that block's decoded value although nothing about it was edited — the shape neither D2o nor the 0c-3a review named | Accepted and refused by name (`EditError::RemovalWouldExtendABlockScalar`), the twin of `RemovalWouldExtendAKeptBlock`. **Narrowed by the 0c-3b-1 review's finding 2, which found the first form over-broad.** It now fires on three clauses, not two: the removal has something to preserve, *and* some block scalar's content ends at or before the envelope's first run with nothing but blank lines in between, *and* **the first non-blank line the removal preserves sits at that block's own body column or deeper**. A shallower line ends the block instead of extending it, exactly as the removed entry's key already did, so the reviewer's `>` block above a column-zero comment is a legal removal and is pinned byte-exactly. The body column is `ScalarPresentation::indent`, **read off the span layer and never re-lexed** (D2/D2d); the earlier "only reconstructible" objection was about a block's *end*, not its body column. One case still refuses unconditionally: a block whose content span is **empty** (`replace: \|` with the next sibling under it, the R5 shape), where `indent` holds the header's column rather than any observed body's. Costs the synthetic corpus **1** attempt, in `run-based-removal-envelope.yml`, and the real corpus **0** — unchanged by the narrowing, which let one attempt through and turned none away. `run-based-removal-boundaries.yml` pins the safe side. |
| R22 | **`InconsistentEntryIndentation` is pinned at 0 and is argued to be *unreachable*, not merely unreached** — a coverage hole and a proof look identical in a count | Accepted, with the argument recorded in `docs/decisions/0c-3a-notes.md` §3: a valid block mapping cannot have its keys at two columns, and the two shapes that can are refused earlier by other variants. No fixture was invented to reach it, because an impossible fixture would prove nothing. This is the one refusal family whose pinned zero rests on an argument rather than on a construction — treat it as the weakest pin in the table, and revisit if a real file ever trips it. |
| R24 | **A safety property that lives only in the test suite is not a safety property** — 0c-3b-2a shipped `the_arrival_is_the_departure` in the sweep but not in `verify()`, so a defective planner that permuted the bytes it carried could still mint a `PatchedDocument` | **Closed in 0c-3b-2a's fix round (D2q)**, and recorded as a *class* rather than an incident: the check is now a production property, plus `comment_ownership_survives` for the re-attribution variant no byte comparison can see. **Standing instruction for every later phase: when a sweep proves something the engine relies on, ask whether the engine asserts it too.** The pattern to watch for is a property whose only home is a test file whose name ends in the thing it protects. Pinned by `every_other_move_property_certifies_the_permuted_candidate`, which asserts the other four properties **accept** the corrupted candidate. **It recurred immediately in 0c-3b-2b** — a removal envelope swallowing an unowned blank line was caught by nothing in production, because `bytes_outside_the_replacements_match` authorised it from the envelope's own declaration. Closed by `RemovalCarriesMoreThanTheEntry` (D2t). **The gate now rests on no property whose only home is a test file**, and that sentence is the closure condition: check it again whenever a sweep gains a property. |
| R25 | **Move verification is not compositional** — `MoveMustBeTheOnlyEditInItsBatch` refuses a batch pairing a move with any other edit, including the safe and obvious "move this match and change its `replace`" | Accepted as a **deliberate phase-scope limit, not an invariant**, and relabelled as such after the 0c-3b-2a review found the original circularity argument unconvincing. It conceals no demonstrated splice-order bug — a single move still exercises descending application of its own runs. Two costs, both recorded: the safe combined request above is refused, and **`OverlappingEdits` is consequently never tested against a move-versus-edit conflict**, because the restriction rejects such batches before overlap analysis runs. Closing it means applying the permutation to a combined expectation and exempting precisely the independently verified rewritten node, which is how field batching already works. Revisit when the UI needs it or when cross-file move lands. |
| R26 | **`shares_a_line` and the move sweep's second derivation of `comment_ownership_survives` are pinned or covered more weakly than the rest** | Accepted and named rather than papered over. `shares_a_line` is **reachable** — via a compact nested sequence such as `outer[0][1]` in `- - first` — and is driven by a hand-written unit test rather than a corpus fixture, because neither corpus holds that shape; it is weaker than corpus coverage and R20's rule would prefer a fixture. `comment_ownership_survives` has a production derivation but **no independent second derivation in the sweep**, deferred on R19 cost grounds (`docs/decisions/0c-3b-2a-notes.md` §3.4). Both are the weakest pins added by 0c-3b-2a; R22 remains the weakest in the table overall. |
| R27 | **A held identity goes stale on every reparse, and the UI is what holds identities.** `MatchId` is refused across a revision change (D2v), which is correct and is not free: a selection, a scroll position or an open editor pane held across an external file change now meets `IdentityError::StaleRevision` | Accepted, and it is the specified behaviour — refusing beats resolving to the wrong match, which is what the code did before the Phase 1a review. **The cost lands squarely on Phase 1b/1c**: every lookup that can cross a `refresh()` must handle the error rather than unwrap it, and the UI needs a re-selection policy (most likely: re-resolve by `DocumentPath`, which is the thing designed to survive a reparse, then fall back to clearing the selection). Plan §6.5's reconciliation already requires that conversation, so this adds a case to it rather than a new mechanism. Pinned in both directions by `an_identity_from_before_a_reordering_is_refused_rather_than_resolved`, which also asserts that reprojecting *identical* bytes mints the *same* identity. |
| R28 | **`Deserialize` on `ByteSpan` bypasses `ByteSpan::new`'s inverted-span assertion.** A frontend-supplied span is currently only ever echoed back, but nothing in the type system says so | Accepted **for a read-only phase, and dangerous the moment a mutation trusts a span that crossed the IPC boundary.** `serde` is `Serialize`-only except for a named list — `DocumentId`, `NodeId`, `DocumentPath`, `PathSegment`, `ByteSpan`, `MatchId` — which are exactly plan §6.4's command *arguments*. `ContentRevision`'s hand-written `Deserialize` accepts only the 64-character hex string its `Serialize` writes, so a malformed concurrency token is a typed rejection rather than a digest that quietly matches nothing. **Phase 2 must not let a deserialized `ByteSpan` reach the patch engine without revalidating it**, and must not widen the `Deserialize` list without re-reading `docs/decisions/1a-notes.md` §9 hole 6. |
| R29 | **An unmodelled subtree is accounted for by span, not by name** (D2w): a key nested under an unrecognised option is proven present but is not addressable, searchable or displayable | Accepted as the deliberate trade, and recorded as a hole rather than folded into the "no key is dropped" claim — which is how the Phase 1a review found it. Measured cost: **28 of 546 synthetic keys** are span-accounted rather than named, and **0 of 566 real ones**, so the live config loses nothing today. Two second-order weaknesses named with it: accounting is by *containment*, so an over-wide recorded span would over-account (unreachable today, since every span comes from a published node), and two `UnknownEntry` reasons carry no path by construction — `NonScalarKey` (no `PathSegment` can spell such a key) and `RepeatedKey` (a path would name the *first* entry, not this one). A later phase that wants to render such a subtree must decide how, not assume the projection already did. |
| R31 | **The hardcoded-string check sees markup only.** It scans `src/**/*.svelte` for literal text outside `t()`, and is blind to `<script>` bodies, `{'literal'}` expressions, `.ts` string constants and props — so a clean run means *"no literal sits in markup"*, not *"no hardcoded string exists"* | Accepted and **stated in those words** rather than as a passing check (`docs/decisions/1b-1-notes.md` §7). Its blind spots are pinned as tests, so the boundary is asserted rather than remembered, and it was proven able to fire against the real tree rather than only to pass. The residual exposure grows with every phase: 1c is almost entirely user-facing strings, and the class of string this check cannot see — an error message assembled in a `.ts` store — is exactly what 1b-2's code dictionaries produce. **Re-read this row before adding any string outside markup.** |
| R32 | **Nothing renders, and "the process stayed up" is not evidence that anything did.** No test mounts `AppShell` or asserts that switching the picker re-renders; `npm run tauri build` has never been run, so the bundler, the `.app` layout, the `Info.plist` merge and the production CSP are untested end to end | Accepted for 1b-1 and **owed by 1c**, which is the first phase with a screen worth asserting about. **This risk stopped being hypothetical inside the phase itself.** 1b-1 first reported the shell "smoke-launched and stayed up"; the fix round found a missing `custom-protocol` feature meant every binary loaded the dead `devUrl`, so that window was **blank** and `npm run tauri build` could not have succeeded. A launched process proved the window and webview were created and **nothing whatever** about what was painted in them — which is precisely what the risk says, demonstrated. It was separated from a frontend exception only by planting a static `<h1>` in `dist/index.html` and watching that fail too. A DOM environment (`jsdom` / `@testing-library/svelte`) is a deliberate future decision rather than a default, and `vite.config.ts` says so at its `environment: 'node'` line; the `$effect` half of the document-language sync is untested for the same reason. The bundler half is Phase 5's subject (plan §10, `SIGN_AND_NOTARIZE.md`). **Standing instruction: never again record a hand launch as evidence about rendering.** |
| R34 | **The macOS application menu is unlocalized**, so a Spanish user meets an English menu bar — a live exception to CLAUDE.md §2, which is non-negotiable | **Open, owed by 1b-2, and it is a recorded disagreement rather than a settled hole.** The Phase 1b-1 reviewer's position is that the phase should not have closed while it stands. The rebuttal on file: Tauri v2 builds the default menu in Rust, so localizing it needs either Spanish strings in Rust — which plan §9 forbids in as many words — or menu labels handed across IPC, which needs a command, and 1b-2 is the phase that has one. `CFBundleLocalizations = [en, es]` and `CFBundleDevelopmentRegion = en` are already declared. Both halves of the argument are in `docs/decisions/1b-1-notes.md` §9 hole 1 so a later session can overrule this one **on the evidence** rather than rediscover the question. |
| R35 | **Nothing establishes that a Spanish string is Spanish.** The dictionary suite checks key parity, placeholder parity and non-identity with the English value — a translation reading `"Sprache"` passes every one | Accepted, and the *claim* was corrected rather than the code: the suite is named for the untranslated-value heuristic it is, per the review's finding 5, and the `"Sprache"` counterexample is written into the notes and the module doc comments so the boundary cannot be forgotten. Closing this needs reviewed expected translations or a bilingual review gate — a process, not a test — and the cost grows with every phase, since 1c is almost entirely user-facing strings. Two smaller relatives named with it: the duplicate-key scanner compares **key text** rather than decoded escapes, and `webview-floor.test.ts` pins the esbuild target against the plist floor for *consistency* only — esbuild constrains syntax, not library APIs, so a newly used API with a higher baseline than the target would still slip through. `Object.hasOwn` was exactly that shape. |
| R33 | **TypeScript is pinned to 6.0.3, one major behind 7.0.2**, because `svelte-check@4.7.4` declares `typescript: ^5 \|\| ^6` | Accepted and dated. The whole i18n guarantee is a *compile-time* one, so the version that compiles it is load-bearing: an upgrade that changes how `Record<Exclude<keyof T, TranslationKey>, never>` behaves would weaken `ExactDictionary` silently. The four disabling experiments of `1b-1-notes.md` §2 are the tripwire — **re-run them after any TypeScript or `svelte-check` upgrade**, because they are the only thing that would notice. |
| R30 | **Nothing in the projection is proven against espanso itself.** The field list is plan §3's, verified against espanso 2.3.0 and its JSON schemas — but by the plan's author, not by any test in this repository | Accepted, and the failure mode is the right one rather than a silent one: a field espanso has and plan §3 lacks lands in `unknown_entries`, where D2w's accounting proves it survived and R29 records that it is not rendered. That is not the same as being correct. Closing this means a differential check against espanso's own schema, which is a Phase 3 concern at the earliest (plan §12 puts unknown-field preservation *verified end to end* there). |

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

## Phase 0c-3b-2a review disposition

Review of record: [`docs/reviews/phase-0c-3b-2a-move-and-invariant.md`](docs/reviews/phase-0c-3b-2a-move-and-invariant.md).
Its verdict was blunt and correct: *"the stronger invariant is not sound as the production safety
boundary"* — the engine usually copied bytes correctly and the sweep checked that it had, but the three
advertised **production** properties could jointly certify presentation corruption. Full per-finding
disposition in [`docs/decisions/0c-3b-2a-notes.md`](docs/decisions/0c-3b-2a-notes.md) §9.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High** — the three properties never prove the carried bytes were copied verbatim; that check lived only in the test sweep | **Adopted in full.** `the_arrival_is_the_departure` is a production property with two typed failures, expected bytes read from the **original** document at independently bounded runs. A fifth property, `comment_ownership_survives`, closes the re-attribution variant no byte comparison can see. All four listed variants have retained tests. See D2q and R24. |
| 2 | **High** — the EOF rotation hands a previously unterminated destination line a terminator it never had, possibly a foreign one | **Adopted in full: the rotation is gone**, refused by name as `MoveWouldTerminateTheFinalLine`. D2p is a recorded decision and overriding it was not this phase's call. Two simplifications fell out at zero measured cost: the line multisets are paired again, and `MoveWouldExtendAKeptBlock` lost a now-dead clause. Cost: 3 synthetic moves, 0 real. |
| 3 | **Medium** — there are more than three seams; concatenating several carried runs creates internal joins none of them examines | **Adopted.** `MoveSeam::CarriedRunsJoin`, one per adjacent pair of carried runs, with `move-run-joins.yml` pinning **both** sides. The decoded-tree walk already rejected the shape, so this was never silent corruption — but the "three seams" claim was false and the typed refusal was missing. |
| 4 | **Medium** — the mutation experiments are documented history, not retained tests, and the weak ones alter multiset counts | **Adopted.** C1/C2/C2b/C4/C5 plus M1 (**permutation-preserving**, the case the originals missed), M3 and M4 drive the complete pipeline via `tampered_move`. `every_other_move_property_certifies_the_permuted_candidate` pins that the other four properties **accept** the corruption. |
| 5 | **Low** — `MoveMustBeTheOnlyEditInItsBatch` is a workaround, not an invariant | **Accepted as stated.** The restriction stays; its doc comment and the notes are rewritten to call it a scope limit, the circularity argument is withdrawn, and the untested `OverlappingEdits` case is recorded. Now **R25**. |
| 6 | **Coverage** — the quoted-scalar hole, R23-for-moves, `entry_hull_lines`, `shares_a_line` | Three closed, one recorded. The quoted shape is **restored** and the tripwire re-bucketed (R20's seventh, above); R23-for-moves gets `move-kept-comment-joins-a-block.yml` on both sides, 0 → 3; `entry_hull_lines`' block-body `#` defect is **fixed** by porting `patch_move.rs`'s version, moving no count; `shares_a_line` stays a unit test and is documented as reachable via `- - first` (**R26**). |
| 7 | **Scope** — "copied verbatim without re-indentation" holds only for one operation | **Recorded as D2r** and in notes §7.7. A differently indented or nested destination must re-indent or refuse and **cannot reuse these proofs**. |

The reviewer's strongest failed attack is worth keeping: changing a neighbouring block scalar's decoded
value at any of the three external joins **is** caught independently by the lockstep tree walk. The
failures were all in presentation-only corruption, terminator ownership, internal run joins and trivia
re-attribution — *"the exact areas decoded-tree equality cannot observe"*.

---

## Phase 1c-2a review disposition

The review is [`docs/reviews/phase-1c-2a-detail-pane.md`](docs/reviews/phase-1c-2a-detail-pane.md).
**No High findings.** Two Medium and two Low, all four closed before the commit, so no commit holds a
demonstrated defect.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Medium | The pane says an unmodelled entry "is shown as written" and shows only its key | **Real, and the sharpest of the four** — it is a claim the project has not earned, the same class as D2u and R16. Verified against the wire first: `UnknownEntry` carries `key`, `key_node`, `key_span`, `value_span`, `value_kind`, `path` and `reason` — **no value text**, so the pane never could have shown it. Six strings reworded in both languages to claim only what is true (*recorded and left untouched*, *kept exactly as the file writes it* — about the file, not the screen), and a new `browser.detail.unknownValue` renders `value_kind` through `tValueKind`: "holds a set of keys, which this pane does not show". **Deliberately not fixed by reconstructing the value in TypeScript from `value_span`** — JS string indices are UTF-16 units, not bytes, and that confusion is exactly what the core's `CharToByte` adapter exists to prevent. Carrying an exact Rust-sliced source span is hole 13 and inherited work |
| 2 | Medium | A sequence item's boundary is invisible | Real. `detail.ts` modelled the item label and the component rendered nothing for that arm, with `list-style: none` removing the native bullet too. Two `search_terms` whose first item held a two-line literal block rendered as three unmarked lines. A `•` in markup — **not a CSS `content:` rule**, so `innerText` can see it and a window reading can check it — plus a stylesheet rule and a text-scan guard |
| 3 | Low | The field-coverage test audits what the implementation emitted | Real, and **D2w recurring**. Closed at the root rather than by rewording the comment: `EVERY_DETAIL_FIELD` is pinned to `DetailFieldName` in both directions by two `assertNever<Exclude<…>>()` calls, and the assertion is now set **equality** rather than a count. Experiment Q adds an unemitted 25th member: the new test fails, and the test it replaced passed |
| 4 | Low | The notes' dictionary counts are wrong and disagree with each other | Real, and verified independently against `0507f6f` — 169 keys at the base. Corrected throughout; the figure is now **50 added, one removed, 218 each**, the extra over the review's arithmetic being `unknownValue`, which finding 1 added after the review was written |

## Phase 1c-1 review disposition

The review is
[`docs/reviews/phase-1c-1-shell-and-data-path.md`](docs/reviews/phase-1c-1-shell-and-data-path.md).
**Eleven items — two High, five Medium, three Low, plus one defect found outside the review — and every
one is closed. Nothing was rejected.** The phase was held open until the fix round finished, so the
commit contains no intermediate state holding a demonstrated defect. The full disposition, with what
each fix cost, is `docs/decisions/1c-1-notes.md` §13.

- **High 1 — the fingerprint could silently confirm a different match.** Real, and the most serious
  finding in the phase. `matchFingerprint` compared `search_text`, the badges and two shape codes, which
  between them carry **no** `word`, `propagate_case`, variable, form field, unmodelled entry or
  non-primary content field. The reviewer's counterexample is two matches differing only in
  `word: true` / `word: false`: identical fingerprints, so `reresolve()` answered `sameMatch` and the
  browser selected the wrong snippet. The notes had admitted only the *identical-twins* limit, which is
  far narrower. Closed by route (a) — a new read-only `MatchView.source_text`, the bytes the match's
  span names, compared alone. Bytes out of the file are a fact about how the file is written, never a
  resolved value, so D2u is untouched. Hole 3 of the notes is rewritten to the true statement: two
  **byte-identical** matches remain indistinguishable, and nothing in the file distinguishes them either.
- **High 2 — recovery installed a fresh identity over a stale document.** Real. `applyRepair()` stored
  the re-resolved id but never replaced the old `DocumentView` in `views`, so `selectedMatch` resolved
  the old node behind the new id, the list kept old rows and the counts stayed stale; deleted snippets
  also stayed visible after `differentMatch` and `gone`. Closed: `repairSelection` returns the projection
  it read and `installView` replaces the document **before** the selection outcome is applied, on both
  the kept and the cleared paths.
- **Medium 1 — an overlapping selection could overwrite a newer choice.** Real. Closed with a generation
  token checked after every `await`. Its experiment is the one that **did not fire** until the test also
  asserted that a superseded selection issues no reload; recorded in the notes rather than tidied away.
- **Medium 2 — reopening kept an invalid file filter and query.** Real. `open()` now resets selection,
  query, documents, summary, views and failures, under an open-generation token.
- **Medium 3 — search omitted secondary content forms.** Real, and it was a **core** defect rather than a
  frontend one: `build_search_text()` took `ContentSpec::primary()`, so `replace: alpha` + `html: needle`
  could not be found by `needle`. Closed by `ContentSpec::collect_scalars`. The notes' claim that
  `fixtures.ts` re-transcribes the core's join faithfully was false — it added both forms where the core
  added one — and both the fixture and the sentence are corrected.
- **Medium 4 — an unreadable file gave a misleading total with no visible failure.** Real, and it
  contradicted the notes' own justification for computing `pending`, which was then never rendered. The
  browser reached `ready` showing "All 2" while a 100-match file had failed to the console alone. Closed
  with `BrowserState.loadFailures` and a localized partial-total block, and **read out of a running
  window** in both languages.
- **Medium 5 — a notice code was turned into a key rather than going through an accessor.** Real, and it
  is the rule CLAUDE.md §2 and this checkpoint both state. Closed with a `tSelectionNotice` accessor —
  and with a **new lint**, `scripts/lint/built-translation-keys.ts`, which refuses any `t(` whose key is
  not written literally. It immediately found a **second, older** instance in `LanguagePicker.svelte`
  that had survived two phases; that is now `tLocaleName`.
- **Low 1** — `buildSidebar()` added a `ConfigProfile`'s count to the total although `holdsMatches` is
  false for one. Closed by guarding the addition.
- **Low 2 — eight test names promised more than their bodies established.** All eight strengthened, one
  narrowed. **This is R24's corollary and its fifth occurrence**, and the sharpest instance is the
  reviewer's own: `does not wait for a profile, which holds no matches` never supplied a profile count,
  so it passed while `buildSidebar()` counted one — the same test the notes had cited as the reason
  experiment E was unnecessary. That claim is corrected too.
- **Low 3** — the "stub" detail pane already rendered `trigger` and `label` through list-oriented helpers
  that collapse several trigger forms, which 1c-2 would have had to undo. Reduced to notice, file and
  placeholder; its two field keys are gone.
- **The plural defect, found outside the review.** `browser.sidebar.snippetCount` was `"{count} snippets"`
  / `"{count} fragmentos"` with no singular, so a one-match file's tooltip read **"1 snippets"** and
  **"1 fragmentos"** — and the phase's own R32 evidence shows one-match files, so it was on screen.
  Closed with a `.one` / `.other` key pair selected on `count === 1`, which is correct for both languages
  and adds no dependency. Confirmed from a running window: `"1 snippet"` and `"1 fragmento"`.

**One defect was found by the re-run readings and deliberately left for 1c-2**: a file that could not be
read shows the same `–` / "Not read yet" marker as a profile nobody has projected, which conflates
*could not* with *have not*. Recorded in `1c-1-notes.md` §10.4.

## Phase 1b-2b review disposition

The review is
[`docs/reviews/phase-1b-2b-dictionaries-and-menu.md`](docs/reviews/phase-1b-2b-dictionaries-and-menu.md).
Seven findings, **two High**, and the phase was held open until every one was dispositioned — so no
commit holds a demonstrated defect. The full disposition, with the disabling experiment for each fix
and the one escape that is **narrowed rather than closed**, is `1b-2b-notes.md` §12.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | Six wire-visible enums — `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind`, `VariableKind` — crossed the boundary with no dictionary entry and no accessor, deferred to 1c as "hole 3". A 1c component meeting `trigger.kind = "Single"` could only render a raw Rust identifier or invent an unchecked mapping | **Fixed, deferral withdrawn.** Six `CODE_ENUMS`/`VARIANT_COUNTS` rows, 33 keys per dictionary, six key builders, six `describe` functions, six reactive wrappers, six sample tables. Sixteen namespaces, 111 code keys. Hole 3 closed |
| 2 | High | The exhaustiveness check failed open three ways: `#[cfg(…)] Variant,` on one line, `A, B,` on one line, and a brand-new enum never added to `CODE_ENUMS` | **Fixed for the first two, narrowed for the third.** `crate::rust_source` parses with `syn` and lexes with `proc-macro2` (dev-dependencies of `src-tauri` only). Two new checks derive the expected enum set from source — every `Serialize`-carrying enum in both trees, every string-literal union in `types.ts`. **An enum a `macro_rules!` expands to still escapes**, demonstrated in notes §12.3 experiment 12E and recorded as hole 2 |
| 3 | Med | A version skew was refused *inside Tauri's command macro* — English prose, no `code` — and `main.ts` discarded the result, so the English default menu stayed up with nothing reported | **Fixed both halves.** The command takes an untyped envelope and validates it itself, answering `invalidMenuLabels` with `missing`/`unexpected` field names; `startMenuLocalization` consumes the result and `main.ts` holds no logic, which is what makes the path testable |
| 4 | Med | The `detail` guard was a name scanner, and `JSON.stringify(classifyFailure(x))` renders the string while naming no guarded identifier | **Fixed in the type, not the scanner.** The developer string left `IpcFailure`: non-enumerable, symbol-keyed, read only by `developerDetail()`, with `reportIpcFailure()` as its destination. `errors.test.ts` pins enumerability, so putting it back under any name fails. Notes §10's "a component that renders it fails `npm test`" was **withdrawn and rewritten** |
| 5 | Med | `{ ok: true }` was returned before `build_menu`/`set_menu` ran, so a failure inside the closure was unobservable | **Fixed.** `menu::on_main_thread` waits on a one-shot channel and answers the new `menuBuildFailed`. Waiting cannot deadlock — `tauri_runtime_wry::send_user_message` runs a main-thread post inline when already on the main thread, quoted in the notes. Hole 3 of §11.8 closed |
| 6 | Med | The menu literal scanner blanked a whole line when a block comment *began* on it, so `*/ let title = "Edit";` slipped a hardcoded English label past every check | **Fixed.** Check 1 lexes instead of masking; the masker survives only for the two checks where over-masking is a loud false positive, with a test pinning that direction |
| 7 | Low | `COMMAND_ERRORS` pinned nine samples against ten variants, so a code could have rendered `""` and "renders every command error" would still pass | **Fixed, and generalised.** All twelve codes are covered and asserted bidirectionally against `COMMAND_ERROR_CODES`; every sample table in `codes.test.ts` is now checked for completeness against its wire union **at compile time** |

The review additionally **confirmed as non-findings**: the capability decision (`"permissions": []`
is correct for an application command from a local origin with no ACL manifest); the architecture
rule; `identityWrongDocument`'s dictionary entries; and the source scanner failing loudly on a
rename.

## Phase 1b-2a review disposition

The review is [`docs/reviews/phase-1b-2a-ipc-surface.md`](docs/reviews/phase-1b-2a-ipc-surface.md).
Ten findings; **all ten closed before the phase was recorded complete**, so no commit holds a
demonstrated defect. The full disposition with the fix for each is `1b-2a-notes.md` §15.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | `identityRecovery()` treated every stale revision as recoverable, and the claim that `DocumentPath` "survives a reparse" and keeps the selection was **false** — a sequence step is `PathSegment::Index(usize)`, so deleting an earlier match silently re-points the selection at a different one | **Fixed.** The three answers are returned as data; the false sentences are gone from `errors.ts`, `types.ts`, `error.rs`, `commands.rs`, the notes **and this file**; `a_document_path_is_positional_so_a_deletion_repoints_it` fails if the claim is reinstated |
| 2 | High | A non-UTF-8 path made serde's `PathBuf` serializer reject the response *after* the command returned `Ok`, so the webview got serde's prose instead of `{code, operands}` — falsifying `commands.rs`'s own module claim | **Fixed** in the core: `crate::wire::WirePath` backs all five wire path fields and all four path operands. Four tests, each asserting the premise (bare `PathBuf` **does** fail) before the fix |
| 3 | Med | `isCommandError()` narrowed to full operand types after checking only `code`, so `{code: 'identityStaleRevision'}` yielded guaranteed-`string` fields that were `undefined` | **Fixed.** A `COMMAND_ERROR_OPERANDS` table validates required operands and primitive shapes; surplus allowed for forward compatibility. The test that licensed the unsoundness was rewritten |
| 4 | Med | `wire_contract.rs` silently passed three concrete divergences: required→optional (`?` was stripped), nested operand names and types, and every frontend *error* interface | **Fixed** all three; hole 2 rewritten to the one thing left (the type text of read-model properties), with its owner named |
| 5 | Med | The no-mutating-command oracle was **one-directional** — registering `commands::save_match` and changing nothing else left the test green, though its name claims to check registrations | **Fixed.** `generate_handler!` parsed independently, compared both ways, six forbidden names asserted absent from both sets. The disabling experiment was run: the test failed, then reverted |
| 6 | Med | `CommandError`'s own enumeration was not mechanically exhaustive, and the notes claimed it was; `identityRecovery()`'s `default` absorbed new variants | **Fixed.** The enumeration test reads `error.rs`'s enum block; `default` → `const unhandled: never`; both false sentences corrected |
| 7 | Med | `DocumentId` is `u64` typed as TS `number`, so values above 2⁵³−1 collide | **Fixed** by stating and **asserting** the invariant: `MAX_EXACT_WIRE_INTEGER` checked at `mint()`, with a `#[should_panic]` test and a full numeric-field audit in notes §16 |
| 8 | Low | Three test names overclaimed what their bodies established — the project's own standing rule | **Fixed**: names narrowed, bodies strengthened (the exports set is now read from the module) |
| 9 | Low | The disabling-experiment table presented historical runs as evidence that the committed state cannot reproduce | **Fixed by honest relabelling.** A–G are marked unreproducible; H–M are new and were run against committed code |
| 10 | Low | Vitest callbacks breached the literal reading of CLAUDE.md's JSDoc / closing-comment rule | **Decided both ways** and recorded (notes §14): closing-bracket comments applied, per-callback JSDoc explicitly exempted with reasoning and an escalation path |

Codex additionally **confirmed as non-findings**: the core has no tauri edge; no mutating command
leaked in; `dispatch_check.rs`'s ACL claim is sound for Tauri 2.11.5 because `get_ipc_response` runs
the same `Webview::on_message` branch as production; the session mutex has no re-entrancy path; no
real-corpus content appears anywhere; and no user-facing prose escapes via `Display`.

## Phase 1b-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-1b-1-shell-and-i18n.md`](docs/reviews/phase-1b-1-shell-and-i18n.md). Nine
findings, **two High**, and the phase was held open until every one was dispositioned — so, as with
every phase since `8989c16`, no commit holds a demonstrated defect.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High** — the bundle declares macOS 11.0 but targets `safari16` and calls `Object.hasOwn` (Safari 15.4+), so the first render throws and the window is blank | **Closed, both sides.** The floor is now `13.0`, the release that ships Safari 16, because the *target* is the deliberate value and the plist was the mistake — `vite.config.ts`'s own comment already said the build "may assume a current macOS". `Object.hasOwn` → `Object.prototype.hasOwnProperty.call`, which costs nothing in the one function that runs before anything can report an error. `webview-floor.test.ts` fails if the two ever disagree again. |
| 2 | **High** — `core:default` is not minimal; it grants `image:allow-from-path` and `image:allow-rgba`, so a compromised renderer can read local image pixels, against the phase's claim of "no filesystem permission" | **Closed.** `"permissions": []` — provably sufficient, because the 1b-1 frontend calls no Tauri API. **Verified empirically by launching a production-mode binary**, not by argument. The notes §6 sentence that described `core:default` as minimal is corrected. 1b-2 adds back permissions one at a time, never a `*:default` set. |
| 3 | **Medium** — five hardcoded user-facing strings against CLAUDE.md §2 | **Split, and the split is on file.** *Fixed:* `NSHumanReadableCopyright` was the English sentence "MIT licensed. See LICENSE.", which Finder shows under a Spanish locale — it is now `© 2026 ccarpiog · MIT`, and it was never on the §8 exception list, so no argument had ever been made for it. `index.html`'s hardcoded `lang="en"` is now set from the detected locale by `bootstrap()` **before** mount, with an ordering test. *Upheld:* the two developer-facing messages (a missing `#app`, a webview that cannot be created) — both fire only where no interface exists to render a message **in**, and neither is user-triggerable. *Open:* the macOS menu — see the disagreement below. |
| 4 | **Medium** — the production CSP allows `'unsafe-inline'` styles, so injected markup can hide the interface and paint its own | **Closed.** Production `style-src 'self'`; the relaxed policy moved to `devCsp`, which is where it was ever true. The production bundle emits an **external** CSS asset, so it renders fully styled without it — checked, not assumed. |
| 5 | **Medium** — "the runtime tests cover whether a Spanish value is actually Spanish" is false; they establish only non-identity | **Closed as a correction to the claim, not to the code.** Renaming `language.label` to `"Sprache"` passes every check. The suite is renamed to the untranslated-value heuristic it is, and §2, §3 and two module doc comments are corrected with that counterexample written into them. Establishing that a value is *Spanish* needs a bilingual review gate and is recorded as a hole. |
| 6 | **Medium** — "follows the system" stops following: `system` is computed once, so a platform language change is ignored until restart | **Closed.** `createLocaleState` takes a tag *reader* and re-negotiates on `languagechange`; `dispose()` detaches the listener. Two directions are pinned, and the second matters more: a user who **chose** a language is never overridden by their OS. Experiment F breaks exactly that and fires. |
| 7 | **Low** — duplicate JSON keys bypass every compile-time and runtime check; a translator editing the first occurrence is silently discarded | **Closed.** `scripts/lint/duplicate-json-keys.ts` reads the **raw file text**, because a JSON parse cannot see it by construction. Proven on `es.json`: the compiler stayed silent, the other 22 dictionary tests passed, and only the scanner named the line. |
| 8 | **Low** — `the_core_crate_is_linked_and_callable` names a stronger property than it checks; the only core reference is inside `#[cfg(test)]` | **Closed by renaming**, which is the honest fix: `the_core_dependency_is_callable_from_the_test_target`, with a doc comment saying a production build does not yet reference the core. The notes already admitted this at §6; now the **name** admits it too. This is R24 reaching a test's name rather than its body. |
| 9 | **Low** — the required Node runtime is neither pinned nor declared; Vite 8 needs `^20.19.0 \|\| >=22.12.0` | **Closed.** `engines.node` declared, `.nvmrc` pins 26.5.0, and the notes record which runtime the suite was verified on. `engine-strict` deliberately not set — reason in notes §1. |

**One defect the review did not reach, found by the fix round, and it invalidated the phase's own
evidence.** `src-tauri/Cargo.toml` declared no `custom-protocol` feature, and `tauri::is_dev()` is
literally `!cfg!(feature = "custom-protocol")` — so every build loaded the dead `devUrl` and the window
1b-1 reported as "launched and stayed up" was **blank**. `npm run tauri build` could not have succeeded.
Separated from a frontend exception by planting a static `<h1>` in `dist/index.html` and watching that
fail too. **The lesson is R32's:** a process that stays up is not a screen that renders.

**One live disagreement, recorded rather than resolved by silence.** The reviewer's position is that the
phase should not close while the macOS menu is unlocalized, since CLAUDE.md §2 is non-negotiable. The
rebuttal is that Tauri v2 builds the default menu in Rust, so localizing it means either Spanish strings
in Rust — which plan §9 forbids in as many words — or handing labels across IPC, which needs a command,
which is 1b-2 by design. **1b-2 owes it**, it is hole 1 of notes §9, and both halves of the argument are
written there so a later session can overrule this one on the evidence.

---

## Phase 1a review disposition

Review of record: [`docs/reviews/phase-1a-core-read-model.md`](docs/reviews/phase-1a-core-read-model.md).
Its verdict: **"hold the phase open"** — *"match identity is positional in practice, and the strongest
'no unknown key is lost' oracle cannot detect whole omitted mappings. Both violate explicit Phase 1a
gates."* It was right on both counts, and the phase was held open until all five findings were closed.
**No commit holds the demonstrated defect.**

| # | Finding | Disposition |
|---|---|---|
| 1 | **Match identity is positional after a reparse, and its test never performs a reorder.** `NodeId` is the parser arena index and `DocumentId` was the sorted-enumeration position, so exchanging two equally shaped matches hands `:a`'s identity to `:b`; separately, adding an alphabetically earlier file re-points a retained `DocumentId` at another file | **Adopted in full — this is D2v.** `MatchId` carries the parse's `ContentRevision` and `match_by_id` returns `Result<_, IdentityError>`; `DocumentId` comes from a monotonic session counter keyed by path. Both reviewer counterexamples are **retained tests**, and the mis-named test was renamed to what it actually does. Disabling experiments A and B reproduce the reviewer's two sequences verbatim with the guards removed. |
| 2 | **Keys nested under an unknown entry are neither modelled nor recorded, and the coverage oracle passes vacuously** — records exist only for mappings the schema walk chose to scan, so omitting one entirely is invisible to `all()` over emitted records | **Adopted in full — this is D2w.** The unknown entry's whole value span is recorded, the claim is restated as *named or inside a recorded undescended span*, the **library** checks it (`unaccounted_keys` → `KeyNotAccountedFor`, per R24), and the test oracle now derives its expectation from the **document tree**. Experiment C1 suppresses a record's *creation* and fails both corpus sweeps — which the old audit could not see. |
| 3 | **`load_from_source()` lets an unsaved draft replace Rust's disk snapshot**, contradicting plan §6.4's ownership split; and the API is not yet one-to-one wrappable (`WorkspaceError` unserializable, no `get_match`) | **Adopted in full.** The method is **deleted**, not hidden — its one test now compares `project_source` against the disk path. `WorkspaceError` and `DiscoveryError` gained hand-written code-plus-operand `Serialize`; `Workspace::get_match` added. `SourceDocument` stays unserializable **by design**: `DocumentView` is what crosses the boundary. |
| 4 | **The D2u oracle has a false-negative branch** — text is compared only when `scalar.decoded` is true, so `text = "true"` with `decoded = false` over source `on` escapes | **Adopted.** Text is compared whenever `decode()` succeeds, plus a clause refusing a decodable scalar labelled undecoded. Experiment D constructs the reviewer's exact pair. No production violation was demonstrated; the oracle's *claim* was broader than its enforcement, which is the same defect class in a smaller box. |
| 5 | **Non-scalar items inside a scalar sequence are diagnosed but dropped**, contradicting the doc comment and shifting the positions of the remaining elements | **Adopted, by fixing the implementation rather than the documentation.** `triggers`, `search_terms`, `depends_on` and `imports` are `Vec<ValueView>` and elide such an item **in place**, so positions never shift. Losing positional correspondence in a read model is the kind of thing a later phase silently builds on. |

**Pinned counts moved: none.** All 33 `SYNTHETIC_PROJECTIONS` rows are byte-identical after the fix
round — an elided item contributes no scalar, and neither did a dropped one — which is the desired
outcome for a fix that changes structure rather than content. The new diagnostics are pinned at 0.

**The lesson, and it is the third occurrence.** R24's failure mode — a property whose only home is a
test file, or a test whose name claims more than its body checks — was found here by a *reviewer* rather
than by the phase. Two of the five findings are instances of it: a test called
`…survives_a_reordering` that never reordered, and a coverage audit that could only see what the
implementation had already chosen to tell it. **Both were closed by moving the check into the library
and re-deriving the test's expectation from the document tree**, which is the same shape as every prior
closure of R24.

---

## Phase 0c-3b-2b review disposition

Review of record: [`docs/reviews/phase-0c-3b-2b-the-gate.md`](docs/reviews/phase-0c-3b-2b-the-gate.md).
Its verdict: **"The gate is not genuinely passed."** It was right, and the phase was held open.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — E5 is a production safety hole and blocks the gate.** A removal swallowing an unowned following blank line passes every production check, and `bytes_outside_the_replacements_match` *authorises* it from the envelope's own declaration; only the test sweep saw it | **Adopted in full — this is D2t.** `RemovalCarriesMoreThanTheEntry` derives the entry's allowed line runs from the key/value frontier, the leading-trivia rule and D2o's blank-run rule, consulting nothing `removal_envelope` produced. E5 re-run is now rejected **by production**; E5b shows the sweep's bound still fires independently. |
| 2 | **Medium — the tag oracle has concrete false negatives, and "0 gaps" is circular** (the test compared the function against a predicate calling it) | **Adopted in full.** All four named errors fixed — `2001-1-1`, oversized sexagesimals, `+0o17`, and the `012` documentation (the *code* was verified correct, so the docs were corrected instead). A second independent transcription of the 1.1 half now sweeps 500 000 generated values with **zero disagreements**, plus 77 hand cases. §4.1's overstatement withdrawn. |
| 3 | **Medium — the matrix proves document co-occurrence, not operation × construct interaction**; `RefusedOnly` is 8 not 5; and the real sweep is *sampled* (`REAL_CORPUS_STRIDE`) | **Adopted in full.** Attribution is operation-local for structural axes; four rows moved `Applied` → `RefusedOnly`; the true count is **18**, enumerated cell by cell and asserted against the measurement. **The stride is gone** — the sweep is exhaustive, bought by the memoisation R19's row records. |

The third finding is the one worth remembering: the checkpoint had explicitly instructed *"memoise rather
than thin the sweep"*, and the phase thinned it anyway, which turned the plan's exit criterion into a
weaker claim wearing the criterion's words. Memoising made the sweep **exhaustive and twice as fast**, so
the instruction was not merely principled — it was cheaper.

---

## Verification — Phase 1c-2a

Every command below was run by the orchestrator after the fix round, not taken on the worker's report.

| Command | Result |
|---|---|
| `npm test` | ✅ **412 tests across 24 files**, 0 failed |
| `npm run check` | ✅ 366 files, **0 errors, 0 warnings** (run with `--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 98.33 kB |
| `cargo test --workspace` | ✅ all suites pass, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `rg render_probe src src-tauri/src scripts` | ✅ **no match** — the temporary R32 probe is fully reverted |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **218 and 218** — the key parity finding 4 was about, re-derived rather than quoted |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| Every §3.3 field renders when the source has it | ✅ | `describeMatch()` collects all 22; the equality test pins the emitted set against `DetailFieldName` |
| §3.4's nine variable types and §3.5's forms render | ✅ | `describeVariable()`; the window reading shows three variable cards and a form's fields |
| A scalar renders as source text, never an inferred type (D2u) | ✅ | **Seen on a screen**: `word: on` renders as `on`; no checkbox exists in the pane |
| Absent is distinguished from empty | ✅ | Seen side by side on two screens; the one wire-level exception is stated as hole 2 |
| No hardcoded user-facing string | ✅ | Both lints pass, **and** R31's four blind spots are enumerated by name in the notes §8 rather than assumed clean |
| The five uncalled accessors get real callers | ✅ | `tTriggerKind`, `tContentKind`, `tVariableKind`, `tScalarStyle`, `tUnknownReason`, plus the new `tValueKind`, `tDetailField`, `tUnknownCount` |
| A claim about a screen is backed by a reading of a screen (R32) | ✅ | Two readings, both languages, the second **re-taken after the fix round changed the component** |
| No real config content anywhere | ✅ | The readings ran against a hand-written synthetic config with `XDG_CONFIG_HOME` **and** `HOME` overridden |

**What the verification does *not* establish**, carried forward as stated holes: no component is
rendered by any automated test; no pixels, so the indentation and the bullet are known to exist in the
markup and the stylesheet but not known to *paint*; `Alias`, `Elided` and a non-scalar mapping key are
unit-tested and were never on a screen; and nothing establishes that the 50 new Spanish values are
Spanish beyond one bilingual reading.

## Verification — Phase 1c-1

Every command below was run by the **orchestrator** against the working tree, **after** the review fix
round and after the R32 readings were re-taken, not reported by a worker. All exit 0.

| Command | Result |
|---|---|
| `npm run check` | 364 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **354 passed** across 23 files (from 318 across 21) |
| `npm run build` | ok — `dist/assets/index-*.js` 81.30 kB |
| `cargo test --workspace` | 16 suites, **0 failed** anywhere |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x) |

Two things were checked by the orchestrator **independently of any worker's claim**, because both are
claims a passing test cannot make:

- **The IPC layer really is in the shipped bundle.** `rg -o` over `dist/assets/*.js` finds
  `open_workspace`, `list_documents`, `get_document`, `get_match` and `set_menu_labels`. `document_text`
  is **absent**, which is correct — the raw YAML viewer is 1c-2 and nothing calls it yet. This is R32's
  first half, the oldest debt in the project, discharged by measurement.
- **The core's search haystack really does cover plan §8.1's five fields.** Read out of
  `build_search_text()` directly rather than taken from the phase's summary: trigger, `triggers`, `regex`,
  label, content, comment and `search_terms`.

The R32 window readings are `docs/decisions/1c-1-notes.md` §10, and they were **re-taken after the fix
round** on the orchestrator's instruction, because that round edited `Sidebar.svelte` and
`DetailPane.svelte` and **nothing in this project renders a Svelte component in an automated test**. A
runtime error in either would have produced an empty pane that all 354 tests pass straight through.
`git status --short` after the readings is byte-identical to before them: the temporary probe is gone.

## Verification — Phase 1b-2b

Every command below was run by the **orchestrator** against the working tree, **after** the review
fix round, not reported by the worker. All exit 0.

| Command | Result |
|---|---|
| `cargo test --workspace` | **544 passed, 0 failed** (was 514) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds (D2x's check, not the withdrawn `rg -c tauri Cargo.lock`) |
| `npm run check` | 344 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **214 passed** (was 104) |
| `npm run build` | ok — 60.79 kB JS, 1.59 kB CSS |

**Six claims were checked by hand rather than taken from a worker's report**, each because it is a
rule a phase can quietly undo:

- `src-tauri/capabilities/default.json` is still **`"permissions": []`**, and its `description` now
  carries the reasoning so the next phase cannot re-open it by accident.
- **Six** `#[tauri::command]` attributes exist — five in `commands.rs`, one in `menu.rs` — and the
  `generate_handler!` list holds exactly those six. None mutates a file.
- `CommandError` still has **no `Display` impl** anywhere in the crate.
- `syn` and `proc-macro2` are **`[dev-dependencies]` of `src-tauri` only**. `cargo tree -p
  espansoconfig-core -e normal,build,dev -i syn` shows the core reaches `syn` **only** through
  `serde_derive` and `thiserror-impl`, which are proc-macros and were already there before this
  phase. The core's own `Cargo.toml` names neither `syn` nor `tauri`.
- The dictionaries hold **138 keys each**, 111 under `code.` and 16 under `menu.`, with **8 values
  identical across the two files** — matching the exception list exactly, no silent growth.
- **Corpus privacy (D1) intact**: no `corpus/real` path appears anywhere in the tree status, and
  `git check-ignore -v` still resolves the real corpus to `.gitignore:107`.

**The Spanish was read, by a reader, and it is Spanish.** Hole 9 correctly says nothing automated
establishes this — the untranslated-value check establishes only non-identity. A sample of the
`menu.*` block and the first `code.diagnosticCode.*` entries was read in full: the register is right,
the quotation marks are Spanish (`«…»`, not `"…"`), the phrasing is idiomatic rather than calqued
(*"No se ha podido indexar este archivo"*, *"así que"*), and the menu labels are **Apple's own**
Spanish strings — `Edición`, `Ocultar los demás`, `Mostrar todo`, `Seleccionar todo` — rather than
literal translations of the English. This is a **sample read by one reader, not a review of all 111
values**, and hole 9 stays open on those terms.

**R32 was discharged for the menu, and re-run after the fix round changed the thing it measured.**
The fix round altered `set_menu_labels`' signature and the main-thread step, which made the first
reading a description of a slightly different program — so it was taken again against the current
binary rather than carried forward:

- **Spanish** (`-AppleLanguages '(es-ES)'`): the real macOS menu bar read out of the accessibility
  tree gives `Apple, espansoconfig, Edición, Ventana`, with `Acerca de espansoConfig` … `Salir de
  espansoConfig` in the app submenu and `Deshacer, Rehacer, Cortar, Copiar, Pegar, Seleccionar todo`
  under `Edición`.
- **English** (`(en-US)`): `Apple, espansoconfig, Edit, Window`, likewise complete.
- **Every answer is byte-identical to the pre-review reading**, which is what makes it a regression
  check rather than a fresh anecdote.
- **The one-shot channel does not deadlock**: the menu is installed, so the closure ran and the
  channel delivered, and `sample <pid>` shows the main thread idle in `__CFRunLoopServiceMachPort`
  rather than parked in `recv`. `Ok(())` now genuinely means *installed*.
- **The untyped envelope parsed** — a refusal would have left Tauri's `File, Edit, View, Window,
  Help` default standing, which is exactly the failure the first reading could not have
  distinguished.

**Two things were not verified at runtime, and both are recorded as holes rather than assumed.** The
**live** locale switch did not reproduce this time: `System Events` reports 0 windows for the process,
so there is no `window 1` to find the picker in, while `CGWindowListCopyWindowInfo` shows the window
on screen at 1063×685. That is not a code fault, and the discriminating test says so — the
**development-mode** binary, which never runs the frontend and never calls `set_menu_labels` at all,
reports the same 0 windows. Closing it needs a bundled `.app`, which is Phase 5. And
`invalidMenuLabels` cannot be reached without a skewed frontend or a webview console; it is covered by
three `dispatch_check` tests through the real dispatcher instead. `1b-2b-notes.md` §12.5 states both.

## Verification — Phase 1b-2a

Every command below was run by the orchestrator **after** the review fix round, not reported by the
worker. All exit 0.

| Command | Result |
|---|---|
| `cargo build --workspace` | ok |
| `cargo test --workspace` | **514 passed, 0 failed** (core 478, was 471; shell 36, was 1) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds (D2x's check, not the withdrawn `rg -c tauri Cargo.lock`) |
| `npm run check` | 336 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **104 passed** (was 97) |
| `npm run build` | ok — 38.87 kB JS, 1.59 kB CSS |

Three claims were checked by hand rather than taken from the worker's report, because each is a rule
a phase can quietly undo: `src-tauri/capabilities/default.json` is still `"permissions": []`; exactly
five `#[tauri::command]` attributes exist and `rg` finds no forbidden name in `main.rs` or
`commands.rs` outside a comment; and `CommandError` has no `Display` impl anywhere in the crate.

**R31 was honoured explicitly, and a clean lint run is not the evidence.** `scripts/lint/hardcoded-strings.ts`
scans `.svelte` markup only, and this phase's user-facing strings would live in `.ts` — exactly the class
it cannot see. The check was done by hand; `classifyFailure()`'s `detail` field is documented as a
**developer** string that must never be rendered, and giving the unexpected arm its one generic
dictionary key is 1b-2b's job.

## Verification — Phase 1b-1

Every command below was run by the **orchestrator** against the working tree, **after** the review fix
round, not reported by the worker:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **472 passed, 0 failed, 0 ignored**, across 16 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the rule holds (D2x) |
| `npm run check` | exit 0 — svelte-check, **0 errors 0 warnings** over 328 files, run with `--fail-on-warnings` |
| `npm run build` | exit 0 — 38.87 kB JS / 1.59 kB CSS, the CSS **external** (which is what makes the production CSP tightenable) |
| `npm test` | exit 0 — **71 passed** across 8 files (45 across 5 before the fix round) |
| `cargo test -p espansoconfig-core --test corpus_integrity` | exit 0 — 17 passed, the fixtures are untouched |

Test count moved 471 → **472**: one Rust test, and it is named for exactly what it can fail on —
`the_core_dependency_is_callable_from_the_test_target`. It is **not** evidence that a production build
references the core, because that reference lives inside `#[cfg(test)]` and no production one exists
yet; the review's finding 8 is that the earlier name (`the_core_crate_is_linked_and_callable`) claimed
otherwise. **No Phase 0 or 1a test was ignored, weakened or deleted**, and the only tracked files the
phase modified are
`Cargo.toml` (one workspace member, two workspace dependencies) and `Cargo.lock`. Nothing under
`crates/espansoconfig-core/src/` or `tests/` changed at all, which is why the 471 carry over unexamined.

**Architecture rule re-verified by the new check** (D2x): `cargo tree -p espansoconfig-core --depth 1`
lists `saphyr-parser`, `serde`, `sha2` and four dev-dependencies. No tauri, direct or transitive.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and no `node_modules/` or `dist/` path — the pre-existing ignore rules already
covered the frontend.

**Independently spot-checked by the orchestrator**, because the type-level i18n guarantee is the one
claim in this phase that a passing test suite could not establish on its own:
`src/lib/i18n/dictionaries.ts` really does bind `es.json` to `ExactDictionary<typeof es>`, and the
`Record<Exclude<keyof T, TranslationKey>, never>` half really is what rejects a surplus key. The
`identifier` in `src-tauri/tauri.conf.json` is `cc.carpio.espansoConfig`, and `Info.plist` declares
`CFBundleLocalizations`. **The four review fixes were checked in the files rather than taken from the
report**: `"permissions": []`, `minimumSystemVersion: "13.0"`, `'unsafe-inline'` present **only** in
`devCsp`, and `custom-protocol` declared in `src-tauri/Cargo.toml`.

**Seven disabling experiments, each broken, fired and reverted** (A–G in the notes): the macOS floor
dropped to 11.0; a duplicate `app.name` in `es.json`; the document language set after mount rather than
before; `index.html` shipping `lang="es"`; `refreshSystem()` emptied (four tests fired); `refreshSystem()`
also clearing the override; and a no-op `dispose()`. Every new test in this round was shown able to fail.

---

## Verification — Phase 1a

All four run by the orchestrator against the working tree, **after** the review fix round:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **471 passed, 0 failed, 0 ignored**, across 15 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |

Test count moved 465 (baseline `37cb48d`) → 465 (implementation) → **471** (fix round): +3 projection,
+3 workspace. No test was ignored, weakened or deleted. The suite also passes with
`tests/corpus/real/` absent.

**Architecture rule re-verified**: `rg -c tauri Cargo.lock` finds nothing — `espansoconfig-core` still
has no tauri dependency, direct or transitive, after gaining `serde`.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and every real-corpus figure is computed rather than hard-coded.

**The load-bearing Phase 0 files were checked by the orchestrator directly**, because a change there is
more dangerous than anything in `model/`: the diffs in `syntax/{mod,node,trivia}.rs`, `patch/path.rs`
and `discovery.rs` are **derive-only** (`Serialize`/`Deserialize`), and `watch/mod.rs` adds one
hand-written `Serialize` emitting the revision as its 64-character hex string rather than as 32
numbers. No Phase 0 behaviour changed, and all 465 Phase 0 tests pass unmodified. The reviewer reached
the same conclusion independently.

**The projection sweep:**

| | Synthetic | Real |
|---|---|---|
| Keys accounted for | 546 | 566 |
| …named (modelled or recorded) | 518 | 566 |
| …inside a recorded undescended span | 28 | 0 |
| Unaccounted keys | 0 | 0 |

---

## Verification — Phase 0c-3b-2b

All four run by the orchestrator against the working tree, **after** the review fix round:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **439 passed, 0 failed, 0 ignored**, across 13 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |

Test count moved 423 (baseline `d40ec0e`) → 434 (implementation) → **439** (fix round). No test was
ignored, weakened or deleted at any point. The suite also passes with `tests/corpus/real/` absent.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and every real-corpus figure is computed rather than hard-coded.

**The gate sweep**, exhaustive over both corpora:

| | Synthetic | Real |
|---|---|---|
| Attempts | 2 080 | 1 998 |
| Applied | 1 696 | 1 851 |
| Verification failures | 0 | 0 |

48-cell axis×operation matrix, **no `Absent` cell**, 18 `RefusedOnly` each enumerated. Refusals per hazard
family, attempts / applications: merge keys 23/0, aliases 9/0, anchors 31/0, explicit keys 11/0, tags 9/0,
duplicate keys 15/0, multi-document 33/0, flow comments 18/0.

**Runtime, after memoising `ownership.rs` (R19):** gate binary **34.3 s → 16.9 s** while becoming
exhaustive; whole suite **87.9 s → 39.4 s**.

---

## Verification — Phase 0c-3b-2a

All four run by the orchestrator against the working tree, **after** the review fix round:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **423 passed, 0 failed, 0 ignored**, across 12 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |

Test count moved 383 (baseline `e712467`) → 411 (implementation) → **423** (fix round). No test was
ignored, weakened or deleted at any point.

**Privacy re-verified after the phase**, per `CLAUDE.md` §1: `./scripts/sync-real-corpus.sh` reports its
ignore-rule probe verified, `git check-ignore -v` resolves the real corpus to `.gitignore:107`, and
`git status --short --untracked-files=all` shows **no path under `tests/corpus/real/`**.

**Headline sweep figures** (synthetic pinned per fixture with the table asserted to cover the corpus
exactly; real corpus computed, never hard-coded, and skipping cleanly when absent):

| Sweep | Synthetic | Real |
|---|---|---|
| Moves | 2 571 attempted, 1 790 applied | 340 attempted, 126 applied |
| Structural edits | 2 974 attempted | 1 856 attempted |
| Scalar edits | 5 700 attempted, 5 359 applied | 2 004 attempted |

New refusal counts: `MoveWouldTerminateTheFinalLine` 3, `MoveSeam::CarriedRunsJoin` 2,
R23-for-moves 3, `MoveWouldExtendAKeptBlock` 8 — synthetic; **0 in every new category on the real
corpus**, which is unchanged at 13 files / 340 attempts / 126 applied across both rounds.

The corpus grew 30 → 32 fixtures; every pinned count that moved is retabulated with its delta attributed
to a named fixture in `docs/decisions/0c-3b-2a-notes.md` §5.2. One regression is deliberate and pinned:
`block-scalar-terminal-spaces.yml` now offers **no applied move at all**, which is the measured cost of
refusing the EOF rotation.

---

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

**Phase 1c-2a is complete. Start Phase 1c-2b — the app's judgements, and Phase 1's exit.**

The detail pane now renders the match itself: §3.3's fields, §3.4's nine variable types, §3.5's forms
and the entries the projection did not model, all as source text, all seen in a running window in both
languages. **What it does not yet do is say anything *about* that snippet or the file behind it.**
1c-2b does, and the plan's stated exit for Phase 1 lands there: *the owner can browse their entire real
config and every snippet renders correctly.*

Concretely, and in roughly this order:

1. **Surface `HazardKind`** where the visual editor cannot preserve a construct. Ten strings exist
   (`tHazard`) and **have no caller at all**. `MatchView.blocking_hazard`, `MatchView.safely_editable`
   and `DocumentView.hazards` are all live on the wire and nothing reads any of them. This is where a
   read-only browser starts making claims about *editability*, so it is the sub-phase's real risk.
2. **Surface the diagnostics.** `tDiagnostic` is 22 strings with **no caller**, and
   `DocumentView.diagnostics` is live. The four deliberately invalid fixtures yield typed diagnostics
   and still expose their raw text.
3. **The raw YAML viewer — and note the correction.** The earlier claim here, that `document_text` is
   "the one command with no frontend caller, tree-shaken out of `dist`", was **wrong**. `document_text`
   is a `Workspace` method and **not a registered Tauri command at all**: `main.rs` registers six and it
   is not among them. So this is a command, a `types.ts` mirror entry and updates to
   `wire_contract.rs` and `dispatch_check.rs` — meaningfully more than "add a caller". Phase 3 owns
   CodeMirror; 1c-2b needs only to display text faithfully.
4. **Fix the load-failure conflation**, named for 1c-2 by 1c-1 and still open. A file that could not be
   read shows the same `–` / "Not read yet" marker as a profile nobody has projected, conflating *could
   not* with *have not*. `browser.loadFailures` already holds what is needed to tell them apart.
5. **Consider showing `MatchView.source_text`** — the match's own bytes, D2u-safe because it is source
   text. It stops at the match's mapping, so the comment above a snippet is not in it.

**One thing 1c-2b inherits as a known lie-by-omission, and it is the shape of this sub-phase's whole
risk.** An unmodelled entry's **value is not on the wire**: `UnknownEntry` carries `value_kind` and
`value_span` but no text. 1c-2a's review caught the pane claiming it was "shown as written" and the
strings now claim only that the entry is *recorded and left untouched*. Displaying it needs an exact
**Rust-sliced** source span — byte slicing stays in Rust, because JavaScript string indices are UTF-16
units and this project's premise is byte fidelity. See `1c-2a-notes.md` hole 13.

**What 1c-2b inherits, and should not rebuild.**

- **A detail pane, and the rule that keeps it thin.** New work deciding *what* appears goes in
  `src/lib/browser/detail.ts` beside `describeMatch()`; the component gets the walk. The text scan at
  the end of `detail.test.ts` is where a new accessor gets its cheap guard.
- **Seventeen reactive typed accessors** — 1c-1's fourteen plus `tValueKind`, `tDetailField` and
  `tUnknownCount`. **A component calls one and never builds a key.** As of 1c-1 that is enforced rather
  than trusted: `scripts/lint/built-translation-keys.ts` refuses any `t(` whose key is not written
  literally, and it found a two-phase-old instance the moment it was written.
- **218 dictionary keys**, `en.json` still the schema, and the untranslated-value exception list now
  carries `browser.detail.section.variables` by name.
- **A working data path.** `browser.status`, `browser.documents`, `browser.sidebar`,
  `browser.scopedMatches`, `browser.visibleMatches`, `browser.selected`, `browser.selectedMatch` and
  `browser.loadFailures` are all live, and the selection is already R27-correct.
- **A plural helper.** `src/lib/i18n/plural.ts` selects a `.one` / `.other` key pair on `count === 1`.
  Any new counted string uses it; `"1 snippets"` was a real defect on a real screen.
- **A notice area, selection-scoped.** If 1c-2 needs somewhere for a non-blocking failure,
  `1c-1-notes.md` hole 5 is the shape of the work: `menuUnavailable`, `menuBuildFailed` and
  `invalidMenuLabels` still have a string and no screen.

**Five rules 1c-2b is most likely to break.**

- **Do not claim on screen what the app does not do.** New in 1c-2a and it is this sub-phase's central
  risk, because 1c-2b's entire content *is* claims: a hazard says a construct cannot be edited safely, a
  diagnostic says a file is wrong. 1c-2a's own Medium 1 was a sentence saying an entry was "shown as
  written" beside a rendering that showed only its key. **Before writing a string, check that the data
  behind it exists** — `UnknownEntry` had no value text at all, and no amount of careful wording in the
  component would have found that.
- **Never hardcode a user-facing string** (CLAUDE.md §2). `tHazard` and `tDiagnostic` are 32 strings
  between them, and they are the last two namespaces with no caller.
- **R31 — a clean lint run is not evidence.** `scripts/lint/hardcoded-strings.ts` sees `.svelte`
  **markup** only: not `<script>` bodies, not `{'literal'}`, not `.ts` constants, not props. 1c-2a
  enumerated its four blind spots by name in `1c-2a-notes.md` §8 rather than assuming them clean; do the
  same.
- **Nothing establishes that any of the Spanish strings is Spanish.** The untranslated-value check
  establishes non-identity. This now matters more than it ever has: the strings are on a screen, 1c-1
  added 35 and 1c-2a added 50. A bilingual reader is the only thing that closes it. The one defect found
  here so far — two different Spanish words for one concept, one above the other on screen — was found
  **by reading a screen**, which remains the only instrument that has ever caught anything in this area.
- **Nothing renders a Svelte component in an automated test** — `1c-1-notes.md` hole 1, and the reason
  the R32 readings had to be re-taken after the fix round. A component that throws produces an empty
  pane that the whole suite passes straight through. Either adopt a DOM and a component-testing library
  as a deliberate decision with its own costs, or read the window again. **Do not skip both.**
- **A held identity can go stale, and the UI is what holds identities** — R27. `match_by_id` returns
  `Result<_, IdentityError>`; a lookup crossing a `refresh()` may get `StaleRevision`, which means the
  **document moved on**, not that the match survived. Recovery is re-resolution, with three possible
  answers, and `identityRecovery()` returns them as data so a caller cannot skip one. `DocumentPath`
  is **not** a fallback identity — a sequence step is a position. **1c-1 got this wrong once already**
  and a reviewer caught it: the comparison that decided `sameMatch` was blind to `word`, to variables
  and to every non-primary content field. It compares `MatchView.source_text` now — the match's own
  bytes — and **must not be narrowed back to a display projection.**

**Phase 1 is read-only, so it cannot corrupt a file.** That makes it the right place to spend effort on
the UI shell, i18n and the Tauri boundary rather than on fidelity. The fidelity engine is done and
proven, and since 1a the read model is too.

### What Phase 1b inherits from 1a

- **The command surface already exists.** `Workspace::{discover, summary, list_documents,
  get_document, get_match, document_view, document_text, refresh, load_all, evict}` maps onto plan
  §6.4's read-only commands. `DocumentView` is what crosses the boundary; `SourceDocument` is
  deliberately not serializable.
- **A held identity can go stale, and the UI is what holds identities** — R27, **corrected at
  1b-2a**. `match_by_id` returns `Result<_, IdentityError>` and a lookup crossing a `refresh()` may
  get `StaleRevision`. Handle it; do not unwrap it. That code means **the document moved on** — not
  that the match survived. Recovery is *re-resolution*, and re-resolution has three possible answers:
  the same match, a **different** match, or nothing. `DocumentPath` is **not** a fallback identity: a
  sequence step is `PathSegment::Index(usize)`, a position, so an external edit that deletes an
  earlier match leaves the path resolving to a different one. The earlier wording here — "re-resolve
  by `DocumentPath`, the thing designed to survive a reparse" — was **false and is withdrawn**.
- **Scalars arrive as source text**, per D2u. There is no type to render, and no badge derives from a
  value.
- **`Deserialize` is derived on a named list only** — R28. Do not widen it without reading
  `docs/decisions/1a-notes.md` §9 hole 6 first.

### What the gate licenses, and what it does not

**Licensed:** UI work on the operations that exist — editing a scalar, adding and removing a field,
reordering matches **inside one sequence**.

**Not licensed, and each has a reason on file:**

- **Presenting a plain scalar's *type*** to the user. R16's open half: 31 synthetic and 65 real plain
  scalars resolve non-`str` under YAML 1.1, and the projection is not proven to match espanso's resolver.
  A UI that renders `on` as a boolean is making a claim this project has not earned. **This question is
  now decided — see D2u: the browser shows source text, never an inferred type.** Flagging a scalar as
  1.1-ambiguous *is* permitted, because that is a claim about risk rather than about meaning.
- **Moving a match between files or between sequences** (D2r). `ItemMove` is same-sequence only, and its
  "no re-indentation" proof does not transfer. Plan §8.4's drag-between-files needs its own operation.
- **Combining a move with any other edit in one batch** (R25).

### The two concerns this section used to raise before Phase 1, and where they stand

1. **R19's remaining half — ✅ answered by 1a.** The safe entry point re-scanned on every call, and
   ~20 ms per keystroke-triggered rescan is not viable for an editor. `crate::workspace` now builds the
   `SyntaxIndex` + `TriviaIndex` **once per `ContentRevision`** and serves views from the cache, pinned
   against an instrumented parse counter. What is *not* answered is incrementality: a document that
   changes is reparsed whole. That is fine for a browser and will need revisiting when Phase 2 edits on
   a debounce.
2. **Architecture rule (CLAUDE.md §3) — still absolute, and the check changed in 1b-1 (D2x).**
   `crates/espansoconfig-core` must never depend on `tauri`, directly or transitively.
   `rg -c tauri Cargo.lock` **is no longer a check** — `src-tauri/` exists, so the lockfile contains
   tauri legitimately and that command now finds matches whether or not the rule holds. The check is
   `cargo tree -p espansoconfig-core | rg tauri` finding nothing, and it was run and empty at 1b-1.
   Do not quote the old one-liner as evidence again.

### Standing rules that outlive Phase 0

- **R24 — a safety property that lives only in the test suite is not a safety property.** It has now
  occurred **three times, in three consecutive phases**, and the third (Phase 1a) was found by a
  *reviewer* rather than by the phase. Whenever a sweep proves something the engine relies on, ask
  whether the engine asserts it too. The closure condition is the sentence in
  `docs/decisions/0c-3b-2b-notes.md` §8.1: *the gate rests on no property whose only home is a test file.*
  **Its 1a corollary, which is cheaper to check and catches more:** read the test's *name*, then read its
  *body*, and ask whether the body could fail if the name's claim were false. `…survives_a_reordering`
  never reordered anything for a whole phase.
- **An audit that iterates what the implementation emitted is vacuous.** New in 1a (D2w), and it is R24
  seen from the other side: a coverage check that walks the records the code chose to produce cannot see
  a record the code declined to produce. Derive the expectation from the **document**, then compare.
- **R20 — the corpus is the weak link, eight occurrences.** A new refusal gets a fixture on **each side**
  of its condition, never one inside it. The eighth was `ExplicitKeyMapping`, which had no fixture at all
  for five phases while being counted as covered. **1a added two more deviations rather than fixtures** —
  the depth guard and the non-scalar sequence item are pinned by hand-written sources on both sides, not
  by corpus fixtures — and both are recorded as deviations in `1a-notes.md` §9 holes 4 and 10.
- **An oracle must be able to disagree.** Break the **engine** and check the oracle fires, not only the
  reverse.
- **A comparison that decides identity must see everything that distinguishes two things.** New in 1c-1,
  and it is R24's corollary aimed at a *predicate* rather than at a test. The selection's fingerprint was
  assembled from what the **list pane displays** — search text, badges, two shape codes — and was then
  asked to answer a question about **identity**. Two matches differing only in `word: true` / `word: false`
  were identical to it. The lesson generalises: when a comparison is built from a projection, write down
  what the projection drops, then ask whether the question being asked can survive those omissions.
- **A component that no test renders is a component nobody has run.** New in 1c-1. The whole frontend
  suite — 354 tests — passes without instantiating a single Svelte component, so a runtime error in one
  produces a blank pane the suite cannot see. Until that changes, **a claim about a screen needs a
  reading of a screen**, re-taken after any change to a component. 1b-1's blank window is the precedent.
- **An identity that is "designed to survive" something has to be shown surviving it.** New in 1b-2a,
  and the fourth occurrence of the pattern R24's corollary names. The phase wrote that `DocumentPath`
  was the identity designed to survive a reparse, **in three files and in this checkpoint**, without a
  test in which anything survived a reparse. The reviewer wrote the counterexample in four lines. Read
  the *name* of the property, then look for the test that could fail if it were false — the same check
  as R24's corollary, applied to a doc comment instead of to a test name.
- **Corpus privacy (D1) is absolute**, and matters more as the UI grows: no real config content in any
  committed file, screenshot, test name or report. Real-corpus counts computed, never hard-coded; its
  tests skip cleanly when absent.
- **Never hardcode a user-facing string** (CLAUDE.md §2). This is the rule Phase 1 is most likely to
  break, because a browser is almost entirely user-facing strings.

### The weakest pins, if a later phase touches them anyway

**R22** (`InconsistentEntryIndentation` pinned at 0 by argument, not construction — the weakest in the
table), **R25** (move verification is not compositional, so `OverlappingEdits` is never tested against a
move-versus-edit conflict), **R26** (`shares_a_line` is a unit test rather than a fixture), and R16's
1.2-core half, which has no second implementation where the 1.1 half now has one.

---

## Key paths

| Path | Why it matters next |
|---|---|
| [`src/lib/browser/`](src/lib/browser/) | **The data path 1c-2 renders from.** `workspace.svelte.ts` (`createBrowserState` — the four states, the two generation tokens, `installView`, `loadFailures`), `selection.ts` (**R27 in code**: a position to look at and `MatchView.source_text` to check with, never a display projection), `search.ts` (the matching rule; the haystack is the core's), `sidebar.ts` (grouping, `holdsMatches`, the pending count), `labels.ts`, `notices.ts`, `fixtures.ts` (neutral synthetic builders) |
| [`src/lib/browser/detail.ts`](src/lib/browser/detail.ts) | **The pane's model, and where 1c-2b's new logic goes.** `describeMatch()` (the trigger and content sides kept independent, options grouped by intent per plan §8.5), `flattenValue()` (all five `ValueView` arms, `Elided` included — a node the projection stopped at still gets a line), `scalarDisplay()` (D2u: `empty`, `ambiguous` and `style` are the only three things said about a scalar, and none of them is its meaning), `detailFieldKey()` (a template literal typed as `TranslationKey`, so a field with no string is a compile error **here**) |
| [`src/lib/components/DetailPane.svelte`](src/lib/components/DetailPane.svelte) | **Presentation only, deliberately.** Five snippets and one walk over `describeMatch()`'s output. Nothing in this repository renders a Svelte component in a test, so logic placed here is logic nothing can check — the phase caught itself doing it once and moved it out. The `•` for a sequence item is **markup, not a CSS `content:` rule**, so a window reading's `innerText` can see it |
| [`docs/decisions/1c-2a-notes.md`](docs/decisions/1c-2a-notes.md) | Phase 1c-2a's decision record: why the logic is not in the component (§2), absent vs empty and the one place the wire cannot tell them apart (§3), D2u in the pane (§4), the two sides never collapsed (§5), options by intent (§6), variables and forms (§7), **the strings and R31's four blind spots by name (§8)**, **the eighteen experiments including the two that did not fire (§9)**, what the phase got wrong (§10), **R32's readings and what they do and do not establish (§11)**, **the thirteen coverage holes stated as holes (§12)** and what 1c-2b inherits (§13) |
| [`docs/reviews/phase-1c-2a-detail-pane.md`](docs/reviews/phase-1c-2a-detail-pane.md) | The Phase 1c-2a review, dispositioned above. **No High findings.** Its Medium 1 is the one to remember: a sentence claiming an unmodelled entry was "shown as written" beside a rendering that showed only its key — the data to honour that claim **does not exist on the wire**. Its Low 3 is D2w recurring, caught in a test whose own comment claimed the property it did not have |
| [`scripts/lint/built-translation-keys.ts`](scripts/lint/built-translation-keys.ts) | **Why a code cannot reach the screen through a built key.** Refuses any `t(` whose key is not written literally — the rule CLAUDE.md §2 states and that 1c-1 broke twice. It found the second, two-phase-old instance the moment it existed. Note what it does **not** replace: R31 still applies to `hardcoded-strings.ts` |
| [`docs/decisions/1c-1-notes.md`](docs/decisions/1c-1-notes.md) | Phase 1c-1's decision record: the data path (§2), the four states (§3), search and whose rule is whose (§4), badges as D2u seen from the list (§5), **R27 in the selection (§6)**, the strings and where the lint cannot see them (§7), the **twenty-two disabling experiments including the one that did not fire (§8)**, what the phase got wrong (§9), **R32's five window readings and exactly what they do and do not establish (§10)**, **the coverage holes stated as holes (§11)**, what 1c-2 inherits (§12) and **the review disposition (§13)** |
| [`docs/reviews/phase-1c-1-shell-and-data-path.md`](docs/reviews/phase-1c-1-shell-and-data-path.md) | The Phase 1c-1 review, dispositioned above. Its High 1 is the sharpest finding in the project so far: a fingerprint that decided `sameMatch` while being blind to `word`, to variables, to form fields and to every non-primary content field. Its Low 2 is **R24's corollary for the fifth time**, and one of the eight tests it names was the very test the notes had cited as making an experiment unnecessary |
| [`src/lib/i18n/codes.ts`](src/lib/i18n/codes.ts) | **What a 1c component calls, and the one file it should not work around.** Twelve typed key builders and twelve `describe*` functions over the sixteen namespaces; the reactive `t*` wrappers are in [`index.ts`](src/lib/i18n/index.ts). The builders' template-literal return types make a **missing key a compile error here** rather than a blank label at the call site. Build a key by hand and you have opted out of that |
| [`src/lib/i18n/en.json`](src/lib/i18n/en.json) · [`es.json`](src/lib/i18n/es.json) | The two dictionaries — **138 keys each**, of which 111 are `code.*` and 16 are `menu.*`. `en.json` **is the schema**: the key set is derived from it, never declared separately. Eight values are identical across the two files and each is on the untranslated-value exception list **by name** |
| [`src-tauri/src/dictionary_contract.rs`](src-tauri/src/dictionary_contract.rs) · [`rust_source.rs`](src-tauri/src/rust_source.rs) | **Why a code cannot reach the UI without a string.** `rust_source` parses with `syn` and lexes with `proc-macro2` (dev-dependencies of `src-tauri` **only**); `dictionary_contract` compares the derived variant set against both dictionaries bidirectionally, and two further checks derive the *registry* from source — every `Serialize` enum in both trees, every union in `types.ts` — so a **new enum** is caught without anyone adding a row. What still escapes: an enum a `macro_rules!` expands to, demonstrated in `1b-2b-notes.md` §12.3 experiment 12E |
| [`src-tauri/src/menu.rs`](src-tauri/src/menu.rs) · [`menu_contract.rs`](src-tauri/src/menu_contract.rs) | The localized menu: three submenus, 16 labels, **zero user-facing string literals in the Rust**, pinned by a check that *lexes* the file rather than masking comment lines. `set_menu_labels` takes an **untyped envelope** and validates it itself so a version skew is `invalidMenuLabels` rather than serde's prose; `on_main_thread` waits on a one-shot channel so a build failure is `menuBuildFailed` rather than a silent `{ ok: true }` |
| [`src-tauri/src/wire_contract.rs`](src-tauri/src/wire_contract.rs) | Reads the `.ts` files as text and compares interface properties, union members, error codes and the `generate_handler!` list against what Rust actually writes — bidirectionally, with the six forbidden Phase 2 command names asserted absent from both sets. **Six commands are registered now**, the sixth being `menu::set_menu_labels`; none mutates a file and the test enforces it |
| [`src-tauri/src/error.rs`](src-tauri/src/error.rs) | The wire error: **twelve** flat codes with structured operands (`invalidMenuLabels`, `menuBuildFailed` and `menuUnavailable` joined the original nine), a hand-written `Serialize` giving each code **one** spelling, exhaustive `From` impls over the core's three error enums, and **no `Display` impl at all** so there is no developer rendering to leak onto the wire |
| [`src/lib/ipc/`](src/lib/ipc/) | The frontend boundary: `types.ts` (the hand-written wire mirror), `errors.ts` (`isCommandError`'s operand validation, `classifyFailure`, `identityRecovery` and its three answers, `developerDetail`, `reportIpcFailure`), `commands.ts` (the typed `invoke` wrapper returning `CommandResult<T>` rather than throwing), `menu.ts`. **The developer string is no longer a property of `IpcFailure`** — non-enumerable and symbol-keyed, so no spread, serialization, enumeration or index reaches it; `JSON.stringify` of a failure is pinned at `{"kind":"unexpected"}` |
| [`crates/espansoconfig-core/src/wire.rs`](crates/espansoconfig-core/src/wire.rs) | `WirePath` — why a non-UTF-8 filename can no longer turn a typed failure into serde's untyped English *after* the command already returned `Ok` |
| [`src-tauri/src/dispatch_check.rs`](src-tauri/src/dispatch_check.rs) | Why `"permissions": []` is evidence rather than argument: all **six** commands driven through the real Tauri dispatcher with the **shipped** config and capability file, plus `a_remote_origin_is_refused` pinning the other side. 1b-2b added the three menu paths, `the_main_thread_step_reports_what_the_work_answered` among them |
| [`docs/decisions/1b-2b-notes.md`](docs/decisions/1b-2b-notes.md) | Phase 1b-2b's decision record: the key scheme and the sixteen namespaces (§1), the dictionaries and the five new exceptions (§2), the typed accessor (§3), **the exhaustiveness check and what it cannot see (§4)**, the developer-string guard (§5), the experiments (§6), what the phase got wrong (§7), **the eleven coverage holes stated as holes (§9)**, **what 1c inherits (§10)**, the menu in full (§11, with R32's evidence in §11.5 and the capability argument in §11.3) and **the review disposition (§12)** |
| [`docs/reviews/phase-1b-2b-dictionaries-and-menu.md`](docs/reviews/phase-1b-2b-dictionaries-and-menu.md) | The Phase 1b-2b review, dispositioned above. Its two High findings were both real: six wire-visible enums deferred to 1c with no strings at all, and an "exhaustiveness" check that failed open on two valid Rust syntaxes and on any new enum. Its finding 4 is the sharpest — the `detail` guard was a name scanner, and `JSON.stringify` names no identifier |
| [`docs/decisions/1b-2a-notes.md`](docs/decisions/1b-2a-notes.md) | Phase 1b-2a's decision record: what crosses and what does not (§1), the synchronous-command/mutex trade (§2), the error representation (§3), **R27 corrected** (§4), the capability argument then its execution (§5), the hand-written mirror and the check that guards it (§6), **why the lint proves nothing here** (§7), what the phase got wrong on the way (§8), **the four remaining coverage holes with owners named** (§9), the thirteen disabling experiments and which six are reproducible (§11), what 1b-2b inherits (§12), the JSDoc exemption decided rather than left open (§14), the review disposition (§15) and the numeric-field audit (§16) |
| [`docs/reviews/phase-1b-2a-ipc-surface.md`](docs/reviews/phase-1b-2a-ipc-surface.md) | The Phase 1b-2a review, dispositioned above. Its two High findings were both real: a **false identity claim** repeated in three files and in this checkpoint, and a serialization failure that could deliver prose to the webview. Its finding 5 is the sharpest — a scope-creep oracle that could not detect the scope creep it was named for |
| [`src-tauri/src/commands.rs`](src-tauri/src/commands.rs) | The five read-only document commands over a `WorkspaceSession` holding `Workspace` behind a std `Mutex`, **synchronous** so no guard can cross an `.await`. Registered in [`src-tauri/src/main.rs`](src-tauri/src/main.rs)'s `generate_handler!` alongside `menu::set_menu_labels`. **No mutating command exists and a test enforces it** |
| [`src/lib/i18n/dictionaries.ts`](src/lib/i18n/dictionaries.ts) | **The i18n enforcement point.** `TranslationKey = keyof typeof en`, and `const spanish: ExactDictionary<typeof es> = es` is the binding that makes a missing *or* surplus Spanish key a compile error. `translate()` interpolates `{placeholder}` and leaves an unknown one verbatim on purpose |
| [`docs/decisions/1b-1-notes.md`](docs/decisions/1b-1-notes.md) | Phase 1b-1's decision record: the pinned versions and why each is exact (§1), what the typed key union enforces and the four disabling experiments that verify both directions (§2), what the types cannot see (§2 end), the runtime checks and the **exception list by key** (§3), locale detection and the override policy (§4), the architecture rule's new check (§5), what the Tauri shell deliberately does not contain (§6), **what the hardcoded-string check cannot see (§7)**, the strings deliberately left untranslated (§8), **the eight coverage holes stated as holes (§9)**, and what 1b-2 inherits (§10) |
| [`scripts/lint/hardcoded-strings.ts`](scripts/lint/hardcoded-strings.ts) | The markup scan behind R31. Read §7 of the notes before trusting a clean run: it sees `.svelte` markup and **not** `<script>` bodies, `{'literal'}`, `.ts` constants or props. Its blind spots are why the review found an English sentence in `Info.plist` that no check could ever have seen |
| [`docs/reviews/phase-1b-1-shell-and-i18n.md`](docs/reviews/phase-1b-1-shell-and-i18n.md) | The Phase 1b-1 review, dispositioned above. Its two High findings were both **real grants** — an over-broad capability set and a production CSP allowing inline styles — and its finding 1 was a crash on the declared minimum macOS. R34 and R35 come from it |
| [`src/lib/stores/locale.svelte.ts`](src/lib/stores/locale.svelte.ts) · [`src/lib/bootstrap.ts`](src/lib/bootstrap.ts) | The locale state and the pre-mount bootstrap. `createLocaleState` takes a tag *reader* and re-negotiates on `languagechange` **without ever touching an explicit override**; `bootstrap()` sets `documentElement.lang` before mount. Both directions are pinned by disabling experiments |
| [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) · [`Info.plist`](src-tauri/Info.plist) · [`capabilities/default.json`](src-tauri/capabilities/default.json) | Identifier `cc.carpio.espansoConfig`, strict CSP, **`"permissions": []`** — measured sufficient for all **six** commands by `dispatch_check.rs`, not merely argued — and `CFBundleLocalizations = [en, es]`. The menu **is** localized as of 1b-2b, and it needed no permission: a capability governs *plugin* commands, and `set_menu_labels` is this application's own. The reasoning is written into the file's `description` field so the next phase cannot re-open it by accident |
| [`crates/espansoconfig-core/src/workspace/mod.rs`](crates/espansoconfig-core/src/workspace/mod.rs) | **What Phase 1b wraps, one command per method.** `discover`, `summary`, `list_documents`, `get_document`, `get_match`, `document_view`, `document_text`, `refresh`, `load_all`, `evict` — plus the per-`ContentRevision` cache that answers R19's remaining half, and the monotonic path-keyed `DocumentId` allocation that D2v's identity fix rests on |
| [`crates/espansoconfig-core/src/model/`](crates/espansoconfig-core/src/model/) | **The read model itself.** `document.rs` (`DocumentView`, `match_by_id`, `unaccounted_keys`, `coverage_is_complete`), `match_view.rs` (plan §3.3's 22 fields, `MatchId`, badges), `variable.rs` (the nine §3.4 types), `scalar.rs` (`ScalarView` — D2u in a type), `unknown.rs` (`UnknownEntry`, the undescended spans of D2w), `diagnostic.rs` (22 codes, no prose), `project.rs` (the walk), `profile.rs`, `value.rs` |
| [`docs/decisions/1a-notes.md`](docs/decisions/1a-notes.md) | Phase 1a's decision record: what the projection is and is not (§1), D2u as a type (§2), the key accounting stated so it can be false (§3), where the schema stops (§4), identity and the design rejected (§5), the workspace and R19 (§6), the disabling experiments (§7 and §12), what the phase got wrong on the way (§8), **the eleven coverage holes stated as holes (§9)**, the dependencies added (§10), what 1b inherits (§11) and the review disposition (§12) |
| [`docs/reviews/phase-1a-core-read-model.md`](docs/reviews/phase-1a-core-read-model.md) | The Phase 1a review, which held the phase open. D2v and D2w and R27–R30 all trace to it; its finding 1 is R24's third occurrence and its finding 2 is the vacuous-audit corollary |
| [`crates/espansoconfig-core/tests/model_projection.rs`](crates/espansoconfig-core/tests/model_projection.rs) | Phase 1a acceptance: the per-fixture `SYNTHETIC_PROJECTIONS` table, the D2u oracle and its disabling experiment, the tree-derived coverage oracle, `an_identity_from_before_a_reordering_is_refused_rather_than_resolved` (the reviewer's counterexample, retained), the truncation sweep and the badge/search pins |
| [`crates/espansoconfig-core/tests/workspace_cache.rs`](crates/espansoconfig-core/tests/workspace_cache.rs) | The cache and identity acceptance: parse-count instrumentation, `an_identity_survives_a_directory_that_gained_and_lost_a_file`, and the refresh/evict/change-and-back sequences the review asked for |
| [`crates/espansoconfig-core/tests/gate_roundtrip.rs`](crates/espansoconfig-core/tests/gate_roundtrip.rs) | **The Phase 0 gate itself** — the R9 sweep over every eligible target of both corpora, the 48-cell axis×operation matrix with `REFUSAL_ONLY_CELLS` enumerated, and `independent_yaml_1_1`, the second transcription of the 1.1 productions that makes the tag table's proof non-circular |
| [`crates/espansoconfig-core/src/emit/tags.rs`](crates/espansoconfig-core/src/emit/tags.rs) | The YAML 1.1 / 1.2-core resolution table (D2s). **Load-bearing in production**: the emitter consults it and `verify()` asserts on it. Hand-maintained — its 1.1 half has an independent second transcription in the gate test, its 1.2-core half does not |
| [`docs/decisions/0c-3b-2b-notes.md`](docs/decisions/0c-3b-2b-notes.md) | Phase 0c-3b-2b's decision record: what the sweep is and is not (§1), what it measured (§2), the tag oracle and D2h's failure (§3), R16's exact open wording (§4), R24 answered (§5), the twelve disabling experiments (§6), and **the gate verdict, re-derived (§8)** |
| [`docs/reviews/phase-0c-3b-2b-the-gate.md`](docs/reviews/phase-0c-3b-2b-the-gate.md) | The review that refused the first verdict. D2s, D2t and the R4 closure all trace to it; its E5 finding is why the removal envelope has a bound derived independently of itself |
| [`crates/espansoconfig-core/tests/patch_move.rs`](crates/espansoconfig-core/tests/patch_move.rs) | **Phase 0c-3b-2a acceptance, and the closest model for the gate's own sweep.** The per-fixture move table, the independently re-derived refusals, `check_the_arrival_is_the_departure` (the test-side second derivation of D2q's property 4), and the **retained mutation tests** — `a_planner_that_permutes_the_carried_lines_is_rejected`, `every_other_move_property_certifies_the_permuted_candidate`, C1/C2/C2b/C4/C5, M1/M3/M4 — which are the pattern for "break the engine, not the oracle" |
| [`docs/decisions/0c-3b-2a-notes.md`](docs/decisions/0c-3b-2a-notes.md) | Phase 0c-3b-2a's decision record: what byte identity stopped being able to say (§1), how the envelope and destination are derived (§2), the five-property invariant and what a hostile reader says it misses (§3), the seam model and the blank-run rule at the destination (§4), every measurement per fixture with deltas attributed (§5), the disabling experiments and the four engine breaks (§6), the claims this phase proved false including the withdrawn EOF argument (§7), what is owed to 0c-3b-2b (§8), and **the review disposition (§9)** |
| [`docs/reviews/phase-0c-3b-2a-move-and-invariant.md`](docs/reviews/phase-0c-3b-2a-move-and-invariant.md) | The Phase 0c-3b-2a review; D2q, D2r and R24–R26 come from the phase and this review, dispositioned above. Its first High finding is why a safety property must live in `verify()` and not only in a sweep; its second is why the EOF rotation is refused |
| [`crates/espansoconfig-core/src/patch/edit.rs`](crates/espansoconfig-core/src/patch/edit.rs) | **Where 0c-3b-2a landed and where the gate reads from.** `apply_edits` is the one batch protocol for `ScalarEdit`, `FieldInsert`, `FieldRemoval` and `ItemMove`; `verify()` holds D2q's five properties, `the_arrival_is_the_departure` and `comment_ownership_survives` among them. Formerly: | `apply_edits` is the one batch protocol for `ScalarEdit`, `FieldInsert` and `FieldRemoval`: plan against the original index, reject overlaps, splice highest-offset-first, reparse, verify. Also `EditError`, `VerificationFailure`, `StructuralGuard`, `PresentationNote`, `PatchedDocument`, and 0c-3b-1's run derivation (`preserved_regions`, `runs_between`, `block_scalar_the_kept_bytes_would_join`, `first_kept_column`, `absorbs_a_line_at`) |
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
| [`crates/espansoconfig-core/tests/corpus/synthetic/move-a-match.yml`](crates/espansoconfig-core/tests/corpus/synthetic/move-a-match.yml) | The Phase 0c-3b-2a ownership fixture: what travels with a moved match and what stays behind. Also the **only** fixture holding a quoted scalar with an inline comment — restored by the review after the phase first deleted the shape (R20's seventh) |
| `move-block-scalar-seams.yml` · `move-run-joins.yml` · `move-kept-comment-joins-a-block.yml` | The three Phase 0c-3b-2a fixtures whose **columns are the test data** — CLAUDE.md §4 entries 13–15. Respectively: the three external seams, the internal carried-run join the review found, and R23 seen by a move. Each pins **both** sides of its condition, per R20 |
| [`crates/espansoconfig-core/tests/corpus/synthetic/`](crates/espansoconfig-core/tests/corpus/synthetic/) | The committed corpus — **32 fixtures** |
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
| 0c-3b-1 | `4015ff7` | ✅ pushed to `origin/main` | clean |
| 0c-3b-2a | `7fd9850` | ✅ pushed to `origin/main` | clean |
| 0c-3b-2b | `912cb89` | ✅ pushed to `origin/main` | clean |
| 1a | `185c9a6` | ✅ pushed to `origin/main` | clean |
| 1b-1 | `94aa6c9` | ✅ pushed to `origin/main` | clean |
| 1b-2a | `d876eb6` | ✅ pushed to `origin/main` | clean |
| 1b-2b | `065a516` | ✅ pushed to `origin/main` | clean |
| 1c-1 | `59d4207` | ✅ pushed to `origin/main` | clean |
| 1c-2a | `PENDING` | see below | see below |

Two follow-ups landed after `4f92c03`, both documentation only: `3b76697` recorded the commit here,
and `2eb12cb` reconciled the Phase 0a–0c-2a corpus figures in this file with the fixture Phase 0c-2b
added, so no historical paragraph states a count the suite no longer pins.

`8989c16` is Phase 0c-3a **including its review fix round** — the phase was held open until all five
findings were closed, so there is no intermediate commit holding the demonstrated defect. It contains
the implementation, the three new fixtures, the review, the notes doc and this checkpoint. A fresh
session should start from `8989c16` or later.

`4015ff7` is Phase 0c-3b-1 **including its review fix round** — the phase was held open until both
findings were closed, so, as with `8989c16`, no commit holds the demonstrated defect. It contains the
run derivation in `src/patch/edit.rs`, the `subtree_extent` doc correction in `src/syntax/trivia.rs`,
the two new fixtures, the retabulated pins in seven test files, `CLAUDE.md` §4's twelfth fixture row,
the review, `docs/decisions/0c-3b-1-notes.md` and this checkpoint. **A fresh session should start
from `4015ff7` or later.**

`7fd9850` is Phase 0c-3b-2a **including its review fix round** — the phase was held open until all five
findings and three of the four coverage holes were closed, so, as with `8989c16` and `4015ff7`, no commit
holds the demonstrated defect. It contains `ItemMove` and D2q's five verification properties in
`src/patch/edit.rs`, the new `tests/patch_move.rs`, four new fixtures, the quoted-overshoot bucket in
`tests/parser_evaluation.rs`, the `entry_hull_lines` fix in `tests/patch_structure.rs`, retabulated pins
across seven test files, `CLAUDE.md` §4 entries 13–15, the review, `docs/decisions/0c-3b-2a-notes.md` and
this checkpoint. **A fresh session should start from `7fd9850` or later.**

`912cb89` is Phase 0c-3b-2b **including its review fix round** — the phase was held open until the
blocking finding was closed **in production** and the verdict re-derived rather than reworded, so, as with
every phase since `8989c16`, no commit holds the demonstrated defect. It contains `tests/gate_roundtrip.rs`,
`src/emit/tags.rs`, `RemovalCarriesMoreThanTheEntry` in `src/patch/edit.rs`, the memoised
`src/syntax/ownership.rs`, the `explicit-key-mappings.yml` fixture, retabulated pins across seven test
files, the R16 consultation, the review, `docs/decisions/0c-3b-2b-notes.md`, `CLAUDE.md` §6 and this
checkpoint. **This commit closes Phase 0. A fresh session starting Phase 1 should start from `912cb89`
or later.**

Note: commit `123f5c0` ("Ignore the .claude directory and untrack its settings") landed
out-of-band between the plan commit and 0a. It untracks `.claude/settings.json` and ignores
`.claude/`. Benign and left in place.

`94aa6c9` is Phase 1b-1 **including its review fix round** — the phase was held open until all nine
findings were dispositioned, so, as with every phase since `8989c16`, no commit holds the demonstrated
defects: neither the over-broad `core:default` capability, nor the production CSP allowing inline styles,
nor the macOS floor that would have thrown on first render, nor the missing `custom-protocol` feature
that made every binary load a dead dev URL. It is the first commit to add `src-tauri/` and `src/`, so it
contains the Tauri v2 shell, the Svelte 5 + TypeScript + Vite frontend, the i18n layer in both
languages, three lint scripts, `docs/decisions/1b-1-notes.md`, `docs/reviews/phase-1b-1-shell-and-i18n.md`,
`CLAUDE.md` §6 and this checkpoint. **A fresh session starting Phase 1b-2 should start from `94aa6c9`
or later.** Note that `npm install` is required before any frontend command will run — `node_modules/`
is gitignored and `package-lock.json` is committed, so `npm ci` reproduces the pinned tree exactly.

`d876eb6` is Phase 1b-2a **including its review fix round** — the phase was held open until all ten
findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated defects:
neither the false `DocumentPath`-survives-a-reparse claim, nor the non-UTF-8 path that could deliver
serde's prose to the webview, nor the scope-creep oracle that could not detect a registered
`save_match`. It contains the five commands in `src-tauri/src/commands.rs`, the wire error in
`src-tauri/src/error.rs`, the contract and dispatcher checks in `src-tauri/src/{wire_contract,dispatch_check}.rs`,
the new `crates/espansoconfig-core/src/wire.rs` and its four callers in the core, the frontend boundary
in `src/lib/ipc/`, `docs/decisions/1b-2a-notes.md`, `docs/reviews/phase-1b-2a-ipc-surface.md` and this
checkpoint. **A fresh session starting Phase 1b-2b should start from `d876eb6` or later.** As at 1b-1,
`npm install` (or `npm ci`) is required before any frontend command will run.

`065a516` is Phase 1b-2b **including its review fix round** — the phase was held open until all seven
findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated defects:
neither the six wire-visible enums deferred with no strings at all, nor the exhaustiveness check that
failed open on two valid Rust syntaxes and on any new enum, nor the `detail` guard that
`JSON.stringify` walked straight past, nor the menu command that answered `{ ok: true }` before it had
built anything. It contains the dictionaries and the typed accessor
(`src/lib/i18n/{codes.ts,en.json,es.json,index.ts}`), the exhaustiveness check and its parser
(`src-tauri/src/{dictionary_contract.rs,rust_source.rs}`), the menu and its checks
(`src-tauri/src/{menu.rs,menu_contract.rs}`, `src/lib/{menu.ts,ipc/menu.ts}`), the developer-string
guard (`src/lib/ipc/errors.ts`, `scripts/lint/ipc-detail.ts`), three new `CommandError` codes,
`docs/decisions/1b-2b-notes.md`, `docs/reviews/phase-1b-2b-dictionaries-and-menu.md`, `CLAUDE.md` §6
and this checkpoint. **This commit closes Phase 1b. A fresh session starting Phase 1c should start from
it or later.** As at 1b-1, `npm install` (or `npm ci`) is required before any frontend command will run.

`185c9a6` is Phase 1a, the first commit after `37cb48d`, which recorded D2u. Like every phase since `8989c16` it
is committed **including its review fix round** — the phase was held open until all five findings were
closed, so no commit holds the demonstrated positional-identity defect or the vacuous coverage audit.
It contains `src/model/` (nine files), `src/workspace/mod.rs`, the two new test binaries, the
`Serialize`/`Deserialize` derives across `syntax/`, `patch/path.rs`, `discovery.rs` and `watch/`,
`docs/decisions/1a-notes.md`, `docs/reviews/phase-1a-core-read-model.md` and this checkpoint.
**A fresh session starting Phase 1b should start from the 1a commit or later.**
