# YAML parser evaluation — Phase 0a

**Date:** 2026-07-29 · **Crates as tested:** `saphyr-parser` 0.0.11, `yaml-rust2` 0.11.0,
`marked-yaml` 0.8.0 (latest on crates.io at the time of writing) · **rustc** 1.97.0

This is the architectural gate described in `IMPLEMENTATION_PLAN.md` section 12, Phase 0.
Every claim below is produced by a runnable probe, not by reading documentation — twice
during this evaluation the documentation turned out to be wrong.

Reproduce everything:

```sh
cargo test -p espansoconfig-core --test parser_evaluation -- --nocapture --test-threads=1
```

31 tests in `crates/espansoconfig-core/tests/parser_evaluation.rs` pin every finding, so a
future crate upgrade that changes one fails the build instead of silently invalidating the
design built on top of it.

> **Revision note (adversarial review, `docs/reviews/phase-0a-parser-substrate.md`).** The first
> version of this document claimed end offsets were *"exact, every style"*. That claim was
> **wrong for block scalars**, and it was wrong because the test counted them and then asserted
> nothing about them (`ScalarStyle::Literal | ScalarStyle::Folded => true`). It is corrected in
> §1 and §2 below. Three further gaps the review identified — the offset *counting scheme*, the
> definition of a "gap", and behaviour on incomplete input — are now measured and pinned as well.

---

## Recommendation

> **Build the Phase 0b substrate on `saphyr-parser` 0.0.11, wrapped in two adapters of our own:
> a character-to-byte offset table, and a lexical trivia scanner.**
>
> `saphyr-parser` is the only one of the three that reports **where a node ends**. For *flow*
> scalars — plain, `'single'`, `"double"` — that end is exact: 727 of them in the synthetic
> corpus and 980 in the owner's 13 real files reproduce their source token byte for byte, with
> zero mismatches. That is the finding that de-risks the project's central technical bet.
>
> For **block** scalars (`|`, `>`) the reported end is **not** exact: it overshoots into
> trailing trivia, exactly as collection ends do. It is nevertheless *sufficient*, because the
> true content end is reconstructible from the reported span, `Marker::col()` and the header's
> chomping indicator. All 31 block scalars in the synthetic corpus re-decode byte-for-byte from
> those three inputs.
>
> It is **not** sufficient on its own. It reports **Unicode-scalar-value** offsets rather than
> byte offsets, and it discards comments, blank lines, block-scalar headers, chomping indicators
> and anchor names entirely. The plan's anticipated outcome — parser marks plus a small lexical
> scanner — is confirmed, but the scanner's job is much smaller than feared, because everything
> it must recover lives in the gaps *between* reported spans, once block-scalar ends are trimmed.

`yaml-rust2` and `marked-yaml` are both rejected, for the same root cause: neither reports an
end offset for a scalar, and span surgery is impossible without one.

---

## Scorecard

Scores: ✅ usable as-is · ⚠️ recoverable with our own code · ❌ not available.

| Criterion (plan §12) | `saphyr-parser` 0.0.11 | `yaml-rust2` 0.11.0 | `marked-yaml` 0.8.0 |
|---|---|---|---|
| **1. Exact end offsets — flow scalars** | ✅ exact source token | ❌ none in the API | ❌ always `None` |
| **1. Exact end offsets — block scalars** | ⚠️ **overshoots into trivia**; trimmable | ❌ none in the API | ❌ always `None` |
| **1. Exact end offsets — collections** | ⚠️ start exact, end overshoots into trivia | ❌ start is displaced | ❌ start displaced, end overshoots |
| **Offset unit** | ⚠️ Unicode scalar values, not bytes | ⚠️ same | ⚠️ same |
| **2. Block scalar — style** | ✅ `Literal` / `Folded` | ✅ | ❌ no style at all |
| **2. Block scalar — content indent** | ✅ from `Marker::col()` | ❌ | ❌ |
| **2. Block scalar — header text** | ⚠️ adjacent to the span, one-line lex | ❌ | ❌ |
| **2. Block scalar — chomping** | ❌ `Chomping` enum is in a private module | ❌ | ❌ |
| **3. Comment positions** | ❌ discarded | ❌ discarded | ❌ discarded |
| **4. Blank-line attribution** | ⚠️ recoverable from span gaps | ❌ | ❌ |
| Anchor **names** | ❌ numeric id only | ❌ | ❌ crate rejects anchors |
| Anchor / tag **spelling** relative to the node span | ✅ always outside the span | — | — |
| Explicit tags | ✅ `Tag { handle, suffix }` | ✅ | ❌ |
| Duplicate mapping keys | ✅ both retained | ❌ loader errors | ✅ |
| Anchors / merge keys | ✅ | ✅ | ❌ `Unexpected definition of anchor` |
| Parses the whole valid corpus (19 fixtures) | ✅ 19/19 | 18/19 | 18/19 |
| Parses the owner's 13 real files | ✅ 13/13 | not run | not run |
| Error location on invalid input | ✅ char index + line + column | ✅ | ✅ line + column |
| **Never panics on incomplete input** | ✅ 21 054 prefixes, 0 panics | not run | not run |
| Maintenance | active, YAML 1.2 | active, YAML 1.2 | thin layer over `yaml-rust2` **0.10** |

