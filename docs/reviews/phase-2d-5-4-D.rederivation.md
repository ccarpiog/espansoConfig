# Re-derivation — Phase 2d-5-4-D

Read-only worker. No build, no test, no `cargo`, no `npm` was run. Every claim below was derived
by reading the committed tree at `f3ba2cd` (HEAD `2d192ce` only records the SHA). Nothing was
fixed and no source file was changed.

Line numbers are HEAD's unless a line is explicitly attributed to `f3ba2cd^` (the pre-fix tree).

---

## 1. The blocker

> **[BLOCKER] high · confidence 0.98 — `src/lib/browser/observationTransitions.ts:849` — "Check
> workspace lifecycle after materializing the addition."** *"Source defect introduced by M5's
> reordered reads. At the injected boundary this fix explicitly supports, give an `Added`
> observation for document D at sequence 500 a summary getter t…"* (truncated). **Fix:** *"Carry a
> lifecycle token from the accepted batch and revalidate it after wire materialization, before
> admission or any workspace mutation."*

### Verdict: **HOLDS IN PART**

- The **defect** holds, and its consequence is worse than the review states.
- The **attribution** — *"introduced by M5's reordered reads"* — **does not hold**. The same window
  existed before M5, through `route.summary.id`. M5 **widened** it from one accessor to seven plus
  a `has` trap, and simultaneously **closed** a different window. Both halves are derived below.
- It is **not production-reachable** today. It is reachable only through an injected accessor —
  which is the boundary every fence of this chain (M4, M5, finding 4) exists to defend.
- The **anchor 849 is accurate** as the *trigger* line. The **cause** line is **851**.

### 1.1 What exactly runs between the wire read and the `admit` / the mutation

`src/lib/browser/observationTransitions.ts:844-863`, quoted in full because the whole finding is
about the order of six statements:

```
844  function applyAddition(
845    route: Extract<ObservationRoute, { kind: 'added' }>,
846    workspace: ReconciliationWorkspace,
847    sequences: AcceptedSequences
848  ): ObservationOutcome {
849    const row: DocumentSummary = { ...route.summary, loaded: false };
850    const reason = 'Unreadable' in route.content ? route.content.Unreadable.reason : null;
851    if (!sequences.admit(row.id, route.sequence)) {
852      return 'superseded';
853    }
854    workspace.addDocument(row);
855-858  // (the fence's comment)
859    if (reason !== null && sequences.isNewest(row.id, route.sequence)) {
860      workspace.noteDocumentStatus(row.id, { kind: 'unavailable', reason });
861    }
862    return 'added';
863  } // End of function applyAddition()
```

Classifying every read, using `routeObservation` (`:404-413`) as the authority for which values are
own data properties of the route literal and which are still the wire's own objects:

| Line | Read | Whose code runs |
|---|---|---|
| 849 | `route.summary` | own data property of the literal built at `:408-412` — **nothing runs** |
| 849 | `{ ...route.summary }` | **caller code**: the wire summary's `[[OwnPropertyKeys]]` + a `get` per own enumerable key. `DocumentSummary` has **seven** required members (`ownedSummaryOf`, `workspace.svelte.ts:688-704`), so seven accessors, plus a `Proxy` `ownKeys`/`getOwnPropertyDescriptor` trap if one is there |
| 850 | `'Unreadable' in route.content` | **caller code**: a `Proxy` `has` trap on the wire content |
| 850 | `route.content.Unreadable.reason` | **caller code**: two getters, on the unreadable arm only |
| 851 | `row.id`, `route.sequence` | own data properties of the freshly built `row` and of the route literal — **nothing runs** |
| 854 | `workspace.addDocument(row)` | host member; `ownedSummaryOf` inside it reads own data properties of `row` only (`workspace.svelte.ts:2845`) |
| 859 | `sequences.isNewest(...)` | injected interface method; the only implementation (`observationTransitions.ts:250-252`) is a `Map` lookup |

So the caller-controlled window is **849–850**, and it sits **above** the arbitration at 851 and
above the mutation at 854. Between 851 and 854 **nothing caller-controlled runs at all** — that is
what M5 bought, and it is real.

`applyAddition` is the **only** arm of this module that runs caller code before its own `admit`.
Derived by inspection of the other four arbitrating arms: `applyChange` (`:895`) admits on
`route.document`; `applyRemoval` (`:1154`) on `route.document`; `applyUnreadable` (`:1196`) on
`route.document`; `applyNamedRow` (`:1234`) on `route.namedDocument` — every one of those is an own
data property of the route literal that `routeObservation` built at `:371-473`, so no accessor
stands above any of their `admit` calls.

### 1.2 Can a *lifecycle* change be driven from inside that window, and by what path

**Yes — and the question `applyAddition` asks is explicitly not that question.**

