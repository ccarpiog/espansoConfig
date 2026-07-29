# Review — Phase 0b-1, the byte-accurate span layer

**Reviewer:** Codex (session `019fae9e-7226-7d73-b2dd-c6a0b5ce902e`)
**Date:** 2026-07-29
**Target:** `crates/espansoconfig-core/src/syntax/` — `CharToByte`, `DocumentPreamble`,
`SyntaxIndex`, block-scalar trimming, the gap frontier — plus `tests/syntax_index.rs`.

Commissioned because the diff (~3 200 lines over 11 files) tripped the `/goahead` per-step
review gate, and because the frontier design is the foundation Phase 0b-2 and 0c build on.

The verdicts below are the reviewer's verbatim reply. Disposition of each finding is tracked in
`PROGRESS.md` under "Open risks and deviations".

---

## 1. Block-scalar trim derivation

**Verdict: Correct for the exercised corpus, but not generally correct; terminal horizontal whitespace and incomplete/empty blocks are concrete counterexamples.**

- The six ordinary header forms are recognized: `match_header` accepts `|` or `>`, one indentation digit, and one chomping indicator in either order. The synthetic matrix exercises clip/strip/keep for both literal and folded styles, plus explicit indentation. [block.rs:62](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:62) [syntax_index.rs:342](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:342)

- **Concrete defect: genuine trailing spaces or tabs at EOF are discarded.** `content_len` always applies `trim_end_matches([' ', '\t'])`, assuming the final horizontal whitespace belongs to the next token’s indentation. At EOF—especially a block scalar with no final newline—there is no next token, so trailing horizontal whitespace can be scalar content. This affects all chomping modes before their newline handling even runs. [block.rs:179](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:179) [block.rs:180](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:180)

- The same ambiguity exists for tabs. YAML indentation tabs are rejected by the project’s invalid corpus, but tabs occurring after the required indentation are scalar data; the unconditional trim cannot distinguish those from overshot trivia. Header trailing tabs are separately accepted by the lexer. [block.rs:97](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:97) [block.rs:180](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:180)

- CRLF handling is sound for the tested cases: clip preserves the two-byte `\r\n`, strip removes all terminal CR/LF bytes, and keep retains them. This is directly tested for all three chomping modes. [block.rs:181](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:181) [block.rs:360](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:360)

- A normal final block without a trailing newline works only when its last meaningful byte is non-whitespace: `without_breaks.len()` then equals the source end. Nested-sequence placement does not itself alter the calculation; the calculation examines only the reported scalar interval. [block.rs:179](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:179) [block.rs:262](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:262)

- **Concrete defect on incomplete/empty blocks:** when the reported span begins with its own header, `content_start` is set immediately after the indicator text—not after the header line. Thus a truncated `replace: |\n` treats the header’s own line break as content. Existing truncated-header tests check only header detection and reconstruction, not equality with the parser’s decoded value. [block.rs:264](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:264) [block.rs:268](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:268) [syntax_index.rs:458](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:458)

- Header-location failure is silently converted into “use the reported span unchanged.” For a valid-but-unhandled block form or future parser behavior change, that preserves the known overshoot into blank lines and the next node’s indentation instead of rejecting the index. [index.rs:420](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:420) [index.rs:434](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:434)

- The corpus proof is narrower than it appears. The decoder falls back from the recorded indentation to `trim_start_matches(' ')`, which can conceal an incorrect indentation boundary; folded blocks with more-indented lines are explicitly unsupported and absent from the corpus. [syntax_index.rs:1003](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1003) [syntax_index.rs:1011](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1011) [syntax_index.rs:1026](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1026)

## 2. `leading_content_start()`

**Verdict: The basic trigger is reasonable for empty physical lines, but it does not establish a consistent replacement envelope and is too broad in what it calls whitespace.**

- The correction properly avoids ordinary blocks: it requires at least one additional `\n` between the header-line terminator and the reported start, so mere indentation before the first body character does not trigger it. [block.rs:225](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:225) [block.rs:237](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:237)

- CRLF works because `body_start` is placed after `\n`; the preceding `\r` remains part of the already-skipped header terminator, while subsequent `\r\n` pairs remain in `between`. Bare-CR line endings are not handled because the function searches only for `\n`, despite the header lexer treating either CR or LF as a line separator. [block.rs:130](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:130) [block.rs:230](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:230)

