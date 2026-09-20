# Phase 2d-5-4-G — read-only re-derivation of the review, and this worker's own sweep

**Nothing was built, tested or modified.** No `cargo` command, no `npm` command, no script. Every
statement below was derived by reading the committed tree at `HEAD` (`bfc323e`; the change under
review is `c410548`) with `rg`, `sed -n`, `awk`, `git show` and `git log`. The only file this worker
created is this one.

**All line numbers are HEAD's**, and each is quoted with enough of its own text that the orchestrator
can re-derive it if a later edit moves it.

**Verdict summary.**

| Finding | Verdict | True anchor | Source or record |
|---|---|---|---|
| F1 — removal fix loses the post-`removeDocument` guard | **HOLDS** | cause `observationTransitions.ts:1493`, harm `:1497` | **source** (regression introduced by the fix under review) |
| F2 — recovery reopens after a disposal | **HOLDS** | cause `reconciliationCoordinator.ts:893`, harm `:912` (+ `:904`, `:905`) | **source** |
| F3 — the snapshot does not make the fifth read inert | **HOLDS** | `reconciliationCoordinator.ts:988-992`; cause `:1348`, harm `:983` | **source (comment)** + record |
| F4 — the identity sweep leaves the unrelated-file rationale standing | **HOLDS** | derivation `2d-5-2a-A-notes.md:169-172`, conclusion `:210-215` | **record only** |

Eleven further findings were swept (§5): **four Medium in source comments, two Medium in the record,
one Medium source-comment-plus-record, four Low**. Under `CLAUDE.md` §7.1, F1, F2 and at least seven
swept items require source edits, so the fix that answers this round commissions a further round —
stated in §8.

---

## 1. F1 — *Restore the ownership check after `removeDocument`*

> Review anchor: `src/lib/browser/observationTransitions.ts:1493`. Body truncated at *"For example,
> remove Na…"*.

### 1.1 Verdict: **HOLDS**. Source correctness defect, and a **regression** of the fix under review.

### 1.2 The true anchor

- **Cause**: `observationTransitions.ts:1493` — `if (!sequences.isNewest(named, route.sequence)) {`,
  the single arbitration `removeWhileOurs` takes.
- **The injected call that spends it**: `:1496` — `workspace.removeDocument(named);`.
- **Harm**: `:1497` — `workspace.noteDocumentStatus(named, { kind: 'removed' });`, a write to durable
  window state taken below an injected host call with no fence between the two.

### 1.3 The derivation, statement by statement

1. `applyNamedRow` (`:1443`) admits at `:1450` (`sequences.admit(named, route.sequence)`).
2. `removeWhileOurs` (`:1492-1498`) asks `sequences.isNewest(named, route.sequence)` **once**, at
   `:1493`, and then performs **two** writes: `:1496` and `:1497`.
3. `workspace` is `ReconciliationWorkspace` — an **injected interface**. `removeDocument` is declared
   at `:654` and `noteDocumentStatus` at `:661`. The coordinator passes its own `host` straight in as
   this parameter (`reconciliationCoordinator.ts:1106`:
   `observationOutcomeRecords.push(applyObservation(observation, host, accepted, session));`), so
   `removeDocument` is caller code by construction, not merely by type.
4. `isNewest` is `(highest.get(document) ?? 0) === sequence` (`:266-268`) and `admit` sets
   `highest` (`:257-264`). So **one** re-entrant `admit(named, S')` with `S' > route.sequence` makes
   every later `isNewest(named, route.sequence)` answer `false`.
5. Therefore the check at `:1493` is **spent** before `:1497` runs, with an injected call in between.
   `CLAUDE.md`: *a check and a spend separated by any property read are not atomic* — here they are
   separated by a whole injected method call.

### 1.4 The module's own rule says the fence belongs **after** `removeDocument`

This is not a theoretical window; it is the one place in this module that now breaks a rule the module
states three times, and the sibling that states it sharpest is the `Addressable` removal:

```
1366:  workspace.removeDocument(route.document);
1367:  // **Fenced, because `removeDocument` is a host member** — Phase 2d-5-4-C's M4.
1368:  // It clears a selection, drops a projection and re-reads the raw viewer's
1369:  // target, so a window whose removal admits a newer observation of the same
1370:  // identity — an `Added` re-inserting the path, say — would have this `removed`
1371:  // written over that newer verdict, permanently: the batch watermark has moved
1372:  // past the observation that carried it. The removal itself is unconditional,
1373:  // because it is this arm's transition and not a statement about status.
1374:  if (sequences.isNewest(route.document, route.sequence)) {
1375:    workspace.noteDocumentStatus(route.document, { kind: 'removed' });
1376:  }
```

