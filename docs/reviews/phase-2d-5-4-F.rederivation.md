# Re-derivation of the Phase 2d-5-4-F review

**Worker:** read-only re-derivation. No source file, record file, test, build or `cargo` command was
run or changed. The only file written is this one.

**Tree:** `/Users/ccarpio/Developer/Utils/espansoConfig`, branch `main`, HEAD `daca2b1`. The change
under review is `fe7d61b`. Every `file:line` below resolves at HEAD.

**Inputs:** `docs/reviews/phase-2d-5-4-F.brief.md`, `docs/reviews/phase-2d-5-4-F.md` (four findings,
bodies truncated), `docs/decisions/2d-5-4-E-notes.md`, and the code.

**Verdict in one line:** all four review findings **hold** — two source blockers, one source-comment
defect, one record defect — and the sweep adds **seven** more, one of which (W3) is the record twin of
review finding 1 and is the class `CLAUDE.md` calls this project's worst.

**§7.1 consequence, stated once:** review findings 1, 2 and 3 and swept findings W1, W2, W3, W4, W5, W6
all require a change to a **source** file (`src/lib/browser/*.ts`, comments included — §7's closed list
does not contain them). So whatever subset is fixed, the fix round will change source and **§7.1
commissions a further round**. Review finding 4 and swept finding W7 are record-only and would not, on
their own, commission anything.

---

## The shared facts every finding below rests on

Three facts, derived once so no finding has to re-derive them.

**F1 — the lifecycle counter and its three increment sites.** `let lifecycle = 0;` is
`src/lib/browser/reconciliationCoordinator.ts:786`. A sweep of the file for every mutation gives
exactly three:

```
reconciliationCoordinator.ts:899   lifecycle += 1;   // recoverFromLostHistory()
reconciliationCoordinator.ts:1510  lifecycle += 1;   // dispose()
reconciliationCoordinator.ts:1537  lifecycle += 1;   // workspaceOpened()
```

and exactly one site each for the state they are meant to stand for:
`reconciliationCoordinator.ts:1555` `accepted.clear();` (inside `workspaceOpened()`) and
`reconciliationCoordinator.ts:1504` `disposed = true;` (inside `dispose()`). Nothing else clears the
accepted-sequence map and nothing else disposes. **The record's §2.2 claim about the three sites
holds.**

**F2 — the one comparison, and what is above and below it.** `accept()` is
`reconciliationCoordinator.ts:950-1052`. Its first five statements are

```
951  const batchEpoch = batch.epoch;
952  const batchDiscarded = batch.discarded;
953  const newestSequence = batch.newest_sequence;
954  const observations = batch.observations;
955  if (lifecycle !== lifecycleAt) {
```

so the four caller-controlled property reads are above the single comparison, exactly as the record
says. `lifecycleAt` is captured at `reconciliationCoordinator.ts:1085`, the **first** statement of
`runOneDrain()`, above `host.openGeneration()` at `:1087`. `accept()` has exactly one call site,
`reconciliationCoordinator.ts:1274`.

**F3 — the routing fence covers what its comment says it covers.** `routeObservation`
(`src/lib/browser/observationTransitions.ts:383-488`) contains nothing but `in` checks, property reads
and object literals whose members are own data properties. The fence is
`observationTransitions.ts:912`, below `routeObservation` at `:911` and above the switch at `:919`.
I read all six arms (`applyAddition` 1016, `applyChange` 1077, `applyRemoval` 1337, `applyUnreadable`
1379, `applyNamedRow` 1415, `applyUnnamedPath` 1489) and confirm the claim at
`observationTransitions.ts:893-896` — *nothing between this fence and an arm's own `admit` runs caller
code, for every arm except `applyAddition`*: each arm reads only own data properties of the `route`
literal before its `admit`. **The routing fence's own comment is true.** (What is *not* true is a
different sentence, about the window between an arm's `admit` and its host write — see W4.)

---

## Review finding 1 — `reconciliationCoordinator.ts:981`, "Recheck the lifecycle after blocked-path callbacks"

### 1.1 What it claims

Reconstructed from the truncated text plus the code: the single lifecycle comparison at
`reconciliationCoordinator.ts:955` is taken **above** `recoverFromLostHistory()`, which is called at
`:982` and whose first statement, `reconciliationCoordinator.ts:888`, calls the **injected**
`host.openWriteSurfaces()`. That call is caller code. If it returns without having ended the
lifecycle, fine; if it *ends* the lifecycle and then answers a non-empty list,
`recoverFromLostHistory()` returns `false` and `accept()` falls through to two writes — at `:990` and
`:991` — with the comparison that was supposed to protect them already spent. The fix the review
proposes is to carry the captured lifecycle into the recovery and recheck after the registry read, and
to materialize `observations.length` above the comparison.

**The anchor is defensible but blunt.** `:981` is `if (block.kind === 'blockedByLostHistory') {`, the
head of the arm. The **cause** is `reconciliationCoordinator.ts:888`; the **harm** is
`reconciliationCoordinator.ts:990-991`. A fix worker should read `888`, `982`, `990` and `991`, not
`981` alone.

### 1.2 The derivation

The exact lines that decide it:

