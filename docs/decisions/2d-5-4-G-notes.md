# Phase 2d-5-4-G — the round `CLAUDE.md` §7.1 commissioned for 2d-5-4-F's fix

**Status: taken and answered.** Risk class: **high**. Components: **one comment**, in
`src/lib/components/MatchCreator.svelte` — no statement, no markup and no string; §9 item 8 is where
that is weighed rather than waved past.

This is **not** an implementation step. §7.1: *a fix round that changes at least one source file is
owed a review round, scoped to that change.* Phase 2d-5-4-F was itself such a round; its fix changed
four source files, and this is the round that reviews **that fix**. Its own fix changes source, so
§7.1 commissions a further round — §10 says so and says what it is scoped to.

The documents: the brief [`docs/reviews/phase-2d-5-4-G.brief.md`](../reviews/phase-2d-5-4-G.brief.md),
the review [`docs/reviews/phase-2d-5-4-G.md`](../reviews/phase-2d-5-4-G.md), and the re-derivation
[`docs/reviews/phase-2d-5-4-G.rederivation.md`](../reviews/phase-2d-5-4-G.rederivation.md).

---

## 1. How the round was run

**The review was Codex**, dispatched through `autoclaude-review.sh`, which **exited 0** — so no
fallback agent was spawned and this is **nine consecutive Codex rounds**. Verdict `ship-with-fixes`,
**4 findings**, two of them titled `BLOCKER:` in their own text and all four reported at severity
`medium` / `SHOULD-FIX`.

**The finding bodies arrived truncated for the eighth round running**, so the same three-stage shape
was used and nothing was accepted on the report's strength:

1. a **read-only re-derivation worker** derived each finding from the committed tree at `HEAD`
   (`bfc323e`; the change under review is `c410548`) with `rg`, `sed`, `awk` and `git show`, built no
   code and ran no gate, and swept for what the review had missed — finding **eleven** more;
2. **both blockers were spot-checked by the orchestrator** before this worker started, and **all four
   review findings hold**. Two of the four had anchors that are the *comment making the false claim*
   rather than the defective statement — F2's `:1041` and F3's `:988` — which is precise enough to
   re-derive from and is recorded as such below;
3. this fix round closed all fifteen, and pinned both behavioural changes with a case confirmed to
   fail against the **whole** pre-fix tree.

**Every disposition was decided before this worker started.** Nothing below re-litigates whether a
finding holds; what this record adds is what the fix changed and what it does **not** claim.

**Two of the four review findings are the previous round's own fix turning into the next round's
defect**, which is the sequence §7.1 exists to catch: F1 is a **regression** introduced by 2d-5-4-F's
W4 fix, and F2 is a correctness defect in the branch 2d-5-4-F newly declared safe in as many words.

---

## 2. Review finding 1 — the removal fix lost the guard it was standing on

> `src/lib/browser/observationTransitions.ts:1493` (cause `:1493`, harm `:1497`) — source, and a
> **regression** of the fix under review.

### 2.1 Verdict: **HOLDS**

`applyNamedRow` admits at its top, and then two **injected** calls stand between that `admit` and
every write below it — `session.requestMembershipReload()` and `workspace.holdsDocument()`. That is
the reason the arm has a fence at all, and the arm's own doc says so. 2d-5-4-F fenced the removal by
collapsing **both** of the `removed` arm's writes under a **single** `isNewest` call above them:

```ts
if (!sequences.isNewest(named, route.sequence)) { return; }
workspace.removeDocument(named);
workspace.noteDocumentStatus(named, { kind: 'removed' });
```

`workspace.removeDocument` is a host member on the injected `ReconciliationWorkspace`, and
`reconciliationCoordinator.ts` passes its own `host` straight in as that parameter — so it is caller
code by construction, not merely by type. One re-entrant `sequences.admit(named, S')` with
`S' > route.sequence` fired from inside it makes every later `isNewest(named, route.sequence)` answer
`false`; the check above the removal is therefore **spent** before the status write below it runs,
with a whole method call in between. `CLAUDE.md`: *a check and a spend separated by any property read
are not atomic* — here they are separated by more than a property read.

**It is a regression, and the pre-fix tree did not have it.** `git show
c410548^:src/lib/browser/observationTransitions.ts` has the `removed` arm calling
`noteWhileOurs({ kind: 'removed' })`, which re-asked `isNewest` **after** `removeDocument`. So the fix
**traded** a fenced status write for a fenced removal rather than adding a fence, and
`2d-5-4-F-notes.md` §6.4's *"One arbitration rather than two"* is the sentence that bought the trade.

