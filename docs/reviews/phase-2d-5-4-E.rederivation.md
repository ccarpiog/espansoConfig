# Phase 2d-5-4-E — read-only re-derivation of the review's three findings, and the sweep

**Nothing here was accepted on the review's strength.** `docs/reviews/phase-2d-5-4-E.md` arrived
truncated mid-sentence for the **sixth round running**, so every finding below is derived from the
source at HEAD (`4f7c500` plus the two record commits after it), and where the report's sentence
breaks off the **strongest reading its cited lines support** is reconstructed and named as such.

**No source file, record file or configuration file was modified. No test, build, `cargo` or `npm`
command of any kind was run.** Every claim below is a reading of code, never a measurement.

---

## Part A — the three review findings

### A1. [BLOCKER] `src/lib/browser/observationTransitions.ts:913` — "Capture lifecycle ownership before caller-controlled batch reads"

**Verdict: HOLDS.** The defect is real, the mechanism is exactly the one the truncated sentence was
reaching for, and **the anchor is half wrong in the way this chain keeps producing**: `:913` is where
the *symptom* is visible, but the **cause is `src/lib/browser/reconciliationCoordinator.ts:917-919`**,
which the report itself cites. The fence is not defective; the value it is handed is.

#### The reconstruction

The report's body breaks off at *"In reconciliationCoordinator.ts:917–919, accept() reads
batch.newest_sequence before constructing s…"*. The only completion its cited lines support is
**"…before constructing `session`"**, and that is what the code says.

#### The derivation

`accept()` in `reconciliationCoordinator.ts` reads the caller-supplied batch four times before the
session literal exists, and a fifth time after it:

| Line | Read | Relative to the session literal |
|---|---|---|
| 895 | `batch.epoch` | **above** |
| 897, 901, 903 | `batch.discarded` | **above** |
| 911 / 917 | `batch.newest_sequence` | **above** |
| 918-945 | the `ObservationSession` object literal is built; `epoch` is captured **by value** at line 919 | — |
| 946 | `batch.observations` | below |

`session.epoch` is therefore the value of the coordinator's `let epoch` **at line 919**, i.e. *after*
every one of those reads.

`BrowserState.open()` (`workspace.svelte.ts:3509`) calls `reconciliation.workspaceOpened(root)` at
**line 3530, synchronously, before its first await**. `workspaceOpened()`
(`reconciliationCoordinator.ts:1403-1446`) sets, in this order: `adopted = false`, **`epoch = 0`**,
`watermark = 0`, `lastDiscarded = 0`, `accepted.clear()`, `observationOutcomeRecords.length = 0`,
**`block = { kind: 'running' }`**, `openInProgress = true`. It does **not** set `disposed`.

**The concrete interleaving:**

1. A getter on `batch.newest_sequence` (line 917 — or on `batch.epoch` at 895, or `batch.discarded`
   at 897) synchronously calls `BrowserState.open()`.
2. `workspaceOpened()` runs: `epoch` becomes `0`, `accepted` is cleared, `block` is reset to
   `running`.
3. The getter returns; line 917 completes.
4. Line 919 captures `epoch` — now **`0`** — as `session.epoch`.
5. Every observation of the batch is applied. `applyAddition`'s fence at `:913` evaluates
   `!session.stillApplying() || session.epochNow() !== session.epoch`:
   - `stillApplying()` = `!disposed && block.kind !== 'blockedByLostHistory'` = **`true`** (neither
     was set);
   - `epochNow()` = `epoch` = `0`; `session.epoch` = `0`; `0 !== 0` = **`false`**.
6. The fence passes. This is literally **the replacement lifecycle compared with itself**, which is
   the report's phrase.
7. `sequences.admit(row.id, route.sequence)` then runs against the **cleared** map: `held = 0`, so
   any positive sequence is admitted, `highest.set(id, sequence)` writes the **closed** workspace's
   number into the **replacing** workspace's map, and `admit` returns `true`.
