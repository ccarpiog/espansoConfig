# Phase 2b-2c-3a — decision record

**The whole-document-text replacement mode, in the core, with no command.**

`espansoconfig_core::persist::save_document` — the only entry point in this application that may
write a user's file — gained a second *content mode*. A caller may now supply a whole replacement
text instead of a batch of `DocumentEdit`s. Nothing calls it yet: `save_raw_document`, the eleventh
`#[tauri::command]`, is Phase 2b-2c-3b's.

The design consult for the whole of 2b-2c-3 was taken before any line of this existed and is
`docs/reviews/phase-2b-2c-3-design.md`. **Its Q2 was put to the owner and the owner reversed it**,
and that reversal is recorded in the second half of the same file. This phase implements the
consult as amended, not as originally written.

---

## 1. What this phase built

- **`SaveContent<'a>`**, a two-arm enum: `Edits(&'a [DocumentEdit])` and `ReplaceText(&'a str)`.
  `SaveRequest.edits` became `SaveRequest.content`. The enum is **core-only** — it is not on the
  wire, because no command takes it yet.
- **The branch inside `save_document`**, placed after the lock and after the revision recheck, into
  a private `Candidate` that is either patched or replaced. Both arms then share the parse, the
  validation, the acknowledgement verdict, the backup and the atomic commit.
- **`FindingCode::DocumentDoesNotParse { revision, line, column, byte_index, detail }`**, class
  `SuspiciousButPermitted` — the eleventh finding code, and the first that `validate` does not
  produce. It is what makes the owner's ruling safe: an unparseable replacement is **disclosed and
  acknowledgeable**, never refused and never silent. `revision` was added in the second fix round;
  see §6.
- **`SaveError::ReplacementRequiresBackups { path }`**, raised before the lock, for the replacement
  arm only. Added in the first fix round; see §5.
- **`crates/espansoconfig-core/tests/persist_raw_save.rs`** — 18 tests, in six groups.

## 2. The decisions, each with its reason

### 2.1 D1 — the mode is a field of `SaveRequest`, not a second entry point

Consult Q4 ruled for one entry point branching internally, and the reason is not stylistic: **the
file lock is not reentrant.** A second public writing function would either take the lock itself —
and then any composition of the two hangs the process silently and forever — or take a lock guard
as a parameter, which puts the most dangerous object in this crate into a public signature.

The mode became a field rather than making `SaveRequest` itself an enum, because `context`,
`base_revision`, `acknowledgement` and `backups` are common to both arms and duplicating them
across variants would let a caller construct a raw save that skips the revision check by
construction.

### 2.2 D2 — a replacement never becomes a `DocumentEdit`

2b-2c-1's consult had already answered this (its Q6) and this phase honours it. Synthesizing a
full-span `DocumentEdit` would be the cheap implementation, and it would run the submitted bytes
through the planner, the verification and the presentation notes — letting a mode with **no**
locality claim borrow the vocabulary of the mode that has one.

Consult Q8 puts the same point as a product guarantee: calling the whole file "the edited span"
would make the original guarantee vacuous. The raw arm's promise is narrower and is stated on the
variant itself, where a caller reads it: *the exact submitted UTF-8 bytes are committed — no parser
formatting, no newline normalization, no BOM added or removed, no final newline supplied, no
re-indentation.*

### 2.3 D3 — the parse is a fact, not a gate

The consult's Q1 made a successful reparse half the substitute for the patch engine's proof. **The
owner's reversal of Q2 removes that**: if an unparseable text may be written, then failing the
parse cannot be disqualifying.

The parse is still **attempted**, because its answer is what the user is told and what the
workspace cache must do next. It is reported, not enforced.

### 2.4 D4 — "does not parse" is a `Finding`, not a `CommandError`

This is the load-bearing consequence of the owner's ruling, and it decided where the code lives.
The consult (under the ruling it gave) suggested a planning-time `CommandError::InvalidYaml`. Under
the reversal that is wrong twice over: a `CommandError` cannot be acknowledged, and it lives at the
command layer, where this phase registers nothing.

It had to be a `Finding` for the **exact-multiset acknowledgement** to apply to it at all. So it is
an eleventh `FindingCode`, class `SuspiciousButPermitted` — the class that is blocking until
acknowledged. First attempt: refused, carrying the finding. Second attempt, carrying that exact
finding: committed.

`span` is `None`, because a parse rejection is a **position**, not a range of bytes.

