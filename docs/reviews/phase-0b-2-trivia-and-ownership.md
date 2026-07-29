# Review — Phase 0b, aggregate (emphasis on 0b-2 trivia and ownership)

**Reviewer:** Codex (session `019faef5-be0a-7770-978e-a021cbb84a68`)
**Date:** 2026-07-29
**Target:** `crates/espansoconfig-core/src/syntax/trivia.rs` and `ownership.rs` plus
`tests/trivia_scanner.rs`, reviewed against the Phase 0b-1 span layer already committed at
`813f809`.

The mandatory once-per-phase `/goahead` review. Its bottom line was that Phase 0b-2 is a sound
gap-tiling and attribution layer with the critical file-header rule correct, but is **not** yet
sound as the advertised pessimistic safety gate or as a complete source of move/delete
envelopes — "substantive correctness issues, not polish". Phase 0b was therefore held open and
a fix round run before the phase was recorded complete.

Disposition of each finding is tracked in `PROGRESS.md` under "Open risks and deviations".

> One caveat on the reviewer's own evidence: it could not re-run `cargo test`/`clippy` because
> `target/debug/.cargo-build-lock` was held by the orchestrator's concurrent run. The
> orchestrator verified those gates directly instead — 148 tests, clippy and fmt clean.

---

## 1. Ownership rules

**Verdict: The file-header outcome is correct and deterministic, but the four rules are not implemented “verbatim”; inline ownership and non-sequence leading comments extend or weaken the specification.**

- The load-bearing header case works for the normal espanso shape. `starting_after` chooses the root collection, `descend_to_entry` reaches its first key/item, and `is_first_top_level` recognizes either the root or its first child. The `FileHeader` check also precedes blank-line and leading-block attribution, so a generated header cannot become owned by the first match. [ownership.rs:138](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:138) [ownership.rs:167](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:167) [ownership.rs:196](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:196) [ownership.rs:454](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:454)

- Rules can logically overlap, although only one `rule` is emitted. A header followed by a blank line satisfies both file-header and blank-line-separated conditions; a header immediately above a root sequence item satisfies both file-header and leading-block conditions. The fixed precedence—flow, inline, file-header, blank-line, leading—is deterministic and gives the safe result, but the statement that each rule is implemented “verbatim” is too strong. [IMPLEMENTATION_PLAN.md:412](/Users/ccarpio/Developer/espansoConfig/IMPLEMENTATION_PLAN.md:412) [ownership.rs:429](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:429) [ownership.rs:440](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:440) [ownership.rs:460](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:460)

- Rule 3 says “mapping entry,” but the implementation attaches to the nearest non-zero-width node—normally the value scalar, or the key when the value is later/empty. There is no mapping-entry node, only separate `MappingKey` and `MappingValue` children. Thus identical logical entries have different owners depending on presentation. [IMPLEMENTATION_PLAN.md:415](/Users/ccarpio/Developer/espansoConfig/IMPLEMENTATION_PLAN.md:415) [ownership.rs:440](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:440) [node.rs:65](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/node.rs:65) [trivia_scanner.rs:325](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:325)

- Rule 1 is broader in code than in the plan. The plan grants leading comments to sequence items only; the implementation gives any non-header, non-blank-separated leading block to whatever node follows. The test explicitly blesses attachment to a second top-level mapping key. That may be a reasonable additional policy, but it is not literal section 6.2. [IMPLEMENTATION_PLAN.md:412](/Users/ccarpio/Developer/espansoConfig/IMPLEMENTATION_PLAN.md:412) [ownership.rs:454](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:454) [trivia_scanner.rs:370](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:370)

- No comment is left undecided: trailing comments fall back to `TrailingFile`, inline comments without a node fall back to the file, and all other leading blocks end at `LeadingBlock`. [ownership.rs:444](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:444) [ownership.rs:454](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:454) [ownership.rs:476](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:476)

