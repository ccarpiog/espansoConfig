# Re-derivation — Phase 2d-5-4-C's four findings

Read-only. **No build, test, package, `cargo` or `npm` command of any kind was run**; only `git show`,
`rg`, `sed`/`awk` and file reads. The only file this step created or modified is this one.

Why this document exists: the Codex report `docs/reviews/phase-2d-5-4-C.md` renders finding bodies to a
fixed width and truncates them at ~180 characters — the fourth round in a row — so **no finding may be
accepted on the report's strength**. Each of the four below is re-derived from the code at `HEAD`
(`834ed1b`, which carries the fix under review), with the decisive lines quoted and the reviewer's
wording corrected where it is wrong.

## Verdicts at a glance

| # | Anchor as reported | Verdict | Defect in |
|---|---|---|---|
| 1 | `workspace.svelte.ts:719` | **HOLDS** (one clause of the wording corrected) | source (+ a false comment at 709–712, + a false record) |
| 2 | `workspace.svelte.ts:3130` → the culprit is **2468** | **HOLDS** (one clause of the wording corrected) | source (+ four overclaiming records/comments) |
| 3 | `workspace.svelte.ts:3599` | **HOLDS IN PART** — the defect holds, *"introduced by the summary copy"* does not | source |
| 4 | `observationTransitions.ts:901` → the write is at `workspace.svelte.ts:**2429**` | **HOLDS**, and the record overclaim is wider than reported | source (+ a false comment at 874–878) |

**All four are source.** Under `CLAUDE.md` §7.1 the fix round for this review changes at least one
source file whichever subset is taken, so **another round is commissioned regardless of severity
ranking**.

The four share one threat model, and it is the project's settled one: `commands`, the drained wire
values and the `ReconciliationWorkspace` host are all injected, so a property read on one of them is
arbitrary code (`CLAUDE.md`, *a check and a spend separated by any property read are not atomic*).
**Finding 2 needs none of that** — it is reachable in the shipped window with no accessor at all.

---

## Finding 1 — the selection repair keeps the command's `MatchId`, and `ownedRepair` says so on purpose

**Verdict: HOLDS.** One clause of the reported wording is wrong and is corrected below; the defect,
its severity and the prescribed fix are right.

### The decisive lines

The identity is minted from the **unnormalized** answer, one call before `ownedRepair` sees it:

- `src/lib/browser/selection.ts:294-300` — `repairSelection`'s `reresolve` arm:
  ```
  294:      const reloaded = await reload(previous.document);
  298:      const found = reresolve(previous, reloaded.value);
  300:        return { kind: 'kept', selected: found.selected, reloaded: reloaded.value };
  ```
  `reload` is `commands.reloadDocument`, so `reloaded.value` is the command's own object.
- `src/lib/browser/selection.ts:193-207` — `reresolve` copies the identity **by reference**:
  ```
  193:  const candidate = view.matches[previous.position];
  202:    selected: {
  203:      id: candidate.id,
  ```
- `src/lib/browser/workspace.svelte.ts:717-724` — `ownedRepair` normalizes `reloaded` and passes
  `selected` straight through:
  ```
  719:    case 'kept':
  720:      return {
  721:        kind: 'kept',
  722:        selected: repair.selected,
  723:        reloaded: ownedProjectionOf(repair.reloaded)
  724:      };
  ```
  So `repair.selected.id === candidate.id` — an object `commands` built, at the **third** level, the
  exact level 2d-5-4-B's finding 2 closed everywhere else.
- `src/lib/browser/workspace.svelte.ts:3752-3757` — the call site, and the staleness check the review
  names:
  ```
  3752:      const repair = ownedRepair(
  3753:        await repairSelection(next, resolved.failure, commands.reloadDocument)
  3754:      );
  3755:      if (selectionLookupIsStale(generation, document, projection)) {
  3756:        return;
  3757:      }
  ```
- `src/lib/browser/workspace.svelte.ts:3256-3258` — where it is retained:
  ```
  3256:      case 'kept':
  3257:        installView(repair.reloaded);
  3258:        replaceSelection(repair.selected);
  ```

### The clause that is wrong

*"…and it is then read after the final selection-staleness check."* Inside `select()` **nothing reads
`selected.id`'s own properties after 3755**: `installView` walks owned views, `replaceSelection`
(2667-2670) is a counter bump and an assignment, `notice = 'kept'` is a literal, and `readFileText()`
reaches `rawTarget` (`rawDocument.ts:62-74`), which reads `selected.document` — an own data property
of the literal `reresolve` built, not of the command's object.

