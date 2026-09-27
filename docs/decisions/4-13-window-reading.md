# Phase 4-13 — Early authoring window half (window reading)

**What this is:** the reading of the real Tauri window for step 4-13 (`4-split-notes.md` §2 *4-13*,
ruling 29), taken on 2026-09-27 in the attended owner session on an unlocked screen. It holds two kinds
of evidence, and each row says which one it is:

- **A model's look** (`3-split-notes.md` §4.1) at `screencapture -x -o -l <window>` captures, where every
  action was a script-dispatched DOM event from the uncommitted instrument (`4-13-notes.md` §3), not real
  input. Launches L01 … L08 and L10 … L12.
- **The owner's real input and the owner's own judgements**, in launch L09. The owner typed with the
  keyboard and clicked with the pointer, and the orchestrator looked at `-l` captures of the window
  between the owner's turns.

Mounted jsdom evidence is not credited here as a screen. The owner's configuration was never opened:
every launch used synthetic fixtures in a scratch tree.

## 1. Build, placement and isolation

- **Build:** `npx tauri build --debug --bundles app --config '{"build":{"beforeBuildCommand":"npx vite
  build --config instrument-4-13/vite.config.ts"},"app":{"windows":[{"label":"main","title":"espansoConfig","width":1040,"height":1400,"x":3092,"y":-421,"minWidth":720,"minHeight":480,"resizable":true,"visible":true}]}}'`,
  exit 0, 236 modules each time (the tracked 234 plus `probe.ts` and `probe.css`). The builds:
  `build.log` (L01 … L05), `build2.log` (after L05, adding one badge field; L06 … L09), `build3.log`
  (after the B5 fix's first shape, `4-13-notes.md` §1; L10 and L11) and `build4.log` (after the review
  fix, `4-13-notes.md` §1.3; L12). Four builds in all. The `app.windows` array is replaced whole by the
  JSON merge, so the full window object was passed.
- **Placement:** the owner asked for the tests to run on the vertical display (27EA33; NSScreen frame
  `(3072, 249, 1080, 1920)` at scale 2, beside the main display `(0, 0, 3072, 1728)`). That display is
  1080 points wide, so the 1180×760 window every earlier reading used could not fit; the window was
  **1040×1400**, a **1040×1368 viewport**. Bounds read with a CGWindowList helper during L02:
  `X=3092 Y=-411 W=1040 H=1400`, inside the vertical display.
- **Isolation:** each launch a fresh scratch tree under `/private/tmp/4-13/L<n>/` and a fresh bundle copy,
  `HOME` and `XDG_CONFIG_HOME` inside it (read back from the process with `ps -E` into `launch.txt`).
  `"IOConsoleLocked" = No` before the launch, before every capture and after it. The language was set
  through the in-app picker in every launch. `pgrep` found no process after each one.
- **Captures:** `/private/tmp/4-13/L<n>/caps/`, 1400-px copies in `small/`. The badge (bottom left, over
  the sidebar) lags the screen by about one step, so captures are identified by content.

## 2. The launches

| L | Language | Route | Window | Captures | What the disk shows afterwards |
|---|---|---|---|---|---|
| L01 | EN | variables, A1 | 11:31:14 | 75 | `vars.yml`: the choice variable, `{{choice}}`, `word: true`, `propagate_case: true` |
| L02 | ES | variables, A1 | 11:33:07 | 75 | the same as L01 |
| L03 | EN | forms | 11:34:39 | 60 | no change |
| L04 | ES | forms | 11:35:49 | 60 | no change |
| L05 | EN | conflict | 11:36:59 | 70 | only the second writer's two lines |
| L06 | ES | conflict | 11:38:41 | 70 | only the second writer's two lines |
| L07 | EN | CR and CRLF | 11:40:03 | 45 | `crlf.yml`: a choice inserted, CRLF kept |
| L08 | ES | CR and CRLF | 11:41:02 | 45 | the same as L07 |
| L09 | EN | **owner** | 11:43:10 | owner-turn captures | `vars.yml` and `forms.yml` as §4 says; `conflict.yml` only the second writer's two lines |
| L10 | EN | conflict, after the B5 fix | 12:31:45 | 70 | only the second writer's two lines |
| L11 | ES | conflict, after the B5 fix | 12:33:08 | 70 | only the second writer's two lines |
| L12 | EN | conflict, after the review fix | 12:46:53 | 70 | only the second writer's two lines |

