# Phase 4-21 — Regex bench core and read-only wire

**Status:** implementation record for step 4-21 of [`4-split-notes.md`](4-split-notes.md) §2, under
ruling 28 of §3 (the bench runs in Rust with this crate's `regex`, first-match search without added
anchors; JavaScript `RegExp` is never used). Core-first: **no Svelte component calls anything this step
adds** (a typed IPC wrapper and i18n accessors only; the bench UI and `regexBench.ts` are 4-22's). Taken
in numeric order; §4.4's early-run allowance was not used. No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Core: `crates/espansoconfig-core/src/regex_bench.rs` (new module)

- **`test_regex(request)`** and **`test_regex_with_limits(request, limits)`**: a pure function of one
  `RegexBenchRequest { request_id, pattern, sample }`. No document, identity, lock, file I/O, clock or
  environment read. The pattern is compiled by `regex::RegexBuilder` with
  `size_limit(limits.compiled_bytes)` and `dfa_size_limit(limits.dfa_cache_bytes)` and searched once with
  `Regex::captures` (leftmost-first, unanchored).
- **Outbound:** `RegexBenchAnswer { request_id, engine, outcome }`. `engine` is the constant
  `ENGINE = RegexEngine { name: "regex", version: "1.13.1" }`. `outcome` is
  `RegexOutcome::Tested { group_names, found }` or `RegexOutcome::Refused { refusal }`.
  `found: Option<RegexFound { whole: RegexSpan, groups: Vec<RegexGroup { name, capture: Option<RegexSpan> }> }>`;
  `RegexSpan { text, utf16_start, utf16_end }`.
- **Codes:** `RegexRefusal` (5): `PatternTooLarge`, `SampleTooLarge`, `CaptureLimit`,
  `CompileRejected { reason: RegexCompileFailure }`, `OutputLimit`. `RegexCompileFailure` (3): `Syntax`,
  `CompiledTooBig`, `Other` (for `regex::Error` being non-exhaustive).
- **`RegexBenchLimits::DEFAULT`**: 8 KiB pattern, 64 KiB sample, 128 named groups, 1 MiB compiled size,
  1 MiB DFA cache, 128 KiB response.
- **`RegexBenchRequest`'s `Debug` is written by hand** and prints the id and the two byte lengths, never
  the texts.
- `lib.rs`: `pub mod regex_bench;` and a 4-21 line in the phase list. `Cargo.toml`: `serde_json` moved
  from `[dev-dependencies]` to `[dependencies]` (already in the lockfile; no new crate), and the `regex`
  comment now names `regex_bench` as its second confinement.

### 1.2 Tauri: one stateless command

`commands::test_regex(request_id, pattern, sample) -> RegexBenchAnswer` in `src-tauri/src/commands.rs`,
one call into the core. **It takes no `State`**, so it needs no open workspace. It is declared
`#[tauri::command(async)]`, the third command off the main thread (§3 item 6). Registered in `main.rs`
after `update_sidecar`. Module headers of `commands.rs` and `main.rs` restate the counts (twenty-nine
registered commands; "every command but three is synchronous").

### 1.3 Wire mirror, contracts, i18n

- `src/lib/ipc/types.ts`: `RegexEngine`, `RegexCompileFailure`, `RegexRefusal`, `RegexRefusalName`,
  `RegexSpan`, `RegexGroup`, `RegexFound`, `RegexOutcome`, `RegexBenchAnswer`.
  `src/lib/ipc/commands.ts`: `testRegex(requestId, pattern, sample)` (JSDoc'd), `COMMAND_NAMES` 27 → 28
  (`test_regex` last). Not re-exported from `src/lib/ipc/index.ts`; no component imports it.
- `wire_contract.rs`: the registry test renamed `the_registered_commands_are_the_frontend_twenty_eight_and_the_menu_command`
  (28 declared / 29 registered, `test_regex` asserted a non-writer); the async-attribute scan 27 → 28
  commands with `test_regex` in the asynchronous set; new
  **`the_regex_bench_shapes_declare_exactly_what_rust_writes`** and
  **`the_regex_bench_is_stateless_and_logs_nothing`** (with `LOGGING_IDENTIFIERS` and
  `STATEFUL_IDENTIFIERS`).
- `dictionary_contract.rs`: two namespaces (`regexRefusal` 5, `regexCompileFailure` 3); `RegexOutcome`
  on `NOT_A_CODE` with its reason.
- `dispatch_check.rs`: the remote-origin sweep 28 → 29 and
  **`the_regex_bench_is_reachable_with_no_workspace_open`**.
- **i18n: 8 keys per language.** `codes.ts`: `regexRefusalKey`/`describeRegexRefusal`,
  `regexCompileFailureKey`/`describeRegexCompileFailure`, registered in `CODE_NAMESPACE_KEY_BUILDERS`
  (samples in `codes.test.ts`); reactive `tRegexRefusal`, `tRegexCompileFailure` in `index.ts`. No
  sentence interpolates an operand or quotes the pattern; the compile sentences name "the version
  espansoConfig uses" and none claims what espanso accepts. The user-facing word is "regex test" /
  "prueba de expresiones regulares"; 4-22 may rename it when it draws the surface.

## 2. How each acceptance clause is met

Core: `crates/espansoconfig-core/tests/regex_bench.rs` (14). Command level: `wire_contract.rs` (2),
`dispatch_check.rs` (1). i18n: `src/lib/i18n/regexCodes.test.ts` (3); IPC: one case in
`commands.test.ts`.

| Clause | Evidence |
|---|---|
| Compile / no match / match | `a_pattern_compiles_and_matches_or_does_not` (first match, no added anchor, id echoed; no match still lists names; unclosed group and duplicate name are `CompileRejected { Syntax }`; the JSON shapes); dispatcher twin |
| Optional captures | `named_groups_are_listed_in_pattern_order_and_unmatched_ones_are_none` (optional absent, alternative not taken, unnamed group not listed, a participating empty group is `Some("")` not `None`, `null` on the wire) |
| Unicode | `unicode_text_is_cut_in_rust_and_positioned_in_utf16_units` (precomposed and decomposed `é`, astral `😀`, CJK; `\p{…}`, Unicode `\w` and `.`; a Unicode group name; every span equals the UTF-16 slice of the sample) |
| Zero-width matches | `zero_width_matches_are_representable` (`a*` on `bbb`, `\b`, `$` after an astral char, empty pattern, empty sample, an empty group) |
| Each limit at and past its boundary | `the_pattern_limit_holds_at_the_boundary` (8192 / 8193 bytes, also with two-byte characters; checked first), `the_sample_limit_holds_at_the_boundary` (65 536 / 65 537, also with three-byte characters; checked before compiling), `the_named_group_limit_holds_at_the_boundary` (128 / 129; unnamed groups not counted), `the_compiled_size_limit_holds_at_the_boundary` (the exact limit a pattern compiles under, and one byte below it refused; under the default, `\w{n}` fits and `\w{n+1}` is `CompiledTooBig` yet compiles under twice the limit), `the_dfa_cache_limit_bounds_memory_and_never_refuses`, `the_response_limit_holds_at_the_boundary` (an answer of exactly 131 072 serialized bytes is returned, 131 073 is `OutputLimit`; JSON escaping counted; nested groups refused before being built), `the_default_limits_are_the_ones_the_step_names` |
| Result text cut in Rust | every span is sliced in `span_of`; the Unicode and zero-width tests compare text and UTF-16 positions; no byte offset crosses (`!json.contains("byte")`) |
| Pattern and sample never logged | `the_regex_bench_is_stateless_and_logs_nothing` (the core module and the command's signature and body name no printing/logging identifier, no session, identity, lock, writer or filesystem; controls non-vacuous); `neither_the_pattern_nor_the_sample_is_echoed_outside_the_found_text` (regex's own syntax message quotes the pattern — premise asserted — and no answer does; `Debug` prints lengths); the dispatcher test's `SECRET(` |
| Engine names the locked version | `the_engine_named_is_the_one_the_lockfile_pins` (reads `Cargo.lock`, every `regex` package block, compares to `ENGINE.version`) |
| No document, identity, lock or file I/O | the stateless scan above, and the dispatcher test runs with **no workspace opened** |

## 3. Decisions

1. **Offsets are UTF-16 code units, named so** (`utf16_start`, `utf16_end`), and the text is cut in
   Rust. A JavaScript `sample.slice(utf16_start, utf16_end)` on the string sent equals `text`; no byte
   offset crosses the wire (`CLAUDE.md` §6). TypeScript cannot check the caller slices the same string
   it sent; the type's doc comment says so.
2. **Named groups only.** espanso turns a regex trigger's named captures into variables; unnamed groups
   still take part in the match but are not listed and do not count toward the 128.
   `group_names` is present on every `Tested` answer, matched or not, so 4-22 can offer captures from
   a compiling pattern with no match.
3. **Compile-error text policy: never returned.** `regex` formats a syntax error by quoting the pattern
   with a caret under the fault, so returning it would echo the pattern; `CompileRejected` carries a
   closed `RegexCompileFailure` code instead. The cost is that the UI cannot point at the fault position
   (§5 item 1).
4. **Boundaries are inclusive** for every limit: at the limit answered, one unit past refused. Units:
   pattern and sample in UTF-8 bytes; named groups by count; compiled size and DFA cache in `regex`'s own
   measure; the response in bytes of the whole `RegexBenchAnswer` as `serde_json` writes it (the
   serializer Tauri answers with). Checks run pattern → sample → parse and named groups → compile →
   search → response, and the first failed one is the only refusal (order as corrected by §8).
5. **Output-limit measurement** is a counting `io::Write` that fails at the first byte past the limit,
   so an oversized answer is never fully serialized. A running total of raw text bytes during the build
   refuses earlier (serialized text is never shorter than its raw bytes), so an answer with many
   overlapping 64 KiB groups is not built. A refusal answer carries no text (the test bounds it under 200 bytes).
6. **`async` command.** The search is linear in the sample but its constant grows with the compiled
   program; a 64 KiB sample against a program near 1 MiB would freeze the window on the main thread.
   Nothing is awaited inside.
7. **A refusal is an answer, not a `CommandError`**, so `request_id` is echoed on every outcome and
   4-22 can discard stale replies uniformly. The command is infallible past argument deserialization.
8. **The DFA cache limit is a setting, not a refusal**: `regex` falls back to a slower engine when the
   lazy DFA's cache is too small. It is pinned by a text check that the builder receives it and by a
   behavioural test that a 1-byte cache answers identically.
9. **Wire spelling deviation:** the step writes `test_regex({ request_id, pattern, sample })`; the
   frontend sends `requestId` in camel case, as every multi-word argument on this boundary is sent
   (`baseRevision`), and the dispatcher test asserts `request_id` is refused. The answer's own field is
   `request_id` (serde's spelling, as every answer field).
10. **`serde_json` became a normal core dependency** for decision 5. It was already locked (tests and
    `src-tauri`), pulls in no tauri, and `cargo tree -p espansoconfig-core | rg tauri` still finds
    nothing.
11. **Citation drift:** §2 of the split notes cites `Cargo.lock:2536-2537`; the `regex` block now stands
    at lines 2566-2567. The version (1.13.1) is unchanged, and the test pins the version, not the lines.

## 4. What is and is not guaranteed

- **Pinned by tests:** every limit at and past its boundary except the compiled-size limit's absolute
  value (below); the texts cut in Rust and positioned in UTF-16 units; no pattern or sample text in any
  answer beyond the found text, nor in a request's `Debug`; the engine version against `Cargo.lock`;
  reachability with no workspace; the remote-origin refusal.
- **A text scan, not a call graph:** "never logged" and "stateless" are the absence of a fixed
  vocabulary (`println`, `eprintln`, `print`, `eprint`, `dbg`, `log`, `tracing`, `env_logger`, `info`,
  `debug`, `warn`, `trace`, `stdout`, `stderr`; session, identity, lock, writer and filesystem names) in
  the core module and the command. A facility reached under another name, inside `regex`, or by Tauri's
  own IPC layer logging arguments is not seen.
- **The compiled-size limit's absolute value** is pinned only by the text check that
  `.size_limit(limits.compiled_bytes)` is called and by the constant: `regex` measures in its own unit,
  and mutation M5 (the limit quadrupled inside the builder call) was caught by that text check alone.
- **Nothing here says anything about espanso** (1.5.5 versus 1.13.1). The bilingual compatibility
  sentence is 4-22's.

## 5. Open items for later steps

1. **Fault position for a syntax error (4-22 or later).** `regex_syntax::Error` carries a span, but
   `regex::Error::Syntax` exposes only the formatted string. Reporting a position without echoing text
   would need `regex-syntax` as a direct dependency and a parse before the compile.
2. **Stale-reply handling is the caller's** (4-22's `regexBench.ts`): the id is echoed; nothing in
   Rust or `commands.ts` compares it.
3. **Textarea normalization** (`CLAUDE.md` §6): a sample typed in a `<textarea>` has its line breaks
   normalized to LF before it is sent; 4-22 decides whether the bench says so.
4. **8 new keys per language** join the Phase 4 translation inventory (4-24). No sentence has been read
   on a window.
5. **Limits in sentences:** the refusal sentences state no number; if 4-22 wants "8 KiB" on screen it
   should receive the limits from Rust rather than write them into the dictionaries.
6. Pre-existing and not touched: the `commands.ts` header still reads "The twenty-two workspace
   commands"; the `dictionary_contract.rs` header's enum count is stale.

## 6. Failing-first evidence, by mutation

The tests were written with the module, so failing-first is shown by mutation (git was not used):
fourteen mutations applied, run and restored byte for byte by `/private/tmp/4-21/worker/mutate.py`;
outputs `/private/tmp/4-21/worker/mutations/M*.txt`, summary `mutations/summary.txt`.

| # | Mutation | Failed |
|---|---|---|
| M1 | pattern limit off by one | pattern boundary |
| M2 | sample limit off by one | sample boundary, response boundary |
| M3 | named-group limit off by one | named-group boundary |
| M4 | response limit off by one | response boundary |
| M5 | compiled-size limit quadrupled in the builder | `the_default_limits_are_the_ones_the_step_names` (the text check only; §4) |
| M6 | byte offsets instead of UTF-16 | Unicode, zero-width, sample boundary |
| M7 | unnamed groups reported | named groups, named-group boundary |
| M8 | an unmatched group reported as an empty capture | named groups, named-group boundary |
| M9 | `Debug` prints the pattern | the no-echo test |
| M10 | engine version drifts from `Cargo.lock` | the lockfile test |
| M11 | the response never measured | response boundary |
| M12 | the counting writer never refuses | *did not build; discarded* (M4 and M11 cover the writer) |
| M13 | the command prints the pattern's length | `the_regex_bench_is_stateless_and_logs_nothing` |
| M14 | the command takes the workspace session | `the_regex_bench_is_stateless_and_logs_nothing` |

## 7. Verification

All exit 0, run serially, outputs under `/private/tmp/4-21/worker/`: `cargo test --workspace --
--test-threads=1` (`cargo-test.txt`; the first run failed two prose sweeps — `liveness_contract` and
`retained_state_contract` flagged the phrases "is answered" and "cannot observe" in the new module's
comments; reworded, re-run green), `cargo clippy --workspace --all-targets -- -D warnings` (`clippy.txt`),
`cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check.txt`: 515 files, 0 errors, 0
warnings), `npm test` (`npm-test.txt`), `npm run build` (`npm-build.txt`); `cargo tree -p
espansoconfig-core | rg tauri` finds nothing (`cargo-tree.txt`); bundle oracle — server-only pattern
absent, client-only present.

Rung **`1806 / 515 / 4545 / 231`** (was `1789 / 514 / 4540 / 231`): +17 Rust tests (14 core, 2 wire
contract, 1 dispatcher); +1 `svelte-check` file (`regexCodes.test.ts`); +5 vitest tests (3 in
`regexCodes.test.ts`, 1 in `commands.test.ts`, and 1 more from an existing suite that iterates the
namespaces, not traced further); Vite modules unchanged — no new module enters the bundle.

## 8. Review fix (`docs/reviews/4-21.md`, one should-fix)

**Finding:** `regex` 1.13.1 removes a subexpression repeated `{0}` while compiling, so
`Regex::capture_names()` does not list every declared name. For `(?P<hidden>a){0}(?P<live>b)` the answer
omitted `hidden`, and `CaptureLimit` counted compiled rather than declared groups, so 128 live names
plus any number under `{0}` passed.

**Fix** (`regex_bench.rs`, `search` and the new `declared_names`/`NamedGroups`): the declared named groups
are read in pattern order from `regex-syntax`'s AST (`ast::parse::Parser`, the parser `regex` itself runs
first, same default nesting limit of 250) with a pre-order `ast::Visitor`, which walks on a heap stack.
Chosen over the HIR because the HIR translator is where simplification begins and `regex` does not expose
either; the AST is the earliest faithful record of what the pattern declares. `CaptureLimit` is enforced on
that list **before compiling**; every declared name is reported, and one the compiled regex lacks (looked
up by name in `capture_names`) or that did not participate comes back `capture: None`. A parser refusal
answers `CompileRejected { Syntax }` and its message, which quotes the pattern, is dropped.

