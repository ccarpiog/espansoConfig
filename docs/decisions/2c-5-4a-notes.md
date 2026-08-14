# Phase 2c-5-4a — the restore coordinator wiring, with nothing drawn

> **Read §6 first.** The review round found three defects, all three are closed, and two of them
> were **this record claiming a guarantee the code did not give**. §2.7, §3 and §5 have been
> corrected in place rather than left standing; §6 is the fix round and says what moved.

**One module changed, one suite extended, and no component and no dictionary touched.**
`src/lib/browser/workspace.svelte.ts` gains the four restore-facing methods a screen will reach
through — three thin wrappers over the read-only backup commands, and one send that composes
`BrowserState.saveRawDocument` with `restore.ts`'s permit. `workspace.test.ts` drives them.

Step 2c-5-4 was split in two by failure mode. **This half is how the window talks to disk**; 4b is
the i18n keys and their typed accessors, `RestorePane.svelte`, the `DetailPane.svelte` mode with
its open-surface predicate and its `InvalidateEverySurface` supplier, and the phase's mounted
matrix. Nothing here draws anything, and **no i18n accessor was added** — `tRestoreRefusal` is 4b's,
because a component has to call it and an uncalled accessor is exactly what 2c-5-3 was adjudicated
right to defer.

The consult is `docs/reviews/phase-2c-5-design.md`; **Q5** is the screen 4b draws, **Q6** is what
restore may never claim, **Q7 item 4** is the evidence step 4 owes and **Q8** is the single binding
instruction this file exists to not loosen. Step 3's record is `docs/decisions/2c-5-3-notes.md` and
its rounds are `docs/reviews/phase-2c-5-3-code.md` and `phase-2c-5-3-confirmation.md`.

**No mounted test and no window reading are owed by this half, and neither was taken.** No
`.svelte` file and no file under `src/lib/i18n/` changed.

---

## 1. What this step built

- **`src/lib/browser/workspace.svelte.ts`**
  - `BackupCommands` and `REAL_BACKUP_COMMANDS` — a **second** injected surface, §2.1;
  - a third parameter on `createBrowserState`, defaulting to the real backup boundary;
  - `BrowserState.listBackupBatches`, `.listBackupEntries` and `.readBackupText` — three thin
    reads that report and answer, remember nothing, and are therefore the re-ask (§2.2, §2.3);
  - `BrowserState.restoreDocument` — the send, §2.4 to §2.7. The fix round took its `session`
    parameter away and made it answer `RestoreSession | null` (§6.2);
  - `reportedRead`, one private helper carrying the report-and-answer rule for all three reads;
  - the returned object is now **named** `state`, so `restoreDocument` can call
    `saveRawDocument` rather than copy it (§2.4);
  - the module header now says there are two injected surfaces rather than one.
- **`src/lib/browser/workspace.test.ts`** — 19 new cases in three suites.
- **The fix round added two more files to that list** — `src/lib/browser/restore.ts` and its suite —
  and it is still true that no `.svelte` file and no file under `src/lib/i18n/` changed. §6.

**No file was created.** The record you are reading is the only new file, and it is not under
`src/`, so neither the `svelte-check` file count nor `scripts/lint/ipc-detail.test.ts`'s per-file
`it.each` moved.

---

## 2. The decisions

### 2.1 D1 — the three backup commands are a second injected surface, and that is a constraint rather than a design

`BrowserCommands` is the one injected object the module header has described since 1a: every
command goes through it so that a test which cannot run Tauri can still drive a refusal. The
obvious place for `list_backup_batches`, `list_backup_entries` and `read_backup_text` is three more
members of it.

**They are not there, and the reason is scope rather than architecture.** Five object literals
**under `src/lib/components/`** implement `BrowserCommands` in full — one each in
`DetailPane.test.ts`, `MatchDeleter.test.ts` and `MatchDuplicator.test.ts`, and two in
`MatchMover.test.ts`; every one of `workspace.test.ts`'s two dozen spreads its own
`scriptedCommands()`, so `src/lib/browser/` holds exactly one. This sub-phase was scoped to change
no file under `src/lib/components/`. Three **required** members
added to that interface do not compile in any of the five; three **optional** ones compile
everywhere and let an omission mean "there is none", which is the shape this repository refuses in
`documentHasUnsavedDraft`, in `openWholeDocumentSave`'s `forget`, in `applyRestore`'s
`invalidate` and in `RestoreContext`'s two required fields.

