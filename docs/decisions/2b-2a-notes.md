# Phase 2b-2a — the save spine and the first mutating command

The sub-phase that let something outside `espansoconfig-core` write a user's file for the
first time. One command, one edit kind, one result type, and the deserialization the
acknowledgement needed to travel inwards at all.

---

## 1. What was built

| Piece | Where |
|---|---|
| `Deserialize` on the acknowledgement graph | `crates/espansoconfig-core/src/persist/save.rs`, `validate/mod.rs`, `model/variable.rs` |
| `ItemMove::resulting_index` — the move's arithmetic, spelled once | `crates/espansoconfig-core/src/patch/edit.rs` |
| `Workspace::document_context` — what a `SaveRequest` needs | `crates/espansoconfig-core/src/workspace/mod.rs` |
| `Serialize` on `PresentationNote` and `NotReencodable` | `patch/edit.rs`, `emit/choose.rs` |
| `SaveResult` — the operation-neutral wire result | `src-tauri/src/save.rs` (new) |
| `CommandError::SaveFailed` and `CommandError::MoveNotWithinOneSequence` | `src-tauri/src/error.rs` |
| The app-owned `BackupSession`, and `move_match` | `src-tauri/src/commands.rs` |
| The typed wrapper, the browser action, the two new namespaces | `src/lib/ipc/`, `src/lib/browser/`, `src/lib/i18n/` |

Registered commands: **7** in `commands.rs` (six read-only plus `move_match`) and **1** in
`menu.rs`.

---

## 2. The wire convention, chosen explicitly

`SaveResult` is **flat**, like `CommandError`: one `outcome` discriminant plus the operands
that outcome declares. It is *not* the core's externally tagged convention.

The reason is what the type is. Phase 2b-1 settled that the core writes its own errors
externally tagged and that a frontend wanting flat top-level codes **builds a shell type the
way `CommandError` already does** (`2b-1-notes.md` §1.2). `SaveResult` is that shell type: it
is declared in `src-tauri/`, it exists only because a command needs an answer shape, and it
sits on the same boundary as `CommandError`, one channel over. A boundary that spelled its
two discriminants two different ways would be exactly the drift both conventions exist to
prevent.

**What it carries is not reshaped.** A `Finding`, a `SaveVerdict`, a `PresentationNote` and a
`DocumentView` all cross as the core writes them. The shell is flat; the cargo keeps its own
convention — which is what `CommandError` has done since 1b-2a, where `Io` is a flat code
carrying a core-spelled `kind`.

Every arm owes its two dictionary entries. `code.saveResult.{saved,conflict,refused}` exist in
both files, and `dictionary_contract.rs` fails the build without them — the namespace is
derived from the **variant** names, and `the_serialized_outcome_is_the_uncapitalised_variant_name`
in `save.rs` pins that the wire word and the key agree.

---

## 3. The conflict payload's honesty rule

`save_document` reports a stale base as `SaveError::RevisionMismatch { path, expected, found }`
and hands back **no bytes**. The command layer therefore re-reads to describe the disk side —
and that read happens **after the lock is released**. It is a different observation.

So the payload carries **both**:

- `found` — what the locked read saw. **The bytes that refused the save.**
- `disk_revision` — the revision of the **fresh read taken afterwards**.

They are usually equal and they need not be. When they differ, the file changed again in
between, and neither this application nor any string it shows may present the two as
descriptions of the same bytes. The variant's doc comment says it, `ConflictResult` in
`types.ts` says it, and `a_conflict_reports_the_refusing_revision_and_the_fresh_read_separately`
in `save.rs` makes all three of `expected`, `found` and `disk_revision` differ so that no two
of them can be confused for one another by accident.

**The payload is built in one place**, `conflict_after_the_lock` in `commands.rs`, and the rule
is discriminated against that function rather than against the command — the review's third
finding, and §11.3 for why the interleaving is not reachable through `move_match` at all.

