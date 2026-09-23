# Phase 2d-6-9c — the narrow window reading of the reconciliation status

**Date:** 2026-09-23.
**Phase:** 2d-6-9c, the last third of 2d-6-9 ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2,
*The orchestrator's cut of 2d-6-9*). It reads in a real window what 2d-6-9a, 9b-1, 9b-2 and 9b-3
built, in English and Spanish, over the ruling-38 hard fixture.
**Instrument:** the harness `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, widened in this phase
(§2).
**Binary for every proof launch** (`P9-01`–`P9-23`):
`9e0eb6fc53307303bad525534b9bd6049371f0f362d1af067ae24a712dc89d59`. It was built from `src/probe.ts`
`593bfde4…`, `src-tauri/src/probe.rs` `d2f6681d…`, and a tree that already held the layout fix of
§5.1. The shakedown `S9-06` is the only reading taken before that fix.

This is a **window reading**. It makes claims about what a WKWebView window built from this tree
drew. The claims rest on three things only:
- 23 proof launches of a hand-assembled macOS bundle, and their transcripts;
- an out-of-app comparison of every transcript against the dictionary files and the fixture bytes;
- the WebKit page snapshots named in §6.

**No person looked at a live window.** The window was hidden and unfocused in every launch
(`hasFocus=false visibility=hidden`), as in 8c. The snapshots are WebKit's render of the page, not
a composited window.

**Several states were put in place by the instrument, not by the disk.** On this host there is no
honest way to make a write's outcome unknown, hold a save's answer, refuse the wake registration,
report epoch zero or drop an observation. So the probe **substitutes one command's answer at the
transport** (§2.2). Each substitution prints a `--- substituted` line naming what the backend really
answered. What the window then draws is its own rendering of the state that answer put it in. The
cause of the state is the probe's.

**In short.**
- Every reachable state of the ten was drawn, in both languages: **stale, unavailable, removed,
  path drift, not watched, failed registration, lost history, membership reload wanted, held
  observation and uncertain write.**
- Four of the five controls were drawn and pressed: membership reload, lost-history exit,
  stale-file reread and uncertainty acknowledgement. The fifth, the retry, was drawn **disabled
  only**.
- **9b-3's refused automatic reread and its exit were read.** A change on disk under an uncertainty
  hold issued no `reload_document`. The route drew the unknown outcome, the refused observation's
  disk text byte for byte and an enabled acknowledgement, while the pane and the row drew `stale`
  with the reread refused. The acknowledgement issued no command and opened the reread. The reread
  issued one `reload_document`, and `stale` left.
- **Two of the eight panels** drew their snapshot acknowledgement: the raw editor and the match
  editor. The press withdrew the pane's unknown-outcome sentence and gave back the panel's reload
  choice.
- Every drawn sentence was attributed to a dictionary key by an out-of-app script. **0 problems.**
- **One defect was found and fixed**: the route squeezed the sidebar and the pane to zero height.
  §5.1 describes it.

---

## 1. What the filesystem showed when this phase began

- The harness had `launch.sh`, `launch-7c.sh`, `launch-8c.sh`, the 7c/8c tools and fixtures, and
  launches up to `P8-21`.
- The four instrument paths were present, and `git diff --stat src-tauri/src/main.rs src/main.ts`
  read `5 insertions(+), 1 deletion(-)`.
- `src/probe.ts` was `c1fa7377…` (8c's last) and `src-tauri/src/probe.rs` was `b44b8569…`. Copies
  of both are kept as `/private/tmp/9c-probe.ts.orig` and `/private/tmp/9c-probe.rs.orig`.
- `PROGRESS.json` was already modified. That file is the orchestrator's.

## 2. What changed in the harness and the instrument (never committed; 2d-8 deletes both)

### 2.1 Harness (outside the repository)

```
launch-9c.sh               a copy of launch-8c.sh. It takes the thirteen status-* plans (§3).
                           Every plan starts at hard R0. It adds ECFG_PROBE_TARGET_EXTRA and
                           ECFG_PROBE_R5, and after the process ends it puts back the permission
                           bits of match/other.yml and match/extra.yml