The danger is **one step later and lives for the rest of the session**: the trap object is now in
module state, and it is read as the *last conjunct of three selection-follow guards*, each immediately
before the `replaceSelection` that guard justifies.

- `src/lib/browser/workspace.svelte.ts:4675-4686` — `adoptTheDocumentOnDisk`:
  ```
  4675:    if (
  4676:      ownedMoved !== null &&
  4677:      selected !== null &&
  4678:      selected.document === document &&
  4679:      isTheSameIdentity(selected.id, ownedTarget)
  4680:    ) {
  4684:      const position = positionInSameParse(next, ownedMoved);
  4685:      if (position !== null) {
  4686:        replaceSelection(selectMatch(next, position));
  ```
  `isTheSameIdentity` (437-446) reads `held.document`, `held.revision` and `held.node` — three
  accessor firings on the command's object, *after* the first two conjuncts have been answered.
- `src/lib/browser/workspace.svelte.ts:4113-4116` — `deleteMatch`'s `heldBefore` capture.
- `src/lib/browser/workspace.svelte.ts:4193-4196` — `duplicateMatch`'s `intent` capture, which
  `adoptAfterTheDuplicate` then re-validates by reference at 4838-4839.

**Statements that can run caller code between the check and the spend:** exactly one, and it is the
check's own last conjunct — `isTheSameIdentity(selected.id, ownedTarget)` at 4679. Everything after
it (`positionInSameParse` → `positionOf` → every `match.id.node` of `next`, then `selectMatch`) is
module-owned data, which is what `ownedMatchIdOf` bought and what 4828-4834's comment correctly
claims for `adoptAfterTheDuplicate`.

### The concrete failure sequence

1. `commands.reloadDocument` answers a projection whose `matches[k].id` carries a `get node()` (or
   `get document()`) trap. (Injected boundary; the same standard under which 2d-5-4-B's findings 1, 2
   and 4 were accepted and fixed.)
2. The person clicks a snippet. `select()` runs, `commands.getMatch` refuses with a code
   `identityRecovery` maps to `reresolve`, `repairSelection` reloads, `reresolve` answers
   `sameMatch`, and `applyRepair` installs the owned projection and holds `repair.selected` —
   whose `id` is the trap object. Notice: `kept`. Nothing has gone wrong yet.
3. Later the person moves that snippet. `BrowserState.moveMatch` commits and calls
   `adoptTheDocumentOnDisk(document, match, answer.value.moved, 'requestedMove')` (3890-3895).
4. At 4679 the trap fires. It synchronously calls `state.clearSelection()` — or `state.select(other)`,
   whose synchronous prefix bumps `selectGeneration` and assigns `selected` — and then returns values
   equal to `ownedTarget`'s, so the conjunction is `true`.
5. 4686 writes the selection to the moved snippet and sets `notice = null`, **over the intent the
   person expressed inside the guard**. The window ends up on the moved snippet with no notice; the
   click or the clear is discarded. That is 2c-3c step 2's High, at the one identity ingress the
   previous round's fix did not reach.

### Source or record

**Source**, and a record with it. The fix is in `src/lib/browser/workspace.svelte.ts` — `ownedRepair`
must rebuild the kept `SelectedMatch` field by field with `ownedMatchIdOf(repair.selected.id)` (the
copy then happens at 3752, before the check at 3755, which is where every other ingress copy sits).
Two prose halves go with it: the JSDoc at 709-712 (see **M1** below) and
`docs/decisions/2d-5-4-notes.md` §7 item 12's new correction block.

### What a pinning test would assert, and what exists

**Exists: nothing, in either form.** No case answers `reloadDocument` with a projection whose
`matches[i].id` carries getters, and no case anywhere asserts object ownership of a held value (no
`not.toBe(trap)`, no `getOwnPropertyDescriptor`). The nearest neighbour is
`workspace.test.ts:8722` — *'repairs the selection against the projection it read, not a re-entrant
one'* — which puts a `get source_text()` trap on a reloaded `MatchView` and ends with `selected`
**null**, so nothing is retained. The eight cases on the `select()` → failing `getMatch` →
`repairSelection` path are at `workspace.test.ts:1031, 1074, 1104, 1135, 1149, 1182, 1215, 1254`;
two of them (`1031`, `1182`) take the `kept` arm and neither uses a trap.