## 2. Ambiguous-case policies

**Verdict: All five policies are deterministic and the tests accurately describe current behavior, but safe move/delete behavior depends on Phase 0c collecting ownership recursively rather than using the current direct-owner accessors.**

- `empty:` plus inline comment behaves as claimed: zero-width nodes are excluded from backward ownership, so both colon and comment resolve to the key. This is sane if Phase 0c treats key and value as one mapping entry; deleting only the value should leave the comment, while deleting the entry must include key-owned trivia. [ownership.rs:124](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:124) [ownership.rs:261](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:261) [trivia_scanner.rs:448](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:448)

- A bare item’s dash resolves forward to its zero-width item; its inline comment first fails backward lookup and then resolves forward on the same line. That is coherent. Phase 0c must still build a physical-line envelope because indentation and the terminating line break intentionally have no owner. [ownership.rs:255](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:255) [ownership.rs:440](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:440) [ownership.rs:480](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:480) [trivia.rs:125](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:125)

- Compact-item dash ownership works: among nodes sharing the post-dash start, the shallower item mapping wins, not its first key. This is the right owner for reorder. [ownership.rs:143](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:143) [ownership.rs:251](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:251) [trivia_scanner.rs:551](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:551)

- Explicit `?`/`:` attribution behaves as claimed and the enclosing mapping is hazardous. Refusal makes the otherwise awkward envelopes sane. [ownership.rs:258](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:258) [ownership.rs:521](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:521)

- Flow-interior comments attach to the innermost flow collection and raise the intended hazard. However, the claim that whole-collection replacement remains legal contradicts the public gate: `is_safely_editable(flow)` returns false when the hazard is on that exact node, and the test asserts that result. This is conservative, but the documented policy is wrong. [ownership.rs:429](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:429) [trivia.rs:366](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:366) [trivia_scanner.rs:629](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:629) [PROGRESS.md:201](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:201)

- Concrete stranding case: a comment after the last value of a sequence-item mapping is owned by that value, not the item. `items_owned_by(item)` and `comments_owned_by(item)` test only direct equality, even though PROGRESS tells Phase 0c to use them as the move/delete source of truth. Moving the item via its span plus directly owned trivia would leave the final inline comment behind, visually transferring it to a different snippet. Phase 0c needs subtree-aware ownership or a real mapping-entry abstraction. [trivia.rs:335](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:335) [trivia.rs:342](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:342) [PROGRESS.md:307](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:307)

## 3. Safety gate and hazards

**Verdict: `is_safely_editable` correctly propagates recorded hazards through the tree, but the hazard set is far too narrow to serve as the advertised pessimistic Phase 0c gate.**

- Only four hazard kinds exist, and collection adds only explicit keys, unclassified trivia, truncated block headers, and flow comments. Anchors, aliases, merge keys, duplicate keys, tags, and multi-document streams are never considered. [trivia.rs:231](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:231) [ownership.rs:514](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:514)

- Anchored definitions and aliases must be refused unless Phase 0c becomes dependency-aware. Editing an anchored node changes every alias’s effective value elsewhere; moving/deleting it can invalidate or retarget references. The index already records `anchor` and `alias_target`, but the safety collector ignores both. [node.rs:150](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/node.rs:150) [index.rs:471](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:471) [ownership.rs:543](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:543)

- Merge keys remain unguarded. They arrive as ordinary scalar keys and aliases as non-scalar values; the existing test proves only that the distinction is observable, not that edits are refused or resolved safely. This contradicts PROGRESS’s statement that Phase 0b path resolution “must” handle them. [syntax_index.rs:1086](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1086) [PROGRESS.md:249](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:249)

- Duplicate keys are parse-valid but compose-ambiguous, yet there is no duplicate detection or hazard. A path such as `matches[0].trigger` cannot safely identify which duplicate the visual model means without a NodeId-based resolver and explicit policy. The fixture is present, but Phase 0b-2’s pinned hazard count is exactly one, proving it is not flagged. [trivia_scanner.rs:74](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:74) [node.rs:58](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/node.rs:58)

