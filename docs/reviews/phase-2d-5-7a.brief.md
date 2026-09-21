# Review brief — Phase 2d-5-7a

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
`src-tauri/` + Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-5-7a.md` (overwrite it).

**Time budget:** 15 minutes.

---

## The phase and its goal

Phase **2d-5-7a** is the first half of step 7 of the 2d-5 design consult: **production activation,
capability widening, dispatcher evidence and the baseline re-measure.** The spec is step 7 of
`docs/reviews/phase-2d-5-design.md` (~line 348) with its Q4 (~line 111) and Q9 (~line 258); the
record is `docs/decisions/2d-5-split-notes.md` §2 "2d-5-7" (~line 107, whose last paragraph records
today's split into 7a and 7b) and §3 rulings **16** (disposal owns the registration race, ~line 208)
and **33** (`dispatch_check.rs` must assert the capability's exact contents, ~line 297). 2d-5-7b —
the harness rebuild and the narrow window lifecycle reading — is **not** this phase; no window was
launched and none is claimed. Restated so nothing is reviewed from memory:

- **The production import.** `src/lib/ipc/events.ts` (`REAL_RECONCILIATION_EVENTS`) had no
  production importer by design since 2d-4b. `AppShell.svelte` now passes it to `createBrowserState`
  explicitly, with the real commands/report/backup and the **inert** foreground source
  (`INERT_FOREGROUND_EVENTS`) — no real `ForegroundSource` exists, and building one was out of scope.
  `createBrowserState`'s own defaults stay inert.
- **The lifetime contract.** `onMount` now calls `browser.start()` **before** `browser.open(null)`
  and returns a cleanup calling `browser.dispose()`. The notes' §2 argues either order is correct
  because `workspaceOpened()` closes the drain gate synchronously.
- **The capability.** `src-tauri/capabilities/default.json` goes from `[]` to exactly
  `["core:event:allow-listen", "core:event:allow-unlisten"]`, and its description was rewritten to
  the present state.
- **Ruling 33.** `dispatch_check.rs` gains three tests — the capability's exact contents through the
  shipped `RuntimeAuthority` (listen/unlisten local-only, emit/emit_to refused, the seventeen
  application commands unresolved from both origins), a local `plugin:event|listen` answering an id,
  a `plugin:event|unlisten` answering null — and a separate two-row plugin table in the remote-origin
  sweep, the application table staying at **seventeen**. Every sentence and test name claiming an
  empty capability set is said to be corrected.
- **Mounted lifecycle evidence.** New `src/lib/components/AppShell.test.ts` (jsdom, six cases):
  one `listen` per mount, unlisten exactly once on unmount, a second cycle, disposal before the
  registration resolves (ruling 16 through the host), a refused registration, a retry, and one
  end-to-end drain through the real composition; a file-wide `afterEach` asserting the exact `invoke`
  list, exact registration/unlisten counts, all shells stopped, and the report count.

**Components: yes — `AppShell.svelte` only.**

## The changed files

```
 M src-tauri/capabilities/default.json           +2 −2     (permissions + description)
 M src-tauri/src/dispatch_check.rs               +330 −47  (three tests, plugin table, prose)
 M src-tauri/src/events.rs                       prose only
 M src-tauri/src/liveness_contract.rs            prose only
 M src-tauri/src/reconciliation.rs               prose only
 M src/lib/browser/reconciliationCoordinator.ts  prose only (+/−41)
 M src/lib/browser/workspace.svelte.ts           prose only (+/−49) — the code is claimed untouched
 M src/lib/browser/workspace.test.ts             +2 −2     (prose)
 M src/lib/components/AppShell.svelte            +64 −? (the imports, the five-argument call, onMount)
 M src/lib/ipc/events.test.ts                    +4 −4     (prose)
 M src/lib/ipc/events.ts                         prose only (+/−61)
