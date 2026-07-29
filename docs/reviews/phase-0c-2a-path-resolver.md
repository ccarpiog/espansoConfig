Verdict: **accept with fixes**. I found no counterexample to either core round trip and no reachable panic on a parser-produced `SyntaxIndex`. However, one hazard-gate claim is false, and the acceptance suite leaves several contract-critical branches untested.

## Findings, ranked

### Medium — flow collections are not refused by the hazard gate as claimed

[path.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/path.rs:27) says every flow collection resolved here is later refused by `is_safely_editable`. That is false.

[HazardKind](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:251) has only `CommentInFlowCollection`, not a general flow-collection hazard. [is_safely_editable](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:493) checks only recorded hazards.

Concrete input:

```yaml
matches: [{trigger: ":a", replace: old}]
```

With no comment or other hazard, `matches[0].replace` resolves and the gate returns true. That may be intentional—D2d only promises refusal when a comment occurs inside the flow collection—but it contradicts this step’s stated safety story.

This matters in 0c-2b: replacing `old` with a multiline value may make the codec choose block style, which is illegal inside `{...}`. Reparsing should prevent corruption, but the edit will fail late unless 0c-2b either:

- explicitly refuses all edits inside flow collections, or
- passes flow context to rendering and guarantees a flow-legal scalar.

Choose one and correct the documentation. Do not let 0c-2b rely on the current false claim.

### Medium — key edits cannot use the advertised same-path verification cycle

`path_to` correctly refuses `MappingKey`, while `resolve_key` exposes the key node. But modifying that key invalidates the path used to find it.

Concrete input:

```yaml
replace: old
```

Resolve `replace`, obtain its key through `resolve_key`, then rename the key to `replacement`. After reparsing, resolving the same path `replace` returns `NoSuchKey`.

Therefore 0c-2b must enforce that scalar edits target only `Resolved.value`, never `Resolved.key`. A future key-rename operation needs a separate verification protocol using both the old and intended new path. Editing an ordinary value that merely equals some other key string causes no problem.

### Medium — the universal textual and totality contracts lack universal tests

The implementation appears correct, but [the awkward-key test](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/path.rs:1210) does not cover the classes explicitly at issue:

- `"\0"`, `"\u{0007}"`, and `"\u{007f}"`
- embedded `\n`, `\r`, and `\t`
- `\u{feff}`
- U+2028/U+2029
- astral characters such as `😀`
- long runs of apostrophes
- arbitrary combinations of segments and document indices

Likewise, [the “no panic” acceptance test](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_path.rs:438) crosses only thirteen fixed, already-valid paths with the corpus. It does not test `DocumentPath::parse` on arbitrary input.

Add property/fuzz tests for:

```rust
parse(&DocumentPath::new(doc, arbitrary_segments).to_string()) == Ok(path)
```

and for totality of `DocumentPath::parse(arbitrary_string)`. The static cursor analysis looks safe, but the current tests do not establish the advertised universal contract.

### Medium — important refusal shapes are absent from the corpus oracle

The exact acceptance count explicitly asserts [zero non-scalar keys](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_path.rs:252). Consequently, `AddressError::NonScalarKey` is never exercised by the corpus audit.

Add explicit inputs for:

```yaml
? [a, b]
: value
```

and, if accepted by the parser, an alias used as a key.

Duplicate descendants also need a pinned test:

```yaml
a:
  child: one
a:
  child: two
```

Both `child` values must be unaddressable, and resolving `a.child` must fail at the duplicated `a`. The implementation does this correctly, but the present fixture count only covers four direct duplicate values, not descendants.

Also test duplicates across scalar presentations:

```yaml
a: one
'a': two
```

### Low — the “unknown node” unit test tests something else

[an_unknown_node_identifier_is_refused_not_panicked_on](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/path.rs:1341) never passes an unknown `NodeId` to `path_to`. It resolves a syntactically valid path and expects `KeyIntoNonMapping`; the `beyond` number is merely embedded in a key string.

A reachable test is to obtain a high `NodeId` from a larger index and call `path_to` on a smaller index where that arena slot does not exist. Assert `AddressError::UnknownNode`.

### Low — control characters round-trip but undermine “textual form for logs”

No key breaks `parse(display(p))`, including controls. But [write_key](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/path.rs:221) emits characters verbatim.

Examples:

- YAML key `"\0"` displays with a literal NUL.
- YAML key `"a\nb"` displays as a multi-line quoted path.
- BEL and other non-whitespace controls are emitted bare.

This is exact in Rust, but poor for logs and line-oriented diagnostics. Either describe the form as an in-memory serialization only, or introduce escaping for controls and line separators.

## Core properties

`resolve(path_to(n)) == n`: **exact for every well-formed, parser-produced node that `path_to` accepts.** The proof is direct:

- A `MappingValue` contributes the decoded preceding key; `path_to` refuses unless that key occurs exactly once, so `resolve` selects that same pair.
- A `SequenceItem` contributes its exact position in the parent’s children, which `resolve` indexes directly.
- Both operations repeat to the same document root.

Duplicate ambiguity correctly propagates through value descendants. Nodes inside mapping keys may refuse earlier as `IsMappingKey`, which is still correct.

`parse(display(p)) == p`: **exact for every Rust `String`.** Reserved grammar characters and `#` are quoted, apostrophes are doubled and reversed, and every other Unicode scalar is copied without transformation. `#0` as a real key is canonically written `'#0'`, distinct from root path `#0`.

Reachable panics: **none found.** Every string slice begins on a maintained UTF-8 boundary; numeric slices contain only ASCII digits; empty input is checked before `bytes[0]`; index parsing checks bounds; and mapping pairs use `first()`/`get(1)` or a length guard.

`Resolved.parent`: correct. It is the immediate mapping or sequence for non-root paths and intentionally `None` for a root path.

## Test-oracle assessment

The inverse assertion in `audit()` is genuinely valuable: it checks every addressable node by identity, not merely by value. It is not completely independent—both directions share decoded-key and child-order assumptions—but the targeted tests independently pin the major public semantics.

The exact counts are partly load-bearing:

- `addressable`, `mapping_keys`, and `ambiguous` detect coarse reachability regressions.
- The total `1095` is mostly a corpus/parser-shape lock.
- Counts cannot detect compensating category changes or unrepresented shapes.
- `non_scalar_keys == 0` documents a coverage hole rather than proving that branch.

The hazard/resolver separation itself is correct, but in 0c-2b the mutation entrypoint must own the gate check internally. Making safety a caller convention would be unacceptable.

Codex session ID: 019fafa2-79f2-7502-896f-fd2d60296a8a
Resume in Codex: codex resume 019fafa2-79f2-7502-896f-fd2d60296a8a
