1. **Ship (b): `DraftField<T> { Unchanged, Set(T), Remove }`, externally tagged.** It makes intent explicit and malformed input fails closed.

   - `(a) Option<Option<T>>`: technically works with custom deserialization, but `undefined`/missing/`null` are routinely collapsed by TypeScript types, form libraries, serializers, and generated clients. The catastrophic failure is accidental `null` becoming removal.
   - `(b) DraftField<T>`: verbose, and tag/casing mismatches cause deserialization errors—but that is the desirable failure mode: rejection rather than unintended mutation. Make omission default to `Unchanged` if partial drafts are allowed.
   - `(c) touched_fields`: the values and touch metadata can drift apart. Misspellings, stale names, duplicates, or “touched” without a corresponding value can silently produce the wrong edit.

2. **Compare drafted logical value with the existing scalar’s decoded logical value. Nothing else.** The trap is that decoding YAML scalars includes quoting, escapes, block folding, chomping, and—especially for plain scalars—resolver/type ambiguity. Use the projection’s established string-decoding semantics; do not introduce a second “helpful” YAML 1.1 inference path.

   Test semantically equal but textually different spellings: plain, single-quoted, double-quoted with escapes, and block scalars. For each, submitting the same logical value must yield an empty edit batch, byte-identical output, and no `PresentationNote`. Also test a genuinely different logical value produces exactly one scalar edit.

   Comparing `codec.emit(draft)` with existing source text is never the unchanged test. It is tempting because the codec already exists and the comparison is easy, but it compares representations, not values. A codec may canonically emit `"hello"` while the file validly contains `'hello'`; rewriting that is precisely the preservation bug.

3. **The boundary is: 2b-2b may modify or remove existing addressable nodes, and may insert scalar-valued mapping entries; it may not change sequence cardinality or create collection structure.**

   Therefore:

   - Existing elements of `triggers` and `search_terms` may have their scalar values edited by path/index.
   - Existing `vars` and `form_fields` items may have addressable scalar leaves edited; scalar fields inside their existing block mappings may also be inserted or removed where valid.
   - Adding or deleting any trigger, search term, variable, or form-field item must receive a typed `UnsupportedSequenceCardinalityChange`-style refusal.
   - Any item-shape change requiring a new mapping or sequence must also be refused.

   Editing an existing sequence scalar is sound: it is a scalar-node replacement, not a sequence mutation. State the invariant in code and tests as: **the generated plan must be representable solely by the current four primitives, and 2b-2b must never synthesize a collection node or sequence item.** Do not silently ignore unrepresentable differences.

4. **Judge shape changes by the destination structure, not by field names.** A transition is allowed only when it decomposes into removals of existing mapping entries, scalar edits, and insertion of new scalar-valued mapping entries. Removal may discard an existing subtree; insertion cannot construct one.

   Thus a scalar-key-to-scalar-key change can be `RemoveField + InsertField`. A destination requiring a sequence, mapping, or new sequence item must be refused. This makes the rule intentionally asymmetric: deleting an existing collection and replacing it with a scalar can be expressible, while replacing a scalar with a collection is not.

5. **All dependencies must resolve in the original tree, and insertion anchors must survive the batch.** Reject these concrete hazards:

   - Inserting after a key that the same batch removes.
   - Anchoring after a key inserted by the same batch—it does not exist in the original index.
   - Removing a field while also editing a scalar inside its value: the spans overlap.
   - Editing the same scalar twice.
   - Using a decoded key that is ambiguous because duplicate mapping keys exist.
   - Multiple insertions at the same original offset without a defined ordering; they may reverse or otherwise depend on splice implementation.

   Draft edit order must not imply sequencing. Require anchors to be unique original siblings unaffected by the batch, and either define a canonical order for shared-anchor insertions or reject them.

6. **The likeliest byte-preservation failure is generating `ScalarEdit`s for every value present in the draft—often because source spelling or codec output differs—even when the logical value is unchanged.** The cheapest catching test is a golden round trip containing deliberately noncanonical scalar spellings: submit a fully populated but logically identical draft, assert the derived batch is empty, then assert exact byte equality and zero presentation notes.

Codex session ID: 019fbfef-e7dc-7143-be36-d02e8cc014e5
Resume in Codex: codex resume 019fbfef-e7dc-7143-be36-d02e8cc014e5
