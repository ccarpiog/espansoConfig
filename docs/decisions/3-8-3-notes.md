# Phase 3-8-3 — The local raw UI: the window half

**Spec:** `docs/decisions/3-split-notes.md` §2 *3-8* and its 2026-09-24 addendum (the 3-8-3 bullet), §3
rulings 30 and 31, §4.1, §4.2; `docs/decisions/3-8-2-notes.md` §5 item 1 (what the components draw).
**Risk:** high. **Records only in tracked files.** The launch-by-launch reading is
[`3-8-3-window-reading.md`](3-8-3-window-reading.md). This phase closes step 3-8.

**No tracked source file changed.** The phase adds two records under `docs/decisions/` and an uncommitted
instrument (§2). `git status --short --untracked-files=all` shows, besides the two records, only
`PROGRESS.json` (the orchestrator's) and the five `instrument-3-8-3/` files.

---

## 1. What was done, and why

Step 3-8's window half (ruling 30) was taken on 2026-09-24 between 11:40:23 and 11:53:04, on an unlocked
screen, by a model reading `screencapture -l <window>` captures of the real Tauri window, in English and
Spanish with the language set through the in-app picker in every launch. Per §4.1 this is **a model's look**,
recorded as one; no owner judgement was sought or is claimed. Every action on the page was a
**script-dispatched DOM event**, not real input: nothing below concerns keyboard or pointer hit-testing, focus
or typing, and those stay **unread**. Mounted jsdom evidence (3-8-2 §4) is not credited here as a screen.

**CF-55's unread half (§4.2) is closed by this reading.** On both raw surfaces, under one held save, the probe
read the DOM state of *Undo*, *Redo*, *Save* and *Stop editing* and drew it into the badge **in the capture
that shows those controls**, so the DOM state and the pixels come from one launch and one moment. In EN and ES,
on `RawSnippetEditor` and on `RawEditor`: the DOM recorded all four `disabled`, the capture draws all four with
grey labels (against dark labels in the same launch before the save), synthetic presses on *Undo*, *Redo* and
*Stop editing* left the text box's value unchanged, and no discard confirmation was drawn. The 2d-7 observation
of *Stop editing* "drawn dark where the DOM recorded it disabled" does **not** reproduce on the current tree.

The configuration was synthetic: byte copies of three committed corpus fixtures, copied per launch under
`/private/tmp/3-8-3/L<n>/xdg/espanso/match/`, reached through `XDG_CONFIG_HOME` with `HOME` also pointed into
the scratch tree. The corpus files were only read. Captures stay in `/private/tmp/3-8-3/`, following 3-6-3's
precedent; none is in the repository.

## 2. The instrument (ruling 30) — uncommitted, in the tree through the review

A new, untracked directory; **no tracked file was edited to host it**, and it was never `git add`ed. It
follows 3-5-2-2 notes §2 and 3-6-3 notes §2: the build wraps the tracked Vite configuration and injects one
module into `index.html` at build time; the plan and language are read from the synthetic match file's name in
the sidebar, so no Rust, IPC or `src/` change was needed. **No temporary hook in `src/` exists.** The save is
held from the probe by wrapping `window.fetch`, which is Tauri's IPC transport on macOS (the `invoke` and
`ipc` properties Tauri defines are non-writable). **It stays in the tree through this phase's single review and
is deleted afterwards**, from the repository root, with:

```sh
rm -r instrument-3-8-3
```

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-3-8-3/vite.config.ts` | `4afbb6679af7436e8018b52a05b0e9f8d46c17571cf6b1b131ae28460c1c4da9` | wraps `../vite.config.ts`, adds a `pre` `transformIndexHtml` plugin injecting `probe.ts` before `src/main.ts` |
| `instrument-3-8-3/probe.ts` | `5ab9c18d6a98d33747a76a939f19fab50884c8ac141bdf206ac64f35d1ea4d07` | the page driver: picker, rows, buttons by exact dictionary text (imports `src/lib/i18n/{en,es}.json`), `input` events, the `fetch` hold, the DOM line, the badge |
| `instrument-3-8-3/launch.sh` | `d571662bd84921bd6c9515127a69dbf023bb8df7565f0ee770535e7f306ed538` | one launch: scratch tree, fixture byte copy, fresh bundle copy, `open -n --env`, lock checks, captures, quit, disk compare |
| `instrument-3-8-3/winid.swift` | `65c69a41c4f5a4f41ada2192fee2dd3bc48bea1b4fbff4e9a6415662bff6f230` | prints the app's CoreGraphics windows (id, layer, on screen, size, title) for `screencapture -l` |
| `instrument-3-8-3/default.yml` | `e7c2eebc61f8423ef392302ffda1b51c0a32e2d04cc550cdb172b38eebc2438f` | synthetic `config/default.yml` (one comment line) |

Outside the repository: `/private/tmp/3-8-3/winid` (compiled from `winid.swift`,
`96d06e69b448038dcface5523843d09d911469ff322fdca716886b40b75878e3`), the helpers
`/private/tmp/3-8-3/run.sh` (`2cead6c0413a566e41363a5b42eb48c54bc77c649d3b11f39a6d275cedf35633`) and
`/private/tmp/3-8-3/post.sh` (`0f4a88c516d904b5e1040c665bcefa32fc85017c92a32aa447f9b48633b62322`), the scratch
trees `/private/tmp/3-8-3/L01` … `L10` (each with its bundle copy, `caps/`, `small/`, `badge/`, `launch.txt`,
`before.yml`, `after.yml`, and the comparison crops named in the reading), and the build logs
`/private/tmp/3-8-3/build.log`, `build2.log`, `build3.log`.

**Build:** `npx tauri build --debug --bundles app --config
'{"build":{"beforeBuildCommand":"npx vite build --config instrument-3-8-3/vite.config.ts"}}'` (205 modules: the
tracked 204 plus `probe.ts`; the two dictionaries were already in the graph), built three times (binaries A, B,
C in the reading; only C is credited). The instrumented bundle lives in the gitignored `target/debug/bundle/`
and must not be read as a plain build; `dist/` was rebuilt by the plain `npm run build` gate afterwards (204
modules; the probe's strings `383 t=` and `probe-383` are absent from `dist/`).

## 3. Launches and the lock state per launch

Lock state was read with `ioreg -n Root -d1` before each launch, before every capture and after the launch
(`launch.txt`). **Every reading in every launch was `"IOConsoleLocked" = No`**; no capture was stopped for a
lock. The screen was `No` at the phase's start (11:35:12) and after the last launch (11:54:09).

| Launch | Plan | Lang | Fixture copied | Window | Captures (times) | Lock before / captures / after | Binary | Status |
|---|---|---|---|---|---|---|---|---|
| L01 | snippet | EN | `block-scalars.yml` | 9642 | 45 (11:40:24–11:41:17) | No / No / No | A | exploratory, not credited |
| L02 | snippet | EN | `block-scalars.yml` | 9653 | 48 (11:43:05–11:44:01) | No / No / No | B | exploratory, not credited |
| L03 | snippet | EN | `block-scalars.yml` | 9664 | 48 (11:44:39–11:45:34) | No / No / No | C | read |
| L04 | snippet | ES | `block-scalars.yml` | 9677 | 48 (11:46:43–11:47:39) | No / No / No | C | read |
| L05 | whole | EN | `block-scalars.yml` | 9688 | 48 (11:47:46–11:48:43) | No / No / No | C | read |
| L06 | whole | ES | `block-scalars.yml` | 9699 | 48 (11:48:50–11:49:46) | No / No / No | C | read |
| L07 | holed | EN | `run-based-removal-boundaries.yml` | 9710 | 36 (11:49:57–11:50:39) | No / No / No | C | read |
| L08 | holed | ES | `run-based-removal-boundaries.yml` | 9721 | 36 (11:50:45–11:51:26) | No / No / No | C | read |
| L09 | cr | EN | `file-comments-and-mixed-endings.yml` | 9732 | 36 (11:51:32–11:52:14) | No / No / No | C | read |
| L10 | cr | ES | `file-comments-and-mixed-endings.yml` | 9743 | 36 (11:52:20–11:53:02) | No / No / No | C | read |

## 4. The rows (a model's look; never mounted evidence, never a hidden page)

Paths are `/private/tmp/3-8-3/L<n>/small/cNN.png` unless named. Each "read" cites the capture and the DOM line
drawn in it; the lines are quoted in full in the reading.

| Row | EN | ES |
|---|---|---|
| (1) `RawSnippetEditor` over a contiguous snippet: load | **read** — L03 `c12`: scope sentence, *Starts at line 48*, the seven owned lines with the leading comment block and the block's interior blank line; DOM `undo=off redo=off save=off close=on … box=editable text=257:3527a417` | **read** — L04 `c12`, same DOM line |
| (1) draft | **read** — L03 `c16` (`edits=AB unsaved=1`), `c19` (`undo=on redo=on save=on close=on … edits=A-`), all four controls dark, *Unsaved changes* | **read** — L04 `c16`, `c18`; *Cambios sin guardar*; *Dejar de editar* on its own row |
| (1) save | **read** — L03 `c34`: *The file was written. What is on disk now is exactly the text that was sent.*, *Dismiss*; DOM `unsaved=0 … held=save_match_item_text`; disk diff one line (`54c54`, `EDIT-A`) | **read** — L04 `c33`, *Se ha escrito el archivo…*; the same one-line diff |
| (2) Disjoint ownership (`ItemRangeNotContiguous`) refusal with the offer of the file's text view | **read** — L07 `c12` (`:leading-comment-block`), `c20` (`:folded-above-a-shallow-comment`): the range sentence, **Go to the whole file's text**, no box, no save (`rangeNotContiguous=1 offer=on textareas=0 save=none`); after pressing the offer, `c22`/`c24`: the file text view with **Edit this file's text** (`fileText=1 rawEditorOpen=1`) | **read** — L08 `c12`, `c20`, *Ir al texto del archivo completo*; `c25`, *Editar el texto de este archivo* |
| (3) `\r` refusal | **read** — L09 `c12` (`:crlf-anchor`): the carriage-return sentence, no fallback offer, no box (`lineEndings=1 offer=none textareas=0`); `c21`: the LF-only `:ends-the-file` of the same file opens (`box=editable text=73:0478bf24`); `c27`: the file view's own `\r` refusal, no *Edit this file's text* (`rawEditorOpen=0 rawEditorCr=1`) | **read** — L10 `c12`, `c21`, `c27` |
| (4a) CF-55 on `RawSnippetEditor`: *Undo*/*Redo* and *Stop editing* under a held save, DOM and capture in one launch | **read** — L03 `c25`: DOM `undo=off redo=off save=off close=off saving=1 cannotStop=1 … box=readonly … held=save_match_item_text unchangedByPresses=1`; drawn: all four grey (full-resolution crops `L03/cmp-head.png`, `cmp-btn.png`), *This save cannot be stopped…*, *Saving…*, no discard panel; `c27` `unchangedSincePresses=1`; `c29` same drawing | **read** — L04 `c25` (same DOM line, `unchangedByPresses=1`), all four grey (`L04/cmp-1825.png`), *Este guardado no se puede detener…*, *Guardando…* |
| (4b) CF-55 on `RawEditor` | **read** — L05 `c25`: DOM `undo=off redo=off save=off close=off saving=1 cannotStop=1 … held=save_raw_document unchangedByPresses=1`; drawn: all four grey against dark in `c19` (`L05/cmp-controls.png` rows 1–4); `c27` `unchangedSincePresses=1`; outcome `c33` | **read** — L06 `c25`, same DOM line; *Dejar de editar* grey against dark in `c19` (`cmp-controls.png` rows 5–6); outcome `c33` |
| (5) One hard fixture shape (R38, ruling 31) | **read** — three: the `\|` block with an interior blank line under a leading comment block (`block-scalars.yml`, L03, L05: the save changed one line and nothing else); the file-owned comments inside a hull (`run-based-removal-boundaries.yml`, L07); CRLF lines among LF ones with no final line break (`file-comments-and-mixed-endings.yml`, L09) | **read** — L04, L06, L08, L10, same |

**The exact screens and actions (ruling 31)** are in the reading under each launch pair's heading.

**Unread, and why:** real keyboard and pointer input on every control (§4.1 reserves it to a person); what
pressing *Redo* after a committed save does (open item 1; not pressed); the discard confirmation over a dirty
draft (not driven); *Edit this file's text* pressed from the fallback route of row 2 (the whole-document editor
itself is read in row 4b over another file); the send failure, uncertain-write reconciliation, conflict and
stale-identity panels of the snippet editor (outside 3-8-3's acceptance; not driven); the trailing-blank-line
refusal (not driven); and whether the drawn grey reads clearly as "unavailable" to a person (a layout judgement
reserved to a person). The hold delays the IPC **request**: a save held inside Rust (for example behind the save
lock) was not produced, though the page's `saving` state it draws is the same.

**ES fit.** Nothing was seen clipped in Spanish. In the snippet editor *Dejar de editar* moves to its own row
under the file name when *Cambios sin guardar* is shown (L04 `c18`, `c25`); the `\r` sentence takes three
lines in ES against two in EN (L10 `c12`, L09 `c12`).

## 5. Open items (noticed, not fixed here)

1. **Redo stays enabled after a committed save, on both raw surfaces** (L03 `c34`, L04 `c33`, L05 `c33`, L06
   `c33`: DOM `undo=off redo=on`, *Redo* drawn dark). The undone `EDIT-B` step survives the commit. This matches
   the documented rule of `savedDraft` in `src/lib/browser/draft.ts` ("the past is cut at it and the future is
   untouched"), so it is recorded as an observation, not a defect; whether a person expects *Redo* to re-apply
   a pre-save step over the saved text is a question for the owner. Pressing it was not driven.
2. **The holed fixture's fallback lands on the file text view, not in the editor** — as 3-8-2 D4 decided; the
   person presses *Edit this file's text* next. Recorded only because the offer's label (*Go to the whole file's
   text*) and the refusal's sentence (*The whole file's text can be edited instead*) promise editing one press
   away; a wording question for the owner.
3. **Both snippets of `run-based-removal-boundaries.yml` are refused as disjoint**, including
   `:leading-comment-block`, whose file-owned comment sits inside `vars`. No snippet of that file can be edited
   locally; the whole-document editor is the only raw route. Expected by `raw_item.rs`'s rule; noted for the
   owner.
4. Carried from `3-8-2-notes.md` §5, unchanged by this reading: **item 3** (no recovery sentence on this
   surface), **item 4** (a stale identity is terminal on this surface), **item 5** (the pane's captured identity
   is the opening one), **item 6** (the line count is not drawn, so 3-8-1 §5 item 7 has no reader), **item 7**
   (3-8-1 §5 item 6: `reconcileWithDisk` under an external conflict leaves the conflict standing).
5. Carried from `3-6-3-notes.md` §4 item 1 (not this phase's scope): a draft holding a list-item addition never
   drew the external-change panel. Not exercised here.
6. Unread and owed to a later reading if wanted: everything in §4's *Unread* paragraph.

No candidate defect was found in this reading.

## 6. Deviations

- **L01 and L02 were exploratory** and are not credited: binary A's badge was dropped by the app's CSP
  (`style-src 'self'` ignores a `style` attribute) and its DOM lines were read before Svelte flushed; binary B
  still had the unstyled badge and a `d4-undo` step that did not press. Binary C fixed all three.
- The DOM lines are **transcribed from the badge in the capture**, not logged to a file: the window title did
  not follow `document.title`, so the capture is the one carrier of each line.
- Row 2 used two snippets of one fixture instead of one; row 3 added the LF-only snippet of the CR file and the
  file view's refusal, both cheap in the same launch.

## 7. Gates (run with the instrument present, after the last launch)

| Command | Exit | Result |
|---|---|---|
| `cargo test --workspace -- --test-threads=1 > /private/tmp/3-8-3-cargo.log 2>&1` | 0 | 33 `test result: ok` lines, 1465 passed, 0 failed, no `FAILED` |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | |
| `cargo fmt --check` | 0 | |
| `npm run check` | 0 | 470 files, 0 errors, 0 warnings |
| `npm test` | 0 | 3773 passed, 78 files |
| `npm run build` | 0 | 204 modules; server-only oracle: absent; client-only oracle: 2; no probe string in `dist/` |

`cargo tree -p espansoconfig-core | rg tauri` printed nothing. **Rung with the instrument in the tree:
`1465 / 470 / 3773 / 204`.** The instrument contributes **nothing** to any gate: it lies outside
`tsconfig.json`'s `include` (`src/**`, `scripts/lint/**`), outside vitest's `include`
(`src/**/*.test.ts`, `scripts/lint/**/*.test.ts`), outside every lint scan root (`src`, `scripts`), and is
imported by neither `index.html` nor `vite.config.ts`; only the instrumented Tauri build counts it (205
modules). **The harness-free rung after `rm -r instrument-3-8-3` is therefore expected to be `1465 / 470 /
3773 / 204`**, unchanged from the last committed rung.

## 8. Review and closure

The phase's single review ran through `autoclaude-review.sh`, which **exited 0 — Codex**, no fallback:
**`ship`, 0 findings** ([`docs/reviews/phase-3-8-3.md`](../reviews/phase-3-8-3.md), brief
[`phase-3-8-3.brief.md`](../reviews/phase-3-8-3.brief.md)). After the review the instrument was deleted
with `rm -r instrument-3-8-3`, as §2 prescribes; it was never committed. The scratch trees and captures
under `/private/tmp/3-8-3/` are outside the repository and are left for inspection. The harness-free rung
is `1465 / 470 / 3773 / 204`, unchanged from 3-8-2. Step 3-8 closes with this phase.
