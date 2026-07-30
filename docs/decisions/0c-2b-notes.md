# Phase 0c-2b — decisions, new error variants, and what turned out to be wrong

Phase 0c-2b is the first code in the crate that mutates a document:
[`crates/espansoconfig-core/src/patch/edit.rs`](../../crates/espansoconfig-core/src/patch/edit.rs).
This file records the decisions a reader cannot re-derive from the code, and the claims already in
`PROGRESS.md` or in the source that this phase found to be false.

**Read §7 first if you are comparing this document to the code.** The phase's adversarial review
returned *do-not-accept*, and the fix round it forced changed two of the decisions below and deleted
two of the error variants §4 lists. Where §7 and an earlier section disagree, §7 is current.

---

## 1. R17 — what happens inside a flow collection

**Decision: option (b). Thread flow context into rendering and guarantee flow-legal bytes.
Flow-interior edits are not refused.**

R17 was open because `HazardKind` has only `CommentInFlowCollection`, so
`matches: [{trigger: ":a", replace: old}]` both resolves *and* passes `is_safely_editable`, while a
block scalar is illegal inside `{…}`/`[…]`. Doing nothing would emit invalid YAML.

`scalar_context()` marks the target's context `ScalarContextKind::Flow` whenever **any** enclosing
collection is bracket-delimited, and the Phase 0c-1 emitter already refuses to put a block *or* a
plain scalar into flow context (`choose_scalar`'s `!context.is_flow()` guard and
`ScalarContext::can_hold_a_block_scalar`). So a multi-line value inside a flow collection becomes a
**double-quoted scalar with `\n` escapes** — one physical line, brackets undisturbed.

Why (b) rather than "refuse flow-interior edits outright":

- **It costs a real espanso config nothing.** `triggers: [":a", ":b"]` and inline
  `vars: [{name: …, type: …}]` are idiomatic espanso, and `flow-collections.yml` alone holds 11
  editable flow-interior scalars. Refusing them would mean the visual editor cannot change a
  trigger list.
- **Refusing is not the cheaper option.** Detecting flow context is the same `is_inside_a_flow_
  collection` walk either way, so (a) is (b) minus the two lines that pass the context on. The
  safety (a) would buy is already provided by construction.
- **Byte fidelity is unaffected.** Only the scalar's own token changes; the commas, brackets and
  spacing around it are outside every replaced span.

The one cost, documented on the entry point and pinned by a test: a **plain** scalar inside a flow
collection is requoted on edit (`vars: [one, two]` → `vars: [one, 'three']`), because a plain scalar
in flow context is terminated by `,`, `]` and `}` and the emitter never writes one there. Two
apostrophes inside the edited token, nothing outside it.

Pinned in both directions by `a_flow_interior_edit_is_flow_legal_in_both_directions` (tests) and
`an_edit_inside_a_flow_collection_never_emits_a_block_scalar` +
`a_flow_scalar_is_quoted_even_when_the_value_would_be_plain_safe` (unit): the same multi-line value
becomes `"one\ntwo\n"` in flow context and a `|` block in block context, and a flow collection that
*does* carry a comment is still refused outright.

---

## 2. The gate is at the mutation entry point, and cannot be bypassed

`apply_scalar_edits(source, edits)` takes the **source text**, not a pre-built `SyntaxIndex` or
`TriviaIndex`. It parses and scans internally, so there is no argument a caller can get wrong and no
way to hand it a trivia index that describes a different document. The 0c-2a reviewer's condition —
"the mutation entry point in 0c-2b must own the gate check internally" — is met structurally rather
than by convention. `resolve` is untouched and still knows nothing about hazards (D2j).

`PatchedDocument` has no public constructor and no public field. The only way to hold candidate
bytes is to have been handed them *after* `verify()` passed, so there is no code path from a
verification failure to a document a caller could write.

One additive change to Phase 0b: `TriviaIndex::disqualifying_hazard()` returns *which* hazard
disqualifies a node, and `is_safely_editable` is now "that returned `None`". The two cannot drift
apart, and the mutation layer can refuse by name.

---

## 3. Trailing line breaks: preserve the layout, let the indicator reinterpret it

A block scalar's trailing line breaks are shared property — the chomping indicator decides how many
of the breaks *physically present* after the last content line belong to the value, and the rest are
blank-line trivia the edit must leave alone. `breaks_to_emit()` therefore emits **exactly as many
trailing breaks as the replaced region already held**, so the document's line structure is unchanged
and only the header's indicator changes meaning:

| Source | New value | Result |
|---|---|---|
| `k: \|` + `  a` | `a` | `k: \|-` + `  a` (the terminating break stays) |
| `k: \|-` + `  a` | `a\n` | `k: \|` + `  a` (the break already there serves) |
| `k: \|+` + `  a` + 2 blanks | `a\n` | `k: \|` + `  a` + 2 blanks (they become trivia) |

