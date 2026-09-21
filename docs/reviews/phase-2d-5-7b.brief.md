# Review brief — Phase 2d-5-7b

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
`src-tauri/` + Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-5-7b.md` (overwrite it).

**Time budget:** 15 minutes.

---

## The phase and its goal

Phase **2d-5-7b** is the second half of step 7 of the 2d-5 design consult: **the harness rebuild and
the narrow window lifecycle reading.** The spec is the "Evidence" sentence of step 7 in
`docs/reviews/phase-2d-5-design.md` (~line 348, *"a narrow window lifecycle reading"*) and
`docs/decisions/2d-5-split-notes.md` §6 item 7 (the readings 2d-5-2 and 2d-5-7 owe are **narrow
regression readings, not native-watcher proofs**). 2d-5-7a activated the coordinator in production
(`AppShell.svelte` passes the real event source, `onMount` calls `browser.start()` then `open(null)`
and returns a cleanup calling `browser.dispose()`; the capability holds exactly
`core:event:allow-listen` and `core:event:allow-unlisten`). This phase launched the application built
from this tree in real WKWebView windows and recorded what the probe transcript showed. **The
product of the phase is one record**, and the reading rests on a temporary instrument that is never
committed. Restated so nothing is reviewed from memory:

- **The harness** was rebuilt at a **new** path, `/private/tmp/espansoconfig-harness-2d-5-7b/`
  (`launch.sh`, `inert.sh`, five fixtures, a post-manifest, twelve retained launches
  `S01-S03`, `L01-L07`, `N01-N02`, each with its own `.app` bundle copy and `probe.log`).
  `confine.sh` and `adversary.sh` were not rebuilt; the record says so.
- **The instrument extension.** `src/probe.ts` gained an IPC recorder. `window.__TAURI_INTERNALS__.invoke`
  is claimed **not wrappable** (non-writable, non-configurable in `@tauri-apps/api` 2.11.5), so the
  recorder wraps **`window.fetch`** — the `ipc://localhost/<cmd>` transport — buffers every command
  except the probe's own, flushes through `render_probe` once a plan is known, and discards and
  restores with no plan. `src-tauri/src/probe.rs` changed only its `HARNESS_ROOT` constant.
- **What the record claims is established** (`docs/decisions/2d-5-7b-window-reading.md` §4):
  (1) `plugin:event|listen` for `workspace://reconciliation-ready` **resolved** (`-> ok answer=0`) on
  every plan launch, and the open produced exactly one `drain_external_changes {"afterSequence":0}`
  answering `epoch=1 newest_sequence=0 observations=0` (§4.2, `L01`/`L02`); (2) after
  `probe_second_writer` replaced the watched file from outside the app, a **new** drain arrived
  263-342 ms later answering `observations=1 [Changed seq=1 …]` followed by `reload_document`
  (§4.3, `L03`/`L04`; §4.4, `L05` over a CRLF block-scalar fixture — the R38 shape); (3) the no-plan
  control ran, logged nothing, changed nothing, and was alive at kill (§4.6, `N01`/`N02`).
- **What the record says is NOT established** (§4.5, §5): `dispose()` on window close — by source no
  close path unmounts the Svelte tree, and a real `osascript` quit ended the process with no
  `plugin:event|unlisten` observed (bounded: teardown lines cannot flush). `L06`/`L07` show an ACL
  refusal of `plugin:window|close`, offered as the control that makes "resolved" non-vacuous. Wake
  delivery is **inferred from timing**, not observed; nothing about what a window draws.

**Components: none.** No production file under `src/lib/`, `src-tauri/src/` (other than the
instrument) or `crates/` changed.

## The changed files

```
?? docs/decisions/2d-5-7b-window-reading.md   579 lines — the phase record, THE product under review
?? src/probe.ts                                1979 lines (was 1241) — the instrument, extended; never committed
?? src-tauri/src/probe.rs                      HARNESS_ROOT only — the instrument; never committed
 M src-tauri/src/main.rs, M src/main.ts        the two hook files, pinned at 5 insertions(+), 1 deletion(-) — unchanged
 M PROGRESS.json                               the orchestrator's; not under review
```

The harness tree and every retained `probe.log` are readable at
`/private/tmp/espansoconfig-harness-2d-5-7b/launches/<name>/probe.log`. **Read the transcripts
directly** where the record quotes them; the record's claims must rest on those lines and nothing else.

## Where to be adversarial

