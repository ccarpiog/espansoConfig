## High

- [src/lib/ipc/commands.ts:578](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.ts:578) — A failed `reload` rejects `saveRawDocument()` after the backend has already committed the replacement. This escapes the advertised `Promise<CommandResult<SaveResult>>`, hides the successful `Saved` result, and may invite the caller to retry a write that already happened. It also leaves stale projections if the callback failed before invalidating them. Minimal fix: invalidate through frontend state owned by the save operation, and represent/recover from reload failure separately while still returning the committed `Saved` result. Add a test with a rejecting reload callback.

## Medium

- [src/lib/ipc/commands.ts:560](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.ts:560) — The required callback does not make ignoring invalidation a compile error; it only makes omitting an argument an error. A no-op callback compiles, and the tests use exactly that at [commands.test.ts:150](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.test.ts:150) and [commands.test.ts:275](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.test.ts:275). Likewise, an asynchronous callback can read or expose stale projections before it performs invalidation. `await` only protects code after the caller awaits the wrapper. Minimal fix: put raw save behind the browser/workspace state abstraction that owns the projections and performs synchronous invalidation itself; an arbitrary caller-supplied function cannot enforce this invariant.

## Low

- [src-tauri/src/dispatch_check.rs:708](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:708) — The dispatcher test claims to inspect bytes on disk but calls `document_text`, which may serve the workspace cache. It could pass if a future command incorrectly updated cached text without persisting it. Direct-disk coverage exists in the command/core tests, so this is a test-isolation weakness rather than a runtime defect. Minimal fix: retain the temporary directory and compare `std::fs::read` directly.

- [src-tauri/src/commands.rs:4388](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:4388) — The command-layer acknowledgement-mismatch test says it proves identical parser stopping points, but it only compares `span`, `node`, and `path`, then asserts the complete codes differ. It would still pass if line, column, byte offset, or detail differed, in which case the revision operand would not be what distinguishes the findings. The stronger core test at `persist_raw_save.rs:655` does correctly isolate and compare those operands, so the binding itself is covered. Minimal fix: destructure both codes, compare all non-revision operands, and separately compare each revision with its candidate hash.

The remaining suspicions did not survive inspection:

- `save_raw_document` reaches only `save_document`, through `run_one_save`; no command calls either low-level replacement function.
- Omitting `view_at` is sound. The locked revision check catches the important stale-editor case, while success, no-op, and conflict all pass through cache refresh. Evicted and never-loaded known documents work through `document_context`; unknown documents fail before the transaction.
- `DocumentDoesNotParse.revision` is computed from the submitted candidate and participates in finding equality, so acknowledgement binding is enforced.
- `moved: None`, transactional refusal in the value channel, no-op transaction handling, absence of `force` and wire paths, localization, and the explicit no-position presentation case are correct.
- The four existing `run_one_save` callers retain `SaveContent::Edits(&edits)` with no behavioral or lifetime change.
- The registration, remote-origin, and wire-contract checks were retabulated without weakening their bidirectional set comparisons.

READINESS: NOT READY

Codex session ID: 019fc3b2-58ba-7863-bed8-03d6e93a7663
Resume in Codex: codex resume 019fc3b2-58ba-7863-bed8-03d6e93a7663