```
reconciliationCoordinator.ts:888    if (host.openWriteSurfaces().length > 0) {
reconciliationCoordinator.ts:889      return false;
…
reconciliationCoordinator.ts:955    if (lifecycle !== lifecycleAt) {
…
reconciliationCoordinator.ts:981    if (block.kind === 'blockedByLostHistory') {
reconciliationCoordinator.ts:982      if (recoverFromLostHistory()) {
reconciliationCoordinator.ts:988        return true;
reconciliationCoordinator.ts:989      }
reconciliationCoordinator.ts:990      watermark = newestSequence;
reconciliationCoordinator.ts:991      observationsDroppedCount += observations.length;
reconciliationCoordinator.ts:992      return true;
```

The concrete sequence, entirely within the injected boundary this whole fence exists for:

1. A drain resolves. `lifecycleAt` was captured at `:1085`; nothing has moved `lifecycle`.
2. The batch carries `discarded > lastDiscarded`, so `:977-979` set `lastDiscarded` and put `block`
   into `blockedByLostHistory`. All own data — safe.
3. `:982` calls `recoverFromLostHistory()`, whose first statement `:888` calls
   `host.openWriteSurfaces()`. `host` is the injected `ReconciliationHost`. That call — or the
   `.length` read on whatever it returns — synchronously calls `BrowserState.open()`, which reaches
   `coordinator.workspaceOpened(root)` before its first await. `workspaceOpened()` runs
   `lifecycle += 1` (`:1537`), then `adopted = false`, `epoch = 0`, `watermark = 0`,
   `lastDiscarded = 0`, `observationsDroppedCount = 0`, `accepted.clear()`,
   `observationOutcomeRecords.length = 0`, `block = { kind: 'running' }`, `openInProgress = true`
   (`:1549-1579`).
4. The call then answers a non-empty array, so `:889` returns `false` — recovery declines, exactly as
   ruling 12 intends when a write surface is open.
5. Back in `accept()`, **`:990` writes `watermark = newestSequence`** — the *closed* lifecycle's
   `newest_sequence` — into the cursor `workspaceOpened()` has just zeroed for the *replacing*
   workspace. **`:991` then adds the closed batch's observation count into a counter the same reset
   zeroed.** `:992` returns `true`, so `runOneDrain` records `'accepted'` at
   `reconciliationCoordinator.ts:1284`.

**The observable wrong outcome.** `coordinator.cursor()` (`:1594-1599`) answers
`{ epoch: 0, watermark: 500, lastDiscarded: 0 }` for a workspace whose own observations start at
`FIRST_OBSERVATION_SEQUENCE`. The next drain reads `afterSequence = watermark` at
`reconciliationCoordinator.ts:1094` and issues `host.drain(500)`, so **the new epoch's first five
hundred observations are never delivered to this window at all** — not refused as `'superseded'` with
a record, as in the defect §8 measured, but never fetched. And `coordinator.observationsDropped()`
(`:1628-1630`) reports a count belonging to the closed workspace. The drain record says `'accepted'`,
which is the one outcome string that claims the cursor legitimately moved.

**A second, independent route to the same line.** `:991` is `observationsDroppedCount +=
observations.length`. For a compound assignment to an identifier, JavaScript evaluates the target
reference and **reads its current value first**, then evaluates the right-hand side, then stores.
So a getter or `Proxy` trap behind `observations.length` that calls `workspaceOpened()` has its
`observationsDroppedCount = 0` (`:1554`) **overwritten** by the store that follows it. This is the
exact claim `2d-5-4-E-notes.md` §9 item 1 denies — *"the `.length` read is the last statement before
that arm returns and nothing is written after it"*. The read is not a statement; it is an operand of a
statement whose **store happens after it**. The review's second fix clause ("materialize
`observations.length`") is aimed at this, and it is right.

**The `true` arm of `recoverFromLostHistory()` is not a second instance.** If `:888` answers an empty
list after having reopened, `:899` bumps the lifecycle again, `:900` re-sets `block`, and `:907` fires
`host.reopenWorkspace(openRequest)` — with `openRequest` now holding the *new* open's request, because
`:1565` overwrote it. That is a redundant second reopen of a workspace that just opened, and it is
wasteful rather than corrupting: `:988` returns `true` and **nothing is written**. Worth a sentence in
whatever comment the fix adds; not a defect on its own.

### 1.3 Verdict

**HOLDS.** **Source.** The single comparison at `:955` is not sufficient for the blocked arm, because
injected code runs at `:888` between it and the writes at `:990-991`, and both writes land in a
workspace the comparison has stopped describing.

### 1.4 Narrowest correct fix

Two changes inside `accept()`:

- materialize the count above the comparison — `const observationCount = observations.length;` as a
  fifth line at `:955`, with `:991` becoming `observationsDroppedCount += observationCount;`;
- re-ask the comparison in the arm, immediately under `:989`:
  `if (lifecycle !== lifecycleAt) { return false; }` — **`false`, not `true`**, because unlike the
  `:988` arm this is a lifecycle that moved under the session rather than a refusal the session
  itself performed. `runOneDrain` then records `'staleOpen'` at `:1281`, which is the arm that already
  means *the batch's numbers cannot be attributed to the lifecycle now in force*.

