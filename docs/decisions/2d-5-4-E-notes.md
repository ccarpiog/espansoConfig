# Phase 2d-5-4-E — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4-D's fix

**Status: taken and answered.** Risk class: **high**. Components: **none** — no `.svelte` file was
modified, so no window reading is owed.

This is **not** an implementation step. §7.1: *a fix round that changes at least one source file is
owed a review round, scoped to that change.* Phase 2d-5-4-D's fix changed eight source files; this is
the round that reviews **that fix**. Its own fix changes source, so §7.1 commissions a further round —
§8 says so and says what it is scoped to.

The documents: the brief [`docs/reviews/phase-2d-5-4-E.brief.md`](../reviews/phase-2d-5-4-E.brief.md),
the review [`docs/reviews/phase-2d-5-4-E.md`](../reviews/phase-2d-5-4-E.md), and the re-derivation
[`docs/reviews/phase-2d-5-4-E.rederivation.md`](../reviews/phase-2d-5-4-E.rederivation.md).

---

## 1. How the round was run

**The review was Codex**, verdict `ship-with-fixes`, **3 findings: 2 blockers and 1 should-fix**, over
the committed fix `4f7c500`.

**The finding bodies arrived truncated for the sixth round running**, so the same three-stage shape was
used and nothing was accepted on the report's strength:

1. a **read-only re-derivation worker** derived each finding from the source alone, reconstructed the
   strongest reading each truncated sentence's cited lines support, corrected one anchor, and swept
   for what the review had missed — finding five more, all established;
2. **all three review findings hold**, one (A1) with its anchor **half wrong** in the way this chain
   keeps producing: `observationTransitions.ts:913` is where the symptom is visible and
   `reconciliationCoordinator.ts:917-919` is the cause;
3. this fix round closed all eight, derived **two further instances of A1's own shape** for itself
   before fixing them (§2.3 and §2.4), and pinned every behavioural change with a case confirmed to
   fail against the pre-fix code.

**One sentence of the re-derivation is corrected here rather than carried forward**, because a record
is checked against the code and not the other way round:

| What the re-derivation said | What is true |
|---|---|
| A1's smallest fix: *"add one conjunct: `stillApplying: () => … && lifecycle === lifecycleAt`"* | That would have made **`applyChange`'s guard doc false in the same commit**. That doc says `stillApplying` *"is not a generation comparison and there is no number it could be folded into"*, and folding a counter into it is exactly that. The question is a **fourth** member of `ObservationSession` instead — `lifecycleIsOurs` — which leaves `stillApplying`'s enumerated two states, and the guard's justification for asking it first, true as written. |

---

## 2. A1 — the lifecycle fence's baseline was captured after caller-controlled batch reads

> `src/lib/browser/observationTransitions.ts:913` / `reconciliationCoordinator.ts:917-919` — BLOCKER,
> source.

### 2.1 Verdict: **HOLDS**, and the fence was never the defective part

`accept()` read `batch.epoch`, `batch.discarded` and `batch.newest_sequence` **above** the
`ObservationSession` literal, which captures `epoch` by value. Every one of those is a property read
on a value that crossed an injected boundary, so each can run caller code through a getter or a
`Proxy` trap. A getter that synchronously calls `BrowserState.open()` reaches
`reconciliation.workspaceOpened(root)` — `workspace.svelte.ts` calls it before its first await — which
sets `epoch = 0`, clears `accepted`, empties the outcome record and puts `block` back to `running`,
and does **not** set `disposed`.

The session literal then captured the **already-reset** epoch, so `applyAddition`'s fence evaluated
`!disposed && block.kind !== 'blockedByLostHistory'` → `true` and `0 !== 0` → `false`, passed, and
`admit` ran against the cleared map. **That is the replacement lifecycle compared with itself.**

