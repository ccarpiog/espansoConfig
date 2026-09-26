# Phase 3-14 — Delete-conflict wording and action placement

**Spec:** `docs/decisions/3-split-notes.md` §2 *3-14* and §4.4; `docs/decisions/2d-7-9-notes.md` §7 items
1–2; `docs/decisions/2d-7-9-window-reading.md` §5.1.

## 0. The owner's rulings, verbatim (quoted before any change)

Given 2026-09-26 in the attended session, as answers to two multiple-choice questions; the chosen
option's label and text are the ruling. Copied from `PROGRESS.md`'s Next action:

- **CF-52.** Asked *"CF-52: the delete panel's conflict choice buttons are below the fold at 1180x728. What should 3-14 do?"*, the owner chose **"Move choices up (Recommended)"** — *"Draw the choice row before the long disk-version comparison so it is visible at 1180x728 in EN and ES; keyboard order and focus unchanged."* (The other option was "Leave as is".)
- **CF-54.** Asked *"CF-54: the two opening paragraphs of the external-conflict delete panel repeat each other. What should 3-14 do?"*, the owner chose **"Merge into one (Recommended)"** — *"Keep one paragraph that carries every distinct fact (came from watching the file; changed while open; no save initiated, nothing written from here; cannot say what or when), in EN and ES."* (The other option was "Leave as is".) The two paragraphs are `browser.conflictOrigin.changedWhileOpen` and `browser.externalConflict.fileChangedWhileOpen`.

CF-53's labels are kept (§4.4; ruling 33).

**Risk:** routine. The window reading is [`3-14-window-reading.md`](3-14-window-reading.md).

---

## 1. What changed, and why

### 1.1 CF-54 — one opening paragraph on the external-conflict delete panel

**The two keys are shared, so the shared keys and producers were left alone.**

- `browser.conflictOrigin.changedWhileOpen` is produced by `conflictOriginMessageKey` in
  `src/lib/browser/conflictSource.ts`.
- `browser.externalConflict.fileChangedWhileOpen` is produced by `externalConflictMessageKey` in
  `saveOutcome.ts`, as element 0 of every `describeExternalConflict` model.
- Both are drawn by every external-conflict surface: the editor, the creator, the mover, the duplicator,
  the raw editor and the recovery panel.
- `fileChangedWhileOpen` is also the refusal sentence of `creationRefusalKey`, `recoveryRefusalKey`, the
  duplication refusal and `restore.ts`, where no origin line stands beside it.
- A shared rewrite would therefore have changed six panels the ruling does not name, and would have left
  those refusal sentences shorter. It was not clearly right, so **only the delete panel's drawing changed**.

The change:

- **New key** `browser.matchDeletion.changedWhileOpen` (EN and ES). It carries every distinct fact the
  ruling lists:
  - the conflict came from watching the file;
  - the file changed on disk while this panel was open;
  - no save was initiated in response, so nothing was written from here in response to it;
  - this app cannot say what changed the file or when.
  - The only words `fileChangedWhileOpen` had that the origin line lacked were *"this file"* and *"this
    panel"*; the merged sentence says *"this panel"* where the origin line said *"this"*.
- **`externalLinesUnderMergedOpening`** in `src/lib/browser/matchDeletion.ts` (new, pure) answers the
  external model's lines without `fileChangedWhileOpen`, in their own order.
- `MatchDeleter.svelte`'s external panel draws the merged paragraph first, then those lines. The save
  panel's origin line (`refusedSave`) is unchanged.
- No key became unused: both old keys are still drawn by the other surfaces.

**The merged sentences:**

- **EN:** *What is compared here came from watching the file: it changed on disk while this panel was
  open. No save was initiated in response to this observation, so nothing was written from here in
  response to it, and this app cannot say what changed the file or when.*
- **ES:** *Lo que se compara aquí viene de la vigilancia del archivo: cambió en el disco mientras este
  panel estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, así que desde
  aquí no se ha escrito nada como respuesta a ella, y esta aplicación no puede decir qué cambió el archivo
  ni cuándo.*

### 1.2 CF-52 — the choice row before the disk version

**What moved.** In `MatchDeleter.svelte`'s shared `comparison` snippet, which is drawn by both the save
and the external panel, three things now come after the operation block and before *The version on
disk*:

- the second step's warning (`reloadIdentifiesNoSnippet`);
- the reload-unavailable line;
- the choice row.

**Done in the markup, not with CSS `order`**, so the order on screen and the Tab order stay the same order.
What the ruling's *"keyboard order and focus unchanged"* holds to:

- **The row's own order is unchanged:** *Leave this as it is · Keep what I asked for · Load the version
  on disk* (the second step: *… · Close this and load it*).
- **No control gained or lost reach.**
- **In every state except one, the Tab order of the whole panel is identical to before**, because the
  disk text holds no focusable element. The mounted suite pins the sequence for both origins.
- **Focus:** nothing in the change calls `focus()`, and nothing did before. `revealOutcome`'s scroll
  targets (panel start; the row's end at the second step) are the same bound elements.

**The one relative change — a deviation for the owner to see.** Under an unknown write outcome, the
external panel draws *I have reviewed this snapshot* directly under the snapshot (2d-6-9b-2). In that
state only *Leave this as it is* is offered. That button now comes **before** the acknowledgement, in
Tab order and on screen alike; before this change it came after it.

- Keeping the old Tab order would have needed CSS `order`, which puts Tab order against the screen
  order.
- Or it would have needed moving the acknowledgement above the snapshot it asks the person to review.
- Both were judged worse than this one swap. The mounted suite pins the new order
  (`keeps the acknowledgement under the snapshot, after the row…`).

### 1.3 The readiness line stays under the disk version (found by the window reading)

The first instrumented build moved the *Keep what I asked for* readiness line up with the row. Launch L01
(EN) showed that line's **shared** sentence (`browser.reapply.readyOperation`, also drawn by the mover and
the duplicator) saying *"…the version of this file on disk **shown above**"* — while the disk version was
now drawn below it. A false sentence is this project's worst defect class. The shared key is correct
where it is drawn under the disk text, so:

- the readiness line was left **under the disk version** (after the acknowledgement slot);
- the build was redone;
- L02–L05 were taken on the corrected build.

No other sentence the delete panel draws refers to a position (checked: no `above`/`below` in the
`saveOutcome`, `reapply`, `matchDeletion`, `conflictOrigin` or `externalConflict` strings it draws, other
than `readyOperation`).

### 1.4 Tests

- `src/lib/components/MatchDeleter.test.ts`:
  - The external case and the language-switch case now expect the merged paragraph, and neither old
    sentence.
  - The save-origin case also asserts the merged paragraph is absent.
  - **New suite** (*Phase 3-14*), EN and ES, 8 cases:
    - the save conflict's row precedes the disk heading and the file text at both reload steps, with
      the warning above the row, and the whole panel's button order;
    - the external conflict's row precedes the disk version, the readiness line follows the file
      text, and the button order;
    - the acknowledgement state's order;
    - the merged paragraph drawn exactly once, first, followed by the model's remaining lines, and
      neither replaced sentence present.
- `src/lib/components/DetailPane.test.ts`: the operation-panel case, for `matchDeleter` only, expects the
  merged paragraph. The mover and duplicator arms are unchanged.
- `src/lib/browser/matchDeletion.test.ts`: 2 cases for `externalLinesUnderMergedOpening`.
- **What jsdom cannot show** is where the row lands in a window; §2 and the window reading are that
  evidence.

## 2. The window half — rows classed (a model's look)

All at a 1180x728 viewport. Full detail is in [`3-14-window-reading.md`](3-14-window-reading.md).

| Row | EN | ES |
|---|---|---|
| External panel, first step: row visible, before the disk version | **read** L02 `c15` (row 333–356) | **read** L03 `c16` (350–373) |
| External panel, second step: row visible | **read** L02 `c20` (653–676) | **read** L03 `c20` (667–689) |
| External panel: merged paragraph once, old sentences absent | **read** L02 `c15` | **read** L03 `c16` |
| Save panel, first step: row visible, before the disk version | **read** L04 `c19` (474–496) | **read** L05 `c19` (491–513) |
| Save panel, second step: row visible | **read** L04 `c24` (666–688) | **read** L05 `c24` (666–689) |
| Keyboard order | **read in part** (DOM order on the badge; no real Tab) | **read in part** |
| Focus; real input; wording acceptance by a person | **unread** | **unread** |
| Readiness line under the disk version; unknown-outcome acknowledgement order | **unread** (below the fold / not staged; pinned by the mounted suite) | **unread** |