**The module states F1's own derivation three times, about the same pair of calls.** `applyRemoval`
carries nine lines of it above `workspace.removeDocument(route.document)` — *"Fenced, because
`removeDocument` is a host member"* — `applyAddition` carries it for `addDocument`, and every status
write in `applyChange` goes through a helper that re-asks at the write. After 2d-5-4-F,
`removeWhileOurs` was the **only** write site in the module whose fence stood above an injected call
rather than at the write.

### 2.2 The fix

`observationTransitions.ts:1544` keeps **both** arbitrations — the pre-removal one 2d-5-4-F added and
the at-the-write one it deleted:

```ts
const removeWhileOurs = (): void => {
  if (!sequences.isNewest(named, route.sequence)) {
    return;
  }
  workspace.removeDocument(named);
  noteWhileOurs({ kind: 'removed' });
}; // End of function removeWhileOurs()
```

That is `applyRemoval`'s shape plus the pre-removal guard the `Named` column needs because two
injected calls stand above it. Three writes, three `isNewest` calls, each immediately above the write
it guards.

**Two comments were corrected with it, and one of them is the defect's own rationale.**
`removeWhileOurs`'s doc has lost *"One `isNewest` call, not two"* and now says why one call cannot
cover both writes. `applyNamedRow`'s *"Every write this function makes is fenced, the removal
included"* now says **which** fence covers which write, because the fix's own stated reason — injected
calls standing between the `admit` above and every write below — applies verbatim to `removeDocument`
standing between the check and the status write.

**What the fix does not claim.** `noteWhileOurs`'s fence is not a fence over `removeDocument`, and
nothing in TypeScript ties a write in this arm to an arbitration: both helpers are local arrow
functions and a fourth write added beside them would compile. What holds the discipline is the
ordering, the two doc blocks that state it, and the two cases in §8.1.

---

## 3. Review finding 2 — the recovery can reopen a workspace after a disposal

> `src/lib/browser/reconciliationCoordinator.ts:1041` (the comment making the false claim); cause
> `:893`, harm `:912`, with `:904` and `:905` — source.

### 3.1 Verdict: **HOLDS**, and the review's anchor is the comment rather than the statement

`:1041-1044` is the sentence *"The recovery's own `true` arm needs no such recheck: it writes
nothing"*. The defect is in the function that sentence is about, which is where this fix lands. The
review named the right pair; the re-derivation supplied the anchors.

### 3.2 The derivation

`runOneDrain` takes its only `disposed` read above every caller-controlled read of the command's
answer, and its own comment says that placement is deliberate. `accept()` compares the applying
lifecycle at its top and — since 2d-5-4-F — again in the blocked arm after the recovery declines.
`dispose()` sets `disposed` **and** increments `lifecycle`, and that increment is documented as being
what stops *"a disposed coordinator asking the window to throw away and reload its whole workspace"*.

`recoverFromLostHistory`'s **first statement** was the injected `host.openWriteSurfaces()`, with a
`.length` read on its answer — two caller-controlled operations on one line, and **nothing below them
asked either question**. A read that synchronously calls `dispose()` and *then* answers an **empty**
list therefore fell straight through to `lifecycle += 1`, `block = { kind: 'running' }` and
`host.reopenWorkspace(openRequest)`. The increment cannot defend this, because the disposal lands
*below* `accept()`'s only fence, not above it. The recovery returned `true`, `accept()` returned
`true`, and the drain recorded `'accepted'` — the one outcome whose doc claims *the cursor moved*.

**What goes wrong is an injected side-effecting call made after disposal** — a whole-workspace reload
the window is asked to perform — plus two writes to module state and a wrong outcome string. The
design consult's own Q4 bullet, *"Pending or returned drains perform no transition after disposal"*,
is violated on that path.

### 3.3 The fix

`recoverFromLostHistory` takes the caller's capture and compares it **below** the registry read and
its `.length`, **above** the first write:

```ts
function recoverFromLostHistory(lifecycleAt: number): boolean {
  if (host.openWriteSurfaces().length > 0) {
    return false;
  }
  if (lifecycle !== lifecycleAt) {
    return false;
  }
```

**Below the read on purpose**: above it, the comparison would be spent by that read and would answer
nothing about what the read did. §8.1 measures exactly that — a probe with the comparison moved above
the registry read fails the new case identically to the pre-fix tree.

**There is exactly one caller and it already holds the capture.** `rg -n recoverFromLostHistory` over
the repository outside `docs/` finds the declaration, its closing-bracket comment, two references in
comments, and **one call site**, in `accept()`'s blocked arm; `accept()` receives `lifecycleAt` as a
parameter, so the capture was threaded from there and **no caller had to invent one**.

**No new outcome arm was invented.** `false` from the recovery reaches `accept()`'s existing
comparison, which fails for the same reason and answers `false`, which `runOneDrain` already records
as `'staleOpen'` — *this batch's numbers cannot be attributed to the lifecycle now in force*.