`disk` — the projection of that fresh read — is carried too, and `disk_revision` is deliberately
a restatement of `disk.revision` at the **top level**: the whole point of the rule is that the
two revisions can be compared without descending into a projection. The redundancy is the
mechanism, not an oversight.

---

## 4. `base` is omitted — a deliberate deviation from plan §6.4

Plan §6.4 sketches `Conflict { disk_revision, disk, base, draft }`. This type omits **`base`**,
and it omits `draft` because `move_match` has no draft at all.

The frontend already holds what it opened. That *is* what "base" means — the projection the
caller was editing against, which it sent as `base_revision` a moment earlier. Sending it back
is the application quoting the caller to itself, and it doubles the size of the largest payload
on this boundary to do it. `expected` carries the base **revision**, which is the only part of
it a caller cannot re-derive from what it already has.

The plan's `Saved { revision, match_id }` is also not what was built: it is match-shaped, and
`save_raw_document` will have no match while `move_match` has no draft. `SaveResult` is
document-level for that reason, with `moved: MatchId | null` as the field an operation fills
when it happens to have one.

---

## 5. Where the backup session lives, and what happens if it cannot be made

`WorkspaceSession` now holds an `Open { workspace, backups }` rather than a bare `Workspace`.
The two travel together because they have the same scope: a `BackupSession` is *"which files
this editing session has already copied, and which batch folder its copies go in"*, and both
questions are about the directory that is open. Opening another replaces both.

**There is no fallback, because there is no fallible step.** `BackupSession::rooted_at` is
infallible by construction: it canonicalises the configuration root where that succeeds, keeps
it as spelled where it does not, and **creates no directory at all**. A session that saves
nothing leaves no trace on disk — `the_session_copies_a_file_before_its_first_change_and_not_again`
asserts that the backup root does not exist until the first save. So `move_match` passes
`Some(&backups)` unconditionally, and **no code path in this crate passes `None`**.

**That is a property of today's constructor, not a law**, and the decision if it ever changes
is written down on `WorkspaceSession::open` rather than left to whoever meets it: a save whose
safety net cannot be put in place must **refuse**, exactly as `SaveError::Backup` refuses one
whose copy cannot be written. Saving with `backups: None` would make an unread field the only
thing between a user and a destructive operation performed without the copy that exists to
survive it.

`backup_taken: false` is a **success**, and the test says so: the second move of one file in
one session reports `false`, because the rule is *before the first modification of each file
per session*. Nothing in this phase's strings says a backup makes a file recoverable —
retention is ten sessions.

---

## 6. How a stale `MatchId` is answered

`MatchId { document, revision, node }` carries the revision it was minted from, so **every
successful commit invalidates every identity the caller holds for that file.** This is the
central problem of the sub-phase, not an edge case.

The answer is three steps, and none of them guesses:

1. **The engine's own arithmetic, once.** `ItemMove::resulting_index(from)` is now public and
   `plan_move` calls it, so the index the item lands at is computed in exactly one place. A
   caller and the engine cannot disagree about where the item went.
2. **The address, not the position in a list.** The new address is the item's own sequence path
   with the landing index appended, and the moved match is found in the fresh projection by
   comparing that whole `DocumentPath`.
3. **The fresh projection, not the old one.** `after_a_save` calls `Workspace::refresh` and
   mints the identity from what came back.

`moved` is `None` — a fact, never a failure — when the operation had no single match, when the
commit was skipped, or when **the fresh read disagrees with the revision the transaction
established**, which means some other writer reached the file in between and the position is no
longer known to hold what was written there.

`a_move_answers_with_an_identity_that_resolves_in_the_new_revision` pins both halves: the
returned identity resolves through `get_match` to the snippet that moved, and the identity that
was passed in comes back as `identityStaleRevision`.

---

## 7. Cache coherence