**Cost:** three source lines plus comments; the comment at `:926-930` and the record's §2.4 and §9
item 1 must be corrected with it (see W3). A case is writable without new machinery:
`reconciliationCoordinator.test.ts:186` implements `openWriteSurfaces` as `(): readonly
OpenWriteSurface[] => control.surfaces`, so a case can install a getter on `control.surfaces` that
calls `coordinator.workspaceOpened(...)` once and then answers a one-element list — the same technique
the two cases added at `:1613` and `:1669` already use. **No existing case covers this arm.**

---

## Review finding 2 — `reconciliationCoordinator.ts:1274`, "Validate and accept the same materialized batch"

### 2.1 What it claims

With an epoch already adopted, `reconciliationCoordinator.ts:1266` validates `answer.value.epoch`
against `expectedEpoch` and `:1274` reads `answer.value` **again**. `answer` is whatever the injected
`host.drain()` resolved with, so `value` may be an accessor that answers a different object on the
second read. The batch whose epoch was validated is then not the batch whose numbers are consumed.
**The anchor `:1274` is correct**; the companion line is `:1266`.

### 2.2 The derivation

```
reconciliationCoordinator.ts:1261    if (!answer.ok) {
reconciliationCoordinator.ts:1266    if (expectedAdopted && answer.value.epoch !== expectedEpoch) {
reconciliationCoordinator.ts:1271      record(afterSequence, reasons, 'staleEpoch');
reconciliationCoordinator.ts:1272      return;
reconciliationCoordinator.ts:1273    }
reconciliationCoordinator.ts:1274    if (!accept(answer.value, lifecycleAt)) {
```

The sequence, with `expectedAdopted === true` (captured at `:1088`) and `adopted` still `true`:

1. `:1266` reads `answer.value` → object **A**, then reads `A.epoch` → a number equal to
   `expectedEpoch`. The `staleEpoch` arm does not fire.
2. `:1274` reads `answer.value` → object **B**. Nothing moved `lifecycle`, so `accept()`'s fence at
   `:955` passes.
3. `accept()` materializes **B**'s four members at `:951-954`. Because `adopted` is still `true`,
   `:964`'s `if (!adopted)` is false and `batchEpoch` is discarded — **B's epoch is never checked
   against anything**. `:973-979` then act on `B.discarded`, `:996` writes
   `watermark = B.newest_sequence`, and `:1039-1050` apply **B**'s observations into the
   accepted-sequence map.

**The observable wrong outcome** is precisely what the `'staleEpoch'` arm exists to prevent, and its
own comment at `:1267-1270` states the harm: *"its `newest_sequence` is not comparable with this
session's — the non-falling property is scoped to one epoch (ruling 7)"*. A watermark from a foreign
epoch is then handed to `host.drain(afterSequence)` at `:1094`, and B's observations are admitted into
`accepted` under path-stable `DocumentId`s, where they refuse the showing epoch's later observations
of those same files as `'superseded'`.

**The lifecycle counter does not defend this and cannot.** No lifecycle movement is required: one
session, one epoch, two reads of one accessor. This is the check-and-spend shape `CLAUDE.md` names —
*a check and a spend separated by any property read are not atomic* — and here the check and the spend
are two reads of **the same property**.

**The suite already models a non-idempotent `value`.** The case added by this very fix at
`reconciliationCoordinator.test.ts:1669` defines `get value(): ReconciliationBatch` returning a
**freshly constructed object literal on every call**. That case does not reach `:1266` (its
`expectedAdopted` is `false`, so `&&` short-circuits before the read), but it establishes in this
repository's own test vocabulary that `answer.value` is not a stable value.

**A second, narrower instance inside the same finding.** Even if `answer.value` answers one object
both times, `.epoch` is read **twice** on it — once at `:1266` for validation, once at `:951` for
adoption. Today that is harmless only by coincidence: when `expectedAdopted` is `true`, `adopted` is
also `true` inside `accept()` and `batchEpoch` is dead; when `expectedAdopted` is `false`, `:1266`
short-circuits and there is only one read. The two are kept in step by the fact that `adopted` is
cleared only in `workspaceOpened()` (`:1549`), which also bumps `lifecycle`. **Nothing states this**,
and a statement that set `adopted` anywhere else would make the double read live.

### 2.3 Verdict

**HOLDS.** **Source.** Validating one read and spending another is a defect of the shape §7's brief
and `CLAUDE.md` both name, and the value substitution needs no lifecycle movement, so no fence in this
round defends it.

### 2.4 Narrowest correct fix

Hoist one materialization above `:1266`:

```
const batch = answer.value;
if (expectedAdopted && batch.epoch !== expectedEpoch) { … }
if (!accept(batch, lifecycleAt)) { … }
```

That closes the object-substitution half with two changed lines and no signature change. Note the
consequence and write it into the comment: with `const batch = answer.value;` above `:1266`, the
`value` getter now fires **above** the `staleEpoch` arm rather than below it — still below the
`disposed` check at `:1106` and both generation checks, and still above `accept()`'s comparison at
`:955`, so a getter that ends the lifecycle is caught exactly as before.

