# Phase 2c-4a-1 — decision record

**The revision-bound disk snapshot, in Rust and on the wire, and nothing above it.**
`SaveResult::Conflict` carries the whole disk-side file text, the one construction site produces it,
the TypeScript mirror declares it and `ConflictModel` carries it. **No screen draws it, no control
was added, no i18n key exists for it, and no wrapper's conflict arm changed.** `conflictText` and
`captureTheDiskText` in `src/lib/browser/workspace.svelte.ts` are exactly as they were.

The authority for this step is `docs/reviews/phase-2c-4a-design.md` — the design consult for this
sub-phase. This step discharges its **Q6** ("strengthen the capture so the text is explicitly
revision-bound") and its **Q9 item 2** ("'disk text at revision R' is not presently a typed fact").
Where this record and that document disagree, the consult is right and this is a bug.

The consult marked the Rust accessor **uncertain** and deferred the choice here. §2.2 records what it
turned out to be, and it is not the second-call shape Q6's fallback sentence hedged towards.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src-tauri/src/save.rs` | `SaveResult::Conflict::disk_text: String`, its documentation, the module's own paragraph on it; `operand_count` 4 → 5 for that arm; the field written by the hand-written `Serialize`; `every_save_result()`'s conflict fixture pairs text and revision |
| `src-tauri/src/commands.rs` | `conflict_after_the_lock` takes the text out of the same `Workspace::refresh` that already yielded `disk` and `disk_revision`; its doc comment states the pairing and why `String` rather than `Option<String>` |
| `src/lib/ipc/types.ts` | `ConflictResult.disk_text: string`, documented in the same terms |
| `src/lib/browser/saveOutcome.ts` | `ConflictModel<T>.diskText: string`, carried by `describeConflict` out of the result |

Tests added or extended:

| Where | What it pins |
|---|---|
| `src-tauri/src/commands.rs` — `a_conflicts_disk_text_survives_byte_for_byte` (**new**) | a real raw-save conflict over a file with a UTF-8 BOM, CRLF line endings **and** no final newline comes back with all three intact and byte-identical, and its `ContentRevision::of_bytes` equals `disk_revision` |
| `src-tauri/src/commands.rs` — `a_conflict_describes_the_refusing_read_and_the_fresh_read_separately` | the pairing under the honesty rule: with the file changed **twice**, `disk_text` is the later text, hashes to `disk_revision`, and does **not** hash to `found` |
| `src-tauri/src/commands.rs` — `a_file_replaced_under_the_session_answers_with_a_conflict`, `a_stale_raw_save_never_overwrites_the_bytes_written_after_it_loaded` | the ordinary case: the text is the other writer's whole file |
| `src-tauri/src/save.rs` — `a_conflict_reports_the_refusing_revision_and_the_fresh_read_separately` | the fixture's own text rehashes to its own `disk_revision` |
| `src-tauri/src/wire_contract.rs` | nothing was added: `every_save_outcome_declares_exactly_what_rust_writes` derives the operand set from the JSON `serde` writes, so it **failed** until `types.ts` declared `disk_text`, then passed |
| `src/lib/browser/saveOutcome.test.ts` — two cases (**new**) | `describeConflict` carries the text through byte for byte, BOM, CRLF and missing final newline included; and carries the **later** read's text when the file changed twice |
| `src-tauri/src/dispatch_check.rs` — `a_conflicts_disk_text_crosses_the_dispatcher_byte_for_byte` (**new at §6.1**) | the same three properties **through the real IPC dispatcher**: the serialized `disk_text` compared with `std::fs::read` of the file, and `disk_revision` compared with a digest recomputed from the bytes that came out of serialization |

Twelve test files' conflict fixtures gained the field, because it is required rather than optional
and TypeScript said so. That churn is the type doing its job.

**No `.svelte` file was touched, no command was registered, no i18n key was added, no fixture's bytes
changed, and `crates/espansoconfig-core` was not touched at all.** This step needs nothing from the
core: `Workspace::refresh` already answered a `SourceDocument` carrying `.source`, `.revision` and
`.view` as **one snapshot**, which is precisely why the fix is the one below rather than a new
accessor. (§6.2 corrects the "from one read" this sentence originally said.)

---

## 2. The decisions

### 2.1 D1 — `disk_text` is a `String`, and an `Option` would be a type claiming a possibility the code denies

`Workspace::refresh` reads through `read_utf8`, which refuses a file that is not valid UTF-8 with
`WorkspaceError::NotUtf8`. That error propagates through the `?` in `conflict_after_the_lock`, which
then returns `Err` and **builds no `Conflict` at all** — the whole conflict report is already an
error in that case, and has been since the function was written. A file that reads but does not
*parse* is not a failure either: it comes back with its text and a diagnostic. So there is no path
by which a `SaveResult::Conflict` exists whose disk text could not be read.

An `Option<String>` would therefore have added an arm no code can reach, and the arm would have had
to be given a sentence in two dictionaries — a user-facing claim about a state this application
cannot produce. The reasoning is written on the field itself so that a later reader does not "fix"
the type; the field's doc comment carries it, and `conflict_after_the_lock`'s repeats the one-line
version beside the `?` that makes it true.

**What this does not claim.** It is a statement about *today's* single construction site, not a
guarantee Rust enforces. If a later change makes a conflict reachable without a successful read —
for instance by describing the disk side from something other than a refresh — the type will be
wrong and nothing in the compiler will say so. §2.2 is the reason there is one site to check.

### 2.2 D2 — the pairing is by construction, in the one function that builds the payload

The consult's Q9 item 2 named the hazard exactly: `conflictText` stores only `(document,
CommandResult<string>)`, and the UI would place that text beside `disk_revision`. Two things make
that dishonest, and both are visible in the shipped code rather than hypothetical:

- the text comes from a **separate** `document_text` IPC call, so a concurrent refresh between the
  two calls makes a later read masquerade as the conflict snapshot;
- `captureTheDiskText` (`workspace.svelte.ts:2960`) reuses the viewer's cached `fileTextAnswer`
  whenever the viewer happens to be pointed at the same document — an answer taken at an **earlier**
  time, carrying no revision. Not just a later text: an older one.

The fix is that `Workspace::refresh` returns **one** `&SourceDocument` carrying `.source`,
`.revision` and `.view` — one **snapshot** — and `conflict_after_the_lock` already called exactly
that. So the three operands are now taken out of that one value:

> **Correction (§6.2).** This paragraph first said "all from one read", and that is not literally
> true. `refresh` (`workspace/mod.rs:514-530`) hashes the bytes it has just read and, when that hash
> equals the revision the cached snapshot already carries, **keeps the cached snapshot and drops the
> string it read** — so the snapshot handed back may be a previous parse. What pairs the text with
> the revision is therefore **content-hash equality**, which is the stronger claim and is exactly
> what `refresh` tests before deciding to reuse: a snapshot's `.source` hashes to its own `.revision`
> by construction, and reuse happens only after that same hash matches bytes read from the disk this
> instant. What the equality does not exclude is a `ContentRevision` collision.

```rust
let fresh = workspace.refresh(document)?;
let disk_text = fresh.source.clone();
let disk = Box::new(fresh.view.clone());
```

No second read, no second IPC call, and **no call-ordering argument needed as proof** — which is what
the consult asked for in the same sentence it deferred the choice.

**What the alternative would have cost in honesty.** A second `document_text` call cannot be made
truthful by any amount of care at the call site. Its result would have to be either *labelled* as a
later cached observation — the consult's own fallback, which means the conflict screen shows text it
declines to say belongs to the revision printed above it — or paired by ordering, which is an
argument, not a type. The construction-site pairing replaces the argument with the absence of an
opportunity.

**What it does not force.** `SaveResult::Conflict` is an ordinary struct variant; Rust cannot tie one
field to another, and a second construction site could pair a revision with somebody else's text and
compile. What holds the rule is that there is exactly **one production site** — verified by search
before the change. The tests do not restate the expression that produced the value either; they
recompute `ContentRevision::of_bytes` from the string that came back.

> **Correction (§6.2).** This paragraph first read "every other `SaveResult::Conflict` in the crate
> is a pattern match in a test", and that is false. `every_save_result()` (`save.rs:377`, `#[cfg(test)]`)
> **constructs** one. It is not a counterexample to the rule — it is the wire-contract fixture, it
> pairs its text with its revision the same way the production site does, and
> `a_conflict_reports_the_refusing_revision_and_the_fresh_read_separately` rehashes the serialized
> text rather than trusting the fixture — but the sentence as written claimed a search result the
> search does not return. The correct claim is **one production construction site, plus one test-only
> fixture**, and both `save.rs` and `conflict_after_the_lock` now say so in those words.