`applyAddition`'s parameter list (`:844-848`) does **not** include `session`. `applyObservation`
holds one and passes it to three arms only:

```
799      return applyAddition(route, workspace, sequences);        // no session
803      return applyRemoval(route, workspace, sequences);          // no session
805      return applyUnreadable(route, workspace, sequences);       // no session
807      return applyNamedRow(route, workspace, sequences, session);
809      return applyUnnamedPath(route, workspace, session);
```

So the two live lifecycle questions — `ObservationSession.stillApplying()` and
`ObservationSession.epochNow()` — are **unreachable from `applyAddition`**. The only question it can
ask is about a *sequence*, through `AcceptedSequences`.

The concrete path to a lifecycle change, end to end:

1. A getter in the 849–850 window calls `BrowserState.open(root)`.
2. `open()` (`workspace.svelte.ts:3503`) bumps `openGeneration` at `:3504` and calls
   `reconciliation.workspaceOpened(root)` at `:3524` — **both synchronously**, before its first
   `await` at `:3570` (`const opened = await commands.openWorkspace(root);`).
3. `workspaceOpened` (`reconciliationCoordinator.ts:1399-1416`) sets `adopted = false`,
   `epoch = 0`, `watermark = 0` and calls **`accepted.clear()`** at `:1414`.
4. `clear()` (`observationTransitions.ts:262-264`) is `highest.clear()`.
5. Control returns to line 851. `admit(row.id, 500)` now runs against an **empty** map:
   `const held = highest.get(document) ?? 0;` → `0`; `500 <= 0` is false; the map is set to
   `D → 500` and the call answers `true` (`:244-251`).
6. `workspace.addDocument(row)` at 854 inserts the **superseded workspace's row** into the
   **new** workspace's `documents` and into `pendingAdditions` (`workspace.svelte.ts:2845-2853`) —
   over the list `open()` blanked at `:3544`.

**This is the (b) case of the brief's distinction, not the (a) case.** `isNewest` cannot answer it:
after a `clear()`, `isNewest(D, 500)` is `(0 === 500)` → `false`, so every *fence* in this module
fails **safe** across a lifecycle reset. `admit` is the one operation that a `clear()` answers
**permissively**, because its whole contract is *strictly greater than what is held*, and after a
clear nothing is held. That asymmetry is the defect in one sentence:

> **`clear()` is the single event that makes every `isNewest` fence refuse and makes every `admit`
> accept, and `applyAddition` is the only arm whose caller-controlled code runs before its
> `admit`.**

### 1.3 What the contamination costs — derived, and sharper than the review's claim

Two Rust facts decide it, and one of them contradicts twelve comments in this repository (§3.1).

**(i) The observation sequence restarts at 1 for every epoch.** `src-tauri/src/ledger.rs:576`:

```
pub const FIRST_OBSERVATION_SEQUENCE: u64 = 1;
```

and `begin_epoch` at `:1218`: `ledger.next_sequence = Some(FIRST_OBSERVATION_SEQUENCE);`

**(ii) A `DocumentId` is stable for the process, per path, across any number of opens.**
`crates/espansoconfig-core/src/workspace/mod.rs:317-329` — `identity_of` is a `static` path→id table
that returns the existing entry for a known path; `:486` — `Workspace::from_tree` mints every file
through it; and `from_tree`'s own doc at `:474-481` says it in as many words:

> *"Identities come from the **session's path table**, not from the tree's order, so they are stable
> across two `open` calls of a directory that **changed** as well as one that did not … removing one
> leaves its identity unmatched rather than handing it to a neighbour."*

Put together: after the contamination, the new epoch numbers its observations from 1, and the file
that had id `D` in the closed workspace **still has id `D`**. So the entry `D → 500` refuses, as
`'superseded'`, **the first 500 observations the new workspace ever receives for that exact file** —
`applyChange`, `applyRemoval` and `applyUnreadable` alike, each returning at its own `admit`. The
review's phrase *"silently suppress subsequent changes"* is correct and is, if anything, understated:
nothing anywhere records the refusal except an `'superseded'` entry in `observationOutcomeRecords`.

The second cost is the stale row of step 6, which `open()`'s later `documents = rows` (`:3630`)
overwrites when the open succeeds — but **not** when it is refused: `open()` returns at `:3574`
(generation) or on `!opened.ok`, leaving the blanked workspace plus one row from the closed one.

### 1.4 Production-reachable? **No — injected accessor only. And no existing case catches it.**

- The wire values reach `applyObservation` from `reconciliationCoordinator.ts:947` inside
  `for (const observation of batch.observations)` (`:942-949`), whose `batch` is a Tauri command
  answer — JSON-parsed plain objects with no accessors and no proxies. Nothing in the 849–850 window
  runs in production.