The case to write, in `workspace.test.ts` (`scriptedCommands` at `:387`, spread-override style as at
`:8625`): drive `select()` to the `kept` arm with `script.reload` answering a projection whose
`matches[0].id` is `{ get node() { fired += 1; return 30; }, document: 2, revision: … }`; **arm the
trap only after the repair has landed** (the `:9065` idiom); then commit a move of that snippet and
assert (a) `fired === 0` — the adoption's guard read no command-supplied accessor — and (b) the
selection is the moved snippet under an identity `toBe`-distinct from the trap object. Assertion (a)
is the discriminating one; pre-fix it reads ≥ 1.

---

## Finding 2 — a no-op restatement spends the status-ownership token a newer read is holding

**Verdict: HOLDS.** The interleaving is right; one clause of the reported wording is wrong (B captures
the **same** token, not a later one, and that is precisely why it loses). The anchor `3130` is where
the damage shows; the **culprit is 2468**.

### The decisive lines

- `src/lib/browser/workspace.svelte.ts:2919-2923` — the counter is bumped **unconditionally**, value
  change or not:
  ```
  2921:    statusWrites.set(document, (statusWrites.get(document) ?? 0) + 1);
  ```
- `src/lib/browser/workspace.svelte.ts:2427-2432` — the coordinator-facing host member marks, then
  captures:
  ```
  2428:        const opened = openGeneration;
  2429:        noteDocumentStatus(document, { kind: 'stale' });
  2432:        const marked = statusWriteOf(document);
  ```
- `src/lib/browser/workspace.svelte.ts:3070-3075` — a **failed** read is answered as a failure *even
  when it is superseded*; the comment says so in as many words:
  ```
  3070:    if (!fresh.ok) {
  3074:      report(fresh.failure);
  3075:      return fresh.failure;
  ```
- `src/lib/browser/workspace.svelte.ts:2439-2468` — the failure callback, its three fences, and the
  restatement:
  ```
  2443:            if (opened !== openGeneration) { return; }
  2449:            if (marked !== statusWriteOf(document)) { return; }
  2453:            if (!documents.some((held) => held.id === document)) { return; }
  2468:            noteDocumentStatus(document, { kind: 'stale' });
  ```
- `src/lib/browser/workspace.svelte.ts:3059` and `:3130` — the other reader of the same token:
  ```
  3059:    const statusAt = statusWriteOf(document);
  3130:    if (statusAt === statusWriteOf(document)) {
  3131:      noteDocumentStatus(document, null);
  ```

**The check is 2449; the spend is 2468; the statement between them is 2453**, a `documents` read that
2d-5-4-B made module-owned. So this finding is *not* a re-entrancy defect — nothing caller-supplied
runs in the window. It is a **token-accounting** defect: the spend at 2468 is value-neutral by the
fence's own construction and yet advances the very counter a second, newer reader captured.

### The concrete failure sequence (no accessor, no proxy, production-reachable)

Document `D`, `statusWrites[D] = 0`.

1. A `Changed`/`Addressable`/`Projected` observation is admitted; `applyChange` calls
   `workspace.rereadUnderGuard(D, guard)` (`observationTransitions.ts:1005`). The host member marks
   `stale` (2429) → `statusWrites[D] = 1`; `marked = 1`; the private helper captures
   `reread = 1`, `projection = p`, `statusAt = 1` and awaits `commands.reloadDocument(D)`. **Call A.**
2. While A is out, the person uses the recovery control: `state.rereadDocument(D)` (3793) →
   `rereadUnderGuard(D, ALWAYS_PERMITTED)` (3810). It writes **no** initial mark — only the host
   member does — so it captures `reread = 2`, `projection = p`, `statusAt = **1**`. **Call B.**
3. **A comes back a failure.** 3070-3075 returns it regardless of A being superseded. The host
   callback runs: `opened` unchanged ✓; `marked (1) === statusWriteOf(D) (1)` ✓ (B has written
   nothing); the row still exists ✓ → 2468 writes `{stale}` over `{stale}`. **No value changes;
   `statusWrites[D]` becomes 2.**
4. **B comes back a success.** `stillCurrent()` passes, `forgetFileText()`, `installView(next)` —
   the window now shows the bytes on disk. Then 3130: `statusAt (1) === statusWriteOf(D) (2)` is
   **false**, so the clear at 3131 is suppressed.
5. The file is left marked `stale` **permanently**. Nothing re-derives it: the batch watermark has
   advanced past the observation, and only an installation clears the mark. The person's explicit
   recovery succeeded, the projection on screen is current, and the window says otherwise. 2d-6 is
   what draws it; today it is observable through `state.externalDocumentStatus(D)` (4542-4547).

