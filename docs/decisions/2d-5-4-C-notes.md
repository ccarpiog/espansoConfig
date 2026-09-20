# Phase 2d-5-4-C — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4-B's fix

**Status: taken and answered.** Risk class: **high**. Components: **none** — no `.svelte` file was
modified, so no window reading is owed.

This is **not** an implementation step. §7.1: *a fix round that changes at least one source file is
owed a review round, scoped to that change.* Phase 2d-5-4-B's fix changed four source files; this is
the round that reviews **that fix**, and this file records what the round found and what was done
about it. Its own fix changes source, so §7.1 commissions a further round — §11 says so and says why.

The documents: the brief [`docs/reviews/phase-2d-5-4-C.brief.md`](../reviews/phase-2d-5-4-C.brief.md),
the review [`docs/reviews/phase-2d-5-4-C.md`](../reviews/phase-2d-5-4-C.md), and the re-derivation
[`docs/reviews/phase-2d-5-4-C.rederivation.md`](../reviews/phase-2d-5-4-C.rederivation.md).

---

## 1. How the round was run

**The review was Codex**, verdict `ship-with-fixes`, **4 findings: 1 blocker and 3 SHOULD-FIX**, over
the committed fix `834ed1b`.

**The report's finding bodies arrived truncated for the fourth round running** — about 180 characters,
each breaking off mid-sentence — so the same three-stage shape was used and **no finding was accepted
on the report's strength**:

1. a **read-only re-derivation worker** derived each finding's mechanism from the source alone, quoted
   the decisive lines, corrected the reviewer's wording where it was wrong, and swept for what the
   review had missed — finding five more things;
2. the **orchestrator spot-checked the decisive lines of all four findings and of M1** against the
   files;
3. this fix round implemented the four fixes **plus M1, M3, M4 (decided item by item on the code) and
   M5**, and pinned every source fix with a case confirmed to fail against the pre-fix code.

**All four held**, three of them with a clause of the reviewer's wording corrected and one (finding 3)
holding only in part. **Where the review and the re-derivation differ, this record says the
re-derivation's sentence and names the difference**, because the review's is what a later reader would
otherwise carry forward:

| # | What the review said | What is true |
|---|---|---|
| 1 | the retained identity *"is then read after the final selection-staleness check"* | nothing inside `select()` reads it after that check. The danger is **one step later and lasts the session**: the object goes into module state and is read as the last conjunct of three selection-follow guards, immediately before the `replaceSelection` each guard justifies |
| 2 | anchored at `workspace.svelte.ts:3130` | `3130` is where the damage **shows**; the culprit is the restatement at `2468`, and the mechanism is `noteDocumentStatus` bumping the ownership token unconditionally at `2921` |
| 3 | *"source defect introduced by the summary copy"* | the shape **pre-existed** — `documents = listed.value` already put two caller-supplied reads between the check and the assignment — and the copy widened the window to `2 + 7N` reads plus a caller-controlled iterator. The copy is not the cause; it is what made the window wide |
| 4 | anchored at `observationTransitions.ts:901` | `901` is on the path that reaches it; the unfenced write is `workspace.svelte.ts:2429`, and the reason the host could not fence it is that `ReconciliationWorkspace.rereadUnderGuard` carried no predicate |

**One more correction, and it is to the re-derivation rather than to the review.** Its recipe for
finding 2's pinning case settles the two reads in the **opposite order** to its own failure sequence —
the newer read first, the older failure second. In that order the case **passes both ways**; §12 records
the measurement and the discard.

---

## 2. Finding 1 — the kept selection repair retained the command's own identity

**What it was.** `repairSelection` (`src/lib/browser/selection.ts:294-300`) calls `reresolve` on the
projection `commands.reloadDocument` answered with, and `reresolve` (`:193-207`) fills the kept
selection's `id` from `view.matches[previous.position].id` **by reference**. `ownedRepair` in
`src/lib/browser/workspace.svelte.ts` copied the *projection* and passed `selected` through unchanged,
so what `applyRepair` installed — and what the window then held for the rest of the session — was an
object an injected command built.

