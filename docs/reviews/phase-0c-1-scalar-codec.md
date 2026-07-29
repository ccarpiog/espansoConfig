## Verdict

Phase 0c-1 should not be accepted unchanged. I found two concrete correctness defects that violate byte/value round-trip guarantees, plus one already-known decoder loss that needs either fixing or an explicit mutation-time refusal. There are also two compatibility gaps that should be resolved before the codec is connected to document editing.

I did not run tests or modify files.

## Ranked findings

### 1. Block indentation greater than nine silently adds spaces to the value

Must block Phase 0c-1.

[plan.rs, `ScalarContext::indentation_indicator`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/plan.rs:97>) clamps the relative indentation to nine, while [`literal_block`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/plan.rs:158>) and [`render_block_body`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/plan.rs:288>) still indent the body to the original, deeper column.

Checkable case:

```rust
let context =
    ScalarContext::block(0, LineEnding::Lf).with_indent(10);
let plan = choose_scalar(" x\n", context);
```

It renders conceptually as:

```yaml
|9
           x
```

There are ten structural spaces plus the one data space before `x`. The `|9` indicator removes nine, so YAML reparses the value as `"  x\n"` instead of `" x\n"`.

The comment claiming the extra indentation is harmless “more-indented content” is exactly the problem: that extra indentation becomes scalar content. A relative indentation above nine combined with an ambiguous first line is not representable at the requested body column. It must select another representation or return a typed refusal.

The round-trip tests miss this because every constructed `ScalarContext::block` uses the default two-column delta; none uses `with_indent` or a delta above nine ([scalar_codec.rs, `BLOCK_SITES`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/scalar_codec.rs:270>)).

### 2. The known terminal whitespace-line bug loses logical data

Must block Phase 0c-1 unless the exact shape is guaranteed to be refused before any edit in Phase 0c-2.

[`block::content_len`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:244>) removes a whitespace-only final physical line at EOF without knowing the block indentation. The test documents the exact failure:

```yaml
key: |2-
   
   
```

Specifically, for bytes:

```text
key: |2-\n   \n   
```

the substrate returns `" \n "`, while this codec returns `" "` ([scalar_codec.rs, documented failing case](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/scalar_codec.rs:607>)).

That is not merely a span-layer cosmetic issue. If the affected scalar is displayed from this decoder and then edited, the missing line cannot be written back. The round-trip property explicitly exempts these failures through `known_shortfalls`, so a green test suite does not establish the advertised decoder contract.

Deferring is safe only if Phase 0c-2 introduces a source-shape hazard that prevents this scalar from being edited. Otherwise fix `content_len` now.

### 3. YAML 1.1 line-separator characters are not conservatively handled

Compatibility finding; should block integration with the espanso parser, at latest Phase 0c-2.

This is partly a hypothesis because the named files test only saphyr, not espanso’s Go/Rust consumer.

U+2028 and U+2029 are allowed through the plain predicate because Rust does not classify them as control characters. They are also emitted raw by [`escape_double_quoted`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/plan.rs:316>), despite the decoder supporting YAML’s `\L` and `\P` spellings ([decode.rs, `consume_escape`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/decode.rs:408>)).

Checkable cases:

```rust
choose_scalar("a\u{2028}b", block_context)
choose_scalar("a\u{2029}b", block_context)
```

Both can emit raw plain text. A YAML 1.1 implementation may treat these characters as line breaks and fold or reject them. The saphyr-only round-trip currently treats them as safe—indeed both appear in the adversarial set—so it cannot establish compatibility with the stated 1.1-ish destination stack.

For destination-independent output, force double quotes and emit `\L`/`\P`.

### 4. Bare-CR block bodies incorrectly return `Ok` from `reencode_in_place`

Must block Phase 0c-1 because it directly contradicts that function’s byte-identity contract.

[`block_line_ending`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/choose.rs:453>) counts bare CRs, but this branch:

```rust
(0, _) => Ok(LineEnding::Lf)
```

classifies both “LF only” and “bare CR only/mixed with LF” as LF.

For a literal block whose `content_span` is:

```text
"  a\r  b\r"
```

