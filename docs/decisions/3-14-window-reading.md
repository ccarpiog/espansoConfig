# Phase 3-14 — Delete-conflict wording and action placement (window reading)

**What this is:** a model's look (§4.1 of `3-split-notes.md`) at `screencapture -x -o -l <window>` captures
of the real Tauri window, taken on 2026-09-26 between 10:41:06 and 10:46:11 in the attended session, on an
unlocked screen. No owner judgement was sought or is claimed. Every action on the page was a
script-dispatched DOM event from the uncommitted instrument (`3-14-notes.md` §3), not real input. Mounted
jsdom evidence is not credited here as a screen.

## 1. The launches

Each launch: a fresh scratch tree under `/private/tmp/3-14/L<n>/`, a fresh bundle copy, synthetic fixtures
only, `XDG_CONFIG_HOME=/private/tmp/3-14/L<n>/xdg` and `HOME=/private/tmp/3-14/L<n>/home` (read back from
the process with `ps -E` into `launch.txt`). `"IOConsoleLocked" = No` before the launch, before every
capture and after the launch, in every launch. Every window was **1180x760** (`winid`), which is a
**1180x728 viewport** (`vp=1180x728` on the badge's DOM line). The language was set through the in-app
picker in each launch. `pgrep` found no process after each launch (`process gone`).

| Launch | Language | Route | Window appeared | Second writer | Captures | Result |
|---|---|---|---|---|---|---|
| L01 | EN | external | 10:41:07 | 10:41:20 | 36 | **superseded**: taken on the first build, which drew the readiness line above the disk version. It showed that line's shared sentence saying *"shown above"* of a disk version now drawn below it (`3-14-notes.md` §1.3). Not credited below. |
| L02 | EN | external | 10:42:38 | 10:42:50 | 34 | external-origin conflict, both reload steps |
| L03 | ES | external | 10:43:38 | 10:43:50 | 34 | external-origin conflict, both reload steps |
| L04 | EN | save | 10:44:27 | 10:44:37 | 42 | save-origin conflict, both reload steps |
| L05 | ES | save | 10:45:25 | 10:45:35 | 42 | save-origin conflict, both reload steps |

**The routes.**

- **External:** the deletion panel was opened on `:charlie` in `match/sample.yml` (26 synthetic
  snippets, so the disk version is long). The launch script then appended one synthetic snippet to that
  file, and the window's watcher raised the external conflict.
- **Save:** the panel was opened and *Delete it* pressed. The instrument's `core-shim.ts` held the
  `delete_match` IPC call for 13 s (shim log on the badge: *hold 13000ms … sent …*). During the hold the
  script appended the same snippet, so the core answered the deletion with a real save-origin conflict.
  The held watcher delivery was consumed by the session (no external panel appeared).

`disk.diff` in L02–L05 holds only the second writer's two appended lines: **nothing was deleted, and no
backup directory appeared.**

## 2. The badge

The instrument drew a yellow badge at the bottom left of the window (over the sidebar and the footer's
first words; it covers no part of the detail pane). Its DOM line gives:

- the viewport;
- the conflict panel's top;
- the choice row's `top`/`bottom` and whether it lies inside the viewport (`inView`);
- the disk-version heading's top;
- the number of times the merged paragraph occurs in the panel (`merged`), and whether either of the two
  replaced sentences, or the save origin's sentence, is present;
- the panel's buttons in document order (`tab=[…]`), which is the order Tab reaches them in, since no
  `tabindex` is set.

## 3. What each capture shows

Captures are `/private/tmp/3-14/L<n>/small/cNN.png` (the `sips -Z 1400` copies of `caps/`).

### 3.1 External origin (L02 EN, L03 ES)

- **First step, as the app's own reveal left it** (L02 `c15`, L03 `c16`, badge `s05`):
  - The panel starts at the top of the detail pane (`panel top=44`).
  - It draws, in order:
    1. the **one merged opening paragraph**;
    2. *What you asked for here is still set up…* / *Lo que pediste aquí sigue preparado…*;
    3. the reload warning;
    4. the observed revision;
    5. *What you asked for, kept here*, the operation, and the identity note;
    6. **the choice row** — *Leave this as it is · Keep what I asked for · Load the version on disk* /
       *Dejarlo como está · Conservar lo que he pedido · Cargar la versión del disco*;
    7. then *The version on disk* / *La versión del disco* and the file text, which runs past the
       window's bottom edge.
  - Row geometry: EN `choices top=333 bottom=356 inView=true`, disk heading at 366. ES
    `top=350 bottom=373 inView=true`, disk heading at 383.
  - Paragraph check: `merged=1 originOld=false fileOld=false refusedSave=false` in both languages.
  - Tab order: `[Leave this as | Keep what I as | Load the versi]` /
    `[Dejarlo como e | Conservar lo q | Cargar la vers]`.
- **Second step, after *Load the version on disk*** (L02 `c20`, L03 `c20`, badge `s06`):
  - The reveal brought the row into view with the second step's warning above it.
  - The row reads *Leave this as it is · Keep what I asked for · Close this and load it* /
    *… · Cerrar esto y cargarla*.
  - Geometry: EN `choices top=653 bottom=676 inView=true`; ES `top=667 bottom=689 inView=true`.
    The ES row's lower edge is about 39 px above the viewport's bottom.
- **Back to the first step, after *Leave this as it is*** (L02 `c23`, L03 `c23`, badge `s07`): the same
  as `s05`, with the conflict still standing.

The **merged paragraph as drawn**:

- EN: *What is compared here came from watching the file: it changed on disk while this panel was open.
  No save was initiated in response to this observation, so nothing was written from here in response to
  it, and this app cannot say what changed the file or when.*
- ES: *Lo que se compara aquí viene de la vigilancia del archivo: cambió en el disco mientras este panel
  estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, así que desde aquí
  no se ha escrito nada como respuesta a ella, y esta aplicación no puede decir qué cambió el archivo ni
  cuándo.*

### 3.2 Save origin (L04 EN, L05 ES)

- **First step, as the app's reveal left it** (L04 `c19`, L05 `c19`, badge `s05`):
  - The panel starts at the pane's top. It draws, in order:
    1. *Nothing was written…*;
    2. the refused-save line;
    3. the kept-request line;
    4. the reload warning;
    5. the save origin's sentence (`refusedSave=true`);
    6. the three revisions;
    7. *What you asked for, kept here*, the operation, and the identity note;
    8. **the choice row**;
    9. then the disk version, running past the bottom edge.
  - Row geometry: EN `choices top=474 bottom=496 inView=true`, disk heading at 507. ES
    `top=491 bottom=513 inView=true`, disk heading at 524.
  - `merged=0 originOld=false fileOld=false`: this panel never drew the external paragraphs, and still
    does not.
- **Second step** (L04 `c24`, L05 `c24`, badge `s06`):
  - The row is *… Close this and load it* / *… Cerrar esto y cargarla*.
  - Geometry: EN `choices top=666 bottom=688 inView=true`; ES `top=666 bottom=689 inView=true`.
- **After *Leave this as it is*** (L04 `c28`, L05 `c28`, badge `s07`): the outcome is put away
  (`dismissDeletionOutcome`, unchanged behaviour). The panel offers *Delete this snippet* /
  *Eliminar este fragmento* again, and the pane still says the file is not reconciled
  (`3-14-notes.md` §5 item 2).

## 4. Rows classed

| Row | EN | ES |
|---|---|---|
| External panel: choice row visible at 1180x728, before the disk version (first step) | **read** L02 `c15` | **read** L03 `c16` |
| External panel: second-step row visible | **read** L02 `c20` | **read** L03 `c20` |
| External panel: one merged opening paragraph, drawn once, neither replaced sentence present | **read** L02 `c15` | **read** L03 `c16` |
| Save panel: choice row visible at 1180x728, before the disk version (first step) | **read** L04 `c19` | **read** L05 `c19` |
| Save panel: second-step row visible | **read** L04 `c24` | **read** L05 `c24` |
| Keyboard order: buttons in document order, the row's own order unchanged | **read in part** (DOM order on the badge; no real Tab key was pressed) | **read in part** |
| Focus unchanged | **unread** (no real input; nothing in the change moves focus — `3-14-notes.md` §1.2) | **unread** |
| The readiness line under the disk version | **unread** (below the fold, by design; the mounted suite pins its position) | **unread** |
| The unknown-outcome acknowledgement's position after the row | **unread** (not staged: needs a write of unknown outcome) | **unread** |
| Wording acceptance by a person (§4.1) | **unread** | **unread** |

## 5. What this reading does not show

- It does not show what a **person** sees at another window size, or with a longer panel above. For
  example, a pane-level status block above the panel changes where the row lands when the reveal does
  not scroll.
- It does not show real keyboard or pointer input.
- It does not show the unknown-outcome state.