?? src/lib/components/AppShell.test.ts           492 lines
?? docs/decisions/2d-5-7a-notes.md               334 lines — the phase record, itself under review
```

**Four paths in the tree are NOT this phase's and must not be reviewed or reported on:**
`src-tauri/src/probe.rs`, `src/probe.ts`, and the hook lines in `src-tauri/src/main.rs` and
`src/main.ts`. They are a temporary window-reading instrument, never committed. Their pin is
`5 insertions(+), 1 deletion(-)` and it still holds. Note `src-tauri/src/main.rs:214-227` still says
`"permissions": []` — that sentence is now false and was deliberately **not** edited because the file
carries the instrument; the notes record it as an open item. `PROGRESS.json` and
`docs/decisions/2d-5-split-notes.md` are the orchestrator's and are not under review.

## Where to be adversarial

1. **Is the disposal real, and is it observed through the host?** Svelte 5's `onMount` cleanup runs
   on unmount. Confirm the test actually unmounts (not merely lets the case end), that the unlisten
   count is asserted **exactly one** per cycle and not `>= 1`, and that the "disposal before
   registration resolves" case controls the `listen` promise from the test rather than racing a real
   microtask. A guard that passed against the pre-change shell proves nothing: the notes' §5 claims
   6/6 failed against the old `onMount` and 5/6 with `start()` but no cleanup — is that consistent
   with what each case asserts?
2. **Green and false, the project's worst defect class.** Roughly 200 lines of this diff are prose:
   doc comments in `workspace.svelte.ts`, `events.ts`, `reconciliationCoordinator.ts`, three Rust
   files and the capability description, rewritten from "no production caller" to the present state.
   Read each rewritten sentence against the code beside it. Where TypeScript cannot force something
   (nothing makes a host call `start()`/`dispose()`; nothing makes the shell pass the real source),
   does the sentence say so? Confirm `workspace.svelte.ts` really changed no code:
   `git diff -U0 src/lib/browser/workspace.svelte.ts | rg '^[+-]' | rg -v '^[+-]{3}' | rg -v '^[+-]\s*(\*|//|/\*)'`
   should print nothing.
3. **The dispatcher tests — do they establish what ruling 33 lists, through the real path?** The
   capability test reads the file and the directory *and* resolves the shipped `RuntimeAuthority`.
   Check that the local listen/unlisten cases go through the same dispatcher entry the seventeen
   application commands use, from the `main` webview with the shipped `tauri.conf.json`, and that the
   remote-origin sweep genuinely attempts both plugin commands from a remote origin and reads a
   refusal (not an unrelated error). Check the seventeen-count assertion is still compared against
   the names parsed from `generate_handler!` and that the two plugin rows are asserted **absent** from
   it. Is `plugin:event|emit` / `emit_to` refusal asserted through the ACL alone, or also attempted?
   If the former, does the record say so?
4. **The capability itself.** Exactly the two entries, no `core:event:default`, no `remote` block.
   Does the rewritten description make any claim the dispatcher tests do not back — e.g. "attempts
   both event-plugin commands from a remote origin" — that you can falsify by reading the test?
5. **The `afterEach` of `AppShell.test.ts`.** This suite mounts the real composition, so 2d-5-6's
   exact-zero `invoked` rule cannot apply verbatim; the notes' §3 says it asserts the **exact** invoke
   list instead. Is that list asserted per case with the case's expected commands (order and
   arguments), or is it a loose "at least these"? Does a case that throws mid-way still meet every
   `afterEach` question? Is `settle()` (a zero-delay macrotask turn, §3) enough for the composition's
   real promise chains, or could a pending registration outlive the case and leak into the next?
   Does the file-wide `afterEach` dispose every shell on every exit, including a mount that throws?
6. **The `onMount` order.** §2 argues `start()` before `open(null)` is correct because
   `workspaceOpened()` closes the gate synchronously. Re-derive it from `reconciliationCoordinator.ts`:
   with `start()` first, the registration's continuation may resolve while `open()` is in flight —
   does `runOneDrain()`'s `openInProgress` gate / `staleOpen` arm cover that, and is there a window in
   which a drain runs against a workspace whose first open has not installed a projection?
7. **The module count.** `npm run build` is **191** on the working tree, against a recorded 189 and
   a design expectation of "+1 = 190". The notes account for it on a pristine `git archive HEAD` copy
   (188): `src/probe.ts` (the instrument, inside the 189), `src/lib/ipc/events.ts` (+1) and
   `node_modules/@tauri-apps/api/event.js` (+1, its only importer being `events.ts`) — so a committed
   tree builds 190. Confirm the arithmetic and that `events.ts` is indeed the sole production importer
   of `@tauri-apps/api/event` (`rg -ln "@tauri-apps/api/event" src --glob '!*.test.ts'`).
8. **The notes' re-derived figures.** Per-file counts (AppShell 6, DetailPane 24, RestorePane 61,
   workspace 245, `ipc-detail` 137 → 138) and the three new Rust cases (1320 → 1323). Spot-check two.

## Verification already run, by the orchestrator, each gate on its own

You do not need to re-run these; report it if you find a figure that is wrong.

| Gate | Result |
|---|---|
| `cargo test --workspace -- --test-threads=1` (to a file, exit read from cargo) | exit 0, **26** `test result` lines, none lacking `0 failed`, sum **1323** |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm run check` | exit 0, **444 files, 0 errors, 0 warnings** |
| `npm test` | exit 0, **2474 passed, 62 files**; per-file re-derived with `--reporter=verbose`: AppShell 6, DetailPane 24, RestorePane 61, workspace 245, ipc-detail 138 |
| `npm run build` | exit 0, **191 modules**; server-only bundle markers **absent**, client-only **present (2)** |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | `5 insertions(+), 1 deletion(-)` |

## Report format

`VERDICT: ship | ship-with-fixes | do-not-ship`, then `BLOCKERS: <n>`, then the findings, each with
severity, file:line, what is wrong, and the evidence you re-derived — bodies in full, never
truncated. A finding about a record sentence names the sentence. Do not spend budget on the four
instrument paths, on `PROGRESS.json`, or on the foreground source being inert in production (a
recorded open item, out of this phase's scope by the brief).
