# Phase 2b-2c-3b — decision record

**`save_raw_document`, the eleventh `#[tauri::command]`, and the last of Phase 2b-2c.**

Phase 2b-2c-3a gave `espansoconfig_core::persist::save_document` — the only entry point in this
application that may write a user's file — a second content mode, and gave it no caller. This
phase is that caller. With it, **every command Phase 2b was scoped to deliver exists**, and the
application can replace a whole file's text from a window.

The design consult for the whole of 2b-2c-3 is `docs/reviews/phase-2b-2c-3-design.md` and was
**not** re-commissioned. **Its Q2 was reversed by the owner**, in the second half of that same
file, and this phase implements the consult as amended.

---

## 1. What this phase built

- **`save_raw_document`** — the command, its `WorkspaceSession` method, and the free function
  `save_one_raw_document` that plans nothing. Registered in `src-tauri/src/main.rs`.
- **`run_one_save` generalized** from `edits: &[DocumentEdit]` to `content: SaveContent<'_>`, and
  its four existing callers updated to pass `SaveContent::Edits(&edits)`. **All five writing
  commands take one tail.**
- **`saveRawDocument()`** in `src/lib/ipc/commands.ts`, with `RawSaveInvalidation`,
  `ReloadAfterRawSave`, `RawSaveReload` and `RawSaveOutcome` beside it — the boundary half of the
  mechanism that closes 3a's hole 7.2 (§3 below).
- **`BrowserState.saveRawDocument`** in `src/lib/browser/workspace.svelte.ts`, with the two
  private functions the invalidation is made of — `forgetTheReplacedDocument` and
  `adoptTheReplacedDocument` — added by the fix round (§10). This is the running application's
  path, and it is what owns the invalidation.
- **`src/lib/browser/rawSave.ts`** — the presentation model for Q8 and for the owner's ruling,
  with `src/lib/browser/rawSave.test.ts` beside it.
- **Six dictionary keys in both languages**, reached through `tRawSaveMessage` and
  `tRawSaveChoice` in `src/lib/i18n/index.ts`.
- **Six new Rust tests** (five in `commands.rs`, one in `dispatch_check.rs`) and **36 new
  frontend tests** — 18 in `rawSave.test.ts`, eight in `commands.test.ts`, eight in
  `workspace.test.ts`, and two the `ipc-detail` guard sweep adds by itself because two new `.ts`
  files exist under `src/`.

## 2. The decisions, each with its reason

### 2.1 D1 — the command takes flat parameters, not a request struct

`document`, `base_revision`, `text`, `acknowledgement`. The shape the four writing commands
before it use, and the reason to keep it is that Tauri's argument deserialization is per
parameter: a `SaveRawDocumentRequest` would put one more hand-written wire shape between the
frontend and Rust for no gain, and `wire_contract.rs` would owe it an interface check.

The target is the **document identity**, never a wire path. `crate::wire_contract` records that
two distinct filenames can render to one `WirePath` string, so a command that accepted one back
as a target could write to the wrong file. It is a document rather than a match because a whole
text has no match in it to name.

### 2.2 D2 — a raw save takes no `view_at`, and that is the correct answer rather than a weaker one

This is the phase's one real departure from the shape of the other four, and it was decided
rather than drifted into.

Every other writing command refuses a stale `base_revision` **before** the transaction, and
`view_at`'s own documentation says why: each of them turns an identity into a **position** in one
particular parse, and a stale identity does not name a missing entry — it names a different one,
and succeeds. **A replacement turns nothing into a position.** Its request is self-contained: the
bytes are the request.

That leaves exactly one check worth taking, and one place worth taking it — the transaction's
own, against the bytes under the write lock. It is not a weaker answer, and consult Q7 is what
makes that concrete. Q7 names the highest risk of this whole mode as *silently overwriting
changes made after the raw editor loaded the file*, and in that scenario some other program wrote
the file while this session was idle: **the session's cached projection still holds the revision
the editor loaded, so a pre-check against it would pass.** Only the locked read can see it.