`save_document` hands back *facts* and deliberately does not reach into `Workspace`. Keeping the
session's cache in step is therefore this layer's job, and without it a `get_document`,
`get_match` or `document_text` after a save would be served the parse of the bytes the save
replaced — which on a screen is indistinguishable from a move that did not happen.

- **Committed save** — `Workspace::refresh`, which reparses only when the bytes changed. A read
  that fails leaves the entry **evicted** rather than stale.
- **Conflict** — `refresh` too, and the projection it returns *is* the `disk` payload. One read
  serves both purposes.
- **A failure whose rename may have completed** (`SaveError::may_have_written`) — the entry is
  evicted. A missing parse costs the next caller a read; a stale one is this application showing
  a file it no longer has.

`a_committed_move_leaves_the_session_reading_the_new_bytes` proves it from both surfaces that
could serve a stale parse, and compares what the session serves against `std::fs::read`.

On the frontend, `BrowserState.moveMatch` calls **`forgetFileText()`** — its fourth caller and
the first that is about a *write* — and then re-reads, so the raw viewer cannot redraw bytes
that have just been replaced. **It calls it on exactly the cases the Rust side evicts on**, which
is the review's High finding as a rule (§11.1): a commit, a `Saved` whose revision is not the one
this state was projecting, and a **failure whose `may_have_written` is true**. A `Saved` with
`committed: false` is none of them — nothing was written, so nothing was invalidated.

---

## 8. Everything else is an `Err(CommandError)`, and two variants were added

`CommandError::SaveFailed { error: SaveError }` carries the transaction's typed failure
**whole**. Flattening nine variants into nine codes would duplicate a vocabulary that already
has its own namespace and its own accessor, and would lose the nesting 2b-1 kept on purpose:
`WriteError::may_have_written` is computed from a `WriteStep` a flattened copy would drop.

**It writes a second operand it does not store.** `may_have_written` is `SaveError`'s own
predicate evaluated in the serializer, added by the review round (§11.1), and it is the answer to
the one question whose answer changes what a caller does next. The nesting is still there and the
predicate is still computed in exactly one place — the operand is that place's result crossing,
not a copy of its reasoning.

Two consequences, both deliberate:

- **`CommandError` is no longer `Clone`, `PartialEq` or `Eq`.** A `SaveError` reaches down to an
  `io::Error`, which is neither cloneable nor comparable — and for a good reason: two I/O
  failures with the same kind are not the same event. Hand-writing a `PartialEq` would mean
  inventing an equality for `io::Error` and then having six tests assert on that invention. The
  six call sites now match on the variant or compare `code()`.
- **`OperandShape` gained `'object'`**, for the one operand that is a nested wire enum. It is
  the weakest shape in the table on purpose: `isCommandError` can say the operand is present and
  is an object and no more. What keeps that payload honest is the `SaveError` union in
  `types.ts`, which `wire_contract.rs` compares against what `serde` writes.

`CommandError::MoveNotWithinOneSequence` is a **negative claim**, and the wording follows it: it
does not say the destination is in a different sequence, it says this application could not
establish that it is in the same one. Three shapes reach it — a destination whose address names
another sequence, a match with no address at all, and an address that does not end in a sequence
position — and all three are one decision to a caller.

**Its cross-sequence half is unreachable through `move_match` today**, and that is recorded
rather than papered over: every match a `DocumentView` holds is an item of the one `matches`
sequence at the root of stream document 0, so two matches of one file are always siblings. The
cross-**document** case *is* reachable and is `IdentityWrongDocument`
(`a_destination_in_another_document_is_refused_and_writes_nothing`). The check exists because it
is what keeps D2r true the day the projection grows a second sequence, and it is exercised where
it can be — against the addresses themselves, in
`only_an_address_ending_in_a_position_names_a_sequence_item`.

---

## 9. The acknowledgement

