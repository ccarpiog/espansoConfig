# Phase 2b-2c — design consult, taken before the sequence-item primitives were written

**Consulted:** Codex (`codex:codex-rescue`), 2026-08-02, before any line of 2b-2c existed.
**Question put:** the sub-phase cut for 2b-2c, the shape of an item-insert primitive, the empty and
flow sequence cases, the relationship between item removal and `ItemMove`, the last-item case, and
the least invasive whole-text path through `save_document`.

The brief was self-contained — Codex was told not to read the repository or the web — so this is a
judgement about the *design as described*, not an audit of the code. Everything below is Codex's
reply, verbatim, followed by this project's disposition.

---

## The reply, verbatim

### Q1 — the split

The three sub-phases are the right cut.

- **2b-2c-1:** `InsertItem` and `RemoveItem` together. They share sequence layout, envelope, indentation, comment ownership, and boundary-join machinery. Separating them would duplicate design validation without isolating much risk.
- **2b-2c-2:** `create_match` and `delete_match`.
- **2b-2c-3:** `save_raw_document`.

Keep raw save last. You may introduce the internal `SaveRequest` enum earlier as a mechanical preparation, but do not activate `WholeText` until its validation and concurrency behavior have dedicated tests.

### Q2 — `InsertItem`

Choose **(a)**:

```rust
InsertItem {
    sequence: DocumentPath,
    after: Option<usize>,
    fields: Vec<(String, String)>,
}
```

Constrain it to one new **block-style mapping item containing scalar values only**. Rust validates keys, rejects duplicates, requires at least one field, and uses the scalar codec for every value. Suggested errors:

- `InsertedItemHasNoFields`
- `DuplicateInsertedField`
- `InvalidInsertedFieldKey`
- `UnsupportedInsertedItemShape`

Do not accept caller-supplied YAML: that moves spelling, indentation, structure, and injection risk into the untrusted frontend. A `MatchSeed` puts espanso-specific semantics into the generic patch engine and makes future sequence-item users require new core types.

Do not weaken the global rule to "not inside an existing node's interior"; that wording permits too much. State a narrow exception:

> No generic primitive may synthesize a collection. `InsertItem` may synthesize exactly one new flat block-mapping sequence item with scalar fields, at a sequence-item boundary.

Also explicitly permit `InsertItem` to promote an eligible implicit-null mapping value into its first block-sequence item; otherwise `matches:` cannot be targeted as a sequence.

### Q3 — indentation and empty sequences

1. **Bare `matches:` / implicit null:** allow promotion when the value is truly absent and trivia ownership is unambiguous. Derive:

   - mapping-key indentation from the `matches:` line;
   - indentation step from block children in the same surrounding mapping, then the document's dominant indentation step;
   - if the document has no evidence, use the renderer's documented default of two spaces;
   - line ending from the document's dominant line ending.

   Preserve inline comments. If inserting would require deciding whether a following standalone comment belongs to the absent value or the next entry, refuse with `ImplicitNullSequenceHasAmbiguousTrivia`.

2. **`matches: []`:** refuse with `FlowSequenceInsertionUnsupported`. Converting flow to block rewrites an existing collection's presentation.

3. **Non-empty flow sequence:** same refusal: `FlowSequenceInsertionUnsupported`.

4. **Inconsistent item indentation:** refuse with `InconsistentSequenceIndentation`. Do not select a "majority" spelling.

### Q4 — `RemoveItem`

Yes: implement it as the source/lift half of `ItemMove`, with no landing. The envelope derivation and source-gap join must be literally shared code.

Comments owned by the removed item are removed with it. They must not be left as misleading orphan comments. Blank runs owned by its envelope also disappear. Comments and trivia owned by surviving neighbors remain byte-identical.

At the new previous/next joint, apply the existing lift-site join rule: retain surviving trivia, avoid concatenating two separator runs into unintended extra vertical space, and never consume a comment merely to make the join attractive. If the required deletion span would carry non-owned material, reuse `RemovalCarriesMoreThanTheEntry`.

