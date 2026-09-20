# Phase 2d-5-4-D — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4-C's fix

**Status: taken and answered.** Risk class: **high**. Components: **none** — no `.svelte` file was
modified, so no window reading is owed.

This is **not** an implementation step. §7.1: *a fix round that changes at least one source file is
owed a review round, scoped to that change.* Phase 2d-5-4-C's fix changed four source files; this is
the round that reviews **that fix**. Its own fix changes source, so §7.1 commissions a further round —
§8 says so and says what it is scoped to.

The documents: the brief [`docs/reviews/phase-2d-5-4-D.brief.md`](../reviews/phase-2d-5-4-D.brief.md),
the review [`docs/reviews/phase-2d-5-4-D.md`](../reviews/phase-2d-5-4-D.md), and the re-derivation
[`docs/reviews/phase-2d-5-4-D.rederivation.md`](../reviews/phase-2d-5-4-D.rederivation.md).

---

## 1. How the round was run

**The review was Codex**, verdict `ship-with-fixes`, **1 finding: 1 blocker and 0 should-fix**, over
the committed fix `f3ba2cd`.

**The finding body arrived truncated for the fifth round running** — about 180 characters, breaking
off mid-sentence — so the same three-stage shape was used and the finding was **not** accepted on the
report's strength:

1. a **read-only re-derivation worker** derived the mechanism from the source alone, quoted the
   decisive lines, corrected the reviewer's wording, and swept for what the review had missed — finding
   seven more things, five established and two not;
2. the **orchestrator spot-checked** the decisive lines independently — `applyAddition`'s parameter
   list, the materialization window, `applyChange`'s two lifecycle arms, `accepted.clear()`'s stated
   justification, the surviving mention of the deleted host failure arm, and the Rust identity
   contract;
3. this fix round implemented the blocker's fix plus three of the established items, **derived the
   fourth for itself before fixing it**, and pinned both behavioural fixes with a case confirmed to
   fail against the pre-fix code.

**Nothing the re-derivation marked NOT ESTABLISHED was fixed.** Its §3.6 (the discarded `void` at
`workspace.svelte.ts:2465`) and §3.7 (`statusWrites` growing unboundedly) are suspicions with no
derivation behind them, and they are left exactly as they were.

**Two of the re-derivation's own sentences are corrected here rather than carried forward**, because a
record is checked against the code and not the other way round:

| What the re-derivation said | What is true |
|---|---|
| §1.6: *"the `never` terminus at `:811-813` makes a new `ObservationOutcome` arm a compile error at every site that must handle it"* | It does **not**. That `never` is over `ObservationRoute` — `const unreachable: never = route` — so it exhausts the *route* union and says nothing about the outcome union. **Nothing anywhere switches over `ObservationOutcome`**: its only producers are six string-literal returns in `observationTransitions.ts` and its only consumer is `observationOutcomes()`, which hands an array to tests. A new arm costs nothing and buys no compile-time check. §2.3 says what it does buy. |
| §3.1: *"twelve comments in five source files"* | **Sixteen**, in seven files. §3 lists every one, with how the sweep was run. |

---

## 2. The blocker — the lifecycle window in `applyAddition`

> `src/lib/browser/observationTransitions.ts:849` — *"Check workspace lifecycle after materializing
> the addition."* high, confidence 0.98.

### 2.1 Verdict: **HOLDS IN PART**, and the half that does not hold is the attribution

**The defect holds.** Two statements of caller-controlled code stand above `applyAddition`'s `admit`:
the spread `{ ...route.summary, loaded: false }`, which runs one accessor per own enumerable key of a
wire object with seven required members, and `'Unreadable' in route.content`, which runs a `Proxy`
`has` trap. A getter there can synchronously call `BrowserState.open()`, which reaches
`workspaceOpened` before its own first await; that clears the accepted-sequence map. Control returns
to `admit`, which is *strictly greater than what is held* — and after a clear nothing is held, so it
accepts and writes the **closed** workspace's sequence into the **replacing** workspace's map.

**The asymmetry is the finding in one sentence.** A `clear()` makes every `isNewest` fence in this
module answer `false`, so every fence fails safe across a lifecycle reset; `admit` is the one
operation a clear answers **permissively**. `applyAddition` was the only arm running caller code above
its own `admit` — `applyChange`, `applyRemoval`, `applyUnreadable` and `applyNamedRow` all admit on an
own data property of the literal `routeObservation` built.

