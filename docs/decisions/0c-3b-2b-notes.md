# Phase 0c-3b-2b — the round-trip property test, R16, and the Phase 0 gate verdict

Phase 0c-3b-2b adds no new operation. It adds the **proof, over both corpora, that
the plan's Phase 0 exit criterion is met** — `IMPLEMENTATION_PLAN.md` section 12:
*"the round-trip property test passes on the full corpus"* — and it answers R16, the
last open question about what a candidate document **means** where espanso reads it
rather than where we reparse it.

Three deliverables, in dependency order:

1. **The R9 round-trip sweep**, [`crates/espansoconfig-core/tests/gate_roundtrip.rs`](../../crates/espansoconfig-core/tests/gate_roundtrip.rs)
   — every presentational axis and every structural construct R9 names, crossed with
   every one of the four operations, over both corpora.
2. **The tag-resolution oracle**, [`crates/espansoconfig-core/src/emit/tags.rs`](../../crates/espansoconfig-core/src/emit/tags.rs)
   — YAML 1.1 implicit type resolution written down as a table, with the YAML 1.2
   core schema beside it, **in the library** rather than only in the tests.
3. **The verdict**, section 8. It is a **qualified pass**, and the qualifications are
   named.

**Section 7 is the list of things earlier documents claimed that this phase proves
false.** The most important is that one of R9's six named constructs had **no corpus
fixture at all**.

> **Read section 10 first.** This phase was reviewed adversarially
> ([`docs/reviews/phase-0c-3b-2b-the-gate.md`](../reviews/phase-0c-3b-2b-the-gate.md))
> and the review found it **not genuinely passed**: E5 was a production safety hole,
> the tag oracle had false negatives whose differential test was circular, and the
> coverage matrix measured document co-occurrence rather than interaction. Section 10
> dispositions every finding and section 8's verdict is re-derived **after** the fixes.
> Where this document and the review disagree about a number, the review was counting
> the version of the code that existed when it was written; the numbers here are the
> ones the suite prints today.

---

## 1. What the gate sweep is, and what it deliberately is not

`tests/patch_edit.rs`, `tests/patch_structure.rs` and `tests/patch_move.rs` each
sweep **one** operation exhaustively and re-derive **every** refusal reason from the
document. That work is not repeated here, and this file says so in its own header.
What none of them can answer is R9's actual question, which is a **crossing**: has
each presentational axis a document can have — CRLF, a BOM, no final newline,
trailing spaces, comments, block-scalar terminal newlines — and each structural
construct it can hold — duplicate keys, nested sequence mappings, merge keys,
aliases, explicit keys, empty values — been met by **every one of the four
operations**, with the same properties holding at every meeting?

So the unit is **(fixture × operation × target)**, and the sweep pins two things:

- a **per-fixture outcome row** — applied and refused for each of the four
  operations — with the table asserted to cover the corpus exactly and its rows
  asserted to add up to the swept total (`SYNTHETIC_OUTCOMES`, 33 rows);
- an **axis × operation coverage matrix**, `AXIS_COVERAGE`, whose 48 cells each say
  `Applied`, `RefusedOnly` or `Absent`. A cell that quietly became `Absent` is a
  coverage hole wearing a green tick, and this table is what makes it impossible.

### 1.1 The axes are derived, never declared — and credited **operation-locally**

`axes_of()` reads every axis off the source text and the syntax index. Nothing is
hard-coded per fixture. That matters twice: it is what makes the matrix a
measurement rather than a restatement of the fixture list, and it is what lets the
**same** derivation classify the real corpus, where hard-coding anything is
forbidden (`CLAUDE.md` section 1).

**Deriving an axis is not the same as crediting it, and the review's third finding is
that this file used to conflate them.** An axis was attached to the whole *document*,
so an insertion into `global_vars[0].params` credited `explicit-keys × FieldInsert`
although the operation never went near the explicit-key mapping. That is co-occurrence.

The attribution is now split by `Scope`, and the split is not cosmetic — it decides
what each cell of the matrix means:

- a **presentational** axis — CRLF, BOM, no final newline, trailing spaces, comments,
  block-scalar terminal newlines — is a fact about the document's *bytes*, and **every
  applied attempt asserts something about all of them**. Property 1 rebuilds the whole
  candidate from the replacement list and compares it byte for byte; property 5
  re-scans every comment in it; property 6 every line ending; property 8 every block
  scalar. "A BOM document met an insertion" is therefore a real interaction: that
  attempt did assert the BOM survived and that every offset it used accounted for it;
- a **structural** axis — duplicate keys, nested sequence mappings, merge keys,
  aliases, explicit keys, empty values — is a fact about *one construct*, carried by a
  named node, and it is credited only when that node **is** the operation's target,
  contains it, or is contained by it. That is the same relation
  `TriviaIndex::disqualifying_hazard` uses, which is what makes a refusal in such a
  cell the *answer* rather than an accident of which file the construct shared.

`DocumentAxes::carries` is the one place the split is applied, so moving an axis from
one half to the other changes the measurement rather than only the prose — experiment
E11 in section 6 is that, done on purpose.

The one axis whose definition needed a decision is `BlockScalarTerminalNewline`.
"Contains a block scalar" is too broad to mean anything — most fixtures do. The
definition used is *a block scalar whose terminal newline is actually at stake*:
its chomping indicator is explicit (`|-` or `|+`), **or** two or more line breaks
follow its content. That is the shape where a wrong answer changes the value.

### 1.2 The properties, uniform across all four operations

Written once and called from all four branches, which is the point: an operation
that satisfied its own sweep's properties but not these would show up here and
nowhere else.

| # | Property | Where |
|---|---|---|
| 1 | the candidate is the source with the replacements applied, ascending and disjoint | `check_universal` |
| 2 | it is still valid YAML | every branch reparses |
| 3 | the replacements lie inside the construct the path named | `check_scalar_spans` / `check_spans_inside` / `check_insertion_is_a_line_boundary` / `check_move_is_a_relocation` |
| 4 | the edit did what it said | `check_scalar_intent` / `check_insert_intent` / `check_remove_intent` / the permutation half of `check_move_is_a_relocation` |
| 5 | no comment the **file** owns was lost | `check_universal`, over an independent `#` scan that skips frontier leaves |
| 6 | the candidate holds **no line ending the source does not** | `check_universal` |
| 7 | no **new** YAML 1.1-ambiguous plain scalar | `check_universal`, R16's differential property |
| 8 | every block scalar's decoded value is conserved, where the operation names none | `check_block_scalars_conserved` |

Property 6 is D2p stated as **containment** rather than as equality, and that is
deliberate: "the file had no CRLF and the candidate has one" is always a defect,
while "the file had a bare LF and the candidate does not" can simply mean the line
that carried it was legitimately removed. Equality would have had to be excused for
removals; containment is total.

Property 3 for a **scalar** edit is the exact form, not the line hull: every
replacement must lie wholly inside `header_span` **or** `content_span`. The bytes
between them are the header line's tail and its own break (D2c) and belong to no
scalar. This is the form `tests/patch_edit.rs` arrived at after its review's finding
3, and using the looser hull here would have made the gate weaker than the sweep it
sits above.

**Property 3 for a removal now has a production counterpart**, which it did not when
this table was first written: `RemovalCarriesMoreThanTheEntry` (section 5.1). The two
derivations are kept because two derivations of one boundary is the discipline, and
experiments E5 and E5b show each firing on its own.

### 1.3 What the sweep cannot see

Stated so nobody has to discover it later:

- **It does not re-derive every refusal reason.** `classify()` re-derives the
  hazard-gate refusals — a `Refused` answer must be justified by a hazard the
  document actually has — and buckets the rest by name, panicking on any variant not
  in the list. The per-operation sweeps own the full re-derivation. A gate that
  re-derived them a third time would be three copies of one argument, not three
  independent ones.
- **It does not prove the projection is right**, only that editing does not change
  it. See section 4.4.
- **Property 8 is scoped**, and the scoping is real: a scalar edit whose new value
  is multi-line legitimately *creates* a block scalar, and a removal legitimately
  deletes one, so conservation is asserted only where the operation names none. 654
  of the applied synthetic edits had at least one block scalar to conserve.
- **It is a fixed set of *operations* per target, not a fuzzer.** Two values per
  scalar (rotated by node index), two insertions per mapping, one removal per entry,
  two relocations per sequence — first-to-back and last-to-front. The exhaustive cross
  products live in the per-operation sweeps.

  What this is **no longer** is a fixed set of *targets*. Until the review round the
  real corpus was swept with `REAL_CORPUS_STRIDE = 3`: mappings only when
  `mapping.id % 3 == 0`, sequences thinned the same way. `PROGRESS.md`'s R19 had said
  in as many words what to do instead — *"if it bites, memoise `ownership.rs`'s
  primitives by position rather than thinning the sweep"* — and thinning is what
  happened. **Both corpora now run over every eligible target**: every scalar, every
  mapping, every entry of every mapping, every block sequence with two or more items.
  Section 9.1 has the measurement.

  The distinction that matters for the verdict: "passes on the full corpus" now means
  *every eligible target in every file*, not *every file*. The remaining fixed set is
  the operation offered at each target, and it is the same fixed set in both corpora.