The transactional answer is also strictly richer. `SaveResult::Conflict` carries `expected`,
`found`, `disk_revision` **and the projection of what the disk holds now** — everything a raw
editor needs to tell the user what happened — where `CommandError::IdentityStaleRevision` carries
two hex strings and nothing else.

`a_stale_raw_save_never_overwrites_the_bytes_written_after_it_loaded` drives exactly this path,
and asserts the premise first: it checks that the session still believes the file holds what it
loaded *before* attempting the save, so the test cannot pass because some earlier refresh made
the pre-check redundant.

### 2.3 D3 — `run_one_save` was generalized, not copied

The brief required it and `PROGRESS.md` had already recorded why: that block is this layer's
single cache-coherency policy, and it was four copies before the `35a9e9e` cleanup round. The
parameter became the **content mode** rather than gaining a second optional argument, because a
raw save has no batch at all — a `Option<&[DocumentEdit]>` beside a `Option<&str>` would let a
caller construct a request that is neither or both.

The four outcomes it decides — commit, conflict, refusal, failure-with-eviction — are the same
four for a replacement, and the eviction rule matters *more* here: a failure after the rename
means the file may already hold a whole new text, and a window still drawing the old parse would
be showing a file that no longer exists in that form.

### 2.4 D4 — `at: None`, and it is permanent

`after_a_save` mints no identity. Not a defensive `None` and not a missing feature: consult Q3
rules that a committed raw save has no distinguished match, so `moved: None` is *semantically
correct*, and it is correct by construction rather than by policy — there is no single match a
whole-document replacement acted on.

### 2.5 D5 — the invalidation obligation belongs to the state that owns the cache

3a's hole 7.2, and the sharpest debt this phase inherited. See §3.

**Rewritten by the fix round.** The first version of this decision was *the obligation is a
required parameter of the frontend wrapper*, and the review showed why a parameter alone cannot
be the answer: it makes **omitting an argument** a compile error, not **ignoring the
obligation**, and this phase's own tests passed `() => {}`. The parameter is still there — it is
what makes the boundary drivable by a test that has no browser state — but the mechanism is now
that `createBrowserState` owns the invalidation and passes its own. §3 is the account.

### 2.6 D6 — the presentation model lives in `src/lib/browser/`, and returns codes

The project's standing split: `src/lib/browser/` holds what a test can reach, the component gets
the walk. Nothing in this repository renders a Svelte component in an automated test, so a
decision written in markup is a decision no test can see.

Every line the model produces is a **code**, never a sentence, and `i18n/index.ts` wraps
`rawSaveMessageKey` and `rawSaveChoiceKey` in `tRawSaveMessage` and `tRawSaveChoice` — exactly
the arrangement `selectionNoticeKey`/`tSelectionNotice` has had since 1c-1, and for the same
reason: a component that wrote `t(rawSaveMessageKey(m))` would be building a key in markup, which
`scripts/lint/built-translation-keys.ts` refuses.

### 2.7 D7 — "no position" is a case, and the byte offset is carried but never rendered

`line`, `column` and `byte_index` are each `Option` on the wire, because a syntax failure raised
inside this crate's own span layer is a defect in it rather than a property of the user's text —
and the user's bytes are never withheld over that (3a's D6). So `parserStopOf` answers a stop only
when the parser gave **both** a line and a column, and anything less becomes `positionUnknown`,
its own sentence in both languages. A model that formatted `null` into the position sentence
would put "line null" on a screen.

`byteIndex` is carried and **not rendered**. A byte offset is not a JavaScript string index — a
JS string index counts UTF-16 code units — so handing one to an editor as a caret position puts
the caret in the wrong place in exactly the documents this application exists to handle
carefully. That is the same rule `documentText`'s contract states, applied to the one new value
that could break it.

### 2.8 D8 — the choice is offered only when it can be kept