**It was already an exact multiset.** `Acknowledgement::covers_all` consumes each match
(`swap_remove` on a working list) rather than testing membership, `verdict` calls it, and
`two_equal_suspicions_are_not_covered_by_one_acknowledgement` already pinned the distinction.
Nothing needed fixing.

What 2b-2a added is the direction it can now travel and a test of the multiset property
**through that direction**:

- `Deserialize` on `Finding`, `FindingCode` and `VariableKind`. `ByteSpan`, `NodeId` and
  `DocumentPath` already had it, so the graph is closed. `2b-1-notes.md` §5 listed `ByteSpan` as
  missing; it was not. **`ByteSpan`'s is now hand-written too**, because the derive it had could
  build an inverted span the type's own constructor refuses — the review's second finding, and
  §11.2 for the audit that found it to be the only one of its shape in this graph.
- **`Acknowledgement`'s `Deserialize` is hand-written and routes through
  `Acknowledgement::of`.** A derive would fill `accepted` with whatever arrived, including an
  `EditorModelError`, and the type documents itself as holding suspicions and nothing else. The
  filter is not a security boundary — `verdict` refuses an error however much is acknowledged —
  it is the invariant staying true of every value of the type, so `len()` cannot come to mean two
  things. `a_deserialized_acknowledgement_drops_what_it_cannot_acknowledge` is the pin.
- `a_deserialized_acknowledgement_still_counts_occurrences` builds the payload with `serde`,
  reads it back, and asserts that one copy **refuses** two equal suspicions and two copies
  **proceed** — so it fails from either side. A `Deserialize` that collapsed the list into a set
  would leave every pre-existing assertion green.
- `a_finding_survives_the_round_trip_with_all_four_of_its_parts` — the acknowledgement is matched
  by `Finding`'s own equality, so a payload that lost the span, the node or the path would
  silently stop matching and every save would be refused twice.
- End to end through the command:
  `a_suspicion_refuses_the_move_until_the_findings_come_back` takes the findings out of a
  refusal, serializes them, reads them back as an `Acknowledgement`, and watches the same move
  proceed.

**There is no `force` flag anywhere**, and two tests assert its absence in the arguments the
frontend sends rather than only in the types.

---

## 10. What this phase did not do, and why

- **`save_match`** — needs a `MatchDraft` and a minimal-diff engine. 2b-2b.
- **`create_match`, `delete_match`, `save_raw_document`** — the core has **no primitive** for
  inserting a sequence item, removing a sequence item, or replacing a whole document's text.
  Inventing one at the command layer would be an edit engine living outside the crate that owns
  the fidelity rules. 2b-2c, and the primitives come first.
- **No screen was read.** Nothing in this project renders a Svelte component in an automated
  test, and this phase added no component — the logic is in `workspace.svelte.ts` and is driven
  by `workspace.test.ts`. The first component that draws a `SaveResult` owes a window reading.
  What *was* measured, in `dispatch_check.rs`, is the boundary: `move_match` driven through the
  **real Tauri dispatcher** with the shipped configuration and the shipped `"permissions": []`
  capability file, with its camelCase argument names, its `Acknowledgement` arriving as JSON, a
  flat `outcome` coming back, the answered identity resolving through `get_match`, and a refusal
  crossing in the **`Ok`** channel and then being acknowledged.
- **`Rotation::bounded()` and `SaveError::is_refusal()` still do not cross** (2b-1 hole 6).
  `SaveResult` answers the second question structurally for the three outcomes it names — a
  refusal is an `Ok` arm and a failure is an `Err` — but a frontend that wants `is_refusal()`
  for a `SaveFailed` payload still cannot get it.

---

## 11. The review, and what closing it changed

`docs/reviews/phase-2b-2a-save-spine.md` — five findings, no blockers. All five are closed.
Three of them were *tests that passed vacuously*, so each one's fix was checked by breaking
the code on purpose, watching the new assertion fail, and putting it back.

### 11.1 High — a failed save that may already have written left the screen alone

