1. Positional is right under these constraints, but only if the draft is bound to the exact projected snapshot.

Key-addressing cannot uniquely identify duplicate keys. JSON objects also collapse or ambiguously handle duplicate properties, commonly producing last-wins behavior, while your YAML resolver reads the first occurrence. The caller could believe it edited the second `layout`, while the engine edits the first. Non-decodable keys are not safely nameable at all, and name-bearing refusals would violate privacy.

The positional failure mode is stale indices: if the file changes after projection, index 3 may now identify a different entry. Prevent that with a document revision/hash checked before planning and again before applying.

2. Yes, prefix checking is sound if `DocumentPath` represents physical CST ancestry in one immutable snapshot and prefix comparison is component-wise—not string-prefix comparison.

For example, removing:

`/form_fields/0`

contains an edit at:

`/form_fields/0/2/1`

even though the nodes are in different nested mappings. Structural prefix catches it.

A disagreement exists if paths traverse aliases, merge-key expansion, or other semantic indirection: a semantic descendant can reside outside the removed byte span. Another harmless disagreement is trivia: a removal span may contain comments or whitespace with no descendant `DocumentPath`. If paths address only concrete syntax nodes without alias expansion, there is no relevant disagreement. Make that invariant explicit.

Also, grouping derived edits does not replace D4’s full-map duplicate scan. An unedited duplicate can still make an edited path ambiguous.

3. Exact `true` versus source `true` being unchanged is correct only if this surface’s draft value is explicitly source spelling.

The dangerous part is pretending this is the inherited logical-value equality rule. It is not. You now have two possible contracts:

- Logical contract: compare draft logical value with reliably decoded logical value.
- Source-text contract: compare draft text with the exact scalar source representation.

For params, your stated resolver limitation forces the second contract. Therefore `yes`, `on`, `True`, and `true` are distinct strings. Setting `"true"` against source `yes` must be an edit, even if YAML 1.1 could interpret both as boolean true.

Likewise, unquoted `null` and an empty scalar are distinct source spellings. Do not collapse them merely because a resolver might assign both a null value. If quoting is included in the displayed source, compare that too. Encode this distinction in the type/API; overloading `ScalarView.text` will eventually cause a false no-op or unwanted rewrite.

4. No refusal is locally more dangerous than performing an edit whose meaning or byte scope is not authorized.

The worst product-level case is refusing collection removal or variable removal: users may fall back to manually editing YAML or using a whole-document serializer, which can cause broader damage. But that is a UX consequence, not permission for this engine to delete unseen bytes.

The correct response is a precise index-only refusal plus guidance to use a raw/config-aware editor. Do not weaken the safety boundary based on speculation about the user’s next action.

5. A later sequence-cardinality phase must undo several absolute rules:

- D3’s “edit existing elements only, never add or remove.”
- D4’s refusal to add or remove a variable, if the new primitives apply to `vars`.
- The global invariant that sequences never change cardinality.
- Any closed-surface validation that permits only scalar edits at item paths; it must become operation-sensitive and admit sequence insert/remove targets.

D6 will need more than extension-by-path-shape. Index-shifting creates dependencies: two removals, insertion plus edit, or move plus removal can change what later indices mean. You need original-snapshot coordinates, deterministic application ordering, collision rules, and insertion-anchor survival checks for sequences.

D1’s ban on new author-chosen mapping keys need not change. Sequence insertion does not automatically authorize arbitrary mapping-key synthesis. Likewise, collection-entry removal remains separate from sequence-item removal.

6. The highest risk is stale positional drafts.

Without snapshot identity and atomic validation at application time, every rule can pass and the engine can still modify the wrong author-chosen entry after an external file change. Bind projection, draft, spans, and application to the same exact file bytes—preferably by content hash or revision—and reject the whole batch if they differ.

Codex session ID: 019fc1d7-d6fa-7150-8520-925145c6d3e8
Resume in Codex: codex resume 019fc1d7-d6fa-7150-8520-925145c6d3e8