The important architectural point is that the source transformation produced by `ItemMove` and `RemoveItem` should be identical for the same item.

### Q5 — removing the last item

Refuse with `RemovalWouldEmptyTheSequence`.

Writing `matches: []` would synthesize and choose a presentation for a replacement collection. Leaving `matches:` changes the value to null. Neither is "remove one existing item."

The UI should disable ordinary deletion for the last match and explain that at least one match must remain. If users need an empty configuration, that is a separate explicit document-level operation—most naturally raw editing—not an item removal disguised as one.

### Q6 — `save_raw_document`

Use:

```rust
enum SaveRequest {
    Edits(Vec<DocumentEdit>),
    WholeText(String),
}
```

Do not manufacture a full-span `DocumentEdit`. That would falsely claim the patch engine's locality and node-boundary invariants apply.

Both variants must converge immediately into the existing locked transaction:

1. acquire the same lock;
2. check the revision against the text the UI actually loaded;
3. produce candidate text—apply edits or accept whole text;
4. parse and validate the candidate;
5. verify the exact multiset of acknowledged findings;
6. create the backup;
7. atomically commit;
8. return the new revision.

Whole-text-specific rules:

- **Revision:** mandatory base revision; stale raw text returns the existing `RevisionConflict`.
- **Final newline:** preserve exactly as supplied. Never add or remove one.
- **Line endings:** preserve exactly, including mixed endings. Do not normalize.
- **BOM:** preserve the original UTF-8 BOM as file metadata outside the editable text. Reject an embedded or newly introduced BOM with `InvalidByteOrderMark`.
- **Non-UTF-8:** if the application's document abstraction is `String`, refuse loading/saving it with `DocumentNotUtf8`; do not perform lossy decoding.
- **Validation findings:** calculate them from the whole-text candidate, not from the previous projection.
- **No-op saves:** preferably detect identical bytes and avoid backup/revision churn.

### Q7 — most likely failure

The likeliest failure is deleting or duplicating comments/blank runs at the removal boundary—especially first, middle, and last items under CRLF.

Use a table-driven locality test covering every position with zero/one/multiple blank lines and owned/non-owned comments. For each case, assert:

- the exact expected output bytes;
- every byte outside the calculated replacement/join region is unchanged;
- `RemoveItem` output equals the lift-site output of `ItemMove` for the same source item;
- both LF and CRLF variants behave identically at the structural level.

---

## Disposition

| # | Ruling | Disposition |
|---|---|---|
| Q1 | Three sub-phases; `InsertItem` and `RemoveItem` paired; raw save last | **Adopted.** 2b-2c-1 is the pair, 2b-2c-2 the two commands, 2b-2c-3 the raw save. The `SaveRequest` enum is *not* introduced early — it belongs to the phase whose tests exercise it |
| Q2 | Shape (a): a flat block mapping of scalar fields, spelled by the existing codec | **Adopted.** (b) puts preservation-critical structure in the untrusted caller — the same reason the frontend sends a `MatchDraft` and not an edit list (2b-2b). (c) puts espanso's schema inside the generic patch engine |
| Q2 | The narrow exception, stated rather than the rule weakened | **Adopted verbatim** as the primitive's doc comment |
| Q2 | Promotion of an implicit-null mapping value into its first block-sequence item | **Adopted**, with Q3's derivation and its named refusal |
| Q3 | Flow sequences refused, inconsistent indentation refused, implicit null derived | **Adopted.** The error names are the consult's |
| Q4 | `RemoveItem` is `ItemMove`'s lift half, sharing the code and not merely the answer | **Adopted**, and the shared-code claim is pinned by a test that compares the two outputs |
| Q5 | Refuse the last item by name; the UI explains it | **Adopted.** `RemovalWouldEmptyTheSequence` |
| Q6 | A `SaveRequest` variant, never a full-span `DocumentEdit` | **Recorded for 2b-2c-3**, not built here |
| Q7 | The boundary table, LF and CRLF, with `RemoveItem` compared against `ItemMove` | **Adopted** as 2b-2c-1's headline test |