1. **Does the recorder observe what the record says it observes?** Read the `window.fetch` wrapper in
   `src/probe.ts`. Tauri 2's IPC over the custom protocol: is the command name really the URL path of
   the fetch, are the args the request body, and is `-> ok answer=…` the **response** (status 200
   and body) rather than the request having been sent? Could a rejected invoke (an ACL refusal is an
   HTTP 400 with a body) be logged as `ok`, or vice versa? The `L06`/`L07` refusal line is the
   control — confirm it was produced by the same code path as the `ok` lines. Does the recorder
   handle the `Response` body being consumed (a clone, or the original left readable for Tauri's own
   code)? A recorder that alters the IPC it observes makes every reading a reading of the instrument.
2. **Is "resolved under the two-entry capability" the same as "registered"?** `answer=0` for
   `plugin:event|listen` is an event id. Confirm from `@tauri-apps/api/event.js` that `listen`
   resolves with that id and that the coordinator's `start()` reaches the state the record calls
   registered — i.e. that the `drain_external_changes` on open is the *registration-triggered* drain or
   the *open-completed* one, and that the record does not conflate the two (2d-5-7a-notes §2 says
   either order is correct; the record must say **which** it observed and not "both").
3. **Is the delivery drain caused by the wake, or by something else?** The record infers wake
   delivery from timing (263-342 ms after `probe_second_writer`). What else could produce a second
   `drain_external_changes` at that moment — the reload, a foreground trigger (inert in production),
   a plan step, the recorder itself? Check `reconciliationCoordinator.ts` for every trigger and
   confirm the record's §5 states the inference honestly and names the alternatives it did not rule
   out. Is `afterSequence` on the second drain the value the record quotes, and is it what the
   coordinator's cursor should hold after the first drain answered `newest_sequence=0`?
4. **Green and false — the project's worst defect class, this time in a record.** Every sentence of
   §4 must cite a launch and a line. Spot-check at least four citations against the transcript files
   on disk: the line number, the exact text, the launch name. A record sentence stronger than its
   transcript line is a blocker. Check the "not established" list (§5) against what §4 claims: does
   any §4 sentence claim disposal, drawing, or native-watcher behaviour that §5 disclaims?
5. **The fixtures and privacy.** Every fixture under `/private/tmp/espansoconfig-harness-2d-5-7b/fixtures/`
   and every quoted line in the record must be synthetic. Confirm no real-config content, no personal
   name or address, entered either (`CLAUDE.md` §1). File names, counts and digests are fine.
6. **The no-plan control.** Does `inert.sh` genuinely set no `ECFG_PROBE_*` variable, and does the
   recorder in a no-plan launch restore the original `fetch` and log nothing (a zero-byte
   `probe.log`, as claimed)? Is "tree unchanged" a `cmp`/digest reading or an assumption?
7. **The two binaries.** `S01` ran on `15f44bbb…` and everything else on `c163c487…`. Is every claim
   in §4 made from launches on the second binary, and does the record say what the first one's two
   driver defects were and that they were the driver's, not the application's?
8. **The `HARNESS_ROOT` move and the hook pin.** `probe.rs`'s constant and `launch.sh`'s `HARNESS`
   must agree; the two hook files must still diff at exactly `5 insertions(+), 1 deletion(-)`.
9. **The gates and the instrument's contribution** (§8): `1323 / 444 / 2474 / 191`, with Rust 0,
   svelte-check +1, vitest +1, Vite +1 attributed to the instrument. Is the vitest "+1" right — which
   test file counts the instrument (`scripts/lint/ipc-detail.test.ts` generates cases from
   `scannableFiles()`, so an *added* file moves it)? Does 2d-5-7a's rung really include `probe.ts`?

## Verification already run, by the orchestrator, each gate on its own, harness in the tree

You do not need to re-run these; report it if you find a figure that is wrong.

| Gate | Result |
|---|---|
| `cargo test --workspace -- --test-threads=1` (to a file, exit read from cargo) | exit 0, **26** `test result` lines, none lacking `0 failed`, sum **1323** |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |
| `npm run check` | exit 0, **444 files, 0 errors, 0 warnings** |
| `npm run build` | exit 0, **191 modules**; server-only bundle markers **absent**, client-only **present (2)** |
| `npm test` | exit 0, **2474 passed, 62 files** |
| `git diff --stat -- src/main.ts src-tauri/src/main.rs` | `5 insertions(+), 1 deletion(-)` |
| `pgrep -fl espansoConfig.app` | nothing running |

## Report format

`VERDICT: ship | ship-with-fixes | do-not-ship`, then `BLOCKERS: <n>`, then the findings, each with
severity, file:line (or launch:line for a transcript), what is wrong, and the evidence you re-derived
— bodies in full, never truncated. A finding about a record sentence names the sentence. Do not
spend budget on `PROGRESS.json`, on the foreground source being inert in production (a recorded open
item), or on what a window draws for an external conflict (2d-6's surface, excluded by the spec).