### 2.5 D5 — `validate` must not produce the new code, and a test asserts it from both sides

`FindingCode` had, until now, an invariant worth keeping: `every_finding_code_is_reachable` proved
that some fixture produces every code. The new code breaks it, because the save transaction
produces it and `validate` cannot.

The exemption is written so it cannot rot. It asserts **both** that no fixture produces the code —
so `validate` growing a path to it fails the test — **and** that the exempted name is still a name
the enum declares, so renaming the variant fails the test rather than silently exempting nothing.

### 2.6 D6 — a non-`Parse` syntax error is the same finding, with no position

`Offset` and `Invariant` syntax errors indicate a defect in this crate, not in the user's text.
They also become `DocumentDoesNotParse`, with `line`, `column` and `byte_index` all `None`. **A
user's bytes are never withheld over this crate's own bug.** That is why the three operands are
optional and why the dictionary sentence names no placeholder.

### 2.7 D7 — a replacement reports one whole-document span

`SavedDocument::replacements` reports a single span of `0..source.len()` for a replacement. Empty
would read as *nothing was replaced*, which is false. The single full span is the truthful
byte-level statement of what happened, and it is explicitly **not** a locality claim — D2 is what
keeps those two apart. A test rebuilds the file from it.

### 2.8 D8 — `notes` is always empty for a replacement

A raw save re-encodes nothing and moves nothing, so it has nothing to disclose. This was stated as
a claim to test rather than assume, and it is tested.

## 3. The invariants this phase did not touch

- **`save_document` is still the only entry point that may write a user's file.** There is exactly
  one `lock_path()` call in production code, and `replace_locked_file` is called from exactly one
  place, inside the transaction, holding that lock. `replace_file_atomically`, which takes the lock
  itself, is called from nowhere but its own definition.
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1 of the
  project).
- **An editor-model error is still not acknowledgeable.** The owner's ruling widened exactly one
  thing — a text the *parser* rejects — and a test pins that it widened nothing else.
- **No `force` flag, no acknowledgement bypass for a stale revision.**

## 4. The headline property

`stale_raw_save_never_overwrites_newer_bytes` is consult Q7's named test and was written first. It
loads revision A, externally replaces the file with byte-distinct text B, then attempts to save
candidate C against revision A, and asserts the concurrency conflict, that **B is still byte-identical
on disk**, and that no commit was reported.

It runs inside `within()`, a bounded-timeout instrument that spawns the work on its own thread and
waits with `recv_timeout`. The defect this file most fears is **a call that never returns**: a
replacement path that reached for the non-reentrant lock a second time would park forever, and a
test that simply waited would hang the suite instead of failing it.

## 5. The first fix round — Q6 was not honoured, and a test had codified that

The aggregate review found the phase's one real defect before it was committed.

The backup path was **content-mode-neutral**: `take_backup(backups, …)` runs when the save commits,
and does nothing when `SaveRequest.backups` is `None`. For an `Edits` save that is defensible — the
patch engine bounds what a commit can destroy to the planned spans. For a replacement it is exactly
what consult Q6 forbids: *every committed raw replacement must have a recoverable pre-commit image
… do not commit without recoverability.* Nothing of the previous file survives a raw commit, so a
`backups: None` replacement destroyed a file with no copy of it anywhere.

`every_byte_exact_fixture_is_committed_exactly_as_submitted` passed `None` and committed fourteen
whole-file replacements, so **a test had codified the wrong behaviour** — the same shape as
2b-2c-2's Low finding.

**Fixed** with `SaveError::ReplacementRequiresBackups { path }`, a struct variant (D5 of the
project), raised **before the lock**, immediately below the read-only check and deliberately after
it: a package file must not be written whatever the caller supplies, so that is the more
fundamental answer and the one worth reporting. Nine tests now pass a real `BackupSession`.

**The two backup outcomes that look alike are distinguished, and that distinction is tested.**
`take_backup` answering `None` because *the session already holds a copy of this file* is not the
failure case — that copy **is** the recoverable image, and Q6 rules explicitly that a one-snapshot
system should *preserve that snapshot rather than overwriting it*. Refusing there would make a raw
editor unusable after its first save.
`a_second_replacement_in_one_session_commits_with_no_second_copy` asserts the commit **and** that
the first snapshot survives unchanged. Only a **missing session** is refused.

### 5.1 The side effect that was accepted deliberately

Because the check is pre-lock, it also refuses a `backups: None` replacement whose text would have
turned out **byte-identical** and so committed nothing. Q6's letter says *every **committed** raw
replacement*, so this is stricter than the ruling requires.