Closing the `.epoch` double-read half as well costs more: either pass the validated epoch into
`accept()` as a parameter beside `lifecycleAt`, or hoist all four of `accept()`'s materializations into
`runOneDrain`. The review's own fix text asks for the second ("Read `answer.value` and the batch's four
fields once"). **The cheaper one is enough for the defect as derived**; the `.epoch` half should be
recorded as a §9 item if it is not fixed, because it is currently protected by a coincidence nothing
states.

---

## Review finding 3 — `reconciliationCoordinator.ts:1505`, "Document disposal's counter increment as necessary"

### 3.1 What it claims

The comment above `dispose()`'s `lifecycle += 1` says the increment is redundant. It is not: `accept()`
fences on `lifecycle` alone and never reads `disposed`, so without the increment a disposal fired from
a getter after `runOneDrain`'s own `disposed` check would let `accept()` run. The increment must be
kept and the two source comments plus the record corrected. **The anchor `:1505` is correct**; the
second source comment is `reconciliationCoordinator.ts:782-785` and the record passage is
`docs/decisions/2d-5-4-E-notes.md` §2.2, the `dispose()` row of its table.

### 3.2 The derivation

The comment under review, `reconciliationCoordinator.ts:1505-1510`:

> *"**Redundant with the line above, and kept for the rule rather than for an effect.**
> `stillApplying()` reads `disposed` live, so every fence already refuses after this point…"*

and its twin at `reconciliationCoordinator.ts:782-785`:

> *"`dispose()`'s increment is **redundant today**, because `stillApplying()` reads `disposed` live…"*

`accept()`'s fence is `reconciliationCoordinator.ts:955`, `if (lifecycle !== lifecycleAt)`. There is no
`disposed` read anywhere in `accept()` — the only one on the whole drain path is
`reconciliationCoordinator.ts:1106`, which runs **before** the caller-controlled reads at `:1111`,
`:1261`, `:1266`, `:1274` and `:951-954`. `stillApplying()` (`reconciliationCoordinator.ts:1031`) is
consulted only per observation, inside `applyObservation`, which the loop at `:1039` reaches **after**
every cursor write.

So, with the increment hypothetically removed, a getter on `answer.value` or on any of `batch.epoch`,
`batch.discarded`, `batch.newest_sequence`, `batch.observations` that calls `coordinator.dispose()`
leaves `accept()` running to completion:

- `:970-971` adopt an epoch **after disposal**;
- `:977-979` move `lastDiscarded` and put the session into `blockedByLostHistory`;
- `:982` calls `recoverFromLostHistory()`, which — with no write surface registered — reaches
  `reconciliationCoordinator.ts:907`, **`host.reopenWorkspace(openRequest)`: a disposed coordinator
  asking the window to throw away and reload the whole workspace**;
- `:990` or `:996` moves the watermark.

Only the per-observation arms are covered by the live `disposed` read, and they are the last thing to
run. The increment at `:1510` is what makes `:955` refuse first, so it is **load-bearing for every
cursor write and for the reopen call**, and the two comments assert the opposite.

The reachability is the same injected boundary as every other finding in this chain: the existing cases
at `reconciliationCoordinator.test.ts:1613` and `:1669` already call `coordinator.workspaceOpened(...)`
from inside a wire getter, and `coordinator.dispose()` is reachable the same way.

### 3.3 Verdict

**HOLDS.** **Source** — a comment defect, not a behavioural one. The code is correct; the two comments
claim the increment could be deleted without effect, which invites exactly that deletion. This is the
class `CLAUDE.md` calls this project's worst defect class, inverted: instead of claiming a guarantee
the code does not give, it denies a guarantee the code **does** give.

### 3.4 Narrowest correct fix

Rewrite both comments to say what is true: the increment overlaps the live `disposed` read **for the
per-observation fences in `observationTransitions.ts`**, and is **necessary** for `accept()`, whose
comparison at `:955` is the only thing standing between a disposal fired from a wire getter and the
cursor writes, the blocked-state transition and `host.reopenWorkspace()`. Correct the `dispose()` row
of `2d-5-4-E-notes.md` §2.2 in the same pass. **Cost:** two comment blocks and one record row; no
statement changes. Comment-only is still source under §7, so this alone commissions a round.

---

## Review finding 4 — `docs/decisions/2d-5-4-notes.md:485`, "the remaining live identity-reallocation rationale"

### 4.1 What it claims

`docs/decisions/2d-5-4-notes.md:485` still justifies withholding a membership reload by asserting that
`open()` reallocates every identity. **The anchor is correct.** The line reads:

> *"- the only whole reload this application has is `open()`, which reallocates every identity in the
> window, and ruling 12 forbids running it while any surface is open;"*

It is present tense, in the record's own voice, unstruck, justifying a decision — an **instance** of
the claim 2d-5-4-D struck in sixteen source comments and 2d-5-4-E struck in two record passages, not a
quotation of one.

### 4.2 The derivation, against the Rust

`crates/espansoconfig-core/src/workspace/mod.rs:316-327`, `identity_of`:

```rust
pub fn identity_of(path: &Path) -> DocumentId {
    let mut table = session_identities().lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(id) = table.by_path.get(path) { return *id; }
    let id = mint(table.next);
    table.next += 1;
    table.by_path.insert(path.to_path_buf(), id);
    id
}
```

