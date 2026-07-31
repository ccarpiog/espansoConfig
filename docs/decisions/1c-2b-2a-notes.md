# Phase 1c-2b-2a — the boundary: the raw-text wire widening

**What this sub-phase is.** The point at which a file's own text starts crossing the IPC boundary. Two
things were added and **nothing was put on a screen**: a seventh Tauri command, `document_text`, and
one wire field, `UnknownEntry.value_text`. 1c-2b-2b renders them; this sub-phase decides what a byte
is worth on the way across, and pins each answer.

**The contract, stated once and narrowly: exact preservation of valid UTF-8, and a typed refusal
otherwise.** Both new values are JSON strings, and a JSON string cannot hold a byte sequence that is
not valid UTF-8. This document originally said "raw file bytes" and "exactly as it is on disk"; the
review of this sub-phase was right that those words describe an API this is not. Section 3.1 records
the decision, and its cost, in the terms Phases 2–5 inherit it.

The split follows the one 1b-2 used. 1c-2b-2a fails as a **data-format decision later phases
inherit**; 1c-2b-2b fails as a viewer that normalises what it was handed. Keeping them apart means the
format question was answered against `std::fs::read` rather than against a screenshot.

**No dictionary key changed, in either language.** That is a consequence of the split, not an
oversight: this sub-phase adds no prose because it adds no screen. Section 4 says what that does and
does not mean.

---

## 1. What was built

**`commands::document_text` in `src-tauri/src/commands.rs`**, over the new
`WorkspaceSession::text()`, registered in `main.rs`'s `generate_handler!` as the seventh command and
the sixth read-only one. It answers a document's whole text as a JSON string, **including for a
document that failed to parse** — the file a reader most needs is the one the parser refused.

**`documentText(id)` in `src/lib/ipc/commands.ts`**, with `'document_text'` in `COMMAND_NAMES` and
the wrapper re-exported from `src/lib/ipc/index.ts`. It has **no caller yet**; section 8 says why
that is not the same as tree-shaking being evidence of anything.

**`UnknownEntry.value_text: String`** in `crates/espansoconfig-core/src/model/unknown.rs`, sliced by
`MappingScan::skip`, which now takes the document's `source`. Mirrored in `src/lib/ipc/types.ts`.
Closes `1c-2a-notes.md` §12 hole 13 **on the wire only** — `detail.ts` deliberately still does not
read it, so the pane's existing strings stay true.

**Contract updates.** `dispatch_check.rs` proves **seven** commands reachable with
`"permissions": []`, and — since the review — attempts all seven from a remote origin, with the
attempt table compared against the same independently parsed `generate_handler!` list.
`wire_contract.rs` asserts six read-only names plus one menu name against that list, and still
asserts the six forbidden Phase 2 names absent from both sets.

**Dispatcher-level fidelity for both values.** `document_text` is swept over the corpus, and
`an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte` fetches a document through
`get_document` over the real dispatcher and compares each answered `value_text` with a Rust-side
slice of the file's own bytes by the `value_span` that arrived beside it. Before the review the
second value had never crossed the dispatcher in any test.

---

## 2. Decision — `document_text` is a command, and it was never one

`PROGRESS.md`'s "Next action" already carried the correction, and it was right: `document_text` was a
`Workspace` method with no command, no `types.ts` entry and no wrapper. The earlier claim that it was
"the one command with no frontend caller, tree-shaken out of `dist`" conflated two different things.
Both halves are now separately true and separately checked:

- it **is** registered, and `dispatch_check.rs` drives it through the real dispatcher rather than
  arguing from the macro's presence;
- its wrapper **is** absent from `dist` (`rg -c document_text dist/assets/*.js` finds nothing after
  `npm run build`), because nothing calls it. That is a fact about the bundler, and it is **not**
  evidence about registration in either direction.

The capability question was re-asked rather than inherited. `capabilities/default.json` stays at
`"permissions": []`, and the seventh command is driven through the shipped configuration and the
shipped capability file exactly as the other six are. `a_remote_origin_is_refused` now attempts **all
seven** — the review found it claiming seven and invoking three — and `document_text` is the entry
that matters most in it: it is the command that hands out the contents of the user's files, so a
navigated or compromised webview reaching it would be the worst outcome on this surface. Every one is
refused with the dispatcher's string, not with one of our codes, and the attempt table is asserted
equal to the names parsed out of `generate_handler!` so that an eighth command cannot be added and
left out of the sweep.

---

## 3. Decision — the value text is **uncapped**, and the wire carries no truncation flag

The brief asked for this decision to be made deliberately. It was, and the answer is **no cap**.

**Why not.** A cap needs a flag, because *a truncated value that does not say it is truncated is this
project's signature failure mode* — it is the 1c-2a review's first finding in a new costume, and the
same class as D2u and R16. A flag needs a string, a string needs both dictionaries, and a string on a
screen needs 1c-2b-2b. So a cap would have cost this sub-phase a user-facing claim it has no screen to
put anywhere, in exchange for a bound this phase has no measured need of.