It was kept, for a reason: making the requirement depend on the file's content would mean **a
caller cannot know whether its request is well-formed without reading the file**. "A replacement
requires a backup session, full stop" is a rule a caller can satisfy in advance; "unless it happens
to change nothing" is not. The refusal is also in the safe direction — it never causes a write.

## 6. The second fix round — an acknowledgement did not name the text it was about

The aggregate code review (`docs/reviews/phase-2b-2c-3a-code.md`) returned **NOT READY** on one
High finding, and it is the sharpest defect this phase had.

`Acknowledgement` matches findings as an **exact multiset and nothing else**, and
`DocumentDoesNotParse` carried only the parser's stopping point — line, column, byte offset and
message. A stopping point is a property of the text's *invalid prefix*, not of the text: two
byte-distinct candidates that share that prefix and differ only after it produce **equal** findings.
So consent collected for one broken text would have silently committed a different one. The consult's
Q5 had already assumed the property that was missing — *"changing the text requires recomputing
findings and matching a new exact multiset"*.

The existing `acknowledging_one_unparseable_text_does_not_acknowledge_another` could not see it: it
asserts `assert_ne!(first, second)` and so only ever exercised the case where the two findings
already differed.

### 6.1 D9 — the finding carries the candidate's own `ContentRevision`

**Fixed by making the finding content-addressed to the exact candidate.** `DocumentDoesNotParse`
gained a `revision: ContentRevision` operand — the hash of the **submitted text**, not the target's
— beside the three position operands. It stays a struct variant (D5 of the project).

The point of choosing this shape over any other is that it adds **no new concept**: the
acknowledgement protocol is untouched, `Acknowledgement`'s shape is untouched, the `Edits` mode is
untouched, and there is still no `force` flag and no second consent channel. A different text is
simply a different finding, and the exact-multiset machinery that already existed does the binding.

`ContentRevision` serializes as a 64-character hex string, so the operand crosses the wire as one
more string. **No dictionary sentence names it**, and that is deliberate rather than an omission: it
is an opaque digest and would be noise on a screen. The Rust placeholder check
(`every_save_transaction_placeholder_names_an_operand_serde_writes`) is one-directional — every
placeholder must name an operand, not every operand must appear — so nothing forced a hash into a
user-facing sentence. `saveCodes.test.ts` asserts its **absence** from both languages' rendering,
beside the same assertion `detail` already had.

### 6.2 The test the review named as the single most valuable one missing

`an_acknowledgement_cannot_carry_to_a_text_that_fails_in_the_same_place`. Two byte-distinct texts
share the invalid prefix `matches: broken: here` and differ only afterwards; the parser stops both at
line 1, column 15, byte 15, with the same message. The test **asserts that premise first** — equal
stopping points, equal span, equal node, equal path — so it cannot pass vacuously on a pair that
never collided, and would fail immediately if the operand were removed. It then proves that the
acknowledgement of the first refuses the second, that the target is byte-identical **and the same
inode**, that the session copied nothing, and finally that the *right* acknowledgement does commit,
so the test cannot pass by refusing everything.

### 6.3 What a surplus acknowledgement does — the review's open question, answered

An acknowledgement holding **only findings that were never issued** commits nothing:
`covers_all` matches every *candidate* suspicion against a distinct acknowledged copy, so findings
about some other text cover none of them.
`an_acknowledgement_of_findings_that_were_never_issued_commits_nothing` pins it.

**A surplus entry alongside a covering one does *not* refuse**, and that is deliberate and
pre-existing: `a_surplus_acknowledgement_does_not_refuse` in `crates/espansoconfig-core/src/persist/save.rs`
has always pinned it. The rule is *every suspicion was acknowledged*, not *every acknowledgement was
used*. It is not a hole in the binding — an extra finding can only ever fail to match, never match
something it does not equal — and the second half of the new test exercises exactly that case so the
two statements cannot be confused.

### 6.4 Four tests that asserted proxies

The review's Medium finding. Each now fails against the implementation it could not previously
distinguish:

- `a_byte_identical_replacement_commits_nothing_and_takes_no_backup` observed a **content revision**,
  which cannot tell *not written* from *rewritten with the same bytes*. It now observes the target's
  **inode and modification time**, and additionally asserts that a replacement which really does
  change the file *does* install a new inode — so the check means something on this filesystem.
