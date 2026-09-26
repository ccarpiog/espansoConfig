# Phase 3-13-3 — the window half of step 3-13: the reading, launch by launch

**Date:** 2026-09-26, an attended session (the owner present, the screen unlocked). **Spec:**
`docs/decisions/3-split-notes.md` §2 *3-13* and its 2026-09-24 addendum (the 3-13-3 bullet), ruling 30,
§4.1, §4.8; `docs/decisions/3-13-2-notes.md` §1 (what the components draw) and §5 (the unmeasured
line-feed claim). What changed and why, the instrument, the row classification and the open items are in
[`3-13-3-notes.md`](3-13-3-notes.md).

**Every statement below about what a window drew is a model's look** at a `screencapture -x -o -l <window>`
capture of the real Tauri app window, taken while `ioreg -n Root -d1` read `"IOConsoleLocked" = No`. It is
never the owner's judgement. **Every action on the page was a script-dispatched DOM event** (`.click()` on a
button, a `change` event on the language `<select>`, and `document.execCommand('insertText')` into a focused
text box, which fires the box's own `input` event) run by the uncommitted probe; none is real keyboard or
pointer input. No capture read is the lock screen: every one shows the app's own window (title bar
*espansoConfig*, header with the language picker, sidebar, list pane, detail pane, footer) with the probe's
badge. None is a hidden-page snapshot, and no mounted test is credited.

## How the launches were run

`instrument-3-13-3/launch.sh <n> <lang> 72`, following 3-11-3's script:

- A fresh scratch tree `/private/tmp/3-13-3/L<n>/`. The synthetic fixtures were copied into
  `…/xdg/espanso/`, plus a one-snippet marker file `match/probe-names-<lang>.yml`; the probe reads the
  language from its name. A pre-launch copy was kept in `…/before/`.
- **A scratch `HOME`** at `…/home`. The script wrote the seeded sidecar before the launch (below) to
  `…/home/Library/Application Support/cc.carpio.espansoConfig/workspaces/<digest>.json`, and kept a copy
  as `…/sidecar-before.json`.
- A fresh bundle copy `…/espansoConfig-L<n>.app`, launched with `open -n --env XDG_CONFIG_HOME=…/xdg --env
  HOME=…/home`. The process's environment was read back with `ps -E` into `launch.txt`: both variables
  point into the scratch tree in both launches.
- The main window was found with `/private/tmp/3-13-3/winid <pid>`.
- 72 captures about 1.1 s apart went into `…/caps/cNN.png` (2360 × 1520 px), with 1400-px copies in
  `…/small/`. The lock state was read before the launch, before every capture and after the launch, into
  `…/launch.txt`; the script stops at the first reading that is not `No`.
- After the last capture the app was killed. The tree was compared with `before/` (`disk.diff`), the
  sidecar with its seed (`sidecar.diff`), and the scratch home was listed (`home-listing.txt`).

**The seeded sidecar.** Nothing on screen sets `sortOrder` (3-13-2 §6 item 2), so the rank, one display
name and three defaults were **written into the scratch sidecar before launch**, in the version-1 format
(`src-tauri/src/sidecar/format.rs`). The root was `u:/private/tmp/3-13-3/L<n>/xdg/espanso`, and the file
name was the SHA-256 of the domain line `espansoconfig-sidecar-root/1\n` followed by that root. Two
entries were written:

- `u:match/bravo.yml`: `sortOrder` 2, a long display name, and `newSnippetDefaults` `word` = `"true"`,
  `propagate_case` = `"true"`, `force_mode` = `"clipboard"`.
- `u:match/charlie.yml`: `sortOrder` 1.

The EN name was *Everyday greetings, sign-offs and other neutral sample phrases for a long display name*
(86 characters). The ES name was *Saludos, despedidas y otras frases de ejemplo neutras para probar un
nombre visible largo* (89). The app read this file: its later rewrite kept both entries (`sidecar.diff`).

