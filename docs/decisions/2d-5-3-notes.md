# Phase 2d-5-3 — the drain lifecycle coordinator

**Status: complete, with one adversarial review round taken and answered.** Risk class: medium.
Components: **none** — no `.svelte` file was modified.

**§8 is the review round and is the first thing to read after this line.** It found two
correctness defects in `src/lib/browser/reconciliationCoordinator.ts` that every gate above passed
over — a request stranded in the pump's single-flight release window, and an epoch adopted from a
drain taken between an `open()`'s entry and its `ready`. Both are fixed, both are pinned by tests
that were run against the unfixed code, and **every sentence elsewhere in this file that those
fixes made false has been corrected in place with a pointer to §8**.

This is step 3 of the seven-step split in
[`docs/decisions/2d-5-split-notes.md`](2d-5-split-notes.md) §2, ruled by
[`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md) Q2, Q3 and Q4. It
delivers `start()` and `dispose()`, the single-flight drain pump, all four triggers, the
session `{ epoch, watermark, lastDiscarded }` cursor, registration-race handling,
current-open-generation capture and injected foreground/resume events. **The production event
source stays unreachable.**

---

## 1. What was built, and where

| File | What it is |
|---|---|
| `src/lib/browser/reconciliationCoordinator.ts` | **new** — the coordinator as a value: plain TypeScript, no Svelte runes |
| `src/lib/browser/reconciliationCoordinator.test.ts` | **new** — **40** model cases driving the coordinator directly over fakes (32 at first delivery, 8 added by §8's round) |
| `src/lib/browser/workspace.svelte.ts` | modified — `BrowserState.start()` / `.dispose()`, two new `createBrowserState` parameters, two `open()` hooks, one type-only import; §8 added comments to `open()` and changed no statement in it |
| `src/lib/browser/workspace.test.ts` | modified — the drain budget replaces the blanket zero, plus 9 workspace cases |

Nothing else changed. No Rust file, no `.svelte` file, no configuration file, no dictionary.

### 1.1 The module-placement decision, and its precedent

`2d-5-split-notes.md` §6 item 2 is explicit that **the consult does not say where the
coordinator lives**, and leaves it to the steps: "Whether the registry, the pump and the
observation transitions go into `src/lib/browser/workspace.svelte.ts` … or a new module beside
it is left to the steps. Both satisfy every ruling."

**This step puts the pump in a module of its own, following 2d-5-2a's precedent** — that step
made the same call for the write-surface registry and recorded the same two reasons in
`writeSurfaceRegistry.ts`'s own header:

1. `workspace.svelte.ts` was **3 945 lines** when this step began, and 2d-5-4 and 2d-5-5 each
   add more coordinator machinery to it.
2. A module with **no runes in it** is drivable by a model test with no component mounted.
   That is what let this step's whole evidence budget go on trigger orders and overlaps: a
   wake during a drain, an `open()` during a drain and a disposal during a registration are
   three statements each in `reconciliationCoordinator.test.ts`, and would each be a mounted
   component and a flush in `workspace.test.ts`.

It is the **orchestrator's decision for this step**, taken under §6 item 2's grant, and not a
ruling of the consult. A later step is not bound by it; what it is bound by is §6 item 2 itself,
which is still open for 2d-5-4's and 2d-5-5's own additions.

### 1.2 What is reactive, and what is not

**Nothing in the coordinator is reactive**, exactly as nothing in `writeSurfaceRegistry.ts` is.
A coordinator reads its own state immediately before it decides something, which is how the
generation counters in `workspace.svelte.ts` are already read. When 2d-6 draws the *not watched*
state, the mirror belongs on `BrowserState` beside `openWriteSurfaces()`'s — that is 2d-5-2b's
shipped shape and this step deliberately does not anticipate it.

---

## 2. Which ruling each piece discharges

Rulings are `2d-5-split-notes.md` §3.

| Ruling | Where it is discharged |
|---|---|
| **6** — two sequence states, deliberately | `ReconciliationCursor` is exactly `{ epoch, watermark, lastDiscarded }` and holds **no** per-document map. Its doc comment says the map is 2d-5-4's and does not exist yet, rather than shipping an empty one that would look like the second state |
| **7** — the watermark advances for an empty batch | `accept()` assigns `watermark = batch.newest_sequence` unconditionally. Case *"advances the watermark for an empty batch"* |
| **8** — the epoch is learned from the first **post-open** drain | `accept()`'s `if (!adopted)` arm is the **only** assignment to `epoch` other than `workspaceOpened()`'s clear. `open()` supplies none. A wake before adoption may request a drain and establishes nothing — case *"lets a wake before any epoch ask, without letting it establish one"*. **The *post-open* half was missing until §8's round**: any drain at the current generation was accepted, including one taken between `open()`'s entry and its `ready`, when Rust still holds the workspace being replaced. The open gate is what makes the discharged sentence the ruling's own — cases *"issues no drain between an open and its ready, and adopts no epoch there"* and *"records a wake between an open and its ready without draining for it"* |
| **9** — `epoch: 0` is not stale | `watchState()` answers the typed `notWatched` arm; the cursor keeps `0`/`0`. Case *"keeps epoch zero as 'watched by nothing' rather than as stale"* |
| **13** — `lastDiscarded` is cumulative and monotonic | `accept()` moves it only on a **strictly greater** value and counts the strict increases in `discardedNotices()`. The watermark still advances in the same block. Case *"does not act twice on a repeated discarded value, and does on a larger one"* |
| **14** — one idempotent `requestDrain` behind a single-flight pump | `requestDrain` sets one boolean; `ensurePumping` starts at most one pump. Cases *"turns ten duplicate wakes before a drain into exactly one call"* and *"turns ten wakes during a drain into at most one follow-up"*. **"At most one follow-up" was true and "never dropped" was not until §8's round**: the slot's release now re-enters the pump when a request is outstanding — case *"does not strand a request made while the pump gives its slot back"*, with *"does not restart the pump when the release window holds no request"* as the no-spin half |
| **15** — single-flight removes drain-versus-drain reordering and nothing else | `runOneDrain` takes the open generation, the expected epoch, the disposal state **and, since §8's round, the open gate** before the await and rechecks all **four** after. Cases *"installs nothing from a drain an open overtook"*, *"installs nothing from a drain that returns after disposal"* and *"installs nothing from a drain an open began under"* |
| **16** — disposal owns the registration race | `dispose()` nulls the held unlisten in the statement before it calls it, and removes foreground listeners synchronously; `register()`'s continuation sees `disposed` and calls the unlisten it received. Cases *"calls a held unlisten exactly once, however often dispose is called"*, *"calls the unlisten exactly once when disposal beats the registration"* and *"removes the foreground listener synchronously"* |
| **35** — the blanket zero-drain assertion is **replaced, not deleted** | `workspace.test.ts`'s `afterEach` now asserts a **declared budget** (default zero) and that every scripted answer was consumed. §5 below |

### 2.1 The four triggers

All four are wired, and each has a named case in both suites where the wiring reaches:

1. **Registration first.** `start()` fires `register()`; when `subscribe` resolves, the unlisten
   is retained and `requestDrain('registration')` runs.
2. **Every successful current `open()`.** `open()` calls `reconciliation.workspaceOpened()` at
   entry — before its first await — and `reconciliation.workspaceReady()` after
   `status = 'ready'`. Every early return in `open()` (a superseded generation, a refused
   `open_workspace`, a refused `list_documents`) leaves the second unreached, so a drain is
   requested only for the load that really finished. **That wiring is pinned by two executing
   cases and not by reading this paragraph** — `src/lib/browser/workspace.test.ts:7566` for the
   successful open, where deleting either call changes the assertion, and
   `src/lib/browser/workspace.test.ts:7591` for the refused `open_workspace`; §7 item 10 has the
   mutations and names the two arms that are still unasserted. **Since §8's round the two calls are also a
   gate, not only two clears and a trigger**: `workspaceOpened()` closes it and only
   `workspaceReady()` opens it, so between them a trigger is *recorded* and no physical drain is
   issued. That is why the failure and supersede returns above matter twice — they leave the gate
   closed, deliberately, and §8.3 is the argument that this is the wanted answer rather than a
   coordinator waiting for a `ready` that never comes.
3. **Foreground and resume**, through the injected `ForegroundSource`.
4. **A wake, only at the current epoch.** `onWake` compares `wake.workspace_epoch` against the
   adopted epoch and requests nothing on a mismatch; before adoption it requests and
   establishes nothing.

**Either order works, and one physical drain can satisfy both.** A request made before
`start()` is *recorded* rather than dropped, and `start()` flushes it — without that, the
open-then-registration order would produce no drain at all for the open. The pump yields once
before its first call, so two triggers arriving in the same microtask batch coalesce; the case
*"lets one physical drain satisfy both when neither has started"* asserts a single record
carrying `['workspaceOpened', 'registration']`.

**"Recorded rather than dropped" now has three cases, not one, and §8 is where the other two came
from.** A reason is recorded and no call is made when the lifecycle has not started, when an
`open()` has not reported `ready`, and when a pump is already in flight — and the pump's release
is what guarantees the third of those is a delay rather than a loss. `requestDrain`'s own doc
comment lists all three, because before §8's round it said *"a boolean is set, and the pump does
the rest"*, which is exactly the sentence the first defect falsified.

---

## 3. What this step deliberately does **not** do

Each with the step that owns it. **All three are stated in the module's own header too**, so a
reader of the code meets them without this file.

1. **It applies no observation.** `Added`, `Removed` and `Unreadable`, the per-document
   `acceptedSequenceByDocument` map, the guarded reread and `applyExternalObservation` are
   **2d-5-4's**. A drained batch's observations are counted by `observationsDropped()` and
   otherwise dropped. The counter exists so that 2d-5-4 replacing the drop with a transition is
   a change to something a test already reads.
2. **It performs no `discarded` recovery.** No re-run of `open()` with the retained original
   request, no blocked-reconciliation policy, no synthetic conflict — rulings 10, 11 and 12 are
   **2d-5-4's**. What this step ships of ruling 13 is the accounting: the value, its
   monotonicity, and the fact that the watermark advances anyway.
3. **It draws nothing and adds no dictionary key.** `2d-5-split-notes.md` §6 item 6 says the
   EN/ES entries and the `src/lib/i18n/codes.ts` accessor for the *not watched* state are owed
   by **whichever step first names it to a person**, and 2d-6 draws it. This step names the
   state *in a type* and puts nothing on a screen, so **no i18n key was added** — deliberately,
   and this sentence is the record of that choice.
4. **It does not do 2d-5-6's work.** No hoisted `@tauri-apps/api/core` spy, no file-wide
   `invoked` assertion, and `DetailPane.test.ts` and `RestorePane.test.ts` are untouched.
   Ruling 35's *uniform* treatment across the three files stays 2d-5-6's; what this step did to
   `workspace.test.ts` is the one thing that file's own comment said this phase would do.

### 3.1 The coordinator is unreachable in the shipped window, and that is what makes 3.1's drop safe

Three independent facts, each checkable:

- **No production caller invokes `start()`.** `AppShell.svelte` was not modified;
  `2d-5-split-notes.md` §5.2 assigns the `AppShell` lifetime change to 2d-5-7.
- **No production module imports `src/lib/ipc/events.ts` as a value.** Both new references to
  it are `import type`, which is erased. `rg -n 'REAL_RECONCILIATION_EVENTS' src/ --glob
  '!*.test.ts'` matches **only that file**, three times, all inside it — the comments in the two
  files that describe the reservation name the adapter by description rather than by identifier
  precisely so that search stays an oracle rather than a convention.
- **Both injected sources default to inert ones.** `INERT_RECONCILIATION_EVENTS` **rejects**
  rather than resolving with a no-op unlisten, because resolving would report a subscription
  this application does not have — which is `src/lib/ipc/events.ts`'s own stated rule.
  `INERT_FOREGROUND_EVENTS` succeeds and never signals, which is truthful: it really does
  register a handler on a source with no window behind it.

So a shipped window registers nothing, drains nothing and derives nothing from a batch. **That
is why dropping observations at this step is safe**: nothing on any screen is computed from
anything this module holds, and the first thing that will be is 2d-5-4's own transition.

---

## 4. Where TypeScript cannot force what the code intends

Stated here and in the same sentences in the source, per the standing rule that a record
claiming a guarantee the code does not give is this project's worst defect class.

1. **Nothing makes a host call `dispose()`.** `BrowserState.dispose()` exists and no production
   caller invokes it; the exact unlisten count is asserted by test, never claimed by type. The
   same sentence `writeSurfaceRegistry.ts` writes about its lease.
2. **Nothing keeps the four captures four.** An edit that read `disposed`, the open generation,
   the expected epoch or the open gate *after* the await instead of before it would compile. Only
   the three overlap cases in `reconciliationCoordinator.test.ts` would notice. (Three until §8's
   round; the gate is the fourth, and it is a **re-observation** rather than a stored value — see
   §8.3.)
3. **The captured epoch and the live epoch cannot differ within one open generation** — the
   pump is the only thing that adopts one and single-flight means there is one pump — **but that
   is an argument about today's callers, not a property any type states.** A second adopter
   added later would break it silently.
4. **A batch reporting `epoch: 0` with a non-zero `newest_sequence` would be believed.** The
   wire contract says such a batch is necessarily empty and this module checks neither the
   emptiness nor the sequence; it stores what the batch reports.
5. **`requestDrain` records a reason before `start()` and nothing forces `start()` ever to
   come.** A state that opens a workspace and is never started holds a pending reason forever,
   which costs nothing and is invisible. **Since §8's round the same is true of the open gate, and
   there it is a decision rather than an accident**: nothing forces a host that called
   `workspaceOpened()` ever to call `workspaceReady()`, and a coordinator whose host never does
   holds every reason and issues no drain. That is the answer this step wants for a failed
   `open()` (§8.3) — and it is also, unavoidably, what a host that simply forgets the second call
   would get. `awaitingWorkspaceReady()` exists so that state is readable rather than guessed at;
   no type demands the pair.
6. **The drain goes through the injected `commands` object**, so `workspace.test.ts`'s counter
   sees it — but `workspace.svelte.ts` still binds its command wrappers at module level, and a
   future call made through one of those bindings would increment nothing. **That route is
   2d-5-6's to close, for all three suites**, and this step neither closes nor widens it.
7. **`INERT_RECONCILIATION_EVENTS` is distinguished by an error message, not by a type.** A
   caller comparing `NO_RECONCILIATION_TRANSPORT` against `registration().error` is comparing
   prose; nothing stops a real transport rejecting with the same message.
8. **`dispose()` calls host-supplied unsubscribes, and a throwing one would stop the rest.**
   What is guaranteed is the part that matters: `disposed = true` is assigned **before** any of
   them runs, so a throw from a broken host still leaves the coordinator disposed and every
   pending or returning drain inert. What is *not* guaranteed is that the remaining
   unsubscribes, or the held unlisten, are reached — nothing in TypeScript makes a host's
   unsubscribe total, and no test in this repository drives a throwing one.

---

## 5. What happened to `workspace.test.ts`'s blanket assertion

The comment at that `afterEach` said, before this phase: *"the phase that starts draining
changes this on purpose instead of discovering it."* This is that change.

**It was extended, not deleted** (ruling 35):

- `drainBudget` defaults to **zero**, so every case written before this phase is held to zero
  exactly as it was. There is no opt-out and no relaxation.
- A reconciliation case calls `expectDrains(n)` and is held to **exactly** `n`.
- `Script.drains` is a **finite** queue of batches; running out falls back to the refusal every
  other case gets, and `afterEach` separately asserts that **every scripted answer was
  consumed**. A case that drains too few times and one that scripts too many answers are
  different defects and are caught separately.
- `drainSequences` records each call's `afterSequence`, so "the watermark the previous answer
  established" is an assertion rather than an inference.
- Every case that starts a coordinator disposes it before it ends.

**What was not done here**: the hoisted `@tauri-apps/api/core` spy, the file-wide `invoked`
assertion, and the same treatment in `DetailPane.test.ts` and `RestorePane.test.ts`. Ruling 35
asks for those across three files and `2d-5-split-notes.md` §2 assigns them to 2d-5-6.

---

## 6. The gates: predicted, then measured

**This section measures the first delivery. §8.6 measures the tree after the review round, and
its figures are the current ones** — `npm test` is **2306**, not the 2298 recorded below. The
table here is left as it was taken rather than overwritten, because it is the evidence for the
`npm run build` arithmetic in the paragraph under it and that arithmetic did not change.

**The baseline is the with-harness one**, because the 2d-5-2c instrument is still in the working
tree: `1320 / 439 / 2255 / 187`. `PROGRESS.md`'s "Two baselines are live at once" section is why
that is the right one to compare against and why it is **not** a production figure.

The prediction was written before any gate ran, from `PROGRESS.md`'s own arithmetic: a new `.ts`
source module is **+1** `npm run build` module and **+1** `npm run check` file; a new `.test.ts`
file is **+1** `npm run check` file; and `scripts/lint/ipc-detail.test.ts` generates one case per
file from `scannableFiles()`, so **both** new files under `src/` move `npm test` without an
author touching that suite.

| Gate | Baseline | Predicted | Measured | Agrees |
|---|---|---|---|---|
| `cargo test --workspace -- --test-threads=1` | 1320 | **1320** (no Rust file touched) | **1320** | yes |
| `npm run check` files | 439 | **441** (+1 module, +1 test file) | **441**, 0 errors, 0 warnings | yes |
| `npm test` | 2255 | **2298** (+2 `ipc-detail` per-file cases, +32 model cases, +9 workspace cases) | **2298**, 60 files | yes |
| `npm run build` modules | 187 | **188** (+1 reachable `.ts`; no `<style>` block, and `events.ts` is imported **type-only** so it stays out) | **188** | yes |

**All four landed on the prediction, and the `npm run build` figure is the one worth being exact
about.** The naive arithmetic would have said **+2** — two new `.ts` files — and it is +1 because
a `.test.ts` file is not in the production graph. It would have said **+2** again if the import
of `../ipc/events` had been a value import, because that file builds its real adapter at module
scope; `import type` is erased, which is why the number moved by one and why the two bundle
oracles were read rather than the number trusted alone.

**Both bundle oracles were read and both lines are reported**, the second because it proves the
search can match at all:

- `rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` → **no match**
  (server-only markers **absent**)
- `rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js` → **2** (client-only
  markers **present**)

The other machine checks: `cargo clippy --workspace --all-targets -- -D warnings` exit 0,
`cargo fmt --check` exit 0, `cargo tree -p espansoconfig-core | rg tauri` finds nothing.

### 6.1 The working tree

The four harness paths — `M src-tauri/src/main.rs`, `M src/main.ts`, `?? src-tauri/src/probe.rs`,
`?? src/probe.ts` — were **not modified, reverted, staged or deleted**. `git diff --stat` over the
two hook files is still `5 insertions(+), 1 deletion(-)`.

---

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round**; §7.1 is the only
mechanism and it reads a diff.

1. **The pump's microtask boundaries are two, they do different things, and only one of them is
   now a bare choice — *recorded only*.** This item said, before §8's round, that the yield was
   *"a correctness choice, not a defect"*, and that was a true sentence about the wrong boundary.
   What is true after the fix:

   - **The yield before the first drain** (`await Promise.resolve()` at the top of `pump()`) is
     still a choice and still load-bearing for exactly one case: it is what makes *"one physical
     drain satisfies both when neither has started"* reachable. Remove it and that case fails and
     nothing else does; the coalescing it buys is otherwise invisible, and no type states it.
   - **The boundary at the *other* end — between the loop exiting and the single-flight slot
     being given back — was a defect**, and §8.2 is it. A request landing in that microtask set
     its boolean, saw an occupied slot, and was stranded with no pump behind it. It is closed:
     `release` clears the slot and re-enters the pump when a request is outstanding, and the pair
     of cases in *"the single-flight release window"* pins both the re-entry and the fact that it
     cannot spin. **The window still exists** — the slot is still released a microtask after the
     pump settles, which is what `isPumping()`'s doc comment now says out loud — what no longer
     exists is a request being lost in it.

2. **`flush()`/`settleDrains()` are fixed at ten microtask turns — *recorded only*.** The
   longest chain any case produces is four hops, so ten is margin rather than a threshold. A
   future case with a longer chain would fail with a wrong count rather than a timeout, which is
   the safe direction, but nothing computes the bound.

3. **`isPumping()`'s callers are all tests, and what it measures is the slot rather than a
   drain — *recorded only*.** It replaced an `idle()` settlement door that was removed
   deliberately: a test that waited on the coordinator would hang rather than fail when a fake
   never answered a drain. The narrower accessor is what survived, and a production caller may
   never appear. **Its doc comment claimed more than it measured until §8's round** — *"`true`
   while the single-flight pump is running"*, when it is `inFlight !== null` and therefore also
   `true` for the microtask in which the slot is released. The comment now states the boundary
   instead of rounding it off, and it is worth keeping in view that a caller reading `false` is
   reading *no pump and none being released*, which is the stronger of the two readings.

4. **The epoch-mismatch arm compares the *captured* epoch, and the argument that it equals the
   live one is about callers — *recorded only*.** §4 item 3. A second adopter of `epoch` added
   in 2d-5-4 or 2d-5-5 would make the two capable of differing, and the comment beside the check
   is the only thing that would say so.

5. **`observationsDropped()` is the only evidence that a batch's observations were seen at
   all — *recorded only*.** It is a count and not a record: a batch of two removals and a batch
   of two additions are indistinguishable through it. 2d-5-4 is where an arm starts to matter,
   and it will replace the counter rather than extend it.

6. **The two `workspace.test.ts` helpers duplicate the two in
   `reconciliationCoordinator.test.ts` — *actionable*, and not a correctness defect in source.**
   `testEvents`/`testForeground` and `controlledEvents`/`controlledForeground` are near-twins;
   they were kept apart because the workspace ones need no deferred registration and no
   rejection, and a shared fixture module would be a third file for two callers. A later step
   adding a third caller should fold them into `./fixtures.ts`. **Both files are test files and
   the duplication is not a defect in either**, so §7.3's blocker clause does not apply.

7. **No window reading was taken and none is owed at this step — *recorded only*.** Nothing is
   drawn, no `.svelte` file changed, and the coordinator cannot run in the shipped window.
   2d-5-7 owns the narrow lifecycle reading, and `2d-5-split-notes.md` §6 item 7 is explicit
   that neither it nor 2d-5-2's may be cited as evidence that a wake was delivered.

8. **A registration failure is reachable only through a rejecting `subscribe`, and the real
   adapter's rejection mode is unevidenced — *recorded only*.** What a Tauri `listen` refused by
   a missing `core:event:allow-listen` actually rejects with is 2d-5-7's to find out; this step
   asserts only that a rejection lands as `failed` and that nothing pretends to be registered.

9. **The open gate is a claim about what the coordinator was *told*, and no type pairs the two
   calls — *recorded only*.** `workspaceOpened()` without an eventual `workspaceReady()` holds
   every drain, for ever, and that is the deliberate answer for a failed open (§8.3) and an
   unavoidable one for a host that forgets. The only enforcement is that `open()` in
   `workspace.svelte.ts` is the single caller of either method, and a second caller added later
   would not be checked by anything. 2d-5-7, which is what first makes this coordinator run in a
   window, is where a wrong pairing would first be observable — and it is observable, through
   `awaitingWorkspaceReady()`.

10. **The wiring *is* pinned by an executing test, and the residual is narrower than this item
    said — *recorded only*, and not a defect in source. Corrected by the 2d-5-3-A round; see
    [`2d-5-3-A-notes.md`](2d-5-3-A-notes.md) §3.4.** As written, this item claimed that nothing
    tested the gate against a real `open()` and that the wiring was something "§2.1 item 2 asserts
    by reading the source". **Both halves were wrong.**
    `src/lib/browser/workspace.test.ts:7566` — *"drains again once a workspace reaches ready"* —
    drives a real `state.open(null)` on a started coordinator and discriminates on **both** calls.
    Measured, by mutating `open()` in `workspace.svelte.ts` and running that case:

    - delete `reconciliation.workspaceReady()` and it fails with
      `expected [ +0 ] to deeply equal [ +0, +0 ]` — the open triggers no second drain at all;
    - delete `reconciliation.workspaceOpened()` and it fails with
      `expected [ +0, 6 ] to deeply equal [ +0, +0 ]` — the second drain asks `6` rather than `0`,
      because the registration's answer set `newest_sequence: 6` and nothing cleared the cursor.

    So the success path is executable coverage, not a reading. **What genuinely remained was the
    *failing* open**, and the same round closed that too:
    `src/lib/browser/workspace.test.ts:7591` — *"drains for no failed open, and holds later triggers
    behind the gate it left closed"* — scripts a refused `open_workspace`, asserts that the open
    adds no drain and that a wake arriving afterwards adds none either. It was proven able to fail
    by putting `workspaceReady()` on that failure arm: `expected [ +0, +0 ] to deeply equal [ +0 ]`.

    **What is left is smaller than either.** No case drives a *superseded* `open()` (two opens
    overlapping, the first returning stale) or a refused `list_documents` across a started
    coordinator; both leave `workspaceReady()` unreached by the same early-return shape the two
    covered arms use, and neither is asserted. And no case runs any of this in a window — 2d-5-7
    owns that, per item 7 above.

11. **`pump()` checks `drainMayStart()` and `runOneDrain()` then calls `host.openGeneration()`
    before `host.drain()` — *recorded only*, and deliberately not restructured. Raised as the one
    Low of the 2d-5-3-A round.** That is the check-and-spend *shape* `CLAUDE.md` names: the
    predicate is evaluated in `pump()`'s loop condition, and the first thing the drain does is call
    a **caller-supplied** function, so a host whose `openGeneration()` accessor re-entered
    `workspaceOpened()` would have closed the gate and still get the drain issued.
    **It is inert as shipped**: the only production accessor is `() => openGeneration` in
    `workspace.svelte.ts`, a plain read of a module-local number that calls nothing. It is recorded
    rather than fixed because rewriting this control flow — re-asking the gate between the
    generation capture and the drain, or capturing the generation before the loop condition —
    changes the ordering of a pump that had two real concurrency blockers fixed one round earlier,
    and the risk of that change is larger than the risk of the shape. A later step that gives
    `ReconciliationHost` an accessor with behaviour behind it is where this stops being inert, and
    it should re-read this item before it does.

---

## 8. The adversarial review round, and what it found

`docs/reviews/phase-2d-5-3.md` is the report. Two High findings and two Lows, all four answered
here. **Both Highs were re-derived independently before being accepted** — neither was taken on the
reviewer's word, and both are real. Neither was reachable in a shipped window at the time, because
nothing calls `start()` until 2d-5-7; both were correctness defects in source on the day they were
written, and 2d-5-7 is the step that would have shipped them.

### 8.1 What the round says about §6's gates

Nothing in §6 caught either defect and nothing in §6 could have. 1320 Rust tests, 441
`svelte-check` files with zero warnings, 2298 frontend tests and a 188-module build were all green
over a coordinator that stranded a drain request at one microtask depth and adopted the wrong
epoch for a whole workspace lifetime. **Both defects are interleavings**, and a count of green
cases is not evidence about an interleaving nobody wrote a case for. That is the same sentence
this project already writes about a mounted test and a window, one level down.

### 8.2 High 1 — the request stranded in the single-flight release window

**What it actually was.** `pump()`'s `while (requested && …)` exits **synchronously** the moment
`requested` is false, but the single-flight slot is only given back by `void running.then(release,
release)` — one microtask later. A `requestDrain` landing between those two points set
`requested = true`, saw `inFlight !== null`, and returned. Its reason stayed on `pendingReasons`
with no pump behind it, and nothing but a later trigger could rescue it. The reviewer measured the
depth: a request made from a two-deep microtask chain gave `calls=1 pending=["foreground"]
pumping=false`, where depths 0, 1 and 3–10 all gave `calls=2`. **Two microtasks deep is where
`open()`'s tail calling `workspaceReady()` lands**, so this was not a hypothetical depth.

**The shape of the fix.** The release path re-checks. `release` now returns early unless it owns
the slot, clears it, and then — if a request is outstanding and the lifecycle permits a drain —
calls `ensurePumping()` again. Three properties were held on to deliberately:

- **It cannot spin.** A restart happens only because a trigger set `requested`, and the pump's
  loop clears `requested` *before* each drain, so every restart consumes exactly the request that
  caused it. The second case in the suite is the no-spin half: a release window with no request
  leaves one call and a free slot.
- **The slot is cleared before the re-entry**, so `ensurePumping` sees a free slot and a throw
  from the restart cannot leave the slot held.
- **`.then(release, release)` stays, and `.finally` is still refused.** A `void`-ed `.finally` on
  a rejection is an unhandled rejection with nothing to report it; a rejection handler that
  returns normally is not. `release` returns normally on both arms — `ensurePumping` calls an
  `async` function, which reports a synchronous throw as a rejected promise rather than by
  throwing — so the fix does not smuggle a second unhandled rejection in.

**The test that pins it.** *"does not strand a request made while the pump gives its slot back"*,
in the new `describe('the single-flight release window')`. It answers the registration drain and
then requests one from a `Promise.resolve().then().then()` chain — the exact depth the reviewer
measured — and asserts a second physical call asking with the watermark the first established.
Its comment names the window rather than the symptom, so a reader knows what would have to change
for it to stop being a regression test. **Run against the unfixed `release`** (the fix reverted,
nothing else): `AssertionError: expected [ +0 ] to deeply equal [ +0, 6 ]`.

### 8.3 High 2 — an epoch adopted from a drain taken before the open reached `ready`

**What it actually was.** `open()` bumps `openGeneration` and calls
`reconciliation.workspaceOpened()` at **entry**, then awaits the whole load before
`workspaceReady()` requests its drain. In that window Rust still holds the **previous** workspace —
`WorkspaceSession::open` discovers, summarises and only then swaps under the session lock, and its
own doc comment says a failure leaves the previously open workspace in place. So a trigger arriving
between entry and `ready` — a foreground signal, or **any** wake, because `workspaceOpened()` had
just cleared `adopted` and `onWake`'s epoch check passes unconditionally while it is false —
started a drain whose captured `openGeneration` was **already current**. Every guard in
`runOneDrain()` therefore passed after the await, and `accept()`'s `if (!adopted)` arm adopted the
**old** lifecycle's epoch and watermark.

`adopted` is never re-cleared except by the next `workspaceOpened()`, so the damage was permanent
for that workspace: the post-`ready` batch came back `staleEpoch` and moved neither sequence state,
every later wake for the real epoch was dropped by `onWake`, and `watchState()` reported
`{ kind: 'watching', epoch }` at an epoch nothing on screen belonged to. Reconciliation was
silently dead, while reporting that it was watching.

**The invariant established.** *No batch may be accepted, and no epoch adopted, from a drain that
was in flight while an `open()` had not yet reached `ready`* — and no trigger arriving in that
window may be lost, because the consult requires registration and open in either order both to be
answered.

**The shape of the fix: a fourth capture, and a gate in front of the pump.**

- `workspaceOpened()` sets `openInProgress = true` beside the four clears it already did.
- `workspaceReady()` sets it back to `false` **before** it requests its drain, so that request is
  the flush rather than one more thing held behind the gate.
- One predicate, `drainMayStart()` = `started && !disposed && !awaitingReady()`, is read by all
  four places that decide to pump: `requestDrain`, `start()`, the pump's own loop condition and
  the single-flight release. **A clause added to it is added to all four by construction**, which
  three copies would not give.
- `requestDrain` still records its reason. A request made while the gate is closed is a delay, not
  a loss, and `pending()` is where a test reads it.
- `runOneDrain()` **rechecks the gate after its await** as well: an `open()` that begins mid-drain
  makes that drain's batch describe the lifecycle on its way out, and the outcome is `staleOpen`.

**Why the check after the await is not the generation check written twice.** The generation is read
through `ReconciliationHost.openGeneration()`; the gate is set by a call on the coordinator's own
interface. Under `workspace.svelte.ts`'s wiring the two move together — the bump is the statement
before the call — but nothing in either type ties them, and the two checks catch different things
in any case: an open that begins *and finishes* during a drain leaves the gate open and the
generation moved, so the generation capture is the one that refuses it. Both are load-bearing.

**Why the fourth capture is a re-observation and not a stored value.** The other three compare a
number or a flag taken before the await with the live one. What the gate asks after the await —
*has an `open()` begun that has not reported `ready`* — is a fact about now; storing the pre-await
answer and comparing would only re-derive the generation capture, and an equality that can never
fail is a claim no test can fail either. That is the same reasoning `runOneDrain()` already writes
about the disposal check it deliberately does **not** duplicate above its await.

**Why the gate is a plain flag and not keyed to the open generation.** Keying it — recording
`host.openGeneration()` in `workspaceOpened()` and gating only while the host still reports that
number — was written first and then rejected. It would let a generation the coordinator was never
told about **open** the gate, which is precisely the hole this gate exists to close, and it bounds
nothing a plain flag does not: every `open()` announces itself on entry, so a gate left closed by a
failed or superseded open is re-armed by the next open and released by that open's `ready`.

**The two sequences the round told us not to lose.**

- **A failed `open()`.** `open_workspace` or `list_documents` refusing leaves `workspaceReady()`
  unreached, and this coordinator has **no third door on purpose**. The gate stays closed, and
  that is the wanted answer rather than a coordinator waiting for a `ready` that never comes: Rust
  keeps the *previous* workspace when an open refuses, while the window has already cleared every
  document and shows a failure, so a drain from there would come back describing a lifecycle
  nothing on screen belongs to and hand it to `accept()` as this session's epoch — High 2 again,
  in the failure shape. **It is not permanently gated**: the next `open()` that reaches `ready`
  opens it, and an `open()` is the only thing that puts a workspace on screen at all, so no shown
  workspace can be left behind a closed gate. The decision is written at both failure arms of
  `open()` as well as here, because that is where a future author would otherwise add the door.
- **A superseded `open()`.** The first open returns at its own generation check without calling
  anything; the second has already closed the gate under its own `workspaceOpened()`, and its
  `ready` opens it. Nothing is left stuck, and the case *"is opened by the ready of the open that
  superseded another"* is the evidence.

**The tests that pin it**, all in the new `describe('the open gate')` — a drain requested between
entry and `ready`, a wake in the same window, a drain an open began *under*, a failed open, a
superseded open, and a coordinator never told about an open at all (which is what keeps the other
three triggers working for every case in the file that opens no workspace). **Run against the
unfixed gate** (`awaitingReady()` forced to `false`, nothing else changed), five of the six fail:

```
× issues no drain between an open and its ready, and adopts no epoch there
    expected [ +0, +0 ] to deeply equal [ +0 ]
× records a wake between an open and its ready without draining for it
    expected [ +0, +0 ] to deeply equal [ +0 ]
× installs nothing from a drain an open began under
    expected 'accepted' to be 'staleOpen'
× stays closed after an open that never reaches ready, and the next ready opens it
    expected [ +0, +0 ] to deeply equal [ +0 ]
× is opened by the ready of the open that superseded another
    expected [ +0, +0 ] to deeply equal [ +0 ]
```

The sixth passes without the gate, and is meant to: it asserts that a coordinator never told about
an open holds nothing.

### 8.4 The two Lows

- **`cursor()` claimed a frozen snapshot and returned a plain literal.** Frozen, rather than the
  sentence relaxed — the sentence is the one a caller relies on, and three numbers are not worth
  weakening it over. `Object.freeze` is on the returned literal and the doc comment now says why.
- **`isPumping()` claimed more than it measured.** It is `inFlight !== null`, which after 8.2's
  fix still includes the microtask in which the slot is being released. Its doc comment now states
  that boundary rather than rounding it off: `false` means *no pump running and none being
  released*, `true` means *a pump is running, or one has just finished and its slot has not been
  given back*. The alternative — making it measure a narrower thing — was rejected because the
  slot is what a caller can act on and the accessor's only callers are tests.

### 8.5 What was swept, and for the shape rather than the words

Per `CLAUDE.md`'s standing rule, the sweep after each fix was for **what the code now says**, not
for the wording of the finding:

- Every place either file said *"three captures"* — the module header, `runOneDrain()`'s doc
  comment, §2's ruling-15 row, §4 item 2, and the `describe` block in the test file that was
  literally named *"the three captures around the await"*.
- Every sentence that described `requestDrain` as *"a boolean is set, and the pump does the
  rest"* — the interface doc comment and §2.1.
- Every sentence that said a drain is requested *"only for a load that really finished"* without
  saying what happens to the triggers in between — §2.1 item 2, and `open()`'s own two comments in
  `workspace.svelte.ts`.
- Ruling 8's row in §2, which claimed the *post-open* half that the code did not have.
- §7 item 1, whose *"a correctness choice, not a defect"* was a true sentence about the yield at
  one end of the pump and a false one about the release at the other.

### 8.6 The gates after the round

Predicted **before** the gates were run, from `PROGRESS.md`'s arithmetic: no new file of any kind,
so `npm run check` files and `npm run build` modules both unmoved; eight new model cases and no
new file under `src/`, so `npm test` **+8**; no Rust file touched, so `cargo test` unmoved.

| Gate | Before | Predicted | Measured | Agrees |
|---|---|---|---|---|
| `cargo test --workspace -- --test-threads=1` | 1320 | **1320** | **1320** | yes |
| `npm run check` files | 441 | **441** | **441**, 0 errors, 0 warnings | yes |
| `npm test` | 2298 | **2306** (+8 model cases, no new file) | **2306**, 60 files | yes |
| `npm run build` modules | 188 | **188** | **188** | yes |

Both bundle oracles were read, and the second is reported because it proves the search can match
at all: `rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` → **no match**;
`rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-*.js` → **2**.
`cargo clippy --workspace --all-targets -- -D warnings` exit 0 and `cargo fmt --check` exit 0, both
unchanged because no Rust file was touched.
`rg -n 'REAL_RECONCILIATION_EVENTS' src/ --glob '!*.test.ts'` still matches only
`src/lib/ipc/events.ts`. The four harness paths were not touched and
`git diff --stat -- src-tauri/src/main.rs src/main.ts` is still `5 insertions(+), 1 deletion(-)`.
No `.svelte` file was modified.

### 8.7 What this round does under `CLAUDE.md` §7

**This fix round changed source** — `src/lib/browser/reconciliationCoordinator.ts`,
`src/lib/browser/reconciliationCoordinator.test.ts` and `src/lib/browser/workspace.svelte.ts` — so
§7.1 commissions a round scoped to it. That is stated here as a fact about the diff and is not a
decision this file makes: §7.1 reads a diff, and the workflow's own cap (§7.4) may bind first. The
change to `workspace.svelte.ts` is comment-only, and §7's *"the unit is the file, not the line"*
means that counts exactly as much as the other two.