**The conflict route:** the instrument opened `:cf1` in `match/conflict.yml`, added the trigger item
`:cf1c` and edited the block-scalar layout to three lines; 20 s after the window appeared the launch
script appended one synthetic snippet holding a long single line, and the window's watcher raised the
external conflict.

## 3. Rows read by a model's look (scripted actions)

1. **Variable group, chips, list, dependency state** — L01 `c10`, L02 `c06`. Chips `who echo` and
   `mood choice`; the ordered list with its usage lines. Pressing `mood` mounts controls for it alone
   (badge `boxes=0` before any selection): name, type, the `inject_vars` box holding `false` with the D2u
   lines *"Written between single quotes / The box holds the text between the quotes / Left untouched, it
   keeps its quotes; any edit writes it without quotes"* (and their ES equivalents), the `values` list, and
   *Move to the top*.
2. **Choice insertion** — L01 `c16`, L02 `c10`. Provisional name `choice`, the verdict *"No name this
   snippet can see uses it."* / *"Ningún nombre que este fragmento pueda ver lo usa."*, target
   *Replacement text*, *Insert* disabled with *"A choice needs at least one value."* After *Insert*
   (L01 `c24`, `c29`; L02 `c16`): `{{choice}}` at the end of the replacement box, a third chip *"choice new
   in the draft"*, and *"The draft already adds a new variable. Save it before adding another."*
3. **Save, and item-owned comments** — L01 `c38`, L02 `c29`: *"The file was written…"*. The disk diff holds
   only line 5 (the reference) and six inserted lines after `inject_vars`; the three item-owned comments are
   byte-identical.
4. **A1** — L01 `c55`, `c68`; L02 `c68`. `word` and `propagate_case` typed `true`; after the save the file
   holds `word: true` and `propagate_case: true`, unquoted.
5. **Form builder, shorthand shape** — L03 `c06`/`c12`/`c20`/`c26`/`c30`, L04 `c12`/`c30`. *"The snippet's own
   form (form and form_fields)"*, the display with marked placeholders, rows `pick` (1 choice) and `lines`
   (1). The `pick` panel: a `type` box holding `choice` with suggestions, a `default` text area, `multiline`
   and `trim_string_values` as text boxes with `true`/`false` suggestions (no checkbox; badge
   `checkboxes=0`), `values` item by item with *Take out*, the new-values area, *Take this option out* and
   the removal preview. `lines` shows `multiline` = `true` as text. The *Add a field* panel (Field name;
   Text / Choice / List).
6. **Form builder, verbose shape** — L03 `c40`/`c44`/`c47`, L04 `c44`/`c48`. *"The form in the variable
   survey (layout and fields)"*, its own *Layout* box (the block scalar shown as two lines), the display,
   rows `answer` (1 list) and `notes`; the `answer` panel; the *Insert a form* panel (name `form`, *Layout*,
   *"Write the form's layout first."*).
7. **B1 and a block-scalar layout under an external change** — L05 `c14` (the draft), `c28`/`c33`/`c38`/`c45`;
   L06 `c28`/`c44`. The external panel is drawn. Its retained rows include *Triggers — this item would be
   added to the list — `:cf1c`* and *Layout — this text would be written* with the three block lines; badge
   `save.disabled=true roInputs=20`; the disk version shows the item-owned comment. Choices *Keep editing ·
   Copy my text · Keep my draft · Load the version on disk* (ES: *Seguir editando · Copiar mi texto ·
   Conservar mi borrador · Cargar la versión del disco*, on two rows).