**Why that matters, stated as the code says it rather than as the review did.** Nothing in `select()`
reads that identity's own properties after the final staleness check: `installView` walks owned views,
`replaceSelection` is a counter bump and an assignment, and `readFileText` reaches `selected.document`,
an own data property of the literal `reresolve` built. The exposure is *later*. `isTheSameIdentity`
reads `held.document`, `held.revision` and `held.node`, and it is the **last conjunct** of the
selection-follow guard in `adoptTheDocumentOnDisk`, of `deleteMatch`'s `heldBefore` capture and of
`duplicateMatch`'s `intent` capture — each immediately before the `replaceSelection` that guard
justifies. A getter there runs arbitrary code inside exactly the window 2c-3c step 2's High was closed
to protect: it can clear or move the selection and then answer values that make the conjunction true,
and the adoption then writes over the intent the person expressed *inside* the guard.

**The fix.** `ownedRepair`'s `kept` arm rebuilds the `SelectedMatch` field by field, with
`ownedMatchIdOf(repair.selected.id)`. Field by field rather than a spread, for `ownedMatchOf`'s reason:
a required member added to `SelectedMatch` later is a compile error in that function. The copy happens
where `ownedRepair` is already called — before `select()`'s own staleness check — so the accessors run
before the comparison rather than between it and the write it approves. **What no type forces:** that
a future arm of `SelectionRepair` carrying a selection goes through it too.

**The pinning case.** `workspace.test.ts` — *keeps no command identity when a repair keeps the
selection*. It drives `select()` into the `kept` arm with a reload whose `matches[0].id` is a trap,
asserts the retained identity is not that object, then arms the trap, commits a move and asserts the
adoption's guard fired no command-supplied accessor.

**Confirmed against the pre-fix code** by restoring `selected: repair.selected` and running the suite:

```
AssertionError: expected { Object (document, revision, ...) } not to be { Object (document, revision, ...) } // Object.is equality
```

and, with that first assertion removed so the second could be reached, `AssertionError: expected 1 to
be +0 // Object.is equality` — the guard's own read of the command's object.

---

## 3. Finding 2 — a value-neutral restatement spent the ownership token a newer read was holding

**What it was.** The host's coordinator-facing `rereadUnderGuard` member marked the file `stale` before
starting the read and, on failure, re-stated `stale` behind three fences: the open generation, this
file's status-write count and whether the window still holds a row. The fences are correct, and what
they prove is that the permitted write can never change a value — a write they allow happens only when
nothing has written that file's status since the initial mark, so the entry there *is* this arm's own
`stale`. **What the write still did was advance the token.** `noteDocumentStatus` bumps
`statusWrites` unconditionally, and that token is the only thing the private helper's clear compares.

**The sequence, and it needs no accessor at all — it is reachable in the shipped window.** A `Changed`
observation is admitted for document `D`; the host marks `stale` (token 1) and read **A** goes out. The
person uses the recovery control while A is still out: `BrowserState.rereadDocument` writes **no** mark
of its own, so read **B** captures token **1** as well. A comes back a failure; all three fences pass,
because B has written nothing; the restatement writes `stale` over `stale` and the token becomes 2. B
then succeeds and installs the bytes on disk — and finds `statusAt (1) !== statusWriteOf (2)`, so its
clear is suppressed. The file is left marked `stale` **permanently**: the batch watermark has moved
past the observation that set it, and only an installation clears a mark.

**The fix: the restatement is deleted, and the arm with it.** Deleting is the whole repair rather than
a weakening, and the fences are what prove it: they permit the write only in the case where it changes
no value, so nothing that was true stops being true. What records a failed read is the mark written
**before** the read starts — which nothing has cleared, since that is exactly what the second fence
tested — and the failure itself is carried by `report` inside the private helper, on the one channel
every other failure of this state uses. The member is now the initial mark plus `void
rereadUnderGuard(document, guard)`, and its JSDoc says all of this, including that the answer is not
handled there and is not discarded either.

