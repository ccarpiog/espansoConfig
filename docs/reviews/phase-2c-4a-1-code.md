NOT READY

- Medium — Byte-exactness is not tested through the actual `SaveResult` IPC serialization path. [src-tauri/src/commands.rs:3023](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:3023). The Rust test stops before serialization; [src-tauri/src/save.rs:467](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/save.rs:467) serializes only ordinary LF `SAMPLE_SOURCE`; and [saveOutcome.test.ts:348](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/saveOutcome.test.ts:348) starts with a hand-built, already-correct TypeScript value. Consequently, normalization or substitution specific to `SaveResult::disk_text` could pass all three tests. Fix: add a dispatcher-level conflict test invoking `save_raw_document` over BOM+CRLF+no-final-newline disk text, then compare the response-body `disk_text` bytes with the file and rehash them against `disk_revision`.

- Low — The documentation overstates two implementation facts. [docs/decisions/2c-4a-1-notes.md:83](/Users/ccarpio/Developer/espansoConfig/docs/decisions/2c-4a-1-notes.md:83). `Workspace::refresh` does not always return source/view produced by the current read: when the revision is unchanged, it returns the previously cached `SourceDocument` ([workspace/mod.rs:514](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/workspace/mod.rs:514)). Also, “every other `SaveResult::Conflict` … is a pattern match” is false because `every_save_result()` constructs a test-only instance ([save.rs:377](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/save.rs:377)). The production guarantee remains valid, but the record violates the project’s documentation-honesty rule. Fix: say “one production construction site” and “one returned revision-consistent snapshot”; explicitly note cached reuse for unchanged revisions.

- Pairing claim — No additional finding. There is exactly one non-test constructor at [commands.rs:1320](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:1320), and the changed-twice test independently distinguishes `LATER`, `found`, and `disk_revision`.

- `String` versus `Option<String>` — No finding. `read_utf8` rejects invalid UTF-8 before construction, while parse failure still builds a `SourceDocument` containing the original text and a failed projection.

- Wire-shape completeness — No finding. The five operands, serializer, fixture enumeration, discriminant, Rust shape test, wire contract, and required TypeScript field agree. The dictionary count correctly tracks variants, not fields.

- Scope discipline — No finding. No `.svelte` production file, dictionary, control, wrapper conflict arm, `conflictText`, or `captureTheDiskText` changed. All twelve TypeScript test-file changes either add the required fixture field or add the two intended model tests; no assertion was removed or weakened.

- Wire size — No finding. Large or repeated conflicts incur unbounded, linear serialization and allocation cost, but the decision record states this limitation honestly, and the existing projection is already whole-document scale.

- Naming hazard — No finding. `RawEditor.svelte`’s `diskText: RawDocumentText | null` and `ConflictModel.diskText: string` live at different typed boundaries; TypeScript will reject accidental interchange. Renaming or adapting them belongs in step 2.

Codex session ID: 019fd911-ff7c-77d1-a984-e846aef3adb6
Resume in Codex: codex resume 019fd911-ff7c-77d1-a984-e846aef3adb6
