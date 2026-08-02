# Phase 2b-2a review — the save spine and `move_match`

Codex review of the uncommitted working tree, run against the whole change
(26 modified files plus `src-tauri/src/save.rs` and `docs/decisions/2b-2a-notes.md`).
Verbatim reply below.

---

Confirmed findings:

Blocking: none.

1. **High** — [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:859) — Every `saveFailed` leaves the frontend projection and raw-text snapshot untouched even when the nested `WriteError` says the rename completed, contradicting the Rust-side cache eviction.  
   **Failure scenario:** the rename succeeds and directory sync or read-back fails (`Write.Io` at `SyncDirectory`/`ReadBack`, or `VerificationFailed`); the file may contain the moved snippet and Rust evicts its cache, while the window continues displaying the pre-save order and raw bytes. The test `reports a failed save and changes nothing on the screen` at line 1358 would pass against this broken behavior because its fixture fails at `Rename`, which explicitly means the rename did not complete.

2. **Medium** — [save.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:174), via [mod.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/syntax/mod.rs:82) — Deserialization can construct an acknowledgement containing an invalid inverted `ByteSpan`, bypassing the invariant enforced by `ByteSpan::new`.  
   **Failure scenario:** `{"accepted":[{"code":{"ReferenceHasNoDeclaration":{"name":"x"}},"span":{"start":20,"end":10},"node":null,"path":null}]}` deserializes successfully and is retained as a suspicion; calling `span.len()` then underflows or panics. The new round-trip test uses only a valid span, so it cannot detect this.

3. **Medium** — [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:1501) — The conflict test does not discriminate the honesty rule it claims to prove because `found` and the later `disk_revision` are deliberately equal in its fixture.  
   **Failure scenario:** an implementation incorrectly sets `disk_revision = found` while separately refreshing `disk`; this test still passes because no writer changes the file between refusal and refresh. In production, a second external replacement could make `disk` describe revision C while the payload falsely labels it revision B. The current production construction at lines 436–441 is correct and derives `disk` and `disk_revision` from one refresh.

4. **Low** — [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:867) — The frontend treats every `Saved` arm as if bytes changed, despite `committed: false` being a documented successful outcome.  
   **Failure scenario:** moving one of two byte-identical snippets yields a byte-identical candidate and `committed: false`; the frontend nevertheless discards raw text, re-reads the document, and repairs selection as though identities had become stale. It does not classify the result as a failure, but its comment and behavior overstate what `Saved` guarantees, and there is no browser test for `committed: false`.

5. **Low** — [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:1356) — `a_move_leaves_the_bytes_it_did_not_move_alone` does not prove byte identity outside the move, despite its name and documentation.  
   **Failure scenario:** a broken command changes `replace: first` to another same-length value while preserving the leading comment, trigger count, unmodelled-key count, and total file length; every assertion in this test still passes.

No additional merely suspected findings.

The reviewed code otherwise satisfies the named structural invariants: production writes remain centralized in `save_document`; `covers_all` consumes distinct matches; there is no force bypass; `move_match` accepts identities rather than paths; it sends exactly one same-sequence `MoveItem`; backups are always supplied; and the moved identity is resolved at `resulting_index` against a refreshed matching revision. Dropping `Clone`/`PartialEq`/`Eq` from `CommandError` was reasonable given that the full typed `SaveError` is intentionally retained; the six rewritten no-workspace assertions lost no meaningful operand discrimination because `NoWorkspaceOpen` is operand-free.