**Two overclaims were corrected with it**, because the comment is the reason a reader would not look
for the defect:

- the source comment at the blocked arm's second `false`, which said the recovery's `true` arm *writes
  nothing*; it now names the two state writes and the injected call, and names the second cause that
  reaches that `return false`;
- the record halves — `2d-5-4-F-notes.md` §2.2 (*"That is wasteful and writes nothing"*) and §9 item 6
  (*"Nothing is written … so it is wasteful rather than corrupting"*), the latter marked **recorded
  only** when what it names is a correctness defect in a source file, which `CLAUDE.md` §7.3 does not
  allow an item to carry. Both carry correction blocks.

`dispose()`'s interface doc was bounded in the same pass (S4), because *"makes every pending or
returning drain inert"* is the interface-level twin of the sentence this fix falsified.

**What the fix does not claim.** The comparison is not atomic with the registry read either — it is
below it, which is the point, but a *second* injected read added between the two would reopen the same
window. Nothing in TypeScript forces the one caller to pass its own capture: a caller passing the live
`lifecycle` would make the comparison vacuous, and the parameter's own doc says so.

---

## 4. Review finding 3 — the snapshot does not make the fifth read inert

> `src/lib/browser/reconciliationCoordinator.ts:988`; cause `:1348`, harm `:983` — source (comment)
> **and** record. Not a missing runtime fence.

### 4.1 Verdict: **HOLDS**, in full, including the review's own line numbers

`runOneDrain` builds a snapshot of four members. Three are copied by value; the fourth is
`observations: delivered.observations` — a **reference** to whatever object the injected `host.drain()`
supplied. `accept()`'s fifth read, `observations.length`, is therefore a property read on the
**caller's** array: a `Proxy` `get` trap or an own `length` accessor on it runs caller code there,
from the one live caller.

The comment beneath said the opposite — *"those five reads run no caller code at all today"*, with the
first of them *"unreachable from the one live caller"*. **A passing case in the same commit drives
exactly that path**: `reconciliationCoordinator.test.ts`'s *drops no count when the observation list's
own length reopened the workspace* hands a `Proxy` whose `length` trap calls
`coordinator.workspaceOpened('/tmp/other')` and asserts the trap fired. So the comment asserted
unreachable the path its own suite proves reachable.

### 4.2 The fix

The claim is split where the code splits it. The **four** member reads are own data properties of the
snapshot and run no caller code; **`observations.length` remains a live caller-controlled read**,
which is *why* it is hoisted above the comparison rather than left in the blocked arm's compound
assignment — and the case is named in the comment as the evidence. The half that was true is
untouched: the comparison stays because nothing in `ReconciliationBatch` forces a caller to hand
`accept()` a plain object. `runOneDrain`'s snapshot comment now says that the `observations` member is
a copied **reference, not a copied list**, and `2d-5-4-F-notes.md` §3.2 carries the correction block.

**No behaviour changed**, and this is the point of the hoist rather than an argument against it: the
live read is above the comparison, which is why the comparison catches it. **No case pins this fix**,
because it changes no statement — §9 item 2.

---

## 5. Review finding 4 — the identity sweep left the unrelated-file rationale standing

> `docs/decisions/2d-5-2a-A-notes.md:210`, naming `:169-172` — **record only**. No source file is
> involved.

### 5.1 Verdict: **HOLDS**

Two halves, both false of this tree:

- §3.2 asserts that the source comment *"now names reallocation"*. `rg -i reallocat` over `src/`,
  `crates/`, `src-tauri/`, `scripts/` and the root files finds **nothing**. What stands above
  `projectionGenerations.clear()` in `src/lib/browser/workspace.svelte.ts:3536-3538` is the opposite:
  *"The identities survive the load below — they are path-stable — so an entry kept here would be the
  **same** file's count."*
- §3.1's derivation, in the record's own voice, says a surviving registration *"names a `DocumentId`
  that now denotes a **different file**"*, and §3.2 concludes *"a false refusal over an unrelated
  file"*. That is the exact claim 2d-5-4-F struck twelve lines earlier in the same file.

### 5.2 The Rust contract, and what the corrected sentence claims

Re-derived from `crates/espansoconfig-core/src/workspace/mod.rs`, which distinguishes two identities
the record ran together:

- **Path identity is permanent and is what a `DocumentId` is.** `identity_of` returns the existing
  entry for a known path from one process-wide `OnceLock<Mutex<SessionIdentities>>` keyed by path, and
  `SessionIdentities::next` is *"Never reused, so a removed file's identity cannot be inherited by
  another file"*. `Workspace::from_tree`'s doc adds that identities are stable across two `open` calls
  of a directory that **changed** as well as one that did not. So *"now denotes a different file"* and
  *"an unrelated file"* are both impossible.