**The configuration was synthetic and neutral.** `config/default.yml` holds one comment line. Four match
files hold one snippet each: `alpha.yml` (`:alpha1`), `bravo.yml` (`:bravo1`), `charlie.yml`
(`:charlie1`) and the marker (`:marker`). Every capture shows only those paths.

**One plan, the same in both launches** (probe steps `s01` … `s15`, each held about 3.4–4.4 s):

1. Set the language through the picker, then read the sidebar.
2. Select `match/alpha.yml` in the sidebar and open *File preferences*.
3. Run the line-feed measurement in its display-name box (below).
4. Type a long display name into the box. Add a `force_mode` default and press its `keys` suggestion.
   Press *Save preferences*.
5. Read the sidebar again.
6. Press *Add a snippet* and choose `match/bravo.yml` as the destination. Read the seeded options (two
   scroll positions).
7. Press *Remove* on `propagate_case`.
8. Type `:created1` into the trigger box and `Created sample line` into the replacement.
9. Press *Add this snippet*, then read the sidebar.

The name typed in step 4 was *Second sample file, with a long name typed into the preferences control*
(EN, 71 characters) and *Segundo archivo de muestra, con un nombre largo escrito en el control de
preferencias* (ES, 85).

**The language was set through the in-app picker in both launches** (`#language-picker-select` set to `en`
or `es`, then `change`). Every capture cited shows the picker reading *English* / *Español*. The footer's
tail, *…uage: English* / *…rfaz: Español*, shows past the badge.

**The badge and the DOM line.** A yellow block over the bottom-left corner shows `3133 <lang> s<k> <step>`,
then `|| <DOM line>`, then `|| lf: <measurement>`. It is redrawn 500 ms after the step's action. Its words:

- `side=` the sidebar rows in order, with `*` marking a row that draws a display name.
- `prefs=` the preferences panel, open or closed; `save=` the save button, enabled (`e`) or disabled (`D`).
- `prefDefaults=` the defaults held in boxes; `outcomes=` the number of save-result lines.
- `creator opts=` each option's box value, `absent` when there is none, and `+` when the *From this file's
  defaults* mark is drawn.
- `dest=` the chosen destination; `create=` the *Add this snippet* button.

**A DOM line is DOM evidence, not a window reading**; it is cited beside the pixels, never instead of them.
A capture taken inside the 500 ms window can show the next step's pixels under the previous step's badge
(L01 `c34`: `bravo` already pressed and the seeding sentence drawn under the `s08` badge). Every citation
below was checked against the pixels.

## Launches and the lock state

| Launch | Lang | Window | Captures (times) | Lock before / every capture / after | Disk | Status |
|---|---|---|---|---|---|---|
| L01 | EN | 11364 | 72 (10:19:15–10:20:35) | No / No ×72 / No | `match/bravo.yml` gained one snippet; every other fixture byte-identical; `.espansoconfig-backups/` created | read |
| L02 | ES | 11396 | 72 (10:21:51–10:23:10) | No / No ×72 / No | the same | read |

In both launches `disk.diff` shows `match/bravo.yml` gaining exactly these four lines after `:bravo1`, and
nothing else in any fixture:

```
  - trigger: ':created1'
    replace: Created sample line
    word: 'true'
    force_mode: clipboard
```

`propagate_case` is absent: the removed default's key was not written. `word` was written as the
**quoted** string `'true'` (notes §5 item 1).

The sidecar was rewritten by the app with a new `u:match/alpha.yml` entry holding the typed name and
`newSnippetDefaults` `force_mode` = `"keys"`. Bravo's and charlie's entries came back unchanged, only
re-indented by the app's pretty-printer (`sidecar.diff`).

## What was seen

Paths are `/private/tmp/3-13-3/L<n>/small/cNN.png` unless named otherwise.

### 1. The sidebar: a display name with the path, and the rank order

(L01 `c05`, L02 `c05`.)

**Order.** Under *Files* / *Archivos* the rows run:

1. `match/charlie.yml` (rank 1).
2. The long display name, wrapped to three lines, then `match/bravo.yml` in smaller type beneath it (rank 2).
3. `match/alpha.yml`.
4. `match/probe-names-<lang>.yml`.

The last two are unranked, in workspace order after the ranked rows. `config/default.yml` is under
*Profiles* / *Perfiles*. DOM:
`side=All,charlie.yml,bravo.yml*,alpha.yml,probe-names-en.yml,config/default.yml` (ES `Todo,…`). The
workspace order without ranks would put `alpha` first, so the ranks visibly reorder the list.

**The path stays visible** under the name in both languages.

**The row's snippet count is drawn on its own line under the path**, left-aligned (`1` under
`match/bravo.yml`). Rows without a name draw the count at the right edge on the same line (notes §5 item 3).

After the save (L01 `c23`/`c25`, L02 `c25`), `match/alpha.yml` also draws its typed name above its path,
wrapped to three lines, with its count likewise on its own line. Its position is unchanged: it has no rank.

### 2. The new-snippet form: seeded defaults, one removed, created

**Before a destination** (L01 `c34`, under the `s08` badge): the form lists destinations by **path only**
(3-13-2 §6 item 1, now seen). `config/default.yml` is offered and refused with its reason.

**Seeded, before *Create*** (L01 `c36`, L02 `c36`, badge `s09`):

- Under *Options* / *Opciones*, the notice *The defaults saved for match/bravo.yml are filled in below.
  Each is written only if it is still here when you add the snippet, and you can change or remove any of
  them.* (ES *Abajo aparecen los valores predeterminados guardados para match/bravo.yml. …*).
- All seven options are drawn. Three carry the mark *From this file's defaults* / *De los valores
  predeterminados de este archivo*, each with a box and *Remove* / *Quitar*:
  - `word` `true`
  - `propagate_case` `true`
  - `force_mode` `clipboard`, with its `clipboard` and `keys` suggestions
- The other four read *Not set: the new snippet gets no such key.* / *Sin definir: el fragmento nuevo no
  recibe esta clave.* with *Add this option* / *Añadir esta opción*.
- DOM: `word+="true", propagate_case+="true", force_mode+="clipboard"`, the rest `absent`,
  `dest=match/bravo.yml`, `create=D` (no trigger yet: *A snippet needs the text that fires it.*).

**One removed** (L01 `c43`, L02 `c43`, badge `s11`): `propagate_case` now reads *Not set…* / *Sin
definir…* with *Add this option*. Its *From this file's defaults* mark is still drawn (notes §5 item 4).
`word` and `force_mode` keep their boxes. *Undo* / *Deshacer* is enabled. DOM `propagate_case+=absent`.

**Created** (L01 `c52`, L02 `c52`, badge `s13`):

- The outcome panel reads *The file was written. What is on disk now is exactly the text that was sent.* /
  *Se ha escrito el archivo. Lo que hay ahora en el disco es exactamente el texto que se envió.*, then the
  backup sentence and *Add another snippet* / *Añadir otro fragmento*.
- The sidebar count for `match/bravo.yml` is now `2`, and *All* / *Todo* reads `5`.
- `disk.diff` agrees and shows no `propagate_case` key (§ Launches).

**ES fit** (L02 `c36`, `c43`): the longer Spanish mark and sentences wrap inside the pane. The
`propagate_case` mark wraps onto its own line under the option name.

The pinned action block (*Deshacer*, *Rehacer*, *Añadir este fragmento*) cuts the option lines scrolling
past it mid-line (crop `L02/cmp-c36-actions.png`). The same pinned block is drawn in EN.

### 3. The preferences control: name and defaults saved, the sidecar lines

**Opened** (L01 `c10`, badge `s03`):

- *Close file preferences* above a panel headed *Preferences for match/alpha.yml*, and the sentence
  *espansoConfig keeps these preferences in its own folder. No espanso file is changed.*
