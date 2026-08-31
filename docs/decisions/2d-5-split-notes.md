# Phase 2d-5 — the design consult, and the seven-step split it rules

**Status:** the record of a design decision, taken before any line of 2d-5 exists. It changes no
source file. `docs/reviews/phase-2d-5-design.md` is the consult itself and is the authority for
*what* 2d-5 builds; this file is this project's own restatement of it, plus the citation audit the
house rule owes, plus the corrections it forces on earlier documents.

---

## 1. What the consult was, and what it does not cover

- **Provider and effort:** Codex (GPT-5 family), **high** effort, dispatched **2026-08-31** by
  `/autoclaude-opus` in driven mode through the companion CLI, per
  `docs/decisions/codex-dispatch-procedure.md`.
- **The brief** is `docs/decisions/2d-5-design-brief.md` — 219 lines, written for this consult, with
  its own coverage bounds named to the consultant in its §7 rather than hidden.
- **The reply** is `docs/reviews/phase-2d-5-design.md`, captured verbatim with only the two edits the
  dispatch procedure permits: the reply's own `## VERDICT` demoted to `###`, and the session-ID
  trailer dropped with the ID kept.
- **It is the second provider to look at this material since 2d-4a began.** That discharges the
  coverage bound `2d-4b-notes.md` §14.8 item 6 carries, and it discharges it **for the design only**:
  no *review round* of 2d-5's code has run on a second provider, and none is promised by this record.

**No gate was run for this consult and none is claimed.** The brief forbade Cargo and npm; Codex ran
neither and said so itself, immediately under its verdict
(`docs/reviews/phase-2d-5-design.md:33`). Every figure it quotes — the four verification
baselines, the seventeen-command table, the six named `invoked` cases — is **read from a file, not
measured**. This record ran no gate either, for the same reason, and every count in §7 below was
derived by reading the file with `rg`, not by running a suite.

Three further bounds, stated because each is assumable:

1. **A design consult is not a review round.** Nothing here is a finding, nothing here has a severity,
   and this record commissions no round under `CLAUDE.md` §7 — it changes no source file at all.
2. **No claim here is about what a window does.** The consult ran no window, and neither did this
   record. Where §2 assigns a window reading, that is an obligation, never evidence.
3. **The consult reasoned from the repository as it stands on `main` at `998e346`.** A citation that
   resolves today can drift under the first commit of 2d-5-1; §4 is a snapshot with a date on it.

---

## 2. The seven-step split, restated

Codex's Q11 cuts 2d-5 into seven dependency-ordered steps. Restated here in this project's own terms.
The third column is the one that matters for evidence, because two of the seven touch `.svelte`
components and the earlier statement of the phase said none would.

### 2d-5-1 — surface and conflict vocabulary

**Delivers** the widened single `OpenWriteSurface` union with the creator's unknown/known target; the
two predicates over it (watcher targeting, restore competition); `ConflictSource` as a discriminated
save/external union; the memo that gives one wire `ConflictResult` one stable source object; the
origin-specific message values and their EN/ES accessors.

**Evidence:** model and type tests only, including the exhaustive `never` arms and the unchanged
unknown-creator restore behaviour. **Components: none.**

### 2d-5-2 — the exhaustive live registry

**Delivers** the coordinator-owned keyed registry with a register/unregister lease, and the exact
`OpenWriteSurfaceKind`-keyed binding object in `DetailPane` that makes omitting a declared kind a
compile error in one file; `MatchCreator` reports its chosen destination upward.

**Evidence:** mounted evidence for all seven kinds, the creator's unknown-to-known transition, and
restore's unchanged behaviour — plus **a narrow window regression reading**, which may not claim real
watcher delivery. **Components: yes**, registry plumbing only, no new watcher UI.

### 2d-5-3 — the drain lifecycle coordinator

**Delivers** `start()` and `dispose()`, the single-flight drain pump, all four triggers, the session
`{ epoch, watermark, lastDiscarded }` cursor, registration-race handling, current-open generation
capture, and injected foreground/resume events. The **production** event source stays unreachable.

**Evidence:** workspace and model tests over every trigger order, duplicate wakes, a wake during a
drain, an open during a drain, epoch mismatch, epoch zero, a failed registration, disposal before and
after registration, and an exact unlisten count. **Components: none.**

### 2d-5-4 — observation state transitions

**Delivers** the per-document accepted-sequence map, the guarded reread, the `Added` / `Removed` /
`Unreadable` arms, the selected-document removal transition, `Addressable`-only command routing, and
the discarded-history recovery that re-runs the coordinator's **retained original open request**.

**Evidence:** model and workspace tests across every observation-by-document-arm combination, two
documents, surface-open races, lost additions and removals, and an explicit zero-save-command
assertion. **Components: none.**

### 2d-5-5 — external conflicts and save arbitration

**Delivers** the generalization of all six conflict registrations, origin-switched reapply evidence,
same-revision coalescing, different-revision supersession, and the per-document in-flight-write
barrier.

**Evidence:** model and workspace tests for save-conflict versus watcher arrival in **both** orders, a
later different revision, stale evidence, all three adoption answers, a committed save, a definite
failure and a `mayHaveWritten` one. **Components: none** — drawing the new origin is 2d-6's.

