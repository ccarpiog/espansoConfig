## Verdict: hold the phase open

The read model is thoughtfully structured, but match identity is positional in practice, and the strongest “no unknown key is lost” oracle cannot detect whole omitted mappings. Both violate explicit Phase 1a gates.

## Ranked findings

### 1. Match identity is positional after reparsing, and its test never performs a reorder

`MatchId` contains `DocumentId + NodeId`, but both components are allocated by position:

- `DocumentId` is the file’s sorted enumeration position: `DocumentId(position as u64)` in [workspace/mod.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/workspace/mod.rs:203).
- `NodeId` is explicitly the parser arena index, assigned from `nodes.len()` in [syntax/index.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/index.rs:638).

Concrete counterexample:

```yaml
matches:
  - trigger: :a
    replace: A
  - trigger: :b
    replace: B
```

Parse it, then exchange the two equally shaped mappings and refresh. The parser emits the new first mapping at the old first mapping’s arena position. Consequently `:b` inherits `:a`’s former `MatchId`, while `:a` receives the former second ID. Identity follows position, exactly what §6.2 forbids.

The claimed test is an oracle that cannot catch this. `a_match_identity_is_the_document_plus_a_node_and_survives_a_reordering` never changes the source or reparses it; it only verifies uniqueness and that each path’s final index equals its current vector position in [model_projection.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/model_projection.rs:741).

There is a second collision:

1. Open a directory and retain the ID for `match/b.yml`.
2. Add an alphabetically earlier file.
3. Reopen the workspace.
4. Use the retained ID.

IDs are reassigned from sorted positions, so the retained ID can now select another file. The existing two-open test uses an unchanged directory and therefore cannot detect this in [workspace_cache.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/workspace_cache.rs:325).

This also contradicts `DocumentId`’s documentation that snapshots across an external modification are different documents: `refresh()` retains the existing context ID in [lib.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/lib.rs:72) and [workspace/mod.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/workspace/mod.rs:326).

### 2. Nested keys under an unknown entry disappear from the projection, and all coverage checks pass

Concrete input:

```yaml
matches:
  - trigger: :a
    replace: A
    future_option:
      nested_key: nested_value
```

`future_option` becomes one `UnknownEntry` containing only its name, spans, and `ValueKind::Mapping`; it does not contain a `ValueView` and is never descended in [unknown.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/unknown.rs:44). Therefore `nested_key` is neither modelled nor recorded by name and path.

The decision record acknowledges that unmodelled entries are not descended, but treats this as a depth-test precondition rather than a Phase 1a coverage failure, and it is absent from the §9 holes list: [1a-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1a-notes.md:267).

The coverage oracle cannot detect this:

- Coverage records exist only when `Projector::close()` is called for a mapping the schema walk chose to scan: [project.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/project.rs:142).
- The audit iterates only records already present in `view.coverage`: [model_projection.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/model_projection.rs:327).
- `coverage_is_complete()` likewise applies `all()` only to emitted records: [document.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/document.rs:289).

Thus omitting the nested mapping’s entire coverage record passes vacuously. The retained disabling experiment only deletes an entry from a record that already exists; it does not disable creation of the record itself.

Related: repeated and non-scalar keys deliberately receive `path: None`, despite the stated requirement that unknown keys be recorded by name and path: [unknown.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/unknown.rs:171).

### 3. `load_from_source()` lets an unsaved draft replace Rust’s disk snapshot

The plan says Rust owns disk snapshots and the frontend owns the unsaved draft in [IMPLEMENTATION_PLAN.md](/Users/ccarpio/Developer/espansoConfig/IMPLEMENTATION_PLAN.md:474). The public `load_from_source()` method instead installs arbitrary caller-supplied bytes into the same `Entry.loaded` slot used by disk reads: [workspace/mod.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/workspace/mod.rs:378).

Concrete sequence:

1. Disk contains revision A.
2. `get_document(id)` caches A.
3. Call `load_from_source(id, draft_B)`.
4. Call `get_document(id)` or `document_text(id)`.

They return draft B as the cached snapshot even though disk still contains A. Only an explicit `refresh()` restores disk authority. This is more than a testing seam and should not be part of the production workspace state machine.

The IPC surface is also not one-to-one yet: `WorkspaceError` is not serializable, `SourceDocument` is not serializable, and there is no workspace-level `get_match`, despite plan §6.4 requiring it. A wrapper must compose/map these APIs rather than simply expose them.

### 4. The D2u oracle has a concrete false-negative branch

In `scalar_disagreement()`, when source decoding succeeds, text is compared only if `scalar.decoded` is true: [model_projection.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/model_projection.rs:259).

Construct the same deliberately wrong view used by the retained experiment, but set:

```rust
inferred.text = "true".to_owned();
inferred.decoded = false;
```

For source text `on`, `decode()` succeeds, but the oracle returns `None`. The disabling test mutates only `text`, leaving `decoded == true`, so it does not cover this branch.

The current production constructor appears to set `decoded == false` only after a real decode failure, so I found no demonstrated production D2u violation. However, the oracle’s headline claim is broader than what it enforces. Also, the raw fallback means strict D2u depends on proving the accepted-by-parser/rejected-by-decoder case unreachable; §9 explicitly says that has not been proven.

### 5. Malformed elements inside scalar sequences are diagnosed but not projected

`scalar_sequence()` says a non-scalar item is projected as an elided value, but the implementation only emits a diagnostic and omits it from the returned `Vec<ScalarView>`: [project.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/project.rs:114).

For example, a `search_terms` sequence containing a nested mapping loses that element from the semantic projection. Raw document text remains available, so this is not silent at the file level, but the implementation contradicts its documented read-model behavior. This hole is not listed in notes §9.

## Specifically checked and found sound

- Current model fields representing user-authored scalar values use `ScalarView`; schema booleans are not exposed as Rust booleans. Serialization keeps `ScalarView.text` as a JSON string.
- The retained cache-disabling experiment is meaningful: repeated accessors all converge on `get_document()`, while `parse_count` increments only in the parsing path. Always reparsing would be detected.
- Within one workspace entry, revision handling is sound for identical replacement, change-and-back, refresh, and eviction. Identical contents safely reuse the parse; change-and-back reparses both transitions; eviction causes the next open to read current disk contents.
- Parse failures retain UTF-8 source text and produce structured diagnostics. The remaining `expect()` calls follow assignments or exhaustive branches and are not input-dependent in the inspected code.
- Diagnostics themselves are codes plus operands. The English `Display` implementations are developer renderings; they should not be used as the Phase 1b IPC error representation.
- The Phase 0 load-bearing diffs are serialization derives and exports, not parsing, ownership, path-resolution, or patch behavior changes.
- No `tauri` dependency appears in either core manifest or `Cargo.lock`, directly or transitively.
- I did not run tests, modify files, browse, fetch URLs, or inspect private corpus contents.

Codex session ID: 019fb568-828d-7b30-aa57-1ea7b99280a7
Resume in Codex: codex resume 019fb568-828d-7b30-aa57-1ea7b99280a7
