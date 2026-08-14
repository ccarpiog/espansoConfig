# Phase 2c-5-4b — the restore screen, its i18n, and the phase's mounted evidence

**This is the step that draws restore.** `src/lib/components/RestorePane.svelte` is the seventh
write surface and the third-pane mode consult Q5 asks for; `DetailPane.svelte` reaches it from the
file's whole-text surface and supplies the two things a coordinator cannot derive — the list of
open write surfaces and the post-commit invalidation. Fifty new dictionary keys cross both
locales, one typed accessor (`tRestoreRefusal`) is added and called, and
`src/lib/components/RestorePane.test.ts` is the whole of Phase 2c-5's **mounted** evidence
(consult Q7 item 4).

The consult is `docs/reviews/phase-2c-5-design.md`; **Q5** is this step's specification, **Q6** is
what restore may never claim, and **Q8** is the single binding instruction the model was built not
to loosen. The coordinator half is `docs/decisions/2c-5-4a-notes.md`, and its five hand-forwards
are discharged in §4.

**No window reading is owed by this step and none was taken** — 2c-5-6 owes it, for both
languages. **No Rust changed.**

---

## 1. What this step built

### Created

- **`src/lib/components/RestorePane.svelte`** — the screen. §2.
- **`src/lib/components/RestorePane.test.ts`** — 59 mounted cases over a **real** `BrowserState`.
  §5.
- **`src/lib/browser/restoreFacts.ts`** — `candidateMeasurements` and `distinctReasons`: the
  arithmetic the screen states about a candidate, kept out of markup. §2.3.
- **`src/lib/browser/restoreFacts.test.ts`** — 15 model cases.
- **`src/lib/i18n/restoreCodes.test.ts`** — 18 accessor cases, both locales, plus the consult Q6
  claim scan over every `browser.restore.*` key. §3.2.

### Modified

- **`src/lib/components/DetailPane.svelte`** — the restore mode, its opener on the whole-text
  surface, `openWriteSurfaces()`, `invalidateEverySurface()`, and `restoring` joining `busy` so the
  seven write surfaces stay mutually exclusive. §2.5, §4.4.
- **`src/lib/components/DetailPane.test.ts`** — `BackupCommands` injected explicitly, a hoisted
  mock of `@tauri-apps/api/core`, and two cases: the mode is reachable, and its first catalogue
  read goes through the injected surface. §4.1.
- **`src/lib/i18n/en.json` and `es.json`** — 50 new `browser.restore.*` keys each (62 in total in
  each dictionary, counting the twelve refusals 2c-5-3 shipped), plus one new conflict-choice
  label. §3.
- **`src/lib/i18n/index.ts`** — `tRestoreRefusal`, and the import of `../browser/restore` that
  2c-5-3 and 2c-5-4a both deliberately did not add. §3.1.
- **`src/lib/i18n/dictionaries.test.ts`** — `browser.restore.revisionExpected` joins the
  `.revisionExpected` family. §5.4.
- **`src/lib/browser/restore.ts`** — the step itself changed `CONFLICT_CAPABILITIES.offersReload`
  to `true` and rewrote its note to say what the flip cost: **one boolean and a comment; no
  transition, no type and no behaviour** (§2.4). **The fix round then changed the module's
  authorization machinery** — the permit is built by `prepareRestore` rather than by
  `confirmRestore`, `PENDING_CONFIRMATIONS` became the value-carrying `PENDING_AUTHORIZATIONS`, and
  `revokeConfirmation` is called by every withdrawing transition. §8. **The confirmation round then
  re-keyed `PENDING_AUTHORIZATIONS` by the `RestoreSession` itself**, so a revocation reads no
  property at all, and added `carryTheQuestion`, `takeTheQuestion`, `putTheQuestionBack` and
  `withNothingPending`. §9. **The second confirmation round replaced `putTheQuestionBack` with a
  suspension**: `SuspendedQuestion`, `SUSPENSIONS`, `isSuspended`, `suspendTheQuestion`,
  `restoreTheQuestion` and `unchangedByInspection`, because taking an entry out to protect it made
  `prepareRestore` see a question that was not there. §10.
- **`src/lib/browser/workspace.svelte.ts`** — the confirmation round only:
  `adoptDiskVersion` reserves the confirmation immediately after testing it, takes its two
  caller-controlled reads into locals first, and releases the reservation on each refusal. §9.3.
- **`src/lib/browser/saveOutcome.ts`** — a **sixth** `ConflictChoice`, `confirmReloadKeeping`, and
  `conflictChoicesFor` choosing between the two confirmations by the surface's declared
  `reloadOutcome`. §2.4.1 is why this was necessary and why it was done this way.
- **Seven components gain one dead `switch` arm each** — `MatchEditor`, `MatchCreator`,
  `MatchDeleter`, `MatchMover`, `MatchDuplicator`, `RawEditor` and `RecoveryPanel`. Each is the
  compile error the new member produced, closed the way those files already close `copyDraft` and
  `keepMyDraft`. **No sentence any of them draws changed.**
- **`src/lib/browser/restore.test.ts` and `saveOutcome.test.ts`** — the conflict-choice
  expectations, and one new case pinning the sixth member. The fix round rewrote two cases of
  `restore.test.ts` and added fifteen more (§8.1, §8.2); the confirmation round rewrote **nine of its
  cases** onto in-place mutation of the asked session — a copy of one is no longer a key, so a case
  built by spreading would have passed with every field recheck deleted — and added 38 (§9). The
  second confirmation round added nine more, in one suite (§10.4).
- **`src/lib/browser/workspace.test.ts`** — the confirmation round only: one cross-document
  alternating-getter adoption case. §9.3.

---

## 2. The screen

### 2.1 Three states, stacked, with the evidence still on screen

Consult Q5 asks for three states and explicitly refuses "a modal detached from its evidence". What
is drawn is three `<section class="step">` blocks in order — the recognised batches, the chosen
batch's entries, the exact candidate — followed by this window's own loaded observation, then a
**sticky** action row carrying either *Prepare to replace file* or the question and *Replace entire
file with the shown text*. Nothing is hidden when the question is asked: the candidate, its
measurements and the destination stay exactly where they were, above the question.

The destructive control is set apart by weight and by a heavier border rather than by colour alone
(`.destructive`), because a colour is not a distinction for a person who cannot see it.

**There is no type-the-filename ritual.** The consult rules that it adds ritual and no stronger
binding, and the binding that does exist is the five-value confirmation the model owns.

### 2.2 `SourceText` everywhere, and nothing writable

Every piece of file text on this screen — the candidate, the window's loaded observation, and the
conflict's disk side — is drawn through `SourceText` with `documentStart`, which is the only way a
byte-order mark is drawn as the segment it is. **There is no `<textarea>` and no `<input>` on this
screen at all**, and there cannot be: measured in the shipped WKWebView at 2c-2-2, a `<textarea>`
assigned `"x\ry\r\nz"` reads back `"x\ny\nz"` and an `<input type="text">` assigned `"p\rq"` reads
back `"pq"`. A backup entry may hold either, and a restore exists to put a file's own bytes back.

What a person chooses here is an entry, never a character, so the CR question the raw editor had to
answer with a refusal does not arise.

**The loaded observation is optional and is labelled.** `browser.restore.loadedObservation` says it
is the text this window read when it last loaded the file, that it is this window's observation
rather than a reading taken now, and that nothing here compares it with the candidate. It is
**captured** with the projection and the file in one assignment by `DetailPane.startRestoring`,
never read live: `browser.fileText` follows `browser.fileTextTarget`, which a sidebar click moves,
and a live reader would put another file's bytes under that sentence — the 2c-2-2 High, one screen
along. There is no diff, and nothing on this screen is writable.

### 2.3 The candidate's facts are measured, and `restoreFacts.ts` is where

Consult Q5 asks for "candidate byte/character facts that are actually measured". Two numbers are
counted from the retained string itself: the **UTF-8 byte length**, through `TextEncoder`, because
that is the size of what would be written and `String.length` counts UTF-16 code units; and the
**code-point count**, by stepping the string's own iterator, because `String.length` reports an
emoji as two.

A third number is *compared and disclosed rather than resolved*: `BackupEntry.length` is what
`stat` reported **when the entry was listed**, and `../ipc/types.ts` says in the same sentence that
it is a fact about that moment. It is read with `BigInt` and only from plain decimal digits —
`BigInt` accepts `' 12 '`, `'0x0c'` and `''` and a batch is untrusted input — and where both
numbers exist and differ, the sentence says that two observations taken at two moments disagree and
that **nothing here says which describes the entry now**.

The module exists rather than the arithmetic living in markup for 2c-3c-3's reason: a rule written
into one renderer is carried by that renderer's mounted suite alone. It is not part of `restore.ts`
because that module is the restore *transaction*, finished and reviewed at 2c-5-3 and 2c-5-4a.

`distinctReasons` collapses `BackupBatchListing.skipped` — which carries **one code per skipped
entry** — to one sentence per reason. What that deliberately loses is how many entries each reason
covers; the listings carry `unrecognised` and `unreadable` for that, and those are different
numbers.

### 2.4 The conflict panel, and the label that had to be invented

`offersReload` was `false` through 2c-5-3 with every transition already built and driven. This step
flipped it, and that is all it took: `askToReloadDiskVersion`, `confirmDiskReload`,
`reloadTheDiskVersion`, the refused terminal step and the retargeting of the candidate were all
2c-5-3's, and no machinery was invented on top of drawing them. That is the 2c-4a-2 trade paying
off for the third time.

#### 2.4.1 The one thing this step changed outside its own files, and why