---

## 2. What the sweep measured

### 2.1 Synthetic corpus — 2 080 attempts

| Operation | Applied | Refused |
|---|---|---|
| `ScalarEdit` | 903 | 59 |
| `FieldInsert` | 434 | 52 |
| `FieldRemoval` | 294 | 248 |
| `ItemMove` | 65 | 25 |
| **Total** | **1 696** | **384** |

Refusals by family:

| Family | Count |
|---|---|
| `Refused` (hazard gate) | 149 |
| `EntryDoesNotOwnItsLines` | 158 |
| `LastEntryOfMapping` | 35 |
| `FlowCollection` | 18 |
| `EmptyTarget` | 10 |
| `RemovalWouldExtendAKeptBlock` | 5 |
| `NoObservableLineEnding` | 3 |
| `MoveWouldInventALineEnding` | 2 |
| `MoveWouldTerminateTheFinalLine` | 2 |
| `RemovalWouldExtendABlockScalar` | 1 |
| `MoveWouldExtendABlockScalar` | 1 |

Plus **4 scalars no path can name**, because their key is duplicated
(`AddressError::AmbiguousKey`). Those are counted separately and pinned, because a
construct that contributes zero attempts and says nothing is exactly the hole this
file exists to close.

`EntryDoesNotOwnItsLines` at 158 is not a defect and is worth understanding: the
first entry of an espanso match is written `- trigger: …`, sharing its line with the
sequence dash, so removing *that* entry is refused. It is also why removal is
attempted on **every** entry of every mapping rather than only the first — the first
draft of this sweep sampled only the first entry and left four axes with a removal
column that never applied anything. That is a sampling bug the coverage matrix
caught, which is the matrix earning its keep before the phase was even finished.

### 2.2 Real corpus — 1 998 attempts, **exhaustive**, computed and never hard-coded

13 files, **every eligible target**. The stride is gone; section 9.1 is the cost.

| Operation | Applied | Refused |
|---|---|---|
| `ScalarEdit` | 1 002 | 0 |
| `FieldInsert` | 362 | 0 |
| `FieldRemoval` | 419 | 147 |
| `ItemMove` | 68 | 0 |

All 147 refusals are `EntryDoesNotOwnItsLines` (103) and `LastEntryOfMapping` (44) —
the compact `- trigger:` shape and one-entry mappings. **Not one hazard refusal and
not one verification failure anywhere in the real corpus.** No count above is
hard-coded in the test; what is asserted is the shape — every operation applied at
least once, every refusal was typed and justified, and every axis a real file carries
was met by some operation, which is now an equality (`attempts > 0` if and only if
some file carries the axis) rather than a skip.

The scalar-edit column is unchanged at 1 002 because scalars were never strided; the
insertion, removal and move columns roughly tripled, which is exactly the share of
mappings and sequences the stride used to drop.

The real corpus carries 5 of the 12 axes: no final newline, trailing spaces,
comments, block-scalar terminal newlines and nested sequence mappings. It has no
CRLF file, no BOM, no duplicate key, no merge key, no alias, no explicit key and no
empty value. That is a fact about one user's configuration, not about espanso, and
it is exactly why the synthetic corpus has to carry those constructs.

### 2.3 The coverage matrix, retabulated operation-locally

**No cell is `Absent`. Eighteen of the forty-eight are `RefusedOnly`**, each one
enumerated in `REFUSAL_ONLY_CELLS` with its reason, the enumeration asserted against
the measurement cell by cell, and its length asserted to be the measured count. The
notes used to say "five", which counted grouped *rows* of the prose table below; the
review counted the cells of the matrix as it then stood and got **eight**. Both
numbers were about the document-scoped matrix. The operation-local one has eighteen,
and the arithmetic is now derived rather than written down.

The measured matrix, synthetic corpus (`A` applied, `r` refusal-only, applied /
attempts):

| Axis | files | `ScalarEdit` | `FieldInsert` | `FieldRemoval` | `ItemMove` |
|---|---|---|---|---|---|
| `crlf` | 2 | A 30/30 | A 18/18 | A 10/18 | A 2/4 |
| `bom` | 1 | A 8/8 | A 6/6 | A 2/5 | A 2/2 |
| `no-final-newline` | 4 | A 33/34 | A 20/22 | A 11/21 | **r 0/4** |
| `trailing-spaces` | 2 | A 22/22 | A 14/14 | A 6/13 | A 2/4 |
| `comments` | 32 | A 902/960 | A 434/484 | A 294/541 | A 65/90 |
| `block-terminal-newline` | 6 | A 198/198 | A 90/90 | A 55/105 | A 12/12 |
| `duplicate-keys` | 1 | **r 0/4** | **r 0/6** | **r 0/3** | **r 0/2** |
| `nested-sequence-mappings` | 14 | A 312/320 | A 162/178 | A 130/203 | A 30/42 |
| `merge-keys` | 1 | **r 0/10** | **r 0/6** | **r 0/8** | **r 0/1** |
| `aliases` | 1 | **r 0/10** | **r 0/18** | **r 0/14** | **r 0/2** |
| `explicit-keys` | 1 | **r 0/2** | **r 0/4** | **r 0/2** | **r 0/1** |
| `empty-values` | 1 | **r 0/10** | A 10/10 | A 6/6 | A 3/3 |

The eighteen split into two kinds, and telling them apart is the point of the list:

| Cells | Kind | Why |
|---|---|---|
| `duplicate-keys`, `merge-keys`, `aliases`, `explicit-keys` × all four (16) | **hazard refusal — the intended answer** | Every attempt whose target *is* the flagged construct, an ancestor of it or a descendant of it was refused, in all four columns. This is the statement the matrix could not make before, and it is strictly stronger than what it said. |
| `no-final-newline` × `ItemMove` (1) | **capability gap** | **D2p's measured cost.** Every file without a final break either ends in the item a move would carry, or would have to terminate a line that never was terminated. Both destinations are refused by name. Phase 0c-3b-2a's review forced that refusal in place of the rotation that used to pass. |
| `empty-values` × `ScalarEdit` (1) | **capability gap** | A zero-width scalar has no bytes to rewrite, so the answer is `EditError::EmptyTarget` every time. The other three operations reach an empty value through the construct that holds it and apply. |

**Four rows changed from `Applied` to `RefusedOnly` in the retabulation**, and every
one of them because the `Applied` was co-occurrence: a merge key, an alias, an
explicit key or a duplicate key never once let through an operation that reached it.
The review's own example — an insertion into `global_vars[0].params` crediting
`explicit-keys` — is exactly the cell that changed, and experiment E11 reproduces it.

R12's "refused by scope, not by file" has not been dropped; it has moved to where it
can actually be stated. `explicit-key-mappings.yml`'s `global_vars:` sibling still
applies 10 scalar edits, 6 insertions and 3 removals, and those appear in this table
under the axes that sibling itself carries. The per-fixture outcome rows
(`SYNTHETIC_OUTCOMES`) are what pin them, and not one of those rows moved.

**The real corpus has 0 refusal-only cells**, because it carries none of the six
refused constructs: 13 files carry comments, 11 block-scalar terminal newlines, 10
nested sequence mappings, 5 trailing spaces and 1 no final newline, and every one of
those met all four operations with at least one application.

The per-construct property is *also* asserted separately and per hazard family, which
was already the stronger statement and is now corroborated by the matrix rather than
contradicted by it:

| Hazard family | Attempts it blocked | Applications |
|---|---|---|
| `MergeKey` | 23 | **0** |
| `AliasReference` | 9 | **0** |
| `AnchorDefinition` | 31 | **0** |
| `ExplicitKeyMapping` | 11 | **0** |
| `ExplicitTag` | 9 | **0** |
| `DuplicateMappingKey` | 15 | **0** |
| `MultiDocumentStream` | 33 | **0** |
| `CommentInFlowCollection` | 18 | **0** |

Every attempt count is pinned exactly and every one is asserted `> 0`, so a
construct cannot quietly stop contributing; every application count is asserted `0`,
so the refusal is **total per construct**. That pair is what "state the refusals
explicitly rather than letting them count as passes" means in practice.

---

## 3. R16 — the tag-resolution oracle

### 3.1 Why not a second parser crate

Settled by consultation and recorded in
[`docs/reviews/phase-0c-3b-2b-r16-consultation.md`](../reviews/phase-0c-3b-2b-r16-consultation.md).
The short form:

- a **syntax-level** reparse is largely theatre here. The bytes outside an edit are
  already proven identical, and every scalar the emitter *writes* is conservatively
  quoted. A second parser would mostly confirm that a document we did not change
  still parses;
