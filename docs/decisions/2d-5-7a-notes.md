# Phase 2d-5-7a — production activation, capability widening, dispatcher evidence and baselines

**Status: implemented, gates green, awaiting the phase's one review.** Risk class: **medium** — the
first phase since 2d-5-2 to change a `.svelte` renderer (`AppShell.svelte` only), the first to widen
`src-tauri/capabilities/default.json` since Phase 1b-1 narrowed it to empty, and the first production
import of `src/lib/ipc/events.ts`. No user-facing string was added; no `.ts` production module was
added.

This is the first half of step 7 of the design consult
([`docs/reviews/phase-2d-5-design.md`](../reviews/phase-2d-5-design.md), Q4, Q9 and step 7), split on
2026-09-21 by [`2d-5-split-notes.md`](2d-5-split-notes.md) §2 "2d-5-7": everything except the window
reading, which is **2d-5-7b's** together with the harness rebuild. Binding rulings **16, 32 and 33** of
that record's §3 are this phase's. Every `file:line` below is on the final tree of 2026-09-21, over
`HEAD` `272583a` plus this phase's changes, and will drift.

---

## 1. What changed and why, per file

**`src/lib/components/AppShell.svelte`** (`:3`, `:12`, `:51-57`, `:59-88`). The shell now names every
source at its `createBrowserState` call — `REAL_COMMANDS`, `reportIpcFailure`, `REAL_BACKUP_COMMANDS`,
`REAL_RECONCILIATION_EVENTS`, `INERT_FOREGROUND_EVENTS` — rather than taking defaults. The first three
are the values the defaults would have supplied; they are written out so that the fourth can be passed
at all (it is the fourth positional parameter) and so that the whole composition is read in one place.
The fourth is **the first production import of `src/lib/ipc/events.ts`**, which is what makes Tauri's
`listen` reachable from the shipped window. The fifth is the inert foreground source, passed explicitly
so the decision is at the call and not in a default (§6 item 1). `onMount` now calls `browser.start()`
before `open(null)` (§2) and **returns a cleanup that calls `browser.dispose()`** — without which
`dispose()` was an unused method rather than a disposal, which is the consult's own justification for
touching the component.

