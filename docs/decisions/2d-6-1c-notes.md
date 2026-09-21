# Phase 2d-6-1c — the coordinator and workspace members on `BrowserState`

**Status: implemented, reviewed (§6), the review's two findings re-derived and fixed, gates
green.** Risk class: as the orchestrator classified 2d-6-1 (**high** — a notification placed
inside a coordinator whose every fence is a lifecycle capture, and two request methods that end in a
whole `open()`). No `.svelte` file, no Rust, no new module, no i18n key. `git status` shows changes
under `src/lib/browser/` and this file only, beside the four instrument paths already dirty.

This is the third and last of the three sub-phases the orchestrator cut 2d-6-1 into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-1*). It is bound by
§3 entries **28, 29, 32** and §6 item 11 of that record; the drain-budget discipline is rulings 34/35
of [`2d-5-split-notes.md`](2d-5-split-notes.md). It consumes 1a's `decideAutomaticReload` and 1b's
`automaticReloadGuardFor`; **§3 below checks 2d-6-1's whole acceptance in one place**, as the cut
requires when this sub-phase closes.

---

## 1. What changed, per deliverable

Line numbers are of the final tree. `C` is `src/lib/browser/reconciliationCoordinator.ts`, `W` is
`src/lib/browser/workspace.svelte.ts`.

### 1.1 The state-change notification and the one revision signal (entry 28)

- **`ReconciliationHost.reconciliationChanged(): void`** (`C:415`), a required host member. The
  private **`notifyChanged()`** (`C:970`) calls it, and every transition of a value a reader answers
  is followed by one call: `rememberReason` (`pending()`), the splice at the top of `runOneDrain`,
  `record()` (`drains()`, and with it every epoch adoption, cursor move, block transition and
  accepted-sequence move `accept()` makes synchronously before it), `ensurePumping` and its `release`
  (`isPumping()`), the four registration arms in `register()` — `registering`, **`failed` on the
  asynchronous subscription rejection**, `abandoned`, `registered` — the session's
  `requestMembershipReload`, `dispose()`, `workspaceOpened()`, `workspaceReady()` and the new
  `reopenFromRetainedRequest()`. **`accept()` has no call of its own, deliberately**: every exit of it
  is followed by `record()`, and a call between its lifecycle comparison and the cursor writes would be
  caller code exactly where 2d-5-4-E's fence forbids it. The placement rule — after the writes
  announced, never between a capture and a write the capture fences — is stated on `notifyChanged()`
  and driven by the coordinator suite's re-entrant-callback case.
- **`BrowserState.reconciliationRevision(): number`** (`W:2711`, impl `W:6746`) over one `$state`
  counter (`W:3269`) bumped by the host member (`W:3507`) and nowhere else. **A count, never a
  copy**: no watch state, block or flag is mirrored. `reconciliationBlock()` and
  `membershipReloadWanted()` (`W:6729`, `W:6741`) now read the counter as their dependency and
  answer from the coordinator, the shape `openWriteSurfaces()` uses over `surfaceGeneration`; the
  sentence at `reconciliationBlock()` that deferred the mirroring decision to 2d-6 is discharged this
  way. The callback touches no selection and nothing else.

### 1.2 `watchState()` and the sanitized registration state (entry 28, §6 item 11 — claimed)

- **`reconciliationWatchState(): ReconciliationWatchState`** (`W:2723`, impl `W:6750`) — the
  coordinator's value unchanged; its three arms carry at most an epoch number.
- **`reconciliationRegistration(): ReconciliationRegistrationState`** (`W:2735`, impl `W:6755`; the
  type `W:1096`). The coordinator's `RegistrationState.failed` arm carries `error: unknown` — the
  rejection object, unchanged, which its own suite needs; it does not cross. The private
  **`sanitizedRegistration()`** (`W:3555`) builds a fresh frozen literal for every arm and narrows the
  failure to **`RegistrationFailureReason = 'noTransport' | 'rejected'`** (`W:1087`): `noTransport`
  when the rejection is an `Error` carrying the exported `NO_RECONCILIATION_TRANSPORT` (the inert
  default source — every test state), `rejected` for everything else. A code and not a string, so
  2d-6-9 selects a sentence with a `switch` and a `never` terminus.

### 1.3 The two guarded reload request methods (entry 29)