- The one *production* re-entrancy candidate in this module is `tellTheSurfaceAbout`'s
  `WriteSurfaceTransition` (`applyChange`, `:958` and `:1042`), and the only production registration
  is `src/lib/components/DetailPane.svelte:669,717` —
  `const tellNobodyYet: WriteSurfaceTransition = () => undefined;`. A no-op. **2d-5-5 replaces it**,
  and that is when the batch-loop shape of §3.2 stops being hypothetical.
- **No existing case would catch it.** The only `sequences.clear()` inside a getter anywhere in
  either suite does not exist: `observationTransitions.test.ts:444` is a direct unit test of the map
  (`it('forgets everything on a clear')`). The M5 pin at `:1095` — *"refuses the addition when the
  summary's own getter admitted a newer removal"* — drives the getter to admit sequence **9** over
  sequence **3**, which is the *sequence* defence and the **opposite** of this case: it makes `admit`
  refuse, where a `clear()` makes it accept. Searched by shape: the only in-getter re-entries in
  `observationTransitions.test.ts` are at `:591`, `:635`, `:677`, `:877-904`, `:1005`, `:1105-1122`
  and `:1232`, and every one of them admits a newer observation. None resets a lifecycle.

### 1.5 Was it introduced by M5? **No.** — the half that does not hold

`f3ba2cd`'s own diff of this function gives the pre-fix body:

```
-  if (!sequences.admit(route.summary.id, route.sequence)) {
     return 'superseded';
   }
-  workspace.addDocument({ ...route.summary, loaded: false });
```

JavaScript evaluates `admit`'s arguments left to right **before** entering `admit`. `route.summary`
is an own data property; **`.id` is a read of the wire summary object**, i.e. caller code. So in the
pre-M5 tree a hostile `id` getter already ran **above** `admit`, and steps 1–6 of §1.2 run
identically with `route.summary.id` in place of the spread. The window is **pre-existing**.

What M5 actually changed, stated as three separate facts:

1. **It widened the pre-`admit` accessor surface** from one getter (`id`) to seven plus a `has` trap
   plus, on the unreadable arm, two more property reads.
2. **It closed the `admit`→mutation window**, which is what its JSDoc at `:830-837` claims and which
   is true: nothing caller-controlled now stands between 851 and 854.
3. **It closed a third defect its record does not claim**: pre-M5, `route.summary.id` was read
   **three** times (at `admit`, inside the spread, and at `noteDocumentStatus`), so a getter
   answering different values could arbitrate under `D₁`, insert a row under `D₂` and status `D₃`.
   Single materialization removes that. Worth recording, because it is a gain the notes leave out.

So the correct mechanism sentence is: *M5 did not introduce this; it inherited it and widened its
trigger surface sevenfold while closing the window on the other side of `admit`.* Accepting the
review's wording would put a false attribution into the record, which is the class §6 checks for.

### 1.6 The smallest fix that closes it at the cause

`applyObservation` already holds the `ObservationSession` and already passes it to three arms.
**Give it to `applyAddition` and ask, between the materialization and the arbitration, the two
questions `applyChange`'s guard already asks at `:1030` and `:1034`:**

- at `:799`, `return applyAddition(route, workspace, sequences, session);`
- add the parameter, and insert **one statement between 850 and 851**:

```ts
if (!session.stillApplying() || session.epochNow() !== session.epoch) {
  return 'superseded';
}
```

Why this is the smallest thing that closes it **at the cause**:

- It is asked **after** the whole caller-controlled window and **before** `admit`, so it is atomic
  with the arbitration in the sense `CLAUDE.md` requires: `session.stillApplying` and
  `session.epochNow` are own data properties of the literal `accept()` builds at
  `reconciliationCoordinator.ts:913-941`, and both are closures over the coordinator's own `let`s.
- It discriminates. `workspaceOpened` sets `epoch = 0` at `:1407` before `accepted.clear()` at
  `:1414`, and `session.epoch` is the adopted batch epoch — non-zero, since `FIRST_WORKSPACE_EPOCH`
  is 1 and 0 means *unset*. So `epochNow() !== session.epoch` is `true` the instant a re-open
  begins, synchronously, in the same turn.
- Moving the materialization elsewhere does **not** close it: wherever the accessors run, they run
  inside the batch loop, so the lifecycle question has to be re-asked after them regardless. That is
  why the review's *"carry a lifecycle token … and revalidate it after wire materialization"* is the
  right shape even though its attribution is wrong.

Two consequences to decide rather than assume:

- **`'superseded'` is a reuse, and its doc comment (`:1186`) says *"A newer observation for the same
  file has already been admitted"*, which is not what happened.** Either widen that comment or add an
  arm; the `never` terminus at `:811-813` makes a new arm a compile error at every site that must
  handle it, which is the safer of the two and the more expensive.