The symmetric orderings are all safe and I checked each: A failing *before* B starts (B captures 2,
clears); two **coordinator** rereads overlapping (B's host member writes its own mark, so
`marked (1) ≠ 2` and A's restatement is refused — this is the case `workspace.test.ts:8855` already
pins); B succeeding before A's failure lands (B clears, `marked (1) ≠ 2`, A refused).

### Source or record

**Source.** Either delete the restatement at 2468 — the fence's own documented property is that a
permitted write changes no value, so deleting it loses nothing — or give it a write that does not
advance ownership. Four prose passages assert the write is harmless and must be corrected with it
(**M3** below).

### What a pinning test would assert, and what exists

**Exists: no case.** The gap is exactly *deferred coordinator failure still in flight while an
explicit `rereadDocument` succeeds*. The two nearest are `workspace.test.ts:8855` — *'keeps an
overlapping reread's installed status over an older failure'*, where **both** arms are coordinator
rereads, so the counter separates them and the case passes either way — and `:8914` — *'clears the
mark when an explicit reread installs the file again'*, which has the right two actors but settles
the coordinator failure **first**, so there is no overlap.

The case to write, in `workspace.test.ts` (`deferred()` at `:565`, `reconciliationBatch()` at `:7690`,
`changedObservation()` at `:7963`, `rereadBaseDocument()` at `:8030`): give `reloadDocument` two
deferred answers keyed by call count — the first rejects/refuses, the second succeeds. Drain a
`Changed` batch for document 2 (starts A, marks `stale`), then `void state.rereadDocument(2)` (starts
B), then settle **B** with a success and assert `state.externalDocumentStatus(2)` is `null`, then
settle **A** with its failure and assert `state.externalDocumentStatus(2)` is **still** `null`. The
last assertion is the discriminating one; pre-fix it reads `{ kind: 'stale' }`.

---

## Finding 3 — `open()` publishes `documents` after running the caller's row getters

**Verdict: HOLDS IN PART.** The check-and-spend gap holds and the prescribed fix is right. The
attribution — *"introduced by the summary copy"* — does **not** hold: the shape pre-existed and the
copy widened it.

### The decisive lines

```
3584:      const listed = await commands.listDocuments();
3585:      if (generation !== openGeneration) {      ← the check
3586:        return;
3587:      }
3588:      if (!listed.ok) {                          ← caller-supplied property read
3598:      const rows: DocumentSummary[] = [];
3599:      for (const summary of listed.value) {      ← caller-supplied property read + caller-supplied iterator
3600:        rows.push(ownedSummaryOf(summary));      ← seven caller-supplied property reads per row (688-698)
3601:      }
3602:      documents = rows;                          ← the spend
...
3627:      for (const document of documents) {
3628:        const view = await commands.getDocument(document.id);   ← a command issued for the spent rows
3629:        if (generation !== openGeneration) { return; }
```