---

## Evidence

### 1. Exact end offsets — the decisive criterion

**`saphyr-parser` reports a `Span`, not a bare marker.** Its public iterator yields
`Result<(Event, Span), ScanError>`, and `Span` carries `start: Marker` *and* `end: Marker`
(`scanner.rs:101`). Probing one scalar of every style:

```
--- saphyr-parser scalar spans over STYLE_PROBE ---
Plain   0..5   source="plain" value="plain"
Plain   7..18  source="hello world" value="hello world"
Plain  19..25  source="single" value="single"
SingleQuoted  27..34  source="'it''s'" value="it's"
Plain  35..41  source="double" value="double"
DoubleQuoted  43..49  source="\"a\\tb\"" value="a\tb"
Plain  50..57  source="literal" value="literal"
Literal  63..73  source="one\n  two\n" value="one\ntwo\n"
Plain  73..78  source="strip" value="strip"
Literal  85..96  source="no newline\n" value="no newline"
Plain  96..100 source="keep" value="keep"
Literal 107..113 source="kept\n\n" value="kept\n\n"
Plain 113..119 source="folded" value="folded"
Folded 126..134 source="fold me\n" value="fold me"
```

The quoted spans include their quotes and the *undecoded* escape (`"a\tb"` in source, `a<TAB>b`
as a value). That separation of presentation from value is exactly what plan §6.3 requires.

⚠️ **This probe is exactly where the original evaluation went wrong.** Every key in it sits in
column 0, so there is no following indentation for a block-scalar span to run into and the
overshoot measures zero. Put the same block scalars inside a `matches:` sequence, where the next
key is indented, and the block spans stop being exact. See §2.

Scaled to the corpus, **flow scalars only**:

```
--- corpus-wide FLOW-scalar end-offset check ---
flow scalars asserted exact:   727
multi-line plain scalars skipped (they fold): 0
block scalars deferred to their own test:     31
mismatches:                    0
```

and against the owner's live configuration (gitignored, never committed):

```
real corpus: 13/13 files parsed
real corpus: 1067 scalar spans checked, 0 invalid
real corpus: 980 flow scalars exact, 0 wrong
real corpus: 87 block scalars, 80 with an overshooting end
```

The real corpus therefore reproduces the block-scalar overshoot on **80 of 87** block scalars.
It is the normal case, not an edge case.

**`yaml-rust2` has no end offset at all.** Its public parse result is
`type ParseResult = Result<(Event, Marker), ScanError>` (`parser.rs:207`). One marker. The
`MarkedEventReceiver` trait passes the same single `Marker`. The marker is correct — the plain
scalar `hello world` is reported at its true start — but there is no API of any kind that says
where it stops. Obtaining one means scanning forward through YAML ourselves, which is the lexer
we were trying not to write.

**`marked-yaml` looks promising and then is not.** Its `Span` type has both `start()` and
`end()`, but its loader builds scalar spans with `Span::new_start(mark)` (`loader.rs:349`),
leaving the end unset. Measured over the same probe:

```
--- marked-yaml spans over STYLE_PROBE ---
key "plain" start=Some(0) end=None
key "single" start=Some(19) end=None
key "double" start=Some(35) end=None
key "literal" start=Some(50) end=None
key "strip" start=Some(73) end=None
key "keep" start=Some(96) end=None
key "folded" start=Some(113) end=None
root collection end marker: Some(Marker { source: 0, character: 134, line: 14, column: 1 })
```

Collections get an end; scalars — the things we edit — never do. `marked-yaml` also depends on
`yaml-rust2` **0.10**, so adopting it would pull a second, older copy of the same parser into
the build.

**Collection extents.** "Move a whole match" needs the byte extent of one sequence item.
`saphyr-parser` gives an exact start and an end that overshoots into trailing trivia:

```
--- collection extents ---
saphyr item 13..47 -> "trigger: :a\n    replace: alpha\n\n  "
saphyr item 49..61 -> "trigger: :b\n"
marked-yaml item start = 20 (correct answer is 13)
```

The overshoot is benign and easy to trim: the reported end is the start of the next token, so
walking back over whitespace yields the true item end. `marked-yaml`'s start is displaced by the
length of the item's first key (20 instead of 13) and is unusable. `yaml-rust2` has the same
displacement — its `MappingStart` marker lands after the first key has been scanned.

### 0. The offset unit — an unlisted criterion that would have caused silent corruption

All three crates report **character** indices, not byte offsets. `saphyr-parser`'s own source
contradicts itself: the `Marker::index` field is documented *"The index (in chars) in the input
string"* while its getter says *"Return the index (in bytes)"* (`scanner.rs:64–86`). Measurement
settles it. With `"a: ⌘\nb: end\n"`, where `b` is at byte 7 and character 5:

```
--- offset units (byte answer would be 7, char answer 5) ---
saphyr-parser  Marker::index()      = 5
yaml-rust2     Marker::index()      = 5
marked-yaml    Marker::character()  = 5
```

The damage this would have done, measured on the corpus fixture written for it:

```
--- byte-vs-character slicing over non-ascii.yml ---
scalars:                       33
wrong when treated as bytes:   29
correct after char->byte:      33
first divergence: value="¡Hola! ¿Qué tal? Añádelo aquí."
  raw index slice:  Some("'¡Hola! ¿Qué tal? Añádelo a")
  converted slice:  Some("'¡Hola! ¿Qué tal? Añádelo aquí.'")
```

29 of 33 spans in one file would have been silently truncated — and the owner's real config
contains Spanish accents and `⌘`/`⌥` symbols throughout.

#### 0b. *Which* character? The confirmed counting scheme

"Characters" is not a definition, and the `CharToByte` adapter is built entirely on the answer.
Four schemes are plausible and they give different numbers. `unicode-offsets.yml` separates all
four in a single flow sequence — precomposed `é` (U+00E9), **decomposed** `é`
(U+0065 U+0301), `😀` (U+1F600), then `tail` — and is deliberately **not** normalised
(`xxd` shows `c3 a9`, `65 cc 81`, `f0 9f 98 80` on disk, and `corpus_integrity.rs` fails the
build if any editor "helps"):

```
--- offset counting scheme over unicode-offsets.yml ---
token        reported    bytes  scalars    utf16 graphemes
"é"               274      274      274      274      274
"e\u{301}"        277      278      277      277      277
"😀"               281      283      281      281      280
"tail"            284      289      284      285      283
"after"           290      295      290      291      289
"end"             297      302      297      298      296
```

> **Confirmed: `saphyr-parser` offsets are counts of Unicode scalar values — exactly Rust's
> `char`, i.e. `str::chars().count()`.** Not UTF-8 bytes, not UTF-16 code units, not grapheme
> clusters.

Both endpoints of every token match the scalar-value prediction, and all three rival schemes are
asserted *wrong* wherever they differ (12 such disagreements in the fixture), so the test cannot
pass by coincidence on an ASCII prefix. Consequently `CharToByte` is a
`Vec<usize>` of `source.char_indices()` plus a one-past-the-end sentinel: O(n) to build once per
document, O(1) per lookup, and defined only at Unicode-scalar boundaries. Offsets beyond its
domain must be rejected, not saturated, in the Phase 0b implementation.