- **Document identity *within a workspace* is what an `open()` replaces.** `identity_of`'s own doc
  draws the line: *"An identity minted here is not an address in any particular `Workspace`."*
  Membership and everything derived from it go, and the replacing workspace may not hold that path at
  all — in which case the lookup answers `WorkspaceError::UnknownDocument` for the very number the
  registration still names.

**So the true cost is narrower, still real, and about the right file**: `competingSurfaceFor` can
refuse a restore of **the file the closed surface really was about**, and `targetingSurfaceFor` can
attribute **that same file** to that same dead surface. Both remain refusals rather than permissions,
so *a write is still safe* survives intact — which is why the decision §3.2 records is unaffected.

### 5.3 The fix

Two correction blocks in `2d-5-2a-A-notes.md`, one under §3.1 and one under §3.2, in the convention
those files already use: the original sentence left exactly as written, `~~struck~~` clauses, and a
bold attribution naming this phase and the finding. **The historical quotation of the old source
comment at `:169` is left untouched** — §3.1 is a *What it was* section and that sentence really did
stand in `workspace.svelte.ts`.

---

## 6. The eleven swept findings

### 6.1 S1 — `stillApplying`'s doc denied a guarantee the code gives

**MEDIUM, source (comment), and a narrower instance of 2d-5-4-F's own W2, standing in the doc comment
W2 fixed.** The paragraph enumerating *"The epoch, the accepted sequence, the registry generation and
the host's own three captures"* concluded that *"every one of them is unmoved by a coordinator that has
stopped"*, and the disposal bullet said *"Nothing a guard compares moves when a coordinator is
disposed"*. Both predate `lifecycleIsOurs`, which 2d-5-4-E added to the same interface and which
**does** move on a disposal: `dispose()` increments the applying lifecycle, and `lifecycleMovedUnder`'s
doc ninety lines below says so in as many words. W2's fix bounded the *"What it does not cover"*
paragraph and left these two unbounded, so one comment said both things.

**Fixed** by bounding both to the guard this module actually builds: `applyChange`'s guard asks four
questions and deliberately does not ask `lifecycleIsOurs`, so nothing **it** compares moves on a
disposal. **The opening count was left alone** — *"the other three"* is a claim about which questions
pre-existed the sentence, and this round could not re-derive what it counted, so it was not replaced by
a number this round invented.

**Why it matters rather than being pedantry**: this is the **inverted** defect class 2d-5-4-F's own
finding 3 named — a comment denying a guarantee the code does give, which invites the deletion of
`dispose()`'s increment. F2 is the proof that the increment is already only half sufficient.

### 6.2 S2 — `2d-5-2b-notes.md` §7's own voice, three paragraphs below its correction block

**MEDIUM, record only.** *"Not clearing costs a false refusal over an unrelated file"* stands in that
section's own voice below 2d-5-4-F's correction of the identical claim at the section's opening, and
below a passage 2d-5-4-E had already corrected. **Fixed** with a correction block naming the same Rust
contract and the block twenty lines above it. The comparison the paragraph draws — refusals on the
*keep* side, a permission on the *clear* side — is unaffected and is stated as such.

### 6.3 S3 — `2d-5-2a-notes.md` §3's quoted 2d-5-2a-A block got no correction-to-the-correction

**MEDIUM, record only.** 2d-5-4-F wrote exactly that block for §7 item 4's copy of the same quoted
passage and not for §3's, which carries the false derivation three different ways — *"reallocated by
the load below it"*, *"now denotes a different file"*, *"a false refusal over an unrelated file"*. And
2d-5-2a-B's correction beneath it ends *"The claim itself is unaffected and stands. Only the pointer
was wrong"* — a later phase's own voice asserting the struck claim still stands. **Fixed** with a
correction-to-the-correction under 2d-5-2a-B's block, striking all three clauses and saying in as many
words that *"the claim itself is unaffected"* was true of the **citation** finding it answered and is
not true of the claim.

### 6.4 S4 — `dispose()`'s interface doc claimed every drain is made inert

**MEDIUM, source (comment).** F2's path is a drain that has already passed the only `disposed` read and
afterwards writes `lifecycle`, writes `block`, calls `host.reopenWorkspace()` and records `'accepted'`.
**Fixed in the same pass as F2, which is the only way it can be fixed honestly**: the sentence now
names the two things that carry "inert" — the post-await `disposed` check for a drain above it, and the
applying-lifecycle counter for a drain below it, *including* the comparison now inside the recovery —
and says what the call cannot do, which is unwind a write already made.