**The check is 3585; the spend is 3602; the statements between them that can run caller code are
3588, 3599 (both the `.value` read and the iteration protocol) and 3600 × seven fields × N rows.**
There is no comparison between them. This is the exact inversion `ownedProjectionOf`'s own header
(580-584 — *"they run **before** the comparisons that decide whether the answer may be installed, and
never between one of those comparisons and the install it approved"*) forbids, and it is the same
defect 2d-5-4-B's finding 1 fixed for the *projection* loop,
left standing in the *summary* loop the same fix introduced.

### Why the attribution is only partly right

`git show 834ed1b -- src/lib/browser/workspace.svelte.ts` shows the line this replaced:

```
-      documents = listed.value;
+      … the loop … documents = rows;
```

So before the fix there were still **two** caller-supplied reads between 3585 and the assignment
(`listed.ok`, `listed.value`), and a getter on `value` could already re-enter. What the copy did was
widen the window from two reads to `2 + 7N` reads plus a caller-controlled iterator, and hand it a
per-row trap surface. Calling the defect *introduced* overstates it; calling the round's fix its
**cause** understates what was already there. The remedy is the same either way and closes both.

### The concrete failure sequence

1. `commands.listDocuments()` answers rows, one of which has `get relative_path()` (any of the seven
   works) that synchronously calls `void state.open('/second')` once.
2. `state.open('/second')` bumps `openGeneration`, clears `documents`, `views`, `selected`,
   `externalStatuses`, `pathDrift`, `pendingAdditions`, sets `status = 'loading'`, and suspends at
   `await commands.openWorkspace('/second')` (3563). The getter returns.
3. The first `open()` finishes its loop and executes **3602**: `documents = rows` — the *superseded*
   workspace's rows, over the new open's cleared list.
4. It then enters 3627, issues **one** `commands.getDocument(<workspace-1 id>)` at 3628, and only
   then returns at 3629.
5. If the second open now **fails** — `fail(opened.failure)` at 3579, or `fail(listed.failure)` at
   3591 — `fail` (2733-2737) sets `status = 'failed'` and touches `documents` not at all. The window
   draws *the open failed* over a sidebar listing the previous workspace's files, whose identities
   feed `rawTarget`, `creatorEligibility`, `holdsDocument` and the coordinator's membership test,
   with no `pendingAdditions` marks to constrain them. If the second open succeeds it overwrites the
   rows at its own 3602, so the persistent form needs the refusal; the stale `getDocument` at 3628
   goes out either way.

### Source or record

**Source.** A `generation !== openGeneration` comparison after the loop and immediately before 3602 —
literally the same repair the same fix round made at 3662 for the projection loop.

### What a pinning test would assert, and what exists

**Exists: no case.** One test puts a trap on a `listDocuments` answer —
`workspace.test.ts:9013`, *'reads no summary of its own between the failure arm's checks and its
write'*, trap at `:9027-9038` — but it is **armed only after the load has finished** (`:9065`), so it
never fires during the row ingress, and it asserts `externalDocumentStatus`, a read count and an
`openWorkspace` count, never `state.documents`. The shape to copy is
`workspace.test.ts:772` — *'publishes nothing when the last file's own getter opens another
workspace'* — which does exactly this for a `getDocument` answer and asserts `state.documents` is `[]`.

The case to write: `script.list` answers two rows, the second with a `get disabled()` (or any of the
seven) that fires once and calls `void state.open('/second')`, with the second open's
`openWorkspace` refused; then assert `state.documents` is `[]`, `state.status` is `'failed'`, and the
`getDocument` spy recorded **zero** calls. The document-count and command-count assertions are the
discriminating ones; pre-fix `documents` holds the workspace-1 rows and one `getDocument` was sent.

---

## Finding 4 — the reread path's initial `stale` is written outside every ownership question

**Verdict: HOLDS.** The write the review anchors on is in the *other* file: `applyChange`'s no-surface
path reaches it, but the statement is `workspace.svelte.ts:2429`. The record half holds and is
**wider** than reported.

### The decisive lines

- `src/lib/browser/observationTransitions.ts:868` — the ownership check:
  ```
  868:  if (!sequences.admit(document, route.sequence)) { return 'superseded'; }
  ```
- `src/lib/browser/observationTransitions.ts:894-905` — the no-surface path:
  ```
  894:  if ('Unreadable' in route.content) { … return 'unavailable'; }
  901:  if (tellTheSurfaceAbout(route, workspace, markStaleWhileOurs)) { return 'conflicted'; }
  907:  const registryAt = workspace.writeSurfaceGeneration();
  1005:  workspace.rereadUnderGuard(document, guard);
  ```
- `src/lib/browser/observationTransitions.ts:1041-1048` — the two host reads inside that call, either
  of which is arbitrary code:
  ```
  1041:  const kind = targetingSurfaceFor(
  1042:    route.document,
  1043:    workspace.openWriteSurfaces(),
  1044:    workspace.creatorEligibility(route.document)
  1045:  );
  1046:  if (kind === null) { return false; }
  ```
- `src/lib/browser/workspace.svelte.ts:2427-2429` — the write, with no predicate available to it:
  ```
  2427:      rereadUnderGuard: (document: DocumentId, guard: () => boolean): void => {
  2428:        const opened = openGeneration;
  2429:        noteDocumentStatus(document, { kind: 'stale' });
  ```
  The `ReconciliationWorkspace.rereadUnderGuard` signature (`observationTransitions.ts:608`) carries
  no ownership argument, so the host **cannot** ask the question even in principle.

**The check is `observationTransitions.ts:868`; the spend is `workspace.svelte.ts:2429`; the
statements between them that run caller code are `:901` → `:1043` `openWriteSurfaces()` and `:1044`
`creatorEligibility()`, and then `:907` `writeSurfaceGeneration()`.** That is the identical window
2d-5-4-B's finding 5 closed for the guard's four arms, still open for the path that *does not* refuse.

### The concrete failure sequence

1. A batch carries `Changed`/`Addressable`/`Projected` for document 1 at sequence 5. `admit` accepts.
2. `route.content` is not `Unreadable`, so 894 falls through and 901 calls `tellTheSurfaceAbout`.
3. `workspace.creatorEligibility(1)` (1044) re-enters and applies a newer `Unreadable` for document 1
   at sequence 9. `applyUnreadable` (1113-1119) admits it and writes
   `{ kind: 'unavailable', reason }`. The accessor then answers `'notCreatorEligible'`.
4. `kind === null`, so `tellTheSurfaceAbout` returns `false` and 901 does **not** take the
   `conflicted` arm. 1005 calls `workspace.rereadUnderGuard(1, guard)`.
5. `workspace.svelte.ts:2429` writes `{ kind: 'stale' }` over the newer `unavailable`. **The typed
   reason is gone permanently** — the watermark has advanced past the observation that carried it, so
   nothing re-derives it, which is the same permanence 2d-5-4-A's finding 3 and 2d-5-4-B's finding 5
   were both about.
6. The guard later refuses at `:981` (`isNewest` is false for sequence 5) and writes nothing, so the
   file is left `stale` with the reason lost.

### The record half, and it is wider than reported

`observationTransitions.ts:874-878` claims:

> *"…so that this module has exactly one fenced status writer and a reader can see that **every
> `stale` an admitted `Changed` produces goes through it**."*

The second clause is false in **two** ways, not one:

- the host's `:2429` and `:2468` writes are both `stale`, both produced by an admitted `Changed` (the
  member is reachable only from `applyChange`), and neither goes through `markStaleWhileOurs`;