**Dependency:** `regex-syntax` is now a **direct** dependency (workspace `Cargo.toml`, `default-features =
false, features = ["std"]`; core `Cargo.toml`). It was already locked at 0.8.11 as `regex`'s own
dependency, so no crate enters the lockfile, and `cargo tree -p espansoconfig-core | rg tauri` still finds
nothing.

**Tests** (`crates/espansoconfig-core/tests/regex_bench.rs`, +3):
`a_group_repeated_zero_times_is_still_declared_and_comes_back_unmatched` (hidden then live; nested under
`{0}` with no match), `the_named_group_limit_counts_declared_groups_not_compiled_ones` (128 live + 1
hidden refused; 129 all hidden refused; 127 live + 1 hidden answered with all 128 listed; a pattern past
the group limit and too big to compile answers `CaptureLimit`, so the limit precedes the compile), and
`a_duplicate_name_is_refused_even_when_one_copy_is_hidden` (three spellings; the answer carries no pattern
text). **Failing-first** (`/private/tmp/4-21/review-failfirst.txt`, against the unfixed module): the first two
failed; the duplicate test already passed, because both parsers refuse a duplicate name; it is kept as a
regression guard for the new parse step.

**Verification:** outputs `/private/tmp/4-21/worker/*-after-fix.txt`; see the report for exit statuses.