`reencode_in_place` decodes it to `"a\nb\n"`, selects `LineEnding::Lf`, and renders:

```text
"  a\n  b\n"
```

rather than the original CR bytes. It returns `Ok`, not `MixedLineBreaks`.

Since `LineEnding` has no bare-CR variant, any bare CR in block content should be refused. The corpus test can pass simply because its fixtures do not contain this physical-line-ending class.

### 5. Chomping-before-indent headers cannot re-encode byte-identically

Must block Phase 0c-1’s `reencode_in_place` contract; otherwise defer only if that API’s byte-identity claim is weakened.

[`ScalarPlan::render_header`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/plan.rs:194>) always renders the indentation indicator before the chomping indicator:

```text
|2+
```

But YAML also permits the reverse source presentation:

```text
|+2
```

`ScalarPresentation` records the two meanings but not their source order. Thus:

```yaml
key: |+2
  body
```

can produce an `Ok` plan whose header is `|2+`, failing byte identity even though nothing about decoding is lossy.

Add a presentation-order hint or a typed `NonCanonicalHeaderOrder` refusal. Add both indicator orders to the synthetic identity suite.

### 6. The “plain-safe” API has no mapping-key context

Can be deferred to Phase 0c-3 if this codec is guaranteed to emit values only.

[`ScalarContextKind`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/plan.rs:29>) distinguishes block from flow, but not mapping keys from values. Consequently `is_conservatively_safe_plain_scalar("<<")` returns true.

As a mapping key:

```yaml
<<: value
```

has merge-key significance rather than being an ordinary string key. The current round-trip sites test only values under `key:` and cannot reveal this.

Either document that `choose_scalar` is value-only or add a key/value role before structural insertion is implemented.

### 7. YAML-printability is not validated

Low-probability but severe; preferably block Phase 0c-1, or add a typed refusal before Phase 0c-2.

Valid Rust strings can contain U+FFFE and U+FFFF. They are not `char::is_control()`, so the current code may emit them raw as plain or quoted YAML.

Checkable inputs:

```rust
choose_scalar("\u{fffe}", context)
choose_scalar("\u{ffff}", context)
```

There is no printable-set predicate or refusal. Add direct substrate parsing tests for these values and refuse them if the substrate cannot represent them. This finding is conditional on substrate behavior, which was not demonstrated in the named files.

## Review questions

### 1. Where can data change silently?

The direct logical-value corruptions are:

1. Relative indentation above nine adds leading spaces.
2. The known whitespace-only final line is omitted by decoding.
3. Hypothetically, YAML 1.1 handling of raw U+2028/U+2029 can fold or split the value.

The direct byte-identity violations are:

- bare CR becoming LF;
- `|+2` becoming `|2+`.

I saw no mechanism here that could modify a different scalar Y: this phase only renders one scalar and does not splice documents. Whether future span surgery preserves Y is outside these files.

### 2. Is the plain predicate conservative enough?

For ordinary mapping values in block context, it is quite conservative. It correctly covers YAML 1.1 booleans/nulls, numeric-looking values, sexagesimals, timestamps, document markers, comment starts, structural colons and regex backslashes ([choose.rs, predicate and resolver-shape checks](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/emit/choose.rs:214>)).

The remaining gaps are:

- U+2028/U+2029 under a YAML 1.1 consumer;
- `<<` when used as a mapping key;
- lack of YAML-printability validation.

Quoting every flow-context value is conservative and avoids many context-specific ambiguities.

### 3. Double-quote escaping and inverse grammar

For the characters the encoder currently chooses to escape, the encoder and decoder are inverses:

- slash, quote and backslash handling is correct;
- named C0 escapes agree;
- `\x`, `\u` and `\U` decoding checks length, hexadecimal syntax and Unicode scalar validity;
- raw UTF-8 is otherwise preserved.

It is minimal for saphyr, but not necessarily for a YAML 1.1 destination: U+2028 and U+2029 should use the already-supported `\L` and `\P` escapes. U+FFFE/U+FFFF also need an explicit policy.

`NonCanonicalEscaping` is overly broad: it refuses every double-quoted source containing any backslash, including already-canonical spellings such as `\\`, `\"`, `\n` and `\t`. That is safe but unnecessarily disables identity re-encoding.