- the danger class that actually survives is **implicit type resolution**, and no
  maintained crate implements YAML 1.1's. libyaml's event parser exposes no
  application-level resolver; `yaml-rust` 0.4 is unmaintained and its resolver is not
  reliably full 1.1; `yaml-rust2` and `saphyr` target 1.2; `serde_yaml` is
  `0.9.34+deprecated`;
- adopting one would be reassurance rather than evidence, and **a wrong second
  oracle is worse than an honest single one**.

So the crate gains **no dependency, in the library or in dev-dependencies**. The
rules are written down and owned.

### 3.2 What the table says

`src/emit/tags.rs` implements `resolve_plain_yaml_1_1` and
`resolve_plain_yaml_1_2_core`, each returning a `(tag, canonical)` pair. The tag
alone is not enough: `012` is `int` under **both** schemas and is **ten** under 1.1's
octal rule and **twelve** under 1.2 core. A tag-only comparison would call that a
match.

Where the two disagree, exhaustively:

| Text | YAML 1.1 | YAML 1.2 core |
|---|---|---|
| `y` `Y` `yes` `Yes` `YES` `n` `N` `no` `No` `NO` `on` `On` `ON` `off` `Off` `OFF` | `bool` | `str` |
| `012` | `int` = 10 (octal) | `int` = 12 |
| `0b101` | `int` = 5 | `str` |
| `0o17` | `str` | `int` = 15 |
| `12:30` | `int` = 750 (sexagesimal) | `str` |
| `1:30.5` | `float` = 90.5 | `str` |
| `+0o17` | `str` | `int` = 15 — **see deviation 4** |
| `2001-12-14`, `2001-1-1`, `2001-1-1 10:00:00` | `timestamp` — **see deviation 3** | `str` |
| `1e3`, `1.0e3` | `str` — 1.1 needs a decimal point **and** a signed exponent | `float` |
| `<<` | `merge` | `str` |
| `=` | `value` | `str` |

Agreeing in both: `true`/`True`/`TRUE`, `false`/…, `null`/`Null`/`NULL`/`~`/empty,
plain decimal integers, `0x…`, `1_000` (**changed by deviation 4** — `int` = 1000 in
both), ordinary base-10 floats with a signed exponent, `.inf`/`.nan` and their case
variants.

**Four deviations from the printed productions, every one towards what a real
implementation does and every one in the direction that reports *more* danger**, all
recorded in the module docs. The first two were in the phase; the second two are the
review's second finding:

1. the 1.1 float production `[-+]?([0-9][0-9_]*)?\.[0-9_]*(…)` literally matches a
   lone `.`, which no implementation resolves as a float. At least one digit is
   required here, as in libyaml and PyYAML. (A run of `_` with no digit at all —
   `0x_` — is rejected on the same ground, in `radix_value`.)
2. the timestamp production's time-zone part is accepted with optional white space
   before **both** `Z` and a numeric offset, as PyYAML accepts it;
3. **the timestamp's date-only form takes one or two digits for month and day.** The
   printed production is `[0-9]{4}-[0-9]{2}-[0-9]{2}` and PyYAML transcribes it
   exactly, so `2001-1-1` is a *string* to PyYAML. Ruby's Psych — also a YAML 1.1
   implementation — uses `\d{4}-\d{1,2}-\d{1,2}` and reads it as a date. The review is
   right that the old code called `2001-1-1` a string, and right that this table must
   never narrow a shape, so the broader reading wins. **The review's stated reason —
   "the YAML 1.1 timestamp implicit resolver admits one- or two-digit month and day in
   the date form" — is true of Psych and not of the printed regexp or of PyYAML**, and
   this note says so rather than repeating it;
4. **the 1.2 core integer production accepts a sign before a radix prefix, and
   underscores between digits.** The printed core schema is
   `[-+]?[0-9]+ | 0o[0-7]+ | 0x[0-9a-fA-F]+` — no sign on the radix forms, no
   underscores — so, strictly, `+0o17` is a *string* under 1.2 core and the old code
   was faithful. `go-yaml` v3, a widely used 1.2 consumer, resolves integers with Go's
   `ParseInt(_, 0, 64)` and accepts both. Accepting them here **can only add an
   ambiguity report and never remove one**: a text YAML 1.1 already resolves to a
   non-string is reported by the *first* half of `plain_scalar_is_ambiguous` whatever
   the 1.2 side says, so the only texts this deviation moves are ones 1.1 calls
   strings — and moving them means quoting them.

**Shape, never arithmetic.** A text that matches a production is classified by that
production even when its value does not fit in an `i128`. The review found
`yaml_1_1_sexagesimal` returning `None` on overflow, which called a 39-digit
sexagesimal a *string* — the one classification that lets the emitter write it plain.
It now renders `60#digits`, as the other four bases already did, and
`a_value_too_large_for_our_integers_is_still_classified_by_its_shape` pins all five.
`render_float` gained the same fallback for symmetry, so no float production can be
turned back into a string by a parse failure either.

**The `012` claim, checked.** The review calls "`012 → 12` under 1.2 core" unfaithful.
It is not: the core schema's decimal production is an unrestricted `[-+]?[0-9]+`, it
matches `012`, and the schema reads the match as decimal — which is what `saphyr` and
`serde_yaml` both do, and `saphyr` is the substrate this crate actually reparses with.
`go-yaml` reads the same three bytes as **ten**, because Go's base-0 `ParseInt` treats
a leading zero as octal. So implementations disagree, our 1.2 side models the one
verification consults, and either way `012` is reported ambiguous by the 1.1 half. The
implementation is unchanged and this paragraph is the correction the review asked for.

The timestamp matcher is deliberately **syntactic**: `2001-13-99` is a timestamp to
it, because it is one to the resolver that uses the production. Pinned by
`a_timestamp_may_have_single_digit_fields_and_a_space_separator`, which also pins the
three shapes that are *not* timestamps — three digits in a field, a missing field, and
trailing blanks with no time zone after them (the blanks belong to the zone group, as
in PyYAML; the old code accepted a trailing run of blanks and now does not).

### 3.3 The property is differential, and that is the design point

`no_ambiguous_plain_scalar_is_introduced` in `src/patch/edit.rs` is a **multiset
containment**: for every ambiguous plain scalar text, the candidate may hold no more
occurrences than the source did.

It is **not** "the corpus contains no ambiguous plain scalars". Real espanso files
legitimately contain `true`, `on` and `100`; a test demanding their absence would be
wrong, and would have to be deleted the first time it met a real config. Instead:

- pre-existing ambiguities are **reported and counted as data** (section 3.5);
- an edit that **introduces** one, or that increases the count of one, is a
  **hard failure** — `VerificationFailure::AmbiguousPlainScalarIntroduced`.

Deleting one is fine. Relocating one is fine. Writing one is not. That is the
property that actually protects the user's file, and it is checkable exhaustively.

It is stated **twice**, independently: once in production `verify()`, and once in the
gate sweep's `check_universal` (property 7). The production copy reads the reparsed
candidate's own scalars; nothing in it comes from the planner, the replacement list
or the style the emitter chose. Section 6 shows each catching the other's absence.

### 3.4 D2h's claim, checked against the oracle — and it did not hold

D2h says the plain predicate "rejects every YAML 1.1 boolean/null/sexagesimal
spelling". The oracle was built first and the predicate measured against it, over
**3 000 000 seeded values** drawn from an alphabet of every character that can open
or continue a 1.1 implicit type, plus the space a timestamp may use as its
separator.

That comparison was one-sided and remains valid as such: it asked whether the *shape
test* misses something the *table* catches, which is a real question with a real
answer whichever way the table is checked. What it could **not** ask is whether the
table itself is right — section 3.4a.

**The predicate had 33 distinct gaps**, in two families:

- `=`, which YAML 1.1 resolves to `tag:yaml.org,2002:value`. The predicate has no
  clause that mentions it;
- the `._7` / `.__2` / `._78E-8` family. `resembles_a_typed_scalar`'s numeric test
  begins with "opens numerically", which for a leading `.` requires the **next**
  character to be a digit. `._7` has `_` there, so the shape test says string, while
  1.1's `\.[0-9_]+` float production matches and resolves it to 0.7.

A hand-built counterexample added a **34th**, in a third family:
`2001-1-1 10:00:00` — a timestamp with single-digit month, day and hour and a
**space** where a `T` would be. `looks_like_a_date` requires two digits for month and
day, and the space is outside `NUMERIC_ALPHABET`, so both halves of the shape test
miss it.

**No scalar in either corpus exhibits any of the 34.** That is why three phases of
corpus sweeps never saw it, and it is R20's lesson for the sixth time: the corpus is
the weak link, and only a generated sweep found this.

**Fixed, in production.** `is_conservatively_safe_plain_scalar` now consults the
oracle as well as the shape test. Both are kept: neither contains the other — the
shape test still quotes `0800-CALL` and `yEs`, which the oracle correctly calls
strings — and their union is strictly safer.

