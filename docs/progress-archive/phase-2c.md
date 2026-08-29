# Phase 2C — verification and review dispositions

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

---

## Phase 2c-4c — consult disposition

Phase 2c-4c, the recovery fallback, was put to a design consult before any line of it was written,
by the rule every phase since 2b-2c has followed. The consult is
`docs/reviews/phase-2c-4c-design.md`. **Unlike the 2c split's consult, this one was given the
repository to read** — every ruling cites `path:line`, as 2c-4b's and 2c-3c's did — and was
forbidden the web. Five questions were asked; five were answered, and the consult **returned no
open question for the owner**, on the ground that the repository already fixes the preservation
boundary, the conflict entry condition, the naming, the write path, the evidence rule and the
localization contract tightly enough that what is left is engineering rather than product policy.

**The verdict in one sentence:** 2c-4c adds a **recovery creator**, reached only from an intact
conflict, that keeps the original conflict and draft alive while it prepares **one ordinary
`create_match`** against a person-chosen eligible destination, at that destination's **end**.

| # | Question | Ruling | What it changes |
|---|---|---|---|
| 1 | Is *save my draft as a new snippet* a `create_match`, and what is its trigger? | **Yes**, on the match editor and the creator only. It is the projection-based product 2c-3c refused to call *Duplicate* — so it is labelled **_Create a new snippet from supported fields_** with an explicit disclosure of what was not copied. The trigger is carried as an **editable literal** and is **never auto-suffixed, normalized or guessed**; an exact repeat is reported as risk by a new transaction finding | 2c-3c's precedent transfers **at the level of the pattern, not the code**: `DuplicateKeepsTriggerDefinition` fires only for `DuplicateItem` batches, so a **new** `FindingCode::NewMatchRepeatsLiteralTrigger { revision }` is needed, `SuspiciousButPermitted`, content-addressed to the candidate, and emitted for `InsertItem` candidates — which means it reaches **ordinary `create_match` too**, because exact repetition is a property of the candidate and not of the route that reached it |
| 2 | Where does the recovered snippet go? | **Fixed `NewMatchPosition::End`, with no placement chooser.** The conflict's own document is preferred **only when the disk projection still says it is eligible**; otherwise an explicit destination choice is required, using the creator's existing destination vocabulary. If the `matches` sequence is gone, recovery **must not synthesize one** — it offers the other eligible destinations, and if none exists it writes nothing and keeps the draft | Recovery has **no trustworthy anchor by definition** — the anchor is what went missing — so `After` is refused outright. A person who wants another position performs a later same-sequence move as its own operation, which D2r and R25 already require |
| 3 | What is *manual resolution* on a screen? | The **existing** stacked comparison plus the truthful actions the draft kind supports. **No diff viewer is added**, and nothing a diff produces may be writable. 2c-4c's addition is the recovery creator for **authored-text match drafts**; an `operationChoice` draft gets neither a copy nor a save-as-new | This answers the plan's *Compare* and *Copy draft* offers by saying they already exist rather than by building them. It also names what an `operationChoice` recovery **is**: confirmed reload, fresh selection, fresh operation |
| 4 | Which surfaces get it? | **All six are in the recovery contract; only two gain save-as-new** — the match editor and the creator. The deleter, the mover and the duplicator recover by confirmed reload then a fresh operation. **The raw editor is in**, but recovers only as whole-document authored text: keep editing, exact copy, comparison, confirmed reload | The raw editor being out of *reapply* does **not** put it out of *recovery* — the consult was asked to rule that explicitly and did |
| 5 | Does it need Rust? | **Yes, but narrowly.** Widen `NewMatch` from its two mandatory fields to those two plus optional `label`, `word`, `left_word`, `right_word`; add the new finding. **No new `DocumentEdit` variant, no thirteenth command, no second writer** — everything still composes `create_match` → `InsertItem` → `run_one_save` → `save_document` | This is smaller than 2c-3c's Rust (which needed a new primitive **and** a command) and larger than 2c-4a's and 2c-4b's (which needed none) |

**The six-step cut the consult prescribed**, adopted as written:

| Step | Scope | Evidence it owes |
|---|---|---|
| **2c-4c-1** | The creation and risk contract in Rust: widen `NewMatch`, add `NewMatchRepeatsLiteralTrigger`, keep `create_match` lowering to one `InsertItem` | Rust model and persistence tests only. **No frontend control changes** — this isolates the one authoritative protocol change |
| **2c-4c-2** | Recovery as browser values: the shared outcome/choice model, the six field transfer decisions, destination selection, fixed-end placement, and the rule that the source conflict survives until a recovery create **commits**. Compose `BrowserState.createMatch`; **draw nothing** | Model and workspace tests over every `manualResolution` obstacle from the five surfaces, no eligible destination, another conflict, refusal/acknowledgement/retry, uncertain send, failed adoption after a known commit, selection races — and proof that **no command is called** by operation-choice or raw recovery |
| **2c-4c-3** | One recovery UI, i18n in both languages through typed accessors, and mounted evidence | A mounted interaction test per changed component, proving the editor and creator invoke recovery creation, the three operation surfaces offer neither copy nor save-as-new, raw offers no save-as-new, and the original conflict survives every non-committed ending |
| **2c-4c-4** | **Rebuild the window instrument** from `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md`, add recovery plans and expected-byte fixtures, and prove it reaches all six surfaces | This step **judges the instrument, not the screen** |
| **2c-4c-5** | The bilingual window reading: every surface's manual path, recovery creation at end, changed destination, missing sequence, exact repeated-trigger acknowledgement, another conflict, copy success/failure, committed-result adoption — byte-comparing the whole configuration tree after every case | The phase's manual evidence. **At least one committed awkward corpus fixture** (CRLF or BOM) and one item-owned-comment/block-scalar case, verifying pre-existing bytes survive and that the disclosure does not call the synthesized item a duplicate |
| **2c-4c-6** | Remove the instrument, sweep the residue, and **re-derive** the harness-free gate counts rather than copying figures observed with the harness | No product evidence; it exists so an instrument does not become production code |

**Step 4 is the instrument and step 5 is the reading, and that separation is not new** — 2c-4a-3c,
2c-4b-3c and 2c-4b-3d-2 were each numbered in two for the same reason: **building an instrument and
taking a reading are two different kinds of work in one worker's context.**

**On R38, the standing bound, the consult ruled narrowly and deliberately:** step 5 closes *the
fixture shapes directly relevant to recovery* and no more. The full fifteen-fixture sweep and the
owner's real configuration **stay open**, recorded rather than quietly absorbed into this phase.

---

## Phase 2c-5-4b review disposition

Six rounds: a code review (`docs/reviews/phase-2c-5-4b-code.md`), then four confirmation rounds
(`phase-2c-5-4b-confirmation.md`, `phase-2c-5-4b-confirmation-2.md`, `phase-2c-5-4b-confirmation-3.md`,
`phase-2c-5-4b-confirmation-4.md`), the last finding only a JSDoc contract, fixed directly. The code
review returned **NOT READY**. **No round found a defect in what is written to disk that survived its
own round**, and **no Rust file was touched by any of them**.

### Round 1 — the code review: 2 High, 1 Medium, 2 Low

