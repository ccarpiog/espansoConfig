# Phase 2d-5-4-F — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4-E's fix

**Status: taken and answered.** Risk class: **high**. Components: **none** — no `.svelte` file was
modified, so no window reading is owed.

This is **not** an implementation step. §7.1: *a fix round that changes at least one source file is
owed a review round, scoped to that change.* Phase 2d-5-4-E's fix changed four source files; this is
the round that reviews **that fix**. Its own fix changes source, so §7.1 commissions a further round —
§10 says so and says what it is scoped to.

The documents: the brief [`docs/reviews/phase-2d-5-4-F.brief.md`](../reviews/phase-2d-5-4-F.brief.md),
the review [`docs/reviews/phase-2d-5-4-F.md`](../reviews/phase-2d-5-4-F.md), and the re-derivation
[`docs/reviews/phase-2d-5-4-F.rederivation.md`](../reviews/phase-2d-5-4-F.rederivation.md).

---

## 1. How the round was run

**The review was Codex**, verdict `ship-with-fixes`, **4 findings: 2 blockers and 2 should-fix**, over
the committed fix `fe7d61b`.

**The finding bodies arrived truncated for the seventh round running**, so the same three-stage shape
was used and nothing was accepted on the report's strength:

1. a **read-only re-derivation worker** derived each finding from the source alone, corrected one
   anchor, and swept for what the review had missed — finding **seven** more, all established;
2. **all four review findings hold**, one (review finding 1) with its anchor *defensible but blunt*:
   `:981` is the head of the arm, the **cause** is `host.openWriteSurfaces()` inside
   `recoverFromLostHistory()`, and the **harm** is the two cursor writes below it;
3. this fix round closed all eleven, and pinned every behavioural change with a case confirmed to fail
   against the pre-fix code.

**Every disposition was decided by the orchestrator before this worker started.** Nothing below
re-litigates whether a finding holds; what this record adds is what the fix changed and what it does
**not** claim.

**One sentence of the re-derivation was not followed, and the departure is deliberate.** For W4 the
re-derivation proposed one statement — `if (lifecycleMovedUnder(session)) { return 'lifecycleMoved'; }`
above `applyNamedRow`'s switch. What shipped instead puts the arm's removal under the **same
`isNewest` arbitration** as the status write beside it. The two answer different questions: the
predicate answers *has the workspace been replaced*, and `isNewest` answers *does this observation
still own this file*. The concrete sequence the re-derivation walks — a `holdsDocument()` that admits
a newer observation of the same identity and then answers `true` — moves no lifecycle at all, so the
predicate would not have caught it. The shipped shape catches both readings of the window, because a
replacement clears the map and `isNewest` fails safe on a cleared one.

---

## 2. Review finding 1 — the blocked arm's writes are below an injected call

> `src/lib/browser/reconciliationCoordinator.ts:981` (cause `:888`, harm `:990-991`) — BLOCKER, source.

### 2.1 Verdict: **HOLDS**

`accept()` takes its single lifecycle comparison above everything. The blocked-by-lost-history arm
then calls `recoverFromLostHistory()`, whose **first statement** calls the injected
`host.openWriteSurfaces()`. A call that synchronously reaches `BrowserState.open()` —
`workspaceOpened()`, `lifecycle += 1`, a zeroed cursor — and *then* answers a non-empty registry makes
recovery decline, which returns to an arm that writes `watermark = newestSequence` and
`observationsDroppedCount += observations.length` into the **replacing** workspace's freshly zeroed
cursor. The drain records `'accepted'`, the one outcome that claims the cursor legitimately moved.

**The harm is not a lost record.** The next drain reads `afterSequence = watermark` and issues
`host.drain(500)`, so the new epoch's first five hundred observations are **never fetched at all** —
not refused with a record, never asked for.

### 2.2 The fix

`reconciliationCoordinator.ts:1019` re-asks the same comparison the top of the function makes, **after**
recovery has declined and **above both writes**, and answers `false`. No new outcome arm was invented:

> **Correction — Phase 2d-5-4-G, 2026-09-20, this round's sweep.** ~~`:1019`~~ — **`:1023`**, and the
> statement is `if (lifecycle !== lifecycleAt) {` inside the `blockedByLostHistory` arm. The number was
> off by exactly four on the tree this record describes (`c410548`), and §3.2's own last paragraph names
> the mechanism: the orchestrator rewrote `accept()`'s top-fence comment block, four lines longer, after
> this record was written, which moved everything below it. On the tree **Phase 2d-5-4-G** leaves the
> same statement is at **`:1102`**, because that phase grew both `accept()`'s doc block and that same
> comment. `2d-5-2a-A-notes.md:191-193` already prescribes the defence and it is applied here: the
> quoted statement beside the number, so the citation survives the next edit that moves it.
`runOneDrain` already records `'staleOpen'` for a `false`, which means *this batch's numbers cannot be
attributed to the lifecycle now in force*.

**`false`, not `true`, and that is the whole difference from the arm above it.** The `true` arm is a
refusal **this session performed** — recovery ran, the batch is accounted for by being refused under
ruling 10. This arm is a lifecycle that moved **under** the session.

**What the fix does not claim.** The recovery's own `true` arm is left alone, and the re-derivation is
right that it can fire a second, redundant `reopenWorkspace` for a workspace that has just opened
(`openRequest` holds the new request by then). That is wasteful and writes nothing; it is stated in the
arm's comment and is not fixed here.

> **Correction — Phase 2d-5-4-G, 2026-09-20, review finding 2.** ~~That is wasteful and writes
> nothing~~ — **it writes three things and one of them is an injected call into the window.**
> `recoverFromLostHistory` as this record left it wrote `lifecycle += 1`, wrote
> `block = { kind: 'running' }` and called `host.reopenWorkspace(openRequest)`, all three below the
> injected `host.openWriteSurfaces()` read that no comparison stood under. A registry read that
> synchronously calls `dispose()` and *then* answers an **empty** list therefore had a **disposed**
> coordinator ask the window to throw away and reload its whole workspace — the exact harm
> `dispose()`'s own increment is documented as preventing, and the increment cannot prevent it because
> that disposal lands *below* `accept()`'s only fence. The drain recorded `'accepted'`. **It was a
> correctness defect in source, not waste**, and it is closed at 2d-5-4-G by a comparison inside
> `recoverFromLostHistory` taken **below** the registry read and above the first write; the source
> comment that carried the same false sentence is corrected in the same pass. **The conclusion of §2 is
> unaffected**: the arm this section's own fix added is right and is untouched.

---

## 3. Review finding 2 — the batch validated was not the batch accepted

> `src/lib/browser/reconciliationCoordinator.ts:1274` (with `:1266`) — BLOCKER, source.

### 3.1 Verdict: **HOLDS**

`answer.value.epoch` was validated on one line and `answer.value` was read **again** on the line that
called `accept()`. `answer` is whatever the injected `host.drain()` resolved with, so `value` may be
an accessor answering a different object each time. The epoch check then validates object **A** and
`accept()` spends object **B** — and because `adopted` is already `true` on that path, B's epoch is
never compared with anything at all. B's `newest_sequence` becomes the watermark handed straight back
to `host.drain()`, and B's observations are admitted into the accepted-sequence map under path-stable
identities, where they refuse the showing epoch's later observations as `'superseded'`.

**No lifecycle movement is required**, which is why nothing 2d-5-4-E added defended it: one session,
one epoch, two reads of one property. It is the check-and-spend shape `CLAUDE.md` names, in its
sharpest form — the check and the spend are two reads of **the same** property.

### 3.2 The fix

`reconciliationCoordinator.ts:1339` reads `answer.value` **once** into `delivered` and materializes the
batch's four members from that one object into a plain snapshot. The epoch check validates the
snapshot, and `accept()` is handed the same snapshot, so its own four reads read data properties.
**`accept()`'s signature is unchanged and its top fence is exactly where it was.**

> **Correction — Phase 2d-5-4-G, 2026-09-20, this round's sweep.** ~~`:1339`~~ — **`:1343`**, and the
> statement is `const delivered = answer.value;`. Off by the same four lines and for the same reason as
> §2.2's; on the tree **Phase 2d-5-4-G** leaves it is at **`:1436`**. Two other citations in this record
> were re-derived in the same pass and are **right**: §6.3's `:983`
> (`const observationCount = observations.length;`) and §6.4's `observationTransitions.ts:1492`
> (`const removeWhileOurs = (): void => {`). Both of those are above the rewritten comment block or in
> the other module, which is why the offset missed them.
>
> The sentence *"`accept()`'s signature is unchanged and its top fence is exactly where it was"* was
> re-derived and **stands**, at 2d-5-4-F and at 2d-5-4-G alike: the signature 2d-5-4-G changed is
> `recoverFromLostHistory`'s, which gained a `lifecycleAt` parameter.