run-9c.sh                  runs launch-9c.sh over a list, one launch after another
tools/verbatim-9c.cjs      the out-of-app comparison (§4)
fixtures/extra-r0.yml      new, neutral: a one-snippet file the extra writer creates
launches/S9-01 … S9-20     shakedowns
launches/P9-01 … P9-23     proof launches
```

The fixtures are 7c's hard set (§2.3). All content is neutral and synthetic. The real
configuration was never read, copied or launched against.

### 2.2 Instrument

The `main.rs`/`main.ts` hook diff is unchanged.

- **`src-tauri/src/probe.rs`** (`b44b8569…` → `d2f6681d…`) gained four confined commands. Each
  requires a plan, and each refuses any path outside the launch's own `xdg/espanso/match`:
  - `probe_extra_writer(unreadable)` creates `match/extra.yml` with `create_new`. With
    `unreadable`, the file is created with mode `0o000`.
  - `probe_remove_other` removes `match/other.yml`.
  - `probe_remove_extra` removes `match/extra.yml`.
  - `probe_lock_other` sets `match/other.yml` to mode `0o000`.
- **`src/probe.ts`** (`c1fa7377…` → `593bfde4…`) gained two sections.
  - ***Substituted answers.*** Five substitutions, armed by a plan:
    - `mayHaveWritten`: the save really runs, and its answer is then replaced by
      `saveFailed { Write: Io { step: SyncDirectory } , may_have_written: true }`. That is the
      shape the Rust predicate gives a directory sync failing after the rename.
    - `delay`: the save really runs, and its answer is held for 7 s.
    - `listenRefused`: `plugin:event|listen` is answered with an error and never issued.
    - `epochZero`: every drain answer is rewritten to the empty batch of epoch 0.
    - `discardOnce`: the next drain answer carrying an observation reports `discarded: 1`.

    An error is always a `Tauri-Response: error` response, never a rejected `fetch`. Tauri resends
    a rejected `fetch` through `postMessage`, which would issue the command twice. The
    registration and the drain wait for the plan to be known, which costs one round trip at
    start-up in every instrumented launch.
  - ***The reconciliation status — Phase 2d-6-9c.*** The thirteen plans, and these helpers:
    `readRegion`, `readRow`, `reportRows`, `pressStatus`, `waitForSentence`,
    `waitForSentenceGone`, `closeRawEditor`, `uncertainRawSave`, `reportShellLayout`, `hold`,
    `heartbeat` and `keepAlive`.
- **Two host facts forced two helpers.** Both are recorded as deviations in the notes §5.
  1. **`pause(ms)` is capped at 400 backend round trips**, which on this host is about 70–115 ms
     whatever `ms` is. So every 8c `pause(1500)` waited about a tenth of that. The new plans use
     `hold(ms)`, which loops `pause` until the wall clock passes. `S9-10` failed on this: its 7 s
     delay released after 114 ms.
  2. **The hidden page stops a couple of seconds after the last WebKit snapshot request**, once
     the launch is more than about six seconds old.
     - `S9-01`, `S9-02` and `S9-04` stopped dead at 6.5–7.8 s, with nothing in flight.
     - `S9-04`'s heartbeat printed through 7.8 s and then went silent.
     - In `S9-05`, `keepAlive` asked for a snapshot (`shots/keepalive-webview.png`, overwritten)
       about once a second. The same plan then ran to `--- end`, with twenty beats a second
       apart.

     This is `CLAUDE.md` §6's occlusion stop. It also explains 8c's `P8-09`. It is **not** an
     application defect: the page ran again as soon as it was asked to render.

### 2.3 Fixtures and ruling 38

Every plan opens over **hard R0** (`hard-r0.yml`, `a569b4d9…`). Its hard shape is 7c's §8.1:
- `|` block bodies at column five;
- a block line that looks like a comment;
- a column-five comment owned by `:beta`;
- an interior blank line, and a blank run after a block;
- a column-two comment owned by `:gamma`;
- a `>-` folded block with a more-indented line.

The external change is **hard R1** (`hard-alpha-changed-r1.yml`, `0b6c6dfd…`). Ruling 38 asks that
a reading "include one hard fixture". Here the hard text is what the route's snapshot, the raw
panel and the viewer draw, and §4 holds each of those against the fixture bytes. `match/other.yml`
(`other-r0.yml`) and `extra-r0.yml` are neutral one-snippet files.

## 3. The launch recipe and the plans

```sh
npm run build                                            # 200 modules
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol
/private/tmp/espansoconfig-harness-2d-6-6c-2/run-9c.sh <plan>:<en|es>=<name> …
```

Every launch went into a bundle path never used before, with one plan per launch. Every plan set
the language through the picker, and each transcript prints `--- language picked=<lang> … label=ok`.

| Plan | What it drives | Substitution |
|---|---|---|
| `status-uncertain-route` | Raw editor, a draft, *Save* made uncertain. The editor closed (*Discard my changes*). Writer R1 with no surface open. The route, the pane and the row. A locale switch. The acknowledgement pressed on the route. The reread pressed in the pane | `mayHaveWritten` on `save_raw_document` |
| `status-uncertain-raw` | The same save, the editor left open, writer R1: the raw panel with its acknowledgement, then the press | `mayHaveWritten` on `save_raw_document` |
| `status-uncertain-editor` | Match editor over `:beta`, a draft, *Save this snippet* made uncertain, writer R1: the editor's panel with its acknowledgement, then the press | `mayHaveWritten` on `save_match` |
| `status-stale` | Raw editor, writer R1, *Save* about 80 ms later (refused as a conflict). The editor closed. The reread | none |
| `status-held` | Raw editor, *Save* with its answer held, writer R1 during the hold: the held observation and the retry, then the release | `delay` 7 s on `save_raw_document` |
| `status-membership` | An unreadable `match/extra.yml` created (the reachable `Unnamed`), then removed. The membership reload | none |
| `status-removed` | Raw editor over `match/other.yml`, which is then removed | none |
| `status-unavailable` | `match/other.yml` shown, then set to mode `0o000` | none |
| `status-lost-history` | Raw editor open, writer on `match/other.yml` with one discarded observation reported. The editor closed. The workspace reload | `discardOnce` |
| `status-registration` | The wake registration refused. Writer R1 | `listenRefused` |
| `status-not-watched` | Every drain answered with epoch 0. Writer R1 | `epochZero` |
| `status-diag-uncertain` / `-plain` | Diagnostics of the §2.2 stop (shakedowns only) | as named |

## 4. The launches

| Launch | Plan | `end`/`failed`/`MISMATCH` | `probe.err` | Sentences checked (`verbatim-9c`) | Verdict |
|---|---|---|---|---|---|
| `S9-01`–`S9-20` | shakedowns | — | 0 | — | Shakedowns. They found the close question (`S9-01`/`02`), the page stop (§2.2) and the cap on `pause` (`S9-10`). They showed that a created readable file arrives as an `Added` row, not as drift (`S9-11`). **`S9-06` is the reading before §5.1's fix** |
| **`P9-01`** | `status-uncertain-route:en` (→ es → en) | 1/0/0 | 0 | 25, 0 problems | **pass** |
| **`P9-02`** | `status-uncertain-route:es` (→ en → es) | 1/0/0 | 0 | 25, 0 | **pass** |
| **`P9-03`** | `status-uncertain-raw:en` | 1/0/0 | 0 | 10, 0 | **pass** |
| **`P9-04`** | `status-uncertain-raw:es` | 1/0/0 | 0 | 10, 0 | **pass** |
| **`P9-05`** | `status-uncertain-editor:en` | 1/0/0 | 0 | 8, 0 | **pass** |
| `P9-06` | `status-uncertain-editor:es` | **0**/0/0 | 0 | 6, 0 | **No terminal line.** The transcript stops after `--- counts ue-acknowledge-before`, with the keep-alive running. Not counted, and re-run as `P9-23`. Cause not established |
| **`P9-07`** | `status-stale:en` | 1/0/0 | 0 | 7, 0 | **pass** |
| **`P9-08`** | `status-stale:es` | 1/0/0 | 0 | 7, 0 | **pass** |
| **`P9-09`** | `status-held:en` | 1/0/0 | 0 | 5, 0 | **pass** |
| **`P9-10`** | `status-held:es` | 1/0/0 | 0 | 5, 0 | **pass** |
| **`P9-11`** | `status-membership:en` | 1/0/0 | 0 | 6, 0 | **pass** |
| **`P9-12`** | `status-membership:es` | 1/0/0 | 0 | 6, 0 | **pass** |
| **`P9-13`** | `status-removed:en` | 1/0/0 | 0 | 1, 0 | **pass** |
| **`P9-14`** | `status-removed:es` | 1/0/0 | 0 | 1, 0 | **pass** |
| **`P9-15`** | `status-unavailable:en` | 1/0/0 | 0 | 2, 0 | **pass** |
| **`P9-16`** | `status-unavailable:es` | 1/0/0 | 0 | 2, 0 | **pass** |
| **`P9-17`** | `status-lost-history:en` | 1/0/0 | 0 | 7, 0 | **pass** |
| **`P9-18`** | `status-lost-history:es` | 1/0/0 | 0 | 7, 0 | **pass** |
| **`P9-19`** | `status-registration:en` | 1/0/0 | 0 | 2, 0 | **pass** |
| **`P9-20`** | `status-registration:es` | 1/0/0 | 0 | 2, 0 | **pass** |
| **`P9-21`** | `status-not-watched:en` | 1/0/0 | 0 | 2, 0 | **pass** |
| **`P9-22`** | `status-not-watched:es` | 1/0/0 | 0 | 2, 0 | **pass** |
| **`P9-23`** | `status-uncertain-editor:es` | 1/0/0 | 0 | 8, 0 | **pass** |

**The verdict is a conjunction:**
- one `--- end` line, no `--- failed` line and no `MISMATCH`;
- an empty `probe.err`;
- `verbatim-9c.cjs` reporting `problems=0 not-found=0`;
- `home-files=0`;
- a tree diff naming only the files the plan's writers or its own saves touched.

The "sentences checked" figure counts only the `--- sentence` lines. The attribution pass (item 2
of the list below) covers every drawn text, whatever that count says.

**What `verbatim-9c.cjs` does.** It runs in Node, outside the application. It reads
`src/lib/i18n/en.json`/`es.json` from disk and switches dictionary at each `--- language picked=`
line. It is a copy of `verbatim-8c.cjs` with two additions. First, every fixture the launch used,
and the two strings the probe types, are removed from each text before attribution; the removals
are counted, so nothing is hidden. Second, a row's `⟨title: …⟩` wrapper is removed. It then does
three things:
1. **It re-derives every `--- sentence` line** from its key and params. The result is the table
   above, with the in-app verdict agreeing every time.
2. **It attributes every `--- text` line**, longest dictionary value first, and prints what is left
   over. This greedy pass proves that every drawn string exists somewhere in the picked language's
   dictionary. It does **not** prove that the right key produced it: two keys sharing a value, or a
   value contained in another, are indistinguishable to it. Only item 1's re-derivation ties a
   sentence to its key. In every proof launch the residue is one of these:
   - nothing;
   - `match/conflict.yml` or `match/other.yml` (a route's path line or a section header);
   - in the editor plans only, the fixture text split around `:beta`. The first `SourceText` in
     the editor's panel is the trigger field, so the `--- disk ue-panel` line holds `":beta"` and
     not the file. That one `--- disk` line is the single `matches-no-fixture=1` in `P9-05`,
     `P9-06` and `P9-23`. **This is a probe artifact**: the panel's whole-file text is removed as
     fixture R1, and the remainder is `:beta`.
3. **It holds every `--- disk` line** against the fixtures' bytes:
   - the route's snapshot (`ur-refused-route`, `ur-switched-route`), the raw panel (`uw-panel`)
     and the released raw panel (`hd-released-panel`) are each `exact hard-alpha-changed-r1.yml`
     (836 characters). The columns, blank runs and owned comments came through unchanged;
   - the viewer after each reread (`ur-reread-viewer`, `st-reread-viewer`) is
     `exact hard-alpha-changed-r1.yml`;
   - the viewer while the automatic reread was refused (`ur-refused-viewer`) is
     `fixture+draft-line hard-r0.yml`. That is **the window's own projection of what its uncertain
     save wrote, not the disk's R1**. It is direct evidence that the refused reread installed
     nothing.

Per-launch output is in `launches/P9-nn/verbatim.txt`.

### 4.1 9b-3: the refused automatic reread, and acknowledge-then-reread (`P9-01`, `P9-02`)

```
--- substituted #10 save_raw_document real=ok {"outcome":"saved","revision":"d4d2ab17…",…} -> error saveFailed may_have_written=true
--- waited the pane’s unknown-outcome sentence 89ms
```

1. **Uncertain, the editor still open.** The pane's status block draws
   `browser.externalConflict.writeOutcomeUnknown` (the surface placement). The route draws nothing.
   The raw editor's own outcome draws `browser.rawEditor.mayHaveWritten`.
2. **Closing the editor** first draws its question (*Your changes have not been written…* /
   *Discard my changes · Keep editing*). After *Discard my changes*, the route draws the path and
   `browser.externalConflict.route.writeOutcomeUnknown`, and the pane block leaves.
3. **Writer R1.** The route's snapshot label was drawn 287–309 ms after the writer was asked.
   `--- rereads ur-after-writer count=0 []`: no `reload_document` and no `document_text`.
   - **Route:** the path, the route sentence, *The disk snapshot this acknowledgement is about:* /
     *La instantánea del disco a la que se refiere este reconocimiento:*, R1 byte for byte, and
     *I have reviewed this snapshot* / *He revisado esta instantánea* **enabled**.
   - **Pane:** `browser.externalDocument.stale`, *Read this file again* **`[off]`**, and
     `browser.reconciliation.refusal.uncertaintyUnresolved`.
   - **Row:** *Not reconciled* / *Sin conciliar*, with the header sentence as its `title`.
4. **The locale switch on the mounted status panel** (entry 35), EN → ES in `P9-01` and ES → EN in
   `P9-02`. The counts of eight commands were identical before and after
   (`--- switched ur unchanged=yes`). The route, the pane and the row redrew every sought sentence
   in the other language (`present … ok`). The route's snapshot was still
   `exact hard-alpha-changed-r1.yml`, and the reread stayed `[off]`.
5. **The acknowledgement:** `--- pressed ur-acknowledge … unchanged=yes`, so no command was
   issued. The route left entirely. The pane kept `stale`, and *Read this file again* became
   enabled, with the `uncertaintyUnresolved` refusal `absent … ok`.
6. **The reread:** exactly `reload_document(1)` and `document_text(1)`. `stale` left the pane
   (724 ms) and the row, and the viewer drew R1 `exact`.

### 4.2 Two of the eight panels: the snapshot acknowledgement (`P9-03`–`P9-05`, `P9-23`)

**The raw editor** (`P9-03` EN, `P9-04` ES):
- After the uncertain save and writer R1, the raw panel was drawn 321 ms after the writer. It
  carries `browser.conflictOrigin.changedWhileOpen`, the observed revision (`0b6c6dfd…`), the
  whole disk text (`exact hard-alpha-changed-r1.yml`), and directly under it
  `div.acknowledgement` with *I have reviewed this snapshot* / *He revisado esta instantánea*
  enabled.
- The panel itself does **not** draw `writeOutcomeUnknown` (`absent … ok`). The pane's block above
  it does, once (9b-2 ruling 1).
- Choices before the press: `[Keep editing · Copy my text]`. The reload is withheld under the
  hold.
- After the press, no command was issued (`unchanged=yes`). The acknowledgement left the panel and
  the pane's unknown-outcome sentence left. The choices became
  `[Keep editing · Copy my text · Load the version on disk]`.

**The match editor** (`P9-05` EN, `P9-23` ES):
- The same sequence over `save_match`.
- Choices before the press: `[Keep editing · Copy my text]`; after it:
  `[Keep editing · Copy my text · Keep my draft · Load the version on disk]` (ES:
  `[Seguir editando · Copiar mi texto · Mantener mi borrador · Cargar la versión del disco]`).
- No command was issued by the press.

**The six other panels were not read** (creator, recovery, deleter, mover, duplicator, restore).
§7 says why.

### 4.3 `stale` from a refused save, and the stale-file reread (`P9-07`, `P9-08`)

- *Save* was pressed 82 ms after writer R1. The pane drew `stale` 82 ms after the writer, and the
  row drew *Not reconciled* / *Sin conciliar*.
- **With the raw editor open, the pane offered no reread** (`controls=[]`). After the editor
  closed, *Read this file again* was drawn enabled.
- The press issued exactly `reload_document(1)` and `document_text(1)`. `stale` left the pane
  (723 ms) and the row, and the viewer drew R1 `exact`.

### 4.4 The held observation and the retry (`P9-09`, `P9-10`)

- The save's answer was held for 7 s. Writer R1 ran 200 ms after the press.
- 506 ms later the pane drew `browser.externalConflict.observationRetained` with *Check the
  observed change now* / *Comprobar ahora el cambio observado* **`[off]`**, and
  `browser.reconciliation.refusal.writeInFlight` under it.
- The route did not draw the held sentence (`absent … ok`).
- The raw editor drew *This save cannot be stopped, so the editor stays open until it answers*,
  with *Stop editing* `[off]`.
- On release (7.0 s) the held sentence left, and the raw editor drew its external panel over R1
  (`exact hard-alpha-changed-r1.yml`), with
  `[Keep editing · Copy my text · Load the version on disk]`.

### 4.5 Membership: path drift, the membership banner and the reload (`P9-11`, `P9-12`)

1. **An unreadable `match/extra.yml` was created.** 306 ms later the banner read
   `browser.externalDocument.pathDrift.unreadable` with the path, and then
   `code.unreadableReason`'s *Your system refused espansoConfig permission to read this file*.
   No membership banner and no control were drawn. An unreadable path does not ask for a reload.
2. **It was then removed.** The drift banner became `pathDrift.removed`, and below it
   `browser.reconciliation.membershipReloadWanted` with *Reload the file list* /
   *Recargar la lista de archivos* enabled.
3. **The press** issued `open_workspace` 1 → 2, `list_documents` 1 → 2 and one drain. The banners
   left in 725 ms. The rows were unchanged (the file was never listed).

`pathDrift.changed` was not drawn (§7).

### 4.6 `removed` over a surface still open (`P9-13`, `P9-14`)

With the raw editor over `match/other.yml`, the file was removed:
- the row left the sidebar;
- the pane drew *This file is no longer present in the observed workspace.* / its ES value
  **exactly once** in the whole detail section (`removed-sentence-count-in-detail=1`);
- the route drew nothing;
- the raw editor stayed open, with *Undo · Redo · Save* all `[off]`.

### 4.7 `unavailable` (`P9-15`, `P9-16`)

After `match/other.yml` was set to mode `0o000`:
- the pane drew `browser.externalDocument.unavailable` and the reason *Your system refused
  espansoConfig permission to read this file.* / *Tu sistema le denegó a espansoConfig el permiso
  para leer este archivo.*;
- the row drew *Unreadable when observed* / *Ilegible al observarse*, with the header sentence as
  its `title`;
- no control was drawn.

### 4.8 Lost history and its exit (`P9-17`, `P9-18`)

- One drain carrying `match/other.yml`'s change was reported with `discarded: 1`. The banner
  `browser.reconciliation.lostHistory` was drawn 306 ms after the writer. *Reload the workspace* /
  *Recargar el espacio de trabajo* was drawn `[off]`, with `refusal.surfaceOpen` under it, while
  the raw editor was open.
- After the editor closed, the control was enabled and the refusal was `absent … ok`.
- The press issued `open_workspace` 1 → 2 and `list_documents` 1 → 2. The banner left in 752 ms.

### 4.9 Failed registration and not watched (`P9-19`–`P9-22`)

- **Failed registration.** `--- substituted #2 plugin:event|listen not-issued`. The banner read
  `browser.reconciliation.registrationFailed.rejected` / its ES value, with no control.