Every `saveFailed` left the frontend projection and the raw-text snapshot untouched, including
when the nested `WriteError` said the rename had already happened. The command layer evicts its
own cached parse in exactly that case (`SaveError::may_have_written`), so the two sides
disagreed: the window went on drawing the pre-save order and the pre-save bytes over a file that
might already hold the moved snippet.

**The wire did not carry enough to decide it, and now it does.** The frontend could have derived
the answer from the nested `WriteStep`, and that is precisely what must not happen — a second
list of write steps in TypeScript drifts from the `match` in `write.rs` the first time a step is
added. `CommandError::SaveFailed` therefore writes a **second operand**, `may_have_written`,
which is [`SaveError::may_have_written`] *evaluated in the serializer*. There is no field to set
wrongly because there is no field, and `a_save_failure_says_whether_its_rename_may_have_completed`
in `error.rs` takes its expectation from the core's own predicate over three write steps rather
than writing the answers out.

On the frontend the question has one spelling, `mayHaveWritten()` in `src/lib/ipc/errors.ts`, and
a `true` does what the Rust side does: `forgetFileText()`, re-read the document, repair the
selection. `OperandShape` gained `'boolean'` so `isCommandError` type-checks it — an absent
operand reads as `undefined`, which is falsy, which is the quiet version of the bug itself.

The existing test `reports a failed save and changes nothing on the screen` is **kept**, with its
fixture's meaning stated: it fails at `Rename`, which is the step that means the rename did not
happen. Its twin, `re-reads the file when the failure says the rename may have completed`, fails
at `SyncDirectory`. Removing the re-read makes the new test fail and leaves the old one green,
which is the pair working as intended.

### 11.2 Medium — an inverted `ByteSpan` could be deserialized

`ByteSpan::new` enforces `start <= end`; the derived `Deserialize` filled both fields directly,
so `{"start":20,"end":10}` was accepted and a later `len()` underflowed. Reachable: a span is an
operand of a `Finding`, and a finding travels inwards inside an `Acknowledgement` (§9).

`Deserialize` is now **hand-written and routes through `ByteSpan::new`**, in the same spirit as
`Acknowledgement`'s. An inverted span is a deserialization **error**, not a repair, and the
reason is recorded on the impl: clamping, swapping or zeroing all produce a span this crate would
then act on, and because the acknowledgement is compared against findings recomputed under the
lock, a repaired span would silently stop matching and refuse the save a second time with no
statement of why. The refusal surfaces as `serde`'s own rejection rather than a code — the same
thing every malformed command argument already produces, and not worth a code because no
interface this application ships can build one.

**Audited for the same shape elsewhere in the newly-deserializable graph** (`Finding`,
`FindingCode`, `VariableKind`, and the pre-existing `NodeId`, `DocumentPath`, `ContentRevision`):
`ByteSpan` was the only one. `NodeId`'s constructor is `pub(crate)` and enforces nothing a value
can violate, `DocumentPath::new` has no invariant, `FindingCode`'s operands are `String`s and a
`VariableKind`, and `ContentRevision` already had a hand-written `Deserialize` that refuses
anything that is not 64 hex digits — which is the precedent this follows.

Two tests: `a_deserialized_byte_span_cannot_be_inverted` in `syntax/mod.rs`, which also asserts
the empty span `7..7` stays legal, and `an_acknowledgement_cannot_carry_an_inverted_span` in
`persist/save.rs`, which feeds in the exact payload the review wrote out and asserts its
well-ordered twin still reads back.

### 11.3 Medium — the conflict test could not discriminate the honesty rule

`a_file_replaced_under_the_session_answers_with_a_conflict` made `found` and `disk_revision`
equal, so an implementation that set one from the other passed it. The production construction
was correct; the test was not.