8. `workspace.addDocument(row)` inserts the closed workspace's row into the replacing workspace, and
   `sequences.isNewest(...)` — now `true`, because `admit` just set it — permits the status write.

**The cost is the one 2d-5-4-D measured for the original blocker**, and it is not hypothetical
arithmetic: `crates/espansoconfig-core/src/watch/retained_state.rs` clause 3 says each epoch's
allocator restarts at its first sequence, and `Workspace::from_tree` makes the identity path-stable,
so an entry holding the closed epoch's high-water mark refuses that same file's earliest observations
of the new epoch, each answering `'superseded'` with nothing recording the refusal.

#### The half of D's record this falsifies

`docs/decisions/2d-5-4-D-notes.md` §2.2, bullet 2, states: *"It discriminates. `workspaceOpened` sets
`epoch = 0` **before** `accepted.clear()`, and an adopted epoch is non-zero, so
`epochNow() !== session.epoch` is true the instant a re-open begins."* The first clause is true and
the conclusion **does not follow**, for exactly the ordering above: when the re-open begins *before*
line 919, `session.epoch` is the post-reset value and the comparison is vacuous. See **S2** below,
where the second clause is separately falsified.

#### Not production-reachable today

The batch arrives from `call<ReconciliationBatch>('drain_external_changes', …)`
(`src/lib/ipc/commands.ts:920-921`) — a Tauri `invoke`, hence a JSON-parsed plain object with no
accessors. The one production re-entrancy candidate, `WriteSurfaceTransition`, is registered in
`DetailPane.svelte:669,717` as `tellNobodyYet`, a no-op. **This is the same reachability every
finding of 2d-5-4-B, -C and -D had**, and the brief is explicit that an injected driver is not a
reason to call the fix unnecessary.

#### The smallest fix that closes it at the cause

Not on the batch, and not in `observationTransitions.ts`. A **coordinator-owned monotonic lifecycle
counter, captured before any `batch` property is read**:

- add `let lifecycle = 0;` beside the other `let`s (~line 840);
- `lifecycle += 1;` inside `workspaceOpened()`;
- as the **first statement of `accept()`**, above `if (!adopted)`: `const lifecycleAt = lifecycle;`
- add one conjunct: `stillApplying: (): boolean => !disposed && block.kind !== 'blockedByLostHistory'
  && lifecycle === lifecycleAt`.

Four lines, no new type, no wire change, and it fixes **every** arm at once because `stillApplying`
is the first question both the addition's fence and `applyChange`'s guard ask.

**Why the obvious smaller fix is wrong:** hoisting `const sessionEpoch = epoch;` above line 888 is
not available, because `if (!adopted) { epoch = batch.epoch }` is where the epoch is *legitimately
learned from the batch* (ruling 8) — a capture taken above it would compare the learned epoch against
`0` and refuse every first batch of every session.

**Uncertain:** I have not run the suites, so I cannot say whether the extra conjunct changes any
existing assertion. My reading is that it does not — after a legitimate `open()` the epoch arm of
`applyChange`'s guard already refused with the same `markStaleWhileOurs()` side effect, and
`applyAddition` already answers `'lifecycleMoved'` — but *which arm refuses* changes, and that is
exactly the kind of thing a case can pin. **Not derived: the test impact.**

---

### A2. [BLOCKER] `src/lib/browser/observationTransitions.ts:878` — "Fence routing before declaring other arms safe in isolation"

**Verdict: HOLDS.** The claim is correct, the anchor is correct, and the surviving claim is sharper
than the report's truncated sentence states.

#### The reconstruction

The body breaks off at *"A single Removed observation can have a sequence getter that ca…"* — the only
completion its cited lines support is **"…that calls `open()`"** (or "that can reset the lifecycle").
That is what the code permits.

#### The false sentence

`observationTransitions.ts:878-885`, added by 2d-5-4-D:

> *"{@link applyRemoval} and {@link applyUnreadable} run nothing caller-supplied above their own
> `admit` and so are safe in isolation…"*

and, three lines up at `:874-875`:

> *"This arm is the only one that runs caller code above its own `admit`…"*

#### The derivation

Both sentences are true **of the function bodies** and false **of the call path**. `applyObservation`
(`:814-839`) runs `routeObservation(observation)` *before* dispatching any arm, and
`routeObservation` (`:381-486`) is nothing but caller-controlled property reads on the wire value. For
a `Removed`/`Addressable` observation it reads, in order:

`'Removed' in observation` → `observation.Removed` → `removed.document` → `'Addressable' in document`
→ `removed.sequence` → `document.Addressable` → `document.Addressable.document`.

Every one of those is a getter or a `Proxy` `has` trap the caller supplies. A getter on
`removed.sequence` (or on any of the others) that synchronously calls `BrowserState.open()` reaches
`workspaceOpened` and `accepted.clear()`. `routeObservation` then returns a **plain literal** whose
fields are own data properties — which is what makes the arm bodies' own claim true — and
`applyRemoval` calls `sequences.admit(route.document, route.sequence)` against the **cleared** map,
which admits permissively and returns `true`.

`applyRemoval` then calls `workspace.removeDocument(route.document)` — on the **replacing** workspace —
and, because `admit` just wrote the sequence, `isNewest` answers `true` and
`noteDocumentStatus(d, { kind: 'removed' })` lands there too.

**Which arms the `admit`/`isNewest` asymmetry actually reaches.** Every arm that calls `admit` is
reached, not only the two the sentence names:

| Arm | `admit` reached on a cleared map? | What lands in the replacing workspace |
|---|---|---|
| `applyRemoval` (`:1218`) | yes | `removeDocument` + `{ kind: 'removed' }` status, both permitted |
| `applyUnreadable` (`:1260`) | yes | `{ kind: 'unavailable', reason }` status, unconditional |
| `applyChange` (`:958`) | yes — `admit` is its **first statement**, and its lifecycle questions are inside the async `guard()` far below | map contamination, plus `noteWhileOurs`'s `unavailable`/`stale` writes, which `isNewest` now permits |
| `applyNamedRow` (`:1296`) | yes | `requestMembershipReload()`, possibly `removeDocument` + a status |
| `applyUnnamedPath` (`:1370`) | n/a — **it never arbitrates at all** | `notePathDrift` unconditionally |
| `applyAddition` (`:905`) | **no** — its fence sits below routing, and in *this* interleaving `session.epoch` was captured before the reset, so `epochNow() = 0 !== session.epoch` and it answers `'lifecycleMoved'` | nothing |

So `applyAddition` is the **only** arm the fix defended, and the sentence that declares the others
safe is the inverse of what the code does.

#### The smallest fix that closes it at the cause

One insertion in `applyObservation`, above the switch and **below** `routeObservation`:

```ts
const route = routeObservation(observation);
if (!session.stillApplying() || session.epochNow() !== session.epoch) {
  return 'lifecycleMoved';
}
switch (route.kind) { … }
```

It covers all six arms with one comparison per observation, needs no new type, and **`applyAddition`'s
own fence still earns its place** — the spread at `:911` and the `in` at `:912` run *after* this point,
so the narrower fence is not made redundant by the broader one. That is also what the report's
truncated *"Retain addition's later check because…"* was reaching for.

**This fix alone is not sufficient**, and saying so is the point of running the two findings together:
in A1's interleaving the newly inserted comparison is `0 !== 0` as well. **A1's fix is the
load-bearing one**; A2's is what widens it from one arm to six.

#### Also not production-reachable today, for A1's reason

Same JSON-parsed boundary, same no-op `WriteSurfaceTransition`.

---

### A3. [SHOULD-FIX, record-only] `docs/decisions/2d-5-4-notes.md:523`