**The cost is not hypothetical arithmetic.** `admit`'s contract is *strictly greater than what is
held*, and after a clear nothing is held, so any positive sequence is admitted and the closed
workspace's number is written into the replacing workspace's map. `Workspace::from_tree` makes a
`DocumentId` path-stable, and `retained_state.rs` clause 3 restarts each epoch's allocator at its
first sequence — so an entry holding the closed epoch's high-water mark refuses that same file's
earliest observations of the new epoch, each answering `'superseded'` with nothing recording the
refusal. §8's pre-fix measurement is that number: **500**.

**Not production-reachable today**, and that is not a reason to leave it: the batch arrives from a
Tauri `invoke`, so it is a JSON-parsed plain object, and the one production re-entrancy candidate,
`WriteSurfaceTransition`, is registered in `DetailPane.svelte` as `tellNobodyYet`, a no-op. This is
the same reachability every finding of 2d-5-4-B, -C and -D had, and the injected boundary is the only
place any fence in this module matters at all.

### 2.2 The counter, and every site that moves it

**No existing monotonic value was incremented at those sites, so this was checked before one was
added.** Every other number in `createReconciliationCoordinator` is either cleared by
`workspaceOpened()` (`epoch`, `watermark`, `lastDiscarded`, `discardedNoticeCount`,
`observationsDroppedCount`) or lives on the injected host (`openGeneration()`, which a host may move
without ever announcing an open, and which is caller code to read). `disposed` is a one-way boolean
and says nothing about a replacement. So `reconciliationCoordinator.ts:786` is new:

```ts
let lifecycle = 0;
```

**The three increment sites, each justified:**

| Site | Line | Why it ends the applying lifecycle |
|---|---|---|
| `workspaceOpened()` | `:1537` | The one the fence exists for. It clears `accepted` — the map `admit` answers permissively when empty — along with the cursor and the outcome record. The increment is its **first** statement, above every clear, so caller code re-entering part-way through the reset already sees a lifecycle it cannot claim rather than a half-cleared one it can. |
| `recoverFromLostHistory()` | `:899` | The one place this coordinator asks for the workspace it is applying to be replaced. It is moved **before** `host.reopenWorkspace(...)` rather than left to the announcement, because nothing in TypeScript forces a host to announce — that call's own comment says so. It cannot rescue the batch being applied when it runs: `accept()` returns immediately below it, having already compared its own capture. |
| `dispose()` | `:1510` | **Redundant today and kept anyway.** `stillApplying()` reads `disposed` live, so every fence already refuses after it. What the increment keeps true is the rule *every site that ends the applying lifecycle moves the counter*, so a reader does not have to re-derive which of two values covers which site. The comment beside it says it is redundant, in the same sentence that says why it is there. |

**What no type forces, said where it is done:** `lifecycle` is a plain `let`, and a fourth reset site
added without a `lifecycle += 1` would compile and silently widen every fence built on it. The
comment above the declaration says exactly that.

### 2.3 Where the capture is taken — and the two reads above `accept()` that the review did not name

The brief requires the capture to be *the first thing that happens, above every `batch.*` read*, and
adds *"and at this module's other call site if that one reads caller-controlled values first too."*
`accept()` has exactly one call site, `runOneDrain`, and **it does read caller-controlled values
first**: `answer.ok`, then `answer.value` on the line that calls `accept`. `answer` is whatever the
injected `host.drain()` resolved with, so a getter on `value` moves the lifecycle *before `accept()`
is entered at all* — and a capture taken as `accept()`'s first statement would be the post-reset
value, which is A1 again one frame up.

So the capture is `runOneDrain`'s, at `:1085`, as the **first** of its captures — above
`host.openGeneration()`, which is itself a call on the injected host — and it is handed to `accept` as
a parameter (`:950`) rather than re-read there. §8's third case is what pins the placement: it moves
the lifecycle from a getter on the `CommandResult` itself, and only a capture taken before that line
survives it.

**What this does not claim.** It is not a stronger form of the open-generation capture and does not
replace it: that one asks an injected host, and this one compares a `let` nothing outside the factory
can reach. Neither subsumes the other, and both are kept.