- **The resulting content-span convention is inconsistent.** An ordinary block starts at the first content character, leaving its first-line indentation in the gap. A block with leading empty lines starts immediately after the header newline and therefore includes blank-line indentation and the eventual first non-empty line’s indentation. A future emitter cannot treat both spans identically without knowing which convention was used. [block.rs:233](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:233) [block.rs:268](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:268) [block.rs:374](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:374)

- The test covers only completely empty leading lines. Its decoder special-cases physical line zero as already de-indented, so a leading blank line containing spaces or tabs would retain those bytes in the reconstructed value rather than normalize its indentation. [syntax_index.rs:419](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:419) [syntax_index.rs:1006](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1006)

- `char::is_whitespace` accepts substantially more than YAML’s indentation and line-break characters. If the parser skips a Unicode whitespace character that YAML does not consider ordinary separation, the correction can absorb it as leading blank content. A byte-level test should constrain the accepted set explicitly to the line-ending and horizontal-indentation bytes intended here. [block.rs:237](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:237)

- Reconstruction does not validate this start correction: segments will reconstruct regardless of whether the bytes are classified as a leaf or adjacent gap. The useful assertion is the decoder comparison, but its indentation fallback weakens that proof. [frontier.rs:72](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/frontier.rs:72) [syntax_index.rs:983](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:983)

## 3. Gap frontier

**Verdict: Sound as a document partition, but insufficient by itself for zero-width-node ownership and future structural edits.**

- Excluding zero-width leaves is correct for gap enumeration: they claim no bytes and would only split a physical gap at an arbitrary point. The nodes remain available through `zero_width_leaves`, including their exact byte coordinate and structural role. [frontier.rs:22](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/frontier.rs:22) [index.rs:120](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:120)

- Therefore an `empty:` value or bare sequence item can still supply an insertion coordinate. Exclusion does not make insertion impossible, provided Phase 0c consults the arena rather than only `frontier()`. [index.rs:126](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:126) [node.rs:172](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/node.rs:172)

- It does leave comment ownership ambiguous. For an empty value followed by an inline comment, the colon, spaces, comment, and newline occupy one gap shared by the key, zero-width value, and mapping. The current code explicitly postpones that ownership policy; the tests only count zero-width nodes and reconstruct the bytes. [index.rs:120](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:120) [syntax_index.rs:720](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:720)

- Compact mappings and explicit `?`/`:` forms have the same problem for delete/move envelopes: punctuation is deliberately gap material, while collection extents are derived only from children. The tree identifies the relevant nodes, but neither frontier membership nor collection spans assign ownership of `-`, `?`, `:`, or adjacent comments. [frontier.rs:8](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/frontier.rs:8) [index.rs:388](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:388)

- The reconstruction property is necessary but nearly tautological: `segments` inserts each frontier span and defines every interval between them as a gap. Any ordered, disjoint, in-bounds frontier reconstructs, even with semantically wrong boundaries. [frontier.rs:68](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/frontier.rs:68) [syntax_index.rs:844](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:844)

## 4. Coordinate-system consistency

**Verdict: The BOM conversion path is correct and tested, but enforced through convention and final slice validation rather than strong types.**

- Parsing is performed on the suffix returned by `DocumentPreamble::detect`; the conversion table is built over that stripped body, while `base` records the original-document byte offset. [index.rs:190](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:190) [preamble.rs:38](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/preamble.rs:38)

- Every event endpoint is converted from a body-relative character offset to a body-relative byte offset and then shifted by the BOM width. Block layout receives that already-shifted span together with the original source, so its arithmetic remains consistently original-relative. [char_to_byte.rs:64](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/char_to_byte.rs:64) [index.rs:235](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:235) [index.rs:420](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:420)

- Parse-error markers use the same conversion and base shift. An out-of-domain error marker becomes `byte_index: None`, as documented, rather than producing a wrong original-relative coordinate. [index.rs:219](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:219) [error.rs:50](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/error.rs:50)

- The invariant is clearly stated module-wide and is pinned by a BOM test that requires the first scalar to start at byte 3 and slice correctly. [mod.rs:20](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/mod.rs:20) [index.rs:667](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:667)

- It is not type-guarded: both body-relative and original-relative positions are plain `usize`, and public `CharToByte::span` accepts an arbitrary `base`. `DocumentPreamble::detect` documents its suffix-length equation but does not assert it. Final construction only verifies that each resulting span slices the original source. [char_to_byte.rs:77](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/char_to_byte.rs:77) [preamble.rs:34](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/preamble.rs:34) [index.rs:549](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:549)

## 5. `CharToByte` rejection semantics

**Verdict: Out-of-domain event offsets propagate correctly, but the broader “never clamped” claim is false for inverted spans.**