**Verdict: HOLDS — and it is an instance, not a historical quotation.** This is the distinction
`2d-5-4-D-notes.md` §9 item 3 warns about, and it comes down on the *instance* side.

The passage runs 523-525; **the claim is at line 525**:

> *"Both are cleared by `open()`, for `projectionGenerations`' reason: a status is keyed by an
> identity the load is about to reallocate."*

It is in the **present tense**, it is the record's own voice, it **justifies an action** (clearing
`externalStatuses` and `pathDrift`), and nothing around it marks it as struck or quoted. There is no
`~~strikethrough~~`, no correction block and no attribution to an earlier round. That is what makes it
an instance rather than a faithful quotation of a claim struck elsewhere.

#### The contract it contradicts, in the contract's own words

`crates/espansoconfig-core/src/workspace/mod.rs`, `Workspace::from_tree` (`:475-481`):

> *"Identities come from the **session's path table**, not from the tree's order, so they are stable
> across two `open` calls of a directory that *changed* as well as one that did not: adding a file
> gives that file a fresh identity and moves nobody else's, and removing one leaves its identity
> unmatched rather than handing it to a neighbour."*

`identity_already_issued` (`:331-356`):

> *"Path identity is deliberately process-lifetime-stable — the session identity table this module
> keeps — so the same path answers the same number for as long as the process runs, a recreation at
> that path included."*

`identity_of` (`:316-327`) returns the existing entry for a known path before minting; `SessionIdentities.next`
(`:217-218`) is *"Never reused, so a removed file's identity cannot be inherited by another file."*

So `open()` reallocates nothing. The true reason for the clear is the one the source comment now
carries at `workspace.svelte.ts:3559-3563` — a status is what the watcher said about a file *while the
closed workspace was open*, and a drift is a statement about which files *that* workspace held.

#### Smallest fix, and the §7.1 consequence

Replace line 525's subordinate clause with the true reason, in place. It is under `docs/`, so it is
**record**: under §7.1 fixing it **commissions no round**.

---

## Part B — the sweep

Ordered by severity. **Source / record** is marked on each, because under §7.1 that is what decides
whether the fix commissions another round.

### S1. [HIGH — source] `src/lib/browser/observationTransitions.ts:914-917` — the fence's own comment claims of an *injected interface* what is only true of one implementation

The comment 2d-5-4-D wrote under the new fence:

> *"…both members are the coordinator's own closures over its own `let`s, so nothing between this line
> and the arbitration below runs anything a caller supplied."*

`session` is a parameter of type `ObservationSession` — an **interface**. `stillApplying` and
`epochNow` are declarations, and `epoch` is `readonly number`, which in TypeScript does **not**
exclude an accessor and does not freeze at runtime. Line 913 performs three injected member accesses
(`session.stillApplying()`, `session.epochNow()`, `session.epoch`) in that order, so caller code can
run *between the two halves of the comparison the fence is made of*.

This is the class `CLAUDE.md` names: *where TypeScript cannot force something, say so in the same
sentence that describes what it does force*. The module already knows how to say it — the
`stillOurs` JSDoc at `:975-985` writes the disclaimer out in full: *"That is a property of that
implementation and not of the type, and a later store with a getter behind `isNewest` would put a
callback back inside a guard."* The new comment makes the identical assertion with the disclaimer
**omitted**, and it does so in the one place whose entire threat model is an injected boundary.

It is also the source-side face of A1: the comment reasons about what runs *after* the fence and says
nothing about what ran *before* `session.epoch` was captured.

**Smallest fix:** append `stillOurs`'s own disclaimer sentence to the comment — that this is a
property of the coordinator's implementation and not of `ObservationSession`, and that the value
`session.epoch` carries is only as trustworthy as the moment its producer captured it. **Source**, so
it commissions a round.

### S2. [MEDIUM — record] `docs/decisions/2d-5-4-D-notes.md` §2.2 bullet 2 — *"an adopted epoch is non-zero"* is a Rust invariant the TypeScript explicitly refuses to force