**What the disjointness argument actually bounds, and what it does not.** The projection **does not
descend into an unmodelled value** (`Projector::close` records both spans as undescended), so no
unknown entry's value span can contain another unknown entry's. The value spans of one document are
therefore pairwise disjoint, and the sum of every `value_text` in a document is bounded by the
document's own length.

That bounds **duplication — one extra copy of the document's text at most — and nothing else.** The
review's third medium finding is correct and this paragraph used to overstate it: an absolute size
bound is not what follows. Each slice is allocated with `to_owned` in
`MappingScan::skip`; `WorkspaceSession::document` clones the whole `DocumentView` out of the cache;
Tauri then encodes that clone into a response body; and every command here is synchronous, so all of
it happens on the main thread. A single very large valid-UTF-8 file holding **one** unknown block
scalar that spans most of it therefore costs the cache's copy, the entry's copy, the command's clone
and the encoded body — a multiple of the file size, in peak memory, with the UI blocked meanwhile.
Disjointness says nothing about that case, and the corpus measurement below says nothing about it
either. It is recorded as hole 10 rather than argued away.

Measured over the committed corpus: **20 unmodelled entries, 2 369 bytes carried in total, widest
single value 342 bytes**, printed by `every_synthetic_unmodelled_entry_carries_the_bytes_of_its_span`.
That is a fact about *this corpus*, not a bound on any input. The real corpus carries **zero**
(section 9, hole 2).

**The decision stands.** For a bounded read-only phase over an espanso configuration directory — files
a human wrote and espanso reads on every keystroke — an unflagged truncation is a worse failure than a
large allocation, and the flag a cap needs cannot be built without a screen. A phase that wants the
pathological input handled should reach for streaming or an async command, not for a silent prefix.

**What the wire says about it.** Nothing, deliberately — there is no `truncated` field, because
nothing truncates. If a later phase adds a cap, it must add the flag in the same change:
`a_truncated_unknown_value_is_caught_by_the_oracle` is written so that a cap fails the suite, and the
padded-value arm is there so that a cap which pads back to the right length fails it too.

`MatchView.source_text`, which set the precedent at 1a, is also uncapped. Two uncapped source-text
fields on one wire is a consistent format; one capped and one not would be a trap.

### 3.1 Decision — the wire carries **text**, not bytes, and that is a Phase 2–5 inheritance

`CommandResult<string>` on the frontend and `Result<String, CommandError>` in Rust **cannot represent
arbitrary disk bytes.** This was true before the review and the review is what made it explicit; it is
recorded here as a decision with its cost, because the alternatives were available and were not taken.

**What the code does, and has always done.** `read_utf8` in
`crates/espansoconfig-core/src/workspace/mod.rs` reads with `std::fs::read` and then
`String::from_utf8`. A file containing, say, a lone `0x80` fails that conversion and becomes
`WorkspaceError::NotUtf8 { path, offset }`, where `offset` is `valid_up_to()` — the byte position of
the first invalid sequence. `src-tauri/src/error.rs` maps it exhaustively to
`CommandError::NotUtf8`, which crosses as `{ code: "notUtf8", path, offset }`. No panic, no lossy
decode, no U+FFFD substitution.

**What that costs the user.** The raw pane cannot show that file **at all**. A typed refusal naming a
byte offset is the honest answer and a far better one than a silently mangled document — this project
exists to not mangle documents — but it is a refusal, and 1c-2b-2b has to render it as one rather than
as an empty file.

**What it costs later phases.** Widening this is a **wire-format** change, not a change to a command
body. Anything that wants arbitrary bytes on this wire needs a different representation — base64, a
`{ text, bytes }` union, a byte array, or a raw-response channel — and every consumer of
`document_text` and of `UnknownEntry.value_text` changes with it. Phases 2–5 inherit that: a save
transaction that round-trips a non-UTF-8 file cannot be built on the current format either, since the
file never becomes a `String` to begin with.

**Why it was not widened here.** espanso reads its own configuration as UTF-8 YAML, so a non-UTF-8
config file is already broken for espanso before this application sees it; a boundary sub-phase with
no screen is the wrong place to invent a second representation; and the refusal is typed, positioned
and testable, which is the standard this project holds every other refusal to. What was wrong was the
*wording* — "raw file bytes", "exactly as it is on disk", "Everything survives the crossing", "what
the webview receives is the file" — and every one of those has been narrowed to the contract above, in
`src-tauri/src/commands.rs`, `src-tauri/src/dispatch_check.rs`,
`crates/espansoconfig-core/src/workspace/mod.rs`, `src/lib/ipc/commands.ts` and this document.

**Nothing here pins the refusal.** No test in this sub-phase drives a non-UTF-8 file; the `notUtf8`
path is pinned in the core, where the error is constructed. That is section 9's hole 8, unchanged.

---

## 4. The fidelity rules, one by one

