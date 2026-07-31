## High

1. `identityRecovery()` treats every stale revision as recoverable even though staleness does not prove the match still exists.

Files:

- `src/lib/ipc/errors.ts:229-258`
- `src/lib/ipc/types.ts:76-85`
- `crates/espansoconfig-core/src/patch/path.rs:74-85`
- `crates/espansoconfig-core/src/model/match_view.rs:109-121`

Concrete failure:

1. The UI holds the second match’s `MatchId` and `DocumentPath`, such as `matches[1]`.
2. An external edit deletes that match.
3. `reload_document` reparses the file.
4. `get_match` checks the revision before the node and returns `identityStaleRevision`.
5. `identityRecovery()` returns `refetch`.
6. Its JSDoc directs the caller to re-resolve via `DocumentPath` and keep the selection.
7. But `DocumentPath` uses `PathSegment::Index(usize)`—a sequence position, not a stable identity. `matches[1]` may now identify the old third match or nothing.

Thus the claims at `errors.ts:232-234` that “the thing still exists” and that `DocumentPath` preserves the selection are false. `types.ts:78-80` similarly calls `DocumentPath` “the identity designed to survive a reparse,” contradicting the positional Rust representation.

The decision record overstates this too:

> “`identityStaleRevision` — re-resolve and keep the selection”

at `docs/decisions/1b-2a-notes.md:118-120`.

Recommended fix: make stale revision mean “refresh and attempt recovery,” not “the match still exists.” Recovery needs an actually stable selector or an explicit reconciliation result capable of returning either “same logical match found” or “selection gone.” Do not reselect using a sequence-index `DocumentPath`.

2. Non-UTF-8 YAML paths can turn successful commands or typed errors into untyped serializer failures containing prose.

Files:

- `crates/espansoconfig-core/src/discovery.rs:327-355`
- `crates/espansoconfig-core/src/workspace/mod.rs:257-265`
- `crates/espansoconfig-core/src/model/document.rs:100-108`
- `src-tauri/src/error.rs:142-181`
- `src-tauri/src/commands.rs:17-18`

Concrete failure:

On Unix/macOS, create a filename whose basename contains invalid UTF-8 bytes but whose extension is the valid ASCII `.yml`. `collect_yaml_files()` accepts it because only the extension is converted to `str`. The resulting `DocumentSummary` and `DocumentView` carry that path as `PathBuf`.

Serde’s `PathBuf` serializer rejects non-UTF-8 paths. Therefore:

- `list_documents` can reach `Ok(Vec<DocumentSummary>)` and then fail while Tauri serializes the response.
- An `Io` or `NotUtf8` `CommandError` containing that same path can itself fail to serialize.

The webview then receives Tauri/serde’s generic serialization rejection instead of `{code, operands}`. This directly contradicts the module-level claim that “Every failure crossing this boundary is a `CommandError`” at `commands.rs:17-18`. The serializer error text is also prose outside the Rust code dictionary.

Recommended fix: define an explicit wire-path representation that always serializes—for example a validated Unicode display path plus an opaque byte-safe identity—or reject non-Unicode discovered paths as a dedicated typed error before constructing the wire response. Add dispatcher tests using a non-UTF-8 basename on supported Unix targets.

## Medium

3. `isCommandError()` is an unsound TypeScript type guard.

Files:

- `src/lib/ipc/errors.ts:148-158`
- `src/lib/ipc/errors.ts:175-193`
- `src/lib/ipc/errors.test.ts:46-50`

Concrete failure:

```ts
const raw = { code: 'identityStaleRevision' };
```

`isCommandError(raw)` returns `true`, after which TypeScript treats `raw.expected` and `raw.found` as guaranteed strings. Both are actually `undefined`. Likewise `{code: 'io'}` becomes an `IoError` without `path` or `kind`.

The test explicitly licenses this behavior by checking only the code and calling the result a typed `CommandError`. A future localized formatter can consequently interpolate `undefined`, while `identityRecovery()` can initiate recovery based on a malformed rejection.

Recommended fix: validate the required operands and their primitive/array shapes per code. If forward-compatible extra fields are desired, allow surplus fields but not missing or wrongly typed required fields. Alternatively rename the predicate to reflect that it recognizes only a code and do not give it the `value is CommandError` return type.

4. `wire_contract.rs` is non-vacuous for its fixed sample list, but it misses several concrete, silent divergences.