Two adjustments, each forced:

- clip and strip need the last body line **terminated**; when neither the region nor the source
  after it holds a break, one is written — except at end of file, where a strip block legitimately
  ends a file with no final newline (`no-trailing-newline.yml`).
- **keep chomping counts every physical break**, so it is the one indicator that cannot leave a
  trailing break as trivia. There the count is exact (`wanted - following`), and when the document
  already holds more breaks than the value wants the edit is **refused** rather than made to absorb
  blank lines silently.

---

## 4. New typed error variants, and why each exists

`EditError` — the edit was not applied and no bytes were produced:

| Variant | Why it exists |
|---|---|
| `SourceDoesNotParse` | nothing in an unparseable document can be addressed |
| `Unresolvable` | the path names nothing; carries the `PathError` verbatim |
| `NotAScalar` | a collection cannot take a scalar value by span replacement — that is 0c-3 |
| `EmptyTarget` | `empty:` and a bare `- ` are **zero-width** scalars positioned *before* the punctuation that introduces them (R7), so writing into their span would splice the value onto the wrong side of a `:` or `-`. Giving an empty entry a value is a structural edit |
| `Refused` | the hazard gate said no, named by `HazardKind` and located by span |
| `OverlappingEdits` | two edits in one batch whose order would decide the result. Requesting the same path twice lands here |
| `TrailingNewlinesNotRepresentable` | see §3 |
| `MalformedSpan` | a span did not slice the source; always a bug in this crate |
| `Verification` | wraps the below |

**Two variants this section used to list no longer exist**, and §7 records why:
`CommentOnBlockHeader` and `LineNotFreeForBlockScalar` were both refusing edits that have an exact
lossless answer. They were deleted rather than left as dead branches.

`VerificationFailure` — the candidate was reparsed and discarded: `DoesNotParse`, `TargetLost`,
`TargetKindChanged`, `ValueMismatch`, `DecoderDisagreement`, `Undecodable`,
`BytesOutsideTheSpanChanged`, `SpanNotPermitted`, `LengthMismatch`. `SpanNotPermitted` is new in the
fix round and is the one that would have caught finding 1 — see §7.

Two conventions these follow deliberately:

- **No variant carries scalar text.** These errors are printed by tests that sweep the private
  corpus, so they carry spans, lengths, counts and the offset of the first differing byte only
  (`CLAUDE.md` §1).
- **They are diagnostics, not user-facing prose**, exactly as `PathError` already documents. Every
  string a user reads goes through the frontend i18n layer (plan §9); this phase introduces no
  user-facing string.

`PresentationNote` is not an error. It reports that a scalar's *spelling* changed as well as its
value — a `>` block rewritten as `|`, an escaped double-quoted scalar re-escaped canonically, a
plain scalar requoted — which is plan §6.2's "never silently normalise" requirement discharged
without blocking the edit. This is also how the `PROGRESS.md` instruction "a scalar that
`reencode_in_place` refuses must not be silently rewritten" is honoured: the refusal reason travels
to the caller in `PresentationNote::reason`, and the edit is not refused, because `preserve_scalar`
documents rewriting a folded scalar as `|` as intended behaviour.

---

## 5. Three things that turned out to be false

### 5.1 A quoted scalar's reported end overshoots — a latent Phase 0b bug (**fixed**)

`PROGRESS.md` D2 says the substrate's end offsets are "exact for **flow** scalars — 727 in the
synthetic corpus and 980 in the 13 real files reproduce their source token byte for byte, zero
mismatches", and `tests/parser_evaluation.rs` asserts it corpus-wide.

**That is a statement about the corpus, not about the substrate.** A *quoted* scalar's reported end
is the next token on its line, exactly like a block scalar's, so it swallows trailing spaces and a
following comment:

| Source | Reported span |
|---|---|
| `a: 'x'` | `'x'` |
| `a: 'x'   ` | `'x'   ` |
| `a: 'x' # c` | `'x' # c` |
| `a: ["x" , "y"]` | `"x" ` |

A **plain** scalar's end really is exact (`a: x  # c` reports `x`), which is why nothing noticed: no
corpus fixture puts a comment or a trailing space after a *quoted* scalar, so all 1 892 quoted
scalars in the two corpora end their line at their closing quote.

Phase 0c-2b found it by **writing** such a document: editing the value of
`replace: hello # note` to `Don't` requotes it, the untrimmed span then covered ` # note`, the value
decoded as `'…' # note`, and the reparse-verify step refused a *correct* edit with
`DecoderDisagreement`. Any edit that requotes a value whose line carries a comment hit it — a
common shape in the real corpus.

