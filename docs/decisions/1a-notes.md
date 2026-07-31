# Phase 1a — the core-side read model

Phase 1a builds the two things the read-only browser stands on, and nothing else. It is Rust only:
no UI, no Tauri, no frontend file.

1. **`crates/espansoconfig-core/src/model/`** — the read-only semantic projection. `DocumentView`,
   `MatchView`, `VariableView`, `ConfigProfileView`, `ScalarView`, `ValueView`, `UnknownEntry`,
   `MappingCoverage`, `Diagnostic`.
2. **`crates/espansoconfig-core/src/workspace/`** — discovery plus a document cache keyed by
   `ContentRevision`, shaped like plan §6.4's `open_workspace` / `list_documents` / `get_document`
   so the Phase 1b Tauri commands wrap it one to one.

Acceptance is [`tests/model_projection.rs`](../../crates/espansoconfig-core/tests/model_projection.rs)
(20 tests) and [`tests/workspace_cache.rs`](../../crates/espansoconfig-core/tests/workspace_cache.rs)
(12 tests). The whole suite is **471 tests, all passing**; Phase 0's 439 are untouched and unmodified.

The phase was held open by its own adversarial review
([`docs/reviews/phase-1a-core-read-model.md`](../reviews/phase-1a-core-read-model.md)) and every one
of its five findings is closed. **Section 12 is the disposition** — what each fix cost, and the
disabling experiment that proves each new check can disagree. Where this document said something the
review showed to be false, the sentence is corrected here rather than annotated below.

**Out of scope, deliberately not started:** every Tauri command, every frontend file, the i18n
dictionaries, validation (`crate::validate` is still a stub), saving, and the watcher. Phase 1b's
concerns.

---

## 1. What the projection is, and what it is not

**It is a projection in the strict sense the crate's central invariant uses.** Nothing in
`crate::model` owns a value. Every view holds byte spans and `NodeId`s pointing back into a
`SyntaxIndex` the caller owns; dropping a view changes nothing; reprojecting the same bytes always
gives the same answer. An edit produces a *new* projection by reparsing, never a mutated one. That
is why there is no `&mut` anywhere in the module and why no view carries a `String` of the whole
document.

**It is not a validator.** A `Diagnostic` says what a document looks like. It refuses nothing, and
Phase 1 is read-only anyway. `MatchHasNoContent` fires 6 times across the synthetic corpus and every
one of those matches still renders.

**It is not a type resolver.** §2.

**It is not the espanso schema in Rust.** §4.

---

## 2. D2u is a type in the code, not a note in a document

The rule is *"the browser displays the scalar's source text as written; it may say what the file
says, it may not say what the value means."* A rule stated only in prose gets violated by the third
person who adds a field. So it is enforced structurally:

- **`ScalarView::text` is a `String`.** There is no `bool`, no `i64`, no untagged value enum
  anywhere in `crate::model`. `word`, `left_word`, `right_word`, `propagate_case`,
  `force_clipboard` and `paragraph` are `Option<ScalarView>` like every other field, although the
  espanso schema calls them booleans.
- **`ValueView` has four inhabited variants** — `Scalar`, `Sequence`, `Mapping`, `Alias` — plus
  `Elided`. There is no `Bool`, `Int` or `Null` for a future contributor to reach for.
- **The permitted claim has its own field.** `ScalarView::ambiguous_yaml_1_1` is `true` when a
  **plain** scalar's text is one YAML 1.1 and YAML 1.2 core disagree about, or one 1.1 resolves to
  something other than a string. It is computed by calling `crate::emit::plain_scalar_is_ambiguous`,
  which is `src/emit/tags.rs`'s table — **the one resolution table in the crate**. This module does
  not contain a second copy, and the corpus test asserts the flag is never set on a quoted or block
  scalar, whose text is a string in both schemas by construction.

**Measured:** 23 of the 570 projected synthetic scalars and 65 of the 624 projected real ones are
plain and 1.1-ambiguous. `plain-scalar-hazards.yml`'s column is **0**, which is the fixture doing
its job: every dangerous value in it is written quoted, and quoting is exactly what removes the
ambiguity.

The real figure matches `PROGRESS.md` R16's 65 exactly. The synthetic one is 23 where R16 says 31,
and the difference is not a disagreement — R16 counts every plain scalar the *parser* produces, this
counts the ones the *projection exposes*. The eight were located rather than assumed: four are
**mapping keys** inside a match or a `vars` mapping (`anchors-aliases-tags-merge.yml` ×2,
`move-run-joins.yml` ×2), which the projection exposes only at the top level; the other four are
**values of entries it records as unknown** rather than modelling
(`anchors-aliases-tags-merge.yml` ×2, `empty-entries-and-extents.yml` ×2), whose spans it keeps and
whose text it does not turn into a `ScalarView`. Both are consequences of §3's design, not gaps in
it: an unknown entry is recorded, and recording is not projecting.

### The oracle, and the proof it can disagree