**Why not the other repair.** Making `noteDocumentStatus` skip the bump when the value is unchanged was
rejected on the code: it would need a deep comparison of `ExternalDocumentStatus`, and it would open a
new hole at the clear — a newer `Unreadable` re-asserting the reason that was already there would bump
nothing, and the held read would then clear a mark a newer observation had just set.

**The pinning case.** `workspace.test.ts` — *lets a newer successful reread clear a mark an older
failure cannot hold*: two held reads, the coordinator's failing first and the person's succeeding
second.

**Confirmed against the pre-fix code** by restoring the arm verbatim and running the suite:

```
AssertionError: expected { kind: 'stale' } to be null
```

---

## 4. Finding 3 — `open()` published copied rows with no generation re-check

**What it was.** `open()` compares its generation once, immediately after `list_documents` answers.
Everything between that comparison and `documents = rows` is caller code: `listed.ok`, `listed.value`,
the iteration protocol `for…of` asks `listed.value` for, and seven field reads per row inside
`ownedSummaryOf`. A getter on any of them can synchronously call `state.open(...)`, which bumps the
generation, clears `documents`, `views`, `selected`, `externalStatuses`, `pathDrift` and
`pendingAdditions`, sets `status = 'loading'` and suspends at its own first await. The superseded load
then publishes the **previous** workspace's rows over the new open's cleared list and issues one
`get_document` for one of them. If the second open refuses, `fail()` sets `status = 'failed'` and
touches `documents` not at all, so the window draws *the open failed* over a sidebar listing another
workspace's files — identities that feed `rawTarget`, `creatorEligibility`, `holdsDocument` and the
coordinator's membership test, with no `pendingAdditions` marks to constrain them.

**Where the review overstates it.** *Introduced by the summary copy* does not hold. Before 2d-5-4-B the
line was `documents = listed.value`, with `listed.ok` and `listed.value` already standing between the
check and the assignment; a getter on `value` could already re-enter. The copy widened the window from
two reads to `2 + 7N` plus a caller-controlled iterator and gave it a per-row trap surface. The remedy
closes both, and the comment in source says so.

**The fix.** A `generation !== openGeneration` comparison after the row loop and immediately before
`documents = rows` — literally the repair 2d-5-4-B made after the projection loop, one loop earlier.

**The pinning case.** `workspace.test.ts` — *publishes no row when a summary's own getter opens another
workspace*, with the second open refused so the window it leaves behind is the one a person would see.

**Confirmed against the pre-fix code** by deleting the new comparison and running the suite:

```
AssertionError: expected [ { id: 1, …(6) }, …(2) ] to deeply equal []
```

and, with that assertion removed, `AssertionError: expected "vi.fn()" to not be called at all, but
actually been called 1 times` — the `get_document` the superseded load sent for a row of a workspace
that was already gone.

---

## 5. Finding 4 — the initial `stale` mark stood outside every ownership question

**What it was.** `applyChange` arbitrates at `sequences.admit(document, route.sequence)` and then, on
the path that does **not** refuse, calls `tellTheSurfaceAbout` — which runs `workspace.openWriteSurfaces()`
and `workspace.creatorEligibility(document)`, the second of which walks this window's row list — and
then `workspace.writeSurfaceGeneration()`, before reaching `workspace.rereadUnderGuard(document, guard)`.
The host member's **first statement** is `noteDocumentStatus(document, { kind: 'stale' })`. So a host
whose accessor admits a newer `Unreadable` for the same file has that observation's typed reason
overwritten by a `stale` from an observation that is no longer the newest — permanently, because the
watermark has moved past the one that carried the reason. This is the identical window 2d-5-4-B's
finding 5 closed for the guard's four arms, left open for the path that starts the read.

**The reason it was not closed then, stated as a property of the type.**
`ReconciliationWorkspace.rereadUnderGuard` carried no ownership argument, so **the host could not ask
the question even in principle**, and the caller could not make the write because the write is in the
host.