No pinned corpus count moved as a result of the predicate change, because
`reencode_in_place` does not consult it and no corpus scalar is one of the 34.

### 3.4a The differential was circular, and now it is not

**The review's second finding, and the more important half of it.** The retained
sweep used to compare `plain_scalar_is_ambiguous` against a predicate that itself
calls `plain_scalar_is_ambiguous`, so "0 gaps" measured only that the emitter is a
conservative superset of **its own table**. A table cannot be its own oracle, and the
sixteen hand-written counterexamples were a start rather than completeness.

`tests/gate_roundtrip.rs` now carries `mod independent_yaml_1_1`: **a second
transcription of the YAML 1.1 productions**, written from the type repository,
answering one question — *does 1.1 resolve this text to something other than a
string?* — with no canonical values and no call into `src/emit/tags.rs`. It is written
differently on purpose: `tags.rs` scans with a mutable cursor and renders values, this
matches with slice predicates and returns `bool`. Where the productions themselves
dictate the shape the two necessarily look alike, and the case table is what carries
external knowledge there. The five documented deviations are transcribed too, because
they are the module's specified behaviour and an oracle that omitted them would report
policy as defect.

`the_emitters_predicate_never_disagrees_with_an_independent_transcription` makes three
claims, in increasing strength:

1. a hand-written table of **77 cases**, every family on **both** sides of its
   condition — nulls, the twenty-two booleans and four near misses, `<<`/`=`, all five
   integer bases with a near miss each, base-60 both ways and past `i128`, base-10 and
   base-60 floats, the mandatory exponent sign, `.inf`/`.nan`, and timestamps in every
   admitted form plus four that are not — is right about **both** implementations;
2. over **500 000 generated values** from two generators — a character alphabet of
   everything that can open or continue an implicit type, and a token generator that
   assembles keywords and numeric fragments — the library's resolver and the
   independent transcription **never disagree**. 43 773 of the 500 000 resolve to a
   non-string, so the sweep is not vacuous, and that number is printed;
3. the emitter never writes plain anything the **independent** reading of YAML 1.1
   calls a non-string. That is the non-circular form of "0 gaps".

Experiments E9 and E10 in section 6 break `tags.rs` in two ways and show each half
firing: E9 a family the case table covers, E10 a family it does not, caught only by
the generated differential.

**The 1.2 half has no second implementation and this document does not pretend
otherwise.** `the_ambiguity_predicate_covers_the_disagreement_half_as_well` is
hand-built, and section 4.3 is where that residual risk stays.

### 3.5 The census, both corpora

Reported as **data**, never failed on.

| | Synthetic | Real |
|---|---|---|
| Plain scalars examined | 823 | 787 |
| Not `str` under YAML 1.1 | **31** | **65** |
| — of those `bool` | 19 | 65 |
| — `null` | 5 | 0 |
| — `int` | 4 | 0 |
| — `merge` | 2 | 0 |
| — `float` | 1 | 0 |
| 1.1 / 1.2 disagreements | **5** | **0** |
| — same tag, different value (the `012` class) | 0 | 0 |

The synthetic figures are pinned exactly. The real ones are computed and printed and
**nothing about them is hard-coded**; they are counts and tag names only, never
values (`CLAUDE.md` section 1). The 5 synthetic disagreements are the two `<<`, the
two `y` and the one `yes`. The real corpus's 65 are all booleans, which both schemas
agree on — so for this user's configuration the 1.1/1.2 gap is currently **zero**,
and the 65 are the projection question of section 4.4 rather than an edit question.

The `012` class being 0 in both corpora is pinned so that its absence is a
measurement rather than an oversight.

---

## 4. R16 stays open, and this is the wording

> **R16 stays open: byte preservation and conservative emission prevent edits from
> changing untouched bytes or introducing known YAML 1.1-ambiguous plain scalars, but
> the UI projection of pre-existing plain scalars is not yet proven to match
> espanso's resolver.**

The residual risk, phrased for the risk table:

> A pre-existing or explicitly tagged scalar may be displayed or used by the typed
> projection with a different type/value than espanso assigns, and an incomplete
> hand-maintained resolver table or an espanso-specific schema change could leave
> that disagreement undetected.

### 4.1 What is now closed, stated to the strength the evidence supports

The phase first wrote "edits cannot **introduce** an ambiguity", full stop. The review
is right that that overstates: two statements of one rule are two statements of *that
rule*, and the rule is a hand-maintained table. The honest version:

> **No edit introduces a plain scalar that this crate's YAML 1.1 table calls
> ambiguous.** Two independent statements say so — the emitter's predicate, which now
> consults the oracle, and `verify()`'s differential property — and section 6 shows
> each firing without the other. The guarantee is **bounded by the table's
> correctness**, and the table's correctness is bounded by section 4.3.

What the review round changed is how much that bound is worth. The 1.1 half of the
table now has a **second, independently written transcription** to disagree with it
(section 3.4a), which is the one thing section 4.3 said it lacked. Four concrete
errors it had — the date-only timestamp, the overflowing sexagesimal, the signed 1.2
radix forms and the underscored 1.2 decimal — are fixed and pinned. The 1.2 half still
has no second implementation.

### 4.2 What is not

The **projection**. `matches[0].replace` holding a plain `on` is a boolean to
espanso and a string to us, and this phase does not change that. It measures it
(section 3.5) and refuses to make it worse. Closing it needs either espanso's own
deserializer as a dependency, or a decision about how the UI shows a scalar whose
1.1 tag is not `str`.

### 4.3 The table is hand-maintained, and the halves are no longer equally weak

That is the second half of the residual risk and it is not rhetorical. The table is
5 productions for 1.1 and 3 for 1.2, transcribed by hand, with 4 deliberate
deviations. It is unit-tested against all 22 boolean spellings, the disagreement cases
of section 3.2, thirteen timestamp shapes, the five out-of-range integer bases and
nine ordinary espanso strings.

The two halves now stand differently, and saying so is the point of this section:

- **the 1.1 half has a second implementation.** `mod independent_yaml_1_1` in
  `tests/gate_roundtrip.rs` is a separate transcription of the same productions,
  differentially swept over 500 000 generated values and checked against a 77-case
  hand table. That is not the same as an *external* implementation — one author wrote
  both, and a misreading of a production could survive in both — but it is no longer a
  table compared with itself, and the phase's own objection to a second parser
  ("a wrong second oracle is worse than an honest single one") does not apply to a
  transcription that is checked case by case against a written-down expectation;
- **the 1.2 core half has none.** It is checked only by hand-written cases and by the
  argument that a false "int" there can only *add* an ambiguity report. That is where
  the residual risk now lives, and it is smaller than the 1.1 half's was, because the
  1.2 side is consulted only for the second, weaker clause of
  `plain_scalar_is_ambiguous`.

The review round found **four** concrete errors in the 1.1/1.2 table, all of which had
survived the phase's own 3 000 000-value sweep because that sweep was circular. That
is the measured value of an independent oracle, and it is also the reason this section
is not deleted: the next four errors are the ones neither transcription has.

### 4.4 Explicit tags are outside it entirely

`!!str`, `!custom` and friends raise `HazardKind::ExplicitTag` and are refused, so no
edit reaches them. The oracle says nothing about them, and the residual-risk sentence
names them for that reason.

---

## 5. R24 answered: what the sweep proves, the engine now asserts

R24 is a standing instruction, not a closed incident: *when a sweep proves something
the engine relies on, ask whether the engine asserts it too.* This phase's answer, in
both directions:

- **Yes, and it was not asserted.** The R16 differential property began as a test
  idea. It is now `no_ambiguous_plain_scalar_is_introduced` inside `verify()`, a
  typed `VerificationFailure`, with the test-side derivation **kept** as the second
  statement. Without it, a future emitter defect would mint a `PatchedDocument`
  holding a plain `no` and every other property would certify it — which is exactly
  what experiment E2 in section 6 demonstrates.
- **And the phase missed one, in the same class, in the same phase.** Experiment E5
  showed a removal envelope deleting a blank line the entry does not own, caught by
  **nothing in production** and only by the gate sweep's own line bound. Section 6.1
  of this document originally presented that as *evidence the sweep is an oracle*. The
  review's reading is the correct one: a property whose only home is a test file is
  not a safety property, so E5 was R24 open as a class, one phase after R24 was
  written down as a standing instruction. It is closed below.
- **`PatchedDocument` gained no public constructor and no public field**, so the new
  property is unavoidable rather than advisory.
- The **oracle itself lives in the library**, not in the test suite, for the same
  reason: the emitter has to be able to consult it.

`AmbiguousPlainScalarIntroduced` is pinned at **0** over both corpora and argued
unreachable — the emitter never writes such a value plain. Like
`RemovalWouldDeleteAFileComment`, it is an **assertion, not a policy**, and its
unreachability is demonstrated rather than asserted: the retained unit test
`the_ambiguity_property_fires_on_a_candidate_no_emitter_would_produce` hands it the
candidate a defective emitter would have made, and shows it firing, refusing to fire
on the three legitimate shapes (kept, deleted, relocated), and **counting** rather
than merely looking up — two occurrences where the source had one is still an
introduction.