### 2.4 The cursor is the half no per-observation fence could protect

Deriving 2.3 exposed a third instance of the same shape, in the same function, and it is **not** the
one the review found. `accept()`'s reads were *interleaved with the writes they fed*:
`epoch = batch.epoch`, then `lastDiscarded = batch.discarded`, then `watermark = batch.newest_sequence`.
A getter firing in the middle of that sequence left the **cursor** carrying a closed lifecycle's epoch
and watermark into the replacing one — with `adopted` re-set to `true` by the line above the getter —
which is precisely the state `workspaceOpened`'s own comment says poisons `onWake` for the session.
**No fence in `observationTransitions.ts` can defend that**, because it happens before any observation
is routed.

The fix is the smallest that closes it at the cause: `accept()` reads the batch's four members into
locals **first**, compares the lifecycle **once**, and only then writes anything (`:951-954` and `:955-963`). Every
existing branch afterwards uses the locals. Two early returns that were `return` are now `return true`
— a batch refused under ruling 10 *was* accounted for, and the recovery is this session's own act
rather than a lifecycle that moved under it.

`runOneDrain` records `'staleOpen'` when `accept` answers `false` (`:1274`). **No tenth `DrainOutcome`
arm was invented**, and that is a claim about the fact rather than about economy: `'staleOpen'` already
means *an `open()` landed while the call was in flight, so it installed nothing*, and a getter that
reopens the workspace from inside the answer's own reads is an open landing while the call is in
flight. Its doc now says both halves.

### 2.5 What each half of the fence discriminates, and what it does not

`lifecycleMovedUnder` (`observationTransitions.ts:849`) is the single producer of the three questions,
so two fences cannot drift; before it, the expression was written out at one site and would have had
to be written out again at the second.

- **`stillApplying()`** answers disposal and the blocked state, and **nothing about a replaced
  workspace** — its own doc says so and is unchanged.
- **`lifecycleIsOurs()`** answers a replacement, a disposal and a self-requested reopen, and **nothing
  about which epoch is showing now**: it is a counter, so a `false` means *something ended that
  lifecycle since the capture*, never *this is the epoch that replaced it*.
- **The epoch comparison** answers *a different workspace epoch is showing*, and is **vacuous for a
  session that adopted `0`** — see §4. It is kept as the cheap, specific question beside the counter,
  not as the load-bearing one.

**None of the three is forced by a type**, and the fence's own comment now says so: all three are
members of an injected interface, `session.epoch` is a `readonly` declaration rather than a frozen
value, and `readonly` does not freeze at runtime. The coordinator's implementation — three closures
over its own `let`s and one own data property — is a property of that implementation alone.

---

## 3. A2 — `routeObservation()` runs caller code above *every* arm's `admit`

> `src/lib/browser/observationTransitions.ts:878` — BLOCKER, source.

### 3.1 Verdict: **HOLDS**, and the surviving claim is sharper than the review's sentence

Two sentences 2d-5-4-D wrote were **true of the function bodies and false of the path that reaches
them**:

> *"{@link applyRemoval} and {@link applyUnreadable} run nothing caller-supplied above their own
> `admit` and so are safe in isolation…"*

`applyObservation` runs `routeObservation(observation)` **before** it dispatches any arm, and that
function is nothing but caller-controlled property reads and `in` checks on the wire value. For a
`Removed`/`Addressable` observation it reads `'Removed' in observation`, `observation.Removed`,
`removed.document`, `'Addressable' in document`, `removed.sequence`, `document.Addressable` and
`document.Addressable.document` — every one a getter or a `has` trap the caller supplies. So **a
single `Removed` observation can reset the lifecycle inside its own routing**, before its arm is
entered.

The asymmetry 2d-5-4-D established is what makes it matter, and it reaches five arms rather than one:

| Arm | Reaches `admit` on a cleared map | What lands in the replacing workspace |
|---|---|---|
| `applyRemoval` | yes | `removeDocument` and a `{ kind: 'removed' }` status, both permitted |
| `applyUnreadable` | yes | an `{ kind: 'unavailable', reason }` status |
| `applyChange` | yes — `admit` is its **first statement** | map contamination, plus the `unavailable`/`stale` writes `isNewest` now permits |
| `applyNamedRow` | yes | `requestMembershipReload()`, possibly `removeDocument` and a status |
| `applyUnnamedPath` | n/a — it never arbitrates | `notePathDrift` unconditionally, as before |
| `applyAddition` | no — its own fence is below routing | nothing |

### 3.2 The fix, and why `applyAddition` keeps its own

One insertion in `applyObservation`, below `routeObservation` and above the switch
(`observationTransitions.ts:912`), answering `'lifecycleMoved'`. It covers all six arms with one
comparison per observation and needs no new outcome arm.

**It does not make `applyAddition`'s fence redundant, and that is derived rather than assumed.** The
route `routeObservation` returns is a plain literal whose fields are own data properties, so nothing
between the new fence and any arm's `admit` runs caller code — *except* in `applyAddition`, whose
spread `{ ...route.summary, loaded: false }` and `'Unreadable' in route.content` run seven accessors
and a `has` trap **after** routing has returned. That window is what its own fence sits below.

**`applyChange`'s guard was deliberately not widened to the third question**, and the reason is in
`applyAddition`'s doc where a reader will look for it: what catches a replacement across that guard's
await is the host's own open-generation capture inside `rereadUnderGuard`, which the guard's doc
already names. Adding the counter there would have been a third comparison the brief did not
authorise and a rewrite of a five-question justification; §9 item 2 records what that leaves.

---

## 4. S2 — *"an adopted epoch is non-zero"* is a Rust invariant that does not reach this boundary

> `docs/decisions/2d-5-4-D-notes.md` §2.2 bullet 2 — MEDIUM, record.

`accept()`'s own comment says the opposite in as many words: *"Epoch `0` is adopted exactly like any
other; what it means is `watchState()`'s business."* So on the TypeScript side a session whose adopted
epoch is `0` is a **supported** state, and in it `epochNow() !== session.epoch` can never fire — the
2d-5-4-D fence reduces to `stillApplying()` alone.

What keeps `0` out of production is `src-tauri/src/watch.rs`'s `FIRST_WORKSPACE_EPOCH = 1` and
`NO_EPOCH = 0` (*"never a real epoch"*). **An injected batch is bound by neither**, and the injected
boundary is the only place the fence matters.

This is why the epoch **could not** be the token the review proposed, and it is the whole reason the
new discriminator is a counter rather than a stronger reading of the epoch. The bullet is struck and
rewritten in place, naming `accept()`'s comment as the reason the epoch half is not a guarantee, and
both halves of the old bullet are answered — the ordering half by A1, this half here.

---

## 5. S1 and S3 — two comments in source, one claiming a guarantee and one narrower than A2's

**S1 (HIGH, source)** — the fence's own comment asserted of the **injected** `ObservationSession`
(*"both members are the coordinator's own closures over its own `let`s"*) what is true only of one
implementation. `session` is a parameter of an interface type: `stillApplying` and `epochNow` are
declarations, `epoch` is `readonly number` — which in TypeScript neither excludes an accessor nor
freezes at runtime — and the fence performs three injected member accesses in sequence, so caller code
can run *between the two halves of the comparison the fence is made of*. This module already knows how
to say it: `applyChange`'s `stillOurs` JSDoc writes the disclaimer out in full. The new comment now
carries it too, and the fuller version is on `ObservationSession.lifecycleIsOurs`
(`observationTransitions.ts:728`).

**S3 (LOW, source)** — *"This arm is the only one that runs caller code above its own `admit`"*, four
lines above A2's sentence: a **narrower wording of the same false claim**, which is this chain's
recurring failure mode. Both are replaced in the same pass, with the narrower claim that is true
stated explicitly: this is the only arm with caller code above its `admit` **inside its own body**.