- **The same statement is owed to `applyRemoval` and `applyUnreadable` only if §3.2 is taken.** They
  have no caller code above their own `admit`, so they are safe *in isolation*; they are unsafe only
  as later iterations of a batch loop in which an earlier observation reset the lifecycle.

### 1.7 What a pinning test would have to drive

**Suite:** `src/lib/browser/observationTransitions.test.ts`, the `describe('the addition' …)` block
that ends at `:1147`.
**Seam:** the identical one the M5 pin already uses at `:1095-1122` — an own **getter** on the wire
`DocumentSummary`, which the spread at `:849` is guaranteed to run.
**Injected member:** `get relative_path()`, whose body must drive a **lifecycle** reset rather than a
newer admission. Both halves are already available in the harness and neither needs new machinery:

- `sequences.clear()` — the `AcceptedSequences` the case builds at `:1087` is in scope; and
- `session.live = EPOCH + 1` — `RecordedSession.live` is documented *"assignable, so a case can
  replace a workspace"* (`:250`) and is what `epochNow()` answers (`:270`).

**Assertions, all three of which fail against today's code:**

| Assertion | Today | After the fix |
|---|---|---|
| the outcome | `'added'` | not `'added'` |
| `workspace.added` | one row | `[]` |
| `sequences.sequenceFor(42)` | `3` — the new epoch's map is contaminated | `0` |

The third is the one that measures the finding rather than its symptom, and no case in either suite
asserts `sequenceFor` after an `applyObservation` today.

---

## 2. The five things the brief pointed the review at

### 2.1 The deleted failure arm — **ESTABLISHED, and both halves of its argument hold**

**Half one — "the arm could never change a value": TRUE, and slightly stronger than claimed.** The
deleted arm's own third fence was `marked !== statusWriteOf(document)`, and `statusWrites` is bumped
by `noteDocumentStatus` and by nothing else (`workspace.svelte.ts:2926`; sole writer confirmed by
sweep — the only three references are `:2285`, `:2926`, `:2943`). So a permitted write ran only when
nothing had written that file's status since the arm's own `stale`, which means the entry was that
`stale`. Re-writing it produced an equal value. (Strictly it also produced a **new array and a new
entry object** and moved the entry to the tail, because `:2927-2928` filters and appends — so the
write was not a no-op for reference identity or for order. That makes deleting it *more* right, not
less.)

**Half two — "`report` still carries the failure": TRUE.** `workspace.svelte.ts:3081-3085`:

```
    if (!fresh.ok) {
      // Answered and reported whether or not this read is still the wanted one …
      report(fresh.failure);
      return fresh.failure;
```

`report` is the same channel every other failure of this state uses, and the member's `void` at
`:2465` discards a value that has already been reported. **No failure now reaches no channel.**

**Is there a file left `stale` with nothing able to clear it?** No new one. The clear is
`noteDocumentStatus(document, null)` at `:3141`, inside the installation block and fenced on
`statusAt === statusWriteOf(document)` at `:3140`; `open()` also clears wholesale at `:3556`; and
`BrowserState.rereadDocument` reaches the private helper with `ALWAYS_PERMITTED`, which is the
user-facing recovery. A failed read leaving the mark standing is the member's stated contract
(`:2420-2427`), not a regression.

**Is there a path that clears a mark it did not set?** **Derived: no, but only by a coupling nothing
in the type expresses.** The member writes no mark when `owns()` is `false` (`:2462-2464`) and then
starts the read anyway (`:2465`). If the read succeeded and installed, `:3140-3141` would clear a
mark this arm never wrote. It cannot, because `owns` is `stillOurs` and `guard`'s **third** arm
(`observationTransitions.ts:1038`) asks the identical predicate, so `owns() === false` at the mark
implies `guard() === false` at the install — `admit` only ever raises `highest`, and a `clear()`
leaves `isNewest(D, n)` false for any `n ≥ 1`. **The member takes `guard` and `owns` as two
independent `() => boolean`s and nothing forces this relationship between them.** That is a
`recorded only` observation, not a defect today.

**What else was the deleted clause carrying?** It carried the member's only `opened`/`marked`
captures and the only third reader of `documents`' ownedness. `ownedSummaryOf`'s header was updated
to say so (`:676-681`, *"A third reader is gone rather than answered"*) and `addDocument`'s comment
was too (`:2829-2832`). **One narrower wording of it was missed — see §3.3.**

### 2.2 `ownedRepair`'s rebuilt `SelectedMatch` — **ESTABLISHED, the claim holds**

- **No optional-member hole.** `SelectedMatch` (`src/lib/browser/selection.ts:75-89`) has exactly
  four members — `id`, `document`, `position`, `fingerprint` — and **all four are required**; the
  rebuild at `workspace.svelte.ts:743-748` writes all four. `MatchId` (`src/lib/ipc/types.ts`,
  the `document`/`revision`/`node` interface) has three, all required, and `ownedMatchIdOf`
  (`:498-504`) writes all three. So the compile-error property really is total for these two shapes
  today.