8. **B5, the failing measurement (before the fix)** — L05/L06 badge, on the disk-version `SourceText`:
   `left=591 right=1016 clientWidth=423 scrollWidth=1832 overflow-x=auto white-space=pre scrollLeft=0`,
   panel right edge 1026, page `scrollWidth` 1040 = the viewport. **1409 CSS px of the long line were hidden
   beyond the box's right edge**, cut mid-word, with no visible scrollbar (macOS overlay scrollbars). The box
   stayed inside the panel; the page did not scroll sideways.
9. **The CR refusal at load** — L07 `c06`, L08 `c06`. `:crlayout`'s layout is drawn through `SourceText` with
   the `carriage return U+000D` / `retorno de carro U+000D` marker and the carriage-return sentence; no
   layout box (`layoutBoxes=0`) and no display. **The refusal at edit and at send is not reachable on
   screen**, because no box is drawn to edit or send from; it is carried by the mounted suites alone.
10. **CRLF untouched bytes** — L07/L08. `crlf.yml` went from 226 to 365 bytes; the common prefix is 162
    bytes and the common suffix 63; the only removed byte is the closing `"`, replaced by `{{choice}}"`
    and the new `vars` block; every inserted line ends in `\r\n`, and the result holds no bare LF
    (`crlf.cmp` in each launch).
11. **B5 after the fix, first shape** (per-line blocks, later replaced; `4-13-notes.md` §1.3) — L10 `c45`
    (EN), L11 `c45` (ES), badge on the same box:
    `left=591 right=1016 cw=423 sw=423 overflowX=visible ws=break-spaces scrollLeft=0 panelRight=1026`.
    **clientWidth equals scrollWidth: nothing is hidden.** Every file line starts with a `›` in a gutter;
    the long line and the long comment continue on indented rows with no `›`; the legend *"Each line of the
    file starts at a ›. A row without one continues the line above: the box wraps long lines, and the file
    has no line break there."* / *"Cada línea del archivo empieza con ›. …"* sits under the box.
12. **B5 after the review fix, the shape that shipped** — L12 `c45` (EN), badge on the same box:
    `left=591 right=1016 cw=423 sw=423 overflowX=visible ws=break-spaces scrollLeft=0 panelRight=1026`.
    Nothing is hidden. Every file line starts with a `›`; the long line and the long comment continue on
    rows that start at the box's left edge with no `›`; the legend is drawn. ES was not relaunched on this
    shape (`4-13-notes.md` §4 item 7).

## 4. Rows from the owner's real input (L09)

The owner set the language to English through the picker and did three things with the keyboard and the
pointer. The orchestrator compared the scratch files with `diff` after each.

1. **Choice insertion, real typing** — `match/vars.yml` › `:greet` › *Edit this snippet* › *Insert a choice*;
   the owner typed `red` and `blue` into the values box, pressed *Insert*, then *Save this snippet*. The
   file changed in exactly two places: `{{choice}}` appended to the replacement (where the caret was, so
   directly after `{{mood}}`) and six new lines defining `choice` with `red` and `blue`. Capture
   `L09/owner-p1-small.png`.
2. **Add a field to a verbose form, real typing** — `match/forms.yml` › `:verbose`; the owner clicked at the
   end of the form builder's *Layout* box, pressed Return, typed `Extra: `, pressed *Add a field*, typed
   `colour`, chose *Choice*, typed `small` and `large` into *Values, one per line* (the orchestrator's first
   instruction had left this step out; the button stays disabled until a value exists, and the sentence
   *"Give at least one value."* says so), pressed *Add the field* and saved. The file changed in exactly two
   places: the layout gained the line `Extra: [[colour]]` inside the block scalar, and the five-line
   `colour` definition went in after the existing fields. Captures `L09/owner-p2b-small.png`,
   `owner-p2c-small.png`.
3. **B1 with real input** — `match/conflict.yml` › `:cf1`; under *Triggers* the owner pressed *Add an item*
   and typed `:cf1c`, unsaved. The orchestrator then appended the `:written` snippet as the second writer.
   The external-change panel drew at once, the sidebar marked the file *Not reconciled*, and `:cf1c` was
   listed as *"this item would be added to the list"*. Capture `L09/owner-p3b-small.png` (it also shows O1
   and O5). The owner scrolled the disk-version box sideways and quit with ⌘Q without pressing a panel
   button; `conflict.yml` held only the second writer's two lines.