**The consequence is written into the comment rather than discovered later.** The `value` getter and
the four member getters now fire **above** the `staleEpoch` arm instead of below it. They are still
below the `disposed` check and both generation checks, and still above `accept()`'s comparison — so a
getter that ends the lifecycle is caught exactly as before, by `accept()` answering `false` and the
drain recording `'staleOpen'`.

> **Correction — Phase 2d-5-4-G, 2026-09-20, this round's sweep.** ~~caught exactly as before~~ — **caught
> above every write, but not always by the same catcher.** Three of the four member getters used to fire
> *inside* `accept()`, below the `staleEpoch` arm; they now fire above it. So when `expectedAdopted` is
> `true` and the batch names an epoch this session is not showing, a getter that ends the lifecycle is
> caught by the `staleEpoch` arm and the drain records **`'staleEpoch'`**, never reaching `accept()` at
> all. Nothing is written on either path, so this is a **label** rather than a state defect — and §9 item
> 5 of this record, which notes that the getters moved above that arm, is evidence the round held the fact
> and did not carry it into this sentence. The source comment is bounded in the same pass.

**What this does not close**, said here because the re-derivation asked for it if it was not: the
`.epoch` **double read** is closed as a side effect — the snapshot's `epoch` is validated and the same
data property is what `accept()` adopts — so the coincidence the re-derivation names (that
`expectedAdopted` and `adopted` are kept in step by `workspaceOpened()` being the only writer of
`adopted`) is no longer load-bearing. It is still true, and nothing states it in a type.

**And one comment the fix left behind, corrected by the orchestrator on the same tree.** The inline
comment on `accept()`'s top fence still enumerated *"one of the **four** reads above"* — the fifth,
`observationCount`, had just been hoisted beside them by §6.3's fix — and it still offered that read
as a way the workspace could be reopened, which the single live caller's plain snapshot makes
impossible. Both halves are now written: the count is five, those five reads run **no caller code at
all** from the one caller that exists today, and the comparison stays because **nothing in
`ReconciliationBatch` forces a caller to hand this function a plain object**. It is a comment change
in a source file, so §10 counts it inside the same commissioned round and nothing about §7.1's
consequence moves.

> **Correction — Phase 2d-5-4-G, 2026-09-20, review finding 3.** ~~those five reads run **no caller
> code at all** from the one caller that exists today~~ — **four of the five do; the fifth does not.**
> The snapshot `runOneDrain` builds copies four members by value, but its `observations` member is a
> copied **reference** to the array the injected `host.drain()` supplied, so `observations.length` — the
> fifth read, and the one §6.3 hoisted — is a property read on the caller's own object. A `Proxy` `get`
> trap or an own `length` accessor there runs caller code from the live caller. **A passing case in this
> very commit drives exactly that path**: `reconciliationCoordinator.test.ts`'s *drops no count when the
> observation list's own length reopened the workspace* hands `control.answer()` a `Proxy` whose
> `length` trap calls `coordinator.workspaceOpened('/tmp/other')` and asserts the trap fired. So the
> sentence asserted unreachable the path the case in the same commit proves reachable — and §9 item 7
> of this record, which notes that on a `Proxy` the hoisted read is *"one more trap firing"*, is
> evidence the round held the fact in one place and denied it in another.
>
> **Nothing behavioural was wrong**, and this is the point of the hoist rather than an argument against
> it: the live read is **above** the comparison, which is why the comparison catches it. What is
> corrected is the claim of inertness. The source comment is corrected in the same pass, splitting the
> claim where the code splits it, and the *"nothing in `ReconciliationBatch` forces a caller to hand
> this function a plain object"* half was re-derived and **stands**.

---

## 4. Review finding 3 — `dispose()`'s increment is necessary, and two comments said it was redundant

> `src/lib/browser/reconciliationCoordinator.ts:1505` (and `:782-785`) — MEDIUM, source (comment).

### 4.1 Verdict: **HOLDS**

`accept()`'s fence compares `lifecycle` **alone** and never reads `disposed`. The only `disposed` read
on the drain path is `runOneDrain`'s, and it is above every caller-controlled read of the command's
answer. So a `dispose()` fired from a getter on `answer.value`, on one of the batch's four members or
on `observations.length` lands **below** it — and without `dispose()`'s increment, `accept()` runs to
completion: an epoch adopted after disposal, the blocked state entered, `recoverFromLostHistory()`
reached and with it `host.reopenWorkspace()`, a **disposed coordinator asking the window to throw away
and reload its whole workspace**, and the watermark moved.