So `BackupCommands` is a second interface with **all three members required**, a
`REAL_BACKUP_COMMANDS` beside `REAL_COMMANDS`, and a third parameter on `createBrowserState` with
the real one as its default — the same shape `commands` already has, so it is not a new idiom.
`workspace.test.ts`'s `scriptedBackups()` is the scripted implementation.

**What that costs, stated rather than glossed.** A `createBrowserState(commands, report)` call that
omits the third argument gets the **real** boundary for the backup reads. Every such call site
today is a test that never touches a restore, so nothing is affected — but a 4b mounted test that
means to drive the catalogue and forgets the third argument would reach `invoke` rather than a
script, and nothing in TypeScript makes that a compile error. It is a default, and a default is
what makes the running application work without ceremony.

**Left open for a later step:** whether the two surfaces should be folded into one, in a commit
that can update all six implementations at once. That commit is not this one, and the split is
recorded here and in `BackupCommands`'s own JSDoc so it is not later mistaken for a claim that the
backup reads are architecturally different. They are not; they are read-only commands like
`documentText`.

### 2.2 D2 — the three reads are thin, and they thread no session

They take the arguments the command takes, answer the `CommandResult` unchanged, and report a
refusal on the developer channel on the way past — `rereadDocument`'s shape, which reports **and**
answers so that a caller can say on screen that the read did not reach the file. They do **not**
take a `RestoreSession` and return a new one.

**That is deliberate and it is about staleness.** A wrapper that took a session, awaited the
command and then applied `batchesLoaded` to the session it was handed would be writing an answer
onto a snapshot taken before the await. A person who chose a different batch, or a different entry,
while the listing was in flight would have that choice silently overwritten — and `batchesLoaded`
has no guard against it, because in the model the caller is expected to hand it the **live**
session at the moment the answer lands. `entriesLoaded` and `candidateRead` do have identity
guards, and threading would evaluate them against the stale session rather than the live one.

The send is the exception, and it is an exception with a reason: **while `phase` is `saving` the
session really is frozen**, because every transition in `restore.ts` answers its own argument
unchanged there. So threading across the send's await loses nothing, and that freeze is what
2c-5-3's §2.14 exists to give.

They exist on `BrowserState` rather than being imported from `../ipc/commands` by whichever
component draws the catalogue because **no `.svelte` file in this repository imports
`../ipc/commands`** — checked, not assumed: the five `.svelte` files that name it at all
(`MatchEditor`, `MatchCreator`, `MatchDeleter`, `MatchDuplicator`, `RecoveryPanel`) name it in a
comment. That is a fact about the code as written and not a guarantee any type gives.

### 2.3 D3 — the re-ask is the wrapper itself, because the coordinator remembers nothing

2c-5-3 handed forward: *a catalogue or candidate answer landing during a send is dropped — step 4
owes a way to ask again.*

**This is that way, and it is a property rather than a feature.** Nothing on `BrowserState` caches
a batch listing, an entry listing or a candidate; nothing keys one by workspace; nothing records
that one was asked for. The catalogue lives on a `RestoreSession`, which is the value a surface
owns, exactly as every other editing session in this application is. So the three methods are
re-callable, each call really reaches the command, and calling one again **is** asking again.

Two cases pin it: a candidate read whose answer lands on an in-flight session is dropped by
`candidateRead` and the very same wrapper installs the next one after the file has answered; and
the same for a batch listing. Both assert the command call count, because a coordinator that had
quietly memoised would answer from a cache and pass every assertion about the session.

**What no type here forces**, in the same sentence as what one does: nothing makes a *screen* offer
the re-ask. 4b owes the control. What is forced is that the coordinator cannot be the thing that
makes a second ask a no-op.

### 2.4 D4 — restore is a content path on the sixth writer, and the send calls it rather than copying it

`restoreDocument` issues no command. It hands `sendRestore` a sender that is
`BrowserState.saveRawDocument`, so the lock, the revision check, the reparse, the validation
verdict, the acknowledgement multiset, the backup, this state's own cache invalidation, the
conflict registration and the seal are all that method's. There is no restore-specific command and
consult Q3 rules that there must not be one.