`2d-5-4-D-notes.md` §2.1's record twin is corrected too, and the correction distinguishes the two
halves: *those four arms admit on own data properties of the route literal* stays true as stated; what
does not follow is the conclusion drawn from it, that `applyAddition` was the only exposed arm.

---

## 6. A3, S5 and S4 — three record fixes

**A3 (SHOULD-FIX, record)** — `docs/decisions/2d-5-4-notes.md`: *"a status is keyed by an identity the
load is about to reallocate."* It is present tense, in the record's own voice, justifying an action,
with no strikethrough and no attribution to an earlier round — so it is an **instance** of the claim
2d-5-4-D struck in sixteen source comments, not a quotation of one. `open()` reallocates nothing:
`Workspace::from_tree` takes identities from the session's path table, `identity_of` returns the
existing entry for a known path, and `identity_already_issued` says the same path answers the same
number for as long as the process runs, a recreation included. Struck, with the true reason in its
place — a status is what the watcher said while the **closed** workspace was open.

**S5 (LOW, record)** — the same claim, live, at `docs/decisions/2d-5-2b-notes.md`, found by sweeping
for the *rationale* rather than for the word. Struck and corrected the same way.

**S4 (LOW, record)** — `2d-5-4-D-notes.md` §4 cited `workspace.svelte.ts:3682` for a phrase that is at
`:3690`. The number was **re-derived rather than either number trusted**: `rg -n "failure arm"` over
that file answers `678`, `2431`, `3072` and `3690`, and `3690` is the line holding *"the injected
`report` on the failure arm"*. `3682` is inside the projection loop's body. The substance of the near
miss was right; only the citation was wrong, and it was wrong at the tree the record was committed
with.

---

## 7. What this round deliberately did not do

- **It built no machinery the brief ruled out.** No token is carried on the batch, no lifecycle
  object, no event and no subscription. What was added is one `let`, three increments, one capture,
  one parameter, one interface member, one shared predicate and two comparisons.
- **It did not fold the counter into `stillApplying`**, which was the re-derivation's proposal. §1
  says why: `applyChange`'s guard doc states that `stillApplying` is not a generation comparison and
  that there is no number it could be folded into, and folding one in would have falsified that
  sentence in the same commit as the fix.
- **It did not widen `applyChange`'s guard** to the third question. §3.2 says what defends it instead
  and §9 item 2 records what is left.
- **It did not touch the remaining 21 `docs/` occurrences** of the false identity claim that
  `2d-5-4-D-notes.md` §9 item 3 counts. Two were named by this round's re-derivation and both are
  fixed here; the rest are record, they commission no round, and they were outside the brief.
- **It ran no `cargo` command of any kind.** The orchestrator owns the Rust gate; `cargo test
  --workspace` is flaky on this host.
- **It touched none of the four instrument paths.** `git diff --stat` over `src-tauri/src/main.rs` and
  `src/main.ts` is still `5 insertions(+), 1 deletion(-)`.
- **It edited neither `PROGRESS.md` nor `PROGRESS.json`.**

---

## 8. The gates, and every pre-fix failure message

| Gate | Command | Exit | Figure | Moved? |
|---|---|---|---|---|
| Rust | *not run* — the orchestrator owns it | — | **1320** as of 2d-5-4-D | no Rust changed; `git diff --numstat -- crates/ src-tauri/` names only the instrument's `main.rs` hook |
| `svelte-check` | `npm run check` | **0** | **443 FILES 0 ERRORS 0 WARNINGS** | **unmoved** — no file entered or left the set |
| vitest | `npm test` | **0** | **2409** tests, 61 files | **+3** — exactly the three cases below |
| vite | `npm run build` | **0** | **189 modules** | **unmoved** — no new source module and no new styled component; every change is inside four files that were already in the graph |