**Acceptance against §2 *3-14*:**

- *Rulings quoted first:* met (§0 was written before any source edit).
- *Choices visible at 1180x728 in EN and ES before the long comparison:* met, for both origins at both
  reload steps, as the app's own reveal left the pane.
- *Keyboard reach and focus unchanged:* reach met. Order met except the one recorded swap (§1.2). Focus
  unchanged by construction; unread in a window.
- *Repeated opening removed without losing a distinct fact:* met.
- *Save-origin and external-origin panels both read:* met.

## 3. The instrument — uncommitted, deleted after the launches

A new, untracked `instrument-3-14/` at the repository root was rebuilt from 3-13-3's copy
(`/private/tmp/3-13-3/instrument-copy/instrument-3-13-3/`). **No tracked file was edited to host it.** It
was never `git add`ed, and no hook in `src/` exists.

It adds one thing to 3-13-3's arrangement: a `resolveId` hook. For `src/lib/ipc/commands.ts` only, it
resolves `@tauri-apps/api/core` to `core-shim.ts`, which re-exports the real module and can hold one
`delete_match` call. That is the save-origin route.

It was deleted with `rm -r instrument-3-14` after the five launches. A verified byte copy is kept at
`/private/tmp/3-14/instrument-copy/instrument-3-14/` (the two SHA-256 lists compare identical). Its files:

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-3-14/vite.config.ts` | `c0b493f80dd6c020992c3a3ed61e626771968e1f3420f27e0ded0c2a54aa4da5` | wraps the tracked config; injects `probe.ts` before `src/main.ts`; the `resolveId` hook for the shim |
| `instrument-3-14/core-shim.ts` | `c072cdbe90260a9d880d2017a8a168cc1e439913b1d5f3a8f3f92ed2188557d8` | the real `@tauri-apps/api/core`, with an optional hold before `delete_match` |
| `instrument-3-14/probe.ts` | `d3bd2c5effadb80e80b95abd65bc5d3d9dd3254765876e4693c2e801b822fdd9` | the page driver and the badge |
| `instrument-3-14/probe.css` | `351549cdb5e243feabceccabceea5d4bea9e94c7305d0e3d5078bd14573716be` | the badge's stylesheet |
| `instrument-3-14/launch.sh` | `c24753e9e4419a6b9e85e681b9500429b477f91c9557674008a228d38adc30b6` | one launch: scratch tree, lock checks, the second writer, captures |
| `instrument-3-14/fixtures/config/default.yml` | `33be5a1cca1dce83ba851e8224443d117fc42e785b803373241edbe807204f41` | one comment line |
| `instrument-3-14/fixtures/match/sample.yml` | `c92afa29d6b0c95688069c21cece5e20a728c0cd963b946cef0ab97d151df7b9` | 26 synthetic snippets (`:alpha` … `:zulu`) |

**Outside the repository:**

- `/private/tmp/3-14/winid`, a byte copy of 3-13-3's helper
  (`96d06e69b448038dcface5523843d09d911469ff322fdca716886b40b75878e3`, the hash 3-13-3 recorded);
- the scratch trees `L01` … `L05`;
- `instrument-sha256.txt`, `copy-sha256.txt`, `ls-before.txt` and `ls-after.txt`;
- the logs `build.log` and `build2.log` (instrumented, 217 modules each: the tracked 214 plus `probe.ts`,
  `probe.css` and `core-shim.ts`), `check-pre.log`, `vitest-pre.log`, `plain-build.log`, `check.log`,
  `vitest.log` and `gates.txt`.

**Build:** `npx tauri build --debug --bundles app --config
'{"build":{"beforeBuildCommand":"npx vite build --config instrument-3-14/vite.config.ts"}}'`, exit 0, twice
(the second after §1.3). The instrumented bundle lives in the gitignored `target/debug/bundle/`. `dist/`
was then rebuilt by the plain `npm run build` gate (214 modules). The probe's strings (`probe314`,
`probe-314`, `instrument-3-14`, `__probe`) are absent from `dist/`.

**Isolation:**

- The espanso configuration and the app data were scratch: `XDG_CONFIG_HOME` and `HOME` under
  `/private/tmp/3-14/L<n>/`, read back with `ps -E`.
- The webview's `localStorage` follows the bundle identifier (`CLAUDE.md` §6), so the language was set
  through the picker in every launch.
- The owner's configuration was never opened.

**Deletion evidence:**

- `/private/tmp/3-14/ls-before.txt` (10:38:46, before the instrument existed) and `ls-after.txt`
  (10:46:34, after `rm -r`) each hold `ls -a` of the root and `git status --short --untracked-files=all`.
- `diff` reports only the timestamp line.
- `ls -d instrument-3-14` afterwards answers *No such file or directory*.
- `pgrep -fl espansoconfig` found nothing.

## 4. Deviations

1. **The Tab-order swap in the unknown-outcome state** (§1.2): the ruling's *"keyboard order unchanged"*
   holds in every other state, and this one state follows the screen instead. **Accepted by the owner on
   2026-09-26**, verbatim: asked *"In the unknown-outcome state, 'Leave this as it is' now comes before 'I
   have reviewed this snapshot' (screen and Tab alike). Accept?"*, the owner chose **"Accept the swap
   (Recommended)"** — *"Tab order follows the screen; the acknowledgement stays under the snapshot it
   refers to. Recorded as an owner-accepted deviation from 'keyboard order unchanged'."* (The other option
   was "Restore old Tab order".)
2. **The readiness line did not move with the row** (§1.3). Its shared sentence says *"shown above"*,
   and moving it would have made that sentence false.
3. **The save-origin conflict needed an instrument hold** on the `delete_match` IPC call (13 s), because
   the window's watcher otherwise raises an external conflict first. The conflict itself is the core's
   real answer; only the timing of the call was the instrument's.
4. **L01 is superseded** (taken on the first build) and credited for nothing but §1.3's finding.
5. **The Rust gates were not run:** no Rust file changed. `dictionary_contract.rs` covers Rust variants,
   not TypeScript-only keys.

## 5. Open items (noticed, not fixed here)

1. **The same repeated opening exists on the six other external-conflict surfaces** (editor, creator,
   mover, duplicator, raw, recovery): each draws the origin line and `fileChangedWhileOpen` one after the
   other. The ruling named only the delete panel. A shared change — merging the two keys, while keeping
   `fileChangedWhileOpen` for the refusal sentences that draw it alone — is an owner question for a later
   phase.
2. **After *Leave this as it is* on a save-origin conflict**, the deleter puts the outcome away and
   offers *Delete this snippet* again. The pane keeps saying the file is not reconciled (L04 `c28`,
   L05 `c28`). This is the pre-existing `keepEditing` → `dismissDeletionOutcome` path; whether a person
   reads it as intended is a wording/flow question.
3. **The same fold likely exists on the mover and the duplicator**, which draw the same comparison
   shape. They were not read here, and CF-52 names only the delete panel.
4. **Carried unchanged:** the open items `PROGRESS.md`'s Next action lists for 3-14 (3-13-3 notes §5,
   including the candidate defect *Create* writes `word: 'true'`, and the earlier lists).

## 6. Gates (the tree as left, instrument deleted)

Output went to files under `/private/tmp/3-14/`. Exit statuses were read from the tool, not through a
pipe, and are recorded in `gates.txt`.

| Command | Exit | Result |
|---|---|---|
| `npm run check` | 0 | 487 files, 0 errors, 0 warnings |
| `npm test` | 0 | 88 files, 4074 passed |
| `npm run build` | 0 | 214 modules |
| `cargo test --workspace -- --test-threads=1` | not run | no Rust file changed |

Bundle oracle: `rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js` found nothing, and
`rg -c 'window\.__svelte|svelte-trusted-html'` answered 2. No probe string was found in `dist/`.

**Rung: `1555 / 487 / 4074 / 214`**. The Rust figure is carried from 3-15-1 (not re-run, §4 item 5).
vitest rose by 10: 8 mounted cases and 2 model cases.