**The half that does not hold is *"Source defect introduced by M5's reordered reads"*.** The window is
**older than M5**. Before it, the same function read `route.summary.id` as an argument to `admit`, and
JavaScript evaluates arguments left to right before entering the call — so a hostile `id` getter
already ran above `admit`. M5 **widened** the trigger surface from one getter to seven plus a `has`
trap, and simultaneously **closed** the window on the other side of `admit`, which is what its JSDoc
claims and what is true. Accepting the review's wording would have put a false attribution into the
record, which is the class this project checks for.

**The corrected anchor.** `849` is accurate as the *trigger* line — it is where the caller's code
runs. The **cause** is `851`, the `admit` that a cleared map cannot refuse. The fence is inserted
between them.

**Not production-reachable today.** The wire values reach `applyObservation` from a Tauri command
answer — JSON-parsed plain objects with no accessors and no proxies. It is reachable only through an
injected accessor, which is the boundary every fence of this chain exists to defend, and it is the
same reachability every finding of 2d-5-4-B and 2d-5-4-C had.

### 2.2 The fix, and why it is the smallest one that closes it at the cause

`applyObservation` already held the `ObservationSession` and already passed it to three arms. It now
passes it to a fourth, and `applyAddition` asks **the same two questions** `applyChange`'s guard asks
first, in the same synchronous block as the arbitration:

```ts
if (!session.stillApplying() || session.epochNow() !== session.epoch) {
  return 'lifecycleMoved';
}
```

- It is asked **after** the whole caller-controlled window and **before** `admit`, and nothing between
  it and `admit` runs anything a caller supplied: `stillApplying` and `epochNow` are closures the
  coordinator builds over its own `let`s, and `session.epoch` is an own data property of that literal.
- It discriminates. `workspaceOpened` sets `epoch = 0` **before** `accepted.clear()`, and an adopted
  epoch is non-zero, so `epochNow() !== session.epoch` is true the instant a re-open begins.
- **The review's own fix — *carry a lifecycle token from the accepted batch* — was not taken.** It
  invents a value where two existing members answer the question, and this round has no evidence for
  the machinery. The shape it was reaching for is what the two lines above do.

### 2.3 The `ObservationOutcome` value, derived rather than assumed

The re-derivation suggested `'superseded'` with its doc widened. **That is the wrong value, and the
reason is what the coordinator does with the record.**

`'superseded'`'s doc says *"A newer observation for the same file has already been admitted"*, and
`observationsDropped`'s doc leans on exactly that reading: an observation that reaches a transition is
not dropped, *"one superseded by a newer sequence is on `observationOutcomes` as `superseded`, which is
arbitration rather than loss"*. Neither is true here — this observation never reached an arbitration.

Worse, **`workspaceOpened` empties `observationOutcomeRecords`** in the same synchronous block as
`accepted.clear()`. So on the re-open path the entry this arm pushes is the **first entry of the
replacing workspace's record**, and calling it `superseded` there would claim a newer observation of
that file had been admitted by a session that has admitted nothing.

No existing arm is true of it, so the union gains one: **`'lifecycleMoved'`**. What that costs and what
it buys, stated so no reader takes more from it than it gives:

- it buys **a true record** and a value a case can assert;
- it buys **no compile-time check at all** — see §1's correction. Nothing switches over this union, so
  a future arm that forgets to answer it fails nothing.

---

## 3. Sixteen source comments claimed `open()` reallocates every document identity, and the Rust says the opposite

This is `CLAUDE.md`'s named worst defect class — a record claiming a guarantee the code does not give
— at **source** scope, and it is load-bearing for the blocker's cost.

**The claim**, in its sharpest instance (`reconciliationCoordinator.ts`, `workspaceOpened`):

> *"`open()` reallocates every document identity, so a retained entry would be a sequence about a
> different file."*

**The contract it contradicts**, `crates/espansoconfig-core/src/workspace/mod.rs`, in
`Workspace::from_tree`'s own doc: identities come from the **session's path table**, not from the
tree's order, *"so they are stable across two `open` calls of a directory that changed as well as one
that did not … removing one leaves its identity unmatched rather than handing it to a neighbour"*.
`identity_of` returns the existing entry for a known path; `identity_already_issued`'s doc says *"the
same path answers the same number for as long as the process runs, a recreation at that path
included"*; and eviction is **refused** by design.