**The fix: the question travels to the write.** `rereadUnderGuard` takes a third parameter, `owns: () =>
boolean`, asked immediately before the initial mark and in the same synchronous block as it.
`applyChange` hands it `stillOurs` — `sequences.isNewest(document, route.sequence)` — which is the same
closure its own fenced writer asks. **Where TypeScript cannot force this**: `owns` is a `() => boolean`,
so a caller passing `() => true` compiles, and both the interface's JSDoc and the host member's say so
in the sentence that describes what the parameter does force.

**The pinning case, and where it had to live.** Not in `workspace.test.ts`: there the host member is the
module's own closure, `creatorEligibility` reads only owned rows and re-enters nothing, and a batch is
applied in sequence order — so a higher-sequence `Unreadable` applied first would make `admit` refuse
the `Changed` before this path is reached, and the production window is unreachable by construction.
The case is at the seam, `observationTransitions.test.ts` — *hands the reread an ownership question
that refuses after a host read* — with a hostile `creatorEligibility` that admits sequence 9 while
answering, asserting that the predicate `applyChange` hands over answers `false`.

**Confirmed against the pre-fix code** by dropping the third argument at the call site:

```
TypeError: workspace.reread[0]?.owns is not a function
```

A companion case, *asks the same question of an ordinary reread and gets a yes*, establishes that the
predicate is not one that always refuses. It fails pre-fix with the same `TypeError`, so it is not a
case that passes both ways — but it is **not** the measurement, and the case says so.

**The host half is not separately discriminated, and §13 item 2 records that.** No case drives the
production host with a predicate that answers `false`, for the reason above: in this assembly nothing
caller-supplied runs between the arbitration and the mark.

---

## 6. M1 — the struck claim survived one wording narrower, in source

`docs/decisions/2d-5-4-notes.md` §7 item 12's 2d-5-4-B correction block struck *"the third level and
below is still the command's own object"* and replaced it with *"the **fourth** level and below … is
still the command's own object, and **nothing this module reads after a guard goes that deep**"*. The
replacement is false, and `ownedRepair`'s header in `src/lib/browser/workspace.svelte.ts` carried
the same claim in **source** — lines 709-712 of the pre-fix tree `f3ba2cd^`, which this round's own
fix rewrote, so that number names an unrelated paragraph at HEAD:

> *"{@link SelectedMatch} itself is not re-made: `reresolve` built it, and its own fields are read by
> this module rather than by a command. Its `id` is the command's object, exactly as {@link
> ownedProjectionOf} says of every value one level down."*

Two things wrong with it, not one. It states the defect §2 fixes as a *property* — the identity **is**
the command's object, and a guard **does** read it. And it **misattributes the rule it cites**:
`ownedMatchOf`'s own header, twenty lines above, says *"**`id` is the one exception**, through
`ownedMatchIdOf`, because it is the only one of those values whose own properties this module reads
after a guard"*. The two headers contradicted each other in one file, and the wrong one guarded the
ingress finding 1 is about.

**Fixed in all three places**: the header now says the kept selection *is* re-made and why, the
correction block in `2d-5-4-notes.md` is struck and replaced, and `2d-5-4-B-notes.md` §3 and §7 carry
correction blocks of their own.

**The sweep was by shape, not by the wording.** Every writer of `selected` and every producer of a
`SelectedMatch` was enumerated (§7), and every occurrence of *"level"*, *"deeper"* and *"the command's
own object"* in `src/`, `docs/` and the two root records was read. Two source comments survived the
sweep because they are true: `ownedProjectionOf`'s *anything deeper* list, which is about a projection
and not about a retained identity, and the private `rereadUnderGuard`'s *two levels deep plus each
match's `id`*, which describes what that function installs. `docs/decisions/2d-5-4-A-notes.md:79-81`
says *"two levels"*; it reads as a statement of what that round did, so it is annotated in place
rather than struck.

---

## 7. M2 — `selected` has exactly one unnormalized ingress, and it is finding 1's

