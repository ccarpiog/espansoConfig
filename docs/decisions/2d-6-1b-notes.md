# Phase 2d-6-1b — the observation-protocol members on `BrowserState`

**Status: implemented, reviewed (§7), the review's three findings fixed, gates green.** Risk class:
**high** (the orchestrator's classification at selection: check-and-spend semantics inside a 6 000-line
coordinator, the defect class 2d-5-5b's three blockers came from); worker model **opus** —
five new public members and one changed return type on `BrowserState`, a seventh arm on a shared
verdict type, the settlement path inside the six writing wrappers' `finally` now runs receiver code,
no `.svelte` file, no Rust, no new module. `git diff --stat` over `src/lib/components/`,
`src-tauri/` and `crates/` (beyond the four instrument paths) is empty on the final tree.

This is the second of the three sub-phases the orchestrator cut 2d-6-1 into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-1*). It is bound by
§3 entries **2, 4, 5, 11, 14, 15, 16, 17, 18, 41 and 42** of that record and by its §5.5 and §5.6;
the consult behind them is [`docs/reviews/phase-2d-6-design.md`](../reviews/phase-2d-6-design.md).
It consumes what [2d-6-1a](2d-6-1a-notes.md) landed and nothing in production consumes what it
lands: **no component, no session transition and no coordinator transition calls any member added
here**, by design (entry 42), and every member's doc says so.

---

## 1. What changed, per deliverable

All four deliverables are on `BrowserState` in `src/lib/browser/workspace.svelte.ts`; the line
numbers are of the final tree.

### 1.1 The arbitration/delivery member and settlement publication (entries 2, 4, 5)

- **`observeExternalChange(observation): ObservationDelivery`** (interface `:1405`, implementation
  `:4628`) is the arbitration/delivery member entry 4 names. It arbitrates once — the private
  `arbitrateHere` (`:3392`) now builds its answer through 1a's `arbitratedDelivery` /
  `retainedDelivery`, so the verdict is sealed with the observation it is about by construction —
  and the one caller of `arbitrateHere`, the new private **`arbitrateAndDeliver`** (`:3462`), hands
  that one envelope to every receiver registered over the file through the new private
  **`deliver`** (`:3499`). The barrier branch delivers a `retained` envelope too. **The return type
  changed** from `ObservationVerdict` to the envelope, so a caller and the receivers hold the same
  sealed object; the ten call sites in `workspace.test.ts` that read the answer now read `.verdict`.
- **`registerObservationReceiver(document, receiver): UnregisterObservationReceiver`** (`:1447`,
  `:4654`) is where a session's receiver is registered later. One registration object per call
  (`ReceiverRegistration`, `:2585`), so the unregister is **instance-bound**: the same function
  registered twice is two registrations, each unregister removes exactly its own, a second call is
  inert. Recipients are copied before the first is called, so a receiver that registers or removes
  during a delivery changes the next delivery's recipients. **A receiver that throws is caught per
  receiver, reported through the injected `report` as an `unexpected` failure, and does not stop its
  siblings** — because the settlement path publishes from inside the wrappers' `finally`, where an
  escaping throw would replace a committed write's answer with a session's exception (the project's
  named worst class). Since the review (§7, finding 1) the reporting is contained too: a reporter
  that throws, or a thrown value `classifyFailure` cannot read, is dropped at that boundary — the one
  place this state drops an error, said where it happens. What the reporting costs is stated in the
  doc: the console line carries the command-failure prefix, the one developer channel this state
  has. **Deliveries are queued behind the one in progress** (§7, finding 2): a publication made from
  inside a receiver is decided at once and handed out after the current envelope has reached every
  recipient, so every receiver sees decisions in the order they were made; one synchronous drain
  hands out each (observation, verdict kind) pair once, which is what lets a receiver that
  re-publishes what it receives come to rest. Not cleared by `open()`, for the same reason the
  write-surface registry is not.