### 2d-5-6 — the file-wide route-guard closure

**Delivers** the uniform hoisted `@tauri-apps/api/core` spy and its file-wide `afterEach` assertion in
`workspace.test.ts`, `DetailPane.test.ts` and `RestorePane.test.ts`, and replaces the blanket
zero-drain assertion with exact scripted budgets in the cases that deliberately reconcile.

**Evidence:** the targeted frontend tests and the machine-checkable frontend gate set. **Components:
none** — three component *test* files change, no `.svelte` renderer does.

### 2d-5-7 — production activation, capability, baseline

**Delivers** the first production import of `src/lib/ipc/events.ts:192-193`; `AppShell` starting the
coordinator and returning its disposal from `onMount`; **both** `core:event:allow-listen` and
`core:event:allow-unlisten` in the capability file; and the `dispatch_check.rs` extension.

**Evidence:** mounted lifecycle evidence, a narrow window lifecycle reading, the dispatcher tests, and
the complete machine-checkable gate set, with **all four baselines re-measured here**. **Components:
yes — `AppShell.svelte` only**, justified by the lifetime contract: with no host cleanup, `dispose()`
is an unused method rather than a disposal.

---

## 3. The binding rulings

One entry per ruling that constrains later work. Each says what it forces **and, in the same sentence,
what it does not** — a record claiming a guarantee the code does not give is this project's worst
defect class.

1. **The coordinator owns the live registry; `DetailPane` makes it exhaustive.** A keyed
   register/unregister lease gives ownership and lifetime, and one exact
   `satisfies Record<OpenWriteSurfaceKind, …>` assembly in the composition file makes omitting a
   *currently declared* kind a compile error — but it **cannot force a future author to classify a new
   component as a write surface at all, and cannot force a child to call its reporter correctly**, so
   mounted tests are the only thing that establishes either.

2. **A lease, not a bare kind key.** Reopening one kind must not let a stale instance unregister a
   newer one; the lease is what makes that impossible. Nothing in TypeScript forces a caller to
   *invoke* the unregister it was handed, which is why disposal is asserted by test rather than
   claimed by type.

3. **`OpenWriteSurface` becomes one discriminated union, not two registries.** The creator carries
   `target: { kind: 'unknown' } | { kind: 'document'; document }` and every other kind carries the
   document arm — which forces narrowing before a document can be read, and **does not** force a
   consumer to treat the unknown arm conservatively after narrowing.

4. **Two predicates over one union, and they answer differently.** Watcher policy treats an unknown
   creator as targeting **every** creator-eligible document; restore competition treats it as
   competing with **none**. The second is not a new rule — it is 2c-5's shipped behaviour
   (`src/lib/browser/restore.ts:373-376` carries the reason today, in the doc comment above the
   interface; `:378-383` is the declaration that comment sits on, and citing it for the *reason* was
   this record's own slip, caught by this phase's review), and preserving it is the whole point of
   writing the switch out rather than widening `surface.document === document`.

5. **`competingSurfaceFor` must switch on the target discriminant with a `never` terminus.** That
   turns a future arm into a compile error at that call site; it **does not** stop a consumer written
   without the switch from collapsing the arms, and only that function's own tests establish the two
   behaviours in entry 4.

6. **Two sequence states, deliberately, and they may hold different numbers.** The session cursor
   `{ epoch, watermark, lastDiscarded }` is the drain acknowledgement; `acceptedSequenceByDocument` is
   the arbitration key. Treating a disagreement between them as a bug would be the design error —
   nothing in the types says they should agree, and nothing enforces that a transition consults the
   right one.

7. **The watermark advances for an empty batch too.** That is what stops the queue being re-read;
   `src/lib/ipc/types.ts` documents the per-epoch non-falling property the coordinator relies on, and
   **that property is scoped to one epoch** — across a replacement it falls, and only the epoch
   comparison makes that safe.

8. **The shown epoch is learned from the first post-open drain, never from `open_workspace`.** The
   summary carries only a root and counts, so `open()` cannot supply one. Before that first batch, a
   wake may **request** a drain but may not establish authority — a wake carries no observation.

9. **`epoch: 0` is not stale; it is "watched by nothing".** Returned after a successful current open it
   means the epoch space was exhausted and the lifecycle started with no worker, so the batch is
   necessarily empty; keep epoch `0` and watermark `0` and expose a typed *not watched* state for 2d-6
   to draw. Presenting it as ordinary reconciliation coverage would be a false claim about what is
   being watched, and no type prevents that presentation.

10. **A newly increased `discarded` makes the whole shown workspace untrustworthy**, and it is handled
    **before** any observation in the same batch. Per-document rereads are not a recovery: the lost
    entry may have been the only observation of an addition or a removal.

11. **With no write surface open, recovery is a true `open()` — with the coordinator's retained
    original request, never `summary.root`.** A wire path is a lossy rendering and is
    **never round-trippable** as a command argument (`src/lib/ipc/types.ts:678-683`), so re-opening
    from it would be a different request that happened to look like the same one.