- Multi-document streams are recognized but not hazardous. Unless Phase 0c explicitly supports document-scoped paths and patching, they should be refused. There is also a metadata boundary bug: a header before the next document’s `---` targets that document’s first key, but `file_owner` determines the document from the comment’s position, which still lies in the previous document’s range. [ownership.rs:222](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:222) [ownership.rs:492](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:492) [syntax_index.rs:1044](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1044)

- Explicit tags affect scalar resolution and collection meaning, but they merely get attached as movable decoration. Until the visual model understands tagged values, a pessimistic gate should flag them. [node.rs:86](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/node.rs:86) [ownership.rs:276](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:276)

- `UnclassifiedTrivia` with `node: None` disables nothing. `collect_hazards` permits an unclassified item outside every node to carry no node, while `is_safely_editable` discards all node-less hazards with `filter_map`; if those are the only hazards, it immediately returns true for every node. A global unknown byte should instead make the entire document unsafe. [ownership.rs:534](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/ownership.rs:534) [trivia.rs:366](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:366)

## 4. Reconstruction strength

**Verdict: Tiling is stronger than 0b-1’s opaque-gap reconstruction, but reconstruction itself still says nothing about whether a byte received the correct trivia kind or owner.**

- `assert_tiles` proves only contiguity, positive width, gap containment, byte coverage, and reconstruction. A comment mislabeled as `Tag`, a colon attributed to the wrong node, or a dash mislabeled as punctuation still passes every reconstruction assertion. [trivia_scanner.rs:870](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:870)

- The exact aggregate counts add falsifiable information, particularly zero `Unclassified`, but they are not a semantic oracle: two opposing misclassifications can preserve every total. [trivia_scanner.rs:125](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:125)

- There is a concrete uncovered classifier defect. `TriviaKind::Tag` documents support for verbatim tags containing a comma, but `is_tag_char` reuses the anchor-name predicate, which stops at commas. Such a tag is split into `Tag`, punctuation, and unclassified pieces rather than one tag. Current tests exercise tags from the fixture but never the documented verbatim form. [trivia.rs:78](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:78) [trivia.rs:675](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:675) [trivia_scanner.rs:703](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:703)

- The missing assertion is a per-item semantic invariant, ideally pinned corpus-wide: each `kind` must match an independent lexical/context predicate, and each structural owner must have the expected role and relationship. At minimum, every documented token spelling—including verbatim tags—needs exact `(span, kind)` assertions; ownership needs golden `(span, owner role, rule)` assertions rather than only totals.

## 5. Count conventions

**Verdict: The discrepancy explanation is genuine, not a rationalization, although the comment documentation should name both punctuation cases explicitly.**

- The old scan iterates each gap with `str::lines()`, trims the resulting fragment, and counts an empty fragment as a blank line. Therefore the gap fragment containing only the line break after a frontier scalar is counted as “blank,” even though it terminates a content-bearing physical line. [syntax_index.rs:297](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:297)

- The scanner instead recognizes a blank line only at physical line start and only when the entire line lies inside the gap; otherwise a newline is `LineBreak`. That directly explains 688 versus 94. [trivia.rs:481](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:481) [trivia.rs:583](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:583)

- The two missed comments are indeed inline comments whose gap-line fragments begin with punctuation: one after a mapping colon and one after a flow comma. The old scan sees a trimmed line beginning with punctuation, not `#`; the token scanner reaches the later `#`. [comments-everywhere.yml:8](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/corpus/synthetic/comments-everywhere.yml:8) [flow-collections.yml:19](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:19) [trivia.rs:503](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:503)