**The interleaving is not reachable through `move_match`** — the locked read and the fresh read
happen inside one synchronous call, so no caller of the command can put a writer between them.
It *is* reachable one level down, so the payload's construction was given a name of its own,
`conflict_after_the_lock`, and that is now the only place it is built. The new test
`a_conflict_describes_the_refusing_read_and_the_fresh_read_separately` drives a **real** refusal
through `move_match` to obtain `found`, replaces the file a second time with a differently-shaped
document, and calls the builder with that same `found` — the interleaving exactly, with nothing
invented. It asserts the two revisions differ, that `disk_revision` is `disk`'s own revision, and
that `disk` projects the *third* text. Setting `disk_revision: found` fails it and leaves the old
test green.

The old test is kept and its doc comment now says what it does and does not pin, rather than
claiming the two revisions are "the whole assertion".

### 11.4 Low — the frontend treated every `Saved` as if bytes had changed

`committed: false` is a documented success: moving one of two byte-identical snippets produces a
byte-identical candidate and nothing is written. The frontend nevertheless dropped the raw text,
re-read the document and repaired the selection — harmless, and a comment and a behaviour that
overstated what `Saved` guarantees.

The branch is now taken on the two facts that actually mean this screen is out of date: the file
was rewritten, **or** the revision the transaction ended on is not the one this state was
projecting. The second half is not decoration — the transaction's two reads are both under the
lock, but a non-cooperating writer between them is what `Saved::revision` is a fact about.
`leaves the screen alone when a save commits nothing` pins it, and it is written as a success:
same selection, no notice, no second read of either the projection or the text.

### 11.5 Low — the byte-identity test did not compare bytes

`a_move_leaves_the_bytes_it_did_not_move_alone` counted triggers, counted the unmodelled key,
checked the first line and compared the file's length. A command that rewrote `replace: first` to
another value of the same length passed all four — that was confirmed by writing exactly such a
corruption in a throwaway test and watching every old assertion hold.

It now derives the expectation from the pre-move text and the move itself: `split_into_items`
cuts the document into everything above the first item and one string per item envelope, the two
envelopes are concatenated in the other order under the same head, and the file on disk is
compared to that **byte for byte**. The split is asserted lossless first, so the expectation is
the file rather than a restatement of whatever came out.

---

## 12. Holes this phase leaves open

**None of the eight below was closed by the review round**, and saying so is the point of
saying it: the five findings were *defects and vacuous tests*, not entries on this list, and
§11 records each one's disposition. Two entries did change — 3 and 4 gained the review's own
strings and tests — and two are new: 9 and 10, which the round itself created.

1. **The cross-sequence branch of `MoveNotWithinOneSequence` is unreachable through the
   command** (§8). Its code path is exercised against addresses, not through a save.
2. **`SaveResult::Saved::notes` is always empty in practice.** A move re-encodes no scalar, so
   `PresentationNote` and `NotReencodable` are on the wire with no producer behind them until
   2b-2b's `save_match`. That is 1b-1's shape repeated, and it is deliberate — the alternative
   was landing eight dictionary entries in the middle of the sub-phase that needs them.
3. **Nothing establishes that the Spanish is Spanish.** Thirteen new Spanish values, checked
   only for being non-blank, non-identical to their English twin and in placeholder agreement
   with it. The standing hole from 1b-1 §9. The review round added **no** dictionary entry —
   `may_have_written` is an operand nothing renders — so the count is unchanged.
4. **The sentences are unreviewed for accuracy against the code they describe.** A
   wrong-but-plausible sentence passes every check in this repository. The review round changed
   no user-facing sentence, so this is exactly as wide as it was.
5. **`move_match` holds the session mutex across the whole save**, which includes a lock, two
   parses, a validation, a backup copy and a rename. Every command is synchronous and runs on
   the main thread (`commands.rs`), so a slow disk blocks the window. The module's own
   documentation already says that trade is worth re-examining when Phase 2 edits on a debounce;
   this is the first command for which it is not theoretical.