12. **With any write surface open, nothing is reloaded and nothing is manufactured.** No `open()`, no
    synthetic per-surface conflict (there may be no trustworthy disk snapshot to conflict against),
    the draft/operation/candidate preserved, reconciliation marked blocked, and subsequent
    per-document observations not applied. **An unknown-target creator counts as open** and therefore
    blocks the reload.

13. **`lastDiscarded` is remembered within the epoch.** `discarded` is cumulative and monotonic
    (`src/lib/ipc/types.ts:3101-3110`), so a repeated batch carrying the same non-zero value must not
    prompt twice; a strictly larger value updates the existing loss state. The watermark still advances
    while blocked, so the retained queue is not refetched — and that means those observations are gone,
    which is safe **only because** incremental reconciliation does not resume until a successful whole
    open establishes a new epoch.

14. **All four drain triggers call one idempotent `requestDrain`, and a single-flight pump serializes
    the actual calls.** Ten duplicate wakes before a drain produce one call; ten during it produce at
    most one follow-up.

15. **Single-flight removes drain-versus-drain reordering and nothing else.** The three captures taken
    before the await — open generation, expected epoch, disposal state — are still required, because an
    `open()` or a disposal can make the *only* drain stale.
    `src/lib/browser/workspace.svelte.ts:2382-2434` is the shipped shape of that discipline.

16. **Disposal owns the registration race.** `dispose()` marks the coordinator disposed and calls a
    held unlisten exactly once; a `subscribe()` that resolves afterwards sees `disposed` and calls the
    unlisten it received instead of storing it. Nothing in TypeScript forces that continuation to be
    written, so an exact unlisten count is the only evidence.

17. **`applyExternalObservation` exists, and its clean path delegates to the reread machinery.** The
    batch's projection is snapshot-exact and installing it directly would still be wrong: it bypasses
    `installView`'s invalidation and the selection discipline. The extra disk read is the accepted cost.

18. **The extra guard captures registry generation and accepted sequence too, and the recheck and
    `installView` stay one synchronous block.** Same open generation and epoch, still the newest
    accepted observation, projection generation unmoved, registry generation unmoved, and no open
    surface able to target the document. **Nothing in the language keeps those two in one block** —
    this project has already shipped a check-and-spend split by a property read.

19. **The conservative sentence claims an open surface, never a dirty draft.** *"The coordinator knows
    that a write surface capable of targeting this document is open; it cannot tell whether that
    surface has been edited, so it will not reload automatically."* R36 is why: `isDirty` is derived
    inside a component's own session and no coordinator can observe it.

20. **The raw viewer *may* refresh automatically; the raw editor takes the conflict path even when
    pristine.** The viewer is ordinary browser state, the editor is a registered write surface. The
    permission is deliberate and this record originally restated it as an obligation: the consult
    says the read-only viewer *may* refresh (`docs/reviews/phase-2d-5-design.md:170`), which leaves
    2d-5-4 free to decide whether it does. Only the editor's half is a requirement.

21. **`ConflictModel.source` becomes a discriminated `ConflictSource`, not a structurally widened
    save type.** Optional top-level `expected` / `found` / `changedAgain` would let the two origins
    masquerade as one another; they move under, or are derived only from, the `save` arm.

22. **A save source is memoized on its `ConflictResult`,** so repeated descriptions of one wire
    conflict recover the same object and the identity-keyed maps keep working. `conflictOrigins`
    (`src/lib/browser/workspace.svelte.ts:1594-1597`) and the reapply authorization memo both re-key to
    `ConflictSource`; all six `rememberTheConflict` callers take the memoized source first. **Nothing
    forces a caller to go through the memo** rather than build a fresh wrapper, and a fresh wrapper
    would install nothing — which fails safe, but silently.

23. **Origin may change the messages, whether expected/found exist, the provenance and eligibility of
    reapply evidence, and the explanation. It may not change who installs or who produces controls.**
    `adoptDiskVersion` stays the only confirmed-install door with its `installed | alreadyThere |
    refused` answers, and `conflictChoicesFor` (`src/lib/browser/saveOutcome.ts:517-534`) stays the
    only choice-list producer.

24. **External reapply evidence is usable only when its `base_revision` matches the retained draft's
    base and its `disk_revision` matches the current disk snapshot.** The wire says the correspondence
    table is snapshot-bound and that **TypeScript does not express the pairing**; one Rust function
    building both is the whole of what it rests on.

25. **At the same document and the same `disk_revision`, the save conflict wins.** It carries the
    stronger fact — a locked write attempt was refused — plus operation-specific evidence. The watcher
    observation is still accepted for sequence and watermark accounting and must not replace the model,
    its messages or its source identity. Revision equality proves identical bytes, never origin or
    chronology.

26. **A strictly higher observation sequence with a different revision supersedes the conflict's disk
    side.** Draft preserved; disk text, projection, revision, findings and origin replaced; the save
    conflict's `found` never rendered as the current disk revision; any pending reload confirmation
    withdrawn; old reapply evidence invalidated. **Hashes carry no order**, so only the observation
    sequence defines "later".

