The overall span-surgery approach is sound, but the stronger claim that all preservation metadata lives in gaps is not yet justified.

1. The gap-scanner premise has several concrete failure modes.

First, “gap” depends on which spans form the frontier. Parser spans are normally nested: a mapping span contains its key and value spans; a sequence span contains its item spans. A comment can therefore be inside the mapping span while between child spans. Taking the complement of all reported spans loses it; taking gaps only between leaf spans retains it. This distinction must be explicit and asserted.

Block scalars are the largest risk:

```yaml
script: |2-
    echo hello
    # this is shell text, not a YAML comment
```

The `|2-` header may be part of the scalar’s reported span, rather than a gap before its content. If so, indentation and chomping indicators are trivia inside a span. At the other boundary, the scalar span may include or exclude one or more final line breaks. Those line breaks determine both scalar semantics and where the following comment or key begins. “Exact scalar end” needs a lexical definition covering header, content indentation, final newline, and chomping—not merely agreement with a hand-selected content range.

Blank lines can also be scalar content:

```yaml
message: |
  first

  second
```

Likewise, multiline single-quoted scalars may contain blank lines and doubled quotes:

```yaml
regex: 'first

  second''part'
```

A scanner must never recover those blank lines as document trivia. This is safe only if it excludes the complete scalar lexical span, which must itself be proven for every scalar style.

Anchor names are not reliably gaps:

```yaml
defaults: &base
  enabled: true
copy: *base
```

Depending on the event model, `&base` may be included in the anchored node’s span, exposed through a separate event, or sit between the key separator and node span. Tags create the same problem:

```yaml
value: !custom &id "text"
```

You need assertions for all orders of tag and anchor properties, not an assumption that their spelling is outside the node.

Flow collections expose ambiguous ownership:

```yaml
items: [one, # explanation
        two]
```

The comment is lexically between `one` and `two`, but does it belong to the first item, second item, or containing sequence? Pure value replacement can ignore ownership. Deleting, moving, or inserting entries cannot. The same problem occurs here:

```yaml
map: {one: 1, # about one?
      two: 2}
```

A scanner can preserve the bytes without understanding them, but it cannot define a correct deletion envelope without an attachment policy.

Empty and implicit nodes create zero-width or overlapping boundaries:

```yaml
empty:
items:
  -
flow: [a,, b]   # invalid, but relevant while a user is typing
```

For `empty:`, the value has no lexical scalar token. The colon, trailing spaces, comment, and newline may all occupy a gap shared by the key, null value, and mapping. There is no unique owner. Explicit mapping syntax has similar cases:

```yaml
? complex
: value
```

Compact sequence mappings add another boundary problem:

```yaml
- key: value
```

The dash belongs to the sequence entry, while the mapping begins on the same line. Parent and child spans can share starts or ends, leaving syntax that is not meaningfully “between” distinct spans.

Merge keys and aliases also require syntactic classification:

```yaml
combined:
  <<: [*base, *extra]
```

`<<` may arrive as an ordinary scalar key, while aliases are not scalar values. A path resolver that assumes key/value scalar pairs can select the wrong event or reject an editable construct.

Quoted `#`, colons, braces, and interpolation are safe only because they remain inside proven scalar spans:

```yaml
regex: '^foo # literal: {{var}}$'
```

If the scanner ever scans within that span—to locate an anchor, header, or delimiter—it must understand quoting and is effectively becoming a lexer. That contradicts the “never decides what a scalar is” claim.

2. The missing criterion is replacement-envelope correctness, not merely endpoint accuracy.

A parser can report the expected scalar start and end yet still be unsuitable for editing because it does not provide enough structure to identify the intended node and determine a syntactically closed replacement region. The evaluation should mutate actual documents and assert all three properties:

- The selected span corresponds to the requested structural path despite duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys, and empty values.
- Replacing exactly that envelope produces the intended parsed value and remains valid YAML.
- Every byte outside the envelope is identical, including CRLF versus LF, BOM, missing final newline, trailing spaces, comments, and block-scalar terminal newlines.

Also test parser behavior on incomplete editor states. A desktop editor routinely sees `key: "unfinished`, half-written flow collections, and transient indentation errors. Whether loading fails cleanly, emits misleading partial spans, or panics matters as much as correct spans on valid YAML.

3. A per-document char-to-byte table is the right default: it gives constant-time conversion and avoids repeatedly walking UTF-8 prefixes. Build it only at Unicode-scalar boundaries and reject offsets beyond its domain.

Pin the definition with one source containing `[é, é, 😀, tail]`. The reported start of `tail` distinguishes byte offset, Unicode scalar count, UTF-16 units, and grapheme clusters: they produce different positions. Assert starts and ends for every element against all four counting schemes. The decomposed `é` distinguishes scalar values from graphemes; `😀` distinguishes scalar values from UTF-16; `é` and both examples distinguish characters from UTF-8 bytes. Do not normalize the input.

4. Pre-1.0 is acceptable if it is pinned exactly, isolated behind one module, and protected by those behavioural assertions. I would not vendor immediately: vendoring creates ownership without eliminating upgrade risk. Keep a small adapter API and a locked dependency; fork only if an upstream release breaks required behavior, maintenance becomes unreliable, or you need a parser fix that upstream will not take.

Codex session ID: 019fae40-8d3e-7142-acce-5bf7c59ef6f7
Resume in Codex: codex resume 019fae40-8d3e-7142-acce-5bf7c59ef6f7