`RawSaveModel.choices` includes `saveAnyway` only when the verdict is
`RefusedForUnacknowledgedSuspicions` **and** the refusal carries at least one finding, and
`acknowledgement` is `null` for exactly the models that omit the button. A
`RefusedForEditorModelErrors` verdict cannot be moved by any acknowledgement, so offering to save
anyway beside one would be a promise this application would not keep. The frontend cannot see a
finding's *class* — `Finding` does not carry one — but it can see the **verdict**, which is the
same information at the level that matters.

The emptiness half is defensive rather than reachable and is documented as such: `verdict()`
produces that arm only when some suspicion went unacknowledged.

### 2.9 D9 — the parser's own message is carried and is not a sentence

`DocumentDoesNotParse.detail` comes from `saphyr-parser` and cannot be localized (3a's hole 7.6).
This is where that first becomes visible, and the answer is the one 3a predicted: the sentence
**around** it is translated (`code.findingCode.documentDoesNotParse`, and the three new
`browser.rawSave.*` sentences), and the fragment inside is carried on `UnparseableCandidate` for
a developer surface. A test asserts it appears in none of the messages the model builds.

## 3. The identity invalidation — how hole 7.2 was closed, and what it does not force

**Rewritten by the fix round.** The account below is what the code does *after* the review; §10
records what it did before and why that was wrong.

**The obligation.** After `committed: true`, every `MatchId` the caller holds for that file is
stale, because an identity records the revision it was minted from — and unlike a create, a
delete, a move or a scalar save, there is **no single match to answer with**. Consult Q3 puts the
obligation on the frontend. 3a recorded that it "is represented in no type: a caller that ignores
it compiles."

**The mechanism: the state that owns the cache performs it, and the wrapper's parameter is what
lets a test drive the boundary without that state.**

```ts
// src/lib/browser/workspace.svelte.ts — the running application's path
state.saveRawDocument(document, baseRevision, text, acknowledgement)

// src/lib/ipc/commands.ts — the boundary, whose fifth parameter the state fills in
saveRawDocument(document, baseRevision, text, acknowledgement, reload)
```

`BrowserState.saveRawDocument` has **no callback parameter at all**: there is nothing for a
caller to pass and therefore nothing for a caller to get wrong. It calls the wrapper with an
invalidation closure of its own, and that closure is the only production caller of
`ReloadAfterRawSave`.

**What the invalidation forgets.** `forgetTheReplacedDocument` is synchronous, total, and runs
before any `await`:

- the document's **projection**, removed from `views` — the snippet list, the sidebar count and
  `selectedMatch` all read off it;
- the held **selection**, dropped rather than re-pointed, with the selection generation bumped so
  that a `select()` in flight for that file cannot land afterwards;
- the raw viewer's **snapshot** of that file's text, when the viewer is pointed at it.

It is synchronous because an asynchronous invalidation has a window in which a getter can still
read the projections the commit destroyed, and `await` only protects the code that comes after
it — the review's second half of the Medium finding.

`adoptTheReplacedDocument` then reads the file again and looks for the selection the ordinary
way: positionally, and **then checked** against the source slice (R27), so a different snippet at
the held position clears the selection with `differentMatch` rather than moving it silently. This
is deliberately **not** `adoptTheDocumentOnDisk`'s path, which re-points a selection **by the
identity the command answered with**: a replacement answers `moved: null` permanently and by
construction, so there is no identity to re-point with.

Three failure modes are closed, and it is worth naming them separately because they are what the
alternatives leave open:

1. **Forgetting.** The application's entry point has no obligation to forget: the state performs
   the invalidation itself.
2. **Handling the wrong arm.** The wrapper decides *when*, not the caller: on `committed: true`
   and nowhere else. A caller that thought "saved means saved" cannot be wrong about it.
3. **Ordering.** The reload is awaited, and the state's own invalidation is synchronous before
   its first `await`, so nothing can read a stale projection between the commit and the forget.

**`committed: false` is modelled honestly.** A candidate byte-identical to what the file already
held is not written, no new revision exists, and nothing became stale — so the reload is **not**
called, and calling it anyway would make a window discard a projection that is still correct. The
wrapper says so with its own arm, `reload: { kind: 'notOwed' }`, rather than leaving "did not
run" and "ran and worked" indistinguishable.

**A conflict does not call it either**, and that was a real decision rather than an omission.
Nothing was written, so this call invalidated nothing. What *is* true is that the caller holds a
projection of bytes some **other** writer replaced — and that is carried in the answer's own
`disk` field, in an arm a TypeScript caller must narrow to before it can read anything, so it is
not silent. Calling `reload` there would blur "I wrote this" and "somebody else did", which are
two different things for a raw editor to say. The state adopts that projection instead, exactly
as a conflicted move does.

**A reload that fails cannot unwrite the file.** The wrapper answers a `RawSaveOutcome` rather
than a `CommandResult<SaveResult>`: the committed `SaveResult` is always on the success arm, and
`reload` carries `notOwed` / `done` / `failed` beside it. A throwing or rejecting reload is
caught, classified through `classifyFailure` — the same channel every other failure of this
boundary uses — and handed back on the answer. The state reports it and still returns the
committed outcome.

**What it does not force, stated rather than glossed.** `() => {}` still type-checks as a
`ReloadAfterRawSave`, and no TypeScript type can require a property of a returned value to be
*read*. Two things changed anyway, and they are the two that matter: the running application no
longer depends on a caller-supplied body at all, and a reload failure now survives as a value
instead of destroying the answer that says the file was written. A branded-token return type was
considered and rejected: it can only be produced by a cast somewhere, so it moves the escape
hatch rather than closing it, and it would have put an unconstructible type in the IPC layer's
public surface for that.

## 4. The invariants this phase did not touch

- **`save_document` is still the only entry point that may write a user's file.** This phase adds
  no call to `replace_file_atomically` or `replace_locked_file`, from a command or anywhere else.
  The lock is not reentrant.
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1 of the
  project). A raw save has no planning stage, so its only refusals are transactional — which is
  D2 above, not an exception to this rule.