### 6.5 S5 — `'staleOpen'`'s doc enumerated two causes of an `accept()` that answers `false`

**MEDIUM, source (comment).** *"which is a getter on the injected answer or on the batch reopening the
workspace"* was true while the top comparison was the only `false`. 2d-5-4-F added one in the blocked
arm whose cause is neither: the injected registry read. This is precisely the shape 2d-5-4-F's own W3
closed one function away, left standing in the type's own doc. **Fixed** by naming three
caller-controlled reads and dropping the *"which is"*.

### 6.6 S6 — `accept()`'s `@returns` promised that nothing whatever was written

**MEDIUM, source (comment).** Exact for the `false` at the top; the second `false` stands **below five
writes** — `adopted` and `epoch`, and `lastDiscarded`, `discardedNoticeCount` and `block`. Whether the
residue survives depends on **which** site moved the lifecycle, and only one of the three clears it:
`workspaceOpened()` clears all five, `dispose()` clears nothing, and the recovery's own increment
returns `true` and so never reaches that `false`. **Fixed** in both places that carried it — the
`@returns` and `'staleOpen'`'s *"and neither moved anything"* — by promising what is true on both
paths, that **no cursor moved**, and naming the five and their three fates.

### 6.7 S7 — two citations in `2d-5-4-F-notes.md` are off by exactly four lines

**LOW, record only.** §2.2's `:1019` is `:1023` at `c410548` (`if (lifecycle !== lifecycleAt) {`) and
§3.2's `:1339` is `:1343` (`const delivered = answer.value;`); both are **below** the comment block
§3.2's own last paragraph records the orchestrator rewriting after the record was written — a four-line
growth, which is the offset. §6.3's `:983` and §6.4's `observationTransitions.ts:1492` were re-derived
and are **right**, which is consistent: both are above that block or in the other module. **Fixed** by
correction blocks that give the number at `c410548`, the number on the tree this phase leaves, and the
**quoted statement** beside each, which is the defence `2d-5-2a-A-notes.md:191-193` prescribes.

### 6.8 S8 — a cross-file citation that resolves numerically and names unrelated code

**LOW, source (comment), in a fifth file.** `MatchCreator.svelte` claimed
*"`workspace.svelte.ts:3328-3331` rebuilds a `RestoreContext` around that very array"*. That range is
the sidebar snippet-count loop (`counts.set(view.id, view.matches.length)`), read to confirm it; the
file's only `RestoreContext` literal is at **`:4451-4454`**. **Not one of the four excluded stale
citations** the brief names. **Fixed** to `:4451-4454`, with the old number named. Every other citation
in the same comment block was checked by the re-derivation and resolves.

### 6.9 S9 — *"caught exactly as it was"* names the wrong catcher

**LOW, source (comment) + record.** Three of the four member getters used to fire **inside** `accept()`,
below the `staleEpoch` arm; the snapshot moved them above it. So with `expectedAdopted` true and a
batch epoch differing from the frozen one, a getter that ends the lifecycle is caught by the
`staleEpoch` arm and the drain records **`'staleEpoch'`**, never reaching `accept()`. Nothing is written
on either path, so it is a **label** rather than a state defect. **Fixed** in the comment and in
`2d-5-4-F-notes.md` §3.2, bounded to *caught above every write, by `accept()`'s comparison or by the
`staleEpoch` arm now above it*.

### 6.10 S10 — `'pendingRow'`'s variant doc claimed something happened

**LOW, source (comment).** *"A locally pending row **was** marked, removed or annotated"* is false of
every refusing path, and 2d-5-4-F widened it: pre-fix the `removed` arm always performed
`removeDocument`, and after it `removeWhileOurs` can refuse both writes while the arm still answers
`'pendingRow'`. The shipped case asserts exactly that. `rg -n pendingRow docs/decisions/` matches
nothing, so no record had addressed it. **Fixed** to *a locally pending row's arm ran; whether it wrote
depends on its own arbitration*, citing the case, and noting that this is the type header's own rule
about these names applied rather than an exception to it.

### 6.11 S11 — `ensurePumping`'s cost enumeration stops one cost short

**MEDIUM, source (comment) + record.** The corrected comment is right about what `pump()` catches and
then names two costs. A third is not named: `accept()` writes `watermark = newestSequence` **above** the
observation loop, so a throw from any host member an arm calls at observation *k* leaves the cursor
already advanced past the whole batch — the next drain asks `host.drain(watermark)`, observations *k* …
*n* are never fetched again, and nothing counts them as dropped. It is the mechanism ruling 13 relies on
for a blocked session, without that ruling's whole-reload obligation behind it.
`2d-5-4-F-notes.md` §6.6's *"the re-derivation found no resulting defect"* is the record half; what it
found was no unhandled **rejection**, which is narrower. **Fixed as comment and record only** — see §7.