### 2. Block scalars — header, indent, chomping, and the end that is *not* exact

**The header sits outside the span.** The span of a block scalar starts on the first content
line, at the block's content-indentation column:

```
--- saphyr literal block span ---
span   63..73 = "one\n  two\n"
col    2
value  "one\ntwo\n"
```

This holds for every header shape, including explicit indentation indicators: with `|2-`, the
`|2-` is outside the span, the span starts at the **declared** indent column (6), and the two
extra columns of an over-indented first line are *inside* the span, because they are content.

**The end overshoots.** `span.end` is not the end of the scalar. It is the position of the next
non-whitespace character (or EOF), so it swallows every trailing blank line *and* the
indentation of whatever comes next — regardless of chomping. Measured over `block-scalars.yml`,
where every entry sits at `matches:` depth so the following key is indented:

```
--- chomping decides the terminal newlines ---
|    chomping=Clip  span="clip line one\n      clip line two\n\n\n    " value="clip line one\nclip line two\n" trivia="\n\n    "
|-   chomping=Strip span="stripped\n    " value="stripped" trivia="\n    "
|+   chomping=Keep  span="kept\n\n\n    " value="kept\n\n\n" trivia="    "
>    chomping=Clip  span="folded clip\n    " value="folded clip\n" trivia="    "
>-   chomping=Strip span="folded strip\n    " value="folded strip" trivia="\n    "
>+   chomping=Keep  span="folded keep\n\n    " value="folded keep\n\n" trivia="    "
|2-  chomping=Strip span="  four-space first line\n      two-space second line\n    " value="  four-space first line\ntwo-space second line" trivia="\n    "
|2+  chomping=Keep  span="  four-space first line\n\n    " value="  four-space first line\n\n" trivia="    "
```

`span` is the reported span text, `value` is what the parser decoded, and `trivia` is the
overshoot the gap scanner must recover. The same fixture reports:

```
block scalars whose reported end overshoots: 11/11
```

Four consequences, all now pinned by assertions:

1. **The reported span always contains *all* the trailing line breaks.** How many of them belong
   to the value — `keep` = all, `clip` = one, `strip` = none — is knowable **only from the
   header**. The parser's `ScalarStyle` cannot distinguish `|`, `|-` and `|+`; all three report
   `Literal`. `saphyr-parser` has an internal `Chomping` enum (`scanner.rs:2709`) but declares
   `mod scanner;` privately in `lib.rs:48` and re-exports only `Marker`, `ScalarStyle`,
   `ScanError` and `Span`, so it is unreachable.