- `applyNamedRow:1165` writes `{ kind: 'stale' }` for a `Changed` observation whose document is
  `Named` (`routeObservation:385-391`), and it is a different function, so it cannot go through a
  closure local to `applyChange`.

`docs/decisions/2d-5-4-B-notes.md` §11 item 6 already records the *general* risk ("nothing stops a
further writer being added beside it rather than through it… a convention, not a type"), so the
record is not uniformly wrong — but the **source comment states the convention as a fact and it was
already false when it was written**, which is this project's named worst defect class.

### Source or record

**Both, and the source half decides.** The fix is a predicate carried into
`ReconciliationWorkspace.rereadUnderGuard` (`observationTransitions.ts:608`), passed as
`markStaleWhileOurs` or as an `owns(): boolean` from `applyChange:1005`, and consulted immediately
before `workspace.svelte.ts:2429`. The comment at 874-878 must be narrowed with it.

### What a pinning test would assert, and what exists

**Exists: no case.** The two hostile-`creatorEligibility` cases —
`observationTransitions.test.ts:565` and `:769` — call only `sequences.admit(document, 9)` and never
re-enter `applyObservation`, and both assert `workspace.statuses` is `[]` for the *guard's* arms.
None applies a newer `Unreadable` from inside a host member.

Where the discriminating case must live is worth stating, because it is not obvious: **not** in
`workspace.test.ts`. There the host member is the module's own closure, `creatorEligibility` reads
`documents`/`views` and re-enters nothing, and a batch is applied in sequence order — a
higher-sequence `Unreadable` applied first would make `admit` refuse the `Changed` at 868 — so the
production window is unreachable by construction. The case belongs at the seam, in
`observationTransitions.test.ts` (`recordingWorkspace()` at `:114`, hostile-host idiom at `:777`,
driver `apply()` at `:386`): a `creatorEligibility` that applies a newer `Unreadable` through
`apply()` and then answers `'notCreatorEligible'`, asserting that the predicate `applyChange` now
hands `rereadUnderGuard` answers `false`. Pre-fix there is no third argument to record, so the case
cannot even be written against the old signature — which is what makes it discriminating. A second,
host-side case in `workspace.test.ts` should assert that the member writes **no** initial mark when
its predicate answers `false`.

---

## The generalization sweep — six things the review did not name

### M1 — a narrower wording of the struck claim survives, **in source**, in finding 1's own function

The brief asked for exactly this check. `docs/decisions/2d-5-4-notes.md` §7 item 12 re-marks *recorded
only* → **blocker** and strikes *"the third level and below is still the command's own object"*,
replacing it with *"the **fourth** level and below … is still the command's own object, and **nothing
this module reads after a guard goes that deep**"* (`2d-5-4-notes.md:757-759`).

That replacement is **false**, and `src/lib/browser/workspace.svelte.ts:709-712` is the narrower
wording still standing:

```
709: * {@link SelectedMatch} itself is not re-made: `reresolve` built it, and its own
710: * fields are read by this module rather than by a command. Its `id` is the
711: * command's object, exactly as {@link ownedProjectionOf} says of every value one
712: * level down.
```

It also **misattributes the rule it cites**: what `ownedProjectionOf`'s own family says about `id` is
the opposite of what is claimed here — `ownedMatchOf`'s header, 536-539: *"**`id` is the one
exception**, through {@link ownedMatchIdOf}, because it is the only one of those values whose *own*
properties this module reads after a guard."* So the two
headers contradict each other, in the same file, and the one that is wrong is the one guarding the
ingress finding 1 is about. The struck claim survives, the correction block that declared the third
level closed is an overclaim, and both are fixed by finding 1's source change.

(`docs/decisions/2d-5-4-A-notes.md:81` also still says the depth is *"two levels"*; that is now
*two plus each match's `id`*. It reads as a historical statement of what that round did, so I record
it rather than calling it a defect.)

### M2 — `selected` has exactly one unnormalized ingress, and finding 1 is it

Swept by shape over every writer of `selected` (`replaceSelection` at 2667, plus the two documented
direct assignments at 3539 and 3725):

| Writer | Identity's origin | Owned? |
|---|---|---|
| `select()` 3725 | `selectMatch(viewOf(...), position)` — a held, installed view | ✓ |
| `applyRepair` 'kept' 3258 | `reresolve(…, reloaded.value)` — **the command's answer** | ✗ |
| the three adoptions 4686 / 4756 / 4846 | `selectMatch(next, …)`, `next = ownedProjectionOf(...)` | ✓ |
| `adoptTheReplacedDocument` 5003 | `reresolve(held, next)`, `next` owned at 4994 | ✓ |
| `repairAfter` 5093 | `reresolve(selected, view)`; all six callers (3133, 3485, 4697, 4761, 4857, 4903) pass an owned view | ✓ |
| `forgetTheReplacedDocument` 4951, `removeDocumentFromWindow` 2896, `open()` 3539 | `null` | ✓ |

So the fix is one function and needs no audit of a second site — and `adoptDiskVersion` (3391-3490) is
the model it should follow: it reads `conflict.source` and copies `adoption.disk` through
`ownedProjectionOf` *before* the reservation, and `authorizeDiskAdoption`
(`saveOutcome.ts:1515-1529`) has already flattened `diskRevision` into a module-built literal, so
`adoption.diskRevision` at 3468 runs no caller code.

### M3 — four passages assert finding 2's write is harmless, and each is true of the value and false of the effect

`workspace.svelte.ts:2402-2411` (*"A write it permits can only ever restate this arm's own mark… so no
value changes"*), `docs/decisions/2d-5-4-A-notes.md` §7 item 4, `docs/decisions/2d-5-4-B-notes.md`
§10 (*"`expect(state.externalDocumentStatus(2)).toEqual({ kind: 'stale' })` — it cannot
discriminate"*) and §11 item 5 all reason from *the value cannot change* to *the write is safe*. It
does not follow, because `noteDocumentStatus` (2919-2923) bumps the ownership token unconditionally,
and that token is the only thing `rereadUnderGuard`'s clear at 3130 compares. The records are the
reason the defect was invisible: they argue, correctly, that no test **asserting the value** can see
it — and then conclude there is nothing to see.

### M4 — every writer of a document status, and whether it is fenced

`src/lib/browser/observationTransitions.ts`:

| Line | Write | Ownership check before it | Caller/host code in between | Verdict |
|---|---|---|---|---|
| 892 | `stale` | `isNewest` at 889 | none | **fenced** |
| 829 | `unavailable` (addition) | `admit` 824 | `workspace.addDocument()` 826 + the spread of the wire summary | **unfenced, unjustified** |
| 895 | `unavailable` (`Changed`) | `admit` 868 | `'Unreadable' in route.content` 894 — a `has` on wire data | **unfenced, justification inaccurate** (see below) |
| 1094 | `removed` | `admit` 1090 | `workspace.removeDocument()` 1093 | **unfenced, unjustified** |
| 1118 | `unavailable` | `admit` 1115 | none | **unfenced, justified** (atomic) |
| 1165 | `stale` (named row) | `admit` 1153 | `session.requestMembershipReload()` 1158, `workspace.holdsDocument()` 1160 | **unfenced, unjustified** |
| 1169 | `removed` (named row) | `admit` 1153 | the same two, plus `workspace.removeDocument()` 1168 | **unfenced, unjustified** |
| 1172 | `unavailable` (named row) | `admit` 1153 | the same two | **unfenced, unjustified** |

The host reread path, `src/lib/browser/workspace.svelte.ts`:

| Line | Write | Check before it | In between | Verdict |
|---|---|---|---|---|
| 2429 | `stale`, initial | `admit` (other file, 868) | two host members + `writeSurfaceGeneration()` | **unfenced, unjustified** — finding 4 |
| 2468 | `stale`, restated | 2443, 2449, 2453 | module-owned reads only | **fenced — and the fence's permitted write is finding 2** |
| 3131 | the clear | 3130 | none | **fenced** |

On `:895`: `2d-5-4-B-notes.md` §11 item 8 justifies leaving it alone because *"nothing is **checked**
before it that the read could invalidate: it is the first write of that arm."* `sequences.admit` at
868 **is** checked before it, and `'Unreadable' in route.content` at 894 is an `in` on a wire value
whose `has` trap runs code. The exposure is genuinely the narrowest on the table — no host member
runs in between — but the stated reason is not the true one, so the item is a record defect rather
than the residual it presents itself as.

Also swept, and clean: `statusWrites` (2260) is never cleared, so the token is monotonic per
identity, which is what every comparison above relies on; `open()` clears `externalStatuses` directly
at 3546 without going through `noteDocumentStatus`, and the `opened` captures at 2428/3050 are what
cover a read that spans an open.

### M5 — `ownedSummaryOf`'s other ingress is covered by no check of its own, and the same argument applies

`addDocument` (`workspace.svelte.ts:2840-2849`) is reached only from `applyAddition`:

```
824:  if (!sequences.admit(route.summary.id, route.sequence)) { return 'superseded'; }
826:  workspace.addDocument({ ...route.summary, loaded: false });
```

The check is 824; the spend is `documents = …` at 2842-2846 together with `pendingAdditions` at
2847-2849; and **the caller-code statement in between is the spread at 826**, not the copy at 2840 —
the spread has already materialized own data properties, so `ownedSummaryOf` there reads nothing
foreign. (That is worth saying plainly: the copy at 2840 is the right thing to have done for
`documents`' *readers*, and it does nothing at all for *this* window.)

The failure: the wire summary's `get relative_path()` applies a newer `Removed` for the same identity
at a higher sequence; `applyRemoval` admits it, `removeDocumentFromWindow` drops the row and writes
`{ removed }`; the getter returns; `addDocument` then re-inserts the row and re-marks it pending. The
window ends with a row for a file the watcher has said is gone, statused `removed`, in
`pendingAdditions`. Same shape as finding 4, one door along; neither the review nor the fix round
reaches it. A generation/sequence recheck immediately before 2842 — or taking the spread before
`admit` — closes it.

### M6 — two of the brief's five pointers resolve clean, and I record them so the next round does not re-walk them

- **The second generation check in `open()` covers everything between itself and
  `workspaceReady()`.** `views = projected` (3665), `loadFailures = refused` (3666) and
  `status = 'ready'` (3667) are `$state` assignments — a signal write, not a synchronous effect run —
  and they read only module-built locals; `reconciliation.workspaceReady()` (3677) is the **last**
  statement, so whatever it runs sits after every spend rather than between a check and one. The
  comment's account of *why* the per-iteration check is insufficient (3651-3661) is true of the code,
  including its claim about the failure arm: `report` is a `createBrowserState` parameter (2062) and
  is therefore injected. **No finding.**
- **The unfenced install survives the `Removed` case the brief asks about.**
  `removeDocumentFromWindow` (2884) calls `invalidateProjectionOf` first, so a `Removed` admitted
  while a guarded reread is out moves the projection generation, `stillCurrent()` fails at 3094, and
  nothing is installed and nothing is cleared — the `repairAfter(next)` at 3133 is never reached.
  `workspace.test.ts:8792` pins the neighbouring case. **No finding.**

---

## What §7.1 makes of this

Every one of the four fixes changes a source file (`src/lib/browser/workspace.svelte.ts` for 1, 2 and
3; both that file and `src/lib/browser/observationTransitions.ts` for 4), as do M1's source half, M4's
`:895` neighbours if they are taken, and M5. So the fix round answering this review **commissions a
further round**, scoped to that fix, whatever severities are assigned. M1's record half and M3's four
passages are prose and commission nothing on their own.