**Both bundle oracles were read**, and both lines rather than one, because the server-only search is
vacuous on its own: `rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` matched
**nothing** (absent, as required) and `rg -c 'window\.__svelte|svelte-trusted-html'
dist/assets/index-*.js` answered **2** (present, as required).

The previous rung was `1320 / 443 / 2406 / 189`. The only figure that moved is `npm test`, by the
three new cases; the module count could not move under §4's ladder, because nothing added a `.ts`
module or a `.svelte` component.

### 8.1 Every case was confirmed against the pre-fix code

The method: restore `observationTransitions.ts` and `reconciliationCoordinator.ts` from
`git show HEAD:<path>` — the whole pre-fix tree, not a partial revert — run the suites with the new
cases in place, record the message verbatim, restore the fixed files, and re-run to green (112 passed
across the two suites).

**Three cases, all new. Two suites.**

| Fix | The case | What it said before the fix |
|---|---|---|
| §3 the routing fence | `observationTransitions.test.ts:1232` — *refuses a removal whose own routing reopened the workspace* | `AssertionError: expected 'removed' to be 'lifecycleMoved' // Object.is equality` |
| §2.4 the materialized reads and the single comparison in `accept()` | `reconciliationCoordinator.test.ts:1613` — *writes nothing when the batch's own getter reopened the workspace* | `AssertionError: expected [ { id: 42, …(6) } ] to deeply equal []` |
| §2.3 the capture taken in `runOneDrain`, above the answer's own reads | `reconciliationCoordinator.test.ts:1669` — *writes nothing when the command answer's own getter reopened the workspace* | `AssertionError: expected [ { id: 42, …(6) } ] to deeply equal []` |

**Each case's first assertion masks the ones that measure the finding, so those were measured
separately** by suspending the assertion above them and re-running against the same pre-fix tree:

- the routing case, with the outcome assertion suspended: `AssertionError: expected [ 42 ] to deeply
  equal []` — the closed workspace's removal lands in the one replacing it;
- the routing case, with the workspace assertions suspended as well: `AssertionError: expected 500 to
  be +0 // Object.is equality`;
- both coordinator cases, with `control.added` suspended: `AssertionError: expected 500 to be +0 //
  Object.is equality`.

**`500` is the figure that measures the finding rather than its symptom**, and it is the same number
2d-5-4-D measured for its own blocker. The replacing workspace's map holds `42 → 500`; that epoch
numbers its own observations from `FIRST_OBSERVATION_SEQUENCE` and the identity is path-stable, so the
first five hundred things the new epoch ever said about that file would be refused as `'superseded'`
with nothing anywhere recording the refusal.

**One measurement is worth naming because it is evidence about the *shape* of the fix rather than
about the fix.** With only §2.4's comparison reverted — the rest of the round in place — the batch
case failed on the **cursor** assertion instead (`expected { epoch: +0, watermark: 500, …(1) } to
deeply equal { epoch: +0, watermark: +0, …(1) }`), while `control.added` and `acceptedSequence(42)`
still passed. That is the division of labour stated in §2.4 being observed rather than asserted: the
per-observation fence defends the arbitration, and only the comparison in `accept()` defends the
cursor.

**Nothing was discarded.** No candidate case was written that passed against both trees.

**Non-discriminating assertions, named so no reader mistakes one for the measurement**:
`expect(sprung).toBe(true)` in all three cases establishes only that the trap fired, and
`expect(workspace.rows).toEqual([42])` in the routing case establishes only that the row the removal
would have taken was there to take.

---

## 9. Where it is thin

Every item carries one of §7.3's two marks. **No item commissions a round** — §7.1 is the only
mechanism and it reads a diff — and **no item below names an unfixed correctness defect in a source
file**, so none holds this step open.