Two independent failures in one sentence; A1 covers the first, this covers the second.

`accept()`'s own comment at `reconciliationCoordinator.ts:892-893` says the opposite in as many
words: *"**Epoch `0` is adopted exactly like any other**; what it means is `watchState()`'s
business."* So on the TypeScript side a session whose adopted epoch is `0` is a supported state, and
in it `epochNow() !== session.epoch` can **never** fire — the fence is reduced to `stillApplying()`
alone.

Production keeps it out of reach, and the reason is worth naming rather than assuming:
`src-tauri/src/watch.rs:159,168` fix `FIRST_WORKSPACE_EPOCH = 1` and `NO_EPOCH = 0` (*"never a real
epoch"*), and `ReconciliationBatch::epoch`'s doc (`src-tauri/src/reconciliation.rs:692-700`) says
**"A drain can see that value"** when the epoch space is exhausted — but that *"such a workspace is
watched by nothing and its batch is always empty"*. An injected batch is bound by none of that, and
the injected boundary is the only place the fence matters at all.

So the record states as an unconditional property of the fence something that holds only because of a
Rust-side invariant that does not reach the boundary being defended.

**Smallest fix:** rewrite the bullet to say what the fence actually discriminates on — `stillApplying`
in the general case, and the epoch only where the session has adopted a non-zero one — and name
`accept()`'s comment as the reason the epoch half is not a guarantee. **Record**, so it commissions
no round.

### S3. [LOW — source] `src/lib/browser/observationTransitions.ts:874-875` — a narrower wording of A2's false claim, four lines above it

> *"This arm is the only one that runs caller code above its own `admit`…"*

Same defect as A2, in a different sentence in the same doc block. Recording it separately because
this chain's recurring failure is a fix written against the *previous wording* that leaves the
narrower instance standing (`CLAUDE.md`: *sweep for what the type now says*). **Any fix for A2 must
close this line in the same pass**, and it is **source**.

The same claim also stands in the record at `docs/decisions/2d-5-4-D-notes.md` §2.1 — *"`applyChange`,
`applyRemoval`, `applyUnreadable` and `applyNamedRow` all admit on an own data property of the literal
`routeObservation` built"* — which is true as stated and is then used to conclude that `applyAddition`
was the only exposed arm, which A2 falsifies. That half is **record**.

### S4. [LOW — record] `docs/decisions/2d-5-4-D-notes.md` §4 — a `file:line` citation that is off by eight at the tree it was written against

§4's sweep paragraph says: *"One near miss was checked and left: `workspace.svelte.ts:3682` says
*"the injected `report` on the failure arm"*."* At HEAD — which is the tree this record was committed
with, both in `4f7c500` — that phrase is at **`workspace.svelte.ts:3690`**; line 3682 is inside the
projection loop's body. The *substance* of the near miss is correct (it is the projection loop's own
`view.failure` arm, not the deleted one). **Record.**

Every other citation I checked resolves: `workspace.svelte.ts:545` (`ownedMatchIdOf` inside
`ownedMatchOf`), `workspace.svelte.ts:2310`, `rawDocument.test.ts:84`,
`docs/reviews/phase-2d-5-design.md:147-163` and `:246-256`, and `crates/…/workspace/mod.rs`'s
`identity_of` / `from_tree` / `identity_already_issued`.

### S5. [LOW — record] `docs/decisions/2d-5-4-notes.md:525` has a twin the review did not cite

The shape sweep for the *rationale* rather than the word found a second live instance:
`docs/decisions/2d-5-2b-notes.md:361` — *"…load is about to reallocate. Nothing reads it there
today."* It is the same present-tense justification and is **not** marked struck. Both are
**record**; both are inside the 23 occurrences `2d-5-4-D-notes.md` §9 item 3 nominates, and neither
commissions a round.

---

## Part C — the five brief pointers, answered, and what the sweep cleared