- An empty *Display name* box with its hint.
- *Defaults for new snippets* with its hint. Each of the seven options reads *No default: a new snippet
  gets no such key.* with *Add a default*; suggestions are drawn where the option has them.
- DOM `save=D`, `outcomes=0`.
- ES (L02 `c14`): *Preferencias de match/alpha.yml*, *Nombre visible*, *Valores predeterminados para
  fragmentos nuevos*, *Sin valor predeterminado: …*, *Añadir un valor predeterminado*.

**No sidecar read line is drawn.** A sidecar that read as `Loaded` draws none by design
(`preferencesReadingLineOf` in `src/lib/browser/preferencesControl.ts` answers `null`). The five
non-loaded statuses were not reached.

**Name and default entered** (L01 `c19`, badge `s05`):

- `force_mode` holds a box with `keys`, *Remove the default*, and the suggestions `clipboard` and `keys`.
- Below the options is the sentence *Each box holds one line. A line break or a carriage return pasted
  into one is removed.*, then *Save preferences*.

**Saved** (L01 `c25`, L02 `c25`, badge `s06`):

- The save line *Preferences saved.* / *Preferencias guardadas.* is drawn under *Save preferences*, which
  is now grey. DOM `save=D outcomes=1`. The line's lower edge is under the badge, but its words are legible.
- The sidebar draws the new name above `match/alpha.yml` (DOM `alpha.yml*`).
- `sidecar.diff` shows the name and `force_mode` = `"keys"` written to the scratch sidecar.

### 4. The line-feed measurement

(L01 `c14`, full-resolution copy `L01/badge-c14.png`; L02 `c14`, badge `s04`. The same values in both launches.)

The probe measured four routes, in the shipped WKWebView, with the preferences control's display-name
`<input type="text">`:

| Route | What was put in | What the box held |
|---|---|---|
| `execCommand('insertText')` into the focused, selected box (the editing path, which fires the box's `input` event) | `one\ntwo` | `"one two"`, codes `111.110.101.32.116.119.111`: **the line feed became a space (32)**; command returned `true` |
| the same | `three\r\nfour` | `"three four"`: the pair became one space as drawn (codes not recorded for this case); `true` |
| a synthetic `paste` `ClipboardEvent` with `text/plain` | `five\nsix` | unchanged (`changed=false`): an untrusted paste has no default action |
| a synthetic `beforeinput` `insertFromPaste` | `seven\neight` | unchanged: untrusted, no default action |
| the `value` setter, on a probe-made `<input type="text">` | `nine\nten` | `"nineten"`: **deleted** |
| the `value` setter, on a probe-made `<textarea>` (control) | `nine\nten` | `"nine\nten"`: kept |

The box was drawn holding `three four`, highlighted (L01 `c14`, L02 `c14`).

**So the claim in 3-13-2 §2 D4 and §5 ("an `<input>` deletes carriage returns and line feeds") holds for
the `value` setter and not for text inserted through the editing path**, where WebKit replaced each line
break with one space. **A real paste (⌘V) was not measured**: it needs real input. Whether it follows the
editing path's replacement is therefore **unread**. The drawn sentences *A line break or a carriage return
pasted into one is removed.* / *…se elimina.* (the preferences control and the creator's option list) state
the deletion (notes §5 item 2).

## Rows not read

- **Real keyboard and pointer input**, including a real ⌘V paste of a line break: §4.1 reserves real
  input to a person.
- **The sidecar's non-loaded statuses and refused saves** (not writable, corrupt set aside, corrupt left in
  place, future schema, unreachable storage, the withdrawn save, the display-name and default refusals):
  the fixtures did not reach them.
- **A default seeded with a line feed drawn read-only, and one withheld for a carriage return**: not
  seeded.
- **`kept`** (a default not applied over a value the draft already held): not reached.
- **Wording clarity and layout acceptance**, including whether the count under a named row is acceptable:
  a person's judgement.
