# Decisions, and why

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

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

### D4 — the write is optimistic conflict detection, not a compare-and-swap, and every doc says so

`replace_file_atomically()` reads the target, compares its `ContentRevision` against what the caller
believed, writes a temp file, and renames. The per-path lock in step 1 is a **process-wide mutex**: it
serialises this application's own threads and has no effect on any other process. So between the hash
and the rename, vim, espanso, Dropbox or iCloud Drive can replace the target, and the rename will
overwrite that change and report success.

**This is not fixable.** There is no ordinary POSIX or macOS pathname operation that means *replace this
name only if its contents hash to X*. Advisory locks, lock files and `flock` bind only cooperating
writers. So the decision is: **build the honest thing and name it honestly.**

- The primitive promises **atomic replacement plus optimistic conflict detection**, and the module doc
  has a `# The residual race` section naming vim, espanso and sync agents by name. It does **not**
  promise "only if the file still holds what you believed".
- `recheck_target()` runs immediately before the rename and refuses on a changed path, a changed
  `(dev, ino)`, a changed type or a changed hash, so the window is **one rename wide** rather than as
  wide as writing and syncing a whole candidate file. Narrowed, and said to be narrowed.
- `TargetChangedDuringWrite` is a **separate variant** from `RevisionMismatch`, because the two mean
  different things to a user: one is *someone else had already changed it before you started*, the other
  is *someone else changed it while you were saving*. The `Identity` arm exists because a file can be
  replaced by different bytes that hash the same only if it is the same content — an inode change with
  an equal hash still means the object is not the one that was inspected.
- `WriteError::may_have_written()` answers *whether **this call's** rename may have completed* — not
  whether the target currently holds anything. Under external writers the target must be re-read.

**What this obliges later phases to do.** 2a-3's backups and 2d's watcher are not conveniences: they are
the recovery path for the race this decision leaves open. A conflict UI that assumes the app's last
write is what is on disk would be wrong for the same reason.

---