### 5.1 `RemovalCarriesMoreThanTheEntry` — E5 closed in production

The sixth verification property, and the review's blocking finding. It is the
removal's counterpart of `MoveCarriesMoreThanTheItem`, and it exists because the two
halves `StructuralGuard::Removal` already had are both stated over **node spans**, and
a blank line holds no node:

- no node is crossed, so the first half is blind;
- every token of the entry is still covered, so the second half is blind;
- the mapping loses exactly one entry, so `verify_field` is blind;
- the line decodes to nothing, so every sibling digest is unchanged;
- and `bytes_outside_the_replacements_match` positively **authorises** the deleted
  byte, because the envelope declared it. That is the circular authorisation the Phase
  0c-2b review named, in its last remaining hiding place.

`entry_owned_runs` derives the bound in two steps, and **consults nothing
`removal_envelope` produced**:

1. **the entry's own physical lines**, walked from the source text and the key's and
   value's node spans — the whole subtree's minimum start and maximum end, because a
   block collection's span stops at its last child and a block scalar's content ends
   past its final break — then up over the contiguous comment-only lines directly
   above, stopping at the first blank or non-comment line, and asking the syntax index
   rather than the text whether a `#` is inside a frontier leaf;
2. **minus what ownership keeps** — the whole line of every file-owned comment inside
   those lines, grown over the blank runs that touch it. That is **D2o's rule read the
   other way round**: a blank run survives exactly where it touches a kept file-owned
   comment's line, so a blank run touching no such line is the entry's own interior
   trivia and may go with it. A blank line *inside* a removed entry's own block scalar
   is inside the envelope; E5's blank line, below the entry, is outside it. **The
   distinction is ownership, not whether the byte decodes to YAML data.**

It duplicates `preserved_regions` rather than calling it, deliberately and for the
same reason `item_own_lines` duplicates the move envelope's boundary:
`preserved_regions` punches its holes out of **the hull the planner built**, so an
envelope that widened by a line would be handed its own widened hull as the window to
check against. Both consult the same ownership layer — there is one answer to "who owns
this comment" and re-deciding it in the edit layer is what D2/D2d forbids — but they
disagree the moment the hull is wrong, which is the whole point.

**A move's source half is deliberately not bounded here.** `StructuralGuard::Removal`
carries an `EnvelopeKind`, and a move's envelope says `CarriesTheItem`: `verify`
already bounds it twice with the same two arguments —
`MoveCarriesMoreThanTheItem` for the item's own lines and `CommentOwnershipChanged`
for the blank run a kept comment's ownership rests on — and both report a failure that
names the move. Bounding it a third time here would pre-empt both and report a
removal's failure for a move, which the retained experiments C5 and the
comment-ownership one would have shown as a regression. They still assert their own
names.

**Not one legitimate removal in either corpus moved.** Every pinned count is
unchanged: 2 080 synthetic attempts with the same applied/refused split per fixture,
and the real corpus's removals apply exactly as before at every target the stride used
to skip as well as the ones it did not.

---

## 6. The disabling experiments, verbatim

Every experiment below was run by editing production or test code, capturing the exact
message, and reverting. The tree is clean of all of them. **Twelve**: E1–E7 from the
phase, E5b and E8–E12 from the review round, and E5 re-run against the fixed engine.

### E1 — break the **engine**: the emitter's predicate stops consulting the oracle

`src/emit/choose.rs`, `is_conservatively_safe_plain_scalar`: the
`plain_scalar_is_ambiguous` clause disabled. The sweep asks every scalar for `._7`,
one of the 34 values the shape test alone lets through.

```
synthetic/anchors-aliases-tags-merge.yml edit node 59 value 2: unexpected outcome
the candidate holds a 3-byte plain scalar at byte 1289 that YAML 1.1 does not read
as a string and the source did not already hold
```

**The production property caught it**, before the sweep's own copy had a chance to.
That is the R24 answer working: a defect in the emitter is stopped by `verify()`,
not by a test.

### E2 — break the engine **and** the production property together

E1 plus `no_ambiguous_plain_scalar_is_introduced` disabled inside `verify()`.

```
synthetic/anchors-aliases-tags-merge.yml edit node 59 value 2: the candidate holds
1 occurrences of a 3-byte YAML 1.1-ambiguous plain scalar the source held fewer of
```

The sweep's own derivation catches it. The two are independent: neither is a
restatement of the other.

### E3 — break the **engine** a second way: `preserve_scalar` stops guarding

`src/emit/choose.rs`, the `ScalarStyle::Plain` arm of `preserve_scalar`: the
`is_conservatively_safe_plain_scalar(value)` guard removed, leaving
`is_conservatively_safe_plain_scalar` itself intact. This is a different defect from
E1 — the predicate is correct and the caller stops asking it.

```
synthetic/anchors-aliases-tags-merge.yml edit node 46 value 1: unexpected outcome
the candidate holds a 2-byte plain scalar at byte 1049 that YAML 1.1 does not read
as a string and the source did not already hold
```

### E4 — break the **engine**: the removal envelope widens by one line

`src/patch/edit.rs`, `removal_span`: the terminated-line case returns
`line_end_of(source, extent.end)` instead of `extent.end`.

```
synthetic/blank-lines.yml remove entry 22 of 19: unexpected outcome
the removal envelope run 468..581 reaches into node 24
```

`StructuralGuard::Removal` caught it. Disabling that guard as well:

```
synthetic/blank-lines.yml remove entry 22 of 19: unexpected outcome
edit 0: the mapping holds 1 entries where 2 were intended
```

`verify_field`'s entry count caught it independently. **Two production layers, in
series, neither derived from the other.**

### E5 — break the engine where **no** production layer could see it — *re-run*

The C5 shape, applied to a removal: `removal_span` swallows one following **blank**
line. It touches no node, so `StructuralGuard::Removal`'s node halves are blind; it
changes no entry count, so `verify_field` is blind; it decodes to nothing, so the
sibling digest is blind; and `bytes_outside_the_replacements_match` positively
**authorises** it, because the envelope declared it.

**As the phase first shipped it**, only the gate sweep's own property 3 saw it:

```
synthetic/block-scalar-header-tails.yml remove entry 7 of 4:
replacement 441..516 reaches outside the construct's own lines 441..515
```

The phase presented that as evidence the sweep is an oracle rather than a mirror. It
is also evidence that R24 was open as a class, and that is the reading the review
took. **Re-run against the fixed engine**, with the same defect written directly into
`removal_span` — after the terminated-line and unterminated-line cases alike, extend
`end` over one following line when that line is blank — and with **every** test-side
property still in place:

```
synthetic/blank-lines.yml remove entry 7 of 4: unexpected outcome
the removal run 27..45 is not inside the runs the entry owns within its own lines 27..44
```

That is `VerificationFailure::RemovalCarriesMoreThanTheEntry`, **from production**,
reached through `classify()`'s "a verification failure is a defect in the engine,
never an expected answer" arm. The sweep never got to check property 3.

### E5b — and the two are still independent

The same engine defect, with the new bound *also* disabled — `entry_owned_runs`'
containment loop short-circuited to `Ok(())`:

```
synthetic/blank-lines.yml remove entry 7 of 4:
replacement 27..45 reaches outside the construct's own lines 27..44
```

The gate sweep's property 3 catches it again, with nothing left in production to help.
**Two derivations of one boundary, each demonstrated to fire on its own**, which is
what D2q asks for and what E5 previously had only half of.

### E6 — break the **engine**: a move planner that permutes the lines it carries

`src/patch/edit.rs`, `plan_move`: the arrival text is the carried runs with their
first two lines swapped. This is the exact defect the Phase 0c-3b-2a review
constructed.

```
synthetic/blank-lines.yml move item 4 of 3: unexpected outcome
edit 0: the bytes written at byte 581 are not the bytes taken from the source;
they first differ 2 bytes in
```

`the_arrival_is_the_departure` caught it — D2q's property 4, in production, which is
where R24 put it. Disabling that:

```
synthetic/blank-lines.yml move item 4 of 3: unexpected outcome
edit 0: sequence position 2 does not hold the item the move intended to put there
```

Disabling `items_are_in_the_intended_order`,
`constructs_outside_the_move_are_unchanged` and `comment_ownership_survives` as well,
so that **every** production move property is off:

```
synthetic/blank-lines.yml move item 4 of 3:
the 35 bytes written are not the 35 bytes taken
```

The gate sweep's `check_move_is_a_relocation` catches it with nothing left in
production to help. Four layers, each demonstrated to fire on its own.

### E7 — break the **oracle** rather than the engine