- **Settlement publishes through the same path** (entry 2): the lease's `close()` no longer discards
  `arbitrateHere`'s answer — `case 'arbitrate'` calls `arbitrateAndDeliver` (`:3666`), and `case
  'writtenHere'` delivers a `writtenHere` envelope (`:3654`, §1.5). **Watermark and accepted
  sequence are untouched**: `deliver` reaches neither, and the *watermark unmoved* case drives the
  coordinator through a settlement publication and asserts the next drain asks with the cursor the
  last batch established (`expectDrains([0, 0, 11])`).
- **Entry 5, in the code's own words.** The settlement is published synchronously from `close()`,
  which runs in the wrapper's `finally` — before the wrapper's promise settles, and therefore before
  the continuation of any `await save(...)` on it. The *settlement verdict delivered* case pins that
  order on this side (`['delivered:retained', 'delivered:raised', 'continuation']`). What a session
  does with a delivery that arrives before its own continuation resumes — hold it, apply its result,
  consume the latest valid delivery — is the session's, and **nothing in TypeScript orders a
  continuation against a delivery**; the doc on `registerObservationReceiver` says so in the same
  sentence, and the mounted ordering test is 2d-6-6's.
- **The `ReconciliationWorkspace` interface was not widened.** The record's wording is "the narrow
  `ReconciliationWorkspace` arbitration/delivery member"; this phase reads that as the member the
  coordinator's transition will call — `BrowserState.observeExternalChange` — and leaves
  `observationTransitions.ts`'s `tellTheSurfaceAbout` calling the registered
  `WriteSurfaceTransition` with the bare observation, as before. Adding a member to the coordinator's
  interface with no transition calling it would have cost ten test fakes an implementation of a dead
  member; routing the transition through this member together with child-reported receivers is
  2d-6-6's (the record §2: "the first live component path for `observeExternalChange`"). The
  orchestrator may rule the other way; the change is then one interface member and one host line.

### 1.2 The person-requested retry (entries 16, 17, 18)

**`retryRetainedObservation(document): RetainedRetryOutcome`** (`:1486`, `:4685`; the outcome type
`:974`). Three answers and no loop: `nothingRetained`, `writeInFlight` (the record untouched, the
write's settlement releases it), and `attempted` carrying the delivered envelope. One press is one
arbitration: the record's observation and **original arrival generation** are read off this state's
own table, the record is deleted, and `arbitrateAndDeliver` runs at that generation — never a fresh
`observeExternalChange`. **Delete-first is what makes re-entrancy bounded**: a press from inside the
attempt finds the barrier empty and answers `nothingRetained`, and an attempt whose arbitration finds
the tables moved retains the observation again at the same arrival generation and answers
`attempted` with `retained` — held, and askable again. **An arbitration that throws before deciding
gives the record back** (§7, finding 3): it is restored into an empty slot only, by `has` and `set`
with nothing between them, so a reading a re-entrant arrival retained during the failed attempt is
kept and the throw still reaches the caller. The *original arrival generation* case shows
the retry registering at g0 after a re-read moved the window to g1 and `adoptDiskVersion` refusing
the backwards install; its **negative control** shows that a fresh `observeExternalChange` on the
same window registers at g1 and installs `rev-c` over `rev-d` — exactly the renewal entry 17 forbids.

### 1.3 The uncertainty acknowledgement (entries 14, 15)

Two members, mirroring `confirmReloadDiskVersion` / `adoptDiskVersion`'s mint-and-spend shape:

- **`uncertaintyAcknowledgementFor(source): UncertaintyAcknowledgement | null`** (`:1514`, `:4715`)
  mints a frozen, empty, branded object (`:1020`) whose binding — open generation, document,
  **uncertainty generation**, standing origin — lives in a private `WeakMap` (`:2818`). `null` when
  the origin was never registered here, is not standing, its arrival generation is outlived, the file
  is under no hold, or a write is in flight. The only caller-controlled operand is the origin object,
  read by identity (`WeakMap.get`, `===`); no property of it is read.
- **`acknowledgeWriteUncertainty(acknowledgement): UncertaintyAcknowledgementOutcome`** (`:1547`,
  `:4748`) refuses, in this order and spending nothing: `unknown`, `spent`, `workspaceReplaced`,
  `writeInFlight`, `superseded`, `projectionReplaced`, `holdMoved` (`:1033`); otherwise it marks the
  object spent and deletes the file from `uncertainWrites` in two adjacent statements over this
  state's own tables. It installs nothing, mints no consent, re-observes nothing and issues no
  command; the projection is asserted to be the very object it was and the standing origin the one
  that stood.
- **The uncertainty generation** (`uncertaintyGenerations`, `:2810`) is bumped by the lease's
  `close()` on every `uncertain` settlement (`:3621`), whether or not the file was already held, so an
  acknowledgement minted under one hold cannot spend a hold a later uncertain write re-established.
  Monotonic, never decremented, not cleared by `open()` — the open generation is what refuses a
  pre-open acknowledgement.
- **The operand is `ConflictSource`, either origin.** The consult said "standing observed source";
  the binding record's entry 14 says "standing source". This phase took the wider reading because
  the hold is per file: a file under the hold whose standing origin is a save refusal — a
  `raisedWithoutReload` never reached it, or a same-revision reading coalesced into the refusal —
  would otherwise have no third exit at all, and a refused save's `disk_text` is a disk snapshot too.
  The *save origin* case pins it. The narrowing is one type change if the review rules otherwise.

### 1.4 The per-file automatic-reload guard state (entry 15)

**`automaticReloadGuardFor(document): AutomaticReloadGuardInputs`** (`:1573`, `:4797`) answers
1a's three inputs from the tables, in one synchronous block, frozen: `uncertaintyUnresolved` from
`uncertainWrites`, `observationRetained` from the barrier, `surfaceOpen` from the registry through
`targetingSurfaceFor` with the file's creator eligibility — the coordinator's own question, now
shared: `creatorEligibilityFor` (`:3159`) was extracted from the host literal so both callers ask
one function. It is a value, not a decision and not a request; the guarded reread request that
consults it is 2d-6-1c's, and nothing named `requestFileReread` was added. The *guard state per
file* case registers two surfaces over one file under a hold, closes one, closes both, and shows
the hold refusing through `decideAutomaticReload` with no surface registered at all; only the
acknowledgement permits.

### 1.5 One thing the record did not commission: a seventh verdict arm

`ObservationVerdict` (`conflictSource.ts:554`) gained **`writtenHere`**, with a third envelope
constructor `writtenHereDelivery` (`observationDelivery.ts:173`), `ArbitrationOutcome` excluding it
beside `retained` (`conflictSource.ts:610`), and `isReplacingVerdict` answering `false` for it. It
was found necessary while wiring the settlement: a session told `retained` records a
pending-reconciliation restriction (entry 11's last row) that blocks submission (entry 8), and the
one settlement outcome that consumes a held observation *without* a verdict — `releaseBarrier`'s
`writtenHere`, a reading of exactly the bytes the write ended on — would have left that restriction
in place with nothing ever announcing the wait over. None of the six arms fits: `notLater` and
`coalesced` each carry a standing origin, and here nothing need stand. The arm's doc names the
session action entry 11 owes it — lift the restriction recorded for this observation, change nothing
else — and 2d-6-2's transition owes that action. It carries the `BarrierRelease` arm's own caveat:
revision equality proves identical bytes and never authorship. The Rust side's self-write
suppression makes the path rare, not absent.

**Also `ArbitratedDelivery`** (`observationDelivery.ts:100`): an intersection narrowing the
envelope's verdict to `ArbitrationOutcome`, so `arbitrateHere` switches over the five arbitrated arms
with a `never` terminus instead of throwing on two the type could exclude.

## 2. Entry 41 corrections made in this diff

| File | Sentence falsified | Correction |
|---|---|---|
| `workspace.svelte.ts`, `uncertainWrites` declaration | "What clears it is a later write … and `open()`. **Nothing else does**" | three exits, the acknowledgement named as the third (§5.5) |
| `workspace.svelte.ts`, `writeOutcomeUncertain` doc | "a later write of this window's own that *ended* does, and so does `open()`" | three things end it, the last establishing nothing about the earlier write |
| `workspace.svelte.ts`, `beginWrite` doc | "until a later write … ends on a named revision or `open()` replaces the workspace" | the acknowledgement added; and a paragraph saying what `close` now delivers |
| `workspace.svelte.ts`, `arbitrateHere` doc | "**If no write is ever made for that file again, it stays held** — `open()` is the only other thing that clears the table" | three releases, the retry named (§5.6); and that it decides and registers but does not deliver, with the one caller that does |
| `workspace.svelte.ts`, `retainedObservationFor` doc | (no release named) | three releases named |
| `workspace.svelte.ts`, `observeExternalChange` doc | "The door the coordinator's write-surface transition will call … It registers, and it installs nothing" | the arbitration/delivery member, delivering to registered receivers of which production has none, with the wiring step named |
| `conflictSource.ts`, `ObservationVerdict.retained` | "**What releases a held observation today is a later settlement … or `open()`** … The 2d-6 record's §5.6 binds a third release … until that lands there is none, and this comment is corrected when it does" | three releases, the retry's one-attempt-per-press contract; the header says every arm is delivered |
| `conflictSource.ts`, `ObservationVerdict` header | "Only `BrowserState.observeExternalChange` … answers the `retained` arm" | `BrowserState` answers `retained` and `writtenHere` |
| `conflictSource.ts`, `ArbitrationOutcome` | "`retained` is the one arm this excludes" | two arms |
| `observationDelivery.ts`, module header | "nothing in production imports this module yet"; "Two constructors and no third"; "the state that feeds it is 2d-6-1b's" | `workspace.svelte.ts` is the one importer; three constructors; `automaticReloadGuardFor` answers the inputs |
| `observationDelivery.ts`, `arbitratedDelivery`, `retainedDelivery`, `AutomaticReloadGuardInputs`, `ExternalConflictNotice`, `ExternalConflictAction` docs | "(2d-6-1b's member)", "(once 2d-6-1b lands it)", "is 2d-6-1b's", "a `BrowserState` member 2d-6-1b adds" | present tense, naming the member and that no component calls it |
| `saveOutcome.ts`, `ExternalConflictModel` header | "it registers the origin and delivers nothing yet" | delivers to registered receivers, of which production has none; 2d-6-2 and 2d-6-6 named for the two halves |
| `i18n/index.ts`, `tExternalConflictNotice` and `tExternalConflictAction` docs | "the uncertainty acknowledgement is 2d-6-1b's member"; "a control 2d-6-1b's member will stand behind" | the member exists and no component calls it; 2d-6-9 draws the control |
| `conflictSource.ts`, module header | "`observeExternalChange` drives `arbitrateObservation`" | through `arbitratedDelivery` since this phase (a precision, not a falsification) |

**Left alone, deliberately.** `saveOutcome.ts` / `index.ts`'s "Nine codes" sentence (1a §5 item 2):
this diff touched `saveOutcome.ts` for one doc paragraph and did not change either module's code
list, so entry 41's permission was not exercised. "Today every registered transition is a no-op" in
`observationTransitions.ts` and the matching sentences in `writeSurfaceRegistry.ts` are still true —
no production transition changed — and are 2d-6-2's / 2d-6-6's. `docs/decisions/2d-5-5b-notes.md`
items 4, 13 and 14 are a record and were not edited.

## 3. Counts, measured

**Vitest: 2520 → 2549 passed, 64 → 64 files.** The before figure from the JSON reporter on the
untouched tree (`/tmp/2d-6-1b-vitest-before.json`), the after figures from the text summary and a
per-file `it(` count of the one file that moved, re-derived per file:

| File | Δ | How |
|---|---|---|
| `src/lib/browser/workspace.test.ts` | +29 | the nested suite *the observation protocol — Phase 2d-6-1b* (245 → 274): 7 delivery cases, 6 retry cases, 8 acknowledgement cases, 2 guard-state cases at the first landing (+23), then the six re-derivation cases of §7 (+6) |
| `src/lib/browser/observationDelivery.test.ts` | 0 | three cases rewritten for the seventh arm and third constructor (14 → 14) |
| `scripts/lint/ipc-detail.test.ts` | 0 | no new `.ts` or `.svelte` file under `src/` (141 → 141) |
| **Total** | **+29** | ✓ (2543 at the first landing, 2549 after the review) |

**Vite: 192 → 192 modules** (with the instrument in the tree; 191 normalized). No new module: every
change is inside modules the entry already reached, and `observationDelivery.ts` was already
reachable through `codes.ts`. The bundle oracle read both lines: `rg -l` over the server-only pattern
lists no file, and the client-only pattern is present (2).

**svelte-check: 447 → 447 files, 0 errors, 0 warnings.** No file was added.

## 4. Verification

Run from the repository root on the final tree, each gate on its own, each exit read directly:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | `/tmp/2d-6-1b-check.txt` — 447 files, 0 errors, 0 warnings |
| `npm test` | 0 | `/tmp/2d-6-1b-vitest.txt` — 2549 passed, 64 files (2543 before the review's six cases) |
| `npm run build` | 0 | `/tmp/2d-6-1b-build.txt` — 192 modules transformed; server-only markers absent, client-only present (2) |
| Cargo | not run | `git status --short --untracked-files=all` shows no path under `src-tauri/` or `crates/` beyond the instrument's `main.rs` hook and `probe.rs`; no Rust gate could have moved |

Only `git status`, `git diff` and `git diff --stat` were run. The four instrument paths are
untouched (`git diff --stat -- src-tauri/src/main.rs src/main.ts` reads `5 insertions(+), 1
deletion(-)`); `PROGRESS.json` was already modified when the phase began and was not touched.

## 5. Open items noticed and left, deliberately

1. **The `ReconciliationWorkspace` interface does not carry the delivery member** (§1.1, last
   bullet). If the orchestrator reads the record's "narrow `ReconciliationWorkspace` member" as an
   interface member, 2d-6-1c or 2d-6-6 adds `deliverExternalChange` to `observationTransitions.ts`'s
   interface and the host literal forwards it to `observeExternalChange`; the fakes in
   `observationTransitions.test.ts` and `reconciliationCoordinator.test.ts` then each need one line.
2. **A `writtenHere` envelope needs its session action in 2d-6-2** (§1.5): lift the
   pending-reconciliation restriction recorded for that observation and change nothing else. The
   record's entry 11 table has six rows; this is the seventh, and the model transitions 2d-6-2 writes
   should switch with a `never` terminus so the arm cannot be skipped silently.
3. **An acknowledgement is bound to the reviewed origin's arrival generation, so a hold whose only
   standing origin arrived before a later projection replacement cannot be acknowledged** — nor can
   that origin be reloaded (`adoptDiskVersion` refuses it by the same comparison). Concretely: after
   a second `mayHaveWritten` answer, the wrapper's own re-read moves the generation and the standing
   origin is outlived; the file then needs a fresh observation, a later ended write or `open()`. This
   is the consult's item 3 read literally ("the evidence's projection generation is no longer valid")
   and the acceptance's "at a moved generation"; whether a snapshot the window already *holds* should
   count as current evidence, as `adoptDiskVersion`'s `alreadyThere` does, is a question for 2d-6-9,
   which draws the control.
4. **A receiver fault is reported with the command-failure prefix.** `report` takes an `IpcFailure`
   and `reportIpcFailure` prints `[espansoConfig] a command failed`; a session that throws inside a
   receiver is not a command. A second developer channel, or a prefix parameter, is one deliberate
   change to `../ipc/errors` — not this phase's.
5. **`retryRetainedObservation` and `acknowledgeWriteUncertainty` are model members with no
   control**; 2d-6-9 draws both, and the record's §6 item 4 leaves which refusal reasons carry a
   sentence to that step. No i18n key was added here: every refusal is a decision, not a sentence.
6. **No mounted case exists for the settlement-before-continuation order on the session side**
   (entry 5) — the *settlement verdict delivered* case pins the window's half only. 2d-6-6's.
7. **`classifyFailure`'s doc in `src/lib/ipc/errors.ts` says it "never throws"**, and it does for
   a thrown object whose `code` getter throws (`isCommandError` reads `record.code` unguarded). The
   review's blocker was re-derived on exactly that value (§7). The sentence was false before this
   phase and this diff does not touch that module; `handOut` contains the throw at its own boundary
   instead. Correcting the function — or its sentence — is one deliberate edit to `errors.ts` and
   its test, for whichever step next changes it.
8. **A hostile `sequence` getter can defeat its own retention** on the retry's restore path (§1.2,
   §7 finding 3): a throw inside `newestObservationOf`'s comparison against a reading held meanwhile
   leaves that reading in the slot and the retried one lost. Stated in the code; not closed, because
   closing it needs a `sequence` read inside a `catch` that must not throw.
9. **A receiver that manufactures a fresh observation on every delivery loops** through the queue
   as it would through any door (§7 finding 2's bound is repetition, not invention). Stated in the
   code and pinned only in its negative form (the two terminating receivers).

## 6. Where it is thin — what the type system cannot force, and which test carries it

| Fact the code relies on | Why a type cannot force it | The test that carries it |
|---|---|---|
| No arbitration, retry or acknowledgement reaches a command | a signature cannot prove the absence of a hidden call (entry 18) | every case in the new suite asserts the hoisted `invoke` spy at zero, and the file's `afterEach` re-asserts it; *no command from a retry* and *acknowledged once* also hold the injected surface's stubs to their counts |
| Two sessions over one file receive one decision | a receiver is `(delivery) => void`; nothing stops two arbitrations | *one decision to every receiver* (`toBe` on the envelope object) |
| A settlement is delivered rather than discarded | `close()` returns `void` either way | *settlement verdict delivered*, *writtenHere is announced*, *unavailable in flight* |
| Publication moves no watermark and admits no sequence | `deliver` cannot reach the coordinator, but nothing says a future edit will not | *watermark unmoved* (`expectDrains([0, 0, 11])`) |
| A receiver's throw does not become the write's answer | `finally` semantics are not in a type | *receiver exception isolated* (`outcomeOf(answer)?.outcome === 'saved'`, two reports); *reporter throws* and *unclassifiable throw* for the second boundary (§7) |
| Every receiver sees decisions in the order they were made, and a re-publishing receiver comes to rest | nothing types a delivery order or a fixed point | *decision order across re-entrancy*, *re-publication terminates* (§7) |
| A retry whose arbitration throws keeps its record, without overwriting a re-entrant retention | a `catch` is not a type | *record survives a throwing arbitration*, *re-entrant retention is not overwritten* (§7) |
| The unregister is instance-bound and one-shot | a `() => void` says nothing | *instance-bound unregister*, *recipients fixed at the start* |
| The retry uses the original arrival generation | a `number` is a `number` | *original arrival generation* and its negative control |
| One press is one arbitration, re-entrancy bounded | nothing in TypeScript counts calls | *one attempt per press* (getter read count 2, inner press `nothingRetained`), *held and askable again* (three presses, reads 1 + press) |
| The retry is unavailable in flight | the barrier is a private count | *unavailable in flight* |
| The acknowledgement binds to open generation, standing origin, projection generation and hold generation | the object is empty; the binding is a private `WeakMap` | *refused after supersession*, *refused at a moved generation* (both generations), *hold re-established*, *refused in flight*, *mints nothing* (hand-built literal → `unknown`) |
| Spending is one-shot and installs nothing | `WeakSet` membership is not a type | *acknowledged once* (`spent` on the second call, projection identity unchanged, standing unchanged) |
| The guard's `surfaceOpen` is answered from the registry, never a panel | three booleans are three booleans | *guard state per file*, *retained and creator facts* (through `registerWriteSurface` leases, including an unknown-target creator over an eligible file and not the profile) |
| The settlement lands before the wrapper's continuation | microtask order is not a type | *settlement verdict delivered* (`order` array); the session-side half is 2d-6-6's mounted test |
| The origin passed to `uncertaintyAcknowledgementFor` is the one the person looked at | any registered standing `ConflictSource` type-checks | nothing — a mounted test in 2d-6-9 is what can show the control mints against the panel's own `model.source` |
| A receiver registered in production acts on the arm it is given | `void` return, no protocol | nothing — 2d-6-2's model suites and 2d-6-6's mounted suites |

## 7. Review

**Codex adversarial review, ship-with-fixes: 1 BLOCKER, 2 SHOULD-FIX**
([`docs/reviews/phase-2d-6-1b.md`](../reviews/phase-2d-6-1b.md)), all three in
`src/lib/browser/workspace.svelte.ts`. Each was re-derived against the pre-fix tree by writing the
failing case first and reading its failure; all three held. The reviewer records that it checked and
did **not** uphold acknowledgement double-spending, cross-file hold spending, sequence readmission,
arrival-generation renewal or unregister interference; those paths were left alone.

1. **[BLOCKER] `deliver` — a receiver's fault could still escape the settlement path.** Held, both
   halves. The `catch` around a receiver called `report(classifyFailure(raw))` unguarded: an injected
   reporter that throws escapes it, and so does `classifyFailure` itself when the thrown value has a
   throwing `code` getter (`isCommandError` reads `record.code`). On the settlement path that throw
   leaves the lease's `close()` through the wrapper's `finally`, and the committed save comes back as
   a rejection. Pre-fix, *reporter throws* failed with `Error: the reporter is broken too` thrown out
   of `observeExternalChange` and the `afterEach` reported the write lease still open; *unclassifiable
   throw* failed with `Error: the thrown value is hostile` the same way. **Fix:** delivery is split
   into `deliver` (the queue, §7.2) and `handOut`, whose per-receiver `catch` wraps the reporting in
   a second `catch` that drops what the first could not report — the one place this state drops an
   error, with the reason stated where it happens. **Pinned by** *keeps a committed answer when the
   reporter itself throws on a receiver's fault* and *keeps a committed answer when the thrown value
   refuses to be classified*: both drive a committing raw save held open, deliver `retained` and the
   settlement through a broken receiver, and assert `outcomeOf(answer)?.outcome === 'saved'`, the
   sibling told both envelopes, the window at `rev-d`, and (first case) the reporter reached exactly
   twice.

2. **[SHOULD-FIX] `deliver` — a re-entrant publication reached siblings out of order.** Held.
   Receiver A publishing a newer observation from inside its handling of an older one made the nested
   delivery complete before the outer loop reached B, so B was handed `supersedes` before `raised`.
   Pre-fix, *decision order across re-entrancy* failed with `expected [ 'supersedes', 'raised' ] to
   deeply equal [ 'raised', 'supersedes' ]`, and *re-publication terminates* — a receiver forwarding
   every envelope's observation back through the door — ran to `expected [ 'raised', 'notLater',
   …(1499) ]`, i.e. until the stack overflowed inside the per-receiver `catch`. **Fix:** `deliver`
   is a synchronous drain — no `await`, no microtask. The outermost call sets `delivering`, hands out
   its envelope, then every envelope queued by receivers during the drain, in decision order; a
   nested call enqueues and returns its already-decided envelope to its caller. One drain hands out
   each (observation, verdict kind) pair once: a repeat goes to its caller and to nobody, because
   within one synchronous block a second verdict of the same kind about the same object tells a
   recipient nothing the first did not. That is the bound the coordinator asked for, and it is stated
   as a bound on repetition, not invention — a receiver manufacturing a fresh observation on every
   delivery loops through this door as it would through the coordinator (§5 item 9). The three
   pieces of drain state are reset in a `finally`. **Pinned by** *delivers decisions to every
   receiver in the order they were made, across a re-entrant publication* (A and B both see
   `['raised', 'supersedes']`) and *terminates when a receiver re-publishes what it receives, and
   when it publishes one newer reading on every delivery* (`['raised', 'notLater']` for the
   forwarder; `['coalesced', 'supersedes', 'notLater']` for the pusher, the fourth publication being
   the repeated `(newer, notLater)` pair that goes nowhere).

3. **[SHOULD-FIX] `retryRetainedObservation` — a throwing arbitration lost the record.** Held. The
   record leaves the barrier before the arbitration reads the caller's observation (delete-first,
   which is what bounds re-entrancy), and a `diskRevision` getter that throws on that read left
   nothing held, nothing standing and nothing to ask again — against entry 16's *retained and
   askable again*. Pre-fix, *record survives a throwing arbitration* failed at
   `retainedObservationFor(2) === outer` (printed as the getter's own error, because vitest formats
   the expected object on a failing `toBe`; the cases now compare identity through a boolean for
   that reason). **Fix:** the `arbitrateAndDeliver` call is wrapped; on a throw the original record
   object is put back **only into an empty slot** — `has` then `set` on a `Map` keyed by a number,
   with nothing between them and no user code — and the throw is rethrown. A re-entrant arrival the
   throwing read retained meanwhile therefore stays, whatever its sequence: re-applying the barrier's
   newest-wins rule would need a `sequence` read of the caller's object inside a `catch` that must
   not throw. A completed arbitration never reaches the `catch`, so no consumed record is reinstated.
   The one edge left open is named in the code and in §5 item 8. **Pinned by** *keeps the record when
   the retry's arbitration throws before deciding* (two throwing presses keep the record at its
   arrival, a third non-throwing press decides `supersedes` and delivers once) and *does not
   overwrite a record a re-entrant retention made while the retry's arbitration was throwing* (the
   getter opens a write, observes a newer reading — retained — and throws; the newer reading stays
   held, a press answers `writeInFlight`, and the settlement registers it).

After the fixes: `npm run check` exit 0 (447 files, 0 errors, 0 warnings); `npm test` exit 0
(2549 passed, 64 files: +6 in `workspace.test.ts`, 268 → 274); `npm run build` exit 0 (192 modules,
server-only markers absent, client-only present (2)). No `.svelte`, no Rust, no new module; the
instrument paths are untouched.