- **`ReconciliationCoordinator.reopenFromRetainedRequest(): boolean`** (`C:792`, impl `C:2005`):
  refuses when disposed, otherwise moves the applying lifecycle, resets the block to `running` and
  calls `host.reopenWorkspace(openRequest)` — the request `workspaceOpened()` was told, `null`
  included, never `summary.root`. **The retained request never leaves the coordinator**: the window
  holds no value it could substitute.
- **`requestMembershipReload(): WorkspaceReloadOutcome`** (`W:2764`, impl `W:6760`) and
  **`requestLostHistoryRecovery(): WorkspaceReloadOutcome`** (`W:2786`, impl `W:6767`). Neither takes
  an argument. Both are one call of the private **`reopenRetained(intent)`** (`W:3641`), whose
  rechecks (**`workspaceReloadRefusal()`**, `W:3597`) and reopen are adjacent statements with no
  caller code between them: `disposed` → `workspaceNotReady` (the coordinator's gate) → for the
  lost-history intent `notBlocked` → `writeInFlight` (with the files) → `surfaceOpen` (with the open
  kinds, in registry order). The outcome type is `W:1136`. Closing the last surface permits and
  triggers nothing: nothing observes the registry emptying.

### 1.4 The guarded file reread request (entry 32)

**`requestFileReread(document): Promise<FileRereadOutcome>`** (`W:2818`, impl `W:6775`; types
`W:1203`, `W:1225`). The private **`fileRereadRefusal()`** (`W:3670`) is asked **twice by the same
function**: at the request (a refusal costs no command) and as `rereadUnderGuard`'s guard,
immediately before the installation and in its synchronous block. Order: `disposed`,
`workspaceNotReady`, `notAddressable` (no row, or a row an `Added` observation invented),
`blockedByLostHistory` (the consult's *recheck the block*), then 1a's `decideAutomaticReload` over
1b's `automaticReloadGuardFor` (`uncertaintyUnresolved`, `observationRetained`, `surfaceOpen`), then
`writeInFlight`. The guard records its own answer, because `rereadUnderGuard` answers `null` for a
refusal and for an installation alike; `at: 'request' | 'installation'` says when. `completed` claims
only that the read did not fail and no guard refused. **The guard runs no caller code**, and since the
review that is a fact about ingress: `ownedProjectionOf` now copies every top-level key through the
new **`ownedScalarOf`** (`W:723`), because the eligibility predicate reads `top_level_keys[i].text`
(§6, finding 1). **`rereadDocument` and the coordinator's
automatic path are untouched**: this is a third caller of `rereadUnderGuard`, not a change to it;
the comments at `rereadUnderGuard`'s clear and at `rereadDocument` now say so.

### 1.5 Sentences corrected (entry 41), all in files this diff touches

`C` header: *nothing here is reactive* now names the notification; *it performs no membership
reload* now names the person's path; `membershipReloadWanted`'s *nothing acts on it* → *nothing
acts on it automatically*. `observationTransitions.ts` `reopenWorkspace`: *only the
discarded-history recovery calls it* → two callers named (the interface itself is **not** widened,
per the orchestrator's ruling (1) at 1b's close). `observationDelivery.ts` (two places) and
`automaticReloadGuardFor`'s doc: *the guarded request is 2d-6-1c's* → `requestFileReread`, present
tense.

## 2. Rulings taken here

1. **Host member, not constructor option.** The `ReconciliationHost` header's own argument: an option
   with an inert default lets a host be built without one and go on compiling, and a coordinator
   nobody can observe is a screen that never redraws; a required member fails at every construction
   site. Cost: one line in the one fake host of `reconciliationCoordinator.test.ts`.
2. **The membership request is permitted when `membershipReloadWanted()` is `false`.** The flag says
   an observation asked; a person may refresh without one having asked, and the refusal set is about
   safety, not need. It is also permitted while blocked — a whole open is what the block waits for.
3. **The lost-history request refuses `notBlocked` while `running`.** The permitted reload may
   already have been taken at the batch after the last surface closed; a stale press must not clear
   the window twice. Asked after `disposed` and `workspaceNotReady` (no shown workspace to act on)
   and before the two conditions about *now*.
4. **`workspaceNotReady`, not `openInProgress`.** The gate is closed while an open loads *and* after
   one that failed; the coordinator cannot tell the two apart and the reason does not pretend to.
5. **The reread asks the hold before the barrier.** Its three reasons are the stronger claims
   (`decideAutomaticReload` orders them so); a write in flight is the one condition that ends by
   itself. It also asks addressability and the block, which the consult's line 213 names.
6. **Refusals carry what 2d-6-9 needs to draw them** — open surface kinds, files with a write out —
   and no sentence: no i18n key, no component.
7. **No `WriteLease`, receiver or `Error` crosses**; every exposure is a fresh frozen literal or a
   coordinator value of numbers and codes.

## 3. The full 2d-6-1 acceptance, checked in one place

| Clause (record §2, 2d-6-1) | Pinned by | File |
|---|---|---|
| A settlement verdict is delivered, not discarded (1b) | *delivers a held observation as retained, and its settlement verdict on the same path*; *announces a held reading dropped as the bytes its own commit ended on*; *publishes a settlement without moving the drain watermark* | `workspace.test.ts` |
| One retry press makes at most one attempt; re-entrancy leaves the observation askable again (1b) | *makes at most one attempt per press, and a re-entrant press makes none*; *leaves the observation held and askable again when the tables move under the attempt*; *keeps the record when the retry's arbitration throws before deciding* | `workspace.test.ts` |
| The acknowledgement refuses in flight, after supersession and at a moved generation, and spends once (1b) | *refuses an acknowledgement while a write is in flight, spending nothing*; *… minted for an origin a later reading superseded*; *… at a moved projection generation, and after an open*; *ends the hold once, installing nothing, issuing no command and re-observing nothing* | `workspace.test.ts` |
| The command spy stays at zero through every arbitration, retry and acknowledgement (1b) | every case of *the observation protocol — Phase 2d-6-1b* asserts `invoked` at zero; *initiates no command from a retry, whatever it answers*; the file's `afterEach` re-asserts it | `workspace.test.ts` |
| `describeExternalConflict` no longer emits `changedElsewhere` (1a) | *never emits changedElsewhere for any external conflict, whatever the surface or the observation* | `saveOutcome.test.ts` |
| **1c:** the revision signal fires on every coordinator transition and on subscription rejection | *announces every registration transition, the pump slot and the drain record*; *announces the asynchronous subscription rejection*; *announces the inert default source refusing, and an abandoned registration*; *announces both block transitions and the membership-reload request* | `reconciliationCoordinator.test.ts` |
| **1c:** … and selection is untouched, the state's own signal moves, the exposure is sanitized | *bumps one revision on every announcement, sanitizes the rejection, and leaves the selection the object it was*; *classifies a transport that refuses as rejected, whatever it threw*; *exposes notWatched for an epoch of zero, and registered for a transport that resolved* | `workspace.test.ts` |
| **1c:** the reload requests refuse while a surface is open and permit once the last closes, without triggering; the explicit request reaches `open()` with the retained request, `null` included | *refuses a membership refresh while a surface is open, permits once the last closes without triggering, then re-runs the retained request*; *re-runs null when null was the request, and clears the wanted flag by reopening*; *refuses a lost-history recovery while a surface is open, permits once it closes without triggering, and recovers on the explicit ask*; *re-runs exactly the retained request, null included, and resets the block* | `workspace.test.ts`; `reconciliationCoordinator.test.ts` |
| **1c:** … refuse during an in-flight write, while an open is in progress or failed, after disposal | *refuses both requests during an in-flight write, naming the file, and permits once it settles*; *refuses while an open is loading, after an open that failed, and after disposal*; *refuses after disposal, reopening nothing and announcing nothing* | `workspace.test.ts`; `reconciliationCoordinator.test.ts` |
| **1c:** the guarded reread refuses while the per-file hold stands (each input alone) | *refuses the reread at the request under each of the three per-file holds, sending nothing*; *… for a write in flight, an invented row, an unknown file, a blocked session and a loading workspace* | `workspace.test.ts` |
| **1c:** … and rechecks every guard immediately before installing | *re-asks every guard immediately before installing, so one that moved while the read was out refuses the installation* (surface, retained observation, write in flight, disposal — each flipped between request and answer); *completes a stale file whose surface has closed, clears the mark, and leaves the automatic path to a fresh observation* (ruling 32's scenario end to end); *reads no command-built key inside the installation guard, so a key's own getter cannot open a surface under it* (§6, finding 1) | `workspace.test.ts` |
| **1c:** the notification takes no resource and issues no command on a coordinator it disposed | *takes no foreground listener, and issues no drain, on a coordinator the registering notification disposed*; *issues no physical drain when the pending-splice notification disposed the coordinator*; *ends a registration exactly once, and drains nothing, when the registered notification disposes the coordinator* (§6, finding 2) | `reconciliationCoordinator.test.ts` |
| The one command a reload request may reach is scripted exactly (rulings 34/35) | every 1c case with a drain declares `expectDrains([...])` with cursors; the `afterEach` holds `drainsUnscripted` to zero file-wide | `workspace.test.ts` |

## 4. Verification

Run from the repository root on the final tree, each gate on its own:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | 447 files, 0 errors, 0 warnings (`--fail-on-warnings` is in the script) |
| `npm test` | 0 | **2549 → 2574 passed, 64 → 64 files** (2570 before the review's four cases) |
| `npx vitest run src/lib/browser/workspace.test.ts` | 0 | **274 → 288** (+13 in the suite *the coordinator and workspace members — Phase 2d-6-1c*, +1 from §6) |
| `npx vitest run src/lib/browser/reconciliationCoordinator.test.ts` | 0 | **62 → 73** (+8 in two suites tagged *Phase 2d-6-1c*, +3 from §6) |
| `npm run build` | 0 | **192 modules transformed** (the instrument in the tree); no new module |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | server-only markers absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | prints `2` — client-only present |
| Cargo | not run | no path under `src-tauri/` or `crates/` changed beyond the instrument |

`git status --short --untracked-files=all`: `M` on six files under `src/lib/browser/` plus this
file and the review's two files under `docs/reviews/`, the four instrument paths as before,
`PROGRESS.json` already modified when the phase began.
`git diff --stat -- src-tauri/src/main.rs src/main.ts` reads `5 insertions(+), 1 deletion(-)`. No git
command that changes the tree was run.

## 5. Where it is thin, and open items left deliberately

1. **The notification is over-approximate by design.** One drain announces several times (splice,
   slot, record, release); a `$derived` over any coordinator reader re-runs on each. Cheap, and a count
   is what entry 28 asked for; a coalescing step would be machinery invented for prose.
2. **A host whose `reconciliationChanged` throws is not contained**, and one site — `release` — runs
   inside a promise callback, so a throw there is an unhandled rejection. The one production host is
   one increment; stated on the interface member and at that site. A host that *disposes* from the
   callback is now fenced at the two sites that continued past it (§6, finding 2); a disposal from
   `host.openGeneration()` still costs one refused drain, as it did before this phase.
3. **A throw from a host member inside `accept()`'s observation loop reaches no `record()`**, so the
   transitions that loop made are announced only by `release`'s notification (the slot freeing). The
   count still moves; which transition it stood for is not knowable, and never was.
4. **An uncertainty that settles while a person's reread is out cannot be seen by the guard**: the raw
   wrapper's own re-read supersedes the pending read first and `completed` truthfully reports a read
   that did not fail and was not refused. Stated in the case that drives the other flips.
5. **`completed` does not say installed.** The captures distinguish "discarded as no longer wanted"
   from "installed" only inside `rereadUnderGuard`, which answers `null` for both; widening its answer
   is a change to a helper three callers share, left for a step that needs the distinction.
6. **The registration rejection reaches no developer channel** — the coordinator stores it and this
   phase classifies it; nothing reports it. Pre-existing; one `report(classifyFailure(error))` in
   `register()` if a step wants it.
7. **`notAddressable` for an invented row is asked at the request only in the sense that matters**: at
   the installation the row still exists and the reason re-fires identically; a row removed between
   request and answer makes `rereadUnderGuard`'s own generation captures discard the answer first.
8. **No mounted evidence** (components: none). The revision signal's reactivity is argued from the
   `surfaceGeneration` precedent and pinned as a count, not as a redraw; 2d-6-9's mounted suites are
   where a window is shown to re-derive from it.
9. **1b's open items stand** (`2d-6-1b-notes.md` §5): the `ReconciliationWorkspace` delivery member
   (2d-6-6's), the `writtenHere` session action (2d-6-2's), `classifyFailure`'s "never throws"
   sentence, the hostile `sequence` getter on the retry's restore path.

## 6. The review's two findings, re-derived

**Codex adversarial review, ship-with-fixes: 1 BLOCKER, 1 SHOULD-FIX**
([`docs/reviews/phase-2d-6-1c.md`](../reviews/phase-2d-6-1c.md)). Each was re-derived against the
pre-fix tree by writing the failing case first, in the file that owns the code, and reading its
failure; both held. The reviewer records that it checked and did **not** uphold whole-reload registry
getter exposure, reopening on final-surface release, retained-request substitution and
registration-object leakage.

1. **[BLOCKER] `workspace.svelte.ts` — the final reread guard ran caller code after its safety
   checks. Held.** `ownedProjectionOf` kept `top_level_keys` by reference, and `fileRereadRefusal`'s
   hold question reaches `creatorEligibilityFor` → `destinationEligibility` → `key.text` *after* the
   registry list and the two hold tables have been read. **Case:** *reads no command-built key inside
   the installation guard, so a key's own getter cannot open a surface under it* — document 2's
   projection carries a `text` getter on `top_level_keys[0]` that registers a `matchEditor` over the
   file when read while armed; armed between the request and the held `reload_document`'s answer.
   **Pre-fix failures, verbatim:** `AssertionError: expected [ [ 'matchEditor' ], …(2) ] to deeply
   equal [ [], { kind: 'completed' }, [ 77 ] ]` — an editor open over the file, the read `completed`,
   node 77 installed under it; and, with the read count asserted first, `AssertionError: expected 2
   to be +0 // Object.is equality` — the key read at the request guard and again at the installation
   guard. **Fix (ingress, the narrower):** `ownedScalarOf` copies every key's six fields and its
   span; `ownedProjectionOf` builds `top_level_keys` from it. The getter now fires during `open()`'s
   copy and never again; no existing case observes key identity. The docs of `ownedProjectionOf`
   (depth, sixth reader), `automaticReloadGuardFor` (interface and implementation) and
   `fileRereadRefusal` now say the block runs no caller code *because* of ingress, and what a field
   the predicate starts reading without a copy would reopen.
2. **[SHOULD-FIX] `reconciliationCoordinator.ts` — disposal from the `registering` notification
   leaked a foreground listener. Held, and a second site with it.** **Cases:** *takes no foreground
   listener, and issues no drain, on a coordinator the registering notification disposed* — pre-fix
   `AssertionError: expected true to be false // Object.is equality` at `activity.listening()`; and,
   from the symmetric sweep the orchestrator asked for, *issues no physical drain when the
   pending-splice notification disposed the coordinator* — pre-fix `AssertionError: expected [ +0 ]
   to deeply equal []` at `control.asked`: one `host.drain(0)` reached against a disposed
   coordinator, refused a microtask later. **Fix:** `start()` rechecks `disposed` after
   `register()` and returns before subscribing; and, because `subscribe` is the source's own code,
   rechecks again after it and calls the answered unsubscribe at once instead of holding it.
   `runOneDrain` rechecks `disposed` after the splice notification and records `'disposed'` with the
   spliced reasons, replacing the comment that called such a check unreachable. **Checked and did
   not hold**, by reading and by one positive pin: `workspaceOpened()` (the notification is its last
   statement), `workspaceReady()` (`requestDrain` refuses when disposed), the `failed` and
   `abandoned` arms (nothing follows but the `abandoned` arm's own `off()`, exactly once), the
   `registered` arm — pinned by *ends a registration exactly once, and drains nothing, when the
   registered notification disposes the coordinator* — `rememberReason` (`drainMayStart()` refuses),
   `ensurePumping` and `release` (the loop condition refuses), `reopenFromRetainedRequest` (last
   statement), `record()` (callers return), and the observation loop (`stillApplying()` is live).

After the fixes: `npm run check` exit 0 (447 files, 0 errors, 0 warnings); `npm test` exit 0
(2574 passed, 64 files: +1 in `workspace.test.ts`, 287 → 288; +3 in
`reconciliationCoordinator.test.ts`, 70 → 73); `npm run build` exit 0 (192 modules; server-only
markers absent, client-only present (2)). No `.svelte`, no Rust, no new module, no i18n key; the
instrument paths are untouched.
