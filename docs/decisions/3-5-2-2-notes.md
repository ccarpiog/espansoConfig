# Phase 3-5-2-2 — Scalar content and options: the window half

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-5" and its addenda of 2026-09-23 and 2026-09-24,
§3 rulings 30 and 31, §4.1; `docs/decisions/3-5-2-1-notes.md` (what the components draw).
**Risk:** high. **Records only in tracked files.** The launch-by-launch reading is
[`3-5-2-2-window-reading.md`](3-5-2-2-window-reading.md).

**No tracked source file changed.** The phase adds two records under `docs/decisions/` and an
uncommitted instrument (§2). `git diff --stat` touches only `PROGRESS.json` (the orchestrator's).

---

## 1. What was done, and why

Step 3-5's window half (ruling 30) was taken on 2026-09-24 between 07:13:29 and 07:23:34, on an
unlocked screen, by a model reading `screencapture -l <window>` captures of the real Tauri window, in
English and Spanish with the language set through the in-app picker in every launch, including one
block-scalar content conflict (ruling 31). Per §4.1 this is **a model's look**, recorded as one; no
owner judgement was sought or is claimed. Every action on the page was a **script-dispatched DOM
event**, not real input: no claim below concerns keyboard or pointer hit-testing, focus or typing, and
those stay **unread**.

The configuration was synthetic (three neutral snippets, `instrument-3-5-2-2/snippets.yml`), copied per
launch under `/private/tmp/3522/L<n>/xdg/espanso/`, reached through `XDG_CONFIG_HOME` with `HOME` also
pointed into the scratch tree; every capture read shows only the synthetic file names in the sidebar.
Captures stay in `/private/tmp/3522/`; none is in the repository.

## 2. The instrument (ruling 30) — uncommitted, reviewed, then deleted

**Deleted after the phase's single review** (`docs/reviews/phase-3-5-2-2.md`, Codex, `ship`). Before the
deletion the orchestrator re-hashed all six files with `shasum -a 256` and each matched the table below;
`rm -r instrument-3-5-2-2` then removed the directory, and `git status --short --untracked-files=all`
shows no instrument path. It was never committed. What stays outside the repository is listed below; the
instrumented debug bundle under the gitignored `target/debug/bundle/` is left until the next build
overwrites it and must not be read as a plain build.

A new, untracked directory; **no tracked file was edited to host it**. The build wraps the tracked Vite
configuration and injects one module into `index.html` at build time; the plan and language are read from
the synthetic match file's name in the sidebar, so no Rust or IPC change was needed.

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-3-5-2-2/vite.config.ts` | `25ee0b35a8446e4ef32b0ac3190f5932ff1ec85c0de60c466741c5cae2782d1f` | wraps `../vite.config.ts`, adds a `pre` `transformIndexHtml` plugin injecting `probe.ts` |
| `instrument-3-5-2-2/probe.ts` | `780f3b703b51dfba8bbb0f68e247532d4779a26e30a1879c272440466249f47a` | the page driver: picker, row, *Edit*, scrolls, clicks, the badge |
| `instrument-3-5-2-2/launch.sh` | `1e483236e1f32ddb08c5b5b46aca200d6bba82bfec70b7158b011225ae1efb68` | one launch: scratch tree, fresh bundle copy, `open -n --env`, lock checks, captures, disk rewrite |
| `instrument-3-5-2-2/winid.swift` | `3097b1fb3ba51f7df94881a98eb51b1a066105fe9e1a7d1c9d6c9c1f66a33639` | prints the app's CoreGraphics windows for `screencapture -l` |
| `instrument-3-5-2-2/snippets.yml` | `e6e3bf03bc9e2125c98886c25c40affb5e6e762b3c50d124bd76646cbbd70ab9` | the synthetic match file |
| `instrument-3-5-2-2/default.yml` | `0246b19ca6b638e6d7bd9eb1522094f5f847aace5baafe190340bb6545b50c8d` | the synthetic `config/default.yml` (one comment line) |

Outside the repository: `/private/tmp/3522/winid` (compiled from `winid.swift`,
`bed7107f2113aeb121635682c3a9e84df5c5685e5a38aa77398fe77fda66531c`), the scratch trees `/private/tmp/3522/L01` …
`L10`, and the build logs `/private/tmp/3522/build.log`, `build2.log`.

**Build:** `npx tauri build --debug --bundles app --config
'{"build":{"beforeBuildCommand":"npx vite build --config instrument-3-5-2-2/vite.config.ts"}}'`
(201 modules: the tracked 200 plus `probe.ts`). The first build injected the tag after Vite's own HTML
processing and bundled nothing (200 modules); it was never launched. **Binary A**
(`5bbf4d31d16be3fce2a0945d7db42df3507b2699ced541631f6fb6297573b231`) ran L01 … L08; **binary B**
(`be514ea1dcae44531d1a8e1846cf1f3a23d39f42a32f30f60ef2180753c9dec0`) ran L09 and L10, after the conflict
plan's last steps were changed to scroll to the panel's headings and choices. The instrumented bundle lives
in the gitignored `target/debug/bundle/`, and `dist/` was rebuilt by the plain `npm run build` gate
afterwards (no probe string in it).

The probe draws a small badge in the bottom-left corner naming the step and the document's checkbox count.
It is instrument output, not the app's; it covers the left end of the status line only.

## 3. The launches and the lock state per launch

Lock state was read with `ioreg -n Root -d1` before each launch, before every capture and after the
launch. **Every reading in every launch was `"IOConsoleLocked" = No`, with no `CGSSessionScreenIsLocked`
key.** No capture was stopped for a lock.

| Launch | Plan | Lang | Window | Captures (times) | Lock before / all captures / after | Binary | Status |
|---|---|---|---|---|---|---|---|
| L01 | cursor | EN | 8890 | 14 (07:13:30–07:13:43) | No / No / No | A | read |
| L02 | cursor | ES | 8909 | 14 (07:13:56–07:14:09) | No / No / No | A | read |
| L03 | editor | EN | 8920 | 60 (07:14:15–07:15:14) | No / No / No | A | read |
| L04 | editor | ES | 8933 | 40 (07:15:32–07:16:11) | No / No / No | A | read |
| L05 | switch | EN | 8938 (wrong) | 40 | No / No / No | A | **void**: the window filter picked an off-screen 3072×30 window; nothing read |
| L06 | switch | EN | 8955 | 40 (07:17:14–07:17:54) | No / No / No | A | read |
| L07 | switch | ES | 8966 | 40 (07:18:17–07:18:56) | No / No / No | A | read |
| L08 | conflict | EN | 8977 | 66 (07:19:13–07:20:18); disk rewrite 07:19:26 | No / No / No | A | read in part (the panel's disk side not reached) |
| L09 | conflict | EN | 8988 | 62 (07:21:15–07:22:16); disk rewrite 07:21:28 | No / No / No | B | read |
| L10 | conflict | ES | 8999 | 62 (07:22:33–07:23:33); disk rewrite 07:22:45 | No / No / No | B | read |

**The last capture was taken at 07:23:33** (L10 `c62`).

## 4. The rows (a model's look; never mounted evidence, never a hidden page)

Paths are `/private/tmp/3522/L<n>/small/cNN.png` (1400-px copies) unless `caps/` is named.

| Row | EN | ES |
|---|---|---|
| (1) Sections: trigger and content, content kind, label and comment, the four textual option groups; *Insertion* holds `force_mode` and `force_clipboard` as two labelled text controls; no checkbox | **read** — L03 `caps/c07` (trigger, content), `c17` (content kind, then label and comment), `c12`, `c27`, `c32` (Word boundary, Capital letters, Insertion method with *Insertion mode* and *Force the clipboard (older setting)* as two labelled text boxes, Other); no checkbox seen in any capture, and every badge reads `checkboxes=0` | **read** — L04 `c03`, `c12`, `c07`, `c17`, `c32` (*Método de inserción* with *Modo de inserción* and *Forzar el portapapeles (ajuste antiguo)*); `checkboxes=0` |
| (2) Exact-string suggestion buttons for `uppercase_style` / `force_mode`; the unfamiliar-value sentence | **read** — L03 `c27`: `uppercase`, `capitalize`, `capitalize_words` under `shouting` with *"This value is not one of the suggested spellings. It is kept exactly as written."*; `clipboard`, `keys` under `clipboard` with no such sentence. Pressing a suggestion was not exercised (**unread**) | **read** — L04 `c17`, `c32`; the same buttons, spelled identically, and *"Este valor no es una de las formas sugeridas. Se conserva exactamente como está escrito."* Pressing: **unread** |
| (3) Content-switch preview (rename, text kept or edited, kept/removed companions), Confirm/Cancel, save disabled with its reason until confirmed | **read** — L06 `c08` (rename, *text kept*, kept companion `vars`, Confirm/Cancel), `c13` (save grey + *"This snippet cannot be saved until the change of content kind above is confirmed."*), `c23` (confirmed sentence), `c28` (save enabled, reason gone). The *text edited* variant and a removed-companion list were not driven (the latter is unreachable through the editor, 3-5-2-1 open item 3) | **read** — L07 `c08`, `c13`, `c23`, `c28`; same scope |
| (4) `$|$` control on `replace`; several-markers advisory with its count | **read** — L01 `caps/c06` (button + hint), `caps/c12` (*"This text holds 2 cursor markers ($|$)…"*). A single-marker insertion and its undo were not driven (**unread**) | **read** — L02 `caps/c12` (*"Este texto tiene 2 marcas de cursor ($|$)…"*); same scope |
| (5) One block-scalar content conflict (R38 touch, ruling 31) | **read** — see below; L08 `c06`, `c18`, `c23`; L09 `c35`, `c45`, `c50` | **read** — L10 `c06`, `c35`, `c50` |

**Row (5), the exact screen and action seen.** Screen: the small match editor (`MatchEditor.svelte`) in
the detail pane, open on snippet `:block`, whose `replace` is a `|` block scalar of two lines. Action:
the probe appended a third line to the *Replacement text* text area (an `input` event), the editor drew
*Unsaved changes*; then the launcher rewrote the file on disk, changing the block's second line
(`sed -i ''`, which writes a new file). **Without any save being pressed**, within four seconds the
window drew the external-change conflict panel below the editor (`MatchEditor.svelte`'s `comparison`
snippet): the sidebar row marked *Not reconciled* / *Sin conciliar*; the observation sentences (*"What
is compared here came from watching the file …"*); *"Your text is still here, exactly as you wrote it"*;
the reload warning and the observed revision; **What you wrote, kept here** with the three-line
*Replacement text* marked *this text would be written*; **The version on disk** showing the rewritten
block (`Second line, changed on disk.`); and the choices *Keep editing*, *Copy my text*, *Keep my
draft*, *Load the version on disk* (ES: *Seguir editando*, *Copiar mi texto*, *Conservar mi borrador*,
*Cargar la versión del disco*). The editor above turned read-only (boxes greyed, the cursor control no
longer drawn). **No choice was pressed**: reload, reapply, copy and keep-editing after a block-scalar
conflict remain **unread** in a window. What a *Save* click did in that state is **unread** (L08 §
in the reading).

**ES fit.** Nothing was seen clipped in Spanish. Longer ES text wraps: the switch buttons wrap to two
rows, *Confirmar…* and *Cancelar…* stack, the withheld-save sentence and the role sentences take an extra
line, *Dejar de editar* wraps under the file name when *Cambios sin guardar* is shown, and *Cargar la
versión del disco* wraps to a second row of choices. The one clipped line seen is language-independent
(open item 1).

## 5. Open items (noticed, not fixed here)

1. **The disk-version box does not wrap a long line**: the synthetic file's 74-character first line runs
   past the box's right edge and is cut, in EN and ES (L09 `c45`, L10 `c50`). Whether the box scrolls
   horizontally was not examined (no pointer input). A later phase should decide wrap vs. scroll.
2. **The conflict panel says the same thing twice**: *"What is compared here came from watching the file:
   it changed on disk while this was open. No save was initiated …"* and *"This file changed on disk while
   this panel was open. No save was initiated …"* both open the panel. A wording question for the owner
   (layout and wording acceptance are reserved to a person, §4.1).
3. **ES rename sentence reads without an article and with capitalised field labels mid-sentence**:
   *"Texto de sustitución pasará a ser Contenido en Markdown."* (EN: *"Replacement text will become
   Markdown content."*). For the Phase 3 translation-review inventory (ruling 29); the `{from}`/`{to}`
   operands are field labels, so the fix is in the sentence or in the operands, not here.
4. **3-5-2-1 open item 5, seen in a window**: a snippet with one content key draws four empty dormant
   content boxes (Markdown, HTML, Image path, Form layout) each with the role sentence, and the conflict
   panel repeats them as *left as the file has it* with empty boxes. They push the option groups far
   down. Whether to draw them is the owner's call.
5. *Change to: Form layout* is offered for a plain `replace` snippet; a switch to `form` was not driven.
   Noted only so a later phase can check the preview makes sense for that target.
6. Unread in this phase and owed to a later reading if wanted: real keyboard/pointer input on every
   control above; pressing a suggestion; the *text edited* preview variant; a single-marker insertion and
   its undo; every conflict choice after the block-scalar conflict; the save-press path of a conflict.

## 6. Deviations

- **L05 was voided** (wrong window captured) and re-run as L06; nothing from it is credited.
- **L08 was re-taken as L09** after the probe's last steps were changed; L08 is kept as a reading of the
  panel's top and of the read-only editor, and is credited only for what it shows.
- The conflict was raised by the watcher, not by a save that met a changed revision; the task's
  "the conflict surface drawn over it" was met by the watcher's panel. A save-time conflict was not
  produced.

## 7. Gates (run with the instrument present, after the last launch)

| Command | Exit | Result |
|---|---|---|
| `cargo test --workspace -- --test-threads=1 > /private/tmp/3-5-2-2-cargo.log 2>&1` | 0 | 30 `test result:` lines, 1419 passed, 0 failed, no `FAILED` |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | |
| `cargo fmt --check` | 0 | |
| `npm run check` | 0 | 463 files, 0 errors, 0 warnings |
| `npm test` | 0 | 3617 passed, 74 files |
| `npm run build` | 0 | 200 modules; server-only oracle: absent; client-only oracle: 2; no probe string in `dist/` |

`cargo tree -p espansoconfig-core | rg tauri` printed nothing. **Rung: 1419 / 463 / 3617 / 200**, unchanged:
the instrument lies outside `tsconfig.json`'s `include`, outside vitest's `include`, outside every lint
scan root (`src`, `scripts`), and is not imported by `index.html` or `vite.config.ts`.
