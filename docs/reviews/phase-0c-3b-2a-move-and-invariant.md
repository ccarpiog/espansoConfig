## Review result

The stronger invariant is not sound as the production safety boundary. The current engine usually copies bytes correctly, and the acceptance sweep adds stronger checks, but the three advertised production properties can jointly certify presentation corruption. One such weakness is exercised deliberately by the EOF rotation.

### High — the three properties do not prove that the carried bytes were copied verbatim

[`verify()`](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:4335) runs line conservation, intended-order comparison, and the decoded-tree walk. It never verifies that the insertion text equals the bytes removed from the source. That stronger assertion exists only in the external sweep’s [`check_the_arrival_is_the_departure()`](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_move.rs:1032).

Concrete counterexample:

```yaml
matches:
  - trigger: ':a'
    # first
    # second
    replace: x
  - trigger: ':b'
    replace: y
```

Move item 0 after item 1, but have a defective engine swap `# first` and `# second` in the carried text.

All production checks accept:

- Line contents and terminators are the same multisets.
- The item digests and intended sequence order are unchanged because comments are absent from the digest.
- The lockstep tree is identical.
- Neither comment is file-owned, so `file_comments_survive` adds no protection.
- `bytes_outside_the_replacements_match` authorizes the insertion text supplied by the defective planner.

The same blind spot permits:

- swapping LF and CRLF terminators among carried lines while preserving the terminator multiset;
- moving blank lines between strip-chomped block scalars when decoded values remain unchanged;
- exchanging indentation-bearing comment lines without changing the YAML tree;
- deleting an ownership blank line while relocating that line elsewhere, thereby re-attributing a comment without losing its text.

The notes’ C1/C2 mutations are real in the limited sense that the described defects are caught, but they are weak mutations: they alter multiset counts. A permutation-preserving rewrite is not tested. C5 actually confirms the production hole: the notes acknowledge that an extra blank line passed the guard, line conservation, tree walk, and byte check; only a test-side hull bound caught it ([notes §6.2](/Users/ccarpio/Developer/espansoConfig/docs/decisions/0c-3b-2a-notes.md:493)).

The production verifier needs the equivalent of `check_the_arrival_is_the_departure`, based on independently bounded source runs, with any permitted EOF transformation stated narrowly. Presentation-sensitive trivia ownership also needs comparison if re-attribution is forbidden.

### High — EOF rotation violates D2p and changes an untouched destination line

At an unterminated EOF, [`plan_move()`](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:2752) removes the carried item’s trailing break and prefixes it to the inserted item. That break now terminates the previously unterminated destination line.

Concrete byte shape:

```yaml
matches:                 # LF
  - trigger: ':a'        # CRLF
  - trigger: ':b'        # LF
    replace: tail        # EOF, no terminator
```

Move item 0 after item 1. The resulting `replace: tail` line receives the moved item’s CRLF, while the moved `trigger: ':a'` line becomes unterminated.

This silently changes the presentation of an untouched destination line and may impose a foreign line-ending style on it. Nevertheless:

- contents are conserved;
- the terminator multiset remains `{LF, LF, CRLF, none}`;
- decoded values and tree shape are unchanged;
- the intended item permutation is correct.

Therefore all three properties certify it.

This is not satisfaction of D2p “a fortiori.” D2p expressly requires the break already in use where the bytes land, or a refusal when no such evidence exists ([PROGRESS.md](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:890), and the move-specific instruction at [line 1347](/Users/ccarpio/Developer/espansoConfig/PROGRESS.md:1347)). Global byte conservation does not preserve which unedited line owned a terminator.

The safe answer under the recorded decision is to refuse this EOF move unless an independently defined local destination ending can be copied. If rotation remains desired, it needs a new explicit decision acknowledging that an untouched line’s terminator is rewritten; it cannot be presented as verbatim relocation.

### Medium — there are more than three block-scalar seams when an envelope has holes

The three checks cover source closure, arrival start, and arrival end ([`plan_move()`](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:2788)). They do not cover joins created when multiple removal runs are concatenated at the destination.

Concrete shape:

```yaml
matches:
  - trigger: ':a'
    vars:
      x: |
        body

      # file-owned; preserved at the source

        # leading comment owned by y
      y: one
    replace: done
  - trigger: ':b'
    replace: done
  - trigger: ':c'
    replace: done
```

Move item 0 after item 2.