Files:

- `src-tauri/src/wire_contract.rs:174-245`
- `src-tauri/src/wire_contract.rs:328-441`
- `src-tauri/src/wire_contract.rs:671-680`
- `src/lib/ipc/types.ts:259-288`
- `src/lib/ipc/errors.ts:56-146`
- `docs/decisions/1b-2a-notes.md:175-184`

The positive result: the interface check cannot silently process zero samples—the 19-entry `samples()` table is fixed, missing interfaces panic, and differing empty/non-empty sets fail. The union and error-code checks likewise compare against non-empty Rust sets. There is no current zero-match regex path.

But these concrete divergences all pass:

- Change `DocumentView.profile` at `types.ts:548` from required nullable to `profile?: ConfigProfileView`. `property_name()` deliberately strips `?` at `wire_contract.rs:220-230`, so the check still sees the same property name even though serde always writes the key and writes `null` for `None`.
- Change `ParseFailed.byte_index` at `types.ts:274` to `byte_index: string`, or rename it to `byteIndex`. The interface check observes only the outer `Diagnostic` keys; the union check observes only variant names, never nested operand keys or types.
- Rename `IoError.path` at `errors.ts:89` to `filename`, or change `kind` to `number`. `wire_contract.rs` checks only `COMMAND_ERROR_CODES` from `errors.ts`; it never checks any frontend error interface.

The notes admit that types are unchecked at `docs/decisions/1b-2a-notes.md:256-260`, but understate the hole: required-vs-optional, nested operand property names, tag payload shapes, and every error operand are also unchecked. Its broader statement that the handwritten mirror is made safe by this check is overstated.

Recommended fix: generate the TypeScript wire schema, or compare both sides through a real schema representation. At minimum, parse TypeScript with its compiler API and check requiredness, nullability, primitive kinds, arrays, enum tagging, nested operands, and all `CommandError` variants.

5. The command-name test does not establish that the registered surface contains exactly five commands.

Files:

- `src-tauri/src/wire_contract.rs:683-706`
- `src-tauri/src/main.rs:59-68`
- `docs/decisions/1b-2a-notes.md:179-184`

Concrete divergence:

Add this only to `generate_handler!`:

```rust
commands::save_match,
```

Leave `COMMAND_NAMES` unchanged. The test builds `registered` by filtering the frontend-declared names through `main.rs` at `wire_contract.rs:695-699`. It never extracts registrations independently. All five declared names are still found, `declared.len() == 5`, and the test passes despite a prohibited mutating command being registered.

That contradicts both the test name—`the_frontend_command_names_are_the_registered_commands`—and the decision-record claim that command names are checked against registrations exactly.

No mutating command is currently registered; the issue is that the claimed scope-creep oracle would not detect one.

Recommended fix: independently parse the complete `generate_handler!` list, then compare that set bidirectionally with `COMMAND_NAMES`. Also assert that none of the six forbidden Phase 2 names appears in either set.

6. The error code set is not mechanically exhaustive, and frontend recovery silently absorbs new variants.

Files:

- `src-tauri/src/error.rs:119-139`
- `src-tauri/src/error.rs:204-246`
- `src/lib/ipc/errors.ts:248-258`
- `docs/decisions/1b-2a-notes.md:109-114`
- `docs/decisions/1b-2a-notes.md:270-272`
- `docs/decisions/1b-2a-notes.md:322-327`

The source-core conversions are sound: each `From<WorkspaceError>`, `From<DiscoveryError>`, and `From<IdentityError>` uses an exhaustive match, so a new core variant fails compilation.

`CommandError` itself is not covered the same way. A maintainer can:

1. Add a new `CommandError` variant.
2. Add arms to `code()`, `serialize()`, and `operand_count()`.
3. Omit it from `every_command_error()` and `COMMAND_ERROR_CODES`.

All current contract tests pass because both compared enumerations omit it. The notes acknowledge this at lines 270-272, but later say “The code sets are fixed and mechanically checked” at lines 322-327, which is false without qualification.

Separately, adding a new frontend `CommandError` member does not force `identityRecovery()` to be reviewed: its `default` returns `none`. The switch is therefore not exhaustive despite the decision record saying flattening enables an exhaustive frontend switch at lines 93-95.