**Both new values are text: valid UTF-8, preserved exactly.** Section 3.1 is the other half — a file
that is not valid UTF-8 never becomes either value. Here is what happens to each hazard, where the
answer is decidable, and what pins it. **Every row was measured, not argued.**

| Hazard | `document_text` | `UnknownEntry.value_text` | Pinned by |
|---|---|---|---|
| CRLF line endings | survives | survives | `document_text_answers_every_synthetic_fixture_byte_for_byte` (CRLF pairs counted **on what came back**, and equal to the LF count); `an_unmodelled_value_keeps_its_line_endings_indentation_and_unicode`; `dispatch_check::an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte` |
| Leading UTF-8 BOM | survives | n/a (never inside a value span) | the sweep above asserts `starts_with('\u{feff}')` on the answer |
| No final newline | survives | survives | the sweep asserts `!ends_with('\n')` on the answer |
| Precomposed `é` (U+00E9) | survives | survives | the sweep, plus `wire_contract::an_unmodelled_entrys_value_crosses_as_its_own_bytes` and the dispatcher test above |
| Decomposed `é` (U+0065 U+0301) | survives, **uncomposed** | survives, uncomposed | as above; the assertion is on the two code points, so a normaliser fails it |
| Astral `😀` (U+1F600) | survives | survives | as above |
| Block-scalar terminal spaces | survive | survive | the sweep asserts `ends_with("  ")`; the hand-written test asserts `contains("spaces  ")`; the dispatcher value-text test asserts `contains("line  \n")` |
| Interior indentation | survives | survives | byte-for-byte comparison against `std::fs::read` |
| NUL (U+0000) | survives | **not measured — hole 9** | `commands::document_text_hands_back_the_file_byte_for_byte` and `dispatch_check::document_text_carries_a_nul_and_the_two_unicode_line_separators`, both over **hand-written** sources; `src/lib/ipc/commands.test.ts` on the wrapper. Nothing pins it for `value_text`: a source holding a NUL does not parse, so it yields no unmodelled entry |
| Line separator (U+2028) | survives | survives | as above for `document_text`; `dispatch_check::an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte` for the value, whose fourth unrecognised key carries it |
| Paragraph separator (U+2029) | survives | survives | as above |
| Lone surrogate | **cannot arise** | cannot arise | not a test but a property: a Rust `String` cannot hold one, and its would-be UTF-8 encoding is invalid, so `String::from_utf8` rejects the file. Testing it would require changing the wire representation (section 3.1) |
| Not valid UTF-8 at all | **typed `notUtf8` refusal** | never built | section 3.1; the refusal is constructed and pinned in the core, not here (hole 8) |

**Which of the three a `value_text` fixture can hold was measured, not reasoned.** That fixture has to
*parse* or it yields no unmodelled entry at all. `SyntaxIndex::parse` refuses a source containing
U+0000 — putting one in made the response's `parsed` come back `false` — and accepts U+2028 and
U+2029, so `UNMODELLED_HAZARDS` carries those two in a fourth unrecognised key and no NUL. The one
remaining gap is `value_text` and a NUL, hole 9. All three of the hazards in the last three rows are
pinned by **hand-written sources rather than corpus fixtures**, which is an R20 deviation of the same
kind as hole 1 and is recorded with it.

**Where the characters are written as `\u{…}` escapes, that is the point.** A literal `é` in a test
file can be normalised by an editor, at which point the test would agree with a normalising boundary
instead of catching it. Every Unicode assertion in this sub-phase is written as escapes, in
`dispatch_check.rs`, `commands.rs`, `wire_contract.rs`, `model_projection.rs` and
`src/lib/ipc/commands.test.ts` alike.

### 4.1 Why the JSON encoding is not taken on trust