`applyRemoval`'s comment is F1's derivation, written by this project, about the same pair of calls,
nine lines wide, still standing at `:1367-1373`. The same discipline holds at `applyAddition`
(`:1050-1057`: `addDocument`, then `isNewest`, then the status write, with the comment *"`addDocument`
is a host member"*) and throughout `applyChange`, where **every** status write goes through
`noteWhileOurs` (`:1127-1132`), which re-asks at the write — the guard at `:1238-1270` re-asks the
ownership question at `:1247` and again justifies it at `:1258-1261` because *"`tellTheSurfaceAbout`
ran two host members in between"*.

After 2d-5-4-F, `removeWhileOurs` is the **only** write site in the module whose fence is above an
injected call rather than at the write.

### 1.5 It is a regression: the pre-fix tree suppressed this write

`git show c410548^:src/lib/browser/observationTransitions.ts` (the committed pre-fix tree), lines
1455-1458:

```
    case 'removed':
      workspace.removeDocument(named);
      noteWhileOurs({ kind: 'removed' });
      return 'pendingRow';
```

Pre-fix, `noteWhileOurs` re-asked `isNewest` **after** `removeDocument`. Post-fix, nothing does. So
for a re-entry fired from inside `removeDocument` the fix **traded a fenced status write for a fenced
removal** rather than adding a fence — which is exactly the shape the brief's sweep item 2 names, and
`2d-5-4-F-notes.md` §6.4's justification (*"One `isNewest` call, not two, so the two writes cannot be
split by a later reader"*) is the sentence that bought the trade.

### 1.6 Concrete counterexample

The existing case `observationTransitions.test.ts:1416` is one accessor away from it. Take that case
and move the trap from `holdsDocument` to `removeDocument`:

1. `workspace.rows = [9]`; observation = `removal(4, NAMED_NINE)` — a `namedRow`/`removed` for
   identity 9 at sequence 4.
2. `admit(9, 4)` → `highest[9] = 4`, returns `true` (`:1450`).
3. `holdsDocument(9)` → `true` (`:1503`), so the switch is entered and `removeWhileOurs()` runs.
4. `isNewest(9, 4)` → `4 === 4` → `true` (`:1493`). **The fence is spent here.**
5. `workspace.removeDocument(9)` (`:1496`) — the injected host member. Its implementation calls
   `sequences.admit(9, 12)` (the same one-line trap the shipped case uses on `holdsDocument`) and
   returns. `highest[9] = 12`.
6. `workspace.noteDocumentStatus(9, { kind: 'removed' })` (`:1497`) — **the older observation's
   `removed` is written over the newer one's verdict.**

**What goes wrong**: a **write to durable state** (the window's document status), and it is
permanent — the batch watermark has already moved past the observation that carried the newer verdict
(`reconciliationCoordinator.ts:1053`, `watermark = newestSequence`, executed before the observation
loop), so nothing re-derives it. The arm still answers `'pendingRow'`.

On the pre-fix tree the identical sequence wrote nothing at step 6. The shipped case does **not**
catch it: it traps `holdsDocument`, which fires above `removeWhileOurs`, so it pins the fence's
*existence* and not its *placement* (§6.4 below).

### 1.7 The fix

Keep both arbitrations — the pre-removal one the fix added **and** the at-the-write one it deleted:

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
injected calls (`requestMembershipReload`, `holdsDocument`) stand above it. `removeWhileOurs`'s doc
(`:1489-1490`) must lose *"One `isNewest` call, not two"* — that sentence is the defect's rationale —
and `applyNamedRow`'s *"Every write this function makes is fenced, the removal included"*
(`:1426-1430`) must say **which** fence covers which write, since the fix's own reason (*"injected
calls standing between the `admit` above and every write below"*) applies verbatim to
`removeDocument` standing between `:1493` and `:1497`.

A case is owed that pins the **placement**: the same trap moved to `removeDocument`, asserting
`workspace.statuses` is `[]` while `workspace.removed` is `[9]`.

---

## 2. F2 — *Check lifecycle before recovery performs the reopen*

> Review anchor: `src/lib/browser/reconciliationCoordinator.ts:1041`. Body truncated at *"make
> host.openWriteSurfaces call coordinator.dispose() before r…"*.

### 2.1 Verdict: **HOLDS**. Source correctness defect, in the branch 2d-5-4-F newly declared safe.

The review's anchor `:1041` is the **comment that makes the false claim** — *"The recovery's own
`true` arm needs no such recheck: it writes nothing"* (`:1041-1044`). The defect is in the function
that comment is about.

### 2.2 The true anchor

- **Cause**: `reconciliationCoordinator.ts:893` —
  `if (host.openWriteSurfaces().length > 0) { return false; }`. Two caller-controlled operations on
  one line: the injected call, and a `.length` read on the array it answers.
- **Harm**: `:912` — `host.reopenWorkspace(openRequest);`, reached with the coordinator **disposed**.
  Two writes precede it: `:904` `lifecycle += 1;` and `:905` `block = { kind: 'running' };`.
- **Wrong outcome string**: `:1369` records `'accepted'` for that drain.

### 2.3 The derivation

1. `runOneDrain` takes its only `disposed` read at `:1163`, and its own comment at `:1147-1150` says
   the placement is deliberate: *"The one that matters is below the await."* Nothing below `:1163`
   reads `disposed` again on this path — verified by reading every statement from `:1141` to `:1369`.
2. `accept()` takes its lifecycle comparison at `:984` and, since 2d-5-4-F, again at `:1023`. Its own
   doc says the comparison *"reads `lifecycle` **alone** and never reads `disposed`"*
   (`dispose()`'s comment, `:1602-1603`).
3. The blocked arm calls `recoverFromLostHistory()` at `:1015`. Its **first statement** is the
   injected registry read at `:893`.
4. If that read (or the `.length` on its answer) calls `dispose()`, then: `disposed = true` and
   `lifecycle += 1` (`:1597`, `:1614`) — and **nothing in `recoverFromLostHistory` asks either
   question**. With an empty registry answered afterwards, `:893` falls through and the function
   proceeds to `:904`, `:905` and `:912`.
5. `:912` is `host.reopenWorkspace(openRequest)` — which `dispose()`'s own comment names as the harm
   its increment exists to prevent: *"a disposed coordinator asking the window to throw away and
   reload its whole workspace"* (`:1609-1611`). **The increment does not prevent it here**, because
   this disposal lands *below* `accept()`'s only fence, not above it.
6. `recoverFromLostHistory` returns `true`, `accept()` returns `true` at `:1021`, and `runOneDrain`
   records `'accepted'` at `:1369`.

### 2.4 Concrete counterexample

`reconciliationCoordinator.test.ts:1960` already builds every part of this; one line changes.

1. `controlledHost()`, `workspaceOpened('/tmp/espanso')`, `workspaceReady()`, `start()`, flush.
2. Redefine `control.surfaces` as a getter (exactly as the shipped case does at `:1978-1992`) whose
   body calls `coordinator.dispose()` — instead of `coordinator.workspaceOpened('/tmp/other')` — and
   then answers **`[]`** instead of `[SURFACE_OVER_ONE]`.
3. `control.answer(batch({ newest_sequence: 500, discarded: 1, observations: [...] }))`, flush.

**What happens**: `accept()` passes `:984`; adopts the epoch (`:1003-1004`); enters the blocked state
(`:1010-1012`); calls recovery; the getter disposes the coordinator; the empty registry lets recovery
proceed; `lifecycle` moves a second time; `block` is reset to `running`; **`host.reopenWorkspace()`
fires on a disposed coordinator** (`control.reopened` would hold one entry); the drain records
`'accepted'`.

**Classification**: an **injected side-effecting call made after disposal** — a whole-workspace reload
the window is asked to perform — plus two writes to module state (`lifecycle`, `block`) and a wrong
**outcome string** (`'accepted'`, whose doc at `:298` is *"The batch was for this open and this epoch,
and the cursor moved"*, and where `'disposed'` at `:314-315` says *"The coordinator was disposed
before or during the call"*). The design consult's own Q4 bullet — *"Pending or returned drains
perform no transition after disposal"* (`docs/reviews/phase-2d-5-design.md:140`) — is violated on this
path.

### 2.5 Two overclaims this same finding carries

- **Source comment**: `:1041-1044` — *"The recovery's own `true` arm needs no such recheck: it writes
  nothing. It may fire a second, redundant `reopenWorkspace` … which is wasteful and not corrupting."*
  It writes `lifecycle` (`:904`) and `block` (`:905`), and it calls `host.reopenWorkspace` (`:912`).
- **Record**: `2d-5-4-F-notes.md` §2.2 (*"That is wasteful and writes nothing"*) and §9 item 6
  (*"Nothing is written and `accept()` returns `true`, so it is wasteful rather than corrupting"*) —
  §9 item 6 is marked *recorded only*, and under `CLAUDE.md` §7.3 an item naming a **correctness
  defect in a source file** may not be carried. On this derivation it names one.

### 2.6 The fix

The review's proposal is right and is two lines. Give `recoverFromLostHistory` the caller's capture
and compare it **after** the registry read and its `.length`, before `:904`:

```ts
function recoverFromLostHistory(lifecycleAt: number): boolean {
  if (host.openWriteSurfaces().length > 0) {
    return false;
  }
  if (lifecycle !== lifecycleAt) {
    return false;          // the existing recheck at :1023 then answers `false` → 'staleOpen'
  }
  …
```

Returning `false` needs no new outcome arm: `accept()`'s existing `:1023` comparison fails and
answers `false`, which `runOneDrain` already records as `'staleOpen'` (`:1366`). `dispose()`'s
interface doc at `:479` must be bounded in the same pass — see S4.

---

## 3. F3 — *The snapshot does not make the fifth read inert*

> Review anchor: `src/lib/browser/reconciliationCoordinator.ts:988`. Body truncated at *"Consequently
> observations.length at line 983 still invokes…"*.

### 3.1 Verdict: **HOLDS**, in full, including the review's own line numbers.

Source **comment** defect plus record defect. Not a missing runtime fence — the hoisted read is above
the comparison, so the *behaviour* is right; what is false is the sentence that says no caller code
runs.

### 3.2 The derivation

1. `runOneDrain` builds the snapshot at `:1343-1349`. Three members are copied by value; the fourth,
   `:1348`, is `observations: delivered.observations` — a **reference** to whatever object the
   injected `host.drain()` supplied.
2. `accept()` reads `observations.length` at `:983`. That is a property read on the **caller's**
   object, not on the plain snapshot: a `Proxy` `get` trap or an own `length` accessor on that array
   runs caller code there.
3. The comment at `:985-994` therefore says something false of the code beneath it:

   > *"one of the **five** reads above reopened the workspace … **The first of those is unreachable
   > from the one live caller and is still checked**: `runOneDrain` now hands this function a plain
   > snapshot of own data properties, so those five reads run **no caller code at all** today."*

   Four of the five read own data properties of the snapshot. The fifth does not, and it is reachable
   from the one live caller.
4. **The suite in the same commit proves it.** `reconciliationCoordinator.test.ts:2020` — *"drops no
   count when the observation list's own length reopened the workspace"* — builds
   `new Proxy([...], { get(target, property) { if (property === 'length' && !sprung) { sprung = true;
   coordinator.workspaceOpened('/tmp/other'); } … } })`, hands it to `control.answer(batch(...))`, and
   asserts `expect(sprung).toBe(true)`. That trap can only fire at `:983`, through the live caller.
   So the comment asserts unreachable exactly the path a passing case in the same commit drives.
5. **Record half**: `2d-5-4-F-notes.md` §3.2's last paragraph says *"the count is five, those five
   reads run no caller code at all from the one caller that exists today"*.

### 3.3 The fix

Split the claim where the code splits it: the **four** member reads are own data properties of the
snapshot `runOneDrain` builds and run no caller code; **`observations.length` remains a live
caller-controlled read**, which is *why* it is hoisted above the comparison rather than left in the
compound assignment — and the case at `:2020` is the evidence. The `@returns` and the rest of the doc
block already say the comparison stays because nothing in `ReconciliationBatch` forces a plain
object; that half is true and unaffected. `2d-5-4-F-notes.md` §3.2 needs the same correction, and §9
item 7 (*"`observationCount` is now read for every batch … on a `Proxy` it is one more trap firing"*)
is consistent with the corrected reading and is evidence the record knew it in one place and denied it
in another.

---

## 4. F4 — *The identity sweep leaves the unrelated-file rationale standing*

> Review anchor: `docs/decisions/2d-5-2a-A-notes.md:210`, naming lines 169-172.

### 4.1 Verdict: **HOLDS**. **Record only** — no source file is involved.

### 4.2 The two passages, quoted

`2d-5-2a-A-notes.md:167-172` (§3.1, *What it was*), in the record's own voice:

> The same file at `:2269` clears `projectionGenerations` because *"Their identities are reallocated
> by the load below"*. A registration that survives an `open()` therefore names a `DocumentId` that
> now denotes a **different file**: `competingSurfaceFor` refuses a restore of a file nobody has open,
> and `targetingSurfaceFor` attributes that file to a surface that is not about it.

`:210-215` (§3.2, *What changed*):

> What changed is the comment and the record — **both now name reallocation** and state the two costs,
> and both say that the costs are **refusals rather than permissions**, so a *write* is still safe and
> the price is a **false refusal over an unrelated file**.

### 4.3 Why each half is false on this tree

- **`rg -i reallocat` over `src/`, `crates/`, `src-tauri/`, `scripts/` and the root files finds
  nothing.** The source comment §3.2 claims *"now names reallocation"* says the opposite today:
  `workspace.svelte.ts:3536-3538`, above `projectionGenerations.clear()` at `:3542`, reads *"The
  identities survive the load below — they are path-stable — so an entry kept here would be the
  *same* file's count."* So the quotation at `:169` is history (fine — it is a `What it was` section),
  but the sentence at `:212` asserting what the comment *now* says is false of HEAD.
- **The derivation at `:170-172` is false of the Rust contract** (below), and it is the record's own
  voice, not a quotation.
- **`:213-214`'s *unrelated file* is the conclusion that derivation produces**, and it is the exact
  claim 2d-5-4-F struck twelve lines earlier in the same file (`:143-151`, §2.6, struck with
  *"`open()` reallocates nothing"*). The sweep corrected §2.6 and thin item 5 and left §3 standing —
  `git show c410548 --unified=0 -- docs/decisions/2d-5-2a-A-notes.md` shows exactly two hunks, at
  `:143`/`:145` and at the thin section.

### 4.4 The Rust contract, re-derived

`crates/espansoconfig-core/src/workspace/mod.rs`:

- `SessionIdentities` (`:216-221`): `next: u64` — *"Never reused, so a removed file's identity cannot
  be inherited by another file"* — and `by_path: BTreeMap<PathBuf, DocumentId>`. Its doc (`:200-214`)
  says a path *"keeps its identity for the life of the process, a new file gets a fresh one, and an
  identity whose file is gone matches nothing and comes back as `WorkspaceError::UnknownDocument`"*.
- `session_identities()` (`:271-279`): one process-wide `OnceLock<Mutex<SessionIdentities>>`.
- `identity_of(path)` (`:316-328`): returns the existing entry for a known path, else mints and
  inserts. Its doc adds the sentence F4's corrected text needs: **"An identity minted here is not an
  address in any particular `Workspace`."** It says *this process names that path under this
  number*, and nothing more; *"Only a `Workspace` can say whether it holds a path, and
  `Workspace::document_id` is the question."*
- `Workspace::from_tree` (`:471-499`): *"Identities come from the **session's path table**, not from
  the tree's order, so they are stable across two `open` calls of a directory that **changed** as well
  as one that did not."*

### 4.5 What the corrected sentence should claim

Distinguish the two identities the Rust contract distinguishes:

- **Path identity is permanent and is what a `DocumentId` is.** A surviving registration's
  `DocumentId` denotes **the same path** for the life of the process — a deletion and recreation of
  the file at that path included, and no other file can ever be handed that number (`next` is never
  reused). So *"now denotes a different file"* and *"an unrelated file"* are both impossible, and no
  cost of not clearing the registry can be described that way.
- **Document identity *within a workspace* is what an `open()` replaces.** Membership and everything
  derived from it go; the replacing workspace may not hold that path at all, in which case
  `Workspace::document_context` answers `WorkspaceError::UnknownDocument` for the very number the
  registration still names.
- **So the true cost is narrower and still real, and it is about the right file**:
  `competingSurfaceFor` can refuse a restore of **the file the closed surface really was about**, on
  the strength of a surface belonging to a workspace this window is closing; `targetingSurfaceFor` can
  attribute **that same file** to that same dead surface. Both remain refusals rather than
  permissions, so *a write is still safe* survives intact — which is why, as the existing correction
  blocks say, the decision §3.2 records is unaffected.

The fix is a correction block under §3.1 and a second under §3.2 (the convention those files already
use: `~~struck~~` plus a bold attribution), leaving the historical quotation of the old source comment
at `:169` exactly as written.

---

## 5. The sweep

Eleven findings. Each is given as *severity · file:line · source or record · what the fix is*. The
shapes searched were the brief's seven, and the negative results are in §6.

### S1 · Medium · `src/lib/browser/observationTransitions.ts:748-750` (with `:730-736`) · **source (comment)**

**A narrower instance of W2, standing in the same doc comment W2 fixed.** `stillApplying`'s doc opens
*"The question the other three could not ask"* and enumerates *"The epoch, the accepted sequence, the
registry generation and the host's own three captures"* (`:732-735`), then its second bullet says:

> **Disposal.** Nothing a guard compares moves when a coordinator is disposed, so a read in flight at
> `dispose()` would install after reconciliation was stopped.

Both sentences predate `lifecycleIsOurs`, which 2d-5-4-E added to this same interface and which
**does** move on disposal: `dispose()` increments `lifecycle` (`reconciliationCoordinator.ts:1614`),
and `lifecycleMovedUnder`'s doc ninety lines below says so in as many words — *"`lifecycleIsOurs`
answers a replacement, **a disposal** and a self-requested reopen"* (`:838-839`). 2d-5-4-F's W2 fix
bounded the *"What it does not cover"* paragraph (`:752-762`) and left the enumeration and the
disposal bullet unbounded, so the same doc comment now says both things.

Why it matters rather than being pedantry: this is the **inverted** defect class 2d-5-4-F's own review
finding 3 named — a comment **denying a guarantee the code does give**, which invites the deletion of
`dispose()`'s increment. That increment is what F2 shows is already only half sufficient.

**Fix**: bound both sentences to the guard this module actually builds — *nothing `applyChange`'s
guard compares moves on a disposal, because that guard deliberately does not ask `lifecycleIsOurs`
(`:1178-1185`)* — rather than claiming it of any guard.

### S2 · Medium · `docs/decisions/2d-5-2b-notes.md:363-364` · **record only**

The same *unrelated file* claim F4 names, standing **three paragraphs below 2d-5-4-F's own correction
block in the same section**. §7's opening was struck and corrected at `:332-344`; at `:363-364` the
section's own voice still says:

> Not clearing costs a false refusal over **an unrelated file**, because both consumers refuse rather
> than permit — a write stays safe.

Identities are path-stable and never reused (§4.4), so the refusal is over **the file the surface
really was about**. **Fix**: strike *unrelated* and name the true cost, citing the correction block
twenty lines above it. (Note `:369-375` in the same section was already corrected at 2d-5-4-E, which
is what makes this one a missed instance rather than an unswept file.)

### S3 · Medium · `docs/decisions/2d-5-2a-notes.md:236-241` and `:266` · **record only**

**The same file got a correction-to-the-correction for one quoted 2d-5-2a-A block and not for the
other.** `git show c410548 --unified=0 -- docs/decisions/2d-5-2a-notes.md` is a single 11-line
insertion, at item 4 (`:440-450`), and `2d-5-4-F-notes.md` §5.2's table names only *"§item 4's
2d-5-2a-A correction block"*. §3's 2d-5-2a-A block at `:234-247` carries the identical false
derivation — *"the identities of the documents it holds are **reallocated** by the load below it"*,
*"names a `DocumentId` that now denotes a **different file**"*, *"the cost is a false refusal over an
unrelated file"* — and the 2d-5-2a-B correction beneath it ends, at `:266`:

> **The claim itself is unaffected and stands.** Only the pointer was wrong.

which is a later phase's own voice asserting the struck claim still stands. **Fix**: the same
correction-to-the-correction the sweep already wrote at `:440-450`, placed under `:267`, plus a clause
noting that 2d-5-2a-B's *"the claim itself is unaffected"* was true of the citation finding it
answered and is not true of the claim.

### S4 · Medium · `src/lib/browser/reconciliationCoordinator.ts:479` · **source (comment)**

`dispose()`'s interface doc claims it *"makes every pending or returning drain **inert**"*. F2's path
is a drain that has already passed the only `disposed` read (`:1163`) and afterwards writes
`lifecycle`, writes `block`, calls `host.reopenWorkspace()` and records `'accepted'`. The claim is the
interface-level twin of the one at `:1041-1044`. **Fix**: either close F2 (then bound the sentence to
*a drain that has not yet passed the post-await `disposed` check, and every arm that asks
`stillApplying()`*), or, if F2 were somehow left open, this sentence would have to say which drains
are not inert. The two must be fixed in one pass, because the comment is the reason a reader would not
look for F2.

### S5 · Low → Medium · `src/lib/browser/reconciliationCoordinator.ts:303-309` · **source (comment)**

`'staleOpen'`'s variant doc enumerates the causes of an `accept()` that answers `false`:

> this arm is also what `accept` answering `false` records, **which is** a getter on the injected
> answer or on the batch reopening the workspace from inside the reads.

Since 2d-5-4-F there is a **second** `false` return, at `:1045`, whose cause is neither of those: it is
the injected registry read inside `recoverFromLostHistory` (`:893`). This is precisely the shape W3
closed one function away — *"the enumeration here was short by exactly that until 2d-5-4-F"*
(`:936-938`) — left standing in the type's own doc. **Fix**: add the registry read to the enumeration,
or replace *"which is"* with a bound.

### S6 · Medium · `src/lib/browser/reconciliationCoordinator.ts:970-971` (with `:308-309`) · **source (comment)**

`accept()`'s `@returns` says:

> `false` when the lifecycle moved under it and **nothing whatever was written**.

That was true while `:984` was the only `false` return. The fix added one at `:1045`, **below five
writes**: `adopted = true` and `epoch = batchEpoch` (`:1003-1004`), and `lastDiscarded`,
`discardedNoticeCount += 1` and `block = { kind: 'blockedByLostHistory', … }` (`:1010-1012`).
`'staleOpen'`'s doc repeats it — *"and neither moved anything"* (`:308-309`).

Whether the residue survives depends on **which** site moved the lifecycle, and only one of the three
clears it: `workspaceOpened()` clears all five (`:1653-1664`); `dispose()` clears nothing, so on the
F2-style disposal path a disposed coordinator is left holding `adopted = true`, an adopted `epoch`,
`lastDiscarded`, a bumped `discardedNoticeCount` and a `blockedByLostHistory` block, and then answers
`false`; `recoverFromLostHistory()`'s own increment always returns `true` and so never reaches `:1045`.
**Fix**: state what the `false` at `:1045` does and does not promise — no **cursor** write, and five
pre-recovery writes that the replacing `open()` clears and a disposal does not.

### S7 · Low · `docs/decisions/2d-5-4-F-notes.md:69` and `:105` · **record only**

Two citations to the tree the record itself describes are **off by exactly four lines**, and the record
names the mechanism that moved them:

| Record says | Actual HEAD line | Text at HEAD |
|---|---|---|
| §2.2 `reconciliationCoordinator.ts:1019` *"re-asks the same comparison"* | **`:1023`** | `if (lifecycle !== lifecycleAt) {` |
| §3.2 `reconciliationCoordinator.ts:1339` *"reads `answer.value` **once** into `delivered`"* | **`:1343`** | `const delivered = answer.value;` |
| §6.3 `:983` | `:983` ✓ | `const observationCount = observations.length;` |
| §6.4 `observationTransitions.ts:1492` | `:1492` ✓ | `const removeWhileOurs = (): void => {` |

The two wrong ones are both **below** `accept()`'s top-fence comment; the two right ones are above it
or in the other module. §3.2's own last paragraph records that the orchestrator rewrote that comment
block (`:985-994`) *after* the fix worker wrote this record — a four-line growth, which is exactly the
offset. This is the shape `2d-5-2a-A-notes.md:191-193` already names: *"A line number derived from a
file the same phase is editing is exactly the shape this finding names."* **Fix**: re-derive both,
and add the quoted statement beside each number, as that earlier correction prescribes.

### S8 · Low · `src/lib/components/MatchCreator.svelte:408` · **source (comment)**

A cross-file citation that resolves numerically and names unrelated code. The comment claims
*"`workspace.svelte.ts:3328-3331` rebuilds a `RestoreContext` around that very array"*.
`workspace.svelte.ts:3322-3333` is the sidebar snippet-count loop (`counts.set(view.id,
view.matches.length)`); the only `RestoreContext` literal in the file is at **`:4451-4454`**
(`const context: RestoreContext = { observed: revisionInProjection(views, session.target), surfaces };`).
**Not one of the four excluded citations.** Every other citation in the same comment block was checked
and resolves: `restore.ts:1993, 2009, 2095, 2397, 2581, 2663, 3228` and
`RestorePane.svelte:340, 509, 510, 515`. **Fix**: `:4451-4454`.

### S9 · Low · `src/lib/browser/reconciliationCoordinator.ts:1337-1342` (and `2d-5-4-F-notes.md` §3.2) · **source (comment) + record**

The snapshot's *consequence* paragraph claims:

> They are still below the `disposed` check and both generation checks, and still above `accept()`'s
> comparison, so a getter that ends the lifecycle **is caught exactly as it was** — by `accept()`
> answering `false` and this drain recording `'staleOpen'`.

Not exactly. Three of the four member getters (`discarded`, `newest_sequence`, `observations`) used to
fire **inside** `accept()`, below the `staleEpoch` arm; they now fire above it (`:1345-1348`). So with
`expectedAdopted` true (`:1145`) and a batch epoch differing from the frozen `expectedEpoch`, a getter
that ends the lifecycle is caught at `:1350` and the drain records **`'staleEpoch'`**, never reaching
`accept()` at all. Nothing is written on either path, so this is a label rather than a state defect —
but *"caught exactly as it was"* names the wrong catcher, and §9 item 5 of the record (which notes the
getters moved above that arm) shows the round had the fact and did not carry it into this sentence.
**Fix**: bound the sentence to *caught above every write, by `accept()`'s comparison or by the
`staleEpoch` arm now above it*.

### S10 · Low · `src/lib/browser/observationTransitions.ts:813-814` · **source (comment)**

`'pendingRow'`'s variant doc is *"A locally pending row **was** marked, removed or annotated."* It is
false of every refusing path, and the fix under review widened it: pre-fix the `removed` arm always
performed `removeDocument` (so something always happened), and post-fix `removeWhileOurs` can refuse
both writes and the arm still answers `'pendingRow'` (`:1511-1512`). The shipped case at
`observationTransitions.test.ts:1416` asserts exactly that — `'pendingRow'` with `workspace.removed`
and `workspace.statuses` both empty. The type's own header bounds outcome names correctly (*"these
names say which arm ran and not what it achieved"*, `:781-784`), so only the variant doc is wrong.
`rg -n pendingRow docs/decisions/` matches **nothing**, so no record has ever addressed it.
**Fix**: *"A locally pending row's arm ran; whether it wrote depends on its own arbitration."*

### S11 · Medium · `src/lib/browser/reconciliationCoordinator.ts:1454-1457` (and `2d-5-4-F-notes.md` §6.6) · **source (comment) + record**

The corrected `ensurePumping` comment is right about what `pump()` catches and then closes its cost
enumeration too early:

> What that costs is one drain missing from {@link drains} — its reasons were spliced off
> `pendingReasons` before the await and no `record()` runs — and **not** a stranded slot, because the
> rejection arm below releases it.

A third cost is not named: `watermark = newestSequence` is written at `:1053`, **above** the
observation loop at `:1096-1107`. So a throw from any host member an arm calls — `noteDocumentStatus`,
`removeDocument`, `addDocument`, `rereadUnderGuard`, `creatorEligibility` — at observation *k* leaves
the cursor already advanced past the whole batch, so observations *k*…*n* are **never fetched again**
(`afterSequence = watermark`, `:1151`) and nothing records that they were dropped. It is the same
mechanism ruling 13 documents for a blocked session at `:960-963`, but without that ruling's
whole-reload obligation behind it. `2d-5-4-F-notes.md` §6.6's *"the re-derivation found no resulting
defect"* is the record half.

**Fix (comment and record, not machinery)**: name the third cost, and if the partial-application
window is to be closed, that is a phase decision — a `try` added to make a sentence true is the
machinery §7 of that record correctly refused.

---

## 6. What was checked and found sound

Recorded because a round that reports only findings gives the next round no baseline.

1. **`2d-5-4-F-notes.md` §8.1's four pre-fix failure messages are all consistent with the code**,
   re-derived rather than trusted:
   - `:1960` case — pre-fix, `watermark = 500` was written after the registry getter's
     `workspaceOpened()` had zeroed it, hence `watermark: 500` versus `watermark: +0`. ✓
   - `:927` case — pre-fix, the substitute object's `newest_sequence` (500) became the watermark
     instead of the validated 20. ✓ (`expect(reads).toBe(1)` pins the single read directly.)
   - `:2020` case — a compound assignment evaluates its reference, **reads the old value**, then
     evaluates the operand: so `0` is read, the `length` trap zeroes the count, and `0 + 2` is stored.
     `observationsDropped()` is 2 where 0 is expected. ✓ And the record's extra measurement is
     derivable too: with the whole fix minus the materialization, the `:1023` recheck passes (the trap
     has not fired yet) and the same assertion fails identically, which is what makes that case
     evidence for the hoist rather than for the recheck. ✓
   - `:1416` case — pre-fix, `removeDocument` ran unconditionally, so `workspace.removed` is `[9]`. ✓
2. **The two modules' own cross-file citations resolve and point at the right content**:
   `observationTransitions.ts:8` → `docs/reviews/phase-2d-5-design.md:246-256` is Q8's table;
   `reconciliationCoordinator.ts:8` → `:126-144` is Q4's drain lifecycle. Both checked by reading.
3. **No live instance of the struck identity claim survives in source.** `rg -i reallocat` over
   `src/`, `crates/`, `src-tauri/`, `scripts/` and the root files finds nothing, and the three places
   that discuss it state the corrected version (`reconciliationCoordinator.ts:525-530`, `:1646-1652`,
   `observationTransitions.ts:233`).
4. **No consuming operation with a discarded result** exists in either module.
   `rg '\.delete\(|\.shift\(|\.pop\(|\.splice\(|\.clear\('` over both finds four sites: two
   `splice`es whose result is consumed (`:1143`, `:1618`) and two `clear()`s, which return nothing.
5. **The four new cases pin fences rather than outcome strings, with one gap.** `:927` asserts
   `reads === 1`; `:1960` and `:2020` assert the cursor and the dropped count are unmoved **and** that
   the outcome is `'staleOpen'` rather than `'accepted'`, so a fence removed in either direction fails
   them; `observationTransitions.test.ts:1416` asserts both writes absent, so it survives a fix that
   re-splits the arbitration correctly. **The gap is placement, not existence**: `:1416` traps
   `holdsDocument`, which fires above `removeWhileOurs`, so it is green both for the shipped fence and
   for the fence F1 asks for — and green for the defect F1 names. `:1960` drives only the
   registry-declines arm, so no case reaches F2's arm at all.
6. **`ensurePumping`'s corrected claim about `pump()` is otherwise accurate**: `pump()` (`:1391-1397`)
   holds no `try`, `runOneDrain`'s wraps only `await host.drain(afterSequence)` (`:1153-1162`), and
   `answer.ok` at `:1318` is outside it.

---

## 7. What could not be settled by reading

1. **Whether either correctness defect is reachable in production.** Both need an injected
   `ReconciliationHost` member to re-enter — `removeDocument` for F1, `openWriteSurfaces` for F2. The
   brief declares wire values are JSON-parsed plain objects and `WriteSurfaceTransition` is a
   registered no-op; this worker read neither the Tauri host wiring nor `BrowserState`'s registry
   accessor to confirm it, and the whole chain's standard is the injected boundary regardless.
2. **The gate figures.** Nothing was run. The brief's ladder (1320 / 443 / 2413 / 189) is taken as
   given; any fix answering this round moves `npm test` by whatever cases it adds and should not move
   the module count, since every file named here is already in the graph.
3. **`writeSurfaceRegistry.ts:231`, one of the four excluded citations, names no citation on this
   tree.** Line 231 is the closing brace of an interface. The nearest citation is `:242` →
   `src/lib/components/DetailPane.svelte:844-961`, and that range is inside the component's `<script>`
   block (which runs `:1-1017`), not the *"one `if`/`else` chain"* of markup it claims; the citation
   has sat at `:242` since `4f7c500`, so the excluded item's own number is either stale or names
   something else. **Reported here rather than as a finding**, because it cannot be distinguished from
   the class the brief excludes.
4. **Whether the remaining `rg -i reallocat docs/` residue holds further live instances.** Three were
   classified here (F4, S2, S3) by reading each hit in the `2d-5*` and `2c-3a-1` records. The residue
   in `docs/reviews/`, `docs/progress-archive/` and the older `2d-5-4-D`/`-E` records was read only far
   enough to classify it as quotation or as a round's own description of the claim; a full pass over
   sixteen files was outside this budget, and `2d-5-4-F-notes.md` §9 item 3 already carries it as
   *recorded only*.
5. **Whether F1's counterexample can be built without a custom `removeDocument`.** The shipped
   `recordingWorkspace()` helper was not read in full; the case sketched in §1.6 assumes the same
   spread-and-override shape the `:1416` case uses, which is present there.

---

## 8. The `CLAUDE.md` §7.1 consequence

F1 and F2 are correctness defects **in source**, so under §7.3 each is fixed now or the step is
`BLOCKED` with the item named. S1, S4, S5, S6, S9, S10 and S11 are source comments; S8 is a source
comment in a fifth file. F4, S2, S3 and S7 are record only.

Any fix answering this round therefore **changes at least one source file**, so §7.1 commissions a
further round, scoped to that fix. The tail does not end here.