27. **An in-flight write is a per-document arbitration barrier.** Observations for that document are
    retained and coalesced, not applied, until the write promise settles — and an uncertain
    (`mayHaveWritten`) outcome forbids automatic reload, because a later watcher snapshot can establish
    what is on disk but never who wrote it. **No save command may ever be initiated by watcher
    arbitration.**

28. **Only an explicitly narrowed `Addressable` arm reaches an open-workspace document command.**
    `Named` and `Unnamed` produce state-only transitions, notices, or a deferred safe membership
    reload. The routing boundary is an exhaustive switch with a `never` terminus, which forces a
    future fourth arm to be handled and **cannot force the narrowed `Named` branch not to call a
    command** — negative command-spy tests are what establish that.

29. **No common identity accessor is added.** The wire type deliberately has none, because one would
    collapse `Addressable` and `Named` into one answer with a `?`.

30. **`Added` inserts or replaces a `DocumentSummary` by identity with `loaded: false`, puts nothing in
    `views`, and calls no command.** An addition's identity is by definition not an address the open
    workspace resolves.

31. **A removed selected document needs a new synchronous `removeDocument` transition, not
    `repairAfter`.** `repairAfter` repairs only against a supplied `DocumentView`, and a removed
    document has none; the new transition invalidates the projection, removes it, clears `selected`
    through `replaceSelection`, and drops the raw snapshot.

32. **Both event permissions land together, in the sub-step that makes the first production
    `subscribe()` reachable, and neither lands unused.** `core:event:default` is too broad — it also
    grants emit and emit-to. `src-tauri/capabilities/default.json:6` is `"permissions": []` today and
    the file's own text demands the narrowest enumerated set.

33. **`dispatch_check.rs` must now assert the capability set's exact contents**, local listen, local
    unlisten, remote refusal for both plugin commands, the unchanged **seventeen**-command application
    table (`src-tauri/src/dispatch_check.rs:1926`), and continued local reachability plus remote-sweep
    membership for every application command. Its present prose and test names claim an **empty**
    capability set and must be corrected rather than left green and false.

34. **The route-guard closure mocks `@tauri-apps/api/core`, not `$lib/ipc/commands`.** Keeping the real
    wrapper module and the real `REAL_COMMANDS` assembly is what makes any module-level bypass reach
    the recorded `invoke`; a partial command-module mock would make a 186-case suite test a mocked
    composition module. The rejected third shape — a composition root with every dependency required —
    is strongest locally and still cannot prevent a future direct import.

35. **The blanket `expect(drained).toBe(0)` is replaced, not deleted.** Every reconciliation test
    supplies a finite scripted drain-answer queue, each intended trigger asserts an exact call count
    and `afterSequence`, `afterEach` asserts the budget was consumed exactly with nothing pending, and
    the core-level `invoked` assertion stays **zero in every test** because even an intended drain must
    use the injected boundary. Every coordinator created must be disposed before its case ends.

---

## 4. Citation audit

**The consult makes 56 `file:line` citations that name a file, plus 11 abbreviated `:NNN`
continuations that inherit the preceding filename — 67 distinct line references.** Both figures are
this record's own, derived with `rg` over `docs/reviews/phase-2d-5-design.md`, and the 56 agrees with
the figure the task was set with.

**Every one of the 67 was checked by reading the cited lines.** A single-line citation resolves if the
named construct is at or begins at that line; a range resolves if the named construct is substantially
within it. **Result: 67 resolve, 0 drifted, 0 wrong** — which is the cleanest citation set this
project has audited, and the reason is visible in the consult's own text: it cites ranges it had
opened rather than ranges it remembered.

**The *Consult line* column was wrong in all 67 rows when this section was first written, and this
is the correction.** The column names a line in `docs/reviews/phase-2d-5-design.md`, and that file's
**header** was edited twice after the audit was derived — once to correct the *fifteen/sixteen* count
of §5.5, once to replace a paragraph-position claim with a line citation — each edit adding one line
above the reproduced reply and shifting every body line down by one. The audit was not re-derived
after either. This phase's review caught the column off by one; the second edit had by then made it
off by two.

**The column is now re-derived rather than re-shifted, and the check is mechanical**: every row's
citation string was required to occur on the line that row claims, in the file as it now stands, and
all 67 do. **No row's verdict was affected** — the verdicts are about whether a `file:line` into the
*source tree* resolves, and no source file was touched by this phase or by either header edit. The
failure is worth its paragraph anyway: it is the ordinary shape of a derived figure outliving the
thing it was derived from, and the only reason it was caught is that a reviewer re-derived a column
nobody expected to have moved.