| # | Finding | Disposition |
|---|---|---|
| H1 | **`confirmRestore` derived the permit's submission after the confirmation had been spent.** The values it froze — the candidate bytes, the candidate revision, the base revision, the entry identity — were read from caller-controlled objects **after** the checked spend, so a getter or a proxy trap could make the submitted bytes differ from the candidate whose hash the person confirmed | **Fixed**: the permit is built by `prepareRestore`, frozen, and filed in a `PENDING_AUTHORIZATIONS` WeakMap; `confirmRestore` reads nothing it does not already hold. **Reopened narrower at round 2** (two caller-controlled sources for one base revision) and **confirmed closed at round 3** |
| H2 | **Cancellation and the other withdrawals did not revoke the runtime confirmation.** `cancelRestore` and `withdrawn()` cleared `session.pending`, but the object stayed **registered**, so a retained pre-cancellation session could still confirm and send | **Fixed**: every withdrawing transition calls `revokeConfirmation`. **Reopened narrower twice** — at round 2 (the helper's own first operation was a caller-controlled read, and `reloadTheDiskVersion` was omitted from the withdrawal set) and at round 3 (temporary absence during inspection) — and **confirmed closed at round 4** |
| M3 | **The mounted forbidden-claim test and the decision record claimed coverage they did not provide** — a scan of two cases described as if it covered the pane's states | **Fixed by taking the stronger evidence**: the scan went from **2 cases to 32** — sixteen mutually exclusive states in each of the two languages — and §7 item 8 of the record states what it still cannot cover, namely a state nobody added an entry for. What *is* forced is that each of the six competing surface kinds has an entry, by a `satisfies Record<CompetingWriteSurfaceKind, true>` |
| L4 | **The "exact candidate" mounted case checked only a distinctive substring**, so it would have passed with the byte-order mark dropped, the carriage return normalised away, or `SourceText` replaced by markup showing one line | **Fixed by asserting the rendering**: both invisible characters named, the mark as a **byte-order mark** (which it is only because `documentStart` is passed), three `<br>` elements and no line ending in any text node, and the three runs of the file's own characters untrimmed and in order. The bound is stated in the same place: `sourceSegments` collapses a CRLF and a bare LF to one `break` segment, so **no mounted assertion can distinguish them** — the CRLF's survival is proved at the save boundary instead |
| L5 | **The record overstated how the byte-identity of the conflict labels is verified** — it said a suite "asserts it directly", and no suite does | **Fixed by a correction block** (§2.4.1): the added case asserts only that the six pre-existing surfaces still *receive* `confirmReload` rather than `confirmReloadKeeping`; the historical byte-identity is established **by the diff and an independent inspection**, and no executable test here compares a rendered label against a pre-change snapshot |

### Round 2 — the first confirmation round: 3 High

| # | Finding | Disposition |
|---|---|---|
| H1 | **The frozen permit could bind one base revision while submitting another.** `prepareRestore` read the base revision from **two separate caller-controlled sources**; `permitHolds` checked one and `sendRestore` sent the other | **Fixed**: every frozen value is read exactly once, through a local, and the entry identity through one `preview.entry.id` local for the same reason. The regression makes the two disagree **during** `prepareRestore` and asserts no question is asked, with a control walking the same path in agreement and getting one. Confirmed **closed at round 3** |
| H2 | **Withdrawal remained re-entrantly spendable, and one path was omitted entirely.** `revokeConfirmation`'s own first operation was `session.pending`, so a getter fired there could mint before the deletion ran; and `reloadTheDiskVersion` never revoked at all, which stranded a question on an object a caller had just replaced | **Fixed**: `PENDING_AUTHORIZATIONS` was re-keyed by the exact asked `RestoreSession`, which makes revocation a **bare reference operation** reading no property; `carryTheQuestion`, `takeTheQuestion`, `putTheQuestionBack` and `withNothingPending` were added; `reloadTheDiskVersion` joined the withdrawal set. **Reopened narrower at round 3**, confirmed **closed at round 4** |
| H3 | *Found by this round, against its own earlier adjudication.* **`adoptDiskVersion` could install two documents from one confirmation.** Projection generations are **per document**, so alternating getters across **two** documents let one confirmation spend twice | **Fixed**: `adoptDiskVersion` reserves the confirmation immediately after testing it, takes its two caller-controlled reads into locals first, and releases the reservation on each refusal. Pinned by a cross-document alternating-getter case in `workspace.test.ts`. Confirmed **closed at round 3** |

### Round 3 — the second confirmation round: 1 High, 1 Low

| # | Finding | Disposition |
|---|---|---|
| H1 | **`targetRevisionObserved` made an existing question look absent while it inspected.** The take-and-put-back protected the *spend* and handed the *mint* a licence: `prepareRestore` tests **presence**, so while the entry was out, a getter on the asked session could register a **second** question on a successor, and both permits could then send | **Fixed by the review's own answer — suspend, never remove.** `SuspendedQuestion` is a module-private cell **replacing** the permit under the same key for the length of one call: `confirmRestore` rejects it through a `WeakSet` membership test that reads no property; `prepareRestore` counts it as an existing question with **no code changed there**; `takeTheQuestion` refuses it so `carryTheQuestion` cannot move it; and the put-back is **identity-checked, from a `finally`**, so a re-entrant withdrawal stands and a throwing getter cannot strand a session suspended. Confirmed **closed at round 4** |
| L2 | **A stale or mismatched candidate response withdrew an unrelated pending question.** `candidateRead` revoked **before** deciding the response was stale, so an irrelevant in-flight read cancelled a valid question | **Fixed**: the staleness decision comes first, and three parameterized cases — a response about another document, another entry, another batch — assert the **same session by reference**, a question still pending, and a send handing the sender the original candidate's exact bytes. Confirmed **closed at round 4** |

### Round 4 — the third confirmation round: no High, no Medium, 1 Low

| # | Finding | Disposition |
|---|---|---|
| L1 | **A nested inspection could return a session that still presents a question after a re-entrant withdrawal removed its authorization.** `unchangedByInspection` did not consult the map at all when its `suspension` argument was `undefined` — and `undefined` is exactly what a **nested** inspection gets, because `suspendTheQuestion` leaves ownership with the outer call | **Fixed** by deleting the `suspension === undefined ||` short-circuit so both branches consult the map, which is the authority and can be asked without reading a property. **Verified against a counterexample build with that short-circuit restored, alone: exactly one case failed, the new one, and the other 2122 passed.** The finding is in `unchangedByInspection` — the helper added *beyond* the previous review's minimal fix |

### Round 5 — the fourth confirmation round: no High, no Medium, 1 Low

| # | Finding | Disposition |
|---|---|---|
| L1 | **`withNothingPending` documented a precondition and a caller inventory the code does not satisfy.** The contract said *"call it only after `revokeConfirmation`"*, and `carryTheQuestion` does not: `takeTheQuestion` refuses a suspension and answers `undefined`, so `carryTheQuestion` then calls the helper with **no revocation having occurred**. The runtime behaviour was already safe — the successor is fresh and no authorization was ever filed under its key — so nothing executable could have failed. **What was wrong was the stated contract**, which a maintainer could have followed into assuming every call site follows a revocation | **Fixed directly** in the comment: it now states the **actual** precondition — *no authorization is reachable under the key this session will be presented as* — and describes the **three call families** that establish it by three different routes. **No code changed in this round**; the gates are unmoved |

### The lesson, and it is the same one 2c-5-3 and 2c-5-4a each paid for

**Every round closed one instance of a single shape and the next round found a narrower one — three
times running, each created by the previous round's fix.** The shape is the one this file already
records: **a check and a spend separated by any property read are not atomic in JavaScript**, because a
property read runs arbitrary code through a getter or a proxy trap, `readonly` does not freeze at
runtime, and the absence of `await` proves nothing about **synchronous re-entry**.

**The new half, and it is what round 4 cost: removing a token to protect it creates a false "nothing
here" state for every other producer that tests for presence.** Round 3's fix took the authorization out
of the map while inspecting it; `prepareRestore` reads absence as permission to ask a second question, so
the fix that closed a spend opened a **mint**. A guard that answers wrongly spends nothing — it mints —
and **a sweep for consuming operations cannot find that**. The sweep that finds it asks, of every state a
value can be in mid-call, **which other producer can observe it**. The answer is to **replace** the token
with a private marker the other producers still count as present, never to take it out.

Two further notes, so they are not relitigated:

1. **Code added *beyond* a review's minimal fix is the least-reviewed code in a change**, and both of the
   last two rounds' findings were in exactly that code — `unchangedByInspection`, and the JSDoc written
   alongside it.
2. **A count in a decision record rots.** *"Exactly eight operations"* and *"the third caller"* were both
   wrong when they were written; they are now an access-site table and an **unnumbered** enumeration of
   three call families. An enumeration without a total does not rot as callers are added.


## Phase 2c-5-4a review disposition

Three rounds: a code review (`docs/reviews/phase-2c-5-4a-code.md`), a fix round, and a confirmation
round (`docs/reviews/phase-2c-5-4a-confirmation.md`). The code review returned **NOT READY**.

| # | Finding | Disposition |
|---|---|---|
| H1 | **`sendRestore` discarded the result of `PERMITS.delete(started)`.** `permitHolds` reads many properties off caller-supplied `session` and `context` values, and any read can run a getter or a proxy trap. Such a trap can **synchronously re-enter** `sendRestore` with the same `StartedRestore`; the inner call validates, deletes, and enters its sender before the outer `permitHolds` returns, and the outer call then ignores its own failed deletion and sends too. **One confirmation, two whole-file replacements** | **Fixed**: the checked deletion *is* the authorization on every path that reaches a sender, and the mismatch arm consumes the permit with the same checked deletion so a re-entrant winner owns the withdrawal while the loser answers `notAttempted`. Pinned by a case driving a `Proxy` surface list whose `Symbol.iterator` trap re-enters `restoreDocument`: **it fails `expected 1 call, got 2` without the fix**. Confirmed **fully closed** |
| M1 | **A rejected permit left the session permanently in `saving`.** On mismatch `restoreDocument` returned its input session unchanged; on the intended path that is `started.session`, whose phase confirmation set to `saving`, and the model deliberately makes every editing transition a no-op there. The session came back claiming a send was in flight **when no sender ran**, and no ordinary transition took it back. The record's claimed *the panel has to ask again* recovery therefore did not exist. The mismatch also left the permit in `PERMITS` | **Fixed** in two parts: `RestoreSend` gained a `withdrawn` arm and `restore.ts` gained `restoreConfirmationWithdrawn`, which clears `phase` and `inFlight` while keeping the candidate, its acknowledgement, the catalogue and the chosen entry; and the redundant `session` parameter is **deleted** from `restoreDocument`, which now derives it from `started.session`, so a permit can no longer be paired with a foreign session. Confirmed **fully closed** |
| L1 | The record claimed the batch identity reaches the command *as the very object it was given*, while the test asserted `toEqual`, which a rebuilt structurally-equal object passes | **Fixed by taking the stronger evidence**, not by weakening the claim: the case captures the call and asserts `toBe(RESTORE_BATCH)`. Confirmed **fully closed** |
| L2 | *Found by the confirmation round, in the fix round's own prose.* The new sentences justified consuming a mismatched permit with *consent is for one attempt* — but `restoreConfirmationWithdrawn` deliberately **keeps** the acknowledgement, so once a transient obstruction clears, a fresh confirmation mints a permit carrying the same one. Acknowledgement is **candidate-scoped, never one-attempt** | **Fixed by the orchestrator** at all three sites (`restore.ts` module header, the `withdrawn` arm's contract, and the record's §6.2). The corrected sentences claim only that *the confirmation and its permit authorize one send attempt*, and name `boundAcknowledgement` plus the retargeting transitions as what actually forbids consent reaching other bytes. The coordinator's own comment already said this correctly and was left alone |

### The lesson, and it is the sharpest instance yet of one this file already records

**H1 is a narrower surviving instance of the very defect 2c-5-3 spent four review passes closing.**
That step's own status row records the ending: round 4 closed it "by making the **checked `delete`
itself the membership test** — `WeakSet.delete` runs no user code, so only one of any two re-entrant
callers receives `true`." That fix was applied to `PENDING_CONFIRMATIONS`, the confirmation half. The
**permit** half, one function along, kept `PERMITS.delete(started)` with its boolean discarded — and the
prose at four sites asserted the atomicity the code no longer gave.

This is the documented narrowing pattern, and it now has an instance that crossed a step boundary: the
sweep after round 4 was written from the wording of the finding it had just closed. **Sweep for the
shape — a consuming operation whose result is discarded — not for the words.**

Two further notes the confirmation round settled, so they are not reopened:

1. **`restoreDocument` answering `RestoreSession | null` does not reproduce the `moveMatch` defect
   shape.** `null` has **one** actionable meaning across all its causes — *this invocation produced no
   session, so do not install one* — and non-null always means install the returned transition. The
   three-way distinction is retained in `RestoreSend`, where it is needed to decide whether a transition
   is owed. This was checked specifically because a two-answer type over a three-answer world is a
   recorded scar here.
2. **The re-entrancy test is honest but is one concrete regression vector, not an exhaustive
   getter/trap matrix.** It would stop exercising re-entry if `competingSurfaceFor` stopped reading
   `Symbol.iterator` altogether; it does **not** depend on iteration being the *last* read, because an
   earlier trap would still let the inner call spend before the outer deletion. §6.5 of the notes states
   that limitation accurately.

The one declined suggestion — making `BrowserState` perform the confirmation from its own projection
observation — was judged **acceptable to defer**, with its first rationale marked overstated: such a
helper *would* reduce misuse on the intended component path even though exports permit bypass, so it
does not literally "close nothing". The other grounds hold. **4b inherits the corrected form of it:
construct one shared live `RestoreContext` for `restoreView`, `restoreRefusal`, `prepareRestore` and
`confirmRestore` rather than wrapping only confirmation** — all four gates must agree.


## Phase 2c-4c-3b review disposition

Two rounds, in `docs/reviews/phase-2c-4c-3b-code.md`. Round 1 returned **NOT READY** on one High and
one Medium; round 2 found **no High**, confirmed the High closed, and returned one Medium that the
fix round's own record had introduced.

| # | Round | Finding | Disposition |
|---|---|---|---|
| H1 | 1 | `recoveryWithoutCreation` centralized **which** reason but not **whether it is drawn**: each of the four hosts carried its own `{#if}` and accessor call, so a host could omit the sentence while consuming the model faithfully — the 2c-3c-3 failure mode. The record compounded it with *"one function, six callers, one suite"*, which was false of what shipped | **Fixed by building the shared renderer**, the first of the two answers the review named. `RecoveryPanel.svelte` was **not** redesigned into a discriminated form/reason renderer and its three collaborators were **not** made optional — that was the second answer, and it would have put a possibly-absent prop on the two surfaces that must never be without one. The false claim is retracted in the record rather than reworded |
| M1 | 1 | The record claimed three surviving endings on *"each surface"*; the raw editor has only **two** reachable, its reapply being deliberately unavailable. No raw case asserted `close` was not called, and a spy `close` means continued local rendering proves nothing | **Fixed by doing the work and correcting the record**: §5 distinguishes two endings from three, and the enumerated endings assert `closed() === 0` |
| M1 | 2 | The fix for M1 wrote *"every tested non-committed ending on all four surfaces"* into the record — a claim one scope wider than the work. Four pre-existing no-write endings did not assert it, and `alreadySatisfied` is a **distinct** ending rather than duplicate coverage | **Fixed both ways by the orchestrator**: the four named endings now assert it (they pass, so `close` genuinely was not called), **and** the sentence is narrowed to what this step enumerates. The review's list was prefixed *including*, so an exhaustiveness claim over four suites is one nothing verified |

**Three lessons, and the third is the one this phase keeps re-teaching.**

**The model can own a rule and still leave the failure mode open.** `recoveryWithoutCreation` was a
real centralization — it decided which reason and whether there was one — and it was still the
2c-3c-3 defect, because *deciding* and *drawing* are two rules and only the first had one home. **A
function returning what to draw does not make a renderer that draws it**; the four hosts each had to
choose to. The shared component closes it by owning the `{#if}` itself, and each host's suite proves
the **mount** rather than the words, through a data attribute carrying the reason **the component**
derived — so a host that re-inlined the paragraph fails with identical text on screen.

**Not reusing `RecoveryPanel.svelte` was right, and the review agreed with the reasoning rather than
the convenience.** Its `aria-label`, heading, transfer table, destination list and create control
are all about a new snippet these four surfaces cannot make, and mounting it would have meant making
`open`, `create` and `adoptDiskVersion` optional on the two surfaces that must never be without
them. **A prop that may be absent on the surface that creates is this project's "a control could
compile and do nothing" failure**, and it would have been paid to reuse thirty characters of markup.

**A fix for an over-claim wrote a bigger over-claim.** Round 1's M1 was a record claiming more
evidence than existed; the fix for it claimed more evidence than existed, one scope wider. **The
orchestrator's own brief contributed** — it asked for the assertion on "every tested non-committed
ending on all four surfaces", and the worker wrote that sentence into the record while implementing
it only for its own cases. This is the sixth consecutive round on this phase in which a fix produced
the next round's finding. **Read a fix round's record against its diff, not against the brief that
commissioned it.**

---

## Phase 2c-3c-3 review disposition

**Two rounds, four findings, `NOT READY` both times** (`docs/reviews/phase-2c-3c-3-code.md`; round 2
is the confirmation pass, appended there). **Both verdicts were accepted rather than argued with**,
and all four were fixed before the commit, so no commit holds a demonstrated defect.

**The standing rule held again: each round's fix produced the next round's finding.** Round 1's two
fixes were behaviourally correct — round 2 confirmed the Medium *closed, not relocated*, and both
localized sentences correct — and **both of round 2's findings were prose those fixes introduced**.
That is this project's named worst defect class, twice, in the round commissioned to look for it.

| # | Where | Finding | Disposition |
|---|---|---|---|
| R1-1 | `MatchDuplicator.svelte:443`, `matchDuplication.ts:1000,1088` | **Medium — the component was not a rule-free walk.** It decided that the frozen `notDuplicable` reason loses to a live `outOfDate`; the view handed the frozen reason out unconditionally and a markup condition was the only thing keeping the suppressed certainty off the screen | **Fixed in the model.** `MatchDuplicationView.notDuplicable` is replaced by the presentation-ready `notDuplicableToShow`, computed from the same `cannotDuplicate` answer that drives `canDuplicate`, and returning the frozen reason **only when `cannotDuplicate === 'notDuplicable'`** — written against that value rather than against `outOfDate`, so any refusal added above it in the order suppresses the detail **by construction**. The unsuppressed verdict stays on `MatchDuplicationSession.eligibility`. The component keeps a null check; two new model cases drive both sides, and the two mounted cases are kept as this renderer's regression cover |
| R1-2 | `matchDuplication.ts:201,233`, `DetailPane.svelte:407`, `en.json:349`, `es.json:349` | **Low — a sentence false of its own predicate.** `documentHasUnsavedDraft` returns `true` for every *open* match editor identity, pristine or not, while the refusal said the snippet *has edits that have not been saved* | **Fixed in words, not in the predicate.** R36 is kept: `isDirty` is derived inside `MatchEditor.svelte`'s own session, so no coordinator can observe it, and over-refusing costs one closed editor where under-refusing strands edits. Both sentences were rewritten to claim an open editor and this app's inability to tell whether it was edited; the Spanish was written natively to the same claim, with the consequence in the subjunctive |
| R2-1 | `matchDuplication.ts:9`, `matchDuplication.test.ts:783`, `MatchDuplicator.test.ts:1` | **Low — the R1-1 fix introduced a false testability record.** The new prose said a decision in markup is something "nothing can check" and that no test can drive `MatchDuplicator.svelte` — which opts into jsdom, mounts, and whose live/stale pair drove the very condition round 1 removed | **Fixed, with the accurate claim.** A **model** test drives values and never markup, so a rule in one renderer is carried by that renderer's mounted suite **alone** and a second renderer can omit it while walking the model faithfully — *that*, not untestability, is the architectural problem. Applied in the module header, the model test's comment and the component's note |
| R2-2 | `2c-3c-2-notes.md:101`, `phase-2c-3c-design.md:156,247` | **Low — the governing records still claimed dirty-draft coordination**, including as a completion criterion, so they asserted a guarantee the implementation deliberately does not give | **Fixed by correction blocks appended in place**, not by rewriting either record: both now say the intended risk is a dirty draft while the implemented, deliberately conservative predicate measures any open match editor |
| O-1 | `DetailPane.svelte` header | **The orchestrator's own correction, outside both rounds.** The file header carried the pre-existing absolute "Nothing in this repository renders a Svelte component in an automated test, so logic put here is logic nothing can check" — false of that very file: `DetailPane.test.ts:1` opts into jsdom and mounts the pane at line 181 | **Corrected directly.** The worker had proposed leaving it because it predated the step; a known false absolute in a file this step edits is not left standing. The header now gives the narrow reason |

**Confirmed sound by round 2, and worth recording as checked rather than assumed:** the panel reads
`projections()` **once** in one `$derived.by` and takes both the view and the identity handed to
`beginDuplicate` from that read; it calls `BrowserState.duplicateMatch` and never the raw IPC
wrapper, and writes nothing to `selected`, `selectGeneration` or `projectionGenerations`, so the
step-2 selection-follow race is not reopened; the acknowledgement is produced by
`acknowledgeDuplicationFindings` and the mounted retry compares the **complete** accepted finding,
`DuplicateKeepsTriggerDefinition.revision` included; the six write surfaces are mutually exclusive in
both directions through `busy`; the `path: matchListPath(0)` additions in `DetailPane.test.ts` only
make the fixtures genuine sequence items, with no existing assertion removed or weakened; and all 31
`browser.matchDuplication.*` keys exist in both dictionaries with no key built by hand in any
component.

### Two defects this step found in a sibling screen and did NOT fix

Both are in **move**, both shipped, and both are left by the standing rule that changing a sentence
or a decision in a shipped screen obliges a **re-taken window reading** of the sub-phase that owns
it — 2c-3b-2's:

- **`browser.matchMove.refused.unsavedDraft` (`en.json:316`, `es.json:316`) has R1-2's exact
  defect.** It says *"This snippet has edits that have not been saved"*, while its producer —
  `unsavedDraftFor()` in `DetailPane.svelte`, which answers `editingMatch.match.id` — asks the same
  open-editor question `documentHasUnsavedDraft` asks.
- **`MatchMover.svelte:511` carries R1-1's exact shape**:
  `{#if current.view.notMovable !== null && current.view.cannotMove !== 'outOfDate'}` — the
  precedence decision written into a `.svelte` file. Duplicate's model-side fix now **diverges** from
  it, so two sibling panels resolve the same rule in two places and only one of them is a decision a
  model test can drive.

**The standing debt ledger is therefore four items** — *five as of 2c-4c-2 round 7, which added
`browser.saveOutcome.reloadClosesSurface`; see "Phase 2c-4c step 2 — the rounds 5–7 disposition"* —:
`browser.matchDeletion.sendFailed`,
`browser.rawEditor.discardWarning`, `browser.matchMove.refused.unsavedDraft`, and
`MatchMover.svelte:511`'s in-component rule.

---

## Phase 2c-3b-2 review disposition

**Two rounds, nine findings, `NOT READY` both times.** The mandatory once-per-phase aggregate review
is `docs/reviews/phase-2c-3b-2-code.md` (six findings, three High); the confirmation pass over its
fixes is `docs/reviews/phase-2c-3b-2-confirmation.md` (three more, all Low). **All nine were fixed
before the commit**, so no commit holds a demonstrated defect.

**Four of the six first-round findings were user-facing sentences claiming more than the code
knows** — this project's named worst defect class, in the medium where it does the most damage.

| # | Finding | Disposition |
|---|---|---|
| F1 | **High — `rereadDocument` awaited with no generation captured**, so an older re-read could install a projection over newer state. The one genuine correctness bug in the round | **Fixed.** Three captures before the await, each in a shape already used in this file: `openGeneration`, a new per-document `rereadGenerations` request counter, and `projectionGenerationOf(document)`. Two deferred-promise tests force out-of-order completion |
| F2 | **High — a committed move whose re-read failed drew two contradictory sentences at once**: `windowOutOfStep` ("this window could not read the file back") beside `browser.matchMove.moved` ("the file has been read again"). Both reachable together because `view.moved` is true even when `adoption.kind === 'failed'` | **Fixed.** `moved` no longer mentions a re-read in either language; a mounted case covers the failed-adoption state |
| F3 | **High — `movedNotIdentified` said *"It is in the file"* on `landed === null`**, which means the file changed *again* between the write and the read that followed — an intervening change that may have removed the snippet entirely | **Fixed.** Both languages now say the window cannot establish where the snippet is **or whether it is still there**, and ask the person to look at the file as it is now |
| F4 | **Medium — `sendFailed` claimed *"The snippet is where it was"***. The failure establishes that *this move* wrote nothing; it establishes nothing about the file, which something external may have changed | **Fixed.** Claims only that this move wrote nothing, in both languages |
| F5 | **Medium — a *failed* recovery re-read kept a projection already known to disagree**, leaving the session live against it, holding its old destinations, and able to resend the same stale identity | **Fixed with the smallest honest change**, deliberately: a new `moveRecoveryFailed(session)` sets `invalidated`, so the session can no longer choose or send. **The workspace invalidation helpers and the two counters were not touched** — collapsing or mis-driving those is a known past data defect, and a Medium does not justify re-plumbing them |
| F6 | **Low — the record promised every successful re-read makes the session `outOfDate`.** An unchanged-bytes re-read returns the *same* revision, the full identity still compares equal, and the panel stays usable | **Fixed in words, not code.** Qualified in the notes and in the component comment |

**F5's fix forced a fifth copy change that no reviewer had seen**, which is why the confirmation pass
was commissioned rather than assumed: `cannotMove.outOfDate` said *"This window has read this file
again"*, false for the new producer, and now says only that the destinations come from a reading the
window can no longer stand behind.

**The confirmation pass found three more, and all three were prose contradicting code** — the class
no test can fail:

| # | Finding | Disposition |
|---|---|---|
| C1 | **`matchMove.ts`'s module header still called `applyMove` the only producer of `invalidated`** and defined the field as *a projection was replaced*. `moveRecoveryFailed` is a second producer and explicitly does **not** replace one | **Fixed.** `invalidated` is now documented as **identities the session can no longer vouch for**, with both producers named and the difference between them stated: one replaces a projection, the other leaves it installed after the command contradicted its identity |
| C2 | **The spent-session prose in the component and the notes claimed every `outOfDate` session came from a parse that is gone.** After `moveRecoveryFailed` the parse is still installed | **Fixed in both places.** Three histories, not two, with the third named as the one where the parse is *not* gone |
| C3 | **The F1 comments and the workspace-replacement test stated the opposite counter policy from the code** — that `open()` clears the re-read counters. It clears only `projectionGenerations`; `rereadGenerations` is deliberately monotonic, and its own declaration comment says so 200 lines above | **Fixed.** Both passages now say the two per-document counters fail to distinguish workspaces for **opposite** reasons, and that only `openGeneration` separates them |

**Confirmed sound by the second pass, and worth recording as checked rather than assumed:** all three
F1 generations are captured before the await and failures are still reported; the counters key by
`DocumentId`; both race tests genuinely force delayed older completion; all five copy changes match in
strength across English and Spanish; `moveRecoveryFailed` disables choosing and sending and survives
dismissal; and R37, the `notMovable` suppression, `moveMatch`'s three repaired behaviours and the
refusal precedence all remain intact.

**One interlock the pass surfaced, and it is worth knowing before anyone edits either half.**
`cannotMove.outOfDate` can say *"This move wrote nothing"* **only because of the refusal precedence**:
`mayHaveWritten` and `alreadyMoved` are both asked above it, so a session that wrote — or may have —
never reaches that sentence. **Reordering `refusalGiven` would silently make that copy a lie.** The
copy's truthfulness is load-bearing on the arm order, in two files that look unrelated.

### A defect this step found in a sibling module and did NOT fix

**`browser.matchDeletion.sendFailed` carries F4's exact defect**, in both languages: *"The snippet is
still in the file"* / *"El fragmento sigue en el archivo"*. A send failure establishes that **this
deletion** wrote nothing; it establishes nothing about the file, which something external may have
changed in the meantime.

It was left deliberately, by this project's own standing rule: changing a sentence in a shipped
screen obliges a **re-taken window reading** of the sub-phase that owns it, and that is 2c-3a-2's.
This is the same reason `browser.rawEditor.discardWarning` is still outstanding. **Whichever
sub-phase next touches the deleter owes this fix and the re-taken reading**, exactly as the raw
editor's twin is owed.

---

## Phase 2c-3b-1 fourth pass disposition — the decision the checkpoint left open

**The decision was taken explicitly, as the checkpoint required, and the answer was to run the
pass.** The reasoning: round 3 changed refusal *precedence* and *user-facing copy about a person's
own file*, step 2 draws both onto a screen, and every one of the three previous rounds' fixes had
produced the next round's finding. Settling it before a component is built on it is cheaper than
after.

**The pass was justified by its result: `READINESS: NOT READY`, two High findings, both real.**
The review is `docs/reviews/phase-2c-3b-1-fourth-pass.md`.

| # | Finding | Disposition |
|---|---|---|
| F1 | **`notMovable` still won over `outOfDate`, and it is the arm that claims more.** `refusalGiven` asked the frozen `eligibility` before `invalidated \|\| !live`. Eligibility is computed once, at `startMatchMove`, and no transition recomputes it — so after a reprojection a session still answered the definite *this snippet cannot be moved*, read off a parse the window had replaced. **This is the exact rule round 3 applied to `mayHaveWritten`, left unapplied one pair further down**; the existing test drove `notMovable` only against its own original projection, where the overlap cannot arise | **Fixed.** The liveness check moved above the frozen eligibility, the rule written into the doc comment with its reason rather than as an arrangement of `if`s, and a regression test added — **verified to fail against the old ordering** before being kept, so it is not a vacuous pass |
| F2 | **Two comments still justified the terminal state as preventing a repeated write** — the justification §9 rejected and the dictionaries were rewritten to drop. A session resends its **frozen base revision**, so a successful first write makes that base stale and a retry **conflicts** rather than duplicating. This is this project's named worst defect class surviving in the two comments the dictionary rewrite did not reach | **Fixed.** Both passages restated on **uncertainty and stale identity**, each saying explicitly what the justification is **not**. No test accompanies it, because no test can fail a comment — which is the whole reason the class is named |

**Clean in the pass, and worth recording as checked rather than assumed:** the swap itself is
centralized in one `refusalGiven` serving **both** public paths, no arm became unreachable, both
English strings limit themselves to uncertainty and stale identity, the Spanish makes the same
claims at the same strength using `fragmento`, and all **37** `browser.matchMove` keys exist in both
dictionaries with matching placeholders.

**A third thing was found while fixing F1, by neither the pass nor any test.** `MatchMoveView`
exposes `notMovable` — the **frozen** eligibility reason — as a field beside the live `cannotMove`,
so a component drawing both would put the definite claim back on screen exactly where the new
precedence had just suppressed it. **Nothing in TypeScript can enforce that**, and the only place it
can be broken is a component, so the rule is written on the field's own doc comment where step 2
reads it: `notMovable` may not be drawn beside a `cannotMove` of `outOfDate`.

---

## Phase 2c-1b review disposition

**Three rounds, nine findings, and the sharpest two were found by neither of the reviews.** The
mandatory once-per-phase adversarial review is `docs/reviews/phase-2c-1b-code.md`; the second pass
on the reading's fixes is appended to the same file. Both returned **`READINESS: NOT READY`**.
**All nine were fixed before the commit**, so — as with every phase since `8989c16` — no commit
holds a demonstrated defect.

**Round 1 — the aggregate review. Three High, three Medium.**

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **High** | **Stale text could be paired with a newer revision and silently overwrite another program's write.** `installView` replaced the projection at revision R1 while `readFileText` skipped its re-read because the document ID was unchanged, so *Edit* paired text T0 with R1, the revision check passed, and T1 was overwritten. **Wider than the notes' own revert-then-restore argument**, which it falsified | `readFileText` captures the projection's revision **before** the text read and answers it as `BrowserState.fileTextRevision`; `installView` drops a snapshot whose projection it replaces. The notes' §5 was rewritten — the old argument reasoned about two reads and the defect was a third event |
| 2 | **High** | **A failure carrying `may_have_written: true` was drawn as "nothing was written".** Rename succeeds, a later step fails; the file may already hold the candidate. That is *a committed write reported as not-written* | `BrowserState.saveRawDocument` answers a typed `RawSaveAnswer` whose `failed` arm carries `mayHaveWritten`, and an **indeterminate** arm is drawn instead, in both languages |
| 3 | **High** | **A committed save whose re-projection failed was drawn as a clean success.** The workspace reported the reload failure only to the developer channel and sealed only the `SaveResult`, so the editor could not draw *window out of step* | `adoptTheReplacedDocument` returns its failure; `sealWholeDocumentSave` takes it as a required third argument; `applySave` appends `windowOutOfStep` beside the saved arm. Hole 8.3 **deleted rather than reworded** — it had stopped being a hole |
| 4 | Medium | **Closing the editor mid-save let an authorized write commit with its outcome drawn nowhere**, under a dialog saying the changes had not been written | Close and discard-confirm are refused while a save is in flight, a sentence says the save cannot be stopped, and a dialog raised before a save is withdrawn when one starts |
| 5 | Medium | **The conflict read the disk text from the pane's *current* target**, so an editor open on file A while the sidebar pointed elsewhere lost *Reload disk version* entirely — one of the eight §6 requirements | `captureTheDiskText` captures **by document**, read through `BrowserState.rawTextOf(id)` |
| 6 | Medium | **The phase had no window reading**, which `2c-split-notes.md` §7 requires of every 2c sub-phase | Taken. It is §9 of the notes — and it found findings 7 and 8 |

**Round 2 — what the window reading found, which no review and no test did.**

| # | Sev | Finding | Fix |
|---|---|---|---|
| 7 | **High** | **CRLF silently normalized.** Three CRLF endings went in and none came out, while the panel said *"exactly the text that was sent"* | A **refusal**, structural: `RoundTripText`, a branded string whose only constructor applies the CR check. Reconstruct-on-save named and refused (D13) |
| 8 | Medium | ***Copy my text* never copied**, on the conflict's destructive step | `copyBySelecting`: an offscreen carrier text area, `document.execCommand('copy')`, no new dependency, with the existing disclosure still firing when both routes fail |

**Round 3 — Codex on those two fixes. One High, one Medium.**

| # | Sev | Finding | Fix |
|---|---|---|---|
| 9 | **High** | **The CR invariant was not total and D13 claimed it was.** `editText` accepted any string without the check, so `editText(session, "a\rb")` then `beginSave` produced a candidate carrying a CR. Unreachable from the running screen, because a `<textarea>` never emits one — but *that* is a fact about a component, not a guarantee, and the record had written it as a type-system claim | The check moved into the brand's constructor and is applied at all three doors plus `beginSave`. **D13 rewritten into three named categories**: what TypeScript enforces, what the guards enforce, and what merely happens to be true of the current path |
| 10 | Medium | **`copyBySelecting` could throw out of its own cleanup**, so an unguarded `previous.focus()` swallowed *both* disclosures — silence on the one control that exists to keep a draft from being lost | Removal and focus restoration are independently non-throwing through one named `quietly`, the function always returns a boolean, and the previous **selection** is snapshotted and restored beside the active element |

**The reading was then re-taken**, because the fixes changed three files and a claim about a screen
needs a reading of a screen. It confirmed the refusal on screen in both languages, the LF twin still
opening, and the fixture's 375 bytes and thirteen CRLF endings **`cmp`-identical after every one of
five launches**.

**One reading result was withdrawn rather than kept.** The first run measured
`navigator.clipboard.writeText` rejecting and concluded the shipped WKWebView refuses it. The
re-take established the confounder — `document.hasFocus()` false throughout, `lsappinfo front` =
`loginwindow`, `CGSSessionScreenIsLocked = true`; the machine's screen was locked, and both
clipboard routes are gated on a focused document. **The question is open and needs a human at an
unlocked machine** (hole 8.12). D14 survives on its merits — a second route costing no dependency —
with the claim corrected rather than the code. The source comment asserting the withdrawn
measurement was corrected too.

---

## Phase 2c-1a review disposition

The mandatory once-per-phase adversarial review is `docs/reviews/phase-2c-1a-draft-spine.md`. It
returned **`READINESS: NOT READY`** on three High findings. **All eight were fixed before the
commit**, so — as with every phase since `8989c16` — no commit holds a demonstrated defect.

The brief carried the protocol as *rules* rather than as background, so a violation would come
back as a defect and not as taste, and it told the reviewer the tests already passed and to skip
"add a test for X" unless a missing test hid a real defect. **Two of the eight findings were this
project's own decision record asserting a guarantee the code did not give** — the most valuable
thing the review found, because a false claim in a notes file is the one defect no test can fail.

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **High** | **The seal was readable by reflection.** The payload sat on the sealed object under a module-private symbol, and `Reflect.ownKeys(sealed)` / `Object.getOwnPropertySymbols` recovered it, as did spreading the object and reflecting on the copy. The seal was also **reusable** — openable again later with a no-op callback. The module doc's claim that the outcome could not be read except through the opener was **false** | The payload moved off the object into a module-private **`WeakMap`**; the sealed object is now an empty frozen husk carrying nothing at all. The entry is **deleted before the callback runs**, so the seal is one-shot *and* a `forget` that re-enters with the same seal cannot be served either. A second open returns `alreadyOpened` and does not call the callback. Six escapes are now tests |
| 2 | **High** | **A throwing `forget` hid a committed save.** The opener let the callback's exception propagate in place of the result, which is exactly the prohibited *"a committed write is never afterwards reported as an error"* — the invariant a prior review had already caught broken in TypeScript once | The throw is caught, classified through the existing `classifyFailure`, and returned **beside** the committed outcome as `invalidation: { kind: 'failed' }`. The file is written and stays written, and the answer says so |
| 3 | **High** | **Structured values were stored by reference.** Acknowledge candidate A, mutate a nested field in place, and `draft.value` and `consent.candidate` are the same object — so consent survives onto candidate B, with no history step and no invalidation. If the base is the same object the mutation moves it too, so `isDirty` stays false. `readonly` is shallow and is not a runtime barrier | A draft carries **rules**, `{ same, snapshot }`, not just an equality. The base, the current value, every history step, the save/reload base and the consent candidate are all snapshots, **deep-frozen unconditionally**. The reviewer's exact scenario is driven with a structured `T` |
| 4 | Medium | **`acknowledgeDraft` accepted any acknowledgement**, so A's consent could be bound to draft B — and **this file's own record claimed the module never produces that pairing**, which was untrue: given A's acknowledgement, it constructed it | `acknowledgeDraft` is **gone**. Consent is opaque and branded, and only `acknowledgeRefusal(draft, submission, refusal)` produces it, checking the base revision, the candidate identity and acknowledgeability. The record was corrected to say what is now true rather than to soften what was wrong |
| 5 | Medium | **The save boundary destroyed history the person still needed.** Submit `2`, type `3` while the save is in flight, succeed: the post-submission edit could no longer be undone back to the saved value | Submissions carry a **history generation**. `savedDraft` cuts the past at the submitted step and **keeps what came after it**. The undone-past and abandoned-branch cases are handled and tested explicitly |
| 6 | Medium | **Scope and document were caller assertions.** `describeSaveOutcome(rawRefusal, 'edit')` suppressed the whole-document disclosure; the wrong `DocumentId` could be sealed against a result; and a whole-document saved arm with a non-`null` `moved` stayed representable although the protocol says it is `null` permanently and by construction | Two producers — `describeWholeDocumentSave` and `describeEditSave` — replace the free-form `scope` string. `WholeDocumentOutcome` is produced **only** by the seal, and its saved arm **types** `moved: null`, rebuilt rather than passed through |
| 7 | Medium | **`draftKept: true` was an adjective, not a guarantee** — a caller could discard the draft and still get a model saying it was kept. **This record called that "not expressible"**, which was untrue | `ConflictModel<T>` **carries the actual `Draft<T>`**. Reload is a confirmed transition, `confirmReloadDiskVersion` → `reloadDiskVersion`, with a token checked against that conflict. This is also the shape 2c-4a inherits |
| 8 | Low | **Unbounded history** — every keystroke would append a whole document string for the life of a session | `HISTORY_LIMIT = 100`, oldest step dropped first, with the memory arithmetic and **what the user loses at the bound** written down. Coalescing is explicitly the editor's job, not this module's, and it says so |

**The review's closing judgement was answered rather than absorbed.** It held that the shape was
*"not yet adequate for `MatchDraft` or later conflict rebase"* on three counts — aliasing,
post-submission history, and a conflict state not carrying the draft. All three are findings 3, 5
and 7, and `docs/decisions/2c-1a-notes.md` §5 answers each **plainly**, including whether 2c-4b
will need more than this shape gives.

**Five residues are recorded rather than claimed closed** (`2c-1a-notes.md` §4), and the first
three are the same shape: **TypeScript has no linear types.** A caller can still read
`submission.acknowledgement` and pass it beside different text straight through
`commands.saveRawDocument`, where the wire's exact-multiset check is the only backstop; nothing
forces a value to be **sealed** in the first place, and `sealWholeDocumentSave(documentB, resultOfA)`
is undetectable here because the pairing is asserted once by the adapter that issued the save;
`() => {}` still satisfies `ForgetReplacedDocument`, because no signature can require a body to
act. Two more are narrower: `reloadedDraft` is exported and reachable without the confirmation
token, and `deepFreeze`/`deepEquals` cover plain data only while the history bound is arithmetic
rather than measurement.

---

## Phase 2c split — consult disposition

The split of Phase 2c was put to a design consult before any line of 2c was written, by the same
rule 2b-2c's split followed. The consult is `docs/reviews/phase-2c-split-design.md` — held to a
self-contained brief with no web search and no repository exploration, so its answers are about
the design as stated rather than about whatever it might have found by reading. The resulting cut
is `docs/decisions/2c-split-notes.md`.

**Seven questions, seven answers, all adopted. Four changed the cut rather than confirming it.**

| # | Question | Answer | Disposition |
|---|---|---|---|
| 1 | Is putting the **raw whole-document editor first** right, or dangerous? | **Raw editor first** — the small editor introduces changed-field tracking, scalar fidelity, optional-field semantics and projection-to-draft conversion *simultaneously*, so a protocol failure could be misattributed to any of them. A raw candidate is one exact string and isolates the protocol unusually well. *"Saving unparseable text is not itself the danger; saving it without content-addressed, draft-specific acknowledgement is."* | **Adopted, with its prerequisite.** The prerequisite is not optional: a committed replacement must produce a **typed** invalidation effect, not a documented obligation. **That moves the effect out of 2c-3 and into 2c-1a** — the first change to the cut |
| 2 | Is a "minimal but honest" conflict state in 2c-1 sound, or a half-built path never revisited? | **Sound** — *"a deliberately terminal conflict state is a complete first implementation, not a partial implementation of rebasing."* Eight requirements listed for it to be honest | Adopted verbatim as `2c-split-notes.md` §6, plus its prohibition: **no control in 2c-1b may be called "Keep my draft"**, because in the plan that phrase means the 2c-4b rebase. No placeholder buttons; 2c-4's behaviour is an explicit Phase 2c exit requirement instead |
| 3 | Where does **draft-level undo** belong? | **Not a sub-phase.** *"Undo is not genuinely separable from the draft architecture. Its state shape must be designed in 2c-1."* Seven state distinctions listed | **Adopted — the second change.** Undo is deleted as a sub-phase; its shape is 2c-1a's and its coverage extends per editor. The seventh distinction is the protocol's own rule meeting undo: **an acknowledgement is bound to the exact current candidate**, so undoing invalidates consent collected for another |
| 4 | Is **duplicate** a trivial addition? | **No.** A projection-based duplicate loses comments, key order, scalar spelling and quoting, unknown fields, tags and anchors — *"Calling that operation 'Duplicate' would violate the app's preservation promise even if the source match itself remains untouched."* A true duplicate clones the exact source subtree, which `create_match` cannot express | **Adopted — the third change.** Duplicate becomes **2c-3c**, owing a decision before it owes code: a true duplicate (Rust work in `patch/`) or an honestly-labelled *New from supported fields*. Not a button |
| 5 | Which sub-phases are themselves too large? | 2c-3 → three; 2c-4 → three (*"'keep my draft' is the dangerous algorithmic part and shouldn't ship alongside five new UI offers in one commit"*); 2c-5 dissolved | **Adopted — the fourth change.** Five sub-phases became ten |
| 6 | The most likely failure the split does **not** protect against? | *"A successful raw save followed by continued use of stale frontend projections and `MatchId`s"* — the screen can present every arm correctly and still leave the workspace holding stale selections, details, search results and draft targets | Adopted and **written into the split as §8 rather than left to be discovered.** Moving the effect into 2c-1a does not by itself close it: the effect must be **unignorable**, and where TypeScript cannot force that, the residue is recorded as a hole rather than claimed closed — as `2b-2c-3b-notes.md` §7.2 already did for `ReloadAfterRawSave` |
| 7 | What acceptance evidence, given no automated test renders a component? | **Three kinds per sub-phase**: automated model/state tests, **at least one mounted-component interaction test**, and a recorded manual window reading. Per-sub-phase specifics given | Adopted, with one addition of our own — see the decision below |

**The one decision taken here rather than by the consult: this project gains mounted-component
tests, in 2c-1b, scoped.** The consult asked for them; the choice of when and how wide is ours.
`vite.config.ts` has anticipated exactly this decision since 1b-1 in as many words — *"Adding
jsdom later is a deliberate decision, not a default"* — and Phase 2c is where the premise behind
that default expires: its components hold interactive state, and **the acknowledgement round trip
is the highest-risk protocol in the application while living entirely inside a component**, where
a model test cannot reach it and a manual reading cannot regress-test it. The decision is scoped
and not retroactive: the harness is added in 2c-1b and used for the interactive components 2c
introduces; existing components are not back-filled; and **the manual window reading is not
replaced** — a mounted test proves a handler fires, not that a window draws.

---

## Verification — Phase 2c-5 step 7 (COMPLETE — the instrument removed, the harness-free baseline re-derived, three review rounds ending READY, and the phase closed)

**2026-08-24. Step 7 is CLOSED, and with it phase 2c-5 and the whole of Phase 2c.** The removal:
final manifest verified **92/92 OK immediately before deletion** and its digest recorded in the
notes; both probe sources deleted; the two hook files reverted by path (`git restore`, the step's
one permitted git command, stated in the record as prescription rather than proven history); the
2.3 GB scratch tree, four decoys and planted symlink artifacts deleted from the exact paths the
records name; residue sweep clean (targeted identifier search empty; the broad-`probe` matches are
committed history by construction, `git diff HEAD` empty at the reading). The record is
`docs/decisions/2c-5-7-notes.md`.

**Gates on the harness-free tree — measured by the worker and re-run independently by the
orchestrator, twice each where fixes followed**: `cargo test --workspace` **1153 / 0**;
`npm run check` **431 files / 0 / 0**; `npm test` **2125 in 56 files**; `npm run build`
**184 modules**; clippy `-D warnings` clean; `cargo fmt --check` clean; bundle oracle
server-absent / client-present; `cargo tree -p espansoconfig-core | rg tauri` empty.
**The production baseline is now `1153 / 431 / 2125 / 184` and the with-harness figures no longer
describe any tree.** The npm-test −1 against the with-harness 2126 was traced, not assumed, to
`scripts/lint/ipc-detail.test.ts`'s per-file generation; check −1 and build −1 are `src/probe.ts`.

**The review is `docs/reviews/phase-2c-5-7-removal.md`, three rounds, READY at round 3.** Round 1
(NOT READY: 1 High, 2 Medium, 1 Low) found the High **in the phase, not the step**: steps 1–3's
last on-file verdicts were NOT READY while their fix rounds lived only in this file. Discharged by
a commissioned closure round, appended to `docs/reviews/phase-2c-5-{1,2,3}-confirmation.md` under
"Closure round (commissioned at phase closure, 2026-08-24)": step 1 READY as it stood; steps 2 and
3 each left narrower comment-level instances — all three fixed (`backup.rs` lexical-containment
test comment, endorsed as "still worth doing" by this file's own §; `persist_backup.rs` marker
helper doc; `restore.ts` `PendingRestore`/`confirming` presentation docs). The three round-1 prose
findings in the notes were fixed with the counts re-measured before writing (broad sweep 29, docs
identifier count 29 pre-record / 30 with it). Round 2 (NOT READY: 1 Medium) found one further
marker-provenance sentence at `write_batch_marker`; fixed to recognition/eligibility with the
orchestrator's own shape sweep reading every `minted|mints|provenance|trusts` site, and round 3
verified the fix, re-swept independently, and returned **READY** — closing the step and the phase.
Rounds 1 and 2 were captured verbatim by the orchestrator (read-only sandboxes); round 3 and the
closure round were written by the reviewers themselves.

**What the next phase inherits explicitly** (round 1's list, on file in the review): the four
probe-writer pathname rebindings (deleted, never proven closed — any rebuilt harness inherits
them); the four live-window-unreachable states; the unmeasured enabled-state half of the
conflict-moment covering; the missing real-keyboard activation evidence; the
no-command-counter limitation (unchanged final bytes do not distinguish no write from an identical
or transient write); and the corpus fixtures plus the owner's real configuration, never exercised
by the window harness.

## Verification — Phase 2c-5 step 6b (COMPLETE — the reading, its fix round, the round-1 disposition, the twelve re-takes, and a round-2 READY)

**2026-08-24, closure. 6b is CLOSED.** The twelve owed re-takes were taken as **P87–P98** on an
unlocked console (`CGSSessionScreenIsLocked` absent from `IOConsoleUsers`; a display-asserting
`caffeinate -d -u` held through the run), all on the fix-round binary `371fc7c1…`, its digest
re-verified before the first launch. §11.7 licenses the ten part-2 cases moving off `c4f2ae02…`:
only `restore-notutf8` traverses the code the fix changed, so one binary serves all twelve.
**Every launch's own transcript prints `visibility=visible`** — verified per transcript by the
orchestrator, independently of the worker's report — with `hasFocus=true`, `end-lines=1`,
`failed-lines=0` and `probe.err=0 bytes`, and the four committed launches passed the by-hand
displaced-bytes readings (P91/P92 minted batches `cmp`-identical to `base-r0.yml`, P95/P96 to
`elsewhere-r1.yml`). Record §13 (13.1–13.12 the per-launch entries, 13.13 the re-earned §8 rows,
13.14 the closure) discharges §12's obligation. One defect was found and fixed during the
orchestrator's verification, before the review: §13.14's status sentence claimed the tree held
"exactly the four harness paths, and nothing else" while the record itself sat modified by the
very append that wrote the sentence — the record-claims-what-is-false shape — and now names its
own modification, matching §11.9's precedent. **The round-2 review is READY with no findings**,
written by the reviewer itself into `docs/reviews/phase-2c-5-6b-reading.md` under "Round 2" (a
writable sandbox this round, unlike round 1's capture): all twelve launches meet §12's
launch-local acceptance term, the artifacts agree with the standing shapes and §13.1–§13.12, the
§9/§12 edits resolve both round-1 findings, and the §11.7 binary license holds.
**`manifest-2c-5-6b-reading.sha256` is written and verifies 92/92 OK** — five scripts, thirteen
fixtures, both probe sources, and `probe.log` + `bytes.txt` for every 6b launch P63–P98. Gates
were **not** re-run at closure, deliberately: no product, driver, script or fixture file changed
after the fix round's double re-derivation — the closure touched only the record, the review file
and the manifest — so the with-harness baseline stands at `1153 / 432 / 2126 / 185` as derived
below. The account that follows is the partial state as it stood before the re-takes, kept as the
history of the round-1 disposition.

**2026-08-24. 6b is NOT closed.** What is done: **twenty-four launches** — P63–P74 (part 1: `restore-none`,
`restore-prepare`, `restore-replace`, `restore-conflict`, `restore-skipped`, `restore-notutf8`, each
en then es, binary `c4f2ae02…`), P75–P84 (part 2: `restore-preview-bytes`, `restore-withdraw`,
`restore-findings`, `restore-nothing`, `restore-reload`, each en then es, same binary), and P85/P86
(the fix round's bilingual re-takes of `restore-notutf8` on the rebuilt `371fc7c1…`). All
twenty-four: `failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`; all six by-hand displaced-bytes
readings taken (P67/P68/P79/P80 minted batches `cmp`-identical to `base-r0.yml`; P83/P84 to
`elsewhere-r1.yml`). The record is `docs/decisions/2c-5-6-window-reading.md` (§§1–12); the
orchestrator resolved the checkpoint's open scoping question **restore states only** (Q7 item 6 is
authoritative; the write surfaces had their own bilingual readings), and the review verified that
resolution against the design.

**The reading found one Medium and judged one Low, and the fix round closed the Medium.** Medium
(part 1, P73/P74): the refused non-UTF-8 read drew two sentences each promising "the reason beside
this" with nothing supplying it — `code.backupReadError.notUtf8` existed in both dictionaries and
was unreachable, `tBackupReadError` having no component caller. Fixed in
`src/lib/components/RestorePane.svelte` (+38: both failed panels now draw the nested
`BackupReadError` through the typed accessor via `backupReadReasonOf()`), proven by two new mounted
cases in `RestorePane.test.ts` (+68) and by P85/P86 in both languages; `src/probe.ts`'s
`reportRefusedEntryRead` gained a third dictionary-resolved wait; re-take scope P85/P86-only,
review-confirmed against the component's branches. Low (P83/P84): the conflict-moment covering —
the sticky actions row under the app header — **accepted as recorded**: the covered control is
disabled at that moment, both exits hit-test clean, the enabled-state half named as unmeasured.

**The phase review (round 1) returned NOT READY** — captured verbatim to
`docs/reviews/phase-2c-5-6b-reading.md` (read-only sandbox, standing capture rule). Eleven sampled
transcripts record-exact, coverage table complete, all four 6a §6 unreachability arguments verified,
fix and re-take scope confirmed. **Its Medium: the record's completed-timers occlusion derivation
was unsound** — all ten part-2 launches and both re-takes printed `visibility=hidden hasFocus=false`
at plan start, and the record derived they "could not have" stayed hidden; but the driver's ~6 s
grace plus waits that return immediately make a completed plan compatible with a window hidden
throughout. **Disposition (record §12): the derivation is withdrawn in all three places it stood;
P75–P84 and P85/P86 are re-classified as document-and-filesystem readings (their byte lines stand;
their screen claims do not), and twelve re-takes are owed — P87 upward, same cases and languages on
binary `371fc7c1…`, each accepted only if its own transcript prints `visibility=visible`.** They
were not taken: at the post-review check the console answered `CGSSessionScreenIsLocked = 1`, and
no launch can present behind a locked screen. (The lock's timestamp postdates most part-2 launches;
what hid the windows mid-run is unmeasured — plausibly display idle-sleep — and unclaimed.) The
review's Low (a "three"-for-four count in §9) is fixed. **A round-2 review scoped to the re-takes
and the §12 edits is owed once the re-takes are taken.**

Gates re-derived twice after the fix round — by the fix worker and independently by the
orchestrator: `cargo test --workspace` **1153 / 0 failed**; `npm run check` **432 files / 0 / 0**;
`npm test` **2126 in 56 files** (+2, the new mounted cases — prediction matched measurement);
`npm run build` **185 modules**; clippy `-D warnings` clean; `cargo fmt --check` clean; bundle
oracle **server-absent / client-present → 2**. **The with-harness baseline is now
`1153 / 432 / 2126 / 185`.** The tree gains launches P63–P86; no manifest was written (the closure
writes the final post-image); `manifest-2c-5-6a-cases.sha256` still fails on `src/probe.ts` only,
`manifest-2c-5-6a-fix.sha256` now on `src/probe.ts` plus its already-failing 6a-record entry — kept
as the record of the fix round. The 2c-5-7 deletion list is not lengthened.

## Verification — Phase 2c-5 step 6a (the instrument extended to every restore state 6b must reach)

**2026-08-24. Step 2c-5-6 — the bilingual WKWebView reading — was split by the orchestrator into 6a
and 6b, exactly as 2c-5-5 was cut: 6a extends the instrument to every restore state the reading must
reach, 6b is the reading itself. 6a is COMPLETE: seven new cases proven by launch, four demanded
states argued unreachable with code-grounded arguments, the reporter machinery for 6b's
keyboard/focus/scroll/hit-testing obligations built and exercised, one review round NOT READY on two
prose findings, a fix round, and a second round READY with no findings.** The record is
`docs/decisions/2c-5-6a-instrument-extension.md` (§1 the work-list dispositions, §6 the four
unreachability arguments, §10/§10.1 the review dispositions); the reviews are
`docs/reviews/phase-2c-5-6a-instrument.md` (round 1: one Medium, one Low — both prose, no instrument
defect) and `…-round2.md` (READY), both captured verbatim under the standing read-only-sandbox rule.

**The seven cases and their states**: `restore-skipped` (P55 — the three `BatchSkipped` arms
`ForeignName`/`NotADirectory`/`NoMarker` drawn from one seeded junk set; `Unreadable` deliberately
not seeded — it breaks `cp -R`/`diff -r` themselves and Q7 does not demand `batchesIncomplete`),
`restore-notutf8` (P56 — the refused read, `entriesRefused` drawn), `restore-preview-bytes` (P58 —
BOM, BEL and bare-CR names all drawn; the geometry reporter's first run), `restore-withdraw` (P59 —
withdrawal by catalogue change, where 5b's P51 was a decline by control), `restore-findings` (P60 —
`DocumentDoesNotParse` acknowledged and the unparseable text committed; `acknowledgedAsksAgain`
drawn), `restore-nothing` (P61 — `committed: false`, no backup minted), `restore-reload` (P62 —
the conflict adopted through the two-step reload, adoption `installed`, then a commit over the
adopted base; the hit test caught the sticky actions row sliding under the app header with the
prepare control disabled at that moment — 6b judges whether that covering matters). P54 and P57 are
retained superseded demonstrations (`diff -r`'s symlink-loop guard; the CRLF-only fixture that drew
no CR name, which is `sourceText.ts` naming only a lone CR — the fixture gained a bare CR). All on
binary `c4f2ae02…`, pinned per launch; **`src-tauri/src/probe.rs` untouched, no confinement
widened, no N/C launch owed**; the four residual rebindings stay inherited-open.

**The four unreachability arguments (record §6), each verified against the shipped code by round 1**:
open-surface refusal (DetailPane's surfaces are mutually exclusive — the restore pane is never drawn
beside another surface); the persistent `targetMoved` sentence (the projection re-observation
re-points a moved revision, and `alreadyRestored` orders ahead of it); adoption
`alreadyThere`/`refused` (no reachable restore-pane control independently moves the projection); and
committed-but-reprojection-failed (**P60 measured the hypothesized deterministic route closed** — a
parse failure is a diagnostic on a successful projection, not an IPC refusal, so producing the state
needs a nondeterministic race plus a `probe.rs` change; 2c-5-3's model evidence keeps covering it).
Q7's own "where reachable" qualifier licenses all four dispositions.

**The review rounds.** Round 1: Medium — two `src/probe.ts` comments claimed the `findings` tail
reaches a failed window-side re-read, the record's own §6.4 having said the opposite correctly (the
record-over-claim defect class, living in a comment); Low — three transcript misreadings in the
record's §4. Both fixed (comments and markdown only; no behavior, no launch re-taken); the
shape-sweep also sharpened one §6.4 sentence ("line" → "sentence"). Round 2, scoped to the fix,
returned **READY with no findings** and verified the sweep left no narrower instance standing.
`manifest-2c-5-6a-cases.sha256` (38 entries) now fails on exactly `src/probe.ts`, kept as the
record of the fix; `manifest-2c-5-6a-fix.sha256` is the fix-round post-image (its record entry
fails in turn, recording §10.1's own write — stated there).

Gates re-derived **three times** — by the worker after the last driver edit, independently by the
orchestrator before round 1, and again after the fix round (prediction: no movement; measured: no
movement): `cargo test --workspace` **1153 / 0 failed**; `npm run check` **432 files / 0 / 0**;
`npm test` **2124 in 56 files**; `npm run build` **185 modules**; clippy `-D warnings` clean;
`cargo fmt --check` clean; bundle oracle **server-absent / client-present → 2**. The repository
holds the four harness paths plus this step's record and two review files, and nothing else; the
hook diff still reads 5 insertions / 1 deletion; no mutating git command ran during the worker's
part. The tree gains `byte-fixtures.sh`, three byte-exact fixtures (digests in the record's §2.2),
launches P54–P62 and the two manifests; **the 2c-5-7 deletion list is not lengthened** (no new
decoys or outside-tree artifacts).

## Verification — Phase 2c-5 step 5b (the restore cases, and the second rebuild of the tree)

**2026-08-24. 5b is COMPLETE: both parts built, launched and recorded, and its one review round
returned READY with no findings — the first READY any instrument step of this project has produced;
5a never got one in seven rounds.** The record is `docs/decisions/2c-5-5b-instrument-cases.md`
(§§1–8); the review is `docs/reviews/phase-2c-5-5b-instrument.md`, captured verbatim by the
orchestrator because the reviewer's sandbox was read-only — the same capture rule 5a's rounds 6 and 7
used; the record's §8 is the disposition.

**The scratch tree was lost a second time before this step began.**
`/private/tmp/espansoconfig-harness-2c-5/` did not exist when the session resumed — a `/private/tmp`
wipe took all sixty-six retained launches, the three manifests and the nine decoys; the four probe
paths in the repository survived, with the hook diff still reading exactly 5 insertions / 1 deletion.
Part 1 rebuilt the tree **at the same path** from the 5a record's §2/§3 plus the surviving driver
sources, touching none of the four probe paths, and proved the rebuild on the new binary
(`08229f8c…`): **P49** re-ran `editor-third:en` and reproduced §4.1's transcript shape with
`bytes=MATCH` against `third-r2.yml`; **N09** was the no-plan control (zero-byte transcript, target
unchanged); **C11–C15** re-took the five confinement controls, each documented refusal quoted in its
transcript. Launch numbering continues the lost ranges (P49+, N09+, C11+) so no rebuilt launch can be
mistaken for a 5a artifact; `manifest-2c-5-5b-rebuild.sha256` (29 entries) is the part-1 post-image.
The record's §1 states the loss from the filesystem alone, and 5a's measurements remain readings of
that tree's binary `0a2d3506…` — this tree's controls are the re-takes for its own binaries.

**Part 2 built the four restore cases** — one driver edit (`src/probe.ts`: `restorePlan` plus four
step-scoped helpers, each `section.step` resolved by its translated heading) and `launch.sh`'s
seeded `.espansoconfig-backups` catalogue, every layout choice cited from
`crates/espansoconfig-core/src/persist/backup.rs` in the record's §3.1, plus three restore-only
independent byte-oracle lines (`entry-cmp=`, `backup-tree=`, `batches=`). On binary `6d3a80de…`:
**P50** (`restore-replace:en`) reached catalogue, entry, candidate, prepare and replace in one
launch, with `bytes=MATCH` against the entry, `entry-cmp=MATCH`, `backup-tree=SAME` and
`batches=before:1 after:2` — the restore's own backup observed without disturbing the seeded batch;
**P51** (`restore-prepare:es`) reached the question and declined it, nothing written; **P52**
(`restore-conflict:en`) put the second writer between the question and the confirmation and read this
tree's own fixture digests in the conflict panel, no backup taken; **P53** (`restore-none:es`) read
the listed-and-empty catalogue. `failed-lines=0` and `end-lines=1` on every launch;
`reportReapply` was never called for a restore; **`src-tauri/src/probe.rs` was not touched** and
`TARGET_TAIL` is unwidened, so §8.2 item 7's test obligation never triggered.
`manifest-2c-5-5b-cases.sha256` (24 entries, all verify) is the part-2 post-image; part 1's manifest
was not regenerated and now fails on exactly the two files part 2 edited, kept as the record of the
change. What 5b deliberately does not reach is enumerated in the record's §5.

Gates re-derived **twice** — by the part-2 worker after the last driver edit, then independently by
the orchestrator before the review: `cargo test --workspace` **1153**; `npm test` **2124 in 56
files**; `npm run check` **432 files / 0 errors / 0 warnings**; `npm run build` **185 modules**
(predicted zero movement, measured zero movement); `cargo clippy --workspace --all-targets -- -D
warnings` clean; `cargo fmt --check` clean; bundle oracle **absent / present → 2**. The repository
holds the four harness paths plus this step's record and review file, and nothing else; no mutating
git command ran during either part.

**One geometry note supersedes the 5a tree's:** this tree's launches measured the viewport at
**`1180x728 dpr=2 visible`**, where the lost 5a tree's P37–P48 reported `720x728 dpr=1`. Under §6.8's
incomparability rule neither figure judges the other, and 2c-5-6 still owes its own geometry.

## Verification — Phase 2c-5 step 5a (closure by owner decision)

**2026-08-24. 5a is CLOSED by path B — the owner's deliberate exception to the standing rule; the
eighth review round the round-7 fixes owed was deliberately not run.** The decision was put to the owner
as the record's §15.5 framed it — two paths, the standing rule's prescription named as the default — and
the owner chose acceptance. Changes: **markdown only** — `docs/decisions/2c-5-5a-instrument-rebuild.md`
(§16 appended, plus three closure edits above it: the preamble's first sentence, the ledger's §15.5
sentence and §9's "latest" sentence, each updated because appending §16 would otherwise have falsified
it — the record's own append-falsifies-a-count mechanism, handled at the append for once) and this
checkpoint. **No code file, no test, no launch.** No Codex round ran for the closure — that absence is
the decision itself, not an oversight.

Gates re-derived at closure, with the harness in the tree (recorded in §16.5): `cargo test --workspace`
**1153**; `npm run check` **432 files / 0 errors / 0 warnings**; `npm test` **2124 in 56 files**;
`npm run build` **185 modules**, emitting `index-I5AFZyLL.js` unchanged since round 4;
`cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --check` clean; bundle oracle
read in both directions — server-only `\$\$payload|head_payload|push_element` **absent**, client-only
`window\.__svelte|svelte-trusted-html` **present → 2**.

## Verification — Phase 2c-5 step 5a (the window instrument, rounds 6-7 of its review)

**Status: NOT COMPLETE.** Round 7's three fixes — plus the three extras (§15.8) the fix round's own
sweep found — are applied and verified; **the eighth round they owe under the standing rule has not
been run, and whether to keep paying for it is an owner decision, stated in the record (§15.5) and
deliberately not taken unilaterally.** See "Next action" for the two paths.

**Provenance.** This section was written one session after the rounds it records, from the committed
artifacts: `docs/decisions/2c-5-5a-instrument-rebuild.md` §§14–15, the two captured review files and
this file's "Next action", all committed at `01461c0`. That commit updated "Next action" and the
rebuild record while this file's Status table and this verification chain stayed one session stale —
the going-stale-against-itself shape those rounds kept finding — and this section is the correction.

**What the rounds-6–7 session did.** Two Codex confirmation rounds and two fix rounds, alternating,
beginning where the previous session left off: round 5's fixes applied and unreviewed.

| Round | Findings | Ceiling | Instrument defects | Fixed by |
|---|---|---|---|---|
| 6 (`-round6.md`) | 3 | Low | **None.** | orchestrator by hand (wording dictated by the review), + 2 extra by shape sweep (§14.7) |
| 7 (`-round7.md`) | 3 | Low | **None.** | orchestrator by hand (wording dictated by the review), + 3 extra by shape sweep (§15.8) |

**Both rounds answered "did the fix round create anything?" with YES** — the sixth and seventh
consecutive rounds to do so — and **neither found an instrument defect in either probe source**:
`### Instrument defects` is "None." in both review files, so the instrument has been still since
round 2 and the whole remaining defect surface is this record's prose about its own review history.
Five of the six findings between them were bookkeeping — how many rounds, which section is latest,
which review file is which round — and the mechanism is mechanical: each round appends a section,
the append falsifies a count above it, the next round finds that. §15.8's extras 2 and 3 are that
mechanism operating on §14, the section written one round earlier to document it. **No round has yet
returned READY.**

**What rounds 6 and 7 CLOSED**: all three round-5 findings (round 6); round 6's findings 1 and 3,
finding 2 partially, and both §14.7 extras (round 7). Round 7 also re-verified the
four-residual-rebinding disclosure intact across §8.1, §13.5, §14.5 and the `probe.rs` module note —
open and disclosed, accepted not proven, untouched by either fix round.

Both rounds ran read-only and could not write their own review files; the orchestrator captured each
final message verbatim to `docs/reviews/phase-2c-5-5a-instrument-round{6,7}.md`. **Rounds 6 and 7
changed markdown only** — no executable line, no test, no fixture — so no gate could have moved, and
"Next action" records the with-harness figures re-derived unchanged after the round-7 fixes:
**1153 / 432 / 2124 / 185**.

## Verification — Phase 2c-5 step 5a (the window instrument, rounds 3-5 of its review; **superseded — rounds 6 and 7 ran next, see the section above**)

> **Superseded.** This section is kept as written at the time. What has changed since: the round-6
> confirmation it says has not been run **has been run**, and so have round 7 and both fix rounds —
> the section above is their account, and the trend line now reads 8 → 4 → 5 → 6 → 3 → 3 → 3. Where
> this section says the step waits on the round-6 confirmation, read it as the state at the time it
> was written.

**Status: NOT COMPLETE.** Round 5's three fixes are applied and verified; the round-6 confirmation that
must review them has not been run. See "Next action".

**What this session did.** Three Codex confirmation rounds and three fix rounds, alternating. It began
at the point the previous session left: round 2's fixes applied and unreviewed.

| Round | Findings | Ceiling | Fixed by |
|---|---|---|---|
| 3 (`-round3.md`) | 5 | Medium | phase worker, + 4 extra by shape sweep |
| 4 (`-round4.md`) | 6 | Medium | phase worker, + 5 extra by shape sweep |
| 5 (`-round5.md`) | **3** | **Low** | orchestrator by hand (wording dictated by the review) |

**Every one of the five rounds answered "did the fix round create anything?" with YES.** That is why
none closed without a successor, and it is the reason this step has taken five rounds. The trend is the
reading that matters: 8 → 4 → 5 → 6 → 3, ceiling **High → Medium → Low**.

**The substantive outcome: Arm A of round 2's High is PARTIALLY CLOSED, never closed.** Round 3 found
that the round-2 fix — replacing `/bin/sh` with `create_new` → write/sync → `rename` — had **created** a
new check-and-spend gap, because `rename` re-resolves the temporary *pathname* and the source is
reopened by pathname after its check. The orchestrator chose the **reclassify** branch over the
`openat` branch: no `libc`, no new primitives, **no code behaviour changed in any of the three fix
rounds**, and the claims withdrawn instead. Round 4 then found the reclassified list was itself
non-exhaustive — `fixtures` is a **sibling** of `launches`, so "an ancestor of the launch tree" never
covered a source-ancestor rebinding — and the list went from three to **four**. Round 5 enumerated the
re-resolutions **from the code rather than against the list** and confirmed **four with no fifth**.

**Four residual rebindings are open and disclosed**, in `probe.rs`'s module note and §8.1 in the same
terms: source final component; temporary name after `create_new`; an ancestor of the target's pathname;
an ancestor of the source's pathname. Accepted — operator-controlled launch root, never-shipped binary,
deleted at 2c-5-7 — and **acceptance is not proof of impossibility**.

**Two label defects, one per round, both of the same shape.** §9.1 credited **C06** with measuring the
direct-child source constraint it never exercises (round 4), and then, when every label was re-checked
individually, **C09** with the exact-shape rule it never reaches (the fix round's own sweep). C10 alone
measures target shape. Round 5 re-checked every remaining label and found them all sound.

**Three count contradictions, found one per round by sweeping for the shape rather than the words.**
`74` vs a measured `75` of 78 manifest entries; "sixty-five launches" where §5.8 and §5.10 both give
**66**; and "the proof set" meaning **twelve** in §4 and **nineteen** in §1 and §5.10 — now two defined
terms, the *twelve plan-proof launches* and the *nineteen-launch complete proof set* (12+2+2+3=19).

**One false claim about the tree, caught by measurement and independently re-measured by the
orchestrator.** §1/§5.10/§6.4 said the proof binary is byte-identical to `target/debug/espansoconfig`
*"as it stands now"*. It is not: that path answers `04988c09…` (re-measured by the orchestrator with
`shasum -a 256`, agreeing exactly), while P37's and C10's retained bundles still answer `0a2d3506…`.
All three sentences now bind the equality to **when it was read**.

**Also settled by round 5, and worth not re-litigating:** the `drop(handle)` close-error disclosure is
correct and not overstated (Rust's `File` drop path cannot report a close error to this code; a checked
`sync_all` is a genuine mitigation without proving close succeeded), and `dispatchEvent`'s discarded
boolean is a **genuine non-instance** of the check-and-spend shape, because all three constructed events
omit `cancelable` and so it cannot return `false`.

**Gates, re-derived by the orchestrator after every fix round, never taken from a worker's report**
(with the harness in the tree): `cargo test --workspace` **1153**, `npm run check` **432 files / 0
errors / 0 warnings**, `npm test` **2124** in 56 files, `npm run build` **185 modules**;
`cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` exit 0. Bundle oracle
read on **both** lines, because a bare `svelte/internal/server` search is a vacuous negative: server-only
sentinels **absent**, client-only constructs **2 (present)**, `probe_third_writer` **1**,
`probe_second_writer` **1**.

**No launch was re-run and no new measurement is claimed by any of the three fix rounds.** Every fix
withdrew, narrowed or corrected a claim. The one exception is filesystem reads: two `shasum` readings
taken to settle the binary-identity claim above, which is a read and not a launch.

**Decision records:** `docs/decisions/2c-5-5a-instrument-rebuild.md` §11, §12 and §13 are rounds 3, 4
and 5's dispositions. **Reviews:** `docs/reviews/phase-2c-5-5a-instrument-round{3,4,5}.md`. Round 4's
Codex job wrote its own review file; round 5's sandbox was read-only and the orchestrator captured the
reply with `node "$CC" result <job-id> >` that path — **check whether the file exists and is substantive
before writing to it**, because redirecting over a file Codex already wrote destroys the full review.

---

## Verification — Phase 2c-5 step 4b (the restore screen, and the phase's whole mounted evidence)

**The record:** `docs/decisions/2c-5-4b-notes.md`. **The rounds:** `docs/reviews/phase-2c-5-4b-code.md`,
then `phase-2c-5-4b-confirmation.md`, `phase-2c-5-4b-confirmation-2.md`,
`phase-2c-5-4b-confirmation-3.md` and `phase-2c-5-4b-confirmation-4.md` — one code review, four
confirmation rounds and a documentation fix, **six in all**. The finding-by-finding roster is the
"Phase 2c-5-4b review disposition" section above.

### The gates

| Gate | Before | After 4b | Note |
|---|---|---|---|
| `cargo test --workspace` | 1153 | **1153** | unchanged; **no Rust file was touched** by the step or by any of its fix rounds |
| `npm run check` files | 426 | **431** | 0 errors, 0 warnings; +5 source files — `restoreFacts.ts`, `restoreFacts.test.ts`, `restoreCodes.test.ts`, `RestorePane.svelte`, `RestorePane.test.ts` — and no later round added one |
| `npm test` | 1958 | **2123** | 56 files. +70 at the step, +46 in the fix round, +39 in the confirmation round, +9 in the second, +1 in the third |
| `npm run build` modules | 181 | **184** | **predicted before building, and it held** |

**The module arithmetic, predicted and then measured.** `CLAUDE.md` §6: a new `.ts` module reachable
from the entry costs one, and a new component **with a `<style>` block costs two**, because the block is
a module of its own. So `RestorePane.svelte` is **+2** and `restoreFacts.ts` is **+1**, the prediction
written before the build was **184**, and the build answered 184. `restore.ts` was already reachable as
of 2c-5-4a and contributes nothing. **The `<style>` half was measured rather than inherited**, as
2c-4c-3a's was: the block was deleted, the build came back **183**, and it was restored to **184**.

The bundle oracle was run in the discriminating form the 2c-5-2 entry established, **not** the vacuous
bare `svelte/internal/server` search, and **both** lines were read:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   # → no match (ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    # → 2 (PRESENT)
```

**Every gate above was verified independently by the orchestrator**, not taken from a worker's report.

### What 4b built

`src/lib/components/RestorePane.svelte` is the restore screen and the **seventh write surface** — the
third-pane mode consult Q5 asks for, reached from the document's whole-text surface, with **three
stacked states**: the recognised batches, then the entries, then the exact candidate rendered through
`SourceText` with `documentStart` passed, so a byte-order mark is drawn as one. Beside it:

- **`src/lib/browser/restoreFacts.ts`** — `candidateMeasurements` and `distinctReasons`, the arithmetic
  the screen states about a candidate, kept out of markup. Its suite drives a byte-order mark, a CRLF
  pair, a precomposed and a decomposed `é` and an astral emoji, and asserts all three numbers a screen
  could confuse: 22 UTF-8 bytes, 16 UTF-16 code units, 15 code points.
- **The labelled loaded-target observation** — a second stacked `SourceText`, named as *the window's
  loaded observation* and never as current disk state.
- **A sticky two-stage control**: *Prepare*, then a **visually distinct** *Replace entire file*.
- The catalogue states, the save outcomes, a `conflictChoicesFor` conflict panel with `offersReload`
  flipped to **`true`**, and parse-finding acknowledgement that **re-asks the question**.
- **`DetailPane.svelte`** reaches the mode and owns the two things no coordinator can derive:
  `openWriteSurfaces()` and the synchronous `invalidateEverySurface()`. `restoring` joins `busy`, so the
  seven write surfaces stay mutually exclusive.
- **50 new `browser.restore.*` keys per dictionary**, and `tRestoreRefusal` **added to
  `src/lib/i18n/index.ts` and called**. A component renders a code by calling an accessor, **never** by
  building a key.

**The mounted evidence is the phase's, and it runs over a real `BrowserState`.** `RestorePane.test.ts`
mounts the pane over `createBrowserState` with scripted `BrowserCommands` **and** `BackupCommands`, so a
case that presses *Replace entire file with the shown text* is asserting what reaches
`commands.saveRawDocument` — the destination, the base revision, the exact bytes and the acknowledgement
— through the real coordinator, the real permit and the real seal. It was written as **27 cases**; the
fix round grew the forbidden-claim scan from 2 cases to 32, and the suite stands at **59**.
`BackupCommands` is **injected explicitly in every mounted case** — 4a's hand-forward, because the
surface has a real production default and an omission reaches `invoke` rather than a script — and a
**hoisted mock** of `@tauri-apps/api/core` asserts **no direct IPC call**.

### The `ConflictChoice` widening, taken deliberately outside this step's stated scope

`conflictChoiceKey` picked the confirmation's label from `ConflictDraftKind`, and restore's kind is
`operationChoice`, so restore's confirm control read *"Close this and load it"* — **false**. Restore's
reload closes nothing and discards nothing: it installs the disk observation, keeps the candidate, moves
the base revision to the conflict's `diskRevision` and withdraws the confirmation, with the panel still
open. That is `retargetsCandidate`, the reload outcome 2c-5-3 added because both existing arms are false
sentences here. **A false label on the destructive step of a whole-file replacement is this project's
worst defect class on the worst control in the application to carry it.**

Two answers were available and the cheaper one was taken deliberately. Making the label depend on
`ConflictReloadOutcome` directly means widening `conflictChoiceKey`'s and `tConflictChoice`'s second
parameter at roughly **150 call sites across eight suites** — a cross-cutting rewrite to fix one label,
in a step whose subject is a screen. Instead `ConflictChoice` gained a **sixth member,
`confirmReloadKeeping`**, and `conflictChoicesFor` — still the only producer of a choice list — picks
between the two confirmations from the surface's declared `reloadOutcome`, through a `switch` so a
fourth arm of that union is a compile error rather than a silent inheritance.

**`retargetsCandidate` is declared only by `restore.ts`'s `CONFLICT_CAPABILITIES`**, so the other seven
surfaces still route through `confirmReload`, **every existing key is byte-identical, and no shipped
sentence moved** — verified independently rather than merely asserted, and §2.4.1 of the record carries
the correction block naming exactly what establishes it: the diff and an independent inspection, **not**
a test, because no executable test in this repository compares a rendered label against a pre-change
snapshot. The cost was **one compile-error-driven dead arm in each of seven components** — `MatchEditor`,
`MatchCreator`, `MatchDeleter`, `MatchMover`, `MatchDuplicator`, `RawEditor` and `RecoveryPanel` — closed
the way those files already close `copyDraft` and `keepMyDraft`.

### Six rounds, and one shape behind all of them

**This is the step's central lesson, and it is not about restore.** Every round closed one instance of a
single shape and the next round found a **narrower** one — **three times running, each created by the
previous round's fix**.

The shape: **a check and a spend separated by any property read are not atomic in JavaScript.** A
property read runs arbitrary code through a getter or a proxy trap, `readonly` does not freeze at
runtime, and the absence of `await` proves **nothing whatever** about synchronous re-entry.

- **Round 1** (`docs/reviews/phase-2c-5-4b-code.md`) — **2 High, 1 Medium, 2 Low**. H1: `confirmRestore`
  minted the permit from caller-controlled reads *after* the checked spend, so a getter could make the
  submitted bytes differ from the confirmed candidate hash. H2: `cancelRestore` and `withdrawn()` cleared
  `session.pending` but left the object **registered**, so a retained pre-cancellation session could
  still confirm.
- **Round 2** (`phase-2c-5-4b-confirmation.md`) — the fix had introduced a frozen `RestorePermit` in a
  `PENDING_AUTHORIZATIONS` WeakMap. H1 became **partially** closed: `prepareRestore` read the base
  revision from **two separate caller-controlled sources**, `permitHolds` checked one and `sendRestore`
  sent the other. H2 was **still open**: `revokeConfirmation`'s own first operation was `session.pending`,
  so a getter there could mint the permit before the deletion ran, and `reloadTheDiskVersion` was omitted
  from the withdrawal set **entirely**. Plus a **new** High: the round's own adjudication of
  `adoptDiskVersion` was unsound — projection generations are **per document**, so alternating getters
  across **two** documents let one confirmation install two projections.
- **Round 3** (`phase-2c-5-4b-confirmation-2.md`) — H1 and H3 closed. H2 partially: re-keying the WeakMap
  by the exact asked `RestoreSession` made `revokeConfirmation` a **bare reference operation**, but
  `targetRevisionObserved`'s take-and-put-back **removed** the authorization while inspecting, and
  `prepareRestore` reads absence as permission to register a second question — so two live authorizations
  could both send. Plus a Low: `candidateRead` revoked **before** deciding a response was stale, so an
  irrelevant in-flight read withdrew a valid question.
- **Round 4** (`phase-2c-5-4b-confirmation-3.md`) — **no High, no Medium.** H1, H2, H3 and the round-3 Low
  all confirmed closed by a private `SuspendedQuestion` marker: the permit is **replaced** under the same
  key rather than removed, `confirmRestore` rejects it, `takeTheQuestion` rejects it so `carryTheQuestion`
  cannot move it, `prepareRestore`'s existing bare `has` counts it as an existing question **with no code
  changed there**, and restoration is **identity-checked from a `finally`**. One Low, in
  `unchangedByInspection` — the helper added *beyond* the review's minimal fix.
- **Round 5** (`phase-2c-5-4b-confirmation-4.md`) — no High, no Medium; the Low closed. One Low remained
  in a **JSDoc comment** and was fixed directly: it claimed *"call it only after `revokeConfirmation`"*,
  which `carryTheQuestion` does not satisfy.

**The lesson, in this project's own voice, because it generalizes past this step: removing a token to
protect it creates a false "nothing here" state for every other producer that tests for presence.** That
is precisely how round 3's fix became round 4's defect — the take-and-put-back protected the *spend* and
handed the *mint* a licence, because `prepareRestore` reads absence as permission to ask a second
question. **The answer is to replace the token with a private marker the other producers still count as
present, never to take it out.** A sweep for consuming operations cannot find that defect; the sweep that
finds it asks, of every state a value can be in mid-call, **which other producer can observe it**.

**A second lesson: code added *beyond* a review's minimal fix is the least-reviewed code in a change**,
and **both** of the last two rounds' findings were in exactly that code — `unchangedByInspection`, and
the JSDoc written alongside it.

**A third: a count in a decision record rots.** *"Exactly eight operations"* and *"the third caller"* were
**both wrong when they were written**, because callers had already been added that neither counted. They
are now an access-site table and an **unnumbered** enumeration of three call families. An enumeration
without a total does not rot as callers are added; a count does.

### The evidence for the fixes

**Every fix round verified its regressions fail against counterexample builds**, each applied alone, the
suite run, the failures read and every other case observed passing. Round 3's fix ran **five**:

| Counterexample | Cases that failed |
|---|---|
| **A** — the reviewed defect: the suspension `delete`s and the put-back is unconditional | **9** |
| **B** — `takeTheQuestion` unwraps a suspension | **1**, the carry case, and nothing else |
| **C** — the put-back is not identity-checked | **4** |
| **D** — `confirmRestore` unwraps a suspension | **3** |
| **E** — `candidateRead` revokes first, as the previous round shipped it | **5** |

**B is the reason the carry rule is written down**: no other case in the file, new or old, notices when a
suspension can be carried away. The final fix's counterexample — the `unchangedByInspection`
short-circuit restored, alone — produced **exactly one failure, the new case**, with the other **2122**
passing, including every case in `RestorePane.test.ts`. That is the discrimination a regression owes.

**The eleven pre-existing sequential cases stayed green against the counterexample built for the
withdrawal fix**, where six cases failed — four re-entrant ones, the callback one, and the new sequential
row for the omitted transition. **That is why they never found the defect: no sequential test can.**

### What is still open, and it is one pairing

`preview.revision` and `preview.draft.value` are **two separately readable properties**, the first a hash
of the second, and **nothing in the current interface can prove the backend-supplied hash describes the
captured bytes** — there is no hash function on this side of the wire. This is scoped as **cannot be
closed from the current interface**, never flatly unclosable, and the review names **two constructions
that would bind them**, both outside this step's boundary rather than outside reach:

1. **recompute the content revision from the captured text in the frontend** and refuse registration when
   it disagrees with the supplied one; or
2. **have the IPC adapter produce an opaque, branded candidate snapshot** retained in a private registry,
   so `candidateRead` accepts only the exact backend-produced tuple rather than independently readable
   structural properties.

**What the gap does not permit: substituted bytes cannot be sent.** The permit carries the **captured
bytes**, and `permitHolds` compares those bytes against the live preview before anything reaches the
sender. What the frontend cannot do is independently prove that the backend-supplied hash describes them.

### What this step does not carry

**No window reading, and none is owed here.** Consult Q7 item 4 says a mounted handler test is **not a
screen**, and **2c-5-6 is the only step of this phase that owes the bilingual WKWebView reading**. jsdom
has no layout, so the sticky action row, the scroll-into-view of the outcome panel, keyboard order, focus
and hit testing are not measured by anything in this step. **No `.svelte` file changed after the first fix
round**, so nothing here invalidates that reading or brings it forward.


## Verification — Phase 2c-5 step 4a (the restore coordinator wiring, nothing drawn)

**Step 2c-5-4 was split by the orchestrator before any code was written**, and the split is recorded
here because a later session will otherwise read the consult's Q7 and expect one step. Q7 item 4 names
four things — the mode and its catalogue states, the typed accessors, the two-stage controls, and the
phase's whole mounted matrix — on top of coordinator wiring that did not exist at all. The cut is **by
failure mode**, which is the same criterion Q7 itself used:

- **2c-5-4a** — how the window talks to disk. `BrowserState` gains the backup reads and the restore
  send. Nothing is drawn, no i18n key or accessor is added, and no component is touched.
- **2c-5-4b** — the screen: the i18n keys and their typed accessors, `RestorePane.svelte`, the
  `DetailPane.svelte` mode, the open-surface predicate, the `InvalidateEverySurface` supplier, and the
  mounted matrix that is the phase's mounted evidence.

The boundary was **checked against the code rather than assumed**: `workspace.svelte.ts` contained no
occurrence of `restore` or `backup` at all, and the open-surface knowledge lives in `DetailPane.svelte`
(`openMatchDrafts()`), so a coordinator cannot observe it and 4a must take it as a parameter. Splitting
the other way — accessors in 4a — was rejected because it would have shipped `tRestoreRefusal` with no
component calling it, which is exactly the shape step 3's fourth pass adjudicated right to defer.

### The gates

| Gate | Before | After 4a | Note |
|---|---|---|---|
| `cargo test --workspace` | 1153 | **1153** | unchanged; no Rust touched, and that is the acceptance criterion |
| `npm run check` files | 426 | **426** | 0 errors, 0 warnings; no new file under `src/` |
| `npm test` | 1936 | **1958** | +19 implementation, then +3 net in the fix round (+2 workspace, +2 `restore.test.ts`, −1 pinning an argument pairing the signature no longer allows) |
| `npm run build` modules | 180 | **181** | **predicted before building, and it held** |

**The +1 is `restore.ts` becoming reachable from the entry for the first time**, exactly as `recovery.ts`
was at 2c-4c-3a. Its four value imports were already reachable and its six type imports erase, so the
module is the whole increment. The fix round added no source module and stayed at 181.

The bundle oracle was run in the discriminating form the 2c-5-2 entry established, **not** the vacuous
bare `svelte/internal/server` search: server-only `$$payload|head_payload|push_element` → **absent**;
client-only `window.__svelte|svelte-trusted-html` → **2, present**, proving the search can match at all.
`cargo tree -p espansoconfig-core | rg tauri` finds nothing.

Every gate above was **re-run by the orchestrator**, not taken from a worker's report.

### What 4a built

Three wrappers — `listBackupBatches`, `listBackupEntries`, `readBackupText` — and `restoreDocument`.
Two decisions are worth carrying:

- **The three commands went onto a second injected surface, `BackupCommands`, rather than into
  `BrowserCommands`.** Five full literals of `BrowserCommands` live under `src/lib/components/`, which
  4a was scoped out of. All members are required: an optional member would let an omission mean *there
  is none*. **It has a real production default**, so a `createBrowserState` call that omits it reaches
  `invoke` rather than a script — a live trap for 4b's mounted tests that no type closes.
- **`restoreDocument` builds `RestoreContext.observed` itself** from `revisionInProjection(views,
  session.target)`, read synchronously before anything awaits. This is **not** a refreshed base
  revision: what is written is `permit.submission.baseRevision`, the base the confirmation froze, taken
  off the permit inside `sendRestore`. Verified by the review against the code, not accepted from the
  record.

### The two obligations step 3 handed forward

- **The re-ask.** The three wrappers are unmemoised and re-callable, and that is the coordinator
  affordance. It is **not** the user-visible discharge — whether a screen offers the control is 4b's,
  and no test here can fail for its absence.
- **`InvalidateEverySurface`.** Taken as a required parameter with no default and passed through to
  `applyRestore`. The signature forces that one is supplied, **never that it closes a surface**.


## Verification — Phase 2c-5 step 3 (restore as browser values, nothing drawn)

**The reviews:** `docs/reviews/phase-2c-5-3-code.md` (round 1) and
`docs/reviews/phase-2c-5-3-confirmation.md`, which holds **three** rounds — the fix-round
confirmation, `## Third pass — the H1 spend`, and `## Fourth pass — the atomic spend`.
**The specification:** Q4 of `docs/reviews/phase-2c-5-design.md`, with Q8 as the binding instruction.

Every gate below was run **by the orchestrator** after each fix round, not taken from a worker's
report, and the Rust figure was derived by summing the per-suite totals.

| Gate | Command | Result |
|---|---|---|
| Rust | `cargo test --workspace` | **1153** passed, 0 failed — **unchanged**; this step touches no Rust |
| Types | `npm run check` | **426** files, 0 errors, 0 warnings (424 → 426: `restore.ts` and `restore.test.ts`) |
| Frontend | `npm test` | **1936** passed, 53 files (1793 → 1936) |
| Bundle | `npm run build` | **180** modules — **unchanged**, and that is the *prediction*, not a surprise |
| Lint | `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| Format | `cargo fmt --check` | clean |
| Architecture | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |

**The module count staying at 180 is the evidence, not the absence of it.** A
`src/lib/browser/*.ts` module that **no component imports is not reachable from the entry**, and
nothing draws restore until 2c-5-4 — so a move would have meant something pulled it in. Every IPC
import in `restore.ts` is `import type`; the model makes no IPC call and takes its sender by
injection. The discriminating oracle was run in both directions: `$$payload|head_payload|push_element`
absent, `window\.__svelte|svelte-trusted-html` → **2**. (Do **not** use a bare `svelte/internal/server`
search — `PROGRESS.md`'s 2c-5-2 entry records why that negative is vacuous.)

### The High that survived two fix rounds, and what each round got wrong

Consult Q8 requires the five bound values to live in **one unspent confirmation**. Four passes were
needed to get there, and **each round's fix produced the next round's finding** — the pattern this
file has recorded since 2c-3a-1, in its sharpest instance yet.

1. **Round 1** — `sendRestore` took an already-produced `StartedRestore` and called the sender
   unconditionally. The value carried only `document` and `submission`, so confirming entry A, moving
   the session to entry B and then passing the old value **wrote A under stale authorization**.
2. **Round 2** — a module-private `WeakMap` permit keyed by the returned `StartedRestore` closed
   reuse of *that object*. It did not close the **authorization before it**: two `confirmRestore`
   calls on one session minted two permits, both passed the live recheck, and both sent. The fix
   round's own suite **asserted two sends as correct** and the record adjudicated it an acceptable
   type-system limit. That adjudication was wrong.
3. **Round 3** — a `WeakSet` of pending confirmations, but shaped as `has(pending)` … field reads …
   `delete(pending)` **with the deletion's result ignored**. `readonly` on `PendingRestore` **does not
   freeze the object at runtime**, and the registered object is handed back to the caller as
   `session.pending`, so a getter or proxy trap on a field read between the two operations could
   re-enter, spend, mint a permit, and let the outer call mint a second. The round reasoned about
   **suspension** — it verified there is no `await` — and synchronous **re-entry** is a different
   thing.
4. **Round 4 — closed.** The **checked deletion is the membership test**:
   `if (!PENDING_CONFIRMATIONS.delete(pending)) { return null; }`, placed after every refusal and
   field check and before `submissionOf` and `PERMITS.set`. `WeakSet.delete` invokes no user code, so
   deciding and spending are one operation; two re-entrant callers both reach it and **only one
   receives `true`**. A refusal taken by an earlier check still leaves the question askable. The
   redundant `has` was **removed**, because a second membership read is exactly what made a
   two-operation spend look like one.

**The lesson to carry, in one line: a check and a spend separated by any property read are not
atomic in JavaScript, because a property read can run arbitrary code.** Absence of `await` proves
nothing about it.

### What else the four passes established

- **`applyRestore` opens the seal first, always** — verified by the fourth pass at the line level.
  The original defect was a **committed result stranded** by absent presentation state: the session
  now freezes the submission *and* its preview in `inFlight`, and classification reads the frozen
  record, never the mutable current preview. A throwing invalidator is caught by the opener and
  **cannot replace the committed arm** — a failure after commit never unwrites the file.
- **`frozen(session)`** (`phase === 'saving' || restored`) makes nine catalogue/selection/candidate/
  base transitions return their own argument, because the shipped sentence already promised that
  immutability.
- **`applyRestore` takes a required `InvalidateEverySurface`**, invoked inside the
  `openWholeDocumentSave` callback after the revision is recorded, so Q4's obligation to close or
  terminalize every surface for the document on commit is dischargeable by step 4 rather than
  unreachable.
- **The shared-module regression audit found nothing.** `reloadWarningFor` preserves the old mapping
  exactly — the five match surfaces still declare `closesSurface`, the raw editor still
  `reseedsDraft` — and the new arm is exhaustive rather than a changed default. Turning its
  `if`/fall-through into a `switch` means a future arm is now a **compile error** instead of silently
  inheriting a sentence.
- **The EN/ES meaning audit is clean.** Six open-surface refusals say a surface is open and must be
  closed; **neither language asserts the coordinator observed dirty state**, and none of the fifteen
  new strings claims chronology, authenticity, recoverability, provenance or undo.

### The claim defects, which were again the majority

Of nine findings across four passes, **six were sentences claiming a guarantee the code does not
give** — and two of them were introduced *by a fix round*, once more.

- **M3** — `refused.targetMoved` said *"Nothing was sent to the file by this attempt."* Its predicate
  is only that `context.observed` is null or differs from `session.baseRevision`, which is reachable
  **after** a send, including after an uncertain `mayHaveWritten` answer. Both languages fixed.
- **L1** — the candidate was described as *"still in the entry"*. The catalogue is untrusted and
  mutable and the entry is read **once**; the model knows the text was read from an entry and nothing
  about what that entry holds now. The sweep found three further instances.
- **M4** — round 3 had to correct ~20 sentences asserting the one-shot guarantee round 2 did not give.
- **M5** — the record claimed removing `has` left refusal behaviour *"unobservable and unchanged"*.
  It did not: an already-spent or unregistered question now runs the field reads first, so a throwing
  getter makes `confirmRestore` **throw** rather than return `null`. The equivalence is about the
  **answer for inert values**, and it is now written that way.
- **L3** — `RestoreSession.pending` was documented as *"the question that has been asked and not
  answered"*. `confirmRestore` returns a **new** session and cannot reach the caller's retained one,
  so after a successful confirmation that retained session still carries the very object whose
  membership is gone. Only `PENDING_CONFIRMATIONS` says whether a question is unanswered.

### Three residues, deliberately left and correctly stated

Each was adjudicated by the fourth pass as correct to leave, and each is recorded in
`docs/decisions/2c-5-3-notes.md` §5:

1. **Nothing forces `sendRestore`'s session and context to be live.** TypeScript cannot prove the
   provenance or freshness of an ordinary argument — the component boundary owns it. This does *not*
   excuse the H1 counterexamples, which used live, matching values.
2. **A catalogue or candidate answer landing during a send is dropped**, a consequence of the truthful
   freeze. **Step 2c-5-4 owes a way to ask again.**
3. **`rawEditor.test.ts:487` carries L2's exact old claim** over an identically shaped branch. Left as
   shipped, separately reviewed work — the `browser.matchMove.refused.unsavedDraft` precedent. The
   record neither claims it was fixed nor hides it.

### Two things this step does not do, and one it hands forward

It draws nothing, so **no mounted test and no window reading were taken or claimed**. And it adds
**no reactive `t*` accessor** in `src/lib/i18n/index.ts`: `restoreRefusalKey`/`openWriteSurfaceKey`
already return `TranslationKey`, so a missing key is a compile error where the mapping is defined,
and adding an accessor now would make the model reachable from the entry for code no component calls.
**Step 2c-5-4 must add `tRestoreRefusal(refusal: RestoreRefusal)` and call it from the component** —
never `t(restoreRefusalKey(...))`, never a hand-built key. At that point the component makes the model
reachable anyway and the bundle argument disappears.

---

## Verification — Phase 2c-5 step 2 (the read-only Tauri wire)

**The reviews:** `docs/reviews/phase-2c-5-2-code.md` (round 1, 325 lines) and
`docs/reviews/phase-2c-5-2-confirmation.md` (round 2, 230 lines). **The specification:** Q3 of
`docs/reviews/phase-2c-5-design.md`.

Every gate below was run **by the orchestrator**, not taken from a worker's report, and the Rust
figure was derived by summing the per-suite totals.

| Command | Result |
|---|---|
| `cargo test --workspace` | **1153** passed, 0 failed, 0 FAILED suites |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match — the architecture rule holds |
| `npm run check` | **424** files, 0 errors, 0 warnings |
| `npm test` | **1793** passed, 52 files |
| `npm run build` | **180** modules |
| `git status --short --untracked-files=all` | no real-corpus path at any point (D1) |

**The module count is unchanged at 180 and that is correct, not suspicious**: every frontend change
was a modification of an existing module, and the two new files are a test and a Rust file, neither
reachable from the entry.

**The bundle half of the check was re-derived, because the documented oracle cannot fail.** Searching
a production bundle for `svelte/internal/server` proves nothing — Vite resolves and minifies module
specifiers away, and a control search for `svelte/internal/client` **also matched nothing**. Step 2's
implementer reported that control as having matched; it does not. The discriminating oracle is
server-only sentinels absent (`$$payload`, `head_payload`, `push_element`) **with** client-only
constructs present (`window.__svelte`, `svelte-trusted-html` — 2 matches here), and that is what was
run. `CLAUDE.md`'s wording for this check is now known to be weaker than it reads.

**Two review rounds, two fix rounds, seventeen findings, no High, and no behavioural defect in what
reaches disk.** Round 1: 5 Medium, 6 Low. Fix 1 closed all eleven and swept **30 further sites**.
Round 2: 4 Medium, 2 Low — **narrower instances of the same four defects**, plus one false claim
(`2^53` described as rounded) **introduced by fix 1**. Fix 2 closed those six and swept **27 more**.
No gate figure moved across fix 2.

**What was NOT done, deliberately:** no third review round. Round 2 found no High and no behavioural
defect, and fix 2 changed no executable line except the test control the review itself dictated. Two
residues were named and left for a ruling — `docs/decisions/2a-3b-notes.md:159`'s unconditional
containment claim (which wants a *correction block*, not an edit, per project convention) and the four
i18n strings whose EN/ES meaning-parity was checked by reading only. Both are in "Next action".

**What this step does not cover:** step 2 owes Rust/IPC and TypeScript **model tests only**. There is
**no mounted-component test and no window reading**, by the consult's Q7 — those are steps 4 and 6.
Nothing here is evidence about a screen.

### Git state — Phase 2c-5 step 3

| Phase | Commit | Push | Tree |
|---|---|---|---|
| **2c-5 step 3** | **`41b037b`** | ✅ pushed to `origin/main` | clean |

`2bb69cd` is Phase 2c-5-4b **including its code review, its three fix rounds, its four confirmation
rounds and the documentation fix that closed the last one** — as with every phase since `8989c16`, the
step was held open until every finding was closed, so **no commit holds the demonstrated defects**:
neither the permit minted from caller-controlled reads *after* the checked spend, nor the base revision
read from two sources with one checked and the other sent, nor `revokeConfirmation` whose own first
operation was `session.pending`, nor the take-and-put-back that exposed a false *no question exists*
state to `prepareRestore`, nor the alternating cross-document getters that let one reload confirmation
install two projections, nor the JSDoc precondition `carryTheQuestion` does not satisfy. It contains
`src/lib/components/RestorePane.svelte` and its mounted suite, `src/lib/browser/restoreFacts.ts` and
its tests, the suspension mechanism in `src/lib/browser/restore.ts`, the reservation in
`src/lib/browser/workspace.svelte.ts`, the `ConflictChoice` widening in `src/lib/browser/saveOutcome.ts`
with its dead arm in seven components, `DetailPane.svelte` and its tests, the fifty keys per dictionary
with `tRestoreRefusal` in `src/lib/i18n/`, `docs/decisions/2c-5-4b-notes.md`, the five review documents
`docs/reviews/phase-2c-5-4b-code.md` and `phase-2c-5-4b-confirmation{,-2,-3,-4}.md`, and this
checkpoint. The tree at it produced **`1153 / 431 / 2123 / 184`**. **A fresh session starting step
2c-5-5 should start from `2bb69cd` or later**, and its first act is reading the surviving instrument
prose, not code. As at 1b-1, `npm install` (or `npm ci`) is required before any frontend command will
run.


`2fa86ca` is Phase 2c-5-4a **including its review round, its fix round and its confirmation round** —
as with every phase since `8989c16`, the step was held open until every finding was closed, so **no
commit holds the demonstrated defects**: neither the discarded `PERMITS.delete` result that let one
confirmation issue two whole-file replacements under synchronous re-entry, nor the session left
permanently in `saving` after a write-safe mismatch with no transition able to recover it, nor the
record claiming object-identity evidence a `toEqual` assertion does not give, nor the fix round's own
overcorrection calling a candidate-bound acknowledgement *one-attempt*. It contains the restore
coordinator wiring and `BackupCommands` in `src/lib/browser/workspace.svelte.ts`, the checked spend and
the `withdrawn` arm with `restoreConfirmationWithdrawn` in `src/lib/browser/restore.ts`, their cases in
`workspace.test.ts` and `restore.test.ts` (including the `Proxy` re-entrancy case), the corrected
bundle-regression oracle and the 2c-5 phase narrative in `CLAUDE.md`,
`docs/decisions/2c-5-4a-notes.md`, `docs/reviews/phase-2c-5-4a-code.md`,
`docs/reviews/phase-2c-5-4a-confirmation.md` and this checkpoint. **A fresh session starting step
2c-5-4b should start from `2fa86ca` or later.** As at 1b-1, `npm install` (or `npm ci`) is required
before any frontend command will run.


`41b037b` is Phase 2c-5-3 **including all four review passes and all three fix rounds** — as with
every phase since `8989c16`, the step was held open until every finding was closed, so **no commit
holds the demonstrated defect**: not the reusable `StartedRestore` that would have written entry A
after the session moved to entry B, not the two permits one session could mint, not the check-and-spend
a getter could re-enter between, and not the transitions that stayed live during a send while the
shipped sentence promised they could not. It contains `src/lib/browser/restore.ts` and
`restore.test.ts`, the three additive members and the exhaustive `switch` in
`src/lib/browser/saveOutcome.ts` with its suite, 15 new keys in each dictionary,
`docs/decisions/2c-5-3-notes.md`, both review files, the correction block in
`docs/decisions/2a-3b-notes.md`, and this checkpoint. **It is the first commit in which restore
exists as a value, and nothing draws it.** As at 1b-1, `npm install` (or `npm ci`) is required before
any frontend command will run. **A fresh session starting step 2c-5-4 should start from `41b037b`
or later.**

### Git state — Phase 2c-5 step 2

| Phase | Commit | Push | Tree |
|---|---|---|---|
| **2c-5 step 2** | **`c42b1df`** | ✅ pushed to `origin/main` | clean |

`c42b1df` is Phase 2c-5-2 **including both review rounds and both fix rounds** — as with every phase
since `8989c16`, the step was held open until every finding was closed, so no commit holds a
demonstrated defect. It contains `src-tauri/src/backup.rs`, the three commands in `commands.rs` and
their registration in `main.rs`, the wire types in `src/lib/ipc/types.ts`, six new dictionary
namespaces with 25 keys and four `CommandError` variants across `en.json`/`es.json`, both reviews, and
this checkpoint. Its parent `7c971c6` is Phase 2c-5-1, whose SHA was never recorded here.

**A fresh session starting step 2c-5-3 should start from `c42b1df` or later.** As at 1b-1,
`npm install` (or `npm ci`) is required before any frontend command will run.

---

## Verification — Phase 2c-4c step 6 (**this closes Phase 2c-4c**)

**The record:** `docs/decisions/2c-4c-6-notes.md`. **The review:** `docs/reviews/phase-2c-4c-6.md`
(round 1, **NOT READY**, nine findings, all nine closed; no round 2 — the reason is recorded in the
review file itself, not left to be inferred).

**The removal, in the order the handoff prescribed and with the evidence each part produced:**

1. **The hook diff was read first.** `git diff src/main.ts src-tauri/src/main.rs` showed exactly four
   lines: `mod probe;` and `probe::register_with_probe(...)` in `src-tauri/src/main.rs`, and
   `import { startProbe } from './probe';` plus a trailing `startProbe();` in `src/main.ts`. Reading
   it first is what made the by-hand revert possible after the sources were gone.
2. **Both probe sources deleted.** `src/probe.ts` and `src-tauri/src/probe.rs` were untracked, so
   this leaves no diff — the evidence is the empty status at (4), not a patch. **They were deleted
   without being read**, which is why the record refuses to explain the unchanged Rust count.
3. **The four hook lines reverted by hand**, as four targeted edits rather than a `git restore`.
4. **Proved byte-identical:** `git diff src/main.ts src-tauri/src/main.rs` **empty**, and — because a
   bare `git diff` compares the working tree with the *index* — also `git diff HEAD --stat`
   **empty** and `git status --short --untracked-files=all` **empty**, the latter re-run *after* the
   build at (6).
5. **The scratch tree deleted.** `/private/tmp/espansoconfig-harness-2c-4c/` measured **2.9 GB** by
   `du -sh` — the figure 5b-3 recorded — then `rm -rf`; `ls` afterwards returns *No such file or
   directory*, and a glob for `/private/tmp/espansoconfig*` finds **no match**, so no sibling
   scratch tree from an earlier harness generation survives.
6. **The four gates re-derived on the harness-free tree.**

| Gate | With harness (5b-2) | **Measured at step 6** | Expected |
|---|---|---|---|
| `cargo test --workspace` | 1112 passed, 0 failed | **1112 passed, 0 failed**, exit 0 | 1112 |
| `npm run check` | 424 files, 0 errors, 0 warnings | **423 files, 0 errors, 0 warnings** | 423 |
| `npm test` | 1768 passed, 51 files | **1767 passed, 51 files** | 1767 |
| `npm run build` | 181 modules | **180 modules** | 180 |

**All four match, and nothing was adjusted to make them match** — the expectation stood in this
file's "Next action" *before* the measurement, and the handoff required that a difference be
recorded and investigated rather than edited away. `CLAUDE.md` §4's rule is discharged in its strong
reading: these are figures a harness-free tree produced, not figures copied forward.

**The Rust figure was derived, not read off a summary line**: the `N passed` field of every
`test result:` line was summed — **25 lines**, the `Doc-tests espansoconfig_core` binary included —
giving **1112**. No line reports a non-zero `ignored`, and a search of the whole output for
`failures:`, `FAILED`, `error[` and `warning:` finds nothing.

**The vitest −1 was traced rather than assumed**, which is the one place this step did more than the
handoff asked. `scripts/lint/ipc-detail.test.ts:79` is
`it.each(scannableFiles().filter((file) => !ALLOWED.has(file)))` — one case per `.ts`/`.svelte` file
under `src/` minus a two-entry allow-list. There are now **104** such files, so that block generates
**102** cases and the suite totals **118** (measured with `--reporter=json`); with `src/probe.ts`
present it was 105 → 103 → 119. That is the entire difference. The other two moving figures have the
same single cause — `src/probe.ts` was one file svelte-check checked, and one module the entry
reached through `src/main.ts`'s import. **The Rust count is unchanged at 1112 and the record
deliberately offers no explanation of why**, because the file that would explain it was deleted
unread.

**Both halves of the module guard were run, because 180 is now within one of a legitimate count.**
The arithmetic: 178 at 2c-4c-3a, 180 at 2c-4c-3b (two for one new styled component — the module and
its `<style>` block), and step 6 adds no source module, so 180 is where a harness-free tree belongs.
The bundle search: `rg -c "svelte/internal/server|svelte/server|async_hooks" dist/assets/*.js` finds
**nothing** — and **that negative was checked for falsifiability rather than accepted**, since a
search that cannot match proves nothing about what it did not find: `rg --count-matches "svelte"`
over the same file returns **495**.

**Residue.** A targeted search for `ECFG_PROBE`, `startProbe`, `register_with_probe`, `probe::` and
`from './probe'` outside `docs/` and this file finds nothing. The stronger form is the git fact at
(4) — every tracked file matches `HEAD`, and `HEAD` never held the harness — **bounded** by the fact
that neither the git check nor the greps inspect an **ignored** path, `rg` honouring `.gitignore`.
`dist/` is closed separately: `vite.config.ts:45` sets `emptyOutDir: true`, the build regenerates it
from tracked sources, and `dist/assets/` afterwards holds exactly one `.js` and one `.css`.

**What this step deliberately did not do:** it verified and regenerated **no manifest** before
deleting the tree (`manifest-2c-4c-4a-post.sha256` is a partial-verify artifact by design and 5b-3
states its 54-OK/1-FAILED comparison as a *current* result); it did not reopen step 5; it staged by
path and never with `git commit -a`/`-am`; and it touched neither `.gitignore` nor the corpus nor
the sync script, so `CLAUDE.md` §1's post-touch verification is not owed.

**The standing price, stated because it is permanent.** Every artifact P01–P73 is gone. Any claim in
`2c-4c-4a-instrument-rebuild.md`, `2c-4c-4b-instrument.md`, `2c-4c-5-window-reading.md`,
`2c-4c-5b-1-instrument.md` or `2c-4c-5b-2-notes.md` that rested on a launch directory now rests on
**the record of that launch alone** — testimony, not evidence that can be re-derived. So does the
text of the two probe sources: `PROGRESS.md`'s 2c-4c-4a row already recorded that no record carries
`probe.rs`'s source, which is why 4a had to author it from the code. A future harness is rebuilt
from prose again.

**No window reading and no mounted test is owed.** The only edits were to `src/main.ts` and
`src-tauri/src/main.rs`, and both were returns to what `HEAD` already holds — proved by the empty
diff at (4). The last change to a tracked source file in this phase remains 5b-2's single deleted
CSS declaration in `src/lib/components/RecoveryPanel.svelte`, committed at `c23b39e` and read in a
window across twelve launches (P62–P73).

---

## Phase 2c-4c step 6 review disposition

Codex round 1 returned **NOT READY** on nine findings — **three High, five Medium, one Low — and
every one of the nine was a sentence in the record**. None was a defect in the removal, in the gate
figures or in the application. **No executable line changed in the fix round**, because a step that
changes no tracked source file has none to change.

Three are worth naming, because they are this project's named worst defect class appearing in a step
that does nothing at all:

| # | Severity | The finding | How it was closed |
|---|---|---|---|
| 1 | High | §1.1 offered a bare `git diff` as *"the whole of the proof"* of byte-identity with `HEAD` — but that command compares the working tree with the **index**, so an empty result is also consistent with a staged difference | The section now names the semantics and cites **two** retained facts: the initial status's blank index column, and the empty `git diff HEAD --stat`. The record says an earlier draft got this wrong |
| 2 | High | §2 explained the unchanged Rust count by asserting that `src-tauri/src/probe.rs` *"was a plain `mod probe;` with no `#[cfg(test)]` module of its own"* — a file the step deleted **without reading**, making the explanation an inference from the very count it explained | The bullet now **offers no explanation at all**, says why one would be circular, and keeps only the observation: 1112 with the harness, 1112 without |
| 9 | High | §5 declared *"Phase 2c-4c is complete"* and predicted that *"no finding in any round of step 6 changed a byte written to a user's file"* — **before the round had been run** | §5 rewritten to record round 1's actual outcome, to state that the closing commit is what the handoff prescribes, and to drop the prediction entirely |

The other six narrowed unretained claims: an inventory of a directory only ever measured (§1.2), a
chronology giving 5b-3 three Codex rounds when it took rounds 2 and 3 of step 5's three (§1.3), two
non-existent filenames — the records are `2c-4c-4a-instrument-rebuild.md` and
`2c-4c-4b-instrument.md` (§1.3), a git proof stated more broadly than ignored paths allow (§1.4), a
measurement placed *"at the commit this step produces"* when it was taken on the working tree
(§3.3), and a process assertion no artifact could support (§4).

**All nine were checked against the artifacts before being applied**, not taken on the reviewer's
authority: finding 5's filenames by listing `docs/decisions/`, finding 6's chronology against this
file's 2c-4c-5 and 2c-4c-5b-3 rows.

**The sweep after the fix round found a tenth, and the fix round had created it.** Closing finding 5
introduced a sentence counting the `docs/` files that name the probe's identifiers; the count was
taken through a command ending in `| head`, which caps output at ten lines, and the sentence said
**ten**. Re-derived without the cap: **19**. It is recorded in place at the record's §1.3 rather
than quietly corrected. This is the **thirteenth** consecutive round in this phase to find a
narrower instance of what the round before it closed, and **the third in a row where the fix round
created the instance rather than missing it**. It was found by re-deriving the two figures the fix
round had newly introduced — the file count, and the `dist/` regeneration claim, which held — and
that is the only technique that has worked: **check what the record now says, never the words the
finding used.**

**No round 2 was commissioned, and that is a decision rather than an omission.** The nine findings
were prose in a record describing a step that changes no tracked source file; all nine were closed
by *narrowing* claims rather than by adding new ones, which is the direction that cannot introduce a
new guarantee; and the one instance the fix round did create was found and recorded by the sweep
this project's history predicts is necessary. The reason is written into
`docs/reviews/phase-2c-4c-6.md` so a later session can disagree with it knowingly.

---

## Verification — Phase 2c-4c step 5b-3 (**this closes step 5**)

**The record rewritten:** `docs/decisions/2c-4c-5-window-reading.md` — **799 lines before this step,
1296 after**. **The reviews:** `docs/reviews/phase-2c-4c-5-reading.md` (round 1, pre-existing, NOT
READY — three Highs, one Medium, one Low), `docs/reviews/phase-2c-4c-5b-record.md` (round 2, 79 lines,
NOT READY — two Highs) and `docs/reviews/phase-2c-4c-5b-record-round3.md` (round 3, 55 lines, NOT
READY — one Medium).

**No executable source file changed in 5b-3.** The only application-source change in the whole of 5b
was 5b-2's deleted CSS declaration, already committed at `c23b39e`. So this step owes no mounted test
and no new window reading: nothing a window draws was touched.

### The gates, run by the orchestrator during this step, **with the harness in the tree**

```sh
cargo test --workspace   # 1112 passed, 0 failed
npm run check            # 424 files, 0 errors, 0 warnings
npm test                 # 1768 passed, 51 files
npm run build            # 181 modules
```

Both halves of the module-count check were done — the arithmetic **and** the bundle search:
`svelte/internal/server`, `svelte/server` and `async_hooks` were each searched for in the built bundle
and are **absent**. That matters because 180 is now within one of a legitimate count, so the number
alone decides nothing.

**These are with-harness figures**, and they must never be carried forward as production numbers.
Production is `1112 / 423 / 1767 / 180`, and **step 6 must re-derive it on a harness-free tree**.

**What this gate run does and does not establish.** After it, only `.md` files changed, and no gate
reads `docs/` — so the later edits are outside every gate's input. **The gates were not re-run after
the final edits, and nothing here claims they were.** No transcript is retained and no tree identity
is bound to these figures; they are the orchestrator's account of a run, which is exactly the
distinction round 2's second High was raised about.

### The three rounds, and what each of them found

**Round 1** judged the record *as first written* and returned NOT READY on three Highs, a Medium and a
Low. Its first High was a defect in the record that the orchestrator verified independently in the
code (the `view.outcome === null` premise); 5b-1 measured what that premise had hidden and 5b-2 fixed
it.

**Round 2 returned NOT READY on two Highs, and both were against 5b-3's own corrections, not against
the original record.**

1. **The rewrite raised M2 from Medium to High on pointer unreachability.** That crosses the record's
   own §8.16 — `elementFromPoint` establishes **paint order at a sampled point, not event delivery** —
   and its §8.17, six of seven controls `outsideViewport` at the sampled scroll position, so the
   verdict rests on **one control per launch**. The retained rectangles refute it as well: the sibling
   began **7 px below** the section's top while the close button began **at** the section's top and
   stood **27 px** high, so the button's top 7-px strip was never inside the sibling and **no point in
   that strip was tested**. **M2 is restored to Medium.** The geometry defect itself was never in
   doubt in either direction — round 2 says so, and M2's entry still calls it confirmed, measured in
   all eight pre-fix launches in both languages, and fixed at 5b-2.
2. **The rewrite reintroduced construction chronology inside the very passages that narrow it**: a
   gate run claimed to have happened *before the rewrite was applied*, 5b-2's bundle search claimed to
   have happened *after its CSS change*, and `PROGRESS.md` offered as *a witness outside the record*.
   All three are withdrawn. §10 now treats all four gate reports as **accounts**, §1.3 states the
   manifest's **54 OK / 1 FAILED** as a **current comparison** rather than a re-run, and §8.13 gained
   a paragraph naming all three as claims **the fix round itself created**.

**Round 3 returned NOT READY on one Medium, and it too was a narrower instance the round-2 fix
created**: the new preamble said *"The two findings are both Mediums"*, which reads as a roster of two
when the roster is **two Mediums, two Lows and six Observations**. Round 3 also confirmed, positively:
**both round-2 Highs closed**; M2 does **not** now under-claim (its entry still records the confirmed
defect *and* all three of its arguments — the false latent premise, the withdrawn
programmatic-operability ground, and the over-claimed High — and names what a High would require, a
trusted pointer path over coverage wider than one control); the **7-px qualification is supported** by
the retained geometry; O6's downgrade from L3 is well argued and neither over- nor under-claims; and
**no cited source location, rectangle or count has drifted**.

### M2's entry now records all three arguments in sequence

That is the substantive shape of the rewrite and it is worth stating plainly, because two of the three
arguments are ones this project **advanced and then withdrew**: the false latent premise (round 1's
High), the *"stayed operable through every path this harness drives"* ground — unsound because the
driver presses with `HTMLElement.click()`, which bypasses hit testing, so a programmatic press
succeeding is not evidence a pointer could reach the control — and the over-claimed High (round 2's
first). **Disproving the operability ground does not prove its opposite**, which is precisely why the
High did not follow. **No launch of this project has ever had a trusted pointer path**, so the
evidence a pointer-unreachability High would need has never existed here.

### §8 gained five bounds and one unexplained observation

The bounds are the two 5b-2 recorded (`elementFromPoint` is paint order at a point, not event
delivery; six of seven controls `outsideViewport`) and the three the round-1 review named. The
unexplained observation is the creator's host outcome panel at **812/890 px after** against **829/873
before** — **bimodal across pre-fix launches too**, since P33 measured 812 and P34 measured 890 with
the old CSS. It is therefore **not attributed to the fix**, and its **cause is unexplained** — recorded
rather than resolved.

### Why no round 4 was commissioned — a deliberate decision, with its reason

**This is a judgement, and a later session may overturn it.** The standing inference from this phase's
history is that a fix round is itself reviewable: rounds 2 and 3 are the **eleventh and twelfth
consecutive rounds to find a narrower instance of what the round before closed**, and they are **the
first two in which the fix round created the instance rather than missing it**. Against that history,
stopping needs a reason, and this is it:

- round 3's Medium was closed by **a single sentence Codex prescribed verbatim** — *"The two Medium
  findings, M1 and M2, rank neither above the other"* — so the fix introduced no new prose of the
  orchestrator's own devising;
- it introduced exactly **one factual claim**, the roster arithmetic; and
- the orchestrator **verified that claim by direct enumeration of §6's own headings**: M1, M2, L1, L2,
  L3 (a **withdrawn tombstone**, re-judged as O6 and not counted) and O1–O6 — two Mediums, two Lows,
  six Observations. **All three roster statements in the record now agree**: the preamble, §6's
  preamble and §11.

A later session that disagrees should commission round 4 against exactly that claim; it is bounded and
checkable, and re-deriving it costs one `rg` over the record's `###` headings.

### The working tree at the end of this step

`git status --short --untracked-files=all` shows the four harness paths — `src/main.ts` and
`src-tauri/src/main.rs` modified (two hook lines each), `src/probe.ts` and `src-tauri/src/probe.rs`
untracked — plus `docs/decisions/2c-4c-5-window-reading.md` modified, the two new untracked review
files, and this checkpoint. **The four harness paths must never be committed**; stage by path, never
`git commit -a` or `-am`. No real-config path and no launch artifact appears.

**No finding of the reading, and no finding of any of its three review rounds, changes a byte written
to a user's file.**

---

## Verification — Phase 2c-4c step 5 (as taken and first reviewed; **superseded — step 5 is CLOSED at 5b-3**)

> **Superseded.** This section is kept as written at the time, because its launch evidence and its
> round-1 disposition are the record of what step 5 produced. What has changed since: **step 5 is
> closed**, its fix round 5b ran in three parts, and the section immediately above is the closing
> verdict. Where this section says the step is not closed, read it as the state at the time it was
> written.


**Record:** `docs/decisions/2c-4c-5-window-reading.md`. **Review:** `docs/reviews/phase-2c-4c-5-reading.md`
— **round 1 only, verdict NOT READY**, recovered verbatim from the Codex rollout because the job ran
read-only and its `apply_patch` was rejected (provenance in the file's header).

**The launch evidence, re-derived by the orchestrator from the artifacts rather than accepted from the
worker's report:**

```sh
# 27 step-5 launches, P27–P53, in /private/tmp/espansoconfig-harness-2c-4c/launches/
grep -h "reached-end" P27…P53/bytes.txt   # 27 × reached-end=yes  (waited 3–5s)
grep -l -- "--- failed" P27…P53/probe.log # 0 launches
grep -h "probe.err=" P27…P53/bytes.txt    # 27 × probe.err=0 bytes
grep -c "bytes=MATCH" P01…P53/bytes.txt   # 53 of 53
grep -h "^plan=" P27…P53/bytes.txt        # 13 cases × en/es, plus P53 (duplicator-exact:en)
```

All six write surfaces — editor, creator, deleter, mover, duplicator, raw — have at least one English
and one Spanish launch, so **4b's aggregate language hole is closed**. Codex verified the same
partition independently from the raw artifacts and agrees.

**The gates, run by the orchestrator with the harness in the tree, all exit 0:**

```sh
cargo test --workspace   # 1112 passed, 0 failed
npm test                 # 1768 passed, 51 files
npm run check            # 424 files, 0 errors, 0 warnings
npm run build            # 181 modules
rg -c "svelte/internal/server|svelte/server|async_hooks" dist/assets/*.js   # no match
```

Both halves of the module-count check were done — the arithmetic **and** the bundle search — because
180 is now within one of a legitimate count and the number alone decides nothing. Production remains
`1767 / 423 / 180 / 1112`; step 6 re-derives it on a harness-free tree.

**Why the step was not closed at the time** (it is closed now — 5b-1 measured, 5b-2 fixed, 5b-3
rewrote the record and took rounds 2 and 3). The review returned **NOT READY on three Highs, a Medium
and a Low**.
The orchestrator verified the first High in the code rather than accepting or dismissing it: the
record's §3.2 rests M2's *latent, never constructed* classification on `view.outcome === null` after a
reapply, and **a conflict is an outcome** — `conflictOf()` is `conflictArm(session.outcome)`
(`src/lib/browser/matchEditor.ts:1078`), set by `describeEditSave` for every non-saved result
(`:1522`, `:1525–1530`), and both creating hosts gate the host outcome panel on exactly that value
immediately after `<RecoveryPanel>` (`MatchEditor.svelte:910`). `attemptOfReapply` returns the held
session unchanged for `manualResolution` (`reapply.ts:540–547`), the arm P27–P34 all printed. **The
overlap state was therefore constructed in eight launches and never measured.** Closing the geometry
judgement needs an instrument extension and a re-take from P54; the other two Highs, the Medium and
the Low are prose. **All of that has since happened** — the disposition is the 5b-3 section above, not
"Next action", which now hands off step 6.

**No finding of the reading or of its review changes a byte written to a user's file**, and all 53
retained launches report `bytes=MATCH`.

---

## Verification — Phase 2c-4c step 3b

**Record:** `docs/decisions/2c-4c-3b-notes.md`. **Review:** `docs/reviews/phase-2c-4c-3b-code.md`
(two rounds in one file, round 1 transcribed and round 2 Codex's own bytes — the provenance of each
is stated in it).

**Every number below was re-derived by the orchestrator on the working tree, each command run on its
own, never accepted from a worker's report.** Both gate runs were taken — once after the
implementation and again after the fix round — and the second is what is recorded.

| Gate | Command | Result |
|---|---|---|
| Rust | `cargo test --workspace` | **1112 passed, 0 failed** — unchanged; no Rust file was touched |
| Frontend tests | `npm test` | **1767 passed, 51 files** (1744 → 1764 at the implementation, → 1767 after the fix round) |
| Types | `npm run check` | **423 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` | **180 modules** |
| Lint | `cargo clippy --workspace --all-targets -- -D warnings` | clean |

**180 is exactly the old regression shorthand, and that is why the number alone was not accepted.**
The arithmetic is 178 + 2 for one new styled component (`RecoveryWithoutCreation.svelte`): the
component is one module and its `<style>` block is another. The worker verified it by deleting the
block (179) and restoring it (180); **the orchestrator independently searched the built bundle for
`internal/server`, `svelte/server` and `async_hooks` and found none.** `CLAUDE.md`'s ladder now
carries this rung and the warning that the shorthand is spent.

**+3 tests for zero new cases at the implementation, and +3 more that are new cases.** 1744 → 1764
is 16 new mounted cases (four on each of the four surfaces) plus four model cases; 1764 → 1767 is
the three per-source-file `it.each` scanners each gaining one row for the new component. The four
assertions the orchestrator added in the round-2 fix are inside **existing** cases, so they moved no
count — which is exactly why they were worth adding rather than counting.

## Verification — Phase 2c-4c step 3a

**Record:** `docs/decisions/2c-4c-3a-notes.md`. **Review:** `docs/reviews/phase-2c-4c-3a-code.md`
(two rounds in one file).

**Every number below was re-derived by the orchestrator on the working tree, each command run on its
own, never accepted from a worker's report.**

| Gate | Command | Result |
|---|---|---|
| Rust | `cargo test --workspace` | **1112 passed, 0 failed** — unchanged; no Rust file was touched |
| Frontend tests | `npm test` | **1744 passed, 51 files** (1711 → 1740 at 3a, → 1744 after the fix round) |
| Types | `npm run check` | **422 files, 0 errors, 0 warnings** (`--fail-on-warnings`) |
| Bundle | `npm run build` | **178 modules**; `rg -c "svelte/internal/server" dist/assets/index-*.js` finds nothing |
| Architecture (D2x) | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |

**The module count moved by three for two source files, and that is correct.** `recovery.ts` became
reachable from the entry for the first time (+1) — step 2 built it and nothing imported it, which is
why 175 held then — `RecoveryPanel.svelte` is new (+1), and **that component's `<style>` block is a
module in its own right** (+1). Established by deleting the block, rebuilding to 177, and restoring
it. `CLAUDE.md`'s ladder now carries this, **including that the old regression shorthand "a jump to
~180" is within one of a legitimate count and must not be read alone.**

**Two things were verified by inspection rather than by a gate, because no gate covers them:**

- **No pre-existing dictionary key was altered.** `git diff src/lib/i18n/en.json src/lib/i18n/es.json`
  has **zero deleted lines** in either file — every change is an addition. That is the proof that
  `browser.saveOutcome.reloadClosesSurface`, the standing debt-ledger item, is untouched, and it is
  stronger than grepping for the key.
- **The four 3b surfaces are byte-identical.** `MatchDeleter`, `MatchMover`, `MatchDuplicator` and
  `RawEditor` do not appear in `git status` at all.

### The review, and what it cost

Two Codex rounds, both read-only-mounted and both therefore **transcribed by the orchestrator with
provenance marked** rather than written by Codex.

**Round 1 — NOT READY, two Highs, one Medium, one Low.**

1. **High, and a defect in behaviour.** `RecoveryPanel.svelte`'s `runCreate` awaited
   `sendRecoveryCreate` without ever installing the `saving` session, so `view.saving` was false for
   the entire flight and every control stayed live. **Two clicks on *Create* sent two writes against
   one base revision; one commits, one conflicts, and the late answer could replace the committed
   state with the conflict** — a committed write afterwards reported as an error, which this project
   forbids absolutely. *Close* could also abandon a form mid-write. Confirmed independently by the
   orchestrator against `MatchEditor.svelte:499`, which assigns `session = started.session;`
   synchronously, before commissioning the fix.
2. **High, prose.** `browser.recovery.sourceConflict.retained` claimed the source change was "still
   here, exactly as it was". The predicate establishes only that recovery has written nothing and
   ordered no reconciliation; because the panel is drawn **beside** the host outcome panel, a person
   can dismiss the host conflict with *Keep editing*, edit the host draft, and still be told it is
   exactly as it was.
3. Medium: a JSDoc claiming recovery has no anchor "by definition", when `manualResolution` is also
   reached by a field collision or an unusable destination. 4. Low: a miscounted test inventory.

**The fix chose the model over the renderer.** `sendRecoveryCreate` gained a **required** third
argument, `InstallTheWaitingForm`, invoked before the request is authorized and never for a refused
form; all 36 call sites were updated rather than the argument made optional. Splitting the
composition into the component would have moved the base revision, the `NewMatch` and the fixed
placement into a renderer — the duplication the one shared panel exists to prevent. The sweep for
finding 2 was extended unprompted to `windowMoved` and `spent`.

**Round 2 — no High, no Medium, one Low**, and the implementation fix confirmed sound on every point,
including that **no test installer had been weakened to a no-op** by the 36-call-site change. Its one
finding was a false sentence **the round-1 fix had itself introduced**: §5 of the record called *Save
anyway* "the one control" left live, while the whole refusal choice row stays enabled and §6.1 said
so. Fixed directly by the orchestrator (one sentence, one file); no executable line changed.

### The lesson this step is worth remembering for

**All five gates were green when round 1 found both Highs, and neither was visible to any of them.**
1744 tests, a mounted suite on every changed component, `svelte-check` clean, and a double-click on
*Create* would still have sent two writes. The first High was a synchronous-ordering bug **no model
test drives**; the second was prose, and **the i18n suites check parity and placeholder agreement,
never meaning** — reverting a prose fix while keeping its key leaves every suite green.

**Round 3 was judged not worth spending**, and the reasoning is in the review file's last section so
it can be overruled on evidence: round 2 found no High and no Medium, and its one Low was a prose
contradiction whose fix adds no claim the round had not already stated in its own words.

### What this step did NOT establish

- **No window reading.** None of 3a's evidence is a reading of a screen; a mounted test proves a
  handler fires, not that a window draws. The reading is owed at 2c-4c-5, for six surfaces.
- **The four 3b surfaces are unproven, not proven absent.** That the deleter, mover and duplicator
  offer neither copy nor save-as-new is 3b's mounted obligation; 3a proved only the positive half.
- **`NewMatchRepeatsLiteralTrigger` now has mounted evidence on the ordinary `create_match` path**
  (two cases, `MatchCreator.test.ts`), closing the debt step 1 left. It still has no window reading.

---

## Verification — Phase 2c-4c step 2

**Record:** `docs/decisions/2c-4c-2-notes.md`. **Review:** `docs/reviews/phase-2c-4c-2-code.md`
(five rounds in one file: `## Findings`, `## Confirmation pass — round 2`, `## Round 3 — scoped pass
over the fix round`, `## Round 4 — scoped pass over the second fix round`).

**Codex jobs:** `task-mspyy3x1-ivt7du` (round 1), `task-mspzx6kg-alwkwk` (round 2),
`task-msq0gtws-nwfsyp` (round 3), `task-msq0xsg9-uavnvb` (round 4). All four: no web search,
repository reading permitted.

**Two of the five rounds could not write their own section, and the record says which.** Rounds 3
and 4 ran with the workspace mounted read-only, so their `apply_patch` was refused; a second job
commissioned solely to append round 3's section failed the same way. **Round 3's section is the
orchestrator's transcription of the job's terse final message and its fuller reasoning is not
recoverable** — the thread is `019ff5bf-e4cb-7e50-bd13-51fc97ab1d02` and the rollout jsonl under
`~/.codex/sessions/` is the only place it survives. Round 4 was therefore dispatched asking for the
**full section in the final message**, which worked, and its text is complete. **The provenance note
at the head of each transcribed section is not decoration**: rounds 1 and 2 are Codex's own bytes and
rounds 3 and 4 are not, and a later reader must be able to tell them apart. If a future round meets a
read-only workspace, ask for the section in the reply rather than spending the job discovering it.

| Gate | Expected | Observed |
|---|---|---|
| Frontend tests | `npm test` — was 1633, 49 files | **1711 passed, 50 files** |
| Types | `npm run check` — was 418 files | **420 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` — 175 modules | **175 modules transformed**, `index-C1846SS8.js` 400.85 kB |
| Rust tests | `cargo test --workspace` — 1112 | **1112 passed, 0 failed** — re-summed by the orchestrator from all 25 `test result:` lines |

Every figure above was re-derived by the orchestrator on the tree, not accepted from a worker.

**The bundle staying at 175 is correct here, and it is a different fact from every earlier step that
held it.** 2c-4a-2 and 2c-4b-2 also changed no `.svelte` file, yet each moved the count by one,
because something already in the reachable graph imported the new module. **`recovery.ts` is imported
by nothing** — it sits *above* `matchEditor.ts` and `matchCreation.ts` (it consumes `fieldIntent` and
the destination eligibility, and the reverse direction is an import cycle), so the emitted bundle is
**byte-identical** to the pre-step one, same content hash. **2c-4c-3 is what moves it to 176**, when
the two components that draw recovery import it exactly as they already import `./reapply`. A count
that does *not* move for a new module is therefore evidence about reachability, and the next step
must see it move.

**The test count moved 1633 → 1711 (+78), and +2 of that is not a case anyone wrote.**
`scripts/lint/ipc-detail.test.ts` runs a per-source-file `it.each`, so **adding a source file to
`src/lib/browser/` adds cases to a suite that has nothing to do with the step.** The rest is +64
recovery cases, +8 workspace cases and the +4 later rounds added. Anyone re-deriving this figure
after adding a module should expect the same off-by-two and not hunt for it.

**What changed:** two new source files and one modified — `src/lib/browser/recovery.ts`,
`src/lib/browser/recovery.test.ts`, `src/lib/browser/workspace.test.ts` — plus two new documents,
`docs/decisions/2c-4c-2-notes.md` and `docs/reviews/phase-2c-4c-2-code.md`. **No `.svelte` file, no
`src/lib/i18n/*`, no Rust, no `ConflictChoice` member and no new command**, which is the step's whole
shape: it draws nothing, so **no mounted test and no window reading is owed**. Those are steps 3
and 5, and step 3 also owes the evidence for step 1's live creator-surface behaviour change.

**Confirmed by the orchestrator rather than accepted from a worker:** the four gate figures above;
that the working tree holds exactly the five paths named; and that the `git status` after each of the
five rounds still showed no `.svelte`, i18n or Rust path.

---

## Phase 2c-4c step 2 review disposition

**Five rounds, seventeen findings, and exactly two of them were defects in behaviour.** The pattern
this project has recorded since 2c-2 held again and got sharper: **each round closed what it was
given and left a narrower instance of it standing**, and four of the five times the narrower instance
lived in code the *previous round's own fix* had introduced. That is now five consecutive rounds on
this step, and eight consecutive across the phase.

**Round 1 — NOT READY.** Five findings: one High, three Medium, one Low.

- **High — `sourceConflictRetained` claimed an intactness the composed wrapper can falsify.** It was
  `!session.committed`, but `BrowserState.createMatch` calls `adoptTheDocumentOnDisk` on a
  `mayHaveWritten` failure **and** on the legal `saved, committed: false` out-of-date arm; that
  re-read can replace the projection, move the selection, and advance the projection generation the
  source conflict's one-shot authorization is registered against. The record explicitly claimed that
  arm retains the conflict. **The uncertain-send test could not have caught it**: its callback
  returned the failure shape directly and never executed the wrapper's adoption path, so it observed
  an intact model after omitting the very side effect that makes it non-intact.
- **Two Mediums the implementer had already flagged as tensions rather than fixed** — a
  `reapplySupport: 'supported'` with no transition behind it, and a conflict advertising reload
  consequences with no reload path. Codex ruled both defects. **A tension recorded is not a tension
  closed**, and naming one in a report does not discharge it.
- **Medium — both "no command is called" tests inspected mocks the exercised code cannot reach**, so
  neither could fail. This is the step's own acceptance criterion asserted by a test that could not
  falsify it.
- **Low — the three reserved product names** appeared in the module header and the record, and the
  record made an **absolute sweep claim** that nothing calls it those names while itself repeating
  all three. One citation was ruled **out of scope by the orchestrator**: `PROGRESS.md`'s prohibition
  sentence must name the three terms in order to forbid them.

**Round 2 — NOT READY.** F2, F3, F4 and F5 closed; **F1 not closed**, in the two transitions built to
close F2 and F3. Both spent an adoption and then returned a session that spread the *old*
`windowWasReconciled`, so `sourceConflictState` still answered `retained` after the projection was
installed and its generation advanced — and the reload test **pinned that false answer**. Plus a new
Low: `focusRecoveryField` had no closed-form guard. **The widening was ruled justified**, not an
over-reach: building the two transitions was warranted by the existing capability contract, and both
read only this form's own conflict, never `origin.conflict`.

**Round 3 — NOT READY.** The derivation was ruled sound *for the callback* — `mayHaveWritten` is
exactly the failed arm that re-reads, every answered-arm reconciliation moves `adoption` off
`notOwed`, and `windowMoved` claims uncertainty rather than movement or refusal. Two findings: the
contracts claimed a **definite** install where recording on `alreadyThere` means the code cannot know
one, and the invariant test omitted a **sixteenth** transition, `recoveryCreateCouldNotBeSent`, which
mutates a closed form. **The hole sat exactly where the finding it generalized lived.**

**Round 4 — NOT READY.** The outcome-language sweep was incomplete — seven more carriers asserting
the outcome the corrected contract disclaims — and **five transitions still had no `closed` guard**
(`acknowledgeRecoveryFindings`, both confirmation builders, the reload spend, reapply). The reason
the invariant case missed them is the finding worth keeping: **every probe received the one closed
session the reload transition produces, whose outcome, submission and reload state were cleared
during closure**, so the test could not tell an explicit guard from identity caused by that fixture.
The fix added four hostile type-valid fixtures nothing produces, each with its own adoption recorder,
and **three of the seven guards passed against the friendly fixture alone** — the hole was real and
is now measured rather than argued. Round 4 also affirmed two things not to disturb: removing the
transition counts was right (the runtime-export partition is the authority, the ordinal was
ambiguous), and the F2/F3 mechanics are intact.

**What the five rounds cost and bought.** Seventeen findings; **two defects in behaviour**, both
unreachable from a window because nothing draws this module yet; **fifteen sentences, contracts or
tests claiming more than the code gives.** The step ends with ten reverted mutations proving its
rules can fail, and with the honest limit stated in one sentence beside what it forces: the partition
forces every runtime export name to be classified and none twice, and forces **neither** correct
classification **nor** sufficient probe inputs.

**The obligation this step leaves open, and it is not optional.** Round 4's fixes have had **no
review round of their own** — the session that ran them stopped at its context boundary instead of
starting a sixth. By this project's standing rule, *a fix is a change and the round that reviews it
is not optional*, and five consecutive rounds here have found a narrower instance. **Step 3 must open
with that round**, scoped to round 4's two fixes: the seven reworded carriers, the five new `closed`
guards and the four hostile fixtures. It is written into "Next action" as step 3's first task.

> **Discharged, and this paragraph is history as of rounds 5–7.** The round it demanded ran as step
> 3's first act, and it found what the paragraph predicted it would. The verdicts, the fixes and where
> the narrowing chain finally stopped are **"Phase 2c-4c step 2 — the rounds 5–7 disposition"**
> immediately below. Nothing above this block was rewritten; the sentence *"Round 4's fixes have had
> no review round of their own"* was true when written and is false now.

---

## Verification — Phase 2c-4c step 2, rounds 5–7

**Review:** `docs/reviews/phase-2c-4c-2-code.md`, sections `## Round 5 — scoped pass over the third
fix round`, `## Round 6 — …fourth…`, `## Round 7 — …fifth…`. **Codex jobs:** `task-msqcn0ge-09nyil`
(round 5), `task-msqdcstz-n9epi5` (round 6), `task-msqdjldc-9pa4oj` (round 7). All three: no web
search, repository reading permitted, **read-only mount**, section requested in the final message and
transcribed by the orchestrator with a provenance header.

| Gate | Expected | Observed |
|---|---|---|
| Frontend tests | `npm test` — 1711, 50 files | **1711 passed, 50 files** |
| Types | `npm run check` — 420 files | **420 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` — 175 modules | **175 modules**, `index-C1846SS8.js` 400.85 kB |
| Rust tests | `cargo test --workspace` — 1112 | **1112 passed, 0 failed** (baseline; no Rust file was touched) |

**Every figure was re-derived by the orchestrator on the tree**, at the baseline before any change and
again after each of the three fixes. **The bundle content hash was identical at every one of those
points** — `index-C1846SS8.js`, 400.85 kB — which is this work's strongest single piece of evidence:
three review rounds and three fixes changed **no production behaviour whatsoever**.

**What changed:** `src/lib/browser/recovery.ts`, `src/lib/browser/recovery.test.ts`,
`docs/decisions/2c-4c-2-notes.md`, `docs/reviews/phase-2c-4c-2-code.md`, `PROGRESS.md`. **No `.svelte`
file, no `src/lib/i18n/*`, no Rust, no command, no export added, renamed or removed**, and no
`expect(...)`, fixture value or guard altered — round 6 and round 7 each confirmed that by inspection.
Test-case *names* changed; the test count did not.

**Confirmed by the orchestrator rather than accepted from a worker:** the four gate figures at every
point; the bundle hash; that `git status` showed exactly the five paths above and no probe file; and
that `browser.saveOutcome.reloadClosesSurface` is drawn on two shipped surfaces, which is the
correction that moved round 7's finding out of this step and onto the ledger.

**Git state:** committed as **`b1bc7b0`** — *"Phase 2c-4c-2 rounds 5-7: the claim that changed its
clothes twice"* — five paths staged by name, pushed to `origin/main` (`7ea06c1..b1bc7b0`). The tree is
clean and `b1bc7b0` is where a fresh session resumes.

---

## Phase 2c-4c step 2 — the rounds 5–7 disposition

**Three more rounds, four findings, not one line of executable change.** Rounds 5, 6 and 7 ran as
step 3's opening act, discharging the obligation the step-2 disposition left. All three returned
`NOT READY`; **all four findings were prose, contracts or test names**, and the emitted bundle came
out **byte-identical — content hash `index-C1846SS8.js` — through every one of them.** The four gates
never moved: `1711` frontend tests / 50 files, `420` `svelte-check` files 0/0, `175` modules, `1112`
Rust tests, each re-derived by the orchestrator on the tree after each fix.

**The chain narrowed by *kind* each round, and that is the reusable finding.** This is the sharpest
statement this project has of its own worst defect class, because each round's search was written
from the previous round's vocabulary and each time the claim survived by changing its clothes:

| Round | What it found | The form the claim took |
|---|---|---|
| 5 | 2 findings, 14 sites | The **literal words** — "made the window move", "installs the projection and repairs the selection", plus a stale contract still describing four guards where nine now stand |
| 6 | 1 finding, 5 sites | The **synonym** — *adopts the disk projection*, *crosses to the disk observation*: the same guarantee with none of round 5's words |
| 7 | 1 finding, 1 site in scope | The **endorsement** — `recovery.ts` no longer claimed it, but it vouched for a **shared warning that did**, so the claim survived by reference |

**Rounds 5 and 6 also found sites their own briefs had not listed** — 3 and 1 respectively — which is
the pattern working as intended rather than against it.

**What is settled and must not be re-opened.** Round 6 ruled the thirteen reworded carriers, the
nine-guard terminal contract and the four hostile fixtures **complete**; round 7 ruled
*"takes the disk version in two steps"* (`recovery.test.ts:1319`) an accurate description of the
**person's** two-step act rather than an outcome claim, and ruled *"closes the form on that spend"*
accurate against the real control flow — `notAttempted` returns unchanged, `refused` records
`RELOAD_REFUSED` and leaves `closed` false, and only a satisfied result closes. `windowWasReconciled`
remains correct, coarse and monotonic; both `installed` and `alreadyThere` must keep setting it.

### Round 7's finding escaped this step, and the orchestrator corrected the round twice

Round 7's Medium is the warning `browser.saveOutcome.reloadClosesSurface` — *"Loading the version on
disk **moves this window to it**"* (`en.json:161`, `es.json:161`). Two corrections were recorded in
the review file, neither of which changes the finding:

1. **It is not unreachable; it is shipped, in both languages, on two window-read surfaces.** Round 7
   measured reachability from `recovery.ts`, which nothing draws, and by that measure was right. But
   `saveOutcome.ts:795` selects that key from `draftKind: 'authoredText'`, which the **match editor**
   and the **match creator** already produce — `MatchEditor.test.ts:1171` and `MatchCreator.test.ts:970`
   each assert it **is** drawn, while the deleter, mover and duplicator each assert it is not. That
   raises what is at stake and simultaneously puts the sentence **outside 2c-4c-2**.
2. **Whether it is false is genuinely contested, and this record does not assert that it is.**
   `alreadyThere` is answered when a reprojection has **already reached the requested revision**, so
   in that arm the window *is* on the disk version and merely did not have to move. Read as a promise
   about **movement**, the sentence is false there and round 7 is right; read as a promise about
   **where the person ends up**, it holds in both arms. This project has never ruled which reading a
   warning makes, and choosing one here would settle it by momentum.

**Disposition: the in-scope half was fixed and the rest was ledgered, visibly.** `recovery.ts`'s
capability contract no longer endorses the warning wholesale — it now vouches for **the closing and
that nothing is seeded in the draft's place**, and says in the same breath that it cannot vouch for
*"moves this window to it"* because a satisfied adoption answers `alreadyThere` as readily as
`installed`. The dictionary sentence goes to the standing debt ledger by the established precedent
that **changing a user-facing sentence on a shipped screen obliges a re-taken window reading of the
sub-phase that owns it** — here 2c-4a-3c.

**The standing debt ledger is therefore five items**: `browser.matchDeletion.sendFailed`,
`browser.rawEditor.discardWarning`, `browser.matchMove.refused.unsavedDraft`, `MatchMover.svelte:511`'s
in-component rule, and now **`browser.saveOutcome.reloadClosesSurface`'s "moves this window to it"**,
which is the only one of the five carrying a **disputed** rather than an agreed defect.

### Whether an eighth round is owed — a judgment left visible rather than taken silently

The standing rule says a fix is a change and the round that reviews it is not optional, and round 7's
fix is one sentence of prose in a doc comment. Against that: three rounds have now produced **zero**
executable change and a byte-identical bundle each time, and round 7's own finding had already left
this step's scope. The fix was therefore written to be **maximally conservative** — it withdraws a
claim and vouches for less — which is the shape a round 8 would have the least to find in.
**Recommendation: proceed to step 3 and do not spend round 8**, recorded here so a fresh session can
overrule it on the evidence rather than rediscover the question.

---

## Verification — Phase 2c-4c step 1

**Record:** `docs/decisions/2c-4c-1-notes.md`. **Review:** `docs/reviews/phase-2c-4c-1-code.md`
(three rounds in one file: round 1, `## Confirmation pass`, `## Third pass — the overflow fix`).

**Codex jobs:** `task-mspu3ppu-46us6h` (round 1), `task-mspvw7q0-59af4v` (confirmation),
`task-mspwsgjl-sw2vr5` (third pass). All three: no web search, repository reading permitted.

| Gate | Expected | Observed |
|---|---|---|
| Rust tests | `cargo test --workspace` — was 1086 | **1112 passed, 0 failed** — re-summed by the orchestrator from all 25 `test result:` lines |
| Lint | `cargo clippy --workspace --all-targets -- -D warnings` | clean, exit 0 |
| Format | `cargo fmt --check` | clean, exit 0 |
| Architecture (D2x) | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| Frontend tests | `npm test` — 1633, 49 files | **1633 passed, 49 files** — unchanged, as a Rust-only step requires |
| Types | `npm run check` — 418 files | **418 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` — 175 modules | **175 modules transformed** |

**The three frontend gates are unchanged on purpose, and that is the step's shape showing through.**
No source module was added, so 175 stands; the eleven TypeScript-side edits are the wire mirror, the
two dictionary sentences and doc-comment corrections, none of which is a new module or a new case.
The Rust count moved **+26** across the three rounds — 1086 → 1101 (the step) → 1110 (the fix round)
→ 1112 (the overflow fix).

**What changed:** twenty tracked files and two new documents. Core —
`draft/{mod,new_match}.rs`, `patch/{edit,mod}.rs`, `persist/save.rs`, `validate/mod.rs`, and the
tests `patch_item.rs`, `persist_save.rs`, `validate_semantics.rs`. Shell —
`src-tauri/src/{commands,dictionary_contract,dispatch_check,wire_contract}.rs`. Frontend —
`src/lib/browser/{matchCreation.ts,workspace.svelte.ts}`, `src/lib/i18n/{en,es}.json`,
`src/lib/ipc/{commands.ts,commands.test.ts,types.ts}`.

**No `.svelte` file changed, and `rg -c "#\[tauri::command\]" src-tauri/src/commands.rs` is still
`12`** — the step registered no command, exactly as its brief required. **No mounted test and no
window reading is owed**, because no component changed; those are steps 3 and 5.

**Independently confirmed by the orchestrator rather than accepted from a worker:** the new code is
`SuspiciousButPermitted` in `validate/mod.rs`'s `class()`, which is an **exhaustive match with no
wildcard**, so a future variant that forgets its class is a compile error there; and both dictionary
sentences claim only that the new snippet repeats trigger text another snippet in the list already
writes and that this application cannot determine how espanso will handle overlapping definitions —
**D2u-conformant in both languages, with no placeholder in either**.

---

## Phase 2c-4c step 1 review disposition

**Round 1 — NOT READY.** Three Mediums and two Lows.

**One of the five was a defect in behaviour, and it is the one worth carrying forward.**
`findings_of` ran the new inspection whenever a batch held exactly one `InsertItem`, and the locator
treated `candidate_items.len() - 1` as the source sequence's old length. But `apply_edits`
**deliberately accepts mixed batches** and folds several changes to one sequence, so an insertion
combined with a `RemoveItem` shifted the arrival while the locator still looked one place too high.
The concrete failure: remove the first item and insert a *unique* new trigger after original item 1,
where original items 1 and 2 already share a literal trigger — the code inspects the wrong item, sees
*their* repetition, and emits `NewMatchRepeatsLiteralTrigger` **against an existing item, for a new
snippet that repeats nothing**. Two insertions, conversely, skipped the inspection entirely.

The other four were this project's ordinary classes: tests that assert a property without crossing
the path that can break it (the "ordinary creation" evidence reconstructed `create_one_match`'s
lowering locally instead of entering it, so dropping the optional fields there would have left it
green); stale two-field prose on a now-six-field public boundary; an undecodable-scalar exclusion no
test could falsify; and no Rust↔TypeScript property parity check on `NewMatch`.

**The fix round took the review's second option** — derive the address from the verified aggregate
batch — rather than forbidding a mixed batch. Its reason, and the reason it is recorded here: option
one would have **deleted a capability `apply_edits` deliberately has** (there is a standing test that
an insert and a removal in one batch land where the bytes say), would have needed a new `EditError`
and therefore a bilingual refusal sentence **no caller can reach and no window can show**, and would
have converted the multiple-insertion under-report into a refusal instead of closing it.
`replay_item_positions` was extracted out of `fold_item_expectations` so the fold and a new public
`insertion_landings` share **one** arithmetic.

**Round 2 — NOT READY, all five closed, one new Low introduced by the fix.** The confirmation pass
verified the extraction preserves the fold exactly — claims grouped in first-seen order, insertions
retaining claim order, same-anchor insertions preceding the original item, a claimed removal
suppressing that item, the same touched-subtree digest for every kept slot — and then found that the
**newly public** `insertion_landings` documented itself as pure arithmetic that validates nothing
while adding without `checked_add`. One `InsertItem::after(sequence, usize::MAX, …)` panics in an
overflow-checking build before the promised no-contribution behaviour, and wraps to a **plausible but
false front landing** in a build without checks.

**Round 3 — READY, no findings.** The overflow fix made `ItemPlacement::items_above` checked **at its
own site** (`After(index) => index.checked_add(1)`, signature now `Option<usize>`) rather than
guarding at each call, because that function is the only place all three placement variants become a
count and the false sentence lived there. The pass found **four call sites and no omitted production
caller**, ruled `plan_item_insertion`'s reuse of the existing `EditError::NoSuchDestinationItem`
honest for an overflowing anchor (such an index cannot name an element, so absence of the destination
is the operative error *and* the check that occurs first), and confirmed `create_one_match`'s
degradation to `at: None` is safe: `run_one_save` does not treat a missing address as an error, so a
committed write still returns `SaveResult::Saved` with `moved: None` and **no consumer reads the
missing address as permission to retry the write**. Both new tests were confirmed falsifiable in the
reported ways, neither passing vacuously through the early no-insertions return.

**What this step teaches, beyond its own code:** the first round's behavioural defect existed because
the inspection derived an address from a *shape it assumed the batch had* rather than from the engine
that actually places the item. The engine already knew. Both the fix and the third pass's argument
rest on the same move — ask the arithmetic that does the work, once, instead of re-deriving it beside
it.

**What no test pins, stated because nothing else will.** `insertion_landings` is arithmetic over a
*request*, and it trusts that only `InsertItem` and `RemoveItem` change a sequence's cardinality —
true today only because move and duplicate are batch-of-one, and **the match arms are wildcards, so
the compiler will not force a future cardinality-changing variant into this arithmetic**. Nothing
bounds the replay's time or allocation for a near-`usize::MAX` count that survives the three checks;
that is a cost, not a wrong index, and the doc comments were narrowed to say so. And no executable
test pins what the finding's *sentence* claims — the i18n suites check parity and placeholder
agreement, never meaning.

---

## Verification — Phase 2c-4c design consult

**Consult:** `docs/reviews/phase-2c-4c-design.md` (25 260 bytes, written by the job itself).
**Codex job:** `task-mspsc1gw-ji2qnu`, effort `high`, no web search, repository reading permitted.

**This step changed no source file.** Its whole effect is one new document under `docs/reviews/` and
the checkpoint entries recording what it ruled. **No mounted test and no window reading is owed** —
nothing was built.

**The gates were nonetheless run in full on the pristine tree at `81bc193`, before any edit**, to
confirm that the production baseline 2c-4b-3d-3 rebaselined is the one this phase starts from, and
because the corrected `1633` had not yet been re-observed by a second session:

| Gate | Expected | Observed |
|---|---|---|
| Frontend tests | `npm test` — 1633, 49 files | **1633 passed, 49 files** |
| Types | `npm run check` — 418 files | **418 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` — 175 modules | **175 modules transformed** |
| Rust tests | `cargo test --workspace` — 1086 | **1086 passed, 0 failed** — re-summed from all 25 `test result:` lines |
| Lint | `cargo clippy --workspace --all-targets -- -D warnings` | clean, exit 0 |
| Format | `cargo fmt --check` | clean, exit 0 |
| Architecture (D2x) | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |

**`1633` is confirmed, not inherited.** It was re-derived on a harness-free tree by a session that
did not produce it, which is exactly the re-derivation `2c-4b-3d-3-notes.md` §3 asked for.

**The working tree** was empty before the consult: `git status --short --untracked-files=all`
returned nothing. The consult's only write is the review document.

---

## Verification — Phase 2c-4b step 3d-3

**Record:** `docs/decisions/2c-4b-3d-3-notes.md`. **Review:** `docs/reviews/phase-2c-4b-3d-3.md`.

**This step changed no tracked source file.** Its whole effect is the absence of two untracked files,
the reversion of four hook lines to what `HEAD` already held, and the deletion of a 3.0 GB scratch
tree. **No window reading and no mounted test is owed**, because no component changed and the two
files that did change went back to the versions every existing reading was taken against.

**The gates, each run by the orchestrator on the exact tree, before and after the removal**, and none
taken from a worker's report:

| Gate | With the harness | After the removal |
|---|---|---|
| Frontend tests | `npm test` — 1634 passed, 49 files | **1633 passed, 49 files** |
| Types | `npm run check` — 419 files, 0/0 | **418 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` — 176 modules | **175 modules** |
| Rust tests | `cargo test --workspace` — 1086 | **1086 passed, 0 failed** — re-summed from all 25 `test result:` lines |
| Lint | `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| Format | `cargo fmt --check` | clean |
| Architecture (D2x) | `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| Bundle shape | `rg -l 'svelte/internal/server\|async_hooks' dist/assets/` | no hits — the −1 shape, not the `resolve.conditions` regression |

**The working tree.** `git status --short --untracked-files=all` returns **nothing at all** and
`git diff` is empty. No real-config path appears anywhere in it.

### The one finding, and it is a record's, not the application's

**The production frontend test count was `1623` in this file and is `1633`.** Two of the three
production figures were right; the test count had been stale since 3d-1 and was copied forward through
three consecutive step records. The arithmetic, re-runnable rather than assertable:

```
1623  production at 3a
+ 1   src/probe.ts as a case in scripts/lint/ipc-detail.test.ts (one case per .ts/.svelte under src/)
= 1624 with the harness at 3b
+ 10  net cases committed by a2069db (3d-1): 34 added `it(`/`test(` lines, 24 removed,
      and `rg -c '^[-+].*\.each'` over that diff finds nothing, so no line hides more than one case
= 1634 with the harness at 3d-1, 3d-2a and 3d-2b
- 1   the probe case, removed here
= 1633 production at 3d-3
```

**Why nothing could fail for it:** a production number is only observable on a tree with no harness in
it, and there was no such tree between 3d-2a and this step. `418` and `175` survived because 3d-1
added no file under `src/` and no source module — it added cases inside test files that already
existed. The two stale sentences are **annotated in place** in the 3d-2a and 3d-2b sections above,
beside the originals rather than replacing them, the way 3d-2a annotated `BLOCK_TEXT_LIMIT`.

### What the removal does not close, and never was going to

3d-2a §6.7's **five holes** survive, unchanged: `browser.notice.gone`'s second producer
(`repairSelection`'s `clearSelection` arm, `src/lib/browser/selection.ts:292` — the reading drew that
sentence from `reresolve`'s **length** arm only), and the confirmed-reload transition on the creator,
the deleter, the mover and the duplicator, which exists on all five match surfaces and had a case on
one. **None is an obligation of `2c-4b-3d-1-notes.md` §7**, and each now costs an instrument rebuild
as well as its missing fixture or plan arm. A rebuild needs the *inputs* — the two probe sources, the
four hook lines, `launch.sh`, the case table and the fixtures — **not** `launches/P01…P75/`, which is
retained output; and **3.0 GB is what 75 launches grew to, not a reconstruction footprint.**

**The bound the reading kept is restated so it is not lost with the instrument that carried it:** the
fixture shape was the easy one — plain `replace:` scalars, double-quoted triggers, LF, no BOM, no block
scalars, no item-owned comments, no read-only file. **None of the fifteen corpus fixtures `CLAUDE.md`
§4 lists has ever been through this harness, and the owner's real configuration has never been opened
by it.**

---

## Phase 2c-4b-3d-3 review disposition

**Round 1 — NOT READY. One High, four Medium, three Low** (`docs/reviews/phase-2c-4b-3d-3.md`).
**Every one of the eight is prose**; not one is a defect in the removal, and none changes a byte
written to a user's file. The reviewer was asked specifically to **refute** the 1633 conclusion and
did not: *"The current production count is unambiguously 1633 passed / 49 files, because it was
measured after removal on a clean tree."* It also ruled the manifest bound (§1.3) *"honest and
adequate […] It does not imply that a check occurred at deletion."*

| # | Finding | Disposition |
|---|---|---|
| H1 | The record said the stale `PROGRESS.md` figures **"are corrected in place"** while all four sites still read `1623` — a claim of work not yet done | **Fixed by doing the work**, not by rewording: the status row, the 3d-2a and 3d-2b verification sections and "Next action" are annotated. **The orchestrator's own sweep then found two more** in superseded "Next action" blocks, both stale on the day they were written — **six sites, not four**, the narrowing pattern appearing inside the fix for the round's own High. Every other `1623` is accurate history and was deliberately left |
| M1 | `git checkout -- <paths>` restores from the **index**, not `HEAD`, and plain `git diff` does not show staged difference — so the record's "byte-identity by construction from `HEAD`" was not established by what it cited | Fixed. §1.1 now rests on two observations instead of on the command's name: the pre-command `git status --short` showed a **space in the index column** for both files, so the index equalled `HEAD`; the post-command empty `git status`/`git diff` shows worktree, index and `HEAD` equal |
| M2 | §5 claimed the tracked tree was byte-identical at the step's **start** and end — false, it held four hook lines at the start | Fixed: byte-identical **to `HEAD`**, and explicitly *not* to what the files held at the start. That distinction is what discharges the reading rule |
| M3 | §3 treated a ten-**file** stat plus a commit message as proof of ten added **cases**; additions and removals could net to anything | **Fixed by measuring, which strengthened the claim rather than softening it**: 34 added case lines, 24 removed, net **+10**, matching the gate delta exactly, with the `.each` condition checked rather than assumed |
| M4 | §4.2 called an unmeasured future rebuild cost **"measured"**, and said "the whole scratch tree" would have to be reconstructed | Fixed. Feasibility is demonstrated (2c-4a-3c-5 deleted a harness, 3d-2a rebuilt one); **effort is unmeasured and no longer claimed**. The 75 launch directories are retained output, not inputs |
| L1 | §2.1 stated as a general rule what is a rule of thumb about this bundle | Fixed: the rule is attributed to `CLAUDE.md` §6, and the attribution for *this* tree is argued from three observations on it |
| L2 | "the numbers a fresh clone produces" — no clone was made | Fixed: "the measured harness-free working-tree values", with the `npm install` precondition named |
| L3 | "the ten R1 files" enumerated **eleven** | Fixed, with the 1 + 11 + 9 = 21 arithmetic shown |

**What the review could not do, recorded so no reader infers otherwise:** it read the record, the
relevant `PROGRESS.md` sections and the repository, but **ran no gate**. Every number above is the
orchestrator's own measurement on the exact tree; the review checked the arithmetic and the claims.

---

## Verification — Phase 2c-4b step 3d-2b

**Record:** `docs/decisions/2c-4b-3d-2b-window-reading.md`.
**Reviews:** `docs/reviews/phase-2c-4b-3d-2b-reading.md` (round 1) and
`docs/reviews/phase-2c-4b-3d-2b-confirmation.md` (the confirmation pass).

**The gates, with the harness in the tree**, each re-run by the orchestrator on the exact tree that
closes this step and not accepted from a worker's report:

| Gate | Command | Result |
|---|---|---|
| Frontend tests | `npm test` | **1634 passed, 49 files** |
| Rust tests | `cargo test --workspace` | **1086 passed, 0 failed** |
| Types | `npm run check` | **419 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` | **176 modules** |

The production numbers remain **1623 / 418 / 175**; 3d-3 returns to them when it deletes the harness.

> **Correction, made at 3d-3 and left here beside the original rather than replacing it.** The `1623`
> above is **stale** — the same stale figure this file's 3d-2a section carries, copied forward from
> before 3d-1 committed its 10 new test cases. The measured harness-free figures are
> **`1633 / 418 / 175`**; the two that were right stayed right. See
> `docs/decisions/2c-4b-3d-3-notes.md` §3.

**The review round changed `src/probe.ts`** — uncommitted harness code, but a file `svelte-check`,
`vitest` and `vite` all read — so the four gates were re-run after the instrumentation and **before**
P54, and again at the close of the step. The first round changed no file at all and did not run them,
and the record says so rather than implying a run.

**The working tree.** `git status --short --untracked-files=all` lists the two modified hook files,
the two untracked probe sources and this step's untracked documents under `docs/`; `git diff --stat`
over `src/main.ts` and `src-tauri/src/main.rs` is **5 insertions and 1 deletion** — the four hook
lines and nothing else. **No tracked source file was changed by this step**, and the harness stays
uncommitted.

**The launches.** **64 (P12–P75)** — P12–P53 the reading as first taken on binary `84148bbf…`,
P54–P75 the fix round on `7fe2a6da…`. All 64 reached `--- end`, none printed `--- failed`, every
`probe.err` is zero bytes, and every `bytes=` verdict is **MATCH**, including all five of the
expected-bytes files 3d-2a §6.3 had flagged as never compared against anything. **All 23 cases of the
driver's table have now been launched at least once on this tree**, so 3d-2a §6.2's fourteen-case list
is empty.

**What the reading settled, and it is what the step was for:**

- **3c-2 §11.1's Medium is closed.** Sixteen refusal readings over five surfaces and both languages
  put the reapply report at `y = 44`, the top of the visible band [44, 689].
- **The cause is measured.** P66 records one application-issued `block:nearest` request on the report,
  paired synchronously with `delta=-114` and `rect=-70->44`; `revealReapplyReport`
  (`src/lib/components/reveal.ts:168`) is the only production path calling `scrollQuietly` with
  `'nearest'`.
- **The success-path reveal moves nothing**, on all five match surfaces in both languages; on the
  editor 160–295 px of room went unspent, and the editor's final offset is the browser's clamp,
  separated from the reveal for the first time.
- **A second press re-issues the request** — one `origin=app` call in each of ten `:twice` launches,
  returning without throwing and producing no movement while the report was already in view.
- **§11.3's High, §11.5's Medium and §11.2's Low are closed for the strings this reading drew**, and
  `browser.notice.gone` and `fieldCollisions`' ineligibility arm were judged on a screen in both
  languages.

**The reading's own findings are three Lows (F1–F3) and three Observations (F4–F6), and none is a
defect in what is written to a user's file** — 64 launches, 64 `bytes=MATCH`.

**The bounds it keeps** (record §15): no invoke spy and no command counter, so every refusal claim is
about the **final filesystem state**; the reveal is observed as a *request* and a pane offset, **never
as a platform decision**, and `threw=false` says only that the native call returned without throwing;
the instrumented launches force a layout flush the uninstrumented ones do not; on the four operation
surfaces the success-arm `delta=0` says nothing about the request, because the pane's range was
already `0`; whether a second press ran a second reapply **transition** is still unobservable; §12's
17 px panel-height instability is reproduced and **confounded**, excluding neither candidate cause;
and **the fixture shape is still the easy one — none of the fifteen corpus fixtures `CLAUDE.md` §4
lists has been through this harness, and the owner's real configuration has never been opened by it.**

---

## Phase 2c-4b-3d-2b review disposition

**Round 1 — NOT READY. Three Medium, two Low, one Observation** (`phase-2c-4b-3d-2b-reading.md`).
**Two of the six could not be closed by rewording**, and that is the step's result: they were closed
by **instrumenting the harness** — a `scrollIntoView` spy with pane samples taken synchronously either
side of every call — and by 22 new launches.

| # | Finding | Disposition |
|---|---|---|
| 1 | **Medium** — the reveal's direction was not measured. Every sample was taken *after* the transition, so nothing distinguished a reveal that scrolled from a clamp that produced the same final number | **Closed by measurement**, not by rewording: the instrument (record §1.4) plus twelve new launches (P54–P65). §5.3 replaces "down or nothing, never up" with *the reveal moves nothing on the success path*, and separates the browser's clamp from the request. Checkable against `launches/P54…P65/probe.log` |
| 2 | **Medium** — obligation (c)'s *still scrolls* half was answered with "the report remained in the band", which is consistent with a second press that issued no request at all | **Closed by measurement**: ten new `:twice` launches (P66–P75). §9.1 records exactly one `origin=app` `block:nearest` request per launch, `delta=0` against a pane with room in both directions. Checkable against the `secondReapply` segment of those logs |
| 3 | **Medium** — §12's causal exclusion outran its evidence | **Closed** — rewritten to the confounding conclusion: the between-launch instability is established, and the exclusion of either of 3d-2a's candidate causes is withdrawn. No other verdict depends on conflict-panel height |
| 4 | **Low** — F5 contradicted `2c-4b-3d-1-notes.md` §4.2 | **Closed** — "those call for different actions" removed; F5 kept as a neutral observation that the model intentionally does not attribute a collision to one disjunct, and 3d-1's truthfulness fix stated as delivered |
| 5 | **Low** — §15 was not a complete bounds list | **Closed** — six items added (10–15): the five holes by cross-reference to §14, the three instrument bounds, the operation surfaces' uninformative zero, and the two questions that were the reading's central limits |
| 6 | **Observation** — F1's Low grade rested on the wrong precedent (an earlier reading's decision not to file) | **Closed** — regrounded in current impact and reachability: informational block, one surface, reachable at `y = 44`. 3c-2 §9 is now cited for provenance and non-regression only |

**The confirmation pass — NOT READY on three Lows, all three wording defects in one record and none
of them a defect in what is written to a user's file.** It also confirmed the two measurement fixes
landed at the right layer, ruled the observer-effect bound stated at the right strength, found the
other four round-one corrections sound, verified the fourth binary's digest against the retained
build, and **found no narrower recurrence of round one's findings**.

| # | Finding | Disposition |
|---|---|---|
| 1 | **Low** — §4 called P12's 114 px panel displacement and P66's 114 px pane movement "the same event seen from the two ends", when they are separate launches on separate binaries | **Closed** — restated as *the same 114 px transition shape reproduced across the first launch and its instrumented re-take*, with an explicit "they are not two observations of one event", and the causal statement rested on P66's own paired `delta`/`rect` plus the source search that leaves `revealReapplyReport` the only `'nearest'` caller |
| 2 | **Low** — "decision", "the transcript proves" and "the platform runs it without refusing it" exceeded what the spy observes; `threw=false` does not separate an honoured specified no-op from a silent ignore | **Closed** in §1.4, §5.3, §9.1 and §17: the zero is now **the specified no-movement outcome and not a range clamp**, the request *returned without throwing and produced no movement while the report was already in view*, and no passage claims an internal platform state. §15 item 11, which already stated the tension correctly, is unchanged and the other passages were made consistent with it. The sound conclusions are kept: the application re-issued the request, and the request caused no movement despite available range |
| 3 | **Low** — §17 restored the stale "eighteen" refusal count that §4 had already corrected to 42 | **Closed** — §17 now says **42** and names §4's evidence (3c-2 §9 and §11.1 both say 42; 18 is the stale `PROGRESS.md` value). Nothing in the fix round changes the historical count |

**The whole-file sweep the ninth round owed, and what it found.** After finding 2 was closed, the
record was swept for **any** passage claiming an observed platform choice, refusal, acceptance or
intent — searching for what the corrected text now says rather than for the words the finding used.
**Six further passages** carried the same class and were corrected: §1.4's account of what the first
round could not tell apart ("a pane that chose not to move"), §5.3's closing bound ("no evidence about
the request's *intent*"), §5's three-way answer and §9.1's own heading (both calling the request "a
no-op"), F3's justification ("a request that correctly declines"), and §15 item 13 ("*declined to
scroll*"). **`threw=false`'s limit is now stated in §1.4 bound 1 itself**, where the claims that
relied on it point. Nothing else in the file claims an internal platform state.

**That is the ninth consecutive review round in phase 2c-4b, and the first in eight to be told to
sweep from the corrected text rather than from the finding's wording.** The confirmation pass found no
narrower recurrence of round one's findings; this fix round's sweep is recorded above so the next one
can check it rather than repeat it.

---

## Verification — Phase 2c-4b step 3d-2a

**Record:** `docs/decisions/2c-4b-3d-2a-instrument-rebuild.md`.
**Reviews:** `docs/reviews/phase-2c-4b-3d-2a-instrument.md` (round 1) and
`docs/reviews/phase-2c-4b-3d-2a-instrument-round2.md` (the confirmation pass).

**The gates, with the harness in the tree**, each run by the orchestrator and not accepted from a
worker's report:

| Gate | Command | Result |
|---|---|---|
| Frontend tests | `npm test` | **1634 passed, 49 files** |
| Rust tests | `cargo test --workspace` | **1086 passed, 0 failed** — re-summed from all 25 `test result:` lines |
| Types | `npm run check` | **419 files, 0 errors, 0 warnings** |
| Bundle | `npm run build` | **176 modules** |

The production numbers remain **1623 / 418 / 175**; 3d-3 returns to them when it deletes the harness.

> **Correction, made at 3d-3 and left here beside the original rather than replacing it.** The
> `1623` in the sentence above is **stale, and was stale when it was written**. 3d-1 committed **10**
> new test cases while the harness was in the tree, so the production count had already moved to
> **1633**; only the *with-harness* figure (1634) was re-derived after 3d-1, and the production figure
> was copied forward. 3d-3 measured `1633 / 418 / 175` on the harness-free tree. **`418` and `175`
> were correct** — 3d-1 added no file under `src/` and no source module. The arithmetic and its
> artifacts are `docs/decisions/2c-4b-3d-3-notes.md` §3.

**The working tree.** `git status --short --untracked-files=all` lists the two modified hook files,
the two untracked probe sources and the untracked documents under `docs/`; `git diff --stat` is
**5 insertions and 1 deletion across `src/main.ts` and `src-tauri/src/main.rs`** — the four hook lines
and nothing else. **No production source file was changed by this step**, and the harness stays
uncommitted.

**The launches, re-derived by the orchestrator rather than read off the worker's table.** All eleven
`probe.err` files are zero bytes; all eleven logs end at `--- end`; a literal search for `--- failed`
across all eleven finds nothing; all eleven report `bytes=MATCH`. P01/P03/P05/P06 end at four distinct
hand-authored expected files with `backups=PRESENT`; P02/P04 and P07–P11 end at R1 with `backups=none`.

**The two sentences that had never been drawn**, verified by the orchestrator against the shipped
dictionaries rather than against the worker's claim:

- `browser.notice.gone` — `en.json:124`'s text found in `P09/probe.log`, `es.json:124`'s in
  `P10/probe.log`. One occurrence each.
- `browser.matchEditor.reapply.fieldCollisions` — `en.json:255`'s text found in `P07/probe.log`.

**Why this step exists at all**, and it is the deviation a cold session most needs: the checkpoint
that opened it assumed the harness had survived. Half of it had. The scratch half — `launch.sh`, the
fixtures, the driver's case table and 110 launch directories — was in a session scratchpad that no
longer exists, so **the reading could not begin**. The rebuild is at a stable path outside any session
directory for that reason.

---

## Phase 2c-4b-3d-2a review disposition

**Round 1 — NOT READY. Three High, one Medium, three Low.** Two of the three Highs were **real
instrument gaps, not prose** — the same failure mode as 3c-1's round 1, and caught for the same
reason: the instrument was reviewed *before* the reading was scheduled on it, not during.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High** — no case could draw `browser.notice.gone`. The driver always selected `:beta` at position 1 and the shortest R1 still had two items, so the length predicate `view.matches[previous.position] === undefined` could not fire. Never drawn in any launch in this project's history | **Closed** by `editor-reload-gone`: the selection moved to `:gamma` at position 2, the existing two-item `target-deleted-r1.yml` reused, the conflict answered *Load the version on disk* → *Discard my text and load it*. **No new fixture was needed.** Drawn P09 (en), P10 (es) |
| 2 | **High** — no fixture made a drafted editor field newly **ineligible**, so `fieldCollisions`' corrected sentence could only be read on the already-measured *value*-collision subcase — not the arm the correction was for | **Closed** by a fixture pair differing by three bytes (`replace:` / `replace: ""`, 206 / 209) plus a `draft` parameter, so both plans draft the same `""`, the disk holds the drafted value in both, and **only eligibility differs**. Round 2 traced the refusal to `ownsNoBytes` — `fieldEligibility` returns it exactly when the scalar span is zero-width. Drawn P07 (en), P11 (es), with P08 the isolating twin drawing `alreadySatisfied` |
| 3 | **High** — the record's bounds inherited 3b §8 and 3c-1 §7 but never disclosed either missing case, and the actual downstream work list is the newer `2c-4b-3d-1-notes.md` §7 | **Closed** by a new §6.7: a per-obligation table against that §7, naming for each row the case that serves it and whether it has been launched. Round 2 verified the table complete |
| 4 | **Medium** — the opening turned a two-file digest observation into a claim about every fixture. Old-versus-new digests exist for `base-r0.yml` and `elsewhere-r1.yml` only; for the other seventeen there is no original, no old digest and no before-manifest | **Closed** — the opening now separates *contradicted for two files* from *unknown for seventeen*, matching §4.2's own scope |
| 5 | **Low** — "every fixture here is re-authored from … §4 and … §2" omitted the third source; two fixtures come from `2c-4b-3c-2-window-reading.md` §1.3 | **Closed** — all three records named, and the two fix-round fixtures identified as authored from code rather than from any record |
| 6 | **Low** — two historical no-change claims had no before-image; the manifest binds only post-step versions | **Partially closed at round 2**, then closed in the round-2 fix pass below |
| 7 | **Low** — "assembles the `.app` from the freshly built binary" was unbound; `launch.sh:33` accepts an arbitrary `ECFG_BINARY` and `:103` merely copies it | **Partially closed at round 2**, then closed in the round-2 fix pass below |

**Round 2 — NOT READY, on prose alone.** The verdict says so in its own words: *"Correct those
sentences and the 'holes' classification; **no new launch or fixture is required by this review**."*
It confirmed findings 1–5 closed, traced both new proof constructions to source rather than accepting
them, and re-derived every count independently: 23 case rows in `launch.sh` and 23 arms in `runPlan`;
nine distinct cases launched and the other 14 exactly the list in §6.2; nine `*-expected.yml` files
with five uncompared, exactly the list in §6.3; `manifest-3d-2a-post.sha256` 46 entries, all verifying.

Its four findings were one Medium and three Lows, **all in the record and none in the instrument**:
a no-write claim derived from final-byte equality (introduced by the round-1 fix round itself);
narrower surviving instances of finding 6 at three further sites; a causal gloss in §5.10 attributing
two binary digests' difference to a particular edit and rebuild with no retained source-to-build
binding; and §6.7 labelling disclosed coverage gaps "holes" where its own entries said otherwise.

**That is six consecutive review rounds in phase 2c-4b, each closing a finding and leaving or creating
a narrower instance of it** — every time because the sweep was written from the previous *wording*
rather than from what the artifacts now support. The round-2 fix brief was written against that
history explicitly, and the two partially-closed findings were required to be closed **everywhere**,
with the additional sites reported. That sweep found **eleven further sites** the review had not
cited, two of them counts that had gone stale *during the round*.

**Round 3 — NOT READY, scoped to the record's prose and to nothing else.** Two Mediums and a Low, and
it made the run seven-for-seven:

| # | Finding | Disposition |
|---|---|---|
| 1 | **Medium** — the checkpoint prediction was **already wrong when written**, and it was the orchestrator's own edit. It said the commit stages `PROGRESS.md` and *three* documents; round 3's review made a fourth, so the predicted post-commit four-path status was really five. It also found a **narrower survivor** of the time-binding it was fixing: one §1 sentence still asserted the pre-commit tip in the present tense | **Closed** — the prediction now **enumerates** the four documents (this record and rounds 1, 2 and 3) rather than counting them, and says in the same breath that this arithmetic had already moved once. Both readings are re-bound to a **named event** — the close of the round-2 fix pass — rather than to "when this record was last amended", which is a moment that moves every time the record is touched |
| 2 | **Medium** — §6.7 called the four non-editor confirmed-reload surfaces a **coverage gap** when, on its own definitions, they are **holes**: §6.2's complete list of unlaunched cases holds no creator, deleter, mover or duplicator reload case, so there is no row and no arm to launch | **Closed.** This is the one finding of the three that was **operational rather than editorial**: the record says a coverage gap costs a launch and a hole costs a fixture or plan function first, so the misclassification would have sent 3d-2b to launch cases the same record says do not exist |
| 3 | **Low** — "the four hook lines were checked and **none needed restoring** … unchanged" is a historical claim, and §1 had just established there is no before-image | **Closed** — restated as what the diff gives (the hooks are present and are the four the records specify), with the historical clause relabelled an account, plus the note that for a launch's purposes the distinction does not matter: what matters is that the hooks are correct now |

**What no review round found, across all three: a defect in the instrument, or a defect in the
application.** Every one of the fourteen findings was a sentence in a record claiming more than its
artifacts give — except the two Highs, which were **absent cases** rather than false claims, and were
the reason reviewing the instrument *before* scheduling a reading on it was worth the round-trip.

**Round 3's fixes were made by the orchestrator directly and were not themselves reviewed.** Three
targeted edits to one document, no code and no artifact touched. Given the seven-round history, a
fourth round would probably find something; the judgement is that it would find it in prose about an
instrument, while the instrument itself has been verified twice by source trace. **3d-2b may open
with one if it wants the record airtight before quoting it.**

---

## Verification — Phase 2c-4b step 3d-1

All rows re-run by the orchestrator **with the harness in the working tree**, never taken from a
worker's report. The harness inflates three of them; 3d-3 returns them to the production numbers.

| Command | Result | Exit |
|---|---|---|
| `npm test` | **1634** passed, 49 files — 1624 + **10** new cases | 0 |
| `npm run check` | 419 files, **0 errors, 0 warnings** | 0 |
| `npm run build` | **176** modules — unmoved; the step adds **no** source module, and `rg 'svelte/internal/server\|async_hooks' dist/assets/*.js` finds nothing, so this is not the `resolve.conditions` regression | 0 |
| `cargo test --workspace` | **1086** passed, **0** failed | 0 |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | 0 |
| `cargo fmt --check` | clean | 0 |
| `git status --short --untracked-files=all` | the four harness paths + 22 changed frontend files + four new documents; **no Rust source modified** but `src-tauri/src/main.rs`, which is a harness hook | — |

**The Rust rows are unmoved and that is what they claim.** The only Rust file the tree modifies is
`src-tauri/src/main.rs`, and its modification is the probe hook. No Rust source changed in any of this
step's four rounds, so the three cargo rows above were measured once and re-argued rather than re-run
after every prose round.

### What the four findings actually were, and what they became

| Finding | Predicate | What the sentence says now |
|---|---|---|
| **§11.3 High** — `browser.notice.differentMatch` | `reresolve` compares a **positional index** and an **exact `source_text`** | byte inequality, plus *"that may be the same snippet with changes in it, or a different one: espansoConfig compares the text and cannot tell which"* |
| **§11.3 High** — `browser.notice.gone` | a **length** predicate, and it has a **second producer** in `repairSelection`'s `clearSelection` arm where nothing is read at all | *"can no longer point at"*, with *"that is not a statement that it was removed"* said explicitly |
| **§11.1 Medium** — the invisible reapply report | the report is a second `role="status"` panel and the reveal machinery knew only the outcome panel | `reapplyReveal` + `revealReapplyReport`, `block: 'nearest'` |
| **§11.5 Medium** — `fieldCollisions` | `fieldReapply` returns `collision` when a drafted field becomes **ineligible**, value unchanged | the real disjunction: a different value, the key added or removed, **or** a change in whether this app edits it |
| **§11.2 Low** — the Spanish register | — | *tú* throughout, and the fix is **nine** strings, not the seven the finding named |

The `differentMatch` correction was also made **at the type level**: `ReselectionOutcome`'s JSDoc in
`src/lib/ipc/errors.ts` carried the same identity claim, and an editor of that union would have read it
before any string.

**§11.5 was kept at Medium and not re-graded**, with the argument in view: the refusal and the
no-write outcome are correct and only the reason was false. It was fixed at the **sentence** end
rather than by splitting the predicate, because a field can differ in value *and* in eligibility at
once, so a split needs a precedence rule nothing supports.

### Phase 2c-4b step 3d-1 review disposition — three Codex rounds plus an orchestrator round

`docs/reviews/phase-2c-4b-3d-1.md`, `-confirmation.md`, `-final.md`.

**Round 1 — NOT READY: one High, two Lows.** The High is this project's named worst defect class,
aimed at the fix itself: `revealReapplyReport`'s JSDoc promised *"the page moves by exactly the amount
needed to show it"* while its own `scrollQuietly` **returns without scrolling when `scrollIntoView` is
absent** and **swallows a throw**. Fixed at the honesty end — the guarantee is now conditional in the
same sentence that states it — and the early return and the `catch` were deliberately left alone.

**Round 2 — NOT READY: two Lows, and one of them was the orchestrator's.** Round 1's Low, and the
brief that dispatched its fix, both said a success-path reveal pushes *"the deleter's renewed
confirmation and the mover's rebuilt destinations"* **down**. **It is backwards, verified by reading
the components**: `MatchDeleter.svelte` draws its confirmation at `:464` and its report at `:516`;
`MatchMover.svelte` draws its destinations at `:663` and its report at `:784`. Both controls are drawn
**before** the report. The fix round then rejected the orchestrator's proposed replacement as *also*
too strong and wrote a three-way rule instead — `'nearest'` aligns top-to-top for a report above the
scrollport, so the earlier controls may move up, down, or not at all, and the success geometry has
never been measured.

**Round 3 — NOT READY on one Low, the fifth consecutive round to find a narrower instance.** The
82-sentence shape sweep of round 2 had rewritten *puts / brings / scrolls into view* everywhere and
walked past the synonym **revealed** in three places. Closed by the orchestrator rather than
dispatched — three comments and a record correction, no judgement in any of them — and running the
synonym as its own search then found a **fourth** the review had not named, in the test file's copy of
the same switch comment. **Two further instances are judged and deliberately left**, recorded in the
notes so their survival is not later read as an oversight: both use the word for *which panel the cue
designates*, never for a movement achieved.

**The transferable lesson, and it is the same one five times.** A sweep written from the previous
finding's **wording** finds the previous finding. Round 2's sweep searched for a *shape* rather than
words and found 82 sites across 18 files — including nine in `src/lib/browser/saveOutcome.ts`, a file
no round had ever searched, about the **outcome** reveal rather than the reapply report — and it still
missed a synonym it had not enumerated.

### The one deliberate scope addition, argued rather than smuggled

`reapplyReveal` cues the reveal on **`reapplied` and `alreadySatisfied` too**, where §11.1's evidence
is refusal-only. **Kept, on the orchestrator's decision**: restricting it to the refusal arms would
leave the identical defect — a report block nobody can see — standing on the success arms. The
precedent is 2c-4a-3b, where a step went beyond its brief and round 1 ruled the widening justified
because it was argued and priced. Its price is disclosed and its geometry is **unknown**: 3d-2 must
read the success-arm report and the next usable controls on **all five** match components, in both
languages, not only on the two the first draft named.

---

## Verification — Phase 2c-4b step 3c-2

All rows re-run by the orchestrator with the harness in the working tree, never taken from a worker's
report. This step **adds no production code at all** — its only committed artifacts are two
documents — so every gate number is 3c-1's, unmoved, and an unmoved number is evidence of an unmoved
number and nothing broader.

| Command | Result | Exit |
|---|---|---|
| `npm test` | **1624** passed, 49 files | 0 |
| `npm run check` | 419 files, **0 errors, 0 warnings** | 0 |
| `npm run build` | **176** modules — the harness-inflated count (172 production + the probe's four) | 0 |
| `cargo test --workspace` | **1086** passed, **0** failed | 0 |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | 0 |
| `cargo fmt --check` | clean | 0 |
| `git status --short --untracked-files=all` | the four harness paths + the two new documents; **no production source modified** | — |

### The launch evidence, re-derived by the orchestrator rather than accepted

The single most consequential thing this step got wrong on its first pass was its arithmetic, so the
counts were re-derived here from the retained artifacts and not from the worker's or Codex's prose.
Over `launches/L40…L110` in the scratch tree, reading each `bytes.txt`:

| Measure | Value |
|---|---|
| launches | **71** (L40–L110), continuing 3c-1's L01–L39 |
| `bytes=MATCH` | **71 / 71** |
| non-empty `probe.err`, across all 110 launches | **0** |
| `expect=R1` (a refusal) | **50**, and **every one** of them `backups=none` |
| `expect=…-expected.yml` (an authored write) | **21**, and **every one** of them `backups=PRESENT` |

The partition is perfect and it is what falsified the record's original **28 / 43**. Codex reached
21/50 independently from the ledger; this table reached it from the artifacts. **Two independent
derivations of a number the record had wrong is why the number is now trustworthy** — and it is also
why the fix round was told to re-derive *every* count rather than patch the two named, which surfaced
five more (`manualResolution` 18→42, §10's notices 16→21, editor adoptions 6→9, shorter-surface
adoptions 10→12, *usted* lines 9→7) and two the review never raised ("ten refusal cases" → nine,
"ten of eleven" obstacle sentences → nine of ten).

**A `bytes=MATCH` is a claim about the final filesystem state and nothing more.** There is no invoke
spy and no command counter, so no row above says which command ran or when.

### Phase 2c-4b step 3c-2 review disposition — three rounds, `docs/reviews/phase-2c-4b-3c-2-reading.md`

The step changed no production code, so **every one of the thirteen findings was a claim in the
record** — this project's named worst defect class, in the one document whose whole purpose is to be
believed later.

**Round 1 — NOT READY: five High, one Medium, three Lows.** Two of the Highs were **defects in the
application the record had graded as sound**: `browser.notice.differentMatch` is *false* rather than
merely misleading (`reresolve` proves only that the bytes at the retained index differ, so it fires
when the *same* snippet was edited in place), which raised §11.3 from Low to **High**; and §5.2's
"true" verdict on `fieldCollisions` was wrong, because `fieldReapply` returns `collision` when a
drafted field becomes *ineligible* even with an unchanged value — a **new finding, §11.5**. The other
three Highs were the record's own integrity: a dropped inherited limitation in §12 (3b §8.9, that
`--- end` is printed unconditionally and is only a wrapper signal), the 28/43 miscount, and temporal
claims — *"every conflicted save wrote nothing"*, *"the write happens only on the next press"* —
beyond an instrument with no invoke spy. Re-deriving §12 item by item against 3c-1 §7 then recovered
**three further dropped limitations** the review had not named.

**Round 2 — NOT READY: one High, two Lows, and the High was a finding that did not exist.** Round 1's
sweep had alleged the `differentMatch` clause also stood in `displacedByMove` and
`displacedByDuplicate`. It does not: each is reachable only when the re-read is the committed
operation's own parse, and within that parse a move changes no item's bytes and a duplicate inserts a
byte-exact clone, so the identity claim is *earned*. Both were **retracted**. This is the pattern the
project already knew — each round's fix produces the next round's finding — pointed the other way:
**a sweep can manufacture this project's worst defect class aimed at the application**, handing a
later step work that is not there. Round 2 also confirmed, independently of the orchestrator's own
derivation, that the recount is right, that §12 now drops nothing, and that the fix round's rebuttal
grading §11.5 **Medium rather than High** holds — the refusal and the no-write outcome are correct,
and only the reason is false.

**Round 3 — NOT READY on one Low, everything else clean.** The retraction had grounded *both*
attributed notices in `adoptTheDocumentOnDisk:2750-2752`; a committed duplicate goes through
`adoptAfterTheDuplicate`, whose equivalent guard is `workspace.svelte.ts:2891-2893` and whose
clone-follow early return is `:2882-2887`. **Closed by the orchestrator rather than dispatched**,
after reading both sites: it is a citation correction with no judgement in it, and the retraction's
conclusion never depended on the citation — it rested on there being a revision guard on each
attributed path, and there are two, one per path. All three sites in the record now name both and
reserve `:2741-2746` for the move.

**A shared string is not a shared predicate**, and that is the transferable lesson. Four notices
carried the same clause; two earn it and two do not, and only reading each notice's *producer* tells
them apart.

---

## Verification — Phase 2c-4b step 3c-1

All rows re-run by the orchestrator with the harness in the working tree, never taken from a worker's
report. **This step is a split of 2c-4b-3c**, recorded below. It adds no production code, so every
moved number would be the harness's own presence — and none moved, because `src/probe.ts` was
**edited** rather than added.

| Command | Result | Expected |
|---|---|---|
| `npm test` | **1624** passed, 49 files | unmoved from 3b — `src/probe.ts` was already a case of `scripts/lint/ipc-detail.test.ts`'s sweep |
| `npm run check` | **419** files, 0 errors, 0 warnings | unmoved — already a file `svelte-check` walks |
| `npm run build` | **176** modules | unmoved — no source module added. The guard is the *shape*: a jump toward ~180 with `svelte/internal/server` in the bundle is the regression, and this is not that |
| `cargo test --workspace` | **1086** passed, 0 failed | unmoved — no Rust source changed at all |
| `cargo fmt --check` | clean | |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing | the architecture rule, D2x form |
| `git diff --stat -- src/main.ts src-tauri/src/main.rs` | 5 insertions, 1 deletion | byte-identical to 3b — the four documented hook lines and nothing else |

**An unmoved count is evidence of an unmoved count and of nothing broader.**

**The launch evidence was checked directly rather than accepted from the report.** 39 launch
directories now exist, 16 of them this step's (**L24–L39**); `find … -name probe.err -size +0c`
returns **zero** files across all 39; `rg -l -- '--- end'` matches all 16 new ones and `rg -l --
'--- failed'` matches **none** of them. `L01…L23` and 3b's eight fixtures were required to stay
untouched and did. The fixture directory now holds **17** files, 3b's eight plus this step's nine.

### The four review rounds, and the one thing they were all about

**All ten findings across four rounds were prose or coverage. Not one was a defect in the harness or
in the application**, and Codex's round-1 reply says the byte evidence itself is sound. The reviews
are `docs/reviews/phase-2c-4b-3c-1-instrument{,-round2,-round3,-round4}.md`.

| Round | Verdict | Findings |
|---|---|---|
| 1 | **NOT READY** | 2 High, 4 Medium, 1 Low |
| 2 | **NOT READY** | 5 closed cleanly, **2 closed with new residue**; 1 High, 1 Medium |
| 3 | **NOT READY** | 3 findings, **all one claim**, and one of them was the round-2 fix's own |
| 4 | **READY** | none — the chain converged |

**Round 1's two Highs were real instrument gaps, not sentences**, and they are the reason this step
existed at all rather than 3c-2 discovering them mid-reading. Q7 point 6 requires an `after` anchor
**whose bytes changed and therefore refuses**, and no case had one. Q7 point 4 requires R1 either to
**remove** the operation's target or to change **both** its trigger and its item bytes;
`target-changed-r1.yml` changed only `:beta`'s replacement and left the trigger `":beta"`, and
`creator-anchor-gone` deletes a *placement anchor*, not a target. Both are now built and launched —
`mover-after-changed` (L35) and `editor-missing` (L36).

**Round 1's Medium 3 is this repository's signature defect and it recurred here in a new form: the
record quoted sentence endings that its own transcripts did not retain.** `reportReapply` kept only
the first 300 characters, so L27's log ends at *"spelled the same on"*, L30's at *"the exact owned"*,
and L34's earlier still in Spanish — while the record wrote the full sentences, reconstructed from
knowing what the application would have drawn. `BLOCK_TEXT_LIMIT` is now 1500, L37–L39 re-ran the
three affected cases, and §5.6 of the notes states the rule generally: **a quotation is bounded by
the artifact, never by what the reader knows the application would have drawn.**

**Rounds 2 and 3 are the documented recurrence, and round 3 caught the orchestrator's own fix.**
Narrowing the title from *"extended to the whole Q7 matrix"* left the **stronger claim standing in
the body** — §7.6 still opened *"Q7 is covered case by case"* and called point 6's shapes exhaustive
two paragraphs above admitting `end`-after-reorder was unbuilt. Fixing that introduced *"point 6's
third placement shape is unbuilt"*, which contradicts the very accounting it was written to defend:
**three** shapes were built, and the unbuilt one is the `end` variant, not a third. Four locations
now agree that point 6 names **four** shapes, three have a case and a launch, and `end` after a
reorder does not.

---

## Verification — Phase 2c-4b step 3b

All rows re-run by the orchestrator with the harness in the working tree, never taken from a worker's
report. The step adds no production code, so every moved number is the harness's own presence.

| Command | Result | Expected |
|---|---|---|
| `npm test` | **1624** passed, 49 files | 1623 + 1 — `scripts/lint/ipc-detail.test.ts` sweeps every `.ts` under `src/`, so `src/probe.ts` is a case there |
| `npm run check` | **419** files, 0 errors, 0 warnings | 418 + that same file |
| `npm run build` | **176** modules | 175 + `src/probe.ts`. `rg 'svelte/internal/server|async_hooks' dist/assets/*.js` finds nothing, so this is the +1 shape and not the `resolve.conditions` regression |
| `cargo test -p espansoconfig` | **155** passed, 0 failed | unchanged — `probe.rs` declares no test |
| `cargo test --workspace` | **1086** passed, 0 failed, 26 binaries | unchanged |
| `cargo fmt --check` | clean | |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing | the architecture rule, D2x form |
| `git diff --stat -- src/main.ts src-tauri/src/main.rs` | 5 insertions, 1 deletion | the four documented hook lines and nothing else |

**The launch evidence was checked directly rather than accepted from the report.** 23 launch
directories exist; `find … -name probe.err -size +0c` returns **zero** files, so all 23 are empty; `rg
-l -- '--- end'` matches **21**. Each `bytes.txt` carries a real `cmp` verdict, a backup search and a
whole-tree diff against a pristine copy taken before the launch. Two findings were spot-checked
against the transcripts by hand before being accepted: `L07/probe.log` really does read `--- failed
timed out waiting for the deletion request control` immediately followed by `--- end`, and L20's
report really is at `y = -104`.

### The three review rounds, and what they cost

**Every one of the ten findings across three rounds was prose in the record. Not one was a defect in
the harness, and not one was a defect in the application.** The subject is
`docs/decisions/2c-4b-3b-instrument.md`, which is the only thing this step commits — so auditing it
*is* auditing the step.

| Round | Verdict | Findings |
|---|---|---|
| 1 (`phase-2c-4b-3b-instrument-record.md`) | **NOT READY** | 2 High, 2 Medium, 2 Low |
| 2 (same file, appended) | **NOT READY** | 4 closed cleanly, **2 closed by shipping their mirror image**; 2 Medium, 2 Low |
| 3 (same file, appended) | **NOT READY** | 4 of 5 passages correct; **1 finding, and it was the orchestrator's own round-2 fix** |
| 4 (same file, appended) | **READY** | none — the chain converged |

Round 1's two Highs are the ones worth carrying forward. **§4's "What it proves" column claimed
mechanisms its own fixtures cannot distinguish** — `elsewhere-r1.yml` leaves the target's bytes
identical to R0 and does not reorder the sequence, so the delete and duplicate rows cannot tell an
adopted target from the old one and the move row cannot tell `top` lowered afresh from a stale index.
The column is now *Observed result* and the mechanisms are named as hypotheses that **2c-4b-1's
Rust-side tests carry, not this instrument**. And **`--- end` is not a success signal**: `startProbe()`
prints it unconditionally after the failure report, so `launch.sh`'s `reached-end=yes` says only that
the wrapper reached its last line — L07, L08, L09 and L15 all printed `--- failed` first.

Round 2 is the documented recurrence, twice in one round. Narrowing `--- end` produced **"no part of it
is mechanised"**, which is false — `launch.sh` runs the `cmp` itself, measures `probe.err`, searches
for backups and diffs the tree, and the driver throws when a control never arrives. And narrowing
L01/L04's causes produced **"a byte match without an `--- end` is not evidence"**, when L04's bytes are
real evidence of the byte predicate and merely insufficient to count the launch. Round 3 then found the
same class in the orchestrator's own round-2 fix: the replacement headline was **still a false
universal**, because §6.6's L15 cause is an inference and §6.4 is read from the application's source.
The paragraph beneath it is now explicitly **non-exhaustive**.

---

## Verification — Phase 2c-4b step 3a

All rows re-run by the orchestrator after the fix round and after the confirmation pass's own fix,
never taken from a worker's report.

| Command | Result |
|---|---|
| `npm test` | **1623** passed, **49** files (1587 / 49 at `HEAD`) |
| `npm run check` | **418** files, **0** errors, **0** warnings — unchanged |
| `npm run build` | **175** modules — **unchanged**; `svelte/internal/server` **absent** from the bundle |
| `cargo test --workspace` | **1086** passed, 0 failed — **unchanged; no Rust file was opened in any round** |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| i18n leaf keys | **769** en / **769** es, at parity — 745 plus 24 |
| `rg "'keepMyDraft'" src/ --glob '!*.test.ts'` | **one** producer, `saveOutcome.ts:460`; every other hit is a component `case` arm consuming it |

**The module count did not move, and that is the expected reading of the guard, not a miss.** 3a added
no new source module — only union members, dictionary entries, accessors, handlers and tests — so the
shape rule says the number must stay at 175. A jump to ~180 with `svelte/internal/server` in the
bundle is the regression the guard exists to catch, and it is absent.

**Six `.svelte` files changed, so six window readings are owed** and none is taken. That is 2c-4b-3c,
and it is why 3a is not the end of 2c-4b-3. The confirmation pass's own fix touched two `.svelte`
files in **comments only**, which invalidates nothing because nothing had been read yet.

---

## Phase 2c-4b step 3a review disposition

**Round 1 — `docs/reviews/phase-2c-4b-3a-code.md` — NOT READY.** Four findings, and **all four were
prose**: the class this repository names its worst, and the one no test in it can fail.

| # | Severity | Where | What was claimed that is not true |
|---|---|---|---|
| 1 | **High** | `en.json` `browser.reapply.ready` | The readiness sentence promised a sendable form. `alreadySatisfied` is a permitted successful arm and returns none |
| 2 | Medium | `en.json` `browser.reapply.reapplied` and neighbours | Claimed the attempt had moved the window, and that retrying a refusal could not change the answer |
| 3 | Low | `matchEditor.ts` and eight sibling passages | The swept adoption contracts still named a subset of `adoptDiskVersion`'s refusal causes |
| 4 | Low | `RawEditor.test.ts` | A test comment said the producer requires one of the two reapply gates. It requires both |

All four fixed. The fix round **widened deliberately**: closing finding 2's permanence claim meant
rewriting it in **32 further places** — across `saveOutcome.ts`, `editorSave.ts`, all six surface
modules, two markup comments and twelve suite comments — on the argument that leaving the same claim
standing elsewhere is precisely this project's documented "narrower instance still standing" failure.
Two contract passages the review had not named were corrected with it, including one that said a
confirmation "was spent" on a refusal, when a refusal spends nothing.

Two of the review's suggested wordings were **not taken**, both recorded in `2c-4b-3a-notes.md` §7.6
and both **sustained by round 2**: an "either … or" on the readiness line would have swapped one false
promise for a smaller one, because `manualResolution` and `adoptionRefused` are also reachable after a
safe correspondence; and quoting *"Keep editing"* in the result prose would have been wrong on three
surfaces, which label that control *Leave this as it is*.

**Round 2 — `docs/reviews/phase-2c-4b-3a-code-round2.md` — NOT READY on one new Low, with all four
round-1 findings confirmed closed.** The new one was **introduced by the fix round**, and it is the
recurrence this project has now recorded in five consecutive phases. The 32-site permanence rewrite
left `editorSave.ts`'s `ReloadStep.refused` saying that because a refusal spends nothing, a later
press over a window that had reprojected to the requested revision *would be answered `alreadyThere`*.
Four guards run before the revision comparison, and "a refusal spends nothing" rules out only *this
attempt newly causing* the spent-authorization guard: **an unconditional claim of permanent refusal
had become an unconditional claim of later success**, the mirror image of the finding it closed.

Fixed by the orchestrator, and the sweep written from the predicate rather than from the finding's
words found **two narrower instances** in `reapply.ts`'s `adoptionRefused` arm — the guard walk and
the permanence paragraph — both fixed. `saveOutcome.ts`'s `DiskAdoption` list was examined and
**ruled not an instance**: it is an ordered numbered list whose item 5 is reached only after 1–4, and
it says so in its own words. Neither fix moved a predicate, so no test was added; `npm test` and
`npm run check` are identical before and after, which is the hole restated rather than a reassurance.

---

## Verification — Phase 2c-4b step 2

| Command | Result |
|---|---|
| `npm test` | **1587** passed, **49** files (1499 / 48 at `HEAD`) |
| `npm run check` | **418** files, **0** errors, **0** warnings |
| `npm run build` | **175** modules — 174 plus exactly one new source module; `svelte/internal/server` **absent** from the bundle |
| `cargo test --workspace` | **1086** passed, 0 failed — **unchanged; no Rust file was touched in any round of this step** |
| `git status --short` | **no `.svelte` file among the changes**, in any round |

The three counts that are the point of this step are the **last two rows**. No Rust file changed
because step 1 had already put every byte of evidence on the wire, and no `.svelte` file changed
because nothing is drawn — which is why **no mounted-component test and no window reading are owed
here**, and why the frontend suite grew by 88 cases while the i18n key count stayed at **745** per
language.

**The +1 module is `src/lib/browser/reapply.ts` and nothing else.** The guard is the *shape* of the
change, not the number: a count that moves by exactly the number of new source modules is a new
module, and a jump to ~180 with `svelte/internal/server` in the bundle is `vite.config.ts`'s
`resolve.conditions` regression. Both were checked, the second by grepping the built bundle.

### The four review rounds

| Round | Verdict | Findings |
|---|---|---|
| 1 (`phase-2c-4b-2-code.md`) | **NOT READY** | 2 Medium, 2 Low — including the step's **only algorithmic defect** |
| 2 (`phase-2c-4b-2-code-round2.md`) | **NOT READY** | 1 Medium (introduced), 2 Low (1 survivor, 1 introduced) — all prose |
| 3 (no review file; `2c-4b-2-notes.md` §9) | **NOT READY** | 1 Low, a **survivor across three rounds** |
| 4 (no review file) | **READY** | none |

Round 1's Medium is the one worth remembering, because it is a defect a green suite could not see:
the reapply authorization was a `WeakMap` keyed on the **derived `ConflictModel`**, not on the wire
`ConflictResult` the existing origin map keys on. Two `ConflictModel`s describing one conflict are two
object identities, so each could win a successful adoption spend — the exact *one conflict, one
spend* guarantee 2c-4a-2 was built to give. Its falsifiability was then proved by mutation: re-keying
back to the model broke exactly the two new tests and nothing else.

**Rounds 2, 3 and 4 found no algorithmic defect at all**, and that is the honest shape of this step:
one real bug, then three rounds spent on a single sentence. `BrowserState.adoptDiskVersion`'s guards
were described as *five checks* applied alike when they are an **ordered sequence** — authorization,
spend, origin and projected-document precede every successful answer, `alreadyThere` is decided and
its token spent before the projection generation is inspected at all, and the generation comparison
therefore guards only the installing branch. That was wrong in four places, and each sweep missed the
next one because it had been written from the previous finding's wording rather than from what the
method does. This repository's documented recurrence, again, and the reason the standing rule is
*sweep for what the type now says, not for the words the old finding used*.

**One instance was deliberately left standing**: `src/lib/browser/workspace.svelte.ts:615`'s *"Five
things are checked here, in order"*, shipped and committed at 2c-4a-2 and outside this step's diff.
It is named in `2c-4b-2-notes.md` §8.4 and §9.2 and is **debt 2c-4b-3 should pay**, not something
this step silently accepted.

Rounds 3 and 4 produced **no review file** — Codex returned a verdict without writing one — so §9 of
`docs/decisions/2c-4b-2-notes.md` is their only record and reproduces round 3's finding in full.
Round 3's fix was applied by the orchestrator rather than a worker, which is why round 4 exists: a fix
is a change, and the round that reviews it is not optional.

---

## Verification — Phase 2c-4a step 3c

**Step 3c is the window reading 2c-4a-3 owed, and it ran in five steps.** The cut was forced by the
*instrument*, not by the size: consult Q7's recipe — a second writer that is an external filesystem
process — had **never been demonstrated**, and a reading plan written on an unproven instrument is a
reading that discovers, twenty launches in, that it measured nothing.

| Step | What | Launches |
|---|---|---|
| 3c-1 | The harness, and the proof a true conflict reaches a window | 7 |
| 3c-2 | The reading: six surfaces, both languages | 25 |
| 3c-3 | The reading's five fixes, and the re-take | 16 |
| 3c-4 | The review fix round, and its re-take | 22 |
| 3c-5 | The confirmation pass's Medium, and the probe's removal | — |

**Seventy launches, and every one of them reached its own `--- end` with a zero-byte `probe.err`** —
so no transcript in any of the four records is a partial run rounded up to a conclusion. Every launch
was byte-checked against a pristine copy of the whole configuration tree taken before it. **No
conflict launch wrote anything**; the launches that did write wrote exactly what they were asked to,
as the byte check's own control.

### The findings, and what class they were

| # | Found by | Severity | What |
|---|---|---|---|
| 1 | the reading | **High** | the Spanish creator line said the snippet *se ha escrito* — *had been written* — **four lines under** *"No se ha escrito nada"* |
| 2 | the reading | Medium | *Keep editing* drawn on three panels where nothing is being edited |
| 3 | the reading | Medium | the match editor's conflict panel drawn **entirely below the fold**, `scrollTop` 0, nothing moving it |
| 4 | the reading | Low | the second step's control pushed back out of the viewport by the sentence that justifies it |
| 5 | the reading | Low | the raw editor's refused-reload sentence named a **different control** |
| 6 | Codex round 1 | Medium | the same *Keep editing* defect on the **refused** arm — the deferral the previous round had argued for |
| 7 | Codex round 1 | Low | the reveal cue collapsed every arm to one value, so `refused → saved` need not re-fire |
| 8 | Codex round 1 | Low | the pure reveal rule sat in the renderer layer, restating the model's union to avoid depending on it |
| 9 | the orchestrator | Medium | `reloadUnavailable`'s **sentence** — the third instance of finding 2, on all six surfaces |
| 10 | Codex round 2 | Medium | three passages claimed **three** refusal causes where the code has **five** |

**Six of the ten are sentences or records claiming something the code does not do**, and **none of
the ten changed a byte written to disk.** That is the shape this project keeps producing, and the
reason a window reading and a review are both owed rather than either alone.

### The gates, with the probe removed

| Gate | Result |
|---|---|
| `npm test` | **1482 passed, 47 files** (1426 at 3b; +56 across the model, the six mounted suites, `reveal.test.ts` and the i18n guards) |
| `npm run check` | **415 files, 0 errors, 0 warnings** (412 at 3b) |
| `npm run build` | **174 modules** — 172 at 3a plus `reveal.ts` and `draftKind.ts`, the "moved by exactly the number of new source modules" shape. No `svelte/internal/server`, no `node:async_hooks` |
| `cargo test --workspace` | **1048 passed** — untouched since 2c-4a-1; **nothing in `src-tauri/` or `crates/` changed in the whole of step 3c** |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **nothing** — `CLAUDE.md` §3's check since 1b-1 |
| i18n | **729 keys per language, at parity** |

**The probe is gone and its removal was verified, not asserted.** `src/probe.ts` and
`src-tauri/src/probe.rs` are deleted; `src/main.ts` and `src-tauri/src/main.rs` were restored **by
hand** and `git diff` over both comes back empty, so neither appears in this commit. A sweep for
`ECFG_PROBE|startProbe|register_with_probe|probe_second_writer` over `src`, `src-tauri/src` and
`scripts` finds nothing — the only remaining mentions are the decision records that describe the
harness in prose. Every scratch path lived outside the repository, and **the owner's real
configuration was never opened**: `XDG_CONFIG_HOME` pointed at a synthetic tree rebuilt per launch
and `HOME` at an empty directory, so neither candidate `resolve_config_dir()` probes could reach it.

---

## Verification — Phase 2c-4a step 3b

Every command below was run **by the orchestrator**, each as its own invocation, and re-run after
the fix round. The counts are the final ones.

| Command | Result |
|---|---|
| `npm test` | **1426 passed, 46 files** (baseline 1404 at step 3a) |
| `npm run check` | **412 files, 0 errors, 0 warnings** |
| `npm run build` | **172 modules**, unchanged from step 3a, and `svelte/internal/server` absent from `dist/` |
| `cargo test --workspace` | **1048 passed, 0 failed**, measured against this tree after the fix round — not carried forward. `git status` over `src-tauri/` and `crates/` is **empty**, so no Rust file was touched and the count is unchanged from step 3a |
| `cargo clippy` / `cargo fmt --check` | **not run, and that is correct**, for the same reason |

**The module count did not move, and that is the expected shape.** Step 3b adds **no** new source
module — every new type lives in a file that already existed — so 172 → 172 is the guard passing.
`CLAUDE.md` §6 gives the rule: the guard is the *shape* of a change to that number, and the
regression it exists to catch is a jump to ~180 with Svelte's server build in the bundle. `dist/`
was grepped for `svelte/internal/server` and it is absent.

**i18n is 726 keys per language, at parity** — 711 at step 3a, 724 after the first cut of step 3b,
then **+7 new and −5 removed** in the fix round.

### What step 3b shipped

- **`offersReload: true` on the remaining three surfaces.** `matchDeletion.ts`, `matchMove.ts` and
  `matchDuplication.ts`. `offersCopyDraft: false` is untouched on all three and is **permanent** —
  consult Q4 refuses a copy for a `MovePlacement` or a `MatchId` as a property of the drafted
  value, and `conflictChoicesFor` refuses it even if the boolean were set.
- **The three panels.** `MatchDeleter.svelte`, `MatchMover.svelte` and `MatchDuplicator.svelte`
  draw the disk side through `SourceText documentStart`, all three revisions always, the two-step
  `reloadDiskVersion` → `confirmReload` machine over 2c-4a-2's transitions, and the
  `reloadUnavailable` disclosure that those three surfaces had carried since 3a with **nothing
  rendering it**.
- **A retained *operation summary*, not a retained draft.** `ConflictOperation` in
  `saveOutcome.ts` is the consult's Q5 summary as a six-arm value with `conflictOperationKey`
  behind it; `browser.saveOutcome.operationIdentityIsOld` says on all three panels that the
  summary names the snippet as this window read it and that this application does not look for a
  corresponding snippet in the disk version. **No cross-revision identification** — that is
  2c-4b's.
- **The scope widening, ruled justified by the reviewer.** Verifying the sentence
  `ConflictCapabilities.reloadOutcome` produces exposed a defect: `reloadClosesSurface` ended
  *"Copy it first if you want to keep it"* and `draftKeptInMemory` said *"Your text is still
  here"* — neither true on a panel where a copy is permanently refused and nobody typed anything.
  So `describeConflict` now branches on `draftKind`, `conflictChoiceKey` takes a **required**
  `ConflictDraftKind`, and `MatchEditor.svelte`, `MatchCreator.svelte`, `RawEditor.svelte`,
  `rawEditor.ts` and ~50 test call sites were touched. **Round 1 verified those three surfaces come
  out byte-identical in rendered wording**, their new branches selecting their previous keys.
- **`MatchMover.svelte:511`'s in-component rule is gone.** `MatchMoveView.notMovable` became
  `notMovableToShow`, computed in `matchMove.ts` against `cannotMove === 'notMovable'` exactly as
  `matchDuplicationView.notDuplicableToShow` does since 2c-3c-3, with the mover's markup reduced to
  a null check and the raw frozen verdict left on `session.eligibility`. **This closes the item the
  previous "Next action" flagged**, and the standing debt ledger loses it;
  `browser.matchMove.refused.unsavedDraft` remains on it, untouched.

The record is `docs/decisions/2c-4a-3b-notes.md`; both review rounds are
`docs/reviews/phase-2c-4a-3b-code.md`.

---

## Phase 2c-4a step 3b review disposition

**Two rounds, three findings, `NOT READY` then `READY`** (`docs/reviews/phase-2c-4a-3b-code.md`;
round 2 is the confirmation pass, appended there). Both Codex jobs were dispatched **read-only**,
so neither could create the review file and the orchestrator copied each reply into it verbatim —
the file says so at the top of each round. **All three were fixed before the commit**, so no
commit holds a demonstrated defect.

**Both Mediums were this project's named worst defect class** — a sentence claiming something the
code does not do — and the Low was named by the reviewer as *the cause of the first Medium*
rather than as a cosmetic duplication.

| # | Finding | Disposition |
|---|---|---|
| 1 | **Medium (blocking)** — `browser.matchMove.reloadClosesMover` said the chosen destination could not be kept *because it names snippets of the version this window read*. True of `MovePlacement`'s `after` arm; **`top` and `end` name no snippet at all** | **Accepted.** The key is **deleted**. `MatchMoveView.awaitingReloadConfirmation` is replaced by `reloadWarning: MoveReloadWarning \| null` (`positionalDestination` \| `anchoredDestination`), chosen in `matchMove.ts` by `reloadWarningOf` from the **retained** placement's own arm and rendered through a new `tMoveReloadWarning`. Only the anchored arm may say the destination names another snippet. **One field rather than a boolean plus an arm**, so the condition and the arm it selects are decided together and cannot drift — two fields that have to agree is how a capability came to be expressed twice at 2c-4a-2. Round 2 confirmed the derivation is from the retained conflict placement and not from the current draft |
| 2 | **Medium (blocking)** — `browser.saveOutcome.operation.moveAfterSnippet` promised its anchor was *"still marked as chosen among the destinations above"*, but `movePlacementOptionsOf` **removes old-revision anchors after a live reprojection while the conflict is still displayed**, so the sentence could point at a mark that had gone. The review named the cause: **the mounted test drove only a static projection** | **Accepted.** `ConflictOperation` gains `moveAfterSnippetNoLongerShown`; `operationOf` now takes the live projections and asks `movePlacementOptionsOf`'s **own answer** whether a drawn destination carries the retained placement **and is marked**, so the "marked as chosen above" sentence is gated by the actual drawn mark. **No cross-revision identification** — the other arm says the destination is gone and names nothing of the disk side. Mounted reprojection coverage was added over a **real `BrowserState`** (`state.rereadDocument` under an open conflict), which round 2 confirmed is falsifiable and exercises the claimed production path |
| 3 | **Low** — at the confirmation step, `reloadAbandonsOperation` and each surface-specific `reloadCloses*` sentence **repeated the same close/abandon guarantee in different wording**. Consistent and reachable at the time, but that duplication is what let finding 1's narrower sentence become false | **Accepted, and treated as finding 1's cause.** `reloadWarningFor` in `saveOutcome.ts` is now the **sole** model decision for the guarantee; `reloadClosesSurface` absorbed the missing *operation not carried out / file not written* clause; the five surface confirmation lines were stripped to reason-plus-next-step and **renamed to match what they now say** — `reloadIdentifiesNoSnippet` ×3, `reloadSeedsNoForm`, and the mover's two. **That rewrote rendered wording on five surfaces, four of which were the subject of no finding**, which is exactly why round 2 exists |

**The fix round's own sweep found one narrower instance of finding 2's shape, before the reviewer
did.** The new `moveAfterSnippetNoLongerShown` sentence first blamed the disappearance on *"this
window has read this file again"*, which is only one of the ways `movePlacementOptionsOf` drops an
anchor; it now claims only that the window no longer holds that reading. **The sweep was written
from what the type now says, not from the words the finding used** — the discipline
`2c-4a-2-notes.md` §7.6.2 named after three rounds each left a narrower instance standing — and
this is the first time in this phase that it caught something first.

**Mutation-falsifiability checks, performed rather than claimed.** Step 3b: replacing the
`confirmReload` arm in all three panels with a bare `confirmDiskReload` turned **9 tests red**
across the three mounted suites; rewriting `notMovableToShow`'s guard back to
`cannotMove === 'outOfDate'` turned its model test red. Fix round: making `operationOf` return
`'moveAfterSnippet'` unconditionally turned **both** the model test and the mounted reprojection
test red; flipping `reloadWarningOf` to key off `'end'` turned **5 tests red** across both suites.
All were restored and the suite is green.

**Round 1's clean categories, recorded as given:** the reload transitions treat `installed` **and
`alreadyThere`** as success and stop only on `refused`; no forbidden conflict behaviour was added;
the selection-generation writes remain sound; and the new tests are not vacuous — their only
weakness was the missing mover placement/reprojection coverage, which finding 2's fix supplied.

**Round 2's, likewise:** the three fixes are in the code rather than merely reworded; the renamed
keys are **fully migrated in executable source, tests and both dictionaries**, the one remaining
old-key occurrence being an explicitly historical "now gone" comment at `saveOutcome.ts:619` and
not a lookup; the surface lines make no additional close, abandon or write guarantee in either
language; the forbidden behaviours remain absent with `offersCopyDraft: false` intact on all three
surfaces; and the confirmed mover reload adopts the disk observation and closes **only after a
successful adoption**, neither retrying the stale move nor carrying its placement forward.

**What no test can catch here, and the record says so rather than implying otherwise.** Nothing
enforces that a future renderer walks `reloadWarning` rather than re-deriving the arm from the
retained placement, and nothing enforces that `matchMoveView`'s caller passes the **live**
projections — a caller that passed a stale list there and a fresh one to the options would get a
sentence about a screen it is not drawing. The i18n suites check parity and placeholder agreement,
**not meaning**, so none of the five renamed sentences is pinned by anything executable.

---

## Verification — Phase 2c-4a step 3a

Every command below was run **by the orchestrator**, each as its own invocation, and re-run after
the fix round and again after the round-2 prose fixes. The counts are the final ones.

| Command | Result |
|---|---|
| `npm test` | **1404 passed, 46 files** (baseline 1380 at step 2; 1397 after the first cut, 1404 after the fix round, unmoved by the round-2 prose fixes) |
| `npm run check` | **412 files, 0 errors, 0 warnings** |
| `npm run build` | **172 modules**, and `svelte/internal/server` absent from `dist/` |
| `cargo test --workspace` | **1048 passed** at the session baseline; **not re-run after the change**, and that is correct — no file under `crates/` or `src-tauri/` was touched |
| `cargo clippy` / `cargo fmt --check` | **not run, and that is correct**, for the same reason |

**The module count moved by exactly one, and that is the expected shape.** Step 3a adds exactly one
source module — `src/lib/components/clipboard.ts` — so 171 → 172 is the guard passing. `CLAUDE.md`
§6 gives the rule: the guard is the *shape* of a change, and the regression it exists to catch is a
jump to ~180 with Svelte's server build in the bundle. `dist/` was grepped for
`svelte/internal/server` and it is absent.

**i18n is 711 keys per language, at parity** — 698 at step 2, plus 11 in the first cut and 2 more in
the fix round.

### The split, and why step 3 has three steps rather than one

The checkpoint at step 2 described step 3 as one step: flip `offersReload` on five surfaces, draw
five panels, add the keys, write five mounted suites, and take the window reading. That is five
components averaging ~880 lines each plus a manual reading, and it was cut three ways on the
dependency order every earlier split used, **by failure mode**:

| Step | Scope | Fails as |
|---|---|---|
| **3a** | The two **authored-text** surfaces — `MatchEditor` and `MatchCreator` — the only two that get `copyDraft`, plus the shared model work and the i18n | a **fidelity** mistake — what a copy preserves, and what a sentence claims it preserves |
| **3b** | The three **operation-choice** surfaces — `MatchDeleter`, `MatchMover`, `MatchDuplicator` — reload only, no copy | a **capability** mistake — offering a choice that preserves nothing |
| **3c** | The **window reading** for all six write surfaces | an **instrument** mistake — see Q7 |

The cut is not arbitrary: the step-3 brief already ruled that **only the editor and the creator get
`copyDraft`**, because `MatchBuffers` and `CreationBuffers` hold authored strings while
`MovePlacement` is a positional choice and `MatchId` is a protocol carrier — copying either
preserves nothing while looking like it preserved something. So 3a is exactly the surfaces where
the copy question is live, and 3b is exactly the surfaces where it is settled by the value's own
nature.

### What step 3a shipped

- **`offersReload: true` on two surfaces only.** `matchEditor.ts` and `matchCreation.ts`. The mover,
  the deleter and the duplicator still declare `false`, and **no component of theirs changed**.
- **The panels.** Both draw the retained draft field by field through `SourceText`, the whole disk
  text through `SourceText documentStart`, all three revisions always, the two-step
  `reloadDiskVersion` → `confirmReload` machine over the transitions step 2 had already wired, and
  *Copy my text* as a labelled reference copy that is **never YAML**.
- **One model list behind both.** `view.retainedDraft` is new on both views; its format is
  `referenceCopyOf` in `saveOutcome.ts` and its sentences are `tDraftCopy` in the i18n layer, so
  **neither renderer holds a rule**. Each field's status is what a save *would do*
  (`unchanged`/`setting`/`removing`, mapped from `fieldIntent`), never a presence flag.
- **`src/lib/components/clipboard.ts`** — the one new module. It reuses `RawEditor`'s
  `copyBySelecting` technique and adds one rule: it **refuses the `<textarea>` carrier for text
  holding a `\r`** rather than copying normalised bytes and reporting success. `RawEditor.svelte`
  was migrated onto it during the fix round, so the routine now has one home rather than two.

### Phase 2c-4a step 3a review disposition

**Two rounds, in `docs/reviews/phase-2c-4a-3a-code.md`, appended in order and never rewritten.**
Both Codex jobs were dispatched **read-only**, so neither could create the review file and the
orchestrator copied each reply into it verbatim — the file says so at the top of each round.

Round 1 returned **NOT READY** on seven findings: two High, four Medium, one Low. Round 2 — the
confirmation pass over the fixes, commissioned by the standing rule that **a fix is a change and the
round that reviews it is not optional** — closed six, found **no new defect introduced by the
fixes**, and left one **partially closed**.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High** — the failed-copy sentence told the person they could select and copy the text by hand, but `SourceText` had already replaced any `\r` with its localized name, so a hand copy cannot recover the draft and confirming the reload afterwards loses it | **Accepted; behaviour examined first, sentence changed second.** No CR-safe route exists that can be *claimed* — only `navigator.clipboard.writeText` preserves a `\r`, and a contenteditable carrier is unverifiable in jsdom, so shipping one reporting success would repeat the finding. Both locales and three code comments now say the copy failed, that the panel writes the **name** of characters no font draws, and that reload discards the draft either way. **Partially closed at round 2** and finished there — see below |
| 2 | **High** — match conflicts still displayed the raw editor's `reloadDiscardsDraft` ("replaces your text"), which is not what those surfaces do: they install the disk projection and close | **Accepted.** `ConflictCapabilities.reloadOutcome` is now a **required** field and `describeConflict` picks `reloadDiscardsDraft` (raw editor) or the new `reloadClosesSurface` (all five match surfaces). Round 2 confirmed the three unoffered surfaces were given `closesSurface` because it is **true of them** — their successful reload transitions set `closed: true` — not because it compiles |
| 3 | **Medium** — after an adoption returned `refused`, the spent confirmation stayed presented as actionable, so confirming again could only be refused again, with nothing said | **Accepted, and fixed here rather than deferred to 3b as the implementer proposed.** `ReloadStep` gains a terminal `refused` arm, `spendTheConfirmedReload` answers `satisfied \| refused \| notAttempted`, `ConflictReloadStep` gains `unavailable` where no reload label is offered, and the three live panels disclose it. Deferring would have shipped a stuck-looking confirm step on two **live** surfaces — the exact defect step 2 existed to prevent — while the three surfaces that share the machinery declare `offersReload: false` and cannot reach the new arm, which is what makes adding it now safe |
| 4 | **Medium** — the clipboard mocks inspected the textarea's whole value rather than its selection, so deleting `select()`/`setSelectionRange()` would have left the tests green while real copying failed | **Accepted.** The mocks now record `value.slice(selectionStart, selectionEnd)` and compare exactly against `tDraftCopy(...)`. **Proved by mutation, not asserted**: deleting the two selection calls turned both copy cases red; restored, green |
| 5 | **Medium** — both renderers independently decided that `diskText === ''` means an empty file | **Accepted.** `ConflictDiskText` and `conflictDiskText()` in `saveOutcome.ts` own it, and the raw editor was moved onto them too, so the rule has one shape rather than three |
| 6 | **Medium** — the creator's warning said the form restarts empty; the implementation closes it | **Accepted.** It now says the form **closes**, and that a form opened afterwards starts empty |
| 7 | **Low** — the clipboard doc described a return contract the code does not have (cleanup failure returning `false`) | **Accepted.** The doc now says cleanup failure is swallowed and does not change the answer, and why: reporting a successful copy as a failure because a carrier would not detach would send a person to hand-copy text they already have |

**Round 2's remaining Low is the pattern `2c-4a-2-notes.md` §7.6.2 named, hit again.** Finding 1's
fix corrected every user-facing sentence and every production comment — and left two **test
comments** carrying the framing it had just rejected: *"the panel still shows every byte"*, and the
localized representation called *"the value … on screen for a manual selection"*. A fix closes a
finding and leaves a **narrower instance standing**, because the sweep is written from the old
wording. Both comments are now written against what `SourceText` does. The record's blanket "all
seven are accepted and fixed" was premature for the same reason and now says six were closed by the
fix round and the seventh needed a second.

**A limit round 2 recorded, worth carrying forward: no executable test pins the semantic wording of
`draftCopyFailed`, `reloadClosesForm` or the clipboard JSDoc.** Reverting those prose fixes while
keeping the same keys leaves every suite green. The i18n suites check **parity and placeholder
agreement, not meaning** — so what those sentences *claim* is confirmable only by reading them, and
three of this step's seven findings lived in exactly that gap.

Round 2's clean categories, recorded as given: all six `spendTheConfirmedReload` call sites handle
all three answers and `alreadyThere` reaches the success path everywhere; every refused spend writes
`RELOAD_REFUSED` and every dismissal and applied outcome writes `NOT_RELOADING`, so the terminal
state is leavable through *Keep editing*; raw-editor clipboard behaviour is materially unchanged
after its migration; origin-bound adoption is intact through `ConflictModel.source` and nothing was
rebound to `conflict.expected`; no `saveAnyway`, stale retry, automatic reload, dirty-state clearing,
cross-revision identity inference, YAML-from-projection, diff or *keep my draft* control was
introduced; `conflictChoicesFor` remains the sole choice-list producer; and every user-facing
addition is accessor-driven with no hand-built key.

---

## Verification — Phase 2c-4a step 2

Every command below was run **by the orchestrator**, each as its own invocation, and re-run after
each of the four fix rounds. The counts here are the final ones, on the committed tree.

| Command | Result |
|---|---|
| `npm test` | **1380 passed, 46 files** (baseline 1326 at step 1; 1342 after round 1, 1372 after round 2, 1380 after round 3, unmoved by the two prose rounds) |
| `npm run check` | **411 files, 0 errors, 0 warnings** |
| `npm run build` | **171 modules**, and `svelte/internal/server` absent from `dist/` |
| `cargo test --workspace` | **1048 passed**, unchanged — this step wrote no Rust |
| `cargo clippy` / `cargo fmt --check` | **not run, and that is correct**: no file under `crates/` or `src-tauri/` was touched |

**The module count did not move, and that is the expected shape.** Step 2 adds fields,
transitions, a prop and a great deal of prose, but **no new source module** — so a count that
stayed at 171 is the guard passing, not the guard being ignored. `CLAUDE.md` §6 gives the rule:
the guard is the *shape* of a change, and a jump to ~180 with Svelte's server build in the bundle
is the `resolve.conditions` regression it exists to catch.

**i18n is 698 keys per language, at parity** — one fewer than the 699 at 2c-3c-3, because
`browser.rawEditor.diskVersionUnavailable` was **deleted**. That deletion was challenged in review
and survived: `SaveResult::Conflict.disk_text` is a required `String`, the sole production
constructor returns no conflict when `Workspace::refresh` cannot read valid UTF-8, and there is no
pre-step-1 constructor that omits the field — so the state the key described is unreachable rather
than merely rare. Empty text, a BOM, CR characters and a missing final newline all remain
representable and rendered.

## Phase 2c-4a step 2 review disposition

**Four review rounds, and the last two exist only because the round before each of them left a
narrower instance of the finding it had just closed.** All four are in one file,
`docs/reviews/phase-2c-4a-2-code.md`, appended in order and never rewritten:
`## Findings`, `## Confirmation pass`, `## Round 3 pass`, `## Round 4 pass`, then
`## Round 5 — disposition of the round-4 pass`. The first four verdicts were **NOT READY** and all
four were accepted rather than argued with; the fifth is READY.

**Round 1 — one High, two Mediums, one Low.** The High rejected this step's own first resolution
of its central tension. The implementation had declared a per-surface capability but built the
reload *transition* for the raw editor only, on the reasoning that a match model naming
`reloadDiskVersion` would put a live-looking control on screen before step 3 wired it. The review's
answer is the one to keep: **withholding the offering was right and withholding the transition was
not** — "an unoffered transition and its callback can be implemented and tested without drawing its
choice." As built, step 3 would have had to invent five model transitions, five close/adopt
integrations and their `DetailPane` props *on top of* drawing them, contrary to the approved split,
which assigns per-surface close/reseed behaviour and the `DetailPane` props to **this** step.
The Mediums were the adoption brand unguarded at the spend boundary, and a record claiming a
dismissed match conflict "conflicts again" — true of raw save, **false of all five match commands**,
because `conflict_after_the_lock` has already refreshed the Rust cache so `view_at` answers
`identityStaleRevision` before the locked check is ever reached.

**Round 2 fixed all four and introduced two more.** The new High is the sharpest defect this phase
produced: `adoptDiskVersion` checked the confirmation, the document's existence and a projection
already at `diskRevision`, but **never that the projection still was the one the conflict was
created against** — so a `rereadDocument` landing between *Reload disk version* and *Confirm
reload* left the session at `confirming`, the guard passed, and the window **installed the older
snapshot over the newer projection and reported success**. Its mirror image was equally wrong: when
the intervening projection *was* the disk revision, the method answered `false`, so raw reload did
not reseed and match reload did not close, and confirming again repeated the refusal forever.
A boolean cannot carry three answers. The new Medium was ten-plus sites still saying the arms this
round had just wired "return without doing anything".

**Round 3 closed both and the code has been sound since.** The spend is bound to the conflict's
**origin**: `rememberTheConflict` records, as each conflict arrives, which document it is about and
that document's projection generation, in a `WeakMap` keyed on the wire value `ConflictModel.source`
carries whole. A conflict with no entry is refused — which also closed the cross-`BrowserState`
residue round 1 had left open — and so is one whose projection has been replaced since.
**The generation is the right guard and `conflict.expected` is not**: `expected` is the *session's*
frozen base and legitimately differs from what the window projects. `AdoptTheDiskVersion` now answers
`DiskAdoptionOutcome` = `installed | alreadyThere | refused`, `alreadyThere` is checked first so a
reprojection that reached the requested revision is satisfaction rather than over-refusal, and a
refused confirmation still leaves through the always-present *Keep editing*. The round-3 pass
verified both guards by removing each and watching its test fail.

**Rounds 4 and 5 were record accuracy only, and both found what the sweep before them had missed.**
Round 4 named four sites still describing the old `boolean` contract — including the record's own
**primary design section**, which had survived a sweep that did touch the code. Round 5 named two
more, both saying `close()` fires "only when the window says it installed", which quietly collapses
two successful outcomes back into one. **The root cause of the first miss is recorded rather than
tidied away**: a round-3 edit script asserted through several replacements, threw on a later one,
discarded all its writes including §2.1's, and the retry re-applied only the edit that had failed.
The durable lesson is in `2c-4a-2-notes.md` §7.6.2 — **sweep for what the type now says, not for the
words the old type used**, which is why three consecutive rounds each left a narrower instance
standing.

Round 5 was closed by the orchestrator directly rather than by a fifth adversarial pass: the fix was
three sentences whose exact locations round 4 had already given, and the confirming sweep was run
here instead. That choice, the sweep and its six remaining legitimate hits are written down in the
review file rather than assumed.

**No behavioural finding from any round remains open.** The round-3 pass separately re-confirmed,
after the rewrite, that the six conflict arms still install nothing, that the two-counter selection
invariant holds (`installView` bumps only the adopted document's `projectionGenerations`;
`repairAfter` writes through `replaceSelection`, which bumps the global `selectGeneration` in the
same synchronous block, with **no `await` between them**), that `offersReload` is still `false`
everywhere, and that none of the prohibitions crept in — no `saveAnyway`, no stale-candidate retry,
no automatic reload, no dirty-state clearing on conflict, no cross-revision match identification, no
YAML from a projection, no diff, and no control named or coded "keep my draft".

---

## Verification — Phase 2c-4a step 1

Every command below was run **by the orchestrator**, each as its own invocation, and re-run after
the review fix round. None was taken on a worker's word.

| Command | Result |
|---|---|
| `cargo test --workspace` | **1048 passed, 0 failed** (from 1046 at 2c-3c-3: +1 for the pairing and byte-exactness assertions, +1 for the dispatcher fidelity test the review demanded) |
| `npm test` | **1326 passed, 46 files** (from 1324 — two model tests, no new file) |
| `npm run check` | **411 files, 0 errors, 0 warnings** |
| `npm run build` | **171 modules** — unchanged, which is the point: this step adds no frontend module |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **finds nothing** — the architecture rule holds (D2x) |

**The baseline was measured before the step, not assumed**: 1046 / 1324 / 411 files 0-0 / 171
modules, all four matching what the 2c-3c-3 checkpoint claimed.

**Scope discipline was verified rather than trusted.** `git status --short` shows no `.svelte`
production file, no dictionary, and `src/lib/browser/workspace.svelte.ts` untouched. The twelve
`.test.ts` files changed are fixture additions for the new required field — read, and no assertion
was weakened or deleted to make anything pass.

---

## Phase 2c-4a step 1 review disposition

The review is `docs/reviews/phase-2c-4a-1-code.md`. Verdict **NOT READY**, two findings, and five
categories explicitly cleared rather than omitted (the pairing claim, `String`-versus-`Option`,
wire-shape completeness, scope discipline, wire size, and the `diskText` naming collision).

**The first Codex job for this review hung** and was recovered rather than waited on: its log froze
mid-run after it announced *"the workspace is currently exposed as read-only, so I may be unable to
create the requested review file"*. The bounded watchdog returned exit 3 (stalled), the job was
cancelled, and the review was relaunched through the companion CLI **without the file-write
requirement** — the orchestrator wrote `docs/reviews/phase-2c-4a-1-code.md` from `result` instead.
The recovery procedure exists for exactly this and it was followed, not improvised.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | Medium | **Byte-exactness was claimed by three tests and falsifiable by none.** `a_conflicts_disk_text_survives_byte_for_byte` inspects the **Rust value** and stops before serialization; the shape test in `save.rs` does serialize but only over ordinary LF `SAMPLE_SOURCE`; and the `saveOutcome.test.ts` case starts from a **hand-built, already-correct** TypeScript value. A normalization specific to `disk_text` **in the serialization path** would have passed all three | **Fixed.** `a_conflicts_disk_text_crosses_the_dispatcher_byte_for_byte` added to `src-tauri/src/dispatch_check.rs` — the existing dispatcher-fidelity idiom from 1c-2b-2a, which already asks this question of the other two file-text values on this wire, so no new mechanism was invented. It conflicts over BOM + CRLF + no-final-newline text, compares the serialized `disk_text` against `std::fs::read`, and re-derives `ContentRevision::of_bytes` from the string the **response body** carried. **Its falsifiability was proved by mutation, run and reverted**: a serializer doing `disk_text.replace("\r\n", "\n")` failed the new test **alone** — all three tests that claimed byte-exactness stayed green, which is the finding demonstrated rather than argued |
| F2 | Low | **Two documents claimed guarantees the code does not give** — this project's named worst defect class. (a) "the text, the revision and the projection come out of one read" is **not literally true**: when the freshly-read bytes hash to the revision the cache already holds, `Workspace::refresh` keeps the **cached** `SourceDocument` and drops the string it just read. (b) "every other `SaveResult::Conflict` occurrence is a pattern match" is **false** — `every_save_result()` constructs a test-only instance | **Fixed, and the honest framing is the stronger one.** (a) The claim is now **content-hash equality** — which is exactly what `refresh` tests before deciding to reuse — rewritten in five places (`save.rs` module doc and field doc, `conflict_after_the_lock`, `types.ts`, `saveOutcome.ts`), each naming what it leaves **unforced**: a `ContentRevision` collision, and the fact that Rust does not tie one field of a struct variant to another. (b) Corrected to "one **production** construction site plus one test-only fixture", with `every_save_result()` named and explained as the wire-contract fixture the shape test rehashes |

**One point the implementer declined, and it is recorded rather than buried** (`2c-4a-1-notes.md`
§6.1): a third mutation — `disk_revision: found` in `conflict_after_the_lock` — fails only the
**pre-existing** changed-twice test and not the new one, because the new fixture changes the file
**once**, so `found` and `disk_revision` are one value in it. That case stays the other test's and
was deliberately not duplicated.

**The corrections were added as in-place blocks pointing at §6**, with §§1–5 of the notes left
standing as written. That is this project's house rule for a falsified sentence: the older record is
left as it was and the correction is placed beside it, so the reader sees what was believed and what
replaced it.

---

## Verification — Phase 2c-3c step 3

Every command below was run **by the orchestrator**, each as its own invocation, and re-run after
each of the two review rounds and after the window reading's probe scaffolding was removed. None was
taken on a worker's word.

| Command | Result |
|---|---|
| `npm test` | **1324 passed, 46 files** (from 1302 / 45 at step 2) |
| `npm run check` | 411 files, **0 errors, 0 warnings** |
| `npm run build` | **171 modules** (from 169) |
| `cargo test --workspace` | **1046 passed, 0 failed** — unchanged; step 3 wrote no Rust |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | **17 passed** |
| `git status --short --untracked-files=all` | **no path under `tests/corpus/real/`** |

**The module guard moved 169 → 171 and the delta is exactly the new-module shape**: one new `.svelte`
file contributes its own module **and** its scoped-style virtual module, which is 2c-3a-2's
+4-for-two-components arithmetic seen once. `vite.config.ts` was not touched; no
`svelte/internal/server` and no `node:async_hooks` in the bundle.

**The test delta was derived rather than asserted, and it reconciles exactly.** +22 = **13**
(`MatchDuplicator.test.ts`, measured by running it alone) + **4** (`matchDuplication.test.ts`,
34 → 38) + **1** (`DetailPane.test.ts`) + **4** generated: `scripts/lint/ipc-detail.test.ts` emits
one case per `.ts` or `.svelte` file under `src/` and gains two — the component and its test file —
while `scripts/lint/hardcoded-strings.test.ts` and `scripts/lint/built-translation-keys.test.ts`
each emit one case per `.svelte` file and gain one apiece. 1302 + 22 = 1324.

### Re-derived by the orchestrator rather than accepted from a worker or a reviewer

1. **The probe scaffolding is gone.** `rg "render_probe|probe_plan|ECFG_PROBE|startProbe"` over
   `src`, `src-tauri/src` and `scripts` finds nothing, and the module count is back to **171** — the
   reading itself measured 172, which was 171 plus `probe.ts`.
2. **The old contradictory view member is gone.** `rg "view\.notDuplicable\b|notDuplicable:"` over
   `src/lib` finds nothing, while `notDuplicable` survives correctly as a refusal **code** — the
   union member, the `refusalGiven` arm and the two `cannotDuplicate.notDuplicable` sentences.
3. **The dictionaries hold 699 keys each, with identical key sets** — counted from the files, not
   taken from a record. The `browser.matchDuplication.*` namespace is unchanged at 31 per language:
   this step rewrote one sentence and added no key.
4. **`DetailPane.test.ts:1` opts into jsdom and mounts the pane at line 181.** That is what falsified
   the worker's justification for leaving `DetailPane.svelte`'s "nothing can check" absolute in
   place, and the orchestrator corrected that header directly rather than leaving a known false
   claim standing because it predated the step.

### The three kinds of evidence 2c-split-notes §7 requires — all three exist, and 2c-3c is therefore complete

1. **Model tests** — `matchDuplication.test.ts`, 34 → 38, the two new pairs owning the suppression
   rule and the `documentHasUnsavedDraft` producer.
2. **A mounted-component test** — `MatchDuplicator.test.ts`, the **seventh** file to opt into jsdom
   by its docblock, 13 cases, the last suite over a **real** `BrowserState`; plus the new
   `DetailPane.test.ts` case, which is the reachability claim no test of the panel alone can make.
3. **A window reading** — `docs/decisions/2c-3c-3-window-reading.md`, **24 launches**, all reaching
   `--- end` with zero-byte `probe.err`, **PASS on all seven items, no High and no Medium**, two Lows
   and three Observations, and no defect in what is written to disk. **Its §12 lists nine things the
   evidence is not**, carried into `docs/decisions/2c-3c-3-notes.md` §4 rather than left in one file.

---

## Verification — Phase 2c-3b step 1

Every command below was run as its own invocation and re-run after each of the three review rounds;
the figures are the final run. **`npm test` and the two changed suites were re-measured when this
checkpoint was written**, so the reconciliation below is a measurement and not a transcription — and
it is worth saying that the record's own §3 table still reads 1216 over 50 cases, which is the count
*before* the third pass added two.

| Command | Result |
|---|---|
| `npm test` | **1218 passed, 43 files** (from 1160 over 42 at the 2c-3a-2 checkpoint) |
| `npm run check` | 405 files, **0 errors, 0 warnings** |
| `npm run build` | exit 0, **166 modules** |
| `cargo test --workspace` | **1008 passed, 0 failed** — unchanged, because **no Rust was written** |
| `git status --short --untracked-files=all` | no `.svelte` path, no `.rs` path, no corpus path |

**The module guard moved 165 → 166 and the delta is exactly one new source module**: `matchMove.ts`,
which reaches the bundle because `src/lib/i18n/index.ts` imports its three key builders and every
component imports that. `vite.config.ts` was not touched, and the bundle was checked during the step for the
*shape* of the change rather than the number being trusted: `rg` over `dist/assets/*.js` found no
`svelte/internal/server` and no `node:async_hooks`, so this is the new-module shape and not the
`resolve.conditions` regression.

**The test delta was derived rather than asserted, and it reconciles exactly.**
`matchMove.test.ts` runs **52**; `workspace.test.ts` goes from 111 to **115** — the failed adoption,
the dropped conflict capture, the mid-flight selection of the notes' §5, and the confirmation round's
conflict-through-the-real-wrapper case; and `scripts/lint/ipc-detail.test.ts` generates **one case per
source file under `src/`**, `.test.ts` files included, so the two new files add **two** of their own.
52 + 4 + 2 = 58, and 1160 + 58 = 1218. The two suites were re-run alone and report 167, which is
52 + 115.

**The dictionaries carry 37 `browser.matchMove.*` keys per language, at parity**, counted rather than
taken from the record, and `fragmento` is used throughout for a snippet per the owner's ruling at
`7c266c8`. **No screen has yet drawn the longer noun**, so the width caveat this file records still
stands and step 2's window reading inherits it.

**What this verification does not cover, and it is two thirds of the phase's evidence.**
`2c-split-notes.md` §7 requires three kinds and step 1 has one: **the model tests**. There is no
mounted-component test and **no window reading**, because no `.svelte` file was touched. Per
`1c-1-notes.md` hole 1 and 2c-1b's own conclusion, a green suite is not a screen. **One claim in this
step does have wrapper-level evidence** — a conflict invalidating a move session is driven through the
real `BrowserState.moveMatch` in `workspace.test.ts` — and **wrapper-level is still not a screen**.
**Step 2 owes both missing kinds, and until it is done no claim may be made about what any of this
looks like in a window.**

---

## Phase 2c-3b step 1 review disposition

**Three Codex rounds, fourteen findings, all closed before the commit.** The shape of the rounds is
again the finding worth remembering: *each round's fix produced the next round's finding* — and this
time the third round found the second round's own central fix **BROKEN** rather than merely
incomplete.

**Most of the fourteen were false claims in prose rather than defects in behaviour** — in the decision
record, in a module header, or in a sentence a person reads on screen. By each round's own tally:
**two** of round 1's four, **two** of round 2's four and **four** of round 3's six, which is eight; a
ninth is arguable, because round 3's first finding was a code defect whose *new* sentence was false
too. That is this project's named worst defect class, and the class no test can fail.

**Round 1 — the aggregate code review** (`docs/reviews/phase-2c-3b-1-code.md`, `NOT READY`):

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — `committed: false` at a moved revision invalidated everything and spent nothing.** The wrapper had already re-read and re-projected the file, so every identity on the session was stale while the model still said the control should be enabled — and the record guaranteed that "`committed: false` spends nothing" | **Adopted.** `MatchMoveSession.invalidated` beside `moved`, not merged with it: `moved` means *the file was rewritten through this session*, `invalidated` means *the projection these identities came from has been replaced*. Both are **or-ed into**, never assigned |
| 2 | **High — cross-revision identity inferred from arena node reuse.** A private `sameSnippet` compared document and node only and claimed an older-revision pair is "the same snippet"; a `MatchId` is session-local, so the rule could refuse a move for a snippet nobody is editing | **Adopted.** `sameSnippet` is deleted and the rule uses `sameIdentity` — all three fields. **The residual is stated rather than papered over**: once the draft's identity is older than the projection, the rule stops matching and the move is allowed |
| 3 | **Medium — `canMove: true` with the chosen anchor gone, and an arm with no producer.** The options came from the live projections and the refusal from the session's frozen snapshot, so a panel with no destinations left still reported the move could be sent | **Adopted, on the first of the two branches offered.** One private rule, `refusalGiven(session, live)`, and both sides call it; `anchorUnavailable` is replaced by `outOfDate`, which has real producers — keeping it would have told a person to *choose another destination* when every destination the session offers is stale |
| 4 | **Low — a preservation test that would pass with the implementation removed**: it asserted `[]` against a result carrying `notes: []` | **Adopted.** The case sends a real `ScalarRestyled` note and asserts it comes back unchanged, `toEqual` **and** `toBe` |

**Round 2 — the confirmation pass** (`docs/reviews/phase-2c-3b-1-confirmation.md`, `NOT READY`). It
confirmed all four of round 1 **CLOSED** and reported **four new High findings, every one of them
introduced by round 1's own fix round**:

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — a send that may have written was not terminal, and the sentence contradicted itself.** Neither `canChoose` nor the refusal consulted `mayHaveWritten`, so the same move was offered for retry beside a message saying to look at the file first — and where the re-read succeeded, the reason shown was `outOfDate`, whose sentence begins *"Nothing has been written"* | **Adopted.** A third flag, `mayHaveWritten`, or-ed in and cleared by nothing. **A flag rather than a read of `sendFailure`**, because `dismissMoveOutcome` clears that field and a session read off it would come back by putting the panel away |
| 2 | **High — a conflict replaced the session's identities and the session was not told.** The wrapper installs the conflict's disk projection while answering `adoption: notOwed`, so round 1's "the adoption is the evidence" left `invalidated: false` for a session whose identities had been replaced | **Adopted, on the second branch**: `applyMove` ors `result.outcome === 'conflict'` into `invalidated`, rather than widening `adoption` for the four other writing wrappers that share it. The test that paired a *refused* result with an adoption — a pair the wrapper cannot answer — was replaced by the pair it does |
| 3 | **High — the record prescribed a producer that recreates the defect round 1 closed.** It named `identityInProjection` as what closes the `unsavedDraft` residual; that function resolves by **arena node alone**, so following the record would refuse the wrong snippet | **Adopted.** The claim is removed from all three places and from the function's doc comment, and **hole 18** records what is really missing and the two shapes that would settle it |
| 4 | **High — "cannot disagree by construction" is not what the code gives.** The view and `beginMove` share one rule but take their liveness from two independent arguments | **Adopted.** The claim is qualified everywhere it appears to *one rule over **consistent** inputs*, in each case in the same sentence that says the inputs are not forced — and what would close the other half is written as a requirement on step 2's component |

**Round 3 — a scoped pass over round 2's fixes**
(`docs/reviews/phase-2c-3b-1-third-pass.md`, `NOT READY`), commissioned by the standing rule that *a
fix is a change and the round that reviews it is not optional*. It found F2, F3 and F4 **holding** and
**F1 BROKEN**, plus six findings — one High code defect, three High false claims in prose, one Medium
and two Low:

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — the refusal shown contradicted the failure shown.** Round 2 put the `mayHaveWritten` arm *below* `moved`, so a session that had committed a move and then met a send this application could not account for drew a definite *"This snippet has been moved"* beside a failure saying it may have moved or may not | **Adopted, and written as a rule rather than an arrangement of `if`s** — because this was the second round running to move that arm: **where two refusal arms are true at once, the one that claims less wins.** `mayHaveWritten` is the weakest of the seven, so it is asked first: above `alreadyMoved`, and above the liveness check whose sentence says nothing was written |
| 2 | **High — the on-screen reason for the terminal state was false.** Both dictionaries said moving again could repeat a change that has already happened. **It could not**: the session resends its frozen base revision, so a first write makes that base stale, and after re-opening on the new revision `alreadyThere` refuses the same destination | **Adopted.** Both sentences are new copy: a move was sent, this application cannot tell whether the file was written, so **this panel can no longer establish where the snippet is**. The terminal state rests on **uncertainty and a stale identity**, never on duplicate execution |
| 3 | **High — the record described a pair that cannot exist.** It said `reloadFile` is offered beside `mayHaveWritten`; `mayHaveWritten` is `true` for `saveFailed` alone and `reloadFile` is offered for four *other* codes | **Adopted.** No `MoveRecovery` is offered for `mayHaveWritten`, and that is not a gap — the wrapper has already attempted the re-read a recovery would offer. A test asserts the empty `recovery` beside the real rejection |
| 4 | **Medium — the module header contradicted the implementation**, still saying `invalidated` comes from the adoption alone | **Adopted**, in the header, in the field comment that carried the same sentence, and in `applyMove`'s own JSDoc |
| 5 | **Low — a structural guarantee had lost its test.** Round 2's replacement case tests production but no longer observes that an adoption owed **at all** invalidates whatever arm carried it | **Adopted.** Both cases exist, the second labelled as a **structural guard over a pair the wrapper cannot answer**, so nobody reads it as a claim about production |
| 6 | **Low — "every claim is about model tests" had stopped being true**: round 2 added a case driving the real `BrowserState.moveMatch` | **Adopted.** The record now says the conflict invalidation has **wrapper-level** evidence and that the no-screen limitation is untouched |

**Why three rounds, and why a fourth is a live question.** Two rounds would have shipped a panel whose
refusal contradicted its own failure message, and each of the three previous rounds' fixes produced
the next round's finding. **Round 3's own fixes were not themselves re-reviewed** — see `## Next
action`, where deciding that is the first thing step 2 is asked to do.

---

## Verification — Phase 2c-3a step 2

Every command below was run **by the orchestrator**, each as its own invocation, and re-run after
each of the two fix rounds. None was taken on a worker's word.

| Command | Result |
|---|---|
| `npm run check` | 403 files, **0 errors, 0 warnings** |
| `npm test` | **1160 passed, 42 files** (from 1116 / 40 at step 1) |
| `npm run build` | **165 modules**, `vite.config.ts` untouched |
| `cargo test --workspace` | **1008 passed, 0 failed** — unchanged; step 2 wrote no Rust |

**The module guard moved 161 → 165 and was rebaselined honestly**, not by editing
`resolve.conditions`: a pristine `git archive HEAD` copy measured 161, and the delta of exactly +4 is
two new `.svelte` files × (the module + its virtual CSS module) — confirmed by deleting one `<style>`
block in a scratch copy, which gave 164. No `svelte/internal/server` and no `node:async_hooks` in the
bundle, so this is the new-module shape and not the `resolve.conditions` regression.

**The i18n delta was verified rather than taken on trust**, because a false count was one of the two
review findings: `git diff --numstat` reports **51 added, 0 deleted** in each of `en.json` and
`es.json`.

### The three kinds of evidence 2c-split-notes §7 requires — all three exist for the first time in this sub-phase

1. **Model tests** — step 1's, extended in step 2.
2. **Mounted-component tests** — `MatchCreator.test.ts` and `MatchDeleter.test.ts`, each opting into
   jsdom by its first-line docblock. The existing six components were **not** back-filled; the jsdom
   decision stays scoped. These include the identity-churn test the design consult's Q7 demands, and
   Codex confirmed it **would fail if the repair were removed** rather than passing vacuously.
3. **A window reading** — `docs/decisions/2c-3a-2-window-reading.md`, **12 launches**, all eight
   planned items established, plus a **6-launch re-take** after the layout fix.

**The mounted test earned its existence on its first run, and this is the strongest evidence yet for
the §7 rule.** `startMatchDeletion` drafted `match.id`, and `draft.ts` snapshots through
`structuredClone`, which **throws on Svelte's `$state` proxy**. Opening a deletion in a real window
would have thrown `DataCloneError` — while the whole of `matchDeletion.test.ts` stayed green, because
every model test passes a plain fixture. `plainIdentity()` in `matchDeletion.ts` is the fix; a model
case **and** a mounted case now pin it.

---

## Phase 2c-3a step 2 review disposition

**Round 1 — the aggregate code review** (`docs/reviews/phase-2c-3a-2-code.md`, `NOT READY`):

- **Medium — the line-ending disclosure contradicted the measurement recorded beside it.** The
  creation screen drew **one shared sentence** saying a pasted carriage return becomes an ordinary
  line break, but the trigger is an `<input type="text">`, which **deletes** the character, and only
  the body is a `<textarea>`, which collapses it to LF. Pasting `:a\rb` into the trigger produced
  `:ab` while the screen promised a line break. Fixed by **splitting the key in two** —
  `browser.matchCreation.lineEndings.{trigger,replace}` — each drawn inside its own control's block,
  so **position** chooses the sentence and no condition entered the markup.
  **Interception was deliberately not chosen**: the precedent for refusing a `\r` is the *raw
  editor*, where reconstructing a line ending would reformat lines the user never touched, whereas
  creation writes a brand-new match and no pre-existing byte is at stake.
- **Low — a false count in the decision record**: it claimed fifty-one Spanish sentences where the
  diff added fifty. Fixed by **re-deriving the number** rather than adopting either figure: fifty
  before the fix, **fifty-one** after it, because the fix splits one key into two. All four places in
  the record now agree, and the record says how the number was obtained.

Codex confirmed in the same review that the identity checks this sub-phase exists to protect all
hold: every deletion reaches `confirmDelete` through a single path that recomputes
`identityInProjection(projections(), session.match)` **at the click**; save, create and delete each
forward their own submission's base revision; the two selection generations remain independent and no
changed path adds a direct `selected` assignment; and no writing path bypasses the Rust save entry
point.

**Round 2 — the confirmation pass** (`docs/reviews/phase-2c-3a-2-confirmation.md`, **`READY`**),
commissioned because *a fix is a change and the round that reviews it is not optional* — three of
step 1's ten findings were regressions introduced by a previous round's fix. **No findings.** It
checked, among other things, that the Spanish sentence says what its English twin says, that the new
test **would fail if the two sentences were swapped**, and that the 51-key figure holds against the
actual dictionary diff.

**Round 3 — the window reading, which found what neither review could.** See the section below.

---

## The window reading of 2c-3a-2, and the two defects it found

`docs/decisions/2c-3a-2-window-reading.md`. Twelve launches, all reaching `--- end` with zero-byte
stderr, none blanking. One launch (L2) was wasted on the *instrument* rather than the product — the
probe read `aria-pressed` where `SnippetList.svelte` writes `aria-current` — and was re-taken as L3.
**No launch was lost to a leaked language override**, because every plan set the language through the
picker, which is the correction `2c-2-2-window-reading.md` §1.2 records.

All eight planned items were established, including all five `DestinationRefusal` members drawn as
localized sentences with nothing omitted (consult Q5), the ordinal-position selection repair **and**
its new-last fallback with the localized notice both times (consult Q1), the single-snippet refusal
with no delete control anywhere in the window (consult Q6), and the whole form in Spanish. Every write
was byte-checked: *byte-identical outside the one span*, every time.

**Defect 1 — FIXED IN THIS CUT. The creation form's primary action opened below the fold.** At the
default window (webview 1180×728) with 8 files, the form was **805 px inside a 645 px pane** and
*Add this snippet* sat at **y=813**, invisible until scrolled 174 px — as was the body's line-ending
disclosure. **The cause was the unbounded destination list**, so it scaled with file count and the
owner's real 13-file configuration would have been worse than the measured case.
Fixed in `MatchCreator.svelte` with **layout only, no new string and no new condition**:
`.destinations` takes `max-height: 12rem; overflow-y: auto` so the list scrolls inside itself, and the
action row becomes `position: sticky; bottom: 0`, with the create control and the sentence saying why
it is disabled wrapped into **one** block so a pinned control cannot lose its reason.

**The re-take is what makes that a fact rather than an intention** — a reading is re-taken after any
change to a component. Six further launches, none failed: the create control is now at **y=594** with
the pane no longer scrolling at all (`scrollHeight` 645 = `clientH` 645), and at **14 files the y is
identical at 594** — only the list's internal `scrollH` moves, 390 → 570. A deliberately forced
overflow (an 824 px form in a 617 px box) still put the control on screen at y=624 with its refusal at
y=654. Every destination remains reachable and every refusal readable, so Q5 is not traded away for
the fix. **Spanish measured 13 px of margin, and the record says 13, not "comfortably."**

**Defect 2 — DEFERRED, AND IT NEEDS THE OWNER'S DECISION.** The Spanish dictionary calls a snippet
both **`atajo`** (the 2c namespaces — 22 of this step's 51 new strings) and **`fragmento`**
(everything older), and L9 draws **both, five lines apart, in one pane**. The split **predates
2c-3a-2**; this step widened it and is the first to put both words on screen together.
It was **not** fixed here for two reasons, both deliberate: it spans namespaces belonging to 2c-1a,
2c-1b and 2c-2, well outside this cut, and *which Spanish word this application uses for a snippet* is
a user-facing terminology decision in the owner's own language, not an orchestrator's call.
The mechanical reading favours **`fragmento`** — it is the established majority term and the closer
match to the English *snippet*, whereas `atajo` means *shortcut*, which in espanso more naturally
names the **trigger** than the match. That is a recommendation, not a decision.

**Two further observations, both Low and both recorded rather than acted on**: the destination list
and the sidebar draw the same files in two different orders (each correct per its own documentation),
and hole 13 was confirmed on screen — the raw-text toggle is not withdrawn while either new screen is
open.

**What the reading did not reach, stated as gaps in its §9 rather than papered over**: every outcome
arm but `saved`, plus `confirmationRefused`, `notInDocument`, the leaving confirmation, the in-flight
sentences, undo/redo by click, and `documentHasNoMatchList`. The re-take adds three more: it drove no
save, so no bytes were re-checked; the Spanish *destination list* was not re-listed, so the
reachability finding is English-only; and the list was scrolled by assigning `scrollTop` rather than
by a pointer gesture, so **whether the bounded list looks scrollable to someone who has not tried is
a question no DOM transcript can answer** (§12.9).

**The probe was removed and its removal verified** — `diff` reports `main.ts` and `main.rs` identical
to their pre-probe copies, `rg` finds no probe symbol, and `git status --short --untracked-files=all`
shows exactly the intended files. No real configuration was opened at any point in either reading.

---

## Verification — Phase 2c-3a step 1

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report, and re-run after each of the three review rounds. The figures are the final run.

| Command | Result |
|---|---|
| `npm test` | **1116 passed, 40 files** (from 1020 over 38 at the 2c-2-2 checkpoint) |
| `npm run check` | `399 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS` |
| `npm run build` | exit 0, **161 modules** |
| `rg -c 'svelte/internal/server\|node:async_hooks' dist/assets/*.js` | no match — **not** the `resolve.conditions` regression |
| `git status --short` | no `.svelte` file, no Rust file, no corpus file |

**The module guard moved 158 → 161 and the delta is honest**: exactly three new source modules
(`matchCreation.ts`, `matchDeletion.ts`, `typing.ts`), each reaching the bundle through
`i18n/index.ts`'s three new accessors. `vite.config.ts` was not touched, and the bundle was checked
for the server build rather than the count being trusted — a jump to ~180 with
`svelte/internal/server` present is the regression, and it is absent.

`cargo test --workspace` was **not** re-run and does not need to be: this step wrote no Rust, which
`git status` confirms rather than the worker's report. It stands at **1008**.

**One frontend claim was checked against Rust rather than assumed.** Destination eligibility asks
whether a file has a match list, and `matchCreation.ts:301` reads
`view.top_level_keys.some((key) => key.text === 'matches')`. `match_list_of` in
`src-tauri/src/commands.rs:947` reads `view.top_level_keys.iter().any(|key| key.text == MATCH_LIST_KEY)`
with `MATCH_LIST_KEY = "matches"`. Same field, same literal, same comparison — so the affordance
cannot disagree with the authority it defers to. The literal is duplicated because nothing on the
wire carries the name; the module says so.

**What this verification does not cover, and it is two thirds of the phase's evidence.**
`2c-split-notes.md` §7 requires three kinds, and step 1 has one: **the model tests**. There is no
mounted-component test and **no window reading**, because no `.svelte` file was touched. Per
`1c-1-notes.md` hole 1 and 2c-1b's own conclusion, a green suite is not a screen — nothing in this
project renders a Svelte component in an automated test except the three files that opt into jsdom
by docblock. **Step 2 owes both, and until it is done no claim may be made about what any of this
looks like in a window.**

---

## Phase 2c-3a step 1 review disposition

**Three Codex rounds, ten findings, all closed before the commit.** The shape of the rounds is the
finding worth remembering, more than any individual defect: *each round's fix produced the next
round's finding.*

**Round 1 — the aggregate code review** (`docs/reviews/phase-2c-3a-1-code.md`, `NOT READY`):

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — creation consent survived a retarget.** A create refused in file A at `End` could have its findings acknowledged, then be redirected to file B or `Front`, and `beginCreate` reused the old acknowledgement because the drafted buffers had not changed | **Adopted.** `chooseDestination`/`choosePlacement` now withdraw the submission, outcome, extra lines and consent; a destination change re-points the base through the new `retargetedDraft`. A placement equal to the one held is not a change |
| 2 | **High — the wrapper silently rebased a stale form.** `createMatch`/`deleteMatch` took no `baseRevision` and sent `view.revision` read at call time, so a form opened at R0 and submitted after the window reached R1 was committed against a parse it was never based on | **Adopted.** Both now take a `baseRevision` and forward it unchanged. **The record's own hole 3 was wrong** and was rewritten: it argued the disagreement was decided by "the command's own conflict check", and the original base never reached that check |
| 3 | **High — an identity resolved across revisions by node alone.** `positionOf` compares only `node`, so an R1 `moved` could resolve against a fresh R2 projection that had reused the arena slot, selecting an unrelated snippet as the one just created | **Adopted.** New `positionInSameParse` (document + revision + node), used by `adoptTheCreatedSnippet` **and** by `adoptTheDocumentOnDisk`, which serves `saveMatch` and `moveMatch` |
| 4 | **Medium — a save's adoption could be undone by an in-flight selection lookup**, replacing the mandated `deleted` notice with `differentMatch` — telling the person their file moved under them when what happened is the deletion they asked for | **Adopted**, and the fix was itself wrong. See round 2 |
| 5 | **Medium — a reload did not really invalidate pending deletion consent.** `confirmDelete` compared the pending identity against the session's own — two values minted together — so a retained session across a reprojection kept both stale **and equal**. The test manufactured a changed `session.match` and never drove the real path | **Adopted, enforced not narrowed.** `confirmDelete(session, projected)` takes the identity the **current projection** gives that snippet and compares four values; the test drives the retained-session path |
| 6 | **Low — not every open file was offered** as a destination; `destinationsOf` mapped projections, so a file the sidebar names as unreadable vanished from the list | **Adopted.** It maps summaries; a fifth typed refusal `couldNotBeRead` in both dictionaries |

**Round 2 — the confirmation pass** (`docs/reviews/phase-2c-3a-1-confirmation.md`, `NOT READY`):

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — and it was round 1's own fix.** Finding 4 had been closed with one **global** `selectGeneration` bump inside `installView`. A projection replaced in file B therefore killed a pending `select()` for file A, which returned without repairing, **stranding a `MatchId` that names nothing** — this sub-phase's declared worst failure mode, reached from the other side. Every deferred test used one document, so the suite was green for an unrelated reason | **Adopted.** The counter was split in two: a per-document `projectionGenerations` map bumped only by `installView` and `forgetTheReplacedDocument` for their own file, and the global counter kept as *selection intent*, bumped by a new `replaceSelection` through which every write to `selected` passes |
| 2 | **Medium — the deferral was justified by a caller that does not exist.** The record said fixing `saveMatch` and `moveMatch` needed a `.svelte` edit; `BrowserState.moveMatch` has **no production caller at all**, and `matchEditor.baseRevisionOf` is unused | **Adopted.** `moveMatch` now takes and forwards a `baseRevision`; only `saveMatch` is left to step 2, with the true reason. Its other latent shapes are re-recorded as 2c-3b's scope — **not** as blocked by a component |
| 3 | **Low — the record said `draft.ts` was unchanged** after the fix round added two transitions to it, concealing a change to the spine both other editors draft over | **Adopted**, rewritten as the two halves it has |

**Round 3 — a scoped pass over the round-2 refactor alone**
(`docs/reviews/phase-2c-3a-1-third-pass.md`, `NOT READY` on one **Low**): the invariant comment on
`replaceSelection` claimed one deliberate exception when there are two (`select()`'s and `open()`'s),
in the one place a maintainer would look for permission to add a third. Adopted: both are enumerated,
and the comment now says in the same sentence that the list is maintained by hand and that TypeScript
enforces nothing here.

That pass also **settled an open probe** rather than only finding a defect. Round 2's implementer had
honestly reported that dropping the projection half of `selectionLookupIsStale` failed no test. The
answer is that it is redundant in **every reachable ordering**, not merely the tested ones — a live
lookup makes its document the held selection before awaiting, and every same-document invalidation
then synchronously repairs or replaces that selection, bumping the intent counter. So **no honest test
can isolate it**, and none was written pretending to. It is kept as defensive redundancy and
`2c-3a-1-notes.md` §8.2 says so, including the fact that deleting it would break no test today — so
that deleting it is at least a decision.

**Why three rounds.** Two would have shipped the cross-document identity-stranding bug: it was
introduced by the fix for round 1's finding 4 and found only by looking again. The third round was
commissioned for that reason alone and scoped to that one change — the selection machinery serves
every operation in the application, not only this step's two.

---

## Verification — Phase 2c-2-2

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was re-run after every fix round and after every window reading; the table
records the final run.

| Command | Result |
|---|---|
| `npm test` | **1020 passed, 38 files** (974 / 36 after 2c-2-1; 1007 / 1014 / 1017 at the three reading boundaries) |
| `npm run check` | 394 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, **158 modules** — the guard moved by exactly two, see below |
| `cargo test --workspace` | **1008 passed, 0 failed** — unmoved, because **no Rust was written** |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output — the architecture rule holds |
| dictionary keys | **544 in each language** (513 before), parity clean; 31 keys added, one reworded |
| `git status --short --untracked-files=all` | changes only under `src/lib/`, `docs/` and `CLAUDE.md`; **nothing under `src-tauri/` or `crates/`, no corpus path, no probe artefact** |

**The 156-module guard is now 158, and the shape of the move is the check rather than the number.**
The two are `src/lib/components/MatchEditor.svelte` and `src/lib/browser/matchEditor.ts` — the latter
existed after 2c-2-1 but **no component imported it**, so it was tree-shaken out of the production
bundle. `+2` is exactly the number of source modules a screen over an existing model adds. The bundle
was searched for `svelte/internal/server` and `node:async_hooks`: **neither is present**, and
`vite.config.ts` was not touched. The regression this guard exists for is a jump to ~180 *with the
server build pulled in*. **Rebaseline by building a pristine `git archive HEAD` copy and subtracting;
never by editing the `resolve.conditions` condition.**

**The window readings are the third kind of evidence and they are not ceremony.**
`docs/decisions/2c-2-2-window-reading.md` records **four passes, 26 launches**, one plan per launch
into a fresh bundle path over a freshly rebuilt configuration. Every launch reached its own `--- end`
and every `probe.err` was zero bytes. They found **four defects the 1017-test suite, `svelte-check`
and the first Codex pass had all missed**. The probe was removed four times, once per pass;
`src/main.ts` and `src-tauri/src/main.rs` were each restored from copies taken **before** the probe
first existed and compared with `diff` — `IDENTICAL` every time — and every scratch path lived
outside the repository. **The owner's real configuration was never opened**: every fixture was
synthetic and hand-written for the run.

---

## Phase 2c-2-2 review disposition

Two Codex rounds, both saved in full: `docs/reviews/phase-2c-2-2-code.md` (four findings) and
`docs/reviews/phase-2c-2-2-confirmation.md` (all four confirmed fixed, three more). **Both returned
`READINESS: NOT READY`. All seven were fixed before the commit**, as were the four the window
readings found and the two the implementer's own audit found afterwards. The record is
`docs/decisions/2c-2-2-notes.md`; the readings are `docs/decisions/2c-2-2-window-reading.md`.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — `DetailPane` captured the match but read `file` reactively**, so opening the editor over a snippet of file A and then selecting file B put B's name on the header while every byte a save would write still went to A | **Adopted.** `MatchEditingSession { match, file }` is captured in **one assignment**; the header uses the captured file. `DetailPane.test.ts` exists for this one claim and is mounted over a **real** `createBrowserState` — a stub is not reactive, so the case would have passed before the fix as loudly as after it |
| 2 | **Medium — reprojection was optional.** *Dismiss* cleared the outcome through `keepEditing` and resumed editing on eligibility carried over from bytes the commit had replaced | **Adopted.** `needsReprojection` is a field on `MatchEditorSession`, set by a commit and cleared by **nothing** but `startMatchEditor` over a fresh projection; `isEditable` is `false` while it is `true`; the committed panel offers the re-seed and **no *Dismiss*** |
| 3 | **Medium — the `failure === null` invariant was a comment, not a type.** `{ kind: 'failed', mayHaveWritten: true, failure: null }` type-checked | **Adopted.** `MatchSaveAnswer` has three arms: `answered`, `notAttempted` (no fields, because nothing was sent) and `failed` with `failure: IpcFailure` **required**. This is the prohibited class *a record claiming a guarantee the code does not give*, in a published type |
| 4 | **Low — a mounted test claimed 21 fields unchanged while sampling five** | **Adopted.** `UNTOUCHED: MatchDraft` is an exhaustive typed literal; a twenty-third required property is a compile error |
| 5 | **Low (confirmation) — the caption claimed every refused value is shown "as the file writes it"**, while a `notScalar` arm renders only a localized shape name | **Adopted.** A caption **per arm**: `browser.detail.valueAsWritten` on a `text` arm, the new `browser.matchEditor.shapeOnly` on a `notScalar` one. The blanket caption is gone from the DOM, not overridden |
| 6 | **Low (confirmation) — `unmodelledShape` said the app "cannot show what it holds"** while the component draws `UnknownEntry.value_text` above it | **Adopted, and deliberately not reworded to "the value is shown"** — `shownValuesOf` answers `[]` when `value_text` is empty. It now says the app cannot **edit** the key as one text field and will not write over it, which is true in both cases |
| 7 | **Low (confirmation) — `cannotReproject` gave one cause where three are possible** | **Adopted, as a typed reason rather than a vaguer sentence.** `Reprojection` answers `projected` or `unavailable` over `ReprojectionRefusal = notProjected \| otherFile \| otherSnippet`; the three states have three different ways out, so a neutral sentence would be true and useless |

**Four more came from the window readings, and no test could have.**

| # | Finding | Disposition |
|---|---|---|
| R1 | **A `triggers:`-list snippet's triggers were invisible.** A refused field drew its name and its reason with nothing between them, and D10 replaces the whole detail pane — so the triggers appeared **nowhere in the window**. Measured as `open triggersOnScreen: no` | **Adopted.** `FieldBaseline.shown` / `shownValuesOf`: one entry per trigger, `regex:` included, a non-scalar item **named** rather than dropped |
| R2 | **`shownValuesOf`'s doc claimed "source order" while the code read three fixed slots**, so a file writing `regex:` above `trigger:` drew them the wrong way round | **Fixed in the code, not in the sentence.** Forms are placed by the **first byte of each form's value**; a `triggers:` list's own items are never re-sorted. Weakening the doc was available, correct and cheap — and would have shipped a screen that misorders a snippet's own trigger forms |
| R3 | **The shown boxes were unlabelled**, so a `Several`'s trigger and regex were indistinguishable with the pane that names them off-screen | **Adopted.** `ShownValue.source` rendered with `tDetailField` — the detail pane's own strings, no new key. `tTriggerKind` will not do: it names the whole spec's shape, not a slot |
| R4 | **The unlocated-form branch is unreachable from the projector**, while the doc sold it as a live fallback with a named trigger | **The branch was kept and the comment corrected.** `scalar_sequence()` at `crates/espansoconfig-core/src/model/project.rs:143` emits only `Scalar` or span-bearing `Elided`, so `position: null` cannot arise today — but `ValueView` has five arms and a `MatchView` is a **boundary value** nothing in TypeScript proves came from that writer |

**And two the implementer's own audit found**, after both Codex rounds had passed over them:
`browser.matchEditor.discardWarning` was drafted with the raw editor's *"Your changes have not been
written to the file"*, which is **false** after a `mayHaveWritten` send failure; and the
`fieldRemoved` marker was gated on the buffer's `removed` flag, so it went on promising a future
write after a **committed** removal. It is now gated on `field.intent === 'Remove'`.

**Eight of the thirteen rows above are this project's named worst defect class** — a record, comment
or string claiming a guarantee the code does not give — plus one the tables do not list, the
`matchEditor.ts` module header that said the carriage return is refused *twice* while three gates
existed. That is instances five through thirteen, across three phases (2c-1a had two, 2c-2-1 had
two), and the new thing about this phase is **where** they were: the first three rounds found them in
comments, the last two found them in **sentences a person reads**. Nothing in the test suite,
`svelte-check`, the i18n parity tests or the markup scan can fail on that — every one of those checks
that a key exists and is translated, and every false key existed and was translated.

**One latent instance was found and deliberately not changed.**
`browser.rawEditor.discardWarning` carries the identical false wording and is reachable the same way.
It is 2c-1b's published string and its markup is outside this cut; fixing it here would oblige a
re-take of 2c-1b's window reading for a string this phase does not draw. It is hole 12 of
`2c-2-2-notes.md` §4 rather than a silent carry-over.

**The readings and the reviews found different things and neither subsumes the other.** Codex found
three of the four code findings by reading types; the readings found four defects no type could
express. The fourth reading found nothing, which is what a reading looks like when the fixes are real.

---

## Verification — Phase 2c-2-1

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was re-run after **both** fix rounds; the table records the final run.

| Command | Result |
|---|---|
| `npm test` | **974 passed, 36 files** (894 / 35 before the phase; 963 and 971 at the two fix rounds) |
| `npm run check` | 391 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, **156 modules** — the guard rebaselined, see below |
| `cargo test --workspace` | **1008 passed, 0 failed** (1007 before — exactly the one Rust test this step added) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output — the architecture rule holds |
| `git status --short --untracked-files=all` | changes only under `src/lib/`, `docs/` and `crates/espansoconfig-core/tests/`; **nothing under `src-tauri/`, no corpus path, no probe artefact** |

**The 154-module guard is now 156, and it was rebaselined by measurement rather than by assumption.**
A pristine `git archive HEAD` copy was extracted, given a symlinked `node_modules` and built: it
prints **154**, so the delta is exactly the two new source modules (`matchEditor.ts` and
`editorSave.ts`, both reached from `i18n/index.ts`). The bundle was then searched for
`svelte/internal/server`, `payload.out` and `async_hooks` — **none present**. The guard's real
signature is a jump to ~180 *with the server build pulled in*; that is absent, `vite.config.ts` was
not touched, and the number moved by exactly what a new module costs. **Rebaseline this way or not at
all; never by editing the condition.**

---

## Phase 2c-2-1 review disposition

Two Codex rounds, both saved in full: `docs/reviews/phase-2c-2-model-code.md` (the aggregate review,
five findings) and `docs/reviews/phase-2c-2-model-code-confirmation.md` (the confirmation pass over
the fixes, two more). **Both returned `READINESS: NOT READY`. All seven were fixed before the
commit.** The design consult that preceded the code is `docs/reviews/phase-2c-2-design.md`.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — `BrowserState.saveMatch` collapsed every command failure to `null`**, discarding the `mayHaveWritten` bit, so a `SyncDirectory` failure after the rename was indistinguishable from `noWorkspaceOpen` and could be reported as *nothing was written* | **Adopted.** `saveMatch` answers `MatchSaveAnswer` — `{kind:'failed', mayHaveWritten}` or `{kind:'answered', result, adoption}` — mirroring `RawSaveAnswer`. The `null` return is gone. This is the prohibited class *a committed or possibly-committed write reported as an error*, reached again by a new route |
| 2 | **Medium — a failed reprojection left stale projections and identities installed** while still returning the committed result, contradicting the adoption guarantee the notes claimed | **Adopted.** `adoptTheDocumentOnDisk` now *returns* the failure; `saveMatch` calls `forgetTheReplacedDocument`, puts `adoption: {kind:'failed'}` **beside** the committed outcome, and `applySave` takes it as a required third argument and adds the `windowOutOfStep` line beside — never in place of — the saved arm |
| 3 | **Medium — no carriage-return gate at save time**, though `MatchBuffers` is unbranded, so `{ Set: "a\rb" }` could reach the wire | **Adopted.** `beginSave` refuses when the **derived draft** would write a `\r` — the derived draft and not the buffers, because a CR-refused field legitimately holds one in its buffer while sending `'Unchanged'`, and gating on buffers would refuse every save on such a snippet |
| 4 | **Low — identity adoption dragged the selection back** to the saved match even when the selection moved while the save was in flight | **Adopted.** Adoption takes the pre-save target identity and re-points only when the held selection is still that snippet; `moveMatch` inherits it |
| 5 | **Low — a net-zero typing burst left a ghost undo step** that changed nothing | **Adopted.** `amendDraft` drops the step it replaces when the replacement equals the step immediately before it, restoring that step's value *and* generation |
| 6 | **Medium (confirmation pass) — `saveMatch` invalidated `fileTextAnswer` but not the separate `conflictText` cache**, so a raw-conflict capture of version A survived a field save that committed version B — and the notes said all raw text was dropped | **Adopted.** `forgetConflictText` / `forgetTextOf` added and called on all three state-changing paths; `forgetTheReplacedDocument`, whose comment claims to be total for one document, drops it too, so that claim became true as well |
| 7 | **Low (confirmation pass) — collapsing a net-zero group could not restore an undo entry the group's own bounded push had already evicted** at the 100-step bound | **Adopted, with the cost stated.** `pushBounded` answers what it dropped, `Draft.evicted` retains it for exactly one group, and every boundary a collapse cannot follow releases it. Worst case moves from 100 retained steps to 101, said in the code comment, in `Draft.evicted`'s doc and as notes hole 10 |

**Findings 6 and 7 exist because of the fixes to 1–5** — the confirmation pass earned its round trip,
exactly as 2c-1b's second pass did. **Run one; the pattern is now twice-attested.**

**Two of the seven were the decision record claiming a guarantee the code did not give** (findings 2
and 6), which is this project's named worst defect class and the one no test can fail. That is the
third and fourth instance across two phases. The notes were swept afterwards rather than patched at
the two named sentences, and the remaining guarantee sentences — the wrapper bypass, *nothing forces
a caller to read `adoption`*, *eligibility is not re-derived*, *the gate cannot explain itself* —
were each confirmed to state their limit in the same sentence as the claim.

**The falsification check is the evidence that the tests are real**, and it was run for both rounds:
with the fixes reverted, exactly the named tests fail (8 of 185, then 3 of 188) and nothing else.

---

## Verification — Phase 2c-1b

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was re-run after **every one of the three fix rounds**; the table records the
final run.

| Command | Result |
|---|---|
| `npm test` | **894 passed, 35 files** (821 before the phase; 868 / 883 / 892 at the three fix rounds) |
| `npm run check` | 388 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, **154 modules** — the regression guard, see below |
| `cargo test --workspace` | **1007 passed, 0 failed** — *unchanged*, and run to prove it |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `git status --short --untracked-files=all` | changes only under `src/lib/`, `docs/`, `vite.config.ts` and the two package files; **no probe artefact, nothing under `crates/` or `src-tauri/`** |

**The baseline was verified before the phase, not assumed**: `npm test` 821 passed / 33 files and
`cargo test --workspace` 1007 passed were both run at the head of the session, so the +73 frontend
tests are measured against numbers this session observed.

**154 modules is a regression guard, not decoration.** A first attempt at the jsdom decision set
`resolve.conditions` unconditionally; that option *replaces* Vite's defaults, so the production
build silently went to 180 modules and pulled in Svelte's **server** build. Nothing failed. The
module count is checked on every round because it is the only cheap signal that the test and
production resolution paths have not diverged again.

**`cargo test --workspace` is in the table although this phase wrote no Rust** — that is the point
of running it. 2c-1b's claim is that the raw editor needed zero new Rust, and an unchanged 1007 is
the evidence.

**What this table does not establish, and cannot — and this phase is the proof.** The window
reading found **two real defects that 883 passing tests, `svelte-check` and two Codex passes had
all sailed past**, one of which silently rewrote every line ending in a user's file. A green table
is not a screen. The three kinds of evidence `2c-split-notes.md` §7 requires were all taken:
model tests, this project's **first mounted-component tests**, and **two window readings** — the
second because the first one's findings changed three components, and a claim about a screen needs
a reading of a screen.

**Three things the readings did not reach**, recorded as holes rather than rounded up: the
indeterminate `mayHaveWritten` arm (it needs a failure in the microseconds between rename and
read-back), `windowOutOfStep`, and `committed: false` from this screen — the last unreachable by
design, and read rather than merely argued. Whether the shipped WKWebView refuses
`navigator.clipboard` is **unsettled**, not answered: the machine's screen was locked for both
runs. It needs a human at an unlocked machine.

---

## Verification — Phase 2c-1a

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **twice** — on the implementation and again after the review fix
round — and the table records the second run.

| Command | Result |
|---|---|
| `npm test` | **821 passed, 33 files** (738 before the phase; 797 before the fix round) |
| `npm run check` | 384 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, 150 modules |
| `cargo test --workspace` | **1007 passed, 0 failed** — *unchanged*, and run to prove it |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `git status --short` | changes only under `src/lib/` and `docs/` |

**The baseline was verified before the phase, not assumed**: `cargo test --workspace` 1007 passed
and `npm test` 738 passed were both run at the head of the session, so the +83 frontend tests are
measured against a number this session observed.

**`cargo test --workspace` is in the table although this phase wrote no Rust.** That is the point
of running it: 2c-1a's whole claim is that it is TypeScript-only, and an unchanged 1007 is the
evidence. `git status --short` is in the table for the same reason — it is what shows no `.svelte`
file, nothing under `crates/` and nothing under `src-tauri/` was touched.

**What this table does not establish, and cannot.** Nothing in this project renders a Svelte
component in an automated test, and 2c-1a **draws nothing** — no component, no screen, no window
reading. So none of these 821 tests is evidence about a screen, and the phase does not claim to
be. The three kinds of evidence `2c-split-notes.md` §7 requires of every 2c sub-phase are owed
in full by **2c-1b**, which is where the first mounted-component test and the first window reading
of an editing screen both land.

---