- The two `*_refused_before_anything_is_read` tests observed only the returned error and unchanged
  bytes, which an illicit lock-and-read would also satisfy. Each now **deletes the target and repeats
  the call**: every step the refusal precedes fails on a path with no file at it, so the same typed
  refusal coming back is the evidence. Both were **renamed** to
  `*_is_refused_without_consulting_the_target`, because a read whose result is discarded is invisible
  to any black-box test and the old name claimed more than that. The mutation was checked by moving
  the pre-lock check below `lock_path` and watching the test fail.
- `a_replacement_never_reports_a_presentation_note` proved only an empty report. It now asserts the
  **bytes on disk** at every one of its four stages, because "no note was reported" and "nothing was
  normalised" are two different statements.
- The stale test identified its error through `contains("holds")` — a substring of a `Display` string
  that no rule keeps stable. The bounded-timeout thread now lifts the typed error into a small `Send`
  `Attempt` summary, and the assertion is an equality against
  `Attempt::RevisionMismatch { expected, found, refusal: true, may_have_written: false }`.

## 7. Holes this phase leaves open

### 7.1 Nothing calls the new mode

`SaveContent::ReplaceText` has no caller outside tests. 2b-2c-3b registers `save_raw_document`, and
until it does, the mode's behaviour under a real command — cache invalidation, identity staleness,
the reload the frontend owes after a commit — is unexercised.

### 7.2 Every `MatchId` in the file is stale after a committed replacement, and nothing says so

Consult Q3 requires the frontend to invalidate all cached projections and identities after
`committed: true`. The core reports the facts a caller needs, but **the obligation is not
represented in a type** — a caller that ignores it compiles. 2b-2c-3b must discharge it.

### 7.3 The new code and the new error have never been drawn

`code.findingCode.documentDoesNotParse` and `code.saveError.replacementRequiresBackups` exist in
both dictionaries and in the TypeScript union, and neither has ever appeared on a screen. This
joins the standing debt: the thirty-two `code.draftError.*` strings, `code.commandError.draftRefused`,
the eight `code.editError.*` sentences, `code.commandError.documentHasNoMatchList` and the two
`code.presentationNote.*` sentences are all in the same position.

### 7.4 Two more Spanish sentences checked only by heuristic

215+ Spanish values are now checked only by a heuristic that no sentence is identical to its English
counterpart and that placeholders match. Nothing establishes that any of them is idiomatic.

### 7.5 The real configuration has never had a whole-document replacement applied to it

The real-corpus sweeps cover moves and field edits. Nothing has ever replaced one of those files
wholesale. This extends hole 6.3 of 2b-2c-2 rather than adding a new kind of gap.

### 7.6 `DocumentDoesNotParse` carries the parser's message in `detail`

`detail` is the parser's own text. It is an operand of a wire-visible variant, so it will reach a
screen, and it is **not localized** — it cannot be, since it comes from `saphyr-parser`. The
dictionary sentence around it is localized and the parser's fragment is not.

### 7.7 The content-addressing operand has no frontend obligation behind it

`DocumentDoesNotParse.revision` binds an acknowledgement to one candidate **inside the core**. A
frontend that shows a finding, lets the user edit the text further and then hands the *old* finding
back is refused — correctly — but nothing in a type tells it why, and no screen exists yet to say so.
This is the same shape as hole 7.2 and 2b-2c-3b inherits both.

## 8. Deviations from the brief, recorded rather than hidden

- The brief said not to touch `src-tauri/src/commands.rs` except where a compile break forces it.
  Three lines changed: the `SaveContent` import, the one construction site, and a module-doc
  sentence that the rename made **factually false** ("`SaveRequest` takes a list of edits and
  nothing else"). `main.rs` is untouched and no command was registered.
- `src/lib/ipc/types.ts` and both dictionaries were changed although this is a core phase, because
  a wire-visible enum gaining a variant owes its string in both languages or the dictionary contract
  fails. That is the project's standing rule, not a widening of scope.
- The second fix round changed `src/lib/ipc/types.ts` again, for the same standing rule: the new
  `revision` operand is written by `serde`, and
  `every_save_transaction_variant_declares_exactly_the_operands_serde_writes` fails for a declared
  payload that does not hold it. Neither dictionary changed — no sentence names the operand — and
  `saveCodes.test.ts` gained the assertion that says so.

## 9. Verification

See `PROGRESS.md`, "Verification — Phase 2b-2c-3a". Every command was re-run by the orchestrator
after each fix round.