`serde_json` escapes what JSON requires — `"`, `\` and the C0 controls, `\r` and `\n` among them —
and a parser reverses those escapes exactly. That paragraph is an *argument*. Three tests replace it
with a measurement, each at the level where the answer is actually decidable:

1. **`commands::document_text_hands_back_the_file_byte_for_byte`** — the command's own answer against
   the file's bytes, **and** a `serde_json::to_string` / `from_str` round trip asserted separately,
   because the command can be right while the encoding loses a byte and that is the failure a caller
   would see.
2. **`dispatch_check::document_text_answers_every_synthetic_fixture_byte_for_byte`** — the whole
   committed corpus copied into a workspace with `fs::copy`, asked for over the **real IPC
   dispatcher**, and each answer compared byte for byte with `std::fs::read` of the file that was
   copied. `get_ipc_response` returns the response body Tauri really builds, so the JSON encoding and
   decoding are inside the measurement rather than beside it. **33 fixtures, 37 406 bytes, all
   identical.**
3. **`src/lib/ipc/commands.test.ts`** — the frontend wrapper hands the string back untouched. Its
   sample gained the NUL and the two separators at the review, because a JavaScript string is where
   U+2028 has historically been mishandled. `invoke` is mocked in that file, so what it says is a fact
   about the wrapper and nothing else.
4. **`dispatch_check::an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte`** — added
   at the review, and the only test in which `value_text` crosses the dispatcher at all. The document
   is fetched with `get_document` over IPC and each answered `value_text` is compared with
   `std::fs::read` of the file sliced by the `value_span` that arrived beside it. **4 entries, 128
   bytes.** The entries are found in the response **by shape** — an object carrying both `value_span`
   and `value_text` — so a regression that drops the field fails the count assertion rather than
   silently emptying the sweep.

### 4.2 The one thing that genuinely does not survive, and it is not the text

A **byte offset is not a JavaScript string index.** A JavaScript string is indexed in UTF-16 code
units; every span on this wire counts bytes. `text.slice(span.start, span.end)` is wrong for any
document containing a non-ASCII character before the span, and wrong by a different amount again for
an astral one.

This is why `value_text` is sliced in Rust and carried rather than reconstructed — the confusion the
core's `CharToByte` adapter exists to prevent inside the parser, prevented once more at the boundary.
It is stated on the field, on the command wrapper and on the TypeScript mirror, and **experiment J**
(section 6) is the demonstration: slicing by `chars()` instead of bytes fails four tests.

### 4.3 What is *not* measured — a named limitation, not an implication

`mock_builder()` swaps the platform webview out. So the evidence above covers everything up to and
including the response body's JSON encoding and decoding, and says **nothing** about WKWebView's own
string handling, about `postMessage`, or about what a browser engine does with a lone surrogate.
Closing it needs a reading of a running window, which is 1c-2b-2b's — it is the sub-phase that will
have something on screen to read.

**This paragraph was true and three doc comments disagreed with it.** The review's first medium
finding: `WorkspaceSession::text` said "what the webview receives is the file" and
`src/lib/ipc/commands.ts` said "Everything survives the crossing", both of which claim the hop this
section says is not measured. They now say what the tests say — the response body Tauri builds — and
each names this section. `dispatch_check.rs`'s module documentation carries the rule in a form a
future change can be checked against: **no doc comment, test name or assertion message in this
repository may say what "the webview receives".** A WKWebView-level defect affecting NUL or the line
separators would still leave every test in this repository green; that is what a hole is.

---

## 5. The strings, and R31's blind spots by name

**This sub-phase added no user-facing string, in either language.** `en.json` and `es.json` are
byte-identical to their 1c-2b-1 state and appear in no diff. That is a fact about the split, and it
has a consequence worth stating: **a clean `hardcoded-strings.ts` run says even less than usual
here**, because the scanner only reads `.svelte` markup and this sub-phase changed one `.svelte`
comment and nothing else in any component.

R31's blind spots, enumerated by name for the code this sub-phase actually touched:

1. **Rust doc comments and `panic!` / `assert!` messages.** `dispatch_check.rs`, `commands.rs`,
   `wire_contract.rs` and `model_projection.rs` gained a great deal of English. None of it is
   user-facing — it reaches a developer's terminal, never a window — and no lint in this repository
   looks at Rust text at all. The rule that covers it is CLAUDE.md §5 (all code and comments in
   English), which is satisfied by construction.
2. **`.ts` files.** `commands.ts`, `types.ts`, `index.ts` and `fixtures.ts` all changed and the
   scanner reads none of them. The new prose in them is JSDoc.
3. **The `.svelte` `<script>` block and the component doc comment.** `DetailPane.svelte`'s doc block
   was reworded; the scanner masks that block entirely before scanning.
4. **A string reaching the screen through a prop, `{@html}` or a CSS `content:` rule.** Unchanged by
   this sub-phase, and still invisible to the scanner.
5. **The one guard this sub-phase *did* add is a text scan, and it is over the whole file.**
   `detail.test.ts` now asserts `DetailPane.svelte` contains neither `value_text` nor `valueText`. It
   cannot tell markup from a comment, so it fires on a doc comment that merely names the field — see
   §7.1, where it did exactly that. That is the safe direction: it can only ever be too strict.

**The claim-versus-data sweep.** Every sentence written in this sub-phase that asserts something about
data was checked against the data before it was written down, and three pre-existing sentences were
found to have been **falsified by this change** and were rewritten (§7.2). The three sentences that
say the detail pane does not show an unmodelled value were checked and are **still true**:
`describeUnknown()` does not read `value_text`, `UnknownRow` does not carry it, and
`DetailPane.svelte` never names it.

---

## 6. The disabling experiments

**Fifteen** — ten during the build, five more closing the review — each performed by breaking the
**implementation** and observing which tests fired, not by breaking a test and observing that it
failed. Every one was reverted before the next, and `cargo test --workspace` was green again before
the next was applied.

| # | The break | What fired |
|---|---|---|
| A | Remove `commands::document_text` from `generate_handler!` | **5**: `dispatch_check::the_six_read_only_commands_are_reachable…`, `…document_text_answers_every_synthetic_fixture_byte_for_byte`, `…document_text_answers_a_file_that_does_not_parse`, `…document_text_refuses_an_unknown_document_with_a_code`, `wire_contract::the_registered_commands_are_the_read_only_six_and_the_menu_command` |
| B | `WorkspaceSession::text` replaces `\r\n` with `\n` | **2**: `commands::document_text_hands_back_the_file_byte_for_byte`, the corpus sweep |
| C | `WorkspaceSession::text` strips a leading BOM when present | **2**: the same pair |
| D | Cap `value_text` at 8 bytes | **5**: `model_projection::{every_synthetic_unmodelled_entry_carries_the_bytes_of_its_span, an_unmodelled_value_keeps_its_line_endings_indentation_and_unicode, a_truncated_unknown_value_is_caught_by_the_oracle, every_synthetic_fixture_projects_with_the_counts_it_has_always_had}`, `wire_contract::an_unmodelled_entrys_value_crosses_as_its_own_bytes` |
| E | `value_text` replaces `\r\n` with `\n` | **1**, and see below |
| F | Delete `value_text` from `types.ts` | **1**: `wire_contract::every_interface_declares_exactly_the_properties_serde_writes` |
| G | Delete `'document_text'` from `COMMAND_NAMES` | **3 ways**: `wire_contract::the_registered_commands…`, `npm test` (`commands.test.ts`), and `npm run check` — the wrapper's argument stops being assignable to `CommandName`, so it is a compile error before it is a test failure |
| H | Frontend wrapper does `.normalize('NFC').replace(/\r\n/g, '\n')` | **3** frontend cases, including `hand a document text back as the string Rust sent, unchanged` |
| I | Reorder `UnknownEntry`'s fields so `value_text` precedes `value_span` | **nothing** — see below |
| J | Slice `value_text` with `chars().skip(start).take(len)` instead of bytes | **4**: three in `model_projection`, one in `wire_contract` |

The five performed to close the review, each aimed at a test the review said could not fail:

| # | The break | What fired |
|---|---|---|
| K | `WorkspaceSession::document` truncates every `value_text` of the cloned view to one byte — a regression **confined to the `DocumentView` path**, exactly the review's scenario | **2**: `commands::an_unmodelled_entrys_value_text_is_the_bytes_its_span_names`, `dispatch_check::an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte`. **`wire_contract::an_unmodelled_entrys_value_crosses_as_its_own_bytes` did not fire**, which is the finding restated as a measurement: it projects in-process, so a defect on the command path is invisible to it |
| L | `WorkspaceSession::text` answers `Ok(String::new())` instead of refusing when no workspace is open | **1**: `commands::every_command_refuses_before_a_workspace_is_open` — which before the review would have stayed green, because it never called `text` |
| M | An eighth command added to `commands.rs` and to `generate_handler!` | **2**: `dispatch_check::a_remote_origin_is_refused` (its attempt table no longer equals the registered set), `wire_contract::the_registered_commands…`. This is what makes the seven-command claim self-maintaining rather than a list somebody has to remember |
| O | `WorkspaceSession::text` strips U+0000, U+2028 and U+2029 | **2**: `commands::document_text_hands_back_the_file_byte_for_byte`, `dispatch_check::document_text_carries_a_nul_and_the_two_unicode_line_separators`. The **corpus sweep did not fire** — no fixture holds these bytes, which is why they are hand-written and why that is recorded as hole 9 rather than as coverage |
| P | `MappingScan::skip` strips U+2028 and U+2029 from `value_text` only | **1**: the new dispatcher value-text test. Nothing else in either suite noticed |

### 6.0 The one that could not be constructed, and why that is worth knowing

**Experiment N — grant the remote origin access to a command — could not be built.** The intent was to
break `a_remote_origin_is_refused` from the implementation side. Adding
`"remote": { "urls": ["https://an-unrelated-site.example"] }` to `src-tauri/capabilities/default.json`
changed **nothing**: all 75 tests still passed, remote access included in the refusal. The reason is
structural and is worth writing down — **this application publishes no ACL manifest for its own
commands** (`src-tauri/gen/schemas/acl-manifests.json` contains no `allow-get-document` or any
sibling), so there is no permission a capability could name to let a remote origin reach one. The
refusal is therefore unconditional given the current build, not a configuration that could drift.

What that leaves is a **vacuity check** rather than a disabling experiment, and it is labelled as one:
running the same seven-command sweep from `LOCAL_ORIGIN` instead of the remote one fails on the first
attempt, with `open_workspace` answering a workspace summary. So the assertions do have teeth; what
cannot be demonstrated is a single command being opened up while the others stay shut, and the value
of extending the table from three commands to seven is that the **body now carries the claim** — with
experiment M as the check that it keeps carrying it.

### 6.1 The two that did not fire what they should have

**Experiment E fired one test out of two that could have caught it.**
`an_unmodelled_value_keeps_its_line_endings_indentation_and_unicode` — hand-written — failed. The
**corpus sweep did not**, and the reason is measurable rather than mysterious: of the fifteen
byte-exact fixtures, only four produce unmodelled entries at all
(`file-comments-and-mixed-endings.yml`, `move-kept-comment-joins-a-block.yml`, `move-run-joins.yml`,
`run-based-removal-boundaries.yml`, contributing 9 of the corpus's 20), and **none of them puts a
CRLF, a BOM, a decomposed character or a terminal space inside an unmodelled value**. This is a real
R20 deviation and it is recorded as hole 1 rather than papered over — it is exactly the shape R20
warns about, a condition pinned by a hand-written source instead of by a fixture on each side.

**Experiment D fired four of the five tests that name the property, and the fifth was right not to
fire.** `commands::an_unmodelled_entrys_value_text_is_the_bytes_its_span_names` uses a three-byte
value, so a cap at eight bytes is invisible to it. The test's claim is about the *slice*, not about
the *length*, and it is honest — but it is worth knowing that it alone would not catch a cap.

### 6.2 The one that did not fire, correctly

**Experiment I** — reordering the struct fields — fired **nothing**, in either suite. That is the
right answer and is recorded here so nobody has to re-run it: a JSON object is unordered, and
`wire_contract.rs` compares key **sets** in both directions. Field order in
`crates/espansoconfig-core/src/model/unknown.rs` is a readability decision with no wire consequence.

---

## 7. What this sub-phase got wrong on the way

### 7.1 The guard fired on the documentation that explained the guard

The first version of `DetailPane.svelte`'s reworded doc block named the wire field as
`UnknownEntry.value_text`. The scan added in the same commit — "the pane names neither `value_text`
nor `valueText`" — reads the whole file, comments included, and failed.

That is the guard behaving correctly and the comment being careless. The comment was reworded to say
"the value's own text", the guard was kept as it is, and the false-positive direction is now written
into the test itself. It cost one `npm test` run, and it is a small instance of the pattern this
project keeps meeting: **a text scan cannot tell a claim from a mention** (`1c-2b-1-notes.md`
experiment Y is the same shape with the polarity reversed).

### 7.2 Three existing sentences became false the moment the field was added

This is the failure mode `PROGRESS.md` warns about most loudly, arriving from the other direction: the
sentences were true when written and this change falsified them. All three said, in substance, *the
wire carries no value text at all*:

- `src/lib/browser/detail.ts` — the `UnknownRow` doc block;
- `src/lib/components/DetailPane.svelte` — the pane's doc block;
- `src/lib/browser/detail.test.ts` — the comment on the shape assertion.

Each now says what is actually true: the wire carries it, this layer deliberately does not read it,
and that is what keeps the user-facing strings honest. **`1c-2a-notes.md` §12 hole 13 was left
unedited on purpose** — it is a historical record of what was true at 1c-2a, and rewriting a decision
record to match a later state is how a project loses the ability to say when something changed.

### 7.3 An oracle that would have passed silently in the case it exists for

`unknown_value_disagreement()` was first written with `let tail = source.get(span.start..)?;` — the
`?` returning `None`, which the caller reads as *no disagreement*. An out-of-bounds span, the exact
defect the position check exists to catch, would have passed. Caught while writing and before the
first run, and replaced with an explicit `else` arm that returns a disagreement naming the offset.
Recorded because R24's corollary applies to an oracle's own control flow, not only to its name.

---

## 8. Verification

| Command | Result |
|---|---|
| `cargo test --workspace` | pass — 16 test binaries, 0 failures |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x's check, not the withdrawn `rg -c tauri Cargo.lock`) |
| `npm run check` | 369 files, 0 errors, 0 warnings |
| `npm run build` | built |
| `npm test` | 25 files, 480 tests, 0 failures |
| `git status --short --untracked-files=all` | 16 modified files and 2 new documents, **no real-corpus path** |
| `tests/corpus_integrity.rs` | untouched and passing — no fixture was edited, and none needed to be |

Re-run after the review with the same results; `src-tauri` alone went from 73 to 75 tests, and the
sixteenth modified file is `src-tauri/capabilities/default.json`, whose description said this harness
"drives all six commands" and had been falsified by the seventh.

Evidence lines the suites print:

- `document_text: 33 fixtures, 37406 bytes, all identical`
- `value_text over IPC: 4 entries, 128 bytes`
- `unmodelled values: 20 entries, 19 non-empty, 2369 bytes carried, widest 342`
- real corpus: `13 of 13 files parsed`, `566 keys in the tree, 566 named, 0 inside a recorded span`

The claim on `commands::document_text` that asking for a projection and then for its bytes costs one
parse is **not** new and is not asserted twice: `crates/espansoconfig-core/tests/workspace_cache.rs`
already drives `document_text` after eight `document_view` calls and pins `parse_count() == 1`.

---

## 9. Coverage holes, stated as holes

1. **No byte-exact fixture puts an unmodelled key over its own distinguishing bytes.** Measured, not
   suspected — experiment E fired one test where two could have. `value_text`'s Unicode, CRLF and
   trailing-space behaviour is pinned by **hand-written sources**, which is an R20 deviation of the
   same kind `1a-notes.md` §9 holes 4 and 10 record. Closing it means a fixture, which means a
   sixteenth row in `CLAUDE.md` §4 and a new row in `SYNTHETIC_PROJECTIONS`; it was judged out of
   scope for a boundary sub-phase and is written down instead.
2. **The real corpus exercises `value_text` zero times.** 13 files, 566 mapping keys, **all of them
   modelled** — so the real corpus produces no unmodelled entry and the oracle runs over nothing
   there. No test drives `document_text` over the real corpus either: the sweep uses the synthetic
   one, by CLAUDE.md §1.
3. **Nothing reads either datum on a screen, so no window reading was taken.** R32's instrument would
   show the same window as 1c-2b-1. This is deliberate — the sub-phase adds no markup — and it means
   the *rendering* half of byte fidelity is entirely 1c-2b-2b's, including whether a `<pre>` collapses
   what the wire preserved.
4. **The webview is not in the measurement** (§4.3). `mock_builder()` swaps it out.
5. **`documentText` has no caller and is tree-shaken out of `dist`.** Verified. It means the shipped
   bundle currently cannot call the command, and that no runtime path exercises the wrapper outside
   its unit test.
6. **The disjointness argument for the memory bound is an argument.** Nothing asserts that two
   unknown entries' value spans never overlap; it follows from the projection not descending, which
   is a property of `Projector::close` that no test states directly.
7. **An empty `value_text` is ambiguous in the text alone.** It means either a genuinely empty value
   or a span that could not be sliced. `value_span` distinguishes them, and 19 of the corpus's 20
   entries are non-empty, so the empty arm is exercised exactly once and by a real empty value.
8. **Nothing here pins what `document_text` does for a file that is not UTF-8.** `read_utf8` refuses
   with `notUtf8` before the command is reached, and that path is pinned in the core, not in this
   crate. §3.1 records the decision the refusal implements; what is missing is a test that drives a
   file with a `0x80` in it through `open_workspace` and `document_text` and asserts the code and the
   offset arrive. Closing it needs no fixture — a temp file written by the test is enough — and it
   was left to 1c-2b-2b, which has to **render** that refusal and so needs the case anyway.
9. **`value_text` and a NUL is untested, and all three of NUL, U+2028 and U+2029 are pinned by
   hand-written sources rather than fixtures.** The second half is an R20 deviation of the same shape
   as hole 1. The first half is a hard limit measured rather than assumed: a source containing U+0000
   does not parse, so it produces no unmodelled entry to carry one (§4). `document_text` carries all
   three, at the command, over the dispatcher and in the frontend wrapper. Closing the R20 half means
   a sixteenth `CLAUDE.md` §4 fixture; closing the NUL half means a value that does not need to parse,
   which the model does not have.
10. **The uncapped `value_text` has no size bound, only a duplication bound** (§3). One unknown block
    scalar spanning most of a very large valid-UTF-8 file is owned by the cache, cloned again by
    `WorkspaceSession::document`, and encoded a third time by Tauri, all on the main thread. Nothing
    measures that: the corpus's widest single value is 342 bytes. The decision to stay uncapped stands
    and the reason is in §3; what is written down here is that its cost has never been observed. A
    phase that meets it should reach for streaming or an async command, and must add a `truncated`
    flag in the same change as any cap.
11. **No single command can be shown to be reachable from a remote origin while the others are not**
    (§6.0). The refusal is unconditional because the application publishes no ACL manifest for its own
    commands, so the seven-command sweep is pinned by a vacuity check and by experiment M rather than
    by a break that opens one door.

---

## 10. What 1c-2b-2b inherits, and should not rebuild

- **A registered, reachable `document_text` that preserves valid UTF-8 exactly and refuses anything
  else with a code,** with a typed frontend wrapper already exported from `src/lib/ipc`. Do not add a
  second path to a file's text, and do not slice the string it returns by a `ByteSpan` — §4.2 is the
  whole reason the wrapper's JSDoc says so. **The `notUtf8` arm has no screen yet** (hole 8): a file
  the raw pane cannot show must not look like an empty one.
- **`UnknownEntry.value_text`, uncapped and unflagged.** Rendering it is the work. The moment it goes
  on screen, `browser.detail.unknownValue` and the four `code.unknownReason.*` sentences stop being
  true as written — **they must change in the same commit or not at all**. That pairing is the 1c-2a
  review's first finding, and it is now the only way left to reintroduce it.
- **The fidelity table (§4) as a specification for the viewer.** Every row says what arrived; a viewer
  that renders CRLF as a visible artefact, collapses trailing spaces, or normalises the two `é`s into
  one is showing the owner a file they do not have. `white-space` and the font are decisions, not
  defaults.
- **Three oracles that can disagree.** `unknown_value_disagreement()` in `model_projection.rs`, the
  byte-for-byte corpus sweep in `dispatch_check.rs`, and the dispatcher value-text comparison added at
  the review. A new claim about text goes beside one of them.
- **The `not.toContain('value_text')` guard in `detail.test.ts`.** It is the tripwire that says the
  pane still does not render the value. **Deleting it is part of the work** when the pane starts to —
  and deleting it without also rewording the strings is the defect it exists to make visible.
- **Two holes 1c-2b-1 left open and this sub-phase did not touch**, still 1c-2b-2b's: hole 16 (the
  empty snippet list and its explanation are produced by unrelated code) and hole 2 (a file that
  failed to parse shows `0` exactly like an empty one, though `parsed` is on the wire for it).
- **Phase 1's stated exit is untouched here.** *The owner can browse their entire real config and
  every snippet renders correctly* is a claim about a running window over the real corpus, and this
  sub-phase put nothing new in a window. It is 1c-2b-2b's, in full, and D1 governs how it is recorded:
  counts and error positions, never content.

---

## 11. Review disposition

`docs/reviews/phase-1c-2b-2a-raw-text-boundary.md` found six things and no critical. **All six are
closed**, and nothing was closed by making a sentence vaguer. Four of the six were produced by reading
a test's *name*, then its *body*, and asking whether the body could fail if the name's claim were
false; that check was re-applied to everything added here.

| # | Finding | How it was closed |
|---|---|---|
| High 1–2 | `document_text` documented as "raw file bytes" / "exactly as it is on disk" while the wire type is `String` and the core refuses invalid UTF-8 with a typed `notUtf8` | Every such claim narrowed to **exact preservation of valid UTF-8, typed refusal otherwise**, in `src-tauri/src/commands.rs` (module doc and `WorkspaceSession::text`), `src-tauri/src/dispatch_check.rs` (module doc), `crates/espansoconfig-core/src/workspace/mod.rs` (`Workspace::document_text`), `src/lib/ipc/commands.ts` (`documentText`) and this document's opening. **§3.1 is new**: the decision that `CommandResult<string>` cannot represent arbitrary disk bytes, what it costs the user, what widening it would cost Phases 2–5, and why it was not widened here. The behaviour is unchanged — it was already correct |
| High 1 | `value_text` had never crossed the Tauri IPC dispatcher | `dispatch_check::an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte` **added**: it opens a workspace, fetches the document with `get_document` over the real dispatcher, finds every unknown entry in the response **by shape**, and compares each `value_text` with `std::fs::read` of the file sliced by the `value_span` that arrived beside it. 4 entries, 128 bytes. **Experiment K** is its oracle: truncating `value_text` on the `DocumentView` path alone fires it, and does **not** fire the in-process `wire_contract` test the review named |
| Medium 1 | NUL and U+2028/U+2029 untested; doc comments claiming what the webview receives | The three added to the returned-value assertions at three levels: `commands::document_text_hands_back_the_file_byte_for_byte`, the new `dispatch_check::document_text_carries_a_nul_and_the_two_unicode_line_separators`, and `src/lib/ipc/commands.test.ts`. For `value_text`, U+2028/U+2029 were **measured to be reachable** and are carried by a fourth unrecognised key in `UNMODELLED_HAZARDS`; a NUL was **measured not to be** — a source holding one does not parse — and is hole 9. Experiments O and P are the oracles. The webview claims are gone: §4.3 now records that the doc comments disagreed with it, and `dispatch_check.rs` carries the standing rule that no comment, name or message may say what "the webview receives" |
| Medium 3 | The uncapped decision claimed a saving it had not shown | §3 rewritten: disjointness bounds **duplication** by the document's length and **not size**, the pathological input is spelled out with the three copies it costs on the main thread, and the corpus measurement is labelled a fact about this corpus rather than a bound. **The uncapped decision is kept**, with its reason restated; hole 10 records the cost that has never been observed |
| Medium 4 | `a_remote_origin_is_refused` claimed seven and checked three | Extended to **all seven**, with well-formed arguments so no attempt is refused by the command macro instead of by access control, and the attempt table asserted **equal to the set parsed out of `generate_handler!`** in both directions. **Experiment M** — an eighth registered command — fires it. §6.0 records that a break opening one command alone could not be constructed, and why (no ACL manifest exists for this application's own commands), and gives the vacuity check that was run instead |
| Low 5 | `every_command_refuses_before_a_workspace_is_open` omitted `text` | `session.text(id)` added, with a doc comment saying what the test's name is claiming. **Experiment L** — `text` answering `Ok(String::new())` — fires it |

**Not closed, deliberately: none.** Every finding above is closed in the working tree, and the two
that could only be *partly* closed say so as holes rather than as coverage — hole 9 (a NUL cannot
reach a `value_text` at all) and hole 11 (no per-command remote break is constructible).

**One thing outside the review's six was changed for the same reason the review exists.**
`src-tauri/capabilities/default.json`'s description claimed `dispatch_check.rs` "drives all six
commands"; this sub-phase made that false. It now says seven, and records the ACL-manifest measurement
from §6.0 so the next reader does not have to re-derive it.