Re-derived here before being recorded, by sweeping every writer of `selected` rather than by trusting
the table: `replaceSelection` and the two documented direct assignments are the only writes, and every
non-null value reaching them comes from one of five producers.

| Writer | Where the identity comes from | Owned? |
|---|---|---|
| `select()`'s direct assignment | `selectMatch(viewOf(...), position)` — a held, installed view | ✓ |
| `applyRepair`'s `kept` arm | `reresolve(…, reloaded.value)` — **the command's answer** | ✗ — finding 1 |
| the three adoptions after a move, a create and a duplicate | `selectMatch(next, …)`, `next = ownedProjectionOf(...)` | ✓ |
| `adoptAfterTheDeletion` | `selectMatch(next, at)`, same `next` | ✓ |
| `adoptTheReplacedDocument` | `reresolve(held, next)`, `next` owned one statement above | ✓ |
| `repairAfter` | `reresolve(selected, view)`; all six callers pass an owned view — the guarded reread's `next`, `adoptDiskVersion`'s `disk`, and the four adoptions' | ✓ |
| `removeDocumentFromWindow`, `forgetTheReplacedDocument`, `open()` | `null` | ✓ |

So the fix is one function and needs no audit of a second site. **One producer the re-derivation's own
table omitted** — `adoptAfterTheDeletion` — was found by this sweep and is owned, which is the argument
for sweeping rather than copying a table.

---

## 8. M4 and M5 — every status writer in `observationTransitions.ts`, decided on the code

The re-derivation nominated five more unfenced status writes. Each was decided against the code, not
against the finding's wording, and **four of the five are genuine defects of finding 4's shape and are
fixed**. §7.3 forbids carrying an actionable item that names a correctness defect in a source file, so
none of them is deferred.

| Write | Check before it | What runs in between | Decision |
|---|---|---|---|
| `applyAddition`'s `unavailable` | `admit` | `workspace.addDocument()`, plus the spread and `in` on wire data | **fixed** — the wire reads are hoisted **above** `admit`, and the write asks `isNewest` |
| `applyChange`'s `unavailable` | `admit` | `'Unreadable' in route.content` (a `has` on a wire value) and `route.content.Unreadable.reason` | **fixed** — the reason is read first, then written through the function's fenced writer |
| `applyRemoval`'s `removed` | `admit` | `workspace.removeDocument()` | **fixed** — the removal stays unconditional, the status write asks `isNewest` |
| `applyNamedRow`'s three writes | `admit` | `session.requestMembershipReload()`, `workspace.holdsDocument()`, and `workspace.removeDocument()` on one arm | **fixed** — one fenced writer of its own, used by all three arms |
| `applyUnreadable`'s `unavailable` | `admit` | **nothing** | **not fixed**, and the justification is a statement about the code: no statement stands between the two lines, and both values the write reads — `route.document` and `route.reason` — are own data properties of the literal `routeObservation` built **before** the arbitration, so reading them fires nothing. The JSDoc now says that, and says that a statement inserted between the two lines would end it with nothing objecting |

**M5 — `ownedSummaryOf`'s second ingress.** `addDocument`'s copy is for `documents`' *readers*; it does
nothing for the window between `applyAddition`'s `admit` and the host's `documents = …`, because the
caller-code statement in that window is the **spread of the wire summary at the call site**, not the
copy. Fixed at the cause: `applyAddition` materializes the row and the unreadable reason **before**
`admit`, so an accessor that admits something newer makes `admit` itself refuse and nothing is
inserted. The cost is that a superseded addition reads them too. `addDocument`'s own comment now says
that this is a fact about its one caller and that nothing in its type binds the next one.

**Where 2d-5-4-B's record was wrong about one of these.** §11 item 8 justified leaving the
`applyChange` `Unreadable` write alone because *"nothing is checked before it that the read could
invalidate: it is the first write of that arm."* `sequences.admit` **is** checked before it — it is the
function's first statement — and *the first write of an arm* is not *the first statement after a
check*. That file now carries a correction block saying so.