### 4. What do the property tests prove?

The main emission oracle is not self-confirming. `parse_back` reparses the rendered document through `SyntaxIndex`/saphyr and first compares `scalar.value` with the input ([scalar_codec.rs, `parse_back` and `round_trip`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/scalar_codec.rs:331>)). The custom decoder is a secondary comparison. That is a sound structure.

Important gaps:

- only default two-column block indentation is tested;
- no `with_indent`/delta-above-nine context;
- no bare-CR physical block body;
- no `|+2` header ordering;
- no U+FFFE/U+FFFF;
- no mapping-key emission;
- no destination parser other than saphyr;
- `preserve_scalar` uses only one presentation per style, so it does not cover presentation variants.

The corpus identity test can pass while classification is wrong. It checks only observed corpus shapes, and refusals are counted by family rather than validated per scalar. Two scalars changing eligibility within the same refusal family could cancel. The known finding C is explicitly waived.

### 5. Is each refusal in the right bucket?

- `FoldedStyle`: correct for byte-identity re-encoding.
- `FoldedFlowScalar`: correct; physical fold placement was lost.
- `NonCanonicalEscaping`: safe but substantially too broad. Defer narrowing to 0c-2 if editing escaped double-quoted values remains possible through `preserve_scalar`.
- `NonCanonicalBlankLine`: correct for reconstructing bytes solely from the logical value.
- `MixedLineBreaks`: correct conceptually, but underfires for bare CR and LF/bare-CR mixtures.
- `SynthesisedFinalBreak`: correct.
- `Undecodable`: correct.

The refusal set also needs to account for indicator ordering if `reencode_in_place` retains its byte-identity promise.

## Decisions A–E

### A — backwards-first `locate_header`

Approve.

[`locate_header`](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:161>) correctly searches only the trimmed tail of the current preceding line. For a genuinely truncated `replace: |`, the bytes before `span_start` end at `replace: `, so backwards lookup finds no header and forward lookup finds the `|`. This remains true at EOF.

If the line before `replace:` itself ends in `|` or `>`, `line_start` advances past that prior line break, so that character is not considered. The body-line cases beginning with `|`/`>` are appropriately pinned.

One stale documentation statement at lines 153–155 still says the backwards lexer “must not run”; update the comment, though it is not a correctness problem.

### B — synthesized final break at EOF

Approve.

Matching the substrate is correct for the typed projection, while `SynthesisedFinalBreak` prevents pretending that the synthetic logical newline existed as a source byte. This preserves both semantic agreement and source-byte honesty. It would be a bug only if the value were later written back automatically despite the refusal.

### C — terminal whitespace-only line

Do not leave it silently editable.

It is high danger because the projection is already missing logical data. Fix it before Phase 0c-1 acceptance, or carry an explicit hazard that blocks edits to exactly this scalar until the span fix lands.

### D — indentation-only blank lines

Keep the refusal.

The decoded value cannot reconstruct those spaces, so returning `Ok` would be dishonest. A presentation hint could preserve them during later source-aware edits and would improve formatting fidelity, but that belongs in Phase 0c-2. It should complement, not replace, the refusal in a value-only re-encoder.

### E — policy bundle

- Single-line replacement remains block: approve.
- Folded edited as literal: approve semantically. Note that the implementation only produces `|` when the new value is multiline; a single-line folded replacement falls through to plain/single-quoted, so the stated policy is not universal.
- Quote comma/brackets/braces/backslashes: approve; conservative and regex-friendly.
- Requote edited plain `no` and `12:30`: approve for string-valued fields.
- `ScalarPlan` holding logical values: approve; it prevents double escaping.
- `parent_indent` in `ScalarContext`: approve, but fix the greater-than-nine case rather than clamping it.

The essential blockers are the indentation clamp, bare-CR acceptance, header-indicator ordering, and finding C unless it receives a mandatory typed refusal.

Codex session ID: 019faf49-1312-7c82-8ca9-2e4fcd20e424
Resume in Codex: codex resume 019faf49-1312-7c82-8ca9-2e4fcd20e424