`scalar_disagreement()` in `tests/model_projection.rs` re-derives each scalar from the index: it
must equal `crate::emit::decode()` of its own content span, and its `span` and `style` must be the
node's. Every scalar of every synthetic fixture and every real file goes through it.

An oracle that cannot fail is not an oracle, so the projection was broken deliberately and the
oracle checked (§7, experiment 1): with `ScalarView::project` resolving plain scalars through
`resolve_plain_yaml_1_1`, the corpus sweep fails on the **first** fixture —
`anchors-aliases-tags-merge.yml`, *"node 41 projected 4 bytes where decode() gives 3"* — and the
targeted test fails on `word: on` becoming `true`. `an_inferred_scalar_is_caught_by_the_oracle` is
the retained form of that experiment, and also checks the two neighbouring drifts a type-inference
bug would arrive with: a restyled scalar and a moved span.

**The first form of that oracle had a false-negative branch, and the review found it.** It compared
the projected text against `decode()` **only when `ScalarView::decoded` was true**, so a wrong view
carrying `text: "true"` and `decoded: false` over a source `on` — which decodes perfectly well —
returned `None`. The claim in the heading was broader than the code enforced. The comparison is now
unconditional, with a second clause: a scalar whose bytes *do* decode may not be labelled undecoded,
because production clears that flag only after a real decode failure. Both branches are retained
experiments (§12, experiment D).

---

## 3. "No key is dropped" is a checked accounting, not a promise

Plan §6.2's *"Unknown/unsupported entries are NEVER silently discarded"* forbids a failure that is
invisible by definition: a dropped key leaves no trace in the thing that dropped it. A test that
walked the projection could only ever find what the projection kept.

### The claim, stated so it can be false

The review's finding 2 showed that the first version of this section overclaimed. For

```yaml
matches:
  - trigger: :a
    replace: A
    future_option:
      nested_key: nested_value
```

`future_option` is one `UnknownEntry` and is **not descended into**, so `nested_key` is recorded by
no name anywhere. "Every unknown key is recorded by name and path" was therefore not what this
module does.

**The claim is now the weaker one that is actually true, and it is checked:**

> Every mapping key of the document is either **named** by the projection — modelled, recorded as
> unknown, or carried as a shallow `FieldView` — or **lies inside a byte span the projection recorded
> without descending into it**.

