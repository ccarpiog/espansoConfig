# Phase 2d-6-10 — the foreground fallback

**Date:** 2026-09-23.
**Spec:** [`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the *2d-6-10 — foreground fallback*
block. It is bound by §3 entry 33 (a DOM source, synchronous, and what a mounted case cannot prove)
and entry 38 (a component-changing step owes a narrow window reading). §5.8 is the correction this
phase carries out.
**Components:** `AppShell.svelte` only. **No Rust, no Tauri permission, no capability file and no
instrument hook changed.** No user-facing string was added.

---

## 1. What changed

- **New module `src/lib/browser/domForeground.ts`: `createDomForegroundSource(page, view)`.**
  - It returns a `ForegroundSource`. Each `subscribe` adds two fresh listeners:
    - `visibilitychange` on `page`, which calls the handler only if `page.visibilityState` reads
      `'visible'` at dispatch;
    - `focus` on `view`, without capture.
  - It returns an unsubscribe that removes both, synchronously. The unsubscribe also clears a flag
    that both listeners check, so a target that fails to remove a listener still calls nothing
    afterwards. A second unsubscribe is a no-op.
  - Building the source registers nothing. There is no timer and no debounce; coalescing stays the
    coordinator's pump's.
  - The two targets are structural interfaces (`VisibilityTarget`, `FocusTarget`) rather than the
    globals. So the module touches no DOM at load, and its suite runs in the default `node`
    environment over Node's `EventTarget`.
- **`src/lib/components/AppShell.svelte`** passes `createDomForegroundSource(document, window)` as
  `createBrowserState`'s fifth argument in place of `INERT_FOREGROUND_EVENTS`. It also corrects its
  composition comment, and the disposal comment now says "the two foreground listeners".
- **`src/lib/browser/reconciliationCoordinator.ts`, two comments corrected (§5.8):**
  - The `ForegroundSource` doc said every real implementation, including "Tauri's window
    `onFocusChanged`", registers synchronously. That was false: `onFocusChanged` is `async` and
    awaits two `listen` calls (`node_modules/@tauri-apps/api/window.js:1724`). The doc now says
    so, names the DOM source as the one production source, and states what the type does not force:
    a source can return an unsubscribe that defers its real removal.
  - The module header said the shell ran "three of its four triggers" and passed the inert source.
    It now says that all four are wired, and that WKWebView's emission on a real foregrounding is
    only as true as a window reading has seen.
- **`src/lib/browser/workspace.svelte.ts`**: two doc comments (`start()` and `createBrowserState`'s
  `@param foreground`) said the shell passes the inert foreground source. Both are corrected. No
  code changed.
- **`src/lib/browser/reconciliationCoordinator.test.ts`**: the fake source's doc said "as every real
  foreground source does". It was the same false claim, and it is corrected in the same sentence
  shape. No code changed.
- **Tests:** `domForeground.test.ts` is new (9 cases). `AppShell.test.ts` gained a
  `describe('the foreground fallback — Phase 2d-6-10')` with 5 cases and four file-level helpers
  (`setVisibility`, `restoreVisibility`, `scriptOpenWorkspace`, `mountOpenShell`). None of its
  existing cases and none of its file-wide `afterEach` counts were changed (entry 36). Every new
  case runs under the same exact per-case `invoke` list.

## 2. The evidence

### Adapter (`domForeground.test.ts`, node environment)

1. Construction registers nothing.
2. `visibilitychange` while visible calls the handler once, **inside the dispatch**: the assertion
   follows the `dispatchEvent` with no await between.
3. `visibilitychange` to hidden calls nothing. The state is read per dispatch, so the next change
   back is heard.
4. `focus` on the window calls the handler synchronously.
5. A `focus` on the page and a `visibilitychange` on the window are not heard.
6. One call per signal; the adapter coalesces nothing itself.
7. Unsubscribe removes both listeners (the counting targets read 0 for each type). A second
   unsubscribe is a no-op, and dispatches afterwards call nothing.
8. A target whose `removeEventListener` does nothing still calls nothing after the unsubscribe;
   the flag is what stops it.
9. Two subscriptions are independent.

### Mounted shell (`AppShell.test.ts`, jsdom)

1. A `visibilitychange` with `visibilityState` `hidden` issues nothing. The same event with
   `visible` issues exactly one `drain_external_changes`.
2. A window `focus` issues exactly one drain.
3. A `visibilitychange` and two `focus` events dispatched in one turn issue **one** drain. That is
   the coordinator's existing coalescing, reached through the real composition.
4. While a refused open keeps the drain gate closed, both signals reach no boundary. The call list
   holds only the open.
5. The mount adds exactly one `visibilitychange` listener on `document` and one `focus` listener on
   `window`. The unmount removes **those same two functions**, synchronously, with no await.

**Negative control.** With the shell passing `undefined` (so the inert default) in place of the DOM
source, cases 1, 2, 3 and 5 fail. Case 4 passes, as it should, because it asserts that no drain
happens. The file was restored byte-identically (`diff -q` against the backup).

### Window reading

[`2d-6-10-window-reading.md`](2d-6-10-window-reading.md) has the two launches, `F10-01` (EN) and
`F10-02` (ES). The screen was locked:
- three activation requests from outside the process left Finder frontmost;
- the page saw no `focus`, `blur` or `visibilitychange`, and nothing drained;
- a synthetic `focus` dispatched on the real window issued exactly one drain, which shows that the
  shipped bundle carries the DOM source;
- **real foregrounding, wake and resume were not observed.**

## 3. Acceptance, clause by clause

| Clause | Status |
|---|---|
| Synchronous DOM `ForegroundSource` (`visibilitychange` to visible plus `focus`) replacing `INERT_FOREGROUND_EVENTS` in `AppShell` | **Met.** §1 |
| The coordinator's asynchronous-Tauri comment corrected | **Met.** §1. The same false claim was also corrected in the test fake's doc and in two `workspace.svelte.ts` comments |
| No permission or instrument hook changed | **Met.** `src-tauri/capabilities/` untouched; `git diff --stat src-tauri/src/main.rs src/main.ts` is still `5 insertions(+), 1 deletion(-)`. `src/probe.ts` was extended for the reading, which is a deviation (§5) and not a hook |
| Adapter tests | **Met.** 9 cases (§2) |
| Mounted: a `visibilitychange` to visible and a `focus` each request a drain | **Met.** Mounted cases 1 and 2 |
| Mounted: a hidden visibility does not | **Met.** Mounted case 1 |
| Mounted: triggers coalesce | **Met for signals dispatched in the same synchronous turn only.** Mounted case 3. Signals delivered as separate tasks cost a follow-up drain (the pump clears its flag after one microtask), and whether WKWebView delivers `focus` and `visibilitychange` in one task has not been read in a window (review SHOULD-FIX, §7) |
| Mounted: unmount removes both listeners | **Met.** Mounted case 5 (the same functions, synchronously) |
| A narrow foreground reading with the wake and resume limits stated | **Met in part.** The reading was taken and its limits are stated. It could not observe a real foregrounding: the screen was locked and activation was refused. It shows only that the wiring is live in the real window. Three departures from ruling 38 are named in the window reading §6 |
| One module budgeted, then measured (entry 33) | **Met.** Vite 200 → 201 |

## 4. Open items (not fixed here, `CLAUDE.md` §7)

1. **A visible-window foreground reading remains owed.** An unlocked session must bring the app
   forward and read whether WKWebView emits `focus` or `visibilitychange`, and whether a drain
   follows. The same session should read whether a page stopped by occlusion resumes on one. This
   joins 9c's item 7; 2d-7 is the natural owner.
2. `focus` fires on every window activation, including an in-app return from a native dialog, and
   each one costs one drain (coalesced if one is already pending). This is judged acceptable for a
   fallback: a drain over an empty queue is one cheap command. It is recorded, not measured.
3. There is still no window-close mechanism (entry 33; the record's §7 item 10). A closed window
   never runs `dispose()`, so the two listeners go with the page, as the wake listener does.

## 5. Deviations

- **`src/probe.ts` extended** (`593bfde4…` → `cba6c61a…`) with a `foreground-activate` case, and a
  new harness script `launch-10.sh` was added. Neither is committed; 2d-8 deletes both.
  `probe.rs`, `main.rs` and `main.ts` are unchanged.
- The window reading departs from ruling 38 in three ways, all recorded in its §6: its own plan,
  the probe extended, and a hidden window under a locked screen.

## 6. Verification

Each command was run on its own:
- `npm test` exit 0: **3382** tests in 70 files. That is 3366 before, plus 9 adapter cases, 5
  mounted cases, and 2 per-file cases that `scripts/lint/ipc-detail.test.ts` generates for the two
  new files.
- `npm run check` exit 0: 459 files, 0 errors, 0 warnings.
- `npm run build` exit 0: **201** modules.
- `rg -c '\$\$payload|head_payload|push_element' dist/assets/` found nothing, so the server-only
  markers are absent.
- `rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/` found 2 in `index-*.js`, so the
  client-only markers are present.
- No Rust was touched, so the Rust count carries over.

**New rung: `1323 / 459 / 3382 / 201`**, with the instrument in the tree (previous
`1323 / 457 / 3366 / 200`).

## 7. The review

`autoclaude-review.sh` exited 2 (`REASON=usage-limit`, Codex out of quota until 2026-09-26 19:14), so
the fallback agent `autoclaude-reviewer` (opus) wrote [`phase-2d-6-10.md`](../reviews/phase-2d-6-10.md):
**`ship-with-fixes`, 0 BLOCKERS, 1 SHOULD-FIX.** The finding: the adapter's header, the mounted
coalesce case's comment and §3's "triggers coalesce" row claimed a `visibilitychange` and a `focus`
"delivered together when the window comes forward" coalesce into one drain. That holds only for
signals dispatched in the same synchronous turn — the pump waits one microtask and clears its flag
before draining (`reconciliationCoordinator.ts` `pump()`), so two signals delivered as separate tasks
cost a follow-up drain — and no window reading saw how WKWebView delivers the pair. **Fixed in the
three places the review named**: the header and the test comment now state the same-turn condition
and what is unread, the test's title says "dispatched in one turn", and §3's row is narrowed. Comments
and records only; no behaviour changed. Gates re-run after the fix: `npm test` and `npm run check`, recorded in `PROGRESS.md`.
