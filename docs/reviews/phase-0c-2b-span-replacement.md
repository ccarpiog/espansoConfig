# Phase 0c-2b review — span replacement, the hazard gate, and reparse-verify

Adversarial review of the uncommitted Phase 0c-2b working tree, run before the phase was allowed
to close. Verdict: **do-not-accept**. The findings below are reproduced verbatim; their
disposition is recorded in `PROGRESS.md` under "Phase 0c-2b review disposition".

---

## Findings

1. **High — demonstrated byte-fidelity defect: block-to-flow edits replace trivia between the header and content spans.**  
   [edit.rs:728](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:728), [edit.rs:743](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:743), [edit.rs:1111](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1111)

   Concrete counterexample:

   ```text
   source bytes: b"k: |\r\n  body\nnext: 1\n"
   edit:         path "k", value ""
   wrong output: b"k: ''\nnext: 1\n"
   ```

   The header’s CRLF lies between `header_span.end` and `content_span.start`, outside both intended spans, but the combined envelope swallows it and regenerates LF from the body’s line-ending choice. Similarly:

   ```text
   source:       b"k: |   \n  body\nnext: 1\n"
   wrong output: b"k: ''\nnext: 1\n"
   correct:      b"k: ''   \nnext: 1\n"
   ```

   The three header-tail spaces disappear. Verification passes because it trusts this oversized envelope as an authorized replacement.

   Smallest fix: for block-to-flow changes, replace `header_span` with the flow token and delete only `content_span`; retain the header tail and its original line break. Verify replacements against the union of the original header/content spans, not a synthesized header-through-content envelope.

2. **Medium — demonstrated unnecessary refusals: comments do not require deleting or blocking a representable edit.**  
   [edit.rs:731](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:731), [edit.rs:754](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:754), [0c-2b-notes.md:106](/Users/ccarpio/Developer/espansoConfig/docs/decisions/0c-2b-notes.md:106)

   Counterexamples:

   ```text
   source:  b"k: | # why\n  body\nnext: 1\n"
   edit:    k = ""
   result:  Err(CommentOnBlockHeader)
   valid:   b"k: '' # why\nnext: 1\n"
   ```

   ```text
   source:  b"k: old # why\n"
   edit:    k = "one\ntwo\n"
   result:  Err(LineNotFreeForBlockScalar)
   valid:   b"k: \"one\\ntwo\\n\" # why\n"
   ```

   Thus the headline claim that a block-header comment “cannot” survive a style change is false. The second refusal also chooses a block first and refuses instead of using a lossless quoted fallback.

   Smallest fix: use the split replacement above for block-to-flow edits; if a newly selected block cannot own the line, rerender in a non-plain flow context, producing double quotes when necessary.

3. **Medium — demonstrated architectural limitation: verification is independent of splicing, but not of span authorization.**  
   [edit.rs:1094](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1094), [edit.rs:1160](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1160), [patch_edit.rs:127](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_edit.rs:127)

   Finding 1 passes verification: the planner declares the CRLF/spaces part of the replacement, and both production verification and acceptance tests accept that declaration. The verifier can catch:

   - malformed splice arithmetic;
   - invalid YAML according to saphyr;
   - loss of the path;
   - a value different from the caller’s request;
   - disagreement between the local decoder and saphyr.

   It structurally cannot catch:

   - an oversized or wrong intended span;
   - both decoders sharing the same span/index defect;
   - YAML 1.1/espanso disagreement accepted by the YAML 1.2 substrate;
   - resolving the wrong-but-equivalent path target if both planning and verification make the same addressing mistake.

   Smallest fix: derive allowed spans independently from immutable syntax facts and reject every replacement not wholly contained in those exact spans.

4. **Low — demonstrated test/documentation defect: the claimed per-fixture pinning does not exist.**  
   [patch_edit.rs:421](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_edit.rs:421), [PROGRESS.md:189](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:189)

   The acceptance test aggregates all synthetic fixtures into one `Tally`; it pins totals per outcome category, not per fixture or per scalar. Two fixtures—or two scalars within one category—can exchange eligibility without changing any assertion. The separately pinned anchor/duplicate/flow counts do not constitute the advertised complete per-fixture split.

   The byte assertion is also partly self-fulfilling: it rebuilds the candidate using `PatchedDocument::replacements()` and uses an envelope derived from the same `ScalarPresentation` policy as production.

   Smallest fix: pin `(fixture, node span, replacement class, outcome)` or at least a complete per-fixture tally, and independently assert replacements stay inside the exact header/content-span union.

5. **Low — suspected robustness defect: `quoted_span()` silently restores the known-bad span on lexer failure.**  
   [index.rs:676](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:676), [index.rs:692](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:692)

   I found no current accepted YAML counterexample. The forward lexer correctly handles escaped backslashes, odd/even backslash parity before `"`, doubled single-quote runs, multiline quotes, quoted flow values, and quoted keys. However, every failed precondition returns the original overshooting span—the exact span already shown capable of swallowing comments. A substrate behavior change would therefore fail silently.

   Smallest fix: make quoted-span derivation fallible and reject the index with an invariant violation when a quoted event does not begin and end with a lexable quoted token.

## Categories cleared

- **Logical value corruption:** examined block chomping, indentation indicators, empty/whitespace-only values, terminal spaces, and trailing `\n` runs. I found no edit that returns success while saphyr reparses to a value different from the request; the value comparison prevents that. YAML 1.1 compatibility remains outside this proof.
- **R17 flow legality:** examined multiline, delimiters, quotes, backslashes, controls, and bracket-breaking values. I found no flow-interior edit that emits invalid YAML or escapes its collection. Plain-scalar requoting is contained inside the token.
- **Gate/API bypass:** examined re-exports and the full `PatchedDocument` API. No writable candidate bypass was found; fields and construction remain private and there is no `Deref`, conversion, or unchecked constructor.
- **Batching:** adjacent spans are correctly allowed; genuine intersections and duplicate block header/content replacements are rejected; zero-width targets are refused before batching. Multi-document edits are refused by the document-level hazard, so cross-document overlap behavior is not exercised.
- **BOM, no final newline, terminal EOF spaces, tabs, and non-ASCII byte offsets:** no additional defect found. Splicing and comparison operate in UTF-8 byte coordinates, and the BOM remains outside resolved scalar spans.

**Verdict: do-not-accept.**

Codex session ID: 019fb032-cf61-7c23-996e-dfb5f09dbb9d
Resume in Codex: codex resume 019fb032-cf61-7c23-996e-dfb5f09dbb9d