`session_identities()` (`crates/espansoconfig-core/src/workspace/mod.rs:271-279`) is a
`static OnceLock<Mutex<SessionIdentities>>` — one table for the life of the **process**, keyed by
path. `Workspace::from_tree` (`crates/espansoconfig-core/src/workspace/mod.rs:482-499`) mints through
it for every enumerated file, and its own doc comment (`:474-481`) says so in as many words:
*"Identities come from the **session's path table**, not from the tree's order, so they are stable
across two `open` calls of a directory that changed as well as one that did not."*

**So `open()` reallocates nothing.** The same path answers the same `DocumentId` for the life of the
process, a recreation of the file included. The claim at `:485` is **false as stated**.

**What is true, and what the correction has to preserve**, is the narrower fact the two earlier
corrections already wrote out (`docs/decisions/2d-5-4-notes.md:527` and
`docs/decisions/2d-5-2b-notes.md:363`): an `open()` replaces the **workspace**, so a retained entry is
a statement about a workspace this window is closing, which may not hold that file at all; and the
replacing epoch restarts its observation sequences, so a retained accepted-sequence entry refuses the
new epoch's earliest observations of the same file. `src/lib/browser/observationTransitions.ts:228-241`
and `src/lib/browser/reconciliationCoordinator.ts:1542-1548` already carry that corrected wording, so
the record is now **inconsistent with source it cites**.

### 4.3 Surviving instances, from the sweep the brief asked for

`rg -i reallocat docs/` matches 54 lines across 16 files. I read every match in the four records this
chain has touched plus the 2d-5-2a family. The ones that are **live claims in a record's own voice**,
not blockquoted source, not struck:

| Where | What it says |
|---|---|
| `docs/decisions/2d-5-4-notes.md:485` | the review's anchor — `open()` *"reallocates every identity in the window"* |
| `docs/decisions/2d-5-4-notes.md:819` | *"the only thing that reallocates identities is a whole load"*, justifying why `pendingAdditions` needs no other clearing rule |
| `docs/decisions/2d-5-2b-notes.md:333` | *"names a `DocumentId` that now denotes a **different file**, because the load below reallocates identities"* — restating 2d-5-2a's cost in this record's voice, four lines above a passage 2d-5-4-E struck |
| `docs/decisions/2d-5-2a-A-notes.md:143` | *"`open()` reallocates document identities"* |
| `docs/decisions/2d-5-2a-A-notes.md:373` | item 5 of that round's thin-section, *"A registration that survives an `open()` names a reallocated `DocumentId`"*, marked **actionable** |
| `docs/decisions/2d-5-2a-notes.md:435` | *"`open()` reallocates document identities without any registry operation"* |
| `docs/decisions/2c-3a-1-notes.md:607` | *"reallocated by the load that follows and a kept entry would be a count of replacements of a different …"* |

The review named two; there are at least **seven**. `2d-5-4-E-notes.md` §9 item 7 predicted this and
marked it recorded only, which is the correct mark: **none of these is a correctness defect in a source
file.**

### 4.4 Verdict

**HOLDS.** **Record.** Fixing it, alone, commissions no round under §7.1 — the fix's diff would touch
only files on §7's closed list.

### 4.5 Narrowest correct fix

Strike `:485` and `:819` in place, in the form the two earlier corrections use, and replace the
rationale with the two true reasons (a workspace this window is closing; a restarted sequence
allocator). The other five are outside this round's brief and belong in a deliberate sweep phase; if
they are left, say so in this step's own thin-section so the count does not drift again.

---

## Swept findings the review did not report

Same five-part treatment, plus severity and source/record.

### W1 — `applyChange`'s guard doc still says the epoch detects a replacement — MEDIUM, source

1. **Claim.** `src/lib/browser/observationTransitions.ts:1159-1161` justifies the guard's question
   order: *"…which is the broadest and is therefore first; **the epoch, because a workspace replaced
   meanwhile is a different lifecycle**; whether this is still the newest observation for the file…"*
2. **Derivation.** The guard is `observationTransitions.ts:1217`; its second question is
   `observationTransitions.ts:1222`, `if (session.epochNow() !== session.epoch)`. Under the
   coordinator's own session, `epoch` is captured at `reconciliationCoordinator.ts:998` and `epochNow`
   is `() => epoch` at `:1004`. `workspaceOpened()` sets `epoch = 0` (`:1550`), and `accept()` adopts
   `0` like any other value — its own comment at `:965-969` says so. **So for a session that adopted
   `0`, a replacement leaves `epochNow() === session.epoch === 0` and the question cannot fire.** This
   round's own new doc states exactly that at `observationTransitions.ts:834-839` (*"vacuous for a
   session that adopted `0`"*) and at `:704-707`. The guard's sentence asserts the opposite, four
   hundred lines away, and the round did not touch it: `git show fe7d61b -- src/lib/browser/observationTransitions.ts`
   contains no hunk in that block.
3. **Verdict: HOLDS.** It is the same false claim this round spent itself removing, in a place the
   round's own search did not reach — the failure mode `CLAUDE.md` names as *sweep for what the type
   now says, not for the words the old finding used*.