- **No `force` flag, no acknowledgement bypass, no wire path accepted back as a target.** The
  frontend test asserts the absence of a property called `force` from the arguments, and the
  dispatcher test asserts it of the whole request.
- **`committed: false` and `backup: None` are legal on a success**, and both are asserted as
  successes rather than treated as failures.
- **The acknowledgement is an exact multiset, content-addressed to the candidate.** Consent for
  one broken text does not commit another, and this phase pins that at the command layer as well
  as in the core.

## 5. The contract checks that moved

Every one was retabulated to the new truth; none was weakened.

- `wire_contract.rs`: `FORBIDDEN_COMMANDS` is now `["validate_match"]` — `save_raw_document` left
  it the only way a name may, by existing and being registered. The test is renamed to
  `the_registered_commands_are_the_workspace_eleven_and_the_menu_command`, asserts **11** workspace
  names and **12** registered, and asserts `save_raw_document` **present** in the frontend
  declaration rather than merely absent from the forbidden list.
- `dispatch_check.rs`: the remote-origin sweep gained a `save_raw_document` attempt with
  well-formed arguments and its count went 11 → 12. That entry matters more than any other on the
  list: it is the command a navigated webview could use to overwrite a configuration file with its
  own bytes.
- `dictionary_contract.rs` needed **no** change, and that is a fact rather than an oversight: it
  checks the `code.` namespace against declared Rust enum variants, and this phase declares no new
  enum, no new variant and no key under `code.`.
- Frontend: `commands.test.ts` was retabulated to eleven wrappers and its forbidden list to one
  name. The i18n key-parity, placeholder-parity and untranslated-value checks pass on the six new
  keys with no exception added to any list.

## 6. Tests