**The owner's judgements, verbatim:**

- **B5**, after scrolling the box sideways: *"Yeah, I can read it."* The owner then ruled to wrap
  (`4-13-notes.md` §0).
- **O8**: *"All the buttons at the top of the right side look confusing, there is not enough
  differentiation from the snippet content. It should be much clearer."* Screen: the detail pane with a
  snippet selected and no editor open, the seven actions (*Show this file's text* … *Duplicate this
  snippet…*) stacked one per row above the *TRIGGER* section in the content's own style. The owner asked
  for a note only.
- **O9**: asked to find *Triggers* in the `:cf1` editor, *"Where is Triggers?"*, and with it on screen,
  *"Where?"*. The list's label is small grey text under the bold *Trigger form* heading, weighted like the
  help sentences around it.
- **O10**: *"all text looks samey for a human, there is no clear way of finding sections, labels, etc.
  Clarity is paramount over design."*
- **D15 evidence**: asked to type into "the Layout box" of `:verbose`, the owner asked *"What is the
  "Layout box""*. The empty dormant *Form layout* content box and the form builder's *Layout* box, lower
  down under *Variables and fill-ins*, carry near-identical labels on one screen (`owner-p2b-small.png`).

**Seen during the owner's turns (a model's look at the captures):**

- **O7** — after a committed save the single-match editor stays open. Clicking another snippet highlights
  it in the list while the detail pane keeps showing the edited one, with no sentence saying why the click
  did not switch. It happened twice (`owner-p2a-small.png`: list on `:verbose`, pane on `vars.yml` ›
  `:greet`; `owner-p3a-small.png`: list on `:cf1`, pane on `forms.yml` › `:verbose`).

## 5. Observations from the scripted launches (a model's look; not fixed)

- **O1** — the 64-hex observed-revision line runs past the conflict panel's border (to x≈1035 against a
  border at 1026; L05 `c28`, L06 `c28`, L09 `owner-p3b`).
- **O2** — in the variable group the *Take out* buttons under each `values` item are full-width rows
  (L01 `c10`, L02 `c06`); in the form builder they sit compactly beside the item (L03 `c12`).
- **O3** — the ES form builder mixes register and terms: *"Escriba primero el diseño del formulario."*
  (usted) beside tú elsewhere, and *casilla* where the editor says *caja* (L04 `c12`, `c48`).
- **O4** — after a committed save the new chip still reads *"new in the draft"* / *"nueva en el borrador"*
  until the snippet is read again (L07 `c36`, L08 `c36`); the sentence above it says the analysis is out of
  step.
- **O5** — the conflict comparison lists every untouched field as a *"left as the file has it"* row with an
  empty sliver box: 17 rows before the ones that matter (L05 `c28`).
- **O6** — under an external change the group's insertion openers stay enabled (L06 badge `groupEnabled`:
  *Insert a choice* … *Add a variable*, *Insert a form*); only *Add a field* is disabled. Their forms
  withhold *Insert* (the 4-11 design), so there is no write path.
- **Sidebar** — a long file name, or the ES *Sin conciliar* badge, pushes the snippet count onto its own
  line (L06 `c28`).
- **D15** — the four empty dormant content boxes (*Markdown content*, *HTML content*, *Image path*, *Form
  layout*) with their sentence (L01 `c24`, L02 `c16`).

## 6. What is not read

- The CR refusal **at edit and at send** (row 9): no box is drawn, so no screen reaches it.
- **Every Spanish row is a model's look.** The owner's turn was in English only.
- A1, the variable group and the form builder under **real** input in Spanish were not repeated; the
  scripted ES launches (L02, L04, L06, L08, L11) are the Spanish evidence.
- No owner judgement of the Spanish wording was sought (O3's ruling is on register and term only; R35, the
  native-speaker review, stays owed).