Recommended fix: use compile-time exhaustive enumeration for `CommandError`, centralize the code list in one generated/schema-backed source, and replace `identityRecovery()`’s `default` with an exhaustive `never` assertion.

7. The TypeScript numeric types are broader than JavaScript can faithfully carry.

Files:

- `crates/espansoconfig-core/src/lib.rs:87-93`
- `crates/espansoconfig-core/src/workspace/mod.rs:209-248`
- `src/lib/ipc/types.ts:41-62`
- `src-tauri/src/error.rs:86-97`

`DocumentId` is a `u64`, while TypeScript declares it as `number`. JavaScript numbers cannot distinguish integers above `2^53 - 1`.

Concrete counterexample: Rust values `DocumentId(9_007_199_254_740_992)` and `DocumentId(9_007_199_254_740_993)` serialize as distinct JSON integers but become the same JavaScript number. Sending the latter identity back can address the former. The process-wide monotonic counter makes such values impractical in ordinary use, but the wire type claims fidelity Rust does not guarantee.

Recommended fix: serialize `DocumentId` as a decimal string or constrain/check it to JavaScript’s safe-integer range. Apply the same audit to every `usize` wire field, documenting any size invariant that makes it safe.

## Low

8. Several test names overclaim what their bodies establish.

Files:

- `src/lib/ipc/errors.test.ts:27-32`
- `src/lib/ipc/commands.test.ts:53-61`
- `src-tauri/src/wire_contract.rs:683-706`

Examples:

- “recognises every code the Rust side can produce” iterates `COMMAND_ERROR_CODES`, a frontend list. A Rust code omitted from that list is never exercised.
- “call the five wire names and nothing else” calls five known wrappers. A sixth exported wrapper can exist and remain uncalled.
- “frontend command names are the registered commands” checks only whether each frontend name occurs in `main.rs`, not whether `main.rs` contains additional registrations.

Recommended fix: narrow the test names to their actual assertions or strengthen the bodies with independently derived sets.

9. The decision record’s historical disabling experiments are not independently verifiable from the repository state.

File:

- `docs/decisions/1b-2a-notes.md:300-318`

The current bodies support that the described mutations should trigger the named assertions, but the claims that every mutation was actually performed, the quoted outputs occurred, and experiment A caused exactly four failures cannot be verified from the restored source alone.

Recommended fix: keep a reproducible mutation-test script or committed CI artifact if these historical executions are intended as evidence. Otherwise label the table as expected failure behavior derived from the current test bodies.

10. The new TypeScript tests do not consistently follow the literal “JSDoc on every TS function / closing comment over 10 lines” rule.

Files:

- `src/lib/ipc/commands.test.ts:48-51`
- `src/lib/ipc/commands.test.ts:53-121`
- `src/lib/ipc/errors.test.ts:27-113`

Vitest and lifecycle callbacks are functions, and several callbacks exceed ten lines without a closing-bracket comment; most have no per-function JSDoc.

Recommended fix: either apply the convention to callbacks as written, or clarify the binding rule to exempt framework callbacks. Under the current wording, these are violations.

## Confirmed non-findings

- `cargo tree -p espansoconfig-core | rg tauri` produced no matches.
- No mutating command or wrapper currently leaked into the registered IPC surface.
- The R27 Rust mapping itself is preserved: `IdentityError::StaleRevision` becomes `identityStaleRevision` through direct and dispatcher paths.
- `dispatch_check.rs` uses `get_ipc_response`, which calls the same `Webview::on_message` ACL logic as production. `MockRuntime` does not bypass that ACL branch. If these commands were plugin commands, an app ACL manifest existed, or the origin were remote without permission, the current test would observe the denial. Its claim is sound for Tauri 2.11.5’s current dispatcher behavior.
- The session mutex has no current re-entrancy path: every command takes one lock and makes no nested session call. Poisoning is explicitly absorbed at `commands.rs:138-143`; it does not return a typed error. This is a conscious availability tradeoff, not a deadlock in the present call graph.
- I found no committed real corpus content or owner-identifying configuration material in the reviewed files. The `/Users/somebody/...` test path is plainly synthetic.
- I found no current user-facing prose emitted by `CommandError`; its core-error conversions are exhaustive and do not use `Display`.

Codex session ID: 019fb77c-3942-77c1-a340-4074a0cdad09
Resume in Codex: codex resume 019fb77c-3942-77c1-a340-4074a0cdad09