Calling it required naming the returned object: the state was `return { … }`, and the send needs
one method of it to reach another. The alternative was a second copy of the seal, the conflict
registration and the invalidation, which is the shape `run_one_save` exists in Rust to prevent.
None of these methods reads `this`, and the forwarder is written out in full
(`(document, baseRevision, text, acknowledgement) => state.saveRawDocument(…)`) so that nothing
depends on how a method reference binds.

### 2.5 D5 — the revision the window observes is read here; the open surfaces cannot be

`restoreDocument` takes `surfaces` and builds the `RestoreContext` itself:

```
observed: revisionInProjection(views, session.target)
```

**That is the one guarantee this wrapper adds to the model's own.** `restore.ts`'s header records
that nothing can force `RestoreContext.observed` to have come from the live projection rather than
from the session's own frozen base — *a confirmation that compares two values minted together
observes nothing* — and that a caller which hands back `session.baseRevision` gets agreement it did
not earn. At the send it cannot: the value comes from the projections this state holds, read
synchronously before anything awaits.

**It is not a refreshed base revision, and Q8 forbids that specifically.** What is written is
`permit.submission.baseRevision`, frozen at the confirmation and read off the permit inside
`sendRestore`. This observation is only ever compared *against* that frozen base, so it can make a
send that should be refused actually be refused, and it can do nothing else.

The other half is the caller's, and this is the sentence that says why: **no coordinator can
observe an open write surface.** Every one is a session held inside a component —
`MatchEditor.svelte`'s, `MatchCreator.svelte`'s and the four others — reachable from nowhere but
that component, exactly as a draft's derived `isDirty` is (R36). Whichever component hosts the
third pane is the only thing that can enumerate them, and nothing here can check that the list it
was handed is complete: an empty array claims there are none.

### 2.6 D6 — `InvalidateEverySurface` is taken and passed through, never defaulted

`applyRestore` requires it. `restoreDocument` takes it as a parameter and hands it straight to
`applyRestore`, which discharges it inside `openWholeDocumentSave`. **No no-op default was
invented**, for the reason 2c-5-3 §2.15 gives: a default would be this layer deciding for a caller
that has surfaces it never told anyone about.

The callback itself is 4b's, because the surfaces are hosted in `DetailPane.svelte`.

**What no type forces**: that the body does anything — `() => {}` satisfies it. What the signature
forces is that a caller cannot take a restore's answer without supplying one. A body that throws is
caught by `openWholeDocumentSave`, classified, and comes back as a line **beside** the committed
outcome; **a throwing invalidation never unwrites the file** (`PROGRESS.md` D2), and a case pins it.

### 2.7 D7 — nothing is decided between the confirmation and the spend

Step 3 cost four review passes to learn that a check and a spend separated by any property read are
not one operation in JavaScript: a property read can run arbitrary code through a getter or a proxy
trap, `readonly` freezes nothing at runtime, and verifying that there is no `await` proves nothing
about synchronous re-entry.

**This wrapper adds no check of its own between deciding and spending.** It builds a context, calls
`sendRestore`, and branches on the answer. Every recheck and both spends are `restore.ts`'s and this
wrapper does not touch them.

**Corrected after the review round.** This section used to go on: *"the question's checked deletion
from `PENDING_CONFIRMATIONS`, and the permit's deletion from `PERMITS` before the sender is called"*
— listing the permit's deletion beside the question's as though both were already the atomic kind.
They were not. The question's was checked; **the permit's was `PERMITS.delete(started)` with the
result discarded**, and it sat after a `permitHolds` that reads a dozen properties off caller-supplied
values. A getter or a proxy trap reached there re-enters `sendRestore` with the same
`StartedRestore`, and the inner call can validate, delete and reach its sender before the outer
`permitHolds` returns — after which the outer call ignored its own failed deletion and sent too. One
permit, two whole-file replacements. That is the review's High, and this record asserting the
opposite is the defect class `CLAUDE.md` §6 names as this project's worst.

