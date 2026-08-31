# Phase 0 — verification and review dispositions

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

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


## The Phase 0 substrate risk rows, archived 2026-08-31

Twelve rows moved out of `PROGRESS.md`'s *Open risks and deviations* table at Phase 2d-4b-E, verbatim
and unedited, because the checkpoint had 727 bytes of headroom under its 64 KiB soft bound and every
one of them belongs to a phase that closed long ago. **None is withdrawn and none is downgraded** —
they are open risks still, recorded here instead of in the live head, and `PROGRESS.md` carries one
pointer row to this section.

Three Phase 0-era rows deliberately **stayed** in the live table because a later phase reads them
rather than the archive: **R12** (the refusal breadth, whose "total" wording had to be narrowed once
already), **R16** (whose open half is what D2u constrains, and D2u binds every UI phase) and **R25**
(named in *Standing rules* as one of the three things the gate does not license).

| # | Risk | Mitigation / state |
|---|---|---|
| R1 | `saphyr-parser` is **pre-1.0 (0.0.11)**; the API can break between patch releases | Confined to `crate::syntax` — no other module imports it. 31 pinned tests fail loudly on any behaviour change. Deliberately **not** vendored: vendoring creates ownership without removing upgrade risk. |
| R2 | If a future saphyr release "fixes" `index()` to genuinely return bytes, the `CharToByte` adapter silently becomes wrong | Desired failure mode already wired: `all_three_crates_report_character_offsets_not_byte_offsets` and `saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes` both fail immediately. |
| R5 | An empty block scalar (`replace: \|` mid-keystroke) reports a span that **includes** its header — the one exception to "the header is outside the span" | Phase 0b: the backwards header lexer must refuse to run when the span itself starts with `\|` or `>`. Pinned by `a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header`. The content span now starts past the header *line*, never past the indicator alone, so rewriting it cannot splice a value onto the header line. |
| R13 | **Duplicate-key detection compares decoded scalar values only.** A non-scalar key — an alias or a collection used as a mapping key — is skipped by the duplicate check | Accepted: every such key already raises `AliasReference` or sits inside a refused construct, so the mapping is refused anyway. Revisit only if a case appears where a non-scalar key exists without any other hazard. |
| R9 | The missing evaluation criterion is **replacement-envelope correctness**, not endpoint accuracy | Phase 0c. Mutate real documents and assert: the span matches the requested structural path despite duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys and empty values; the replacement reparses to the intended value and stays valid YAML; every byte outside the envelope is identical (CRLF/LF, BOM, missing final newline, trailing spaces, comments, block-scalar terminal newlines). This is the Phase 0 gate's round-trip property test. |
| R15 | **`NonCanonicalEscaping` is deliberately over-broad**: it refuses every double-quoted source containing any backslash, including already-canonical `\\`, `\"`, `\n`, `\t` | Accepted for now, and safe — it only costs the ability to re-encode such a scalar byte-identically, never correctness. Carries a `TODO(0c-2)` in its doc comment. Narrow it only if 0c-2 finds real files where editing an escaped double-quoted value matters. |
| R18 | **A node in key position cannot be verified by the path that found it.** Renaming the `replace` of `replace: old` makes the path `replace` resolve to `NoSuchKey` in the reparsed document, so the verify step fails on a *correct* edit | Accepted and bounded. A scalar edit targets `Resolved::value` only; `resolve_key` exists for the **spans** a structural edit needs (where an entry begins, so removing it takes its key too), not as an edit target. Documented on `resolve_key` itself. A key-rename operation needs its own protocol — verify against the **intended new** path, not the old one — and is 0c-3's problem if it is wanted at all. Editing an ordinary value that merely equals some other entry's key string is harmless. |
| R10 | A block scalar whose header cannot be located has **no correct span**: the reported one runs into trailing blank lines and the next node's indentation | The index is **rejected** with `InvariantViolation::BlockHeaderNotFound` rather than publishing the known-bad span. There is deliberately no fallback. From the Phase 0b-1 review, ranked failure mode 3. |
| R11 | **Terminal spaces or tabs at end-of-source** are scalar content, not the next token's indentation — there is no next token | `block::content_len` takes `at_end_of_source` and keeps a trailing run that sits on a content line. Pinned by `terminal_spaces_at_end_of_source_stay_inside_the_block_scalar` and the `block-scalar-terminal-spaces.yml` fixture. |
| R23 | **A comment a removal *keeps* can be absorbed by a block scalar above it**, changing that block's decoded value although nothing about it was edited — the shape neither D2o nor the 0c-3a review named | Accepted and refused by name (`EditError::RemovalWouldExtendABlockScalar`), the twin of `RemovalWouldExtendAKeptBlock`. **Narrowed by the 0c-3b-1 review's finding 2, which found the first form over-broad.** It now fires on three clauses, not two: the removal has something to preserve, *and* some block scalar's content ends at or before the envelope's first run with nothing but blank lines in between, *and* **the first non-blank line the removal preserves sits at that block's own body column or deeper**. A shallower line ends the block instead of extending it, exactly as the removed entry's key already did, so the reviewer's `>` block above a column-zero comment is a legal removal and is pinned byte-exactly. The body column is `ScalarPresentation::indent`, **read off the span layer and never re-lexed** (D2/D2d); the earlier "only reconstructible" objection was about a block's *end*, not its body column. One case still refuses unconditionally: a block whose content span is **empty** (`replace: \|` with the next sibling under it, the R5 shape), where `indent` holds the header's column rather than any observed body's. Costs the synthetic corpus **1** attempt, in `run-based-removal-envelope.yml`, and the real corpus **0** — unchanged by the narrowing, which let one attempt through and turned none away. `run-based-removal-boundaries.yml` pins the safe side. |
| R22 | **`InconsistentEntryIndentation` is pinned at 0 and is argued to be *unreachable*, not merely unreached** — a coverage hole and a proof look identical in a count | Accepted, with the argument recorded in `docs/decisions/0c-3a-notes.md` §3: a valid block mapping cannot have its keys at two columns, and the two shapes that can are refused earlier by other variants. No fixture was invented to reach it, because an impossible fixture would prove nothing. This is the one refusal family whose pinned zero rests on an argument rather than on a construction — treat it as the weakest pin in the table, and revisit if a real file ever trips it. |
| R26 | **`shares_a_line` and the move sweep's second derivation of `comment_ownership_survives` are pinned or covered more weakly than the rest** | Accepted and named rather than papered over. `shares_a_line` is **reachable** — via a compact nested sequence such as `outer[0][1]` in `- - first` — and is driven by a hand-written unit test rather than a corpus fixture, because neither corpus holds that shape; it is weaker than corpus coverage and R20's rule would prefer a fixture. `comment_ownership_survives` has a production derivation but **no independent second derivation in the sweep**, deferred on R19 cost grounds (`docs/decisions/0c-3b-2a-notes.md` §3.4). Both are the weakest pins added by 0c-3b-2a; R22 remains the weakest in the table overall. |

---