4. **Source** (comment).
5. **Fix.** Add the vacuity clause to that sentence and name `lifecycleIsOurs` as the member that does
   answer a replacement, with a pointer to `2d-5-4-E-notes.md` §9 item 2, which already records that
   this guard deliberately asks two of the three questions and why that is safe here
   (`rereadUnderGuard`'s own `openGeneration` capture — verified: `src/lib/browser/workspace.svelte.ts:3061`
   captures it and `:3082` compares it inside `stillCurrent()`, after the await and after `guard()`).
   **Cost:** one sentence.

### W2 — `ObservationSession.stillApplying`'s "what it does not cover" list was not updated — LOW, source

1. **Claim.** `src/lib/browser/observationTransitions.ts:752-754`: *"It is a fact about the
   coordinator, not about the window: it says nothing about whether the workspace was replaced (**the
   epoch and the host's open-generation capture say that**)…"*
2. **Derivation.** As W1, the epoch does not say that at `0`. The round added a sibling member,
   `lifecycleIsOurs` (`observationTransitions.ts:728`), whose entire purpose is that this parenthetical
   is short, and whose own doc at `:703-710` says *"The question neither {@link epoch} nor {@link
   stillApplying} can answer"*. The two docs are adjacent in one interface and disagree.
3. **Verdict: HOLDS** — weaker than W1, because the parenthetical names two things and one of them
   (the open-generation capture) really does catch a replacement on `applyChange`'s path. It is wrong
   on the fences that have no such capture: `applyObservation`'s (`:912`) and `applyAddition`'s
   (`:1024`).
4. **Source** (comment).
5. **Fix.** Add `lifecycleIsOurs` to the parenthetical. **Cost:** one clause.

### W3 — `accept()`'s doc and two record passages claim a fence the code does not give — MEDIUM, source + record

1. **Claim.** Three places assert that the single comparison is followed by nothing but the
   observations:
   - `src/lib/browser/reconciliationCoordinator.ts:926-930`: *"**The comparison here is not the whole
     defence, and cannot be.** It is taken once, before anything is written; **the observations are
     applied after it**, and each of them reads caller-controlled properties of its own."*
   - `docs/decisions/2d-5-4-E-notes.md` §2.4: *"`accept()` reads the batch's four members into locals
     **first**, compares the lifecycle **once**, and only then writes anything."*
   - `docs/decisions/2d-5-4-E-notes.md` §9 item 1: *"Neither is a defect: the `.length` read is the
     last statement before that arm returns and **nothing is written after it**…"*
2. **Derivation.** Review finding 1 above. The enumeration at `:926-930` is short by one — it names the
   observations and not `recoverFromLostHistory()` at `:982`, whose `host.openWriteSurfaces()` at
   `:888` is caller code above the writes at `:990-991`. §2.4's *"only then writes anything"* is false
   of `:990`. §9 item 1's *"nothing is written after it"* is false of `:991` itself, whose compound
   assignment stores **after** the `.length` getter has run.
3. **Verdict: HOLDS** — all three.
4. **Source** (the `accept()` doc) **and record** (§2.4, §9 item 1). Because one of the three is a
   source comment, fixing this commissions a round on its own.
5. **Fix.** Correct all three in the same pass as review finding 1; the corrected sentence should
   enumerate **two** kinds of caller code below the comparison — the recovery's registry read and the
   observations — and say that a compound assignment's store follows its operand's getter. **Cost:**
   one comment block, two record paragraphs.

### W4 — `applyNamedRow` runs two injected calls between its `admit` and an unconditional host write — MEDIUM, source

1. **Claim.** `src/lib/browser/observationTransitions.ts:1422` arbitrates; `:1446`
   (`session.requestMembershipReload()`) and `:1448` (`workspace.holdsDocument(named)`) are injected
   member calls; `:1456` (`workspace.removeDocument(named)`) is an **unconditional** host write. No
   fence is re-asked between them.
2. **Derivation.** The arm's own JSDoc at `observationTransitions.ts:1427-1434` names the window —
   *"Two injected calls stand between the arbitration above and every write below"* — and answers it
   with `noteWhileOurs`, which gates only the **status** writes on `sequences.isNewest` (`:1439`).
   `removeDocument` is outside that gate by design (`applyRemoval`'s comment at `:1345-1352` states the
   rule: *"The removal itself is unconditional, because it is this arm's transition"*). The concrete
   sequence: `admit` succeeds; a `holdsDocument` implementation calls `BrowserState.open()` →
   `workspaceOpened()` → `lifecycle += 1`, `accepted.clear()` — and then answers `true`; `:1456`
   removes the row from the **replacing** workspace. Identities are path-stable
   (`crates/espansoconfig-core/src/workspace/mod.rs:316`), so the `Named` identity this window invented
   for a pending row may name a file the replacing workspace legitimately enumerates — and the
   sidebar row, its projection and any selection on it are dropped on the strength of an observation
   about a workspace that is gone. `noteWhileOurs` then writes nothing, because `isNewest` fails safe
   on a cleared map — so the removal happens with no status and nothing recording it.