Fixed in the span layer, not worked around in the edit engine: `SyntaxIndex`'s new `quoted_span()`
trims a quoted scalar's reported end back to its closing delimiter, lexing forwards from the opening
one (`''` and `\"` are data, not terminators; the scan crosses line breaks, so multi-line quoted
scalars trim correctly too). Unlike `block_layout` it falls back to the reported span rather than
rejecting the index, because a quoted scalar with no closing quote inside its own reported span
cannot come from a document the substrate accepted, and making a file unopenable for an unreachable
case is the R14 mistake.

**No committed corpus count moved** — which is itself the evidence that the corpus never exercised
the bug. Pinned by `a_quoted_scalar_span_stops_at_its_closing_quote_not_at_the_next_token`
(`src/syntax/index.rs`) and by a new substrate tripwire,
`saphyr_quoted_scalar_ends_overshoot_trailing_spaces_and_a_comment`
(`tests/parser_evaluation.rs`, which now holds **32** tests, not 31). `ScalarNode::reported_span`'s
doc comment, which claimed "for a flow scalar this equals the node's span", is corrected;
`SyntaxIndex::trimmed_block_scalars()` is now restricted to the two block styles so its name stays
honest.

### 5.2 R12's "refusal is total" overstates the gate

`PROGRESS.md` R12 says: "**Refusal is currently total** for anchors, aliases, tags, merge keys,
duplicate keys and multi-document streams. A real file that uses any of them is entirely
non-editable in the visual UI, not merely partly."

Measured: it is **not** total. `is_safely_editable` refuses the flagged node, its ancestors and its
descendants, so a **sibling** entry stays editable. In `anchors-aliases-tags-merge.yml`, 12
addressable scalars are refused and **5 apply** — `matches[2].trigger` is editable although the
explicit-tag hazard sits on the `replace` beside it. In `duplicate-keys.yml` it is 2 refused and 8
applied.

Only a hazard on a **document** node reaches everything, which is why `multi-document.yml` really is
total. The gate's behaviour is safe and unchanged; it is R12's prose that needs narrowing.
Pinned by `the_hazard_gate_refuses_by_scope_and_not_by_file`.

R12's other claim is confirmed: **2 004 of 2 004 attempted edits on the real corpus applied**, zero
refusals, so total refusal costs this corpus nothing today.

### 5.3 `TriviaIndex::scan` is quadratic

Measured on the real corpus: `sql.yml` (17.8 KB, 477 nodes) takes **2.6 ms to parse and 20 ms to
scan**; `javascript.yml` (7.0 KB, 92 nodes) takes 0.6 ms and 1.0 ms. The cause is structural rather
than incidental — `ownership.rs`'s primitives (`ending_before`, `starting_after`, `enclosing_flow`,
`innermost_containing`) each scan **every node** and are called **once per trivia item**, so the
cost is O(items × nodes).

This is correctness-neutral and pre-existing (Phase 0b-2), so it was **not** changed here. It does
have a consequence for testing: the safe entry point re-scans on every call by design, so the
real-corpus sweep gives each scalar 4 of the 12 replacement values, rotated by node index
(`REAL_CORPUS_STRIDE`), which keeps every value exercised across the corpus at a quarter of the
cost. The synthetic corpus, which everyone runs, keeps the full cross product. 0c-3's gate test will
be larger again; if its runtime matters, memoising the ownership primitives by position is the
cheapest fix and it is confined to `ownership.rs`.

---

## 6. Coverage holes recorded rather than papered over

- **This hole is now closed, and closing it is what exposed finding 1.** The first draft pinned
  `comment_on_block_header` at 0 and noted that no fixture carried a comment on a block-scalar
  header line. That missing coverage was not a harmless gap: the shape it failed to exercise is
  exactly the shape whose bytes were being destroyed. The fix round added
  `block-scalar-header-tails.yml`, and the whole category disappeared with the error variant.
- The `VerificationFailure` families cannot be provoked through the entry point, which by
  construction produces candidates that verify. They are driven **directly** by the unit tests
  `verification_rejects_a_candidate_whose_untouched_bytes_moved` and
  `verification_rejects_a_candidate_that_does_not_parse_or_says_the_wrong_thing`, which hand the
  verifier tampered candidates.
- **R16 still stands.** The verify step reparses with saphyr (YAML 1.2) and cross-checks our decoder
  against the substrate's, which catches a disagreement between the two implementations but still
  does not prove the file means the same thing to espanso's YAML 1.1-ish stack. A second parser
  remains the open mitigation for 0c-3.

---

## 7. The review fix round