---

## 7. What this round deliberately did not do

- **It added no `try`/`catch` anywhere, and did not close S11's partial-application window.** Closing
  it is a phase decision with its own acceptance criteria; a `try` added to make a sentence true is the
  machinery 2d-5-4-F correctly refused, and doing it inside a review tail is how a tail stops
  converging. §9 item 9 carries it.
- **It invented no new `DrainOutcome` arm for F2.** `'staleOpen'` already carries *the batch's numbers
  cannot be attributed to the lifecycle now in force*, and the recovery's refusal is that fact; the
  existing comparison in `accept()`'s blocked arm turns the recovery's `false` into it with no new code.
- **It did not make `applyChange`'s guard ask `lifecycleIsOurs`.** That is still
  `2d-5-4-E-notes.md` §9 item 2's recorded item. S1's fix only stops two sentences denying that the
  member answers a disposal.
- **It did not finish the `docs/` sweep for the identity claim.** F4, S2 and S3 are the three live
  instances this round's re-derivation classified; §9 item 3 records the residue and the shape to
  search for.
- **It re-marked, rather than re-litigated, `2d-5-4-F-notes.md` §9 item 6.** The item's mark was wrong
  under §7.3 because what it named was a correctness defect in source; the correction block says so and
  the defect is fixed, which is what §7.3 requires.
- **It ran no `cargo` command of any kind, and no `npm run build`.** The orchestrator owns the Rust gate
  and the bundle oracles.
- **It touched none of the four instrument paths.** `git diff --stat src-tauri/src/main.rs src/main.ts`
  is still `5 insertions(+), 1 deletion(-)`, and `src-tauri/src/probe.rs` and `src/probe.ts` are still
  untracked and unmodified.
- **It edited neither `PROGRESS.md` nor `PROGRESS.json`.**

---

## 8. The gates, and every pre-fix failure message

| Gate | Command | Exit | Figure | Moved? |
|---|---|---|---|---|
| `svelte-check` | `npm run check` | **0** | **443 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS** | **unmoved** — no file entered or left the set |
| vitest | `npm test` | **0** | **2415** tests, 61 files | **+2** — exactly the two cases below |
| Rust | `cargo test --workspace` | — | — | **not run by this worker**, by instruction; no Rust source is in scope and none was touched |
| vite | `npm run build` | — | — | **not run by this worker**, by instruction. No source **module** was added, so the ladder's module figure should not move; that is a prediction for the orchestrator's run to confirm, not a measurement |

The inherited rung was `1320 / 443 / 2413 / 189`. The only figure this worker measured that moved is
`npm test`, by the two new cases.

### 8.1 Both behavioural fixes were confirmed against the pre-fix code

The method, as 2d-5-4-F's: copy the two edited modules aside, overwrite each **whole** file from
`git show HEAD:<path>` — the committed pre-fix tree, not a partial revert — run the new case alone with
the fixed test file in place, record the message **verbatim**, copy the module back, and confirm with
`git status --short --untracked-files=all` that the tree holds exactly the four instrument paths and
this round's own changes. **No `git stash` and no `git checkout` of any path.**

| Fix | The case | What it said against HEAD's module |
|---|---|---|
| §2 — the status write back under its own arbitration | `observationTransitions.test.ts:1455` — *writes no removal status when the removal itself admitted a newer observation* | `AssertionError: expected [ { document: 9, status: { …(1) } } ] to deeply equal []` |
| §3 — the comparison inside `recoverFromLostHistory` | `reconciliationCoordinator.test.ts:2020` — *reopens nothing when the registry read disposed the coordinator* | `AssertionError: expected [ '/tmp/espanso' ] to deeply equal []` |

Both then pass on the fixed tree, and the whole suite is green at 2415.

**Each case's first failing assertion is the one that measures the finding**, so no assertion had to be
suspended. The non-discriminating ones are named as such in the cases themselves.

#### The three extra measurements, because placement is what these cases have to pin

`CLAUDE.md`'s standard is that a case must pin the **fence** and not an outcome string, and fail if the
fence were moved somewhere that leaves a sibling exposed. That was measured rather than argued, by
moving the fix and re-running:

1. **F2's comparison moved *above* the registry read** — the plausible wrong placement, and the one a
   reader would reach for. The new case fails identically to the pre-fix tree:
   `AssertionError: expected [ '/tmp/espanso' ] to deeply equal []`. The getter has not fired when the
   comparison is asked, so it passes and the reopen still happens.
2. **F2's comparison moved *below* `lifecycle += 1` and `block = { kind: 'running' }`**, above the
   reopen. `control.reopened` is then empty, so the first assertion passes — and the case still fails,
   on the second: `AssertionError: expected 'running' to be 'blockedByLostHistory' // Object.is
   equality`. The pair therefore pins the comparison to the gap between the registry read and the first
   write.