It is closed: the permit is now spent by a **checked** deletion whose result *is* the authorization,
exactly as the question's is one step earlier, and a call that loses the race answers `notAttempted`
without calling the sender. §6.1 is the fix and its evidence.

**The sequential case is not the re-entrant one.** The case this section pointed at — the same
`StartedRestore` handed to `restoreDocument` twice — waits for the first call to finish before making
the second, so it never reaches the window between the check and the spend and passed against the
defect throughout. The case that reaches it drives a proxy on the surface list.

### 2.8 D8 — the send's answers map to transitions the model already has, and the fix round added one that it did not

As shipped, three answers and three existing transitions:

- `notAttempted` → the session unchanged, and the sender never called;
- `failed` → `restoreCouldNotBeSent(session, mayHaveWritten)`;
- `answered` with a seal → `applyRestore(session, sealed, invalidate)`.

No new answer type for the last two: `MatchSaveAnswer` and `RawSaveAnswer` both exist because a
caller had to be told *whether the file may already hold what was sent*, and here the model already
carries that on `RestoreSession.sendFailure`. Inventing a restore-shaped answer would have been a
third vocabulary for facts two types already name.

**The first arm was two facts under one name, and the fix round split it** (§6.2). *No permit at
all* and *a permit that no longer describes the world* were both `notAttempted`, and they owe a
caller opposite things: the first has no session to answer with, because whichever call spent the
permit is the one that answers for it; the second has consumed a permit and must hand the session
back out of the phase the confirmation put it in. So `RestoreSend` gained a `withdrawn` arm and
`restore.ts` gained `restoreConfirmationWithdrawn` — the one transition of this sub-phase that did
not already exist, and it is four lines because everything it needs the model already had.
`restoreDocument` answers `RestoreSession | null` for the same reason: `null` is *this call has
nothing to say about any session*, which is a third answer a session-shaped return cannot carry.

---

## 3. The evidence

**20 cases in `src/lib/browser/workspace.test.ts`, in three suites, and 2 more in
`src/lib/browser/restore.test.ts`.** The step shipped 19 here and none there; the fix round removed
one, added two, and added the two model cases (§6.4).

**`reading the backup catalogue` — 7.** The batch listing and its refusal; the entry listing, with
the identity asserted **by `toBe` on the captured argument** to reach the command as the very object
it was given, and its refusal; the
text read, with **both** arguments asserted and the bytes compared to a candidate that carries a
byte-order mark, two CRLF line endings and a trailing space; its refusal; and "remembers nothing" —
three asks, three commands, and the projections, the selection and the viewer's snapshot all
unchanged by six reads.

Each refusal case asserts **both** halves of the report-and-answer rule: the failure reaches the
developer channel *and* comes back to the caller. A read that only reported would leave a catalogue
looking as though it had never been asked.

**`an answer that lands while a restore is being written` — 2.** The dropped candidate and the
dropped batch listing, each followed by the same wrapper asking again and installing. The two reads
answer **different bytes**, so the assertion distinguishes "the second answer was installed" from
"the first one was still there".

**`sending a confirmed restore` — 11 after the fix round, 10 before it (§6.4).** No confirmation at
all, and the sender is a spy that must never have been called; a window that re-read the file after
the confirmation, which the coordinator noticed rather than the caller, **and which now also asserts
that what comes back is askable again**; that same mismatch spending the permit, so the confirmation
cannot be retried once the world is repaired; **a surface read that re-enters the send, asserting one
write for one permit**; one confirmation
handed over twice; the committed restore, asserting the exact candidate bytes, the frozen base
revision, the empty acknowledgement, one invalidation naming the file and its new revision,
`restored: true`, no extra message, and the projection really moved; `committed: false`, where the
caller's invalidation must **not** run and `restored` stays false; a conflict, where nothing is
installed in the window; a refusal, its acknowledgement, and a second confirmation whose command
call carries exactly the findings and the same bytes at the same base; an uncertain send; and a
committed restore whose caller invalidation throws.

**What no test here holds.** Nothing pins what any sentence *claims* — this half added no
dictionary key, so the i18n suites had nothing new to check, and the JSDoc contracts above are
prose that review is the only check on. That is `CLAUDE.md` §6's standing statement and it is not
narrowed by anything in this step.

---

## 4. The gates