The mandatory once-per-phase adversarial review
([`docs/reviews/phase-0c-2b-span-replacement.md`](../reviews/phase-0c-2b-span-replacement.md))
returned **do-not-accept**. All five findings are fixed; the phase was held open until they were.

### Finding 1 — the demonstrated byte-fidelity defect

For a block-to-flow style change the planner replaced one synthesized envelope
`header_span.start .. content_span.end`. By D2c the content span begins *after* the line break that
terminates the header line, so that envelope swallowed bytes belonging to **neither** span: the
header line’s tail and its own line break. Measured consequences — `k: |\r\n  body\n` edited to `""`
came back with a bare LF, turning a CRLF document into a mixed one, and `k: |   \n  body\n` silently
lost the three spaces after the indicator.

The two spans are now replaced **separately**, so the bytes between them are never written. This is
the same class of bug as R20 and R3: the substrate’s spans are not the envelope, and a synthesized
one is a guess.

### Finding 2 — two refusals that had a lossless answer

`CommentOnBlockHeader` and `LineNotFreeForBlockScalar` are **deleted**. Once the split replacement
exists, `k: | # why` → `""` is simply `k: '' # why`, and a value that needs more than one line on an
occupied line is rendered as a quoted flow scalar rather than refused. The first draft of §4 claimed
a block-header comment "cannot" survive a style change; that was **false**, and it is corrected
there.

### Finding 3 — why verification did not catch finding 1

The verifier checked that the candidate equalled the source with the **declared** replacements
applied, so an oversized *intended* span was authorised by the very declaration it should have been
checked against. `permitted_spans` now derives the allowed spans from immutable syntax facts — for a
block scalar, its `header_span` and its `content_span` and nothing between them — and any
replacement not wholly inside one of them is rejected as `VerificationFailure::SpanNotPermitted`.

What verification still **cannot** catch is recorded rather than glossed: a defect shared by both
decoders, a YAML 1.1/espanso disagreement the 1.2 substrate accepts (**R16**, still open), and an
addressing mistake made identically in planning and in verification.

### Finding 4 — the pinned counts were weaker than advertised

The sweep aggregated all fixtures into one tally and pinned per-outcome totals, so two fixtures
could exchange eligibility undetected. `SYNTHETIC_OUTCOMES` now pins a **complete per-fixture row**
and is asserted to cover the corpus exactly, so a new fixture must be given a row rather than
disappearing into a total. The acceptance test’s allowed-span helper no longer shares the
production policy either — it is the independent `permitted` derivation.

### Finding 5 — the quoted-span fallback is no longer silent

`quoted_span` returns `Option` and every fallback is **counted**
(`SyntaxIndex::unlexable_quoted_scalars`), pinned at zero across both corpora. Rejecting the index
was considered and refused: the reviewer found no reachable counterexample, and making a real file
unopenable for an unreachable case is the **R14** mistake. A counter keeps the failure observable
without that cost.

### What the new fixture moved

`block-scalar-header-tails.yml` is the ninth fixture whose whitespace *is* the test data, so it is
listed in `CLAUDE.md` §4 and pinned by `corpus_integrity.rs`. Every count it moved is its own shape:

| Pin | Old → new | Why |
|---|---|---|
| fixtures | 22 → 23 | the fixture itself |
| nodes (`patch_path`) | 1 095 → 1 114 | 1 document + 1 root mapping + `matches` + sequence + 3 item mappings + 12 scalars |
| addressable | 634 → 645 | root mapping, sequence, 3 item mappings, 6 values |
| documents | 24 → 25 | one more single-document fixture |
| mapping keys | 433 → 440 | `matches` plus each item’s `trigger` and `replace` |
| scalars | 825 → 838 | 13 scalars |
| block scalars | 42 → 45 | `\|`, `\|-`, `>2` |
| overshooting blocks | 40 → 42 | 2 of the 3; the `>2` ends the file, so it has nothing to overshoot into |
| re-encoded identically | 808 → 820 | 12 of 13; the `>2` is refused because `>` is decode-only (D2e) |
| refusals | 17 → 18 | that one folded scalar, pinned by span |
| gap comments (line scan) | 195 → 201 | its 6 whole-line comments |
| scanner comments | 197 → 205 | those 6 **plus** the 2 sharing a header line — the documented difference between the two conventions, and the cross-check that both counted correctly |
| blank lines (line scan) | 688 → 697 | the loose convention, which also counts content-line terminators |
| scanner blank lines | 94 → 96 | the 2 real blank lines separating its items |
| trivia items | 2 687 → 2 742 | — |
| attempted edits | 4 656 → 4 728 | 6 more addressable scalars × 12 values, **all 72 applying** |

Hazards did not move: the fixture raises none.
