## Verdict

The gate is **not genuinely passed**. The corpus sweep is substantial and useful, but E5 proves that production can still mint a `PatchedDocument` after deleting bytes outside the requested field’s ownership boundary. That directly violates the Phase 0 requirement to preserve every byte outside the intended span ([plan](/Users/ccarpio/Developer/espansoConfig/IMPLEMENTATION_PLAN.md:1077)) and repeats R24’s exact failure pattern.

### High — E5 is a production safety hole and blocks the gate

Concrete shape:

```yaml
matches:
  - trigger: ':a'
    replace: x
    label: remove-me

  - trigger: ':b'
    replace: y
```

Operation: remove `matches[0].label`.

With the E5 defect, the deletion run includes both `label: remove-me\n` and the following blank line. The requested field does not own that separator, yet all production checks accept it:

- no node is crossed;
- the mapping loses exactly one entry;
- sibling digests are unchanged;
- no comment or scalar value changes;
- the replacement declaration authorizes the deleted byte.

Only the test-side `owned_lines` check rejects it ([experiment](/Users/ccarpio/Developer/espansoConfig/docs/decisions/0c-3b-2b-notes.md:507), [test derivation](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/gate_roundtrip.rs:812)). Therefore §8.1’s final bullet is evidence that the implementation still violates R24, not evidence supporting passage ([verdict evidence](/Users/ccarpio/Developer/espansoConfig/docs/decisions/0c-3b-2b-notes.md:682)).

Deleting a user’s blank line is not acceptable collateral under this project’s architecture. A blank line genuinely owned by the removed entry is inside the intended envelope; E5’s blank is outside it. The distinction is ownership, not whether the byte decodes to YAML data.

The cheapest correct fix is a production `RemovalCarriesMoreThanTheEntry`-style check, analogous to `MoveCarriesMoreThanTheItem`:

- independently derive the entry’s allowed physical-line runs from its key/value frontier and textual leading-trivia rules;
- include blank runs that those ownership rules genuinely assign to the entry;
- require every deletion run to be contained in that independently derived set.

It must not reuse `removal_envelope` or its declared permitted spans, because that would reproduce the same circular authorization. Until this exists in `verify()` or its pre-splice structural guard, R24 remains open as a class.

### Medium — the tag oracle has concrete false negatives

Concrete shape:

```yaml
matches:
  - trigger: ':a'
    replace: safe
```

Operation: scalar-edit `replace` to `2001-1-1`, under the defective-emitter scenario the new production check is specifically meant to defend against.

The YAML 1.1 timestamp implicit resolver admits one- or two-digit month and day in the date form. `tags.rs` instead requires exactly two digits when the date ends there ([implementation](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/tags.rs:455)). It therefore classifies `2001-1-1` as `str` rather than `timestamp`.

Other concrete inaccuracies:

- A sufficiently large sexagesimal integer such as `999999999999999999999999999999999999999:00` matches the YAML 1.1 integer production, but the resolver returns `None` after its `i128` parse/checked arithmetic overflows ([implementation](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/tags.rs:286)).
- The YAML 1.2-core integer side incorrectly rejects signed radix values and underscores. For example, `+0o17` should resolve as a 1.2 integer but is classified as a string because radix prefixes are checked before stripping the sign ([implementation](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/tags.rs:507)).
- Conversely, its unrestricted decimal `[0-9]+` treatment does not match the core-schema treatment of leading-zero decimal forms; the documented `012 → 12 under 1.2 core` claim is not a faithful core-schema rule.

The independent broad shape predicate currently quotes these examples, so I do not have a normal public edit that emits them plain today. The defect matters because `verify()` was added precisely as independent protection against a future caller bypassing or weakening that predicate. For these inputs, both the production and test-side differential checks consult the same incorrect table and fail together.

Consequently, “0 gaps after the fix” is only a measurement that the emitter is a conservative superset of its own table. The generated test explicitly compares `plain_scalar_is_ambiguous` against a predicate that calls `plain_scalar_is_ambiguous` ([test](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/gate_roundtrip.rs:1928)). The sixteen hand-written cases provide some external knowledge, but not table completeness. The notes themselves acknowledge this weakness ([§4.3](/Users/ccarpio/Developer/espansoConfig/docs/decisions/0c-3b-2b-notes.md:394)); §4.1 nevertheless overstates the result as “edits cannot introduce an ambiguity.”

The common YAML 1.1 boolean spellings, null spellings, ordinary octal/hex integers, bounded sexagesimals, `.inf`/`.nan`, and full timestamps appear otherwise consistent with the intended productions.

### Medium — the matrix proves document co-occurrence, not operation × construct interaction

Concrete shape—the new synthetic fixture’s essential structure:

```yaml
matches:
  - ? explicit trigger
    : explicit value
  - trigger: ':second'
    replace: compact

global_vars:
  - name: greeting
    params:
      echo: hello
```