### 2.3 D3 — the honesty rule now binds the text, and it is stated where the two revisions are stated

`save.rs:143-157` has recorded since Phase 2b-2a that `found` and `disk_revision` are **two
observations, not two names for one**. `disk_text` is of the *fresh* read — the bytes `disk_revision`
names — and never of the bytes at `found` that actually refused the save. When they differ the file
changed **again** in between, and the text on the payload describes the later of the two reads.

That sentence is now in four places, in the same terms the existing prose uses: the module doc, the
`Conflict` variant's doc, the `disk_text` field's own doc, and `conflict_after_the_lock`'s. On the
TypeScript side it is on `ConflictResult` and on `ConflictModel.diskText`.

`a_conflict_describes_the_refusing_read_and_the_fresh_read_separately` is what makes it a check
rather than a paragraph: it drives a real refusal, writes a **third** text into the file, calls
`conflict_after_the_lock` with the real `found`, and then asserts that the returned text hashes to
`disk_revision` and **not** to `found`.

### 2.4 D4 — byte-exactness is asserted on the bytes a normaliser would change

The pairing test uses ordinary LF text, so it would pass over a payload that rebuilt the text from
the projection or converted its line endings. `a_conflicts_disk_text_survives_byte_for_byte` cannot:
its file carries a UTF-8 BOM, CRLF line endings and no final newline — the three properties the
corpus fixtures exist to pin — and the assertions are on the bytes, with the digest recomputed from
what came back. The fixture is a hand-authored temp file written with `\u{feff}` and explicit `\r\n`
escapes rather than a corpus file, so saving `commands.rs` cannot make the fixture agree with a
normalising boundary. The real corpus is not read anywhere in this step.