| # | Consult line | Citation | Cited for | Verdict |
|---|---|---|---|---|
| 1 | 47 | `src/lib/components/DetailPane.svelte:453-494` | the six-entry producer that omits the creator and admits completeness is unchecked | resolves |
| 2 | 47 | `src/lib/components/DetailPane.svelte:649-672` | `busy` independently enumerating seven surfaces | resolves |
| 3 | 47 | `src/lib/browser/restore.ts:329-352` | seven kinds in `OpenWriteSurfaceKind`, `matchCreator` among them | resolves |
| 4 | 65 | `src/lib/components/MatchCreator.svelte:329-336` | the destination choice staying internal to the component | resolves |
| 5 | 65 | `src/lib/browser/restore.ts:373-383` | a required `document` cannot represent the unknown state | resolves |
| 6 | 72 | `src/lib/browser/restore.ts:363-376` | the contract that a creator with no destination competes with no restore | resolves |
| 7 | 72 | `src/lib/browser/restore.ts:404-414` | the comparison assuming every entry has a document | resolves |
| 8 | 78 | `src/lib/ipc/types.ts:3068-3110` | the batch contract distinguishing watermark from observation sequences | resolves |
| 9 | 78 | `src/lib/ipc/commands.ts:903-922` | the wrapper requiring the caller's watermark rather than owning one | resolves |
| 10 | 80 | `src/lib/ipc/types.ts:642-656` | `WorkspaceSummary` holding only a root and counts | resolves |
| 11 | 80 | `src/lib/ipc/commands.ts:257-270` | the open wrapper returning that summary | resolves |
| 12 | 87 | `src/lib/ipc/types.ts:2741-2765` | a wake carrying no observation and being only a hint | resolves |
| 13 | 89 | `src/lib/ipc/types.ts:3077-3085` | epoch zero meaning exhaustion prevented a worker starting | resolves |
| 14 | 95 | `src-tauri/src/reconciliation.rs:241-248` | Rust binding a discarded entry to a whole-workspace reload | resolves |
| 15 | 95 | `src-tauri/src/reconciliation.rs:1160-1169` | the same obligation stated at the drain | resolves |
| 16 | 97 | `src/lib/ipc/types.ts:643-645` | `summary.root` being a lossy rendering | resolves |
| 17 | 97 | `src/lib/browser/workspace.svelte.ts:2174-2207` | a true open clearing documents, projections, selection, viewer, generations | resolves |
| 18 | 109 | `src/lib/ipc/types.ts:3101-3110` | `discarded` cumulative and monotonic | resolves |
| 19 | 122 | `src/lib/ipc/events.ts:21-35` | the four deferred drain obligations listed in the adapter | resolves |
| 20 | 122 | `src-tauri/src/events.rs:47-59` | a failed emit dropped on purpose because fallback drains exist | resolves |
| 21 | 131 | `src/lib/ipc/types.ts:2759-2765` | a wake promising no queue growth | resolves |
| 22 | 133 | `src/lib/browser/workspace.svelte.ts:2382-2424` | the three-capture discipline before an await | resolves |
| 23 | 142 | `src/lib/components/AppShell.svelte:24-31` | creating and opening the state with no cleanup returned | resolves |
| 24 | 142 | `src/lib/ipc/events.ts:129-180` | the wrapper leaving lifetime ownership to its caller | resolves |
| 25 | 155 | `src/lib/browser/workspace.svelte.ts:2382-2434` | capture, reject stale, then forget → install → repair → re-read | resolves |
| 26 | 167 | `src/lib/browser/workspace.svelte.ts:1780-1835` | `installView` invalidating one projection and dropping paired text | resolves |
| 27 | 167 | `src/lib/browser/workspace.svelte.ts:1690-1723` | selection intent as the separate global counter | resolves |
| 28 | 169 | `src/lib/browser/matchDuplication.ts:300-339` | the shipped predicate measuring an open editor, dirty or pristine | resolves |
| 29 | 171 | `src/lib/components/DetailPane.svelte:473-493` | the registry already listing `rawEditor` | resolves |
| 30 | 171 | `src/lib/browser/workspace.svelte.ts:669-715` | the raw viewer being ordinary browser state | resolves |
| 31 | 197 | `src/lib/browser/workspace.svelte.ts:2546` | a `rememberTheConflict` registration site | resolves |
| 32 | 197 | `:2638` | a `rememberTheConflict` registration site | resolves |
| 33 | 197 | `:2715` | a `rememberTheConflict` registration site | resolves |
| 34 | 197 | `:2775` | a `rememberTheConflict` registration site | resolves |
| 35 | 197 | `:2898` | a `rememberTheConflict` registration site | resolves |
| 36 | 197 | `:2980` | a `rememberTheConflict` registration site | resolves |
| 37 | 197 | `src/lib/browser/workspace.svelte.ts:1583-1597` | the origins map accepting only `ConflictResult` | resolves |
| 38 | 197 | `src/lib/browser/saveOutcome.ts:697-775` | the model requiring save-only fields and typing `source` as `ConflictResult` | resolves |
| 39 | 215 | `src/lib/browser/workspace.svelte.ts:2076-2172` | the door validating origin, document, revision and generation | resolves |
| 40 | 215 | `src/lib/browser/saveOutcome.ts:475-534` | the sole choice-list producer | resolves |
| 41 | 215 | `PROGRESS.md:103-116` | EN and ES both, and a component never building a key | resolves |
| 42 | 215 | `src/lib/i18n/codes.ts:1699-1721` | the typed-accessor registry | resolves — the range is the namespace-builder registry and its four stated non-guarantees; the "never build a key" rule itself is `PROGRESS.md:110-111` |
| 43 | 231 | `src/lib/ipc/types.ts:2891-2911` | correspondence snapshot-bound, the pairing not expressed in TypeScript | resolves |
| 44 | 231 | `src/lib/browser/workspace.svelte.ts:2150-2158` | revisions being hashes that carry no order | resolves |
| 45 | 240 | `src/lib/browser/workspace.svelte.ts:2745-2754` | a wrapper distinguishing `mayHaveWritten` | resolves |
| 46 | 240 | `src/lib/browser/workspace.svelte.ts:2931-2944` | the raw-save wrapper doing the same | resolves |
| 47 | 252 | `src/lib/ipc/types.ts:3030-3045` | an addition's identity not being an address, its summary truthfully unloaded | resolves |
| 48 | 254 | `src/lib/browser/workspace.svelte.ts:3571-3587` | `repairAfter` repairing only against a supplied projection | resolves |
| 49 | 256 | `src/lib/ipc/types.ts:2771-2805` | the deliberate absence of an identity accessor | resolves |
| 50 | 262 | `src/lib/ipc/events.ts:46-73` | listen alone leaving a Rust-side listener that cannot be removed | resolves |
| 51 | 262 | `src-tauri/gen/schemas/desktop-schema.json:371-399` | two separate narrow permissions; `core:event:default` also granting emit and emit-to | resolves |
| 52 | 262 | `src-tauri/capabilities/default.json:1-6` | the empty list and the demand for the narrowest set | resolves |
| 53 | 273 | `src-tauri/src/dispatch_check.rs:1-21` | module prose claiming an empty capability set | resolves |
| 54 | 273 | `:283-365` | a test named for the empty capability set | resolves |
| 55 | 273 | `:1942-2013` | the drain dispatcher test claiming the empty set | resolves |
| 56 | 273 | `src-tauri/src/dispatch_check.rs:1907-1939` | the remote table asserting seventeen commands in both directions | resolves |
| 57 | 282 | `src/lib/components/DetailPane.test.ts:59-73` | the hoisted core spy that rejects | resolves |
| 58 | 282 | `src/lib/components/RestorePane.test.ts:112-125` | the same mechanism in the second component suite | resolves |
| 59 | 285 | `src/lib/components/DetailPane.test.ts:336-350` | the `afterEach` that asserts drains, not `invoked` | resolves |
| 60 | 285 | `:516-541` | the one case asserting `invoked` | resolves |
| 61 | 285 | `src/lib/components/RestorePane.test.ts:754-768` | the `afterEach` that asserts drains, not `invoked` | resolves |
| 62 | 285 | `:790-808` | one `invoked` assertion, at the range's last line | resolves |
| 63 | 285 | `:895-968` | three `invoked` assertions, at 911, 941 and 968 | resolves |
| 64 | 285 | `:1069-1085` | the fifth `invoked` assertion | resolves |
| 65 | 287 | `src/lib/browser/workspace.test.ts:502-513` | the blanket zero-drain `afterEach` | resolves |
| 66 | 352 | `PROGRESS.md:272-285` | the four live baselines `1320 / 434 / 2175 / 184` | resolves |
| 67 | 352 | `PROGRESS.md:294-303` | the recorded expectation that `events.ts` moves the module count by one | resolves |