Operation: insert or remove a field inside `global_vars[0].params`.

That successful operation credits `explicit-keys × FieldInsert` or `explicit-keys × FieldRemoval` as `Applied`, although the operation never approaches the explicit-key mapping. The axis is attached to the whole document ([matrix definition](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/gate_roundtrip.rs:286)). The separate hazard tallies do correctly prove that actual hazard-scoped attempts were totally refused, but the 48-cell matrix cannot support the stronger §8.1 wording that every construct was “met” by every operation.

There are also **eight actual `RefusedOnly` cells**, not five: one no-final-newline move, three merge-key operations, three alias operations, and one explicit-key move ([matrix](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/gate_roundtrip.rs:291)). The notes’ “five” counts five grouped table rows/reasons, not cells.

The real sweep is also sampled rather than full-target:

- mappings are included only when `mapping.id % 3 == 0`;
- sequences are similarly thinned;
- moves offer only the first-to-back and last-to-front cases.

See `REAL_CORPUS_STRIDE` and its explanation ([gate test](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/gate_roundtrip.rs:118)). All corpus files are read, but not all structural targets are edited. Thus “passes on the full corpus” is defensible only as “samples every file,” not as the natural stronger reading “runs the property over every eligible target in the corpus.”

## Answers to the six questions

1. **Is the verdict honest?**  
   No. The sweep honestly reports many limitations, but §8 converts E5—a demonstrated production escape—into supporting evidence. E5 is the missing fourth qualification and is a blocker, not a non-blocking qualification. Target thinning and the document-level matrix are additional qualifications to the strength of the evidence.

   The repository’s authoritative progress record also has not been updated: Phase 0c-3b-2b remains “next,” R4 remains uncleared, and Phase 1 remains blocked ([status](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:23), [required disposition](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:1498)). That inconsistency happens to match this review’s conclusion.

2. **Should E5 block?**  
   Yes. The application’s defining guarantee concerns bytes, including blank lines, not only parsed nodes. Port an independent entry-owned-lines/runs bound into production, accommodating genuinely owned blank runs rather than forbidding blank-line deletion categorically.

3. **Is R16 sufficient?**  
   The differential multiset design is reasonable for the four current operations: implicit scalar resolution is lexical, and removal or same-sequence movement does not normally change a neighbouring scalar’s resolution merely through adjacency. `012`-style same-tag/different-value disagreements are intended to be covered through canonical values, and explicit tags are hazard-refused.

   The implementation is nevertheless insufficient because the table has false negatives and the “0 gaps” sweep is self-referential. Current conservative emission supplies overlapping protection, but the claimed independent production guarantee is not established.

4. **Are the refusal-only cells genuine?**  

   - Merge-key insert/remove/move: genuine hazard refusals.
   - Alias insert/remove/move: genuine hazard refusals.
   - Explicit-key move: genuine hazard refusal, but only the poisoned sequence offers a move; the safe sibling has no movable sequence.
   - No-final-newline move: a real **capability gap**, not a hazard. It is a justified safety refusal under D2p, but the engine cannot perform that requested move.

   The matrix’s `Applied` cells for safe siblings should not be described as exercising the hazardous construct itself.

5. **Is `tags.rs` correct?**  
   Not completely. The clearest wrong inputs are `2001-1-1`, oversized sexagesimal integers, and signed YAML 1.2 radix forms such as `+0o17`. The boolean/null tables and ordinary bounded YAML 1.1 numeric cases appear sound. Because the table gates edits, its false negatives should be fixed and pinned directly before calling R16’s corruption half closed.

6. **Did pinned-count retabulation hide a regression?**  
   I found no loosened assertion and no unexplained change to an existing fixture row. Every changed count is additive and matches the new fixture:

   - 15 scalars, 7 collections, 23 nodes;
   - 10 whole-line comments;
   - 1 blank line/run;
   - 1 explicit-key hazard;
   - 72 scalar-edit attempts: 60 applied and 12 hazard refusals;
   - corresponding new exact rows in the structural and move tables.

   One comment in `patch_path.rs` has incorrect arithmetic: it says “6 collections” and “16 scalars,” while its enumerated structure and the independently pinned syntax counts are 7 collections and 15 scalars ([comment](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_path.rs:302)). The asserted total of 23 is correct. This is documentation drift, not an absorbed behavioral regression.

The strongest attack that failed was the proposed neighbouring-resolution change: for the implemented removal and same-sequence move operations, I found no concrete way to change an untouched scalar’s implicit tag purely by changing adjacency while still passing the existing structural checks. The decisive failures are instead E5’s test-only ownership boundary and the resolver’s incomplete rules.

No files were modified, no web access was used, and no private real-corpus content is reproduced.

Codex session ID: 019fb4e2-9e07-7641-9a61-bc00567f0f6a
Resume in Codex: codex resume 019fb4e2-9e07-7641-9a61-bc00567f0f6a