`conflictChoiceKey` picked the confirmation's label by `ConflictDraftKind`: *Discard my text and
load it* for `authoredText`, *Close this and load it* for `operationChoice`. Restore's draft kind is
`operationChoice` — the candidate is text **read from** a backup entry and not something a person
wrote, which is why `conflictChoicesFor` refuses *Copy draft* here as a property of the value — and
its reload **closes nothing and discards nothing**. It installs the disk observation, keeps the
candidate, moves the base revision to the conflict's `diskRevision` and withdraws the confirmation,
with the panel still open. That is `retargetsCandidate`, the reload outcome 2c-5-3 added because
both existing ones would have been false sentences.

So *Close this and load it* would have been **a false label on the destructive step of a whole-file
replacement**, which is this project's worst defect class on the worst control in the application
to have it on, and it is the same shape as the 2c-4a-3a finding that `ConflictReloadOutcome` was
invented for.

**Two answers were available and the cheaper one was taken deliberately.** Making the label depend
on `ConflictReloadOutcome` directly means widening `conflictChoiceKey`'s and `tConflictChoice`'s
second parameter, which is a `ConflictDraftKind` at roughly a hundred and fifty call sites across
eight suites — a cross-cutting rewrite to fix one label, in a step whose subject is a screen.
Instead `ConflictChoice` gains a **sixth member**, `confirmReloadKeeping`, and `conflictChoicesFor`
— still the only producer of a choice list — picks between the two confirmations from the
surface's declared `reloadOutcome`, through a `switch` so a fourth arm of that union is a compile
error rather than a silent inheritance.

**What that cost and what it did not.** It cost one dead arm in each of the seven components that
can never reach it, and every one of those was a **compile error** until it was written — the
safety property those files' own notes advertise. It cost nothing in words: `conflictChoiceKey`'s
answer for all six existing surfaces is **byte-identical**, so **no shipped screen's sentence
changed and no window reading is invalidated by this step**. The new label is one string for both
draft kinds, because it is a statement about what the reload does rather than about what the draft
is.

**What establishes that byte-identity, exactly** (corrected in the 2c-5-4b fix round; finding 5).
The record said `saveOutcome.test.ts` "asserts it directly", and it does not. What the added case
asserts is that the five discarding-or-closing surfaces and the raw editor still *receive*
`confirmReload` rather than `confirmReloadKeeping`; the sentences behind those keys are pinned as
their current values by `dictionaries.test.ts` and the per-surface suites. **The historical claim —
that today's bytes equal the bytes before this step — is established by the diff**, which touches
neither `conflictChoiceKey`'s existing arms nor their English and Spanish values, and by the
independent inspection recorded in `docs/reviews/phase-2c-5-4b-code.md`. No executable test in this
repository compares a rendered label against a pre-change snapshot, and none of the three scans in
§3.2 could tell if one changed.

### 2.5 The mode, and where it is reached from

`DetailPane.svelte` draws the opener inside the file's whole-text section, which is the one place in
this window that is about a file rather than a snippet (consult Q5). It is offered **whether or not
this application may write the file**, for the reason the deletion, move and duplicate controls are:
the pane says why it may not, inline and localized, and `restoreRefusal` is one ordering of reasons
rather than a gate repeated in markup.

**The one gate is a projection to open over.** `startRestore` takes the destination's base revision
off a `DocumentView`, and a file this window could not read has none; where there is none the
opener is replaced by `browser.restore.notProjected`, which says what is missing and what to do.
`startRestoring` is a named function rather than an assignment in markup so the projection, the
file and the loaded text are captured in **one** statement.

---

## 3. The i18n

### 3.1 One accessor, and why there is not a second

`tRestoreRefusal(refusal: RestoreRefusal)` is added to `src/lib/i18n/index.ts` and called by the
pane. It is the shape every browser-side code family uses — a `*Key` function in `src/lib/browser/`
and a one-line reactive wrapper over `translate` — and **not** a `describe*` builder in `codes.ts`,
which is where the Rust-side wire enums live.

**`openWriteSurfaceKey` gets no accessor of its own, deliberately.** `restoreRefusalKey` delegates
its `writeSurfaceOpen` arm to it, so a component never reaches a `CompetingWriteSurfaceKind` without
the refusal that carries it; a second accessor would have no caller, and an accessor with no caller
is exactly what step 3's fourth pass adjudicated right to defer.

The import of `../browser/restore` into `index.ts` is the one 2c-5-3 and 2c-5-4a both declined to
add, for a mechanical reason that has now expired: `index.ts` is reachable from the application
entry, so importing a model nothing drew would have put it in the production bundle. Something draws
it now.

### 3.2 What the sentences may not say, and what actually holds them to it

Every new key was written against consult Q6's forbidden list. The truthful term is **recognised
backup batch**, and `browser.restore.batchOrder` is the one sentence that says what a batch name is:
a folder label of the shape this application writes, made from a clock reading, with a number after
it that separates folders labelled alike — and it denies both halves explicitly, that recognising
the shape of a label is knowing what wrote the folder, and that the label records when this file was
written or what it held. No sentence anywhere converts a name into a localized time.

Three scans exist, at three levels, and **none of them checks meaning**:

- `restoreCodes.test.ts` scans every `browser.restore.*` key in both dictionaries against a listed
  vocabulary, with a control string proving the vocabulary bites;
- `RestorePane.test.ts` scans the **rendered** screen, in both languages, in each of **sixteen
  mutually exclusive states** — which covers the shared `saveOutcome` and `code.*` sentences the
  pane borrows and the key scan cannot see;
- `dictionaries.test.ts`'s `.revisionExpected` family check, which the new key joined by failing.

**The sixteen states, and why there are sixteen rather than one walk** (corrected in the 2c-5-4b fix
round; finding 3). This record and the test's own comment said the scan ran "after a walk that
reaches every panel the pane can draw at once". **No walk can**: the outcome states are mutually
exclusive, and the one that shipped reached the catalogue, the candidate, the loaded observation,
the question and a conflict, and never rendered a committed outcome, a `committed: false`, a
refusal, either send-failure arm, or any of the six open-surface refusals. A forbidden claim in a
shared sentence drawn only after a commit or a send failure would have passed both suites.
`panels()` in `RestorePane.test.ts` is now the table — the catalogue with its question; the five
things a transaction can answer (committed, committed-with-this-window-out-of-step,
`committed: false`, a refusal carrying findings, a conflict); both send-failure arms; the conflict's
reload warning and a reload the window refused; and each of the six open-surface refusals — and the
scan runs over every one of them in **both** languages. **Every entry proves it arrived** before the
scan runs, because a walk that silently failed would make the scan pass over a screen nobody looked
at, which is the same shape one level down.

**Where a test cannot force something, in the same sentence as what one does forces:** those three
pin that a listed vocabulary is absent and that every arm names an entry both dictionaries hold.
They cannot pin that the replacement wording is the right wording, that a Spanish sentence is
Spanish, or that any sentence is true of its predicate. Reverting a prose fix while keeping its key
leaves all three green. That is the standing limit `CLAUDE.md` §6 records, and it is stated here
rather than implied.

Two claims are pinned positively because their predicates are narrow enough to state:
`browser.restore.sendFailed` must contain *this attempt wrote nothing* rather than *nothing was
changed*, and the two open-editor refusals must contain *cannot tell whether* — the
`documentHasUnsavedDraft` defect, which those two sentences have never had and now cannot acquire
silently.

---

## 4. The five things 2c-5-4a handed forward

### 4.1 `BackupCommands` has a real production default

Discharged by injection **and** by a mock. Every `createBrowserState` call in
`RestorePane.test.ts` and `DetailPane.test.ts` passes the third argument, and both files replace
`@tauri-apps/api/core` with an `invoke` that records and **rejects**. A call that reached the real
boundary would fail rather than pass quietly, and every case asserts `invoked` was never called.
That one mock closes two different mistakes: a component importing `../ipc/commands`, and a
`createBrowserState` call that forgets its third argument.

### 4.2 One shared live `RestoreContext` for all four gates

`RestorePane.svelte`'s `current` is a single `$derived.by` that reads `projections()` and
`surfaces()` **once** and builds one `RestoreContext`. `restoreView` — and through it
`restoreRefusal` and `canPrepareRestore` — is derived from that value, and `prepareRestore` and
`confirmRestore` are handed the very same object. `observed` is
`revisionInProjection(projections(), session.target)` and never `session.baseRevision`.

**What no type forces**, in the same sentence as what one does: nothing stops a caller passing a
`projections` function that answers a stale array, and nothing in `restore.ts` can see where its
argument came from — what is closed is that this pane's four gates cannot disagree with each other,
because there is one read and one value.

### 4.3 `restoreDocument` answers `RestoreSession | null`

`runRestore` installs the answer **only when it is non-null**. `null` means this call held no
permit — another call, an earlier one or a re-entrant one that reached the checked deletion first,
is the one that spent it and the one that answers for the session — so installing the
confirmation's own frozen snapshot would overwrite whatever that call produced.

**In this pane there is no such other call**, and the record says so rather than claiming the arm
is exercised: the confirmation is minted and spent in one handler, and a second press finds nothing
pending, which the mounted suite drives by clicking the control three times and asserting one send.
The arm is written for what the coordinator's contract says, not for what this caller can reach.

### 4.4 The `InvalidateEverySurface` supplier is `DetailPane`'s

`invalidateEverySurface` closes every one of the pane's write surfaces whose captured document is
the replaced one, synchronously and with no `await` anywhere in it. **The restore pane itself is
not closed**, deliberately: it is where the outcome of the write is drawn, and
`RestoreSession.restored` already stops it offering to replace anything again.

**The new-snippet form is closed whatever file it names**, because this pane cannot learn which one
it chose — `MatchCreator` picks its own destination — and a form left open over a replaced file
holds a position anchor that names nothing. That is over-broad by construction and it is the
conservative direction.