- **Every carried value is a primitive**, which makes the copy complete rather than one level deep:
  `DocumentId = number` (`src/lib/ipc/types.ts:58`), `NodeId = number` (`:66`),
  `ContentRevision = string` (`:73`), `position: number`, `fingerprint: string`.
- **Every identity the arm carries is normalized.** The `kept` arm's `reloaded` goes through
  `ownedProjectionOf` (`:749`), and the `cleared` arm's through `:754`; `unresolved` and `unchanged`
  carry no projection (`:756`).

**The swept claim — *this was the only unnormalized ingress into `selected`* — is TRUE today.**
Swept by shape, over every write, not by the notes' line numbers. Three writes exist:

| Site | Value | Normalized by |
|---|---|---|
| `:2664` `selected = next` (inside `replaceSelection`) | its callers, below | — |
| `:3549` `selected = null` (in `open()`) | n/a | — |
| `:3753` `selected = next` (the documented direct exception in `select()`) | `selectMatch(view, …)` where `view = viewOf(match.id.document)`, i.e. an installed projection, all of which pass `ownedProjectionOf` | ✔ |

and every `replaceSelection(…)` call with a non-`null` argument:

| Site | Argument | Normalized by |
|---|---|---|
| `:3268` | `repair.selected` | `ownedRepair` at `:3779` — **this round's fix** ✔ |
| `:4714`, `:4784`, `:4874` | `selectMatch(next, position)` | `next = ownedProjectionOf(fresh.value)` at `:4701`, `:4774`, `:4849` ✔ |
| `:4938` (`adoptAfterTheDeletion`) | `selectMatch(next, at)` | `next = ownedProjectionOf(fresh.value)` at `:4926` ✔ |
| `:5031` | `found.selected` from `reresolve(held, next)` | `next = ownedProjectionOf(fresh.value)` at `:5022` ✔ |
| `:5121` (`repairAfter`) | `found.selected` from `reresolve(selected, view)` | its four callers pass an owned projection: `:3143` (`next` at `:3092`), `:3495` (`disk` at `:3425`), `:4725`/`:4789`/`:4885`/`:4931` (the `next`s above) ✔ |

The load-bearing link is that `ownedMatchOf` copies `id` through `ownedMatchIdOf`
(`workspace.svelte.ts:545`), so any `SelectedMatch` built by `selectMatch`/`reresolve` **from an
owned projection** already carries an owned identity. `ownedRepair`'s `kept` arm was the one place a
`SelectedMatch` was built from a *raw* command answer — `repairSelection` is handed
`commands.reloadDocument` directly (`:3779`) — which is exactly why it was the one hole.

### 2.3 `owns` on `ReconciliationWorkspace.rereadUnderGuard` — **ESTABLISHED, no defect**

- **The declaration**: `observationTransitions.ts:618-622`, three parameters, `owns: () => boolean`.
- **The implementation**: `workspace.svelte.ts:2457-2466`.
- **The only caller**: `observationTransitions.ts:1068` —
  `workspace.rereadUnderGuard(document, guard, stillOurs);` — and the argument order matches the
  declaration. `stillOurs` is defined at `:918` as
  `(): boolean => sequences.isNewest(document, route.sequence)`.