3. **Verdict: HOLDS.** It is the shape A2 fixed one level up, surviving one level down. It is
   **pre-existing** — `fe7d61b` did not introduce it, and it is in scope here only as the narrower
   instance the brief and `CLAUDE.md` both ask every round to look for.
4. **Source.**
5. **Fix.** One line at `:1451`, above the switch: `if (lifecycleMovedUnder(session)) { return
   'lifecycleMoved'; }`. That is the third call site of the predicate this round created, needs no new
   machinery and no new outcome arm, and leaves `applyRemoval`'s unconditional-transition rule intact
   because the refusal is above the transition rather than inside it. **Cost:** one statement, one
   comment, one case. If it is not fixed, §7.3 makes it a **blocker** rather than a carried item — it
   names a correctness defect in a source file — so the choice is fix-now or `BLOCKED`.

### W5 — `lifecycleMovedUnder`'s doc overstates where it is asked — LOW, source

1. **Claim.** `src/lib/browser/observationTransitions.ts:820-823`: *"It is asked **twice on every
   observation's path**: once by {@link applyObservation} the moment routing returns, and once by
   {@link applyAddition} after its own materialization window."*
2. **Derivation.** There are exactly two call sites, `observationTransitions.ts:912` and `:1024`. The
   second is inside `applyAddition`, reached only from `case 'added'` at `:920-921`. For the other
   five arms the predicate is asked **once**. A reader taking the sentence at face value would believe
   `applyChange`, `applyRemoval`, `applyUnreadable`, `applyNamedRow` and `applyUnnamedPath` each get a
   second comparison they do not get — which is the belief W4 shows is load-bearing.
3. **Verdict: HOLDS.**
4. **Source** (comment).
5. **Fix.** *"…once on every observation's path, and a second time on the addition path"*. **Cost:**
   one clause.

### W6 — `ensurePumping`'s comment claims `pump()` catches everything a drain can throw — LOW, source

1. **Claim.** `src/lib/browser/reconciliationCoordinator.ts:1363-1364`: *"**Both arms, rather than
   `.finally`.** `pump()` catches everything a drain can throw, so this is defence against a throw
   from the bookkeeping itself…"*
2. **Derivation.** `pump()` (`:1306-1312`) contains no `try`. `runOneDrain`'s `try` (`:1096-1105`)
   wraps **only** `await host.drain(afterSequence)`. Everything after the await is unprotected: a
   throwing getter on `answer.ok`, `answer.failure`, `answer.value`, any of `batch.*` at `:951-954`,
   the `Symbol.iterator` at `:1039`, or any host member an arm calls, propagates out of `runOneDrain`,
   out of `pump()`, and rejects `running`. **No harm follows** — `void running.then(release, release)`
   at `:1372` handles both arms, so the slot is released and there is no unhandled rejection — but the
   drain's reasons were already spliced off `pendingReasons` at `:1086` and **no `record()` entry is
   written**, so that drain vanishes from `coordinator.drains()` entirely.
3. **Verdict: HOLDS IN PART.** The half that holds: `pump()` catches nothing, so the stated reason for
   the two-arm handler is false. The half that does **not** hold: there is no resulting defect — the
   handler is correct for a reason stronger than the one given, and the slot cannot be stranded.
4. **Source** (comment). **Pre-existing**; `fe7d61b` did not touch it.
5. **Fix.** Replace the clause with what is true: `runOneDrain` catches only the drain's own rejection,
   so a throwing wire accessor rejects `running`, and both arms are handled because either one may
   arrive. **Cost:** one sentence. Optional — it is a Low whose fix touches source, so under §7.1 it
   would itself commission a round; batching it with the other comment fixes costs nothing extra.

### W7 — the routing case pins one arm of six and does not discriminate the fence's placement — LOW, record

1. **Claim.** The new case at `src/lib/browser/observationTransitions.test.ts:1232` is the whole of the
   evidence for a fence the record says *"covers all six arms with one comparison per observation"*
   (`2d-5-4-E-notes.md` §3.2).
2. **Derivation.** The case builds a `Removed`/`Addressable` observation whose `get sequence()` calls
   `sequences.clear()` and sets `session.lifecycleOurs = false`, then asserts `'lifecycleMoved'` plus
   four negative assertions (`workspace.removed`, `workspace.rows`, `workspace.statuses`,
   `sequences.sequenceFor(42)`). It genuinely pins a **fence** rather than an outcome string: the
   negative assertions fail unless the refusal happens above `admit`. What it does **not** pin is
   *where* the fence lives — a fence moved from `applyObservation` (`:912`) into `applyRemoval` would
   keep this case green while leaving `applyChange`, `applyUnreadable`, `applyNamedRow` and
   `applyUnnamedPath` exposed to the identical routing window. Only one arm of the six is driven, and
   the case exercises only the `lifecycleIsOurs` clause of the three.
3. **Verdict: HOLDS.** As a coverage bound, not as a defect: the code is right today.
4. **Record.** `2d-5-4-E-notes.md` §9 has eight items and none of them is this one.
5. **Fix.** Record it as a §9-style item in this step's notes. Adding arm cases is optional and is a
   phase decision, not a tail obligation. **Cost:** one paragraph.

### Checked and **not** a finding — the epoch clause's vacuity at `0`