**Two things are stated rather than glossed.** First, `openWriteSurfaces()` omits the creator for
the same reason: a surface value for it would have to invent a document, and consult Q4 is explicit
that a creator naming no file competes with no restore. Second, **the whole body is provably a
no-op today**: `busy` makes the seven surfaces mutually exclusive, so at the moment a committed
restore discharges this callback the restore pane is the only one open. It is written for the day
that stops being true. `InvalidateEverySurface` forces that a caller supplies a body and **never**
that the body closes anything; what is written here is the whole of the guarantee.

### 4.5 The acknowledgement is candidate-scoped, not one-attempt

*Save anyway* on a refusal calls `prepareRestore(acknowledgeRestoreFindings(session), context)` — it
records what was reported and **asks the question again**, because `confirmRestore` consumed the
pending one when the refused attempt was sent. `browser.restore.acknowledgedAsksAgain` is the
sentence, and it says exactly that: accepting sends nothing, the confirmation is asked again, and
what was accepted stays with this exact text and is not asked for a second time.

The mounted case drives the sharp version: acknowledge, be asked again, **cancel the question**,
prepare and confirm afresh — and the second send still carries `{ accepted: [DOES_NOT_PARSE] }`,
the whole finding with its content-addressed revision. Neither the copy nor the cases are built
around consent being re-collected.

---

## 5. The evidence

### 5.1 The mounted matrix, over a real `BrowserState`

`RestorePane.test.ts` mounts the pane over `createBrowserState` with scripted `BrowserCommands` and
`BackupCommands`, and `restore` is the state's own `restoreDocument`. So a case that presses
*Replace entire file with the shown text* is asserting what reaches `commands.saveRawDocument` —
the destination, the base revision, the exact bytes and the acknowledgement — through the real
coordinator, the real permit and the real seal.

The 59 cases cover: the catalogue walk and its skip-reason collapsing; the refusal a read of an
entry that is not this file comes back with; the measurements, including a listing that disagrees;
the loaded observation, drawn and absent; **the exact candidate's rendering, segment by segment**;
nothing sent until the second control and then exactly what was shown; a cancelled question;
withdrawal on a changed entry, on a catalogue refresh, and on this window re-reading the
destination; the open-surface refusal drawn; a surface over another file ignored; **a surface opened
after the question, which the rendered refusal cannot see and `confirmRestore` refuses anyway**; one
question spent once under three presses; the committed outcome with its invalidation; a committed
write this window could not re-read, drawn beside the commit and never in place of it;
`committed: false`; a send that produced no outcome; the acknowledge-and-re-ask round trip; five
conflict cases — nothing installed, the two-step adoption, `refused`, `alreadyThere`, and the
refusal to prepare while a conflict is showing; and **the thirty-two-case forbidden-claim scan of
§3.2**, sixteen mutually exclusive states in each of the two languages.

**The candidate's rendering is asserted rather than sampled** (the 2c-5-4b fix round; finding 4).
The exact-candidate case used to look only for a distinctive word, so it would have passed with the
byte-order mark dropped, the carriage return normalised away, or `SourceText` replaced by markup
showing one line. It now asserts the `SourceText` representation: both invisible characters named —
the mark as a **byte-order mark**, which it is only because `documentStart` is passed — three `<br>`
elements and no line ending in any text node, and the three runs of the file's own characters
untrimmed and in order. **What a rendering cannot be held to, in the same sentence**: `sourceSegments`
collapses a CRLF and a bare LF to the same `break` segment, so the DOM cannot distinguish them and
no mounted assertion can. The candidate therefore carries a **lone** carriage return as well, which
does become a named segment, and what proves the CRLF survived is the submission case, which
compares what reached `saveRawDocument` against the candidate's bytes whole.

### 5.2 What the mounted suite deliberately does not prove

jsdom has no layout. The sticky action row, the scroll-into-view of the outcome panel, keyboard
order, focus and hit testing are **not** measured here and are 2c-5-6's, in both languages. A
mounted test proves a handler fires and that the right value reaches the boundary; it is not a
screen.

The adoption is a **scripted** prop in this suite, so its three answers are driven directly rather
than through `BrowserState.adoptDiskVersion`'s five ordered guards. Those guards are
`workspace.test.ts`'s and `saveOutcome.test.ts`'s; what is proved here is that the pane calls the
prop exactly once, only after both steps, and honours `refused` by re-pointing nothing while
finishing on `alreadyThere`.

`DetailPane.test.ts` proves the mode is **reachable** and that its first catalogue read goes through
the injected surface. It does not drive a restore, and it does not exercise
`invalidateEverySurface`'s body — which, per §4.4, cannot do anything today.

### 5.3 The model evidence beside it

`restoreFacts.test.ts` drives the arithmetic over a byte-order mark, a CRLF pair, a precomposed and
a decomposed `é` and an astral emoji, and asserts all three numbers a screen could confuse: 22
UTF-8 bytes, 16 UTF-16 code units and 15 code points. It drives a length beyond the safe-integer
range exactly, and seven strings `BigInt` would either accept wrongly or throw on.

`restoreCodes.test.ts` renders all twelve refusal arms in both locales, asserts that the twelve keys
are distinct, and asserts that `restoreRefusalKey` **delegates** its open-surface arm to
`openWriteSurfaceKey` rather than carrying a sentence of its own.

### 5.4 A guard that fired

`dictionaries.test.ts`'s `.revisionExpected` family check failed on the commit that added
`browser.restore.revisionExpected`, exactly as its own comment predicted it would. The key was
added to the list and its two sentences checked for the vocabulary of writing; neither uses it.

---

## 6. The gates

| Gate | Before | After the step | After the fix round | After the confirmation round | After the second confirmation round | Arithmetic |
|---|---|---|---|---|---|---|
| `cargo test --workspace` | 1153 | **1153** | **1153** | **1153** | **1153** | no Rust file changed by any of the four |
| `npm run check` files | 426 | **431** | **431** | **431** | **431** | +5: `restoreFacts.ts`, `restoreFacts.test.ts`, `restoreCodes.test.ts`, `RestorePane.svelte`, `RestorePane.test.ts`; no later round adds a file |
| `npm test` | 1958 | **2028** | **2074** | **2113** | **2122** | +70, then +46, then +39, then +9, all itemised below |
| `npm run build` modules | 181 | **184** | **184** | **184** | **184** | +3, **predicted before building**; no later round adds a module |

**The module arithmetic, predicted and then measured.** `CLAUDE.md` §6: a new `.ts` module
reachable from the entry costs one, and a new component **with a `<style>` block** costs two,
because the block is a module of its own. `RestorePane.svelte` is +2 and `restoreFacts.ts` is +1, so
the prediction was **184** and the build answered 184. `restore.ts` was already reachable as of
2c-5-4a and contributes nothing.

**The `<style>` half was measured rather than inherited**, as 2c-4c-3a's was: the block was deleted,
the build came back **183**, and it was restored to **184**.