6. **A conflict's `disk` payload is a whole `DocumentView`**, which is the largest value on this
   boundary. It is boxed in Rust so the common `Saved` arm does not pay for it, but the JSON is
   as big as a `get_document` response. Nothing measures what that costs on a large file.
7. **Two writes, one report.** A committed save writes the target *and* a backup; if the rename
   then fails, `discard_backup` unrecords the copy but a file may remain. Unchanged from 2a-3b
   hole 2, and now reachable from a command.
8. **The identity `moved` names is minted from a read taken after the lock was released.**
   Between the commit and the refresh, another writer can replace the file; the code answers
   `None` in that case, which is honest but means a user's selection is dropped by something
   they did not do.
9. **The conflict payload's honesty rule is pinned *below* the command** (§11.3). The
   interleaving that makes `found` and `disk_revision` differ cannot be produced through
   `move_match`, because both reads happen inside one synchronous call; the discriminating test
   drives `conflict_after_the_lock` directly. What is unproven is therefore not the rule but the
   claim that the command reaches that function with the error's own `found` — which the
   compiler's one call site is the only thing holding.
10. **A `may_have_written` re-read is a re-read, not a guarantee** (§11.1). The frontend forgets
    its text and asks again; a re-read that itself fails is reported and leaves the projection
    alone, because this state cannot describe a file it could not read. Nor is either side's
    answer a claim about what the file holds *now*: it says this attempt's rename had already
    happened, and another program can have written since. And **no screen was read for any of
    it** — the whole path is driven through `workspace.test.ts`, which instantiates no component
    (§10).

---

## 13. Verification

All run at the repository root. The second column is after the review round; where the number
moved, the figure the sub-phase itself recorded is in brackets.

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **828 passed, 0 failed**, 20 binaries (823 before the review round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm run check` | exit 0 — 375 files, 0 errors, 0 warnings |
| `npm run build` | exit 0 |
| `npm test` | exit 0 — **685 passed, 0 failed**, 28 files (681 before) |
| `#[tauri::command]` count | **7** in `commands.rs`, **1** in `menu.rs` |

No test reads or prints a line of the owner's configuration: every fixture in this phase is
hand-authored and neutral (CLAUDE.md §1).

---

## 14. What 2b-2b and 2b-2c inherit

- **`SaveResult` is the answer shape, and it is operation-neutral.** `save_match` fills `notes`
  and `moved`; `create_match` fills `moved` with the identity of the match it created;
  `save_raw_document` fills neither and leaves `moved` `null`. **Do not add an arm** — the three
  are the three outcomes of *a save*, and a fourth would be a failure wearing the `Ok` channel.
- **The conflict payload's two revisions are a contract**, not a convenience. A later command
  that builds one must re-read after the lock is released and must not report the error's
  `found` beside a projection taken separately as though they described the same bytes.
- **`base` is not on the wire and must not be added back** (§4).
- **The backup session is owned by `WorkspaceSession` and is never `None`** (§5). A new mutating
  command threads the same one through; it does not make a second.
- **Cache coherence is the command layer's job** (§7), and `forgetFileText()` is called on every
  write that changed the bytes — **and on a failure whose `may_have_written` is true**, which is
  the same rule the Rust side applies to its own cache (§11.1). A `Saved` alone is not the
  trigger: `committed: false` changed nothing and invalidated nothing.
- **A path on the wire is display text, never an identifier.** Unchanged from 2b-1. `move_match`
  targets by `DocumentId` and `MatchId` only, and its destination is an **identity** rather than
  an index for the same reason a `DocumentPath` is not one: a position re-points itself the
  moment anything above it is deleted.
- **`ItemMove::resulting_index` is the one spelling of where a moved item lands.** A second copy
  in a command would be a second place for the answer to be wrong.
- **R25 stands**: a move may not be combined with any other edit in one batch. `move_match`
  sends a one-element slice, and a batch that mixed a move with a scalar edit would be a new
  decision with the compositionality question re-opened.