**The pinning cases**, all in `observationTransitions.test.ts`, each confirmed by restoring the one
write and running the suite:

| Fix | Case | Pre-fix message |
|---|---|---|
| `applyChange`'s `unavailable` | *writes no unavailable when the content read admitted a newer observation* | `AssertionError: expected [ { document: 1, status: { …(2) } } ] to deeply equal []` |
| `applyRemoval` | *writes no removed status when the host removal admitted a newer observation* | `AssertionError: expected [ { document: 1, status: { …(1) } } ] to deeply equal []` |
| `applyAddition` + M5 | *refuses the addition when the summary's own getter admitted a newer removal* | `AssertionError: expected 'added' to be 'superseded' // Object.is equality` |
| `applyNamedRow` | *writes no status when the host row question admitted a newer observation* | `AssertionError: expected [ { document: 9, status: { …(1) } } ] to deeply equal []` |

---

## 9. M3 — four passages argued the restatement was harmless, and each is true of the value

`workspace.svelte.ts`'s member JSDoc, `2d-5-4-A-notes.md` §3 and §7 item 4, and `2d-5-4-B-notes.md` §10
and §11 item 5 all reason from *the value cannot change* to *the write is safe*, and two of them go
further and say no test could tell the permitted write from no write. The inference fails at one step:
`noteDocumentStatus` bumps the ownership token whether or not a value changes, and that token is what
the clear compares. A case asserting the **value** after one read cannot see it; a case with a
**second, overlapping** read in it discriminates on a value immediately. **These records are the reason
the defect was invisible for three rounds** — they argued, correctly, that one kind of test could not
see it, and concluded there was nothing to see.

All four are corrected: the source JSDoc is rewritten with the arm it described, and the three record
passages carry marked correction blocks that strike the false step and keep the true one.

---

## 10. A case this round had to re-point rather than keep

Deleting finding 2's arm deleted the thing 2d-5-4-B's fix-4 case was written to measure — *reads no
summary of its own between the failure arm's checks and its write*. Left alone it would have gone on
passing while measuring the absence of a code path rather than the ownership of a row, which is the
quietest way to lose coverage.

It is re-pointed at the reader `ownedSummaryOf`'s header names first and which is still there:
`creatorEligibility` walks `documents` **inside the coordinator's guard**, between the arbitration that
admitted an observation and the `stale` that observation writes. The case now arms its trap after the
load and wakes the batch, and it is **re-confirmed to discriminate** by removing `ownedSummaryOf` from
the `open()` ingress:

```
AssertionError: expected 2 to be +0 // Object.is equality
AssertionError: expected 4 to be 3 // Object.is equality
```

— the second being the file's own `afterEach` drain assertion catching the extra drain the second
workspace the trap opened caused.

`ownedSummaryOf`'s header is corrected with it: the failure arm's membership test is named as a reader
that is **gone** rather than as one that is answered, and `holdsDocument` — which runs between
`applyNamedRow`'s `admit` and every status write below it — is named in its place.

---

## 11. What this round deliberately did not do

- **No `cargo` command of any kind was run.** No Rust file was touched and `cargo test --workspace` is
  flaky on this host; the orchestrator runs the Rust gates.
- **No user-facing string was added or changed.** `src/lib/i18n/{en,es}.json` are untouched, so no
  dictionary parity work and no window reading is owed by this round.
- **No `.svelte` file was modified**, so no window reading is owed on that ground either. What this
  round changed — when a file is marked stale, and which of two overlapping truths owns that mark — is
  what 2d-6 draws, and that reading is the first evidence any of it is right on a screen.
- **The four instrument paths were not touched.** `src-tauri/src/probe.rs`, `src/probe.ts` and the two
  hook lines in `src-tauri/src/main.rs` and `src/main.ts` are a window-reading instrument belonging to
  another thread of work; `git diff --stat` over the two hook files still reads
  `5 insertions(+), 1 deletion(-)`.