**The discriminating bundle oracle, both lines read** — a bare `svelte/internal/server` search is
vacuous in a production build and was not used:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # → no match (ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    # → 2 (PRESENT)
```

**The +70 test cases**: `RestorePane.test.ts` 27, `restoreCodes.test.ts` 18, `restoreFacts.test.ts`
15, `DetailPane.test.ts` +2, `saveOutcome.test.ts` +1 — 63 written here — plus **7 from the
per-file `it.each` lint suites**, which grow by themselves: one each in
`scripts/lint/hardcoded-strings.test.ts` and `built-translation-keys.test.ts` for the new `.svelte`
file, and five in `scripts/lint/ipc-detail.test.ts`, one per new file under `src/`.

**The fix round's +46**: `restore.test.ts` +14 (three cases replacing one, plus the twelve-case
withdrawal group and its companion) and `RestorePane.test.ts` +32 (the forbidden-claim scan goes
from 2 cases to 32, and the truthful-term claim becomes 2 of its own). **No lint-suite case moved**,
because the fix round adds no file under `src/`.

**The confirmation round's +39**: `restore.test.ts` +38 — one case for the base-revision
disagreement, one more row in the sequential withdrawal group (`reloadTheDiskVersion`, the omitted
transition), the twelve-case **re-entrant** withdrawal group, the adoption-callback case, and the
twenty-three-row transition table — and `workspace.test.ts` +1, the cross-document
alternating-getter adoption case. **No lint-suite case moved and no file was added**, so the check
and module counts do not move either.

**The second confirmation round's +9**: `restore.test.ts` +9, the whole *a question being inspected
is held, never absent* suite — six re-entrancy cases and the three parameterized Low cases. Nothing
else changed, so no other count moves. §10 is the round.

---

## 7. What this record does not claim

Checked against the code rather than the code against the record, because a decision record
claiming a guarantee the code does not give is this project's worst defect class.

1. **Nothing here proves a screen.** Every claim in §5 is about a handler firing, a value reaching a
   boundary or a string appearing in `textContent`. 2c-5-6 owes the reading, in both languages, and
   any component fix taken then invalidates and retakes it.
2. **The open-surface list is not proved complete.** `openWriteSurfaces()` enumerates what
   `DetailPane` holds; nothing anywhere can check that it holds everything, and an empty array
   claims there are none. That is why the pre-send refusal is an affordance and §4.4's callback is
   the safety proof — and why §4.4 also says the callback's body is a no-op today.
3. **The invalidation supplier is not proved to close anything by any type.** `() => {}` satisfies
   `InvalidateEverySurface`. What is written is the whole guarantee, and it is written down.
4. **The candidate measurements say nothing about the entry now.** Both numbers were true of the
   moment each was taken. Where they differ, the screen says they differ and nothing more.
5. **A recognised batch is not an authentic one.** The ownership marker is deliberately forgeable by
   anything able to write inside the backups folder. No sentence added here says otherwise, and no
   test in this repository could tell if one did — only the vocabulary scans of §3.2 would, and only
   for the words they list.
6. **`tConflictChoice`'s answer for the six pre-existing surfaces is asserted to be the same
   *key*, and the byte-identity of the sentence behind it is established by the diff**, not by a
   test. That is the whole basis for the claim in §2.4.1 that no shipped screen's words changed, and
   it is an assertion about the key each surface is given rather than about anybody having looked at
   those screens again. §2.4.1's correction block is the long form.
7. **The re-entrancy the model defends against is not driven from a screen.** `restore.test.ts` has
   the getter cases; a mounted suite cannot install one usefully, and the three-press case here
   proves only that one question yields one send on the ordinary path.
8. **The forbidden-claim scan covers sixteen states and not every state.** It covers what
   `panels()` lists; a state nobody added an entry for is a state nobody scanned, and nothing in
   TypeScript can enumerate the pane's rendered states for it. What *is* forced is that each of the
   six competing surface kinds has an entry, because `COMPETING_SURFACES` is built with a
   `satisfies Record<CompetingWriteSurfaceKind, true>` and a seventh kind is a compile error there.
9. **No mounted assertion distinguishes a CRLF from a bare LF.** `sourceSegments` gives both the
   same `break` segment, so the rendering is identical; the candidate's CRLF fidelity is proved at
   the save boundary and its lone carriage return on the screen, and §5.1 says which is which.
10. **The revocation of a withdrawn confirmation is not forced by any type.** Nothing makes a new
    transition that writes `pending: null` call `revokeConfirmation`, and TypeScript cannot see the
    obligation. What is forced is that no path outside `prepareRestore` can put an entry into
    `PENDING_AUTHORIZATIONS`, and that every transition which exists today either revokes or carries
    — driven by the withdrawal groups and the transition table in `restore.test.ts`.
    **As written before §9 this item was also wrong about which transitions exist**: it said "every
    transition which exists today revokes" over a list that omitted `reloadTheDiskVersion`, and
    "revokes" meant *called a helper that opened with a caller-controlled read*. §9.2 is the record.
11. **A session's presentation and its authorization agree by obligation, not by type.** Since §9.2
    the authorization is keyed by the session object, so a transition that returns a fresh session
    owes either a revocation or a carry, and TypeScript sees neither. The table in `restore.test.ts`
    drives every exported transition and asserts the biconditional; nothing stops a new one being
    added without a row.
12. **The re-entrant cases prove one opening each, not the absence of openings.** Each drives a
    getter or a callback the transition itself runs. A transition that read a *new* caller value
    before revoking would be caught only because the trap covers **every** own field of the
    session — which is a property of that fixture and not of the model.

---

## 8. The fix round

`docs/reviews/phase-2c-5-4b-code.md` reviewed the uncommitted tree and found **two High, one Medium
and two Low**. All five are closed here, each with the regression evidence the review named. **No
Rust changed, no module was added, and no file was created.** **No `.svelte` file changed either**,
so the bilingual reading 2c-5-6 owes is neither invalidated nor brought forward by this round — what
changed is one model module and two suites.

> **Read §9 before believing this section.** The confirmation review found H1 only **partially**
> closed and H2 **still open**, and found a **new** High in the sweep §8.4 records. M3, L4 and L5 are
> confirmed closed. The correction blocks below mark each false sentence where it stands; §9 is the
> record of what was actually done about them.

### 8.1 H1 — the permit's submission was derived after the confirmation had been spent

`confirmRestore` performed its checked `delete` and *then* read `submissionOf(preview.draft)`, the
session's target and base revision, the preview's entry and hash, and the session's preview
generation. Every one of those is a caller-controlled property read on the far side of the
authorization, and a property read runs arbitrary code: a getter that answered candidate A while the
question was validated and candidate B afterwards produced a permit recording **hash A beside
submission B**, and `permitHolds` re-read the same getter and saw B on both sides of its byte
comparison, so B reached the wire. `permit.submission.baseRevision` was worse still — it is what
`sendRestore` sends and it is compared with **nothing**, so a drifting `draft.baseRevision` was
never noticed at all.

**The fix is one record built one function earlier.** `prepareRestore` now assembles the
`RestorePermit` when it asks the question: the destination, the base revision, the entry identity as
**copied primitive fields** rather than the caller's object, the candidate hash, the preview
generation, and the **exact complete submission** with its acknowledgement `structuredClone`d — the
whole thing `deepFreeze`d, because `readonly` freezes nothing at runtime. It is filed in
`PENDING_AUTHORIZATIONS` under the `PendingRestore` that goes back on the session, and
`confirmRestore` **moves that same object** into `PERMITS`. `PendingRestore`'s own five fields are
copied off the frozen record rather than read a second time, and the confirmation's five checks
compare the record rather than those fields — one step stronger, because the question object is
reachable by a caller and its properties are redefinable while the record is neither.

**Nothing caller-controlled runs after the spend.** The session `confirmRestore` returns is built
*before* the checked deletion — a spread is a caller-controlled read — and the only statement after
it is `PERMITS.set(started, authorized)`.

**What no ordering can make atomic, in the same sentence as what this forces**: `prepareRestore`
still performs several property reads on caller values, so a getter answering differently on
successive reads can make the snapshot internally inconsistent. What is forced is that whatever it
froze is what a send carries, and that `permitHolds` compares the frozen candidate's bytes against
the live preview's before anything is sent.

> **Correction — that concession was incompatible with the binding this phase claims, and §9.1 is
> the long form.** Two of the reads it excused were **two representations of one value**:
> `RestorePermit.baseRevision` came from `session.baseRevision` and
> `RestorePermit.submission.baseRevision` from `submissionOf(preview.draft)`, nothing required them
> to agree, `permitHolds` rechecked only the first and `sendRestore` sent only the second — so a
> locked write could succeed on a base revision the confirmation never bound. Measured against a
> counterexample build: it puts `ELSEWHERE` on the wire for a question that bound `BASE`. There is
> one read now, used for both fields; a disagreement between the draft's own base and the session's
> refuses the question outright; and `sendRestore` sends the field `permitHolds` checks. **The
> remaining concession is one pairing and it is named**: the candidate's hash and the candidate's
> bytes are two different properties of the preview, and nothing on this side of the wire can hash
> anything to check that the frozen pair describes one candidate. Every other value is read once.

Three regression cases, each verified to **fail** against a build that derives the submission at
confirmation time: *reads nothing off the retained draft once the question is spent* (four counting
getters on the draft, all zero, each of which also re-enters); *sends the base revision bound when
the question was asked* (a `draft.baseRevision` that drifts after the question — the sender is
handed the bound one); and *sends the bytes bound when the question was asked* (a `draft.value` that
drifts after the question — the send is refused outright and the sender is not called).

### 8.2 H2 — withdrawal did not revoke the runtime confirmation

`withdrawn()` and `cancelRestore()` wrote `pending: null` into the session they *returned* and left
the question registered, so "withdrawn" was presentation rather than revoked authorization. A caller
holding the pre-transition session could still confirm it — and `BrowserState.restoreDocument`
deliberately takes its session from `started` rather than from live pane state, so that confirmation
could write candidate A while the pane showed B or showed no question at all. That contradicts
consult Q5.

`revokeConfirmation(session)` is the one place a withdrawal becomes a revocation, and this round
made it the first statement of `withdrawn` (and through it `measuredAgainst`, `loadingBatches`,
`chooseBatch`, `loadingEntries`, `chooseEntry`, `candidateRead`, `candidateRefused` and
`targetRevisionObserved`), `cancelRestore`, `applyRestore`, `restoreConfirmationWithdrawn` and
`acknowledgeRestoreFindings`. Two call sites were restructured so the revocation really is first:
`withdrawn`'s second parameter became `'kept' | 'dropped'` rather than a preview, because every
caller used to evaluate `session.preview` *before* the call, and `candidateRead` now builds its new
preview off the withdrawn session rather than off its argument.

> **Correction — this paragraph as it stood was false, and §9.2 is the long form.** The
> confirmation review found three separate ways: `revokeConfirmation`'s **own first operation** was
> `session.pending`, a caller-controlled property read, so it could not precede caller code at all
> and a getter there could answer the question from inside the transition taking it back;
> **`reloadTheDiskVersion` was not in the list**, and it is a withdrawal — it clears `pending`
> through `measuredAgainst`, after five caller-controlled operations and one arbitrary callback;
> and **seven transitions read `session.phase` through `frozen()` before reaching `withdrawn`**,
> which the fix below did not see because it was written against `withdrawn` rather than against
> its callers. What "first" now means is stated in §9.2 and holds of the whole operation rather than
> of its position in a function body.

**The revocation's boolean result is deliberately discarded, and that is not this phase's recurring
defect.** A discarded consuming operation is a defect when its success authorizes something; nothing
is minted from a revocation, and a second revocation of the same question is the same state as the
first.

Twelve regression cases, all verified to fail with the revocations removed: one per withdrawing
transition, each retaining the pre-transition session, asserting it can no longer mint a
`StartedRestore` and that `sendRestore` answers `notAttempted` — **with a control** in the same case
that asks the same retained session again and gets a question that does confirm, so the refusal is
the withdrawal and not the shape of the case.

> **Correction — those cases are sequential, and no sequential case can see this defect.** They
> drive a transition and then confirm; the defect is a confirmation issued *during* the transition,
> from a getter the transition itself runs. §9.2 adds the re-entrant group that does see it, and
> records that the sequential group stayed green against every counterexample of it.

### 8.3 M3, L4, L5

- **M3** — §3.2's correction block and `panels()`. The single walk could not reach the mutually
  exclusive outcome states, and the record said it did.
- **L4** — §5.1's correction block. The exact-candidate case asserted a substring; it now asserts the
  `SourceText` representation, and the candidate gained a lone carriage return so a rendering can be
  held to one.
- **L5** — §2.4.1's correction block. `saveOutcome.test.ts` pins the current key mapping; the diff is
  what establishes the historical byte identity.

### 8.4 What the sweep found beyond the five

The whole of `restore.ts` was swept for the **shape** — a consuming operation whose result is
discarded, and any property read between a check and a spend — rather than for the wording of either
High. Inside it: the three checked deletions (`PENDING_AUTHORIZATIONS` once, `PERMITS` twice) are
each their own authorization; the two unchecked deletions are revocations, which mint nothing; and
`openWholeDocumentSave` and `spendTheConfirmedReload` both have their results read.

> **Correction — the sweep inside `restore.ts` missed its own subject.** It looked at deletions and
> at the reads around them, and did not ask what the *revocation helper itself* read: the answer was
> `session.pending`, a caller-controlled property, which made every claim of the form "revokes first"
> in §8.2 untrue. §9.2 and §9.4 are the redone sweep.

Two instances of the shape were found **outside** it and were recorded rather than changed, because
each is a different phase's reviewed code:

- `openWholeDocumentSave` in `./invalidation.ts` does `SEALS.get`, compares the result with
  `undefined`, and then discards `SEALS.delete(sealed)`. **No user code can run between them** — a
  strict comparison against `undefined` reads no property, and `WeakMap` identity operations invoke
  nothing — so the two cannot come apart. **This one is sound and the confirmation review confirmed
  it**; it is left exactly as it is, and the reason it is safe is the *absence of caller-controlled
  operations between the read and the deletion*, not tolerance of a known risk. Anything later added
  between those two lines re-opens it.
- `BrowserState.adoptDiskVersion` in `./workspace.svelte.ts` tests `spentConfirmations.has` and adds
  to the set some twenty lines later, with three caller-controlled reads in between
  (`conflict.source`, `adoption.disk.id`, `adoption.diskRevision`).

  > **Correction — the adjudication that followed here was unsound, and §9.3 is the long form.**
  > It said the consequence was closed by the later revision and generation checks, because "a
  > re-entrant call that installs bumps the projection generation, so the outer call then finds the
  > window already holding the requested revision". **Projection generations are per document.** A
  > conflict whose getters alternate between two files this state has remembered defeats the
  > argument entirely: the inner call installs document B and bumps only B's generation, and the
  > outer call — already past its `has` — resumes with document A, finds A's generation untouched,
  > and installs A as well. One answer, two projection replacements and two selection repairs. The
  > shape is now closed rather than argued about: the confirmation is reserved immediately after the
  > test with nothing between them, every caller-controlled read is taken into a local first, and a
  > refusal releases the reservation. Measured, not reasoned — the counterexample build answers
  > `['installed', 'installed']` and every other test in the file stays green against it.

---

## 9. The confirmation round

`docs/reviews/phase-2c-5-4b-confirmation.md` reviewed §8's fix round and found **three High and
nothing else**: original finding 1 partially closed, finding 2 still open, and one **new** defect
that §8.4 had adjudicated as safe and got wrong. Findings 3, 4 and 5 are confirmed closed. All three
Highs are closed here. **No Rust changed, no file was created, no module was added, and no `.svelte`
file changed**, so the bilingual reading 2c-5-6 owes is still neither invalidated nor brought
forward.

> **Corrected by §10.** "All three Highs are closed here" is **false as written**. H1 and H3 are
> closed and were confirmed so by the second confirmation review. H2 was **not**: the exception §9.2's
> fourth bullet describes — `targetRevisionObserved` taking the authorization out and putting it back
> — closed the spend and opened a second hole with the same operation, because
> **removing a token to protect it creates a false "nothing here" state for every other producer that
> tests for presence**, and `prepareRestore` is such a producer. §10 is the round that closed it, and
> every claim in §9.2's fourth bullet and in §9.4's conclusion is superseded there.

Every claim below was checked against the code, and each of the three was **verified against a
counterexample build** — the defect reinstated, the suite run, the case observed failing and every
other case observed passing. A regression test that has never been seen to fail is a regression test
nobody has read.

### 9.1 H1 — the permit could bind one base revision and submit another

§8.1 moved the permit's construction into `prepareRestore`, which closed everything on the far side
of the spend. What it did not close is that `prepareRestore` read the base revision **twice, from two
places**: `RestorePermit.baseRevision` from `session.baseRevision` and
`RestorePermit.submission.baseRevision` from `submissionOf(preview.draft)`. Nothing required the two
to agree; `permitHolds` rechecks only the first and `sendRestore` sent only the second. So a
confirmation could bind revision A, pass every check against a window projecting A, and hand the
transaction revision B — and if the disk had moved to B, the locked write succeeds against a base
revision **nobody was asked about**. §8.1's own closing paragraph conceded that the snapshot could be
internally inconsistent, and that concession is exactly what the phase's binding forbids.

Three changes, in order of strength:

1. **one local**. `const baseRevision = session.baseRevision` is read once and fills both fields, so
   the two representations cannot differ by construction;
2. **a refusal, not a repair**. Where `submissionOf(preview.draft).baseRevision` disagrees with it,
   `prepareRestore` answers its argument unchanged and asks no question at all. That state is
   unreachable through this module's own transitions — `startDraft`, `retargetedDraft` and
   `savedDraft` all move the draft's base and the session's together — so this is a guard against a
   caller assembling a session by hand, and the cost of it firing is one control that does nothing
   rather than a write against an unbound revision;
3. **the checked field is the sent field**. `sendRestore` hands the sender `permit.baseRevision`, the
   field `permitHolds` compares, rather than the submission's copy of it. With (1) the two are equal;
   with (3) they are the same expression.

The entry identity is now read through one `preview.entry.id` local as well, for the same reason.

**What is still not atomic, and it is one pairing**: `preview.revision` and `preview.draft.value` are
two different properties, the first a hash of the second. A getter answering inconsistently makes the
permit record a hash that does not describe its bytes, and **nothing on this side of the wire can
detect it** — there is no hash function here, and `permitHolds` can only compare each against the
live preview. What the person is shown and what is sent is the *value*, from one property; the hash
is a binding token that never reaches the wire. Every other value `prepareRestore` freezes is read
exactly once.

**The regression** is `is refused when the draft and the session disagree about the base revision` in
`restore.test.ts`. It makes the two disagree **during** `prepareRestore` — a draft whose base is
`ELSEWHERE` on a session whose base is `BASE` — and asserts that no question is asked, with a control
walking the same path in agreement and getting one. Against the counterexample build it does not just
fail: an instrumented run of it showed the sender being handed `ELSEWHERE` for a question that bound
`BASE`.

### 9.2 H2 — withdrawal was still re-entrantly spendable, and one path was omitted

§8.2's claim that every withdrawal revokes first was false three times over.

**The revocation helper was itself the property read.** `revokeConfirmation` opened with
`session.pending`, because that was the map's key — so a getter installed there could call
`confirmRestore` on the retained session, move the authorization out of `PENDING_AUTHORIZATIONS` and
into `PERMITS`, and leave the outer deletion with nothing to revoke and a live permit it cannot
reach. Being the first *statement* of a transition bought nothing when the first *operation* inside
it was caller code.

**`reloadTheDiskVersion` was not in the list at all**, and it is a withdrawal: its successful path
clears `pending` through `measuredAgainst`, after `conflictOf(session)`, `session.reload`, the
arbitrary `adopt` callback, a spread of the session and `conflict.diskRevision`. Its other two arms
did not clear it at all.

**And seven transitions read `session.phase` before reaching `withdrawn`.** `loadingBatches`,
`chooseBatch`, `loadingEntries`, `chooseEntry`, `candidateRead`, `candidateRefused` and
`targetRevisionObserved` all consult `frozen(session)` first. §8.2 did not see them because it was
written against `withdrawn` rather than against `withdrawn`'s callers — **the same sweep failure this
phase has now committed in three consecutive rounds**, and the reason the new tests trap *every* own
field of the session rather than the field the last finding named.

**The fix is the review's: re-key the authorization by the session itself.**
`PENDING_AUTHORIZATIONS` is now `WeakMap<RestoreSession, RestorePermit>`, registered by
`prepareRestore` under the session it returns. A revocation is `PENDING_AUTHORIZATIONS.delete(session)`
— a bare reference operation that reads no property and runs no user code — so it can genuinely
precede everything. `confirmRestore` looks the session up as its **first** operation and no longer
reads `session.pending` at all; a spread or a `structuredClone` of an asked session now authorizes
nothing, which is stricter than what it replaced.

Four consequences, each of which is a decision rather than a detail:

- **`reloadTheDiskVersion` revokes unconditionally, first.** A question cannot be pending while a
  conflict is on screen — `restoreRefusal` refuses `conflictShowing` — and that control is drawn only
  on a conflict, so over-revoking costs nothing reachable and the claim becomes one about the
  function rather than about which arm a screen can reach.
- **`acknowledgeRestoreFindings` revokes unconditionally, first.** §8.2 placed it after the state and
  consent calculation so that "a call which records nothing takes nothing back"; every one of those
  reads is caller-controlled. Taking a question back too often costs one question asked again; taking
  it back too late costs a whole-file replacement nobody was asked about.
- **Six of the seven `frozen()` callers revoke before that guard** — `loadingBatches`,
  `chooseBatch`, `loadingEntries`, `chooseEntry`, `candidateRead` and `candidateRefused` — and their
  unchanged arms answer through `withNothingPending`, so a revocation never leaves a question drawn
  on screen that authorizes nothing. In every reachable frozen state `pending` is already `null`, so
  those arms still answer their own argument **by reference** and the "nothing changes until the file
  answers" cases still hold by identity.
- **`targetRevisionObserved` is the seventh, and it is the exception rather than a compromise.**
  `RestorePane.svelte`
  runs it from an `$effect` on every change to the session, so an unconditional revocation would take
  the question back in the same tick it was asked. It **takes** the authorization out before reading
  anything and **puts it back** only on the arm where nothing moved: between the two there is nothing
  for a re-entrant caller to spend, the idle arm still answers its argument by reference, and the
  effect still converges.

  > **This bullet's last sentence is false, and §10 is the round that closed it.** The `$effect`
  > justification is sound as an argument against *unconditional revocation*; it does not make
  > **temporary absence** safe. "Nothing for a re-entrant caller to spend" is true only of spending.
  > `prepareRestore` does not spend — it **produces**, and it reads absence from
  > `PENDING_AUTHORIZATIONS` as permission to register another question. A getter on `session.phase`
  > reached by this transition's own `frozen()` call could therefore build a successor session, file a
  > second live authorization under it, and be retained; the outer call then put the first permit
  > back, and **both sessions could confirm and both permits could send**. The exception is now a
  > **suspension** rather than a removal, described in §10.1.

**A transition that keeps the question now moves it**, through `carryTheQuestion` — a checked
deletion from the old key followed by a set on the new one, both bare operations, with the successor
built at the call site *before* the helper is entered so that a re-entrant confirmation during the
spread leaves nothing to carry rather than a second live authorization. Six transitions carry:
`batchesLoaded`, `entriesLoaded`, `restoreCouldNotBeSent`, `dismissRestoreOutcome`,
`askToReloadDiskVersion` and `confirmDiskReload`. Without it, keying by the session would have
stranded a question on the object a caller had just replaced — a control drawn on screen that does
nothing. That is the **safe** direction, and it is still a defect.

**The evidence is three groups.** The sequential group gains a twelfth row for
`reloadTheDiskVersion`. A new **re-entrant** group runs the same twelve transitions over a session
every own field of which is a getter that answers the question once — so whichever field a transition
touches first is the opening, and the case cannot go stale by having been written against the last
finding's wording. A new case drives the **callback** half, where no getter can stand in: the `adopt`
function takes the conflict off the session and then confirms. And a new twenty-three-row table
drives every exported transition and asserts the biconditional *a session presents a question exactly
when it still authorizes one*, which is the obligation `carryTheQuestion` and `revokeConfirmation`
create and no type expresses.

Verified against four counterexample builds applied together — the revocation moved back after
`frozen()` in `loadingBatches`, after the `session.pending` read in `cancelRestore`, after the
consent calculation in `acknowledgeRestoreFindings`, and out of `reloadTheDiskVersion` altogether.
Six cases fail: four re-entrant ones, the callback one, and the new sequential row for the omitted
transition. **The eleven pre-existing sequential cases stay green**, which is the point: they never
could have found this.

### 9.3 H3 — one confirmation could install two documents

`BrowserState.adoptDiskVersion` tested `spentConfirmations.has(confirmation)` and added to the set
some twenty lines later, with `conflict.source` and `adoption.disk.id` — both caller-controlled —
read in between. §8.4 recorded the shape and adjudicated its consequence closed by the later revision
and generation checks. **That adjudication is unsound**, and its error is one word: the projection
generations are **per document**.

The exploit is one `ConflictModel` with alternating getters over two conflicts this state has
remembered. The outer call snapshots document A; at the `conflict.source` read it re-enters exposing
document B; the inner call finds the confirmation unspent, adds it, installs B and bumps **B's**
generation; the outer call, already past its `has`, resumes with A, finds A's generation untouched,
adds the same confirmation again and installs A. One person's answer, two projection replacements and
two selection repairs.

The fix is the review's first option. Both caller-controlled reads are taken into locals before the
membership test; the reservation is `spentConfirmations.add` **immediately** after
`spentConfirmations.has`, with nothing between them; and each of the three refusals that can follow
releases the reservation, so a refusal still spends nothing and the control stays pressable. Only a
call that made the reservation can release one — the arm that finds the confirmation already reserved
returns *above* the reservation — so the release is not the second half of the defect it closes.
Everything after the reservation reads this state's own data until the install itself, by which time
the confirmation is gone.

The regression is `installs one document from one confirmation, whatever its getters alternate
between` in `workspace.test.ts`. Against the counterexample build it answers `['installed',
'installed']`; every other case in that file passes against the same build, which is what makes it
worth adding.

### 9.4 What the sweep found beyond the three

`restore.ts`, `workspace.svelte.ts` and `invalidation.ts` were swept for the **shape** — a consuming
operation whose result is discarded, and a check and a spend separated by any property read — rather
than for the wording of any of the three findings. `src/lib` was then swept for every `.delete(` in
production code — eight call sites across four files — and each was classified as an authorization
whose result is read, or a release that authorizes nothing.

- **`revokeConfirmation`** discards its deletion, deliberately. Nothing is minted from a revocation,
  so there is nothing for a re-entrant caller to spend twice.
- **`spentConfirmations.delete`** in the release above discards its result for the same reason, and
  can only ever release a reservation the same call made.
- **`SEALS.delete(sealed)`** in `openWholeDocumentSave` discards its result, and is **sound**: the
  only operations between `SEALS.get` and it are a strict comparison against `undefined` and a return
  branch, neither of which runs caller code. Left untouched, with §8.4's entry corrected to say that
  it is safe because nothing caller-controlled sits between the two lines — and therefore that adding
  anything there re-opens it.
- **`listeners.delete`** in `src/lib/stores/locale.svelte.ts` is an unsubscribe. It authorizes
  nothing.

Everything that *does* authorize reads its result: `takeTheQuestion`, `confirmRestore`'s spend, and
both of `sendRestore`'s. `prepareRestore`'s `has` is a refusal guard rather than a spend, and the
`set` that follows it is under a key built in that call — so two concurrent prepares register two
questions rather than two authorizations for one, which is `asking again is asking again` and not a
hole. `projectionGenerationOf`/`invalidateProjectionOf` and `nextRereadOf` are read-modify-writes on
plain `Map`s with primitive keys and run no user code between the halves.

> **This conclusion is incomplete, and §10 says how.** Every line above is true of the operations it
> names, and the sweep still missed the defect — because it classified each operation **on its own**
> and the defect is an **interaction between three**: `takeTheQuestion` removes an entry,
> `putTheQuestionBack` restores it, and `prepareRestore`'s `has` runs in between and reads the gap as
> permission to produce a second question. Reading "`prepareRestore`'s `has` is a refusal guard rather
> than a spend" as *therefore harmless* is the error: a guard that answers wrongly does not spend
> anything, it **mints**. A sweep for consuming operations cannot find that; the sweep that finds it
> asks, of every state a value can be in mid-call, **which other producer can observe it**.

One further instance of the shape is recorded rather than changed, because it **cannot be closed from
the current interface** — never "unclosable" flat, which would be a wider claim than the evidence
supports. `prepareRestore` reads `preview.revision` and `preview.draft.value` separately, they are
separate caller-controlled properties of one `BackupTextResponse`-derived value, and no code on this
side of the wire can check that a hash describes bytes: there is no hash function in the frontend.
§9.1 states what that does and does not put at risk.

**Two constructions would bind the pair**, and both are outside this step's boundary rather than
outside reach — the second confirmation review named them:

1. **compute the content revision from the captured text in the frontend** and refuse registration
   when it disagrees with the supplied one; or
2. **have the IPC adapter produce an opaque, branded candidate snapshot** retained in a private
   registry, so `candidateRead` accepts only the exact backend-produced tuple rather than
   independently readable structural properties.

Either changes code or the wire contract beyond `prepareRestore`'s ordering, which is why neither was
taken here. **And the gap does not currently permit substituted bytes to be sent**, which the same
review confirms: the permit carries the **captured bytes**, and `permitHolds` compares those bytes
against the live preview before anything reaches the sender. What the frontend cannot do is
independently prove that the backend-supplied hash describes them.

---

## 10. The second confirmation round

`docs/reviews/phase-2c-5-4b-confirmation-2.md` reviewed §9's round and found **one High and one Low**.
H1 and H3 are confirmed closed, and so is every ordinary revocation path of H2 — `revokeConfirmation`
really is a bare reference operation, the eleven revoke-first transitions really do revoke before any
caller read, and the six carrying transitions really are the six. **The High is the one exception §9.2
argued for**, and it is the fourth consecutive round on one shape: *a check and a spend separated by
any property read are not atomic*, and *a consuming operation whose result is discarded*. **Each round
closed one instance and created or left a narrower one, and this round's defect was created by the
previous round's fix.**

Only `restore.ts` and `restore.test.ts` changed. **No Rust, no new file, no new module, no `.svelte`
file** — so the bilingual reading 2c-5-6 owes is still neither invalidated nor brought forward.

### 10.1 The High — temporary absence is a licence to produce, not only a barrier to spending

§9.2's exception took the authorization **out** of `PENDING_AUTHORIZATIONS` while
`targetRevisionObserved` read three caller-controlled properties, and put it back when the revision
had not moved. The spend half of that is sound and is preserved: while the entry is held locally, no
re-entrant call can *confirm* it. The half §9.2 did not see is that **absence is not neutral** —
`prepareRestore` tests presence, and presence is the only thing standing between one question and two:

1. `S` is the asked session holding permit `P1`;
2. `targetRevisionObserved(S, BASE)` removes `P1`;
3. a getter on `S.phase` — reached by this transition's own `frozen()` — calls `prepareRestore(S, …)`;
4. `prepareRestore` sees `has(S) === false`, builds successor `S2` and registers `P2` under it;
5. the getter retains `S2` and answers the ordinary phase;
6. the outer call finds the revision unmoved and puts `P1` back under `S`;
7. **`confirmRestore(S, …)` and `confirmRestore(S2, …)` both mint, and both permits send.**

**The fix is the review's: suspend, never remove.** `SuspendedQuestion` is a module-private cell — a
plain `{ permit }` object registered in a private `WeakSet` — that **replaces** the permit under the
same key for the length of one call. Four rules make it a question to every producer and a permit to
none:

- **`confirmRestore` rejects it.** `isSuspended` is a `WeakSet` membership test, so the refusal reads
  no property and runs no user code.
- **`prepareRestore` regards it as an existing question.** No code changed there: the cell is
  *present*, so the bare `has` that was already the guard answers `true`. That is the whole argument
  for suspending rather than removing — the producer needs no new rule.
- **`takeTheQuestion` refuses it**, so `carryTheQuestion` cannot move a suspended question to a
  successor. Another call holds that permit and will put it back under the session it is on; moving it
  would leave one question live on two objects, which is the defect wearing a different hat. The
  successor therefore presents nothing — the conservative direction — and the question stays on the
  session the person is looking at.
- **The put-back is identity-checked**, and it happens in a `finally`. If a re-entrant withdrawal
  deleted the cell, that is a decision and it stands: `restoreTheQuestion` finds something other than
  its own cell and **puts nothing back**. The `finally` is what stops a throwing getter stranding a
  session suspended, where it could be neither confirmed nor asked again.

**And the presentation still follows the authorization.** `unchangedByInspection` is the one line that
costs: an inspection that changed nothing answers its argument **by reference** — which is what makes
`RestorePane.svelte`'s `$effect` converge, and is the Low's whole point — unless a getter it ran
withdrew the question, in which case it answers a copy presenting none. The map is consulted rather
than `session.pending`, because the map is the authority and asking it reads no property.

> **Corrected by §11.** As shipped at §10 that paragraph was true only of an inspection that **owns**
> a suspension. `unchangedByInspection` did not consult the map at all when its `suspension` argument
> was `undefined` — it returned the argument by reference on that branch — and `undefined` is what a
> **nested** inspection gets, because `suspendTheQuestion` leaves ownership with the outer call. A
> getter reached by such a nested call can withdraw the *outer* cell, and the nested call then handed
> back a session presenting a question the map no longer held. §11 is the round that closed it. The
> claim now holds of both branches, and it is qualified where it needs to be: while an outer
> suspension is present the argument still comes back by reference, which is presentation following an
> authorization that is **held**, not spendable — the window §10.3 item 7 describes, and it contains
> no `await`.

### 10.2 The Low — a stale response withdrew an unrelated question

§9's round made `candidateRead` revoke before its seven caller-controlled reads, which closed the
re-entrant spend and cost this: a read for entry **B** still in flight, landing after the person has
loaded entry **A** and been asked about it, destroyed A's question on the way to being **rejected as
irrelevant**. The transition's own documentation still said such a response returns *"the same
session"*, and the existing mismatch cases all start with no candidate and no question, so nothing saw
it. Safe in the write direction, and a third deliberate over-revocation beyond the two §9.2 records.

The same suspension closes it for free. `candidateRead` suspends across the validation, and the two
refusal arms answer the session unchanged — **the same authorization, not merely the same fields**.
Only the arm that actually replaces the candidate withdraws, and it withdraws because the candidate
moved. `withNothingPending` is no longer reached from either refusal arm.

### 10.3 The sweep against this fix, and what a suspension itself could expose

Run against the **shape** and against the new mechanism, not against the wording of the finding just
closed.

**The access sites are enumerated rather than counted**, and that replaces this section's original
sentence — *"every entry of `PENDING_AUTHORIZATIONS` is now read by exactly eight operations"* — which
was wrong. `restore.ts` has **fourteen** `PENDING_AUTHORIZATIONS` call sites across the eight
functions below, and whether a checked `get`/`delete` pair is one logical operation or two is a matter
of reading — so the number decided nothing and could only rot. The list is the claim:

| Access site | What it does with the union value |
|---|---|
| `suspendTheQuestion` | `get`, then rejects `undefined` and narrows with `isSuspended`; it stores a private cell only over a real permit, and answers `undefined` otherwise. |
| `restoreTheQuestion` | `get`, compared against the **exact** cell this call owns; `permit` is read only off that typed private cell. |
| `unchangedByInspection` | Returns no union value at all. `has` on the branch where this call owns no cell, `get` compared against its own cell on the branch where it does — the shape §11 corrected. |
| `revokeConfirmation` | `delete`, **indifferent by design**: revoking a suspended question is the intended withdrawal, and its discarded result authorizes nothing. |
| `takeTheQuestion` | `get`, an explicit suspension rejection, then a **checked** `delete`; its return type is `RestorePermit \| undefined`, so nothing else can receive a cell. |
| `carryTheQuestion` | `set` only, of a value `takeTheQuestion` has already narrowed, so a suspension cannot reach a second key through it. |
| `prepareRestore` | `has`, **indifferent by design**: a suspension must count as an existing question. Its `set` files a newly built permit under the newly built session it returns. |
| `confirmRestore` | `get`, rejects `undefined` and narrows with `isSuspended` before any permit field is read or handed to `PERMITS`; its later `delete` is checked. |

Seven things a suspension itself could expose were then asked of those sites:

1. **It could be mistaken for a permit.** The map's value type is a union now, so every site that
   needs a permit must narrow — `confirmRestore` and `takeTheQuestion` do it explicitly, and
   `revokeConfirmation`'s `delete` and `prepareRestore`'s `has` are indifferent **by design**: a
   withdrawal should revoke a suspended question, and a producer should see one.
2. **It could strand a session** — neither confirmable nor askable — if a call suspended and never
   restored. The `finally` covers a throwing getter, which is the only way out of those two functions
   that is not a return.
3. **It could resurrect a withdrawn question.** The identity check is the answer, and it has a test.
4. **It could be carried to a second session**, giving one question two homes. `takeTheQuestion`
   refuses it, and that has a test whose counterexample build fails nothing else.
5. **It could be forged or reached by a caller.** The type is module-private, the `WeakSet` is
   module-private, and no instance is returned from an exported function or attached to a session.
6. **It could be double-owned.** `suspendTheQuestion` answers `undefined` when the question is already
   suspended, so the outer call stays the one owner; a nested transition that withdraws still deletes
   the cell, and that decision reaches the outer call as "not mine any more".
7. **It refuses a legitimate confirmation while it is held.** True, and the window contains **no
   `await`** — no person's click can land inside it. Only a re-entrant call from a getter can, and
   that is not somebody pressing a button.

`carryTheQuestion`'s `set` receives a value the return type of `takeTheQuestion` has already narrowed
to a permit, so a suspension cannot reach a second key. `confirmRestore`'s checked `delete` can only
ever remove what its own `get` saw or nothing: a nested suspension completes synchronously — suspend
and restore, or suspend and revoke — before the outer call resumes, and a nested throw means the outer
call never reaches the deletion.

> **Corrected by §11: item 6 stopped one step short.** *"A nested transition that withdraws still
> deletes the cell, and that decision reaches the outer call as 'not mine any more'"* is true of the
> **outer** call and says nothing about what the **nested** one answers. A nested inspection is
> handed `undefined` by `suspendTheQuestion` — that is item 6's own rule working — and
> `unchangedByInspection` treated `undefined` as licence to return the argument by reference without
> asking the map anything. So the sequence *outer inspection suspends → its first property read runs a
> nested inspection → a getter reached by the nested call revokes → the nested call returns* handed a
> retained session presenting a question the map no longer held. The outer call was correct
> throughout, which is why item 6 read as complete: the defect is entirely in what the nested call
> **answered**, and it is presentation-only — the withdrawal wins, nothing is spendable, no write can
> be issued. It is still a session drawing a confirmation control that does nothing, which is the one
> direction this module's biconditional may not fail in. §11 closes it by making that branch test bare
> presence.

### 10.4 The evidence

Nine cases in `restore.test.ts`, in one new suite named for the property rather than for the finding:
*a question being inspected is held, never absent*. Its fixture traps **one named property** — the one
the transition under test reads first — and runs the case's own body from inside that read, so what a
producer sees mid-call is the thing being asserted about.

- `prepareRestore` re-entered from inside `targetRevisionObserved` builds **no** successor, and the
  retained answer plus the original issue **one** replacement between them;
- `carryTheQuestion` re-entered from the same place carries nothing, and the successor authorizes
  nothing;
- a re-entrant `cancelRestore` is **not** undone, and what comes back presents no question;
- three parameterized cases for the Low — a response about another document, another entry, another
  batch — each asserting the **same session by reference**, a question still pending, and a send that
  hands the sender the original candidate's exact bytes;
- `prepareRestore` re-entered from inside `candidateRead` builds no successor;
- a re-entrant `cancelRestore` during a candidate response is not undone;
- a confirmation attempted **while suspended** answers `null`, and the question is confirmable
  immediately afterwards — which is what separates a suspension from the withdrawal it must not be.

**Verified against five counterexample builds**, each applied alone, the suite run, the failures read
and every other case observed passing:

| Counterexample | Cases that failed |
|---|---|
| **A** — the reviewed defect: suspension `delete`s and the put-back is unconditional | 9 (the two `prepareRestore` re-entry cases, both "not put back" cases, all three Low cases, **and two pre-existing** withdrawal rows) |
| **B** — `takeTheQuestion` unwraps a suspension | 1, the carry case, and nothing else |
| **C** — the put-back is not identity-checked | 4 (both "not put back" cases and two pre-existing withdrawal rows) |
| **D** — `confirmRestore` unwraps a suspension | 3 (the suspended-confirmation case and two pre-existing re-entrant rows) |
| **E** — `candidateRead` revokes first, as §9 shipped it | 5 (all three Low cases, the `candidateRead` re-entry case and the suspended-confirmation case) |

Every new case failed against at least one build, and **B is the reason the carry rule is written
down**: no other case in the file, new or old, notices when a suspension can be carried away.

### 10.5 The gates

| Gate | After the confirmation round | After this round | Arithmetic |
|---|---|---|---|
| `cargo test --workspace` | 1153 | **1153** | no Rust file changed |
| `npm run check` files | 431 | **431** | no file added |
| `npm test` | 2113 | **2122** | +9, the suite above; no lint-suite case moves because no file is added under `src/` |
| `npm run build` modules | 184 | **184** | no module added; `SuspendedQuestion` lives in `restore.ts` |

The discriminating bundle oracle, both lines read:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # → no match (ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    # → 2 (PRESENT)
```

## 11. The third confirmation round

`docs/reviews/phase-2c-5-4b-confirmation-3.md` reviewed §10's round and found **no High and no
Medium**. H1, H2 and H3 are confirmed closed — the suspension mechanism, its unforgeable `WeakSet`
discrimination, the identity-checked put-back, the eleven revoke-first transitions, the six carrying
ones, `takeTheQuestion`'s suspension rejection, `prepareRestore`'s deliberate `has` indifference,
`adoptDiskVersion`'s contiguous `has`/`add` and its three owned releases — and §10.2's Low is
confirmed closed with it. **One Low**, plus two claims in this record that were broader than the code.
**No Rust changed, no file was created, no module was added, and no `.svelte` file changed**, so the
bilingual reading 2c-5-6 owes is still neither invalidated nor brought forward.

### 11.1 The Low — `undefined` is not a licence to answer by reference

`unchangedByInspection` took `suspension === undefined` as sufficient reason to return its argument
**by reference**, without consulting `PENDING_AUTHORIZATIONS` at all. That is sound in the ordinary
no-question case, and it is sound while an outer suspension is still present. It is not sound for a
**nested** inspection, and `undefined` is exactly what a nested one gets:

1. `S` presents a live question and holds permit `P`;
2. an outer `candidateRead(S, …)` replaces `P` with its suspension cell `C`;
3. its first read — `S.entry` — runs a getter that calls and **retains** `targetRevisionObserved(S, null)`;
4. the nested `suspendTheQuestion(S)` sees `C` and answers `undefined`, correctly leaving the cell
   with the outer call — §10.3 item 6 working as written;
5. the nested call's own first read — `S.phase`, through `frozen()` — runs a getter that calls
   `cancelRestore(S)`, which deletes `C`;
6. the nested call reaches `unchangedByInspection(S, undefined)`, the first disjunct is true, and it
   answers `S` **by reference** although the map is now empty;
7. the getter retains that answer. It has `pending !== null` and `confirmRestore` on it returns `null`.

**It cannot issue an unauthorized write.** The withdrawal wins, the authorization stays gone, and the
outer call — which does own a cell — correctly detects that `C` went and answers a copy presenting
none. What it breaks is the biconditional in the other direction: a retained session drawing a
confirmation control that does nothing. That is presentation-only and it is still the one direction
this module may not fail in, because the person is looking at a button.

**The fix is the review's, and it is one branch.** `undefined` no longer bypasses the authority; it
selects a **different question to ask it**:

- this call owns a cell → the check is identity, `get(session) === suspension`, exactly as before;
- this call owns none → the check is bare **presence**, `has(session)`.

Presence rather than identity is deliberate. The one thing that can be present and not this call's is
an **outer** call's suspension, and that is precisely the thing that must still count as a question:
the outer call's own `finally` and its own `unchangedByInspection` decide what becomes of it, and a
nested call correcting that would be answering a question it does not hold.

**`has` is not a new opening, and the sweep asked that directly.** `WeakMap.prototype.has` on an
object key runs no user code and reads no property, so no producer can observe it or interleave with
it. It is not half of a check-and-spend pair either — this phase's recurring shape — because nothing
is minted or consumed on its answer: both outcomes leave the map untouched, and the choice is only
between returning the argument and returning a copy with `pending: null`.

**What `has === true` can mean on that branch was enumerated rather than assumed.** On entry the map
held either nothing or an outer suspension, since a permit would have been suspended and the argument
would not be `undefined`. During the inspection the only writes that could file something under *this
same session object* are `restoreTheQuestion` — reachable only from an outer `finally`, which cannot
run while the nested call is still inside it — and `suspendTheQuestion`, which only ever replaces a
permit and there is none. `prepareRestore` files under the newly built session it returns, and all six
`carryTheQuestion` callers build `to` as a fresh object literal at the call site. So `has === true`
means an outer cell, and the by-reference answer is the correct one.

**One behaviour changes beyond the defect, and it is the biconditional applied.** A session presenting
a `pending` the map does not hold — a hand-built spread, or one retained across a withdrawal — now
comes back from an inspection as a cleared copy rather than by reference. `RestorePane.svelte`'s
`$effect` still converges: the cleared copy is a fixed point by reference, so this costs one extra
step and never a loop. Every identity assertion in the freeze group still holds, because in each
reachable frozen state `pending` is already `null` — which is §9.2's fourth bullet, unchanged.

### 11.2 The two record corrections

Both are marked where the false sentence stands rather than only here, because a record is read from
the section somebody lands in:

- **§10.1** claimed *"the presentation still follows the authorization"* without qualification. It was
  true only of an inspection that **owns** a suspension. The correction block there names the nested
  branch and keeps the one qualification that survives the fix: while an outer suspension is present
  the argument comes back by reference, which is presentation following an authorization that is
  *held* rather than spendable — the window §10.3 item 7 already described, and it contains no `await`.
- **§10.3** claimed *"exactly eight operations"* read the map. That is wrong: `restore.ts` has fourteen
  `PENDING_AUTHORIZATIONS` call sites across eight functions, and whether a checked `get`/`delete` pair
  counts as one logical operation or two is a matter of reading. **The count is replaced by the
  access-site table**, one row per function with its narrowing or its deliberate indifference; a table
  can be checked against the code and a number cannot. §10.3's item 6 also gained a correction block:
  it described what a nested withdrawal means to the **outer** call and said nothing about what the
  nested call answers, which is where the whole Low lived.

### 11.3 The evidence

One case, in the suite §10.4 built — *a question being inspected is held, never absent* — and it uses
that suite's own `whenFirstRead` fixture twice, on the two properties the two inspections read first.
The outer trap is on `entry`, where `candidateRead` starts, and it runs the nested
`targetRevisionObserved(asked, null)`; the nested trap is on `phase`, where `frozen()` reads, and it
cancels. Both arms decided nothing on their own — the response is about another entry and the
observation is `null` — so what is asserted is only what each inspection **handed back**.

The assertion is the biconditional over every retained result: a session presents a question exactly
when it still authorizes one. Both traps are asserted to have fired, the withdrawal is asserted to
stand on the asked session, and the whole retained set is driven through `confirmAndSend` to **zero**
replacements.

**Verified against a counterexample build** — the `suspension === undefined ||` short-circuit
restored, alone. The whole frontend suite ran: **exactly one case failed, the new one**, and the other
2122 passed, including every case in `RestorePane.test.ts`. That is the discrimination a regression
owes: no other case in the tree, new or old, notices this branch.

### 11.4 The gates

| Gate | After the second confirmation round | After this round | Arithmetic |
|---|---|---|---|
| `cargo test --workspace` | 1153 | **1153** | no Rust file changed |
| `npm run check` files | 431 | **431** | no file added |
| `npm test` | 2122 | **2123** | +1, the case above; no lint-suite case moves because no file is added under `src/` |
| `npm run build` modules | 184 | **184** | no module added; the change is one branch inside `restore.ts` |

The discriminating bundle oracle, both lines read:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # → no match (ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    # → 2 (PRESENT)
```

## 12. The fourth confirmation round

The review is `docs/reviews/phase-2c-5-4b-confirmation-4.md`. It found **no High and no Medium**,
confirmed §11's Low closed, adjudicated the fix round's own sweep sound, and verified the one
behaviour change it carried — a cleared copy where a reference was returned before — against
`RestorePane.svelte`'s `$effect` convergence and against the reachable frozen states.

It found **one Low, in a JSDoc comment**, and that is this project's worst defect class rather than
a cosmetic one: the new contract on `withNothingPending` said **"call it only after
`revokeConfirmation`"**, and `carryTheQuestion` does not satisfy it. `takeTheQuestion` refuses to
take a suspension and answers `undefined`; `carryTheQuestion` then calls `withNothingPending(to)`
with **no revocation having occurred** and the outer inspection's cell still in place. The runtime
behaviour was already safe — `to` is a fresh successor and no authorization was ever filed under its
key — so nothing executable could have failed. What was wrong was the stated contract, which a
maintainer could have followed into assuming every call site follows a revocation.

The comment now states the **actual** precondition — *no authorization is reachable under the key
this session will be presented as* — and describes the three call families that establish it by
three different routes: the revoke-first transitions and their frozen branches have removed the
entry; `unchangedByInspection` has established that the map holds nothing this call may present;
and `carryTheQuestion` passes a fresh successor after finding nothing transferable. **They are
deliberately not numbered.** The superseded "third caller" wording counted them, the count was
already wrong when it was written because several revoke-first frozen branches also call the helper,
and §10.3's "exactly eight operations" had to be replaced by an access-site table one round earlier
for the same reason. A count is the kind of claim that rots as callers are added; an enumeration
without a total does not.

No code changed in this round. The gates are unmoved from §11: **1153 / 431 / 2123 / 184**, with the
bundle oracle's server-only line absent and its client-only line at 2.