This is `CLAUDE.md`'s worst defect class inverted: instead of claiming a guarantee the code does not
give, the two comments **denied a guarantee the code does give**, which invites the deletion.

### 4.2 The fix

The increment stays; **both** comments were rewritten — the one beside the statement and the twin in
the `lifecycle` declaration block. What they now say is that the increment *overlaps* the live
`disposed` read for the fences that consult `stillApplying()`, and is **necessary** for `accept()`.
The rule it also keeps true — *every site that ends the applying lifecycle moves the counter* — is
named as a second reason rather than as the reason.

`2d-5-4-E-notes.md` §2.2's `dispose()` row is struck and corrected in the same pass. **No statement
changed**, so this finding is pinned by no case: there is nothing to measure that is not already
measured by the increment's own absence, which no test can produce without editing source.

---

## 5. Review finding 4 and its sweep — the identity-reallocation rationale

> `docs/decisions/2d-5-4-notes.md:485` — MEDIUM, record.

### 5.1 Verdict: **HOLDS**, and the review named two of at least seven

`open()` **reallocates nothing**. `identity_of` in `crates/espansoconfig-core/src/workspace/mod.rs`
takes a `OnceLock<Mutex<SessionIdentities>>` keyed by **path** and returns the existing entry for a
known one, so the same path answers the same `DocumentId` for the life of the **process**, a
recreation of the file at that path included. `Workspace::from_tree`'s own doc says identities are
stable across two `open` calls of a directory that changed as well as one that did not.

What an `open()` really replaces is **workspace membership and everything derived from it**, and the
replacing epoch **restarts its observation sequences** — which is what
`reconciliationCoordinator.ts`'s `workspaceOpened()` comment already says correctly, and what the two
earlier corrections wrote out.

### 5.2 The seven live instances, each corrected

| Where | How |
|---|---|
| `2d-5-4-notes.md` §3.6 | struck in place, replaced with the membership reason |
| `2d-5-4-notes.md` §7 item 13 | struck in place |
| `2d-5-2b-notes.md` §7 | struck in place, with a correction block below it |
| `2d-5-2a-A-notes.md` §2.6 | struck in place |
| `2d-5-2a-A-notes.md` §item 5 of the thin section | heading struck; the item's **mark and its check are unchanged** |
| `2d-5-2a-notes.md` §item 4's 2d-5-2a-A correction block | **not rewritten** — the block is quoted as 2d-5-2a-A wrote it, and a *correction to the correction* was added below it |
| `2c-3a-1-notes.md` | struck in place |

**The convention is the one those files already use**: `~~struck~~` plus a bold attribution naming the
phase and the finding, and a correction block rather than a rewrite wherever the passage is itself a
correction. **No history was rewritten.**

**What is left is named in §9 item 3 rather than claimed to be done.** `rg -i reallocat docs/` still
matches in sixteen files; most of the residue is review reports, re-derivations, the progress archive,
and blockquotes inside earlier records that the re-derivation did not classify. **None is a
correctness defect in a source file.**

---

## 6. The seven swept findings

### 6.1 W1 — `applyChange`'s guard doc said the epoch detects a replacement

**MEDIUM, source (comment).** The guard's ordering paragraph justified its second question with *"the
epoch, because a workspace replaced meanwhile is a different lifecycle"* — which is **vacuous for a
session that adopted `0`**, exactly as this chain's own new doc on `lifecycleMovedUnder` says four
hundred lines away. The two are now made to agree: the sentence carries the vacuity clause, and a new
paragraph names `lifecycleIsOurs` as the member that does answer a replacement and says that this
guard deliberately does not ask it, pointing at the host's own open-generation capture inside
`rereadUnderGuard` as what catches one instead. **The guard's *ordering* claim — `stillApplying`
first, because the arm below it fires a component's callback — is unchanged and survives verbatim.**

### 6.2 W2 — `stillApplying`'s "what it does not cover" list was never updated

**LOW, source (comment).** The parenthetical named the epoch and the host's open-generation capture as
what says whether the workspace was replaced, and 2d-5-4-E then added `lifecycleIsOurs` — whose own
doc, in the same interface, says it is *"the question neither `epoch` nor `stillApplying` can
answer"*. The parenthetical now names `lifecycleIsOurs` first and bounds the other two: the epoch only
for a session that adopted a non-zero one, the capture only on the paths that take one.

