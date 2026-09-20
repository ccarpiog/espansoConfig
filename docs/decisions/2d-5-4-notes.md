# Phase 2d-5-4 — the observation state transitions

**Status: delivered; review round 1 taken, and its five findings are fixed** (section 8). Risk class:
medium-high. Components: **none** — no `.svelte` file was modified, so no window reading is owed.

This is step 4 of the seven-step split in
[`docs/decisions/2d-5-split-notes.md`](2d-5-split-notes.md) §2, ruled by
[`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md) Q2, Q3, Q5 and Q8. It
delivers the per-document accepted-sequence map, the guarded reread, the `Added` / `Removed` /
`Unreadable` arms, the selected-document removal transition, `Addressable`-only command routing and
the discarded-history recovery that re-runs the coordinator's retained original open request.

**What changed about the shipped application: nothing.** No production caller invokes
`BrowserState.start()`, both injected sources still default to the inert ones, and no production
module imports `src/lib/ipc/events.ts`. 2d-5-7 is what makes any of this reachable. So although this
module now *changes* a window when it runs, no shipped window runs it — which is the same bound
2d-5-3 recorded and the reason this step's evidence is entirely model and workspace tests.

---

## 1. What was built, and where

| File | What it is |
|---|---|
| `src/lib/browser/observationTransitions.ts` | **new** — the routing boundary, the accepted-sequence map, the workspace host interface and all eleven transition arms. Plain TypeScript, no Svelte runes |
| `src/lib/browser/observationTransitions.test.ts` | **new** — **40** model cases over a recording workspace (38 before round 1) |
| `src/lib/browser/reconciliationCoordinator.ts` | modified — `ReconciliationHost extends ReconciliationWorkspace`, `workspaceOpened(request)`, the `discarded` recovery and its blocked state, four new accessors, `accept()` rewritten |
| `src/lib/browser/reconciliationCoordinator.test.ts` | modified — the controlled host grew the workspace half and now retains each reread's guard; **56** cases, 40 before this step and 54 before round 1 |
| `src/lib/browser/workspace.svelte.ts` | modified — the host implementation, `rereadUnderGuard`, `addDocument`, `removeDocumentFromWindow`, the two new `$state` records and four `BrowserState` members |
| `src/lib/browser/workspace.test.ts` | modified — **211** cases, 196 before this step and 208 before round 1 |
| `src/lib/browser/conflictSource.ts` | modified — **comments only**; three sentences that named 2d-5-4 as future work |
| `src/lib/browser/writeSurfaceRegistry.ts` | modified — **comments only**; three passages, including the one that said no stored transition had ever been called |

**No Rust file changed, so no cargo gate was run** — see §6. No `.svelte` file, no configuration
file, no dictionary, no i18n key.

### 1.1 The module-placement decision

`2d-5-split-notes.md` §6 item 2 leaves *where the coordinator lives* to the steps.
`src/lib/browser/observationTransitions.ts` is a new module beside `reconciliationCoordinator.ts`
rather than lines inside it or inside `workspace.svelte.ts`, for three reasons in decreasing order
of force:

1. **`workspace.svelte.ts` was 4 083 lines when this step began**, and it gained 240 even so — the
   host implementation, the removal transition and the guarded-reread extraction all have to live
   where `views`, `documents` and `selected` live. Putting the routing table there as well would
   have added roughly another 700.
2. **`reconciliationCoordinator.ts` was 1 227 lines** and is about *when a drain fires*. What an
   observation does to a document is a different subject with a different test file, and 2d-5-5 adds
   more of both.
3. **A module with no runes in it is drivable by a model test with nothing mounted**, which is what
   let the thirteen Q8 cells be driven directly rather than through a `BrowserState`.

The division of labour that fell out: the **coordinator** owns the session — the cursor, the
`discarded` recovery, the blocked state, the retained open request and the accepted-sequence map's
lifetime — and the **transitions module** owns one observation. The coordinator holds the map
because `workspaceOpened()` has to clear it; the module holds the rules that read it.

---

## 2. The four rulings this step was handed, answered

### 2.1 *May refresh automatically* stays a permission (§5 corrections row 4)

`2d-5-split-notes.md` §3 entry 20 originally restated the consult's *the raw viewer **may** refresh
automatically* as *refreshes automatically*; the correction handed the freedom to this step.

**This step exercises the permission and does not promote it.** The clean path delegates to the
reread machinery, and that machinery has dropped the viewer's snapshot and read it again since
2c-1b — `forgetFileText()` then `installView()` then `readFileText()`. So a document reloaded under
an open raw **viewer** does refresh, as a *consequence* of the ruling 17 delegation rather than as a
rule this step wrote. Nothing in the code says "the viewer must refresh", no test asserts that it
must, and a later step that stopped it would contradict no sentence here. The other half of entry 20
is a requirement and is implemented as one: the raw **editor** is a registered write surface, so
`targetingSurfaceFor` answers it and the file takes the conflict path even when the editor is
pristine.

### 2.2 The blocked state's exit (§6 item 4)

The consult permits the whole reload *"after the surfaces are closed or their retained values have
been explicitly dealt with"* and types neither half. This step's answer, in
`ReconciliationBlock`'s own doc comment:

- **The second half is not observable and no attempt is made to observe it.** *Their retained values
  have been explicitly dealt with* is a fact about a draft inside a component's own session, and R36
  says no coordinator can see it: `isDirty` is derived inside `MatchEditor.svelte`'s session.
  Inventing a predicate for it would be this project's named worst defect class.
- **The first half is observable, and only as *is the registry empty*.** That is weaker than *no
  surface is open* — nothing forces a component to register — and it is
  `competingSurfaceFor`'s standing limitation inherited whole.
- **Closing the last surface *permits* the reload; it does not *trigger* it.** Nothing in this
  application observes the registry emptying: a lease's unregister moves a counter and calls nobody.
  So the permission is re-evaluated at the **next accepted batch**, which is an event that already
  exists — a wake, a foreground signal or an open. `workspace.test.ts`'s *takes the permitted reload
  at the next batch once the surface closes* drives exactly that: the lease is released, nothing
  happens, a wake arrives, and `open_workspace` is called a second time with the retained request.

**What that costs, said rather than glossed: a window that receives no further trigger stays
blocked forever.** The blocked state is visible on `BrowserState.reconciliationBlock()` and nothing
draws it; 2d-6 is where a person gets a control that asks. That is a coverage gap in the UI rather
than a defect in this step, and it is §7 item 1.

### 2.3 Nothing bounds how many observations a blocked coordinator drops (§6 item 5)

**Restated rather than fixed, because fixing it is not available.** The watermark advances while
blocked (ruling 13), so the retained queue is not fetched again, so every observation of that epoch
after the loss is gone. `observationsDropped()` counts them — and a count is a **measurement, not a
bound**. What makes the dropping safe is the whole-reload obligation alone: incremental
reconciliation does not resume until a successful whole open establishes a new epoch, and **no type
in this repository expresses that dependency.** Both `ReconciliationBlock`'s doc comment and
`observationsDropped()`'s say so in the same sentence as what they do promise.

The one thing this step added on top of the consult is that `observationsDropped()` now counts
**only** the blocked drops. An observation refused by the accepted-sequence map is not a loss — it
is arbitration — so it is recorded as `superseded` on `observationOutcomes()` instead. Conflating
the two would have made the number that measures the unbounded thing unreadable.

### 2.4 The `not watched` state has no dictionary keys, and this step names nothing on screen (§6 item 6)

**No user-facing string was added by this step, in any language.** `ExternalDocumentStatus`,
`ExternalPathDrift`, `ObservationDetail` and `ReconciliationBlock` are all codes; `src/lib/i18n/en.json`
and `es.json` are byte-identical to what they were. 2d-6 draws the `notWatched` arm and these four
types together, and owes their EN/ES entries and their accessor in `src/lib/i18n/codes.ts` at that
point. Nothing here builds a key, because nothing here renders anything.

The one existing user-facing string this step *reuses* is `browser.notice.gone` — see §3.4.

---

## 3. The decisions, and why

### 3.1 `ReconciliationHost` extends `ReconciliationWorkspace`, rather than a fourth parameter

The alternative was `createReconciliationCoordinator(host, events?, foreground?, workspace?)` with an
inert default, matching how `events` and `foreground` are injected. It was rejected: an inert default
lets `createBrowserState` forget to pass one and go on compiling, and **a coordinator that silently
applies nothing is the exact failure this step exists to end**. A required member is a compile error
at every construction site — which is what it was, in the two places that build a host.

What that costs is a fourteen-member interface. The cost is accepted because every member is
something the coordinator genuinely cannot see for itself, and because of the second property: **no
member of `ReconciliationWorkspace` writes a file, and there is deliberately none that could.**
Ruling 27 forbids watcher arbitration initiating a save command, and the narrowest way to say so is
to hand the module a surface that has no writing command on it — the same argument
`ReconciliationHost` already made for taking a `drain` rather than the whole `BrowserCommands`.

### 3.2 Two sequence states, and their disagreement is not a bug

`createAcceptedSequences()` is a `Map<DocumentId, number>` behind four methods. It is **not** part of
`ReconciliationCursor` and never will be (ruling 6). `reconciliationCoordinator.test.ts`'s *disagrees
with the watermark, which is not a bug* pins one legitimate disagreement — a batch whose
`newest_sequence` is above every observation in it — and `ReconciliationCursor`'s doc comment names
two more: an empty batch advances the watermark while no accepted sequence moves, and a batch
dropped while blocked advances it past observations no document ever accepted.

**`admit()` is a check and a record in one call**, deliberately. `CLAUDE.md` names a check and a
spend separated by any property read as this project's repeated defect: a property read runs
arbitrary code through a getter or a proxy trap, so `if (sequence > sequenceFor(d))` followed by a
write is not atomic in a way any type expresses. `isNewest()` exists separately because the guard has
to ask the question **without** moving anything, possibly more than once.

**Strictly greater, never greater-or-equal.** Two observations of one file under one sequence would
be one observation delivered twice, and applying the second runs a transition against state the
first already moved.

**One map across the `Addressable` and `Named` arms.** This process mints one identity per path, so
the same file observed while the open workspace resolves it and after it stops resolving it is one
key. **Nothing in TypeScript says the two arms cannot collide**; what it rests on is the Rust
identity registry, and that is §7 item 5.

### 3.3 The guarded reread, and the third check nobody asked for

`BrowserState.rereadDocument`'s body moved into a private `rereadUnderGuard(document, guard)` — the
private guarded helper the consult's Q5 permits — and `rereadDocument` is now one call of it with
`ALWAYS_PERMITTED`. The three captures and their comparison are unchanged; **the one thing round 1
changed inside it** is that the command's answer is now copied into a local before the comparisons
rather than read out of `fresh` after them (the correction two paragraphs below).

> **Correction (review round 2).** The order is no longer
> forget → install → repair → re-read: it is forget → install → **clear the status** → repair →
> re-read. The clear used to live in the coordinator's guard, which reached one of this helper's two
> callers; round 2's finding 5 moved it here, where an installation is known to have happened. See
> §7 item 7 below, which it closes as a by-product.

The coordinator's guard adds five questions on top of those three — ruling 18's list less the two the
host already owns, plus the one round 1 found missing:

| Ruling 18 asks for | Where it is checked |
|---|---|
| same open generation | `rereadUnderGuard`'s own `opened` capture |
| same epoch | the guard, via `session.epochNow()` |
| still the newest accepted observation | the guard, via `sequences.isNewest` |
| projection generation unmoved | `rereadUnderGuard`'s own `projection` capture |
| registry generation unmoved | the guard, via `writeSurfaceGeneration()` |
| no open surface can target the document | the guard, via `targetingSurfaceFor` |
| *(added at round 1)* the session is still applying at all | the guard, via `session.stillApplying()`, **first** |

**The three captures are compared twice, once on each side of the guard, and the second comparison is
not belt and braces.** A guard is caller-supplied code: this one asks the registry, computes an
eligibility and — on the arm where a surface opened during the read — calls that surface's
transition, which is a component's callback. `CLAUDE.md` names a check and a spend separated by any
such read as this project's repeated defect class, so the last thing before `installView` is the
project's own comparison, and **the command's answer is materialized into a local before either
comparison is taken** so that nothing caller-controlled is read between the second one and the
install. The *pre*-guard comparison is what stops a guard being consulted about a read that is
already stale, which would let it clear a status or fire a transition for an answer nobody is going
to install.

> **Correction (review round 1).** The paragraph above originally ended *"…is the project's own
> comparison **with nothing between them**"*, and that was false of the code as delivered. After the
> final `stillCurrent()` the function ran `installView(fresh.value)` and `repairAfter(fresh.value)` —
> **two property reads on the injected command's own answer, after the last check**. `CLAUDE.md` says
> in as many words that a check and a spend separated by any property read are not atomic, because a
> property read runs arbitrary code through a getter or a proxy trap and `readonly` does not freeze at
> runtime; a `value` getter registering a write surface over the same file would therefore have had
> the guard approve an installation the registry no longer permitted, and the file would have been
> reloaded under an editor that was open by the time it landed. The fix materializes the answer once —
> `const next: DocumentView = { ...fresh.value }` — **before** the pre-guard comparison, and installs
> from the local.
>
> **What is guaranteed now, and what is not, in one sentence each.** Between the final
> `stillCurrent()` and `installView` there is no read of `fresh` and no read of a property this module
> did not write, because `installView` takes `next.id` off a plain own-property object made here. It
> is **not** a deep copy: `next.matches` is still the command's own array, so `repairAfter` — which
> runs *after* the installation — reads elements this module did not build, and a getter on one of
> those runs there; what bounds that half is `replaceSelection`'s own discipline, and no type
> expresses either half. `workspace.test.ts`'s *installs nothing when the answer's own getter opens a
> surface* is the regression test, and it was confirmed to fail against the delivered code.

> **Correction (review round 2), and it retracts both halves of the sentence above.** The paragraph
> was wrong in two ways that round 2's findings 1 and 2 each name.
>
> **It enumerated `installView`'s caller-controlled reads as `next.id` alone, and there was a second
> one.** `installView` also runs `views.findIndex((view) => view.id === next.id)` over every element
> `views` already holds — and `open()` retained what `get_document` answered, so those elements were
> objects the injected command built. That read happens *after* the final `stillCurrent()` and after
> `invalidateProjectionOf(next.id)` has already been spent, so an accessor on one of them ran between
> the check and the install. Two outcomes, both state-visible and both permanent: an install silently
> dropped with the invalidation already spent, or `next` written into a slot naming another file. The
> copy round 1 added was real and it was one level too shallow.
>
> **And `replaceSelection` does not bound the repair — that clause was simply false.**
> `replaceSelection`'s whole body is `selectGeneration += 1; selected = next;`. It bumps the intent
> counter in the same synchronous block as the write, which cancels lookups taken *earlier* and
> asynchronously; it reads nothing, compares nothing, refuses nothing, and `repairAfter` does not
> consult it about anything. Synchronous re-entry through a getter on `next.matches` — which
> `reresolve` indexes, and whose candidate's `source_text` and `id` it reads — was bounded by nothing
> at all. `CLAUDE.md` names a record claiming a guarantee the code does not give as this project's
> worst defect class; this is an instance of it written into a **source** file's JSDoc and copied
> here, one round after the round that introduced it.
>
> **What is guaranteed now.** `ownedProjectionOf` in `workspace.svelte.ts` copies a command's answer
> field by field, and each of its matches field by field, at **every** ingress — `open()`, the
> guarded reread, all five adoptions, the projection a selection repair carries and the disk snapshot
> a conflict carries. So nothing `views` holds is an object a command built, and nothing `repairAfter`
> reads one level down is either. **What is still not guaranteed, stated as narrowly as the code
> allows:** the copy is two levels deep, so the *value* ~~of `id`,~~ of `trigger`, `content`,
> `options`, `profile` and of every array's elements is still the command's own object, and a consumer
> that walks one of those is reading caller-controlled data. The function's own header says that, and
> no type does.
>
>    > **Correction (Phase 2d-5-4-D).** `id` has not been one of those values since 2d-5-4-B:
>    > `ownedMatchOf` copies it through `ownedMatchIdOf` (`workspace.svelte.ts:545`), and that
>    > function's own header names it *the one exception* for the reason this sentence would have
>    > needed — it is the only one of those values whose own properties this module reads after a
>    > guard. Struck rather than reworded, because the claim it belongs to was struck once already and
>    > a third wording is what this chain keeps producing. The two regression cases are `workspace.test.ts`'s *installs into the slot the projection
> names, whatever a retained view says* and *repairs the selection against the projection it read, not
> a re-entrant one*, both confirmed to fail against the delivered code.

**The guard's arms are ordered, and the order carries a rule.** The surface check comes before the
bare generation check because it is the one arm that *re-arbitrates* rather than merely refusing: the
consult says *"If a surface opens during the read, the answer is not installed; re-run arbitration
against the retained observation and put the surface on its conflict path"*, and calling
`tellTheSurfaceAbout` from inside the guard is exactly that, in the same synchronous block. **And
`stillApplying` is ahead of all four**, because the arm below it fires a component's callback: a
session that may act on nothing must not raise a conflict on a surface on the strength of an
observation it is no longer entitled to act on.

> **Correction (review round 1).** The four questions above **could not ask whether the coordinator
> was still applying observations at all**, and two reachable states make that a defect rather than a
> gap. When `discarded` rises, `accept()` enters `blockedByLostHistory` and calls
> `recoverFromLostHistory()`; when that recovery is **deferred** — which is every time a write
> surface is open — the epoch, the open generation and every projection generation stay exactly where
> the in-flight read left them, so a clean reread issued before the loss passed the guard, installed,
> and its `noteDocumentStatus(document, null)` **cleared the stale mark** — telling the person the
> file was reconciled while the session was in the state that means *I cannot describe this
> workspace's membership*. The blocked state's entire safety argument is the whole-reload obligation,
> and a piecemeal install lands underneath it. The second state is disposal: `openGeneration` moves
> only in `open()`, so `dispose()` moved nothing the guard captured and a read in flight installed
> after reconciliation had been stopped.
>
> The fix is `ObservationSession.stillApplying()`, asked **first**, answered by the coordinator's own
> closure as `!disposed && block.kind !== 'blockedByLostHistory'` — on the session surface the module
> is already handed, never by reaching into the coordinator. **The refusal marks the file `stale` and
> never clears it.** What it does not cover is stated where it is declared: it is a fact about the
> coordinator and not about the window, it says nothing about a replaced workspace, a newer
> observation or an edited surface, and a recovery that *runs* answers `true` again immediately —
> what catches a read across that is the host's own open-generation capture. Four cases pin it, two
> per module, and all four were confirmed to fail against the delivered code.

**A refusal marks the file `stale`, except when a newer observation has already been admitted.** That
one is somebody else's transition to finish, and saying `stale` about it would describe a state the
window is about to leave.

**A reread that fails is observable, and it was not** — review round 1's fourth finding. The host's
`rereadUnderGuard` member fires the read and the `IpcFailure | null` it answers was **discarded**,
which `CLAUDE.md` names as a defect shape this project has already shipped twice in one phase. It
mattered on this arm in particular because the `Changed`/`Projected` transition has *already* advanced
that file's accepted sequence and the batch watermark before the read is issued: the observation will
never be delivered again, a failed read installs nothing, and nothing anywhere recorded that anything
had gone wrong — the window kept the old projection while the arbitration key said the file was
reconciled. So the file is now marked `stale` **before the read starts**, which is a true statement
for the whole time the read is out, and the only thing that clears it is the guard's success arm in
the same synchronous block as the installation; a read that comes back a failure re-states it, which
is not redundant because an overlapping reread of the same file may have cleared it in between. **It
does not retry and it does not say why** — `report` carries the failure itself, and
`ExternalDocumentStatus` is a code about this window's knowledge rather than about the engine's
refusal. `workspace.test.ts`'s *leaves the file marked stale when the guarded reread fails* is the
test, confirmed to fail against the delivered code.

> **Correction (review round 2).** *A read that comes back a failure re-states it, which is not
> redundant because an overlapping reread of the same file may have cleared it in between* — the case
> that sentence names is exactly the case where re-stating is **wrong**. An overlapping reread clears
> the mark by **installing**, so the window is showing the newest bytes on disk and this read's failure
> is the oldest thing about the file, not the newest. The same sentence stood in the JSDoc at
> `workspace.svelte.ts`'s host member. Worse, the write was unconditional: a newer `Removed`
> observation records `removed` and drops the row, a newer `Unreadable` records `unavailable` with a
> typed reason, and the late write overwrote either — permanently for the reason this whole arm
> exists, that the watermark has already advanced past the observation that carried it.
>
> The write is now fenced by three captures the host can observe: the open generation, this file's
> **status-write count** (`statusWriteOf`, bumped by `noteDocumentStatus` and by nothing else), and
> whether the window still holds a row for the file. **What the fence makes of the write, stated
> rather than implied:** a write it permits can only ever restate this arm's own mark, because an
> unchanged count means the entry there *is* that mark — so no value changes today. What it removes is
> every case where the write would have changed one, and each of those was a write over a newer truth.
> ~~It is kept rather than deleted because what the arm promises is *a failed read leaves the file
> stale while this read owns its status*, and the fence is what makes the code say that rather than *a
> failed read leaves the file stale*. Two cases pin it, both over two documents:
> `workspace.test.ts`'s *keeps a newer removal over an older reread that came back a failure* and
> *keeps an overlapping reread's installed status over an older failure*.~~
>
>    > **Correction (Phase 2d-5-4-D).** The arm is **gone**. Phase 2d-5-4-C deleted it (its finding 2):
>    > the fenced write could only ever restate this arm's own mark, so it changed no value, while the
>    > ownership token it advanced was taken away from a second overlapping read holding the same
>    > capture. A failed read now writes nothing at all, and the failure is carried by `report`, the
>    > channel every other failure of this state uses. One of the two cases named above was re-pointed
>    > rather than kept. Struck rather than reworded: `2d-5-4-A-notes.md` §7 item 4 already carries the
>    > correction for the reasoning that kept it, and a third wording of *why it is kept* would be a
>    > claim about code that no longer exists.
>
> **And the guard's own refusing arms are fenced the same way, which is round 2's finding 4.** Of the
> three that write a status, `stillApplying` and the epoch check are asked **above**
> `sequences.isNewest` — the one question that asks whether this read still owns the file — so either
> could write `stale` over a newer `unavailable` and destroy a typed reason nothing re-derives. The
> **order is unchanged** and `stillApplying` stays first, because the arm below it fires a component's
> callback and round 1's blocker 2 is why. What changed is the write: those two arms go through
> `markStaleWhileOurs`, which asks ownership at the write. ~~The two arms *below* the ownership
> question write directly, because reaching them is already the answer to it and a fence there would be
> a call no test could tell from no call.~~ **Decision order and write ownership are two different
> questions**, and treating them as one is the whole of the defect.
>
>    > **Correction (Phase 2d-5-4-D).** The struck sentence is the same positional justification this
>    > chain has twice found false, and it was struck once already at `2d-5-4-A-notes.md` §7 item 4's
>    > correction and again in source. Every arm of `applyChange`'s guard that writes now goes through
>    > `markStaleWhileOurs`, the lower two included: `tellTheSurfaceAbout` runs two host members
>    > between the ownership question and those writes, so *reaching them* stopped being an answer to
>    > it, and `observationTransitions.ts` names the *no test could tell it from no call* half false in
>    > as many words, with a case in `observationTransitions.test.ts` that refuses it. Struck rather
>    > than reworded.

### 3.4 The removal transition, and the notice it reuses

`removeDocumentFromWindow` is ruling 31's synchronous transition, and it is **not** `repairAfter`:
that repairs the selection against a supplied `DocumentView` and a removed file has none. Before any
`await` it invalidates the projection, drops the view, the row and the load failure, clears a
selection inside the file through `replaceSelection` and drops the raw viewer's snapshot.

**`browser.notice.gone` is reused rather than a new arm added**, and what it says is weaker than what
happened rather than stronger: *"The selection was cleared, because espansoConfig can no longer point
at the snippet that was selected. That is not a statement that it was removed: nothing here searched
this file for it."* Both clauses are true of a removed file. A sentence claiming the file was deleted
would be this window asserting something about a path from an observation that says only that the
watcher stopped seeing it — and it would need EN and ES keys this step has no business adding (§2.4).

**The sidebar filter is reset to *All* when it names the removed file.** That is a deliberate extra,
not required by Q8: the row it filters by is gone from the list, so nothing on screen could take the
person back out of an empty scope. `workspace.test.ts` asserts the reset through `scopedMatches`
rather than through a flag, because a scope still naming the removed file would answer `[]`.

**The write surface over a removed file is preserved and is not told.** Q8 asks for a
*removed-target/manual-recovery state*, and what this step can express is the state and not the
telling: `WriteSurfaceTransition` takes an `ExternalConflictObservation` — the narrowed
`Changed`/`Addressable`/`Projected` snapshot — so a removal cannot be delivered through it at all.
The registration stands, nothing is reloaded under it, and the file's status says `removed`. §7
item 2.

### 3.5 `Addressable`-only routing, written out three times

`routeObservation` narrows the three `ObservedDocument` arms **three separate times**, once inside
each observation arm that has one, each with its own `never` terminus. A shared helper would be
ruling 29's forbidden common identity accessor — one answering *the identity, where there is one*
collapses `Addressable` and `Named` into one answer with a `?`, and the difference between them is
that value's whole subject.

**The `Named` route's identity is called `namedDocument`.** It is a `DocumentId` and it is not an
address; naming it `document` would let a reader skimming the union mistake the two. **Nothing in
TypeScript enforces that reading** — a consumer that has narrowed to the `namedRow` arm still holds a
number it could pass anywhere — which is ruling 28's own sentence, and the negative command-spy
assertions in `workspace.test.ts` are what establish that no open-workspace document command is
reached from it.

The only open-workspace document command **`applyObservation` itself** can reach is `reload_document`,
through `rereadUnderGuard`, from the `changed`/`Addressable`/`Projected` combination alone.
`open_workspace`, `list_documents` and `get_document` are reachable only through the discarded
recovery, which passes **no observed identity** — it passes the retained open request.

> **Correction (review round 2).** The sentence above is false, and narrowing it from *the window* to
> `applyObservation` at round 1 did not make it true. `rereadUnderGuard` is a host member and not a
> command, so the claim is necessarily about commands reached **transitively** — and transitively
> there are **two**, not one. With the raw viewer open, `applyObservation` → `applyChange` →
> `rereadUnderGuard` ends, on a successful install, with the host's `readFileText()`, which sends
> `document_text` for the viewer's target; and `applyObservation` → `applyRemoval` → the host's
> `removeDocument` fires the same refresh, because a removal can take the viewer's file with it
> (`applyNamedRow`'s `removed` arm reaches it too). The viewer's snapshot is dropped one line before
> the install, so the identity comparison inside `readFileText` cannot short-circuit it: **that path
> sends `document_text` every time it installs.**
>
> **What is true, in two sentences that say which is which.** The observation arms themselves request
> exactly one document command, `reload_document`, from the `changed`/`Addressable`/`Projected`
> combination alone. The host's own viewer refresh, which any projection replacement or removal
> triggers, then sends `document_text` for the viewer's target when the viewer is open.
>
> **Ruling 28 is untouched and ruling 27 is untouched.** The identity that read is sent for is
> `fileTextTarget()`'s answer, which filters `pendingAdditions` out of the candidate list, so no
> unaddressable identity reaches a command by this route either — the route round 1 closed stays
> closed. And no save command is reachable at all, because `ReconciliationWorkspace` has none. What
> was wrong is an enumeration presented as exhaustive, in a source file's JSDoc and here.
>
> **Why no routing case could see it.** `documentCommandCounts` does compare `documentText` among its
> six reading commands, and round 1's fix made both routing baselines honest — but every case in the
> file runs with the viewer **closed**, so `readFileText` returns at its first line and
> `document_text` is never sent. `workspace.test.ts`'s *sends document_text for the viewer's file
> after an observation installs* turns the viewer on before delivering a `Changed` observation and
> counts both commands, which makes the corrected sentence load-bearing. **It is not a regression
> test**: this round changed no behaviour here, only two false sentences, so the case passes against
> the delivered code as well. What it pins is the claim, against a future edit made to match the old
> one.

> **Correction (review round 1), and it has two halves.**
>
> **The reachability claim was scoped to the wrong thing.** As written, the paragraph above said *the
> only open-workspace document command reachable from any observation*, and that was a statement about
> `applyObservation`'s call graph presented as a statement about the window. It was false of the
> window: the `Added` arm puts a summary straight into `documents`, and `documents` is not only what
> the sidebar draws — it is also the list `rawTarget` picks the raw viewer's file from, through
> `fileTextTarget()`. Selecting the invented row and switching the viewer on therefore sent
> `document_text` for an identity this step's own JSDoc concedes *"is by definition not an address the
> open workspace resolves, so `getDocument` would refuse it"*. Ruling 28 says only an explicitly
> narrowed `Addressable` arm reaches an open-workspace document command, and that was a route around
> it. The fix is a retained `pendingAdditions` list — **explicit state, never an inference from
> `loaded`**, which is a wire field about the engine and not about addressability — written in the
> same statement as the row, cleared by `open()` because that is what makes identities addressable
> again, and dropped by the removal transition. `fileTextTarget()` hands `rawTarget` the addressable
> subset, so the row is still drawn as *not read yet* and is simply never a target. **Nothing in
> TypeScript makes the two assignments one**: a future arm that wrote `documents` without writing that
> list would reopen the route, and only the negative command-spy case would notice.
>
> **And the evidence sentence overclaimed.** *The negative command-spy assertions … are what establish
> it* was true of the intent and not of the assertions: both of them captured their baselines **after**
> `state.start()`, `state.open(null)` and the `settleDrains()` that had already processed the
> observation batch, so an erroneous `get_document` or `open_workspace` issued *while the observations
> were being applied* was already inside the baseline and `toBe(baseline)` could not fail. Both cases
> now take their baseline before the batch is fetched and deliver it through a controlled wake, and
> both compare **all six** reading commands rather than two. That the correction discriminates was
> measured rather than argued: an erroneous `get_document` injected into the `Named` arm's path passes
> under the old placement and fails under the new one.

### 3.6 `Named` and `Unnamed` request a membership reload and nothing performs one

Q8 says these arms produce *"state-only transitions, notices, or a deferred whole-workspace refresh"*.
This step raises `membershipReloadWanted` and **acts on it nowhere**, deliberately:

- the only whole reload this application has is `open()`, which reallocates every identity in the
  window, and ruling 12 forbids running it while any surface is open;
- performing it automatically would mean replacing the person's whole window because an unrelated
  file appeared beside the configuration;
- *request* is what the consult's own wording says, twice.

So it is a flag, cleared by `workspaceOpened()`, read by 2d-6. §7 item 3.

**`unreadable`/`Unnamed` requests nothing**, and that asymmetry is Q8's: a path this application
cannot read says nothing about which files the workspace holds.

### 3.7 `Added` forces `loaded: false` rather than trusting the wire

Ruling 30 says the row is inserted *with `loaded: false`*. The wire promises it — `types.ts`: *"Its
`loaded` is `false`, and truthfully"* — and `applyAddition` writes `{ ...summary, loaded: false }`
anyway, so the ruling stays true of a wire that changed. `observationTransitions.test.ts` drives an
addition whose wire value claims `loaded: true` and asserts the row is inserted with `false`.

The supplied projection is **dropped**: nothing goes into `views` and `getDocument` is not called,
which `workspace.test.ts` asserts by counting every reading command across the batch.

> **Correction (review round 1).** The sentence above originally said *which `workspace.test.ts`
> asserts by counting `get_document` calls across the batch*, and that count was taken after the batch
> had already been applied — so it was a comparison of a number with itself (see section 3.5's second
> half). It now counts all six reading commands, from a baseline taken before a controlled wake
> delivers the addition. Separately, *nothing goes into `views`* was true and was not the whole story:
> the row still entered `documents`, which made the identity reachable as a raw-viewer target until
> `pendingAdditions` was added.

### 3.8 The two new records on `BrowserState`, and why one is deduplicated by path

`externalStatuses` is at most one entry per document, replaced rather than appended, and `null`
clears it. `pathDrift` is **keyed by the lossy display path and deduplicated by it**, latest wins —
and that is the only bound there is. An `Unnamed` observation carries no identity, so the
accepted-sequence map cannot arbitrate one, and a watcher flapping on one path would otherwise append
without limit. **It bounds paths, not observations**: one file flapping records one entry, a thousand
unnamed paths record a thousand.

Both are `$state` arrays rather than `Map`s, because a `Map` in `$state` is not reactive without
Svelte's own wrapper and 2d-6 draws them. Both are cleared by `open()`, for `projectionGenerations`'
reason: ~~a status is keyed by an identity the load is about to reallocate~~ — **struck at 2d-5-4-E,
and it is an instance of the false identity claim rather than a quotation of one**. `open()`
reallocates nothing: `Workspace::from_tree` in `crates/espansoconfig-core/src/workspace/mod.rs` takes
identities from the **session's path table**, `identity_of` returns the existing entry for a known
path, and `identity_already_issued`'s doc says the same path answers the same number for as long as
the process runs, a recreation at that path included. The true reason is the one the source comment
now carries at `src/lib/browser/workspace.svelte.ts`, inside `open()`: a status is what the watcher
said about a file **while the closed workspace was open**, and a path drift is a statement about
which files *that* workspace held — so both describe a lifecycle that is ending, whatever the
identities do.

`reconciliationBlock()` and `membershipReloadWanted()` are **not** mirrored into signals. Nothing
draws them at this step, and a mirror added before there is a consumer would be a second copy of the
coordinator's answer that `workspace.svelte.ts` would have to keep in step. 2d-6 takes that decision
the way `surfaceGeneration` was taken.

---

## 4. Where TypeScript cannot force what the code intends

Each of these is stated in the source, in the same sentence as what *is* forced.

1. **Nothing forces a host to announce its open.** `recoverFromLostHistory` fires
   `host.reopenWorkspace(request)` and writes nothing after it, because a production `open()` calls
   `workspaceOpened()` in its first statements and clears the cursor synchronously. A host that did
   not announce would leave the session comparing a new lifecycle's batches against an old epoch —
   and the coordinator's own test host is exactly such a host, which is why the recovery's *effect*
   is asserted in `workspace.test.ts` and only the *decision* in the coordinator's suite.
2. **Nothing forces a host to pass the argument its own `open()` was called with** to
   `workspaceOpened(request)`. A host that passed something else would make the recovery open a
   workspace nobody asked for.
3. **Nothing forces the guard and `installView` to stay one synchronous block.** The host owns that
   ordering and no type expresses it; §3.3's double comparison is the defence, and only
   `observationTransitions.test.ts`'s guard cases would notice an edit that separated them. **Nor
   does anything force the install's operands to be values this module built** — round 1's first
   finding. The copy taken before the comparisons is what removes the top-level trap; `DocumentView`
   is an interface of `readonly` fields and `readonly` freezes nothing at runtime, so a nested getter
   reached by `repairAfter` *after* the install still runs the command's own code, and only
   `replaceSelection`'s discipline bounds that.
4. **Nothing forces a component to register a surface.** An unregistered surface is invisible to
   `targetingSurfaceFor` *and* to the discarded recovery's empty-registry test, so it would be
   reloaded under and reopened under. That is `competingSurfaceFor`'s standing limitation, and this
   step is the sharpest place in the application where it costs something.
5. **Nothing in `ReconciliationWorkspace` reports whether it did anything.** Every member answers
   `void`, so `observationOutcomes()` records which arm ran and never what it achieved. A host whose
   `removeDocument` is a no-op produces identical outcomes to one that removes the file — which is
   why every claim about a window is asserted in `workspace.test.ts` against the real one.
6. **`ObservationOutcome` is a record for tests and is not a protocol.** Nothing in production reads
   one.
7. **Nothing forces a row to enter `documents` together with its pending mark** — round 1's third
   finding. `pendingAdditions` is what keeps an invented identity out of `rawTarget`'s candidates, and
   it is written in `addDocument`'s own body; a future arm that assigned `documents` elsewhere would
   put an unaddressable identity back into a command target, and only the negative command-spy cases
   in `workspace.test.ts` would notice.
8. **Nothing forces the guard's `stillApplying` answer to come from the coordinator that owns the
   block** — round 1's second finding. The member is on `ObservationSession`, so any caller can supply
   one; what ties the refusal to the blocked state and to disposal is that the only producer in
   production is the same closure that owns `block` and `disposed`.

---

## 5. What this step deliberately does not do

- **It generalizes no conflict.** A surface is *told* through the transition the registry holds, and
  every registered transition in production is still the no-op `DetailPane.svelte` supplies. The six
  existing `rememberTheConflict` registrations, `ConflictSource` on `ConflictModel`, the reapply
  evidence, the same-revision coalescing and the per-document in-flight-write barrier are all
  **2d-5-5's**.
- **It draws nothing.** No `.svelte` file was modified and no dictionary key was added.
- **It performs no membership reload** (§3.6).
- **It does not close the drain-guard escape.** `workspace.test.ts` still has no
  `@tauri-apps/api/core` spy; that is 2d-5-6's, unchanged.
- **It reaches nothing in the shipped window** — no production caller invokes `start()`.

---

## 6. The gates

Measured on this tree, after the last edit, in this order.

| Gate | Result |
|---|---|
| `npm run check` | **443 files, 0 errors, 0 warnings** (442 before this step: +1 for `observationTransitions.test.ts`; `.ts` sources are counted by `svelte-check` and `observationTransitions.ts` was already among the 442 by the time the count was first taken — see below) |
| `npm test` | **2380 tests in 61 files, all passed** (2373 before review round 1) |
| `npm run build` | **189 modules**, baseline **188** |
| `cargo …` | **not run, and none is owed** — no file under `crates/` or `src-tauri/` was modified |

**Re-measured after review round 1's fixes, and only one figure moved.** `npm run check` is still
**443 files** and the build is still **189 modules** — round 1 added no file and no reachable module,
only `pendingAdditions` and one member on an existing interface. `npm test` moved from 2373 to
**2380**: +2 in `observationTransitions.test.ts` (40), +2 in `reconciliationCoordinator.test.ts` (56)
and +3 in `workspace.test.ts` (211), with the two rewritten routing cases replacing themselves rather
than adding. Both halves of the bundle oracle were re-run and answered as below.

**The 443 is measured; the 441 below it is inferred and is labelled as such.** `svelte-check`
reported **442** at the first run of this step, when `observationTransitions.ts` existed and its test
file did not, and **443** once both existed — so the movement is **+1 per new file**, and a pre-step
baseline of **441** follows from those two measurements rather than from a run on a pre-step tree.
No such run was made: this tree carries four uncommitted instrument paths, one of which
(`src/probe.ts`) `svelte-check` counts, so a `git archive HEAD` copy would answer 440 and would need
its own `npm install` to say so.

**The module count moved by exactly one, for exactly one new reachable `.ts` module.** No component
was added, so the `+2 per styled component` rung does not apply. Both halves of `CLAUDE.md`'s bundle
oracle were run rather than either:

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (ABSENT, correct)
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js    → 2 (PRESENT, correct)
```

**The test count was re-derived per file, never from the total**, because
`scripts/lint/ipc-detail.test.ts` generates its cases from `scannableFiles()` and two new `.ts` files
under `src/` move it:

| File | Before | After | Δ | How the *before* was obtained |
|---|---|---|---|---|
| `observationTransitions.test.ts` | — | 38 | +38 | new file (**40** after round 1) |
| `reconciliationCoordinator.test.ts` | 40 | 54 | +14 | **measured** — the file was run alone before this step's cases were added (**56** after round 1) |
| `workspace.test.ts` | 196 | 208 | +12 | **derived** — 208 measured, less the 12 `it(` blocks this step appended (**211** after round 1) |
| `scripts/lint/ipc-detail.test.ts` | 135 | 137 | +2 | **derived** — 137 measured, less one generated case per new scanned file |
| **total** | **2307** | **2373** | **+66** | 2373 measured; 2307 derived. **2380 after round 1** — +7, all in the three files above |

`ipc-detail.test.ts` and `reconciliationCoordinator.test.ts` were each run alone to confirm their
figures.

### 6.1 The working tree

`git status --short --untracked-files=all` shows the six source files of §1, the two new ones, plus
exactly the four instrument paths and `PROGRESS.json`. `git diff --stat src-tauri/src/main.rs
src/main.ts` is **`5 insertions(+), 1 deletion(-)`**, unchanged, as every phase of this chain has
required. No git command that writes was run.

---

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism
and it reads a diff. **The marks below are as they stand after review round 1's fixes**, not as they
were written at delivery: three items moved, and the paragraph under each says which way and why.

1. **A blocked session with no further trigger never reloads — *recorded only*.** §2.2's exit is
   re-evaluated at the next accepted batch, so a window that receives no wake, no foreground signal
   and no open stays blocked and stale indefinitely. It is not a correctness defect in source: every
   ruling is satisfied, nothing is written, nothing false is shown, and the state is on
   `reconciliationBlock()` for 2d-6 to draw with a control. It is a coverage bound on the UI, which
   is why it is recorded rather than actionable.

2. **A write surface whose file was removed is never told — *actionable*, and not a correctness
   defect in source.** Q8 asks for a *removed-target/manual-recovery state*, and
   `WriteSurfaceTransition`'s parameter is the narrowed `Changed`/`Projected` snapshot, so a removal
   cannot be delivered through it. What ships is the safe half: the registration is preserved,
   nothing is reloaded under it, and `externalDocumentStatus` says `removed`. **2d-5-5 is the step
   that widens that protocol**, and it should adopt this deliberately rather than discover it. It is
   marked actionable because it names a specific gap in files that exist
   (`src/lib/browser/writeSurfaceRegistry.ts`, `src/lib/browser/observationTransitions.ts`); it is
   *not* a blocker, because nothing shipped claims the surface was told.

3. **`membershipReloadWanted` is raised and nothing consumes it — *recorded only*.** §3.6. It is dead
   state until 2d-6, exactly as `ReconciliationWatchState.notWatched` has been since 2d-5-3.

4. **The stale comment in `src/lib/components/DetailPane.svelte` is fixed — *recorded only*, and it
   was *actionable* when this section was first written.** It used to say *"Nothing invokes a stored
   transition anywhere in this repository: `transitionFor` is the only reader and it has no caller
   until 2d-5-4 routes an admitted observation"*, and this step falsified both clauses. It has since
   had exactly one comment-only correction — no markup, no script logic — which now says that the
   transition **is** called and that the inertness is the body's rather than the absence of a caller,
   and adds which observation arms cannot reach it at all. Nothing is left to do, so the mark drops to
   recorded only; the equivalent sentences in `writeSurfaceRegistry.ts` and `conflictSource.ts` were
   corrected in the step itself.

5. **One accepted-sequence map across `Addressable` and `Named` rests on the Rust identity registry
   — *recorded only*.** §3.2. It is correct only because this process mints one identity per path;
   nothing in TypeScript says two arms cannot name one number for two files, and if that ever became
   possible an observation of one file could silently supersede an observation of another.

6. **The guard's registry-generation clause over-refuses — *recorded only*.** A surface that opened
   and closed again while the read was in flight moves the generation with nothing targeting the file
   afterwards, so the answer is refused and the file is marked `stale` rather than reloaded. That is
   the safe direction and it is tested (*refuses when the registry moved and came back, with no
   surface to blame*); what it costs is one file left showing an older projection until the next
   observation or foreground drain.

7. **Clearing the status on the guard's success arm happens before the third capture comparison —
   *recorded only*.** If that last comparison then refuses, the status has been cleared and nothing
   was installed. All three ways it can refuse make the clearing harmless or superseded — another
   path installed a projection, a newer reread is in flight and will set its own status, or `open()`
   cleared every status anyway — but the ordering is an argument rather than a construction, and a
   fourth way to fail that comparison would invalidate it. **Round 1 changed two things around this
   and neither closes it.** The `stillApplying` arm is a fifth way for the *guard* to refuse, not a
   fourth way for the comparison to fail, so the three ways above are still the whole list; and the
   host's new mark-before-the-read narrows the window rather than removing it, because the clear still
   happens inside the guard. What *did* shrink the exposure is the materialization: a caller getter can
   no longer move a generation between the clear and the install, because it has already run.

   > **Correction (review round 2): this item is closed, and closing it was not its own fix.** Round
   > 2's finding 5 moved the clear out of the guard and into `rereadUnderGuard`'s success block, in
   > the same synchronous run as `installView` — for a different reason, that the guard reached only
   > one of that helper's two callers and a successful `BrowserState.rereadDocument` therefore left a
   > `stale` mark standing for the rest of the session. There is now nothing to clear before the
   > third comparison: the clear is **after** it, after the installation, and every refusing arm
   > returns above it. The three-ways-to-refuse argument this item rested on is no longer load-bearing
   > and a fourth way would no longer invalidate anything.

8. **An `Added` for an identity this window already holds a projection for would show *not read yet*
   beside a projection — *recorded only*.** `addDocument`'s replace arm exists for a second addition
   of one path, which is the only way the wire's own contract can reach it, and it does not look at
   `views`. A wire that broke that contract would produce the inconsistency and nothing would notice.

9. **`externalDocumentStatus` and `externalPathDrift` are read by no production consumer —
   *recorded only*.** Their reactivity is asserted by nothing: the tests read them imperatively, so
   a future edit that made them plain variables would keep every test green and break 2d-6's
   drawing. The same hole `surfaceGeneration` had before a component consumed it.

10. **`observationTransitions.ts`'s `tellTheSurfaceAbout` can in principle deliver one observation
    twice — *recorded only*.** It is called once by `applyChange` and once from inside the guard, and
    the second call happens only when the first returned `false`, so today at most one delivery
    occurs per observation. Nothing enforces that a future caller invokes the guard more than once,
    and two deliveries would produce two distinct `ExternalConflictObservation` objects for one wire
    observation — which `externalConflictSource`'s memo keys on identity, so they would be two
    sources. 2d-5-5 is where that would start to matter.

11. **Review round 1 has run, and its five findings are fixed — *recorded only*.** Section 8 is the
    record. The warning this item carried is exactly what happened: every gate was green at delivery
    and the round still found two blockers and three should-fixes, two of which were false or
    overclaimed sentences in *this file* that no test could fail. Whether a further round is
    commissioned is `CLAUDE.md` §7.1's question and it reads the fix round's diff — which here
    changed source, so one is owed.

12. **The install is shallow-copied and nothing deeper is — ~~*recorded only*~~, and both reasons
    given for that mark were false.** Round 1's first fix materialized the command's answer into a
    plain own-property object before the comparisons; `repairAfter` still walked `next.matches`, whose
    elements were the command's own objects, and it ran *after* the installation. A deep clone was
    rejected as heavy, failure-prone on non-cloneable values and a change to the identity of the
    installed projection — which remains the right reason not to use `structuredClone`.

    > **Correction (review round 2).** The mark rested on two claims and round 2's findings 1 and 2
    > falsify one each. *"The installation itself is now atomic against the final check"* was false:
    > `installView` reads `view.id` on every element already in `views`, which `open()` had retained
    > from the injected command, so a second caller-controlled read stood between the check and the
    > install. *"The selection repair has `replaceSelection`'s own discipline behind it"* was false in
    > a sharper way, because `replaceSelection` performs no check at all — its whole body is a counter
    > bump and an assignment, it bounds asynchronous lookups taken earlier, and `repairAfter` never
    > consults it. **This was a correctness defect in source**, so under `CLAUDE.md` §7.3 it was a
    > blocker rather than something a later phase could adopt, and it is fixed here rather than
    > carried: `ownedProjectionOf` normalizes at every ingress, two levels deep, and its own header
    > states exactly where the guarantee stops. ~~What survives as *recorded only* is the residue —
    > **the third level and below is still the command's own object**, and no type says so.~~

    > **Correction (Phase 2d-5-4-B).** The struck sentence carries the **wrong mark**, and it is the one
    > place in this record where the mark decides whether a known defect closes with the step. Under
    > `CLAUDE.md` §7.3 an item is a **blocker** when it names a correctness defect in a source file, and
    > the residue named exactly one: the third level is a `MatchId`, `positionOf` in
    > `src/lib/browser/selection.ts` reads `match.id.node` on every element of the projection it walks,
    > and `positionInSameParse` calls it at three adoption sites **between the selection-follow guard
    > and the `replaceSelection` that guard justifies** (`adoptTheDocumentOnDisk`,
    > `adoptTheCreatedSnippet` and `adoptAfterTheDuplicate` in
    > `src/lib/browser/workspace.svelte.ts`). A getter there is arbitrary code inside a check-and-spend
    > window, which is 2c-3c step 2's High in its third-level form. *Recorded only* is for a residual
    > risk that names no defect in a source file, and this named one; the correct mark was **blocker**.
    >
    > It is closed rather than re-marked and carried: `ownedMatchIdOf` copies the identity field by field
    > at ingress, `ownedMatchOf` uses it, `ownedIdentityOf` normalizes the `target` and `moved`
    > identities a save answer carries at the top of each of the three adoptions, and
    > `workspace.test.ts` holds a case confirmed to fail against this record's own code
    > (`docs/decisions/2d-5-4-B-notes.md` §3). ~~What survives as *recorded only* is narrower and names no
    > defect: the **fourth** level and below — the values of `trigger`, `content`, `options` and the
    > element types of the arrays — is still the command's own object, and nothing this module reads
    > after a guard goes that deep.~~

    > **Correction (Phase 2d-5-4-C, review finding 1 and its M1).** The struck replacement is itself an
    > overclaim, and it is the same claim one wording narrower — which is the failure mode this project
    > has now recorded three times. Its second half, *nothing this module reads after a guard goes that
    > deep*, is a statement about **depth** used to answer a question about **ingresses**, and it was
    > false when it was written: a `MatchId` at the third level was still the command's own object at
    > one ingress the round did not reach. `ownedRepair` passed `repair.selected` through unchanged, so
    > the identity `reresolve` had copied **by reference** out of `commands.reloadDocument`'s answer was
    > what the window retained — and `isTheSameIdentity` reads its `document`, `revision` and `node` as
    > the last conjunct of three selection-follow guards, immediately before the `replaceSelection` each
    > guard justifies. `ownedRepair`'s header in `src/lib/browser/workspace.svelte.ts` carried the
    > same claim in source — at 709-712 until that same fix rewrote those lines, so the number resolves
    > only against `f3ba2cd^` — and it also misattributed the rule it cited: `ownedMatchOf`'s own header
    > says **`id` is the one exception**, which is the opposite of what that header claimed for it.
    >
    > Closed rather than re-marked: `ownedRepair` now rebuilds the kept `SelectedMatch` field by field
    > with `ownedMatchIdOf`, and `workspace.test.ts` — *keeps no command identity when a repair keeps
    > the selection* — is confirmed to fail against the code this correction block was written over.
    > What survives is narrower still and is a statement about **which ingresses exist**, not about a
    > depth: every projection, identity and row this module retains is copied at ingress, over a list of
    > call sites held by review and by three JSDoc headers, and **no type expresses any of it**. A
    > future ingress added beside them would not fail to compile.

13. **`pendingAdditions` is cleared only by `open()` and by the removal transition — *recorded
    only*.** There is no *other* way for an invented identity to become addressable today, because the
    only thing that reallocates identities is a whole load. If a later phase ever gives this window a
    narrower membership refresh, that refresh owes this list a clearing rule, and nothing in TypeScript
    will ask it for one.

14. **`stillApplying` conflates two states under one answer — *recorded only*.** A blocked session and
    a disposed one both answer `false`, and a guard that wanted to treat them differently could not.
    Nothing needs to today: both refuse the same way and mark the file `stale` for the same reason.
    Splitting them would mean a second member with no consumer, which is the shape §3.8 refuses for
    `reconciliationBlock()`'s mirror.

---

## 8. Review round 1, and what its five findings changed

The review is [`docs/reviews/phase-2d-5-4.md`](../reviews/phase-2d-5-4.md): **needs-attention, two
blockers and three should-fixes**, read-only, over the working tree. Every one was re-derived from the
code before being fixed, and each fix carries a test that was **confirmed to fail against the
delivered code and pass after the fix** — the verification was run, not assumed.

| # | What it found | Where the fix is | The test that pins it |
|---|---|---|---|
| 1 | **blocker** — caller-controlled property reads still separated the final check from the install | `workspace.svelte.ts`, `rereadUnderGuard()` | `workspace.test.ts` — *installs nothing when the answer's own getter opens a surface* |
| 2 | **blocker** — lost-history blocking and disposal invalidated no pending reread | `observationTransitions.ts` (the question and the guard arm), `reconciliationCoordinator.ts` (the answer) | `observationTransitions.test.ts` ×2, `reconciliationCoordinator.test.ts` ×2 |
| 3 | should-fix — pending `Added` identities escaped into document commands through the raw viewer | `workspace.svelte.ts`, `pendingAdditions` + `fileTextTarget()` | `workspace.test.ts` — *sends no document command for the row an addition invented* |
| 4 | should-fix — the guarded reread's outcome was discarded, hiding a failed reconciliation | `workspace.svelte.ts`, the host's `rereadUnderGuard` member | `workspace.test.ts` — *leaves the file marked stale when the guarded reread fails* |
| 5 | should-fix — the ruling-28 routing evidence was incomplete and partly vacuous | `workspace.test.ts` — two cases rewritten, plus `documentCommandCounts` / `expectNoDocumentCommandSince` | the two rewritten cases themselves |

**Three of the five are corrected in place above, marked as corrections**, because they falsified
sentences this record had already written: §3.3's *"with nothing between them"* (finding 1), §3.5's
*only open-workspace document command reachable from any observation* and its evidence sentence
(findings 3 and 5), and §3.7's count (finding 5). `CLAUDE.md` names a decision record claiming a
guarantee the code does not give as this project's worst defect class, and two of this round's five
were exactly that.

**What finding 5's fix is, stated as a method rather than as two edited cases.** A baseline captured
after the batch it is supposed to measure cannot fail, so both routing cases now take their counts
**before** the observations are fetched and deliver them through a controlled wake, and both compare
**all six** reading commands of the open workspace instead of two. `expectNoDocumentCommandSince` is
what makes the second half uniform, beside the `expectNoSaveCommand` this phase already owed for
ruling 27 — which is unchanged and still asserted in every case of both suites.

**The addition case was rewritten too, although the review named only its sibling.** It had the
identical baseline-after-the-batch shape, and §3.7's claim about it is one of the sentences this
section corrects; leaving it would have left the correction untrue.

**What no fix here touched.** No `.svelte` file (the one comment-only correction this phase owed was
already taken — §7 item 4), no Rust, no instrument path, no dictionary key, no `PROGRESS` file. The
`git diff --stat` of `src-tauri/src/main.rs` and `src/main.ts` is still `5 insertions(+), 1
deletion(-)`.