The TypeScript side does the same on its own boundary: `saveOutcome.test.ts`'s `DISK_TEXT` carries a
BOM, one CRLF among bare LFs and no final newline, and the model test asserts the value rather than
its length, because a stripped BOM and a converted CRLF both keep the shape.

> **Correction (§6.1).** This section presented those two tests as covering the property, and they do
> not: the Rust one inspects the value **before** serialization and the TypeScript one starts from a
> hand-built value that never crossed anything, so a normalisation *in the serialization path* would
> have passed both. `a_conflicts_disk_text_crosses_the_dispatcher_byte_for_byte` in
> `src-tauri/src/dispatch_check.rs` is the test that closes the gap, and §6.1 records the mutation
> that proves the three original tests could not have.

---

## 3. The wire-size consequence, and the judgement

**The whole file text now crosses the IPC boundary on every conflict**, for all six writing commands.
That is a real cost and it is accepted, for three reasons stated in the order of their weight.

1. **A conflict is rare and already expensive.** It happens only when another writer changed the file
   under an open editor. The payload it produces already carries a whole `DocumentView`.
2. **The projection already carries about as much.** `MatchView.source_text` is each snippet's own
   owned slice, so the sum over a match file's snippets is already most of the file, *plus* every
   projected scalar, span, badge and diagnostic beside it. Adding the file text roughly adds one file
   to a payload that was already carrying more than one file's worth of derived text. It is not a new
   order of magnitude.
3. **espanso match files are small.** All 37 `.yml` files of the synthetic corpus are under 2.5 kB
   each, and the directory is 148 kB in total. The real corpus is 13 files
   (`1c-2b-2b-2-notes.md` §8); its sizes are not quoted here (CLAUDE.md §1), and no measurement of it
   was taken for this note.

**What this judgement does not rest on.** No measurement of a large file was taken, and no bound is
claimed. A user with a pathologically large match file pays the size of that file on each conflict,
serialized as a JSON string. If that ever matters, the honest fix is not to make the field optional —
that would reintroduce the unreachable arm D1 removed — but to decide deliberately what a conflict
screen shows for a file too large to draw, which is a 2c-4a-2/3 question about the screen and not
about the wire.

---