1. **The fence's placement, and the two closures.** The fence at `:913` does sit above every
   caller-controlled statement *of that arm*, and nothing between it and `admit` at `:920` runs caller
   code. At the **one production call site** — `reconciliationCoordinator.ts:951` is the only
   `applyObservation` call in `src/` outside tests — `stillApplying` and `epochNow` are genuinely
   closures over the coordinator's `let`s (`:925`, `:938`) and `session.epoch` is an own data property
   of the literal at `:918-945`. The brief's *"both of this module's call sites"* has no second
   production referent; the second is `observationTransitions.test.ts`'s `recordingSession()`
   (`:266-294`), whose `epoch` is likewise an own data property and whose `epochNow` reads a mutable
   `live` field. **What fails is not the closures; it is *when* `session.epoch` was captured** — A1.
   The discrimination claim's second half fails independently — S2.

2. **`'lifecycleMoved'`, the ninth arm.** The record is right that it buys no compile-time check, and
   I verified it rather than accepting it. `ObservationOutcome`'s only consumer is
   `observationOutcomes()` (`reconciliationCoordinator.ts:1498-1499`), which copies the array for
   tests; **nothing switches over the union anywhere**. The two docs it leans on still say what
   §2.3 quotes: `'superseded'` at `observationTransitions.ts:760` (*"A newer observation for the same
   file has already been admitted"*) and `observationsDropped` at
   `reconciliationCoordinator.ts:617-624` (*"one superseded by a newer sequence is on
   `observationOutcomes` as `superseded`, which is arbitration rather than loss"*).
   `workspaceOpened` really does empty the outcome list (`:1422`). **Nothing treats an unknown outcome
   as a failure or as an admission**: the six test assertions use exact-array `toEqual`, and
   `observationsDropped` counts only what a *blocked* coordinator threw away, which a `lifecycleMoved`
   observation is not. No finding.

3. **The sixteen rewritten comments, and the seventeenth instance.** `rg -i reallocat` over `src/`,
   `crates/`, `src-tauri/` and `scripts/` finds **nothing** — the record's claim checks out. The
   by-shape sweep (`different file|another file|new identit|fresh identit|re-issue|identities
   (are|change|move)|renumber|re-mint`, then every line joining `open()`/`reopen` with
   `identit|denote`, then the rationale shape `keyed by an identity|about to reallocate|load is about
   to`) found **no seventeenth source instance and no narrower source wording**. The two near misses
   are both correct: `crates/…/workspace/mod.rs:205` is the *rejected* positional design in the past
   tense (*"Identities used to be the enumeration position…"*), and `workspace.svelte.ts:2310` says
   only that a successful `open()` replaces `documents`, which is true. The rewritten sites I checked
   against the Rust contract — `reconciliationCoordinator.ts:514-520` and `:1409-1414`,
   `workspace.svelte.ts:2199-2210`, `:2278-2288`, `:3535-3541`, `:3559-3565`,
   `observationTransitions.ts:226-239` — each state something true of that site. The only survivors
   are under `docs/` (**A3**, **S5**).

4. **The unconditional status write in `applyAddition` (`:928-930`).** It is the **same** fence
   `applyRemoval` uses: `sequences.isNewest(key, route.sequence)` with the key materialized once into
   an own data property (`row.id` at `:911`, `route.document` at `:1234`), so no caller code runs
   between the check and the write in either. **It cannot clear a mark a newer observation wrote**: if
   `addDocument` admits something newer, `isNewest` is `false`; if `addDocument` *clears* the map, the
   route's positive sequence no longer equals the map's `0` and the fence still fails safe. A
   sequence of `0` cannot reach the write, because `admit` refuses it first (strictly greater). The
   in-flight reread half of the brief's question also holds: `noteDocumentStatus` bumps `statusWrites`
   (`workspace.svelte.ts:2930`), and the reread's clear is gated on `statusAt === statusWriteOf(document)`
   (`:3075`, `:3146-3148`), so the addition's write suppresses the older read's clear rather than being
   overwritten by it. A same-batch `Named` row for the same identity carries a higher sequence and
   wins through its own fenced writer. **No finding.**

5. **The three correction blocks.** All three check out against the code they describe.
   `2d-5-4-B-notes.md` §? (the `markStaleWhileOurs` block): the struck half really was false — the
   host's own reread member writes a `stale` for an admitted `Changed` outside that writer
   (`workspace.svelte.ts:2466-2468`) and `applyNamedRow` carries a second one
   (`observationTransitions.ts:1319-1326`). `2d-5-4-notes.md`'s `id` correction: `ownedMatchOf` does
   copy `id` through `ownedMatchIdOf` at `workspace.svelte.ts:545`, and that function's header at
   `:537` does name it *"the one exception"*. `2d-5-4-C-notes.md`'s re-pointing of `709-712`: at HEAD
   those lines hold a different paragraph of `ownedRepair`'s header, so the re-pointing is warranted —
   *"an unrelated paragraph"* is a shade generous (it is the same header, a different paragraph), and
   that is not worth a finding. The correction that corrects a correction — the deleted failure arm —
   is right: the arm is gone and `rereadUnderGuard`'s JSDoc at `:2431-2449` records it.

---

## Part D — what I could not derive, and where I am uncertain

- **Nothing here was measured.** I ran no test, build, `cargo` or `npm` command. Every statement above
  is a reading of source at HEAD. Where 2d-5-4-D reports a measured figure (the `1320 / 443 / 2406 /
  189` gates, the pre-fix failure messages, `sequenceFor(42)` being `500`), I checked the *reasoning*
  and not the number.
- **The test impact of A1's proposed fix is not derived.** Adding a `lifecycle === lifecycleAt`
  conjunct to `stillApplying` changes *which* guard arm refuses after a legitimate `open()`. My
  reading is that the observable outcome and the `markStaleWhileOurs` side effect are unchanged, but a
  case asserting the refusing arm would move, and I cannot check that without running the suite.
- **I read two of the 23 `docs/` occurrences** of the identity claim — `2d-5-4-notes.md:525` (A3) and
  `2d-5-2b-notes.md:361` (S5) — plus the counts `2d-5-4-D-notes.md` §7 lists. **The other 21 were not
  read**, so no count here supersedes §9 item 3's *"seven were read, sixteen were only counted"*.
- **Production reachability is derived from two facts, not from tracing the deserializer.** The batch
  comes from a Tauri `invoke` (`commands.ts:920-921`) and the one registered `WriteSurfaceTransition`
  is a no-op (`DetailPane.svelte:669`). I did **not** trace the `listen()`/event path that wakes a
  drain, so *"no accessor can reach `accept()` in production"* is my reading of those two facts and
  not an exhaustive proof.
- **Not derived: whether A1 and A2 are separately exploitable through `batch.observations`' iterator.**
  `for (const observation of batch.observations)` reads a caller-supplied `Symbol.iterator`; I believe
  that path is caught by `applyAddition`'s existing fence (the session literal is already built, so
  `session.epoch` is pre-reset) and by A2's proposed fence for the other arms, but I did not enumerate
  the iterator-protocol interleavings.
- **No opinion is offered on whether a window reading is owed.** The brief declares none is, and this
  round changed no `.svelte` file; I did not re-derive that.

---

## Part E — what this implies under §7.1

Two of the three review findings (**A1**, **A2**) and two sweep items (**S1**, **S3** source half)
are **source**. **A3**, **S2**, **S4**, **S5** and **S3**'s record half are **record**.

So a fix round that closes A1, A2, S1 or S3 **changes at least one source file, and §7.1 commissions a
further scoped round.** A fix round that closed only A3, S2, S4 and S5 would change no source file and
would commission nothing — but that is not available here, because A1 and A2 name correctness defects
in source, which §7.3 makes blockers: they are fixed now, or the step is held open and marked
`BLOCKED` with them named.
