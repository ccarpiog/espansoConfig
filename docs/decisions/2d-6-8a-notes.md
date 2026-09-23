# Phase 2d-6-8a — the owed obligations, then the raw and restore receivers registered

**Status: implemented, gates green, not yet reviewed.**
Risk class: **high**. The post-answer handling of the raw save wrapper changes, the two remaining
reloads change their adoption order, and the last two write surfaces now receive live deliveries.
**No new module, no new dictionary key, no Rust.** Components touched: `DetailPane.svelte` and,
mechanically, `RawEditor.svelte` and `RestorePane.svelte`. Each gets one required prop, one
synchronous report and one withdrawal.

This is the first of the three sub-phases 2d-6-8 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-8, taken
2026-09-23*, which this phase wrote). 8b's rendering and 8c's window reading are not done here.

Abbreviations: `W` is `src/lib/browser/workspace.svelte.ts`, `RE` `rawEditor.ts`, `RS`
`restore.ts`, `R` `surfaceReceivers.ts`, `DP` `src/lib/components/DetailPane.svelte`. Line numbers
are of the final tree unless marked *pre-fix* (which are of `HEAD`, `17b7f22`).

---

## 1. What changed

### 1.1 Owed item 1: raw's and restore's reloads (`2d-6-6b-notes.md` §7 item 1)

**Re-derived, and both had both halves of the shape 2d-6-6b's review found in the editor's
reload.**

1. **A read of the step after the pre-adoption look.** Each reload read `session.reload` before
   `current()`. It then handed the step to `spendTheConfirmedReload(conflict, step, adopt)`, which
   reads `step.kind` and `step.confirmation` **after** that look. The step is caller data. A step
   that stayed quiet on the reads before the look and delivered on a later read ran past the last
   look, so the window was asked over a session that was no longer installed. Raw read the step
   twice before the look (to build the reseeded draft) and twice after. Restore read it zero times
   before the look and twice after.
2. **No look after the answer was built.** After the post-adoption `current()`, raw read
   `conflictOf(settled)` and spread `settled`. Restore did the same, then ran `revokeConfirmation`
   and `measuredAgainst` over it. A getter or `Proxy` trap among those reads could install a new
   session, and the answer was still built over the old one.

**Fix: the editor's shape (`matchEditor.ts` `reloadTheDiskVersion`), copied into both.**
`RE:1356` `loadDiskVersion` and `RS:3768` `reloadTheDiskVersion` now work in this order:
- they snapshot the confirmation through `confirmationOf(step)` before the pre-adoption look. Raw
  also builds its reseeded draft from that snapshot.
- they call `adopt(conflict, confirmation)` directly, so no step is read after the look.
- they return every answer after the adoption through `settledAnswer(settled, proposed, current)`,
  which takes the last look after the build. The refused step, the reseed or retarget, and the
  "another conflict" arm all go through it.
- restore's `withNothingPending(session)` arm also goes through `settledAnswer`, because
  `withNothingPending` reads the session after the look.

Both import `confirmationOf` and `settledAnswer` (from `./editorSave`) in place of
`spendTheConfirmedReload`. That sentence in `editorSave.ts`'s `confirmationOf` doc now names the
two new users. A test comment in `restore.test.ts` (`:1931`) said `reloadTheDiskVersion` hands
`adopt` to `spendTheConfirmedReload`. It was corrected in place.

### 1.2 Owed item 2: `BrowserState.restoreDocument` passes no reader (`2d-6-5-notes.md` §4 item 4)