`DocumentView::undescended` is that second list, and it is populated by the one place that decides
not to descend in each case: `Projector::close` (an unmodelled entry's key and value spans),
`Projector::value` (a value past `MAX_VALUE_DEPTH`), `Projector::scalar_sequence` (an item whose
shape the schema does not allow), `DocumentView::project` (each document of a stream espanso does
not load), and the three "this is not the mapping the schema expects" early exits.

Choosing to *record the span* rather than to *descend and name every key* was deliberate: descending
would mean projecting a schema nobody has written, and the day espanso adds a nested option this
module would have to be taught it. Recording the whole value keeps the bytes, keeps the guarantee
checkable, and keeps the entry exactly as editable as an opaque region should be.

### The accounting itself

So the projection **emits its own accounting**. For every mapping it walks it produces a
`MappingCoverage { mapping, path, modelled: Vec<NodeId>, unknown: Vec<NodeId> }` holding the **key
node** of every entry — a key node being the one thing a mapping entry uniquely has, where two
entries can share a key *text* (a duplicate) and even a value shape.

The partition is exact **by construction**, not by later reconciliation: `Projector::entries` hands
each entry to the caller once, and each leaves through exactly one of `MappingScan::model` or
`MappingScan::skip`. Nothing sums anything up afterwards from the same assumptions that could have
lost the entry.

Five layers check it, and each can contradict the others. The first three audit **the records that
exist**; the last two audit **the document against them**, which is the distinction the review's
finding 2 turned on — a check that iterates emitted records passes vacuously when no record was
emitted at all.

| Layer | Where | What it does |
|---|---|---|
| 1 | `MappingCoverage::accounts_for` | the library's own statement: union equals the mapping's entries, no duplicate, no invention |
| 2 | `Projector::close` | calls layer 1 on every record and raises `DiagnosticCode::CoverageIsIncomplete` when it fails — **pinned at 0** over both corpora |
| 3 | `coverage_disagreement()` in the sweep | re-derives the mapping's key nodes from the index with its own transcription of the flat key/value layout, and compares |
| 4 | `DocumentView::unaccounted_keys` | walks **every mapping of the index**, not every record, and raises `DiagnosticCode::KeyNotAccountedFor` per key that is neither named nor inside an undescended span — also **pinned at 0** over both corpora (R24: the sweep must not be the only home of this) |
| 5 | `unaccounted_keys()` in the sweep | derives the expected key set from the **document tree** with its own node enumeration, then asks the view to account for it |

**Measured**, both corpora: **546** mapping keys in the synthetic tree, **518** of them named and
**28** accounted for by lying inside a recorded span; **566** real keys, all **566** named and **0**
inside a span — which is the same fact §3 already records from the other side, that the real config
uses no key this crate does not model. The synthetic sweep asserts that split is non-empty, because
a corpus where every key was named would leave the second clause of the property untested.

Layer 2 was **first written as a `debug_assert!` and that was wrong twice over**: it is a panic on
input, which this module's fifth rule forbids, and it aborts the run before layer 3 can disagree —
so during experiment 2 it *masked* the independent oracle rather than corroborating it. It is now a
diagnostic. That is R24's rule applied in the direction it is usually not: a production check that
pre-empts the test-side one is not a second layer, it is a louder first one.

`a_dropped_key_is_caught_by_the_coverage_oracle` retains both halves of the experiment: an entry
removed from the record, and an entry counted twice — which a plain `modelled + unknown == entries`
count would let through in pairs. `a_key_nested_under_an_unmodelled_entry_lies_inside_a_recorded_span`
retains the two halves the *whole-document* property needs, and they are the ones the review said the
old experiment did not reach: a coverage record whose **creation is suppressed** (not an entry
deleted from a record that already exists), and an undescended span that was never recorded.

### The keys that have no path, and why that is a limit rather than an omission

`UnknownEntry::path` is `None` for exactly two reasons, both now stated on the field itself:

- **`NonScalarKey`** — a `PathSegment` is a key *string* or an index, and a collection or an alias
  used as a key is neither. No path exists to hand out.
- **`RepeatedKey`** — `patch::path::resolve` resolves a key to the **first** entry with that text, so
  the path that looks like the second `replace`'s would address the first one. Handing it out would
  be worse than handing out nothing: it would name the wrong bytes.

Both stay addressable *structurally*, through `key_node`, `key_span` and `value_span` — which is what
an editor would mutate anyway. This is recorded as hole 8 in §9.

**Measured:** 20 unknown entries across the synthetic corpus, **0** across the real one — the real
config uses no key this crate does not model. Three of the four reasons are reached:
`NotModelled` (`anchors`, `<<` twice, `first`, `second`, `explicit trigger`, `trailing`),
`UnexpectedShape` (five fixtures spell `vars` as a mapping, which espanso does not accept, for eight
entries between them), and `RepeatedKey` (`duplicate-keys.yml`'s second `replace` and second
`label`). `NonScalarKey` is reachable and **unreached by both corpora** — §9, hole 1.

---

## 4. Where the schema stops and shallow projection starts

Espanso's schema is closed where plan §3 enumerates it and open everywhere else. Modelling the open
parts by name would guarantee that the day espanso adds an option, this crate drops it.

**Modelled by name (closed):**

- the document root's three match-file keys — `matches`, `global_vars`, `imports`;
- a match's **22** fields — the three trigger forms, the five content forms, `label`, `comment`,
  `search_terms`, the three word-boundary options, `propagate_case`, `uppercase_style`,
  `force_mode`, `force_clipboard`, `paragraph`, `form_fields`, `vars`, `anchor`;
- a variable's **5** — `name`, `type`, `params`, `inject_vars`, `depends_on`.

**Projected shallowly and completely (open):** a variable's `params`, a match's `form_fields`, and
the whole body of a config profile. Every key and value is carried as a `FieldView`/`ValueView`
pair, nothing is interpreted, so nothing can be lost and nothing is ever "unknown" there.

`VariableKind` classifies the `type` field's **text** against espanso's nine names. That is a string
comparison, not a YAML type inference, so it does not touch D2u: `VariableView::declared_type` keeps
the source text and an unrecognised spelling becomes `VariableKind::Unrecognised` rather than being
coerced.

### `DocumentShape` is read off the content, not off the directory

`FileKind` (from `discovery`) says where a file *sits*; `DocumentShape` says what it *looks like*,
derived from whether the root mapping holds any of the three match-file keys. Two reasons: the
corpus has no `config/` or `match/` directory, so a location-only rule would make the projection
untestable on it; and a `config/*.yml` that really does hold `matches` should be *reported*, not
mis-rendered. `DiagnosticCode::ShapeDisagreesWithLocation` is that report, and it fires on exactly
three synthetic fixtures — `config-profile.yml`, `unicode-offsets.yml` and
`single-line-no-line-ending.yml`, none of which has a match-file key — and on **none** of the
temp-tree files in `workspace_cache.rs`, where the directories are real.

### Multi-document streams

Espanso loads the first document of a stream. Projecting only the first and saying nothing would be
a silent discard, so each further document gets its own
`DiagnosticCode::AdditionalDocumentNotProjected { document_index }` **with that document's span** —
the test asserts the span is present and non-empty, because a diagnostic with no bytes cannot show
the user what is being left out. `multi-document.yml` produces exactly two, for its three documents.

---

## 5. Identity — scoped to a parse, and refused when stale

`MatchId { document: DocumentId, revision: ContentRevision, node: NodeId }`. The sequence position
lives in `MatchView::path` as a `DocumentPath`, because the edit engine addresses by path.

**The two-field form was positional and this section used to say otherwise.** The review's finding 1
is right and its counterexample is now a test. `NodeId` is the parser's arena index, assigned from
`nodes.len()`; `DocumentId` was the sorted-enumeration position of a directory walk. So:

- exchange two equally shaped matches and reparse, and the new first mapping lands at the old first
  mapping's arena index — `:b` inherits `:a`'s identity;
- retain an identity, add an alphabetically earlier file, reopen — and the identity names a different
  file.

Both were "identity follows position", which is precisely what plan §6.2 forbids. The old test named
after the property never reordered anything and never reparsed; it checked uniqueness and that each
path's last segment equalled its vector position. It is now named
`a_match_identity_is_the_document_the_revision_and_a_node_and_is_unique`, which is what it does.

### What was chosen, and what was rejected

**Chosen: make a stale identity detectable and typed, not resolvable.**

1. `MatchId` carries the `ContentRevision` of the bytes it was minted from. `DocumentView::match_by_id`
   compares document, then revision, then node, and returns `Result<&MatchView, IdentityError>` with
   three variants — `WrongDocument`, `StaleRevision`, `NoSuchMatch`. A stale identity is **never
   resolved**, so it can never silently select the other match.
2. `DocumentId` comes from a monotonic session counter keyed by path
   (`workspace::identity_of`), not from an enumeration position. A path keeps its identity for the
   life of the process, a new file gets a number nobody held, and a removed file's identity matches
   nothing and comes back as `WorkspaceError::UnknownDocument`. Identities are never reused.

**Rejected: content-derived stable identity** — hashing a match's trigger, or minting and persisting
a synthetic key. It is the design that would let an identity *survive* a reparse rather than merely
be refused by one, and it is a much larger piece of work: it needs a collision policy for two matches
with the same trigger, a rule for what happens when the content the identity derives from is the very
thing being edited, and a persistence story. Phase 1 is read-only and re-fetches after every reparse
anyway, so it buys nothing this phase needs. **Refuse rather than guess** is the standing rule, and
the refusal is honest about what it costs: after any reparse the UI must re-fetch.

The consequence is written into the type's own documentation, so the next contributor meets it there
rather than here.

### What pins it

- `an_identity_from_before_a_reordering_is_refused_rather_than_resolved` builds the reviewer's exact
  source, reorders it, reparses, **asserts the arena slot really is reused** (`:b` now occupies
  `:a`'s former node, so the hazard is demonstrated rather than assumed away) and requires
  `StaleRevision`. It also reprojects the *unchanged* bytes and requires the identity to resolve, so
  the refusal is about the revision changing rather than about reparsing.
- `an_identity_survives_a_directory_that_gained_and_lost_a_file` retains the second counterexample:
  open, retain, add an alphabetically earlier file, reopen, and the retained identity still names its
  own file; then delete that file and the identity becomes a typed error rather than an alias.

---

## 6. The workspace, and R19's remaining half

`PROGRESS.md` R19: *"the safe entry point still re-scans on every call by design, which is a Phase 1
concern — 20 ms per keystroke-triggered rescan is not viable."* The checkpoint calls this the first
Phase 1 concern and says to decide it early because it shapes the command surface. It does.

**Decision: parse once per `ContentRevision`; a `get` never touches the disk; only `refresh` does.**

| Method | Disk | Parse |
|---|---|---|
| `Workspace::open` / `discover` | one directory walk | **none** |
| `list_documents` / `summary` | none | none |
| `get_document` / `document_view` / `document_text` | **none** | once per document, on first use |
| `get_match` | **none** | as `get_document`, then an identity check against *that* parse |
| `refresh` | one read + one hash | only when the revision changed |
| `load_all` | as `get_document`, per document | one per document, once |
| `evict` | none | none (drops the cache slot, keeps the row) |

Three things fall out of that table and each was a deliberate choice:

1. **Opening a workspace parses nothing.** The sidebar can render before a single file is opened,
   which is what splitting `list_documents` from `get_document` buys. Everything a summary row needs
   — kind, `_`-disabled, read-only — already comes from `discovery`.
2. **`get_document` does not stat the file.** Between saves the frontend's draft is the authority
   (plan §6.4, *"do not send every keystroke to Rust"*). A `get` that stat-ed would reintroduce
   per-call I/O for an answer nobody asked for. The watcher's job is to say when the disk moved, and
   `refresh` is what it drives.
3. **`refresh` rehashes before it reparses.** Plan §6.5 says watcher notifications are hints, not
   truth, and most of them are hints about a file that did not really change — an editor's atomic
   rename, espanso's own touch. An unchanged revision costs one read and one hash, and
   `parse_count()` does not move.

**Measured** (`cargo test --release`, this machine, both corpora): a cold parse-and-project costs
**65 µs/file** synthetic, **109 µs/file** real; in the debug profile the suite actually runs under,
**690 µs** and **1.33 ms**. A hundred sweeps over the *warm* projections of all 33 synthetic files
cost **792 ns** in release and **15.8 µs** in debug. The cache is not an optimisation, it is the
difference between an interactive surface and an unusable one.

### A cache slot may hold only what the disk held

Plan §6.4 divides ownership: **Rust owns the disk snapshot, the frontend owns the unsaved draft.**
The first version of this module shipped a public `load_from_source(id, bytes)` that installed
caller-supplied bytes into the same `Entry.loaded` slot a disk read fills, so after one call
`get_document` and `document_text` returned a draft while the disk still held something else, and only
`refresh` could restore the truth. That is a production state machine that can lie about the disk, and
the review was right that it is more than a testing seam.

**It is gone.** The seam the corpus tests actually use is `workspace::project_source`, which builds a
**standalone** snapshot from bytes and touches no session state; the retained test
`projecting_bytes_directly_agrees_with_projecting_them_from_disk` asserts it agrees with the disk path
byte for byte *and* that the cache still holds the disk's bytes afterwards. Nothing was lost: the test
that used the removed method was making a claim about `project_source` all along.

**`parse_count()` is public on purpose.** A property nothing can observe is a property nothing can
test (R24). Two tests count it — `a_second_view_of_one_revision_is_served_without_reparsing` and
`loading_every_document_parses_each_exactly_once` — and disabling the cache (§7, experiment 4) fails
both. `Workspace::project` is the **one** place a `SyntaxIndex` is built in that module, which is
what makes the counter honest rather than a hand-maintained tally.

### `SourceDocument` grew a fallible parse and the plan's `model` field

Plan §6.2's `SourceDocument` sketch has `syntax: SyntaxIndex`, which can only describe a file that
parsed. Phase 1 has to *show* a broken file — that is the file the user most needs — so the field is
now `parse: ParseOutcome`, which is `Parsed { syntax, trivia }` or `Failed(SyntaxError)`. The
trivia index travels with the syntax index because the two are always built together and the hazard
gate needs both.

The plan's `model: MatchFileModel` field arrived at the same time as `view: DocumentView`, and it is
**always present**: a failed parse yields a view holding the diagnostics and nothing else, never an
absent projection the UI has to special-case. Building a second near-duplicate snapshot type in
`workspace` was considered and rejected — two types describing one file is how they drift.

---

## 7. The disabling experiments

Every layer was broken deliberately and the result recorded. Restoring the code and re-running is
part of the phase, not a claim about it.

| # | What was broken | What fired |
|---|---|---|
| 1 | `ScalarView::project` resolves a plain scalar through `resolve_plain_yaml_1_1` instead of showing its text | `every_synthetic_fixture_projects_…` on the first fixture (*"node 41 projected 4 bytes where decode() gives 3"*), and `an_inferred_scalar_is_caught_by_the_oracle` on `on` → `true` |
| 2 | `Projector::skip_entry` discards the entry instead of recording it | with layer 2 as a `debug_assert!`: **four** tests, all of them through the library's panic, and the test-side oracle never ran. With layer 2 as a diagnostic: `every_synthetic_fixture_projects_…` on *"mapping 21 has 3 entries and the record accounts for 2"* — the sweep's own re-derivation — plus `a_dropped_key_is_caught_by_the_coverage_oracle` |
| 3 | `MAX_VALUE_DEPTH`'s guard raised to 4096 | `a_value_nested_past_the_depth_limit_is_elided_rather_than_overflowing` |
| 4 | `Workspace::get_document` always reparses | `a_second_view_of_one_revision_is_served_without_reparsing` and `loading_every_document_parses_each_exactly_once` |

Experiment 2 is the one worth keeping in mind: it is the reason layer 2 is a diagnostic rather than
an assertion, and it is a case where a *stronger-looking* production check made the test suite
weaker.

**Five more experiments were run for the review's findings, and they are §12's table.** Experiment 2
above is also the one the review corrected: deleting an entry *from a record* is a weaker break than
deleting *the record*, and only the second reaches the omission finding 2 named.

---

## 8. What this phase got wrong on the way

- **The depth-limit test tested nothing.** Its first form nested a deep value under an unmodelled
  key of a match. An unmodelled key is recorded by span and **never descended into**, so the guard
  was unreachable from there and the test passed for the wrong reason — it was written to fail and
  it failed, which is the only reason this was caught. The nesting now goes under a
  profile-shaped document, where the shallow projection really does descend.
- **The R12 assertion was false as written.** `a_hazardous_file_still_projects_…` first asserted
  that `anchors-aliases-tags-merge.yml` has an editable match. R12's measurement is about
  **scalars** — `matches[2].trigger` stays editable beside a flagged `replace` — but a match
  **mapping** contains that flagged descendant, so all six of its matches are refused. The scoped
  refusal is now demonstrated on `duplicate-keys.yml`, `flow-collections.yml` and
  `explicit-key-mappings.yml`, each of which holds a refused match *and* an editable one, and the
  reason `anchors-aliases-tags-merge.yml` is not among them is written down beside them.
- **`context_of` took a `root` it never used**, and a free `kind_of` duplicated
  `ValueKind::of_node`. Both removed. Public surface that exists because it was easy to write is
  public surface a later phase has to keep.
- **Two oracles could not disagree, and one test's name claimed a property the test never
  exercised.** The identity test never reordered or reparsed; the coverage audit iterated the records
  the library emitted. Both are the same mistake in different clothes — deriving the expectation from
  the thing under test — and both were found by the review rather than by this phase. The pattern to
  watch for is a test whose *name* is the property and whose *body* is a walk over the implementation's
  own output.
- **A documented behaviour was never implemented.** `scalar_sequence`'s doc comment said a non-scalar
  item is "projected as its own elided value"; the code diagnosed it and dropped it, shifting every
  later item one position left. Nothing caught it because no corpus fixture holds the shape. Fixed in
  the direction the doc comment already promised — §12, finding 5.

---

## 9. Coverage holes, stated as holes

1. **`UnknownReason::NonScalarKey` is reachable and unreached by both corpora.** A collection or an
   alias used as a mapping key exists in `tests/patch_path.rs`'s hand-built cases but in no fixture
   of either corpus, so the branch that records it — and
   `DiagnosticCode::NonScalarKey` beside it — is driven by no test at all. R20's rule wants a
   fixture on each side; only the "scalar key" side exists. This is the weakest thing in the phase.
2. **`DiagnosticCode::ScalarNotDecodable` is pinned at 0 and is not argued unreachable.** It fires
   when the substrate accepts a double-quoted scalar our decoder rejects. Phase 0c-1's codec suite
   found no such scalar and neither did this sweep, but unlike R22 there is no argument that none
   exists — only an absence of examples. The layer is live: the flag is on `ScalarView::decoded`,
   the text falls back to the raw slice, and the sweep asserts the count is zero.
3. **`DiagnosticCode::CoverageIsIncomplete` and `DiagnosticCode::KeyNotAccountedFor` are pinned at 0
   by construction.** Both can only fire on a bug in `crate::model`. Experiment 2 makes the first
   fire and §12's experiments C1/C2 make the second, so neither is dead code, but no input can reach
   either.
4. **The depth guard has no corpus fixture, only a generator.** `MAX_VALUE_DEPTH` is tested at
   `32` and `68` by a closure that takes the depth as a parameter. Two fixtures would pin two fixed
   depths, and the thing under test is the boundary; but this is a deviation from R20's letter and
   is recorded as one.
5. **The prefix sweep is strided at 7.** 3 000-odd prefixes rather than 21 000. No fixture has a
   construct seven bytes wide, and each fixture's prefix set differs because their lengths do, so
   the union is not one residue class — but it is not exhaustive either.
6. **`serde` is `Serialize`-only, with a named exception list.** `Deserialize` is derived on the
   identity/argument types Phase 1b's command *arguments* need — `DocumentId`, `NodeId`,
   `DocumentPath`, `PathSegment`, `ByteSpan`, and now `MatchId` with the `ContentRevision` it
   carries — and nowhere else. A read-only phase does not need to accept a `DocumentView` back, and
   deriving `Deserialize` on `ByteSpan` already bypasses `ByteSpan::new`'s inverted-span assertion —
   which is acceptable for a span the frontend only ever echoes back, and would not be if a mutation
   trusted it. **`MatchId` was added by the review's finding 3**, because plan §6.4's `get_match(id:
   MatchId)` is an argument and cannot exist otherwise; `ContentRevision`'s hand-written
   `Deserialize` accepts exactly the 64-character hex string its `Serialize` writes and rejects
   everything else, so a malformed token is a typed rejection rather than a digest that would quietly
   match nothing. Phase 1b must not widen this without re-reading this paragraph.
7. **Nothing here is proven against espanso itself.** The field list is plan §3's, which was
   verified against espanso 2.3.0 and its JSON schemas — but by the plan's author, not by this
   phase. A field espanso has and plan §3 does not will land in `unknown_entries`, which is the
   right failure mode and is not the same as being right.
8. **An unmodelled entry's contents are recorded by span, never by name** — the review's finding 2,
   admitted here as the hole it is rather than folded into the claim. A `nested_key` under an
   unrecognised option is *accounted for* (§3) but is not addressable, not searchable and not
   displayable as a field. That is the deliberate trade in §3, and if a later phase wants to render
   such a subtree it must decide how, not assume the projection already did.
9. **Two `UnknownEntry` reasons carry no path, by construction** — `NonScalarKey` (no `PathSegment`
   can spell such a key) and `RepeatedKey` (a path would name the *first* entry, not this one). The
   argument is in §3 and on the field. `NonScalarKey` remains unreached by both corpora (hole 1), so
   the pathless case that *is* exercised is the repeated one, in `duplicate-keys.yml`.
10. **A non-scalar item inside a scalar sequence has no corpus fixture.** `triggers`, `search_terms`,
    `depends_on` and `imports` now elide such an item in place (§12, finding 5), and both sides of
    that condition are pinned — but by a hand-written source, not by a fixture. R20's rule would
    prefer a fixture; this is the same deviation hole 4 records for the depth guard, and for the same
    reason: adding the shape to a corpus fixture would change what that fixture exists to pin.
11. **A key is accounted for by *containment*, not by identity.** Layers 4 and 5 ask whether a key's
    span lies inside some recorded undescended span. A recorded span that is far too wide would
    therefore account for keys it has nothing to do with. Nothing in this phase can produce one — every
    span comes from a node the index published — but the check is weaker than a per-key attribution
    would be, and that is worth knowing before a later phase widens what may be recorded.

---

## 10. Dependencies added

| Crate | Where | Why |
|---|---|---|
| `serde` 1, `derive` feature | dependency | The Phase 1b Tauri layer is specified as a **thin wrapper** (plan §6.1). Without `Serialize` on the read model it would need a parallel DTO per type, which is the second copy that drifts. `serde` pulls in no platform code and no `tauri`; `rg -c tauri Cargo.lock` still finds nothing. |
| `serde_json` 1 | **dev**-dependency | `the_read_model_serializes` asserts the model actually reaches JSON — that the revision is an opaque 64-character string rather than 32 numbers, that a match identity survives, and that a scalar arrives as a string. A `derive` that compiles proves none of that. |

`ContentRevision` has a hand-written `Serialize` (hex string) rather than a derive: it is an opaque
concurrency token the frontend hands back unchanged on every mutation, and a `number[]` would
survive JSON and be unreadable in a log line.

Eleven existing types gained a `Serialize` derive so the model can embed them — `ByteSpan`,
`ScalarStyle`, `Chomping`, `NodeId`, `NodeKind`, `HazardKind`, `FileKind`, `LineEnding`,
`DocumentId`, `DocumentPath`, `PathSegment`. Derives only; no behaviour changed, and all 439 Phase 0
tests pass unmodified.

---

## 11. What Phase 1b inherits

- **The command surface exists.** `Workspace::{discover, summary, list_documents, get_document,
  get_match, document_view, document_text, refresh, load_all, evict}` maps one to one onto plan
  §6.4's read-only commands, `get_match` included — it was missing and the review's finding 3 added
  it. `Workspace` takes `&mut self` where it can populate the cache; the Tauri layer holds it behind
  a `Mutex`, which it would need regardless.
- **The error type crosses the boundary.** `WorkspaceError` and `DiscoveryError` have hand-written
  `Serialize` impls emitting `{ "code": …, … operands }`; `io::Error` becomes its `ErrorKind` name,
  which is a code, and the `Display` string is deliberately never sent.
  `every_workspace_error_reaches_json_as_a_code_and_operands` pins that. `SourceDocument` is
  **deliberately not** serializable: what crosses is `DocumentView` (`get_document`) plus the raw
  text (`document_text`), and serializing a `SyntaxIndex` and a `TriviaIndex` per document would ship
  the frontend an arena it has no use for.
- **Every user-visible string is still the frontend's problem.** `DiagnosticCode` is 23 variants
  plus operands, `UnknownReason` is 4, `WorkspaceError` is 5, `IdentityError` is 3, `MatchBadge` is
  10. Not one of them carries a sentence. The `Display` impls are for logs.
- **A `MatchId` from before a reparse is a typed refusal, not a lookup miss.** Phase 1b must surface
  `IdentityError::StaleRevision` as "re-fetch", distinctly from `NoSuchMatch` ("clear the
  selection"). §5.
- **Three things the Phase 0 gate does not license are still not licensed**, and none of them is
  reachable from this code: no type-aware rendering (§2), no cross-file or cross-sequence move, no
  move combined with another edit.
- **A badge is derived from a key's presence or a `type` field's text, never from a value.** There
  is deliberately no "word boundary ON" badge, because producing one would mean deciding that
  `word: on` is true. `badges_come_from_key_presence_and_type_text_never_from_a_scalar_value` pins
  that, including the absence.

---

## 12. Phase 1a review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-1a-core-read-model.md`](../reviews/phase-1a-core-read-model.md). Its verdict was
**hold the phase open**: match identity was positional in practice, and the strongest
"no unknown key is lost" oracle could not detect a whole omitted mapping. Both are explicit Phase 1a
gates. Nothing was committed until all five findings were closed.

**All five are closed. None was declined.**

| # | Finding | Disposition |
|---|---|---|
| 1 | Match identity is positional after a reparse, and its test never reorders | **Closed.** `MatchId` carries the parse's `ContentRevision`; `match_by_id` returns `Result<_, IdentityError>` and refuses a stale identity instead of resolving it. `DocumentId` comes from a monotonic session counter keyed by path, not from an enumeration position. The test was renamed to what it does, and the property its old name claimed has its own test — whose answer is a refusal. §5. |
| 2 | Keys nested under an unknown entry are neither modelled nor recorded, and the coverage oracle passes vacuously | **Closed**, by the second of the two options the review offered: the unknown entry's **whole value span** is recorded with the rest of `DocumentView::undescended`, and the property is restated as *"every key is either named or lies inside a recorded undescended span"*. Two new layers check it — one in the library (`unaccounted_keys` → `DiagnosticCode::KeyNotAccountedFor`, R24), one in the sweep deriving its expectation from the **document tree**. §3. Repeated and non-scalar keys keep `path: None`, now argued precisely and recorded as hole 9. |
| 3 | `load_from_source()` lets a draft replace Rust's disk snapshot | **Closed** by deletion, not by hiding: no production method can install caller-supplied bytes into a cache slot. The one test that used it now compares `project_source` against the disk path, which is the claim it was really making. The two IPC gaps are closed with it — `WorkspaceError` and `DiscoveryError` serialize as codes plus operands, and `Workspace::get_match` exists. `SourceDocument` stays unserializable **by design**; `DocumentView` is what crosses. §6, §11. |
| 4 | The D2u oracle has a false-negative branch | **Closed.** The text is compared whenever `decode()` succeeds, regardless of `decoded`, plus a second clause refusing a decodable scalar labelled undecoded. §2. |
| 5 | Malformed elements inside scalar sequences are dropped | **Closed** in the direction the review preferred — the implementation now matches its documentation. `triggers`, `search_terms`, `depends_on` and `imports` are `Vec<ValueView>`, every item a `Scalar` or an `Elided` **at its own index**, so positions never shift. §8. |

### What it cost

- **Public surface**: `MatchId` gained a field; `DocumentView::match_by_id` changed from
  `Option` to `Result`; `DocumentView` gained `undescended`, `named_key_nodes()` and
  `unaccounted_keys()`; four sequence fields changed from `Vec<ScalarView>` to `Vec<ValueView>`;
  `IdentityError` and `Workspace::get_match` are new; `Workspace::load_from_source` is gone.
- **Behaviour**: one new diagnostic code (`KeyNotAccountedFor`, pinned at 0 over both corpora), and
  one behaviour change with a user-visible consequence — a non-scalar item in a scalar sequence is
  now *shown as elided* rather than silently absent.
- **Counts**: **no pinned per-fixture projection row moved.** All 33 rows of
  `SYNTHETIC_PROJECTIONS` are byte-identical to before, because an elided item contributes no scalar
  (as a dropped one did not either) and the new diagnostic never fires. The suite went
  **465 → 471 tests**: three new in `model_projection.rs`, three in `workspace_cache.rs`.
- **Global state**: one process-wide `Mutex<BTreeMap<PathBuf, DocumentId>>`. This is the only such
  state in the crate. It is what "session-local identity" has to mean for identities that must
  survive `Workspace::open` being called twice, and lock poisoning is absorbed rather than
  propagated because this module must not panic.

### The disabling experiments

Every fix was broken deliberately and the result recorded, then restored and the suite re-run
(471 pass). An oracle that cannot disagree is not an oracle.

| # | For | What was broken | What fired |
|---|---|---|---|
| A | 1 | `match_by_id` reduced to a document + node lookup, the revision guard removed | `an_identity_from_before_a_reordering_is_refused_rather_than_resolved` — and it failed by **resolving the retained identity to `:b`**, which is the reviewer's counterexample reproduced verbatim rather than paraphrased |
| B | 1 | `Workspace::from_tree` assigns `DocumentId(position)` again | `an_identity_survives_a_directory_that_gained_and_lost_a_file`: *"an identity must not follow a position — left `Some(DocumentId(3))`, right `Some(DocumentId(2))`"* |
| C1 | 2 | `Projector::close` never files the coverage record — **the record's creation suppressed**, which is what the old experiment did not do | four tests, including both corpus sweeps: *"6 key(s) are neither named by the projection nor inside a recorded span"* on `anchors-aliases-tags-merge.yml` and 57 on a real file. The per-record layers stayed silent, exactly as the review predicted |
| C2 | 2 | `Projector::close` files the record but records no undescended span | `a_key_nested_under_an_unmodelled_entry_lies_inside_a_recorded_span`, and the synthetic sweep on the same fixture |
| D | 4 | the pre-review `scalar_disagreement()` restored verbatim | `an_inferred_scalar_is_caught_by_the_oracle`: *"the oracle failed to notice a type-inferred scalar marked as undecoded"* — the exact `text = "true"`, `decoded = false` pair the review constructed |
| E | 5 | `scalar_sequence` diagnoses the item and drops it again | `a_non_scalar_item_of_a_scalar_sequence_is_elided_in_place_rather_than_dropped`: *"one item per source entry, none dropped — left 2, right 3"* |

C1 is the one to remember. It is the same lesson as §7's experiment 2 from the other end: an
experiment that breaks the *contents* of a record proves only that records are audited, and says
nothing about whether a record exists to audit. **When a check iterates something the implementation
emits, the experiment must delete the emission, not its contents.**

### What the review checked and found sound, and is therefore not re-argued here

D2u's structural enforcement, the cache-disabling experiment, revision handling within one entry,
parse-failure handling, the diagnostics-as-codes discipline, the Phase 0 diffs being derives and
exports only, and the absence of `tauri` from both manifests and `Cargo.lock`.