## 4. Holes this step leaves open, each with its reason

1. **`conflictText` and `captureTheDiskText` are now redundant, and this step did not touch them.**
   `ConflictModel.diskText` carries the disk text on the payload itself, revision-bound, so the
   separate capture has nothing left to add and two defects it still has: the second-read race, and
   the reuse of the viewer's older cached answer (§2.2). **Superseding them is 2c-4a-2's protocol
   work**, because removing the capture means changing what `saveRawDocument` seals and what
   `DetailPane` passes to `RawEditor` — a frontend behaviour change, which this step is defined not
   to make. Flagged here, deliberately not acted on.
2. **Nothing draws `diskText`.** No screen, no `SourceText`, no i18n key. That is 2c-4a-3.
3. **The eager frontend install is untouched.** The consult's Q2 calls it a 2c-4a defect; it is
   2c-4a-2's, not this step's.
4. **Nothing in Rust or TypeScript forces a second construction site to pair the text correctly**
   (§2.2), and nothing forces the `String` to stay honest if a conflict ever becomes reachable
   without a successful read (§2.1). Both rest on there being one site, and on the tests recomputing
   the digest rather than restating the expression.
5. **The dictionary contract owes nothing and was not changed.** `VARIANT_COUNTS`' `("saveResult", 3)`
   counts *variants*, not fields, so a new data field on an existing variant owes no string. Verified
   by running `dictionary_contract`'s four tests after the change rather than assumed — they pass
   unchanged.

---

## 5. What this step deliberately did not do

- No `saveAnyway`, no retry, no rebase, no cross-revision match identification, no YAML emission from
  a projection, no diff. Those are forbidden for the whole of 2c-4a (consult, Q1 and the verdict).
- No control anywhere named *Keep my draft*.
- No change to `crates/espansoconfig-core`. `cargo tree -p espansoconfig-core | rg tauri` finds
  nothing, unchanged.
- No new module: `npm run build` still reports **171** modules, which is the shape this step's change
  should have — it adds fields, not files.

---

## 6. The review round

`docs/reviews/phase-2c-4a-1-code.md` — Codex, READINESS: **NOT READY**, one Medium and one Low.
Both are accepted and closed; neither is disputed as a false positive, and neither needed a
behaviour change — the Medium is closed by **adding** a test and the Low by correcting prose. No
existing test or assertion was weakened or removed, no frontend behaviour changed, no i18n key and no
control were added. Five of the review's seven other headings returned *no finding* and are recorded
here unchanged: the pairing claim, `String` versus `Option<String>`, wire-shape completeness, scope
discipline, wire size and the `diskText` naming hazard.

### 6.1 Finding 1 (Medium) — byte-exactness was never measured through the serialization path. Accepted, fixed.

**This was a real coverage hole, not a style preference.** Three tests claimed byte-exactness for
`disk_text` and **none of them could have falsified a normalisation in the serialization path**:

- `a_conflicts_disk_text_survives_byte_for_byte` (`commands.rs`) inspects the **Rust value**, and
  stops before `serde` ever sees it;
- `a_conflict_reports_the_refusing_revision_and_the_fresh_read_separately` (`save.rs`) does
  serialize, but only over ordinary LF `SAMPLE_SOURCE` — there is no BOM, no CRLF and no missing
  final newline in it for a normaliser to touch;
- `saveOutcome.test.ts` starts from a **hand-built** TypeScript conflict value that never crossed
  anything, so it measures `describeConflict` and not the wire.

So a normalisation or substitution confined to the `Conflict` arm of `SaveResult`'s hand-written
`Serialize` would have left all three green. §2.4 above claimed the opposite of that; this section is
the correction.

**The fix** is `a_conflicts_disk_text_crosses_the_dispatcher_byte_for_byte`, in
`src-tauri/src/dispatch_check.rs`. **No new mechanism**: that file has held this project's
dispatcher-fidelity idiom since Phase 1c-2b-2a — `document_text_answers_every_synthetic_fixture_byte_for_byte`
and `an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte` ask exactly this question
of the other two values on this wire that are a file's own text — and `disk_text` is simply the
third, so it is asked there, the same way, with the module's own documentation extended to name it.
It builds the application on the mock runtime as `main()` does, lets another writer replace the file
with one carrying a UTF-8 BOM, CRLF endings and no final newline, invokes **`save_raw_document` over
IPC** with a now-stale base, and then does the two things the review asked for: compares the
serialized `disk_text` with `std::fs::read` of that file, and recomputes `ContentRevision::of_bytes`
**from the string the response body carried** to compare against the serialized `disk_revision`. The
three properties are also asserted individually on what crossed, so a failure says which one this
boundary lost.