**`src-tauri/capabilities/default.json`** (`:5-6`). `"permissions"` goes from `[]` to exactly
`["core:event:allow-listen", "core:event:allow-unlisten"]` (ruling 32: both together, in the step that
makes the first production `subscribe()` reachable, neither unused). Not `core:event:default`, which
would also grant `allow-emit` and `allow-emit-to` — nothing in this frontend emits, and a compromised
renderer must not be able to. The `description` was rewritten in the present tense: it keeps the
arguments that still hold (the menu needs nothing; the seventeen application commands need nothing; no
`remote` block) and replaces every sentence the widening invalidated ("deliberately EMPTY", "all seven
commands").

**`src-tauri/src/dispatch_check.rs`** — §4. Three new tests (`:1841`, `:1954`, `:1990`), the remote
sweep extended by a second, separate two-row table for the plugin commands (`:2205-2224`), five
helpers and constants (`:166`, `:174`, `:178`, `:227`, `:238`), two test renames, and every sentence
that claimed an empty capability set corrected (module doc item 3 `:13-30`; the six-command test
`:342-358`; the five write-path tests' "does not block it" claims; the menu test `:1719-1747` and its
assertion message; the remote sweep's doc `:2024-2053`; the drain test's doc `:2227-2251`).

**`src/lib/components/AppShell.test.ts`** — new, §3. Six cases; jsdom by docblock as the two sibling
component suites.

**Present-state prose** (requirement 6). Every passage that said the production caller did not exist
was rewritten to describe today's state, never appended to with a dated paragraph:
`src/lib/ipc/events.ts:46-78` (the section "Two known reasons the real adapter would be refused
today" became "The two capability entries the real adapter needs, and has"; the "no production
module imports this one yet" paragraph became "One production module imports this one") and
`:188-200` (the real adapter's own doc now says what `AppShell.test.ts` proves and does not);
`src/lib/browser/reconciliationCoordinator.ts:59-68` (the header bullet "It reaches nothing in the
shipped window" became "It runs in the shipped window on three of its four triggers"), `:429-439`
(the inert default's doc, whose machine-checkable oracle moved from "the identifier occurs in `src/`
only in the declaring file" to "occurs under `src/lib/browser/` in no file", because the shell and its
test now name it) and `:1696-1704` (the `start()` flush comment);
`src/lib/browser/workspace.svelte.ts:70-77` (the type-only import), `:2096-2103` (`start()`'s doc),
`:2269-2278` (the `events` and `foreground` parameter docs) and `:2576-2580` (the coordinator's
construction comment); `src/lib/browser/workspace.test.ts:9096-9100` (a case comment) and
`src/lib/ipc/events.test.ts:9-16` (the header). On the Rust side, two doc paragraphs said in the present
tense that "a wake dropped today is recovered by nobody" — true of the shipped window until this phase
and false after it — and were rewritten to name the three triggers that recover one and the fourth
that does not (`src-tauri/src/events.rs:53-61`, `src-tauri/src/reconciliation.rs:1120-1128`); the two
`liveness_contract.rs` inventory reasons that described those paragraphs (`:501`, `:507`) were
updated so they do not describe a paragraph that no longer exists. The "drains again" counts they judge
are unchanged.

**What was not changed, deliberately.** `src-tauri/src/main.rs:214-227` is a doc comment on
`register()` that still reads "`capabilities/default.json` stays at `"permissions": []`" — now
false. `main.rs` carries the uncommitted window-reading instrument's hook lines and is not this
phase's to edit; §8 item 1 records it as the first thing a phase with a clean `main.rs` must correct.

## 2. The `onMount` ordering decision: `start()` before `open(null)`

`AppShell.svelte:73-77`. The consult's Q4 lists the four triggers with registration first ("Start
event registration first. When `subscribe` resolves, retain its unlisten function and request a
drain"), and the coordinator's `start()` is written to that order (`reconciliationCoordinator.ts:1671-
1673`: "Registration first, as the consult orders the four triggers — and it is fired rather than
awaited"). So the shell starts, then opens. The reasons, from the coordinator's documented semantics:

1. **`start()` cannot delay the open.** It fires `register()` and returns; nothing in it awaits, so the
   `open(null)` on the next line begins in the same synchronous block either way.
2. **Registration in flight before `open_workspace` is asked for is the narrower of the two windows.**
   A wake emitted while nothing is listening costs a later drain (the module doc of `events.ts` and of
   `crate::events`), and the drain after the open is what pays it; starting first simply makes that
   window the load itself rather than the load plus the registration round trip.
3. **Either order is correct, and the coordinator owns that, not the shell.** `open()` calls
   `reconciliation.workspaceOpened(root)` synchronously before its first await
   (`workspace.svelte.ts:4169`), which closes the drain gate; a registration that resolves during the
   load calls `requestDrain('registration')`, which is *recorded* while the gate is closed and issued
   by `workspaceReady()` (`:4367`) together with the open's own reason — one physical drain for both,
   which the last case of `AppShell.test.ts` pins (`:481-530`). Had the shell opened first, `start()`'s
   own flush (`reconciliationCoordinator.ts:1687-1705`) would find the gate closed for the same reason.
4. **A refused open leaves the gate closed** (`workspace.svelte.ts:4240-4252`), and the shell's *Retry*
   control re-runs `open(null)` without touching the subscription — `events.ts` §"Lifetime" says a
   workspace replacement neither unsubscribes nor resubscribes, and the retry case pins the counts.

The comment at the call site (`AppShell.svelte:60-72`) says all four in the same words, and the
coordinator's flush comment (`:1696-1703`) states the gate rather than the call order, because
nothing in TypeScript fixes the order and a host that opened first would be equally correct.

## 3. `AppShell.test.ts`: what it mocks, what `invoke` answers, and what the `afterEach` asks

**Two boundaries are mocked and nothing above them** (`:83-132`). `@tauri-apps/api/event`'s `listen`
**is** a `vi.fn` — the spy is the module's export, with no wrapper between the caller and the record —
whose every call is a promise the case settles by hand, resolved with a fresh unlisten spy or rejected,
so a registration can be put on either side of the disposal (the review's finding 2 is why it is the
spy itself; §9). `@tauri-apps/api/core`'s
`invoke` records every call and answers from a per-case script, or refuses when none is installed.
`events.ts`, `commands.ts`, the coordinator, the state and the shell are the real modules; this is what
makes each count a fact about the shipped composition.

**The `invoke` policy** (the module doc `:25-35` says it beside the code). The sibling suites hold the
real boundary to zero calls because they inject scripted commands and a call that reached it is the
defect. This file mounts the composition that *is* the real boundary, so the shell's `open(null)`
reaches `invoke` by design and an exact-zero rule cannot apply. The `afterEach` (`:322-390`) therefore
asserts the **exact call list**: `mountShell()` (`:184-206`) pushes `['open_workspace', { root: null }]`
once per mount, a case that clicks *Retry* pushes another, and the one case that scripts a successful
open pushes `['list_documents', {}]` and each `['drain_external_changes', { afterSequence: 0 }]` it
expects. The default answer is a refusal, chosen for three reasons: it is the cheapest fully real path
(the shell draws its failure arm through the real reporter and the real `tIpcFailure`); a refused open
leaves the drain gate closed, so a drain reaching the boundary would show up as an unexpected entry
rather than needing a scripted answer; and it needs no wire-shaped fixture. A refused open is also
reported once through `reportIpcFailure`, which the shell now passes explicitly, so `console.warn` is
spied and held to exactly one call per refused open — the one place the reporter wiring is observed.

**The `afterEach` tears down first and asks six questions second** (`:322-390`). The teardown is
unconditional: every shell still in the module-level `live` set is unmounted — which runs the host's
cleanup and so disposes its coordinator — and every registration nobody settled is resolved into that
disposed coordinator, which calls the unlisten it is handed and stores nothing (the review's finding
1; §9). Both are counted before they are cleaned up, and the counts are what the first and third
questions assert, so the cleanup cannot hide what it cleaned. The six questions, in order: every shell
was stopped **by its case** (so every coordinator the case started was disposed through the host's
own cleanup — the file's form of ruling 35); exactly one `listen` call per mount, with the one event name and a handler and **no third
argument** (the absence is what makes the target `Any`, which is how the shipped window registers);
every registration was settled by the case; every unlisten a resolved registration handed over was
called **exactly once** (ruling 16, file-wide); the exact call list; the exact report count.

**The six cases** (`:392-531`): one listener on mount and one unlisten on unmount, synchronously on
the unmount; a second mount/unmount cycle identical to the first, the first shell's unlisten untouched
by the second's lifetime; disposal before the registration resolves still unlistens exactly once
(ruling 16 observed through the host); a refused registration tears down with nothing to unlisten; a
retry re-opens through the same boundary with the registration count and the unlisten count unmoved;
and the composition end to end — the open is held open by a `deferred()` (`:287-295`) so the
registration is known to land while the gate is closed, one physical drain then satisfies both
reasons, a wake for the adopted epoch delivered through the handler the real adapter registered is a
second drain, a wake for another epoch is nothing, and a wake after disposal is nothing.

**Settling.** `settle()` (`:258-261`) is the two sibling suites' helper: one zero-delay macrotask turn
and a `flushSync()`. It is not a sleep — nothing in the composition uses a timer (measured with `rg`
over the production modules), so the turn exists only to let the whole microtask queue run before the
case reads; it waits for the queue, never for the coordinator, and a drain that never happened is a
wrong call list rather than a hung case. A fixed microtask count was considered and not taken: the
end-to-end case's chain (registration, two command answers, the pump's yield, a drain answer, the
accept) is long enough that a count would be a number to re-tune whenever an `await` is added.

## 4. The dispatcher extension, and how listen and unlisten were driven

Ruling 33 / consult Q9, all six claims, in `src-tauri/src/dispatch_check.rs`:

1. **The permission set is exactly the two entries, with no remote origin** —
   `the_capability_grants_exactly_the_two_event_permissions` (`:1841-1952`). Two readings. The file is
   read from `CARGO_MANIFEST_DIR` and parsed: the `capabilities/` directory holds exactly `default.json`
   (so no second file widens it), `permissions` equals the two entries in order, `windows` is `["main"]`,
   there is no `remote` and no `webviews` key. Then the shipped context's own `RuntimeAuthority` —
   `tauri::Context::runtime_authority_mut()` exposes the object the dispatcher consults — is asked
   `resolve_access` directly: `plugin:event|listen` and `plugin:event|unlisten` resolve for
   (`main`, `main`, `Origin::Local`) with every resolved command in `ExecutionContext::Local`; both
   resolve to `None` for `Origin::Remote` and for a window that is not `main`; `plugin:event|emit` and
   `plugin:event|emit_to` — what `core:event:default` would have added — resolve to `None`; and all
   seventeen application commands resolve to `None` from both origins, which is the measured form of
   "a local origin reaches them because they are not access-checked, not because the list allows them".
2. **A local `main` webview registers through `plugin:event|listen`** —
   `a_local_webview_registers_the_wake_listener_through_the_event_plugin` (`:1954-1988`). The arguments
   are what `@tauri-apps/api/event`'s `listen` really sends, read off `node_modules/@tauri-apps/api/event.js`
   rather than guessed: `event` (spelled from `crate::events::RECONCILIATION_READY`, the name Rust
   emits), `target: { "kind": "Any" }` (what `listen(event, handler)` sends with no options, which is how
   `events.ts` calls it) and `handler`, a callback identifier the mock never invokes. The answer is a
   JSON number, the `EventId`; two registrations answer two different numbers.
3. **The returned listener is removable through `plugin:event|unlisten`** —
   `the_registered_listener_is_removable_through_the_event_plugin` (`:1990-2022`): the identifier from
   a listen is sent back as `eventId` (the camelCase the plugin's `event_id` is renamed to on the wire)
   with the event name, and the answer is `null` — the unit value; a refusal would be a string.
4. **A remote origin is refused for both plugin commands** — the second table in
   `a_remote_origin_is_refused` (`:2205-2224`), from the same `REMOTE_ORIGIN` the ACL test resolves
   against, each refusal a string containing `NOT_ALLOWED`.
5. **The application table stays seventeen** — the first table's `assert_eq!(attempted.len(), 17)`
   is untouched, and the plugin rows are a **separate** array so they cannot inflate it; the sweep also
   asserts neither plugin name is in `crate::wire_contract::registered_commands()`, so a plugin command
   that found its way into `generate_handler!` fails by name.
6. **Every application command stays reachable locally and in the remote sweep** — the existing
   tests, renamed where their names claimed an empty set:
   `the_six_read_only_commands_are_reachable_with_an_empty_capability_set` →
   `…_with_no_application_permission` (`:358`), and
   `the_menu_command_is_registered_and_reachable_with_an_empty_capability_set` →
   `…_with_no_menu_permission` (`:1747`).

**What the two plugin-command tests cannot see, said in their docs.** The plugin records a listener in
a table `tauri` keeps `pub(crate)` and evaluates a script on the webview that `MockRuntime` stores in a
field the application crate cannot reach, so what is measured is the grant and the crossing, not that
a wake would reach a page (2d-5-7b's). And `unlisten_js` answers `Ok(())` for an identifier it never
held, so the unlisten test's claim is exactly *granted and reaches the plugin* — the claim the second
capability entry exists to make true — and not *the listener is gone afterwards*.

## 5. Evidence that each guard bites

Every new assertion was run against the state it exists to refuse, and the result read off the
output rather than assumed.

- **The capability tests, against `"permissions": []`** (the pre-change file, restored from a copy
  afterwards): exactly the three new tests fail, the listen one with the dispatcher's own sentence
  `event.listen not allowed. Permissions associated with this command: core:event:allow-listen,
  core:event:default`; the other 21 pass. (`/tmp/2d-5-7a-dispatch-negative.txt`.)
- **The same, against `["core:event:allow-listen"]` alone**: the listen test passes, the unlisten test
  fails with `event.unlisten not allowed. Permissions associated with this command:
  core:event:allow-unlisten, core:event:default`, and the ACL test fails on the exact-contents
  assertion — which is the failure mode `events.ts` describes, a listener that cannot be disposed, now
  measured rather than argued. (`/tmp/2d-5-7a-dispatch-negative2.txt`.)
- **`AppShell.test.ts`, against a shell whose `onMount` neither starts nor returns a cleanup** (the
  pre-change body): **6 of 6 fail** — "expected `vi.fn()` to be called 1 times, but got 0 times" for
  the unlisten counts, and the `afterEach`'s registration count for the rest.
- **The same, against a shell that calls `start()` but returns no cleanup** (the "unused method"
  state the consult names): **5 of 6 fail**. The one that passes is the refused-registration case,
  which has no unlisten to count — it measures the start half and the teardown's tolerance, not the
  disposal (§6 item 5).
- **The fix round's two controls**, both temporary cases, run before and after the fix (§9): a case
  that mounts and throws before `stop()`, followed by a case asserting an empty `document.body`, an
  empty `live` set and no registrations — the follower **failed before** the fix (`expected 1 to be
  +0` on `childElementCount`) and **passes after** it, while the thrower fails on `boom` and on the
  `afterEach`'s `survivors` count both times; and a case calling the mocked `listen` with a third
  argument — `listened.mock.calls[1]` had length **2 before** the fix and **3 after** it, and with the
  per-mount count balanced the `afterEach`'s `expect(call).toHaveLength(2)` is the assertion that
  fires (`expected [ …(3) ] to have a length of 2 but got 3`).

## 6. Where it is thin

1. **The foreground trigger is inert in production.** `AppShell.svelte:56` passes
   `INERT_FOREGROUND_EVENTS`, so in the shipped window a return to the foreground or a resume never
   requests a drain; registration, a finished open and a current-epoch wake are the three that do. A
   DOM `visibilitychange`/focus `ForegroundSource` is a later phase's — it would be a production module
   of its own and was out of this phase's scope by the brief. Until then a wake dropped while the
   window is in the background is recovered by the next open or the next delivered wake, and the two
   Rust doc paragraphs of §1 say exactly that.
2. **The window reading is owed to 2d-5-7b.** Nothing here launched the application. That
   `plugin:event|listen` succeeds in a real WKWebView with this capability file, that the coordinator's
   `start()` runs from the real `onMount`, and that a real wake reaches `onWake` are all claims only a
   window can make; every green gate here is compatible with a window in which none of them holds.
3. **What the `AppShell.test.ts` `afterEach` does not ask.** It does not ask the barrier question
   (`writesInFlight`, 2d-5-6 §6 item 1) — no case here writes, and `MatchBuffers`-level surfaces are
   never mounted because every case ends in the failure arm or the empty arm. It does not ask the drain
   *budget* question by cursor as `workspace.test.ts` does: a drain here is an entry in the exact call
   list, which is a stronger question about *which* calls and a weaker one about *how many answers
   were scripted* (the script answers any number of drains with the same empty batch). It does not
   assert the `listen` handler's identity across mounts, only its count. And it holds `console.warn`
   to the report count, which would also catch a Svelte development warning — a false failure rather
   than a false pass, but a coupling worth knowing about.
4. **The end-to-end case fixes the registration/open order by hand.** The `deferred()` open is what
   guarantees the registration lands while the gate is closed; the shell's real order makes that
   likely but the coordinator is documented to accept either, and the case pins one of the two. The
   other order — registration resolving after `ready`, giving two physical drains — is
   `reconciliationCoordinator.test.ts`'s and `workspace.test.ts`'s, not this file's.
5. **The refused-registration case measures no disposal.** With nothing to unlisten it passes whether
   or not `onMount` returns a cleanup (§5), so it carries the start half alone.
6. **`settle()` is a macrotask turn, as in the sibling suites** (§3). It is the honest form for a
   composition with no timers; a composition that gained one would make this helper wait for it too.
7. **The two plugin-command tests measure the grant and the crossing, not the listener** (§4).
8. **The bundle oracles are unchanged and still say nothing about `event.js`'s own contents.**
   `@tauri-apps/api/event.js` is now in the bundle; the server-only/client-only oracles of `CLAUDE.md`
   §4 discriminate Svelte's two builds and do not look at it.
9. **The "identifier occurs under `src/lib/browser/` in no file" oracle** (`reconciliationCoordinator.ts:435-437`)
   is narrower than the one it replaced. It still catches a browser-layer module reaching the real
   adapter; it says nothing about a second component doing so, which `events.ts:77-78` says in words.
10. **`main.rs:214-227` is false and was left so** (§1, §8 item 1).

## 7. Verification

Run in the order below on the final tree, every long output redirected to a file and the exit read
from the tool rather than a pipe.

| Gate | Result |
|---|---|
| `cargo test --workspace -- --test-threads=1 > /tmp/2d-5-7a-cargo-test.txt 2>&1` | exit 0; `rg -c '^test result'` = **26**; `rg '^test result' … \| rg -v ' 0 failed'` prints nothing; passed counts sum to **1323** (= 1320 + the three dispatcher tests) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 (after one `cargo fmt -p espansoconfig` over the new test bodies) |
| `cargo tree -p espansoconfig-core \| rg tauri` | nothing |
| `npm run check` | exit 0; **444** files, 0 errors, 0 warnings (443 + `AppShell.test.ts`) |
| `npm test` | exit 0; **2474** tests, 62 files (2467 + 6 `AppShell.test.ts` + 1 `ipc-detail.test.ts`) |
| `npm run build` | exit 0; **191** modules transformed — accounted below |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | nothing (server-only markers absent) |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | **2** (client-only markers present) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | `5 insertions(+), 1 deletion(-)` |
| `python3 -c "…['permissions']"` | `['core:event:allow-listen', 'core:event:allow-unlisten']` |

**Per-file vitest counts, re-derived on the tree with the JSON reporter, never from the total:**
`AppShell.test.ts` **6**; `DetailPane.test.ts` **24**, `RestorePane.test.ts` **61**,
`workspace.test.ts` **245** — all three unchanged from 2d-5-6; `scripts/lint/ipc-detail.test.ts`
**138**, moved by **+1** because it generates one case per `.ts`/`.svelte` file under `src/` and
`AppShell.test.ts` is a new one. On the pristine `git archive HEAD` copy it is **136**: the working
tree's 137 before this phase already carried the instrument's `src/probe.ts`.

**The Vite module count, accounted on a pristine copy.** The brief expected 190 (189 + `events.ts`)
and the tree builds **191**. `git archive HEAD | tar -x -C /tmp/pristine-2d-5-7a`, `npm ci
--ignore-scripts`, `npm run build` there: **188**. A throwaway config wrapping the real
`vite.config.ts` with a `moduleParsed` counter was run over both trees and the two id lists diffed;
the working tree has exactly three modules the pristine copy does not:

| Module | Why |
|---|---|
| `src/probe.ts` | the uncommitted window-reading instrument, imported by the dirty `src/main.ts` — **present in the recorded 189 too**, which was measured on a tree carrying it; not this phase's |
| `src/lib/ipc/events.ts` | the expected +1: the first production import |
| `node_modules/@tauri-apps/api/event.js` | the +1 the expectation missed: `events.ts` imports `listen` from Tauri's event module, which no production module imported before (`core.js` was already in the graph through `commands.ts` and `menu.ts`) |

So the committed tree (no instrument) builds **190** and the working tree **191**; this phase's
contribution is **+2**, one of them Tauri's own module, and nothing else moved. The ladder's rungs
have been measured on the working tree since the instrument landed, so the comparable figure is 191.

**The rung: `1323 / 444 / 2474 / 191`**, from `1320 / 443 / 2467 / 189` at 2d-5-6.

`git status --short --untracked-files=all` on the final tree shows the four instrument paths
(` M src-tauri/src/main.rs`, ` M src/main.ts`, `?? src-tauri/src/probe.rs`, `?? src/probe.ts`), the two
paths that were already modified when the phase began (` M PROGRESS.json`,
` M docs/decisions/2d-5-split-notes.md`), and this phase's: ` M src-tauri/capabilities/default.json`,
` M src-tauri/src/dispatch_check.rs`, ` M src-tauri/src/events.rs`, ` M src-tauri/src/liveness_contract.rs`,
` M src-tauri/src/reconciliation.rs`, ` M src/lib/browser/reconciliationCoordinator.ts`,
` M src/lib/browser/workspace.svelte.ts`, ` M src/lib/browser/workspace.test.ts`,
` M src/lib/components/AppShell.svelte`, ` M src/lib/ipc/events.test.ts`, ` M src/lib/ipc/events.ts`,
`?? src/lib/components/AppShell.test.ts`, `?? docs/decisions/2d-5-7a-notes.md`. Stage by path.

## 8. Open items noticed on the way, for a later phase to take deliberately

1. **`src-tauri/src/main.rs:214-227`** says the capability file "stays at `"permissions": []`" and that
   "the empty permission list that Phase 1b-1's review narrowed to stays exactly as narrow". Both are
   false since this phase. The file holds the instrument's hook lines and is not editable until the
   instrument is deleted (2d-8) or a phase is explicitly given `main.rs` by path; whichever comes first
   owes the correction. The sentence about `core:default` staying gone remains true.
2. **`src/lib/browser/workspace.svelte.ts:346-349`**, the doc of `BrowserCommands.drainExternalChanges`,
   says "Nothing in this file calls it, and that is deliberate … `BrowserState` gains no reconciliation
   state here." That has been false since 2d-5-3, when the coordinator's `drain` host member began
   calling `commands.drainExternalChanges` (`:2589`); it was not invalidated by this phase and so was
   not fixed here.
3. **A production `ForegroundSource`** (§6 item 1) — a DOM `visibilitychange`/focus adapter, one new
   production module, injected at `AppShell.svelte:56` in place of the inert one, with the Vite count
   moving by one and a mounted case in `AppShell.test.ts` driving it.
4. **The narrow window lifecycle reading** — 2d-5-7b, with the harness rebuilt first.

## 9. The review and its two dispositions

The phase's one adversarial review ([`docs/reviews/phase-2d-5-7a.md`](../reviews/phase-2d-5-7a.md)):
ship-with-fixes, 0 blockers, 2 SHOULD-FIX, both in `src/lib/components/AppShell.test.ts`. The report's
bodies were truncated, so each finding was re-derived against the file with a temporary case before
anything was changed; the fix touched that file and this record only.

**Finding 1 — "Failed cases leave mounted shells and pending registrations behind" (`:300` of the
reviewed file). Held, in its leak half; its attribution half did not.** Re-derived with a case that
mounts and throws before `stop()`: the `afterEach` ran, failed its `stillOpen` assertion and vitest
attributed that failure to the throwing case — so a leak was never blamed on the wrong case and never
passed silently. But the shell itself survived: the next case found the mounted `<div>` still in
`document.body`, with a live coordinator behind it and a `listen` promise the file had promised to
settle and never would (it had been `splice`d out of `registrations` and forgotten). Inert in practice
— that coordinator's open had already been refused and its registration could never resolve — but a
surviving coordinator is exactly what ruling 35 exists to forbid, and "inert today" is an argument.
**Changed:** `mountShell()` enters the shell into a module-level `live` set **before** the `flushSync()`
that runs `onMount` (a throw from inside the mount still leaves it findable), `stop()` removes it, and
the `afterEach` now tears down unconditionally before it asserts — unmounts every survivor, which runs
the host's cleanup and disposes the coordinator, and resolves every unsettled registration into that
disposed coordinator, which calls the unlisten it is handed (ruling 16) and stores nothing. The
survivors and the unsettled registrations are counted first and asserted on afterwards
(`expect(survivors).toHaveLength(0)`, `expect(unsettled).toHaveLength(0)`), so the case that forgot
`stop()` still fails and the cleanup hides nothing. The `open` counter is gone; `live.size` is the
fact it approximated. Evidence in §5.

**Finding 2 — "The listener mock makes the argument-count assertion vacuous" (`:111`). Held exactly as
stated.** The mock was `(event, handler) => { listened(event, handler); … }`, a wrapper that forwarded
two arguments and dropped any third, so the `afterEach`'s `expect(call).toHaveLength(2)` — the file's
claim that the adapter passes no options and therefore registers with target `Any` — could not fail.
Re-derived by calling the mocked `listen` with three arguments: the spy recorded two. **Changed:** the
spy is now the module's export itself — `vi.mock('@tauri-apps/api/event', () => ({ listen: listened }))`
with `listened` a `vi.fn` built in the hoisted block whose implementation pushes the registration —
so there is no forwarding layer to be vacuous: a `vi.fn` records the whole argument list its caller
passed, whatever its implementation names. Re-run, the same three-argument call recorded three, and
with the per-mount count balanced the arity assertion is the one that fires (§5). **The negative
control is temporary, deliberately.** A permanent case that passes three arguments would fail the
file-wide arity assertion it exists to prove — that is what proving it means — so it cannot live in
the file; and a permanent case asserting that a `vi.fn` records its arguments would test vitest. The
control is recorded here with its failure text instead, and the hoisted block's doc says why the spy
is the export (`:92-100`).

**What the fix did not do.** It did not add a permanent negative control for either finding, for the
reason above; it did not touch any other file; §6 items 3 and 5 stand as written, and §6 gains nothing
— the teardown is now unconditional, which was the only thinness the review named.

**Re-verification after the fix:** `npm test` exit 0, **2474** tests, 62 files; `npm run check` exit
0, 444 files, 0 errors, 0 warnings; `AppShell.test.ts` **6** cases under the verbose reporter. No Rust
file changed, so the Rust gate stands at §7's figures.