Three notes where this record adds to what the consult wrote rather than disagreeing with it:

- **Row 16.** The lossiness is at `src/lib/ipc/types.ts:644`, but the sharper sentence the ruling
  actually needs — *"a wire path is never an identifier and never round-trippable"* — is at
  `src/lib/ipc/types.ts:678-683`, which the consult did not cite. That is this record's addition.
- **Row 42.** The cited range documents four things the key-builder check does **not** establish; the
  ban on building keys by hand lives in `PROGRESS.md:110-111` and `CLAUDE.md` §5, not there.
- **Row 63.** One range covers three of the five `invoked` assertion sites. Counted as one citation,
  as the consult wrote it; all three constructs were read.

---

## 5. Corrections — where the consult overrides an earlier document

`docs/reviews/phase-2d-design.md` step 5 and Q4 are the earlier statement of this phase. The consult
binds where the two disagree. Four places, the first two known in advance and the last two found by
this audit.

### 5.1 The creator's unknown target does not type-check as written

`phase-2d-design.md:76` prescribes representing the creator as
`{ kind: 'matchCreator', target: 'unknown' }`. **That value does not type-check against today's
`OpenWriteSurface`** (`src/lib/browser/restore.ts:378-383`), which has exactly two members — `kind`
and a **required** `document: DocumentId` — and no `target` field of any kind. The prescription would
not compile, and neither would a variant of it that merely made `document` optional, because
`competingSurfaceFor` (`src/lib/browser/restore.ts:404-414`) compares `surface.document === document`
and an optional field would silently make an unknown creator compete with nothing *by accident*
rather than by rule.

**Replaced by** the discriminated union of §3 entry 3: `target` is itself a union of
`{ kind: 'unknown' }` and `{ kind: 'document'; document }`, and `competingSurfaceFor` switches on that
discriminant with a `never` terminus. The behaviour the earlier document wanted survives; what changes
is that it now has a shape that compiles and a switch that fails loudly when the union grows.

### 5.2 Two of the seven steps do touch components

`phase-2d-design.md:126` ends step 5 with *"No component changes means no mounted or window evidence
yet."* **The consult rules that condition does not hold**, and names the two steps and their reasons:

- **2d-5-2**, because the exhaustiveness mechanism *is* an assembly in the composition file — a
  registry the coordinator owns but nothing constructs completely is exactly the failure mode
  `phase-2d-design.md` Q8 calls this phase's sharpest;
- **2d-5-7**, because `AppShell.svelte:24-31` returns no cleanup today, so without a host change
  `dispose()` is an unused method and the lifetime contract is unenforced.

**Consequence for evidence:** those two steps owe mounted evidence and a narrow window reading; the
other five owe model tests and the machine-checkable gate set. **The window readings may not claim
real watcher delivery** — that observation is a running window's and is 2d-7's, and no suite in this
repository can substitute for it.

### 5.3 The earlier document's two `DetailPane.svelte` ranges are truncated

`phase-2d-design.md:76` cites `DetailPane.svelte:453-469` and `:649-665`. Read today, the
`openWriteSurfaces` doc comment runs to **472** and its body to **494**, and `busy`'s enumeration runs
**664-672** — so `:649-665` stops at the *first* of the seven conditions it is cited for. The consult's
`:453-494` and `:649-672` are exact. **This record uses the consult's ranges**, and both were read.

### 5.4 "Add `applyExternalObservation` **or** drive `rereadDocument`" is settled as "both"

`phase-2d-design.md` Q4 offers the two as alternatives. The consult rules **both**: the transition
exists, and its clean-path installation delegates to a `rereadDocument` refactored to accept one extra
coordinator guard checked immediately before `installView`. Extracting a private guarded helper is
permitted; assigning the observation's `disk` directly is not. The earlier document's related
sharpening — key the origins map "by either origin object's identity" — is settled as the memoized
save source of §3 entry 22, which is what makes "either identity" a stable one.

### 5.5 One figure that was wrong when this section was drafted, and is now corrected

**This section originally recorded a disagreement that no longer exists, and the correction is the
point rather than a footnote.** When the audit was derived, the preamble of
`docs/reviews/phase-2d-5-design.md` said **sixteen** consecutive Opus review rounds with no second
provider, where `PROGRESS.md`, `2d-4b-notes.md` §14.8 item 6 and the brief's §7 item 4 all say
**fifteen**. The preamble was the caller's own count, not Codex's, and it was not derived from
anything — so it was corrected in the same commit to quote the checkpoint's figure explicitly rather
than to restate it. The preamble now reads *fifteen* (`docs/reviews/phase-2d-5-design.md:10-13`).

**Two counts do not differ here, and this record must not say they do.** The review of this phase
caught that sentence still claiming a live disagreement in the same commit that had already closed
it, which is exactly the shape `CLAUDE.md` warns about: a record describing a state the tree no
longer holds. Nothing turned on which figure was right — the coverage bound is discharged by this
consult either way — but a record is not entitled to leave a false sentence standing because its
subject is unimportant.

---

## 6. What the consult did not settle

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round**; §7.1 is the only mechanism
and it reads a diff. None of these names a correctness defect in a source file, so none is a blocker.

1. **2d-5-1 declares "components: none" while changing the shape of a type whose only production
   producer is a component — *actionable*.** `openWriteSurfaces()` at
   `src/lib/components/DetailPane.svelte:473-494` is the sole non-test constructor of
   `OpenWriteSurface` values, and `src/lib/components/RestorePane.test.ts:1079` constructs one too.
   Replacing `document: DocumentId` with a `target` union breaks both at compile time, so
   `npm run check` cannot be green at the end of 2d-5-1 unless the step either makes the widening
   additive or touches that component after all. **The check that settles it can be run in files that
   exist**: 2d-5-1 must decide, before it starts, whether it takes the mechanical edit to
   `DetailPane.svelte` or ships the union additively and lets 2d-5-2 narrow it.
2. **The consult does not say where the coordinator lives — *recorded only*.** Whether the registry,
   the pump and the observation transitions go into `src/lib/browser/workspace.svelte.ts` (already
   3 588 lines) or a new module beside it is left to the steps. Both satisfy every ruling.
3. **"Creator-eligible match document" is not defined — *recorded only*.** §3 entry 4 makes an unknown
   creator target every one of them for watcher purposes, and which documents qualify is 2d-5-1's to
   state and 2d-5-4's to use.
4. **The blocked-reconciliation state's exit is described but not typed — *recorded only*.** The
   consult says the whole reload is permitted "after the surfaces are closed or their retained values
   have been explicitly dealt with"; what observes the second half, and whether closing the last
   surface triggers the reload or merely permits it, is 2d-5-4's.
5. **Nothing in the consult bounds how many observations a blocked coordinator may drop — *recorded
   only*.** The watermark advances while blocked (§3 entry 13), so it drops all of them; that is safe
   only under the whole-reload obligation, and no type expresses the dependency.
6. **The `not watched` state for `epoch: 0` has no dictionary keys yet — *recorded only*.** 2d-6 draws
   it, and the EN/ES entries plus the accessor in `src/lib/i18n/codes.ts` are owed by whichever step
   first names it.