**So a retained entry is never about a different file.** It is about the **same** file (same root
re-opened) or about **no** file in the new workspace (different root) — and the first of those is the
dangerous one, because `begin_epoch` sets `next_sequence = FIRST_OBSERVATION_SEQUENCE`. Clearing is
still right; the **stated reason** for clearing was false, and the true reason is strictly stronger and
is exactly what §2's blocker costs: a kept entry holding the closed workspace's highest number would
refuse the new epoch's earliest observations of that same file, each returning `'superseded'` with
nothing anywhere recording the refusal.

**`accepted.clear()` itself stays.** What was fixed is the sentence, in every place it stood.

**How the sweep was run, so it is checkable rather than asserted.** `rg -i reallocat` over `src/`,
`crates/`, `src-tauri/` and `scripts/` — seventeen hits, sixteen of them instances of this claim
(`writeSurfaceRegistry.ts:79` and `:82` are one sentence across two lines). Then a second sweep **by
shape and not by the word**, for narrower wordings: `different file`, `another file`,
`identities (are|change|move)`, `new identit`, `fresh identit`, `re-issue`, and every line mentioning
`open()` alongside `identit|denote`. That second sweep found two survivors the word-sweep would have
missed — `DetailPane.test.ts:1002` (*"naming a `DocumentId` the load below `open()` has
reallocated"*) and `workspace.svelte.ts:2201` (*"a `DocumentId` that now denotes a **different
file**"*) — and two sentences that are **true** and were left alone: `rawDocument.test.ts:84` and
`workspace.svelte.ts:2310`, both of which say an identity from the previous workspace may name nothing
in the new one, which is the second of the two cases above.

The sixteen, by file: `observationTransitions.ts` ×1; `reconciliationCoordinator.ts` ×3;
`workspace.svelte.ts` ×7; `writeSurfaceRegistry.ts` ×2; `workspace.test.ts` ×1;
`reconciliationCoordinator.test.ts` ×1 (a case **name**); `DetailPane.test.ts` ×1. Every one is
**source** under §7's closed list, test files included. `rg -i reallocat` over those trees now finds
nothing.

**Each replacement states what is true of that site and no more.** They are not one sentence pasted
sixteen times, because the sites were justifying six different actions: clearing the sequence map
(the epoch's numbering restarts), clearing `projectionGenerations` (the counts belong to one
lifecycle's projections), not bumping `statusWrites` (the open generation catches it), the three
captures around a reread (a replaced workspace is a fresh projection of every file), leaving a
registration standing (the surface is about a workspace this window no longer shows, over a file the
replacing one may not hold), and closing the viewer (its text was read out of the workspace being
replaced).

**Severity, honestly stated: no behaviour depended on the false half.** Everything these comments
justify was the right action for a different and true reason. What was wrong was the reason, in sixteen
places, and one of them was the contract a reader of `applyAddition` would consult to decide whether
§2's contamination matters at all.

---

## 4. A source comment still named the deleted host failure arm as a live reader

`src/lib/browser/workspace.svelte.ts`, inside `open()`, justifying the row-by-row copy:

> *"`documents` is read inside the coordinator's guard and in the host failure arm's last check before
> its write, and `listed.value` is an injected command's answer."*

**The host failure arm is the `.then` clause Phase 2d-5-4-C deleted** (its finding 2); the member has
no failure arm at all. 2d-5-4-C corrected exactly this wording in two other places — `ownedSummaryOf`'s
header (*"A third reader is gone rather than answered"*) and `addDocument`'s comment — and left the
third standing. It is the survivor shape the brief warns about, in source, and it is the same failure
mode 2d-5-4-C itself recorded finding in 2d-5-4-B: the sweep was written from the previous wording.

It now names the two readers that are still there — `creatorEligibility` and `holdsDocument`, both of
which walk the list inside the coordinator's guard — which is what `ownedSummaryOf`'s header names
first, so the two passages agree.

**The sweep for every other surviving mention**, by shape: `failure arm|failing arm|arm's last
check|third reader|re-state|restate` over `src/**/*.ts` and `src/**/*.svelte`. Every other mention of
that arm is in the **past** tense and correct — `ownedSummaryOf`'s header, the member's own JSDoc, the
private helper's `statusAt` comment, and three comment blocks in `workspace.test.ts`. One near miss
was checked and left: `workspace.svelte.ts:3682` says *"the injected `report` on the failure arm"*,
which is the projection loop's own `view.failure` arm and not the deleted one.

**This is a comment-only fix. It has no case and does not pretend to one.**

---

## 5. An `Added` after a `Removed` left a `removed` status over a present row

**Derived here rather than taken from the re-derivation**, because the brief made the fix conditional
on what the derivation found.

`applyRemoval` writes `{ kind: 'removed' }` under its `isNewest` fence. `applyAddition` re-inserts the
row through `addDocument`, and **neither `addDocument` nor `removeDocumentFromWindow` touches
`externalStatuses`**. The only clears are `noteDocumentStatus(document, null)` in the reread's
installation block and `open()`'s wholesale `externalStatuses = []` — and **an `Added` requests no
reread** (ruling 30). So *delete a file, recreate it* — a watcher `Removed` then an `Added`, two
batches — left the file reading `removed` while its row was back in the sidebar, until the next
`Changed` for that file completed a reread. Same-batch ordering was already handled by `isNewest` at
the removal; the cross-batch case was what nothing covered.

**It closed locally, so it was fixed.** The condition the brief set was that the fix be a *fenced*
status write inside `applyAddition`'s own path, symmetric with the existing `unavailable` write and
under the same fence. It is exactly that: the write is now unconditional under `isNewest`, carrying
`null` where the content projected and `{ kind: 'unavailable', reason }` where it did not.

**Why this decides nothing between two truths, which is what would have made it 2d-5-5's.** The
addition is a complete statement about the file — the engine's summary and its content at
stabilization — and `admit` accepted it as **strictly newer** than anything that wrote a status before
it. So there is one newest truth at that moment, not two. The `isNewest` fence is what makes it unable
to wipe a newer observation's mark, exactly as it does for `applyRemoval`; before this, `applyAddition`
was the one arm of the four that stated its verdict only *sometimes* and left a superseded one
standing. A same-batch `Named`/`changed` arriving after it writes `stale` over this `null` on its own
higher sequence, which is the newer statement winning, and an in-flight reread's clear is refused by
its `statusAt` capture, which is a third party being refused. Both are the existing machinery
answering, not a new rule.

**What it is not.** It is not a claim that anything on a screen changes: this module's header records
that no screen reads `ExternalDocumentStatus` today and 2d-6 is what draws it. It was wrong **state**,
not a wrong sentence, and it was fixed before anything drew it.

---

## 6. The record-only items

All four are under `docs/`, so **none of them commissions a round** (§7.1). They are recorded here
because each is a narrower survivor of a claim this phase already struck, which is the shape that has
produced a finding in every round of this chain.

1. **`workspace.svelte.ts:709-712`, cited three times and resolving to nothing.** The three citations
   (`2d-5-4-C-notes.md`, `2d-5-4-notes.md`, `2d-5-4-B-notes.md`), two of them in the present tense,
   point at the struck claim in `ownedRepair`'s header — which 2d-5-4-C's own fix rewrote, so at HEAD
   those lines are an unrelated paragraph. Each now names the **symbol** and says the number resolves
   only against `f3ba2cd^`.
2. **`2d-5-4-notes.md` — *the value of `id` … is still the command's own object*.** False since
   2d-5-4-B: `ownedMatchOf` copies `id` through `ownedMatchIdOf`, and that function's header names it
   *the one exception*. **Struck, not reworded** — the claim it belongs to was struck once already, and
   a third wording is what this chain keeps producing.
3. **`2d-5-4-notes.md` — the deleted arm argued as live and *kept rather than deleted*, and the
   positional justification beside it.** Both struck. The arm is gone (2d-5-4-C's finding 2); and *a
   fence there would be a call no test could tell from no call* was struck once at `2d-5-4-A-notes.md`
   §7 item 4 and is named false in source, with a case that refuses it.
4. **`2d-5-4-B-notes.md` — *this module has exactly one fenced status writer for an admitted
   `Changed`*.** Retracted by that file's own §10 item 6 correction for the **source comment**; this is
   the body sentence the comment came from, and it is struck rather than reworded.

---

## 7. What this round deliberately did not do

- **It did not carry a lifecycle token on the batch**, and it did not ask the two questions once per
  iteration at the coordinator's loop or at the top of `applyObservation`. The brief scoped the fix to
  the cause, and the driver is what was closed: `applyAddition` was the only arm that could reset the
  lifecycle by itself. §9 item 2 records what is left of the class and why it is not a defect today.
- **It did not fix the same false identity claim where it stands in the record.** Outside this file
  and the re-derivation — both of which *describe* the claim rather than make it — `rg -i reallocat
  docs/` finds **23 occurrences across ten files**: `2d-5-2a-notes.md` (4), `2d-5-2a-A-notes.md` (6),
  `2d-5-2a-B-notes.md` (1), `2d-5-2b-notes.md` (2), `2d-5-4-notes.md` (3), `2c-3a-1-notes.md` (1),
  `progress-archive/next-action-history.md` (2), `progress-archive/status-table.md` (1),
  `reviews/phase-2d-5-2a.md` (2) and `reviews/phase-2d-5-2a-A.md` (1). Seven of them were read here
  and every one is an instance; the other sixteen were counted, not read, which is why §9 item 3
  carries a **sweep to run** rather than a number to trust. They are record, they commission no round,
  and they were outside the brief.
- **It ran no `cargo` command and no `npm run build` or `npm test`.** The orchestrator owns the full
  gates; §8 records only what this round measured.
- **It touched none of the four instrument paths.** `git diff --stat` over `src-tauri/src/main.rs` and
  `src/main.ts` is still `5 insertions(+), 1 deletion(-)`.
- **It edited neither `PROGRESS.md` nor `PROGRESS.json`.**

---

## 8. The gates, and every pre-fix failure message

**The four gate figures are `1320 / 443 / 2406 / 189`** — `cargo test --workspace` / `npm run check`
files / `npm test` / `npm run build` modules — **measured in full by the orchestrator on the post-fix
tree**, each command run on its own and nothing run concurrently with `cargo`. Only `npm test` moved,
by **+2**, which is exactly the two cases the table below pins; no module was added, no file entered
or left `svelte-check`'s set, and `git diff --numstat -- crates/ src-tauri/` names only the
instrument's `main.rs` hook, so no Rust changed. The Rust figure was summed over **26** `test result`
lines and checked by both complementary questions — no line lacking `0 failed`, and no line lacking
`0 filtered out`, the second because 2d-5-4-C's first run measured nothing while exiting 0. `cargo
clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check` and `cargo tree -p
espansoconfig-core | rg tauri` are clean. **Both bundle oracles were read**: server-only markers
**absent**, client-only markers **present (2)**.

What follows is what **this round** measured while working, and it is evidence about the fix rather
than the gate.

- `npx vitest run src/lib/browser/observationTransitions.test.ts` → exit 0, **53 passed**.
- `npx vitest run src/lib/browser/workspace.test.ts` → exit 0, **224 passed**.
- `npm run check` → exit 0, **443 FILES 0 ERRORS 0 WARNINGS**. Unmoved, and it should be: this round
  added no source module.

**Both behavioural fixes were confirmed against the pre-fix code** by reverting that one change in the
tree, running the one suite, recording the message and restoring it. **Two cases, both new, both in
`observationTransitions.test.ts`.** The comment-only fixes of §3, §4 and §6 have no case.

| Fix | The case | What it said before the fix |
|---|---|---|
| §2 the lifecycle fence | *refuses the addition when the summary's own getter reopened the workspace* | `AssertionError: expected 'added' to be 'lifecycleMoved' // Object.is equality` |
| §5 the status write | *clears a removal's status when the file comes back* | `AssertionError: expected [ { document: 42, status: { …(1) } } ] to deeply equal [ …(2) ]`, the missing element being `{ "document": 42, "status": null }` |

**The blocker's case asserts three things and the first one masks the other two, so both were measured
separately** by suspending the assertion above them and re-running against the same pre-fix tree:

- with the outcome assertion suspended: `AssertionError: expected [ { id: 42, …(6) } ] to deeply equal
  []` — the superseded workspace's row lands in the one replacing it;
- with the row assertions suspended as well: `AssertionError: expected 500 to be +0 // Object.is
  equality`.

**That last figure is the one that measures the finding rather than its symptom.** The replacing
workspace's map holds `42 → 500` before the fix. Its epoch numbers its own observations from
`FIRST_OBSERVATION_SEQUENCE`, and the file's identity is path-stable and therefore the same number — so
the first five hundred things that epoch ever said about that file would have been refused as
`'superseded'`, with nothing anywhere recording the refusal. **No case in either suite asserted
`sequenceFor` after an `applyObservation` before this one.**

**Nothing was discarded.** No candidate case was written that passed against both trees; where that
happens this project records it, and it did not happen here.

**Non-discriminating assertions, named so no reader mistakes one for the measurement**:
`expect(sprung).toBe(true)` in the lifecycle case establishes that the trap really fired, and
`expect(workspace.added.map((summary) => summary.id)).toEqual([42])` in the status case establishes
that the row really came back. Neither measures the fix.

---

## 9. Where it is thin

Every item carries one of §7.3's two marks. **No item commissions a round** — §7.1 is the only
mechanism and it reads a diff — and **no item below names an unfixed correctness defect in a source
file**, so none holds this step open.

1. **recorded only** — `'lifecycleMoved'` is a ninth arm of a union **nothing switches over**. Adding
   it made no site fail to compile and removing it would make none fail either; what it buys is that
   the record the coordinator keeps says something true. The exhaustiveness this project relies on
   elsewhere — `src-tauri/src/dictionary_contract.rs`, `src/lib/i18n/codes.ts` — does not reach this
   type, and §1 corrects the re-derivation's claim that it did.
2. **recorded only** — **the class the blocker belongs to is not closed, only its driver is.** The
   coordinator's batch loop re-asks no lifecycle question between observations, so if anything resets
   the lifecycle mid-batch, every later observation of that batch still reaches its own `admit` against
   the cleared map. This is **not a defect today**, and the mark follows what the item names rather
   than how large the work looks: the only synchronous caller code inside that loop is a wire accessor,
   and production wire values are JSON-parsed plain objects; the one production re-entrancy candidate,
   `WriteSurfaceTransition`, is registered in `DetailPane.svelte` as `tellNobodyYet`, a no-op. **It
   stops being about an injected boundary the moment 2d-5-5 gives that callback a real body**, because
   it is fired synchronously from `applyChange` in the middle of the loop. That phase is where the
   question belongs — once per iteration, or once at the top of `applyObservation` — and it is named
   here so that phase adopts it deliberately.
3. **actionable** — §3's false identity claim still stands in the **record**, at 23 occurrences
   across ten files under `docs/` (§7 lists them with their counts). The mark is actionable because it
   names a check that can be run in files that exist — `rg -i reallocat docs/`, then read each hit,
   since not every occurrence need be an instance — and **not** because a count has been established:
   seven were read here, sixteen were only counted. None is a correctness defect in a **source** file,
   so a later phase may adopt it and this step closes without it.
4. **recorded only** — the two lifecycle members are asked **three** ways in this module now:
   `applyChange` asks them inside an asynchronous guard, `applyAddition` asks them synchronously before
   its arbitration, and `applyRemoval`, `applyUnreadable`, `applyNamedRow` and `applyUnnamedPath` do
   not ask them at all. Which arms need the question is a property of where caller code runs, and
   **nothing in `ObservationSession`'s type expresses it** — an arm that never asks compiles. The
   function's JSDoc says this in the same paragraph that says what the check does force.
5. **recorded only** — §5's fix is pinned by one case over two batches, and what it pins is that the
   status is *stated*. **Nothing pins the fence half** — that a newest-check failure suppresses the
   write — because the recording workspace's `addDocument` cannot admit a newer observation, so that
   window is unreachable from this suite by construction. A future edit that dropped the `isNewest`
   guard around this write would pass every case in the tree. The M5 pin next door covers the
   neighbouring case — a getter that admits a newer removal, where the arm returns before the write —
   and that is not the same thing.
6. **recorded only** — the sixteen comments of §3 were each rewritten to say what is true **of that
   site**, and the six distinct justifications are now six distinct sentences rather than one. That is
   right, and it means **no single sweep will find them all again** if the underlying fact ever changes:
   the word *reallocat* no longer appears anywhere in the tree, so the next reader looking for this
   class has to sweep by shape, as §3 did. The Rust contract they now rest on is
   `Workspace::from_tree`'s doc, and nothing links the two files.
7. **recorded only** — this round changed no `.svelte` file, added no user-facing string in any
   language and takes no window reading. What it changed — which of two truths owns a file's status,
   and whether a row's `removed` mark survives the file coming back — is exactly what 2d-6 draws. The
   first reading that draws it is the first evidence any of it is right on a screen.
8. **recorded only** — five consecutive rounds have now found the same question in a new neighbour:
   *does the statement that acts still own what it is acting on, after everything that ran since the
   check?* This round's instance was the one arm where the check itself — `admit` — answers
   **permissively** under the event every other fence refuses under. The neighbours nobody has swept
   for that particular asymmetry are the other places a monotonic counter is consulted after
   caller-controlled code: `rereadGenerations`, which survives an `open()` untouched by design, and
   `statusWrites`, which is never cleared at all. Neither is named here as a defect, because neither
   was derived.