**Rust — `src-tauri/src/commands.rs`**, on the same hand-authored synthetic trees:

- `a_raw_replacement_commits_the_submitted_bytes_and_names_nothing` — the committed case and its
  byte result. The candidate carries a BOM, one CRLF among bare LFs, a **decomposed** `e`-acute,
  an astral character and no final newline; the assertion is `fs::read_to_string` of the target.
  It also asserts `moved: None`, `notes: []`, and that both cache surfaces (`document`, `text`)
  serve the new bytes without a reload.
- `a_byte_identical_replacement_is_a_success_that_writes_nothing` — `committed: false`, observed
  as the file's **inode and modification time** rather than as a content revision, because a hash
  cannot tell *not written* from *rewritten with the same bytes*. Its second half saves a text
  that really differs and asserts the inode **does** change, so the observation can fail.
- `a_stale_raw_save_never_overwrites_the_bytes_written_after_it_loaded` — consult Q7. Asserts the
  premise (the session still believes the old revision), the conflict payload including the
  projection of the other writer's file, that the other writer's bytes are **byte-identical**
  afterwards, that the **inode is unchanged** so no rename happened, and that the session is left
  reading the bytes the next save will be checked against.
- `an_unparseable_candidate_is_refused_and_then_committed_when_acknowledged` — the owner's ruling
  end to end: refused with `DocumentDoesNotParse` and nothing written, then committed with that
  exact finding acknowledged, then **repaired** by a further replacement with valid text, which is
  the reason the ruling exists.
- `an_acknowledgement_minted_for_another_candidate_does_not_commit_this_one` — two texts sharing
  the invalid prefix `matches: broken: here`. It asserts the premise first, then that the first's
  consent refuses the second and writes nothing, then that the second's own consent commits — so
  it cannot pass by refusing everything. **The premise is asserted operand by operand as of the
  fix round** (§10, finding 4): both codes are destructured, `line`, `column`, `byte_index` and
  `detail` are compared to each other, and each `revision` is compared against
  `ContentRevision::of_bytes` of **its own** candidate.

**Rust — `src-tauri/src/dispatch_check.rs`**:
`save_raw_document_is_reachable_and_its_text_reaches_the_disk_unchanged`, four claims a direct
call cannot make: registration under the empty capability set; a whole document's text
deserializing off the wire as a bare JSON string, byte for byte — **the inbound half of a
question only ever asked outbound before**; `moved` written as `null` rather than omitted; and the
refuse-then-acknowledge round trip over real IPC. **Its three disk assertions read the disk** as
of the fix round (§10, finding 3): `std::fs::read` of the target, not `document_text`, which may
serve the session's cached text.