**Re-derived: not a defect today. It was discharged at 2d-6-6a**, and the item was carried forward
without being closed. `restoreDocument` (`W:6679`) takes `current: ReadTheInstalledRestore` as a
required fourth parameter (`2d-6-6a-notes.md` §1.1). It passes that reader to `sendRestore`,
`restoreConfirmationWithdrawn`, `restoreCouldNotBeSent` and `applyRestore`, so none of the four
calls lacks one. `DP` forwards the reader, and `RestorePane.svelte` hands it `() => session` at its
one call. That closure reads the pane's `$state` at the call, which is the same cell the receiver
this phase registers writes to. Since this phase, a delivery during a restore therefore reaches the
session the reader answers. No case was written, because no failing case exists. **What no type
forces** (the reader's own doc says so) is that a caller's reader reads what its receiver installs.

### 1.3 Owed item 3: the raw save and restore wrappers' post-answer shape

**Audit result: `saveRawDocument` had two defects. `restoreDocument` had none of its own.**

1. **Committed path (hostile thrown value).** The wrapper hands the command a reload closure,
   `invalidate`, which runs `adoptTheReplacedDocument`. The command (`commands.ts:705-713`) catches
   what the closure throws and classifies it with a bare `classifyFailure(raw)`. A thrown value
   whose `code` getter throws makes that classification throw too. The committed save's promise
   then rejected, and the wrapper passed the rejection on. This is the shape 2d-6-6c-2's review
   fixed in `saveMatch` (D2). An `Error` was classified correctly.
2. **Failure path that may have written.** `if (written) await adoptTheReplacedDocument(document)`
   (*pre-fix* `W:6568`) had no catch. Any exception from the re-read, whether an `Error` or a
   hostile value, rejected the wrapper, and `{ kind: 'failed', mayHaveWritten: true }` never
   reached a screen. That answer is the one fact a person needs there: the file may already hold
   their text. This path is not a committed write, but it is the same class of error: a rejection
   hides what the disk may hold.

**Fix, all in `W`:**
- A new private helper, **`classifiedAfterTheCommit`** (`W:7409`), holds the guarded
  classification that `adoptAfterTheCommit` had inline: it calls `classifyFailure`, and if that
  throws, it classifies a fixed string instead. `adoptAfterTheCommit` now calls it, so the rule has
  one copy, not three.
- **The `invalidate` closure** (`W:6535`) catches everything itself. The failure is classified by
  the guarded helper, reported (the command's own catch used to report it, through `answer.reload`)
  and kept on `reprojection`. The seal then carries a `failed` issuer invalidation. Which projection
  stays is unchanged. `adoptTheReplacedDocument` forgets the file before its first await, so a
  throw from `getDocument` leaves the projection dropped, and a throw from `documentText` leaves
  the new projection installed. That matches `adoptAfterTheCommit`'s policy.
- **The may-have-written re-read** (`W:6584`) is wrapped. What it throws is classified by the
  helper and reported, and the answer is the same `mayHaveWritten`.

**`restoreDocument`** sends through `state.saveRawDocument` (via `sendRestore`), so its commit path
is the wrapper fixed above. After the send, it opens the seal through `applyRestore` →
`openWholeDocumentSave`, whose catch covers a throwing `invalidate` body. That catch also
classifies with a bare `classifyFailure`. It lives in `invalidation.ts`, not in the wrapper this
audit names, so it is recorded (§5 item 3) and not fixed.

## 2. Registration and delivery (`R`, `DP`, the two components)

- **`R`**: `ReceivingSurfaceKind` (`R:77`) now lists all eight kinds, adding `rawEditor` and
  `restore`. `isReceivingKind` (`R:210`) answers `true` for all eight and keeps its exhaustive
  `switch` with a `never` default. The module header, the kind's doc, `reportTarget`'s doc and
  `isReceivingKind`'s doc now say eight kinds.
- **`RawEditor.svelte`**: new required prop `reportReceiver: BindObservationReceiver`. At `:238` it
  reports, synchronously in its own initialisation right after `session` is created, a receiver
  that installs `applyObservation(session, delivery)` over the session held **now**. It withdraws
  in `onDestroy`. **The session can be `null`**: `startRawEditor` refuses a text that holds `\r`
  (`CLAUDE.md` §6). In that case the receiver installs nothing, because there is no draft to
  conflict and no save door to refuse. The pane still registers the surface, so the coordinator's
  own effect (the file marked stale) is what remains.
- **`RestorePane.svelte`**: the same, at `:368`, installing `applyRestoreObservation`. Its comment
  answers 2d-6-5 §4 item 9: a delivery cannot arrive from inside the `targetRevisionObserved`
  effect. The window delivers from its reconciliation drain, and nothing that effect reads (a plain
  frozen session and the window's projections) calls into the drain. No type forces this.
- **`DP`** hands down `reportReceiver={bindReceiver('rawEditor' | 'restore')}` (`DP:1312`, `:1483`).
  `transitionOf` needed no change. Its doc now says it is a no-op only for a kind with no live
  binding.
- **Sentences corrected in place** (entry 41). Each said the raw editor's and restore's
  *registration* was 2d-6-8's, which this phase made false: `RE` and `RS` (module header, the
  `awaitingReconciliation` field doc, the receiver doc), `W` (`observeExternalChange` and
  `registerObservationReceiver` docs), `observationDelivery.ts` (header), `saveOutcome.ts`,
  `conflictSource.ts`, `writeSurfaceRegistry.ts` (two) and `observationTransitions.ts`. Sentences
  saying the two panels' **rendering** is 2d-6-8's were left: they stay true until 8b
  (`i18n/index.ts` twice, `observationDelivery.ts:399`, the second half of `saveOutcome.ts`'s, and
  the `externalMessages` / `externalNotices` field docs).

## 3. Rulings taken here, and what each does not force

1. **The receiving-kind list is written out, not aliased to `OpenWriteSurfaceKind`.**
   **What TypeScript forces**: a ninth `OpenWriteSurfaceKind` is a compile error in
   `isReceivingKind`'s `switch`, and `bindReceiver` accepts only a listed kind. `DetailPane.svelte`
   cannot mount `RawEditor` or `RestorePane` without a `reportReceiver`, because the prop is
   required. **What it does not force**: that the list and the `switch` agree, that a component
   calls its reporter, calls it once, or withdraws, or that the pane hands the right kind to the
   right child. The roster suite and the mounted delivery cases (§4.3) pin those.
2. **A raw editor over a `\r` text receives and installs nothing.** Giving that editor a session
   only to hold a conflict would mean drafting a text the editor refuses. Nothing can be sent from
   it, so a missing conflict cannot license a write.
3. **One guarded classifier, not a third inline copy** (the 7a ruling 1 reason). **Forced**: no
   value thrown by the raw wrapper's reload closure or by its may-have-written re-read rejects the
   wrapper. **Not forced**: that `report` never throws, or that a future writer uses the helper.
4. **The restore reader item is closed by re-derivation, not by a case.** §1.2 says why no failing
   case exists.
5. **No new user-facing string.** The wiring adds none. It does make existing, already bilingual
   output reachable under an external conflict: `RawEditor.svelte` draws its disabled save, and
   `RestorePane.svelte` draws its `tRestoreRefusal` sentence and `RecoveryWithoutCreation` over
   `view.conflict`. None of that is read here (§5 item 1).

## 4. Pinning cases, and their failures before the fix, verbatim

### 4.1 The raw wrapper (`workspace.test.ts:5965`)

Suite *a raw save whose follow-up read throws — Phase 2d-6-8a*: 8 rows through the real
`createBrowserState`. The rows cover a committed save and a save that failed and may have written,
each × (`getDocument`, `documentText`) × (an `Error`, a value whose `code` getter throws). A
committed row asserts `sealed` and a `failed` issuer invalidation. A may-have-written row asserts
`{ kind: 'failed', mayHaveWritten: true }`. Every row asserts that the barrier closed. The cases were
written first and run against the untouched wrapper (`/tmp/8a-wrappers-prefix.txt`): **6 failed, 2
passed, 350 skipped**. The two committed `Error` rows passed, because the command's catch
classifies an `Error` correctly.

| Rows | Pre-fix failure, verbatim |
|---|---|
| committed × {getDocument, documentText} × hostile | `Error: the code getter threw` ` ❯ isCommandError src/lib/ipc/errors.ts:743:32` ` ❯ Module.classifyFailure src/lib/ipc/errors.ts:769:7` ` ❯ Object.<anonymous> src/lib/browser/workspace.test.ts:809:48` (the suite's command stub, which repeats `commands.ts`'s catch line for line) |
| may-have-written × getDocument × `Error` | `Error: the read after the raw save threw` … ` ❯ adoptTheReplacedDocument src/lib/browser/workspace.svelte.ts:7397:34` ` ❯ Object.saveRawDocument src/lib/browser/workspace.svelte.ts:6568:19` |
| may-have-written × documentText × `Error` | `Error: the read after the raw save threw` … ` ❯ readFileText src/lib/browser/workspace.svelte.ts:5024:35` ` ❯ adoptTheReplacedDocument src/lib/browser/workspace.svelte.ts:7417:11` ` ❯ Object.saveRawDocument src/lib/browser/workspace.svelte.ts:6568:13` |
| may-have-written × both reads × hostile | `{ code: '<unserializable>: the code getter threw', stacks: [] }` (the rejected value itself) |

After the fix, `workspace.test.ts` passes **358 of 358**.

### 4.2 The two reloads

Three cases in each of `rawEditor.test.ts` (`:1695`, `:1744` × 2) and `restore.test.ts` (`:3918`,
`:3967` × 2), in the suite *the door(s) and the settlement against the installed session*:

- *reads the reload step only before the pre-adoption look, so a read of it cannot displace the
  session past that look*: the step is a `Proxy` that counts, and delivers a displacing `retained`
  on, every read made after the reader was first called. The case asserts zero such reads, one
  adoption and the reseed or retarget.
- *answers what a read of the settled session installed, after a {installed, refused} adoption*: the
  session is a `Proxy` armed inside `adopt`, and its first read after arming installs a displacing
  session. The case asserts that the answer is the displacing session.

Run against `HEAD`'s `rawEditor.ts` and `restore.ts`, which were restored from `git show` for one
run, with the fixed copies put back afterwards and checked with `cmp`
(`/tmp/8a-reload-prefix.txt`): **6 failed, 321 skipped**. Failures verbatim:

| Case | `rawEditor.test.ts` | `restore.test.ts` |
|---|---|---|
| step read after the look | `AssertionError: expected 2 to be +0 // Object.is equality` | `AssertionError: expected 2 to be +0 // Object.is equality` |
| settled session, installed / refused | `AssertionError: expected { Object (document, draft, ...) } to be { Object (document, draft, ...) } // Object.is equality` | `AssertionError: expected { target: 7, …(21) } to be { target: 7, …(21) } // Object.is equality` |

The first draft of the step case fired on a fixed read count (the third read for raw, the second for
restore). It failed before the fix with `AssertionError: expected [ { kind: 'conflict', …(6) } ] to
deeply equal []`, but after the fix raw's count still reached three before the look, so the case
tested read counts, not ordering. It was rewritten to count reads after the look, and the pre-fix
run above is of the rewritten case. After the fix the two files pass **327 of 327**.

### 4.3 The mounted delivery cases (`DetailPane.test.ts:2388`)

Suite *the pane as a delivery host for the raw editor and restore — Phase 2d-6-8a*, copied from
7a's operation-panel suite. Each case opens the surface through the pane's own control over a real
`BrowserState` (`mountPane(true, …)`, so the backup catalogue is stocked), starts the lifecycle
over a finite drain queue with `expectedDrains` exact, and wakes the window:

- *An open {rawEditor, restore} is delivered its file's change, and its send is withdrawn*
  (`it.each` × 2). The raw editor's box is edited, and restore reads a candidate (list, batch,
  entry), so each send starts offered: raw's *Save* and restore's *Review the replacement*. The
  surface is registered over file 1 alone. The case asserts one `raised` delivered to the one
  registration, a standing `externalChange` origin, the send withdrawn, the file `stale` and not
  reloaded, and no `save_raw_document` call.
- *Never hands a reopened {…} what its previous instance was told* (× 2): the surface is told,
  closed (raw's edited draft goes through its discard step; the registrations and the registry end
  empty) and reopened fresh with its send offered. Only the second registration is told of the
  later reading (`[0, 1]`).
- *Lands a settlement after the raw save it settles, in the order it was decided*: a raw save is in
  flight when the wake arrives, so the delivery is `retained`. The command refuses, the settlement
  publishes `raised`, and the editor ends holding the external conflict with nothing to send
  (entry 5). `PaneScript` gained an optional `saveRawDocument` for this case.

Plus `surfaceReceivers.test.ts:221`: the roster registers the raw editor and restore each over its
own file, delivers to the right one, and each withdrawal returns only its own registration. The two
earlier roster cases that said "still not raw or restore" were retitled. They now pin that an
**unbound** receiving kind registers nothing, which is still true.

No sentence is read, so no locale is involved: what the two panels draw is 8b's.

**Shown to discriminate.** The wiring landed before these cases, so, as in 7a, the wiring was
reverted for one run: `isReceivingKind` answered `false` for `rawEditor` and `restore`. A backup
copy was restored afterwards and checked identical with `cmp`. **6 failed**
(`/tmp/8a-dp-reverted.txt`):

| Case | Failure, verbatim |
|---|---|
| delivered, × 2 | `AssertionError: expected [] to deeply equal [ 1 ]`, then the `afterEach`'s `AssertionError: expected 2 to be 3 // Object.is equality` |
| reopened, × 2 | `AssertionError: expected true to be false // Object.is equality`, then `AssertionError: expected 3 to be 4 // Object.is equality` |
| settlement | `AssertionError: expected [] to deeply equal [ 'retained' ]` |
| roster | `AssertionError: expected [] to deeply equal [ 1, 2 ]` |

`RawEditor.test.ts` and `RestorePane.test.ts` mount the components directly. Each gained only an
inert `reportReceiver` (a documented `inertBinding()` helper), and their counts are unchanged.

## 5. Open items handed to 8b, 8c and later (not fixed here, `CLAUDE.md` §7)

1. **8b: what the two panels now draw under an external conflict has not been read.** The raw
   editor draws a disabled *Save* with no sentence. Restore draws its `tRestoreRefusal` sentence
   and `RecoveryWithoutCreation`. Neither draws the origin, the comparison, `externalMessages`,
   `externalNotices`, the reseed or retarget, or the CR disclosure deliberately yet. Those, "the
   viewer refreshes through the guarded path while the editor conflicts" and "the restore
   candidate survives" are 8b's, with the bilingual mounted tests. 2d-6-5 §4 item 12 is also 8b's
   decision: a candidate dropped under a standing conflict leaves lines that say it is kept.
2. **8c: no window was read.** Nothing here claims what a window draws.
3. **`classifyFailure` is still called bare in two post-write catches**: `commands.ts:712` (the raw
   command's reload catch, whose comment says "`classifyFailure` never throws", which is false for
   a hostile `code` getter) and `invalidation.ts:367` (`openWholeDocumentSave`'s catch around a
   caller's `forget`, with the same comment). The production raw closure no longer reaches the
   first. The second is reached by `DetailPane`'s own `invalidateEverySurface` on a restore, which
   throws nothing hostile today. `errors.ts`'s "Never throws" on `classifyFailure` is the root
   claim. Fixing it there would cover all of them, and it is a later phase's decision.
4. **`spendTheConfirmedReload` in `editorSave.ts` has no production caller** since this phase. Its
   doc's "the one place a surface asks the window to cross to the disk side" was already false
   since 2d-6-6b, when the editor's reload stopped calling it, and is now false for every surface.
   Delete it or correct the doc: a later phase decides, as for `adoptForReapply` (7a §4 item 3).
5. **Still open from 6b §7 item 3**: the doors and settling transitions of all eight sessions have
   not been re-audited for reads after their last `current()`, beyond the two reloads fixed here.
6. **Still open from 7a §7 item 1**: the match-level wrappers read the committed result
   (`settlementOfOutcome`, `outcome`) outside any catch before the adoption. Raw's
   `write.expect(settlementOfOutcome(answer.value))` has the same shape. The result is the
   command layer's own parsed JSON, so no getter is reachable in production.

## 6. Verification

Each gate ran on its own on the final tree, with output redirected to a file and read from there,
never through a pipe.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings (no new file) |
| `npm test` | 0 | **3077 passed**, 65 files (+20 from 3057: `workspace.test.ts` +8, `rawEditor.test.ts` +3, `restore.test.ts` +3, `surfaceReceivers.test.ts` +1, `DetailPane.test.ts` +5) |
| `npm run build` | 0 | **193 modules** (unchanged: no new module; the two components import `surfaceReceivers.ts`, which was already in the graph) |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are **absent** |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are **present** |
| `cargo test --workspace -- --test-threads=1` | 0 | **1323 passed**, 0 failed (no Rust edited) |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

New rung (with the instrument): **`1323 / 449 / 3077 / 193`**. **Git:** read-only commands only
(`git status`, `git diff --stat`, one `git stash list` (a listing; no stash was made), and `git show HEAD:<file>` redirected into two working files for
the §4.2 pre-fix run, restored at once). Nothing was staged, committed, stashed or reverted. The
four instrument paths were not touched, and `PROGRESS.md` and `PROGRESS.json` were not edited.

## 7. Review fix round

**Codex adversarial review, `ship-with-fixes`: 1 BLOCKER, 1 SHOULD-FIX**
([`docs/reviews/phase-2d-6-8a.md`](../reviews/phase-2d-6-8a.md)). Both were re-derived and **both
held**. Per `CLAUDE.md` §7, no re-review follows. Each fix touches only the files the finding names,
plus the tests and these notes.

### 7.1 BLOCKER: the reporter rereads the failure outside the guarded classifier (`workspace.svelte.ts`)

**Re-derived, and it held.** `classifiedAfterTheCommit` reads `code` once. If that read answers a
real code such as `noWorkspaceOpen`, `isCommandError` accepts the value and the failure is
`{ kind: 'command', error: <the thrown value> }`. The default reporter, `reportIpcFailure`
(`errors.ts:607`), then reads `failure.error.code` a second time. Both catches this phase added
called `report` bare:

- In the reload closure, the report ran **before** `reprojection` was recorded. A throw from the
  report escaped the closure into the command's own catch, which classifies bare. If the second
  read throws a value no classifier can read, that catch throws too, and the committed save came
  back as an error.
- In the may-have-written catch, a throw from the report rejected the wrapper outright.

**Case** (`workspace.test.ts:6095`, in the §4.1 suite): *answers a {committed, may have written}
raw save as such when its {getDocument, documentText} throws a value the default reporter cannot
read*, 4 rows. The case uses `createBrowserState(commands)`, so the **default reporter** runs, with
`console.warn` silenced. The thrown value is `flakyCommandError()` (`:6072`): its first `code` read
answers `'noWorkspaceOpen'`, and every later read throws a value whose own `code` getter throws.
**Pre-fix failure, verbatim** (`/tmp/8a-fix1-prefix.txt`): **4 failed**.

| Rows | Failure |
|---|---|
| committed × both reads | `Error: the code getter threw` ` ❯ isCommandError src/lib/ipc/errors.ts:743:32` ` ❯ Module.classifyFailure src/lib/ipc/errors.ts:769:7` ` ❯ Object.<anonymous> src/lib/browser/workspace.test.ts:809:48` (the command stub's catch, which repeats `commands.ts`'s) |
| may have written × both reads | `{ code: '<unserializable>: the code getter threw', stacks: [] }` (the rejected value itself) |

A first draft whose second read threw a plain `Error` failed only the two may-have-written rows.
The committed rows passed, because the command's catch classifies an `Error` correctly. The
committed half needs the second read to throw something unclassifiable, and the table above is the
run of the final case.

**Fix.** A new private helper, `reportedQuietly(failure)` (`W:7438`), calls `report` inside a
`try` and drops whatever it throws. Its doc says what this forces (the call always returns) and
what it does not (that the report was delivered). In the closure, `reprojection` is now recorded
**before** the report, and both new catches report through the helper. After the fix,
`workspace.test.ts` passes **362 of 362**.

### 7.2 SHOULD-FIX: the settlement's queue read after the last look (`rawEditor.ts`, `restore.ts`)

**Re-derived, and it held in both files.** `consumingHeldDeliveries` read
`current().heldDeliveries` and decided from what that one read answered. Reading the property runs
caller code. A getter there can deliver into the installed session. The session is still `saving`,
so the receiver installs a *new* session with the envelope appended, while the read itself answers
the old, shorter list. The loop then saw nothing new and returned its replay, so the caller
installing that answer dropped the delivery.

**Cases** (`rawEditor.test.ts:1844`, `restore.test.ts:4139`): *replays a delivery that a read of
the installed session's queue made, after the last look*. The in-flight session is a `Proxy`. Its
first read of `heldDeliveries` after the reader has been called delivers a `retained` observation
through the holder's receiver, once. The case settles through `saveCouldNotBeSent` or
`restoreCouldNotBeSent` and asserts that the getter fired, the queue is empty, and the wait is
recorded. **Pre-fix failure, verbatim** (`/tmp/8a-fix2-prefix.txt`): **2 failed**, both
`AssertionError: expected undefined to be { sequence: 9, document: 7, …(6) } // Object.is equality`.

**Fix, the same in both loops** (`RE:1133`, `RS:3433`). The loop captures the installed session,
reads its queue, and decides whether the queue extends what was replayed. It then asks `current()`
again. A session displaced during those reads is inspected again from the top, and nothing is
replayed twice, because `seen` has not moved. Each function's doc sentence ("read through
`current`, once") was corrected in place. After the fix the two files pass **329 of 329**.
**Forced**: no delivery made by a read inside the inspection is lost when the reader is honest.
**Not forced**: that the rounds end. A getter that delivers a fresh reading on every read does not
come to rest here, which is the same limit the doc already states.

### 7.3 Open items noticed in the fix round (not fixed, `CLAUDE.md` §7)

1. **The other six sessions' `consumingHeldDeliveries` have the same queue-read shape**:
   `matchEditor.ts:1882`, `matchCreation.ts:1700`, `recovery.ts:2074`, `matchDeletion.ts:1071`,
   `matchDuplication.ts:1318` and `matchMove.ts:1847`. They are not this finding's files, and they
   belong with the 6b §7 item 3 re-audit.
2. **The other `report` calls after a raw write are still bare**: `report(answer.failure)` in the
   failed path, and `report(thrown)` in the committed path. The second reads a failure the command
   layer already classified, and the review did not name either. `report` is also called bare in
   `adoptTheReplacedDocument` (`report(fresh.failure)`), over a typed command answer.

### 7.4 Gates after the fix round

Each command ran on its own on the final tree, with its output redirected to a file and read from
that file.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **3083 passed** (+6 over §6: `workspace.test.ts` +4, `rawEditor.test.ts` +1, `restore.test.ts` +1) |
| `npm run build` | 0 | **193 modules** (unchanged) |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are present |
| `cargo test --workspace -- --test-threads=1` | 0 | **1323 passed**, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

New rung: **`1323 / 449 / 3083 / 193`**. No git write command was run. The four instrument paths, `PROGRESS.md`
and `PROGRESS.json` were not touched.