The brief asks whether the epoch clause of `lifecycleMovedUnder` is vacuous at `0` and whether the
record says so. **It is, for the coordinator's own session, and the record says so three times.**
Derivation: the coordinator's session literal sets `epoch` (`reconciliationCoordinator.ts:998`) from
the `let` and `epochNow: () => epoch` (`:1004`) from the same `let`; the only writes to that `let` are
`epoch = batchEpoch` at `:971`, reachable only when `!adopted`, and `epoch = 0` at `:1550` in
`workspaceOpened()`. `adopted` is cleared only at `:1549`, in the same block that bumps `lifecycle`,
and `accept()` is reachable only through an `await` — so no synchronous re-entrant path can adopt a
**new** epoch under a live session. A session that captured `0` therefore sees `epochNow()` answer `0`
for as long as it lives, and `session.epochNow() !== session.epoch` can never fire.
It is stated at `observationTransitions.ts:834-839`, at `observationTransitions.ts:704-707`, and in
`2d-5-4-E-notes.md` §2.5 and §4. **One precision worth a clause if the comments are being edited
anyway:** the doc states the vacuity as a property of *"a session that adopted `0`"* in general, and it
is a property of **this implementation's** session — an injected session may hold `epoch: 0` and an
`epochNow()` answering `7`, in which case the clause fires. The overstatement is in the safe direction
(it understates the fence), so it is noted here rather than raised as a finding.

### Checked and **not** a finding — three claims the brief asked to be re-derived

- **The three increment sites are complete.** F1 above: `accepted.clear()` and `disposed = true` each
  have exactly one site, both inside a function that increments. Nothing else replaces the workspace
  or ends the applying lifecycle from inside this factory.
- **The capture in `runOneDrain` is genuinely above every caller-controlled read.**
  `reconciliationCoordinator.ts:1085` is the function's first statement; `host.openGeneration()` at
  `:1087` and everything else follow it. The record's §2.3 is right that `accept()`'s own first
  statement would have been too late, because `answer.ok` (`:1261`) and `answer.value` (`:1266`,
  `:1274`) are read before `accept()` is entered.
- **`applyAddition`'s second fence still does work the routing fence does not.** Its materialization
  window is `observationTransitions.ts:1022-1023` — the spread `{ ...route.summary, loaded: false }`
  runs the wire summary's accessors and `'Unreadable' in route.content` runs a `has` trap — and both
  run *after* `routeObservation` returned, so the fence at `:912` is above them and the fence at
  `:1024` is below them. `row.id` at `:1039` is an own data property of the object the spread built,
  so nothing caller-supplied runs between `:1024` and `admit`. The justification at `:1025-1036` holds
  as written.

---

## Summary table

| # | Anchor | Verdict | Source / record | Severity |
|---|---|---|---|---|
| Review 1 | `reconciliationCoordinator.ts:981` (cause `:888`, harm `:990-991`) | HOLDS | source | BLOCKER |
| Review 2 | `reconciliationCoordinator.ts:1274` (with `:1266`) | HOLDS | source | BLOCKER |
| Review 3 | `reconciliationCoordinator.ts:1505` (and `:782-785`) | HOLDS | source (comment) | MEDIUM |
| Review 4 | `docs/decisions/2d-5-4-notes.md:485` | HOLDS | record | MEDIUM |
| W1 | `observationTransitions.ts:1160` | HOLDS | source (comment) | MEDIUM |
| W2 | `observationTransitions.ts:753` | HOLDS | source (comment) | LOW |
| W3 | `reconciliationCoordinator.ts:926-930` + E-notes §2.4, §9 item 1 | HOLDS | source + record | MEDIUM |
| W4 | `observationTransitions.ts:1456` (window opens at `:1446`) | HOLDS | source | MEDIUM |
| W5 | `observationTransitions.ts:820` | HOLDS | source (comment) | LOW |
| W6 | `reconciliationCoordinator.ts:1363` | HOLDS IN PART | source (comment) | LOW |
| W7 | `observationTransitions.test.ts:1232` | HOLDS (coverage bound) | record | LOW |

## What could not be determined

- **Nothing was executed.** No test, build or `cargo` command was run, so every behavioural claim above
  is derived from the code rather than measured. In particular, the `500`-style figures quoted in
  finding 1's harm are the arithmetic of `host.drain(watermark)` against
  `FIRST_OBSERVATION_SEQUENCE`, not a measurement taken here.
- **The `21 unread docs/ occurrences` count in `2d-5-4-E-notes.md` §9 item 7 was not reconciled.**
  `rg -i reallocat docs/` matches 54 lines in 16 files today; I read the matches in the six records
  named in §4.3 and classified those. Whether the residue is 21, and whether every one of them is an
  instance rather than a quotation, is a sweep this round did not complete.
- **Production reachability was taken from the brief, not re-derived.** The brief states that wire
  values are JSON-parsed plain objects and that `WriteSurfaceTransition` is registered as a no-op; I
  did not re-check `DetailPane.svelte`. Every finding above is therefore injected-boundary-reachable
  and, on that stated basis, not production-reachable today — which is the same standing for every
  finding of 2d-5-4-B, -C, -D and -E.