The source envelope is split around the file-owned comment and its adjacent blank runs. At the destination, concatenating the runs places the column-eight `# leading comment` immediately after the block body, where it becomes content of `x`. None of the named seams examines this internal run-to-run join.

The decoded-tree verifier should reject the candidate generically, so this is not silent corruption today. But it disproves the claim that three are the complete set of seams and means the planner lacks the promised typed refusal. The right model is three external seams plus one internal seam for every adjacent pair of carried runs.

For the three external seams themselves, the shared indentation/adjacency condition is appropriately narrowed and the safe/refused fixture pairs are useful.

### Medium — the acceptance suite is stronger than the invariant it claims to establish

The test header correctly lists “arrival equals departure” as its first property ([`patch_move.rs`](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_move.rs:22)), and every successful corpus move checks it. The decision record, however, describes the production invariant as the three line/order/tree properties, while production omits this byte-relocation oracle.

Consequently, the 1,780 synthetic and 126 real applications establish that the current implementation copied bytes on those attempts. They do not establish that `PatchedDocument` cannot be produced by a future defective planner that rewrites or over-carries trivia. For an architectural gate, the stronger test-only property belongs in `verify()`.

The mutation experiments are documented historical experiments, not retained mutation tests. The repository therefore cannot reproduce C1–C5 automatically. Direct unit tests show that individual oracle functions can fail, but not that the complete verifier rejects the adversarial mutations above.

### Low — `MoveMustBeTheOnlyEditInItsBatch` is a verification workaround, not an ordering invariant

The restriction at [`apply_edits()`](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1783) does not conceal a demonstrated splice-order bug. A single move still exercises descending application of its deletion runs and insertion.

It does, however, avoid making move verification compositional. For example, this safe request is refused:

```yaml
matches:
  - trigger: ':a'
    replace: old
  - trigger: ':b'
    replace: unchanged
```

Batch: move item 0 after item 1 and change that moved item’s `replace` value to `new`.

The stated circularity argument is unconvincing: verifying a caller-requested scalar value against the caller’s intended value is already how scalar edits work. A combined expectation can apply the permutation and exempt precisely the independently verified rewritten node, as field batching already does.

Thus this is a defensible phase-scope restriction, but not a fundamental invariant. It also means `OverlappingEdits` is not tested against conflicts between a move and another edit—the restriction rejects such batches before overlap analysis.

### Coverage holes

- `shares_a_line` is honestly labelled and reachable through compact nested sequences such as `outer[0][1]` in `- - first`. The direct unit test is adequate for the implementation branch, though weaker than corpus coverage.
- R23-for-moves is also reachable. For example, have item 0 end in a block scalar and item 1 contain a blank-separated file-owned comment indented at the block’s body column; moving item 1 away leaves the comment under item 0’s block. The shared removal-envelope call should refuse it, but R20’s standing rule calls for a corpus fixture on both sides rather than continued reliance on removal coverage.
- The quoted-scalar/inline-comment hole does not invalidate the current move implementation: `SyntaxIndex::quoted_span` has direct regression coverage, and the substrate overshoot has a focused test. But deleting the discovered fixture shape to preserve a corpus test whose title claims exactness is backwards. The corpus test should classify quoted overshoots separately and the fixture should remain.
- `patch_structure.rs`’s block-body `#` mistake affects only its independent R23 derivation today. It does not invalidate this move phase because `patch_move.rs` fixed its own version and no current structural fixture combines the two required shapes. “Next round” is reasonable, but it should be closed before treating future structural sweep counts as authoritative.

### Scope and strongest failed attack

“Copied verbatim without re-indentation” is safe only for the implemented operation: movement between positions of the same block sequence. Valid items in one block sequence share their structural indentation, and deliberately unusual comment indentation is preserved. Moving between differently indented or nested sequences is not expressible by `ItemMove`; that future operation must re-indent or refuse and cannot reuse these proofs unchanged.

The strongest attack that failed was changing a neighbouring block scalar’s decoded value at any of the three external joins. The lockstep tree walk does catch that independently, and the column-five/column-two fixture exercises both sides of each external condition. The failure is in presentation-only corruption, terminator ownership, internal run joins, and trivia re-attribution—the exact areas decoded-tree equality cannot observe.

No repository files were modified, no web access was used, and I did not inspect or reproduce private real-corpus content.

Codex session ID: 019fb3da-2cf3-7401-aeac-8eac69befb53
Resume in Codex: codex resume 019fb3da-2cf3-7401-aeac-8eac69befb53