**It was proved able to fail**, by two mutations run and reverted rather than by argument.

| Mutation | What failed |
|---|---|
| the serializer writes `disk_text.replace("\r\n", "\n")` | **only the new test** — 148 passed, 1 failed. The three tests that claimed byte-exactness all stayed green, which is the finding, demonstrated |
| the serializer writes `expected` in place of `disk_revision` | the new test **and** `save.rs`'s shape test — 147 passed, 2 failed |

A third mutation is recorded because of what it says about the new test's limits: setting
`disk_revision: found` in `conflict_after_the_lock` failed only
`a_conflict_describes_the_refusing_read_and_the_fresh_read_separately`, because this fixture changes
the file **once**, so `found` and `disk_revision` are one value in it. The changed-twice case stays
that other test's, and this one does not duplicate it.

### 6.2 Finding 2 (Low) — the record overstated two implementation facts. Accepted, corrected.

This project's **named worst defect class** — a document claiming a guarantee the code does not
give — and two instances of it. Neither is a code defect; both are corrected wherever the sentence
appears rather than only here.

**(a) "all from one read" was not literally true.** `Workspace::refresh`
(`crates/espansoconfig-core/src/workspace/mod.rs:514-530`) reads the file and hashes the bytes, and
when that hash equals the revision the cached snapshot already carries it **keeps the cached
`SourceDocument` and drops the string it just read**. So the text, the revision and the projection
come out of one **snapshot**, which may be a previous parse. The corrected framing is the *stronger*
one: what guarantees `disk_text` is the text at `disk_revision` is **content-hash equality**, which
is precisely what `refresh` tests before deciding to reuse — a snapshot's `.source` hashes to its own
`.revision` by construction, and the reuse happens only after that hash matches bytes read from the
disk that instant. Stated with what it leaves unforced: a `ContentRevision` collision, and the fact
that Rust does not tie one field of a struct variant to another, so a second construction site could
pair a revision with somebody else's text and compile. Rewritten in `save.rs` (module doc and the
`disk_text` field doc), `commands.rs` (`conflict_after_the_lock`, whose heading now reads *by
content-hash equality*), `src/lib/ipc/types.ts` (`ConflictResult.disk_text`),
`src/lib/browser/saveOutcome.ts` (`ConflictModel.diskText`) and §2.2 above.

**(b) "every other `SaveResult::Conflict` in the crate is a pattern match" was false.**
`every_save_result()` (`save.rs:377`, `#[cfg(test)]`) **constructs** one. It is not a counterexample
to the design — it is the wire-contract fixture, it pairs its text with its revision exactly as the
production site does, and `a_conflict_reports_the_refusing_revision_and_the_fresh_read_separately`
rehashes the serialized text rather than trusting it — but the sentence claimed a search result the
search does not return. The claim is now **one production construction site, plus one test-only
fixture**, said in those words in `save.rs`'s module doc, on `every_save_result()` itself, in
`conflict_after_the_lock`'s doc, in both TypeScript doc comments and in §2.2 above.

---

## 7. The gates

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **1048 passed**, 0 failed (baseline 1046, plus one new test at step 1 and one more at §6.1) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | exit 1 — **finds nothing**, as required |
| `npm run check` | exit 0 — 411 files, **0 errors, 0 warnings** |
| `npm test` | exit 0 — 46 files, **1326 passed** (baseline 1324, plus two new cases) |
| `npm run build` | exit 0 — **171 modules**, unchanged |

The wire-contract test failed once, on purpose and usefully: after the Rust field was added and
before `types.ts` declared it, `every_save_outcome_declares_exactly_what_rust_writes` reported
*"interface ConflictResult: TypeScript is missing ["disk_text"]"*. That is the mechanism working, and
it is recorded here because a boundary field that crossed silently would be exactly the invisible
drift that check exists to prevent.
