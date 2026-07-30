## Findings

### 1. High — demonstrated: removing a collection-valued entry deletes file-owned comments, and verification passes

Concrete input:

```yaml
a:
  x: 1
  # keep this file comment

  y: 2
b: 3
```

Removing field `a` produces:

```yaml
b: 3
```

The comment is separated from `y` by a blank line, so D2d assigns it to the file. Nevertheless:

- `subtree_extent` initializes its hull from the collection’s contiguous node span, which already crosses the comment. Its claim that file comments are excluded is therefore false for comments between descendants. [trivia.rs:484](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:484), [trivia.rs:488](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:488), [trivia.rs:497](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:497)
- `entry_extent` uses that hull, and `removal_span` widens it to whole lines. [edit.rs:1769](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1769), [edit.rs:1789](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1789)
- `StructuralGuard` permits every descendant of `a`, but examines no trivia ownership. [edit.rs:1223](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1223)
- Candidate verification sees `a` gone, `b` unchanged, and the entry count reduced by one. Digests contain decoded nodes, not comments. [edit.rs:2657](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:2657)
- The external acceptance oracle has the same blind spot: it checks overlapping nodes but not file-owned trivia. [patch_structure.rs:384](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_structure.rs:384)

This is the structural equivalent of E1/E3: the deletion declaration authorizes the bad envelope, while the “independent” checks cannot see the destroyed byte.

Smallest correct fix: refuse any removal whose final envelope intersects a file-owned comment. Longer-term, represent envelopes as owned runs rather than a hull; a single contiguous `ByteSpan` cannot express “remove the collection but preserve this interior file comment.”

### 2. Medium — demonstrated: insertion defaults line endings when the document supplies no evidence

Concrete input:

```yaml
a: 1
```

with no final newline. Inserting `b: x` produces:

```yaml
a: 1
b: x
```

using LF. `plan_insertion` takes the document-wide preamble ending and writes it before the new entry. [edit.rs:1528](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1528), [edit.rs:1549](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1549) But `LineEnding::detect` explicitly defaults a single-line document to LF. [lib.rs:104](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/lib.rs:104)

It also learns from the dominant document style rather than the anchor: in a mixed document, inserting after a CRLF-terminated sibling can write an LF entry if LF is globally dominant.

Smallest correct fix: learn the ending from the anchor’s actual terminating break; at EOF, use a nearby sibling’s observed break. If the whole file has no break, refuse or require the caller to supply the desired ending rather than defaulting.

### 3. Medium — demonstrated: three identical removals panic before overlap detection

Concrete batch:

```text
source = "a: 1\nb: 2\n"
edits  = [remove a, remove a, remove a]
```

Each edit plans successfully because the original mapping has two entries. `apply_edits` calls `fold_expectations` before checking replacement overlap. [edit.rs:1129](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1129) Folding starts at two entries and performs unchecked `usize` subtraction three times, underflowing in debug builds. [edit.rs:1434](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1434) The intended `OverlappingEdits` check is reached only afterward. [edit.rs:1134](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1134)

Smallest correct fix: sort and reject overlapping replacements before folding expectations. Also use checked arithmetic so malformed batches can never panic.

### 4. Medium — suspected: the collection-extent fallback still publishes a known-underclaimed extent

The textual derivation correctly returns `None` for an unclassifiable overshoot. [collection.rs:132](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/collection.rs:132) But `SyntaxIndex` converts that into:

```rust
owned_end = span_end
derivation = Unaccountable
```

and still publishes it as an ordinary `usize`. [index.rs:516](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:516)

The corpus test genuinely sums the fallback count across both corpora and pins it to zero. [syntax_index.rs:1986](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1986), [syntax_index.rs:2051](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:2051) So it does not currently fall back silently in CI. However, a caller can read `owned_end` without checking `derivation`; the type does not force the refusal. No current 0c-3a edit consumes this field, so I did not trace present byte loss.

Smallest correct fix: make the owned end fallible—`Option<usize>`/`Result` or a checked accessor—and require structural consumers to refuse `Unaccountable`.

### 5. Medium — demonstrated test-claim gap: refusals are not all independently re-derived

The strong parts are real: every synthetic fixture has a complete pinned row, coverage is checked, successful insert/remove totals are required, and no real-corpus result is hard-coded. [patch_structure.rs:815](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_structure.rs:815), [patch_structure.rs:891](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_structure.rs:891), [patch_structure.rs:928](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_structure.rs:928)

But the claim that every refusal is independently re-derived is false:

- `KeyAlreadyPresent` is counted without checking that the attempted key exists. [patch_structure.rs:719](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_structure.rs:719)
- `NoSuchSibling` and `InconsistentEntryIndentation` are absent from `Tally` and the sweep. [patch_structure.rs:85](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_structure.rs:85)
- The removal oracle never compares file-owned comments before and after, which is why finding 1 passes it.
- `empty-entries-and-extents.yml` covers empty values and extent tails, but explicitly omits CRLF, missing-final-newline, and other invisible-byte shapes. More importantly, it lacks a removable collection containing an interior file-owned comment. [empty-entries-and-extents.yml:9](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/corpus/synthetic/empty-entries-and-extents.yml:9)

Smallest correct fix: independently validate the existing-key refusal, add missing-sibling attempts, and add a synthetic fixture containing the finding-1 shape plus a single-line/no-line-ending insertion case.

## Areas examined and found clean

- Ordinary removal envelopes correctly use subtree ownership rather than direct ownership. Inline comments, leading comments, file headers, blank runs around the entry, CRLF, empty values, block scalars, first/last entries, and compact sequence mappings are handled or refused as documented.
- Indentation is learned from mapping keys, including compact `- key: value` mappings and deep nesting. Insertion after block scalars is correctly placed.
- Node-level verification is strong: deleting or changing a kept sibling node, including nested collections, is detected. It simply does not cover trivia.
- Normal overlap cases work: two insertions at one point, a scalar inside a removed subtree, identical removals, and adjacent removals are classified correctly. I found no corrupt interleaving after overlap checking.
- The flow, compact-first-entry, last-entry, and `RemovalWouldExtendAKeptBlock` refusals are correctly scoped for their stated policy. Flow refusal does make idiomatic inline `vars: [{…}]` structurally uneditable, but that is explicit phase scope, not accidental behavior.
- The zero-width decoder skip is conceptually sound with saphyr 0.0.11: explicit empty `''` has bytes; block syntax has a header; zero-width scalar events represent implicit nulls/bare items. I would harden the test by asserting every skipped node is plain, headerless, and has substrate value `~`, but I found no current zero-width non-implicit scalar hidden by the skip.

I ran only safe unit and synthetic-corpus tests, including the 2,301-attempt structural sweep. I did not run or inspect the private real corpus.

Verdict: **do not accept**. Finding 1 is silent deletion of a byte ownership explicitly says must remain, and present verification certifies the corrupted result.

Codex session ID: 019fb21b-dfa1-7632-b08c-1f62c9f650b3
Resume in Codex: codex resume 019fb21b-dfa1-7632-b08c-1f62c9f650b3
