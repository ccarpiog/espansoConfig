# Phase 3-6-3 — Trigger forms and `search_terms`: the window half

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-6" and its 2026-09-24 addendum (the 3-6-3 bullet), §3
rulings 30 and 31, §4.1; `docs/decisions/3-6-2-notes.md` (what the components draw).
**Risk:** high. **Records only in tracked files.** The launch-by-launch reading is
[`3-6-3-window-reading.md`](3-6-3-window-reading.md).

**No tracked source file changed.** The phase adds two records under `docs/decisions/` and an uncommitted
instrument (§2). `git diff --stat` touches only `PROGRESS.json` (the orchestrator's).

---

## 1. What was done, and why

Step 3-6's window half (ruling 30) was taken on 2026-09-24 between 09:05:52 and 09:42:44, on an unlocked
screen, by a model reading `screencapture -l <window>` captures of the real Tauri window, in English and
Spanish with the language set through the in-app picker in every launch, including the commented multi-line
flow list at `flow-collections.yml:16-22` (ruling 31). Per §4.1 this is **a model's look**, recorded as one;
no owner judgement was sought or is claimed. Every action on the page was a **script-dispatched DOM event**,
not real input: no claim below concerns keyboard or pointer hit-testing, focus or typing, and those stay
**unread**. Mounted jsdom evidence (3-6-2 §4) is not credited here as a screen.

The configuration was synthetic: neutral instrument files (`instrument-3-6-3/*.yml`) or a byte-identical copy
of the committed corpus file `flow-collections.yml`, copied per launch under
`/private/tmp/3-6-3/L<n>/xdg/espanso/`, reached through `XDG_CONFIG_HOME` with `HOME` also pointed into the
scratch tree. Every capture read shows only the synthetic file names in the sidebar. Captures stay in
`/private/tmp/3-6-3/`; none is in the repository.

## 2. The instrument (ruling 30) — uncommitted, in the tree through the review

A new, untracked directory; **no tracked file was edited to host it**, and it was never `git add`ed. It
follows 3-5-2-2 notes §2: the build wraps the tracked Vite configuration and injects one module into
`index.html` at build time; the plan and language are read from the synthetic match file's name in the
sidebar, so no Rust or IPC change was needed. **It stays in the tree through this phase's single review and
is deleted afterwards**, from the repository root, with:

```sh
rm -r instrument-3-6-3
```

**Deleted 2026-09-24** by the orchestrator with that command, after the review (Codex, `ship`, 0 findings,
`docs/reviews/phase-3-6-3.md`) returned; `git status --short --untracked-files=all` then showed no
`instrument-3-6-3/` path. The instrumented debug bundle under `target/debug/bundle/` (gitignored build
output) and the captures under `/private/tmp/3-6-3/` were left in place.

| Path | SHA-256 | What it is |
|---|---|---|
| `instrument-3-6-3/vite.config.ts` | `dc734687a215da5e413fed853c6e8cbd05d11ac1cf2ecd2ca00d2266e3e272dd` | wraps `../vite.config.ts`, adds a `pre` `transformIndexHtml` plugin injecting `probe.ts` |
| `instrument-3-6-3/probe.ts` | `ce7eb57265c3176ab8cad37e2b8e82204b29da4ab371f4f1b0f6946e20366505` | the page driver: picker, rows, *Edit*, clicks by exact dictionary text, `input` events, scrolls, the badge |
| `instrument-3-6-3/launch.sh` | `c47f5b26e87be79efad0c7134e9562cc1b87f779b35f40417f8277582f1dadf2` | one launch: scratch tree, fresh bundle copy, `open -n --env`, lock checks, captures, disk rewrite |
| `instrument-3-6-3/winid.swift` | `b02ecf5860aed10462e48ef03dd0cb1ade13b6b43cfccc1ed0f068e5cb2a2bda` | prints the app's CoreGraphics windows for `screencapture -l` |
| `instrument-3-6-3/default.yml` | `745360423ccf8d3e678228c95a95f8e22abe700bd44bf0c71abb739ee1281d6d` | synthetic `config/default.yml` (one comment line) |
| `instrument-3-6-3/forms.yml` | `a210c62af891115c273350999e38b6374289ca75c2cbc40a177b24db7531bfcb` | `forms` plan |
| `instrument-3-6-3/refusals.yml` | `8b328d1098048fd9e68bc1f795730d002d0c29b1dcafd10c1462ede1fa7a91ef` | `refusals` plan |
| `instrument-3-6-3/presence.yml` | `88349f5179742f9e19dd9a8547a59b3f70c0f05b194547eb680cb3cd0b1fde6d` | `presence` plan |
| `instrument-3-6-3/lists.yml` | `91388e0d5c3f4004280ddbf50b8b61aa71a3bfb3d091691611c0e2149df244e5` | `lists` plan |
| `instrument-3-6-3/recovery.yml` | `0f863713916d0d60fb8b36ef6190091a8f958a09003391ef41d05997dde0e9c7` | recovery plans, before the disk rewrite |
| `instrument-3-6-3/recovery-after.yml` | `0619d426995e12b555c6bd99bdce3a6c55237b3dce7a70cd64c545d8573848ec` | the rewrite that removes the snippet |
| `instrument-3-6-3/recovery-collide.yml` | `74f5d4558fed01d44e9637040b061e7c6ec99d51210b773bc64bd779219c7372` | the rewrite that changes its trigger (L13 only) |

`probe.ts` also holds the exploratory recovery plans of L09–L21 (`recplain`, `reccollide*`, `recsed*`,
`recreplace`); they are dead after this phase and go with the directory.

Outside the repository: `/private/tmp/3-6-3/winid` (compiled from `winid.swift`,
`060bd976c90edcc121739abae8710169f22b2879661cdffb552222ffcfd52a2c`), the scratch trees
`/private/tmp/3-6-3/L01` … `L31` (each with its bundle copy, captures, `launch.txt`, `before.yml`, `after.yml`),
the helper scripts `/private/tmp/3-6-3/{badges.sh,run.sh,iso.sh}`, the pair images `/private/tmp/3-6-3/pairs/`,
and the build logs `/private/tmp/3-6-3/build.log`, `build2.log` … `build11.log`.

**Build:** `npx tauri build --debug --bundles app --config
'{"build":{"beforeBuildCommand":"npx vite build --config instrument-3-6-3/vite.config.ts"}}'` (202 modules:
the tracked 201 plus `probe.ts`), rebuilt eleven times as plans were added (binaries in the reading's table).
The instrumented bundle lives in the gitignored `target/debug/bundle/` and must not be read as a plain build;
`dist/` was rebuilt by the plain `npm run build` gate afterwards (201 modules; the probe's badge string
`363 t=` is absent from `dist/`).

## 3. Acceptance, clause by clause

Every "read" cites a capture a model looked at; paths are under `/private/tmp/3-6-3/`, detailed in the reading.

| Surface | EN | ES |
|---|---|---|
| Three trigger forms' controls (literal `trigger`, `regex`, `triggers` list) | **read** — `L01 c06` (literal), `L01 c09` and `L03 c06` (regex box + hint), `L01 c17`, `L03 c24`, `L30 c06` (list) | **read** — `L02 c06`, `L02 c09`, `L04 c06`, `L02 c17`, `L04 c24`, `L31 c06` |
| Form-switch buttons; switch preview with Confirm/Cancel; save withheld until confirmed | **read** — `L01 c06`, `c09`, `c11`, `c14` (cancel), `c17`, `c21` (confirmed), `c29` (save enabled). The *text edited* preview variant was not driven: **unread** | **read** — `L02` same captures |
| `Several` with the raw-repair sentence | **read** — `L05 c06`, `c09` (no choice buttons drawn) | **read** — `L06 c06`, `c09` |
| `Absent`, adding a form, its withheld save | **read** — `L05 c14`, `c17`, `c19`, `c25`. *Take back the added trigger* drawn, **not pressed** | **read** — `L06` same |
| `wouldDropAliases` refusal with its count | **read** — count 2 on a drafted list `L01 c24`; count 3 on a file list `L03 c24` | **read** — `L02 c24`; `L04 c24` |
| `RegexDoesNotCompile` finding with the draft kept | **read** — `L03 c14` (panel, *Keep editing* only), `c19` (box still `rx-(\d+`) | **read** — `L04 c14`, `c19` |
| List add/remove on `triggers` | **read** — `L01 c24` (add), `L03 c30` (remove), `c34` (add after remove), `L30 c14` (flow style) | **read** — `L02 c24`, `L04 c30`, `c34`, `L31 c14` |
| List add/remove on `search_terms`; absent → *Add this list* → empty → item | **read** — `L07 c06`, `c09`, `c12`, `c21`, `c25`, `c28` | **read** — `L08` same |
| Removed-list read-only items | **read** — `L07 c15` (0 boxes in the block, items as source text) | **read** — `L08 c15` |
| Recovery: carried regex row | **read** — `L22 c29`, `c32` (*Regular expression* box `rec-\d`) | **read** — `L24 c29`, `c32` |
| Recovery: carried `triggers` list row | **read in part** — `L23 c32`: a one-item list `:rec`, source text, no box. A carried list of several items: **unread** (open item 1) | **read in part** — `L25 c32`, same scope |
| Recovery: `search_terms` outcome | **read in part** — the *carried whole, in order* arm (`one`, `two`) in `L22 c32`, `L23 c32`. The empty-list and refused arms, and a carried **edited** list: **unread** (open item 1) | **read in part** — `L24 c32`, `L25 c32` |
| Commented multi-line flow list, `flow-collections.yml:16-22` (ruling 31) | **read** — `L28 c04`, `c06` | **read** — `L29 c04`, `c07` |

**Ruling 31, the exact screen and action seen.** Screen: the detail pane for the snippet `multi-line flow`.
Action: its row in the snippet list was clicked, then the pane was scrolled to *Source text*. Seen: the row
carries *Not editable* / *No editable*; the pane draws *"This app will not edit this snippet: this file
contains a comment inside an inline list or map."* (ES: *"Esta aplicación no editará este fragmento: este
archivo contiene un comentario dentro de una lista o un mapa en línea."*) and no *Edit this snippet* button;
the three triggers are listed with *Written between double quotes*; *Source text* draws the snippet's seven
lines as the file writes them, the `# first alias` comment and the lone `]` included. The match editor was
therefore never opened on it: its list controls and a save's bytes for that list are **unread**, because no
edit route is offered. The file on disk was byte-unchanged (`diff`). For comparison `:hi` (a one-line flow
list, line 5, same file) is editable, and its editor draws the flow style note and the `flowList` refusal
(`L30 c06`, `L31 c06`).

**Unread, and why:** real keyboard and pointer input on every control (§4.1 reserves it to a person); every
save of a trigger-form change or a list edit (none was pressed, so no file bytes after such a save were
seen in a window); *Take back the added trigger*; the *text edited* preview variant; pressing a recovery
form's *Create this snippet*; the items above marked unread in part.

**ES fit.** Nothing was seen clipped in Spanish. Longer ES text wraps: *Confirmar…* and *Cancelar…* stack on
two rows in the preview (`L02 c09`), the three *Añadir un disparador como: …* buttons take a row each
(`L06 c14`), and the offer sentence takes a third line.

## 4. Open items (noticed, not fixed here)

1. **A draft holding a list-item addition never drew the external-change panel.** In ten exploratory
   launches (L09–L16, L18, L20) whose draft added an item to `search_terms` or to a `triggers` list, the
   editor's external-change panel (with *Keep my draft*) was not found within the probe's ~30 s wait after the
   file was changed on disk — by removal, by a trigger change or by an in-place `sed` of `replace`. In the
   seven whose draft held no list-item edit (L17, L19, L21–L25) it was drawn within seconds. The cause was not
   investigated (records only); whether the conflict is detected and not drawn, drawn elsewhere, or not
   detected is **unknown**. It is a candidate defect in 3-6's reapply/observation path for a later phase to
   reproduce with a test, and it is why a carried multi-item `triggers` list and a carried *edited*
   `search_terms` list are unread in recovery.
2. **The commented multi-line flow list is not editable at all**: the whole snippet is refused for "a comment
   inside an inline list or map", so ruling 31's touch reaches only the refusal and the read-only detail. If
   editing such a list is wanted, that is new work for a later phase; if the refusal is intended, the record
   of step 3-6's acceptance ("block and flow lists keep their style") holds for comment-free flow lists only
   as far as a window shows.
3. **The regex finding's outcome panel opens with a sentence about shape**: *"The result contradicts the shape
   espansoConfig models for a snippet, so it was not saved."* above the regex finding (`L03 c14`). A wording
   question for the owner (§4.1).
4. **`Several` draws no choice of form at all** (`L05 c09`): the only route shown is the raw-repair sentence
   (3-6-2 open item 1, the missing one-click route, seen in a window).
5. Items taken out of a list and a removed list's items are drawn as grey source-text boxes similar in size to
   the editable boxes (`L03 c30`, `L07 c15`); whether they read clearly as not editable is a layout judgement
   reserved to a person.
6. The `wouldDropAliases` rows keep the **file's** count while items are drafted in or out (`L03 c34`: three
   boxes drafted, one item taken out, the row still says 3). Noted for a later phase to decide whether the
   count should follow the draft.
7. Unread and owed to a later reading if wanted: everything in §3's *Unread* paragraph.

## 5. Deviations

- **L09–L21 were exploratory** (building the recovery route and isolating open item 1) and are not credited
  except for the table in the reading; **L26/L27 were superseded** by L28/L29 because the flow plan assumed an
  *Edit* button the snippet does not have.
- The multi-line flow list surface was read as a refusal in the detail pane rather than as an editor, because
  the app offers no editor for it (open item 2).
- The recovery panel was reached through an external change (the snippet removed on disk, then *Keep my
  draft*), not through a save-time conflict.

## 6. Gates (run with the instrument present, after the last launch)

| Command | Exit | Result |
|---|---|---|
| `cargo test --workspace -- --test-threads=1 > /private/tmp/3-6-3-cargo.log 2>&1` | 0 | 31 `test result:` lines, 1430 passed, 0 failed, no `FAILED` |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | |
| `cargo fmt --check` | 0 | |
| `npm run check` | 0 | 466 files, 0 errors, 0 warnings |
| `npm test` | 0 | 3692 passed, 76 files |
| `npm run build` | 0 | 201 modules; server-only oracle: absent; client-only oracle: 2; no probe string in `dist/` |

`cargo tree -p espansoconfig-core | rg tauri` printed nothing. **Rung: 1430 / 466 / 3692 / 201**, unchanged
from the committed baseline: the instrument lies outside `tsconfig.json`'s `include`, outside vitest's
`include`, outside every lint scan root (`src`, `scripts`), and is imported by neither `index.html` nor
`vite.config.ts`; only the instrumented Tauri build counts it (202 modules).