- **`statusWriteOf` and the `statusWrites` map are kept.** Only one arm asks the question now — the
  clear at the end of the private `rereadUnderGuard` — and that arm is 2d-5-4-B's finding 3, which this
  round did not reopen.
- **§7.1 commissions a further round.** This fix changed four source files —
  `src/lib/browser/workspace.svelte.ts`, `src/lib/browser/observationTransitions.ts` and the two
  suites — so a round is owed, scoped to that change. It is not owed because of the severities and it
  is not owed because of the count; it is owed because the diff touched source.

---

## 12. The gates

**The four gate figures are `TBD (the orchestrator measures these)`** — `cargo test --workspace`,
`npm run check` files, `npm test` and `npm run build` modules. Everything below is what **this round**
measured while working, and is evidence about the fix rather than the gate.

**Every source fix was confirmed against the pre-fix code** by reverting that one change in the tree,
running the one suite, recording the message and restoring it. Nine cases over the eight source fixes,
plus one re-pointed case re-confirmed against a different baseline:

| Fix | The case | What it said before the fix |
|---|---|---|
| 1 | `workspace.test.ts` — *keeps no command identity when a repair keeps the selection* | `expected { Object (document, revision, ...) } not to be { Object (document, revision, ...) }`; and with that assertion removed, `expected 1 to be +0` |
| 2 | `workspace.test.ts` — *lets a newer successful reread clear a mark an older failure cannot hold* | `expected { kind: 'stale' } to be null` |
| 3 | `workspace.test.ts` — *publishes no row when a summary's own getter opens another workspace* | `expected [ { id: 1, …(6) }, …(2) ] to deeply equal []`; and with that assertion removed, `expected "vi.fn()" to not be called at all, but actually been called 1 times` |
| 4 | `observationTransitions.test.ts` — *hands the reread an ownership question that refuses after a host read* | `TypeError: workspace.reread[0]?.owns is not a function` |
| M4 `applyChange` | `observationTransitions.test.ts` — *writes no unavailable when the content read admitted a newer observation* | `expected [ { document: 1, status: { …(2) } } ] to deeply equal []` |
| M4 `applyRemoval` | `observationTransitions.test.ts` — *writes no removed status when the host removal admitted a newer observation* | `expected [ { document: 1, status: { …(1) } } ] to deeply equal []` |
| M4 + M5 `applyAddition` | `observationTransitions.test.ts` — *refuses the addition when the summary's own getter admitted a newer removal* | `expected 'added' to be 'superseded'` |
| M4 `applyNamedRow` | `observationTransitions.test.ts` — *writes no status when the host row question admitted a newer observation* | `expected [ { document: 9, status: { …(1) } } ] to deeply equal []` |
| (re-pointed) | `workspace.test.ts` — *reads no summary of its own inside the coordinator's guard* | against a tree with `ownedSummaryOf` removed from the `open()` ingress: `expected 2 to be +0`, and the drain assertion `expected 4 to be 3` |

**Nine new cases net**, six in `observationTransitions.test.ts` and three in `workspace.test.ts`; one
existing case was re-pointed (§10), and one other — *keeps a newer removal over an older reread that
came back a failure* — had two comment blocks corrected, because the fence they described is gone while
the outcome they assert still holds.

**Non-discriminating assertions, named where they stand.** Each is stated in the case itself so no
reader mistakes it for the measurement: finding 1's `expect(state.notice).toBe('kept')` and finding 3's
`expect(sprung).toBe(true)` / `expect(opens).toBe(2)`, which establish that the arm really ran and the
trap really fired; and finding 4's companion *asks the same question of an ordinary reread and gets a
yes*, which establishes that the predicate is not one that always refuses.

**A candidate discarded because it passes both ways, and it was measured rather than reasoned.** The
re-derivation's recipe for finding 2 settles the two overlapping reads in the order *newer first, older
failure second*. Written that way, the case was run against the pre-fix tree and **passed**, and
against the fixed tree and **passed**: in that order the newer read's clear has already bumped the
token, so the older failure's second fence refuses and nothing is written either way. The order that
discriminates is the one the re-derivation's own failure sequence gives — **older failure first** — and
that is the case that shipped. The inverted variant is discarded.