| Gate | Before | After the step | After the fix round |
|---|---|---|---|
| `cargo test --workspace` | 1153 | **1153** (no Rust changed) | **1153** |
| `npm run check` files | 426 | **426** | **426** |
| `npm test` | 1936 | **1955** | **1958** |
| `npm run build` modules | 180 | **181** | **181** |

**The test count moved by exactly 19, and all 19 are the cases above.** No file was added under
`src/`, so `scripts/lint/ipc-detail.test.ts`'s per-file `it.each` contributed nothing and
`npm run check` did not move — the increment that "looks unexplained if you only count the cases you
wrote" is absent here because there is no new file for it to come from.

**The fix round moved it by exactly 3**, and the arithmetic is +2 −1 +2: two new cases in
`workspace.test.ts`, the case that pinned an API misuse the signature no longer permits deleted, and
two new cases in `restore.test.ts` (§6.4). It still added no file under `src/`, so `npm run check`
stayed at 426 and the module count stayed at 181 — **predicted before the build**, because a fix
round that adds no source module cannot move it, and both halves of the oracle were re-run below.

**The module count moved by exactly one, and it was predicted before the build.** Importing
`restore.ts` from `workspace.svelte.ts` makes it reachable from the entry for the first time, which
is `recovery.ts`'s +1 at 2c-4c-3a. It costs one and not more because every **value** import
`restore.ts` makes — `./draft`, `./editorSave`, `./invalidation`, `./saveOutcome` — is already
reachable, and its other six imports are `import type` and are erased. No component and no other
`.ts` module was added, so there is no `+2` rung on this ladder.