3. **F1 with the pre-2d-5-4-F shape** — no arbitration above the removal, the status write behind
   `noteWhileOurs`. The **new** case passes, and 2d-5-4-F's case fails:
   `AssertionError: expected [ 9 ] to deeply equal []`. So neither case alone pins both fences and the
   **pair does**: one traps `holdsDocument`, which fires above the helper, and the other traps
   `removeDocument`, which fires inside it, so a single arbitration anywhere in that helper fails one of
   the two whichever end it is taken at.

**What the cases still do not pin, said rather than implied.** F1's new case drives the `removed` arm
only; the `changed` and `unreadable` arms' fences are carried by 2d-5-4-F's case and the 2d-5-4-C case
beside it, not by this one. F2's case drives the disposal cause; the reopen-and-answer-empty cause of
the same comparison is refused by the same line — `workspaceOpened()` moves the same counter — but no
case drives it.

**Nothing was discarded.** No candidate case was written that passed against both trees.

**Thirteen of this round's fifteen fixes are pinned by no case, and none of them could be.** Eight are
source comments (F3, S1, S4, S5, S6, S9, S10, S11), of which S9 and S11 also have record halves; four
are record only (F4, S2, S3, S7); and one is a source citation, S8, which is also a comment. **None of
the thirteen changes a statement**, which is why no case can reach any of them.
`CLAUDE.md` already records that no executable test pins what a comment or a JSDoc contract *claims*;
that gap is where those fixes live, and §9 item 2 says so.

---

## 9. Where it is thin

Every item carries one of §7.3's two marks. **No item commissions a round** — §7.1 is the only
mechanism and it reads a diff — and **no item below names an unfixed correctness defect in a source
file**, so **none holds this step open and the step is not `BLOCKED`**. The two items that did name one,
carried into this round as *recorded only*, are fixed in it: `2d-5-4-F-notes.md` §9 item 6 (F2) and the
regression §6.4 of that record introduced (F1).

1. **recorded only** — **the `Named` column's fences are pinned by three cases and there are six arms in
   the module.** 2d-5-4-F's §9 item 1 stands: `applyObservation`'s routing fence is driven through one
   arm only, so a fence moved from `applyObservation` into `applyRemoval` would stay green while leaving
   four arms exposed. This round adds one more `Named`-arm case and does not change that bound. **Adding
   arm cases is a phase decision, not a tail obligation.**

2. **recorded only** — **thirteen of this round's fifteen fixes are comments or record prose, and nothing
   executable can fail them.** Reverting any of their wording while keeping the code leaves every gate
   green. The defence is that each corrected sentence is derived from the code in this record, so a reader
   can check the record against the code rather than the code against the record. This is the same gap
   `CLAUDE.md` names for the i18n suites.

3. **recorded only** — **the `docs/` sweep for the identity claim is still not finished.** Three live
   instances were classified and fixed this round (F4, S2, S3), after seven at 2d-5-4-F. The
   re-derivation read the residue in `docs/reviews/`, `docs/progress-archive/` and the older `2d-5-4-D`
   and `-E` records only far enough to classify it as quotation or as a round's own description, and says
   a full pass over sixteen files was outside its budget. **The shape to search for is an identity being
   renumbered, not the word *reallocate***, and a passage quoting an earlier record is not an instance.

4. **recorded only** — **both new cases drive an injected boundary, because that is the only boundary
   that exists.** F1 needs a `removeDocument` that re-enters and F2 an `openWriteSurfaces` that does.
   Production wire values are JSON-parsed plain objects with no accessors, and `WriteSurfaceTransition`
   is a registered no-op — asserted by the brief, and **this worker read neither the Tauri host wiring
   nor `BrowserState`'s registry accessor to confirm it**. This is the standing coverage bound of every
   finding in this chain, and it stops being one the moment 2d-5-5 gives that transition a real body.

5. **recorded only** — **the snapshot's four getters run on the `staleEpoch` path where they did not
   before.** 2d-5-4-F's §9 item 5 stands unchanged; what this round adds is that the *consequence*
   sentence about it now names the `staleEpoch` arm as a catcher (S9), so the record and the comment
   agree. No fence moved and nothing is written on that path.

6. **recorded only** — **`observationCount` is still read for every batch, not only for a blocked one.**
   2d-5-4-F's §9 item 7 stands, and this round's F3 fix makes it the *reason* the read is where it is
   rather than a cost noted in passing. On a plain array it is free; on a `Proxy` it is one more trap.