### 6.3 W3 — `accept()`'s doc and two record passages claimed a fence the code did not give

**MEDIUM, source + record.** Three places asserted that the comparison is followed by nothing but the
observations. The source half is `accept()`'s doc block, which now enumerates **two** kinds of caller
code below the comparison — the recovery's registry read and the observations — and states that a
compound assignment's **store follows its operand's getter**. The record half is
`2d-5-4-E-notes.md` §2.4 and §9 item 1, both struck and corrected; §9 item 1's error is precisely the
word *statement*, because `observations.length` is not a statement but the **operand** of one.

`observations.length` is now materialized with the other four reads, above the comparison
(`reconciliationCoordinator.ts:983`), so the doc's claim is true of the code rather than of an
intention.

### 6.4 W4 — `applyNamedRow`'s removal was outside the fence beside it

**MEDIUM, source.** `noteWhileOurs` re-asks `sequences.isNewest` before writing a status, because
`session.requestMembershipReload()` and `workspace.holdsDocument()` stand between this arm's `admit`
and every write below — the arm's own doc block says so. The `removed` arm nevertheless called
`workspace.removeDocument(named)` **unconditionally**, so a newer observation admitted through either
re-entry was overruled by an older `removed`, permanently, because the batch watermark has already
moved past the observation carrying it — and `noteWhileOurs` correctly wrote nothing, so the row
vanished with **no status and nothing recording why**.

The fix is `removeWhileOurs` (`observationTransitions.ts:1492`): **one** `isNewest` call, both of the
arm's writes under it, and the `removed` case reduced to a single call. One arbitration rather than
two, so a later reader cannot split the two writes without deleting a fence rather than moving a line.

> **Correction — Phase 2d-5-4-G, 2026-09-20, review finding 1.** ~~**one** `isNewest` call, both of the
> arm's writes under it~~ — **one call cannot cover both writes, because `workspace.removeDocument()`
> stands between them.** That member is injected — `ReconciliationWorkspace` is a parameter and
> `reconciliationCoordinator.ts` passes its own `host` straight in — so the check taken above the removal
> is **spent** before the status write below it runs, which is the same check-and-spend derivation this
> very section states about `requestMembershipReload` and `holdsDocument`, and the derivation
> `applyRemoval`'s own nine-line comment states about the identical pair of calls. So this fix **traded**
> a fenced status write for a fenced removal rather than adding a fence: pre-fix, `noteWhileOurs` re-asked
> after `removeDocument`; post-fix nothing did, and a `removeDocument` that admitted a newer observation
> of this identity had the older `removed` **status** written over the newer observation's verdict,
> permanently. It was a **regression in source**, and the sentence beginning *"One arbitration rather than
> two"* is what bought it.
>
> 2d-5-4-G keeps **both** arbitrations — the pre-removal one this round added and the at-the-write one it
> deleted — and pins the placement with `observationTransitions.test.ts`'s *writes no removal status when
> the removal itself admitted a newer observation*, which traps the second injected call where this
> round's case traps the first. **What this section got right stands**: the removal really did need a
> fence, and `applyRemoval`'s rule really is untouched.

**It does not contradict `applyRemoval`'s unconditional-transition rule**, and that rule is untouched.
That rule is about an `Addressable` removal, whose `admit` and whose write have **no injected call
between them**; here there are two.

**Pre-existing**: `fe7d61b` did not introduce this, and it is in scope only as the narrower instance
`CLAUDE.md` asks every round to look for.

### 6.5 W5 — `lifecycleMovedUnder`'s doc overstated where it is asked

**LOW, source (comment).** It claimed the predicate is asked *"twice on every observation's path"*.
There are exactly two call sites and the second is inside `applyAddition`, reached only from the
`added` arm. The doc now says **once on every path and a second time on the addition path alone**, and
names the five arms that get one comparison — which matters, because W4 is a defect that the false
sentence would have talked a reader out of looking for.

### 6.6 W6 — `ensurePumping` claimed `pump()` catches everything a drain can throw