**Both halves of the regression oracle were run**, because 180 stopped being usable as a shorthand
at 2c-4c-3b and 181 is no better a number:

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (absent)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    → 2 (present)
```

So the server-only sentinels are absent and the search can match, which is what makes the negative
mean something. A bare `svelte/internal/server` search was **not** used: it is vacuous in a
production build (`PROGRESS.md`, the 2c-5-2 entry).

`cargo tree -p espansoconfig-core | rg tauri` finds nothing.

---

## 5. Holes, stated rather than hoped about

1. **Nothing draws any of this.** No claim in this record is a claim about a window. 4b owns the
   mounted evidence and 2c-5-6 owns the bilingual reading.
2. **`restoreDocument` takes `surfaces` while `prepareRestore`, `confirmRestore` and `restoreView`
   take a whole `RestoreContext`, and that asymmetry is deliberate.** At the send the revision must
   not be a parameter at all (§2.5); at the other three gates it necessarily is one, and 4b must
   build it with `revisionInProjection(browser.views, session.target)` — the model's own named
   producer — rather than with `session.baseRevision`. **A second producer on `BrowserState` was
   considered and rejected**: it would close nothing, because a component can still call
   `revisionInProjection` directly or pass the session's base, and it would be a second name for one
   value.
3. **A caller that lied to `confirmRestore` about the observed revision burns its question and its
   permit.** The confirmation passes, `restoreDocument` reads the live projection, the permit no
   longer holds, and nothing is written — write-safe, and the right outcome, because the window
   really did move. The question was already spent by `confirmRestore` before this method ran, and
   the permit is spent by the mismatch, so **both** are gone and the person asks again from
   `prepareRestore`. With a correct caller the confirmation refuses first and `targetMoved` is on
   screen instead. Nothing here can recover a spend that happened before it was called.

   **Corrected after the review round.** This hole used to end *"the person's click produces silence
   and the panel has to ask again"*, and the second half of that was a recovery the model did not
   have: the session came back exactly as it was handed in — `phase: 'saving'`, with the frozen
   submission on it — and every editing transition in `restore.ts` is a no-op while it is there, so
   nothing could take it back to an askable state and the panel would have gone on saying a
   replacement was in flight. That is the review's Medium. It is closed by
   `restoreConfirmationWithdrawn`, and a case now asserts the phase, the retained candidate, the
   refusal a panel would draw, and that re-measuring against the window's own revision — refused
   outright on the frozen session — works on this one (§6.2).
4. **A caller can no longer pair a permit with a session it was not minted for**, and the hole this
   item used to describe is gone with the parameter that made it expressible. `restoreDocument` took
   `started` **and** a `session`; a caller that handed back the session it confirmed *from* got
   `notAttempted` and no write, which was safe and silent rather than safe and visible. The session
   is now `started.session`, taken off the confirmation, so there is nothing to pair wrongly. The
   case that pinned the misuse is deleted, and the guard it drove is still driven at the model level
   by `restore.test.ts`'s drift row for the phase.
5. **Nothing forces the *model's* `session` argument to be the live one**, and that is a statement
   about `sendRestore` rather than about this coordinator. Through `restoreDocument` the session is
   the confirmation's own, so the session-side rechecks in `permitHolds` compare values that were
   minted together and can never disagree — **which costs nothing, and the reason is worth stating
   rather than assuming**: every transition in `restore.ts` that could change one of them is a no-op
   while the phase is `saving`, and the four reload transitions all require a conflict on screen,
   which a session cannot have while a first send is in flight. So the model can produce no other
   session to compare against. What can still notice movement is the **context** half — the live
   projection's revision and the open surfaces — and §2.5 is why the revision half of it is this
   state's own answer. A caller reaching `sendRestore` directly still supplies both, and every drift
   row in `restore.test.ts` still drives them.
6. **`surfaces` cannot be checked for completeness**, and an empty array claims there are none.
   `competingSurfaceFor`'s own limitation, one layer out.
7. **`InvalidateEverySurface`'s body may do nothing** (§2.6). The signature forces that one is
   supplied, never that it closes a surface.
8. **The backup surface has a real default** (§2.1), so a `createBrowserState` call that omits it
   reaches `invoke` rather than a script. No call site today is affected; a 4b mounted test that
   forgets would be, and no type says so.
9. **Nothing stops a component calling `BrowserState.saveRawDocument`, or `../ipc/commands`'s
   `saveRawDocument`, with any text it likes.** The hole every writing command has had since 2b-2a,
   and no type in this repository closes it. What is forced is that the bytes *this* method sends
   are the permit's own submission.
10. **The three reads are re-callable and that is all §2.3 gives.** Whether a screen offers the
    re-ask is 4b's, and no test here can fail for its absence.
11. **Nothing makes a caller install what `restoreDocument` answers**, and after the fix round that
    matters more than it did: the `withdrawn` arm's whole point is a session the caller has to put
    back on screen. A caller that drops it keeps the frozen one, which is the state the Medium
    describes — reached by ignoring an answer rather than by being handed the wrong one. Every
    value-model surface in this directory has the identical limit, and no type in TypeScript
    expresses "you must use this return value".

---

## 6. The fix round

`docs/reviews/phase-2c-5-4a-code.md` found one High, one Medium and one Low. **All three are
closed**, because a phase is held open until every finding is, so that no commit holds a
demonstrated defect. Two of the three were this record claiming a guarantee the code did not give,
which is the class `CLAUDE.md` §6 calls this project's worst and the one no test can fail.

### 6.1 High — the permit's check and its spend were not one operation

**What was wrong.** `sendRestore` read the permit, called `permitHolds`, and then called
`PERMITS.delete(started)` **discarding the boolean**. `permitHolds` performs about a dozen property
reads from the caller-supplied `session` and `context`; any one of them can run a getter or a proxy
trap — and a Svelte `$state` array *is* a proxy, so this is a shape the next sub-phase can produce
rather than a laboratory one. A trap that re-enters `sendRestore` with the same `StartedRestore` can
validate, delete the permit and enter its own sender **before the outer `permitHolds` returns**; the
outer call then ignored its failed deletion and called the sender too. **One permit, two whole-file
replacements.**

**What changed.** The deletion's own result is now the authorization:

```ts
if (!PERMITS.delete(started)) {
  return { kind: 'notAttempted' };
}
```

so a call that loses that race sends nothing, exactly as `confirmRestore`'s checked
`PENDING_CONFIRMATIONS.delete` has done since 2c-5-3. The mismatch arm consumes the permit with the
same checked deletion (§6.2), and answers `notAttempted` rather than `withdrawn` when it finds the
permit already gone, because a call that consumed nothing has no claim on the session.

**The evidence, and it fails without the fix.** `workspace.test.ts`, *spends one permit on one write
when a surface read re-enters the send*: the surface list handed to `restoreDocument` is a `Proxy`
whose `get` trap fires on `Symbol.iterator` — the last thing `permitHolds` does, through
`competingSurfaceFor`, so it lands after every other check has passed and before the spend — and
re-enters `restoreDocument` with the same `StartedRestore`. Run against the unchecked deletion it
fails with `expected "vi.fn()" to be called 1 times, but got 2 times`, which is two whole-file
replacements from one confirmation; with the checked deletion it passes, one of the two calls answers
about the session and the other answers `null`. **The sequential double-send case did not reach this
and never could**: it awaits the first call before making the second.

**The contrary prose is corrected at every site the review named**, and the sweep was written from
what the code now does rather than from the finding's words: `restore.ts`'s module header (both the
"spends the permit" sentence and the two-memberships paragraph), the `PERMITS` doc comment,
`permitHolds`'s own contract — which now says that every read below it is caller-controlled and may
re-enter — `sendRestore`'s numbered contract, `workspace.svelte.ts`'s `restoreDocument` contract, and
this record's §2.7. `docs/decisions/2c-5-3-notes.md` line 118 is left as it was written: it says the
permit is deleted before the sender is called, which was true then and is true now, and the
correction to what that does **not** cover is here rather than rewritten into a shipped record.

### 6.2 Medium — a rejected permit left the session permanently in `saving`

**What was wrong.** Every `sendRestore` mismatch returned the input session unchanged. On the
intended path that input is `started.session`, whose phase confirmation set to `saving`, and the
model deliberately makes every editing transition a no-op while it is there. So a mismatch handed a
future screen a session still claiming a send was in flight **when no sender ran**, with no ordinary
transition able to move it — and §5's hole 3 said the panel "has to ask again", a recovery that did
not exist. The mismatch also left the permit in `PERMITS`, because the early return preceded the
deletion.

**What changed**, in the three parts the review asked for:

1. **The redundant `session` parameter is gone.** `BrowserState.restoreDocument(started, surfaces,
   invalidate)` takes the session off `started`, so a caller cannot pair a permit with a session it
   was not minted for. That was an API misuse a case could pin and a type should simply forbid; the
   case is deleted and the guard it drove is still driven at the model level, where `sendRestore`
   keeps both arguments and `restore.test.ts`'s drift rows exercise every recheck. §5 hole 5 records
   what that costs and why it is nothing.
2. **A validation mismatch has a real transition.** `RestoreSend` gained `withdrawn`;
   `restore.ts` gained `restoreConfirmationWithdrawn`, which clears `phase` and `inFlight`, keeps the
   candidate, its consent, the catalogue and the chosen entry, and leaves `restoreRefusal` to say
   what is actually in the way. The permit is consumed by the mismatch, with the checked deletion of
   §6.1 — **a deliberate rule and not bookkeeping**: a confirmation authorizes one send attempt, so
   a world that moved under it is asked again rather than sent to once it moves back.

   **That is a claim about the permit and not about the acknowledgement, and the confirmation round's
   one Low was this record making the wider claim.** `restoreConfirmationWithdrawn` keeps the
   acknowledgement on purpose, so once a transient obstruction — an open write surface, say — is gone,
   `prepareRestore` and `confirmRestore` mint a new permit whose submission carries the *same*
   acknowledgement. Acknowledgement is therefore **candidate-scoped, never one-attempt**. What stops
   consent collected for one candidate reaching another is `boundAcknowledgement` together with the
   transitions that retarget the draft and clear it — never a fresh-consent requirement at the send,
   which is what the previous wording implied and the code has never done. **4b inherits this
   directly**: its screen may re-ask for confirmation after a withdrawal while an acknowledgement is
   still held, so neither its copy nor its mounted cases may be built around consent being re-collected.
3. **`restoreDocument` answers `RestoreSession | null`.** `null` is *this call held no permit and has
   nothing to say about any session* — a confirmation that never happened, or one whose permit
   another call spent. Answering the confirmation's frozen session there would replace whatever the
   call that **did** spend the permit produced, which is the same stranding one step along.

**The evidence.** Two cases in `workspace.test.ts` — the projection-mismatch case now asserts no
write, `phase: 'editing'`, no `inFlight`, the candidate byte for byte, `restoreRefusal` answering
`targetMoved`, and that `targetRevisionObserved` (a no-op on the frozen session, by construction)
now really re-measures and leaves the session with no refusal at all; and *spends the permit on a
mismatch*, where the same confirmation handed over again answers `null` and writes nothing. Two in
`restore.test.ts` — the mismatch spending the permit at the model level, and the transition itself
against the frozen session it repairs. The 19 drift rows — 13 named, plus one per competing surface
kind — now assert `withdrawn` rather than `notAttempted`, which is the same "sent nothing" with the
session half made explicit.

**What was declined, and why.** The review also suggested *"preferably make the `BrowserState`
coordinator perform confirmation from its own projection observation as well, so a caller cannot
manufacture the first footgun at all."* **Not done, deliberately, and it is 4b's decision rather than
a fix-round one:**

- it would close nothing. `confirmRestore` stays exported and `RestoreContext` stays constructible,
  and 4b's panel **must** import `restore.ts` anyway — for `restoreView`, `prepareRestore`,
  `restoreRefusal` and the rest — so a component could still build a context and confirm against it.
  It would be an affordance, not a closure. That is exactly the argument §5 hole 2 already records
  for rejecting a second `revisionInProjection` producer on `BrowserState`, and taking the opposite
  decision for the same value one paragraph later would be the split-rule shape this repository
  keeps refusing;
- it is not one gate but four. `prepareRestore`, `canPrepareRestore`, `restoreRefusal` and
  `restoreView` take the same `RestoreContext`, and they must agree with the confirmation or a
  control and its refusal disagree. Wrapping only the confirmation leaves the other three reading the
  caller's own context, which is one rule in two places;
- the send is genuinely different, and §2.5 says why: there the observation must not be a parameter
  at all, because it is the last thing checked before a destructive write. At the four affordance
  gates the same value is *drawn* as well as checked, and the surface that draws is the one that has
  to supply it;
- the component that owns the supplier does not exist yet. Deciding its shape here would bind 4b
  before it is written, and 4b is one step away.

The High's fix is what makes this safe to defer: a caller that manufactures the first footgun gets a
write refused and a session it can act on, rather than a second write.

### 6.3 Low — the record claimed object-identity evidence the test did not give

§3 said the batch identity reaches the command "as the very object it was given" while the assertion
was `toEqual([RESTORE_BATCH])`, which a rebuilt structurally-equal object passes. Closed the stronger
way the review preferred, since the implementation does forward the argument directly: the case now
captures the call, asserts it has exactly one argument, and asserts `toBe(RESTORE_BATCH)` on it. §3
says `toBe` on the captured argument, so the record's claim and the assertion are the same claim.

### 6.4 The gates after the fix round

| Gate | After the step | After the fix round |
|---|---|---|
| `cargo test --workspace` | 1153 | **1153** (no Rust changed) |
| `npm run check` files | 426 | **426**, 0 errors, 0 warnings |
| `npm test` | 1955 | **1958** |
| `npm run build` modules | 181 | **181** |

**+3, accounted for as +2 −1 +2.** `workspace.test.ts` gains the re-entrancy case and the
mismatch-spends-the-permit case and loses the one that pinned an argument pairing the signature no
longer allows; `restore.test.ts` gains the model-level mismatch spend and the transition's own case.

**181 was predicted before the build.** No file was added under `src/`, no module became reachable
from the entry that was not already, and a fix round that adds no source module cannot move the
count. Both halves of the oracle were re-run, because a number this close to the old shorthand
decides nothing on its own:

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (absent)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    → 2 (present)
```

### 6.5 What this round still does not hold

Nothing here is a claim about a window: no `.svelte` file and no file under `src/lib/i18n/` was
touched, exactly as at the step itself, and 4b owns the mounted evidence. Nothing pins what any
sentence *claims* — the new prose in `restore.ts`, `workspace.svelte.ts` and this record is checked
by review alone. And the re-entrancy case pins **one** opening: it drives the surface list, because
that is the caller-supplied value the coordinator still passes through. The permit's spend is now
checked whatever the vector, but no test enumerates the other property reads `permitHolds` makes.