7. **actionable** — **`writeSurfaceRegistry.ts:231`, one of the brief's four excluded stale citations,
   names no citation on this tree.** Line 231 is the closing brace of an interface; the nearest citation
   is at `:242`, pointing at `DetailPane.svelte:844-961`, and that range is inside the component's
   `<script>` block rather than the *"one `if`/`else` chain"* of markup it claims. The citation has sat
   at `:242` since `4f7c500`. **It names a defect in a source comment, not a correctness defect**, so
   §7.3 lets a later phase adopt it and the step closes without it; it is recorded here because the
   re-derivation could not distinguish it from the class the brief excludes, and this round did not fix
   it for that reason.

8. **recorded only** — **this round changed one `.svelte` file and takes no window reading.** The change
   is S8's citation, inside a JSDoc block above an `$effect` in `MatchCreator.svelte`'s `<script>`: no
   statement, no markup, no user-facing string in either language. **The derivation that no screen can
   differ is about the compiler — comments are not emitted — and is not a measurement this round took**,
   because `npm run build` is the orchestrator's. `CLAUDE.md`'s rule that a reading is re-taken after any
   change to a component is written for a change that can alter what is drawn; if the orchestrator reads
   it as unconditional, the remedy is a reading, not a revert. `MatchCreator.test.ts` mounts this
   component and is green.

9. **recorded only** — **S11's partial-application window is open and is named rather than closed.** A
   throw from a host member an arm calls at observation *k* leaves the watermark past the whole batch, so
   observations *k* … *n* are never fetched again and nothing counts them. The comment now says so. It
   names a real gap in **behaviour**, and it is deliberately not marked *actionable*: closing it needs a
   decision about what the coordinator should do with a half-applied batch — re-drain from the failed
   observation, or treat the batch as lost history — which is a phase with acceptance criteria and not a
   line a tail may add.

   **The orchestrator checked this mark rather than accepting it.** It stands, and the reason is that
   §7.3's *correctness defect* needs a decided behaviour to be wrong against: what this application
   should do with a half-applied batch has never been ruled on, and the comment's own sentence says the
   mechanism is the one **ruling 13 sanctions** elsewhere — what is missing is a ruling for this case,
   not conformance to one. So the item is a design gap rather than code deviating from a contract, and
   §7.3's blocker clause does not reach it. It is carried in `PROGRESS.md` as a **named candidate
   corrective phase**, beside the stale-citation class, so that nothing about it depends on a later
   reader remembering it.

10. **recorded only** — **nothing forces a future write in `applyNamedRow` under an arbitration, nor a
    future caller of `recoverFromLostHistory` to pass its own capture.** Both are local functions and
    plain `let` state; a fourth write in that arm, or a second call site handing over the live
    `lifecycle`, would compile. Two doc blocks say so in the same sentence that says what the code does
    force. This is the same *what no type forces* residue the `lifecycle` declaration block already
    carries for its three increment sites.

11. **recorded only** — **F2's comparison is below one injected read and above the writes, which is
    exactly as atomic as that ordering makes it.** A second injected read inserted between the
    comparison and `lifecycle += 1` would reopen the identical window, and nothing marks that ordering.
    The same is true of every fence in this chain; it is recorded here because F2 is the third round in
    a row whose defect was a write below an injected call a previous round's fence stood above.

---

## 10. The §7.1 consequence

**This fix changed five source files.** Four under `src/lib/browser/` and one under
`src/lib/components/`:

- `reconciliationCoordinator.ts` — `recoverFromLostHistory`'s new `lifecycleAt` parameter and the
  comparison below its registry read, the call site that threads the capture, and five corrected comment
  blocks: the blocked arm's second `false`, `accept()`'s top-fence comment and its `@returns`,
  `'staleOpen'`'s variant doc, `dispose()`'s interface doc, `runOneDrain`'s snapshot comment and
  `ensurePumping`'s cost enumeration;
- `observationTransitions.ts` — `removeWhileOurs` routing its status write back through `noteWhileOurs`,
  its own doc, `applyNamedRow`'s doc, `stillApplying`'s doc and `'pendingRow'`'s variant doc;
- `observationTransitions.test.ts` — one case;
- `reconciliationCoordinator.test.ts` — one case;
- `MatchCreator.svelte` — one corrected cross-file citation, in a comment.

Four record files were also changed — `2d-5-4-F-notes.md`, `2d-5-2a-A-notes.md`, `2d-5-2b-notes.md`,
`2d-5-2a-notes.md` — plus this file. Under §7.1 the record half is neither a discount nor a second
question, and the round is scoped to the source half.

**So §7.1 commissions a further round**, scoped to the five source files above. Two of this round's four
review findings were defects that 2d-5-4-F's *fix* created or newly declared safe, which is the whole
reason that rule exists.