1. **recorded only** — `observations.length` in `accept()`'s blocked arm and the `Symbol.iterator`
   the `for…of` runs are both caller-controlled reads that sit **below** the comparison. Neither is a
   defect: the `.length` read is the last statement before that arm returns and nothing is written
   after it, and every observation the iterator yields is fenced by `applyObservation` before any arm
   sees it — which is what the loop's own comment now says. What is left is that *a future statement
   added after either* would be below the comparison and above nothing, and no type marks that
   boundary.
2. **recorded only** — **`applyChange`'s guard asks two of the three questions, not three.** A session
   that adopted epoch `0` and is neither disposed nor blocked cannot tell a replacement from its own
   lifecycle inside that guard. It is not a defect: what catches a read in flight across an `open()`
   is the host's own open-generation capture inside `rereadUnderGuard`, which that guard's doc names
   in as many words, and `FIRST_WORKSPACE_EPOCH = 1` keeps epoch `0` out of production. It is named
   here because the defence lives in another module and nothing links the two files.
3. **recorded only** — **the counter is a `let` and nothing enforces its increment sites.** A fourth
   place that clears `accepted`, or a host that replaces the workspace without calling
   `workspaceOpened()`, leaves every fence built on it answering `true`. The declaration's comment
   says this; no test can fail it, because a missing increment is indistinguishable from a lifecycle
   that did not end.
4. **recorded only** — **`'lifecycleMoved'` is still an arm of a union nothing switches over**
   (2d-5-4-D §9 item 1, re-checked here and unchanged), and this round put a second producer behind
   it. `ObservationOutcome`'s only consumer copies the array for tests, so a future arm that forgets
   to answer it fails nothing.
5. **recorded only** — **the three cases all drive an injected boundary, because that is the only
   boundary that exists.** None of them proves anything about a real drain: production wire values are
   JSON-parsed plain objects with no accessors. This is the standing coverage bound of every finding
   in this chain, and it stops being a bound the moment 2d-5-5 gives `WriteSurfaceTransition` a real
   body, because that callback is fired synchronously from `applyChange` in the middle of the batch
   loop.
6. **recorded only** — **`'staleOpen'` now covers two facts.** An open that landed during the await and
   a getter that reopened from inside the answer's own reads record the same outcome, so a case
   reading `drains()[n].outcome` cannot tell them apart. They are the same fact for the purpose the
   record serves — the batch's numbers cannot be attributed to the lifecycle in force — and the arm's
   doc says both halves; but a later phase that wanted to count them separately would have to split
   the arm.
7. **recorded only** — **21 of the 23 `docs/` occurrences of the false identity claim are still
   unread.** 2d-5-4-D read seven and counted sixteen; this round's re-derivation read two more and
   fixed both. No count here supersedes that, and the sweep that finds the rest is
   `rg -i reallocat docs/` followed by reading each hit, since not every occurrence need be an
   instance. None is a correctness defect in a source file.
8. **recorded only** — this round changed no `.svelte` file, added no user-facing string in any
   language and takes no window reading. What it changed is which arm refuses an observation whose
   lifecycle moved, and nothing on a screen reads an `ObservationOutcome` at all; 2d-6 is the first
   phase that draws anything downstream of it.

---

## 10. The §7.1 consequence

**This fix changed four source files**, all under `src/lib/browser/`:

- `observationTransitions.ts` — the new session member, the shared predicate, the routing fence,
  `applyAddition`'s fence, and the doc fixes for S1, S3 and A2;
- `reconciliationCoordinator.ts` — the counter, its three increments, the capture in `runOneDrain`,
  `accept`'s materialized reads and comparison, the session's `lifecycleIsOurs`, and `'staleOpen'`'s
  widened doc;
- `observationTransitions.test.ts` — the session helper's fourth member and the routing case;
- `reconciliationCoordinator.test.ts` — the two coordinator cases.

Four record files were also changed — `2d-5-4-notes.md`, `2d-5-2b-notes.md`, `2d-5-4-D-notes.md` and
this file — and under §7.1 the record half is neither a discount nor a second question.

**So §7.1 commissions a further round**, scoped to the source half above.