**Frontend — `src/lib/ipc/commands.test.ts`**: the argument shape (with the same byte-exact
sample) and **seven** cases for the invalidation — commit, byte-identical, conflict and refusal,
command failure, the ordering, and the two the fix round added: a reload that **throws** and a
reload that **rejects**, each pinning both halves at once (the committed `Saved` still comes back,
and the reload's failure is visible and classified).

**Frontend — `src/lib/browser/workspace.test.ts`**: eight cases over the state's own
`saveRawDocument`, all added by the fix round — everything cached is forgotten and the file read
again; a selection whose snippet the replacement left alone is found again under the **new**
identity; `committed: false` changes nothing; a failed reload is reported and the committed
outcome still comes back; a conflict adopts the projection the answer carried; a failure with
`may_have_written` re-reads; a re-read that itself fails leaves the file unprojected rather than
redrawing the bytes that are gone; and the arguments, including that the fifth one is this
module's own function rather than anything a caller supplied.

**Frontend — `src/lib/browser/rawSave.test.ts`**: 18 over the model — the always-present Q8
statement, both sides of "position or no position", the byte offset carried but never rendered,
the parser's message never rendered, the finding handed back whole, no finding dropped, the choice
offered only when it can be kept, and the six sentences checked the way `notices.test.ts` checks
its own.

## 7. Holes this phase leaves open

### 7.1 There is still no raw editor

**No `.svelte` component calls `BrowserState.saveRawDocument`.** The raw pane is a **viewer**:
`showFileText` reads a document's text and nothing writes one back, and no screen collects a base
revision from the moment the text was loaded. So the presentation model built here has never been
drawn, and the invalidation — which now exists, is owned by the browser state and is tested — has
never run in a window. This joins the standing "never been drawn" debt below, and it is the
biggest thing between this phase and a user pressing a button.

The fix round deliberately did **not** narrow this: the review's scope forbade building the
editor screen, adding a component or inventing UI state beyond what the invalidation needs.

### 7.2 A no-op reload body still type-checks at the boundary

Narrowed by the fix round, not closed. `ReloadAfterRawSave` is still a function type and
`() => {}` still satisfies it; no TypeScript signature can require a body to do something, and no
type can require a returned property to be *read*. What changed is that the running application
no longer relies on that body — `BrowserState.saveRawDocument` takes no callback and passes its
own — so the parameter's remaining job is to keep the boundary drivable by a test. A caller that
imports `src/lib/ipc/commands.ts` directly and passes a no-op is still a caller that has opted out
of the invalidation, and nothing but review catches that.

The same limit applies to `RawSaveOutcome.reload`: it is a required property carrying a typed
failure, and a caller that never looks at it compiles. What it buys is that the failure survives
as a value rather than destroying the committed answer.

### 7.3 The browser state knows this command and three others still not there

`src/lib/browser/workspace.svelte.ts` now wires `moveMatch` **and** `saveRawDocument` into
`BrowserCommands` and handles their outcomes. `saveMatch`, `createMatch` and `deleteMatch` are
still absent, and a phase that adds the editing screens owes that wiring.

Two things about the wiring that is here are worth keeping written down. It is **not** a copy of
`moveMatch`'s: `adoptTheDocumentOnDisk` re-points a selection **by the identity the command
answered with**, and a replacement answers `moved: null` permanently, so
`adoptTheReplacedDocument` forgets and then looks. And a re-read that fails after a committed
replacement leaves the file **unprojected** — reported on the failure channel, absent from
`views`, and drawn by the sidebar as a file with no count rather than as one that could not be
read. That is honest (this state cannot describe a file it could not read) but it is not the same
thing as `loadFailures`, which only `open()` fills, so such a file's row says less than it could.

### 7.4 Nine new user-facing strings have never appeared on a screen

The six `browser.rawSave.*` keys, plus `code.findingCode.documentDoesNotParse` and
`code.saveError.replacementRequiresBackups` from 3a, and `code.commandError.documentHasNoMatchList`
and the rest of the standing list (the thirty-two `code.draftError.*`,
`code.commandError.draftRefused`, the eight `code.editError.*`, the two `code.presentationNote.*`).
The first phase to build the editor screen owes the look.

### 7.5 Six more Spanish sentences checked only by heuristic

221+ Spanish values are now checked only by the heuristic that no sentence is byte-identical to its
English counterpart and that placeholders match. Nothing establishes that any of them is idiomatic,
and the six added here are ordinary members of that set.

### 7.6 The real configuration has never had a whole-document replacement applied to it

Unchanged from 3a's hole 7.5, and now sharper: a command exists that would do it. The real-corpus
sweeps still cover only moves and field edits, and still exercise neither `create_match` nor
`delete_match` nor this.

### 7.7 `SaveError::ReplacementRequiresBackups` is unreachable from this command

`with_open` always hands a real `BackupSession`, so the pre-lock refusal 3a added can never fire
on this path. That is the intended arrangement — the refusal exists to make forgetting impossible,
and this layer does not forget — but it means the command layer has no test of it, and the only
coverage is the core's. A future writing surface that reached `save_document` some other way would
be the first to need it.

### 7.8 The pre-existing debts carried forward, unchanged

A move still leaves the identical doubled blank line at its origin and says nothing about it
(2b-2c-2 hole 6.2); `create_match` still derives `End` from `view.matches.len()` (hole 6.8);
`verify_items` still speaks `verify_field`'s vocabulary (2b-2c-1 hole 3) and a deletion can still
report a refusal whose sentence is about a move (2b-2c-2 hole 6.4); three `code.diagnosticCode.*`
observations remain recorded as non-defects (`2b-2b-3-notes.md` §7.5).

## 8. Deviations from the brief, recorded rather than hidden

- **The brief expected `dispatch_check.rs` to carry "a seven-command remote-origin table".** It
  carried eleven; it now carries twelve. Nothing was weakened — the table is asserted equal to
  `registered_commands()` in both directions, which is what made the count wrong in the brief
  rather than in the file.
- **`npm install` rewrote `package-lock.json`**, adding an `engines` block the lockfile did not
  carry. That is pre-existing drift between `package.json` and its lockfile and has nothing to do
  with this phase, so **the change was reverted** and is recorded here instead. Anyone running
  `npm install` will see it again.
- **Three module doc comments were rewritten rather than amended** — `commands.rs`, `main.rs` and
  `src/lib/ipc/commands.ts` — because each contained a paragraph explaining why `save_raw_document`
  was absent, which this phase made **factually false**. `wire_contract.rs`'s
  `FORBIDDEN_COMMANDS` doc and `commands.test.ts`'s forbidden-list comment were rewritten for the
  same reason.
- **No `PROGRESS.md` change**, as instructed. The orchestrator owns that file.

## 9. Verification

Every command run from the repository root, each as its own invocation. The table is the state
**after the fix round** (§10); the counts before it were 1007 Rust tests and 728 frontend tests.

| Command | Result |
|---|---|
| `cargo build --workspace` | Finished, no warnings |
| `cargo test --workspace` | **1007 passed, 0 failed** (baseline 1001; +6) |
| `cargo clippy --workspace --all-targets -- -D warnings` | Finished, no warnings |
| `cargo fmt --check` | Clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **No output** — the architecture rule holds |
| `npm run check` | 378 files, **0 errors, 0 warnings** |
| `npm run build` | Built, 148 modules |
| `npm test` | **738 passed** across 30 files (baseline 702; +36) |
| `git status --short --untracked-files=all` | No path under `tests/corpus/`, none under `tests/corpus/real/`; `package-lock.json` unmodified |

No corpus fixture was modified, no file under `crates/` was modified, and the working tree is left
uncommitted.

The Rust total is unchanged across the fix round because both Rust findings were **strengthened
assertions inside existing tests**, not new tests: a test that claimed more than it checked is
worth correcting rather than duplicating.

## 10. The fix round — the aggregate code review's four findings

`docs/reviews/phase-2b-2c-3b-code.md` returned **`READINESS: NOT READY`**. This project holds a
phase open until its findings are closed, so no commit ever carries a demonstrated defect; what
follows is what was actually wrong and what changed. Nothing here is rewritten to look clean.

### 10.1 High — a failed reload rejected a committed save

**What was wrong.** `saveRawDocument` in `src/lib/ipc/commands.ts` `await`ed the caller's reload
inside a function typed `Promise<CommandResult<SaveResult>>`. A reload that threw or rejected
therefore threw **out of the wrapper**, past the advertised return type: the `Saved` the file on
disk already reflected was hidden behind an exception, and a caller catching it could reasonably
retry a write that had already happened. That is `PROGRESS.md` D2 — *a committed write is never
afterwards reported as an `Err`* — broken in TypeScript by the layer that exists to carry it.
It also left the projections stale if the body failed before invalidating them.

**What changed.** The wrapper answers a new boundary-layer type, `RawSaveOutcome`. Its success
arm always carries the `SaveResult` the transaction reached, and a required `reload` property
carries `RawSaveReload` — `notOwed`, `done`, or `failed` with an `IpcFailure` classified by
`classifyFailure`. The reload call is wrapped in a `try`/`catch`, so a throwing or rejecting body
can neither reject this promise nor be swallowed. `SaveResult` itself is untouched (consult Q3)
and `moved` is still `null`.

Two tests pin both halves at once — the committed value still comes back, **and** the reload
failure is visible: `still hands back the committed save when the reload throws` and
`… when the reload rejects`, the second of which is the case a `try` around a non-awaited call
would miss.

### 10.2 Medium — a required callback is not a discharged obligation

**What was wrong.** A required parameter makes *omitting an argument* a compile error, not
*ignoring the obligation*. `() => {}` type-checks, and this phase's own tests passed exactly that
at `commands.test.ts:150` and `:275`. An asynchronous body could also read or expose stale
projections before invalidating, because `await` only protects code after the caller awaits.
D5 claimed more than the parameter could deliver.

**What changed.** The invalidation moved into the module that owns the cache.
`src/lib/browser/workspace.svelte.ts` gained `BrowserState.saveRawDocument`, which takes **no
callback**, and two private functions:

- `forgetTheReplacedDocument(document)` — synchronous and total: the projection leaves `views`,
  the held selection is dropped and the selection generation bumped, and the raw viewer's snapshot
  of that file is forgotten. It runs before any `await`.
- `adoptTheReplacedDocument(document)` — forgets, then reads the file again and looks for the
  selection positionally-and-then-checked (R27), because a replacement has **no identity** to
  re-point with. A re-read that fails is reported and leaves the file unprojected (hole 7.3).

`saveRawDocument` also joined `BrowserCommands` and `REAL_COMMANDS`, so the application's raw save
goes through this state. The wrapper's parameter stays — it is what makes the boundary testable —
but it is no longer the only thing between a commit and a stale window. What is still not forced
at compile time is written down as hole 7.2 rather than claimed closed.

**Scope.** No `.svelte` component was added or changed, no raw editor screen was built, and no new
UI state was invented: the notices the recovery produces are the three `reresolve` already
answers.

### 10.3 Low — a dispatcher test that said "the disk" and asked the cache

**What was wrong.** `save_raw_document_is_reachable_and_its_text_reaches_the_disk_unchanged` in
`src-tauri/src/dispatch_check.rs` asserted the bytes on disk by calling `document_text`, which may
serve the workspace cache. It would have passed for a command that updated cached text without
persisting anything — the exact failure a claim about the disk exists to exclude.

**What changed.** The test binds the temporary directory (`_dir: dir`), names the target once, and
compares `std::fs::read` against the candidate's bytes at all three points: after the commit,
after the refusal, and after the acknowledged commit.

### 10.4 Low — a premise asserted more weakly than it was described

**What was wrong.** `an_acknowledgement_minted_for_another_candidate_does_not_commit_this_one` in
`src-tauri/src/commands.rs` said it proved the two findings had identical parser stopping points,
then compared only `span`, `node` and `path` before asserting the whole codes differ. It would
still have passed if `line`, `column`, `byte_index` or `detail` differed — in which case the
`revision` operand would **not** be what distinguishes the findings, and the test would not be
testing what it is named after.

**What changed.** Both codes are destructured. `line`, `column`, `byte_index` and `detail` are
compared to each other, and each `revision` is compared against `ContentRevision::of_bytes` of its
**own** candidate before the inequality is asserted — so "content-addressed to the candidate" is
measured rather than inferred from a difference.

### 10.5 What the review cleared, and what the fix round did not touch

The review explicitly cleared the single write entry point, the omission of `view_at`, the
acknowledgement binding, `moved: None`, the error-channel rules, the absence of a `force` flag,
the localization, the no-position presentation case, the four unchanged `run_one_save` callers and
the retabulated contract checks. None of them was changed. No dictionary key was added or altered,
`dictionary_contract.rs` still needed no change, and `wire_contract.rs` is as §5 describes it.