7. **The window readings 2d-5-2 and 2d-5-7 owe are narrow regression readings, not the native
   matrix — *recorded only*.** The full matrix is 2d-7's, and neither reading may be cited as
   evidence that a wake was delivered.

---

## 7. The inherited work item, and the counts this record measured

`docs/decisions/2d-4b-notes.md` §14.8 item 1 is the one thing that survived the eight-round 2d-4b tail:
`src/lib/browser/workspace.svelte.ts` imports its command wrappers at module level, so a call made
through one of those bindings rather than through the injected `BrowserCommands` increments the
`drains` counter in nothing. **2d-5-6 is where it is discharged**, and the closure is owed to all three
files rather than to the one without a spy.

**Measured for this record with `rg`, not copied forward:**

| File | core spy | `drains` counter | file-wide `afterEach` | `invoked` assertions | cases |
|---|---|---|---|---|---|
| `src/lib/browser/workspace.test.ts` | **none** | `:319`, incremented `:472` | `:502-513`, asserts `drains` only | **0** | 186 |
| `src/lib/components/DetailPane.test.ts` | `:66`, rejects | `:170`, incremented `:222` | `:341-350`, asserts `drains` only | **1** — `:534` | 8 |
| `src/lib/components/RestorePane.test.ts` | `:117`, rejects | `:445`, incremented `:527` | `:759-768`, asserts `drains` only | **5** — `:808`, `:911`, `:941`, `:968`, `:1084` | 27 |

**So the escaping route is caught in six named cases and nowhere else**, and this record derived the
six rather than inheriting them: one assertion in `DetailPane.test.ts` and five in
`RestorePane.test.ts`, each in a distinct `it` block, and **in neither `afterEach`** — both of those
read the injected `drains` count instead, which is precisely the counter the route bypasses.
`workspace.test.ts`, the file whose subject module *holds* the route, has no `@tauri-apps/api/core`
mock at all.

**The 186 is this record's own derivation and it agrees with the consult's.** `rg -n '\bit\('` over
`src/lib/browser/workspace.test.ts` matches 180 lines, none of them the `it.each(WRITERS)` at `:5967`;
that table has six rows, so 180 + 6 = **186** runtime cases. The other two figures are literal `it(`
counts with no `it.each` in either file.

**What that table does not establish**, in the same breath as what it does: it counts spies and
assertions, not coverage. A file-wide `expect(invoked).not.toHaveBeenCalled()` in every `afterEach`
would close the *route*, and it would still say nothing about a wrapper called during a case that
mocks the boundary for its own reasons — and nothing in TypeScript, in Vitest or in this repository
prevents a future test file from importing `$lib/ipc/commands` directly with no spy at all. That is
the residual §14.8 item 1 named and 2d-5-6 does not remove.

---

## 8. This phase's own review, and its five dispositions

**Verdict: `ship-with-fixes`, 0 blockers, 5 SHOULD-FIX** — a fresh `autoclaude-reviewer` on Opus that
wrote none of the three documents. The full report is
[`docs/reviews/phase-2d-5-design-record-review.md`](../reviews/phase-2d-5-design-record-review.md).

**Its most useful finding was one nobody was looking for**: three of the five were caused not by the
consult, not by the brief and not by this record's reasoning, but by the *orchestrator's own header
edit* to `docs/reviews/phase-2d-5-design.md` landing after the audit had been derived from it.
A derived figure outliving the thing it was derived from is the shape, and it is the same shape
`CLAUDE.md` records under a different name.

| # | Finding | Disposition |
|---|---|---|
| 1 | §5.5 recorded a live *fifteen/sixteen* disagreement in the same commit that had already fixed it | Rewritten. §5.5 now records the correction and says the counts no longer differ |
| 2 | The *Consult line* column was off by one in all 67 rows (off by two by the time it was fixed) | **Re-derived, not re-shifted.** Every row's citation string is now required to occur on the line the row claims, and all 67 do. The paragraph above the table records the cause |
| 3 | §3 entry 4 cited `restore.ts:378-383` — the interface — for a reason carried by `:373-376`, the doc comment above it | Corrected to `:373-376`, with the slip named |
| 4 | Entry 20 restated the consult's *may refresh automatically* as *refreshes automatically* — a permission promoted to an obligation | Corrected, and the permission's freedom handed explicitly to 2d-5-4 |
| 5 | Both files said the consult disclaimed its gates "in its own third paragraph"; it is the second prose paragraph unless the verdict heading counts | Replaced in both files with a line citation, which cannot be read two ways |

**No fix touched a source file**, so under `CLAUDE.md` §7.1 no further round is commissioned and §7.2
closes this step. All five edits landed in `docs/decisions/2d-5-split-notes.md` and
`docs/reviews/phase-2d-5-design.md`, both on §7's closed list.

**What the review did not verify, in its own words:** it ran no gate — the brief forbade Cargo and npm
because the orchestrator had already measured them — so every figure in §1's table is the
orchestrator's, not a second measurement. It opened roughly 32 of the 67 audit rows individually and
checked no row's *characterisation* beyond its endpoints. And it makes no claim whatever about
whether the consult's design rulings are **sound as design**: no window was opened and nothing was
built. Phase 2d-5-1 is the first step that tests any of them against a compiler.