- **Not watched.** Every drain answered epoch 0. The banner read `browser.reconciliation.notWatched`,
  with no control.
- In both, writer R1 then changed nothing on screen. The drain count stayed at 1, the viewer kept
  R0, and the banner stood.

## 5. Found

### 5.1 Defect — the route squeezed the sidebar and the pane to no height (fixed here)

**Before the fix, `S9-06` (EN):** with the route drawing the hard fixture's snapshot, the layout
measured:

```
--- layout ur-refused route y=44 h=703 visible=684px
--- layout ur-refused panes y=747 h=0 visible=0px
--- layout ur-refused sidebar y=747 h=14 visible=0px innerTextLength=0
--- layout ur-refused paneStatus y=768 h=112 visible=0px innerTextLength=0
--- layout ur-refused document scrollHeight=786 clientHeight=728
```

- `S9-03/shots/ur-refused-webview.png` and `ur-switched-webview.png` show the route filling the
  window, with nothing of the sidebar or the pane.
- The pane's block, *Read this file again* with its refusal, was in the DOM and drawn nowhere a
  person could reach. So `S9-06` printed `MISMATCH` for the pane's three sentences: `innerText` was
  empty.
- The route with an **outlived** acknowledgement (disabled, 9b-1's mounted case) would stand like
  that with no exit on screen.

**Cause.** `AppShell.svelte`'s `.shell` is `height: 100vh`, and `.panes` has `min-height: 0`. The
`.reconciliation` region had no bound and no scroll of its own, so the panes shrank to nothing.

**Fix.** `ReconciliationStatus.svelte`'s `.reconciliation` rule gains `flex-shrink: 0;
max-height: 45vh; overflow-y: auto;`, with a comment. A pin in `ReconciliationStatus.test.ts` was
shown failing first (the notes §4 give the failure verbatim). **After the fix** (`P9-01`, `P9-02`):

```
--- layout ur-refused route y=44 h=328 visible=328px
--- layout ur-refused panes y=372 h=317 visible=317px
--- layout ur-refused paneStatus y=393 h=112 visible=112px innerTextLength=192
--- placement ur-refused-acknowledge box=22,694,213x30 scroller=section.reconciliation… scrollTop=0 … visible=0px
--- scrolled ur-refused-acknowledge by-the-probe
--- placement ur-refused-acknowledge box=22,341,213x30 … scrollTop=353 … visible=30px of 30px
```

So the acknowledgement is below the fold of the route's own scroll. A person has to scroll the
route to reach it, as the probe did. It is no longer out of reach.

### 5.2 Seen, not fixed (handed on in the notes §6)

- **A disabled status control is drawn like an enabled one.** In `P9-01/shots/ur-refused-webview.png`
  (*Read this file again*) and `P9-10/shots/hd-held-webview.png` (*Comprobar ahora el cambio
  observado*), the disabled button has the same colour and border as an enabled one. In the same
  image the raw editor's disabled *Rehacer* and *Guardar este archivo* are muted. The refusal
  sentence under the control is the only visible cue. `FileReconciliationStatus.svelte`,
  `ReconciliationStatus.svelte` and `SnapshotAcknowledgement.svelte` each style `button` with
  `color: inherit` and have no `:disabled` rule.
- **A long row mark breaks the file name mid-word.** In `P9-16/shots/un-locked-webview.png` the
  Spanish mark *Ilegible al observarse* leaves `match/other.yml` drawn as `match/other.y` / `ml`.

## 6. Snapshots opened and looked at

Every image named here was opened by this reader. All are WebKit page snapshots of a hidden window.

| Image | What it shows |
|---|---|
| `S9-03/shots/ur-refused-webview.png`, `ur-switched-webview.png` | **Before the fix**, EN and ES: the route with the full snapshot and the acknowledgement at the bottom edge. No sidebar, no pane |
| `P9-01/shots/ur-refused-webview.png` | After the fix, EN: the route (path, sentence, snapshot label, R1 at its columns) in its own scrolled region. Below it, the sidebar row *Not reconciled*, and the pane's *What this window shows…*, *Read this file again* and the `uncertaintyUnresolved` refusal |
| `P9-02/shots/ur-refused-acknowledge-webview.png` | ES, the route scrolled by the probe to *He revisado esta instantánea*, the end of the R1 text above it, *Sin conciliar* and the pane block below |
| `P9-04/shots/uw-acknowledgement-webview.png` | ES raw panel: the observed revision, *La versión del disco*, R1 at its columns, *He revisado esta instantánea* under it. Row *Sin conciliar* |
| `P9-10/shots/hd-held-webview.png` | ES: the pane's held sentence, *Comprobar ahora el cambio observado* (disabled, drawn unmuted; §5.2), *Todavía hay una escritura en curso…*, and the raw editor's *Guardando…* |
| `P9-12/shots/mb-removed-webview.png` | ES banners: the removed-path drift with `match/extra.yml`, the membership sentence, *Recargar la lista de archivos* |
| `P9-13/shots/rm-removed-webview.png` | EN: *This file is no longer present in the observed workspace.* once, above the raw editor over `match/other.yml`. No row for it |
| `P9-16/shots/un-locked-webview.png` | ES: the unavailable sentence with its reason, and the row mark *Ilegible al observarse* (§5.2) |
| `P9-18/shots/lh-blocked-webview.png` | ES: the lost-history banner, *Recargar el espacio de trabajo* and *Hay un panel de edición abierto…* above the open raw editor |

**Enabled** is read from the transcripts' `[off]` marks, not from the pictures. For these controls
the pictures cannot tell (§5.2). Every other snapshot was not opened, and those readings rest on
the transcripts and §4.

## 7. Unread, and why

- **The retry enabled, and pressed.** Its only path holds an observation with no barrier, which
  9b-1 notes §5 calls contrived: a getter that registers a newer origin during the arbitration. No
  window plan can drive it. Read disabled only (§4.4).
- **`registrationFailed.noTransport`.** A production window always has the Tauri transport.
- **`pathDrift.changed`.** It needs a change to a path nothing ever named, and an unreadable file
  gives the `unreadable` arm. Only `unreadable` and `removed` were read.
- **`stale` from an observation on a `Named` pending row, and `stale` behind a surface's panel
  alone.** `stale` was read from a refused save (§4.3) and from 9b-3's refused reread (§4.1).
- **The route's disabled acknowledgement with `projectionReplaced` and its exits note**
  (`browser.reconciliation.route.projectionReplacedExits`). The surface notes
  (`surface.observationExit`, `surface.holdEnded`) and a refused acknowledgement press are unread
  too. No plan built an outlived origin.
- **Six of the eight panels' acknowledgement**: creator, recovery, deleter, mover, duplicator and
  restore. The two read share `SnapshotAcknowledgement.svelte` with the other six. That is a reason
  to expect the same drawing, and not a reading.
- **9b-3 §6 item 1** (a hold established while the automatic read is out, re-adoption installed)
  and **§8's reachable recheck**: both need sub-second timing inside one read.
- **The 9b-2 review's NOT-VERIFIED item on `projectionReplaced` reactivity** under `$derived`:
  unread, for the same reason as the outlived origin.
- **A composited, visible window, real input and wake or resume delivery.** Ruling 38 *requires* a
  visible window, so its absence is a deviation from the ruling and not only an unread state
  (notes §3, §6 item 7); the ruling excludes wake or resume delivery from any claim. Controls were
  pressed with `HTMLElement.click()`.

## 8. Privacy

Only synthetic fixtures under `/private/tmp` were read or written. The transcripts carry harness
paths and synthetic content only. `tests/corpus/real/` was not touched.