**What the fix round ran, post-fix, as a working check and not as the gate:** `npx vitest run
src/lib/browser/workspace.test.ts src/lib/browser/observationTransitions.test.ts` → **275 passed**,
exit 0 (224 + 51); `npx vitest run` → **2404 passed in 61 files**, exit 0, which is 2395 plus the nine
cases above; `npm run check` → **443 files, 0 errors, 0 warnings**, exit 0; `npm run build` → **189
modules transformed**, exit 0. The module count is unchanged because this round added no source module,
which is the shape `CLAUDE.md` asks for rather than the number alone; the bundle oracle was read both
ways, `$$payload|head_payload|push_element` absent and `window.__svelte|svelte-trusted-html` present
twice.

---

## 13. Where it is thin

Every item carries one of §7.3's two marks. **No item commissions a round** — §7.1 is the only
mechanism and it reads a diff — and **no item below names an unfixed correctness defect in a source
file**, so none holds this step open.

1. **recorded only** — the normalization invariant now spans the projection copy, the identity copy,
   the summary copy and the kept-selection copy, and **no type expresses any of it**. This round added
   the **twelfth** ingress to the list rather than removing the need for one, which is 2d-5-4-B §11
   item 1 widened again. The sentence worth carrying is that the risk is a *list of ingresses*, not a
   depth: the depth claim is now true, and a thirteenth ingress added later would not fail to compile.
2. **recorded only** — finding 4's fix has two halves and only one is discriminated. The seam case
   pins that `applyChange` hands over a question that refuses; **nothing pins that the host consults
   it**, because in this assembly nothing caller-supplied runs between the arbitration and the mark, so
   the production window is unreachable from `workspace.test.ts` by construction. A future edit that
   ignored `owns` in the host would pass every case in the tree. This is a coverage bound and it names
   no defect in a source file.
3. **actionable** — `owns` is a `() => boolean` and nothing makes it a question about ownership. The
   check that bites is the same one the ingress list needs: read the call site. `applyChange` is the
   only caller today.
4. **recorded only** — `applyUnreadable`'s write is the one status write in
   `observationTransitions.ts` with no fence, and its justification is positional in the narrowest
   sense: no statement stands between the check and the write. That is true of today's two lines and a
   statement inserted between them would end it silently. §8 records the argument in the source JSDoc
   so that the next reader meets it there rather than deriving it again.
5. **recorded only** — the member's answer is now discarded by `void`, which is the shape 2d-5-4's
   finding 4 was about. What makes it safe is that the failure is consumed **inside** the private
   helper, by `report`, and recorded by the mark written before the read — neither of which the member's
   type expresses. The JSDoc says so in the same paragraph that says the answer is not handled there.
6. **recorded only** — `applyChange` and `applyNamedRow` now carry a fenced writer each, and
   `applyAddition` and `applyRemoval` ask `isNewest` inline because each has exactly one write. Four
   spellings of one rule, and `noteDocumentStatus` is still on the `ReconciliationWorkspace` interface,
   so a fifth writer can be added beside them rather than through them. The single-writer property is a
   convention in each function, not a type across the module — which is what the source comment now
   says instead of claiming the module has one.
7. **recorded only** — this round changed no `.svelte` file and takes no window reading, but what it
   changed — which of two overlapping truths owns a file's mark — is what 2d-6 draws. The first reading
   that draws it is the first evidence any of it is right on a screen.
8. **recorded only** — the four findings and the five things the review missed are all one question
   asked in nine places: *does the statement that writes still own what it is writing, after everything
   that ran since the check?* Three consecutive rounds have now found instances of it, each in a
   neighbour of the last one fixed. The remaining neighbours nobody has swept are the **other** injected
   boundaries: `reconciliationCoordinator.ts`'s own cursor writes, and every `$state` assignment in
   `workspace.svelte.ts` that follows a `commands.*` await. Neither is named here as a defect, because
   neither was derived.
