## Critical

None found.

## High

### 1–2. `document_text` is not a byte-fidelity API for non-UTF-8 files

The command is documented as returning the whole file “exactly as it is on disk” and as carrying “raw file bytes,” but its wire type is `String`, and the core rejects invalid UTF-8 before constructing a document. [commands.rs:134](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:134), [commands.rs:145](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:145), [workspace/mod.rs:628](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/workspace/mod.rs:628), [commands.ts:142](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.ts:142)

Concrete scenario: a discovered YAML file contains byte `0x80`. `std::fs::read` succeeds, but `String::from_utf8` returns `WorkspaceError::NotUtf8`; that is exhaustively converted to the typed `{code: "notUtf8", path, offset}` command error. It does not panic and is not decoded lossily, but the raw pane cannot receive or display the file at all. [workspace/mod.rs:630](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/workspace/mod.rs:630), [error.rs:432](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/error.rs:432)

This is the expensive Phase 2–5 inheritance point: `CommandResult<string>` cannot later represent arbitrary disk bytes without widening or replacing the wire format. The narrower truthful contract is “exact preservation of valid UTF-8; typed refusal otherwise.”

### 1. `value_text` has not crossed the Tauri IPC dispatcher in any fidelity test

The test named `an_unmodelled_entrys_value_crosses_as_its_own_bytes` projects in-process and calls `serde_json::to_value`; it does not build an app, invoke `get_document`, serialize a Tauri response body, or decode one. [wire_contract.rs:1125](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1125), [wire_contract.rs:1139](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1139), [wire_contract.rs:1146](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1146)

The dispatcher corpus sweep invokes only `document_text`; it never obtains an `UnknownEntry` through `get_document`. [dispatch_check.rs:413](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:413), [dispatch_check.rs:418](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:418)

Concrete failure scenario: a regression specific to serializing a `DocumentView` response drops or transforms `value_text`, while bare-string `document_text` remains correct. The model oracle, `serde_json::to_value` test, dispatcher corpus sweep, and mocked TypeScript wrapper tests would all still pass. Therefore the decision record’s claim that both new values crossed the IPC boundary intact is proven for `document_text`, but only asserted below the dispatcher for `value_text`. [1c-2b-2a-notes.md:92](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-2b-2a-notes.md:92)

## Medium

### 1. The tests stop before WKWebView, while public API comments claim what the webview receives

The dispatcher test explicitly substitutes `MockRuntime` and acknowledges that WKWebView string handling is invisible. [dispatch_check.rs:23](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:23), [dispatch_check.rs:86](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:86)

Nevertheless, `WorkspaceSession::text` says “what the webview receives is the file,” and the TypeScript wrapper says “Everything survives the crossing.” [commands.rs:149](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:149), [commands.ts:144](/Users/ccarpio/Developer/espansoConfig/src/lib/ipc/commands.ts:144)

Hazard status:

- BOM and astral text are proven through Tauri’s response-body encoder/decoder, but not through WKWebView/postMessage.
- NUL and U+2028/U+2029 are valid UTF-8 and valid Rust/JavaScript string content, but none of the explicit returned-value assertions exercises them; the asserted hazards stop at BOM, CRLF, final newline, composed/decomposed `é`, astral text, and terminal spaces. [dispatch_check.rs:447](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:447)
- A lone/unpaired surrogate cannot originate in a valid Rust `String`; its attempted UTF-8 byte encoding is invalid and is rejected by `String::from_utf8`. Thus this path cannot test it without changing the wire representation.
- Invalid UTF-8 is the typed `notUtf8` refusal described above.

A WKWebView-level defect affecting NUL or line-separator characters would therefore leave every current test green.

### 3. Disjoint spans bound duplication by the document size, but do not make uncapped payloads small or safe

The non-descent argument is consistent with the current traversal: unknown value spans are recorded and not descended into. [project.rs:187](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/project.rs:187), [project.rs:193](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/project.rs:193) This supports the claim that aggregate `value_text` is at most roughly one additional document’s text.

It does not establish an absolute bound. Each slice is allocated with `to_owned`, `get_document` clones the complete `DocumentView`, and synchronous commands run on the main thread. [unknown.rs:247](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/unknown.rs:247), [commands.rs:113](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:113), [commands.rs:31](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:31)

Concrete scenario: a very large valid-UTF-8 file contains one unknown block scalar spanning most of the file. The cache holds the source and its owned `value_text`; the command clones the view; Tauri then encodes another large response. This can multiply peak memory and block the UI even though the spans are perfectly disjoint. The corpus measurement of a 342-byte maximum says nothing about this pathological input. [1c-2b-2a-notes.md:74](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-2b-2a-notes.md:74)

The uncapped choice may still be acceptable for this bounded phase, but “a memory saving it does not need” is not proven.

### 4. The remote-origin test says all seven commands are refused but invokes only three

`a_remote_origin_is_refused` claims that a remote page cannot reach “any of the seven commands,” but its attempt table includes only `open_workspace`, `document_text`, and `set_menu_labels`. [dispatch_check.rs:712](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:712), [dispatch_check.rs:728](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:728)

Concrete failure scenario: remote access to `get_document` is accidentally permitted while those three commands remain denied. The test still passes despite its security claim being false.

For local reachability, the current six workspace commands are genuinely invoked, and the menu command reaches its own validation body. [dispatch_check.rs:220](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:220), [dispatch_check.rs:618](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:618) `wire_contract.rs`, however, proves only name-set equality by parsing `generate_handler!`; it does not prove dispatch reachability. [wire_contract.rs:1051](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1051), [wire_contract.rs:1086](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1086)

## Low

### 5. `every_command_refuses_before_a_workspace_is_open` omits the new command

The test calls `documents`, `document`, `reload`, and `match_view`, but never `WorkspaceSession::text`. [commands.rs:357](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:357), [commands.rs:365](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:365), [commands.rs:378](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:378)

Concrete failure scenario: `text` begins implicitly opening a workspace or returns an empty string before a workspace is open. The test named “every command” remains green. The shared `with_workspace` implementation currently prevents that defect, but the test name outruns its body.

## Claims that outrun the evidence

- “Raw file bytes,” “Everything,” and “what the webview receives is the file” omit the valid-UTF-8 restriction and the untested WKWebView hop. [commands.rs:143](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:143)
- `an_unmodelled_entrys_value_crosses_as_its_own_bytes` proves projection plus `serde_json::to_value`, not a Tauri IPC crossing. [wire_contract.rs:1133](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/wire_contract.rs:1133)
- The decision record says `dispatch_check.rs` proves seven commands reachable and both new values cross intact; reachability is proven for the current seven, but dispatcher fidelity is tested only for `document_text`. [1c-2b-2a-notes.md:34](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-2b-2a-notes.md:34)
- `a_remote_origin_is_refused` claims all seven while checking three. [dispatch_check.rs:712](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/dispatch_check.rs:712)
- `every_command_refuses_before_a_workspace_is_open` does not check `document_text`. [commands.rs:358](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:358)

No architecture, privacy, i18n, corpus-fixture, or D2u regression was evident in the reviewed change.

Codex session ID: 019fb994-05e2-7cc0-b988-cbe922cd553a
Resume in Codex: codex resume 019fb994-05e2-7cc0-b988-cbe922cd553a