- The pinned totals are reproducible: 2,687 trivia items, 197 comments, 94 blank lines in 90 runs, one hazard, and zero unclassified for 22 synthetic fixtures. The current test also processes every discovered real file and asserts zero unclassified without hard-coding private counts. [trivia_scanner.rs:42](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:42) [trivia_scanner.rs:125](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:125) [trivia_scanner.rs:145](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:145)

## 6. Readiness for Phase 0c

**Verdict: The byte-span and basic trivia layers are usable, but Phase 0c must not treat the present safety gate or direct-owner APIs as complete replacement-envelope machinery.**

- Add subtree-aware move/delete ownership—or preferably explicit mapping-entry identities—before constructing envelopes. Direct owner lookup is insufficient for punctuation and comments owned by descendants. [trivia.rs:335](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:335) [PROGRESS.md:302](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:302)

- Expand hazards or implement dependency-aware edits for anchor definitions, aliases, merge keys, duplicate keys, multi-document streams, and tags. As written, `is_safely_editable` returning true means only “none of four narrowly defined hazards was found,” not “this edit cannot change meaning elsewhere.” [trivia.rs:231](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:231) [PROGRESS.md:203](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:203)

- Decide whether whole-flow replacement is actually legal. The documentation and gate currently disagree; Phase 0c cannot correctly “consult the gate” while also following the stated policy. [PROGRESS.md:247](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:247) [trivia_scanner.rs:651](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/trivia_scanner.rs:651)

- Fix and test tag lexing before using trivia ownership to move tagged nodes. The scanner’s public contract currently promises more syntax than it recognizes. [trivia.rs:74](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:74) [trivia.rs:684](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:684)

- The Phase 0c gate must test actual mutations, not reconstruction: select the intended structural occurrence, derive an envelope, replace it, reparse, confirm the intended decoded value, and compare all bytes outside the envelope. PROGRESS correctly identifies this as still missing. [PROGRESS.md:245](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:245) [PROGRESS.md:250](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:250)

- Verification evidence is strong but not fully reproducible under this read-only environment. The current compiled Phase 0b-2 binary passes all 18 tests, the other current corpus/parser/span binaries pass their 69 tests, and `cargo fmt --check` is clean. A fresh Cargo test/clippy invocation could not acquire `target/debug/.cargo-build-lock`; therefore I cannot independently reconfirm the stated clean rebuild/clippy result, although the checked-in claim is internally consistent with the test inventory. [PROGRESS.md:256](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:256)

## Top risks for Phase 0c

1. **High likelihood × high damage:** moving/deleting a parent using direct-owner queries strands descendant-owned comments, especially a final inline comment, transferring it to another snippet. [trivia.rs:335](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:335)

2. **Medium likelihood × catastrophic damage:** anchored/aliased or merged data is declared safe even though one local edit can change meaning elsewhere or invalidate references. [node.rs:150](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/node.rs:150)

3. **Medium likelihood × high damage:** duplicate-key and multi-document paths select the wrong structural occurrence because neither is refused nor given an explicit Phase 0c policy. [syntax_index.rs:1044](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/syntax_index.rs:1044) [PROGRESS.md:250](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:250)

4. **Low/medium likelihood × high damage:** node-less unclassified trivia makes no node unsafe, defeating the global “refuse rather than guess” promise. [trivia.rs:367](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:367)

5. **Low likelihood × medium damage:** verbatim tags are mis-tokenized despite being documented as supported. [trivia.rs:78](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/trivia.rs:78)

Overall, Phase 0b-2 is a sound gap-tiling and basic attribution layer, and the critical first-file-header behavior is correct. It is not yet sound as the advertised pessimistic safety gate or as a complete source of move/delete envelopes. I would proceed to Phase 0c only after addressing recursive ownership, semantic hazards, node-less hazards, and the flow-replacement contradiction; those are substantive correctness issues, not polish.

Codex session ID: 019faef5-be0a-7770-978e-a021cbb84a68
Resume in Codex: codex resume 019faef5-be0a-7770-978e-a021cbb84a68