2. **The true content end is reconstructible**, deterministically: trim trailing spaces and tabs
   from the reported span (that removes the next token's indentation unconditionally), then keep
   *all* / *one* / *none* of the remaining trailing line breaks according to the chomping
   indicator. Proof that this is the *right* region and not merely a plausible one: re-decoding
   `source[span.start .. reconstructed_end]` by hand — de-indenting by `Marker::col()` and
   folding for `>` — reproduces the parser's own value byte for byte for **all 31 block scalars
   in the corpus**, with `folded scalars needing the more-indented escape hatch: 0`.
3. **The overshoot is always whitespace.** Scanning stops at the first non-whitespace character,
   so a block-scalar span can swallow blank lines and indentation but **never a comment**. This
   is asserted for every block scalar in the corpus, and it is why the gap scanner can still
   recover every comment (§3) even before trimming.
4. **Content indentation is exact**, from `Span::start.col()`. Subtracting it from the span start
   recovers the true content region: `"  one\n  two\n"`.

The header text itself must be lexed by us, by scanning backwards from the span start to the
preceding line break. This is a bounded, single-line, unambiguous read:

```
--- block styles, values and header text ---
  | reported_style=Literal value="one\ntwo\n" header_from_source="|"
 |- reported_style=Literal value="no newline" header_from_source="|-"
 |+ reported_style=Literal value="kept\n\n" header_from_source="|+"
 >- reported_style=Folded value="fold me" header_from_source=">-"
```

Explicit indentation indicators are likewise header-only:

```
--- explicit indent indicator ---
header     "|2"
start col  6
value      "  indented first line\nback to base\n"
```

Nothing in any API reports "the indicator was 2".

**Blank lines can be scalar content**, and they stay inside the span where they belong:

```
--- blank lines that are block-scalar content ---
block-scalars.yml: interior blank line at byte 1499, inside span 1482..1522
blank-lines.yml: interior blank line at byte 537, inside span 489..565
```

The same holds for multi-line **quoted** scalars, which may also contain a blank line and a
doubled quote. Because the reported span covers the complete quoted token, those blank lines are
inside a leaf span and never reach the trivia scanner:

```
--- blank lines inside multi-line quoted scalars ---
SingleQuoted scalar 745..777, interior blank line at byte 757
DoubleQuoted scalar 894..931, interior blank line at byte 909
multi-line quoted scalars with an interior blank line: 2
```

**Anchors and tags are outside the node span**, in both orders (`!custom &id "text"` and
`&id !custom "text"` both report the scalar span as the six characters of `"text"`), and alias
spans are exact (`*shared_defaults` = 16 characters). So anchor and tag *spelling* is gap
material, as the division-of-labour table assumes.

### 3. Comment positions — nothing, anywhere

Over `comments-everywhere.yml`, which has 14 comment lines in every position the plan names:

```
--- comment exposure ---
comment lines in the fixture: 14
saphyr-parser events:         29 (comment-bearing: 0)
yaml-rust2:                   comment-bearing: 0
marked-yaml node tree:        comment-bearing: 0
```

A source-wide grep confirms it structurally: the string `Comment` does not appear anywhere in
`saphyr-parser`'s or `yaml-rust2`'s or `marked-yaml`'s sources. Comments are discarded in the
scanner, before any event exists. There is no option, feature flag or lower-level API to
recover them. **Comment preservation is entirely our subsystem**, exactly as plan §6.2 warned.

### 3b. What "the gap" means — the frontier definition

The review's first objection was that parser spans normally nest: a mapping's span contains its
key and value spans, so a comment can be *inside* the mapping span while lying *between* two
child spans. Taking the complement of all reported spans would lose that comment; taking the
gaps between leaf spans would keep it.

**Measured answer: `saphyr-parser` spans do not nest.** Its collection events are positional
markers, not extents:

```
--- do non-leaf spans enclose leaf spans? ---
fixtures measured:                         19
non-leaf spans enclosing a leaf span:      0
widest collection marker (a flow bracket): 1
widest document marker (`---` / `...`):    3
```

Block `MappingStart`/`MappingEnd` and `SequenceStart`/`SequenceEnd` are **zero width**; flow ones
cover exactly one bracket character; `DocumentStart`/`DocumentEnd` are zero width or exactly the
three bytes of `---`/`...`; `StreamStart`/`StreamEnd` are always zero width. A collection extent
is obtained by *pairing* a start marker with an end marker, never by reading one span.

So, honestly: **on `comments-everywhere.yml` the naive complement-of-all-spans definition drops
no comment at all.** The predicted failure mode does not occur here.

```
--- frontier definitions on comments-everywhere.yml ---
all spans :  29 spans, 18 gap segments, 15 comments, 16 blanks
leaf spans:  15 spans, 15 gap segments, 15 comments, 13 blanks
bytes covered by all-spans but not leaf-spans: 0
gap segments starting mid-line under the all-spans frontier: 17
corpus-wide, all-spans claims these extra characters: ['-', '.', '[', ']', '{', '}']
```

The two definitions cover *exactly the same bytes*. They are still not interchangeable: the
all-spans frontier chops the gaps into more pieces (18 instead of 15) and the splits land in the
middle of a line, so a per-gap line scan over-counts blank lines (16 instead of 13).

**The real frontier hazard is elsewhere: the block-scalar overshoot.** A `|` (clip) block
followed by blank lines reports a span that swallows them even though clip chomping makes them
document trivia. An untrimmed leaf frontier therefore *loses* them:

```
--- untrimmed vs trimmed leaf frontier on block-scalars.yml ---
untrimmed leaf spans: 21 comments, 55 blank lines
trimmed   leaf spans: 21 comments, 71 blank lines
bytes the untrimmed frontier loses after the clip block: "\n\n    "
```

> **Definition of record for Phase 0b.** The gap frontier is the set of **leaf spans** —
> `Scalar` and `Alias` events only — with **every block-scalar end trimmed** to its true content
> end (§2). Collection markers, document markers and flow brackets are *not* frontier members;
> they fall in the gaps, where the scanner already expects structural punctuation.
>
> Leaf-only is chosen even though all-spans happens to be lossless today, because it is the
> definition that stays correct if a future `saphyr-parser` gives collections real enclosing
> extents — the exact change the review anticipated. Under that change, complement-of-all-spans
> would start silently dropping comments; leaf-only would not.

### 4. Blank-line attribution — recoverable from the gaps

No parser reports blank lines. But the constructive result is that everything we need lives in
the bytes no leaf span claims. Subtracting the trimmed leaf frontier from every valid fixture:

```
--- gap analysis across the valid corpus (trimmed leaf frontier) ---
fixture                                 spans   gaps  comments   blanks
synthetic/anchors-aliases-tags-merge.yml   48     49        10       47
synthetic/blank-lines.yml                  19     19         5       21
synthetic/block-scalars.yml                67     68        21       71
synthetic/comments-everywhere.yml          15     16        15       14
synthetic/flow-collections.yml             43     44         5       27
synthetic/plain-scalar-hazards.yml        149    150        11      118
synthetic/scalar-styles.yml                45     46        17       44
synthetic/variable-chain.yml               84     85        12       80
…
total comments recoverable from gaps: 153
total blank lines recoverable:        667
same, without trimming block spans:   631
```

The 36-blank-line difference between 667 and 631 is precisely the trivia the untrimmed frontier
loses inside block-scalar spans.

And the deliberate runs survive intact:

```
--- blank-line attribution over blank-lines.yml ---
gaps between spans:      18
longest blank-line run:  4
```

This is what makes the hybrid tractable. Our scanner never has to lex YAML. It has to lex the
gaps between leaf spans, where the only things that can occur are whitespace, blank lines,
comments, structural punctuation (`-`, `:`, `[`, `{`, `,`, `---`, `...`), anchors, tags and
block-scalar headers.

### 5. Incomplete input — what a desktop editor actually sees

A desktop editor sees YAML mid-keystroke on every character typed, so "whether loading fails
cleanly, emits misleading partial spans, or panics matters as much as correct spans on valid
YAML". Fifteen hand-written half-states, plus every prefix of every corpus fixture:

```
--- incomplete editor states ---
unterminated double quote                CleanErrorWithLocation  char 5 line 1 col 5
unterminated single quote                CleanErrorWithLocation  char 5 line 1 col 5
half-written flow sequence               CleanErrorWithLocation  char 12 line 2 col 0
half-written flow mapping                CleanErrorWithLocation  char 15 line 2 col 0
transient bad indent                     CleanErrorWithLocation  char 28 line 3 col 3
tab indentation                          CleanErrorWithLocation  char 10 line 2 col 1
empty flow entry                         CleanErrorWithLocation  char 9 line 1 col 9
half-written anchor                      CleanErrorWithLocation  char 3 line 1 col 3
half-written alias                       CleanErrorWithLocation  char 3 line 1 col 3
unclosed nested flow                     CleanErrorWithLocation  char 12 line 2 col 0
block header with a junk indicator       CleanErrorWithLocation  char 9 line 1 col 9
truncated block scalar header            AcceptedWithSpans  8 events
truncated block header with indicators   AcceptedWithSpans  8 events
implicit null value                      AcceptedWithSpans  11 events
a lone sequence dash                     AcceptedWithSpans  7 events
panics: 0  clean errors: 11  accepted: 4

--- truncation sweep ---
prefixes parsed: 21054
accepted:        17821
clean errors:    3233
panics:          0
```

> **`saphyr-parser` never panicked.** Not on any of the 15 hand-written half-states, and not on
> any of the 21 054 prefixes of the valid corpus. Every rejection carries a char index, a line
> and a column, which is enough to drive a UI. This is the single best possible outcome for a
> desktop editor and it is now pinned with `catch_unwind`, so a future release that introduces a
> panic fails the build rather than crashing a user's session.

Two classes of input are **accepted rather than rejected**, and both produce spans that will
mislead naive Phase 0b code:

1. **A truncated block-scalar header** — the user has typed `replace: |` and not yet typed the
   body. The document parses, and the reported span *includes the header*:

   ```
   "replace: |\n"    -> span 9..11  = "|\n"    value "\n"
   "replace: |2-\n"  -> span 9..13  = "|2-\n"  value ""
   "replace: >\n"    -> span 9..11  = ">\n"    value "\n"
   ```

   This is the **only** measured case where the "header is outside the span" rule breaks. The
   backwards header lexer must therefore be guarded: if the span itself already starts with `|`
   or `>`, the block is empty and there is nothing behind it to lex.

2. **Implicit and empty nodes** produce **zero-width** spans:

   ```
   "empty:\n"    -> 2 scalars, 1 of them zero width
   "-"           -> 1 scalar,  1 of them zero width
   "key:\n  :\n" -> 3 scalars, 2 of them zero width
   ```

   A zero-width span owns no bytes, so the colon, trailing spaces and newline around it have no
   unique owner. Phase 0b needs an explicit policy (see "Deferred to Phase 0b/0c" below).

### Two further findings the probes turned up

**The BOM is not handled by anyone, and it is worse than a leak.** With a BOM immediately before
a key, it is absorbed into the first scalar's *value*:

```
BOM immediately before a key -> first scalar "\u{feff}matches"
```

With a BOM before a comment — as in the corpus fixture, and as many editors write — the document
is **rejected outright**, because `\u{feff}#…` scans as a plain scalar rather than a comment:

```
BOM before a comment line -> parse REJECTED
```

Stripping the BOM before parsing, recording that it was there, and writing it back on save is
therefore a correctness requirement, not tidiness.

**CRLF is safe.** A CR counts as one Unicode scalar value, so the character-to-byte table stays
valid and offsets remain exact. 11 plain scalars in `crlf-line-endings.yml` verified byte-exact.

### Corpus-wide parse results

```
totals over 19 fixtures: saphyr=19 yaml-rust2=18 marked-yaml=18
yaml-rust2 rejected  synthetic/duplicate-keys.yml: String("replace"): duplicated key in mapping at byte 508 line 13 column 14
marked-yaml rejected synthetic/anchors-aliases-tags-merge.yml: 8:9: Unexpected definition of anchor
```

Both rejections matter for this product. Duplicate keys occur in hand-edited configs and the
editor must *warn* about them, not refuse to open the file. Anchors are recommended by espanso's
own documentation for shared variable blocks. `saphyr-parser` handles both.

Error reporting on the deliberately invalid fixtures is precise enough to drive a UI:

```
--- error reporting on invalid/ ---
synthetic/invalid/tab-indentation.yml  rejected at char 225 line 5
synthetic/invalid/unclosed-flow.yml    rejected at char 136 line 5
synthetic/invalid/unclosed-quote.yml   rejected at char 171 line 5
synthetic/invalid/undefined-alias.yml  rejected at char 272 line 6
```

---

## Division of labour for Phase 0b

**Frontier definition (build instruction).** The gap scanner's input is the complement of the
**leaf-span frontier**: `Scalar` and `Alias` event spans only, with every block-scalar end
trimmed to its true content end per §2. Collection markers, document markers and flow brackets
are not frontier members. See §3b for why leaf-only rather than complement-of-all-spans.

| Fact the `SyntaxIndex` needs | Source |
|---|---|
| Node tree, nesting, key/value pairing | `saphyr-parser` events |
| Flow-scalar start **and end** | `saphyr-parser` `Span`, converted char → byte — **exact** |
| Block-scalar start | `saphyr-parser` `Span.start` — exact, at the content indent column |
| **Block-scalar true end** | our trim: reported end, minus trailing spaces/tabs, minus the line breaks chomping discards |
| Scalar style (plain / `'` / `"` / `\|` / `>`) | `saphyr-parser` `ScalarStyle` |
| Explicit tags | `saphyr-parser` `Tag { handle, suffix }` |
| Alias spans | `saphyr-parser` (exact, e.g. `*shared_defaults` = 16 chars) |
| Document markers `---` / `...` | `saphyr-parser` (`DocumentStart`/`DocumentEnd` spans are exact, width 3) |
| Flow collection brackets | `saphyr-parser` (start/end events cover exactly one bracket each) |
| Block collection extents | *pair* a `MappingStart`/`SequenceStart` marker with its `End` marker; both are zero width |
| **Byte offsets** | our `CharToByte` table over `char_indices()`, built once per document |
| **Block scalar header, chomping, explicit indent** | our scanner, one line backwards from the span start — **guarded** for the empty-block case where the header is inside the span |
| **Content indent of a block scalar** | `Marker::col()` — no scanning needed |
| **Comments, and which node owns each** | our scanner over the gaps, plus the §6.2 ownership rules |
| **Blank lines and runs of them** | our scanner over the gaps |
| **Anchor names** (`&name`) | our scanner — the parser gives a numeric id only; the spelling is always outside the node span |
| **BOM presence** | stripped and recorded before the parser ever sees the text |

The scanner is a *gap* scanner, not a YAML lexer. It never has to decide what a scalar is; the
parser has already told it. Its entire input is the byte ranges no leaf claimed.

## Deferred to Phase 0b/0c — not evaluation work

The review raised four further concerns. They are **implementation** questions, not questions
about which parser to adopt, and they are tracked in `PROGRESS.md` under "Open risks and
deviations":

- **(a) Flow-collection comment ownership.** In `items: [one, # explanation` / `two]` the comment
  is lexically between two items. Pure value replacement can ignore ownership; delete, move and
  insert cannot. An explicit attachment policy is required before those operations ship.
- **(b) Empty and implicit nodes.** `empty:`, a bare `- `, explicit `? key` / `: value`, and
  compact `- key: value` all create zero-width or shared boundaries with no unique owner
  (measured in §5). Parent and child spans can share a start or an end, leaving syntax that is
  not meaningfully "between" distinct spans.
- **(c) Merge keys and aliases.** `<<` arrives as an ordinary scalar key and aliases are not
  scalar values, so a path resolver that assumes key/value scalar pairs will select the wrong
  event or reject an editable construct.
- **(d) The missing evaluation criterion is replacement-envelope correctness.** Endpoint accuracy
  is necessary but not sufficient. Phase 0c must mutate real documents and assert all three of:
  the selected span corresponds to the requested structural path despite duplicate keys, nested
  sequence mappings, merge keys, aliases, explicit keys and empty values; replacing exactly that
  envelope produces the intended parsed value and remains valid YAML; and every byte outside the
  envelope is identical, including CRLF vs LF, BOM, missing final newline, trailing spaces,
  comments and block-scalar terminal newlines. That is the round-trip property test the Phase 0
  gate already requires.

## Risks accepted

- **`saphyr-parser` is pre-1.0 (0.0.11).** Its API can break between patch releases. Mitigated
  by keeping it behind `crate::syntax` — no other module imports it — and by the 31 tests in
  `tests/parser_evaluation.rs`, which fail loudly if any measured behaviour changes. Vendoring
  is deliberately *not* done now: it creates ownership without eliminating upgrade risk. Fork
  only if an upstream release breaks required behaviour, maintenance becomes unreliable, or a
  parser fix is needed that upstream will not take.
- **The `index()` documentation is wrong.** If a future release "fixes" the getter to actually
  return bytes, `all_three_crates_report_character_offsets_not_byte_offsets` and
  `saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes` both fail
  immediately and the `CharToByte` adapter becomes a no-op. That is the desired failure mode.
- **Block-scalar and collection end overshoot** must be trimmed by us. Covered by
  `saphyr_block_scalar_end_offsets_overshoot_into_trailing_trivia`,
  `every_block_scalar_in_the_corpus_reconstructs_from_span_indent_and_header` and
  `collection_extents_are_usable_in_saphyr_and_broken_in_marked_yaml`.
- **The empty-block-scalar span includes its header.** Only reachable from incomplete input, but
  an editor sees incomplete input constantly. Pinned by
  `a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header`; the Phase 0b header
  lexer must guard its call site.

## Rejected alternatives, restated

`serde_yaml` was not evaluated: it is archived, and structurally wrong for this job because
deserialization discards precisely the information we must preserve. Re-serializing a typed
model is the approach plan §6.2 rejects outright.