- For normal parser events, either endpoint being outside `0..=char_len` returns `OffsetOutOfDomain`, and `on_event` propagates it through `?` as `SyntaxError::Offset`. There is no offset clamp on this path. [char_to_byte.rs:54](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/char_to_byte.rs:54) [index.rs:235](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:235) [error.rs:38](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/error.rs:38)

- Parse-error coordinates deliberately swallow an out-of-domain conversion with `.ok()` and expose `None`. This is acceptable because parsing is already failing, but it is an explicit swallowed conversion rather than rejection of the whole call. [index.rs:219](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:219) [error.rs:52](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/error.rs:52)

- **Concrete contradiction:** an inverted character span is silently collapsed to zero width using `end.max(start)`. The documentation explicitly calls this clamping. Thus the claimed “out-of-domain offsets are rejected, never clamped” is accurate only for domain overflow, not malformed endpoint ordering. [char_to_byte.rs:71](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/char_to_byte.rs:71) [char_to_byte.rs:85](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/char_to_byte.rs:85)

- That also makes `InvariantViolation::InvertedSpan` effectively unenforced on the parser conversion path: `ByteSpan::new` never sees the inversion after `max`. [error.rs:107](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/error.rs:107) [char_to_byte.rs:85](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/char_to_byte.rs:85)

## 6. Silent-corruption risk

**Verdict: The main danger is not BOM or Unicode conversion; it is treating corpus-supported block boundaries and ownership-free gaps as ready replacement envelopes.**

- Phase 0c must not equate `Node::span` with a safe replacement envelope until the block-start convention, terminal whitespace, and zero-width ownership cases are resolved. The current documentation already distinguishes content and header edits, which makes incorrect content boundaries directly write-relevant. [mod.rs:174](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/mod.rs:174) [node.rs:143](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/node.rs:143)

- The claimed runtime counts are reproducible in this checkout: 19 synthetic and 13 real files reconstructed; 758 synthetic and 1067 real scalar nodes passed; 31 synthetic and 87 real block scalars decoded. But most exact numbers are only accumulated and printed, not pinned: synthetic reconstruction asserts `>= 19`, scalar fidelity asserts only `> 500`, synthetic block decoding asserts `>= 30`, and the real tests assert no failures without asserting 13/1067/87. [syntax_index.rs:129](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:129) [syntax_index.rs:59](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:59) [syntax_index.rs:298](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:298) [syntax_index.rs:330](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:330)

- “Scalar spans slice exactly” overstates the assertion: empty scalars automatically pass; multiline plain scalars pass merely by containing a newline; double-quoted scalars check only their delimiters; block scalars check only that the span does not begin with the header. [syntax_index.rs:919](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:919)

# Ranked failure modes

1. **Leading-empty-line block replacement corrupts indentation — high likelihood × high damage.** Its span uses a different start convention from ordinary blocks, so a uniform content emitter can under-indent or duplicate indentation and change YAML structure. [block.rs:268](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:268)

2. **Terminal spaces/tabs in a block scalar are misclassified as trivia — medium likelihood × high damage.** Editing the recorded span can leave stale scalar bytes behind or change the decoded replacement value. [block.rs:179](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:179)

3. **Header-location failure publishes the known-overshooting span — low/medium likelihood × catastrophic damage.** A replacement could consume trailing blank lines and indentation belonging to the next YAML node. [index.rs:420](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:420)

4. **Zero-width/shared-boundary deletion or movement claims the wrong comment/punctuation — medium likelihood × medium/high damage.** Insertions remain possible, but delete/move envelopes need an explicit ownership policy. [index.rs:120](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:120)

5. **Incomplete block header exposes a false content newline — medium likelihood in a live editor × medium damage.** Reconstruction passes while the presentation disagrees with the decoded empty value. [block.rs:264](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/block.rs:264)

6. **A future malformed/inverted substrate span is silently collapsed — very low likelihood × high damage.** The index remains apparently valid at a fabricated zero-width coordinate. [char_to_byte.rs:74](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/char_to_byte.rs:74)

7. **BOM/Unicode coordinate drift — low likelihood × high damage, currently well controlled.** Conversion is centralized, errors propagate for event offsets, final spans must slice, and BOM/non-ASCII tests directly exercise the path. [index.rs:190](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:190) [index.rs:549](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:549)

Codex session ID: 019fae9e-7226-7d73-b2dd-c6a0b5ce902e
Resume in Codex: codex resume 019fae9e-7226-7d73-b2dd-c6a0b5ce902e
