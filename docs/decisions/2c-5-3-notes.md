# Phase 2c-5-3 — restore as browser values, with nothing drawn

**One new model, two shared additions, and no component touched.** `src/lib/browser/restore.ts`
is restore as a value, exactly as `rawEditor.ts` is for the raw editor and `matchMove.ts` is for a
move; `restore.test.ts` drives it. This is the project's established value-before-choice cut: the
model exists and is tested before anything draws it, so every rule below is a rule a test can
reach rather than a rule written into markup that one renderer carries alone (2c-3c-3's Medium).

The consult is `docs/reviews/phase-2c-5-design.md`; **Q4** is this step's specification, **Q5** is
the screen 2c-5-4 draws over it, **Q6** is what restore may never claim, **Q7 item 3** is the
evidence this step owes and **Q8** is the single binding instruction. Steps 1 and 2 are
`crates/espansoconfig-core/src/persist/backup.rs`'s read side and the three read-only commands;
their reviews are `docs/reviews/phase-2c-5-{1,2}-code.md` and their confirmations are
`phase-2c-5-{1,2}-confirmation.md`.

**No mounted test and no window reading are owed by this step, and neither was taken.** No
`.svelte` file changed.

---

## 1. What this step built

- **`src/lib/browser/restore.ts`** — the catalogue, the retained candidate, the coordinator's
  `OpenWriteSurface` value, the confirmation, the two private runtime memberships that make one
  answered question authorize at most one write (§2.2a), the sender, the answer, the conflict
  transitions and the view.
- **`src/lib/browser/restore.test.ts`** — 141 cases over the ten groups its header names.
- **`src/lib/browser/saveOutcome.ts`** — two additions, §2.6 and §2.7: a third
  `ConflictReloadOutcome` arm with its `SaveOutcomeMessage`, and a seventh `ConflictOperation`
  member. `reloadWarningFor` became a `switch`.
- **`src/lib/browser/saveOutcome.test.ts`** — the `satisfies Record<ConflictOperation, true>`
  entry the new member forced, the new message in `MESSAGES`, and one case extended to drive the
  third reload arm and assert that the other three sentences do **not** reach it.
- **`src/lib/i18n/{en,es}.json`** — fourteen keys: twelve `browser.restore.refused.*` and the two
  shared ones §2.6 and §2.7 added.

**Two defects in this step's own first draft were found by checking the record against the code
before it was written down**, and both are recorded where they were fixed rather than smoothed
over: the header claimed a guarantee `confirmRestore`'s export contradicted (§2.2), and
`RestoreRefusal` carried a `targetMoved` code **no function produced** while the doc comment above
`restoreRefusal` described a check it did not make (§2.12).

**A third was not, and the code review found it: the confirmed value was reusable** (§2.2's fix
round, and `docs/reviews/phase-2c-5-3-code.md` H1). Six findings came back — one High, three
Medium, two Low — and §§2.2, 2.14, 2.15, 2.5a, 2.8 and 2.11 are what closed them.

**No accessor was added to `src/lib/i18n/index.ts`, deliberately** — §2.9.

---

## 2. The decisions

### 2.1 D1 — the candidate is read once, retained byte-exact, and never re-read

Consult Q1 and Q8. `RestorePreview` holds the string that arrived from `read_backup_text` and
`RestorePreview.revision` is **the wire's hash of exactly those bytes**, never a base revision for
the destination. `sendRestore` reads the text off the permit the confirmation minted — not off the
session a caller hands back — and refuses to spend that permit unless the live session still holds
the same entry, the same hash **and the same bytes**. A preview of entry A followed by a write of
entry B is therefore a state this module refuses rather than one it cannot represent: the review's
H1 was that the first draft made the claim without the recheck (§2.2).

`candidateRead` refuses a response that is not about **this session's destination, this session's
entry and that entry's batch** — three checks, each of them a way the shown candidate and the sent
candidate could come apart. `read_backup_text` already verifies that the entry maps to the document
it was given; this is the frontend half of the same question and not a second opinion about the
filesystem.

**The candidate is a plain `string` and not `RoundTripText`.** That brand belongs to the raw
editor, which refuses a carriage return because a `<textarea>`'s API value has every line break
normalized to LF. A restore candidate never enters an input control — consult Q5 draws it through
`SourceText` — so a CRLF backup entry is restorable byte for byte, and borrowing the brand would
have refused exactly the files this application exists to handle carefully. The suite's fixture is
a CRLF document with a byte-order mark and a trailing space, and the assertion is that the sender
is handed those bytes unchanged.

### 2.2 D2 — the confirmation binds five values and rechecks six

`PendingRestore` carries `document`, `baseRevision`, `entry`, `candidateRevision` and
`generation`, behind a `unique symbol` this module never exports, so `prepareRestore` is the only
thing that can build one. `confirmRestore` rechecks all five against the session, **plus the
open-surface predicate**, and **plus `observed`** — the revision the live projection gives the
destination.

`observed` is the sixth because the other five prove nothing on their own: every value on a
`RestoreSession` was put there by this module, so a session retained across a re-read of the
destination keeps them all stale **and agreeing**. That is `matchDeletion.ts`'s recorded lesson —
*a confirmation that compares two values minted together observes nothing* — and
`revisionInProjection` is what a caller reads the argument with.

**The preview generation is the fifth value and it is not decoration.** The other four are
reproducible: choosing the same entry of the same batch again produces the same document, base
revision, entry identity and candidate hash. The generation is the only one that moves, and
`restore.test.ts` drives exactly that case.

**A confirmation is not the authorization, and the first two drafts of this record both said it
was.** The first said *"nothing this module exports yields a restore submission except
`sendRestore`"*, which `confirmRestore`'s own export contradicts. The second — the one that
shipped for review — narrowed the sentence but left the code unchanged, and that is the **High**
the review found: `StartedRestore` carried the document and the submission, `sendRestore` took it
and called the sender unconditionally, and `confirmRestore` consumed `pending` only in the session
it *returned*. So one confirmed value could be sent twice, or held while the entry, the
destination, the base revision, the preview generation, the candidate or the window's open surfaces
moved and then sent — writing the old candidate under an authorization nothing rechecked. That is
consult Q8's destructive failure mode reached with every lower primitive behaving correctly.

**The fix is a private runtime permit, which is `rememberTheConflict`'s construct one operation
along.** `confirmRestore` mints a `RestorePermit` — the five bound values **and the exact
submission** — into a module-private `WeakMap` keyed by the `StartedRestore` it returns, and that
object now carries nothing but the session to install. `sendRestore` takes the **live**
`RestoreSession` and the **live** `RestoreContext`, and:

1. looks the permit up, so a confirmation already spent authorizes nothing;
2. rechecks the destination, the base revision, the entry identity, the candidate revision, the
   candidate's own **bytes**, the preview generation, the observed revision and the competing
   surfaces — plus the read-only verdict, a committed session, a conflict on screen, a candidate
   that has gone and a phase that is no longer in flight;
3. **deletes the permit before calling the sender**, synchronously, so a re-entrant caller finds
   nothing to spend while the first send is still awaiting.

The bytes and the base revision reach the wire from the permit, never from the session the caller
handed back. Nineteen `it.each` rows drive one moved value each, and the mutation check is
one-for-one: deleting any single recheck fails exactly the rows written for it (§3).

**What is forced and what is not.**

- **Forced**: a write this module issues carries an unspent permit whose bound values still
  describe the session and the window at the moment of the send, minted from a question that had
  not been answered before. `confirmRestore` is the permit's only producer, it needs a
  `PendingRestore` that only `prepareRestore` mints **and that its own checked deletion finds still
  in `PENDING_CONFIRMATIONS`** (§2.2a), both brands are `unique symbol`s this module never exports, and
  neither membership is a property — both are weak-collection entries, so reflection, spread and
  `structuredClone` find nothing, a clone of a `PendingRestore` is not a member, and a clone of a
  `StartedRestore` is not a key.
- **Not forced**: that the session and context handed to `sendRestore` are the live ones. Both are
  ordinary values, which is `observed`'s limit one argument along. Nor that a caller calls
  `sendRestore` at all: `RestoreSession.submitted` carries the candidate and
  `BrowserState.saveRawDocument` is public, so the real hole is one layer out — a component may
  import `saveRawDocument` from `../ipc/commands`, or call `BrowserState.saveRawDocument` with a
  text that never passed through here, which is the hole every writing command has had since 2b-2a.
  Nor is a *session* limited to one **question**: what is spent is one `PendingRestore`, so any
  caller reaching `prepareRestore` again with none pending gets a second question, and that is the
  person being asked again rather than one answer spent twice (§2.2a). **The core does not enforce
  restore intent either** — consult Q3 rules that there must be no restore-specific finding, so a
  save issued around this module is an ordinary whole-document replacement and is accepted as one.

### 2.2a D2a — the question is spent at a second runtime membership, and two fix rounds got that spend wrong before it held

**This section records wrong adjudications being corrected, which is why each is here rather than
deleted.** Round 1 filed the defect as an accepted limit; round 2 built the membership but wrote the
spend as two operations. Both blocks are kept as they were reasoned.

**Round 1 filed the defect as an accepted limit.** The fix round for the review's H1 closed the
*permit* half and then wrote the remainder
down as an accepted type-system limit, in this record's own §2.2 and in hole 8 of §5: *two
confirmations of one session mint two permits, and both hold*. A case at
`restore.test.ts:1006-1019` drove it and asserted **two sends**, so the defect was not merely
recorded — it was pinned as intended behaviour. The confirmation review rejected that adjudication,
and it was right to: this is H1 surviving in a narrower form, not a limit.

**Why the reasoning was mistaken.** It read "the pending request is consumed" off the line
`pending: null` in the session `confirmRestore` *returns*, and treated that as a spend. It is not
one. Every field on a `PendingRestore` is a value — two numbers and three strings, one of them
inside a nested identity — so **nothing a confirmation compares can tell one copy of an answered
question from another**. A caller that keeps its own reference to the session it passed in, or that
holds a `structuredClone` of it, still has a value that satisfies all five checks. The limit was
therefore filed under the same heading as *a caller can call `BrowserState.saveRawDocument` by
hand*, and it does not belong there: it is reached entirely through the intended exported path,
with live and agreeing session and context values, and consult Q8 requires the five values to be
bound into **one unspent confirmation** — the word is *unspent*, and nothing was spending it.

**The fix is the same construct one step earlier, and it took two attempts to write it correctly.**
`PENDING_CONFIRMATIONS` is a module-private
`WeakSet<PendingRestore>`; `prepareRestore` is its only registrar; `confirmRestore` spends it with a
**checked** `PENDING_CONFIRMATIONS.delete(pending)` whose success *is* the authorization. So the
spend now happens at **two** runtime memberships, and neither is a field: one question yields at
most one permit, and one permit yields at most one send.

**Round 2 wrote that spend as two operations, and the confirmation review's third pass found the
same defect a third time.** It asked `PENDING_CONFIRMATIONS.has(pending)` before the five field
checks and deleted the membership after them, **ignoring what the deletion returned**. Between those
two lines sat every property read of the question, the session and the preview — and `readonly` on
`PendingRestore` freezes nothing at runtime, while `prepareRestore` hands the **exact registered
object** back on the session it returns. So a caller could install a getter on `pending.document`:
the outer call passed `has`, the getter re-entered `confirmRestore` with the same session, the inner
call passed membership, deleted it and minted a permit, and the outer call then ignored its own
`delete` returning `false` and minted a second. Two live `PERMITS` keys, each passing `sendRestore`'s
recheck — one answered question running the sender twice, which is the destructive failure consult
Q8 exists to forbid.

**Why it was missed.** The round reasoned about **suspension** rather than about **re-entry**. It
wrote down that `confirmRestore` contains no `await` — true, and not the property that was needed:
synchronous JavaScript re-enters through a getter or a proxy trap without suspending anything. Its
re-entrancy test re-entered only from `submissionOf(preview.draft)`, which is *after* the deletion,
so the test could not reach the earlier opening; and the record then generalized that single test
into *the one place a caller can re-enter*, which is this project's worst defect class — a record
claiming a guarantee the code does not give. `restore.ts` and `restore.test.ts` both carried the
generalization in a comment, and both now say what is actually true.

**The redundant `has` was removed rather than kept.** For an ordinary inert value, every case it
refused still ultimately answers `null`, by one of the two checks that remain: by a field check
where the values disagree, and by the checked deletion where they do not — a `structuredClone` and a
question already answered both reach the deletion, which returns `false`. What keeping it would have
cost is exactly what this round is about: a second membership read whose presence is what made a
two-operation spend look like one. The membership is now touched once in that function, and that
once is the spend.

**That equivalence is about the answer, not about the behaviour, and the difference is deliberate**
(fourth pass, M5). The removed `has` used to reject an unregistered or already-spent question
*before* the field reads, and this very round establishes that those reads can run arbitrary getters
or proxy traps. So an already-spent registered object — or an unregistered one whose fields happen to
match — now runs whatever those reads reach before the deletion answers `false`: a throwing getter
makes `confirmRestore` throw rather than return `null`, and a getter can re-enter or have other
observable effects. The membership *outcome* is unchanged for inert values and the atomic spend is
untouched by any of it, because a re-entrant caller still faces the same single deletion; but it
would be false to say the refusal behaviour is unobservable or unchanged.

**The atomicity and the order inside `confirmRestore` are the whole of the guarantee, and all three
parts are mutation-checked** (§3):

1. the membership decision **is** the deletion. `WeakSet.delete` answers whether the question was
   still a member and removes it in **one operation that runs no user code**, so nothing — no
   getter, no proxy trap, no re-entrant call — can execute between deciding and spending;
2. that deletion is **after every check**, so a confirmation refused because the window moved, or
   because the session no longer matches what was asked, leaves the person able to answer the same
   question once the reason is gone;
3. it is **before `PERMITS.set`**, so a caller re-entering while the submission is derived from the
   retained draft finds the question already spent. That ordering is pinned on its own, and it is
   **not** what makes the spend safe — atomicity is, and round 2 is the evidence that the ordering
   alone was not enough.

**What it does not claim.** Not that a caller cannot re-enter `confirmRestore` — it can, from any
getter or proxy trap the values it passes in can reach, and two cases drive exactly that; what is
closed is that re-entering cannot answer one question twice. Not that a session can be asked only
once: `prepareRestore` mints a fresh question every time it is called on a session with none
pending — by a cancellation, by a
withdrawal, or by a caller keeping the session from before the first call — and each is its own
authorization. Not that a *withdrawn* question stops being a member: `cancelRestore` and
`withdrawn()` clear the field and leave the membership, so a caller that kept the object could put
it back — which is a caller re-asking, judged as always on the five values plus the two window
observations, and never a second answer to one question. Not that the session and context handed to
`sendRestore` are live (hole 7). And not that a clone is refused because TypeScript saw it: it is
refused because the set never held it.

### 2.3 D3 — one private `withdrawn()` is the whole of Q4's withdrawal rule

Consult Q4: *changing the batch, entry, target, candidate, or observed target revision withdraws
confirmation and acknowledgement.* Every transition that touches one of those goes through one
private helper, which drops the pending confirmation, withdraws the draft's consent through
`retargetedDraft` at its existing base revision, and bumps the preview generation. Writing the
rule once is what stops a seventh transition being added with two of the three steps.

A catalogue refresh withdraws too (consult Q5's *catalogue refresh*). **Three transitions clear
`pending` without going through the helper, and each has a reason**: `cancelRestore` and
`acknowledgeRestoreFindings` change nothing the confirmation binds, so bumping the generation there
would be gratuitous — and in the second case actively wrong, since it would invalidate the consent
the transition exists to record; `applyRestore` clears it on every arm because a confirmation given
before a send is spent by the answer whatever the answer was.

`measuredAgainst()` is a second private helper, and it is the one place the base revision moves for
a reason that is **not** a save. Its two callers are `targetRevisionObserved` and
`reloadTheDiskVersion`. The distinction between them is load-bearing and is tested:
`targetRevisionObserved` answers *unchanged* when the revision it is given is the one the session
already holds — right for an idle reprojection check, and wrong for an adoption, where a conflict
whose `diskRevision` happens to equal the session's base (a file changed and changed back) must
still leave the panel with nothing pending. The first draft used `targetRevisionObserved` for both;
a case drives the difference and fails when it is undone.

### 2.4 D4 — `OpenWriteSurface` names seven kinds and the refusal type names six

Consult Q4 asks for a coordinator-owned value covering the match editor, the creator *with a chosen
target*, the deleter, the mover, the duplicator, the raw editor **and restore itself** — seven
kinds. The six that *compete* with restore are `CompetingWriteSurfaceKind`, which is
`Exclude<OpenWriteSurfaceKind, 'restore'>` rather than a second written-out list, so a seventh
member joins it automatically and becomes a compile error in `openWriteSurfaceKey`.

`competingSurfaceFor` skips `restore` entries, and the type is what says so: the caller of the
predicate *is* the restore surface, and a restore that refused itself could never be started.
**What that leaves open, stated rather than glossed**: nothing in an `OpenWriteSurface`
distinguishes one restore from another, so a window that ever drew two restore surfaces over one
file would not see the second here. 2c-5-4 draws restore as a mode of the third pane, of which
there is one.

**Only the file is compared**, for `documentHasUnsavedDraft`'s reason: a form minted over an
*earlier* parse of the file is stranded by a whole-document replacement exactly as a current one
is. **A creator with no chosen destination produces no value at all**, which is Q4's "creator with
a chosen target" — a form that names no file competes with no restore.

**Nothing here can check that the caller passed every surface it holds open.** The argument being
required is what stops silence compiling into "there are none". `documentHasUnsavedDraft` was
**not** reused: it measures any open *match editor*, explicitly excludes the raw draft, and would
have answered a narrower question than the one Q4 asks.

### 2.5 D5 — the refusal sentence is true of its predicate, and none of the six says "unsaved changes"

The predicate answers *a surface is open*, not *a surface is dirty*: `isDirty` is derived inside
each surface's own session, so no coordinator can observe it (R36). Over-refusing costs one closed
panel; under-refusing strands a person's work. This application has shipped the wrong sentence
twice — `browser.matchDuplication.refused.unsavedDraftInDocument` carries a correction block, and
`browser.matchMove.refused.unsavedDraft` still has the defect untouched — so each of the six
sentences claims an open surface, and the two whose surface holds typed text add that this
application cannot tell whether it has been edited.

**What the suite holds and what it cannot.** It holds that the six keys are distinct, that none of
their values contains *unsaved changes* / *cambios sin guardar*, and that the two editor sentences
contain *cannot tell* / *no puede saber* — with `browser.matchMove.refused.unsavedDraft` used as the
positive control that proves the search can match at all. It **cannot** hold that the sentences say
something true instead: no suite in this repository pins meaning, and the i18n suites check key
parity and placeholder agreement only (`CLAUDE.md` §6).

### 2.5a D5a — `targetMoved` claims nothing about what reached the file

**The review's M3, and the same defect class one refusal along.** The shipped sentence ended
*"Nothing was sent to the file by this attempt."* / *"Este intento no ha enviado nada al archivo."*
The predicate is only that `RestoreContext.observed` is `null` or is not `session.baseRevision` —
which is reachable **after** a send: after an uncertain `mayHaveWritten` answer, and after a
`committed: false` success followed by another projection change. It does not establish that no
command was issued.

Both sentences now say only what the predicate supports: this window no longer holds the reading
the text was set up against, the replacement cannot be prepared or confirmed against the reading it
holds now, and it has to be set up again. A case asserts that neither language's `targetMoved`
contains a claim about what was sent or written, with `browser.restore.refused.conflictShowing` —
whose predicate *is* a transaction that refused at its own locked read — as the positive control
that proves the search can match.

The other five sentences were swept against their own predicates in the same pass:
`conflictShowing` claims a conflict wrote nothing, which its arm gives it; `alreadyRestored` claims
a replacement committed, which only `outcome.committed` sets; `inFlight` claims nothing here
changes until the file answers, **which §2.14 is what made true**; `noCandidate` and `readOnly`
claim only what their booleans say.

### 2.6 D6 — restore's reload is a third `ConflictReloadOutcome`, not one of the two that existed

Consult Q4: *after confirmed adoption the old restore confirmation is spent; the person must review
the still-retained candidate against the newly installed target and issue a fresh restore
confirmation with `diskRevision` as the new expected revision.* Neither existing arm describes
that, and `describeConflict` puts `reloadWarningFor`'s sentence into **every** conflict model
whether or not the control is drawn — so declaring either would have shipped a false sentence:

- `reseedsDraft` → *loading the version on disk replaces your text with it*. There is no text of the
  person's here to replace.
- `closesSurface` + `operationChoice` → *closes this panel. What you asked for here is not carried
  out*. The panel keeps a candidate it has every reason to keep.

So `ConflictReloadOutcome` gained `retargetsCandidate` and `SaveOutcomeMessage` gained
`reloadRetargetsCandidate`, with `browser.saveOutcome.reloadRetargetsCandidate` in both
dictionaries. **`reloadWarningFor` became a `switch`**: its `if`/tail form would have handed a new
arm one of the old sentences silently, which is the shape of defect the whole family of
declarations exists to prevent. `saveOutcome.test.ts` now drives the fourth arm and asserts the
other three sentences do not reach it.

`reloadTheDiskVersion` is the transition: on `installed` **or** `alreadyThere` it moves the base
revision to the conflict's `diskRevision`, withdraws the confirmation and any consent, clears the
outcome and keeps the candidate; on `refused` it writes `RELOAD_REFUSED` and moves nothing. **There
is no *retry restore anyway***, and there is no need for one.

### 2.7 D7 — `ConflictOperation` gained `replaceFileFromBackup`

The conflict summary is decided in `src/lib/browser/` rather than assembled in markup, for
2c-3c-3's Medium. Restore needed a seventh member; the `satisfies Record<ConflictOperation, true>`
in `saveOutcome.test.ts` is what caught the missing entry, and `conflictOperationKey`'s `switch`
caught the missing key. The sentence **names no batch, no entry and no time**, for the reason every
other member names no snippet.

### 2.8 D8 — restore's capabilities: `operationChoice`, no copy, no reapply, no control yet

`draftKind: 'operationChoice'` is a statement about what the candidate **is**: nobody typed it, it
is the exact text **read from** a backup entry and retained here — so *your text is still here*
would describe something the person never produced, and `conflictChoicesFor` refuses *Copy draft*
for this draft kind as a property of the value rather than as an opinion of the declaration.

**Nothing claims anything about what that entry holds now**, which is the review's L1. The first
draft said the bytes were *"still in the entry and still retained here"*; the catalogue is
untrusted and mutable, the entry is deliberately read **once** and never revalidated at send time
(§2.1), and no value in this model can know that the entry still exists or still contains those
bytes. The same wording had reached `saveOutcome.ts` twice and `saveOutcome.test.ts` once, and the
sweep for the *claim* rather than for the finding's words is what found those three. No dictionary
sentence carried it, and no test can pin it: it is prose, like every other claim in this file.

`reapplySupport: 'unavailable'` permanently, for the raw editor's reason: the candidate is a whole
document, so there is no target, no field intent and no operation to re-resolve against a newly
parsed file.

`offersReload: false`, and the transition exists anyway. That is the trade 2c-4a-2 made and
2c-4a-3a collected on: the machinery is built and driven by `restore.test.ts` now, and 2c-5-4 flips
one boolean when it draws the panel rather than inventing a transition on top of drawing it. The
suite pins that the offered list is exactly `['keepEditing']` today.

### 2.9 D9 — the key functions are here and the `t*` accessor is not

`restoreRefusalKey` and `openWriteSurfaceKey` live in `restore.ts`, so a missing dictionary key is
a compile error in this file. **No reactive accessor was added to `src/lib/i18n/index.ts`**, which
is `deletionReapplyObstacleKey`'s precedent at 2c-4b-2 — *nothing draws them, so the next step adds
the accessors together with the panel that renders them* — and the reason is mechanical as well as
tidy: `../i18n/index.ts` is reachable from the application entry, so importing this module there
would put a model nothing draws into the production bundle and move the module count off 180.

### 2.10 D10 — `restored` is set by a commit and not by `committed: false`

`committed: false` is a documented success in which **nothing was written**: the candidate was
byte-identical to what the file already held. Nothing became stale and nothing was carried out, so
the session is not spent — the base still moves, because the transaction answered a revision, and
the consent is spent by `savedDraft`. A committed replacement sets `restored` and nothing clears
it, exactly as a deletion sets `deleted`.

`moved` is `null` permanently by `WholeDocumentSaved`'s own type; a case drives a wire result that
carries an identity anyway and asserts it does not survive.

### 2.12 D12 — `RestoreContext`, because a refusal code with no producer is a lie

The first draft gave `restoreRefusal(session, surfaces)` no way to see the destination's live
revision, while `confirmRestore` took it separately. Two things followed, and both were defects:
`RestoreRefusal`'s `targetMoved` arm **had no producer at all** — a code with a dictionary sentence
that nothing could ever return — and `restoreRefusal`'s own doc comment described a check it did
not make. Nothing would have failed for either.

The fix is `RestoreContext = { observed, surfaces }`, taken by `restoreRefusal`,
`canPrepareRestore`, `prepareRestore`, `confirmRestore` and `restoreView`. `confirmRestore` now
checks the observed revision **through `restoreRefusal`**, so the control's rule and the
confirmation's rule are one rule in one place, and a screen cannot draw an enabled control the
confirmation would then refuse for a reason the screen never asked about.

**One code covers two facts** — the window re-read the destination, and the window holds no
projection of it — because the sentence a person needs is the same and there is nothing they would
do differently. The sentence says both.

### 2.13 D13 — the base revision, and what a `RestoreSession` never derives it from

Consult Q1 item 3 and Q8. `RestoreSession.baseRevision` is captured from the destination's
projection when the session opens and moves at exactly two boundaries: a save that answered a
revision (`savedDraft`), and a confirmed adoption of a conflict's disk observation
(`measuredAgainst`). It is **never** the candidate's revision, never derived from a batch name, and
never re-read just before sending — `sendRestore` takes it off the permit the confirmation minted.
`baseRevisionOf` is the named read, and nothing downstream may substitute another; what no type
forces is that a caller reaching `BrowserState.saveRawDocument` by hand passes it.

### 2.11 D11 — a failed invalidation is a line beside the committed outcome

`applyRestore` opens the seal with its own callback, takes `invalidation ?? issuerInvalidation` and
adds **at most one** line, because both mean the same thing to a person: *the file was written and
this window is out of step*. It never replaces the arm (`PROGRESS.md` D2).

**A second open of the same seal invents and replaces no outcome, and returns the session to
`editing` with nothing in flight.** The first draft said it *"leaves the session alone"* while
returning `{ ...session, phase: 'editing' }` — the review's L2. The behaviour is deliberate and
kept; what changed is the claim, in the module, in this record and in the case's own name, which
now asserts the outcome is the first one by identity, that the phase and the in-flight record moved
and that the invalidation was discharged exactly once.

`RawSaveAnswer`'s failed arm carries only `mayHaveWritten`, so `restoreCouldNotBeSent` records no
reason. **That is a limit rather than a policy** — the sealed boundary is not this sub-phase's to
widen — and the raw editor has the identical limit and states it.

### 2.14 D14 — a send in flight really freezes the panel, because the sentence already said so

**The review's M1, and it is this project's named worst defect class in two halves.**
`browser.restore.refused.inFlight` shipped saying *"This replacement is being written, so nothing
can be changed here until the file answers."* Nothing enforced it: `chooseBatch`, `chooseEntry`,
`candidateRead`, `candidateRefused`, the catalogue transitions and `targetRevisionObserved` all
still worked while `phase === 'saving'`. And `applyRestore` began
`if (submission === null || preview === null) { return session; }` and then described the answer
with **the current** `preview.draft` — so a preview dropped under a send stranded a seal the file
may already have committed, and a preview replaced under one described an answer for candidate A
against candidate B.

Two changes close it, and the second is why the first is not merely cosmetic:

1. a private `frozen(session)` — `phase === 'saving' || restored` — gates every catalogue,
   selection, candidate and base-revision transition, each answering **its own argument** so a
   reference comparison can see it. `acknowledgeRestoreFindings` and `dismissRestoreOutcome` are
   gated on the flight alone: a committed outcome carries no findings to consent to and must stay
   dismissible. `restored` joins the flight because `alreadyRestored` says nothing more can be
   replaced from this panel;
2. `RestoreSession.inFlight` holds a `SubmittedRestore` — the exact submission **and** the preview
   it was taken from — minted by `confirmRestore` and cleared by `applyRestore` and
   `restoreCouldNotBeSent`. `applyRestore` opens the seal **first**, always, and classifies the
   answer against that frozen record. Absence of presentation state can no longer prevent a
   committed seal from being discharged: a session with nothing to draw over still records the
   revision, sets `restored` and runs the coordinator's invalidation, and simply invents no outcome
   model.

**The cost, stated rather than hidden**: a catalogue or candidate answer that lands during a send
is **dropped**, and the catalogue keeps whatever state it was in. The person asks again once the
file has answered. The alternative was a sentence the model did not keep.

### 2.15 D15 — `applyRestore` takes the coordinator's whole-document invalidator

**The review's M2.** Consult Q4 makes the pre-send open-surface refusal an *affordance* — a surface
can open after the confirmation, or during the send — and puts the real protection on the other
side: *if a commit nevertheless occurs, the synchronous whole-document invalidation closes/marks
terminal every surface for that document.* `applyRestore` hid `openWholeDocumentSave` behind itself
and took no callback, so **no coordinator could discharge that obligation through the sealed
protocol at all**, and 2c-5-4 would have had no place to put it.

It now takes an `InvalidateEverySurface` — the same shape as `ForgetReplacedDocument`, synchronous
and total for the same reason — and calls it from inside the seal's own callback, **after**
recording the revision. `openWholeDocumentSave` calls that callback for a committed `saved` and
nothing else, so a conflict, a refusal and a `committed: false` success close no surface: nothing
went stale. A callback that throws is caught, classified and added as `windowOutOfStep` **beside**
the committed arm — a failure after the commit never unwrites the file (`PROGRESS.md` D2), and a
case drives exactly that.

**What no type forces**: that the body does anything, exactly as `openWholeDocumentSave`'s `forget`
may be empty; and that the coordinator knows about every surface, which is §2.4's standing hole.

---

## 3. The evidence, item by item

Consult Q7 item 3 lists ten things the model and workspace tests owe. Each is driven by
`restore.test.ts`:

| Owed | Where |
|---|---|
| every binding change | "the confirmation and the five values it binds": five cases, one per bound value, plus an eight-row withdrawal table — **and** "the permit a confirmation mints": the same five moved *after* the confirmation, plus the candidate's bytes |
| the dirty-unknown wording predicate | "the six write surfaces": the two sentence cases, with a positive control |
| all six competing surface kinds | "the six write surfaces": prepare **and** confirm refused for each; "the permit": each opening between the confirmation and the send |
| `committed: false` | "the answer": not spent, base still moves |
| refusal / acknowledgement | "the answer": consent recorded, same bytes re-sent, and no consent for a model-error verdict |
| conflict / adopt `installed \| alreadyThere \| refused` | "the conflict": one case each, plus the equal-revision adoption |
| a second conflict | "the conflict": adopt, prepare, conflict again on the new base |
| send uncertainty | "the answer": `mayHaveWritten`, candidate retained, nothing left in flight |
| committed invalidation failure | "the answer": `windowOutOfStep` beside `fileWritten`, and a throwing coordinator |
| no save without a confirmation | "no save is issued without a confirmation": **nineteen** `it.each` cases |

The review added three more, and they are driven in the two groups it produced:

| Owed by the review | Where |
|---|---|
| a confirmation cannot be spent twice | "the permit": a second send with the same object, and a send from **inside** the sender |
| a question cannot be confirmed twice | "the permit": the same session confirmed twice before either send, a `structuredClone` of the question, a refusal that spends nothing, and **two** confirmations from inside the confirmation — one re-entering after the spend, through a getter on the retained draft, and one re-entering *before* it, through a getter installed on the registered question itself |
| every mutation while the file is being written | "nothing here changes until the file answers": seventeen transitions in flight and ten more after a commit, by reference equality |
| a committed seal survives missing presentation state | the same group: a preview removed, a preview replaced, and a session with no in-flight record at all |
| a commit closes every surface for the file | "the answer": surfaces opened *during* the send, one of them over another file and left alone |

**Both groups are written so they can fail, and that was checked rather than assumed.** Every case
runs the production path a component uses — `confirmAndSend`, which confirms, installs the waiting
session, and sends against **that** session and a live context — with a spy sender, and asserts the
call count rather than a returned shape.

**The permit's rechecks were mutation-checked one at a time, and the mapping is one-for-one.** Each
of the fourteen was deleted in turn and exactly the row written for it failed: the candidate, the
phase, `restored`, the read-only verdict, the conflict, the document, the base revision, the entry
identity, the candidate revision, the candidate's **bytes**, the preview generation, the observed
revision (two rows), the competing surface (six rows), and `PERMITS.delete` (the two spend cases).
The §2.14 guards were checked the same way — deleting any one of them fails exactly its own row in
both tables — as were `applyRestore`'s frozen-preview read, its opening of the seal before any
presentation check, and §2.15's coordinator call.

**§2.2a's three parts were mutation-checked separately, and they pin different cases.** Four
mutations were run and each was measured rather than predicted:

| Mutation | Cases that fail |
|---|---|
| the deletion made **unchecked** in place, so membership is no longer required | four: *is one per question*, *refuses a structurally cloned question*, *spends the question before the permit exists*, *spends the question in one operation* |
| round 2's **two-operation** shape restored — `PENDING_CONFIRMATIONS.has` before the field checks, unchecked `delete` after them | exactly one: *spends the question in one operation* |
| the checked deletion moved **above** the five field checks | exactly one: *does not spend the question when it refuses* |
| the checked deletion moved **after** `PERMITS.set` | exactly one: *spends the question before the permit exists* |

The second row is the point of the new case: round 2's shape leaves *spends the question before the
permit exists* green, because that case re-enters from `submissionOf` and by then **both** shapes
have deleted. The fourth row is why that older case is still not redundant: within a synchronous
function the two orderings are indistinguishable to any caller that cannot re-enter. And the third
row shows the refusal guard is carried by *does not spend the question when it refuses*, which
drives both a `restoreRefusal` arm and one of the five values the question carries.

**What none of it proves.** The nineteen-case group proves that those paths issue nothing; it does
not prove the list is exhaustive, and no type makes it so. Nothing proves anything about a caller
that reaches `BrowserState.saveRawDocument` directly, or that hands `sendRestore` a session and a
context it did not re-read (§2.2).

---

## 4. The gates

| Gate | Before | After | After the review's fixes | After the confirmation review's H1 | After the third pass's H1 |
|---|---|---|---|---|---|
| `cargo test --workspace` | 1153 | 1153 (no Rust changed) | **1153** | **1153** | **1153** |
| `npm run check` files | 424 | **426** (`restore.ts`, `restore.test.ts`) | **426** | **426** | **426** |
| `npm test` | 1793 | 1873 | 1932 | 1935 | **1936** |
| `npm run build` modules | 180 | 180 | 180 | 180 | **180** |

**The test count moved by 80 and every one is accounted for**: 78 new cases in
`restore.test.ts`, plus **2** from `scripts/lint/ipc-detail.test.ts`'s per-file `it.each`, which
adds one case for every `.ts` and `.svelte` file under `src/`. `saveOutcome.test.ts` added no
case — its two changes are an entry in an array an existing case iterates and assertions inside an
existing case.

**The fix round moved it by a further 59, all of them in `restore.test.ts`** — 78 → 137. No file
was added, so `ipc-detail.test.ts` contributed nothing and `npm run check` stayed at 426. The 59
are **23** in "the permit a confirmation mints" (19 drift rows — 13 named plus one per competing
surface — and 4 cases), **30** in "nothing here changes until the file answers" (17 in-flight rows,
10 after-commit rows and 3 cases), **5** in "the answer" (the two coordinator cases and a three-row
table of outcomes that close nothing) and **1** in "the sentences behind the codes".

**The confirmation review's H1 moved it by a further 3** — 137 → 140, all in "the permit a
confirmation mints" — because §2.2a added three cases (a cloned question, a refusal that spends
nothing, and a confirmation inside a confirmation) and **inverted** an existing one rather than
adding a fourth. The inverted case is the counterexample the review named: it asserted two sends,
and now asserts that the second confirmation is refused and the sender ran once. It was kept, and
renamed to say what it pins, because a defect that was once pinned as intended behaviour is worth a
regression case that says so. No file was added, so `npm run check` stayed at 426 and
`ipc-detail.test.ts` contributed nothing.

**The third pass's H1 moved it by a further 1** — 140 → 141, again in "the permit a confirmation
mints" — one case: a getter installed on the **registered** `PendingRestore` that re-enters
`confirmRestore` during the field checks, *before* the spend. Round 2's two-operation shape passes
every other case in the suite and fails this one, which is what makes it a regression case rather
than a restatement. No file was added, so `npm run check` stayed at 426 and `ipc-detail.test.ts`
contributed nothing.

**The module count did not move, and that is correct rather than suspicious.** `restore.ts` is not
imported by any component and `../i18n/index.ts` does not import it (§2.9), so it is not reachable
from the entry and the production bundle does not contain it. The discriminating oracle
`PROGRESS.md` records was run rather than the vacuous `svelte/internal/server` search:
`rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` found nothing, and
`rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js` found 2 — so the search can
match, and the server sentinels are absent.

`cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` are clean, and
`cargo tree -p espansoconfig-core | rg tauri` finds nothing.

---

## 5. Holes, stated rather than hoped about

1. **No screen exists.** Nothing draws any of this, so no claim in this record is a claim about a
   window. 2c-5-4 owns the mounted evidence and 2c-5-6 owns the bilingual reading.
2. **Twelve new sentences are prose no test pins.** The forbidden-vocabulary case checks a fixed
   word list with a positive control; it cannot check that what the sentences say instead is true.
   Meaning-parity between English and Spanish was checked **by reading only**, which is the same
   residue 2c-5-2's fix round 2 left and named.
3. **`competingSurfaceFor` cannot see a second restore surface** (§2.4), and cannot check that its
   caller passed every open surface.
4. **The coordinator that will produce `OpenWriteSurface` values does not exist.** This step
   defines the value and the predicate; whichever component owns the third pane at 2c-5-4 has to
   assemble the list, and nothing here can prove it assembles a complete one.
5. **`browser.matchMove.refused.unsavedDraft` still has the shipped defect** §2.5 names. It was
   left untouched: it is a different surface's sentence and correcting it is not this step's scope.
6. **`restore.ts` imports `RawSaveAnswer` type-only from `./workspace.svelte`**, which is a
   direction no other `src/lib/browser/*.ts` module takes. It was chosen over restating the type,
   which would have been two declarations of one wire shape; the import is erased at build time and
   the module is not in the bundle either way.
7. **Nothing forces `sendRestore`'s `session` and `context` to be the live ones** (§2.2). They are
   ordinary values; a caller that keeps the pair it confirmed with defeats every recheck the permit
   makes, exactly as a caller that hands back `session.baseRevision` defeats `observed`.
8. **A session can be asked the question more than once** (§2.2a), and each question is its own
   authorization. What is *closed* is that one question mints at most one permit and one permit
   spends at most one send — closed by a **checked** deletion, which is what makes deciding and
   spending one operation; what is not closed is `prepareRestore` being called again on a session
   with none pending. This entry previously read *two confirmations of one session mint two permits,
   and both hold*, filed as an accepted type-system limit. **That adjudication was wrong** — it was
   the review's H1 surviving in a narrower form. The round that corrected it then wrote the spend as
   a `has` check and a separate unchecked `delete`, which a caller re-entering through a getter
   defeated, so the closure above dates from the **third** pass and not from the second; §2.2a
   records both mistakes.
9. **A catalogue or candidate answer that lands during a send is dropped** (§2.14), and the
   catalogue keeps whatever state it was in — including `loading`. 2c-5-4 owes a way to ask again;
   nothing here can, because asking again is what the freeze refuses.
10. **The coordinator's invalidator is a required argument whose body may do nothing** (§2.15).
    `applyRestore` can force that a caller supplies one, never that it closes anything.
11. **`rawEditor.test.ts:487` still carries L2's exact claim about its own module.**
    `applyRawSave`'s already-opened arm returns `{ ...session, phase: 'editing' }`, and its case is
    named *"leaves the session alone when the seal has already been opened"* — the same false
    sentence about the same branch shape, one surface along. It was found by sweeping for the
    *claim* rather than for this finding's file, and left untouched for
    `browser.matchMove.refused.unsavedDraft`'s reason: it belongs to a shipped, separately reviewed
    step, and correcting it is not this fix round's scope.
