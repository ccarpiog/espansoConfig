## Findings

1. **Blocking — duplicate sequence intent can bypass R5 and both audits.**  
   [plan.rs:165](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/plan.rs:165), [plan.rs:215](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/plan.rs:215), [audit.rs:94](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/audit.rs:94)

   Concrete failure: existing `triggers[0] == ":one"`; draft contains `Set(":one")` and then `Set(":changed")` for index 0. The first intent disappears at line 215 as a logical no-op, the second produces one edit, both audits see only that edit, and `apply_edits` successfully changes the scalar. Thus the same target was drafted twice without `ScalarEditedTwice`; draft order silently becomes “last effective value wins” despite the no-sequencing rule.

   Smallest fix: pre-scan each sequence draft for duplicate indices among non-`Unchanged` intents before diffing. Batch-only auditing cannot recover an intent already erased as a no-op.

2. **Blocking — source collection shapes are blanket-refused, contrary to R3/R4.**  
   [plan.rs:129](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/plan.rs:129), [error.rs:100](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/error.rs:100)

   Concrete failure:

   ```yaml
   replace:
     nested: value
   ```

   Drafting `replace: Remove` returns `FieldHasAnUnmodelledShape`, although the known `replace` entry is addressable and `FieldRemoval` can delete its subtree. The decision is based on the source shape, not the destination.

   Smallest fix: allow `Remove` whenever the known key exists, regardless of value kind. Supporting `Set("text")` from collection to scalar additionally requires a verified node-to-scalar replacement primitive; removal plus insertion cannot work because insertion planning sees the original key and rejects it.

3. **Should-fix — empty known sequences become invisible as insertion anchors.**  
   [plan.rs:255](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/plan.rs:255)

   Concrete failure:

   ```yaml
   matches:
     - triggers: []
   ```

   Drafting `label = Set("x")` returns `NoInsertionAnchor`. `triggers` is an original, decoded, addressable sibling, but `visible_entries` records a sequence only through its first element, and an empty sequence has none.

   Smallest fix: preserve the sequence entry/container span and presence in `MatchView`, then use that span for ordering. An empty `Vec<ValueView>` cannot distinguish absent from present-empty, particularly for `search_terms`.

4. **Should-fix — the guards are not as independent or complete as claimed.**  
   [audit.rs:54](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/audit.rs:54), [audit.rs:57](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/audit.rs:57), [audit.rs:281](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/audit.rs:281)

   They reuse the planner’s `MatchField::from_key`/`SequenceField::from_key` vocabulary and inspect paths, not actual nodes or original cardinality. For example, a hand-built scalar edit to `triggers[999]` passes both guards; two insertions of `word` after two different original anchors also pass, then `apply_edits` rejects the duplicate destination key. More importantly, finding 1 shows a planner-produced semantically ambiguous batch can pass and apply successfully.

   Smallest fix: describe these as closed-surface/dependency checks, not independent validation of planner intent. For stronger independence, use a literal audit-owned whitelist and pass original node facts—not merely planner-derived key strings. Intent-level duplication still belongs before diffing.

5. **Should-fix — the temporary `DraftError` exclusion has no expiry mechanism.**  
   [dictionary_contract.rs:392](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dictionary_contract.rs:392)

   Concrete future failure: a command begins returning serialized `DraftError`, but the exclusion remains. `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` continues passing, so no English or Spanish key is required.

   Cheapest robust fix: register `DraftError` and add its dictionaries now. If translation must remain deferred, add a source-contract test that fails whenever production Tauri/wire code references `DraftError` while it remains temporarily excluded.

6. **Should-fix — the “field identifiers are rendered literally” justification is currently false on the wire.**  
   [dictionary_contract.rs:375](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dictionary_contract.rs:375), [match_draft.rs:29](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/draft/match_draft.rs:29)

   Concrete failure: `FieldHasAnUnmodelledShape { field: UppercaseStyle, … }` serializes `"UppercaseStyle"`, not the literal espanso key `uppercase_style`. The same applies to `SequenceField::SearchTerms`. A later translated error interpolating this operand exposes a Rust identifier, and no dictionary test fails.

   Smallest fix: serialize `MatchField` and `SequenceField` as their snake-case espanso keys, or give them translated display namespaces. `DraftField` remains a defensible permanent protocol exclusion; `DraftTarget` is defensible only if its nested fields acquire stable display spellings.

7. **Note — the decision record overclaims in several places.**  
   [notes.md:108](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2b-2b-1-notes.md:108) says collection-to-scalar is expressible, but current patch primitives reject it.  
   [notes.md:229](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2b-2b-1-notes.md:229) says every remove-plus-add draft is refused; removing `trigger` while inserting `word` anchored after an untouched `label` is accepted.  
   [notes.md:319](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2b-2b-1-notes.md:319) says error positions index “the batch the caller received,” but an `Err` discards the batch.  
   [notes.md:322](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2b-2b-1-notes.md:322) claims the dictionary contract will fail if the temporary exclusion survives; it will not.

Area 1 otherwise clean: decoded failures refuse; equal zero-width scalars produce no edit; duplicates are refused; elided items refuse; chomping/trailing newlines and Unicode escape spellings compare through decoded logical strings.

Area 4 otherwise clean: current field paths are rooted directly under the match, sequence cardinality does not shift, and duplicate path ancestors are caught by the ancestor-aware hazard gate.

Codex session ID: 019fc010-f805-7483-9a49-256628f90f64
Resume in Codex: codex resume 019fc010-f805-7483-9a49-256628f90f64