**LOW, source (comment).** `pump()` holds no `try` at all, and `runOneDrain`'s wraps only the `await
host.drain(...)`. **No behaviour was changed and no `try`/`catch` was added**, because the
re-derivation found no resulting defect: `void running.then(release, release)` handles both arms, the
slot is released and there is no unhandled rejection. What the corrected comment now says is what is
true — the two-arm handler is right for a **stronger** reason than the one given — and what it costs
when a wire accessor throws: one drain missing from `drains()` entirely, because its reasons were
spliced off `pendingReasons` before the await and no `record()` runs.

> **Correction — Phase 2d-5-4-G, 2026-09-20, this round's sweep.** ~~the re-derivation found no
> resulting defect~~ — **it found no *unhandled rejection*, which is narrower.** The cost enumeration
> stopped one short: `accept()` writes `watermark = newestSequence` **above** the observation loop, so a
> throw from any host member an arm calls — `noteDocumentStatus`, `removeDocument`, `addDocument`,
> `rereadUnderGuard`, `creatorEligibility` — at observation *k* leaves the cursor already advanced past
> the **whole** batch. The next drain asks `host.drain(watermark)`, so observations *k* … *n* are never
> fetched again and nothing counts them as dropped. It is the same mechanism ruling 13 relies on for a
> blocked session, without that ruling's whole-reload obligation behind it.
>
> **The two things this record got right stand**: `void running.then(release, release)` really does
> handle both arms with no unhandled rejection, and a `try` added to make a sentence true really would
> be machinery invented for prose. So 2d-5-4-G **names the third cost in the comment and adds no
> `try`** — closing the partial-application window is a phase decision with its own acceptance
> criteria, and it is carried as such rather than done inside a review tail.

### 6.7 W7 — the routing case pins one arm of six

**LOW, record.** Carried into §9 item 1 as a **recorded only** coverage bound.

---

## 7. What this round deliberately did not do

- **It added no `try`/`catch` to `pump()`.** W6 is a comment defect with no resulting defect, and a
  handler added to make a comment true would be machinery invented for a sentence.
- **It invented no new `DrainOutcome` arm.** `'staleOpen'` already carries *the batch's numbers cannot
  be attributed to the lifecycle now in force*, and review finding 1's refusal is that fact.
- **It did not widen `applyChange`'s guard** to ask `lifecycleIsOurs`. That remains
  `2d-5-4-E-notes.md` §9 item 2's recorded item; this round only made the guard's doc stop denying it.
- **It did not sweep the rest of `docs/` for the identity claim.** The seven live instances the
  re-derivation named are fixed; §9 item 3 records the residue and its shape.
- **It ran no `cargo` command of any kind.** The orchestrator owns the Rust gate.
- **It touched none of the four instrument paths.** `git diff --stat` over `src-tauri/src/main.rs` and
  `src/main.ts` is still `5 insertions(+), 1 deletion(-)`, and `src-tauri/src/probe.rs` and
  `src/probe.ts` are still untracked and unmodified.
- **It edited neither `PROGRESS.md` nor `PROGRESS.json`.**

---

## 8. The gates, and every pre-fix failure message

| Gate | Command | Exit | Figure | Moved? |
|---|---|---|---|---|
| Rust | `cargo test --workspace` — run by the orchestrator, alone, on the final tree | **0** | **1320**, summed over **26** `test result` lines | **unmoved** — no Rust changed; `git diff --stat` names only the instrument's `main.rs` hook |
| `svelte-check` | `npm run check` | **0** | **443 FILES 0 ERRORS 0 WARNINGS** | **unmoved** — no file entered or left the set |
| vitest | `npm test` | **0** | **2413** tests, 61 files | **+4** — exactly the four cases below |
| vite | `npm run build` | **0** | **189 modules** | **unmoved** — no new source module and no new styled component; every change is inside four files already in the graph |

**Both bundle oracles were read**, and both lines rather than one, because the server-only search is
vacuous on its own: `rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` matched
**nothing** (absent, as required) and `rg -c 'window\.__svelte|svelte-trusted-html'
dist/assets/index-*.js` answered **2** (present, as required).

The inherited rung was `1320 / 443 / 2409 / 189`. The only figure that moved is `npm test`, by the four
new cases.

**The four frontend gates were re-run by the orchestrator after its own comment fix** (§3.2's last
paragraph), and all four figures above are that run's, not the fix worker's. **Both complementary
questions were asked of the Rust gate**, not one: the sum over 26 `test result` lines, **no line
lacking `0 failed`**, and **no line lacking `0 filtered out`**. It completed on the first attempt, so
the stale-`target/` host finding has not recurred for nine phases. `cargo clippy --workspace
--all-targets -- -D warnings` exits 0, `cargo fmt --check` exits 0, and `cargo tree -p
espansoconfig-core | rg tauri` finds nothing, so `CLAUDE.md` §3's architecture rule holds by its
post-1b-1 check (D2x).

### 8.1 Every case was confirmed against the pre-fix code

The method: back up the two edited modules, restore them whole from `git show HEAD:<path>` — the
committed pre-fix tree, not a partial revert — run each new case alone with the fixed test files in
place, record the message **verbatim**, restore the edited files from the backup, and confirm with
`git diff --stat` that the fix is back and the four instrument paths are untouched. No `git stash` and
no `git checkout` of a tree.

**Four cases, all new. Two suites.**

| Fix | The case | What it said before the fix |
|---|---|---|
| §2 the recheck in the blocked arm | `reconciliationCoordinator.test.ts:1960` — *writes no cursor when the registry read reopened the workspace* | `AssertionError: expected { epoch: +0, watermark: 500, …(1) } to deeply equal { epoch: +0, watermark: +0, …(1) }` |
| §3 the materialized snapshot | `reconciliationCoordinator.test.ts:927` — *accounts for the batch whose epoch it validated, not a second read* | `AssertionError: expected 500 to be 20 // Object.is equality` |
| §6.3 `observations.length` materialized above the comparison | `reconciliationCoordinator.test.ts:2020` — *drops no count when the observation list's own length reopened the workspace* | `AssertionError: expected 2 to be +0 // Object.is equality` |
| §6.4 the removal under one arbitration | `observationTransitions.test.ts:1416` — *removes no row when the host row question admitted a newer observation* | `AssertionError: expected [ 9 ] to deeply equal []` |