The reverse direction, twice. First, `plain_scalar_is_ambiguous` returns `false`
unconditionally — a silently emptied oracle, which would make the predicate check
vacuously true:

```
"=" must be reported ambiguous
```

Second, a subtler one: the 1.1 **float** production removed from
`yaml_1_1_float`, leaving the bool, null, int, timestamp, merge and value rules
intact. This is the shape a hand-maintained table actually degrades into — one rule
quietly dropped, not the whole thing switched off:

```
"._7" must be reported ambiguous
```

Both are caught by the hand-built half of what is now
`the_emitters_predicate_never_disagrees_with_an_independent_transcription`. **The
generated half could not catch either when this was written**, because it compared the
oracle against the predicate and both consulted the same table. That circularity is
the review's second finding, and E9 and E10 below are what replaced these two.

### E8 — break the **matrix's** measurement, not the engine

Not a safety property, but the same question: can the coverage table disagree with the
sweep that fills it? `AXIS_COVERAGE` is asserted cell by cell against the measurement,
and `REFUSAL_ONLY_CELLS` is asserted to name exactly the cells the measurement finds
refusal-only and to have the same length. Deleting the `explicit-key-mappings.yml`
fixture, or letting one construct stop contributing attempts, turns a cell `Absent`
and fails; that is the property the matrix was built for and it is unchanged.

### E9 — break the **oracle** where a hand-written case covers it

`src/emit/tags.rs`, `yaml_1_1_timestamp`: the date-only form restored to the
pre-review "exactly two digits for month and day" rule — the state the review found.

```
assertion `left == right` failed: src/emit/tags.rs disagrees with the case table about "2001-1-1"
  left: false
 right: true
```

The 77-case table caught it. **The old circular test could not**: `2001-1-1` was not
one of its sixteen hand-built values, and comparing the emitter's predicate against a
predicate that calls the same table cannot see a table that is wrong.

### E10 — break the **oracle** where **no** hand-written case covers it

`src/emit/tags.rs`, `sexagesimal_group`: a third arm accepting a group of **three**
digits, which the base-60 production does not admit. No case in `YAML_1_1_CASES`
spells such a value, so only the generated differential can see it:

```
src/emit/tags.rs and the independent transcription disagree about:
["-14:191", "12:121", "43:000", "8:077", "-12:309", "9:930", "20011:000",
 "10:959", "1:109", "59:000", "-12:943"]
```

**This is the experiment the phase could not run at all.** Its generated sweep asked
the table about itself; this one asks a second transcription, and eleven distinct
generated values disagree.

### E11 — break the **attribution**: one axis back to document scope

`tests/gate_roundtrip.rs`, `Axis::scope`: `ExplicitKeys` returns
`Scope::Presentational`, which is exactly the attribution the phase shipped and the
review objected to.

```
assertion `left == right` failed: explicit-keys: coverage across the four operations
  left: [Applied, Applied, Applied, RefusedOnly]
 right: [RefusedOnly, RefusedOnly, RefusedOnly, RefusedOnly]
```

`left` is the review's own example, reproduced: `explicit-keys × FieldInsert` reads
`Applied` because an insertion into `global_vars[0].params` happened to run in a file
that also holds an explicit-key mapping. The pinned matrix refuses it.

### E12 — break the **memoisation**: an off-by-one in a precomputed order

`src/syntax/ownership.rs`, `starting_after`: `partition_point(|r| r.at <= position)`
instead of `< position`, which is the classic way a binary search replaces a scan
incorrectly.

```
assertion `left == right` failed: starting_after disagrees at 0 of
"matches:\n  - trigger: ':a'\n    replace: x\n  - trigger: ':b'\n"
  left: Some(NodeId(3))
 right: Some(NodeId(1))
```

`the_precomputed_primitives_answer_exactly_as_the_scans_they_replaced` compares the
three precomputed primitives against the linear scans they replaced, at **every byte
offset** of six documents and, for `enclosing_flow`, at every span between two
offsets. The scans are kept in the test module for exactly this.

A gentler mutation — swapping the `(at, depth, arena)` tie-break to
`(at, arena, depth)` — is **not** caught by those six documents, because none of them
holds two candidate nodes with the same endpoint and different depths at a position
any rule asks about. That is recorded rather than glossed: the differential is exact
on the shapes it carries and the corpus-wide pinned attribution counts are the second
line of defence.

---

## 7. What earlier documents claimed that this phase proves false

### 7.1 `HazardKind::ExplicitKeyMapping` had **no corpus fixture at all**

The largest finding of the phase, and it is a coverage hole in one of the six
constructs **R9 names by name**.

`PROGRESS.md` records 18 synthetic hazards, tabulated per family, and
`tests/trivia_scanner.rs` pinned `ExplicitKeyMapping` at **0** with the comment
*"nothing valid — they need the explicit `?` form"*. That comment was true and was a
**coverage hole rather than a property**: the explicit `? key` / `: value` form is
perfectly valid YAML, five phases of corpus sweeps never attempted an edit near one,
and the only thing exercising the hazard was a hand-written unit test in
`tests/trivia_scanner.rs`. R20's standing instruction is that a hazard gets a
**fixture**, not only a unit test.

The gate's coverage matrix is what found it: the `explicit-keys` row was `Absent` in
all four columns, which is precisely the shape the matrix exists to make visible.

`crates/espansoconfig-core/tests/corpus/synthetic/explicit-key-mappings.yml` closes
it. Its `matches:` subtree is refused whole; its `global_vars:` sibling is not, so it
also pins R12's "refused by scope, not by file" once more. It is an ordinary fixture
— its whitespace is not the test data — so it takes **no** row in `CLAUDE.md` section
4 and no entry in `tests/corpus_integrity.rs`. What *is* the test data is its `?`/`:`
punctuation, and an editor that "helpfully" rewrote it into the compact form would be
caught immediately by `tests/trivia_scanner.rs`, whose per-family hazard pin for
`ExplicitKeyMapping` is now **1** and is asserted exactly.

Counts it moved, all retabulated with an explanatory comment at each constant:

| Where | Was | Is |
|---|---|---|
| synthetic fixtures | 32 | **33** |
| hazards (`ExplicitKeyMapping` 0 → 1) | 18 | **19** |
| trivia items | 3 458 | **3 520** |
| scanner comments | 321 | **331** |
| scanner blank lines / runs | 118 / 114 | **119 / 115** |
| `syntax_index` scalars and frontier members | 1 016 | **1 031** |
| `syntax_index` collections | 300 | **307** |
| `syntax_index` gap comments | 316 | **326** |
| `syntax_index` gap blank lines | 843 | **855** |
| overshooting block collections | 273 | **280** |
| `patch_path` nodes / addressable / documents / mapping keys | 1 355 / 780 / 34 / 537 | **1 378 / 793 / 35 / 546** |
| `scalar_codec` scalars / identical re-encodes | 1 011 / 997 | **1 026 / 1 012** |
| `patch_edit` attempts / applied / gate refusals | 5 700 / 5 359 / 276 | **5 772 / 5 419 / 288** |

The fixture carries 10 whole-line comments and **no** inline one, so both comment
conventions gained exactly 10 and the documented gap of 5 between them is unchanged —
the cross-check every new fixture pays.

### 7.2 D2h's "rejects every YAML 1.1 boolean/null/sexagesimal spelling" was incomplete

Section 3.4. It rejected every *boolean, null and sexagesimal* spelling — that part
is true — but the sentence has been read as "rejects everything YAML 1.1 resolves",
and 34 values say otherwise. The predicate is fixed and the claim is now true because
the predicate consults the oracle, not because the shape test was ever sufficient.

### 7.3 "The cheapest real mitigation is to reparse with a 1.1 implementation"

R16's row has said this since Phase 0c-1. It is **withdrawn**. There is no
maintained 1.1 implementation with an application-level resolver to reparse with,
and a nominal one would have produced a *weaker* answer than the table does, because
parse success is not the question. Section 3.1.

### 7.4 The gate sweep's first sampling of removals was wrong

Recorded because it is the kind of mistake that would otherwise be invisible: the
first draft removed only the **first** entry of each mapping. Four axes then showed
`RefusedOnly` in the removal column, purely because the first entry of an espanso
match shares its line with the sequence dash. The coverage matrix caught it before
the phase ended. A sweep that samples badly and a corpus that lacks a shape look
identical in a count; only a per-cell statement tells them apart.

### 7.5 …and its second sampling was wrong too, in the way R19 had already named

