## Findings

### 1. Major — the envelope still deletes file-owned layout that is not adjacent to a file comment

Concrete document:

```yaml
a:
  x: 1

  y: 2
b: 3
```

Remove `a`.

The engine derives the contiguous hull and punches out only regions associated with `file_comments()`; the unrelated blank run remains in a deletion run ([edit.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:1973), [edit.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:2275)). It produces:

```yaml
b: 3
```

The blank line is classified layout with no node owner. Under the product premise—and the phase’s own justification that blank lines are file layout—it should survive byte-for-byte:

```yaml

b: 3
```

The contradiction is especially visible because the implementation preserves a blank run touching a file comment as “layout the user chose,” but deletes the identical unowned blank run when no comment touches it.

The ownership/envelope layer should have caught this by deriving deletions from positively entry-owned runs, or by punching out every unowned blank run and then applying the same semantic-hazard checks used for preserved comments. Verification does not see the loss because it checks node leaves and file comments, not unowned trivia. Worse, the external oracle expressly requires every gap to contain a file comment, so it codifies the omission ([patch_structure.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/patch_structure.rs:601)).

This also disproves the claim that the two halves of `StructuralGuard` say the runs are “exactly the entry”: all frontier leaves are covered and no foreign node is touched, yet file layout is deleted.

### 2. Minor — `RemovalWouldExtendABlockScalar` refuses demonstrably safe removals because it ignores indentation

Concrete document:

```yaml
replace: >
  body
vars:
  first: one
# keep this file comment

  second: two
tail: 3
```

Remove `vars`.

The engine sees a preserved region and a folded block scalar ending immediately above the removal hull. Because `block_scalar_ending_above` deliberately performs no column comparison, it returns `RemovalWouldExtendABlockScalar` ([edit.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:2008), [edit.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:2382)).

But the preserved comment is at column zero, while the folded scalar body is indented. After removal:

```yaml
replace: >
  body
# keep this file comment

tail: 3
```

The comment cannot become block content, and `replace` retains its value. The removal should apply.

The planner’s semantic-hazard layer should compare the preserved region’s first nonblank line column with locally observed block-body indentation. Refusal remains appropriate when the comment is indented to the body column or farther.

The new fixture covers only a literal `|` scalar with a same-column comment ([fixture](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml:14)). It does not cover this safe low-indentation case. The decision record also admits that neither corpus pairs an entry-owned leading comment block with an interior file comment; that combination is another missing run-boundary construct.

## Requested concerns already handled

- Run ordering/disjointness: handled. Preserved regions are sorted and merged, and `runs_between` emits ascending nonempty complements.
- Folded `>` absorption: handled by `presentation.style.is_block()`; the defect is over-refusal when indentation proves absorption impossible.
- Reparenting under another mapping or sequence item: handled for file-owned comments because the ownership-defining blank run below is retained. Block-scalar lexical absorption is the exceptional case.
- Empty mapping values: handled. Single removal of the last entry and batches that collectively empty a mapping are refused.
- First/last document position: handled; an indented standalone comment remains a comment.
- Flow collections: handled by the structural-edit gate.
- `---`/`...` adjacency: I found no path by which an entry hull crosses a document marker; reparsing remains a backstop.
- `EnvelopeMissesTheEntry`: real for node tokens, but not the claimed exactness proof; finding 1 shows its trivia blind spot.
- `RemovalWouldDeleteAFileComment`: the unreachable argument is sound for the current derivation—whole comment lines are punched out, clamped, sorted and merged—and the disabling experiment demonstrates the assertion is live rather than merely unreached.
- Line endings: handled. Removal writes no line ending and preserves each kept comment line’s original terminator, including mixed CRLF/LF sites.
- Batch interaction: handled. Every run enters one flat sorted replacement list, so overlaps involving later runs are rejected before splicing.

No files were modified.

Codex session ID: 019fb338-ad4e-7753-a61a-d9231b845c39
Resume in Codex: codex resume 019fb338-ad4e-7753-a61a-d9231b845c39