- **Can a caller reach the member without one?** No: TypeScript requires three arguments at every
  call. (An **implementer** may declare fewer — `reconciliationCoordinator.test.ts:237` supplies
  `(document, guard) => …`, which satisfies the signature and silently drops the question. That is
  TypeScript's parameter bivariance, not a defect, but it means that fake exercises none of it.)
- **Does the predicate answer at the moment the mark is written?** **Yes.** `stillOurs` closes over
  `document` and `route.sequence` but computes nothing until called; `isNewest` reads the live
  `Map` (`:250-252`); and the call and the write are in one synchronous block with no statement
  between them (`:2462-2464`). The brief's worry — *"a closure capturing `route.sequence` answers
  about a sequence, not about a window"* — is **true as a description** and it is the blocker's own
  shape, but here it fails **safe**: after an `open()` the map is cleared and `isNewest` answers
  `false`, so no mark is written.

### 2.4 The four fenced writers and the fifth — **ESTABLISHED, all five justifications hold**

| Writer | Fence | Between fence and write |
|---|---|---|
| `applyChange` `noteWhileOurs` `:931-935` | `stillOurs()` | nothing — `workspace.noteDocumentStatus(document, status)` reads two locals |
| `applyAddition` `:859-860` | `sequences.isNewest(row.id, route.sequence)` | nothing — `row.id` is an own data property of the object built at 849; `reason` is a local from 850 |
| `applyRemoval` `:1165-1167` | `sequences.isNewest(route.document, route.sequence)` | nothing — `route.document` is an own data property of the route literal |
| `applyNamedRow` `noteWhileOurs` `:1250-1254` | `sequences.isNewest(named, …)` | nothing — `named` is a local |
| `applyUnreadable` `:1196-1199` | **unfenced, positionally justified** | see below |

- **"Is the capture taken after the arm's own mark?"** does not apply to these four: none of them
  takes a *capture*. Each asks a live `isNewest` immediately before its write, which is strictly
  stronger. (The capture-after-the-mark question belonged to the deleted arm, and the surviving
  capture — `statusAt` at `workspace.svelte.ts:3069` — is taken in the **private** helper, i.e.
  after the member's mark at `:2463`, which is correct and is what its comment at `:3057-3067`
  claims.)
- **`applyUnreadable`'s positional justification is true of every path into it.** It has exactly one
  call site, `observationTransitions.ts:805`, inside `applyObservation`'s switch; the function is
  module-private and not exported (`:182-266`, `:790` and `:1191` are the only `export`s near it —
  confirmed against the export list at `:90/120/160/182/242/284/371/496/534/675/741/790`). Both
  values it reads at `:1199` — `route.document` and `route.reason` — are own data properties of the
  literal `routeObservation` builds at `:445-450`, and no statement stands between `:1196` and
  `:1199`. The JSDoc's own caveat (*"A statement inserted between the two lines below would end
  that"*) is exactly right.

### 2.5 The correction blocks — **ESTABLISHED; one survivor in source, several in the record**

Checked against the code each describes. All of the struck claims exist as struck. Survivors found
by sweeping for the **shape**, never for the corrections' own words:

1. **In SOURCE — `src/lib/browser/workspace.svelte.ts:3604-3606`** (see §3.3 below; this is the
   sharpest item this re-derivation found).
2. `docs/decisions/2d-5-4-notes.md:326-341` still argues the deleted arm is live and **must be
   kept** (*"It is kept rather than deleted because…"*), and still carries the *"a fence there would
   be a call no test could tell from no call"* sentence that `2d-5-4-A-notes.md:288-291` struck and
   that `observationTransitions.ts:1022-1025` names false in source. Record only.
3. `docs/decisions/2d-5-4-notes.md:256-259` still says the copy leaves *"the value of `id` … still
   the command's own object"*, which `workspace.svelte.ts:545` has contradicted since 2d-5-4-B.
   Record only, and it is a narrower survivor of what `:761` struck.
4. `docs/decisions/2d-5-4-B-notes.md:215-216` still says *"this module has exactly one fenced status
   writer for an admitted `Changed`"*, which the correction block at `:430` retracts and which
   `workspace.svelte.ts:2463` contradicts — a `stale` for an admitted `Changed`, written from the
   host. Record only.
5. `2d-5-4-B-notes.md:449` (M4, *"it is the first write of that arm"*) has **no** survivor; the fix
   at `observationTransitions.ts:954-955` is in place.

### 2.6 Cross-file citations — one does not resolve

**`src/lib/browser/workspace.svelte.ts:709-712`** is cited three times by this phase
(`2d-5-4-C-notes.md:235`, `2d-5-4-notes.md:770`, `2d-5-4-B-notes.md:275`), two of them in the
present tense (*"the same claim standing in source — `workspace.svelte.ts:709-712`"*). At
`f3ba2cd^` those lines are the struck claim. At HEAD they are the unrelated *"Taken where the repair
lands rather than inside `applyRepair`"* paragraph — the fix moved the text the citations point at.
**Record only** (all three sites are under `docs/`).

Every other anchor checked resolves: the pre-fix anchors resolve at `f3ba2cd^`, and
`src/lib/browser/selection.ts:193-207` and `:294-300` resolve at HEAD to the by-reference `id` fill
the notes describe.

---

## 3. What the review missed

### 3.1 **ESTABLISHED — twelve comments in five source files claim `open()` reallocates document identities, and the Rust says the opposite**

This is `CLAUDE.md`'s named worst defect class — a record claiming a guarantee the code does not
give — at **source** scope, and it is load-bearing for §1.3.

The claim, in its sharpest instance, `src/lib/browser/reconciliationCoordinator.ts:1406-1407`:

> `// open() reallocates every document identity, so a retained entry would be`
> `// a sequence about a different file.`

and `src/lib/browser/observationTransitions.ts:226-228` (the JSDoc of `AcceptedSequences.clear`):

> `* identities of the documents a workspace holds are reallocated by the load that`
> `* replaces it, so an entry kept across one would be a sequence for a different file.`

The contradiction, `crates/espansoconfig-core/src/workspace/mod.rs:474-481` — the doc of the very
function that builds a workspace's rows:

> *"Identities come from the **session's path table**, not from the tree's order, so they are stable
> across two `open` calls of a directory that **changed** as well as one that did not: adding a file
> gives that file a fresh identity and moves nobody else's, and **removing one leaves its identity
> unmatched rather than handing it to a neighbour**."*

with the implementation at `:482-488` (`let id = identity_of(&file.path);`), `identity_of` at
`:317-329` (returns the existing entry for a known path), and `identity_already_issued`'s
`:349-352` (*"the same path answers the same number for as long as the process runs, a recreation at
that path included"*). Eviction is **refused** by design (`:250-256`).

So a retained entry is **never** "about a different file". It is about the **same** file (same root
re-opened) or about **no** file in the new workspace (different root) — and the first of those is
the dangerous one, because §1.3(i) restarts the epoch's sequences at 1. **Clearing is still right;
the stated reason for clearing is false, and the true reason is strictly stronger.**

All twelve sites, so the sweep is checkable rather than asserted — every one of them is **source**
under `CLAUDE.md` §7's closed list:

- `src/lib/browser/observationTransitions.ts:227`
- `src/lib/browser/reconciliationCoordinator.ts:515`, `:665`, `:1406`
- `src/lib/browser/workspace.svelte.ts:2200`, `:2220`, `:2278`, `:2974`, `:3530`, `:3553`, `:3568`
- `src/lib/browser/writeSurfaceRegistry.ts:79`, `:82`, `:346`

and two in test files, which are also source: `src/lib/browser/workspace.test.ts:1965`,
`src/lib/browser/reconciliationCoordinator.test.ts:1590` (the case name
*"is cleared by an open, because identities are reallocated by one"*).

**Not introduced by 2d-5-4-C** — none of these lines is in `f3ba2cd`'s diff — and therefore outside
the strict fix region the brief scopes. It is reported here because the blocker cannot be costed
without it, and because a fix touching any of these files is a source change under §7.1.

**Severity note, honestly stated:** no behaviour depends on the false half today. Everything these
comments justify — clearing the sequence map, clearing `projectionGenerations`, dropping
`externalStatuses`, invalidating registrations — is the right action for a different and true reason.
What is wrong is the reason, in twelve places, and one of those reasons (`observationTransitions.ts:227`)
is the contract a reader of `applyAddition` would consult to decide whether §1's contamination
matters.

### 3.2 **ESTABLISHED — the batch loop re-asks no lifecycle question between observations**

`reconciliationCoordinator.ts:942-949` applies every observation of an accepted batch with no
re-check of `epoch`, `disposed` or `block` between iterations. The `session` closures are live, but
**only `applyChange`'s asynchronous `guard` reads them** (`:1030`, `:1034`); no synchronous arm does,
and three arms cannot (§1.2). So once *any* observation of a batch drives a lifecycle reset, every
later observation of that batch is applied to the replaced workspace, and each one's `admit` writes
into the fresh map.

`applyAddition` is the **first** observation that can do the driving by itself (§1.1). The others can
only be *victims*. The minimal fix in §1.6 closes the driver; closing the class means asking the same
two questions once per iteration at `:947`, or once at the top of `applyObservation`.

Today this is not production-reachable — see §1.4, the `tellNobodyYet` no-op. **It becomes reachable
the moment 2d-5-5 gives `WriteSurfaceTransition` a real body**, because that callback is fired
synchronously from `applyChange:958`, in the middle of the loop, by production code.

### 3.3 **ESTABLISHED — a source comment still names the deleted failure arm as a live reader**

`src/lib/browser/workspace.svelte.ts:3603-3606`, inside `open()`:

```
      // **Copied at ingress, row by row**, for {@link ownedSummaryOf}'s reason:
      // `documents` is read inside the coordinator's guard and in the host failure
      // arm's last check before its write, and `listed.value` is an injected
      // command's answer. Read once, here, into an array this module built.
```

The *host failure arm* is the `.then` callback this phase **deleted**; the member at `:2457-2466`
has no failure arm at all. 2d-5-4-C corrected exactly this wording in two other places —
`ownedSummaryOf`'s header at `:676-681` (*"A third reader is gone rather than answered"*) and
`addDocument`'s comment at `:2829-2832` — and left the third standing. **This is the survivor shape
the brief warns about**, in **source**, and it is the same failure mode 2d-5-4-C itself recorded
finding in 2d-5-4-B: the sweep was written from the previous wording.

It is **not** listed in `2d-5-4-C-notes.md` §13.

### 3.4 **ESTABLISHED — an `Added` after a `Removed` leaves a `removed` status over a present row**

`applyRemoval:1165-1167` writes `{ kind: 'removed' }`. `applyAddition:854` re-inserts the row via
`addDocument`, and neither `addDocument` (`workspace.svelte.ts:2828-2854`) nor
`removeDocumentFromWindow` (`:2888-2910`) touches `externalStatuses`. The only clear is a successful
reread (`:3141`) or a whole `open()` (`:3556`), and **an `Added` requests no reread** (ruling 30,
`:790`-header). So *delete a file, recreate it* — a watcher `Removed` then `Added`, two batches —
leaves the file's `ExternalDocumentStatus` reading `removed` while its row is back in the sidebar,
until the next `Changed` for that file reruns the reread and clears it.

Same-batch ordering **is** handled — `isNewest` at `:1165` refuses the `removed` when an `Added` with
a higher sequence has been admitted, and `applyRemoval`'s own comment at `:1158-1164` says so. The
cross-batch case is the one nothing covers, and the comment's wording makes it easy to read as
covered.

**Production-reachable, pre-existing, and not yet visible**: this module's header (`:104-118`) says
no screen reads `ExternalDocumentStatus` today and 2d-6 is what draws it. So it is wrong *state*
rather than a wrong *sentence* — which is the hand-forward shape the brief names, but this instance
is not among the two the brief declares.

### 3.5 **ESTABLISHED — `guard` and `owns` are interchangeable at the call site, and swapping them would fire a component callback inside the mark block**

Both parameters of `ReconciliationWorkspace.rereadUnderGuard` are `() => boolean`
(`observationTransitions.ts:619-621`), and the declaration's own JSDoc says the type forces nothing
(`:610-612`). Passing them the other way round at `:1068` would compile — and it would make the
host call `guard()` at `:2462`, which fires `tellTheSurfaceAbout` → `WriteSurfaceTransition`
(`:1042`) **synchronously inside the status-mark block**, and `markStaleWhileOurs` twice over.
`2d-5-4-C-notes.md` §13 item 3 nominates the weak type and calls it *actionable*; what it does not
say is what the wrong argument order would actually do. **No defect today** — the call site is
correct — and no test covers the swap.

### 3.6 **NOT ESTABLISHED — that the member's discarded `void` at `:2465` hides anything**

Swept for the standing shape (*a consuming operation whose result is discarded*). The private
helper's answer is reported at `:3084` before it is returned, and the member's JSDoc says so. The
discarded value is a duplicate of something already on a channel. No second observation is spent and
no permit is consumed. Suspicion only; no derivation supports a finding.

### 3.7 **NOT ESTABLISHED — that `statusWrites` growing unboundedly is a defect here**

`statusWrites` (`workspace.svelte.ts:2285`) is never cleared, not even by `open()` (`:3556` clears
`externalStatuses` alone, as `:2275-2278` says). Cross-open comparison is refused earlier by
`stillCurrent()`'s `opened === openGeneration` (`:3077`), so no false equality can result. The map
grows by one entry per document ever statused, which is the same unbounded-by-design shape
`crates/espansoconfig-core/src/workspace/mod.rs:258-265` declares for the identity table. Recorded,
not established as a defect.

---

## 4. Summary table

| # | Item | Verdict | Source or record | Production-reachable |
|---|---|---|---|---|
| 1 | The blocker — no lifecycle fence in `applyAddition` | **HOLDS IN PART** (defect holds; *"introduced by M5"* does not; anchor 849 = trigger, 851 = cause) | source | no — injected accessor only |
| 2.1 | Deleted failure arm | no defect; both halves of its argument hold | — | — |
| 2.2 | `ownedRepair`'s rebuilt `SelectedMatch` and the *only unnormalized ingress* sweep | holds | — | — |
| 2.3 | `owns` on the interface | no defect | — | — |
| 2.4 | Four fenced writers + `applyUnreadable` | all five justifications hold | — | — |
| 2.5 | Correction blocks | one survivor in **source** (§3.3), four in the record | both | — |
| 2.6 | `workspace.svelte.ts:709-712` cited three times | does not resolve at HEAD | record | — |
| 3.1 | *"`open()` reallocates every document identity"* × 12 | **ESTABLISHED false** | source (5 files) | no behaviour depends on it today |
| 3.2 | Batch loop re-asks no lifecycle question | **ESTABLISHED** | source | not today; yes once 2d-5-5 lands |
| 3.3 | `workspace.svelte.ts:3604` names the deleted arm as live | **ESTABLISHED** | source | — |
| 3.4 | `Added` after `Removed` leaves a `removed` status | **ESTABLISHED** | source | yes, but not drawn until 2d-6 |
| 3.5 | `guard`/`owns` interchangeable | **ESTABLISHED** as a latent hazard, no defect today | source | — |
| 3.6 | The `void` at `:2465` | **NOT ESTABLISHED** | — | — |
| 3.7 | `statusWrites` unbounded | **NOT ESTABLISHED** as a defect | — | — |

Commands run: `git log`, `git status`, `git show`, `wc`, `sed`, `rg` only. No build, no test, no
`cargo`, no `npm`.