The review round's own entry in this list, and the one the phase should have caught
itself. `REAL_CORPUS_STRIDE = 3` took every third mapping and every third sequence of
the real corpus, and section 1.3 described that as "every code path is still reached".
`PROGRESS.md`'s R19 had already ruled on the trade-off in as many words — *"if it
bites, memoise `ownership.rs`'s primitives by position rather than thinning the
sweep"* — and the phase did the thing the instruction ruled out and then wrote that it
had not thinned anything to hide a cost (section 9's old R19 bullet). Both are now
false: the stride is gone, the primitives are memoised, and section 9.1 has the
numbers.

The lesson generalises past this phase and belongs with R20's: **a standing
instruction that names the cheap wrong answer is naming it because it is the one that
will be taken.**

### 7.6 A comment in `tests/patch_path.rs` had arithmetic that did not add up

Documentation drift rather than a regression, found by the review and corrected. The
comment enumerating `explicit-key-mappings.yml`'s contribution said "6 collections"
and "16 scalars" while the structure it *listed* was seven and fifteen — which is what
`tests/syntax_index.rs` pins independently. The asserted total of 23 was right
throughout. Corrected in place, with the correction itself recorded in the comment so
the next reader does not re-derive it.

---

## 8. The gate verdict, re-derived

**The first time this section was written it said PASSED with three qualifications.
On the evidence at the time it should not have: E5 was a demonstrated production
escape, and section 8.1's last bullet cited it as *supporting* evidence. The review is
right. This is the verdict re-derived after the fixes, not the same verdict reworded.**

**The Phase 0 architectural gate (R4) is PASSED, with four qualifications named
below. The blocking finding is closed in production and demonstrated closed.**

### 8.1 The evidence

- `cargo test --workspace` — exit 0, **439 tests**, no test ignored, weakened or
  deleted. Five are new (section 9.2); every retabulated pin is explained where it is
  written and in section 9.2. The same suite with `tests/corpus/real/` renamed away
  also passes, with the gate binary dropping from 16.9 s to 2.5 s, which is the
  real-corpus sweep skipping cleanly.
- **The R9 round-trip sweep runs over every eligible target of both corpora**: 2 080
  synthetic attempts (1 696 applied) and **1 998** real ones (1 851 applied) — no
  stride, no thinning — with all eight properties of section 1.2 checked on every
  applied edit, and every refusal typed and, for the hazard families, re-derived from
  the document. "Passes on the full corpus" therefore means *every eligible target in
  every file*, not *every file*; section 9.1 has the runtime that bought it.
- **Every one of R9's twelve named axes is met by every one of the four operations,
  with the crossing measured operation-locally.** No cell is `Absent`; 18 of the 48
  are `RefusedOnly`, 16 of them because the construct is one the gate refuses and 2
  because the engine declines an operation it cannot perform safely. Each of the 18 is
  enumerated, and the enumeration is asserted against the measurement rather than read
  off the table.
- **The four constructs R9 names as refused are refused totally**, both per hazard
  family — merge keys 23 attempts / 0 applications, aliases 9 / 0, anchors 31 / 0,
  explicit keys 11 / 0, tags 9 / 0, duplicate keys 15 / 0, multi-document 33 / 0, flow
  comments 18 / 0 — **and now per matrix cell**, which is the statement the
  document-scoped matrix could not make.
- **Not one verification failure occurred anywhere in either corpus.** Every
  `VerificationFailure` variant remains a defect indicator, and the sweep panics on
  any of them.
- **The removal envelope has a production bound derived independently of itself.**
  `RemovalCarriesMoreThanTheEntry` is the sixth verification property (D2q's five plus
  this), it is what E5 now hits, and E5b shows the sweep's own bound still fires
  without it. **The gate no longer rests on any property whose only home is a test
  file.**
- **The tag table has a second, independently written transcription of its YAML 1.1
  half**, differentially swept over 500 000 generated values with 43 773 non-string
  resolutions and zero disagreements, plus a 77-case hand table covering every family
  on both sides of its condition. The four errors the review named are fixed and
  pinned.
- The gate's properties were shown to be able to **disagree with the engine**:
  **twelve** experiments, five of which break the engine rather than a checking layer,
  and none of which is now caught only outside production.

### 8.2 The qualifications

1. **R16 is open**, in the exact wording of section 4. No edit introduces a plain
   scalar *this crate's table* calls ambiguous; the *projection* of pre-existing ones
   is unproven. 31 synthetic and 65 real plain scalars are non-`str` under 1.1 today.
2. **The tag table is still hand-maintained, and its 1.2 core half still has no
   second implementation** (section 4.3). The 1.1 half now has one, and it found
   nothing further after the four fixes; that is evidence, not proof. Four deviations
   from the printed productions are deliberate and named, and two of them (3 and 4)
   follow one real implementation against another.
3. **D2r's scope stands.** "Copied verbatim without re-indentation" is a fact about
   moving an item between two positions of **the same block sequence**. Cross-sequence,
   cross-document and cross-file moves are not implemented and are not covered by
   anything above. The gate does not imply them.
4. **The weak pins named at the start of the phase are still weak.** R22
   (`InconsistentEntryIndentation` pinned at 0 by argument) is untouched and remains
   the weakest pin in the table. R25 (move verification is not compositional, so
   `OverlappingEdits` is never tested against a move-versus-edit conflict) is
   untouched. R26's `shares_a_line` is still a unit test rather than a fixture,
   although `comment_ownership_survives` now has more corpus exposure through the
   gate's 65 synthetic and 68 real applied moves.

None of the four blocks Phase 1. Qualification 1 is a *display* question, not a
*corruption* question, and the corruption half is closed to the strength section 4.1
states. Qualification 2 is the bound on that strength, measured rather than asserted.
Qualification 3 is a scope statement about an operation that does not exist.
Qualification 4 is three named, argued, non-silent holes.

**What would have kept it closed.** E5 unfixed, or the differential still circular
after the review named it, or the real sweep still strided with no measurement to say
what the stride cost. None of the three is the case; all three were the case when
section 8 first said PASSED.

### 8.3 What "passed" does and does not license

It licenses UI work on the operations that exist: editing a scalar, adding a field,
removing a field, and reordering matches inside one sequence. It does **not** license
presenting a plain scalar's *type* to the user, moving a match between files, or
combining a move with any other edit in one batch.

---

## 9. R19, the measurements, and what the review round moved

### 9.1 R19 is partly closed, and the stride is gone

`ownership.rs`'s three hot primitives — `ending_before`, `starting_after` and
`enclosing_flow` — each scanned **every node** of the document and are called once per
trivia item, so `TriviaIndex::scan` cost O(items × nodes). They are now answered from
three orders built once per scan:

- `by_end`, the non-empty candidates sorted by `(end, depth, arena)`. The last entry at
  or before a position is the maximum the scan looked for; the same-line test is
  applied to that one alone because it is **monotone** — a break between the largest
  such end and the position lies between every smaller end and the position too;
- `by_start`, every candidate sorted by `(start, depth, arena)`. The first entry at or
  after a position is the minimum the scan looked for;
- `flows`, the flow collections alone, which are a handful per document.

The `arena` component is the node's position in `SyntaxIndex::nodes`, and it is there
so the orders break ties **exactly** as the scans did: `max_by_key` returns the last
maximum in iteration order and `min_by_key` the first minimum, and iteration order was
arena order. `innermost_containing` is deliberately left a scan: it is asked only about
unclassified bytes, which raise a hazard that disqualifies the whole document.

**No answer changes**, and that is asserted rather than argued:
`the_precomputed_primitives_answer_exactly_as_the_scans_they_replaced` keeps the three
scans in the test module and compares them at every byte offset of six documents and,
for `enclosing_flow`, at every span between two offsets. Experiment E12 shows it
firing. The corpus-wide pinned attribution counts — 3 520 trivia items, 331 comments,
19 hazards, every ownership rule test — are the second line of defence, and not one
moved.

One test-side change belongs with it: the gate's `check_universal` used to call
`TriviaIndex::scan(source, before)` **once per attempt** to get the source's
file-owned comments. The source does not change, so the file's trivia is now scanned
once and passed in.

Measured, on the real corpus, debug build:

| Configuration | Real-corpus targets | `every_r9_axis…_over_the_real_corpus` |
|---|---|---|
| As the phase shipped: `REAL_CORPUS_STRIDE = 3`, scanning primitives, per-attempt trivia rescan | 1 373 attempts | **31.06 s** |
| Exhaustive, scanning primitives, trivia scanned once per file | 1 998 attempts | **31.15 s** |
| Exhaustive, precomputed primitives, trivia scanned once per file | 1 998 attempts | **17.03 s** |

So the middle row is what the stride was hiding — 45 % more work for the same
wall-clock — and the bottom row is what R19's instruction bought. The gate test binary
goes from 31.83 s to 16.94 s, and `cargo test --workspace` from **87.9 s to 39.4 s**,
while sweeping more.

**The sweep is exhaustive, not sampled**, and the verdict says so without hedging.

R19 is not closed: `TriviaIndex::scan` is still O(items × log nodes) with the safe
entry point rescanning on every call, which is what matters for a UI that rescans on a
keystroke. What is closed is the part that was distorting this phase's evidence.

### 9.2 The five new tests, and every retabulated pin

New (434 → **439**):

| Test | What it pins |
|---|---|
| `ownership::the_precomputed_primitives_answer_exactly_as_the_scans_they_replaced` | R19's precomputation answers as the scans did, at every offset of six documents |
| `tags::a_value_too_large_for_our_integers_is_still_classified_by_its_shape` | all five integer bases classify by shape past `i128` |
| `edit::experiment_e5_a_removal_that_swallows_a_following_blank_line_is_rejected` | the review's exact shape, plus the honest plan applying and an entry that *does* own its blank line |
| `edit::the_entry_owned_runs_bound_keeps_the_blank_run_a_file_comment_rests_on` | D2o's rule as a bound: the blank run under a kept file comment is outside what the entry owns |
| `gate::the_ambiguity_predicate_covers_the_disagreement_half_as_well` | the 1.2-only integer spellings and the `012` class, hand-built |

Renamed, not added: `the_emitters_predicate_never_disagrees_with_the_oracle` →
`…_with_an_independent_transcription`, because it no longer compares the table with
itself.

Pins that **moved**, each with its reason:

| Pin | Was | Is | Why |
|---|---|---|---|
| `AXIS_COVERAGE`, four rows | `Applied` in some columns | `RefusedOnly` in all four | Operation-local attribution. The `Applied` was co-occurrence; the construct itself never let an operation through. Section 2.3. |
| `AXIS_COVERAGE`, `empty-values × ScalarEdit` | `Applied` | `RefusedOnly` | Same. A zero-width scalar is `EmptyTarget` every time; the `Applied` came from other scalars in the same file. |
| refusal-only cells | 5 (rows, in prose) / 8 (cells, per the review) | **18**, derived | Operation-local matrix, and the count is now computed from the measurement and cross-checked against a per-cell enumeration. |
| real-corpus attempts | 1 373 | **1 998** | The stride is gone. Not hard-coded anywhere; printed only. |
| `tags`: `2001-1-1` | `str` | `timestamp` | Deviation 3, section 3.2. The assertion in `a_timestamp_may_have_single_digit_fields_and_a_space_separator` is inverted, deliberately, and the reasoning is in the module docs. |
| `tags`: `1_000` under 1.2 | `str` | `int` = 1000 | Deviation 4. |
| `tags`: trailing-blank timestamp | accepted | rejected | The blanks belong to the time-zone group, as in PyYAML and the printed production. Unreachable in a plain scalar either way. |

Pins that did **not** move, and that is the load-bearing half: every `SYNTHETIC_OUTCOMES`
row, all eight hazard-family attempt counts, `ambiguous_key_targets`, the whole
plain-scalar census in both corpora, and every count in `tests/trivia_scanner.rs`,
`tests/syntax_index.rs`, `tests/patch_path.rs`, `tests/scalar_codec.rs`,
`tests/patch_edit.rs`, `tests/patch_structure.rs` and `tests/patch_move.rs`. The new
production bound rejects **no** legitimate removal in either corpus, and the tag fixes
reclassify **no** corpus scalar.

---

## 10. Every review finding, dispositioned

The review is
[`docs/reviews/phase-0c-3b-2b-the-gate.md`](../reviews/phase-0c-3b-2b-the-gate.md).

| # | Finding | Disposition |
|---|---|---|
| **High** | **E5 is a production safety hole and blocks the gate.** A removal whose run swallows a following blank line the entry does not own is accepted by every production check, and rejected only by the test-side bound. R24's exact pattern. | **Adopted in full.** `VerificationFailure::RemovalCarriesMoreThanTheEntry`, derived by `entry_owned_runs` from the entry's key/value frontier, the textual leading-trivia rule and D2o's blank-run rule — consulting nothing `removal_envelope` produced. In `StructuralGuard::Removal`, pre-splice. E5 re-run and **rejected by production** (section 6, E5); E5b shows the sweep's bound still independent. Retained test on the review's exact shape. Section 5.1. |
| **Med** | **`2001-1-1` misclassified as `str`.** | **Adopted, with the reason corrected.** The date-only form now takes one or two digits. The review's justification is true of Ruby's Psych and *not* of the printed production or PyYAML, and section 3.2 deviation 3 says so rather than repeating it. The conservative direction is what decides it. |
| **Med** | **Large sexagesimals return `None` on overflow**; a value matching the production must classify by shape. | **Adopted in full.** `yaml_1_1_sexagesimal` renders `60#digits` on overflow, as the other four bases already did; `render_float` gained the same fallback. Pinned across all five bases. |
| **Med** | **`+0o17` wrongly rejected on the 1.2 side**; radix prefixes checked before the sign is stripped. | **Adopted, and named as a deviation rather than a bug fix.** The printed core schema carries no sign on the radix forms and no underscores, so the old code was faithful to it; `go-yaml` v3 accepts both. Accepted here because it can only *add* an ambiguity report. Section 3.2 deviation 4. |
| **Med** | **The leading-zero decimal claim is wrong**; correct implementation and documentation to whatever is true. | **Verified and documented; implementation unchanged.** The core schema's `[-+]?[0-9]+` matches `012` and reads it as decimal twelve, which is what `saphyr` and `serde_yaml` do and `saphyr` is the substrate verification uses. `go-yaml` reads ten. Implementations disagree; ours models the one we reparse with, and the 1.1 half reports the value ambiguous either way. Section 3.2. |
| **Med** | **"0 gaps" is circular**; the generated test compares `plain_scalar_is_ambiguous` against a predicate that calls it. | **Adopted in full.** `mod independent_yaml_1_1` is a separate transcription of the 1.1 productions; 77 hand-written cases across every family, both sides; 500 000 generated values from two generators, 43 773 non-string resolutions, zero disagreements. E9 and E10 break the table and show each half firing. Section 3.4a. |
| **Med** | **§4.1 overstates** "edits cannot introduce an ambiguity". | **Adopted.** Restated as bounded by the table's correctness, with the bound in §4.3 and what changed it named. |
| **Med** | **The matrix proves document co-occurrence.** | **Adopted in full.** Attribution is operation-local for structural axes and, with an argument rather than by omission, document-scoped for presentational ones (§1.1). Retabulated: four rows moved to `RefusedOnly`, no cell is `Absent`, and the review's own example is experiment E11. |
| **Med** | **`RefusedOnly` is miscounted: eight, not five.** | **Adopted, and the count is no longer written down.** `print_coverage` derives it, `REFUSAL_ONLY_CELLS` accounts for each cell, and the two are asserted equal. Eighteen, on the operation-local matrix. |
| **Med** | **The real sweep is sampled and the checkpoint said not to.** | **Adopted in full.** Stride removed, primitives memoised, **exhaustive**. 1 373 → 1 998 attempts, real test 31.06 s → 17.03 s, whole suite 87.9 s → 39.4 s. Section 9.1. |
| Q1 | Is the verdict honest? | **No, and it is re-derived.** Section 8. |
| Q2 | Should E5 block? | **Yes.** Closed. |
| Q3 | Is R16 sufficient? | The differential design is sound; the implementation was not. Four errors fixed, the sweep made non-circular, and §4.1/§4.3 restated to the strength the evidence supports. |
| Q4 | Are the refusal-only cells genuine? | **Yes, and the list now says which kind each is.** 16 hazard refusals, 2 capability gaps (`no-final-newline × ItemMove`, `empty-values × ScalarEdit`). The review's point that a safe sibling's `Applied` should not describe the hazardous construct is exactly what the operation-local attribution fixes. |
| Q5 | Is `tags.rs` correct? | Not completely, and now less incompletely. Four named errors fixed and pinned; the 1.2 half still has no second implementation (§4.3). |
| Q6 | Did retabulation hide a regression? | The review found none, and neither did this round. The one arithmetic slip it did find, in a `tests/patch_path.rs` comment, is corrected (§7.6). |

**What this round did not do**, stated so nobody has to look: R22, R25 and R26 are
untouched, cross-file moves are still unimplemented, R16's projection half is still
open, and R19 is only partly closed (§9.1).

---

## 11. What is owed to the phase after this one

- **R16's projection half** (section 4.2), which is a Phase 1 question about how the
  UI shows a scalar whose 1.1 tag is not `str`.
- **Cross-document and cross-file moves** (plan section 8.4). Read
  `docs/decisions/0c-3b-2a-notes.md` section 7.7 first: they must re-indent or
  refuse, and cannot reuse the move proofs unchanged.
- **Compositional move verification**, which would retire
  `MoveMustBeTheOnlyEditInItsBatch` and give `OverlappingEdits` its first
  move-versus-edit test case (R25).
- **The rest of R19** (section 9.1). The primitives are memoised and the sweep is
  exhaustive, but the safe entry point still rescans on every call by design, so
  20 ms per keystroke-triggered rescan is still the Phase 1 problem. A cached index,
  not a faster scan, is the answer there.
- **R22 and R26**, unchanged and still the weakest pins.
- **A second implementation of the 1.2 core half of the tag table**, and ideally an
  *external* one for the 1.1 half — espanso's own locked deserialization stack
  (section 4.3).