**Each case's first failing assertion is the one that measures the finding**, which is why no
assertion had to be suspended this round — the non-discriminating ones (`sprung`, `control.reopened`,
`sequences.sequenceFor(9)`, `workspace.rows`, the two `drains()[n].outcome` reads that agree across
both trees) are all **below** it and are named as non-discriminating in the cases themselves.

**One extra measurement, because it is evidence about the *shape* of the fix rather than about the
fix.** §6.3's case was re-run against a tree holding **the whole round's fix except the
materialization** — `observationCount` deleted and the compound assignment reading `observations.length`
again — and it still failed with `expected 2 to be +0 // Object.is equality`. So that case
discriminates the materialization specifically, and not §2's recheck, which passes in that tree because
the `length` getter has not yet fired when the recheck is asked.

**Nothing was discarded.** No candidate case was written that passed against both trees.

**Two fixes are pinned by no case, and neither could be.** §4 (the `dispose()` comments) changes no
statement. §6.1, §6.2, §6.5 and §6.6 change no statement either. `CLAUDE.md` already records that no
executable test pins what a comment or a JSDoc contract *claims*; that gap is where those five fixes
live, and §9 item 2 says so.

---

## 9. Where it is thin

Every item carries one of §7.3's two marks. **No item commissions a round** — §7.1 is the only
mechanism and it reads a diff — and **no item below names an unfixed correctness defect in a source
file**, so none holds this step open.

1. **recorded only** — **the routing case pins one arm of six, and does not discriminate the fence's
   placement** (swept finding W7). `observationTransitions.test.ts`'s *refuses a removal whose own
   routing reopened the workspace* is the whole of the evidence for a fence `2d-5-4-E-notes.md` §3.2
   says *"covers all six arms with one comparison per observation"*. It does pin a fence rather than
   an outcome string — its negative assertions fail unless the refusal happens above `admit` — but a
   fence **moved** from `applyObservation` into `applyRemoval` would keep it green while leaving
   `applyChange`, `applyUnreadable`, `applyNamedRow` and `applyUnnamedPath` exposed to the identical
   routing window. Only one arm is driven, and only the `lifecycleIsOurs` clause of the three.
   **Adding arm cases is a phase decision, not a tail obligation.**

2. **recorded only** — **five of this round's eleven fixes are comments, and nothing executable can
   fail them.** §4, §6.1, §6.2, §6.5 and §6.6 change no statement. Reverting any of their prose while
   keeping the code leaves every gate green, which is the gap `CLAUDE.md` names for the i18n suites
   and which applies identically here. The defence is that each corrected sentence was derived from
   the code in this record, so a reader can check the record against the code rather than the code
   against the record.

