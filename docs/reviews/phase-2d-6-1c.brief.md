# Review brief — Phase 2d-6-1c

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
`src-tauri/` + Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-6-1c.md` (overwrite it).

**Time budget:** 15 minutes.

---

## The phase and its goal

Phase **2d-6-1c** is the third and last of the three sub-phases the orchestrator cut 2d-6-1 into
(`docs/decisions/2d-6-split-notes.md` §2, subsection *"The orchestrator's cut of 2d-6-1"*, third
bullet). It adds **the coordinator and workspace members to `BrowserState`**
(`src/lib/browser/workspace.svelte.ts`) and the coordinator-to-host state-change notification
(`src/lib/browser/reconciliationCoordinator.ts`). **Components: none. No Rust change. No new i18n
key. No new module.** The rulings that bind it are the record's §3 entries **28, 29, 32** (lines
~351-374) and §6 item 11 (line ~712); rulings 34/35 of `docs/decisions/2d-5-split-notes.md` govern
the drain-budget test discipline. The phase's own record is `docs/decisions/2d-6-1c-notes.md`
(§2 its rulings, §3 the whole 2d-6-1 acceptance checked in one place, §5 where it is thin). The
worker claims to have delivered:

1. **The coordinator state-change notification and one `BrowserState` revision signal** (entry 28):
   a new required host member `ReconciliationHost.reconciliationChanged()`
   (`reconciliationCoordinator.ts:415`), called by a private `notifyChanged()` (`:970`) after every
   reader-visible transition **including the asynchronous subscription rejection**; `accept()` has
   deliberately no call of its own (every exit is followed by `record()`). On `BrowserState`,
   `reconciliationRevision()` (`workspace.svelte.ts:2711` / `:6746`) over one `$state` counter —
   no copied booleans — and `reconciliationBlock()` / `membershipReloadWanted()` now read it as a
   dependency. Claimed never to touch selection.
2. **`reconciliationWatchState()` and a sanitized `reconciliationRegistration()`** (entry 28, §6
   item 11): the failure arm crosses as `failed: { reason: 'noTransport' | 'rejected' }` — no
   `Error`, unlisten function, lease or transition object crosses out of the model.
3. **Two guarded reload requests** (entry 29): `requestMembershipReload()` (`:2764` / `:6760`) and
   `requestLostHistoryRecovery()` (`:2786` / `:6767`), both argument-less, both through the private
   `workspaceReloadRefusal(intent)` + `reopenRetained(intent)` (`:3590-3655`) and then the new
   coordinator member `reopenFromRetainedRequest(): boolean` (`reconciliationCoordinator.ts:792` /
   `:2006` — disposal fence, moves the lifecycle, `host.reopenWorkspace(openRequest)`; the request
   never leaves the coordinator). Refusal reasons, in order: `disposed`, `workspaceNotReady`,
   `notBlocked` (lost-history only), `writeInFlight { documents }`, `surfaceOpen { surfaces }`.
   Rulings taken: membership is permitted even when `membershipReloadWanted()` is false; lost-history
   refuses `notBlocked` while the block is `running`. Closing the last surface is claimed to permit
   **without triggering**.
4. **The guarded file reread request** (entry 32): `requestFileReread(document)` (`:2818` /
   `:6775-6811`) through `rereadUnderGuard` with **the same guard asked at request and again at
   installation** — reasons `disposed | workspaceNotReady | notAddressable | blockedByLostHistory |
   uncertaintyUnresolved | observationRetained | surfaceOpen | writeInFlight`; outcome
   `refused { reason, at } | failed | completed`. Consults 1b's `automaticReloadGuardFor` through
   1a's `decideAutomaticReload`; never `rereadDocument`'s `ALWAYS_PERMITTED`.

## Changed files (`git diff --stat`, instrument paths excluded)

```
src/lib/browser/observationDelivery.ts            |  11 +-   (two doc sentences)
src/lib/browser/observationTransitions.ts         |   8 +-   (one doc sentence; the interface is NOT widened)
src/lib/browser/reconciliationCoordinator.test.ts | 302 +++-  (62 → 70 cases)
src/lib/browser/reconciliationCoordinator.ts      | 189 +++-
src/lib/browser/workspace.svelte.ts               | 613 +++-
src/lib/browser/workspace.test.ts                 | 720 ++++  (274 → 287 cases)
docs/decisions/2d-6-1c-notes.md                   | new, 188 lines
```

**Four paths are deliberately dirty and are NOT part of this phase**: `src-tauri/src/main.rs`,
`src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts` — the temporary window-reading instrument
(`CLAUDE.md` §6). `PROGRESS.json` is the orchestrator's in-flight marker. Ignore all five.

## Verification the orchestrator ran on this tree (each alone, exit 0, read directly)

- `npm run check` → exit 0, `447 FILES 0 ERRORS 0 WARNINGS`.
- `npm test` → exit 0, `64 passed (64)` files, `2570 passed (2570)` tests (from 2549).
- `npm run build` → exit 0, `192 modules transformed` (unchanged); server-only markers absent
  (`rg -l '\$\$payload|head_payload|push_element' dist/assets/` exit 1), client-only present (2).
- Rust untouched: no path under `src-tauri/` or `crates/` changed beyond the instrument's hook line.

## Where to attack — the risks, in order

**A green suite is not proof here**; every blocker 2d-5-5b and 2d-6-1b found was of a shape no gate
could catch. Re-derive, do not re-read.

1. **Check-and-spend in the reload requests.** `workspaceReloadRefusal` reads `isDisposed()`,
   `awaitingWorkspaceReady()`, `block()`, `writesInFlight`, `openWriteSurfaces()` and then
   `reopenRetained` spends through `reopenFromRetainedRequest()`. Is anything between the last check
   and the spend a property read that can run caller code (a getter, a `Proxy`, a registry reader
   that iterates caller-owned surfaces)? Can a surface register, or a write lease open, between the
   check and `host.reopenWorkspace()` → `open()`? Does `reopenFromRetainedRequest` recheck disposal
   **itself**, and what does it do to the applying lifecycle / open gate relative to what
   `recoverFromLostHistory` does — do the two paths leave the coordinator in the same state?
2. **Entry 29's "closing the final surface permits without triggering".** Find the release path of
   the last write surface and confirm nothing there calls `open()`, `reopenWorkspace`,
   `reopenFromRetainedRequest` or a drain. Then the converse: does an explicit permitted request
   issue **exactly one** `open()` with **exactly the retained request** (including the `null` case),
   and is that pinned by a test that asserts the argument rather than the call count?
3. **Entry 28's "every transition".** Enumerate the coordinator's mutation sites (registration
   state, `openRequest`, `adopted`/`epoch`/`watermark`, `block`, `membershipReloadRequested`,
   `disposed`, the applying lifecycle, `started`) and check each is followed by `notifyChanged()`
   before any reader could observe the new value — or is covered by a later call in the same
   synchronous block. **The asynchronous subscription rejection** is the one the ruling names: does
   the `catch` path bump, and does a rejection arriving **after** `dispose()` bump or stay silent
   (either is defensible; the doc comment must say which)? Does `notifyChanged()` running inside a
   Svelte `$state` write during a drain re-enter anything?
4. **Entry 32's "every guard rechecked immediately before installation".** Read
   `requestFileReread`'s guard closure and `rereadUnderGuard`'s call site of the guard: is the guard
   invoked **after** the `await` of the read and **before** the install, with no property read
   between the guard's answer and the install? Do all eight reasons get evaluated at installation
   time, or only some (the notes §5 admit an uncertainty that settles mid-read is unobservable —
   is that the only gap)? Can the automatic clean path (`rereadUnderGuard` from the coordinator's
   `case` arms) still permit when every guard permits — did this phase change its guard?
5. **Sanitization.** Does `reconciliationRegistration()` return anything holding a reference into
   the coordinator (an `Error` with a stack, the unlisten, the event source)? Is the returned value
   frozen, and does `reconciliationWatchState()` return the coordinator's object or a copy?
6. **Doc claims versus code** (`CLAUDE.md` §5, the project's worst defect class). Every new doc
   comment in the four production files: does it claim a guarantee the code does not give? In
   particular the sentence about what a typed callback cannot force, the `accept()` no-call
   argument, the "never touches selection" claim, and the corrected `rereadUnderGuard` /
   `rereadDocument` comments about `ALWAYS_PERMITTED`.
7. **The test discipline of rulings 34/35.** The command spy at exactly zero through every signal,
   exposure and refusal; the reload request that reaches `open()` scripted with an exact drain
   budget and cursor; `drainsUnscripted` asserted zero file-wide; every started coordinator disposed;
   no write lease left open by a new case. A new case that asserts `toHaveBeenCalled()` without an
   argument, or leaves a lease open, is a finding.
8. **The record** (`2d-6-1c-notes.md`): §3 must name a passing test per acceptance clause of
   2d-6-1 (1a's, 1b's and 1c's) — spot-check three names exist in the test files and pin what §3
   says they pin.

## What NOT to spend budget on

- Whether the ten sub-steps 2d-6-2 … 2d-6-11 should be cut differently.
- The four instrument paths and `PROGRESS.json`.
- The fifteen corpus fixtures.
- Spanish prose quality (ruling 40's bilingual review is 2d-6-11's); no i18n key changed here.
- Style: JSDoc presence and closing-bracket comments are the worker's discipline; only flag a
  **false** comment, not a missing one.
- The over-approximation the notes §5 admit (several bumps per drain): one signal that fires too
  often is the ruling's intended shape, not a defect — unless a bump is **missing**.

## Report format

Overwrite `docs/reviews/phase-2d-6-1c.md`. End with the verdict lines the reviewer definition
requires (`ship` / `ship-with-fixes` / `do-not-ship`; counts of BLOCKERS and SHOULD-FIX). For every
finding give `file:line`, the concrete input or interleaving that breaks it, and what the fix should
do — never just "consider". Say explicitly when a suspected finding was checked and **did not hold**.