3. **recorded only** — **the `docs/` sweep for the identity claim is not finished.** Seven live
   instances were named by the re-derivation and all seven are corrected (§5.2). `rg -i reallocat
   docs/` still matches in sixteen files, and the residue is mostly review reports, re-derivations,
   the progress archive, and blockquotes inside earlier records that were never classified. No count
   here supersedes `2d-5-4-E-notes.md` §9 item 7; what it adds is that the claim's **shape** — an
   identity being renumbered — is what to search for, not the word *reallocate*, and that a passage
   quoting an earlier record is not an instance.

4. **recorded only** — **every one of the four cases drives an injected boundary, because that is the
   only boundary that exists.** Production wire values are JSON-parsed plain objects with no
   accessors, and `WriteSurfaceTransition` is a registered no-op. This is the standing coverage bound
   of every finding in this chain, unchanged, and it stops being a bound the moment 2d-5-5 gives that
   transition a real body.

5. **recorded only** — **§3's snapshot moves four getters above the `staleEpoch` arm.** In a tree
   where a wire accessor has side effects, a batch that is refused as `staleEpoch` now runs those four
   getters where it did not before. No fence moved and nothing is written on that path, and in
   production the value is a plain object — but it is a change in *when caller code runs*, and no type
   marks it.

6. **recorded only** — **`recoverFromLostHistory()`'s `true` arm can fire a redundant reopen.** If
   `host.openWriteSurfaces()` reopens the workspace and then answers an **empty** list, the recovery
   proceeds, bumps the lifecycle a second time and calls `host.reopenWorkspace(openRequest)` — with
   `openRequest` already holding the *new* open's request. Nothing is written and `accept()` returns
   `true`, so it is wasteful rather than corrupting. It is stated in the arm's comment; it is not
   fixed here and no case drives it.

   > **Correction — Phase 2d-5-4-G, 2026-09-20, review finding 2.** ~~Nothing is written … so it is
   > wasteful rather than corrupting~~, and ~~**recorded only**~~. Three things are written — `lifecycle`,
   > `block`, and `host.reopenWorkspace()` into the window — and when the read that reopened is a
   > `dispose()` instead, the third is a **disposed** coordinator asking the window to throw away and
   > reload its whole workspace, with the drain recording `'accepted'`. That is a **correctness defect in
   > a source file**, which `CLAUDE.md` §7.3 does not allow an item to carry: it is fix-now or the step
   > is `BLOCKED`. The mark should have been **actionable**, and it is fixed at 2d-5-4-G by a comparison
   > taken inside `recoverFromLostHistory` below the registry read and above the first write, pinned by
   > `reconciliationCoordinator.test.ts`'s *reopens nothing when the registry read disposed the
   > coordinator*. **The narrow case this item actually describes** — a read that reopens and then
   > answers empty, with no disposal — is also refused by that comparison now, because
   > `workspaceOpened()` moves the same counter, so the redundant reopen is gone with it.

7. **recorded only** — **`observationCount` is now read for every batch, not only for a blocked one.**
   The `.length` read moved above the comparison, so it fires on the accepted path too. On a plain
   array that is free; on a `Proxy` it is one more trap firing where none fired before. This is the
   cost of making the doc's claim true, and it is the cheaper side of the trade.

8. **recorded only** — this round changed no `.svelte` file, added no user-facing string in any
   language and takes no window reading. Nothing on a screen reads an `ObservationOutcome` or a
   `DrainOutcome` at all; 2d-6 is the first phase that draws anything downstream of them.

---

## 10. The §7.1 consequence

**This fix changed four source files**, all under `src/lib/browser/`:

- `reconciliationCoordinator.ts` — the recheck in the blocked arm, the materialized `observationCount`,
  the single-read snapshot in `runOneDrain`, `accept()`'s corrected doc block, both `dispose()`
  increment comments, and `ensurePumping`'s corrected claim;
- `observationTransitions.ts` — `removeWhileOurs` and the `removed` arm, `applyNamedRow`'s doc,
  `applyChange`'s guard doc, `stillApplying`'s doc and `lifecycleMovedUnder`'s doc;
- `reconciliationCoordinator.test.ts` — three cases;
- `observationTransitions.test.ts` — one case.

Six record files were also changed — `2d-5-4-E-notes.md`, `2d-5-4-notes.md`, `2d-5-2b-notes.md`,
`2d-5-2a-A-notes.md`, `2d-5-2a-notes.md`, `2c-3a-1-notes.md` — plus this file. Under §7.1 the record
half is neither a discount nor a second question.

**So §7.1 commissions a further round**, scoped to the source half above.
